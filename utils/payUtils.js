/**
 * VIP 支付工具（H5 壳 + Android 微信/支付宝 + iOS 苹果内购）
 * =====================================================================
 * 完整链路：
 *   1) createVipOrder 统一下单（后端组装微信二次签名参数 / 支付宝 orderStr / IAP 商品 ID）
 *   2) NativePay 调起对应渠道（pay.wechat / pay.alipay / pay.iap）
 *   3) 等待结果：
 *      - 订阅 pay.onEvent（cancel/fail 提前终止；success 立即触发查单）
 *      - iOS IAP 的 success 事件携带 receipt：先调 verifyIapOrder 上报苹果收据
 *        完成验票入账（最多重试 3 次），再触发查单
 *      - 同时轮询 queryVipOrder 兜底（事件可能丢失，订单状态以后端为准；
 *        后端在轮询时会向微信/支付宝主动查单补偿掉单）
 *   4) 确认 paid 后调用 syncVipStatus 刷新本地 VIP 状态（Taku 分组 + adControl 全关）
 *
 * 环境限制：仅 H5 原生壳内可用（isNativeShell）；浏览器调试环境会直接报错提示。
 * =====================================================================
 */
import { isNativeShell, NativeApp, NativePay } from '@/utils/h5-native-bridge'
import { syncVipStatus } from '@/utils/vipUtils'
import vipApi from '@/api/vip/vip'

/** 轮询参数：间隔 2.5s，总超时 120s（覆盖用户跳出微信/支付宝再返回的耗时） */
const QUERY_INTERVAL = 2500
const QUERY_TIMEOUT = 120000

/** IAP 收据上报参数：最多重试 3 次，间隔 1.2s */
const IAP_VERIFY_RETRY = 3
const IAP_RETRY_INTERVAL = 1200

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 获取当前设备平台（'android' | 'ios'；非壳环境或识别失败返回 ''）
 * @returns {Promise<String>}
 */
export async function getPayPlatform() {
  if (!isNativeShell) return ''
  try {
    const info = await NativeApp.getInfo()
    const p = String((info && info.platform) || '').toLowerCase()
    return p === 'ios' ? 'ios' : (p === 'android' ? 'android' : p)
  } catch (e) {
    return ''
  }
}

/**
 * 获取当前平台默认可用的支付方式列表（用于页面渲染）
 * @param {String} platform getPayPlatform() 结果
 * @returns {Array<{ type: String, label: String }>}
 */
export function getPayChannels(platform) {
  if (platform === 'ios') {
    return [{ type: 'iap', label: 'Apple 内购' }]
  }
  return [
    { type: 'wechat', label: '微信支付' },
    { type: 'alipay', label: '支付宝' }
  ]
}

/**
 * 购买 VIP（统一下单 → 调起支付 → 等待结果 → 同步 VIP 状态）
 * @param {String} productId 商品档位 product_id（后端 vip_products.php 配置）
 * @param {Object} options
 * @param {String|Number} options.userId 用户 ID（必传）
 * @param {String} [options.payType] 支付方式 'wechat' | 'alipay' | 'iap'（缺省按平台自动选择）
 * @returns {Promise<{ orderNo: String, status: String, vipExpireDate: String }>}
 */
export async function purchaseVip(productId, options = {}) {
  if (!isNativeShell) {
    throw new Error('支付仅支持在云卫家 App 内使用')
  }
  const userId = options.userId
  if (!userId) {
    throw new Error('请先登录')
  }
  if (!productId) {
    throw new Error('请选择开通档位')
  }

  const platform = await getPayPlatform()
  if (!platform) {
    throw new Error('设备平台识别失败，请升级 App 后重试')
  }
  let payType = options.payType
  if (!payType) payType = platform === 'ios' ? 'iap' : 'wechat'
  if (platform === 'ios' && payType !== 'iap') {
    throw new Error('iOS 端请使用 Apple 内购')
  }
  if (platform !== 'ios' && payType === 'iap') {
    throw new Error('Apple 内购仅支持 iOS 端')
  }

  // 1) 统一下单
  const res = await vipApi.createVipOrder({
    user_id: userId,
    product_id: productId,
    pay_type: payType,
    platform
  })
  const order = (res && Array.isArray(res.data) && res.data[0]) || {}
  if (!order.order_no) {
    throw new Error('下单失败，请稍后重试')
  }
  const orderNo = String(order.order_no)

  // 2) 调起支付
  if (payType === 'wechat') {
    if (!order.pay_params) throw new Error('微信支付参数缺失，请稍后重试')
    await NativePay.wechatPay(order.pay_params)
  } else if (payType === 'alipay') {
    if (!order.order_str) throw new Error('支付宝支付参数缺失，请稍后重试')
    await NativePay.alipayPay(order.order_str)
  } else {
    // IAP：原生 StoreKit 购买；成功事件经 pay.onEvent 回传（含 receipt），此处仅调起
    await NativePay.iapPay({ productId: order.ios_iap_id || '', orderNo })
  }

  // 3) 等待结果（事件 + 轮询）
  return await waitForOrderPaid(userId, orderNo, { payType })
}

/**
 * 查询订单并等待支付完成
 * @param {String|Number} userId
 * @param {String} orderNo
 * @param {Object} [options]
 * @param {String} [options.payType] 用于匹配 pay.onEvent 的渠道（可选）
 * @returns {Promise<{ orderNo, status, vipExpireDate }>}
 */
export function waitForOrderPaid(userId, orderNo, options = {}) {
  return new Promise((resolve, reject) => {
    let finished = false
    let checking = false
    let unsub = null
    const startTime = Date.now()

    const finish = (isOk, payload) => {
      if (finished) return
      finished = true
      if (unsub) {
        try { unsub() } catch (e) {}
      }
      if (isOk) resolve(payload)
      else reject(payload)
    }

    /** 单次查单；未支付则按间隔重试直到超时 */
    const check = async () => {
      if (finished || checking) return
      checking = true
      try {
        const res = await vipApi.queryVipOrder({ user_id: userId, order_no: orderNo })
        const row = (res && Array.isArray(res.data) && res.data[0]) || {}
        const status = String(row.status || '')
        if (status === 'paid') {
          // 开通成功：刷新 VIP 状态（Taku 分组 + 广告全关）
          try { await syncVipStatus(userId) } catch (e) {}
          finish(true, {
            orderNo,
            status: 'paid',
            vipExpireDate: row.vip_expire_date || ''
          })
          return
        }
        if (status === 'failed') {
          finish(false, new Error('订单已关闭或支付失败，请重新下单'))
          return
        }
      } catch (e) {
        // 网络异常：继续尝试（最后一次超时会统一提示）
      } finally {
        checking = false
      }
      if (finished) return
      if (Date.now() - startTime >= QUERY_TIMEOUT) {
        finish(false, new Error('支付结果确认超时，如已扣款请稍后在会员中心查看'))
        return
      }
      setTimeout(check, QUERY_INTERVAL)
    }

    /**
     * IAP：把原生回传的 receipt 上报后端验票入账（订单状态改由后端维护）
     * @param {String} targetOrderNo 目标订单号（当前单或历史恢复单）
     * @param {Object} evt pay.onEvent 载荷（含 receipt / transactionId / productId）
     */
    const verifyIapReceipt = async (targetOrderNo, evt) => {
      const receipt = String((evt && evt.receipt) || '')
      if (receipt.length < 100) {
        throw new Error('收据数据缺失，无法验证购买')
      }
      const payload = {
        user_id: userId,
        order_no: targetOrderNo,
        receipt,
        transaction_id: (evt && evt.transactionId) || '',
        product_id: (evt && evt.productId) || ''
      }
      let lastErr = null
      for (let i = 0; i < IAP_VERIFY_RETRY; i++) {
        try {
          return await vipApi.verifyIapOrder(payload)
        } catch (e) {
          lastErr = e
          // 确定性业务失败（凭证被占用/订单归属不符/订单已关闭）重试无意义，直接抛出
          const msg = String((e && (e.msg || e.message)) || '')
          if (msg && (msg.indexOf('不属于') >= 0 || msg.indexOf('已用于') >= 0 ||
              msg.indexOf('未找到与订单匹配') >= 0 || msg.indexOf('已关闭') >= 0)) {
            throw e
          }
          await sleep(IAP_RETRY_INTERVAL)
        }
      }
      throw lastErr || new Error('收据验证失败，请稍后重试')
    }

    /**
     * IAP 支付成功事件处理：
     *   - evt.orderNo 为历史未入账订单（≠ 当前单）→ 静默补验该单，不影响当前流程；
     *   - 否则上报当前订单 receipt → 再触发查单确认最终状态
     */
    const handleIapSuccess = async (evt) => {
      const evtOrderNo = evt && evt.orderNo ? String(evt.orderNo) : ''
      if (evtOrderNo && evtOrderNo !== orderNo) {
        // 恢复场景：原生在本次购买流程中投递了历史成功订单，帮其补验入账（后台静默）
        verifyIapReceipt(evtOrderNo, evt).catch((e) => {
          console.warn('[payUtils] 历史 IAP 订单补验失败', evtOrderNo, e)
        })
        return
      }
      if (finished) return
      try {
        await verifyIapReceipt(orderNo, evt)
      } catch (e) {
        // 上报失败不终止：继续查单（后端可能已经入账），轮询阶段仍可确认
        console.warn('[payUtils] IAP 收据上报失败', e)
      }
      check()
    }

    // 事件提前终止（事件丢失时由轮询兜底）
    unsub = NativePay.subscribe((evt) => {
      evt = evt || {}
      if (options.payType && evt.channel && evt.channel !== options.payType) return
      if (evt.event === 'pay.cancel') {
        finish(false, new Error('已取消支付'))
      } else if (evt.event === 'pay.fail') {
        finish(false, new Error(evt.msg || '支付失败，请稍后重试'))
      } else if (evt.event === 'pay.success') {
        if (options.payType === 'iap') {
          // IAP：先上报 receipt 验票入账，再查单（订单状态以后端为准）
          handleIapSuccess(evt)
        } else {
          // 立即触发一次查单（订单状态以后端为准）
          check()
        }
      }
    })

    // 立即首查 + 周期轮询
    check()
  })
}

export default { purchaseVip, waitForOrderPaid, getPayPlatform, getPayChannels }

/**
 * VIP 免广告工具（真实会员状态版）
 *
 * 状态来源：后端 getVipStatus 接口（唯一事实来源），登录成功 / 开通成功后调用
 * syncVipStatus() 拉取；退出登录调用 clearVip() 清除。
 *
 * 状态存储与 common/taku-sdk.js 共用同一个键（USER_TYPE_STORAGE_KEY = 'taku_user_type'），
 * 取值 'vip' | 'normal'：
 *   - 冷启动：TakuAds.init() 读取该键随参数下发给原生 → 原生在 ATSDK.init 之前
 *     调用 initCustomMap（user_type=vip），保证「开屏」等首个请求即命中 Taku 后台的 VIP 流量分组；
 *   - 运行中：setVipMode() 立即调用 TakuAds.setUserType() 更新原生分组规则（后续请求生效），
 *     并把 H5 广告开关（adControl）置为全关（NONE），双重保障立即免广告。
 *
 * 另存 taku_vip_expire（到期时间）：isVip() 过期兜底 + 展示用。
 */
import TakuAds, { USER_TYPE_STORAGE_KEY } from '@/common/taku-sdk'
import { useAdControlStore, AD_CONTROL_TYPES } from '@/store/modules/adControl'
import vipApi from '@/api/vip/vip'

/** VIP 到期时间存储键（'YYYY-MM-DD HH:mm:ss'） */
export const VIP_EXPIRE_STORAGE_KEY = 'taku_vip_expire'

/** 解析 'YYYY-MM-DD HH:mm:ss' 为时间戳（替换 - 为 / 兼容 iOS 日期解析）；无效返回 0 */
function parseExpireTime(str) {
  if (!str) return 0
  const t = new Date(String(str).replace(/-/g, '/')).getTime()
  return isNaN(t) ? 0 : t
}

/** 读取当前用户类型（'vip' | 'normal'），默认 normal */
export function getUserType() {
  try {
    return uni.getStorageSync(USER_TYPE_STORAGE_KEY) || 'normal'
  } catch (e) {
    return 'normal'
  }
}

/** 读取本地缓存的会员到期时间（字符串，可能为空） */
export function getVipExpireDate() {
  try {
    return uni.getStorageSync(VIP_EXPIRE_STORAGE_KEY) || ''
  } catch (e) {
    return ''
  }
}

/**
 * 是否 VIP：
 *   user_type === 'vip' 且（未记录到期时间 → 以 user_type 为准；已记录 → 需未过期）。
 * 过期判断仅作本地兜底，最终以服务端 syncVipStatus 结果为准。
 */
export function isVip() {
  if (getUserType() !== 'vip') return false
  const ts = parseExpireTime(getVipExpireDate())
  if (ts > 0 && ts < Date.now()) {
    return false // 本地缓存显示已过期：视为非 VIP（等待服务端校准）
  }
  return true
}

/**
 * 设置 VIP 状态：
 *   1) 写本地缓存 + 通知原生更新 Taku 流量分组（后续广告请求生效，下次冷启动开屏也生效）；
 *   2) H5 侧兜底：开启 VIP 时广告全关（adControl=NONE）；
 *      关闭 VIP 时不在此恢复——由登录/房间列表流程重新计算广告类型（见 store/modules/user.js）。
 * @param {Boolean} enabled 是否 VIP
 * @param {String} [expireDate] 到期时间 'YYYY-MM-DD HH:mm:ss'（可选，随状态一起缓存）
 * @param {String|Number} [userId] 用户 ID（可选，透传原生哈希后上报 Taku 对账；退登缺省则清除）
 */
export function setVipMode(enabled, expireDate, userId) {
  const type = enabled ? 'vip' : 'normal'
  TakuAds.setUserType(type, userId) // 内部含 storage 写入 + 原生桥接通知（ad.setUserType）
  try {
    if (expireDate) {
      uni.setStorageSync(VIP_EXPIRE_STORAGE_KEY, expireDate)
    } else if (!enabled) {
      uni.removeStorageSync(VIP_EXPIRE_STORAGE_KEY)
    }
  } catch (e) {
    console.error('[VIP] 到期时间缓存失败', e)
  }
  if (enabled) {
    applyVipAdControl()
  }
  console.log(
    '[VIP] 状态更新:',
    enabled ? '已开通（广告全部关闭）' : '已关闭（等待登录流程重算广告类型）',
    expireDate || ''
  )
  return type
}

/**
 * 从后端同步真实会员状态（登录成功 / 开通成功后调用）。
 * 静默请求（不弹 loading）；失败时保持本地缓存状态，不阻塞主流程。
 * @param {String|Number} userId 用户 ID
 * @returns {Promise<Boolean>} 同步后的 VIP 状态
 */
export async function syncVipStatus(userId) {
  if (!userId) return isVip()
  try {
    const res = await vipApi.getVipStatus(userId, { showLoading: false })
    const row = (res && Array.isArray(res.data) && res.data[0]) || {}
    const isVipNow = String(row.is_vip) === '1'
    setVipMode(isVipNow, row.vip_expire_date || '', userId)
    console.log('[VIP] 服务端状态同步:', isVipNow ? 'VIP' : '普通用户', row.vip_expire_date || '')
    return isVipNow
  } catch (e) {
    console.warn('[VIP] syncVipStatus 失败（保持本地缓存状态）', e)
    return isVip()
  }
}

/** 退出登录：清除 VIP 状态（user_type → normal + 清空到期时间缓存） */
export function clearVip() {
  setVipMode(false)
}

/**
 * 把 VIP 状态应用到 H5 广告开关：VIP → 全关（NONE）。
 * 供登录/房间广告类型计算处调用（见 store/modules/user.js updateRoomList）。
 * @returns {Boolean} true = VIP 已拦截（调用方应跳过正常广告类型设置）；false = 非 VIP（按正常流程处理）
 */
export function applyVipAdControl() {
  if (!isVip()) return false
  try {
    const adControlStore = useAdControlStore()
    adControlStore.setAdType(AD_CONTROL_TYPES.NONE)
    console.log('[VIP] 免广告生效：广告控制类型置为 NONE')
  } catch (e) {
    console.error('[VIP] applyVipAdControl 失败', e)
  }
  return true
}

// 调试钩子：WebView 调试台（chrome://inspect）中可直接执行：
//   __setVipMode(true) / __setVipMode(false)  → 本地切换（绕过接口，仅调试用）
//   __syncVip(123)                            → 按用户 ID 从服务端拉取真实状态
if (typeof window !== 'undefined') {
  window.__setVipMode = setVipMode
  window.__isVip = isVip
  window.__syncVip = syncVipStatus
}

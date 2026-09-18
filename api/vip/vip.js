import request from '@/utils/request'
const BASE_API = '/yefiot/v1/';

// ==================== VIP 会员接口 ====================
// 后端实现：backend-vip-php/v1/（PHP 直连模式，部署到服务器 yefiot/v1/ 下）
// 接口风格与现有接口一致：POST JSON，成功 code === "0"，数据在 data 数组

export default {
  // 查询会员状态 { user_id } → data: [{ user_id, is_vip, vip_expire_date }]
  getVipStatus(user_id, options = {}) {
    return request({
      url: BASE_API + 'getVipStatus/',
      method: 'post',
      data: { user_id },
      showLoading: false,
      ...options
    })
  },

  // 商品档位列表 { platform } → data: [{ product_id, title, months, price, original_price, recommend, ios_iap_id }]
  getVipProducts(platform, options = {}) {
    return request({
      url: BASE_API + 'getVipProducts/',
      method: 'post',
      data: { platform: platform || '' },
      showLoading: false,
      ...options
    })
  },

  // 创建订单 { user_id, product_id, pay_type, platform }
  //   → data: [{ order_no, pay_type, pay_params: {...} | order_str }]（微信/支付宝支付参数）
  createVipOrder(data, options = {}) {
    return request({
      url: BASE_API + 'createVipOrder/',
      method: 'post',
      data: {
        user_id: data.user_id,
        product_id: data.product_id,
        pay_type: data.pay_type,
        platform: data.platform
      },
      showLoading: false,
      ...options
    })
  },

  // 查询订单 { user_id, order_no } → data: [{ status, vip_expire_date }]
  //   status: 'paid' | 'pending' | 'failed' | 'closed'
  queryVipOrder(data, options = {}) {
    return request({
      url: BASE_API + 'queryVipOrder/',
      method: 'post',
      data: {
        user_id: data.user_id,
        order_no: data.order_no
      },
      showLoading: false,
      ...options
    })
  },

  // IAP 票据校验（iOS） { user_id, order_no, receipt } → data: [{ status, vip_expire_date }]
  verifyIapOrder(data, options = {}) {
    return request({
      url: BASE_API + 'verifyIapOrder/',
      method: 'post',
      data: {
        user_id: data.user_id,
        order_no: data.order_no,
        receipt: data.receipt,
        transaction_id: data.transaction_id || '',
        product_id: data.product_id || ''
      },
      showLoading: false,
      ...options
    })
  }
}

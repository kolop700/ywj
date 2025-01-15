import request from '@/utils/request'
const BASE_API = '/yefiot/v1/';

// 添加默认配置
const defaultOptions = {
  showLoading: true
}

export default {
  // 登录
  UserLogin(data, options = {}) {
    return request({
      url: BASE_API + 'UserLogin/',
      method: 'post',
      data: {
        app_phone_mac: data.app_phone_mac || "0",
        app_login_type: data.app_login_type || "2",
        user_acct: data.user_acct,
        user_password: data.user_password
      },
      ...defaultOptions,  // 默认配置
      ...options         // 自定义配置可覆盖默认配置
    })
  },
  // 发送验证码
  sendSMS(phone, verifyCode, options = {}) {
    return request({
      url: BASE_API + 'sendMSM/',
      method: 'post',
      data: {
        mob: phone,
        msg_info: verifyCode,
        msm_type: 0,
        sign_appid: "wx6a5561be592cc61d"
      },
      ...defaultOptions,
      ...options
    })
  },
  // 注册
  UserRegister(data, options = {}) {
    return request({
      url: BASE_API + 'UserRegister/',
      method: 'post',
      data: {
        user_acct: data.phone,
        user_password: data.password,
        user_name: data.name,
        user_sex: data.gender === '男' ? '1' : '2',
        user_identity_card: "",
        user_card_b: ""
      },
      ...defaultOptions,
      ...options
    })
  },
  // 重置密码
  resetPassword(data, options = {}) {
    return request({
      url: BASE_API + 'changePwd/',
      method: 'post',
      data: {
        user_acct: data.phone,
        user_id: 0,
        user_password: data.newPassword
      },
      ...defaultOptions,
      ...options
    })
  },
  // 获取用户房间列表
  getUserRoomList(user_id, options = {}) {
    return request({
      url: BASE_API + 'getUserRoomList/',
      method: 'post',
      data: {
        user_id
      },
      ...defaultOptions,
      ...options
    })
  },
  // 绑定用户房间
  bindUserRoom(data, options = {}) {
    return request({
      url: BASE_API + 'bindUserRoom/',
      method: 'post',
      data: {
        room_id: data.room_id,
        user_id: data.user_id,
        auto_author: data.auto_author || "0"
      },
      ...defaultOptions,
      ...options
    })
  }
} 
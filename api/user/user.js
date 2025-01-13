import request from '@/utils/request'
const BASE_API = '/yefiot/v1/';

export default {
  // 登录
  UserLogin(data) {
    return request({
      url: BASE_API + 'UserLogin/',
      method: 'post',
      data: {
        app_phone_mac: data.app_phone_mac || "0",
        app_login_type: data.app_login_type || "2",
        user_acct: data.user_acct,
        user_password: data.user_password
      }
    })
  },
  // 发送验证码
  sendSMS(phone, verifyCode) {
    return request({
      url: BASE_API + 'sendMSM/',
      method: 'post',
      data: {
        mob: phone,
        msg_info: verifyCode,  // 使用传入的验证码
        msm_type: 0,
        sign_appid: "wx6a5561be592cc61d"
      }
    })
  },
  // 注册
  UserRegister(data) {
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
      }
    })
  }
} 
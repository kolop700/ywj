import request from '@/utils/request'
const BASE_API = '/yefiot/v1/';
// 用户登录
export function UserLogin(data) {
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
}
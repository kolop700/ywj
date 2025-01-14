import request from '@/utils/request'
const BASE_API = '/yefiot/v1/';

export default {
  // 获取设备列表
  getDoorList(user_id) {
    return request({
      url: BASE_API + 'getDoorList/',
      method: 'post',
      data: {
        app_phone_mac: "",
        user_id
      }
    })
  },

  // 发送开门请求
  openDoor(params) {
    return request({
      url: BASE_API + 'mqttpost/',
      method: 'post',
      data: params
    })
  }
} 
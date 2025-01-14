import request from '@/utils/request'

const BASE_API = '/yefiot/v1/'

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
  },

  // 获取单元列表
  getUnitList(data) {
    return request({
      url: BASE_API + 'getUnitLike/',
      method: 'post',
      data
    })
  },

  // 获取房间列表
  getRoomList(unit_id) {
    return request({
      url: BASE_API + 'getRoomList/',
      method: 'post',
      data: {
        unit_id
      }
    })
  },

  // 通过二维码获取单元信息
  getUnitByQRCode(qrCode) {
    return request({
      url: BASE_API + 'openSQL/',
      method: 'post',
      data: {
        sql: `CALL GetUnitNameByQRCode(''${qrCode}'')`
      }
    })
  }
} 
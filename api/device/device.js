import request from '@/utils/request'

const BASE_API = '/yefiot/v1/'

// 添加默认配置
const defaultOptions = {
  showLoading: true
}

export default {
  // 获取设备列表
  getDoorList(user_id, options = {}) {
    return request({
      url: BASE_API + 'getDoorList/',
      method: 'post',
      data: {
        app_phone_mac: "",
        user_id
      },
      ...defaultOptions,
      ...options
    })
  },

  // 发送开门请求
  openDoor(params, options = {}) {
    return request({
      url: BASE_API + 'mqttpost/',
      method: 'post',
      data: params,
      ...defaultOptions,
      ...options
    })
  },

  // 获取单元列表
  getUnitList(data, options = {}) {
    return request({
      url: BASE_API + 'getUnitLike/',
      method: 'post',
      data,
      ...defaultOptions,
      ...options
    })
  },

  // 获取房间列表
  getRoomList(unit_id, options = {}) {
    return request({
      url: BASE_API + 'getRoomList/',
      method: 'post',
      data: {
        unit_id
      },
      ...defaultOptions,
      ...options
    })
  },

  // 通过二维码获取单元信息
  getUnitByQRCode(qrCode, options = {}) {
    return request({
      url: BASE_API + 'openSQL/',
      method: 'post',
      data: {
        sql: `CALL GetUnitNameByQRCode(''${qrCode}'')`
      },
      ...defaultOptions,
      ...options
    })
  }
} 
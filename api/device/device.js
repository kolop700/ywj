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
  },

  // 获取远程开门设备列表
  getRemoteOpenDoorList(userId, options = {}) {
    return request({
      url: BASE_API + 'openSQL/',
      method: 'post',
      data: {
        sql: `CALL get_remote_open_door_list('''',${userId})`
      },
      ...defaultOptions,
      ...options
    })
  },

  // 保存临时密钥
  saveTempKey(params, options = {}) {
    return request({
      url: BASE_API + 'uptempkey/',
      method: 'post',
      data: params,
      ...defaultOptions,
      ...options
    })
  },

  // 验证访客密码
  checkTempPassword(params, options = {}) {
    return request({
      url: BASE_API + 'checkTempPsw/',
      method: 'post',
      data: {
        OpenPassword: params.password,
        qrcode: params.deviceNumber,
        sn: params.sn
      },
      ...defaultOptions,
      ...options
    })
  },

  // 访客密码开门
  tempPasswordOpen(params, options = {}) {
    return request({
      url: BASE_API + 'temppswOpen/',
      method: 'post',
      data: {
        openid: "0",
        qrcode: params.deviceNumber,
        sn: params.sn
      },
      ...defaultOptions,
      ...options
    })
  }
} 
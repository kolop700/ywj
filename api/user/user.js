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
   // 修改
   updateUserInfo(data, options = {}) {
    return request({
      url: BASE_API + 'UserRegister/',
      method: 'post',
      data: {
        user_acct: data.phone,
        user_password: data.password,
        user_name: data.name,
        user_sex: data.gender,
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
      url: BASE_API + 'openSQL/',
      method: 'post',
     data: {
       sql: `SELECT * FROM v_room_ad_user WHERE user_id =  ''${user_id}''`
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
  },
  // 上传用户人脸图片
  uploadUserFacePic(filePath, userAcct, options = {}) {
    return new Promise((resolve, reject) => {
      uni.uploadFile({
        url: process.env.NODE_ENV === 'development' && process.env.UNI_PLATFORM === 'h5' 
          ? '/yefiot/v1/uploadUserFacePic/'  // 开发环境使用代理
          : 'https://xy.yefiot.com/yefiot/v1/uploadUserFacePic/', // 生产环境使用完整URL
        filePath: filePath,
        name: 'file',
        formData: {
          user: userAcct
        },
        success: (res) => {
          // uploadFile 返回的数据是字符串，需要手动转换成对象
          const data = JSON.parse(res.data)
          resolve(data)
        },
        fail: (err) => {
          reject(err)
        }
      })
    })
  },
  // 获取应用版本信息
  getAppVersion(options = {}) {
    return request({
      url: BASE_API + 'getAppVer/',
      method: 'post',
      data: {
        app_no: '1'  // 固定传入 app_no: 1
      },
      ...defaultOptions,
      ...options
    })
  },
  // 注销账号
  deleteAccount(user_id, options = {}) {
   console.log('注销账号', user_id)
   return request({
     url: BASE_API + 'openSQL/',
     method: 'post',
     data: {
       sql: `UPDATE t_app_user SET user_password = ''111222333'' WHERE user_id = ''${user_id}''`
     },
     ...defaultOptions,
     ...options
   })
  },
  // 获取是否是管理员用户
  getUserStatus(user_id, options = {}) {
    return request({
      url: BASE_API + 'openSQL/',
      method: 'post',
      data: {
        sql: `SELECT * FROM t_room_user WHERE user_id =  ''${user_id}'' AND user_type = 2`
      },
      ...defaultOptions,
      ...options
    })
  }
} 
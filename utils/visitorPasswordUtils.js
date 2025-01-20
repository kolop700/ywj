import request from '@/utils/request'

class VisitorPasswordUtils {
  // 处理开门响应
  handleOpenResponse(res) {
    console.log('开门响应:', res)
      const { msg_info } = res.data[0]
      console.log('开门响应:', msg_info)
      switch (msg_info) {
        case 'HD2BB69W':
          uni.showToast({
            title: '开门成功!',
            icon: 'success',
            duration: 3000
          })
          return true

        case 'HD3BB68W':
          uni.showToast({
            title: '数据同步成功!',
            icon: 'none',
            duration: 1000
          })
          return true

        case 'HD3AA79W':
          uni.showToast({
            title: `数据同步失败(${msg_info})!`,
            icon: 'none',
            duration: 3000
          })
          return false

        case 'HD2AA78W':
          uni.showToast({
            title: `开门失败(${msg_info})!`,
            icon: 'none',
            duration: 3000
          })
          return false

        default:
          uni.showToast({
            title: '开门失败!',
            icon: 'error',
            duration: 3000
          })
          return false
      }
  }

  // 验证访客密码
  async verifyPassword(params) {
    try {
      const res = await request({
        url: '/yefiot/v1/checkTempPsw/',
        method: 'post',
        data: {
          OpenPassword: params.password,
          qrcode: params.deviceNumber,
          sn: params.sn
        }
      })
      
      if (res.code === 0 || res.code === '0') {
        return { success: true, sn: params.sn }
      } else {
        uni.showToast({
          title: res.msg || '密码错误或已过期',
          icon: 'none'
        })
        return { success: false }
      }
    } catch (error) {
      console.error('访客密码验证失败:', error)
      uni.showToast({
        title: '验证失败，请重试',
        icon: 'none'
      })
      return { success: false }
    }
  }

  // 访客密码开门
  async openDoor(params) {
    try {
      const res = await request({
        url: '/yefiot/v1/temppswOpen/',
        method: 'post',
        data: {
          openid: "0",
          qrcode: params.deviceNumber,
          sn: params.sn
        }
      })
      
      return this.handleOpenResponse(res)
    } catch (error) {
       return this.handleOpenResponse(error)
    }
  }
}

export default new VisitorPasswordUtils() 
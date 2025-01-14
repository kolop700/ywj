import { useUserStore } from '@/store/modules/user'

// 使用与 request.js 相同的基础URL配置
const BASE_URL = process.env.NODE_ENV === 'development' && process.env.UNI_PLATFORM === 'h5' 
  ? '' // 开发环境下H5使用代理
  : 'https://xy.yefiot.com' // 其他环境使用完整URL

// 门禁工具类
export default {
  // 将用户卡号格式化为 8 位
  formatCardNumber(card) {
    return (Array(8).join(0) + card).slice(-8)
  },

  // 将用户密码格式化为 8 位
  formatPassword(pswd) {
    if (pswd.length < 3) pswd = '00000000'
    return (Array(8).join(0) + pswd).slice(-8)
  },

  // 将脸部标记转换为 2 位 16 进制字符串
  formatTag(tag) {
    return (Array(2).join(0) + parseInt(tag, 10).toString(16)).slice(-2)
  },

  // 格式化有效日期字符串为 "YYMMDD" 格式
  formatExpireDate(dstrs) {
    let ystr = dstrs.substring(2, 4)
    let mstr = (Array(2).join(0) + dstrs.substring(5, 7)).slice(-2)
    let dstr = (Array(2).join(0) + dstrs.substring(8, 10)).slice(-2)
    return ystr + mstr + dstr
  },

  // 将用户编号格式化为 8 位
  formatUserId(userId) {
    return (Array(8).join(0) + parseInt(userId).toString(16).toUpperCase()).slice(-8)
  },

  // 给数据包加校验
  addChecksum(pkg) {
    let arr = []
    for (let i = 0, j = 0; i < pkg.length; i = i + 2) {
      arr[j] = pkg.substring(i, i + 2)
      j++
    }
    let arrstr = '00'
    for (let i = 0, j = 0; i < pkg.length; i = i + 2) {
      arrstr = (parseInt(arrstr, 16) ^ parseInt(arr[j], 16)).toString(16)
      j++
    }
    if (arrstr.length == 1) arrstr = '0' + arrstr
    return ('H' + pkg + arrstr + 'W').toUpperCase()
  },

  // 生成最终的 doorpkg 数据包
  generateDoorPkg(card, tag, datestr, liftstr, user_id, pswd, timegroup) {
    let prefix = 'D2'
    let pkg = prefix + card + tag + datestr + liftstr + timegroup + user_id + pswd
    return this.addChecksum(pkg)
  },

  // 门类型转换为 16 进制表示，并补足 4 位
  formatDoorType(doorType) {
    if (parseInt(doorType) > 100) {
      return (Array(4).join(0) + parseInt(doorType).toString(16).toUpperCase()).slice(-4)
    }
    return doorType // 如果需要其他转换逻辑，可以在这里添加
  },

  // 开门方法
  async openDoor(door) {
    try {
      // 获取用户信息
      const userStore = useUserStore()
      const userInfo = userStore.userInfo
      
      if (!userInfo || !userInfo.user_id) {
        uni.showToast({
          title: '请先登录！',
          icon: 'none'
        })
        return false
      }

      // 格式化数据
      const card = this.formatCardNumber(userInfo.user_card_a)
      const pswd = this.formatPassword(userInfo.user_card_b)
      const tag = this.formatTag(userInfo.user_face_tag)
      const datestr = this.formatExpireDate(userStore.maxExpireDate.toString())
      const user_id = this.formatUserId(userInfo.user_id)
      
      // 处理电梯参数
      const liftstr = door.liftstr || '0'.repeat(16)
      const timegroup = door.timegroup || '00'

      console.log("开门参数:", {
        card, tag, datestr, liftstr, user_id, pswd, timegroup
      })

      // 生成开门数据包
      const doorpkg = this.generateDoorPkg(
        card, tag, datestr, liftstr, user_id, pswd, timegroup
      )

      // 显示加载提示
      uni.showLoading({
        title: '开门中...',
        mask: true
      })

      // 获取门类型
      const type = this.formatDoorType(door.door_type)

      // 使用原生请求
      return new Promise((resolve, reject) => {
        uni.request({
          url: `${BASE_URL}/yefiot/v1/mqttpost/`,
          method: 'POST',
          data: {
            type,
            mac: door.door_mac,
            cmd: "0",
            sn: Date.now().toString(),
            info: doorpkg
          },
          success: (res) => {
            if (res.statusCode === 200 && res.data) {
              if (res.data.mac === door.door_mac) {
                const { msg_info } = res.data.data[0]
                console.log('开门响应:', msg_info)

                switch (msg_info) {
                  case 'HD3BB68W':
                    uni.showToast({
                      title: '数据同步成功!',
                      icon: 'none',
                      duration: 1000
                    })
                    resolve(true)
                    break

                  case 'HD3AA79W':
                    uni.showToast({
                      title: `数据同步失败(${msg_info})!`,
                      icon: 'none',
                      duration: 3000
                    })
                    resolve(false)
                    break

                  case 'HD2AA78W':
                    uni.showToast({
                      title: `开门失败(${msg_info})!`,
                      icon: 'none',
                      duration: 3000
                    })
                    resolve(false)
                    break

                  default:
                    // 其他情况认为是开门成功
                    uni.showToast({
                      title: '开门成功!',
                      icon: 'none',
                      duration: 3000
                    })
                    resolve(true)
                }
              } else {
                uni.showToast({
                  title: '开门失败!',
                  icon: 'error',
                  duration: 3000
                })
                resolve(false)
              }
            } else {
              reject(new Error('请求失败'))
            }
          },
          fail: (err) => {
            console.error('开门请求失败:', err)
            reject(err)
          },
          complete: () => {
            uni.hideLoading()
          }
        })
      })

    } catch (error) {
      uni.hideLoading()
      uni.showToast({
        title: '开门失败!',
        icon: 'error',
        duration: 3000
      })
      console.error('开门失败:', error)
      return false
    }
  }
} 
import { useUserStore } from '@/store/modules/user'
import { httpRequest } from '@/utils/nativeHttp'

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

  // 门禁类型映射表
  doorTypes: {
    "1": "yfn01",
    "2": "yfn02",
    "3": "yfn03",
    "4": "yfn04",
    "5": "yfb01",
    "11": "yff01",
    "12": "yff02",
    "13": "yff03",
    "41": "yfv01",
    "42": "yfv02",
    "43": "bxv02",
    "44": "yfv04",
    "45": "bxv05",
    "46": "yfv06",
    "47": "yfv07",
    "48": "yfv08",
    "49": "yfv09",
    "51": "yfl01",
    "91": "yfd01",
    "92": "yfd02"
  },

  // 门类型转换为 16 进制表示，并补足 4 位
  formatDoorType(doorType) {
    const type = doorType.toString()
    console.log('门类型:', type)
    // 如果在映射表中存在，直接返回
    if (this.doorTypes[type]) {
      return this.doorTypes[type]
    }
    
    // 如果大于100，转换为16进制并补足4位
    if (parseInt(type) > 100) {
      const hexType = parseInt(type).toString(16).toUpperCase()
      return (Array(4).join('0') + hexType).slice(-4)
    }
    
    // 默认返回 yfn03
    return 'yfn03'
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

      // 获取门类型
      const type = this.formatDoorType(door.door_type)

      console.log("开门参数:", {
        card,
        tag,
        datestr,
        liftstr,
        user_id,
        pswd,
        timegroup,
        door_type: door.door_type,
        formatted_type: type
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

      // 使用原生请求
      const reqSn = 'APP' + Date.now().toString()
      console.log('[开门] 走到 mqttpost 请求处，发送参数:', JSON.stringify({
        url: `${BASE_URL}/yefiot/v1/mqttpost/`,
        type,
        mac: door.door_mac,
        cmd: '0',
        sn: reqSn,
        info: doorpkg + '","opencode":"369',
      }))
      return new Promise((resolve, reject) => {
        httpRequest({
          url: `${BASE_URL}/yefiot/v1/mqttpost/`,
          method: 'POST',
          data: {
            type,
            mac: door.door_mac,
            cmd: "0",
            sn: reqSn,
            info: doorpkg + '","opencode":"369',
          },
          success: (res) => {
            if (res.statusCode === 200 && res.data) {
              console.log('[开门] 响应原文:', JSON.stringify(res.data))
              if (res.data.mac === door.door_mac) {
                const { msg_info, opencode } = res.data.data[0]
                console.log('开门响应:', msg_info, 'opencode:', opencode)

                switch (msg_info) {
                  case 'HD3BB68W':
                    uni.showToast({
                      title: '数据同步成功!',
                      icon: 'none',
                      duration: 1000
                    })
                    reject(true)
                    break

                  case 'HD3AA79W':
                    uni.showToast({
                      title: `数据同步失败(${msg_info})!`,
                      icon: 'none',
                      duration: 3000
                    })
                    reject(false)
                    break

                  case 'HD2AA78W':
                    uni.showToast({
                      title: `开门失败(${msg_info})!`,
                      icon: 'none',
                      duration: 3000
                    })
                    reject(false)
                    break

                  default:
                    // 其他情况认为是开门成功
                    uni.showToast({
                      title: '开门成功!',
                      icon: 'none',
                      duration: 3000
                    })
                    resolve({ success: true, opencode })
                }
              } else {
                uni.showToast({
                  title: '开门失败!',
                  icon: 'error',
                  duration: 3000
                })
                reject(false)
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
  },

  // 生成脱机临时密码（30分钟一个时间片，算法需与设备固件一致）
  // 参数: device 设备对象（需含 factory_code 出厂码、door_mac）
  //       date 时间对象，默认当前时间
  genOfflinePsw(device, date = new Date()) {
    if (!device || !device.factory_code || !device.door_mac) {
      console.error('生成脱机密码失败：缺少 factory_code 或 door_mac', device)
      return ''
    }
    const ds = date.getFullYear() * (date.getMonth() + 1) * date.getDate()
    const ms = date.getHours() * 60 + date.getMinutes()
    const sl = ds * (Math.floor(ms / 30) + 1)

    let hash = 0
    const str = device.factory_code + device.door_mac
    for (let i = 0; i < str.length; i++) {
      hash = ((hash * 31 + str.charCodeAt(i)) & 0xFFFFFFFF) >>> 0
    }
    hash = (hash ^ sl) >>> 0
    return hash.toString().slice(-6).padStart(6, '0')
  }
} 
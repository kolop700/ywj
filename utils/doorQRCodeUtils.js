/**
 * 门禁二维码生成工具类
 */
import { useUserStore } from '@/store/modules/user'
import { useDeviceStore } from '@/store/modules/device'
import { encode, decode } from '@/utils/base64x'

// 64进制字符串映射表
const Str64 = "-123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_0="

class DoorQRCodeUtils {
  /**
   * 补零函数 - 将数字转为两位字符串，不足补零
   * @param {string} str 需要补零的字符串
   * @returns {string} 补零后的两位字符串
   */
  static fillZero(str) {
    return str.padStart(2, '0')
  }

  /**
   * 生成时间戳相关的日期字符串
   * @param {Date} date 日期对象
   * @returns {string} 格式化的日期字符串 (DDHHMM)
   */
  static formatDateStr(date) {
    const day = this.fillZero(date.getDate().toString())
    const hour = this.fillZero(date.getHours().toString())
    const minute = this.fillZero(date.getMinutes().toString())
    return day + hour + minute
  }

  /**
   * 生成临时密码
   * @param {string} cardNumber 卡号
   * @param {Date} currentTime 当前时间
   * @returns {string} 格式化的临时密码
   */
  static generateTempPassword(cardNumber, currentTime) {
    // 获取当前时间的小时和分钟
    const hours = this.fillZero(currentTime.getHours().toString())
    const minutes = this.fillZero(currentTime.getMinutes().toString())

    // 生成随机数
    const rani = Math.floor(Math.random() * 10)
    let pswstr = rani.toString()
    
    // 计算随机数的平方，取最后一位
    const ranstreq = (rani * rani).toString()
    const ran = pswstr + ranstreq.slice(-1)

    // 计算时间偏移
    const time_x = this.fillZero(((parseInt(hours) + parseInt(ran)) % 24).toString()) +
                  this.fillZero(((parseInt(minutes) + parseInt(ran)) % 60).toString())
    
    // 添加时间偏移到密码字符串
    pswstr = pswstr + time_x

    // 计算卡号异或运算
    let card_x = ''
    // 前两位与time_x的前两位异或
    card_x += this.fillZero((parseInt(cardNumber.substring(0, 2), 16) ^ parseInt(time_x.substring(0, 2), 16)).toString(16))
    // 第3-4位与time_x的后两位异或
    card_x += this.fillZero((parseInt(cardNumber.substring(2, 4), 16) ^ parseInt(time_x.substring(2, 4), 16)).toString(16))
    // 第5-6位与time_x的前两位异或
    card_x += this.fillZero((parseInt(cardNumber.substring(4, 6), 16) ^ parseInt(time_x.substring(0, 2), 16)).toString(16))
    // 第7-8位与time_x的后两位异或
    card_x += this.fillZero((parseInt(cardNumber.substring(6, 8), 16) ^ parseInt(time_x.substring(2, 4), 16)).toString(16))

    // 转换为十进制并补零到10位
    card_x = parseInt(card_x, 16).toString().padStart(10, '0')

    // 组合密码字符串
    pswstr = pswstr + card_x

    // 计算校验和
    let chk = 0
    for (let i = 0; i < pswstr.length; i++) {
      chk += parseInt(pswstr[i])
    }
    const chkstr = chk.toString().slice(-1)

    // 添加校验和
    pswstr = pswstr + chkstr

    // 格式化密码，每4位添加一个空格
    return pswstr.replace(/(.{4})/g, '$1 ').trim()
  }

  /**
   * 数据包解析函数
   * @param {string} str 需要解析的字符串
   * @returns {string} 解析后的字符串
   */
  static parsePackage(str) {
    var strlit = str;
    let arr = [];
    // 每两个字符分割成一组
    for (let i = 0, j = 0; i < str.length; i = i + 2) {
      arr[j] = str.substring(i, i + 2);
      j++;
    }
    // 初始值为00，与每组数据进行异或运算
    let arrstr = '00';
    for (let i = 0, j = 0; i < str.length; i = i + 2) {
      arrstr = (parseInt(arrstr, 16) ^ parseInt(arr[j], 16)).toString(16);
      j++;
    }
    // 补零处理
    if (arrstr.length == 1) arrstr = '0' + arrstr;
    // 返回原始字符串加上异或结果
    return (strlit + arrstr).toUpperCase();
  }

  /**
   * 将设备ID转换为64进制字符串
   * @param {number} doorid 设备ID
   * @returns {string} 64进制字符串
   */
  static getStr64(doorid) {
    let rslt = ''
    if (doorid >= 0 && doorid < 16777216) {
      rslt = Str64.charAt(parseInt(doorid / (64 * 64 * 64)))
      doorid = doorid % (64 * 64 * 64)
      
      rslt = rslt + Str64.charAt(parseInt(doorid / (64 * 64)))
      doorid = doorid % (64 * 64)
      
      rslt = rslt + Str64.charAt(parseInt(doorid / 64))
      doorid = doorid % 64
      
      rslt = rslt + Str64.charAt(parseInt(doorid))
    }
    return rslt
  }

  /**
   * 生成设备列表的编码字符串
   * @param {Array} devices 设备列表
   * @param {string} expireDate 过期日期
   * @returns {string} 编码后的设备列表字符串
   */
  static generateDoorLists(devices, expireDate) {
    if (!devices || devices.length === 0) return ''

    let doorid64 = ''
    
    // 处理过期日期
    if (expireDate) {
      const ystr = expireDate.substring(2, 4)
      const mstr = Str64.charAt(parseInt(expireDate.substring(5, 7)))
      const dstr = Str64.charAt(parseInt(expireDate.substring(8, 10)))
      doorid64 = doorid64 + ystr + mstr + dstr  // len.4
    }

    // 添加设备数量
    doorid64 = doorid64 + Str64.charAt(devices.length)  // len.5

    // 处理设备ID
    let lastid = 0
    for (let i = 0; i < devices.length; i++) {
      const doorId = devices[i].door_id
      if (doorId) {
        if ((doorId - lastid > 63) || lastid === 0) {
          doorid64 = doorid64 + '+' + this.getStr64(doorId)
        } else {
          doorid64 = doorid64 + Str64.charAt(doorId - lastid)
        }
        lastid = doorId
      }
    }

    // 计算校验和
    let ccode = 0
    for (let i = 0; i < doorid64.length; i++) {
      ccode += doorid64.charCodeAt(i)
    }
    doorid64 = doorid64 + Str64.charAt(ccode % 64)

    return doorid64
  }

  /**
   * 生成完整的门禁二维码内容
   * @param {Object} params 参数对象
   * @param {number} params.validTimes 有效次数（0表示无限次）
   * @param {number} params.validMinutes 有效分钟数（1-30）
   * @param {number} params.gender 性别代码
   * @returns {Object} 返回二维码内容和临时密码
   */
  static generateDoorQRCode({
    validTimes = 0,
    validMinutes = 5,
  }) {
    const userStore = useUserStore()
    const deviceStore = useDeviceStore()
    
    // 从 store 获取卡号信息和过期日期
    const card = userStore.userCardA || '00000000'
    const userPass = userStore.userCardB || '00000000'
    const expireDate = userStore.userInfo.user_expire_date

    // 从 deviceStore 获取设备列表
    const devices = deviceStore.deviceList

    // 处理时间
    const now = new Date()
    const validTime = new Date(now.getTime() + (validMinutes * 60 * 1000))

    // 处理性别代码 - 如果是10则转为0F，否则补零
    const genderCode = validTimes === 10 ? '0F' : `0${validTimes}`

    // 生成日期字符串 (DDHHMM)
    const dateStr = this.formatDateStr(validTime)

    // 组合门禁数据包
    let doorPackage = card + dateStr + genderCode + userPass

    // 生成临时密码
    const tempPassword = this.generateTempPassword(card, now)

    // 处理数据包
    doorPackage = this.parsePackage(doorPackage)

    // Base64编码
    doorPackage = encode(doorPackage)

    // 生成设备列表编码
    const doorLists = this.generateDoorLists(devices, expireDate)

    // 添加包装字符和门禁列表
    doorPackage = '~~' + doorPackage + '@'
    if (doorLists) {
      doorPackage += doorLists
    }

    return {
      qrcode: doorPackage,
      tempPassword: tempPassword,
      validTimes: validTimes === 0 ? '无限' : validTimes.toString(),
      validMinutes: validMinutes.toString()
    }
  }
}

export default DoorQRCodeUtils 
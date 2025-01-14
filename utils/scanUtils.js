/**
 * 扫码工具类
 */

/**
 * 二维码格式验证正则
 */
const QR_REGEX = {
  YEFIOT: /^https:\/\/qrapp\.yefiot\.com\/qr\/yf\?c=.+$/,
  SVR: /^https:\/\/svr\.yefiot\.com\/xy\?c=.+$/
}

const scanUtils = {
  /**
   * 扫描二维码
   * @param {Object} options 配置项
   * @param {Boolean} options.onlyFromCamera 是否只使用相机扫码，默认true
   * @param {Array} options.scanType 扫码类型，默认['qrCode']
   * @returns {Promise<string>} 返回扫码结果，失败返回空字符串
   */
  scanQRCode(options = {}) {
    const { 
      onlyFromCamera = true, 
      scanType = ['qrCode']
    } = options

    return new Promise((resolve, reject) => {
      uni.scanCode({
        onlyFromCamera,
        scanType,
        success: (res) => {
          console.log('扫码结果:', res)
          
          // 验证二维码格式
          if (QR_REGEX.YEFIOT.test(res.result) || QR_REGEX.SVR.test(res.result)) {
            // 提取参数 c 的值
            const codeParam = res.result.split('c=')[1]
            resolve(codeParam)
          } else {
            // 如果二维码格式不正确，返回空字符串
            uni.showToast({
              title: '无效的二维码格式',
              icon: 'none',
              duration: 2000
            })
            resolve('')
          }
        },
        fail: (err) => {
          console.error('扫码失败:', err)
          uni.showToast({
            title: '扫描失败',
            icon: 'none'
          })
          resolve('')
        }
      })
    })
  },

  /**
   * 验证二维码格式
   * @param {string} qrString 二维码字符串
   * @returns {boolean} 是否为有效格式
   */
  validateQRFormat(qrString) {
    return QR_REGEX.YEFIOT.test(qrString) || QR_REGEX.SVR.test(qrString)
  },

  /**
   * 从二维码URL中提取参数值
   * @param {string} qrString 二维码字符串
   * @param {string} paramName 参数名称
   * @returns {string} 参数值，未找到返回空字符串
   */
  extractParamFromQR(qrString, paramName = 'c') {
    try {
      const url = new URL(qrString)
      return url.searchParams.get(paramName) || ''
    } catch (error) {
      console.error('URL解析失败:', error)
      return ''
    }
  }
}

export default scanUtils 


// 基本使用
// const result = await scanUtils.scanQRCode()

// // 自定义选项
// const result = await scanUtils.scanQRCode({
//   onlyFromCamera: false,
//   scanType: ['qrCode', 'barCode']
// })

// // 验证二维码格式
// const isValid = scanUtils.validateQRFormat(qrString)

// // 提取参数
// const code = scanUtils.extractParamFromQR(qrString)
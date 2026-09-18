/**
 * 分享工具类
 */
class ShareUtils {
  /**
   * 截取指定元素的图片
   * @param {Object} element 需要截图的元素引用
   * @returns {Promise<string>} 返回临时文件路径
   */
  static async captureImage(element) {
    return new Promise((resolve, reject) => {
      try {
        // #ifdef APP-PLUS
        const ctx = uni.createCanvasContext('shareCanvas')
        ctx.drawImage(element.result, 0, 0, 250, 250)
        ctx.draw(false, () => {
          uni.canvasToTempFilePath({
            canvasId: 'shareCanvas',
            success: (res) => resolve(res.tempFilePath),
            fail: (err) => reject(err)
          })
        })
        // #endif

        // #ifdef MP-WEIXIN
        resolve(element.result)
        // #endif

        // #ifdef H5
        // H5 原生壳：u-qrcode 的 result 为 data URL，直接返回供保存/分享
        resolve(element && element.result ? element.result : '')
        // #endif
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 分享到微信
   * @param {Object} options 分享选项
   * @param {string} options.imageUrl 图片地址
   * @param {string} options.title 分享标题
   * @param {string} options.summary 分享描述
   * @returns {Promise<void>}
   */
  static async shareToWeChat(options) {
    return new Promise((resolve, reject) => {
      // #ifdef APP-PLUS
      uni.share({
        provider: 'weixin',
        scene: 'WXSceneSession',
        type: 2,
        imageUrl: options.imageUrl,
        title: options.title,
        summary: options.summary,
        success: (res) => {
          uni.showToast({
            title: '分享成功',
            icon: 'success'
          })
          resolve(res)
        },
        fail: (err) => {
          uni.showToast({
            title: '分享失败',
            icon: 'none'
          })
          reject(err)
        }
      })
      // #endif

      // #ifdef MP-WEIXIN
      uni.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline']
      })
      resolve()
      // #endif

      // #ifdef H5
      uni.share({
        provider: 'weixin',
        scene: 'WXSceneSession',
        type: 2,
        imageUrl: options.imageUrl,
        title: options.title,
        summary: options.summary,
        success: (res) => resolve(res),
        fail: (err) => {
          uni.showToast({
            title: '分享失败',
            icon: 'none'
          })
          reject(err)
        }
      })
      // #endif
    })
  }

  /**
   * 保存图片到相册
   * @param {string} filePath 图片路径
   * @returns {Promise<void>}
   */
  static async saveImageToAlbum(filePath) {
    return new Promise((resolve, reject) => {
      uni.saveImageToPhotosAlbum({
        filePath: filePath,
        success: () => {
          uni.showToast({
            title: '保存成功',
            icon: 'success'
          })
          resolve()
        },
        fail: (err) => {
          uni.showToast({
            title: '保存失败',
            icon: 'none'
          })
          reject(err)
        }
      })
    })
  }

  /**
   * 复制文本到剪贴板
   * @param {string} text 要复制的文本
   * @returns {Promise<void>}
   */
  static async copyToClipboard(text) {
    return new Promise((resolve, reject) => {
      uni.setClipboardData({
        data: text,
        success: () => {
          uni.showToast({
            title: '复制成功',
            icon: 'success'
          })
          resolve()
        },
        fail: (err) => {
          uni.showToast({
            title: '复制失败',
            icon: 'none'
          })
          reject(err)
        }
      })
    })
  }
}

export default ShareUtils 
/**
 * 扫码工具类
 */

/**
 * 二维码格式验证正则
 */
const QR_REGEX = {
  YEFIOT: /^https:\/\/qrapp\.yefiot\.com\/qr\/yf\?c=.+$/,
  SVR: /^https:\/\/svr\.yefiot\.com\/xy\?c=.+$/,
  NEW_FORMAT: /^http:\/\/xy\.yefiot\.com\/public\/dl\/\?c=.+$/
}

const scanUtils = {
  /**
   * 检查并申请权限
   * @returns {Promise<boolean>} 是否获得所有权限
   */
  async checkAndRequestPermissions() {
    // #ifdef APP-PLUS
    // iOS权限检查
    if (uni.getSystemInfoSync().platform === 'ios') {
      return new Promise((resolve) => {
        try {
          const AVCaptureDeviceClass = plus.ios.importClass("AVCaptureDevice");
          const status = AVCaptureDeviceClass.authorizationStatusForMediaType('vide');
          
          if (status === 0) {
            // 首次使用，请求权限
            plus.ios.importClass("AVCaptureDevice");
            const result = plus.ios.invoke('AVCaptureDevice', 'requestAccessForMediaType:completionHandler:', 'vide', function(granted) {
              resolve(granted);
            });
          } else if (status === 3) {
            // 已授权
            resolve(true);
          } else {
            // 未授权或已拒绝
            uni.showModal({
              title: '提示',
              content: '请在系统设置中开启相机权限',
              confirmText: '去设置',
              cancelText: '取消',
              success: function(res) {
                if (res.confirm) {
                  try {
                    const UIApplicationClass = plus.ios.importClass("UIApplication");
                    const NSURLClass = plus.ios.importClass("NSURL");
                    const settingsUrl = NSURLClass.URLWithString('app-settings:');
                    const application = UIApplicationClass.sharedApplication();
                    application.openURL(settingsUrl);
                  } catch (e) {
                    console.error('打开设置页面失败:', e);
                  }
                }
              }
            });
            resolve(false);
          }
        } catch (e) {
          console.error('iOS权限检查失败:', e);
          resolve(false);
        }
      });
    }

    // Android权限检查
    const permissionNames = {
      'android.permission.CAMERA': '相机',
      'android.permission.READ_EXTERNAL_STORAGE': '存储',
      'android.permission.BLUETOOTH': '蓝牙',
      'android.permission.ACCESS_FINE_LOCATION': '位置'
    };

    // 检查权限状态
    const checkPermission = (permission) => {
      return new Promise((resolve) => {
        plus.android.requestPermissions(
          [permission],
          function(resultObj) {
            resolve(resultObj.granted.length > 0);
          },
          function(error) {
            console.error('权限检查失败:', error);
            resolve(false);
          }
        );
      });
    };

    // 引导用户去设置页面
    const goToAppSetting = () => {
      return new Promise((resolve) => {
        uni.showModal({
          title: '权限申请',
          content: '请在设置中开启相关权限，以正常使用应用功能',
          confirmText: '去设置',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              // 跳转到应用设置界面
              const Intent = plus.android.importClass('android.content.Intent');
              const Settings = plus.android.importClass('android.provider.Settings');
              const Uri = plus.android.importClass('android.net.Uri');
              const mainActivity = plus.android.runtimeMainActivity();
              const intent = new Intent();
              intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
              const uri = Uri.fromParts('package', mainActivity.getPackageName(), null);
              intent.setData(uri);
              mainActivity.startActivity(intent);
              resolve(true);
            } else {
              resolve(false);
            }
          }
        });
      });
    };

    // 检查所有权限
    for (let permission in permissionNames) {
      const hasPermission = await checkPermission(permission);
      if (!hasPermission) {
        // 显示权限说明
        uni.showModal({
          title: '需要' + permissionNames[permission] + '权限',
          content: '为了更好的使用体验，请授予' + permissionNames[permission] + '权限',
          success: async (res) => {
            if (res.confirm) {
              const granted = await checkPermission(permission);
              if (!granted) {
                // 如果用户拒绝了权限，引导去设置页面
                await goToAppSetting();
              }
            }
          }
        });
        return false;
      }
    }
    return true;
    // #endif

    // #ifdef H5 || MP
    return true;
    // #endif
  },

  /**
   * 扫描二维码
   * @param {Object} options 配置项
   * @param {Boolean} options.onlyFromCamera 是否只使用相机扫码，默认true
   * @param {Array} options.scanType 扫码类型，默认['qrCode']
   * @returns {Promise<string>} 返回扫码结果，失败返回空字符串
   */
  async scanQRCode(options = {}) {
    // 先检查权限
    const hasPermissions = await this.checkAndRequestPermissions();
    if (!hasPermissions) {
      uni.showToast({
        title: '缺少必要权限',
        icon: 'none'
      });
      return '';
    }

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
          if (QR_REGEX.YEFIOT.test(res.result) || QR_REGEX.SVR.test(res.result) || QR_REGEX.NEW_FORMAT.test(res.result)) {
            console.log('匹配成功:', res.result);
            // 提取参数 c 的值
            const codeParam = res.result.split('c=')[1]
            resolve(codeParam)
          } else {
            console.log('匹配失败:', res.result);
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
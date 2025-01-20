import { ref } from 'vue'

class BleUtils {
  constructor() {
    // 存储已发现的蓝牙设备
    this.bleDevices = ref([])
    // 当前连接的设备ID
    this.currentDeviceId = null
    // 当前服务ID
    this.currentServiceId = null
    // 当前特征值ID
    this.currentCharacteristicId = null
    // 添加平台判断
    this.isIOS = uni.getSystemInfoSync().platform === 'ios'
  }

  /**
   * 初始化蓝牙适配器
   * @returns {Promise} 返回初始化结果
   */
  initBluetooth() {
    return new Promise((resolve, reject) => {
      // iOS 需要先监听蓝牙状态
      if (this.isIOS) {
        uni.onBluetoothAdapterStateChange((res) => {
          console.log('蓝牙适配器状态变化:', res)
        })
      }

      uni.openBluetoothAdapter({
        mode: 'central', // iOS 必须指定为 central 模式
        success: (res) => {
          console.log('初始化蓝牙适配器成功')
          resolve(res)
        },
        fail: (err) => {
          console.error('初始化蓝牙适配器失败', err)
          uni.showToast({
            title: '请打开蓝牙和定位功能',
            icon: 'none'
          })
          reject(err)
        }
      })
    })
  }

  /**
   * 开始搜索蓝牙设备
   * @returns {Promise} 返回搜索结果
   */
  startBluetoothDevicesDiscovery() {
    return new Promise((resolve, reject) => {
      uni.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: false, // iOS 不允许重复上报设备
        interval: 0, // iOS 建议设置为0
        success: (res) => {
          console.log('开始搜索蓝牙设备')
          this.onBluetoothDeviceFound()
          resolve(res)
        },
        fail: (err) => {
          console.error('搜索蓝牙设备失败', err)
          reject(err)
        }
      })
    })
  }

  /**
   * 监听发现新设备事件
   */
  onBluetoothDeviceFound() {
    uni.onBluetoothDeviceFound((res) => {
      console.log('发现新设备原始数据:', res.devices)
      res.devices.forEach(device => {
        console.log('设备信息:', {
          deviceId: device.deviceId,
          name: device.name,
          localName: device.localName,
          RSSI: device.RSSI,
          advertisData: device.advertisData,
          advertisServiceUUIDs: device.advertisServiceUUIDs,
          serviceData: device.serviceData
        })
        
        // 这里假设设备名称以 'BMXWL' 开头
        if (device.name) {
          console.log('设备名称存在:', device.name)
          if (device.name.startsWith('BMXWL')) {
            console.log('找到目标设备:', device.name)
            // 检查是否已存在该设备
            const isExist = this.bleDevices.value.some(d => d.deviceId === device.deviceId)
            if (!isExist) {
              console.log('添加新设备到列表')
              this.bleDevices.value.push(device)
              console.log('当前设备列表:', this.bleDevices.value)
            } else {
              console.log('设备已存在于列表中')
            }
          } else {
            console.log('设备名称不匹配 BMXWL 前缀')
          }
        } else if (device.localName) {
          console.log('使用 localName 替代:', device.localName)
          if (device.localName.startsWith('BMXWL')) {
            console.log('找到目标设备(localName):', device.localName)
            const isExist = this.bleDevices.value.some(d => d.deviceId === device.deviceId)
            if (!isExist) {
              console.log('添加新设备到列表(localName)')
              this.bleDevices.value.push({...device, name: device.localName})
              console.log('当前设备列表:', this.bleDevices.value)
            } else {
              console.log('设备已存在于列表中')
            }
          } else {
            console.log('localName 不匹配 BMXWL 前缀')
          }
        } else {
          console.log('设备无名称信息')
        }
      })
    })
  }

  /**
   * 连接蓝牙设备
   * @param {string} deviceId 设备ID
   * @returns {Promise} 返回连接结果
   */
  connectBleDevice(deviceId) {
    return new Promise((resolve, reject) => {
      // iOS 连接前先停止搜索
      if (this.isIOS) {
        this.stopBluetoothDevicesDiscovery()
      }

      uni.createBLEConnection({
        deviceId,
        timeout: 15000, // iOS 建议设置更长的超时时间
        success: (res) => {
          console.log('设备连接成功')
          this.currentDeviceId = deviceId
          // iOS 需要更长的等待时间
          setTimeout(() => {
            resolve(res)
          }, this.isIOS ? 3000 : 1000)
        },
        fail: (err) => {
          console.error('设备连接失败', err)
          reject(err)
        }
      })
    })
  }

  /**
   * 获取设备的服务列表
   * @param {string} deviceId 设备ID
   * @returns {Promise} 返回服务列表
   */
  getBleDeviceServices(deviceId) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        uni.getBLEDeviceServices({
          deviceId,
          success: (res) => {
            console.log('获取服务列表成功，原始数据:', res)
            if (!res.services || res.services.length === 0) {
              console.error('未找到任何服务')
              reject(new Error('未找到任何服务'))
              return
            }
            
            // iOS 可能需要过滤一些系统服务
            const services = res.services.filter(s => {
              // 过滤掉 iOS 的一些系统服务
              return !s.uuid.startsWith('1800') && !s.uuid.startsWith('1801')
            })
            
            console.log('可用服务列表:', services.map(s => ({
              uuid: s.uuid,
              isPrimary: s.isPrimary
            })))
            resolve(services)
          },
          fail: (err) => {
            console.error('获取服务列表失败', err)
            reject(err)
          }
        })
      }, this.isIOS ? 2000 : 1000) // iOS 需要更长的等待时间
    })
  }

  /**
   * 获取特征值
   * @param {string} deviceId 设备ID
   * @param {string} serviceId 服务ID
   * @returns {Promise} 返回特征值列表
   */
  getBleDeviceCharacteristics(deviceId, serviceId) {
    return new Promise((resolve, reject) => {
      uni.getBLEDeviceCharacteristics({
        deviceId,
        serviceId,
        success: (res) => {
          console.log('获取特征值成功')
          resolve(res.characteristics)
        },
        fail: (err) => {
          console.error('获取特征值失败', err)
          reject(err)
        }
      })
    })
  }

  /**
   * 处理开门指令数据包
   * @param {string} str 原始指令字符串
   * @returns {string} 处理后的指令字符串
   */
  parsePackage(str) {
    const strArray = []
    // 每两个字符分割成一组
    for (let i = 0; i < str.length; i += 2) {
      strArray.push(str.substring(i, i + 2))
    }
    
    // 计算异或校验和
    let checksum = '00'
    strArray.forEach(byte => {
      checksum = (parseInt(checksum, 16) ^ parseInt(byte, 16)).toString(16)
    })
    
    // 补齐校验和位数
    if (checksum.length === 1) {
      checksum = '0' + checksum
    }
    
    // 返回完整的指令包
    return ('H' + str + checksum + 'W').toUpperCase()
  }

  /**
   * 将字符串转换为ArrayBuffer
   * @param {string} str 要转换的字符串
   * @returns {ArrayBuffer} 转换后的ArrayBuffer
   */
  string2buffer(str) {
    const array = new Uint8Array(str.length)
    for (let i = 0; i < str.length; i++) {
      array[i] = str.charCodeAt(i)
    }
    return array.buffer
  }

  /**
   * 写入开门指令
   * @param {string} deviceId 设备ID
   * @param {string} serviceId 服务ID
   * @param {string} characteristicId 特征值ID
   * @param {string} command 开门指令
   * @returns {Promise} 返回写入结果
   */
  writeCommand(deviceId, serviceId, characteristicId, command) {
    const buffer = this.string2buffer(command)
    return new Promise((resolve, reject) => {
      // iOS 写入需要分包处理
      if (this.isIOS && buffer.byteLength > 20) {
        console.log('iOS 需要分包处理')
        // 实现分包逻辑
        this.writeByChunks(deviceId, serviceId, characteristicId, buffer, resolve, reject)
      } else {
        uni.writeBLECharacteristicValue({
          deviceId,
          serviceId,
          characteristicId,
          value: buffer,
          success: (res) => {
            console.log('写入指令成功')
            resolve(res)
          },
          fail: (err) => {
            console.error('写入指令失败', err)
            reject(err)
          }
        })
      }
    })
  }

  /**
   * iOS 分包写入
   */
  async writeByChunks(deviceId, serviceId, characteristicId, buffer, resolve, reject) {
    try {
      const chunkSize = 20 // iOS BLE 规范限制
      const data = new Uint8Array(buffer)
      
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize)
        await new Promise((res, rej) => {
          uni.writeBLECharacteristicValue({
            deviceId,
            serviceId,
            characteristicId,
            value: chunk.buffer,
            success: res,
            fail: rej
          })
        })
        // iOS 需要写入间隔
        await new Promise(res => setTimeout(res, 50))
      }
      
      console.log('分包写入完成')
      resolve()
    } catch (error) {
      console.error('分包写入失败:', error)
      reject(error)
    }
  }

  /**
   * 断开蓝牙连接
   * @param {string} deviceId 设备ID
   * @returns {Promise} 返回断开结果
   */
  closeBleConnection(deviceId) {
    return new Promise((resolve, reject) => {
      uni.closeBLEConnection({
        deviceId,
        success: (res) => {
          console.log('断开连接成功')
          this.currentDeviceId = null
          resolve(res)
        },
        fail: (err) => {
          console.error('断开连接失败', err)
          reject(err)
        }
      })
    })
  }

  /**
   * 停止搜索蓝牙设备
   */
  stopBluetoothDevicesDiscovery() {
    uni.stopBluetoothDevicesDiscovery()
  }

  /**
   * 关闭蓝牙适配器
   */
  closeBluetoothAdapter() {
    uni.closeBluetoothAdapter()
  }
}

export default BleUtils 


// 使用示例
// async function openDoor(deviceId) {
//     try {
//       // 1. 初始化蓝牙适配器
//       await bleUtils.initBluetooth()
      
//       // 2. 开始搜索设备
//       await bleUtils.startBluetoothDevicesDiscovery()
      
//       // 3. 连接设备
//       await bleUtils.connectBleDevice(deviceId)
      
//       // 4. 获取服务列表
//       const services = await bleUtils.getBleDeviceServices(deviceId)
      
//       // 5. 获取特征值
//       for (const service of services) {
//         if (service.isPrimary) {
//           const characteristics = await bleUtils.getBleDeviceCharacteristics(deviceId, service.uuid)
          
//           // 6. 找到可写入的特征值
//           for (const characteristic of characteristics) {
//             if (characteristic.properties.write) {
//               // 7. 构造开门指令
//               const userId = '00000001' // 示例用户ID
//               const command = `D1${userId}0000000000000000`
//               const finalCommand = bleUtils.parsePackage(command)
              
//               // 8. 写入开门指令
//               await bleUtils.writeCommand(deviceId, service.uuid, characteristic.uuid, finalCommand)
              
//               // 9. 断开连接
//               await bleUtils.closeBleConnection(deviceId)
              
//               // 10. 停止搜索
//               bleUtils.stopBluetoothDevicesDiscovery()
              
//               uni.showToast({
//                 title: '开门成功',
//                 icon: 'success'
//               })
//               return
//             }
//           }
//         }
//       }
//     } catch (error) {
//       console.error('开门失败:', error)
//       uni.showToast({
//         title: '开门失败',
//         icon: 'none'
//       })
//     }
//   }
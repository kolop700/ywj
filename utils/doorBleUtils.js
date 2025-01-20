class DoorBleUtils {
  constructor(bleUtils) {
    if (!bleUtils) {
      throw new Error('bleUtils 是必需的')
    }
    this.bleUtils = bleUtils
  }

  /**
   * 蓝牙开门主函数
   * @param {Object} device 设备信息，包含 door_mac 等信息
   * @param {string} userId 用户ID
   * @returns {Promise}
   */
  async openDoorWithBle(device, userId) {
    // 显示开门中的提示
    uni.showLoading({
      title: '正在开门...',
      mask: true
    })

    try {
      console.log('开始蓝牙开门流程...')
      // 1. 初始化蓝牙
      await this.bleUtils.initBluetooth()
      
      // 2. 搜索并连接设备
      const targetDevice = await this.findAndConnectDevice(device.door_mac)
      
      // 3. 发送开门指令
      await this.sendOpenCommand(targetDevice, userId)
      
      // 开门成功
      uni.showToast({
        title: '开门成功',
        icon: 'success'
      })
    } catch (error) {
      console.error('蓝牙开门失败:', error)
      throw error
    } finally {
      // 清理资源
      this.bleUtils.stopBluetoothDevicesDiscovery()
      this.bleUtils.closeBluetoothAdapter()
      // 隐藏开门中的提示
      uni.hideLoading()
    }
  }

  /**
   * 搜索并连接设备
   * @param {string} doorMac 设备MAC地址
   * @returns {Promise<Object>} 目标设备信息
   */
  async findAndConnectDevice(doorMac) {
    try {
      // 开始搜索设备
      await this.bleUtils.startBluetoothDevicesDiscovery()
      
      // 等待找到目标设备
      const targetDevice = await this.waitForDevice(doorMac)
      
      // 连接设备
      await this.bleUtils.connectBleDevice(targetDevice.deviceId)
      
      return targetDevice
    } catch (error) {
      console.error('查找连接设备失败:', error)
      throw new Error('未找到或无法连接设备')
    }
  }

  /**
   * 等待发现目标设备
   * @param {string} doorMac 设备MAC地址
   * @returns {Promise<Object>}
   */
  waitForDevice(doorMac) {
    const targetDeviceName = 'BMXWL' + doorMac
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('搜索设备超时'))
      }, 10000) // 10秒超时
      
      uni.onBluetoothDeviceFound(res => {
        const device = res.devices.find(d => d.name === targetDeviceName)
        if (device) {
          clearTimeout(timer)
          resolve(device)
        }
      })
    })
  }

  /**
   * 发送开门指令
   * @param {Object} device 设备信息
   * @param {string} userId 用户ID
   */
  async sendOpenCommand(device, userId) {
    try {
      // 获取服务
      const services = await this.bleUtils.getBleDeviceServices(device.deviceId)
      
      // 遍历服务找到可写特征值
      for (const service of services) {
        if (!service.isPrimary) continue
        
        const characteristics = await this.bleUtils.getBleDeviceCharacteristics(
          device.deviceId, 
          service.uuid
        )
        
        // 找到可写特征值
        const writableChar = characteristics.find(c => c.properties.write)
        if (!writableChar) continue
        
        // 构造并发送开门指令
        const paddedUserId = (Array(8).join(0) + userId).slice(-8)
        const command = `D1${paddedUserId}0000000000000000`
        const finalCommand = this.bleUtils.parsePackage(command)
        
        await this.bleUtils.writeCommand(
          device.deviceId,
          service.uuid,
          writableChar.uuid,
          finalCommand
        )
        
        return // 发送成功
      }
      
      throw new Error('未找到可写入的特征值')
    } catch (error) {
      console.error('发送开门指令失败:', error)
      throw error
    }
  }
}

export default DoorBleUtils 
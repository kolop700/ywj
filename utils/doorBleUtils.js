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
   * @param {Object} bleDevice 已找到的蓝牙设备信息（可选）
   * @returns {Promise}
   */
  async openDoorWithBle(device, userId, bleDevice = null) {
    // 显示开门中的提示
    uni.showLoading({
      title: '正在开门...',
      mask: true
    })

    try {
      console.log('开始蓝牙开门流程...')
      // 1. 初始化蓝牙
      await this.bleUtils.initBluetooth()
      
      // 2. 搜索并连接设备（预扫描已找到则直接复用，避免重复扫描被系统限流）
      let targetDevice
      if (bleDevice && bleDevice.deviceId) {
        await this.bleUtils.connectBleDevice(bleDevice.deviceId)
        targetDevice = bleDevice
      } else {
        targetDevice = await this.findAndConnectDevice(device.door_mac)
      }
      
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
   * 广播名归一化：去除冒号/横线/空格等分隔符并转大写，规避 MAC 格式差异
   */
  normalizeName(v) {
    return String(v == null ? '' : v).replace(/[^0-9a-zA-Z]/g, '').toUpperCase()
  }

  /**
   * 等待发现目标设备
   * @param {string} doorMac 设备MAC地址
   * @returns {Promise<Object>}
   */
  waitForDevice(doorMac) {
    const normalizedTarget = this.normalizeName('BMXWL' + doorMac)
    const macNorm = this.normalizeName(doorMac)

    const isMatch = (d) => {
      if (!d) return false
      const name = this.normalizeName(d.name)
      const localName = this.normalizeName(d.localName)
      const deviceId = this.normalizeName(d.deviceId)
      // 1) 广播名以 BMXWL 开头（门锁固定前缀）
      if (name.startsWith('BMXWL') || localName.startsWith('BMXWL')) return true
      // 2) 广播名严格等于「BMXWL + door_mac」
      if (name === normalizedTarget || localName === normalizedTarget) return true
      // 3) 广播名包含 door_mac（兼容不同批次标识、冒号/横线等格式差异）
      if (macNorm.length >= 6 && (name.includes(macNorm) || localName.includes(macNorm))) return true
      // 4) Android 上 deviceId 即 MAC 地址，直接与 door_mac 比对
      if (macNorm && deviceId === macNorm) return true
      return false
    }

    return new Promise((resolve, reject) => {
      // 预扫描可能已经找到过该设备，直接复用
      const cached = (this.bleUtils.bleDevices.value || []).find(isMatch)
      if (cached) {
        resolve(cached)
        return
      }

      const timer = setTimeout(() => {
        reject(new Error('搜索设备超时'))
      }, 10000) // 10秒超时

      uni.onBluetoothDeviceFound(res => {
        const device = (res.devices || []).find(isMatch)
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
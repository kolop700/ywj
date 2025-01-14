import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useDeviceStore = defineStore('device', () => {
  const deviceList = ref([])

  // 过滤后的设备列表作为 getter
  const filteredDevices = computed(() => {
    return deviceList.value.sort((a, b) => {
      // 在线设备排在前面
      return b.online.localeCompare(a.online)
    })
  })

  // 设置设备列表
  function setDeviceList(list) {
    deviceList.value = list
  }

  // 清空设备列表
  function clearDeviceList() {
    deviceList.value = []
  }

  // 获取在线设备数量
  const onlineDeviceCount = computed(() => {
    return deviceList.value.filter(device => device.online === "1").length
  })

  // 获取离线设备数量
  const offlineDeviceCount = computed(() => {
    return deviceList.value.filter(device => device.online === "0").length
  })

  return {
    deviceList,
    filteredDevices,
    setDeviceList,
    clearDeviceList,
    onlineDeviceCount,
    offlineDeviceCount
  }
}) 
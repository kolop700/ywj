<template>
  <view class="door-list-container">
    <!-- 顶部搜索框 -->
    <view class="search-box">
      <input 
        type="text" 
        v-model="searchKey" 
        placeholder="搜索设备名称" 
        placeholder-class="placeholder"
      />
    </view>

   

    <!-- 设备列表 -->
    <scroll-view 
      class="device-list" 
      scroll-y
      refresher-enabled
      :refresher-triggered="isTriggered"
      refresher-threshold="120"
      refresher-background="#f5f6fc"
      @refresherrefresh="onRefresh"
      @refresherrestore="onRestore"
      @refresherpulling="onPulling"
      :style="{ height: listHeight + 'rpx' }"
      @scrolltolower="onScrollToLower"
    >
      <!-- 设备列表内容 -->
      <view class="device-list-content">
        <view 
          class="device-item" 
          v-for="(item, index) in filteredDevices" 
          :key="index"
          :class="[item.online !== '1' ? 'state' : '']"
          @click="handleDeviceClick(item)"
        >
          <view class="item-left">
            <text class="item-title" :class="{'state': item.online !== '1'}">
              {{ item.door_name }}
            </text>
            <view class="item-address" :class="{'state': item.online !== '1'}">
              <text>地址：{{ item.comm_name }}{{ item.unit_name }}</text>
            </view>
          </view>
          <view class="item-right">
            <text 
              class="status-text"
              :class="{'state': item.online !== '1'}"
            >
              {{ item.online === '1' ? '在线' : '离线' }}
            </text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 底部横幅广告（Taku） -->
    <view class="ad-section" v-if="bannerAdId">
      <view class="ad-divider"></view>
      <view class="ad-view">
        <taku-banner :placement-id="bannerAdId"></taku-banner>
      </view>
    </view>
  </view>

  <!-- 脱机临时密码弹窗 -->
  <offline-pwd-popup
    :visible="showOfflinePwd"
    :device="offlineDevice"
    @close="showOfflinePwd = false"
  />
</template>

<script setup>
import { ref, computed, getCurrentInstance, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { adManager } from '@/utils/adUtils'
import doorAccessUtils from '@/utils/doorAccessUtils'
import OfflinePwdPopup from '@/components/offline-pwd-popup/offline-pwd-popup.vue'
import { getPageHeight } from '@/utils/layout'

const { proxy } = getCurrentInstance()
const userStore = proxy.$store.user.useUserStore()
const deviceStore = proxy.$store.device.useDeviceStore()
const adStore = proxy.$store.ad.useAdStore()
const adControlStore = proxy.$store.adControl.useAdControlStore()
const deviceApi = proxy.$api.device

// 横幅广告位 ID（Taku placementId，空/全关时不展示；随 adType 自动响应更新）
const bannerAdId = computed(() => adStore.getBannerAdId())

// 脱机密码弹窗状态
const showOfflinePwd = ref(false)
const offlineDevice = ref(null)

// 页面高度
const windowHeight = ref('100vh')
// 列表高度
const listHeight = ref(750)

// 计算列表高度
const updateListHeight = async () => {
  // #ifdef MP-WEIXIN || APP-PLUS
  try {
    const sys = uni.getSystemInfoSync()
    const statusBarHeight = sys.statusBarHeight || 0
    const navBarHeight = 44
    // 测量搜索框高度
    const searchBoxHeight = await new Promise((resolve) => {
      uni.createSelectorQuery().select('.search-box').boundingClientRect((rect) => {
        resolve(rect ? rect.height : 0)
      }).exec()
    })
    // 计算列表可用高度 = 窗口高度 - 状态栏 - 导航栏 - 搜索框高度
    const availableHeight = sys.windowHeight - statusBarHeight - navBarHeight - searchBoxHeight
    // 转换为rpx
    listHeight.value = availableHeight * (750 / sys.windowWidth)
  } catch (error) {
    console.error('计算高度失败:', error)
    listHeight.value = 750 // 默认高度
  }
  // #endif
}

// 页面加载时设置高度
onMounted(async () => {
  windowHeight.value = getPageHeight()
  await updateListHeight()
})

// 监听窗口大小变化
onLoad(() => {
  // 初始化广告管理器（预加载激励/插屏广告）
  adManager.initStore(adStore, adControlStore)
  adManager.init()
  // #ifdef MP-WEIXIN || APP-PLUS
  uni.onWindowResize(() => {
    updateListHeight()
  })
  // #endif
})

// 搜索关键词
const searchKey = ref('')

// 过滤后的设备列表
const filteredDevices = computed(() => {
  if (!searchKey.value) return deviceStore.filteredDevices
  return deviceStore.filteredDevices.filter(item => {
    const searchText = searchKey.value.toLowerCase()
    const nameMatch = item.door_name?.toLowerCase().includes(searchText)
    const addressMatch = `${item.comm_name || ''}${item.unit_name || ''}`
      .toLowerCase()
      .includes(searchText)
    return nameMatch || addressMatch
  })
})

// 下拉刷新状态
const isTriggered = ref(false)

// 下拉刷新处理函数
const onRefresh = async () => {
  console.log('开始刷新')
  isTriggered.value = true
  try {
    const res = await deviceApi.getDoorList(userStore.userId)
    if (res.data) {
      deviceStore.setDeviceList(res.data)
      uni.showToast({
        title: '刷新成功',
        icon: 'success'
      })
    }
  } catch (error) {
    console.error('获取设备列表失败', error)
    if (!deviceStore.deviceList.length) {
      uni.showToast({
        title: '获取设备列表失败',
        icon: 'none'
      })
    }
  } finally {
    isTriggered.value = false
  }
}

// 下拉刷新被复位
const onRestore = () => {
  console.log('刷新被复位')
  isTriggered.value = false
}

// 下拉刷新被触发
const onPulling = () => {
  console.log('下拉刷新触发')
}

// 处理设备点击
const handleDeviceClick = async (device) => {
  if (!userStore.checkLogin()) return
  console.log('[设备完整信息]', JSON.stringify(device))
  
  if (device.online === '1') {
    try {
      const success = await doorAccessUtils.openDoor(device)
      if (success && success.success) {
        console.log('开门成功:', device)
        // 开门成功后展示广告（Taku 激励/插屏，按 adType）
        try {
          const adResult = await adManager.showAd()
          if (!adResult) {
            console.log('广告展示受限：可能达到每日限制或间隔时间不足')
          }
        } catch (error) {
          console.error('广告展示失败:', error)
        }
      }
    } catch (error) {
      console.error('开门操作失败:', error)
      // 数据同步成功（命令已下发）不算真正失败，不弹脱机密码
      if (error === true) return
      // 开门失败，弹出脱机临时密码
      showOfflinePwdPopup(device)
    }
  } else {
    // 设备离线，直接弹出脱机临时密码
    showOfflinePwdPopup(device)
  }
}

// 开门失败/设备离线时弹出脱机临时密码
const showOfflinePwdPopup = (device) => {
  if (!device || !device.factory_code) {
    uni.showToast({
      title: '该设备缺少出厂码，无法生成脱机密码',
      icon: 'none'
    })
    return
  }
  offlineDevice.value = device
  showOfflinePwd.value = true
}

// 处理滚动到底部
const onScrollToLower = () => {
  console.log('滚动到底部')
}

</script>

<style lang="scss">
/* #ifdef MP-WEIXIN */
page {
  height: 100vh;
  background-color: #F5F6FC;
}
/* #endif */

.door-list-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #F5F6FC;
  box-sizing: border-box;
  padding: 20rpx 24rpx 0 24rpx;
  position: relative;
}

/* 搜索框：浅紫灰胶囊 */
.search-box {
  flex: none;
  margin-bottom: 20rpx;
  padding: 0;

  input {
    width: 100%;
    height: 84rpx;
    background: #EEF1FB;
    border: 1rpx solid #E4E9FD;
    border-radius: 42rpx;
    padding: 0 34rpx;
    font-size: 28rpx;
    color: #1F2435;
    box-sizing: border-box;
    transition: all 0.2s;
  }

  .placeholder {
    color: #9AA0B5;
  }
}

.device-list {
  flex: 1;
  background: transparent;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;

  .device-list-content {
    padding-top: 8rpx;
    // 为底部悬浮横幅广告预留滚动空间
    padding-bottom: 200rpx;
  }

  /* 设备行：白卡分组悬浮 */
  .device-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 28rpx 26rpx;
    margin-bottom: 20rpx;
    background: #FFFFFF;
    border-radius: 24rpx;
    border: 1rpx solid #EEF0F8;
    box-shadow: 0 6rpx 20rpx rgba(74, 108, 247, 0.06);
    transition: all 0.2s;
    
    &.state {
      background: #FFFFFF;
      box-shadow: 0 4rpx 14rpx rgba(31, 42, 122, 0.04);

      &:active {
        opacity: 0.75;
      }
    }
    
    &:active {
      background: #F0F2FE;
      border-color: #4A6CF7;
      transform: scale(0.985);
    }

    .item-left {
      flex: 1;
      min-width: 0;

      .item-title {
        font-size: 28rpx;
        color: #232838;
        font-weight: 600;
        margin-bottom: 10rpx;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        
        &.state {
          color: #9AA0B5;
        }
      }
      
      .item-address {
        font-size: 24rpx;
        color: #8A90A6;
        line-height: 1.4;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        
        &.state {
          color: #B4B9CC;
        }
      }
    }
    
    .item-right {
      flex: none;
      margin-left: 20rpx;

      /* 在线：品牌绿徽章 / 离线：浅灰徽章 */
      .status-text {
        font-size: 22rpx;
        font-weight: 500;
        color: #16A34A;
        background: rgba(22, 163, 74, 0.1);
        padding: 8rpx 20rpx;
        border-radius: 26rpx;
        line-height: 1.2;
        
        &.state {
          color: #8A90A6;
          background: #F0F1F8;
        }
      }
    }
  }
}

/* ===== 底部横幅广告（Taku）：悬浮于视口底部，不挤压列表滚动区 ===== */
.ad-section {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: 0;
  z-index: 10;
  background: #ffffff;
  border-radius: 24rpx 24rpx 0 0;
  box-shadow: 0 -6rpx 20rpx rgba(74, 108, 247, 0.08);
  box-sizing: border-box;

  .ad-divider {
    height: 2rpx;
    background: #eeeeee;
  }

  .ad-view {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 120rpx;
    padding: 8rpx 0;
  }
}

</style>

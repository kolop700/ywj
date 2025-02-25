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
      refresher-background="#f8f8f8"
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

    <!-- 底部广告区域 -->
    <view class="ad-section">
      <view class="divider"></view>
      <view class="ad-view">
        <ad 
          v-if="bannerAdId"
          :adpid="bannerAdId" 
          @load="onAdLoad" 
          @close="onAdClose" 
          @error="onAdError">
        </ad>
      </view> 
    </view>
  </view>
</template>

<script setup>
import { ref, computed, getCurrentInstance, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import doorAccessUtils from '@/utils/doorAccessUtils'
import { getPageHeight, calculateScrollViewHeight } from '@/utils/layout'
import { adManager } from '@/utils/adUtils'

const { proxy } = getCurrentInstance()
const userStore = proxy.$store.user.useUserStore()
const deviceStore = proxy.$store.device.useDeviceStore()
const adStore = proxy.$store.ad.useAdStore()
const adControlStore = proxy.$store.adControl.useAdControlStore()
const deviceApi = proxy.$api.device

// 广告相关状态
const isAdLoaded = ref(false)
const bannerAdId = ref('')

// 页面高度
const windowHeight = ref('100vh')
// 列表高度
const listHeight = ref(750)

// 计算列表高度
const updateListHeight = async () => {
  // #ifdef MP-WEIXIN || APP-PLUS
  try {
    const height = await calculateScrollViewHeight()
    listHeight.value = height
  } catch (error) {
    console.error('计算高度失败:', error)
    listHeight.value = 750 // 默认高度
  }
  // #endif
}

// 初始化广告管理器
const initAdManager = () => {
  adManager.initStore(adStore, adControlStore)
  adManager.init()
}

// 页面加载时设置高度和广告
onMounted(async () => {
  windowHeight.value = getPageHeight()
  await updateListHeight()
  
  // 初始化广告ID和广告管理器
  try {
    bannerAdId.value = adStore.getBannerAdId()
    initAdManager()
    console.log('广告ID:', bannerAdId.value)
  } catch (error) {
    console.error('获取广告ID失败:', error)
  }
})

// 监听窗口大小变化
onLoad(() => {
  // #ifdef MP-WEIXIN || APP-PLUS
  uni.onWindowResize(() => {
    updateListHeight()
  })
  // #endif
})

// 广告事件处理
const onAdLoad = (e) => {
  console.log('广告加载成功', e)
  isAdLoaded.value = true
}

const onAdClose = (e) => {
  console.log('广告关闭', e)
  isAdLoaded.value = false
}

const onAdError = (e) => {
  console.error('广告加载失败', e)
  isAdLoaded.value = false
}

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
  
  if (device.online === '1') {
    try {
      const success = await doorAccessUtils.openDoor(device)
      if (success) {
        console.log('开门成功:', device)
        // 开门成功后展示广告
        try {
          // 先尝试展示激励广告
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
    }
  } else {
    uni.showToast({
      title: '设备离线',
      icon: 'none',
      duration: 3000
    })
  }
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
  background-color: #F8F8F8;
}
/* #endif */

.door-list-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #F8F8F8;
  box-sizing: border-box;
  padding: 20rpx 20rpx 0 20rpx;
  position: relative;
}

.search-box {
  height: 104rpx;
  flex: none;
  margin-bottom: 20rpx;
  padding: 20rpx;
  background: #FFFFFF;
  border-radius: 12rpx;

  input {
    width: 100%;
    height: 64rpx;
    background: #F8F8F8;
    border-radius: 32rpx;
    padding: 0 30rpx;
    font-size: 28rpx;
    box-sizing: border-box;
  }

  .placeholder {
    color: #999;
  }
}

.device-list {
  flex: 1;
  background: #FFFFFF;
  border-radius: 12rpx;
  padding: 20rpx;
  overflow-y: auto;
  margin-bottom: 245rpx; // 广告高度 + 间距
  -webkit-overflow-scrolling: touch;

  .device-list-content {
    padding-top: 40rpx;
  }

  .device-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 20rpx;
    margin-bottom: 20rpx;
    background: #F8F8F8;
    border-radius: 12rpx;
    transition: all 0.2s;
    
    &.state {
      background: #F5F5F5;
      
      &:active {
        background: #F5F5F5;
        opacity: 0.8;
      }
    }
    
    &:active {
      background: #FF0036;
      
      .item-left {
        .item-title {
          color: #FFFFFF;
        }
        
        .item-address {
          color: rgba(255, 255, 255, 0.8);
        }
      }
      
      .item-right {
        .status-text {
          color: #FFFFFF;
        }
      }
    }

    .item-left {
      flex: 1;
      
      .item-title {
        font-size: 28rpx;
        color: #333;
        font-weight: 500;
        margin-bottom: 8rpx;
        
        &.state {
          color: #999;
        }
      }
      
      .item-address {
        font-size: 24rpx;
        color: #666;
        line-height: 1.4;
        
        &.state {
          color: #999;
        }
      }
    }
    
    .item-right {
      .status-text {
        font-size: 24rpx;
        color: #FF0036;
        
        &.state {
          color: #999;
        }
      }
    }
  }
}

.ad-section {
  position: absolute;
  left: 20rpx;
  right: 20rpx;
  bottom: 0;
  width: auto;
  height: 225rpx;
  background: #FFFFFF;
  box-sizing: border-box;
  z-index: 99;

  .divider {
    height: 2rpx;
    background: #EEEEEE;
  }

  .ad-view {
    width: 100%;
    height: 220rpx;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #FFFFFF;
    
    ad {
      width: 100%;
      height: 100%;
    }
  }
}
</style> 
<template>
  <view class="page-container">
    <!-- 顶部用户信息 - 固定高度 -->
    <view class="user-header">
      <view class="avatar">
        <image v-if="userStore.avatarUrl" :src="userStore.avatarUrl" mode="aspectFill" class="avatar-img"></image>
        <up-icon v-else name="account" size="24"></up-icon>
      </view>
      <text>{{ userStore.userName || '未登录' }}</text>
    </view>

    <!-- 内容区域 - 自适应高度 -->
    <view class="content-wrapper">
      <!-- 公告横幅 -->
      <view class="notice-banner">
        <up-image
          src="/static/img/img_ad.png"
          width="100%"
          height="100%"
          shape="aspectFill"></up-image>
      </view>

      <!-- 功能按钮网格 -->
      <view class="grid-wrapper">
        <up-grid :border="false" :col="3">
          <up-grid-item
            v-for="(item, index) in menuList"
            :key="index"
            @click="handleGridItemClick(item)">
            <view class="grid-item">
              <image
                :src="item.icon"
                mode="aspectFit"
                class="grid-icon"></image>
              <text class="grid-text">{{ item.name }}</text>
            </view>
          </up-grid-item>
        </up-grid>
      </view>

      <!-- 底部按钮 -->
      <view class="bottom-btns">
        <view class="custom-btn" @click="handleScanCode">
          <image
            src="/static/icons/icon_opendoor_code.png"
            mode="aspectFit"
            class="btn-icon"></image>
          <text class="btn-text">扫码开门</text>
        </view>
        <view class="custom-btn" @click="handleRemoteOpen">
          <image
            src="/static/icons/icon_opendoor_one.png"
            mode="aspectFit"
            class="btn-icon"></image>
          <text class="btn-text">远程开门</text>
        </view>
      </view>
    </view>

    <!-- 底部广告区域 - 固定高度 -->
    <view class="ad-section">
      <up-image
        src="/static/img/img_ad.png"
        width="100%"
        height="160rpx"
        shape="round"></up-image>
    </view>

    <!-- 远程开门弹框 -->
    <uni-popup ref="popup" type="center" :mask-click="true" @change="onPopupChange">
      <view class="device-popup">
        <view class="popup-header">
          <text>设备列表</text>
          <text class="close-icon" @click="closePopup">×</text>
        </view>
        <!-- 添加搜索框 -->
        <view class="search-box">
          <input 
            type="text" 
            v-model="searchKey" 
            placeholder="搜索设备名称" 
            placeholder-class="placeholder"
          />
        </view>
        <view class="device-list">
          <view 
            class="device-item" 
            v-for="(item, index) in filteredDeviceList" 
            :key="index"
            :class="[
              item.status === '离线' ? 'offline-item' : 'online-item',
            ]"
            @click="handleDeviceClick(item)"
          >
            <view class="device-info">
              <text class="device-name">{{ item.name }}</text>
              <text class="device-address" v-if="item.address">地址：{{ item.address }}</text>
            </view>
            <text class="status-text">{{ item.status }}</text>
          </view>
        </view>
        <view class="refresh-btn" @click="refreshDeviceList">刷新</view>
      </view>
    </uni-popup>
  </view>
</template>

<script setup>
import { ref, getCurrentInstance, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const { proxy } = getCurrentInstance()
const userStore = proxy.$store.user.useUserStore()

// 菜单列表
const menuList = ref([
  {
    name: "用户登录",
    icon: "/static/icons/icon_user_login.png",
    url: "/user_package/pages/login/index",
  },
  { 
    name: "房屋申请", 
    icon: "/static/icons/icon_hous_application.png",
    needLogin: true
  },
  { 
    name: "访客密码", 
    icon: "/static/icons/icon_guest_password.png",
    needLogin: true
  },
  {
    name: "开门二维码",
    icon: "/static/icons/icon_opendoor_password.png",
    needLogin: true
  },
  { 
    name: "我的", 
    icon: "/static/icons/icon_my.png",
    needLogin: true
  },
  { 
    name: "使用帮助", 
    icon: "/static/icons/icon_help.png" 
  },
])

// 页面加载时检查登录状态
onLoad(() => {
  userStore.checkLogin()
})

// 处理网格项点击
const handleGridItemClick = (item) => {
  if (item.needLogin && !userStore.checkLogin()) {
    return
  }
  if (item.url) {
    uni.navigateTo({
      url: item.url
    })
  }
}

// 处理扫码开门
const handleScanCode = () => {
  if (!userStore.checkLogin()) return
  // 扫码开门的逻辑
}

// 设备列表弹框状态
const showDeviceList = ref(false)

// 模拟设备列表数据
const deviceList = ref([
  {
    name: '1栋1单元门',
    address: '省警察学生宿区（建研所）1栋1单元',
    status: '在线'
  },
  {
    name: '2.8一体机产线测试',
    address: '盈警盾工业区 某某某某某某设计开发区',
    status: '离线'
  },
  {
    name: '2组团15栋2单元门',
    address: '东莞市江南二期园（盈翠市）15栋2单元',
    status: '在线'
  }
  ,
  {
    name: '2.8一体机产线测试',
    address: '盈警盾工业区 某某某某某某设计开发区',
    status: '离线'
  },
  {
    name: '2组团15栋2单元门',
    address: '东莞市江南二期园（盈翠市）15栋2单元',
    status: '在线'
  },
  {
    name: '人行门',
    address: '',
    status: '在线'
  },
  {
    name: '2.8一体机产线测试',
    address: '盈警盾工业区 某某某某某某设计开发区',
    status: '离线'
  },
  {
    name: '2组团15栋2单元门',
    address: '东莞市江南二期园（盈翠市）15栋2单元',
    status: '在线'
  },
])

const popup = ref(null)

// 处理远程开门
const handleRemoteOpen = () => {
  if (!userStore.checkLogin()) return
  popup.value.open()
}

// 关闭弹框
const closePopup = () => {
  popup.value.close()
}

// 弹框状态变化回调
const onPopupChange = (e) => {
  showDeviceList.value = e.show
}

// 刷新设备列表
const refreshDeviceList = () => {
  console.log('刷新设备列表')
  // TODO: 调用获取设备列表API
}

// 处理设备点击
const handleDeviceClick = (device) => {
  if (device.status === '在线') {
    // TODO: 处理开门逻辑
    console.log('开门:', device)
  }
}

// 搜索关键词
const searchKey = ref('')

// 过滤后的设备列表
const filteredDeviceList = computed(() => {
  if (!searchKey.value) return deviceList.value
  return deviceList.value.filter(item => 
    item.name.toLowerCase().includes(searchKey.value.toLowerCase()) ||
    (item.address && item.address.toLowerCase().includes(searchKey.value.toLowerCase()))
  )
})
</script>

<style lang="scss">
.page-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 10rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.user-header {
  height: 6vh;
  min-height: 70rpx;
  flex: none;
  display: flex;
  align-items: center;
  padding: 10rpx;

  .avatar {
    width: 5vh;
    height: 5vh;
    min-width: 50rpx;
    min-height: 50rpx;
    border-radius: 50%;
    background: #f5f5f5;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 15rpx;
    overflow: hidden;

    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  text {
    font-size: calc(12px + 0.5vh);
  }
}

.content-wrapper {
  height: calc(94vh - 200rpx - 20rpx);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  justify-content: center;
  gap: 20rpx;
}

.notice-banner {
  height: 20%;
  min-height: 90rpx;
  border-radius: 8rpx;
  overflow: hidden;
  margin: 0;
}

.grid-wrapper {
  height: 45%;
  overflow: hidden;
  margin: 0;

  .grid-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;

    .grid-icon {
      width: 150rpx;
      height: 150rpx;
    }

    .grid-text {
      font-size: 24rpx;
      margin-top: 10rpx;
    }
  }
}

.bottom-btns {
  height: 30%;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 0 20rpx;

  .custom-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .btn-icon {
      width: 200rpx;
      height: 200rpx;
      margin-bottom: 10rpx;
    }

    .btn-text {
      font-size: 24rpx;
      color: #333;
    }
  }
}

.ad-section {
  height: 200rpx;
  flex: none;
  margin-top: auto;
  padding: 0 10rpx;

  :deep(.up-image) {
    border-radius: 8rpx;
    overflow: hidden;
  }
}

.device-popup {
  width: 85vw;
  height: 75vh;
  background: #fff;
  border-radius: 20rpx;
  overflow: hidden;
  position: relative;
  z-index: 999;
  padding: 0 0 20rpx 0;
  display: flex;
  flex-direction: column;

  .popup-header {
    flex: none;
    padding: 30rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #eee;
    
    .close-icon {
      font-size: 40rpx;
      color: #999;
    }
  }

  .search-box {
    flex: none;
    margin: 20rpx;
    padding: 20rpx;
    background: #F8F8F8;
    border-radius: 12rpx;

    input {
      width: 100%;
      height: 64rpx;
      background: #FFFFFF;
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
    margin: 0 20rpx;
    padding: 20rpx;
    overflow-y: auto;
    border-radius: 12rpx;
    background: #F8F8F8;

    .device-item {
      margin-bottom: 20rpx;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      background: #FFFFFF;
      border-radius: 12rpx;
      padding: 20rpx;
      transition: all 0.5s;

      &.offline-item {
        background: #F5F5F5;
        .device-info {
          .device-name, .device-address {
            color: #999;
          }
        }
        .status-text {
          color: #999;
        }
      }

      &.online-item {
        cursor: pointer;
        &:active {
          background: #FF0036;
          .device-info {
            .device-name, .device-address {
              color: #FFFFFF;
            }
          }
          .status-text {
            color: #FFFFFF;
          }
        }
      }

      &:last-child {
        margin-bottom: 0;
      }

      .device-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8rpx;

        .device-name {
          font-size: 28rpx;
          color: #333;
          font-weight: 500;
        }

        .device-address {
          font-size: 24rpx;
          color: #999;
          line-height: 1.4;
        }
      }

      .status-text {
        font-size: 24rpx;
        &.online {
          color: #FF0036;
        }
        &.offline {
          color: #999;
        }
      }
    }
  }

  .refresh-btn {
    flex: none;
    margin: 40rpx 20rpx 20rpx;
    padding: 24rpx;
    text-align: center;
    background: #FF0036;
    color: #fff;
    font-size: 28rpx;
    border-radius: 12rpx;
  }
}
</style>

<template>
  <view class="page-container">
    <!-- 菜单列表 -->
    <view class="cu-list menu">
      <view class="menu-item" @tap="handleUpdateProfile">
        <view class="content">
          <text>修改用户资料</text>
        </view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view>
      
      <view class="menu-item" @tap="handleRefreshDevices">
        <view class="content">
          <text>刷新设备权限资料</text>
        </view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view>
      
      <view class="menu-item" @tap="handleAccountDelete">
        <view class="content">
          <text class="delete-text">注销账号</text>
        </view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view>
      
      <!-- <view class="menu-item" @tap="handleHelp">
        <view class="content">
          <text>使用帮助</text>
        </view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view> -->
      
      <!-- <view 
        v-if="userStore.userType === '2'" 
        class="menu-item"
        @tap="handleAdminLogin"
      >
        <view class="content">
          <text>管理员登录</text>
        </view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view> -->
    </view>
  </view>
</template>

<script setup>
import { ref, getCurrentInstance } from 'vue'
import { storeToRefs } from 'pinia'

const { proxy } = getCurrentInstance()
const userStore = proxy.$store.user.useUserStore()
const { userType } = storeToRefs(userStore)

// 修改用户资料
const handleUpdateProfile = () => {
  uni.navigateTo({
    url: '/user_package/pages/profile/index'
  })
}

// 刷新设备权限
const handleRefreshDevices = async () => {
  try {
    await userStore.login()
    uni.showToast({
      title: '刷新成功',
      icon: 'success'
    })
  } catch (error) {
    uni.showToast({
      title: '刷新失败',
      icon: 'none'
    })
  }
}

// 使用帮助
const handleHelp = () => {
  uni.navigateTo({
    url: '/deviceMode/pages/help/help'
  })
}

// 管理员登录
const handleAdminLogin = () => {
  uni.navigateTo({
    url: '/manageModule/pages/adminLogin/adminLogin'
  })
}

// 账号注销
const handleAccountDelete = () => {
  uni.showModal({
    title: '注销账号',
    content: '注销后，您的所有数据（包括人脸数据）将在30天内删除，且无法恢复。确定要注销吗？',
    confirmText: '确认注销',
    confirmColor: '#FF0000',
    cancelText: '再想想',
    success: async (res) => {
      if (res.confirm) {
        try {
          // // 这里调用注销账号的API
          await userStore.deleteAccount()
          uni.showToast({
            title: '账号注销成功',
            icon: 'success'
          })
          // 跳转到主页，然后跳转到登录页
          setTimeout(() => {
            uni.reLaunch({
              url: '/pages/index/index',
              success: () => {
                setTimeout(() => {
                  uni.redirectTo({
                    url: '/user_package/pages/login/index'
                  })
                }, 100)
              }
            })
          }, 1500)
        } catch (error) {
          uni.showToast({
            title: '注销失败，请稍后重试',
            icon: 'none'
          })
        }
      }
    }
  })
}
</script>

<style lang="scss">
page {
  background: #F5F5F5;
  height: 100vh;
}

.page-container {
  padding: 20rpx;
}

.cu-list.menu {
  background: #FFFFFF;
  border-radius: 12rpx;
  overflow: hidden;
  
  .menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 32rpx 24rpx;
    position: relative;
    
    // 分割线
    &:not(:last-child)::after {
      content: '';
      position: absolute;
      left: 24rpx;
      right: 24rpx;
      bottom: 0;
      height: 1px;
      background-color: #EEEEEE;
      transform: scaleY(0.5);
    }
    
    .content {
      flex: 1;
      text {
        font-size: 28rpx;
        color: #333333;
        font-weight: 400;
      }
    }
    
    .right-icon {
      width: 32rpx;
      height: 32rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      
      image {
        width: 100%;
        height: 100%;
      }
    }
  }
}

.custom-text {
  font-size: 32rpx;
  font-weight: 500;
  color: #333333;
}

.delete-text {
  color: #FF0000 !important;
}
</style>

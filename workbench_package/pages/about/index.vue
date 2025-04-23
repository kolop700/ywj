<template>
  <view class="page-container">
    <!-- 菜单列表 -->
    <view class="cu-list menu">
      <view class="menu-item" @tap="handleUserAgreement">
        <view class="content">
          <text>用户协议</text>
        </view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view>

      <view class="menu-item" @tap="handlePrivacyPolicy">
        <view class="content">
          <text>隐私政策</text>
        </view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view>

      <view class="menu-item" @tap="handleVersion">
        <view class="content">
          <text>程序版本</text>
        </view>
        <view class="right-text">
          <text>v{{ appVersion }}</text>
        </view>
      </view>

      <!-- 注销账号选项 -->
      <view 
        class="menu-item" 
        @tap="handleAccountDelete"
      >
        <view class="content">
          <text class="delete-text">注销账号</text>
        </view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, getCurrentInstance } from 'vue'
import { storeToRefs } from 'pinia'

const { proxy } = getCurrentInstance()
const userStore = proxy.$store.user.useUserStore()
const { userType } = storeToRefs(userStore)

const appVersion = ref('')

// 初始化版本号
const initVersion = () => {
  // #ifdef APP-PLUS
  appVersion.value = plus.runtime.version
  // #endif
  
  // #ifdef MP-WEIXIN
  const accountInfo = uni.getAccountInfoSync()
  appVersion.value = accountInfo.miniProgram.version
  // #endif
  
  // 如果以上都不匹配，设置默认版本
  if (!appVersion.value) {
    const systemInfo = uni.getSystemInfoSync()
    appVersion.value = systemInfo.appVersion || '1.0.0'
  }
}

// 处理用户协议点击
const handleUserAgreement = () => {
  uni.navigateTo({
    url: '/user_package/pages/agreement/user'
  })
}

// 处理隐私政策点击
const handlePrivacyPolicy = () => {
  uni.navigateTo({
    url: '/user_package/pages/agreement/privacy'
  })
}

// 处理版本信息点击
const handleVersion = () => {
  uni.showToast({
    title: `当前版本：${appVersion.value}`,
    icon: 'none'
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

onMounted(() => {
  initVersion()
})
</script>

<style lang="scss">
page {
  background: #F5F5F5;
  height: 100vh;
}

.page-container {
  padding: 20rpx;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.cu-list.menu {
  background: #FFFFFF;
  border-radius: 12rpx;
  overflow: hidden;
  margin-bottom: auto;
  
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

.right-text {
  font-size: 28rpx;
  color: #999;
  margin-right: 10rpx;
}

.delete-text {
  color: #FF0000 !important;
}
</style> 
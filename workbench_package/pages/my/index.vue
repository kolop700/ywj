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

      <!-- 绑定微信选项 -->
      <view class="menu-item" @tap="handleBindWechat">
        <view class="content">
          <text>绑定微信</text>
        </view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view>
      
      <!-- 注销账号选项，仅在 iOS 平台显示 -->
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

    <!-- 底部广告区域 -->
    <view class="ad-section" :class="{ 'ad-loaded': isAdLoaded }">
      <view class="divider"></view>
      <view class="ad-view" v-if="bannerAdId">
        <ad 
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
import { ref, getCurrentInstance, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { onLoad } from '@dcloudio/uni-app'

const { proxy } = getCurrentInstance()
const userStore = proxy.$store.user.useUserStore()
const adStore = proxy.$store.ad.useAdStore()
const { userType } = storeToRefs(userStore)

const isAdLoaded = ref(false) // 控制广告加载状态
const bannerAdId = ref('') // 初始化为空字符串

// 获取应用版本号
const appVersion = ref('')

// 平台判断
const platform = ref('')

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

// 初始化广告
const initAd = () => {
  setTimeout(() => {
    const adId = adStore.getBannerAdId()
    console.log('获取广告ID:', adId)
    bannerAdId.value = adId
  }, 100) // 延迟100ms加载广告
}

onMounted(() => {
  initAd()
  initVersion() // 初始化版本号
  // 获取平台信息
  const systemInfo = uni.getSystemInfoSync()
  platform.value = systemInfo.platform.toLowerCase()
})

// 广告相关的事件处理函数
const onAdLoad = (e) => {
  console.log('广告加载成功', e)
  isAdLoaded.value = true
}

const onAdClose = (e) => {
  console.log('广告关闭', e)
  isAdLoaded.value = false
  // 广告关闭后，延迟重新加载
  setTimeout(() => {
    initAd()
  }, 300)
}

const onAdError = (e) => {
  console.error('广告加载失败', e)
  isAdLoaded.value = false
  // 广告加载失败后，延迟重试
  setTimeout(() => {
    initAd()
  }, 300)
}

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
  // 版本号点击时可以不做任何操作，或者显示更多版本信息
  uni.showToast({
    title: `当前版本：${appVersion.value}`,
    icon: 'none'
  })
}

// 处理绑定微信
const handleBindWechat = () => {
  console.log('点击绑定微信按钮')
  
  // #ifdef MP-WEIXIN
  uni.showModal({
    title: '提示',
    content: '您当前已在微信小程序中，无需绑定',
    showCancel: false
  })
  // #endif
  
  // #ifdef APP-PLUS
  uni.showModal({
    title: '绑定微信',
    content: '是否跳转到微信小程序进行绑定？',
    success: (res) => {
      if (res.confirm) {
        console.log('用户确认跳转')
        // 使用 uni.navigateToMiniProgram 跳转到小程序
        uni.navigateToMiniProgram({
          appId: 'wx6a5561be592cc61d', // 目标小程序的 appId
          path: 'pages/qropen/qropen', // 目标小程序的页面路径
          success(res) {
            console.log('跳转成功', res)
          },
          fail(err) {
            console.error('跳转失败', err)
            uni.showToast({
              title: '跳转失败，请确保已安装微信',
              icon: 'none',
              duration: 2000
            })
          }
        })
      } else {
        console.log('用户取消跳转')
      }
    }
  })
  // #endif
}
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

.custom-text {
  font-size: 32rpx;
  font-weight: 500;
  color: #333333;
}

.delete-text {
  color: #FF0000 !important;
}

.ad-section {
  width: 100%;
  height: 225rpx;
  flex: none;
  box-sizing: border-box;
  margin-top: 20rpx;
  opacity: 0;
  transition: all 0.3s ease-in-out;
  transform: translateY(20rpx);

  &.ad-loaded {
    opacity: 1;
    transform: translateY(0);
  }

  .divider {
    height: 2rpx;
    background: #EEEEEE;
  }

  .ad-view {
    height: 220rpx;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #FFFFFF;
    border-radius: 12rpx;
    overflow: hidden;
    
    ad {
      width: 100%;
      height: 220rpx;
    }
  }
}

.right-text {
  font-size: 28rpx;
  color: #999;
  margin-right: 10rpx;
}
</style>

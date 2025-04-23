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

      <!-- 添加权限详情选项 -->
      <view class="menu-item" @tap="handleOpenAppSettings">
        <view class="content">
          <text>应用权限详情</text>
        </view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view>

      <!-- 绑定微信选项 -->
      <view class="menu-item" @tap="handleBindWechat">
        <view class="content">
          <text>绑定微信视频通话授权</text>
        </view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view>
            <!-- 管理员入口 -->
      <view 
        v-if="isAdmin" 
        class="menu-item"
        @tap="handleAdminLogin"
      >
        <view class="content">
          <text>管理员登录</text>
        </view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view>


      <!-- 关于我们选项 -->
      <view class="menu-item" @tap="handleAbout">
        <view class="content">
          <text>关于我们</text>
        </view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view>
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
import { ref, getCurrentInstance, onMounted, onLoad } from 'vue'
import { storeToRefs } from 'pinia'
import { encrypt, decrypt } from '@/utils/aesUtils'
import userApi from '@/api/user/user'

const { proxy } = getCurrentInstance()
const userStore = proxy.$store.user.useUserStore()
const adStore = proxy.$store.ad.useAdStore()
const { userType } = storeToRefs(userStore)

const isAdLoaded = ref(false) // 控制广告加载状态
const bannerAdId = ref('') // 初始化为空字符串
const isAdmin = ref(false) // 是否是管理员

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

// 检查管理员权限
const checkAdminStatus = async () => {
  try {
    // #ifdef MP-WEIXIN
    // 获取用户信息
    const userInfo = uni.getStorageSync('userInfo')
    if (!userInfo) {
      console.log('未获取到用户信息')
      isAdmin.value = false
      return
    }
    
    const res = await userApi.getUserStatus(userInfo.user_id)
    isAdmin.value = res.data && res.data.length > 0
    console.log('管理员权限检查结果:', isAdmin.value)
    // #endif
    
    // #ifdef APP-PLUS
    const res = await userApi.getUserStatus(userStore.userId)
    isAdmin.value = res.data && res.data.length > 0
    console.log('管理员权限检查结果:', isAdmin.value)
    // #endif
  } catch (error) {
    console.error('检查管理员权限失败:', error)
    isAdmin.value = false
  }
}

onMounted(() => {
  initAd()
  initVersion() // 初始化版本号
  // 获取平台信息
  const systemInfo = uni.getSystemInfoSync()
  platform.value = systemInfo.platform.toLowerCase()
  checkAdminStatus()
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
  // #ifdef MP-WEIXIN
  uni.navigateTo({
    url: '/manageModule/pages/adminLogin/adminLogin'
  })
  // #endif
  
  // #ifdef APP-PLUS
  plus.share.getServices(
    (services) => {
      console.log('获取到的服务列表：', services)
      const weixinService = services.find(item => item.id === "weixin")
      if (weixinService) {
        console.log('找到微信服务，准备打开小程序')
        weixinService.launchMiniProgram({
          id: "gh_1329871b16ba",  // 微信小程序原始 ID
          path: `manageModule/pages/adminLogin/adminLogin?fromApp=1`, // 小程序页面路径，添加fromApp标识
          type: 0,          // 0-正式版；1-测试版；2-体验版
        })
      } else {
        console.log('未找到微信服务')
        uni.showToast({
          title: '请安装微信',
          icon: 'none'
        })
      }
    },
    (error) => {
      console.error('获取服务失败:', error)
      uni.showToast({
        title: '获取微信服务失败',
        icon: 'none'
      })
    }
  )
  // #endif
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
  console.log('当前用户信息：', {
    account: userStore.userAcct,
    password: userStore.userPassword
  })
  
  uni.showModal({
    title: '绑定微信',
    content: '是否跳转到微信小程序进行绑定？',
    success: (res) => {
      if (res.confirm) {
        console.log('用户确认跳转')
        
        // 加密前的原始数据
        const originalData = {
          account: userStore.userAcct,
          password: userStore.userPassword,
          timestamp: Date.now()
        }
        
        // 对数据进行加密
        const encryptedAccount = encrypt(originalData.account)
        const encryptedPassword = encrypt(originalData.password)
        
        // 检查加密是否成功
        if (!encryptedAccount || !encryptedPassword) {
          uni.showToast({
            title: '数据加密失败',
            icon: 'none'
          })
          return
        }
        
        // 构建加密后的查询参数
        const query = `account=${encodeURIComponent(encryptedAccount)}&password=${encodeURIComponent(encryptedPassword)}&timestamp=${originalData.timestamp}`
        
        // 使用 plus.share.getServices 打开微信小程序
        plus.share.getServices(
          (services) => {
            console.log('获取到的服务列表：', services)
            const weixinService = services.find(item => item.id === "weixin")
            if (weixinService) {
              console.log('找到微信服务，准备打开小程序')
              weixinService.launchMiniProgram({
                id: "gh_1329871b16ba",  // 微信小程序原始 ID
                path: `"pages/voipbind/voipbind?${query}`, // 小程序页面路径，带参数
                type: 0,          // 0-正式版；1-测试版；2-体验版
              })
            } else {
              console.log('未找到微信服务')
              uni.showToast({
                title: '请安装微信',
                icon: 'none'
              })
            }
          },
          (error) => {
            console.error('获取服务失败:', error)
            uni.showToast({
              title: '获取微信服务失败',
              icon: 'none'
            })
          }
        )
      } else {
        console.log('用户取消跳转')
      }
    }
  })
  // #endif
}

// 打开应用权限设置
const handleOpenAppSettings = () => {
  // #ifdef APP-PLUS
  try {
    // iOS权限检查
    if (uni.getSystemInfoSync().platform === 'ios') {
      const UIApplicationClass = plus.ios.importClass("UIApplication")
      const NSURLClass = plus.ios.importClass("NSURL")
      const settingsUrl = NSURLClass.URLWithString('app-settings:')
      const application = UIApplicationClass.sharedApplication()
      application.openURL(settingsUrl)
    } else {
      // Android权限检查
      const main = plus.android.runtimeMainActivity()
      const Intent = plus.android.importClass('android.content.Intent')
      const Settings = plus.android.importClass('android.provider.Settings')
      const Uri = plus.android.importClass('android.net.Uri')
      
      const intent = new Intent()
      intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
      const uri = Uri.fromParts('package', main.getPackageName(), null)
      intent.setData(uri)
      
      main.startActivity(intent)
    }
  } catch (e) {
    console.error('打开设置失败:', e)
    uni.showToast({
      title: '打开设置失败',
      icon: 'none'
    })
  }
  // #endif
  
  // #ifdef MP-WEIXIN
  uni.showModal({
    title: '提示',
    content: '小程序环境下无法直接打开权限设置',
    showCancel: false
  })
  // #endif
}

// 在 script 部分添加 handleAbout 函数
const handleAbout = () => {
  uni.navigateTo({
    url: '/workbench_package/pages/about/index'
  })
}

const appVersion = ref('')

const handleVersion = () => {
  uni.showToast({
    title: `当前版本：${appVersion.value}`,
    icon: 'none'
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

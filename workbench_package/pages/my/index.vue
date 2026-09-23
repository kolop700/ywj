<template>
  <view class="page-container" :class="{ 'has-ad': bannerAdId }">
    <!-- 用户信息头部（蓝紫渐变） -->
    <view class="me-hero">
      <view class="wg-glow me-glow-1"></view>
      <view class="wg-glow me-glow-2"></view>
      <view class="hero-avatar" @tap="handleUpdateProfile">
        <image v-if="userStore.avatarUrl" :src="userStore.avatarUrl" mode="aspectFill"></image>
        <up-icon v-else name="account-fill" size="48" color="#FFFFFF"></up-icon>
      </view>
      <view class="hero-info">
        <text class="hero-name">{{ userStore.userName || '云卫家用户' }}</text>
        <text class="hero-account" v-if="userStore.userAcct">账号：{{ userStore.userAcct }}</text>
        <text class="hero-account" v-else @tap="handleUpdateProfile">点击登录 / 完善资料</text>
      </view>
    </view>

    <!-- 菜单组一：账户与设备 -->
    <view class="menu-group">
      <view class="menu-item" @tap="handleUpdateProfile">
        <view class="menu-icon icon-blue">
          <up-icon name="edit-pen" size="22" color="#4A6CF7"></up-icon>
        </view>
        <view class="content">
          <text>修改用户资料</text>
        </view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view>

      <view class="menu-item" @tap="handleRefreshDevices">
        <view class="menu-icon icon-cyan">
          <up-icon name="reload" size="22" color="#3D7EFF"></up-icon>
        </view>
        <view class="content">
          <text>刷新设备权限资料</text>
        </view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view>

      <!-- 添加权限详情选项 -->
      <view class="menu-item" @tap="handleOpenAppSettings">
        <view class="menu-icon icon-purple">
          <up-icon name="setting" size="22" color="#8B5CF6"></up-icon>
        </view>
        <view class="content">
          <text>应用权限详情</text>
        </view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view>

      <!-- 绑定微信视频通话授权入口（2026-09-23 按需求恢复展示） -->
      <view class="menu-item" @tap="handleBindWechat">
        <view class="menu-icon icon-green">
          <up-icon name="weixin-fill" size="22" color="#07C160"></up-icon>
        </view>
        <view class="content">
          <text>绑定微信视频通话授权</text>
        </view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view>
    </view>

    <!-- 菜单组二：其他 -->
    <view class="menu-group">
      <!-- 管理员入口 -->
      <view
        v-if="isAdmin"
        class="menu-item"
        @tap="handleAdminLogin"
      >
        <view class="menu-icon icon-violet">
          <up-icon name="server-man" size="22" color="#8B5CF6"></up-icon>
        </view>
        <view class="content">
          <text>管理员登录</text>
        </view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view>

      <!-- 会员中心入口 -->
      <view class="menu-item" @tap="handleVip">
        <view class="menu-icon icon-gold">
          <up-icon name="star-fill" size="22" color="#F5A623"></up-icon>
        </view>
        <view class="content">
          <text>会员中心</text>
        </view>
        <view class="vip-badge" v-if="vipActive">VIP</view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view>
      
      <!-- 关于我们选项 -->
      <view class="menu-item" @tap="handleAbout">
        <view class="menu-icon icon-blue">
          <up-icon name="info-circle" size="22" color="#4A6CF7"></up-icon>
        </view>
        <view class="content">
          <text>关于我们</text>
        </view>
        <view class="right-icon">
          <image src="/static/icons/icon_right.png" mode="aspectFit"></image>
        </view>
      </view>
    </view>

    <!-- 底部横幅广告（Taku）：常驻页面底部（fixed，不随滚动移动） -->
    <view class="ad-section" v-if="bannerAdId">
      <view class="ad-divider"></view>
      <view class="ad-view">
        <taku-banner :placement-id="bannerAdId"></taku-banner>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, getCurrentInstance, onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { encrypt, decrypt } from '@/utils/aesUtils'
import userApi from '@/api/user/user'
import { isVip, syncVipStatus } from '@/utils/vipUtils'
// #ifdef H5
import { NativeApp } from '@/utils/h5-native-bridge'
// #endif

const { proxy } = getCurrentInstance()
const userStore = proxy.$store.user.useUserStore()
const adStore = proxy.$store.ad.useAdStore()
const { userType } = storeToRefs(userStore)

// 横幅广告位 ID（Taku placementId，空/全关时不展示；随 adType 自动响应更新）
const bannerAdId = computed(() => adStore.getBannerAdId())

const isAdmin = ref(false) // 是否是管理员

// 微信小程序跳转配置（H5 壳拉起 ywjxcx 管理端；MP-WEIXIN / APP-PLUS 分支不依赖此配置）
// appId：微信开放平台「移动应用」AppId（云卫家 App 与小程序 wxcdc46554970d5e77 须绑定同一开放平台账号）
// 注意：与后端 vip_pay_config.php 的 wechat.app_id 是同一个值，拿到后同步填入（含 iOS Info.plist 的 wx+AppId 回跳 scheme）
const WX_MINI_PROGRAM = {
  appId: 'wx4c80533df6184dda', // 微信开放平台「移动应用」AppId（已填）
  userName: 'gh_67863dc191ba', // ywjxcx 小程序原始 ID
  path: 'manageModule/pages/adminLogin/adminLogin?fromApp=1',
  type: 0 // 0-正式版；1-开发版；2-体验版
}

// VIP 会员状态（真实状态由 utils/vipUtils 同步，服务端为准）
const vipActive = ref(isVip())

// 平台判断
const platform = ref('')

// 初始化版本号
const initVersion = () => {
  // #ifdef APP-PLUS
  appVersion.value = plus.runtime.version
  // #endif

  // #ifdef H5
  NativeApp.getInfo().then((info) => {
    if (info && info.version) appVersion.value = info.version
  }).catch(() => {})
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

    // #ifdef H5
    const res = await userApi.getUserStatus(userStore.userId)
    isAdmin.value = res.data && res.data.length > 0
    console.log('管理员权限检查结果:', isAdmin.value)
    // #endif
  } catch (error) {
    console.error('检查管理员权限失败:', error)
    isAdmin.value = false
  }
}

// 刷新 VIP 会员状态（服务端为准，失败保持本地缓存）
const refreshVipState = async () => {
  if (!userStore.userId) {
    vipActive.value = isVip()
    return
  }
  await syncVipStatus(userStore.userId)
  vipActive.value = isVip()
}

onMounted(() => {
  initVersion() // 初始化版本号
  // 获取平台信息
  const systemInfo = uni.getSystemInfoSync()
  platform.value = systemInfo.platform.toLowerCase()
  checkAdminStatus()
  refreshVipState() // 会员中心入口状态角标
})

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
          id: "gh_67863dc191ba",  // ywjxcx（精简版）小程序原始 ID
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

  // #ifdef H5
  // H5 壳（云卫家 App 主链路）：经原生桥拉起微信小程序管理端
  if (!WX_MINI_PROGRAM.appId) {
    uni.showToast({
      title: '未配置微信开放平台 AppId，暂无法跳转',
      icon: 'none'
    })
    return
  }
  NativeApp.launchMiniProgram(WX_MINI_PROGRAM).catch((err) => {
    uni.showToast({
      title: (err && (err.msg || err.errMsg)) || '打开小程序失败',
      icon: 'none'
    })
  })
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
                id: "gh_67863dc191ba",  // ywjxcx（精简版）小程序原始 ID
                path: `pages/voipbind/voipbind?${query}`, // 小程序页面路径，带参数（注：ywjxcx 精简版曾删除 voipbind 页；2026-09-23 恢复本入口，若跳转异常先核对小程序端 voipbind 页是否已恢复）
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

  // #ifdef H5
  // H5 壳（云卫家 App 主链路）：经原生桥拉起微信小程序视频通话绑定页
  uni.showModal({
    title: '绑定微信',
    content: '是否跳转到微信小程序进行绑定？',
    success: (res) => {
      if (!res.confirm) return
      const encryptedAccount = encrypt(userStore.userAcct)
      const encryptedPassword = encrypt(userStore.userPassword)
      if (!encryptedAccount || !encryptedPassword) {
        uni.showToast({
          title: '数据加密失败',
          icon: 'none'
        })
        return
      }
      const query = `account=${encodeURIComponent(encryptedAccount)}&password=${encodeURIComponent(encryptedPassword)}&timestamp=${Date.now()}`
      NativeApp.launchMiniProgram({
        appId: WX_MINI_PROGRAM.appId,
        userName: WX_MINI_PROGRAM.userName,
        path: `pages/voipbind/voipbind?${query}`,
        type: WX_MINI_PROGRAM.type
      }).catch((err) => {
        uni.showToast({
          title: (err && (err.msg || err.errMsg)) || '打开小程序失败',
          icon: 'none'
        })
      })
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

  // #ifdef H5
  NativeApp.openSettings().catch(() => {
    uni.showToast({
      title: '打开设置失败',
      icon: 'none'
    })
  })
  // #endif
}

// 会员中心
const handleVip = () => {
  uni.navigateTo({
    url: '/user_package/pages/vip/index'
  })
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
  background: #F5F6FC;
  min-height: 100vh;
}

.page-container {
  padding: 24rpx;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;

  /* 有横幅广告时预留底部空间，避免内容被悬浮横幅遮挡 */
  &.has-ad {
    padding-bottom: 220rpx;
  }
}

/* 渐变用户头部 */
.me-hero {
  position: relative;
  overflow: hidden;
  border-radius: 28rpx;
  background-image: var(--brand-grad);
  background-color: #4A6CF7;
  padding: 48rpx 36rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 16rpx 44rpx rgba(74, 108, 247, 0.3);

  .me-glow-1 {
    width: 320rpx;
    height: 320rpx;
    left: -120rpx;
    top: -140rpx;
    opacity: 0.5;
  }

  .me-glow-2 {
    width: 240rpx;
    height: 240rpx;
    right: -70rpx;
    bottom: -120rpx;
    opacity: 0.45;
  }

  .hero-avatar {
    width: 128rpx;
    height: 128rpx;
    flex: none;
    border-radius: 50%;
    border: 6rpx solid rgba(255, 255, 255, 0.85);
    background: rgba(255, 255, 255, 0.25);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8rpx 24rpx rgba(31, 42, 122, 0.25);

    image {
      width: 100%;
      height: 100%;
    }
  }

  .hero-info {
    margin-left: 30rpx;
    min-width: 0;
    display: flex;
    flex-direction: column;

    .hero-name {
      font-size: 38rpx;
      font-weight: 700;
      color: #FFFFFF;
      margin-bottom: 14rpx;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .hero-account {
      font-size: 24rpx;
      color: rgba(255, 255, 255, 0.85);
    }
  }
}

/* 菜单分组白卡 */
.menu-group {
  background: #FFFFFF;
  border-radius: 24rpx;
  overflow: hidden;
  margin-top: 24rpx;
  box-shadow: 0 6rpx 24rpx rgba(74, 108, 247, 0.06);

  .menu-item {
    display: flex;
    align-items: center;
    padding: 30rpx 28rpx;
    position: relative;
    transition: background 0.2s;

    &:active {
      background: #F5F7FE;
    }

    // 分割线
    &:not(:last-child)::after {
      content: '';
      position: absolute;
      left: 108rpx;
      right: 24rpx;
      bottom: 0;
      height: 1px;
      background-color: #F0F1F8;
      transform: scaleY(0.5);
    }

    .menu-icon {
      width: 68rpx;
      height: 68rpx;
      border-radius: 22rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      flex: none;
      margin-right: 24rpx;

      &.icon-blue { background: #E5EBFF; }
      &.icon-cyan { background: #DEEFFF; }
      &.icon-purple { background: #EFE9FF; }
      &.icon-green { background: #E6F7EC; }
      &.icon-violet { background: #F0EBFF; }
      &.icon-gold { background: #FFF3E0; }
    }

    .vip-badge {
      flex: none;
      margin-right: 14rpx;
      padding: 4rpx 16rpx;
      border-radius: 20rpx;
      background: linear-gradient(135deg, #FF9F43, #FF7A2F);
      color: #FFFFFF;
      font-size: 20rpx;
      font-weight: 600;
    }
    
    .content {
      flex: 1;
      min-width: 0;

      text {
        font-size: 29rpx;
        color: #232838;
        font-weight: 500;
      }
    }

    .right-icon {
      width: 32rpx;
      height: 32rpx;
      flex: none;
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

/* ===== 底部横幅广告（Taku）：常驻页面底部 ===== */
.ad-section {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  width: 100%;
  box-sizing: border-box;
  background: #ffffff;
  box-shadow: 0 -6rpx 20rpx rgba(31, 48, 152, 0.08);

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

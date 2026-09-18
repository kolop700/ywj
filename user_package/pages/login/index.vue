<template>
  <view class="container" :class="{ 'has-ad': bannerAdId }">
    <!-- 顶部品牌渐变卡 -->
    <view class="lg-hero">
      <view class="wg-glow lg-glow-1"></view>
      <view class="wg-glow lg-glow-2"></view>
      <view class="hero-logo">
        <image class="logo" src="/static/logo.png" mode="aspectFit"></image>
      </view>
      <text class="hero-title">欢迎使用云卫家</text>
      <text class="hero-sub">智慧门禁 · 安心守护</text>
    </view>

    <!-- 登录表单白卡 -->
    <view class="lg-card">
      <view class="card-head">
        <text class="card-title">账号登录</text>
        <text class="card-sub">登录后即可使用门禁服务</text>
      </view>

      <!-- 输入框区域 -->
      <view class="input-box">
        <view class="input-item">
          <up-icon name="account" size="20" color="#9AA1BD"></up-icon>
          <input
            v-model="form.user_account"
            class="custom-input"
            type="text"
            placeholder="请输入手机号"
            placeholder-class="placeholder"
          />
        </view>
        <view class="input-item">
          <up-icon name="lock" size="20" color="#9AA1BD"></up-icon>
          <input
            v-model="form.password"
            class="custom-input"
            type="password"
            placeholder="请输入密码"
            placeholder-class="placeholder"
          />
        </view>
        <view class="forgot-row">
          <text class="forgot-password" @click="goToForgotPassword">忘记密码?</text>
        </view>
      </view>

      <!-- 按钮区域 -->
      <view class="btn-container">
        <button class="wg-btn-primary" @click="handleLogin">登录</button>
        <button class="wg-btn-outline" @click="goToRegister">注册</button>
      </view>

      <!-- 协议同意选项 -->
      <view class="agreement">
        <checkbox-group @change="onCheckboxChange">
          <checkbox
            :checked="checked"
            color="#4A6CF7"
            style="transform:scale(0.7)"
          />
        </checkbox-group>
        <text class="text-agreement">我已阅读并同意本程序的</text>
        <text class="link" @tap="openUserAgreement">《用户服务协议》</text>
        <text class="normal-text">及</text>
        <text class="link" @tap="openPrivacyPolicy">《隐私政策》</text>
      </view>
    </view>

    <!-- 底部横幅广告（Taku）：常驻页面底部（fixed，不随滚动移动） -->
    <view class="ad-section" v-if="bannerAdId">
      <view class="ad-divider"></view>
      <view class="ad-view">
        <taku-banner :placement-id="bannerAdId"></taku-banner>
      </view>
    </view>

    <!-- 提示信息弹窗 -->
    <uni-popup ref="message" type="message">
      <uni-popup-message :type="msgType" :message="messageText" :duration="2000"></uni-popup-message>
    </uni-popup>
  </view>
</template>

<script setup>
import { ref, getCurrentInstance, computed } from 'vue'
import { onLoad } from "@dcloudio/uni-app"
import TakuAds, { TAKU_CONFIG } from '@/common/taku-sdk'

const { proxy } = getCurrentInstance()
const adStore = proxy.$store.ad.useAdStore()

// 横幅广告位 ID（Taku placementId，空/全关时不展示；随 adType 自动响应更新）
const bannerAdId = computed(() => adStore.getBannerAdId())

const form = ref({
  user_account: '',
  password: ''
})
const checked = ref(false)
const msgType = ref('')
const messageText = ref('')

onLoad((params) => {
  console.log(params)
})

// 协议勾选改变
const onCheckboxChange = (e) => {
  checked.value = e.detail.value.length > 0
  if (checked.value) {
    // 勾选即视为同意《用户协议》《隐私政策》（写入 agreement store，iOS 端据此初始化 Taku 广告 SDK）
    proxy.$store.agreement.useAgreementStore().setAgreement(true)
    // #ifdef APP-PLUS || H5
    TakuAds.init(TAKU_CONFIG)
    // #endif
  }
}

// 打开用户协议
const openUserAgreement = () => {
  uni.navigateTo({ url: '/user_package/pages/agreement/user' })
}

// 打开隐私政策
const openPrivacyPolicy = () => {
  uni.navigateTo({ url: '/user_package/pages/agreement/privacy' })
}

const handleLogin = async () => {
  if (!checked.value) {
    uni.showToast({
      title: '请先同意用户协议和隐私政策',
      icon: 'none',
      duration: 2000
    })
    return
  }

  if (!form.value.user_account || !form.value.password) {
    uni.showToast({
      title: '账号和密码不能为空',
      icon: 'none',
      duration: 2000
    })
    return
  }
  try {
    const loginData = {
      app_phone_mac: "0",
      app_login_type: "2",
      user_acct: form.value.user_account,
      user_password: form.value.password
    }
    console.log(loginData)
    const res = await proxy.$api.user.UserLogin(loginData)
    console.log(res)
    if (res.code === "0") {
      // 保存用户信息到pinia store
      uni.showToast({
        title: '登录成功',
        icon: 'success'
      })
      // 延迟返回登录页
      setTimeout(() => {
        uni.navigateBack()
        const userData = res.data[0]
        proxy.$store.user.useUserStore().loginSuccess(userData)
      }, 2000)
    } else {
      uni.showToast({
        title: res.msg || '登录失败',
        icon: 'none'
      })
    }
  } catch (error) {
    uni.showToast({
      title: '登录失败，请检查账号密码是否正确',
      icon: 'none'
    })
    console.error('登录错误:', error)
  }
}

const goToRegister = () => {
  uni.navigateTo({
    url: '../register/index'
  })
}

const goToForgotPassword = () => {
  uni.navigateTo({
    url: '../forgot-password/index'
  })
}
</script>

<style lang="scss">
.container {
  min-height: 100vh;
  padding: 24rpx 30rpx 60rpx;
  box-sizing: border-box;

  /* 有横幅广告时预留底部空间，避免内容被悬浮横幅遮挡 */
  &.has-ad {
    padding-bottom: 220rpx;
  }
}

/* ===== 顶部品牌渐变卡 ===== */
.lg-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 52rpx 40rpx 48rpx;
  background-image: var(--brand-grad-deep);
  border-radius: 32rpx;
  overflow: hidden;
  box-shadow: 0 16rpx 40rpx rgba(74, 108, 247, 0.28);
}

.lg-glow-1 {
  width: 300rpx;
  height: 300rpx;
  right: -100rpx;
  top: -130rpx;
}

.lg-glow-2 {
  width: 220rpx;
  height: 220rpx;
  left: -90rpx;
  bottom: -120rpx;
  background: rgba(255, 255, 255, 0.08);
}

.hero-logo {
  position: relative;
  width: 132rpx;
  height: 132rpx;
  padding: 10rpx;
  border-radius: 36rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 28rpx rgba(31, 48, 152, 0.32);
  margin-bottom: 26rpx;
  box-sizing: border-box;

  .logo {
    width: 100%;
    height: 100%;
    border-radius: 26rpx;
  }
}

.hero-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.3;
}

.hero-sub {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
}

/* ===== 表单白卡 ===== */
.lg-card {
  margin-top: 30rpx;
  background: #ffffff;
  border-radius: 28rpx;
  padding: 40rpx 32rpx 24rpx;
  box-sizing: border-box;
  box-shadow: 0 10rpx 36rpx rgba(74, 108, 247, 0.08);

  .card-head {
    margin-bottom: 34rpx;
  }

  .card-title {
    display: block;
    font-size: 38rpx;
    font-weight: 700;
    color: #1f2435;
  }

  .card-sub {
    display: block;
    margin-top: 8rpx;
    font-size: 24rpx;
    color: #9aa0b5;
  }
}

/* ===== 输入框区域 ===== */
.input-item {
  display: flex;
  align-items: center;
  height: 100rpx;
  padding: 0 32rpx;
  margin-bottom: 24rpx;
  background: #f2f4fb;
  border-radius: 50rpx;

  .custom-input {
    flex: 1;
    min-width: 0;
    height: 100rpx;
    line-height: 100rpx;
    padding-left: 20rpx;
    font-size: 30rpx;
    color: #2b2f3a;
    box-sizing: border-box;
  }
}

.placeholder {
  color: #9aa1bd;
  font-size: 28rpx;
}

.forgot-row {
  display: flex;
  justify-content: flex-end;
  margin: -6rpx 6rpx 36rpx;

  .forgot-password {
    font-size: 28rpx;
    color: var(--brand);
  }
}

/* ===== 按钮区域 ===== */
.btn-container {
  .wg-btn-primary,
  .wg-btn-outline {
    height: 96rpx;
    line-height: 96rpx;
    border-radius: 48rpx;
    margin-bottom: 26rpx;
    font-size: 34rpx;
    font-weight: 700;
  }
}

/* ===== 协议同意 ===== */
.agreement {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  padding: 6rpx 0 10rpx;

  .text-agreement,
  .normal-text {
    font-size: 25rpx;
    color: #9aa0b5;
  }

  .link {
    color: var(--brand);
    font-size: 25rpx;
    font-weight: 600;
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

<template>
  <view class="container">
    <!-- 登录logo -->
    <view class="login-view">
      <image class="logo" src="/static/logo.png" mode="aspectFit"></image>
    </view>
    
    <!-- 输入框区域 -->
    <view class="input-container">
      <input 
        v-model="form.user_account" 
        class="custom-input" 
        type="text" 
        placeholder="请输入手机号"
        placeholder-class="placeholder"
      />
      
      <input 
        v-model="form.password" 
        class="custom-input" 
        type="password" 
        placeholder="请输入密码"
        placeholder-class="placeholder"
      />
      
      <text class="forgot-password" @click="goToForgotPassword">忘记密码?</text>
    </view>
    
    <!-- 按钮区域 -->
    <view class="btn-container">
      <button class="login-btn" @click="handleLogin">登录</button>
      <button class="register-btn" @click="goToRegister">注册</button>
    </view>

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

    <!-- 提示信息弹窗 -->
    <uni-popup ref="message" type="message">
      <uni-popup-message :type="msgType" :message="messageText" :duration="2000"></uni-popup-message>
    </uni-popup>
  </view>
</template>

<script setup>
import { ref, getCurrentInstance } from 'vue'
import { onLoad } from "@dcloudio/uni-app"

const { proxy } = getCurrentInstance()
const adStore = proxy.$store.ad.useAdStore()
const form = ref({
  user_account: '',
  password: ''
})
const msgType = ref('')
const messageText = ref('')
const isAdLoaded = ref(false) // 控制广告加载状态
const bannerAdId = ref('') // 横幅广告 ID

onLoad((params) => {
  console.log(params)
  bannerAdId.value = adStore.getBannerAdId() // 获取横幅广告 ID
  console.log('bannerAdId', bannerAdId)
})

// 广告相关的事件处理函数
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

const handleLogin = async () => {
  console.log(form.value)
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
      const userData = res.data[0]
      proxy.$store.user.useUserStore().loginSuccess(userData)
      
      uni.showToast({
        title: '登录成功',
        icon: 'success'
      })
      // 延迟返回登录页
      setTimeout(() => {
        uni.navigateBack()
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
  background-color: #fff;
  padding: 0 40rpx;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.login-view {
  display: flex;
  justify-content: center;
  padding: 80rpx 0 80rpx;
  .logo {
    width: 240rpx;
    height: 240rpx;
    border-radius: 25%;
  }
}

.input-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  
  .custom-input {
    border: 1px solid #ddd;  /* 边框颜色和宽度 */
    border-radius: 8rpx;  /* 圆角 */
    margin-bottom: 10px;  /* 输入框间隔 */
    background: #F9F9F9;
    height: 108rpx;
    padding-left: 40rpx;
    font-size: 30rpx;  /* 字体大小 */
    line-height: 30rpx;  /* 线高与输入框高度相同，帮助垂直居中 */
    outline: none;  /* 移除焦点时的边框 */
    box-sizing: border-box;  /* 边框和内边距包含在宽度内 */
    width: 100%;  /* 输入框宽度 */
    
    &:last-of-type {
      margin-bottom: 20rpx;
    }
  }
  
  .placeholder {
    color: #999;
    font-size: 32rpx;
  }
  
  .forgot-password {
    color: #FF0036;
    font-size: 32rpx;
    text-align: right;
    padding: 20rpx 0 60rpx;
  }
}

.btn-container {
  margin-bottom: auto;
  button {
    width: 100%;
    height: 110rpx;
    line-height: 110rpx;
    font-size: 36rpx;
    font-weight: 800;
    border-radius: 12rpx;
    margin-bottom: 30rpx;
    
    &::after {
      border: none;
    }
  }
  
  .login-btn {
    background-color: #FF0036;
    color: #fff;
    
    &:active {
      opacity: 0.8;
    }
  }
  
  .register-btn {
    background-color: #fff;
    color: #333;
    border: 1rpx solid  #FF0036;
    
    &:active {
      background-color: #f5f5f5;
    }
  }
}

.ad-section {
  width: 100%;
  height: 225rpx;
  flex: none;
  box-sizing: border-box;
  margin-top: 20rpx;

  .divider {
    height: 2rpx;
    background: #EEEEEE;
  }

  .ad-view {
    height: 220rpx;
    display: flex;
    justify-content: center;
    align-items: center;
    
    ad {
      width: 100%;
      height: 220rpx;
    }
  }
}
</style> 
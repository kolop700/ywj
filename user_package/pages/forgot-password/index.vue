<template>
  <view class="container">
    <view class="form-container">
      <!-- 手机号 -->
      <view class="form-item">
        <text class="label">手机</text>
        <input
          class="input"
          type="number"
          v-model="form.phone"
          placeholder="手机号码"
          placeholder-style="color: #999999;"
        />
      </view>

      <!-- 验证码 -->
      <view class="form-item">
        <text class="label">验证码</text>
        <view class="verify-code-box">
          <input
            class="input"
            v-model="form.code"
            placeholder="请输入验证码"
            placeholder-style="color: #999999;"
          />
          <button 
            class="code-btn" 
            :disabled="counting"
            @tap="getCode"
          >{{ counting ? `${counter}s` : '发送验证码' }}</button>
        </view>
      </view>

      <!-- 密码 -->
      <view class="form-item">
        <text class="label">密码</text>
        <input
          class="input"
          type="password"
          v-model="form.newPassword"
          placeholder="请输入密码"
          placeholder-style="color: #999999;"
        />
      </view>

      <!-- 确认密码 -->
      <view class="form-item">
        <text class="label">确认密码</text>
        <input
          class="input"
          type="password"
          v-model="form.confirmPassword"
          placeholder="请再次输入密码"
          placeholder-style="color: #999999;"
        />
      </view>
    </view>

    <!-- 提交按钮 -->
    <view class="btn-container">
      <button 
        :class="['login-btn', {'btn-disabled': !isFormValid}]" 
        @click="handleReset"
      >确定</button>
      <button class="register-btn" @click="goToLogin">返回登录</button>
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
  </view>
</template>

<script setup>
import { ref, computed, getCurrentInstance } from 'vue'
import { onLoad } from "@dcloudio/uni-app"
const { proxy } = getCurrentInstance()
const adStore = proxy.$store.ad.useAdStore()

const form = ref({
  phone: '', // 预设手机号
  code: '',
  newPassword: '',
  confirmPassword: ''
})

const counting = ref(false)
const counter = ref(60)
// 保存验证码和对应的手机号
const savedVerifyCode = ref('')
const savedPhone = ref('')

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

// 计算属性判断表单是否有效
const isFormValid = computed(() => {
  return form.value.code && 
         form.value.newPassword && 
         form.value.confirmPassword
})

// 生成6位随机验证码
const generateVerifyCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// 验证手机号
const validatePhone = () => {
  if (!form.value.phone) {
    uni.showToast({ title: '请输入手机号', icon: 'none' })
    return false
  }
  if (!/^1[3-9]\d{9}$/.test(form.value.phone)) {
    uni.showToast({ title: '手机号格式不正确', icon: 'none' })
    return false
  }
  return true
}

// 获取验证码
const getCode = async () => {
  if (counting.value) return
    // 先验证手机号
 if (!validatePhone()) return
  
  try {
    // 先生成验证码
    const verifyCode = generateVerifyCode()
    
    const res = await proxy.$api.user.sendSMS(form.value.phone, verifyCode)
    // 保存验证码和手机号到本地变量
    savedVerifyCode.value = verifyCode
    savedPhone.value = form.value.phone
    
    uni.showToast({ title: '验证码已发送', icon: 'success' })
    // 开始倒计时
    counting.value = true
    counter.value = 60
    const timer = setInterval(() => {
      if (counter.value > 0) {
        counter.value--
      } else {
        counting.value = false
        clearInterval(timer)
      }
    }, 1000)
  } catch (error) {
    console.error('发送验证码错误:', error)
  }
}

// 表单验证
const validateForm = () => {
  if (!form.value.code) {
    uni.showToast({ title: '请输入验证码', icon: 'none' })
    return false
  }
  
  // 验证验证码
  if (!savedVerifyCode.value || !savedPhone.value) {
    uni.showToast({ title: '请先获取验证码', icon: 'none' })
    return false
  }
  if (savedPhone.value !== form.value.phone) {
    uni.showToast({ title: '手机号与获取验证码时不一致', icon: 'none' })
    return false
  }
  if (!form.value.newPassword) {
    uni.showToast({ title: '请输入密码', icon: 'none' })
    return false
  }
  if (form.value.newPassword.length < 6) {
    uni.showToast({ title: '密码不能少于6位', icon: 'none' })
    return false
  }
  if (form.value.newPassword !== form.value.confirmPassword) {
    uni.showToast({ title: '两次输入的密码不一致', icon: 'none' })
    return false
  }
  if (form.value.code !== savedVerifyCode.value) {
    uni.showToast({ title: '验证码错误', icon: 'none' })
    return false
  }
  return true
}

// 提交表单
const handleReset = async () => {
  if (validateForm()) {
    try {
      const res = await proxy.$api.user.resetPassword(form.value)
      if(res.code === "0") {
        // 重置成功后执行登录
        const userStore = proxy.$store.user.useUserStore()
        try {
          userStore.setUserAccount(form.value.phone)
          userStore.setUserPassword(form.value.newPassword)
          // 登录成功后显示重置成功提示
          uni.showToast({ 
            title: '重置密码成功', 
            icon: 'success',
            duration: 2000
          })
          // 延迟跳转到主页
          setTimeout(() => {
            uni.reLaunch({
              url: '/pages/index/index'
            })
          }, 2000)
        } catch (error) {
          console.error('自动登录失败:', error)
        }
      }
    } catch (error) {
      console.error('重置密码失败:', error)
      uni.showToast({ 
        title: error.msg || '重置密码失败', 
        icon: 'none' 
      })
    }
  }
}

// 返回登录页
const goToLogin = () => {
  uni.navigateBack()
}
</script>

<style lang="scss">
.container {
  min-height: 100vh;
  background-color: #fff;
  padding: 20rpx 40rpx;
  display: flex;
  flex-direction: column;
}

.form-container {
  .form-item {
    display: flex;
    align-items: center;
    padding: 25rpx 0;
    border-bottom: 1px solid #eee;
    
    .label {
      width: 140rpx;
      font-size: 30rpx;
      color: #303030;
      font-weight: 500;
    }
    
    .input {
      flex: 1;
      font-size: 30rpx;
      color: #303030;
    }
    
    .verify-code-box {
      flex: 1;
      display: flex;
      align-items: center;
      
      .input {
        flex: 1;
      }
      
      .code-btn {
        margin-left: 20rpx;
        font-size: 28rpx;
        color: #FF0036;
        background: #fff;
        border: 1px solid #FF0036;
        border-radius: 4px;
        padding: 0 20rpx;
        height: 60rpx;
        line-height: 60rpx;
        
        &[disabled] {
          color: #999;
          border-color: #999;
        }
      }
    }
  }
}

.btn-container {
  margin-bottom: auto;
  button {
    margin-top: 30rpx;
    width: 100%;
    height: 100rpx;
    line-height: 100rpx;
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
    
    &.btn-disabled {
       background-color: #FCA5A7;
      opacity: 1;
    }
  }
  
  .register-btn {
    background-color: #fff;
    color: #333;
    border: 1rpx solid #FF0036;
    
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
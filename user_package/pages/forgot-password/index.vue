<template>
  <view class="container" :class="{ 'has-ad': bannerAdId }">
    <!-- 页头说明 -->
    <view class="auth-head">
      <text class="auth-title">重置密码</text>
      <text class="auth-sub">通过手机验证码找回登录密码</text>
    </view>

    <view class="form-container">
      <!-- 手机号 -->
      <view class="form-item">
        <text class="label">手机</text>
        <input
          class="input"
          type="number"
          v-model="form.phone"
          placeholder="手机号码"
          placeholder-style="color: #9aa1bd;"
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
            placeholder-style="color: #9aa1bd;"
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
          placeholder="请输入新密码"
          placeholder-style="color: #9aa1bd;"
        />
      </view>

      <!-- 确认密码 -->
      <view class="form-item">
        <text class="label">确认密码</text>
        <input
          class="input"
          type="password"
          v-model="form.confirmPassword"
          placeholder="请再次输入新密码"
          placeholder-style="color: #9aa1bd;"
        />
      </view>
    </view>

    <!-- 提交按钮 -->
    <view class="btn-container">
      <button 
        :class="['wg-btn-primary', {'btn-disabled': !isFormValid}]" 
        @click="handleReset"
      >确定</button>
      <button class="wg-btn-outline" @click="goToLogin">返回登录</button>
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
import { ref, computed, getCurrentInstance } from 'vue'
import { onLoad } from "@dcloudio/uni-app"
const { proxy } = getCurrentInstance()
const adStore = proxy.$store.ad.useAdStore()

// 横幅广告位 ID（Taku placementId，空/全关时不展示；随 adType 自动响应更新）
const bannerAdId = computed(() => adStore.getBannerAdId())

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

onLoad((params) => {
  console.log(params)
})

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
  padding: 30rpx 30rpx 60rpx;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;

  /* 有横幅广告时预留底部空间，避免内容被悬浮横幅遮挡 */
  &.has-ad {
    padding-bottom: 220rpx;
  }
}

/* ===== 页头说明 ===== */
.auth-head {
  margin: 6rpx 6rpx 0;

  .auth-title {
    display: block;
    font-size: 42rpx;
    font-weight: 700;
    color: #1f2435;
  }

  .auth-sub {
    display: block;
    margin-top: 12rpx;
    font-size: 25rpx;
    color: #9aa0b5;
  }
}

/* ===== 表单白卡 ===== */
.form-container {
  margin-top: 32rpx;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 10rpx 30rpx;
  box-shadow: 0 8rpx 30rpx rgba(74, 108, 247, 0.08);
  overflow: hidden;

  .form-item {
    display: flex;
    align-items: center;
    min-height: 112rpx;
    padding: 20rpx 0;
    border-bottom: 1rpx solid #f0f1f8;

    &:last-child {
      border-bottom: none;
    }

    .label {
      flex: none;
      width: 130rpx;
      font-size: 29rpx;
      color: #232838;
      font-weight: 600;
    }

    .input {
      flex: 1;
      font-size: 30rpx;
      color: #2b2f3a;
    }

    .verify-code-box {
      flex: 1;
      display: flex;
      align-items: center;

      .input {
        flex: 1;
      }

      .code-btn {
        flex: none;
        margin-left: 20rpx;
        font-size: 27rpx;
        color: var(--brand);
        background: var(--brand-soft);
        border: 1rpx solid #ccd4fb;
        border-radius: 34rpx;
        padding: 0 24rpx;
        height: 68rpx;
        line-height: 66rpx;

        &::after {
          border: none;
        }

        &[disabled] {
          color: #a6aabf;
          background: #f3f4fa;
          border-color: #eeeeee;
        }
      }
    }
  }
}

/* ===== 按钮区域 ===== */
.btn-container {
  margin-top: 48rpx;

  .wg-btn-primary,
  .wg-btn-outline {
    height: 96rpx;
    line-height: 96rpx;
    border-radius: 48rpx;
    margin-bottom: 26rpx;
    font-size: 34rpx;
    font-weight: 700;
  }

  .wg-btn-outline {
    margin-bottom: 0;
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

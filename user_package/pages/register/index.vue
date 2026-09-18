<template>
  <view class="container" :class="{ 'has-ad': bannerAdId }">
    <!-- 页头说明 -->
    <view class="auth-head">
      <text class="auth-title">注册账号</text>
      <text class="auth-sub">填写信息即可开通云卫家门禁服务</text>
    </view>

    <view class="form-container">
      <!-- 手机号 -->
      <view class="form-item">
        <text class="label">手机</text>
        <input
          class="input"
          type="number"
          v-model="form.phone"
          placeholder="请输入手机号码"
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

      <!-- 姓名 -->
      <view class="form-item">
        <text class="label">姓名</text>
        <input
          class="input"
          v-model="form.name"
          placeholder="请输入姓名"
          placeholder-style="color: #9aa1bd;"
        />
      </view>

      <!-- 密码 -->
      <view class="form-item">
        <text class="label">密码</text>
        <input
          class="input"
          type="password"
          v-model="form.password"
          placeholder="请输入密码"
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
          placeholder="请再次输入密码"
          placeholder-style="color: #9aa1bd;"
        />
      </view>

      <!-- 性别 -->
      <view class="form-item">
        <text class="label">性别</text>
        <view class="gender-group">
          <view
            v-for="item in genderColumns"
            :key="item"
            :class="['gender-item', form.gender === item ? 'active' : '']"
            @tap="selectGender(item)"
          >{{ item }}</view>
        </view>
      </view>
    </view>

    <!-- 提交按钮 -->
    <view class="btn-container">
      <button 
        :class="['wg-btn-primary', {'btn-disabled': !isFormValid}]" 
        @click="handleSubmit"
      >提交</button>
      <button class="wg-btn-outline" @click="goToLogin">返回登录</button>
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
import TakuAds, { TAKU_CONFIG } from '@/common/taku-sdk'
const { proxy } = getCurrentInstance()
const adStore = proxy.$store.ad.useAdStore()

// 横幅广告位 ID（Taku placementId，空/全关时不展示；随 adType 自动响应更新）
const bannerAdId = computed(() => adStore.getBannerAdId())

onLoad((params) => {
  console.log(params)
})

const form = ref({
  phone: '',
  code: '',
  name: '',
  password: '',
  confirmPassword: '',
  gender: ''
})

const genderColumns = ['男', '女']
const counting = ref(false)
const counter = ref(60)
const checked = ref(false)
// 保存验证码和对应的手机号
const savedVerifyCode = ref('')
const savedPhone = ref('')

// 计算属性判断表单是否有效
const isFormValid = computed(() => {
  return form.value.phone && 
         form.value.code && 
         form.value.name && 
         form.value.password && 
         form.value.confirmPassword && 
         form.value.gender &&
         checked.value
})

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

// 生成6位随机验证码
const generateVerifyCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
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
    uni.showToast({
      title: (error && (error.msg || error.message)) || '验证码发送失败，请稍后重试',
      icon: 'none'
    })
  }
}

// 表单验证
const validateForm = () => {
  if (!form.value.phone) {
    uni.showToast({ title: '请输入手机号', icon: 'none' })
    return false
  }
  if (!/^1[3-9]\d{9}$/.test(form.value.phone)) {
    uni.showToast({ title: '手机号格式不正确', icon: 'none' })
    return false
  }
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

  if (!form.value.name) {
    uni.showToast({ title: '请输入姓名', icon: 'none' })
    return false
  }
  if (!form.value.password) {
    uni.showToast({ title: '请输入密码', icon: 'none' })
    return false
  }
  if (form.value.password.length < 6) {
    uni.showToast({ title: '密码不能少于6位', icon: 'none' })
    return false
  }
  if (form.value.password !== form.value.confirmPassword) {
    uni.showToast({ title: '两次输入的密码不一致', icon: 'none' })
    return false
  }
  if (!form.value.gender) {
    uni.showToast({ title: '请选择性别', icon: 'none' })
    return false
  }
  if (form.value.code !== savedVerifyCode.value) {
    uni.showToast({ title: '验证码错误', icon: 'none' })
    return false
  }
  return true
}

// 性别选择
const selectGender = (val) => {
  form.value.gender = val
}

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

// 提交表单
const handleSubmit = async () => {
  if (!checked.value) {
    uni.showToast({ title: '请先同意用户协议和隐私政策', icon: 'none' })
    return
  }
  
  if (validateForm()) {
    try {
      const res = await proxy.$api.user.UserRegister(form.value)
      if(res.code === "0") {
       // 重置成功后执行登录
       const userStore = proxy.$store.user.useUserStore()
        try {
          userStore.setUserAccount(form.value.phone)
          userStore.setUserPassword(form.value.password)
     
          // 登录成功后显示重置成功提示
          uni.showToast({ 
            title: '注册成功', 
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
      console.error('注册失败:', error)
      uni.showToast({ 
        title: error.msg || '注册失败', 
        icon: 'none' 
      })
    }
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

    .gender-group {
      flex: 1;
      display: flex;
      align-items: center;

      .gender-item {
        min-width: 150rpx;
        height: 72rpx;
        line-height: 68rpx;
        text-align: center;
        font-size: 30rpx;
        color: #6b7189;
        background: #f5f6fb;
        border: 2rpx solid #e6e8f2;
        border-radius: 36rpx;
        margin-right: 24rpx;
      }

      .gender-item.active {
        color: var(--brand);
        background: var(--brand-soft);
        border-color: var(--brand);
        font-weight: 600;
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

/* ===== 协议同意 ===== */
.agreement {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 30rpx;

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

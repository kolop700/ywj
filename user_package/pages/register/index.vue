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
          placeholder="请输入手机号码"
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

      <!-- 姓名 -->
      <view class="form-item">
        <text class="label">姓名</text>
        <input
          class="input"
          v-model="form.name"
          placeholder="请输入姓名"
          placeholder-style="color: #999999;"
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

      <!-- 性别 -->
      <view class="form-item">
        <text class="label">性别</text>
        <picker 
          @change="onGenderChange" 
          :value="genderIndex" 
          :range="genderColumns"
        >
          <view class="picker-content">
            <text :class="['picker-text', form.gender ? 'selected' : '']">
              {{ form.gender || '请选择性别（必填）' }}
            </text>
            <uni-icons type="right" size="16" color="#999999"></uni-icons>
          </view>
        </picker>
      </view>
    </view>

    <!-- 协议同意选项 -->
    <view class="agreement">
      <checkbox-group @change="onCheckboxChange">
        <checkbox 
          :checked="checked" 
          color="#FF0036"
          style="transform:scale(0.7)"
        />
      </checkbox-group>
      <text class="text-agreement">我已阅读并同意本程序的</text>
      <text class="link" @tap="openUserAgreement">《用户服务协议》</text>
      <text class="normal-text">及</text>
      <text class="link" @tap="openPrivacyPolicy">《隐私政策》</text>
    </view>

    <!-- 提交按钮 -->
    <view class="btn-container">
      <button 
        :class="['login-btn', {'btn-disabled': !isFormValid}]" 
        @click="handleSubmit"
      >提交</button>
      <button class="register-btn" @click="goToLogin">返回登录</button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, getCurrentInstance } from 'vue'
import { onLoad } from "@dcloudio/uni-app"
const { proxy } = getCurrentInstance()

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
const genderIndex = ref(0)
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

// 性别选择改变
const onGenderChange = (e) => {
  const index = e.detail.value
  genderIndex.value = index
  form.value.gender = genderColumns[index]
}

// 协议勾选改变
const onCheckboxChange = (e) => {
  checked.value = e.detail.value.length > 0
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
          await userStore.login({
            user_acct: form.value.phone,
            user_password: form.value.password
          })
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
  background-color: #fff;
  padding: 20rpx 40rpx;
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
    
    .picker-content {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-width: 500rpx;
      
      .picker-text {
        font-size: 30rpx;
        color: #999;
      }
    }

    .picker-text.selected {
      color: #303030;
    }
  }
}

.agreement {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 30rpx;
  
  .text-agreement, .normal-text {
    font-size: 28rpx;
    color: #A7A7A7;
  }
  
  .link {
    color: #FF0036;
    font-size: 28rpx;
  }
}

.btn-container {
  button {
    margin-top: 30rpx;
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
    
    &.btn-disabled {
      background-color: #A7A7A7;
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
</style> 
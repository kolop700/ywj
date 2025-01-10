<template>
  <view class="forgot-password-container">
    <view class="form-box">
      <up-form>
        <up-form-item>
          <up-input
            v-model="form.phone"
            placeholder="请输入手机号"
            prefixIcon="phone"
            clearable
          ></up-input>
        </up-form-item>
        
        <up-form-item>
          <up-input
            v-model="form.code"
            placeholder="请输入验证码"
            prefixIcon="checkbox-mark"
            clearable
          >
            <template #suffix>
              <up-button size="mini" :disabled="counting" @click="getCode">
                {{ counting ? `${counter}s后重试` : '获取验证码' }}
              </up-button>
            </template>
          </up-input>
        </up-form-item>
        
        <up-form-item>
          <up-input
            v-model="form.newPassword"
            type="password"
            placeholder="请输入新密码"
            prefixIcon="lock"
            clearable
          ></up-input>
        </up-form-item>
      </up-form>
      
      <view class="btn-group">
        <up-button type="primary" block @click="handleReset">重置密码</up-button>
      </view>
      
      <view class="action-links">
        <navigator url="../login/index" class="link">返回登录</navigator>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      form: {
        phone: '',
        code: '',
        newPassword: ''
      },
      counting: false,
      counter: 60
    }
  },
  methods: {
    getCode() {
      if (this.counting) return
      // 发送验证码逻辑
      this.counting = true
      this.counter = 60
      const timer = setInterval(() => {
        if (this.counter > 0) {
          this.counter--
        } else {
          this.counting = false
          clearInterval(timer)
        }
      }, 1000)
    },
    handleReset() {
      // 重置密码逻辑
      console.log('重置密码表单：', this.form)
    }
  }
}
</script>

<style lang="scss">
.forgot-password-container {
  min-height: 100vh;
  padding: 40rpx;
  background-color: #fff;
  
  .form-box {
    margin-top: 40rpx;
    
    .btn-group {
      margin-top: 60rpx;
    }
    
    .action-links {
      text-align: center;
      margin-top: 30rpx;
      
      .link {
        color: #2979ff;
        font-size: 28rpx;
      }
    }
  }
}
</style> 
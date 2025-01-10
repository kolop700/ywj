<template>
  <view class="container">
    <up-form
      labelPosition="left"
      :model="form"
      :rules="rules"
      ref="registerForm"
      labelWidth="70"
      :labelStyle="{
        fontWeight: '500',
        fontSize: '15px',
        color: '#303030',
        lineHeight: '18px'
      }"
    >
      <!-- 手机号 -->
      <up-form-item
        label="手机"
        prop="phone"
        borderBottom
      >
        <up-input
          v-model="form.phone"
          type="number"
          border="none"
          placeholder="请输入手机号码"
        ></up-input>
      </up-form-item>

      <!-- 验证码 -->
      <up-form-item
        label="验证码"
        prop="code"
        borderBottom
      >
        <view class="verify-code-box">
          <up-input
            v-model="form.code"
            border="none"
            placeholder="请输入验证码"
          ></up-input>
          <view class="code-btn">
            <up-button
              @tap="getCode"
              :text="counting ? `${counter}s` : '发送验证码'"
              type="success"
              size="mini"
              :disabled="counting"
              :customStyle="{
                width: '83px',
                height: '31px',
                borderRadius: '4px',
                border: '1px solid #FA4E52',
                color: '#FA4E52',
                backgroundColor: '#fff'
              }"
            ></up-button>
          </view>
        </view>
      </up-form-item>

      <!-- 姓名 -->
      <up-form-item
        label="姓名"
        prop="name"
        borderBottom
      >
        <up-input
          v-model="form.name"
          border="none"
          placeholder="请输入姓名"
        ></up-input>
      </up-form-item>

      <!-- 密码 -->
      <up-form-item
        label="密码"
        prop="password"
        borderBottom
      >
        <up-input
          v-model="form.password"
          type="password"
          border="none"
          placeholder="请输入密码"
        ></up-input>
      </up-form-item>

      <!-- 确认密码 -->
      <up-form-item
        label="确认密码"
        prop="confirmPassword"
        borderBottom
      >
        <up-input
          v-model="form.confirmPassword"
          type="password"
          border="none"
          placeholder="请再次输入密码"
        ></up-input>
      </up-form-item>

      <!-- 性别 -->
      <up-form-item
        label="性别"
        prop="gender"
        borderBottom
        @click="showGenderPicker = true; hideKeyboard()"
      >
        <up-input
          v-model="form.gender"
          disabled
          disabledColor="#ffffff"
          placeholder="请选择性别"
          border="none"
        ></up-input>
        <template #right>
          <up-icon name="arrow-right"></up-icon>
        </template>
      </up-form-item>
    </up-form>

    <!-- 在提交按钮前添加协议同意选项 -->
    <view class="agreement">
    <up-checkbox
        name="agree"
        activeColor="red"
        usedAlone
        v-model:checked="checked"></up-checkbox>
      <text class="text-agreement">我已阅读并同意本程序的</text>
      <text class="link" @tap="openUserAgreement">《用户服务协议》</text>
      <text class="normal-text">及</text>
      <text class="link normal-text" @tap="openPrivacyPolicy">《隐私政策》</text>
    </view>

    <!-- 提交按钮 -->
    <view class="btn-container">
      <button class="login-btn" @click="handleSubmit">提交</button>
    </view>

    <!-- 性别选择器 -->
    <up-picker
      :show="showGenderPicker"
      :columns="[genderColumns]"
      title="请选择性别"
      @cancel="showGenderPicker = false"
      @confirm="confirmGender"
      @change="changeGender"
    ></up-picker>
  </view>
</template>

<script>
export default {
  data() {
    return {
      form: {
        phone: '',
        code: '',
        name: '',
        password: '',
        confirmPassword: '',
        gender: ''
      },
      rules: {
        phone: [{
          required: true,
          message: '请输入手机号',
          trigger: 'blur'
        }, {
          validator: (rule, value, callback) => {
            return uni.$u.test.mobile(value);
          },
          message: '手机号格式不正确',
          trigger: 'blur'
        }],
        code: [{
          required: true,
          message: '请输入验证码',
          trigger: 'blur'
        }],
        name: [{
          required: true,
          message: '请输入姓名',
          trigger: 'blur'
        }],
        password: [{
          required: true,
          min: 6,
          message: '密码不能少于6位',
          trigger: 'blur'
        }],
        confirmPassword: [{
          required: true,
          validator: (rule, value, callback) => {
            return value === this.form.password;
          },
          message: '两次输入的密码不一致',
          trigger: 'blur'
        }],
        gender: [{
          required: true,
          message: '请选择性别',
          trigger: 'change'
        }]
      },
      genderColumns: ['男', '女'],
      showGenderPicker: false,
      counting: false,
      counter: 60,
      isValid: false,
      checked: false
    }
  },
  methods: {
    getCode() {
      if (this.counting || !this.form.phone) {
        !this.form.phone && uni.$u.toast('请输入手机号')
        return
      }
      
      if (!uni.$u.test.mobile(this.form.phone)) {
        uni.$u.toast('请输入正确的手机号')
        return
      }

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
    confirmGender(e) {
      this.form.gender = e.value[0]
      this.showGenderPicker = false
      this.$refs.registerForm.validateField('gender')
    },
    changeGender(e) {
      console.log('性别选择变化：', e)
    },
    hideKeyboard() {
      uni.hideKeyboard()
    },
    handleSubmit() {
      if (!this.checked ) {
        uni.$u.toast('请先同意用户协议和隐私政策')
        return
      }
      
      this.$refs.registerForm.validate().then(res => {
        uni.$u.toast('验证通过')
        console.log('注册表单：', this.form)
      }).catch(errors => {
        uni.$u.toast('请检查表单填写')
      })
    },
    validateAllFields() {
      this.$refs.registerForm.validate().then(() => {
        this.isValid = this.checked && this.isAgreed
      }).catch(() => {
        this.isValid = false
      })
    },
    handleFieldChange() {
      if (this.form.phone && this.form.code && this.form.name && 
          this.form.password && this.form.confirmPassword && this.form.gender) {
        this.validateAllFields()
      } else {
        this.isValid = false
      }
    },
    openUserAgreement() {
      uni.navigateTo({
        url: '/pages/agreement/user'
      })
    },
    openPrivacyPolicy() {
      uni.navigateTo({
        url: '/pages/agreement/privacy'
      })
    }
  },
  watch: {
    form: {
      handler: 'handleFieldChange',
      deep: true
    }
  }
}
</script>

<style lang="scss">
.container {
  min-height: 100vh;
  background-color: #fff;
  padding: 20rpx 40rpx;
}

.verify-code-box {
  display: flex;
  align-items: center;
  
  .up-input {
    flex: 1;
  }
  
  .code-btn {
    flex-shrink: 0;
  }
}

.agreement {
  display: flex;
  align-items: center;
  margin-top: 20rpx;
 flex-wrap: wrap;
  
  
  .text-agreement {
    font-size: 28rpx;
    color: #A7A7A7;
  }
  
  .normal-text {
    font-size: 28rpx;
    color: #A7A7A7;
  }
  
  .link {
    color: #c21a04;
    font-size: 28rpx;
  }
  
  .text-privacy {
    margin-left: 60rpx;
    margin-top: 5rpx;
  }

  
}

// 修改按钮容器样式，减小上边距
.btn-container {
  margin-top: 20rpx;
}

.login-btn {
    background-color: #FF0036;
    color: #fff;
    
    &:active {
      opacity: 0.8;
    }
  }
  
</style> 
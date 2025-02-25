<template>
    <view class="container">
      <view class="form-container">
        <!-- 手机号 -->
        <view class="form-item">
          <text class="label">账号</text>
          <view class="input-with-button">
            <input
              class="input"
              type="number"
              v-model="form.phone"
              disabled
              placeholder="请输入手机号码"
              placeholder-style="color: #999999;"
            />
            <button class="copy-btn" @click="copyPhone">复制</button>
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
                {{ form.gender || '请选择性别' }}
              </text>
              <uni-icons type="right" size="16" color="#999999"></uni-icons>
            </view>
          </picker>
        </view>
      </view>
  
      <!-- 提交按钮 -->
      <view class="btn-container">
        <button 
          :class="['login-btn', {'btn-disabled': !isFormValid}]" 
          @click="handleSubmit"
        >保存</button>
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
    phone: '',
    name: '',
    gender: ''
  })
  
  const genderColumns = ['男', '女']
  const genderIndex = ref(0)
  
  const isAdLoaded = ref(false) // 控制广告加载状态
  const bannerAdId = ref('') // 横幅广告 ID
  
  // 计算属性判断表单是否有效
  const isFormValid = computed(() => {
    return form.value.name && form.value.gender
  })
  
  // 性别选择改变
  const onGenderChange = (e) => {
    const index = e.detail.value
    genderIndex.value = index
    form.value.gender = genderColumns[index]
  }
  
  // 表单验证
  const validateForm = () => {
    if (!form.value.name) {
      uni.showToast({ title: '请输入姓名', icon: 'none' })
      return false
    }
    if (!form.value.gender) {
      uni.showToast({ title: '请选择性别', icon: 'none' })
      return false
    }
    return true
  }
  
  // 提交表单
  const handleSubmit = async () => {
    if (validateForm()) {
      try {
        const userStore = proxy.$store.user.useUserStore()
        const userInfo = userStore.userInfo
        const params = {
          phone: form.value.phone,
          name: form.value.name,
          gender: form.value.gender === '男' ? 1 : 2,
          password: userInfo.user_password
        }
        const res = await proxy.$api.user.updateUserInfo(params)
        if(res.code === "0") {
          // 直接修改 userInfo.value
          userStore.userInfo.user_name = form.value.name
          userStore.userInfo.user_sex = form.value.gender === '男' ? '1' : '2'
          
          uni.showToast({ 
            title: '保存成功', 
            icon: 'success',
            duration: 2000
          })
          // 延迟返回上一页
          setTimeout(() => {
            uni.navigateBack()
          }, 2000)
        }
      } catch (error) {
        console.error('保存失败:', error)
        uni.showToast({ 
          title: error.msg || '保存失败', 
          icon: 'none' 
        })
      }
    }
  }
  
  // 页面加载时获取用户信息
  onLoad(async () => {
    try {
      const userStore = proxy.$store.user.useUserStore()
      const userInfo = userStore.userInfo
      form.value.phone = userInfo.user_acct || ''
      form.value.name = userInfo.user_name || ''
      form.value.gender = userInfo.user_sex === '1' ? '男' : '女'
      genderIndex.value = form.value.gender === '男' ? 0 : 1

      bannerAdId.value = adStore.getBannerAdId() // 获取横幅广告 ID
      console.log('bannerAdId', bannerAdId)
    } catch (error) {
      console.error('获取用户信息失败:', error)
    }
  })
  
  // 复制手机号
  const copyPhone = () => {
    if (form.value.phone) {
      uni.setClipboardData({
        data: form.value.phone,
        success: () => {
          uni.showToast({
            title: '复制成功',
            icon: 'success',
            duration: 2000
          })
        }
      })
    }
  }

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
      
      .input-with-button {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 20rpx;
        
        .input {
          flex: 1;
          font-size: 30rpx;
          color: #303030;
          
          &[disabled] {
            color: #999;
          }
        }
        
        .copy-btn {
          min-width: 100rpx;
          height: 60rpx;
          line-height: 60rpx;
          font-size: 28rpx;
          color: #FF0036;
          background: #fff;
          border: 1px solid #FF0036;
          border-radius: 30rpx;
          padding: 0 20rpx;
          margin: 0;
          
          &:active {
            opacity: 0.8;
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
  
  .btn-container {
    margin-bottom: auto;
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
        background-color: #FCA5A7;
        opacity: 1;
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
<template>
  <view class="container" :class="{ 'has-ad': bannerAdId }">
    <!-- 页头说明 -->
    <view class="auth-head">
      <text class="auth-title">修改资料</text>
      <text class="auth-sub">更新您的个人信息</text>
    </view>

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
            placeholder-style="color: #9aa1bd;"
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
          placeholder-style="color: #9aa1bd;"
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
            <uni-icons type="right" size="16" color="#9aa1bd"></uni-icons>
          </view>
        </picker>
      </view>
    </view>

    <!-- 提交按钮 -->
    <view class="btn-container">
      <button 
        :class="['wg-btn-primary', {'btn-disabled': !isFormValid}]" 
        @click="handleSubmit"
      >保存</button>
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
  phone: '',
  name: '',
  gender: ''
})

const genderColumns = ['男', '女']
const genderIndex = ref(0)

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
</script>

<style lang="scss">
.container {
  min-height: 100vh;
  padding: 30rpx 30rpx 0;
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

    .input-with-button {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 20rpx;

      .input {
        flex: 1;
        font-size: 30rpx;
        color: #2b2f3a;

        &[disabled] {
          color: #9aa1bd;
        }
      }

      .copy-btn {
        flex: none;
        min-width: 110rpx;
        height: 64rpx;
        line-height: 62rpx;
        font-size: 26rpx;
        color: var(--brand);
        background: var(--brand-soft);
        border: 1rpx solid #ccd4fb;
        border-radius: 32rpx;
        padding: 0 24rpx;
        margin: 0;

        &::after {
          border: none;
        }

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
        color: #9aa1bd;
      }
    }

    .picker-text.selected {
      color: #2b2f3a;
    }
  }
}

/* ===== 按钮区域 ===== */
.btn-container {
  margin-top: 48rpx;
  margin-bottom: auto;

  .wg-btn-primary {
    height: 96rpx;
    line-height: 96rpx;
    border-radius: 48rpx;
    font-size: 34rpx;
    font-weight: 700;
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

<template>
  <!-- 使用 up-navbar 组件 -->
  <view>
    <!-- 二维码区域 -->
    <div class="header">

      <div class="qr-rode-view">
        <up-qrcode
          ref="qrcodeRef"
          :size="250"
          :val="qrCodeValue"
          :showLoading="true"
          loadingText="二维码生成中..."
          @result="onQRCodeGenerated"
          @longpress="save"
        ></up-qrcode>
        <image class="arrow" :src="`/static/icons/icon_refresh.png`" @tap="refreshQRCode"></image>
      </div>
    </div>

    <div class="info-section">
      <div class="info-item">
        <text class="label">开门密码:</text>
        <text class="value">{{doorPassword}}</text>
        <image class="copy-button" :src="`/static/icons/icon_copy.png`" @tap="copyPassword"></image>
      </div>
      <div class="divider"></div>
      <div class="info-item">
        <text class="label">有效次数:</text>
        <text class="value">{{validTimes}}</text>
      </div>
      <div class="divider"></div>
      <div class="info-item">
        <text class="label">有效分钟:</text>
        <text class="value">5</text>
      </div>
      <div class="divider"></div>
    </div>

    <div class="padding flex flex-direction">
      <button form-type="submit" class="cu-btn bg-red login-button" @tap="shareToFriend">分享好友</button>
    </div>

    <div class="footer">
      <navigator url="/pages/qrRodeManage/qrRodeManage" class="footer-link">管理员二维码</navigator>
    </div>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const qrcodeRef = ref(null)
const imgUrl = ref('/static')
const doorPassword = ref('')
const validTimes = ref(0)
const qrCodeValue = ref('initial-qr-code-data')
const navBgColor = ref('linear-gradient(#FCD3D3, #FCDEDE)')
const statusBarHeight = ref(0)

// 二维码生成成功回调
const onQRCodeGenerated = (res) => {
  console.log('二维码生成成功:', res)
}

// 刷新二维码
const refreshQRCode = () => {
  // 这里可以调用后端接口获取新的二维码数据
  qrCodeValue.value = 'new-qr-code-data' // 替换为实际的二维码数据
}

// 复制密码
const copyPassword = () => {
  uni.setClipboardData({
    data: doorPassword.value,
    success: () => {
      uni.showToast({
        title: '密码已复制',
        icon: 'success',
        duration: 2000
      })
    }
  })
}

// 保存二维码
const save = () => {
  uni.showModal({
    title: '保存二维码',
    content: '是否保存二维码到相册？',
    success: (res) => {
      if (res.confirm) {
        uni.saveImageToPhotosAlbum({
          filePath: qrcodeRef.value.result,
          success: () => {
            uni.showToast({
              title: '保存成功',
              icon: 'success'
            })
          },
          fail: () => {
            uni.showToast({
              title: '保存失败',
              icon: 'error'
            })
          }
        })
      }
    }
  })
}

// 分享给好友
const shareToFriend = () => {
  uni.share({
    provider: "weixin",
    scene: "WXSceneSession",
    type: 0,
    title: "门禁二维码",
    success: (res) => {
      console.log("分享成功:", res)
    },
    fail: (err) => {
      console.error("分享失败:", err)
    }
  })
}

// 返回上一页
const goBack = () => {
  uni.navigateBack()
}

onMounted(() => {
  // 初始化时可以调用接口获取二维码数据
  // qrCodeValue.value = await getQRCodeData()
  // 获取状态栏高度
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight

  // 设置状态栏颜色
  uni.setNavigationBarColor({
    frontColor: '#000000',
    backgroundColor: '#FCD3D3',
    animation: {
      duration: 0,
      timingFunc: 'easeIn'
    }
  })
})
</script>

<style scoped>
.bg-qr-rode {
  background-image: linear-gradient(#FCD3D3, #FCDEDE);
  color: var(--darkGray);
}

.header {
  width: 100%;
  background-image: linear-gradient(#FCDEDE, #FFFFFF);
  display: flex;
  justify-content: center;
  align-items: center;
  padding-top: 20rpx; /* 移除之前的padding-top，因为navbar组件会自动处理安全区域 */
}

.button-view {
  background-color: white;
  color: black;
  margin-top: 40rpx;
}

.arrow {
  margin-top: 10rpx;
  width: 100rpx;
  height: 100rpx;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  transition: all 0.3s;
}

.arrow:active {
  animation: rotate 0.3s linear;
}

.copy-button {
  margin-left: 20rpx;
  width: 60rpx;
  height: 60rpx;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  transition: all 0.3s;
}

.copy-button:active {
  animation: scale 0.3s ease-in-out;
}

.login-button {
  margin-top: 15rpx;
  padding: 0 30rpx;
  font-size: 36rpx;
  height: 100rpx;
  text-align: center;
  font-style: normal;
  text-transform: none;
  font-family: PingFang SC, PingFang SC;
  font-weight: 800;
}

.qr-rode-view {
  margin-top: 20rpx;
  background-color: white;
  display: flex;
  flex-direction: column;
  width: 600rpx;
  height: 650rpx;
  justify-content: center;
  align-items: center;
  padding: 20rpx;
  border-radius: 10rpx;
}

.info-section {
  background-color: white;
  border-radius: 10rpx;
  padding-left: 40rpx;
  padding-right: 40rpx;
}

.info-item {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  height: 80rpx;
  font-family: PingFang SC, PingFang SC;
  font-weight: 500;
  font-size: 30rpx;
  color: #303030;
  line-height: 30rpx;
  text-align: left;
  font-style: normal;
  text-transform: none;
}

.label {
  font-family: PingFang SC, PingFang SC;
  font-weight: 500;
  font-size: 30rpx;
  color: #303030;
  line-height: 30rpx;
  text-align: left;
  text-transform: none;
}

.value {
  text-align: right;
  margin-left: 50rpx;
  font-family: PingFang SC, PingFang SC;
  font-weight: 500;
  font-size: 30rpx;
  color: #A4A4A4;
  line-height: 3rpx;
  text-align: left;
  text-transform: none;
}

.footer {
  width: auto;
  padding: 20rpx;
  text-align: center;
}

.footer-link {
  text-align: center;
  font-size: 32rpx;
  line-height: 60rpx;
  height: 60rpx;
  font-family: PingFang SC, PingFang SC;
  font-weight: 500;
  color: #F94B4F;
  font-style: normal;
  text-transform: none;
  text-decoration: none;
}

.divider {
  height: 1rpx;
  background-color: #eee;
  margin: 10rpx 0;
}

/* 自定义导航栏样式 */
.nav-bar {
  width: 100%;
  background-color: #F8F8F8;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 999;
}

.nav-content {
  position: relative;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.left-icon {
  position: absolute;
  left: 16rpx;
  height: 44px;
  width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.left-icon image {
  width: 20px;
  height: 20px;
}

.nav-title {
  font-size: 16px;
  font-weight: 500;
  color: #000;
}

.custom-nav {
  width: 100%;
  background-image: linear-gradient(#FCD3D3, #FCDEDE);
  position: fixed;
  top: 0;
  z-index: 999;
}

.nav-content {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 15px;
}

.back-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  color: var(--darkGray);
}

.nav-title {
  flex: 1;
  text-align: center;
  color: var(--darkGray);
  font-size: 16px;
  font-weight: 500;
}

/* 添加渐变导航栏样式 */
:deep(.u-navbar__content) {
  background-image: linear-gradient(#FCD3D3, #FCDEDE) !important;
  background-color: transparent !important;
}


/* 移除旧的样式 */
.custom-nav,
.nav-bar,
.nav-content,
.back-icon,
.left-icon,
.nav-title,
.up-navbar,
.up-navbar__content {
  display: none;
}

/* 添加旋转动画关键帧 */
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 添加缩放动画关键帧 */
@keyframes scale {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(0.8);
  }
  100% {
    transform: scale(1);
  }
}
</style>


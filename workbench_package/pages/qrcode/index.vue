<template>
  <!-- 使用 up-navbar 组件 -->
  <view>
    <!-- 用于分享的隐藏canvas -->
    <canvas
      canvas-id="shareCanvas"
      style="width: 250px; height: 250px; position: fixed; left: -9999px;"
    ></canvas>

    <!-- 二维码区域 -->
    <div class="header">

      <div class="qr-rode-view">
        <view class="arrow-refresh" @tap="refreshQRCode">
          <up-icon name="reload" size="20" color="#4A6CF7"></up-icon>
        </view>
        <up-qrcode
          ref="qrcodeRef"
          :size="250"
          :val="qrCodeValue"
          :showLoading="true"
          loadingText="二维码生成中..."
          @result="onQRCodeGenerated"
          @longpress="save"
        ></up-qrcode>
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
        <picker mode="selector" :range="validTimesColumns" :value="gender" @change="picktimes">
          <view class="picker">
            <text class="label">有效次数:</text>
            <text class="value">{{ validTimesColumns[gender] }}</text>
            <text class="endlabel">(无限表示不限次数)</text>
          </view>
        </picker>
      </div>
      <div class="divider"></div>
      <div class="info-item">
        <picker mode="selector" :range="validMinutesColumns" :value="min" @change="pickmin">
          <view class="picker">
            <text class="label">有效分钟:</text>
            <text class="value">{{ validMinutesColumns[min] }}</text>
          </view>
        </picker>
      </div>
      <div class="divider"></div>
    </div>

    <div class="padding flex flex-direction">
      <button form-type="submit" class="cu-btn login-button" @tap="shareToFriend">保存到本地相册</button>
    </div>
<!-- 
    <div class="footer">
      <navigator url="/pages/qrRodeManage/qrRodeManage" class="footer-link">管理员二维码</navigator>
    </div> -->
  </view>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import DoorQRCodeUtils from '@/utils/doorQRCodeUtils'
import ShareUtils from '@/utils/shareUtils'

const qrcodeRef = ref(null)
const imgUrl = ref('/static')
const doorPassword = ref('')
const qrCodeValue = ref('')
const navBgColor = ref('linear-gradient(#4A6CF7, #8B5CF6)')
const statusBarHeight = ref(0)

// 有效次数选项
const validTimesColumns = ['无限', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
const validMinutesColumns = Array.from({ length: 30 }, (_, i) => String(i + 1))

// 在 script setup 中定义数据
const gender = ref(0)  // 有效次数索引
const min = ref(4)        // 有效分钟索引

// 生成二维码和密码
const generateQRCode = () => {
  // 获取选择的值
  const validTimes = validTimesColumns[gender.value] === '无限' ? 0 : parseInt(validTimesColumns[gender.value])
  const validMinutes = parseInt(validMinutesColumns[min.value])

  // 调用 DoorQRCodeUtils 生成二维码和密码
  const result = DoorQRCodeUtils.generateDoorQRCode({
    validTimes,
    validMinutes
  })

  // 更新显示
  qrCodeValue.value = result.qrcode
  doorPassword.value = result.tempPassword
}

// 处理有效次数变化
const picktimes = (e) => {
  gender.value = e.detail.value
  generateQRCode()
}

// 处理有效分钟变化
const pickmin = (e) => {
  min.value = e.detail.value
  generateQRCode()
}

// 刷新二维码
const refreshQRCode = () => {
  // 强制重新生成二维码
  qrCodeValue.value = ''  // 先清空二维码值
  nextTick(() => {
    generateQRCode()  // 在下一个tick重新生成
  })
}

// 二维码生成成功回调
const onQRCodeGenerated = (res) => {
  console.log('二维码生成成功:', res)
}

// 复制密码
const copyPassword = async () => {
  try {
    await ShareUtils.copyToClipboard(doorPassword.value)
  } catch (error) {
    console.error('复制失败:', error)
  }
}

// 保存二维码
const save = async () => {
  try {
    const res = await uni.showModal({
      title: '保存二维码',
      content: '是否保存二维码到相册？'
    })
    
    if (res.confirm) {
      await ShareUtils.saveImageToAlbum(qrcodeRef.value.result)
    }
  } catch (error) {
    console.error('保存失败:', error)
  }
}

// 分享给好友
const shareToFriend = async () => {
	save();
  // try {
  //   // 获取二维码图片
  //   const imageUrl = await ShareUtils.captureImage(qrcodeRef.value)
    
  //   // 分享到微信
  //   await ShareUtils.shareToWeChat({
  //     imageUrl,
  //     title: '门禁二维码',
  //     summary: `有效次数: ${validTimesColumns[gender.value]}, 有效分钟: ${validMinutesColumns[min.value]}`
  //   })
  // } catch (error) {
  //   console.error('分享失败:', error)
  // }
}

// 微信小程序分享配置
// #ifdef MP-WEIXIN
const onShareAppMessage = () => {
  return {
    title: '门禁二维码',
    path: '/pages/qrcode/index',
    imageUrl: qrcodeRef.value.result
  }
}

const onShareTimeline = () => {
  return {
    title: '门禁二维码',
    query: '',
    imageUrl: qrcodeRef.value.result
  }
}
// #endif

// 返回上一页
const goBack = () => {
  uni.navigateBack()
}

onMounted(() => {
  // 初始化时生成二维码
  generateQRCode()

  // 获取状态栏高度
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight

  // 设置状态栏颜色
  uni.setNavigationBarColor({
    frontColor: '#ffffff',
    backgroundColor: '#4A6CF7',
    animation: {
      duration: 0,
      timingFunc: 'easeIn'
    }
  })
})
</script>

<style scoped>
.bg-qr-rode {
  background-image: linear-gradient(#4A6CF7, #8B5CF6);
  color: #ffffff;
}

.header {
  width: 100%;
  background-image: linear-gradient(180deg, #4A6CF7 0%, #8B5CF6 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  padding-top: 30rpx; /* 移除之前的padding-top，因为navbar组件会自动处理安全区域 */
  padding-bottom: 46rpx;
}

.button-view {
  background-color: white;
  color: black;
  margin-top: 40rpx;
}

/* 刷新按钮（圆形浅底） */
.arrow-refresh {
  position: absolute;
  right: 26rpx;
  top: 26rpx;
  z-index: 2;
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
  background: #f3f5fc;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6rpx 16rpx rgba(74, 108, 247, 0.12);
}

.arrow-refresh:active {
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
  line-height: 100rpx;
  text-align: center;
  font-style: normal;
  text-transform: none;
  font-family: PingFang SC, PingFang SC;
  font-weight: 800;
  background-image: var(--brand-grad);
  background-color: #4a6cf7;
  color: #ffffff;
  border-radius: 50rpx;
  box-shadow: 0 12rpx 28rpx rgba(74, 108, 247, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-rode-view {
  position: relative;
  margin-top: 20rpx;
  background-color: white;
  display: flex;
  flex-direction: column;
  width: 600rpx;
  height: 650rpx;
  justify-content: center;
  align-items: center;
  padding: 20rpx;
  border-radius: 28rpx;
  box-shadow: 0 20rpx 60rpx rgba(31, 48, 152, 0.25);
}

.info-section {
  background-color: white;
  border-radius: 24rpx;
  margin: -30rpx 24rpx 0;
  padding-left: 30rpx;
  padding-right: 30rpx;
  box-shadow: 0 6rpx 24rpx rgba(74, 108, 247, 0.07);
  position: relative;
}

.info-item {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  height: 88rpx;
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
  font-weight: 600;
  font-size: 30rpx;
  color: #4A6CF7;
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
  background-color: #f0f1f8;
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
  background-image: linear-gradient(#4A6CF7, #8B5CF6);
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
  background-image: linear-gradient(#4A6CF7, #8B5CF6) !important;
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

.picker {
  width: 100%;
  display: flex;
  align-items: center;
}

.label {
  color: #9aa1bd;
  min-width: 150rpx;
}

.endlabel {
  margin-left: 20rpx;
  color: #b4bacd;
  font-size: 24rpx;
}

.value {
  margin-left: 50rpx;
  color: var(--brand);
}

/* 保存按钮外间距 */
.padding {
  padding: 0 24rpx;
  margin-top: 44rpx;
  box-sizing: border-box;
}
</style>

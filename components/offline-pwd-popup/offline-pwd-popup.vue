<template>
  <view v-if="visible" class="popup-mask" @click="onClose">
    <view class="popup-card" @click.stop>
      <!-- 头部 -->
      <view class="popup-header">
        <text class="popup-title">脱机开门密码</text>
        <view class="popup-close" @click="onClose">
          <text class="popup-close-icon">✕</text>
        </view>
      </view>

      <!-- 设备名 -->
      <view v-if="deviceName" class="popup-device">{{ deviceName }}</view>

      <!-- 密码展示区 -->
      <view class="popup-code-area">
        <block v-if="code">
          <text class="popup-code-digit" v-for="(d, i) in code.split('')" :key="i">{{ d }}</text>
        </block>
        <text v-else class="popup-code-empty">暂无法生成</text>
      </view>

      <!-- 说明 -->
      <view class="popup-tip">
        <text v-if="code">设备不在线或开门失败时，可在门口机键盘输入该密码开门</text>
        <text v-else>该设备缺少出厂码，无法生成脱机密码</text>
      </view>
      <view class="popup-tip popup-tip-time">密码每 30 分钟更新一次，请尽快使用</view>

      <!-- 操作按钮 -->
      <view class="popup-btns">
        <button class="popup-btn popup-btn-copy" @click="copyCode">复制密码</button>
        <button class="popup-btn popup-btn-close" @click="onClose">关闭</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import doorAccessUtils from '@/utils/doorAccessUtils'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  device: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])

// 弹窗打开时生成当前时间片的脱机密码
const code = ref('')
watch(
  () => props.visible,
  (val) => {
    if (val) {
      code.value = props.device ? doorAccessUtils.genOfflinePsw(props.device) : ''
    }
  }
)

const deviceName = computed(() => (props.device && props.device.door_name) || '')

// 关闭弹窗
const onClose = () => {
  emit('close')
}

// 复制密码
const copyCode = () => {
  if (!code.value) {
    uni.showToast({
      title: '暂无法生成密码',
      icon: 'none'
    })
    return
  }
  uni.setClipboardData({
    data: code.value,
    success: () => {
      uni.showToast({
        title: '已复制',
        icon: 'success'
      })
    }
  })
}
</script>

<style lang="scss" scoped>
.popup-mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.popup-card {
  width: 600rpx;
  background: #ffffff;
  border-radius: 28rpx;
  padding: 36rpx 40rpx 40rpx;
  box-sizing: border-box;
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.popup-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #1f2435;
}

.popup-close {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  .popup-close-icon {
    font-size: 32rpx;
    color: #9aa0b5;
  }
}

.popup-device {
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #9aa0b5;
}

.popup-code-area {
  margin-top: 40rpx;
  background: #f5f7ff;
  border: 1rpx solid #e4e9fd;
  border-radius: 20rpx;
  padding: 36rpx 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 130rpx;
  box-sizing: border-box;
}

.popup-code-digit {
  font-size: 64rpx;
  font-weight: 700;
  color: #2b5cf5;
  letter-spacing: 12rpx;
  font-family: 'DIN Alternate', 'Arial', sans-serif;
}

.popup-code-empty {
  font-size: 28rpx;
  color: #9aa0b5;
}

.popup-tip {
  margin-top: 28rpx;
  font-size: 26rpx;
  color: #6a7080;
  text-align: center;
  line-height: 1.5;
}

.popup-tip-time {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #b0b5c5;
}

.popup-btns {
  margin-top: 44rpx;
  display: flex;
}

.popup-btn {
  flex: 1;
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 42rpx;
  font-size: 30rpx;
  padding: 0;
  margin: 0 8rpx;
  box-sizing: border-box;

  &::after {
    border: none;
  }
}

.popup-btn-copy {
  background: linear-gradient(90deg, #4a6cf7, #2b5cf5);
  color: #ffffff;
}

.popup-btn-close {
  background: #f0f2f9;
  color: #6a7080;
}
</style>

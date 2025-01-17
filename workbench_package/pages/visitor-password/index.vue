<template>
  <view class="container">
    <view class="title">设备</view>
    <!-- 滚动视图用于设备按钮 -->
    <scroll-view scroll-y="true" class="scroll-container">
      <view v-for="(item, index) in deviceList" :key="index" class="flex flex-direction">
        <button 
          :class="['cu-btn login-button', item.selected ? 'bg-red' : 'textsecondary']" 
          @tap="toggleSelection(item.id)"
        >{{ item.name }}</button>
      </view>
    </scroll-view>
    <view class="divider-botton"></view>
    <view class="divider_40rpx"></view>
    <view class="info-section">
      <view class="info-item" @click="showStartPicker = true">
        <text class="label">开始时间:</text>
        <text class="value">{{ formatDateTime(startDateTime) }}</text>
        <up-datetime-picker
          ref="startPickerRef"
          :show="showStartPicker"
          v-model="startDateTime"
          mode="datetime"
          :formatter="formatter"
          :min-date="currentTime"
          @confirm="onStartTimeConfirm"
          @cancel="showStartPicker = false"
          @close="showStartPicker = false"
          :show-seconds="true"
        ></up-datetime-picker>
      </view>
      <view class="divider"></view>
      <view class="info-item" @click="showEndPicker = true">
        <text class="label">结束时间:</text>
        <text class="value">{{ formatDateTime(endDateTime) }}</text>
        <up-datetime-picker
          ref="endPickerRef"
          :show="showEndPicker"
          v-model="endDateTime"
          mode="datetime"
          :formatter="formatter"
          :min-date="startDateTime"
          :max-date="maxEndTime"
          @confirm="onEndTimeConfirm"
          @cancel="showEndPicker = false"
          @close="showEndPicker = false"
          :show-seconds="true"
        ></up-datetime-picker>
      </view>
      <view class="divider"></view>
      <view class="info-item">
        <picker mode="selector" :range="validTimesRange" :value="validTimes" @change="bindValidTimesChange">
          <view class="picker">
            <text class="label">有效次数:</text>
            <text class="value">{{ validTimes }}</text>
            <text class="endlabel">(0表示无限次)</text>
          </view>
        </picker>
      </view>
      <view class="divider"></view>
      <view class="info-item">
        <text class="label">开门密码:</text>
        <text class="value">{{ doorPassword }}</text>
      </view>
      <view class="divider"></view>
    </view>
    <view class="flex flex-direction button-view">
      <button class="cu-btn line-red login-button" @tap="refresh">刷新</button>
      <button class="cu-btn bg-red login-button" @tap="shareKeys">保存并分享钥匙</button>
    </view>
  </view>
</template>

<script>
import { ref, onMounted } from 'vue';
import { onReady } from '@dcloudio/uni-app';

export default {
  data() {
    const now = new Date();
    const end = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24小时后
    return {
      deviceList: [
        { id: 1, name: '南大门', selected: false },
        { id: 2, name: '1楼消防门', selected: false },
        { id: 3, name: '-1楼消防门', selected: false },
        { id: 4, name: '北门', selected: false }
      ],
      startDateTime: now.getTime(),
      endDateTime: end.getTime(),
      showStartPicker: false,
      showEndPicker: false,
      validTimesRange: ['0', '1', '2', '3', '4', '5'],
      validTimes: 0,
      doorPassword: this.generateRandomPassword()
    };
  },
  computed: {
    currentTime() {
      return Date.now();
    },
    maxEndTime() {
      // 开始时间后的3天
      return this.startDateTime + (3 * 24 * 60 * 60 * 1000);
    }
  },
  methods: {
    toggleSelection(id) {
      // 找到当前设备
      const index = this.deviceList.findIndex(item => item.id === id);
      if (index !== -1) {
        // 直接切换当前设备的选中状态
        this.deviceList[index].selected = !this.deviceList[index].selected;
        // 强制更新视图
        this.deviceList = [...this.deviceList];
      }
    },
    // 获取已选中的设备
    getSelectedDevices() {
      return this.deviceList.filter(item => item.selected);
    },
    bindValidTimesChange(e) {
      this.validTimes = this.validTimesRange[e.detail.value];
    },
    formatDateTime(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    },
    formatter(type, value) {
      if (type === 'year') {
        return `${value}年`;
      }
      if (type === 'month') {
        return `${value}月`;
      }
      if (type === 'day') {
        return `${value}日`;
      }
      if (type === 'hour') {
        return `${value}时`;
      }
      if (type === 'minute') {
        return `${value}分`;
      }
      if (type === 'second') {
        return `${value}秒`;
      }
      return value;
    },
    generateRandomPassword() {
      return String(Math.floor(100000 + Math.random() * 900000));
    },
    refresh() {
      // 只更新开门密码
      this.doorPassword = this.generateRandomPassword();
    },
    onStartTimeConfirm(e) {
      this.startDateTime = e.value;
      this.showStartPicker = false;
      
      // 如果结束时间小于开始时间，将结束时间设置为开始时间后24小时
      if (this.endDateTime < this.startDateTime) {
        this.endDateTime = this.startDateTime + (24 * 60 * 60 * 1000);
      }
      // 如果结束时间超过了最大允许时间，将其设置为最大允许时间
      if (this.endDateTime > this.maxEndTime) {
        this.endDateTime = this.maxEndTime;
      }
    },
    onEndTimeConfirm(e) {
      this.endDateTime = e.value;
      this.showEndPicker = false;
    },
    shareKeys() {
      // 验证时间
      if (this.startDateTime < this.currentTime) {
        uni.showToast({
          title: '开始时间不能小于当前时间',
          icon: 'none'
        });
        return;
      }
      if (this.endDateTime > this.maxEndTime) {
        uni.showToast({
          title: '结束时间不能超过开始时间后3天',
          icon: 'none'
        });
        return;
      }
      
      // 获取选中的设备
      const selectedDevices = this.getSelectedDevices();
      if (selectedDevices.length === 0) {
        uni.showToast({
          title: '请选择至少一个设备',
          icon: 'none'
        });
        return;
      }
      // 分享钥匙逻辑
      console.log('选中的设备：', selectedDevices);
      console.log('开始时间：', this.formatDateTime(this.startDateTime));
      console.log('结束时间：', this.formatDateTime(this.endDateTime));
      console.log('有效次数：', this.validTimes);
      console.log('开门密码：', this.doorPassword);
    }
  },
  onReady() {
    // 微信小程序需要在onReady中设置formatter
    this.$refs.startPickerRef?.setFormatter?.(this.formatter);
    this.$refs.endPickerRef?.setFormatter?.(this.formatter);
  }
};
</script>

<style scoped>
.nav-custom {
  padding: 20rpx;
  background-color: #fff;
}

.content {
  text-align: center;
  font-size: 32rpx;
  font-weight: 500;
}

.divider {
  height: 1rpx;
  background-color: #eee;
}

.divider_40rpx {
  height: 40rpx;
  background: #EEEEEE;
}

.title {
  background-color: white;
  padding-left: 24rpx;
  padding-top: 30rpx;
  font-family: PingFang SC, PingFang SC;
  font-weight: 800;
  font-size: 34rpx;
  color: #303030;
  line-height: 34rpx;
  text-align: left;
}

.scroll-container {
  max-height: 400rpx;
  background-color: white;
  padding: 20rpx 40rpx;
}

.flex {
  display: flex;
  justify-content: center;
  align-items: center;
}

.flex-direction {
  flex-direction: column;
}

.login-button {
  padding: 0 30rpx;
  height: 84rpx;
  width: 100%;
  margin-top: 17rpx;
  font-family: PingFang SC, PingFang SC;
  font-weight: 500;
  font-size: 28rpx;
  line-height: 28rpx;
}

.bg-red {
  background-color: #ff4d4f;
  color: white;
}

.line-red {
  border: 1px solid #ff4d4f;
  color: #ff4d4f;
  background-color: white;
}

.textsecondary {
  color: #ff4d4f;
  background-color: #EFEFEF;
  border: 1px solid #eee;
}

.divider-botton {
  background-color: white;
  width: 100%;
  height: 60rpx;
}

.info-section {
  background-color: white;
  border-radius: 10rpx;
  margin-top: 40rpx;
  padding: 0 40rpx;
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
}

.picker {
  width: 100%;
  display: flex;
  align-items: center;
}

.label {
  color: #888;
}

.endlabel {
  margin-left: 20rpx;
  color: #888;
}

.value {
  margin-left: 50rpx;
}

.button-view {
  background-color: white;
  margin: 40rpx;
}
</style>

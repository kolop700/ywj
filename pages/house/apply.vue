<template>
    <view class="container">
      <!-- 表单区域 -->
      <view class="form-section">
        <form @submit="submitForm">
          <view class="input-container">
            <!-- 楼宇地址输入 -->
            <view class="cu-form-group custom-input">
              <view class="input-wrap">
                <input 
                  v-model="formData.building"
                  placeholder="输入楼宇地址"
                  @input="inputChange"
                  data-field="building"
                  class="ellipsis-input"
                />
              </view>
              <view class="icon-group">
                <view class="btn-wrap" @tap.stop="scanQRCode">
                  <button class="action-btn scan-btn">扫一扫</button>
                </view>
                <view class="btn-wrap" @tap.stop="showBuildingSearch">
                  <button class="action-btn search-btn">搜索</button>
                </view>
              </view>
            </view>
            
            <!-- 房号选择 -->
            <view class="cu-form-group custom-input room-select" @click.stop="selectRoom">
              <input 
                v-model="formData.room"
                placeholder="选择房号"
                data-field="room"
                disabled
              />
              <uni-icons class="arrow-icon" type="bottom" size="16" color="#999999"></uni-icons>
            </view>
          </view>
    
          <!-- 提交按钮 -->
          <view class="button-container">
            <button 
              class="cu-btn bg-red login-button"
              :class="{'secondary': !isFormValid}"
            >提交申请</button>
          </view>
        </form>
      </view>
     
      <!-- 分割线 -->
      <view class="divider_10"></view>

      <!-- 内容区域 -->
      <view class="content-section">
        <!-- 列表区域 -->
        <view class="list-section">
          <view class="card" v-if="cardModel">
            <view class="header">我的房屋</view>
            <view class="divider"></view>
            <scroll-view class="house-list" scroll-y>
              <view 
                v-for="(item, index) in houseList" 
                :key="item.roomid"
                class="house-item"
              >
                <!-- 房屋信息 -->
                <view class="house-info">
                  <text class="house-name">{{item.name}}</text>
                  <view class="auth-info">
                    <text class="auth-date">授权时间：{{item.expire_date}}</text>
                    <text 
                      class="auth-status"
                      :class="{'status-normal': item.authority === '0', 'status-error': item.authority === '1'}"
                    >
                      {{item.authority === '0' ? '权限正常' : '权限异常'}}
                    </text>
                  </view>
                </view>
                <view class="divider" v-if="index !== houseList.length - 1"></view>
              </view>
            </scroll-view>
          </view>
        </view>
      </view>

      <!-- 广告区域 -->
      <view class="ad-section">
        <view class="ad-container">
          <image class="ad-image" src="/static/images/ad-placeholder.png" mode="aspectFill"></image>
          <view class="ad-text">广告区域</view>
        </view>
      </view>
    
      <!-- 弹框部分 -->
      <uni-popup ref="buildingPopup" type="center">
        <view class="modal-content">
          <view class="modal-header">
            <text class="header-text">选择楼宇地址</text>
            <text class="close-icon" @click="hideDialog">×</text>
          </view>
          <scroll-view class="modal-body" scroll-y>
            <view 
              v-for="(item, index) in searchResults" 
              :key="item.unit_id"
              class="device-option"
              @click="selectDialogBuilding(item)"
            >
              {{item.unitname}}
            </view>
          </scroll-view>
        </view>
      </uni-popup>
    
      <uni-popup ref="roomPopup" type="center" :animation="true" :maskClick="true">
        <view class="modal-content">
          <view class="modal-header">
            <text class="header-text">选择房号</text>
            <text class="close-icon" @click="hideRoomDialog">×</text>
          </view>
          <scroll-view class="modal-body" scroll-y>
            <view 
              v-for="(item, index) in roomList" 
              :key="item.id"
              class="device-option"
              @click="selectDialogRoom(index)"
              :class="{'selected': item.selected}"
            >
              {{item.floor_name}}{{item.room_name}}
            </view>
          </scroll-view>
        </view>
      </uni-popup>
    </view>
</template>
<script setup>
import { ref, getCurrentInstance, computed, onMounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { onLoad } from '@dcloudio/uni-app'
import uniIcons from '@/uni_modules/uni-icons/components/uni-icons/uni-icons.vue'
import { getPageHeight, calculateScrollViewHeight } from '@/utils/layout'
import scanUtils from '@/utils/scanUtils'

const { proxy } = getCurrentInstance()
const userStore = proxy.$store.user.useUserStore()
const deviceApi = proxy.$api.device

// 表单数据
const formData = ref({
  building: '',
  room: ''
})

// 搜索结果
const searchResults = ref([])

// 选中的单元
const selectedUnit = ref(null)

// 房间列表
const roomList = ref([])

// 房屋列表
const houseList = ref([])

// 是否显示卡片
const cardModel = ref(true)

// 页面高度
const windowHeight = ref('100vh')

// 列表高度
const listHeight = ref(750)

// 计算列表高度
const updateListHeight = async () => {
  // #ifdef MP-WEIXIN || APP-PLUS
  try {
    const height = await calculateScrollViewHeight()
    listHeight.value = height
  } catch (error) {
    console.error('计算高度失败:', error)
    listHeight.value = 750 // 默认高度
  }
  // #endif
}

// 格式化日期
const getDateOnly = (dateString) => {
  if (!dateString) return ''
  return dateString.split(' ')[0]
}

// 获取房屋列表
const loadHouseList = async () => {
  try {
    const data = await userStore.getUserRoomList()
    if (Array.isArray(data)) {
      houseList.value = data.map(item => ({
        roomid: item.room_id,
        expire_date: getDateOnly(item.expire_date),
        name: item.comm_name + item.unit_name + item.floor_name + item.room_name,
        authority: item.status
      }))
      cardModel.value = houseList.value.length > 0
    }
  } catch (error) {
    console.error('获取房屋列表失败:', error)
    uni.showToast({
      title: '获取房屋列表失败',
      icon: 'none'
    })
  }
}

// 页面加载时获取房屋列表和设置高度
onMounted(async () => {
  windowHeight.value = getPageHeight()
  await updateListHeight()
  loadHouseList()
})

// 监听窗口大小变化
onLoad(() => {
  // #ifdef MP-WEIXIN || APP-PLUS
  uni.onWindowResize(() => {
    updateListHeight()
  })
  // #endif
})

// 表单是否有效
const isFormValid = computed(() => {
  return formData.value.building && formData.value.room
})

// 弹窗引用
const buildingPopup = ref(null)
const roomPopup = ref(null)

// 输入变化处理
const inputChange = (e) => {
  const { field } = e.currentTarget.dataset
  formData.value[field] = e.detail.value
  
  // 如果是楼宇地址输入变化，清空房间
  if (field === 'building') {
    formData.value.room = ''
    roomList.value = []
    selectedUnit.value = null
  }
}

// 扫描二维码
const scanQRCode = async () => {
  try {
    const result = await scanUtils.scanQRCode()
    if (result) {
      // 获取单元信息
      const res = await deviceApi.getUnitByQRCode(result)
      if (Array.isArray(res.data) && res.data.length > 0) {
        console.log('单元信息:', res.data)
        const unitInfo = res.data[0]
        
        if (unitInfo.type === '1') {
          // 大门机，显示楼宇选择弹框
          searchResults.value = res.data
          buildingPopup.value.open()
        } else if (unitInfo.type === '2') {
          // 单元机，直接选中单元
          selectedUnit.value = unitInfo
          formData.value.building = unitInfo.unitname
          formData.value.room = ''
          roomList.value = []
          // 加载房间列表
          loadRoomList()
        } else {
          uni.showToast({
            title: '未找到相关单元信息',
            icon: 'none'
          })
        }
      } else {
        uni.showToast({
          title: '未找到相关单元信息',
          icon: 'none'
        })
      }
    }
  } catch (error) {
    console.error('扫码失败:', error)
    uni.showToast({
      title: '扫码失败',
      icon: 'none'
    })
  }
}

// 显示楼宇搜索
const showBuildingSearch = async () => {
  const searchText = formData.value.building.trim()
  if (!searchText) {
    uni.showToast({
      title: '请输入楼宇地址',
      icon: 'none'
    })
    return
  }

  if (searchText.length < 3) {
    uni.showToast({
      title: '请至少输入3个字符',
      icon: 'none'
    })
    return
  }
  
  // 清空房间相关数据
  formData.value.room = ''
  roomList.value = []
  selectedUnit.value = null
  
  try {
    const res = await deviceApi.getUnitList({
      name: searchText
    })
    
    if (Array.isArray(res.data) && res.data.length > 0) {
      searchResults.value = res.data
      buildingPopup.value.open()
    } else {
      uni.showToast({
        title: '未找到相关楼宇',
        icon: 'none'
      })
    }
  } catch (error) {
    console.error('搜索楼宇失败:', error)
    uni.showToast({
      title: '搜索失败',
      icon: 'none'
    })
  }
}

// 隐藏楼宇搜索
const hideDialog = () => {
  buildingPopup.value.close()
}

// 选择房间
const selectRoom = () => {
  if (!formData.value.building) {
    uni.showToast({
      title: '请先选择楼宇',
      icon: 'none'
    })
    return
  }
  roomPopup.value.open()
}

// 隐藏房间选择
const hideRoomDialog = () => {
  roomPopup.value.close()
}

// 选择楼宇
const selectDialogBuilding = (item) => {
  // 清空房间相关数据
  formData.value.room = ''
  roomList.value = []
  
  // 设置新的楼宇信息
  selectedUnit.value = item
  formData.value.building = item.unitname
  hideDialog()
  loadRoomList()
}

// 选择房间
const selectDialogRoom = (index) => {
  const room = roomList.value[index]
  formData.value.room = `${room.floor_name}${room.room_name}`
  hideRoomDialog()
}

// 加载房间列表
const loadRoomList = async () => {
  if (!selectedUnit.value?.unit_id) {
    console.error('未选择单元')
    return
  }
  try {
    const res = await deviceApi.getRoomList(selectedUnit.value.unit_id)
    if (Array.isArray(res.data)) {
      roomList.value = res.data.map(item => ({
        id: item.room_id,
        room_name: item.room_name,
        floor_name: item.floor_name,
        selected: false
      }))
      
      setTimeout(() => {
        roomPopup.value.open()
      }, 100)
    } else {
      uni.showToast({
        title: '获取房间列表失败',
        icon: 'none'
      })
    }
  } catch (error) {
    console.error('获取房间列表失败:', error)
    uni.showToast({
      title: '获取房间列表失败',
      icon: 'none'
    })
  }
}

// 提交表单
const submitForm = () => {
  if (!isFormValid.value) {
    uni.showToast({
      title: '请填写完整信息',
      icon: 'none'
    })
    return
  }
  
  console.log('提交数据：', formData.value)
}
</script>

<style lang="scss" scoped>
/* #ifdef MP-WEIXIN */
page {
  height: 100vh;
  background-color: #F5F5F5;
}
/* #endif */

/* #ifdef H5 */
.container {
  min-height: v-bind(windowHeight);
  height: v-bind(windowHeight);
  display: flex;
  flex-direction: column;
  background: #F5F5F5;
  box-sizing: border-box;
  padding-bottom: env(safe-area-inset-bottom);
}
/* #endif */

/* #ifdef MP-WEIXIN || APP-PLUS */
.container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #F5F5F5;
  position: relative;
  padding-bottom: 150rpx; /* 为广告区域预留空间 */
}
/* #endif */

.form-section {
  /* #ifdef MP-WEIXIN || APP-PLUS */
  padding-top: var(--status-bar-height);
  /* #endif */
  background: #FFFFFF;
  width: 100%;
  flex: none;
}

.content-section {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* #ifdef MP-WEIXIN || APP-PLUS */
.list-section {
  background: #FFFFFF;
  padding: 10rpx 0;
  height: v-bind(listHeight + 'rpx');
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 100%;
}
/* #endif */

.ad-section {
  /* #ifdef MP-WEIXIN || APP-PLUS */
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  /* #endif */
  background: #FFFFFF;
  padding: 15rpx 20rpx;
  height: 150rpx;
  box-sizing: border-box;
  width: 100%;
  z-index: 99;
}

.card {
  height: 100%;
  background: #fff;
  padding: 20rpx;
  display: flex;
  flex-direction: column;
}

.house-list {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0 15rpx;
}

.ad-container {
  width: 100%;
  height: 100%;
  background: #F8F8F8;
  border-radius: 12rpx;
  overflow: hidden;
  position: relative;
  /* #ifdef MP-WEIXIN */
  margin-bottom: 0;
  /* #endif */
}

.ad-image {
  width: 100%;
  height: 100%;
}

.ad-text {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  color: #999;
  font-size: 28rpx;
}

.input-container {
  margin-top: 15rpx;
  padding: 0 40rpx;
}

.input-wrap {
  flex: 1;
  margin-right: 240rpx; /* 为两个按钮预留空间 */
  overflow: hidden;
}

.ellipsis-input {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.custom-input {
  border: 1px solid #ddd;
  border-radius: 8rpx;
  margin-bottom: 10px;
  background: #F9F9F9;
  height: 108rpx;
  display: flex;
  align-items: center;
  padding-left: 40rpx;
  font-size: 30rpx;
  line-height: 30rpx;
  box-sizing: border-box;
  width: 100%;
  position: relative;
}

/* 弹框样式 */
.modal-content {
  background-color: #fff;
  width: 600rpx;
  height: 800rpx;
  border-radius: 24rpx;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx;
  border-bottom: 1rpx solid #EEEEEE;
  position: relative;
}

.header-text {
  font-size: 32rpx;
  color: #333;
  font-weight: 500;
  flex: 1;
  text-align: center;
}

.close-icon {
  font-size: 40rpx;
  color: #999;
  padding: 20rpx;
  position: absolute;
  right: 0;
}

.modal-body {
  flex: 1;
  padding: 20rpx;
  overflow-y: auto;
}

/* 选项样式 */
.device-option {
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  font-size: 28rpx;
  color: #333;
  background: #F5F5F5;
  margin-bottom: 20rpx;
  border-radius: 8rpx;
}

.device-option.selected {
  background-color: #FF4B4B;
  color: #fff;
}

/* 修改弹出层背景 */
:deep(.uni-popup) {
  /* #ifdef MP-WEIXIN || APP-PLUS */
  z-index: 999;
  /* #endif */
  background-color: rgba(0, 0, 0, 0.5) !important;
}

/* 图标组样式 */
.icon-group {
  display: flex;
  align-items: center;
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
}

.btn-wrap {
  width: 120rpx;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.action-btn {
  font-size: 24rpx;
  padding: 10rpx 20rpx;
  border-radius: 8rpx;
  border: none;
  color: #fff;
  line-height: 1.5;
}

.scan-btn {
  background-color: #007AFF;
}

.search-btn {
  background-color: #FF4B4B;
}

/* 去除按钮默认边框 */
.action-btn::after {
  border: none;
}

.room-select {
  position: relative;
  cursor: pointer;
}

.room-select input {
  pointer-events: none;
}

.divider {
  height: 1rpx;
  background: #EEEEEE;
  width: 100%;
}

.divider_10 {
  height: 10rpx;
  background: #EEEEEE;
  width: 100%;
}

.house-name {
  font-size: 28rpx;
  color: #303030;
  display: block;
  line-height: 1.4;
}

.auth-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12rpx;
}

.auth-date {
  font-size: 24rpx;
  color: #666;
}

.auth-status {
  font-size: 24rpx;
  padding: 4rpx 16rpx;
  border-radius: 4rpx;
}

.status-normal {
  color: #1DA5FB;
  background: rgba(29, 165, 251, 0.1);
}

.status-error {
  color: #e54d42;
  background: rgba(229, 77, 66, 0.1);
}
.button-container {
	display: flex;
	justify-content: center;
	padding: 20rpx 40rpx;  /* 减小内边距 */
	margin-top: 10rpx;  /* 减小上边距 */
  }
/* 按钮样式 */
.login-button {
	width: 100%;
	padding: 0 30rpx;
	font-size: 36rpx;
	height: 100rpx;
	text-align: center;
	font-weight: bold;
  }
  
  .login-button.secondary {
	background-color: #FCA5A7;
  }

  .divider {
	height: 1rpx;
	background: #eee;
	margin: 10rpx 0;
  }


</style> 
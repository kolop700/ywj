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
              class="cu-btn login-button"
              :class="{'secondary': !isFormValid}"
              @click="submitForm"
              type="submit"
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
                  <text class="house-name">申请房屋：{{item.name}}</text>
                  <view class="auth-info">
                    <text class="auth-date">授权时间：{{item.expire_date}}</text>
                    <text 
                      class="auth-status"
                      :class="{'status-normal': item.authority === '1', 'status-error': item.authority === '0'}"
                    >
                    {{item.authority === '1' ? '权限正常' : '权限异常'}}
                    </text>
                  </view>
                </view>
                <view class="divider" v-if="index !== houseList.length - 1"></view>
              </view>
            </scroll-view>
          </view>
        </view>
      </view>

      <!-- 弹框部分（自管理遮罩，不依赖 uni-popup，确保选择后必能关闭） -->
      <view class="popup-mask" v-if="buildingPopupVisible" @tap="hideDialog">
        <view class="modal-content" @tap.stop>
          <view class="modal-header">
            <text class="header-text">选择楼宇地址</text>
            <text class="close-icon" @tap="hideDialog">×</text>
          </view>
          <scroll-view class="modal-body" scroll-y>
            <view 
              v-for="(item, index) in searchResults" 
              :key="item.unit_id"
              class="device-option"
              @tap="selectDialogBuilding(item)"
            >
              {{item.unitname}}
            </view>
          </scroll-view>
        </view>
      </view>
    
      <view class="popup-mask" v-if="roomPopupVisible" @tap="hideRoomDialog">
        <view class="modal-content" @tap.stop>
          <view class="modal-header">
            <text class="header-text">选择房号</text>
            <text class="close-icon" @tap="hideRoomDialog">×</text>
          </view>
          <scroll-view class="modal-body" scroll-y>
            <view 
              v-for="(item, index) in roomList" 
              :key="item.id"
              class="device-option"
              @tap="selectDialogRoom(index)"
              :class="{'selected': item.selected}"
            >
              {{item.floor_name}}{{item.room_name}}
            </view>
          </scroll-view>
        </view>
      </view>
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

// 弹窗显隐（自管理遮罩，不依赖 uni-popup 的实例方法）
const buildingPopupVisible = ref(false)
const roomPopupVisible = ref(false)

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
          buildingPopupVisible.value = true
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

  if (searchText.length < 2) {
    uni.showToast({
      title: '请至少输入2个字符',
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
      buildingPopupVisible.value = true
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
  buildingPopupVisible.value = false
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
  roomPopupVisible.value = true
}

// 隐藏房间选择
const hideRoomDialog = () => {
  roomPopupVisible.value = false
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
      
      roomPopupVisible.value = true
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
const submitForm = async () => {
  if (!isFormValid.value) {
    uni.showToast({
      title: '请填写完整信息',
      icon: 'none'
    })
    return
  }
  if (!selectedUnit.value?.unit_id) {
    uni.showToast({
      title: '请选择有效的楼宇',
      icon: 'none'
    })
    return
  }
  // 获取当前选中的房间ID
  const selectedRoom = roomList.value.find(room => 
    `${room.floor_name}${room.room_name}` === formData.value.room
  )
  if (!selectedRoom) {
    uni.showToast({
      title: '请选择有效的房间',
      icon: 'none'
    })
    return
  }
  try {
    const result = await proxy.$api.user.bindUserRoom({
      room_id: selectedRoom.id,
      user_id: userStore.userInfo.user_id,
      auto_author: "0"
    })
    if (result.code === "0") {
      uni.showToast({
        title: '申请成功',
        icon: 'success'
      })
      // 重新加载房屋列表
      await loadHouseList()
      // 清空表单
      formData.value.building = ''
      formData.value.room = ''
      selectedUnit.value = null
      roomList.value = []
    } else {
      uni.showToast({
        title: result.msg || '申请失败',
        icon: 'none'
      })
    }
  } catch (error) {
    console.error('申请失败:', error)
    uni.showToast({
      title: '申请失败，请重试',
      icon: 'none'
    })
  }
}
</script>

<style lang="scss" scoped>
/* #ifdef MP-WEIXIN */
page {
  height: 100vh;
  background-color: #f5f6fc;
}
/* #endif */

/* #ifdef H5 */
.container {
  min-height: v-bind(windowHeight);
  height: v-bind(windowHeight);
  display: flex;
  flex-direction: column;
  background: #f5f6fc;
  box-sizing: border-box;
  padding-bottom: env(safe-area-inset-bottom);
}
/* #endif */

/* #ifdef MP-WEIXIN || APP-PLUS */
.container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f6fc;
  position: relative;
}
/* #endif */

.form-section {
  /* #ifdef MP-WEIXIN || APP-PLUS */
  // padding-top: var(--status-bar-height);
  padding-top: 15rpx;
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
.header {
font-weight: 800;
font-size: 32rpx;
color: #303030;
line-height: 30rpx;
padding: 20rpx;


}

.header-text {
  font-size: 35rpx;
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
  background: #f5f6fc;
  margin-bottom: 20rpx;
  border-radius: 8rpx;
}

.device-option.selected {
  background-color: #FF4B4B;
  color: #fff;
}

/* 自管理遮罩层（替代 uni-popup） */
.popup-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 999;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
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
	background-color: #B9C4FA;
  }

  .divider {
	height: 1rpx;
	background: #eee;
	margin: 10rpx 0;
  }



/* ==================
        云卫家品牌改版覆盖
 ==================== */

.page-gap {
  display: none;
}

/* 页头渐变标题区 */
.apply-header {
  background-image: var(--brand-grad-deep);
}

/* 表单区悬浮白卡 */
.form-section {
  margin: 24rpx 24rpx 0;
  padding: 30rpx 10rpx 6rpx;
  border-radius: 24rpx;
  box-shadow: 0 6rpx 24rpx rgba(74, 108, 247, 0.07);
  width: auto;
  box-sizing: border-box;
}

/* 输入行圆角胶囊 */
.custom-input {
  border: none;
  border-radius: 50rpx;
  background: #f3f5fc;
  padding-left: 36rpx;
  margin-bottom: 24rpx;
}

/* 扫一扫 / 搜索 小按钮品牌化 */
.scan-btn {
  background-color: var(--brand-soft);
  color: var(--brand);
  border-radius: 30rpx;
}

.search-btn {
  background-color: #ffffff;
  color: var(--brand);
  border: 1rpx solid var(--brand);
  border-radius: 30rpx;
}

/* 提交按钮渐变 */
.login-button {
  background-image: var(--brand-grad);
  background-color: #4a6cf7;
  color: #ffffff;
  border-radius: 50rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 28rpx rgba(74, 108, 247, 0.28);
}

.login-button.secondary {
  background-image: none;
  background-color: #b9c4fa;
  color: #ffffff;
  box-shadow: none;
}

/* 分割线淡化为间距 */
.divider_10 {
  height: 24rpx;
  background: transparent;
}

.divider {
  background: #eff1f9;
}

/* 列表区悬浮白卡 */
.list-section {
  background: transparent;
  padding: 24rpx 24rpx 0;
  box-sizing: border-box;
}

.card {
  border-radius: 24rpx;
  box-shadow: 0 6rpx 24rpx rgba(74, 108, 247, 0.07);
  overflow: hidden;
}

.house-item {
  padding: 10rpx 6rpx;
}

/* 状态徽章：权限正常-品牌蓝，异常保留红 */
.status-normal {
  color: var(--brand);
  background: rgba(74, 108, 247, 0.1);
  border-radius: 8rpx;
}

.status-error {
  border-radius: 8rpx;
}

/* 弹框选项选中态品牌化 */
.device-option {
  background: #f3f5fc;
  border-radius: 16rpx;
}

.device-option.selected {
  background-color: var(--brand);
  background-image: var(--brand-grad);
  color: #fff;
}

.modal-header {
  border-bottom-color: #eff1f9;
}
</style> 
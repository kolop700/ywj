import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import userApi from '@/api/user/user'
import deviceApi from '@/api/device/device' // 引入设备API
import { useDeviceStore } from './device'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref({})
  const user_id = ref('')
  const maxExpireDate = ref('') // 最大过期日期
  
  // 基础图片URL
  const BASE_IMG_URL = 'https://xy.yefiot.com/yefiot/v1/'
  
  // 头像完整URL的计算属性
  const avatarUrl = computed(() => {
    if (userInfo.value.user_face_url && userInfo.value.user_face_tag) {
      return `${BASE_IMG_URL}${userInfo.value.user_face_url}?tag=${userInfo.value.user_face_tag}`
    }
    return '' // 返回默认头像或空字符串
  })

  // 判断是否登录
  const isLogin = computed(() => {
    return !!user_id.value && !!userInfo.value.user_acct
  })

  // 获取账号
  const userAcct = computed(() => {
    return userInfo.value.user_acct || ''
  })

  // 获取用户名
  const userName = computed(() => {
    return userInfo.value.user_name || ''
  })

  // 获取用户ID
  const userId = computed(() => {
    return userInfo.value.user_id || ''
  })

  // 登录方法
  async function login(loginData) {
    try {
      // 如果没有传入登录数据且userInfo中没有账号密码，直接返回
      if (!loginData && (!userInfo.value.user_acct || !userInfo.value.user_password)) {
        return Promise.reject('无登录数据')
      }
      
      // 使用传入的登录数据或userInfo中的账号密码
      const loginParams = loginData || {
        user_acct: userInfo.value.user_acct,
        user_password: userInfo.value.user_password
      }

      const res = await userApi.UserLogin(loginParams)
      
      // 登录成功,保存用户信息
      const userData = res.data[0]
      loginSuccess(userData)
      return Promise.resolve(res)
    } catch (error) {
      return Promise.reject(error)
    }
  }

  // 检查登录状态，未登录则跳转到登录页
  function checkLogin() {
    if (!isLogin.value) {
      uni.navigateTo({
        url: '/user_package/pages/login/index'
      })
      return false
    }
    return true
  }

  // 获取用户房间列表并更新最大过期日期
  async function updateRoomList() {
    try {
      const res = await userApi.getUserRoomList(user_id.value)
      if (res.data && res.data.length > 0) {
        // 找出最大的expire_date
        const maxDate = res.data.reduce((max, room) => {
          return room.expire_date > max ? room.expire_date : max
        }, res.data[0].expire_date)
        maxExpireDate.value = maxDate
      }
      return Promise.resolve(res)
    } catch (error) {
      maxExpireDate.value = userInfo.value.expire_date
      return Promise.reject(error)
    }
  }

  // 登录成功
  async function loginSuccess(data) {
    userInfo.value = data
    user_id.value = data.user_id
    
    // 清空设备列表
    const deviceStore = useDeviceStore()
    deviceStore.clearDeviceList()
    
    try {
      // 登录成功后获取房间列表
      await updateRoomList()
      
      // 获取设备列表
      const res = await deviceApi.getDoorList(data.user_id)
      if (res.data) {
        deviceStore.setDeviceList(res.data)
      }
    } catch (error) {
      console.error('初始化数据失败:', error)
    }
  }

  // 退出登录
  function logout() {
    userInfo.value = {}
    user_id.value = ''
    // 清空设备列表
    const deviceStore = useDeviceStore()
    deviceStore.clearDeviceList()
  }

  const getUserRoomList = async () => {
    try {
      const res = await userApi.getUserRoomList(user_id.value)
      return res.data || []
    } catch (error) {
      console.error('获取房屋列表失败:', error)
      return []
    }
  }

  const bindUserRoom = async (params) => {
    return await userApi.bindUserRoom(params)
  }

  return {
    userInfo,
    user_id,
    maxExpireDate,
    login,
    loginSuccess,
    logout,
    avatarUrl,
    BASE_IMG_URL,
    isLogin,
    userName,
    userAcct,
    userId,
    checkLogin,
    updateRoomList,
    getUserRoomList,
    bindUserRoom
  }
}) 

// 使用例子
// const { proxy } = getCurrentInstance()
// const userStore = proxy.$store.user.useUserStore()

// // 登录成功时
// userStore.loginSuccess(userData)

// // 获取用户信息
// const userInfo = userStore.userInfo

// // 退出登录
// userStore.logout()

// const { proxy } = getCurrentInstance()
// const userStore = proxy.$store.user.useUserStore()

// // 获取用户名
// const userName = userStore.userName

// // 获取用户ID
// const userId = userStore.userId

// // 在template中使用
// <text>{{ userStore.userName }}</text>
// <text>{{ userStore.userId }}</text>


// const { proxy } = getCurrentInstance()
// const userStore = proxy.$store.user.useUserStore()

// // 在需要登录才能访问的页面或方法中
// function someAction() {
//   // 检查是否登录，未登录会自动跳转到登录页
//   if (!userStore.checkLogin()) {
//     return // 如果未登录，终止后续操作
//   }
  
//   // 已登录，继续执行相关操作
//   // ...
// }

// // 或者在页面加载时检查
// onLoad(() => {
//   userStore.checkLogin()
// })
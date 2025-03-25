import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import userApi from '@/api/user/user'
import deviceApi from '@/api/device/device' // 引入设备API
import { useDeviceStore } from './device'
import { useAdControlStore } from './adControl' // 引入广告控制 store

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

  // 获取用户卡号A
  const userCardA = computed(() => {
    return userInfo.value.user_card_a || '00000000'
  })

  // 获取用户卡号B
  const userCardB = computed(() => {
    return userInfo.value.user_card_b || '00000000'
  })

  // 判断是否登录
  const isLogin = computed(() => {
    return !!userInfo.value.user_acct && !! userInfo.value.user_password
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
  async function login(loginDataOrOptions = null, options = {}) {
    try {
      let loginData = null;
      let requestOptions = options;

      // 如果第一个参数是对象，且包含 showLoading，则它是 options
      if (loginDataOrOptions && 'showLoading' in loginDataOrOptions) {
        requestOptions = loginDataOrOptions;
      } else {
        loginData = loginDataOrOptions;
      }

      // 如果没有传入登录数据且userInfo中没有账号密码，直接返回
      if (!loginData && (!userInfo.value.user_acct || !userInfo.value.user_password)) {
        return Promise.reject('无登录数据')
      }
      
      // 使用传入的登录数据或userInfo中的账号密码
      const loginParams = loginData || {
        user_acct: userInfo.value.user_acct,
        user_password: userInfo.value.user_password
      }

      const res = await userApi.UserLogin(loginParams, requestOptions)
      
      // 登录成功,保存用户信息
      const userData = res.data[0]
      loginSuccess(userData, requestOptions)
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
  async function updateRoomList(options = {}) {
    try {
      const res = await userApi.getUserRoomList(user_id.value, options)
      if (res.data && res.data.length > 0) {
        // 找出最大的expire_date
        const maxDate = res.data.reduce((max, room) => {
          return room.expire_date > max ? room.expire_date : max
        }, res.data[0].expire_date)
        maxExpireDate.value = maxDate
      }
      console.log("更新房间列表", res)
      return Promise.resolve(res)
    } catch (error) {
      console.log("更新房间列表失败", error)
      maxExpireDate.value = userInfo.value.expire_date
      // 根据返回的 code 判断是否跳转到房屋申请页面
      if (error.code === '1') {
        uni.navigateTo({
          url: '/pages/house/apply'
        })
      }
      return Promise.reject(error)
    }
  }

  // 登录成功
  async function loginSuccess(data, options = {}) {
    userInfo.value = data
    user_id.value = data.user_id
    console.log("广告类型", userInfo.value.ad_type_app)

    // 获取广告控制 store
    const adControlStore = useAdControlStore()
    // 设置广告类型
    adControlStore.setAdType(userInfo.value.ad_type_app)

    // 清空设备列表
    const deviceStore = useDeviceStore()
    deviceStore.clearDeviceList()
    
    try {
      // 登录成功后获取房间列表
      await updateRoomList(options)
      
      // 获取设备列表
      const res = await deviceApi.getDoorList(data.user_id, options)
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

  // 注销账号
  async function deleteAccount() {
    try {
      // 调用注销账号的API
      const response = await userApi.deleteAccount(user_id.value);
    } catch (error) {
      console.error('注销账号失败:', error);
      console.error('注销账号失败:', error.code);
      // 检查响应的code
      if (error.code === '1') {
        // 清除本地数据
        logout();
        return Promise.resolve('成功');
      } else {
        console.error('注销账号失败:', response);
        return Promise.reject(new Error('注销账号失败'));
      }
    }
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

  // 设置账号
  function setUserAccount(account) {
    userInfo.value.user_acct = account
  }

  // 设置密码
  function setUserPassword(password) {
    userInfo.value.user_password = password
  }

  return {
    userInfo,
    user_id,
    maxExpireDate,
    login,
    loginSuccess,
    logout,
    deleteAccount,  // 导出注销方法
    avatarUrl,
    BASE_IMG_URL,
    isLogin,
    userName,
    userAcct,
    userId,
    checkLogin,
    updateRoomList,
    getUserRoomList,
    bindUserRoom,
    userCardA,
    userCardB,
    setUserAccount,  // 导出设置账号方法
    setUserPassword  // 导出设置密码方法
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
import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref({})
  const user_id = ref('')

  // 登录成功
  function loginSuccess(data) {
    userInfo.value = data
    user_id.value = data.user_id
  }

  // 退出登录
  function logout() {
    userInfo.value = {}
    user_id.value = ''
  }

  return {
    userInfo,
    user_id,
    loginSuccess,
    logout
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
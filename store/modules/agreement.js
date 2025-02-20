import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAgreementStore = defineStore('agreement', () => {
  const STORAGE_KEY = 'hasAgreedToPolicy'
  
  // 检查是否同意协议
  function checkAgreement() {
    return !!uni.getStorageSync(STORAGE_KEY)
  }

  // 设置同意状态
  function setAgreement(status = true) {
    uni.setStorageSync(STORAGE_KEY, status)
  }

  // 打开用户协议
  function openUserAgreement() {
    uni.navigateTo({ url: '/user_package/pages/agreement/user' })
  }

  // 打开隐私政策
  function openPrivacyPolicy() {
    uni.navigateTo({ url: '/user_package/pages/agreement/privacy' })
  }

  return {
    checkAgreement,
    setAgreement,
    openUserAgreement,
    openPrivacyPolicy
  }
}) 
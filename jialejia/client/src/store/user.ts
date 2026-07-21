import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  const token = ref(uni.getStorageSync('token') || '')
  const userInfo = ref(uni.getStorageSync('userInfo') ? JSON.parse(uni.getStorageSync('userInfo')) : null)

  const isLoggedIn = computed(() => !!token.value)
  const phone = computed(() => userInfo.value?.phone || '')

  function setToken(newToken: string) {
    token.value = newToken
    uni.setStorageSync('token', newToken)
  }

  function setUserInfo(info: any) {
    userInfo.value = info
    uni.setStorageSync('userInfo', JSON.stringify(info))
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    uni.removeStorageSync('token')
    uni.removeStorageSync('userInfo')
  }

  return { token, userInfo, isLoggedIn, phone, setToken, setUserInfo, logout }
})
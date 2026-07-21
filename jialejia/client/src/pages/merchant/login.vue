<template>
  <view class="merchant-login-page">
    <view class="login-box">
      <text class="login-title">商家登录</text>
      <input class="login-input" v-model="phone" placeholder="请输入手机号" type="number" maxlength="11" />
      <input class="login-input" v-model="password" placeholder="请输入密码" type="password" />
      <button class="login-btn" @click="handleLogin">登录</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import api from '@/api'

const phone = ref('')
const password = ref('')

async function handleLogin() {
  if (!phone.value || !password.value) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' })
    return
  }
  try {
    const res = await api.merchantLogin(phone.value, password.value)
    if (res.data) {
      uni.setStorageSync('merchant_token', res.data.token)
      uni.setStorageSync('merchant_info', JSON.stringify(res.data.merchant))
      uni.showToast({ title: '登录成功', icon: 'success' })
      uni.switchTab({ url: '/pages/merchant/promote' })
    }
  } catch (err) { console.error('登录失败', err) }
}
</script>

<style lang="scss" scoped>
.merchant-login-page {
  min-height: 100vh; background: #F5F5F5; display: flex; align-items: center; justify-content: center;
  .login-box {
    width: 80%; background: #FFF; border-radius: 24rpx; padding: 60rpx 40rpx;
    .login-title { font-size: 36rpx; font-weight: 600; color: #333; text-align: center; display: block; margin-bottom: 40rpx; }
    .login-input { padding: 24rpx; border-radius: 8rpx; background: #F5F5F5; margin-bottom: 20rpx; font-size: 28rpx; }
    .login-btn { margin-top: 30rpx; height: 88rpx; line-height: 88rpx; background: #1677FF; color: #FFF; border-radius: 44rpx; font-size: 30rpx; }
  }
}
</style>
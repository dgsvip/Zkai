<template>
  <view class="tech-login-page">
    <view class="login-box">
      <text class="login-title">师傅登录</text>
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
    const res = await api.technicianLogin(phone.value, password.value)
    if (res.data) {
      uni.setStorageSync('tech_token', res.data.token)
      uni.setStorageSync('tech_info', JSON.stringify(res.data.technician))
      uni.showToast({ title: '登录成功', icon: 'success' })
      uni.switchTab({ url: '/pages/technician/workOrders' })
    }
  } catch (err) {
    console.error('登录失败', err)
  }
}
</script>

<style lang="scss" scoped>
.tech-login-page {
  min-height: 100vh;
  background: #F5F5F5;
  display: flex;
  align-items: center;
  justify-content: center;
  .login-box {
    width: 80%;
    background: #FFFFFF;
    border-radius: 24rpx;
    padding: 60rpx 40rpx;
    .login-title { font-size: 36rpx; font-weight: 600; color: #333; text-align: center; display: block; margin-bottom: 40rpx; }
    .login-input {
      padding: 24rpx;
      border-radius: 8rpx;
      background: #F5F5F5;
      margin-bottom: 20rpx;
      font-size: 28rpx;
    }
    .login-btn {
      margin-top: 30rpx;
      height: 88rpx;
      line-height: 88rpx;
      background: #1677FF;
      color: #FFFFFF;
      border-radius: 44rpx;
      font-size: 30rpx;
    }
  }
}
</style>
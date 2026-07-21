<template>
  <view class="profile-page">
    <!-- 登录提示 -->
    <view v-if="!isLoggedIn" class="login-prompt" @click="goLogin">
      <view class="avatar-placeholder">
        <text class="avatar-icon">👤</text>
      </view>
      <text class="login-hint">点击登录/注册</text>
    </view>

    <!-- 用户信息 -->
    <view v-else class="user-info">
      <view class="avatar">
        <text class="avatar-icon">👤</text>
      </view>
      <text class="user-phone">{{ userStore.userInfo?.phone || '' }}</text>
      <text class="user-nickname">{{ userStore.userInfo?.nickname || '' }}</text>
    </view>

    <!-- 菜单列表 -->
    <view class="menu-list">
      <view class="menu-item" @click="goOrders">
        <text class="menu-icon">📋</text>
        <text class="menu-text">我的订单</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="goAddress">
        <text class="menu-icon">📍</text>
        <text class="menu-text">地址管理</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="goAnnouncements">
        <text class="menu-icon">📢</text>
        <text class="menu-text">历史公告</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="showAgreement('booking')">
        <text class="menu-icon">📄</text>
        <text class="menu-text">预约协议</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="showAgreement('service')">
        <text class="menu-icon">📄</text>
        <text class="menu-text">平台服务协议</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="callService">
        <text class="menu-icon">📞</text>
        <text class="menu-text">联系客服</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="showAbout">
        <text class="menu-icon">ℹ️</text>
        <text class="menu-text">关于我们</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <button v-if="isLoggedIn" class="logout-btn" @click="handleLogout">退出登录</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const isLoggedIn = ref(userStore.isLoggedIn)

onShow(() => {
  isLoggedIn.value = userStore.isLoggedIn
})

function goLogin() {
  uni.switchTab({ url: '/pages/user/orderList' })
}

function goOrders() {
  uni.switchTab({ url: '/pages/user/orderList' })
}

function goAddress() {
  uni.navigateTo({ url: '/pages/user/address' })
}

function goAnnouncements() {
  uni.navigateTo({ url: '/pages/user/announcement' })
}

function showAgreement(type: string) {
  uni.navigateTo({ url: `/pages/user/agreement?type=${type}` })
}

function callService() {
  uni.showActionSheet({
    itemList: ['拨打客服电话 400-000-0000', '在线反馈'],
    success: (res) => {
      if (res.tapIndex === 0) {
        uni.makePhoneCall({ phoneNumber: '400-000-0000' })
      } else {
        uni.showToast({ title: '客服功能开发中', icon: 'none' })
      }
    }
  })
}

function showAbout() {
  uni.showModal({
    title: '关于佳乐家',
    content: '佳乐家 v1.0.0\n山东省菏泽市曹县本地生活服务平台\n提供家电维修、水电暖通等上门服务',
    showCancel: false
  })
}

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        userStore.logout()
        isLoggedIn.value = false
        uni.showToast({ title: '已退出', icon: 'success' })
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
  background: #F5F5F5;
}

.login-prompt {
  padding: 80rpx 0;
  text-align: center;
  background: #FFFFFF;
  .avatar-placeholder {
    width: 120rpx;
    height: 120rpx;
    border-radius: 50%;
    background: #F0F0F0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20rpx;
    .avatar-icon { font-size: 60rpx; }
  }
  .login-hint {
    font-size: 28rpx;
    color: #1677FF;
  }
}

.user-info {
  padding: 60rpx 0;
  text-align: center;
  background: #FFFFFF;
  .avatar {
    width: 120rpx;
    height: 120rpx;
    border-radius: 50%;
    background: #E6F4FF;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16rpx;
    .avatar-icon { font-size: 60rpx; }
  }
  .user-phone { font-size: 28rpx; color: #333; display: block; }
  .user-nickname { font-size: 24rpx; color: #999; margin-top: 8rpx; display: block; }
}

.menu-list {
  margin: 20rpx 30rpx;
  background: #FFFFFF;
  border-radius: 16rpx;
  overflow: hidden;
  .menu-item {
    display: flex;
    align-items: center;
    padding: 28rpx 30rpx;
    border-bottom: 2rpx solid #F5F5F5;
    &:last-child { border-bottom: none; }
    .menu-icon { font-size: 32rpx; margin-right: 20rpx; }
    .menu-text { flex: 1; font-size: 28rpx; color: #333; }
    .menu-arrow { font-size: 32rpx; color: #CCC; }
  }
}

.logout-btn {
  margin: 60rpx 30rpx;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 40rpx;
  border: 2rpx solid #FF4D4F;
  color: #FF4D4F;
  background: #FFFFFF;
  font-size: 28rpx;
}
</style>
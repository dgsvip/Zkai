<template>
  <view class="tech-profile-page">
    <view class="profile-header">
      <view class="avatar">
        <text class="avatar-icon">👨‍🔧</text>
      </view>
      <text class="tech-name">{{ techInfo.name }}</text>
      <text class="tech-phone">{{ techInfo.phone }}</text>
      <text class="tech-region">{{ techInfo.region }}</text>
    </view>

    <view class="stats-grid">
      <view class="stat-card">
        <text class="stat-value">¥{{ techInfo.balance || 0 }}</text>
        <text class="stat-label">余额</text>
      </view>
      <view class="stat-card">
        <text class="stat-value">{{ techInfo.credit_score || 100 }}</text>
        <text class="stat-label">信用分</text>
      </view>
      <view class="stat-card">
        <text class="stat-value">{{ techInfo.rating_avg || 5.0 }}</text>
        <text class="stat-label">评分</text>
      </view>
      <view class="stat-card">
        <text class="stat-value">{{ techInfo.total_ratings || 0 }}</text>
        <text class="stat-label">评价数</text>
      </view>
    </view>

    <view class="menu-list">
      <view class="menu-item" @click="goHistory">
        <text class="menu-icon">📋</text>
        <text class="menu-text">历史订单</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="goBalance">
        <text class="menu-icon">💰</text>
        <text class="menu-text">收入明细</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="showRadius">
        <text class="menu-icon">🌐</text>
        <text class="menu-text">接单范围设置</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="goAnnouncements">
        <text class="menu-icon">📢</text>
        <text class="menu-text">历史公告</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="showAgreement">
        <text class="menu-icon">📄</text>
        <text class="menu-text">平台服务协议</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="callService">
        <text class="menu-icon">📞</text>
        <text class="menu-text">联系客服</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <button class="logout-btn" @click="handleLogout">退出登录</button>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api from '@/api'

const techInfo = ref<any>(JSON.parse(uni.getStorageSync('tech_info') || '{}'))

onShow(() => {
  loadProfile()
})

async function loadProfile() {
  try {
    const res = await api.getTechnicianProfile()
    if (res.data) {
      techInfo.value = res.data
      uni.setStorageSync('tech_info', JSON.stringify(res.data))
    }
  } catch (err) { console.error(err) }
}

function goHistory() { uni.navigateTo({ url: '/pages/technician/workOrders?type=history' }) }
function goBalance() { api.getTechnicianBalance().then(() => { uni.showToast({ title: '加载中', icon: 'none' }) }) }
function showRadius() {
  uni.showActionSheet({
    itemList: ['5公里', '10公里', '不限'],
    success: (res) => {
      const radius = [5, 10, 0][res.tapIndex]
      uni.showToast({ title: `已设置为${radius || 0}公里`, icon: 'success' })
    }
  })
}
function goAnnouncements() { uni.navigateTo({ url: '/pages/user/announcement' }) }
function showAgreement() { uni.navigateTo({ url: '/pages/user/agreement?type=service' }) }
function callService() { uni.makePhoneCall({ phoneNumber: '400-000-0000' }) }
function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出吗？',
    success: (res) => {
      if (res.confirm) {
        uni.removeStorageSync('tech_token')
        uni.removeStorageSync('tech_info')
        uni.redirectTo({ url: '/pages/technician/login' })
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.tech-profile-page {
  min-height: 100vh;
  background: #F5F5F5;
}

.profile-header {
  background: linear-gradient(135deg, #1677FF, #4096FF);
  padding: 60rpx 0;
  text-align: center;
  color: #FFFFFF;
  .avatar { width: 120rpx; height: 120rpx; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; margin: 0 auto 16rpx; .avatar-icon { font-size: 60rpx; } }
  .tech-name { font-size: 32rpx; font-weight: 600; display: block; }
  .tech-phone, .tech-region { font-size: 24rpx; opacity: 0.8; display: block; margin-top: 4rpx; }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
  margin: 20rpx 30rpx;
  .stat-card {
    background: #FFF;
    border-radius: 12rpx;
    padding: 20rpx;
    text-align: center;
    .stat-value { font-size: 28rpx; color: #333; font-weight: 600; display: block; }
    .stat-label { font-size: 22rpx; color: #999; display: block; margin-top: 4rpx; }
  }
}

.menu-list {
  margin: 20rpx 30rpx;
  background: #FFF;
  border-radius: 16rpx;
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
  background: #FFF;
  font-size: 28rpx;
}
</style>
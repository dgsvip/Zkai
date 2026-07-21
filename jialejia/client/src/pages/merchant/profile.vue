<template>
  <view class="merchant-profile-page">
    <view class="profile-header">
      <text class="merchant-name">{{ merchantInfo.name }}</text>
      <text class="merchant-contact">{{ merchantInfo.contact }} · {{ merchantInfo.phone }}</text>
      <text class="merchant-since">入驻时间: {{ merchantInfo.created_at || '' }}</text>
    </view>

    <view class="income-section">
      <text class="section-title">收益中心</text>
      <view class="income-grid">
        <view class="income-item">
          <text class="income-value">¥{{ income.balance || 0 }}</text>
          <text class="income-label">余额</text>
        </view>
        <view class="income-item">
          <text class="income-value">¥{{ income.total || 0 }}</text>
          <text class="income-label">累计介绍费</text>
        </view>
        <view class="income-item">
          <text class="income-value">¥{{ income.settled || 0 }}</text>
          <text class="income-label">已结算</text>
        </view>
        <view class="income-item">
          <text class="income-value">¥{{ income.pending || 0 }}</text>
          <text class="income-label">待结算</text>
        </view>
      </view>
      <button class="withdraw-btn" @click="showWithdraw">申请提现</button>
    </view>

    <view class="menu-list">
      <view class="menu-item" @click="downloadQR">
        <text class="menu-icon">📱</text>
        <text class="menu-text">推广二维码</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="showFAQ">
        <text class="menu-icon">❓</text>
        <text class="menu-text">常见问题</text>
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

const merchantInfo = ref<any>(JSON.parse(uni.getStorageSync('merchant_info') || '{}'))
const income = ref({ balance: 0, total: 0, settled: 0, pending: 0 })

onShow(() => {
  loadIncome()
})

async function loadIncome() {
  try {
    const res = await api.merchantGetIncome()
    if (res.data) income.value = res.data
  } catch (err) { console.error(err) }
}

function showWithdraw() {
  uni.showModal({
    title: '申请提现',
    content: '请输入提现金额',
    editable: true,
    success: async (res) => {
      if (res.confirm && res.content) {
        const amount = parseFloat(res.content)
        if (amount > 0) {
          try {
            await api.merchantWithdraw(amount)
            uni.showToast({ title: '提现申请已提交', icon: 'success' })
          } catch (err) { console.error(err) }
        }
      }
    }
  })
}

function downloadQR() { uni.showToast({ title: '功能开发中', icon: 'none' }) }
function showFAQ() { uni.showToast({ title: '常见问题功能开发中', icon: 'none' }) }
function goAnnouncements() { uni.navigateTo({ url: '/pages/user/announcement' }) }
function showAgreement() { uni.navigateTo({ url: '/pages/user/agreement?type=service' }) }
function callService() { uni.makePhoneCall({ phoneNumber: '400-000-0000' }) }
function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出吗？',
    success: (res) => {
      if (res.confirm) {
        uni.removeStorageSync('merchant_token')
        uni.removeStorageSync('merchant_info')
        uni.redirectTo({ url: '/pages/merchant/login' })
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.merchant-profile-page {
  min-height: 100vh; background: #F5F5F5;
  .profile-header { background: linear-gradient(135deg, #1677FF, #4096FF); padding: 50rpx 30rpx; color: #FFF; .merchant-name { font-size: 32rpx; font-weight: 600; display: block; } .merchant-contact, .merchant-since { font-size: 24rpx; opacity: 0.8; display: block; margin-top: 4rpx; } }
  .income-section { background: #FFF; margin: 20rpx 30rpx; border-radius: 16rpx; padding: 30rpx; .section-title { font-size: 28rpx; font-weight: 500; color: #333; display: block; margin-bottom: 20rpx; } .income-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20rpx; .income-item { text-align: center; .income-value { font-size: 32rpx; color: #333; font-weight: 600; display: block; } .income-label { font-size: 22rpx; color: #999; display: block; margin-top: 4rpx; } } } .withdraw-btn { margin-top: 20rpx; height: 72rpx; line-height: 72rpx; background: #1677FF; color: #FFF; border-radius: 36rpx; font-size: 28rpx; } }
  .menu-list { margin: 20rpx 30rpx; background: #FFF; border-radius: 16rpx; .menu-item { display: flex; align-items: center; padding: 28rpx 30rpx; border-bottom: 2rpx solid #F5F5F5; &:last-child { border-bottom: none; } .menu-icon { font-size: 32rpx; margin-right: 20rpx; } .menu-text { flex: 1; font-size: 28rpx; color: #333; } .menu-arrow { font-size: 32rpx; color: #CCC; } } }
  .logout-btn { margin: 60rpx 30rpx; height: 80rpx; line-height: 80rpx; border-radius: 40rpx; border: 2rpx solid #FF4D4F; color: #FF4D4F; background: #FFF; font-size: 28rpx; }
}
</style>
<template>
  <view class="promote-page">
    <view class="merchant-info">
      <text class="merchant-name">{{ merchantInfo.name }}</text>
      <text class="merchant-contact">{{ merchantInfo.contact }} · {{ merchantInfo.phone }}</text>
    </view>

    <view class="reward-info">
      <text class="reward-title">奖励规则</text>
      <text class="reward-detail">当前介绍费比例: {{ merchantInfo.referral_rate || 3 }}%</text>
    </view>

    <view class="qrcode-section">
      <text class="section-title">推广二维码</text>
      <view class="qrcode-placeholder">
        <text class="qrcode-icon">📱</text>
        <text class="qrcode-hint">点击生成推广二维码</text>
      </view>
      <view class="qrcode-actions">
        <button class="action-btn" @click="copyLink">复制链接</button>
        <button class="action-btn" @click="shareLink">一键分享</button>
      </view>
    </view>

    <view class="stats-section">
      <text class="section-title">推广数据</text>
      <view class="stats-grid">
        <view class="stat-item">
          <text class="stat-value">{{ statistics.total || 0 }}</text>
          <text class="stat-label">总下单数</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">¥{{ statistics.total_fee || 0 }}</text>
          <text class="stat-label">成交总额</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ statistics.month_total || 0 }}</text>
          <text class="stat-label">本月单数</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">¥{{ statistics.month_fee || 0 }}</text>
          <text class="stat-label">本月介绍费</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api from '@/api'

const merchantInfo = ref<any>(JSON.parse(uni.getStorageSync('merchant_info') || '{}'))
const statistics = ref({ total: 0, total_fee: 0, month_total: 0, month_fee: 0 })

onShow(() => {
  loadStatistics()
  checkLogin()
})

function checkLogin() {
  if (!uni.getStorageSync('merchant_token')) {
    uni.redirectTo({ url: '/pages/merchant/login' })
  }
}

async function loadStatistics() {
  try {
    const res = await api.merchantGetStatistics()
    if (res.data) statistics.value = res.data
  } catch (err) { console.error(err) }
}

function copyLink() {
  uni.setClipboardData({ data: 'https://jialejia.com/promote/' + merchantInfo.value.id })
  uni.showToast({ title: '链接已复制', icon: 'success' })
}

function shareLink() {
  uni.showToast({ title: '分享功能开发中', icon: 'none' })
}
</script>

<style lang="scss" scoped>
.promote-page {
  min-height: 100vh; background: #F5F5F5;
  .merchant-info { background: linear-gradient(135deg, #1677FF, #4096FF); padding: 40rpx 30rpx; color: #FFF; .merchant-name { font-size: 32rpx; font-weight: 600; display: block; } .merchant-contact { font-size: 24rpx; opacity: 0.8; margin-top: 8rpx; display: block; } }
  .reward-info { background: #FFF; margin: 20rpx 30rpx; border-radius: 16rpx; padding: 24rpx; .reward-title { font-size: 28rpx; font-weight: 500; color: #333; display: block; } .reward-detail { font-size: 24rpx; color: #FAAD14; margin-top: 8rpx; display: block; } }
  .qrcode-section { background: #FFF; margin: 20rpx 30rpx; border-radius: 16rpx; padding: 30rpx; .section-title { font-size: 28rpx; font-weight: 500; color: #333; display: block; margin-bottom: 20rpx; } .qrcode-placeholder { text-align: center; padding: 40rpx; border: 2rpx dashed #D9D9D9; border-radius: 12rpx; .qrcode-icon { font-size: 60rpx; display: block; } .qrcode-hint { font-size: 24rpx; color: #999; margin-top: 12rpx; display: block; } } .qrcode-actions { display: flex; gap: 16rpx; margin-top: 20rpx; .action-btn { flex: 1; height: 64rpx; line-height: 64rpx; border-radius: 32rpx; border: 2rpx solid #1677FF; color: #1677FF; background: #FFF; font-size: 26rpx; } } }
  .stats-section { background: #FFF; margin: 20rpx 30rpx; border-radius: 16rpx; padding: 30rpx; .section-title { font-size: 28rpx; font-weight: 500; color: #333; display: block; margin-bottom: 20rpx; } .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20rpx; .stat-item { text-align: center; .stat-value { font-size: 32rpx; color: #333; font-weight: 600; display: block; } .stat-label { font-size: 22rpx; color: #999; display: block; margin-top: 4rpx; } } } }
}
</style>
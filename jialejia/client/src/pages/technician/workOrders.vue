<template>
  <view class="work-orders-page">
    <!-- 顶部信息卡 -->
    <view class="tech-header">
      <view class="tech-info">
        <text class="tech-name">{{ techInfo.name || '未登录' }}</text>
        <text class="tech-region">{{ techInfo.region || '' }}</text>
      </view>
      <view class="tech-stats">
        <view class="stat-item">
          <text class="stat-value">¥{{ techInfo.balance || 0 }}</text>
          <text class="stat-label">余额</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ todayStats.income || 0 }}</text>
          <text class="stat-label">今日收入</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ todayStats.total || 0 }}</text>
          <text class="stat-label">今日接单</text>
        </view>
      </view>
      <view class="busy-toggle">
        <text class="busy-label">忙碌</text>
        <switch :checked="isBusy" @change="toggleBusy" color="#1677FF" />
      </view>
    </view>

    <!-- Tab切换 -->
    <view class="tab-bar">
      <view v-for="tab in tabs" :key="tab.key" class="tab-item" :class="{ active: currentTab === tab.key }" @click="switchTab(tab.key)">
        <text>{{ tab.label }}</text>
        <text v-if="tab.count" class="tab-badge">{{ tab.count }}</text>
      </view>
    </view>

    <!-- 工单列表 -->
    <scroll-view scroll-y class="order-list" @scrolltolower="loadMore">
      <view v-for="order in orders" :key="order.id" class="order-card" :class="{ overdue: isOverdue(order) }">
        <view class="card-top">
          <text class="service-tag">{{ order.service_name }}</text>
          <text class="source-tag">{{ sourceText(order.source) }}</text>
        </view>
        <view class="card-address">📍 {{ order.customer_address }}</view>
        <view class="card-contact">
          <text>{{ order.customer_name }}</text>
          <text class="contact-phone" @click="callPhone(order.customer_phone)">📞 {{ order.customer_phone }}</text>
        </view>
        <view class="card-time">预约: {{ order.appointment_date }} {{ order.appointment_time }}</view>
        <view v-if="order.remark" class="card-remark">📝 {{ order.remark }}</view>

        <view class="card-actions">
          <button v-if="canAccept(order)" class="action-btn primary" @click="acceptOrder(order.order_no)">接单</button>
          <button v-else-if="order.status === 'assigned' || order.status === 'processing'" class="action-btn">进行中</button>
        </view>
      </view>
      <view v-if="orders.length === 0" class="empty-state">
        <text>暂无工单</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api from '@/api'

const techInfo = ref<any>(JSON.parse(uni.getStorageSync('tech_info') || '{}'))
const isBusy = ref(false)
const todayStats = ref({ total: 0, completed: 0, income: 0 })
const currentTab = ref('region')
const orders = ref<any[]>([])
const page = ref(1)

const tabs = [
  { key: 'region', label: '区域单', count: 0 },
  { key: 'pool', label: '抢单池', count: 0 },
  { key: 'processing', label: '进行中', count: 0 },
  { key: 'history', label: '历史', count: 0 },
]

onShow(() => {
  checkLogin()
  loadOrders()
  loadStatistics()
})

function checkLogin() {
  const token = uni.getStorageSync('tech_token')
  if (!token) {
    uni.redirectTo({ url: '/pages/technician/login' })
  }
}

function canAccept(order: any) {
  return order.status === 'pending' && !isBusy.value
}

function isOverdue(order: any) {
  return order.status === 'assigned' && order.created_at && (Date.now() - new Date(order.created_at).getTime()) > 2 * 24 * 60 * 60 * 1000
}

function sourceText(source: string) {
  const map: Record<string, string> = { user: '用户自报', merchant: '商家代报', self: '自建' }
  return map[source] || source
}

async function loadOrders() {
  try {
    const res = await api.getTechnicianOrders({ type: currentTab.value, page: page.value })
    if (res.data) orders.value = res.data.list || []
  } catch (err) { console.error(err) }
}

async function loadStatistics() {
  try {
    const res = await api.getTechnicianStatistics()
    if (res.data) todayStats.value = res.data
  } catch (err) { console.error(err) }
}

function switchTab(key: string) {
  currentTab.value = key
  page.value = 1
  loadOrders()
}

function loadMore() {
  page.value++
  loadOrders()
}

async function acceptOrder(orderNo: string) {
  try {
    await api.acceptOrder(orderNo)
    uni.showToast({ title: '接单成功', icon: 'success' })
    loadOrders()
  } catch (err) { console.error(err) }
}

async function toggleBusy(e: any) {
  isBusy.value = e.detail.value
  try {
    await api.toggleBusy(isBusy.value)
  } catch (err) { console.error(err) }
}

function callPhone(phone: string) {
  if (phone) uni.makePhoneCall({ phoneNumber: phone })
}
</script>

<style lang="scss" scoped>
.work-orders-page {
  min-height: 100vh;
  background: #F5F5F5;
}

.tech-header {
  background: linear-gradient(135deg, #1677FF, #4096FF);
  padding: 30rpx;
  color: #FFFFFF;
  .tech-info {
    display: flex;
    align-items: center;
    margin-bottom: 20rpx;
    .tech-name { font-size: 32rpx; font-weight: 600; }
    .tech-region { font-size: 24rpx; margin-left: 16rpx; opacity: 0.8; }
  }
  .tech-stats {
    display: flex;
    gap: 40rpx;
    .stat-item { text-align: center; .stat-value { font-size: 28rpx; font-weight: 600; display: block; } .stat-label { font-size: 22rpx; opacity: 0.8; } }
  }
  .busy-toggle { display: flex; align-items: center; margin-top: 16rpx; .busy-label { font-size: 24rpx; margin-right: 16rpx; } }
}

.tab-bar {
  display: flex;
  background: #FFFFFF;
  padding: 0 20rpx;
  .tab-item {
    padding: 20rpx 24rpx;
    font-size: 26rpx;
    color: #666;
    position: relative;
    &.active { color: #1677FF; font-weight: 500; &::after { content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 40rpx; height: 4rpx; background: #1677FF; border-radius: 2rpx; } }
    .tab-badge { background: #FF4D4F; color: #FFF; font-size: 20rpx; padding: 2rpx 10rpx; border-radius: 20rpx; margin-left: 6rpx; }
  }
}

.order-list { height: calc(100vh - 400rpx); padding: 16rpx 20rpx; }

.order-card {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  &.overdue { border: 2rpx solid #FF4D4F; }
  .card-top { display: flex; justify-content: space-between; margin-bottom: 12rpx; .service-tag { font-size: 26rpx; color: #1677FF; font-weight: 500; } .source-tag { font-size: 22rpx; color: #999; } }
  .card-address { font-size: 28rpx; color: #333; font-weight: 500; margin-bottom: 8rpx; }
  .card-contact { display: flex; justify-content: space-between; margin-bottom: 8rpx; font-size: 26rpx; color: #333; .contact-phone { color: #1677FF; } }
  .card-time { font-size: 24rpx; color: #666; margin-bottom: 8rpx; }
  .card-remark { font-size: 24rpx; color: #666; background: #F5F5F5; padding: 12rpx; border-radius: 8rpx; margin-bottom: 12rpx; }
  .card-actions { display: flex; gap: 16rpx; .action-btn { flex: 1; height: 64rpx; line-height: 64rpx; border-radius: 32rpx; font-size: 26rpx; border: 2rpx solid #D9D9D9; color: #666; background: #FFF; text-align: center; &.primary { background: #1677FF; color: #FFF; border-color: #1677FF; } } }
}

.empty-state { text-align: center; padding: 100rpx 0; color: #999; font-size: 28rpx; }
</style>
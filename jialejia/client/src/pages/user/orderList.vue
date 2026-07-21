<template>
  <view class="order-list-page">
    <!-- 登录提示 -->
    <view v-if="!isLoggedIn" class="login-prompt">
      <text class="login-text">请输入手机号查看订单</text>
      <view class="login-form">
        <input class="phone-input" v-model="phone" placeholder="请输入手机号" type="number" maxlength="11" />
        <view class="code-row">
          <input class="code-input" v-model="code" placeholder="验证码" type="number" maxlength="4" />
          <button class="code-btn" :disabled="codeSending" @click="sendCode">
            {{ codeSending ? `${countdown}s` : '获取验证码' }}
          </button>
        </view>
        <button class="login-btn" @click="handleLogin">登录查看</button>
      </view>
    </view>

    <!-- 订单列表 -->
    <view v-else class="order-content">
      <view class="tab-bar">
        <view
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-item"
          :class="{ active: currentTab === tab.key }"
          @click="switchTab(tab.key)"
        >
          <text>{{ tab.label }}</text>
        </view>
      </view>

      <scroll-view scroll-y class="order-list" @scrolltolower="loadMore">
        <view v-for="order in orders" :key="order.id" class="order-card" @click="goDetail(order.order_no)">
          <view class="order-header">
            <text class="order-no">#{{ order.order_no }}</text>
            <text class="order-status" :class="'status-' + order.status">{{ getStatusText(order.status) }}</text>
          </view>
          <view class="order-body">
            <text class="order-service">{{ order.service_name }}</text>
            <text class="order-time">{{ order.appointment_date }} {{ order.appointment_time }}</text>
            <text class="order-address">{{ order.customer_address }}</text>
          </view>
          <view v-if="order.technician_id" class="order-footer">
            <text class="technician-info">师傅：{{ order.technician_name || '' }}</text>
          </view>
        </view>
        <view v-if="orders.length === 0" class="empty-state">
          <text class="empty-text">暂无订单</text>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api from '@/api'
import { useUserStore } from '@/store/user'
import { getStatusText } from '@/utils'

const userStore = useUserStore()
const isLoggedIn = ref(userStore.isLoggedIn)
const phone = ref('')
const code = ref('')
const codeSending = ref(false)
const countdown = ref(60)
let timer: any = null

const tabs = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待接单' },
  { key: 'assigned', label: '进行中' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' }
]
const currentTab = ref('')
const orders = ref<any[]>([])
const page = ref(1)

onShow(() => {
  isLoggedIn.value = userStore.isLoggedIn
  if (isLoggedIn.value) loadOrders()
})

async function sendCode() {
  if (!/^1\d{10}$/.test(phone.value)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }
  codeSending.value = true
  try {
    await api.sendCode(phone.value)
    uni.showToast({ title: '验证码已发送', icon: 'success' })
    timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(timer)
        codeSending.value = false
        countdown.value = 60
      }
    }, 1000)
  } catch {
    codeSending.value = false
  }
}

async function handleLogin() {
  if (!/^1\d{10}$/.test(phone.value)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }
  if (!code.value) {
    uni.showToast({ title: '请输入验证码', icon: 'none' })
    return
  }
  try {
    const res = await api.login(phone.value, code.value)
    if (res.data) {
      userStore.setToken(res.data.token)
      userStore.setUserInfo(res.data.user)
      isLoggedIn.value = true
      loadOrders()
    }
  } catch (err) {
    console.error('登录失败', err)
  }
}

async function loadOrders() {
  try {
    const res = await api.getOrders({ status: currentTab.value || undefined, page: page.value })
    if (res.data) orders.value = res.data.list || []
  } catch (err) {
    console.error('加载订单失败', err)
  }
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

function goDetail(orderNo: string) {
  uni.navigateTo({ url: `/pages/user/orderDetail?orderNo=${orderNo}` })
}
</script>

<style lang="scss" scoped>
.order-list-page {
  min-height: 100vh;
  background: #F5F5F5;
}

.login-prompt {
  padding: 60rpx;
  text-align: center;
  .login-text {
    font-size: 32rpx;
    color: #333;
    font-weight: 500;
  }
  .login-form {
    margin-top: 40rpx;
    text-align: left;
  }
  .phone-input, .code-input {
    padding: 20rpx 24rpx;
    border-radius: 8rpx;
    background: #FFFFFF;
    border: 2rpx solid #E8E8E8;
    font-size: 28rpx;
    width: 100%;
    box-sizing: border-box;
  }
  .code-row {
    display: flex;
    gap: 16rpx;
    margin-top: 20rpx;
    .code-input { flex: 1; }
    .code-btn {
      width: 200rpx;
      height: 80rpx;
      line-height: 80rpx;
      font-size: 24rpx;
      background: #1677FF;
      color: #FFFFFF;
      border-radius: 8rpx;
    }
  }
  .login-btn {
    margin-top: 40rpx;
    height: 88rpx;
    line-height: 88rpx;
    background: #1677FF;
    color: #FFFFFF;
    border-radius: 44rpx;
    font-size: 30rpx;
    width: 100%;
  }
}

.tab-bar {
  display: flex;
  background: #FFFFFF;
  padding: 0 30rpx;
  border-bottom: 2rpx solid #F0F0F0;
  .tab-item {
    padding: 24rpx 30rpx;
    font-size: 28rpx;
    color: #666;
    position: relative;
    &.active {
      color: #1677FF;
      font-weight: 500;
      &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 40rpx;
        height: 4rpx;
        background: #1677FF;
        border-radius: 2rpx;
      }
    }
  }
}

.order-list {
  height: calc(100vh - 180rpx);
  padding: 20rpx 30rpx;
}

.order-card {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  .order-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16rpx;
    .order-no { font-size: 24rpx; color: #999; }
    .order-status { font-size: 24rpx; font-weight: 500; }
  }
  .order-body {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
    .order-service { font-size: 28rpx; color: #333; font-weight: 500; }
    .order-time, .order-address { font-size: 24rpx; color: #666; }
  }
  .order-footer {
    margin-top: 16rpx;
    padding-top: 16rpx;
    border-top: 2rpx solid #F0F0F0;
    .technician-info { font-size: 24rpx; color: #1677FF; }
  }
}

.empty-state {
  padding: 100rpx 0;
  text-align: center;
  .empty-text { font-size: 28rpx; color: #999; }
}
</style>
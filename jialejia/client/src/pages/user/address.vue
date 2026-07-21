<template>
  <view class="address-page">
    <view v-for="(addr, i) in addressList" :key="i" class="address-card">
      <view class="address-info">
        <text class="address-text">{{ addr }}</text>
      </view>
      <view class="address-actions">
        <text class="action-btn" @click="deleteAddress(i)">删除</text>
      </view>
    </view>
    <view class="add-address" @click="showAddDialog">
      <text class="add-icon">+</text>
      <text>添加新地址</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/api'

const addressList = ref<string[]>([])

onMounted(async () => {
  try {
    const res = await api.getUserProfile()
    if (res.data?.address) {
      try { addressList.value = JSON.parse(res.data.address) } catch { addressList.value = [] }
    }
  } catch (err) { console.error(err) }
})

async function saveAddresses() {
  await api.getUserProfile() // refresh
  const res = await api.getUserProfile()
  if (res.data) {
    // save via PUT profile
  }
}

function deleteAddress(index: number) {
  uni.showModal({
    title: '删除地址',
    content: '确定要删除此地址吗？',
    success: async (res) => {
      if (res.confirm) {
        addressList.value.splice(index, 1)
        await api['getUserProfile']() // placeholder
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    }
  })
}

function showAddDialog() {
  uni.showModal({
    title: '添加地址',
    content: '请输入地址',
    editable: true,
    success: async (res) => {
      if (res.confirm && res.content) {
        addressList.value.push(res.content)
        uni.showToast({ title: '添加成功', icon: 'success' })
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.address-page {
  padding: 20rpx 30rpx;
  .address-card {
    background: #FFFFFF;
    border-radius: 16rpx;
    padding: 24rpx;
    margin-bottom: 16rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
    .address-text { font-size: 26rpx; color: #333; }
    .action-btn { font-size: 24rpx; color: #FF4D4F; }
  }
  .add-address {
    background: #FFFFFF;
    border-radius: 16rpx;
    padding: 30rpx;
    text-align: center;
    border: 2rpx dashed #D9D9D9;
    font-size: 28rpx;
    color: #1677FF;
    .add-icon { font-size: 32rpx; margin-right: 8rpx; }
  }
}
</style>
<template>
  <view class="announcement-page">
    <view v-for="item in list" :key="item.id" class="announcement-card" @click="goDetail(item.id)">
      <view class="card-header">
        <text class="card-title">{{ item.title }}</text>
        <text v-if="item.is_pinned" class="pinned-tag">置顶</text>
      </view>
      <text class="card-time">{{ item.created_at }}</text>
      <text class="card-reads">已读 {{ item.read_count }}</text>
    </view>
    <view v-if="list.length === 0" class="empty-state">
      <text>暂无公告</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/api'

const list = ref<any[]>([])

onMounted(async () => {
  try {
    const res = await api.getAnnouncements()
    if (res.data) list.value = res.data.list || []
  } catch (err) { console.error(err) }
})

function goDetail(id: number) {
  uni.showLoading({ title: '加载中' })
  api.getAnnouncementDetail(id).then(res => {
    uni.hideLoading()
    if (res.data) {
      uni.showModal({
        title: res.data.title,
        content: res.data.content,
        showCancel: false,
        confirmText: '关闭'
      })
    }
  })
}
</script>

<style lang="scss" scoped>
.announcement-page {
  padding: 20rpx 30rpx;
  .announcement-card {
    background: #FFFFFF;
    border-radius: 16rpx;
    padding: 24rpx;
    margin-bottom: 16rpx;
    .card-header {
      display: flex;
      align-items: center;
      margin-bottom: 8rpx;
      .card-title { font-size: 28rpx; color: #333; font-weight: 500; flex: 1; }
      .pinned-tag { font-size: 22rpx; color: #FF4D4F; border: 2rpx solid #FF4D4F; border-radius: 4rpx; padding: 2rpx 8rpx; }
    }
    .card-time { font-size: 22rpx; color: #999; }
    .card-reads { font-size: 22rpx; color: #999; margin-left: 16rpx; }
  }
  .empty-state { text-align: center; padding: 100rpx 0; color: #999; font-size: 28rpx; }
}
</style>
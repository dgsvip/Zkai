<template>
  <view class="booking-page">
    <!-- 顶部横幅 -->
    <view class="banner">
      <text class="banner-text">山东省菏泽市曹县 · 全区域覆盖</text>
    </view>

    <!-- 公告滚动条 -->
    <view class="announcement-bar" @click="goAnnouncements">
      <text class="announcement-icon">📢</text>
      <swiper class="announcement-swiper" vertical autoplay circular interval="3000">
        <swiper-item v-for="item in announcements" :key="item.id">
          <text class="announcement-text">{{ item.title }}</text>
        </swiper-item>
      </swiper>
      <text class="announcement-arrow">›</text>
    </view>

    <scroll-view scroll-y class="main-content">
      <!-- 第一步：选择服务 -->
      <view class="section">
        <view class="section-title">第一步：选择服务</view>
        <scroll-view scroll-x class="category-tabs">
          <view
            v-for="cat in categories"
            :key="cat.id"
            class="category-tab"
            :class="{ active: selectedCategory === cat.id }"
            @click="selectCategory(cat.id)"
          >
            <text class="category-icon">{{ cat.icon }}</text>
            <text class="category-name">{{ cat.name }}</text>
          </view>
        </scroll-view>

        <view class="service-grid">
          <view
            v-for="item in serviceItems"
            :key="item.id"
            class="service-item"
            :class="{ selected: selectedService === item.id }"
            @click="selectService(item)"
          >
            <text class="service-name">{{ item.name }}</text>
            <text class="service-price">¥{{ item.price_min }}起</text>
            <text class="service-rating" v-if="item.rating_avg">⭐ {{ item.rating_avg }}</text>
          </view>
          <view v-if="serviceItems.length === 0" class="empty-service">
            <text>暂无服务项目</text>
          </view>
        </view>
      </view>

      <!-- 第二步：选择时间 -->
      <view class="section">
        <view class="section-title">第二步：选择时间</view>
        <scroll-view scroll-x class="date-tabs">
          <view
            v-for="(d, i) in dateList"
            :key="i"
            class="date-tab"
            :class="{ active: selectedDate === d.value }"
            @click="selectedDate = d.value"
          >
            <text class="date-week">{{ d.week }}</text>
            <text class="date-day">{{ d.day }}</text>
          </view>
        </scroll-view>

        <view class="time-grid">
          <view
            v-for="t in timeSlots"
            :key="t"
            class="time-slot"
            :class="{ disabled: t.disabled, active: selectedTime === t.value }"
            @click="selectTime(t)"
          >
            <text>{{ t.value }}</text>
          </view>
        </view>
      </view>

      <!-- 第三步：服务地址 -->
      <view class="section">
        <view class="section-title">第三步：服务地址</view>
        <view class="address-row">
          <picker mode="selector" :range="regionList" @change="onRegionChange">
            <view class="region-picker">
              <text>{{ selectedRegion || '选择街道/乡镇' }}</text>
              <text class="picker-arrow">▼</text>
            </view>
          </picker>
          <input
            class="address-input"
            v-model="addressDetail"
            placeholder="门牌号/小区名（选填）"
          />
        </view>
      </view>

      <!-- 第四步：填写联系人 -->
      <view class="section">
        <view class="section-title">第四步：填写联系人</view>
        <input class="form-input" v-model="customerName" placeholder="姓名（必填）" />
        <input class="form-input" v-model="customerPhone" placeholder="电话（必填）" type="number" maxlength="11" />
        <textarea class="form-textarea" v-model="remark" placeholder="备注（选填）" />
      </view>

      <!-- 第五步：协议确认 -->
      <view class="section agreement-section">
        <label class="agreement-checkbox" @click="toggleAgreement">
          <text class="checkbox-icon" :class="{ checked: agreed }">✓</text>
          <text class="agreement-text">我已阅读并同意</text>
          <text class="agreement-link" @click.stop="showAgreement('booking')">《预约协议》</text>
          <text class="agreement-text">和</text>
          <text class="agreement-link" @click.stop="showAgreement('service')">《平台服务协议》</text>
        </label>
      </view>

      <!-- 提交按钮 -->
      <button
        class="submit-btn"
        :class="{ disabled: !canSubmit }"
        :disabled="!canSubmit"
        @click="submitOrder"
      >
        立即预约
      </button>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api from '@/api'
import { getDaysAfterToday, getWeekDay } from '@/utils'

const categories = ref<any[]>([])
const serviceItems = ref<any[]>([])
const announcements = ref<any[]>([])
const selectedCategory = ref<number | null>(null)
const selectedService = ref<number | null>(null)
const selectedServiceName = ref('')
const selectedDate = ref('')
const selectedTime = ref('')
const selectedRegion = ref('')
const addressDetail = ref('')
const customerName = ref('')
const customerPhone = ref('')
const remark = ref('')
const agreed = ref(false)
const submitting = ref(false)

const regionList = [
  '磐石街道', '曹城街道', '青菏街道', '郑庄街道', '倪集街道',
  '庄寨镇', '普连集镇', '古营集镇', '侯集镇', '苏集镇',
  '孙老家镇', '阎店楼镇', '梁堤头镇', '安蔡楼镇', '大集镇',
  '王集镇', '楼庄镇', '韩集镇', '砖庙镇', '常乐集镇',
  '魏湾镇', '仵楼镇', '邵庄镇', '朱洪庙镇', '其他（手动输入）'
]

const dateList = computed(() => {
  const list = []
  for (let i = 0; i < 7; i++) {
    const date = getDaysAfterToday(i + 1)
    list.push({ value: date, week: getWeekDay(date), day: date.slice(5) })
  }
  return list
})

const timeSlots = computed(() => {
  const slots = []
  const now = new Date()
  for (let h = 8; h <= 18; h++) {
    const t1 = `${String(h).padStart(2, '0')}:00`
    const t2 = `${String(h).padStart(2, '0')}:30`
    const isToday = selectedDate.value === getDaysAfterToday(0)
    slots.push({ value: t1, disabled: isToday && `${h}:00` <= `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}` })
    if (h < 18) {
      slots.push({ value: t2, disabled: isToday && `${h}:30` <= `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}` })
    }
  }
  return slots
})

const canSubmit = computed(() =>
  selectedService.value && selectedDate.value && selectedTime.value &&
  (selectedRegion.value || addressDetail.value) && customerName.value.length >= 2 &&
  /^1\d{10}$/.test(customerPhone.value) && agreed.value
)

onMounted(async () => {
  await loadCategories()
  await loadAnnouncements()
  selectedDate.value = getDaysAfterToday(1)
})

onShow(() => {
  // 检查协议版本
  checkAgreementVersion()
})

async function loadCategories() {
  const res = await api.getCategories()
  if (res.data) {
    categories.value = res.data
    if (res.data.length > 0) {
      selectedCategory.value = res.data[0].id
      await loadServiceItems(res.data[0].id)
    }
  }
}

async function loadServiceItems(categoryId: number) {
  const res = await api.getServiceItems(categoryId)
  if (res.data) serviceItems.value = res.data
}

async function loadAnnouncements() {
  const res = await api.getAnnouncements()
  if (res.data) announcements.value = res.data.list?.slice(0, 5) || []
}

function selectCategory(id: number) {
  selectedCategory.value = id
  selectedService.value = null
  loadServiceItems(id)
}

function selectService(item: any) {
  selectedService.value = item.id
  selectedServiceName.value = item.name
}

function selectTime(t: any) {
  if (t.disabled) return
  selectedTime.value = t.value
}

function onRegionChange(e: any) {
  selectedRegion.value = regionList[e.detail.value]
}

function toggleAgreement() {
  agreed.value = !agreed.value
}

function showAgreement(type: string) {
  uni.navigateTo({ url: `/pages/user/agreement?type=${type}` })
}

async function checkAgreementVersion() {
  // TODO: 检查协议版本号，如有更新弹出确认
}

async function submitOrder() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    const address = selectedRegion.value ? `${selectedRegion.value} ${addressDetail.value}` : addressDetail.value
    const res = await api.createOrder({
      service_item_id: selectedService.value,
      service_name: selectedServiceName.value,
      customer_name: customerName.value,
      customer_phone: customerPhone.value,
      customer_address: address,
      appointment_date: selectedDate.value,
      appointment_time: selectedTime.value,
      remark: remark.value || undefined
    })
    if (res.data?.order_no) {
      uni.showToast({ title: '预约成功', icon: 'success' })
      uni.switchTab({ url: '/pages/user/orderList' })
    }
  } catch (err) {
    console.error('下单失败', err)
  } finally {
    submitting.value = false
  }
}

function goAnnouncements() {
  uni.navigateTo({ url: '/pages/user/announcement' })
}
</script>

<style lang="scss" scoped>
.booking-page {
  min-height: 100vh;
  background: #F5F5F5;
  padding-bottom: 120rpx;
}

.banner {
  background: linear-gradient(135deg, #1677FF, #4096FF);
  padding: 20rpx 30rpx;
  .banner-text {
    color: #FFFFFF;
    font-size: 26rpx;
    text-align: center;
    display: block;
  }
}

.announcement-bar {
  background: #FFFBE6;
  padding: 16rpx 30rpx;
  display: flex;
  align-items: center;
  .announcement-icon { font-size: 28rpx; margin-right: 16rpx; }
  .announcement-swiper {
    flex: 1;
    height: 40rpx;
  }
  .announcement-text {
    font-size: 24rpx;
    color: #666;
    line-height: 40rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .announcement-arrow {
    font-size: 32rpx;
    color: #999;
    margin-left: 10rpx;
  }
}

.main-content {
  height: calc(100vh - 200rpx);
}

.section {
  background: #FFFFFF;
  margin: 20rpx 30rpx;
  border-radius: 16rpx;
  padding: 30rpx;
  .section-title {
    font-size: 30rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 24rpx;
  }
}

.category-tabs {
  white-space: nowrap;
  margin-bottom: 24rpx;
  .category-tab {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    padding: 16rpx 30rpx;
    margin-right: 16rpx;
    border-radius: 12rpx;
    background: #F5F5F5;
    &.active {
      background: #E6F4FF;
      .category-name { color: #1677FF; font-weight: 500; }
    }
    .category-icon { font-size: 36rpx; margin-bottom: 8rpx; }
    .category-name { font-size: 24rpx; color: #666; }
  }
}

.service-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  .service-item {
    padding: 20rpx;
    border-radius: 12rpx;
    background: #FAFAFA;
    text-align: center;
    border: 2rpx solid transparent;
    &.selected {
      background: #E6F4FF;
      border-color: #1677FF;
      .service-name { color: #1677FF; }
    }
    .service-name { font-size: 26rpx; color: #333; display: block; }
    .service-price { font-size: 24rpx; color: #FF4D4F; margin-top: 8rpx; display: block; }
    .service-rating { font-size: 22rpx; color: #FAAD14; margin-top: 4rpx; display: block; }
  }
}

.date-tabs {
  white-space: nowrap;
  margin-bottom: 24rpx;
  .date-tab {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    padding: 16rpx 28rpx;
    margin-right: 12rpx;
    border-radius: 12rpx;
    background: #F5F5F5;
    &.active {
      background: #1677FF;
      .date-week, .date-day { color: #FFFFFF; }
    }
    .date-week { font-size: 24rpx; color: #666; }
    .date-day { font-size: 28rpx; color: #333; font-weight: 500; margin-top: 4rpx; }
  }
}

.time-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
  .time-slot {
    padding: 16rpx;
    border-radius: 8rpx;
    background: #F5F5F5;
    text-align: center;
    font-size: 26rpx;
    color: #333;
    &.active {
      background: #1677FF;
      color: #FFFFFF;
    }
    &.disabled {
      background: #F0F0F0;
      color: #CCC;
      text-decoration: line-through;
    }
  }
}

.address-row {
  display: flex;
  gap: 16rpx;
  .region-picker {
    padding: 20rpx 24rpx;
    border-radius: 8rpx;
    background: #F5F5F5;
    display: flex;
    align-items: center;
    min-width: 200rpx;
    .picker-arrow { font-size: 20rpx; color: #999; margin-left: 8rpx; }
  }
  .address-input {
    flex: 1;
    padding: 20rpx 24rpx;
    border-radius: 8rpx;
    background: #F5F5F5;
    font-size: 26rpx;
  }
}

.form-input {
  padding: 20rpx 24rpx;
  border-radius: 8rpx;
  background: #F5F5F5;
  margin-bottom: 16rpx;
  font-size: 26rpx;
}

.form-textarea {
  padding: 20rpx 24rpx;
  border-radius: 8rpx;
  background: #F5F5F5;
  font-size: 26rpx;
  height: 120rpx;
}

.agreement-section {
  .agreement-checkbox {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    .checkbox-icon {
      width: 32rpx;
      height: 32rpx;
      border-radius: 50%;
      border: 2rpx solid #D9D9D9;
      text-align: center;
      line-height: 32rpx;
      font-size: 20rpx;
      color: transparent;
      margin-right: 12rpx;
      &.checked {
        background: #1677FF;
        border-color: #1677FF;
        color: #FFFFFF;
      }
    }
    .agreement-text { font-size: 24rpx; color: #666; }
    .agreement-link { font-size: 24rpx; color: #1677FF; }
  }
}

.submit-btn {
  margin: 40rpx 30rpx;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  background: #1677FF;
  color: #FFFFFF;
  text-align: center;
  font-size: 32rpx;
  font-weight: 500;
  &.disabled {
    background: #D9D9D9;
  }
}

.empty-service {
  grid-column: 1 / -1;
  text-align: center;
  padding: 40rpx;
  color: #999;
  font-size: 26rpx;
}
</style>
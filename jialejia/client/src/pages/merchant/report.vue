<template>
  <view class="report-page">
    <view class="form-section">
      <text class="form-title">代报单</text>
      <view class="form-actions">
        <button class="mini-btn" @click="copyLastOrder">复制上一单</button>
        <button class="mini-btn" @click="quickSelectCustomer">常用客户</button>
      </view>
      <view class="form-group">
        <text class="form-label">服务类型</text>
        <picker mode="selector" :range="serviceNames" @change="onServiceChange">
          <view class="form-picker"><text>{{ selectedServiceName || '请选择' }}</text><text class="arrow">▼</text></view>
        </picker>
      </view>
      <input class="form-input" v-model="form.customer_name" placeholder="客户姓名" />
      <input class="form-input" v-model="form.customer_phone" placeholder="客户电话" type="number" maxlength="11" />
      <input class="form-input" v-model="form.customer_address" placeholder="服务地址" />
      <view class="form-group">
        <text class="form-label">预约日期</text>
        <picker mode="date" @change="onDateChange">
          <view class="form-picker"><text>{{ form.appointment_date || '请选择' }}</text><text class="arrow">▼</text></view>
        </picker>
      </view>
      <view class="form-group">
        <text class="form-label">预约时间</text>
        <picker mode="time" @change="onTimeChange">
          <view class="form-picker"><text>{{ form.appointment_time || '请选择' }}</text><text class="arrow">▼</text></view>
        </picker>
      </view>
      <textarea class="form-textarea" v-model="form.remark" placeholder="备注（选填）" />
      <textarea class="form-textarea" v-model="form.merchant_remark" placeholder="商家备注（仅师傅和后台可见）" />
      <button class="submit-btn" @click="submitOrder">提交代报</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/api'

const form = ref({ customer_name: '', customer_phone: '', customer_address: '', appointment_date: '', appointment_time: '', remark: '', merchant_remark: '' })
const serviceNames = ref<string[]>([])
const serviceItems = ref<any[]>([])
const selectedServiceId = ref<number | null>(null)
const selectedServiceName = ref('')

onMounted(async () => {
  try {
    const res = await api.getServiceItems()
    if (res.data) {
      serviceItems.value = res.data
      serviceNames.value = res.data.map((i: any) => i.name)
    }
  } catch (err) { console.error(err) }
})

function onServiceChange(e: any) {
  const idx = e.detail.value
  const item = serviceItems.value[idx]
  selectedServiceId.value = item.id
  selectedServiceName.value = item.name
}

function onDateChange(e: any) { form.value.appointment_date = e.detail.value }
function onTimeChange(e: any) { form.value.appointment_time = e.detail.value }

function copyLastOrder() { uni.showToast({ title: '功能开发中', icon: 'none' }) }
function quickSelectCustomer() { uni.showToast({ title: '功能开发中', icon: 'none' }) }

async function submitOrder() {
  if (!form.value.customer_name || !form.value.customer_phone || !form.value.customer_address) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' })
    return
  }
  try {
    const res = await api.merchantCreateOrder({ ...form.value, service_item_id: selectedServiceId.value, service_name: selectedServiceName.value })
    if (res.data) {
      uni.showToast({ title: '代报单提交成功', icon: 'success' })
      form.value = { customer_name: '', customer_phone: '', customer_address: '', appointment_date: '', appointment_time: '', remark: '', merchant_remark: '' }
    }
  } catch (err) { console.error(err) }
}
</script>

<style lang="scss" scoped>
.report-page {
  min-height: 100vh; background: #F5F5F5; padding: 20rpx 30rpx;
  .form-section { background: #FFF; border-radius: 16rpx; padding: 30rpx; .form-title { font-size: 30rpx; font-weight: 600; color: #333; display: block; margin-bottom: 20rpx; } .form-actions { display: flex; gap: 16rpx; margin-bottom: 20rpx; .mini-btn { height: 56rpx; line-height: 56rpx; border-radius: 28rpx; border: 2rpx solid #1677FF; color: #1677FF; background: #FFF; font-size: 24rpx; padding: 0 24rpx; } } .form-group { margin-bottom: 16rpx; .form-label { font-size: 26rpx; color: #333; display: block; margin-bottom: 8rpx; } .form-picker { padding: 20rpx 24rpx; border-radius: 8rpx; background: #F5F5F5; display: flex; justify-content: space-between; font-size: 26rpx; color: #333; .arrow { color: #999; } } } .form-input { padding: 20rpx 24rpx; border-radius: 8rpx; background: #F5F5F5; margin-bottom: 16rpx; font-size: 26rpx; } .form-textarea { width: 100%; height: 120rpx; padding: 20rpx; border-radius: 8rpx; background: #F5F5F5; font-size: 26rpx; box-sizing: border-box; margin-bottom: 16rpx; } .submit-btn { margin-top: 20rpx; height: 80rpx; line-height: 80rpx; background: #1677FF; color: #FFF; border-radius: 40rpx; font-size: 30rpx; } }
}
</style>
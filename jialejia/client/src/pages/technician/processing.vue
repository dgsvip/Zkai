<template>
  <view class="processing-page">
    <view class="page-header">⚡ 进行中（{{ orders.length }}）</view>
    <scroll-view scroll-y class="order-list">
      <view v-for="order in orders" :key="order.id" class="order-card" :class="{ warning: isWarning(order) }">
        <view class="card-top">
          <text class="service-tag">{{ order.service_name }}</text>
          <text class="status-tag" :class="isWarning(order) ? 'status-warning' : 'status-processing'">
            {{ isWarning(order) ? '⚠️ 即将超时' : '⏳ 进行中' }}
          </text>
        </view>
        <view class="card-address">📍 {{ order.customer_address }}</view>
        <view class="card-contact">
          <text>{{ order.customer_name }}</text>
          <text class="contact-phone" @click="callPhone(order.customer_phone)">📞 {{ order.customer_phone }}</text>
        </view>
        <view class="card-time">预约: {{ order.appointment_date }} {{ order.appointment_time }}</view>
        <view v-if="order.remark" class="card-remark">📝 {{ order.remark }}</view>
        <view class="card-actions">
          <button class="action-btn success" @click="showComplete(order)">✅ 完工</button>
          <button class="action-btn warning" @click="showTransfer(order)">🔄 转派</button>
          <button class="action-btn danger" @click="showCancel(order)">✕ 取消</button>
        </view>
      </view>
      <view v-if="orders.length === 0" class="empty-state">暂无进行中的订单</view>
    </scroll-view>

    <!-- 完工弹窗 -->
    <uni-popup ref="completePopup" type="center">
      <view class="popup-content">
        <text class="popup-title">完工结算</text>
        <input class="popup-input" v-model="completeForm.price" placeholder="实收金额" type="number" />
        <view class="warranty-select">
          <text v-for="m in [3,6,9,12]" :key="m" class="warranty-option" :class="{ active: completeForm.warranty === m }" @click="completeForm.warranty = m">{{ m }}个月</text>
        </view>
        <textarea class="popup-textarea" v-model="completeForm.remark" placeholder="师傅备注（选填）" />
        <button class="popup-btn" @click="submitComplete">确认完工</button>
        <button class="popup-btn cancel" @click="closeComplete">取消</button>
      </view>
    </uni-popup>

    <!-- 转派弹窗 -->
    <uni-popup ref="transferPopup" type="center">
      <view class="popup-content">
        <text class="popup-title">转派</text>
        <textarea class="popup-textarea" v-model="transferForm.remark" placeholder="转派备注（建议填写）" />
        <button class="popup-btn" @click="submitTransfer">发起转派</button>
        <button class="popup-btn cancel" @click="closeTransfer">取消</button>
      </view>
    </uni-popup>

    <!-- 取消弹窗 -->
    <uni-popup ref="cancelPopup" type="center">
      <view class="popup-content">
        <text class="popup-title">取消订单</text>
        <view v-for="reason in cancelReasons" :key="reason" class="reason-option" :class="{ active: cancelForm.reason === reason }" @click="cancelForm.reason = reason">
          <text>{{ reason }}</text>
        </view>
        <textarea class="popup-textarea" v-model="cancelForm.detail" placeholder="详细说明（选填）" />
        <button class="popup-btn danger" @click="submitCancel">确认取消</button>
        <button class="popup-btn cancel" @click="closeCancel">取消</button>
      </view>
    </uni-popup>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api from '@/api'

const orders = ref<any[]>([])
const completePopup = ref<any>(null)
const transferPopup = ref<any>(null)
const cancelPopup = ref<any>(null)
const currentOrderNo = ref('')

const completeForm = ref({ price: 0, warranty: 6, remark: '' })
const transferForm = ref({ remark: '' })
const cancelForm = ref({ reason: '', detail: '' })
const cancelReasons = ['客户要求取消', '配件不足，无法维修', '距离太远，无法到达', '身体不适，无法上门', '其他原因']

onShow(() => { loadOrders() })

function isWarning(order: any) {
  return order.created_at && (Date.now() - new Date(order.created_at).getTime()) > 24 * 60 * 60 * 1000
}

async function loadOrders() {
  try {
    const res = await api.getTechnicianOrders({ type: 'processing' })
    if (res.data) orders.value = res.data.list || []
  } catch (err) { console.error(err) }
}

function showComplete(order: any) {
  currentOrderNo.value = order.order_no
  completeForm.value = { price: 0, warranty: 6, remark: '' }
  completePopup.value?.open()
}

async function submitComplete() {
  uni.showModal({
    title: '确认完工',
    content: '确认完工后不可修改，是否继续？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await api.completeOrder({
            order_no: currentOrderNo.value,
            price: completeForm.value.price,
            warranty_months: completeForm.value.warranty,
            technician_remark: completeForm.value.remark || undefined
          })
          uni.showToast({ title: '完工确认成功', icon: 'success' })
          completePopup.value?.close()
          loadOrders()
        } catch (err) { console.error(err) }
      }
    }
  })
}

function closeComplete() { completePopup.value?.close() }

function showTransfer(order: any) {
  currentOrderNo.value = order.order_no
  transferForm.value = { remark: '' }
  transferPopup.value?.open()
}

async function submitTransfer() {
  try {
    await api.transferOrder({
      order_no: currentOrderNo.value,
      target_technician_id: 0, // TODO: 选择师傅
      transfer_remark: transferForm.value.remark
    })
    uni.showToast({ title: '转派已发起', icon: 'success' })
    transferPopup.value?.close()
    loadOrders()
  } catch (err) { console.error(err) }
}

function closeTransfer() { transferPopup.value?.close() }

function showCancel(order: any) {
  currentOrderNo.value = order.order_no
  cancelForm.value = { reason: '', detail: '' }
  cancelPopup.value?.open()
}

async function submitCancel() {
  try {
    await api.cancelTechnicianOrder({
      order_no: currentOrderNo.value,
      cancel_reason: cancelForm.value.reason + (cancelForm.value.detail ? `: ${cancelForm.value.detail}` : '')
    })
    uni.showToast({ title: '订单已取消', icon: 'success' })
    cancelPopup.value?.close()
    loadOrders()
  } catch (err) { console.error(err) }
}

function closeCancel() { cancelPopup.value?.close() }

function callPhone(phone: string) {
  if (phone) uni.makePhoneCall({ phoneNumber: phone })
}
</script>

<style lang="scss" scoped>
.processing-page {
  min-height: 100vh;
  background: #F5F5F5;
  .page-header { font-size: 32rpx; font-weight: 600; padding: 30rpx; background: #FFF; }
  .order-list { height: calc(100vh - 120rpx); padding: 16rpx 20rpx; }
  .order-card {
    background: #FFF; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx;
    &.warning { border: 2rpx solid #FAAD14; }
    .card-top { display: flex; justify-content: space-between; margin-bottom: 12rpx; .service-tag { font-size: 26rpx; color: #1677FF; font-weight: 500; } .status-tag { font-size: 22rpx; &.status-warning { color: #FAAD14; } &.status-processing { color: #1677FF; } } }
    .card-address { font-size: 28rpx; color: #333; font-weight: 500; margin-bottom: 8rpx; }
    .card-contact { display: flex; justify-content: space-between; margin-bottom: 8rpx; font-size: 26rpx; .contact-phone { color: #1677FF; } }
    .card-time { font-size: 24rpx; color: #666; margin-bottom: 8rpx; }
    .card-remark { font-size: 24rpx; color: #666; background: #F5F5F5; padding: 12rpx; border-radius: 8rpx; margin-bottom: 12rpx; }
    .card-actions { display: flex; gap: 12rpx; .action-btn { flex: 1; height: 60rpx; line-height: 60rpx; border-radius: 30rpx; font-size: 24rpx; border: none; color: #FFF; text-align: center; &.success { background: #52C41A; } &.warning { background: #FAAD14; } &.danger { background: #FF4D4F; } } }
  }
  .empty-state { text-align: center; padding: 100rpx 0; color: #999; font-size: 28rpx; }
}

.popup-content {
  background: #FFF;
  border-radius: 24rpx;
  padding: 40rpx;
  width: 600rpx;
  .popup-title { font-size: 32rpx; font-weight: 600; text-align: center; display: block; margin-bottom: 24rpx; }
  .popup-input { padding: 20rpx; border-radius: 8rpx; background: #F5F5F5; margin-bottom: 16rpx; font-size: 28rpx; }
  .popup-textarea { width: 100%; height: 120rpx; padding: 20rpx; border-radius: 8rpx; background: #F5F5F5; font-size: 26rpx; box-sizing: border-box; margin-bottom: 16rpx; }
  .warranty-select { display: flex; gap: 16rpx; margin-bottom: 16rpx; .warranty-option { padding: 12rpx 24rpx; border-radius: 8rpx; background: #F5F5F5; font-size: 24rpx; &.active { background: #1677FF; color: #FFF; } } }
  .reason-option { padding: 16rpx 20rpx; border-radius: 8rpx; background: #F5F5F5; margin-bottom: 8rpx; font-size: 26rpx; &.active { background: #E6F4FF; color: #1677FF; } }
  .popup-btn { height: 72rpx; line-height: 72rpx; border-radius: 36rpx; background: #1677FF; color: #FFF; font-size: 28rpx; margin-top: 12rpx; &.cancel { background: #F5F5F5; color: #666; } &.danger { background: #FF4D4F; } }
}
</style>
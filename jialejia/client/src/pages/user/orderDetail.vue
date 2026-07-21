<template>
  <view class="order-detail-page">
    <view v-if="order" class="detail-content">
      <!-- 顶部状态 -->
      <view class="status-header">
        <text class="order-no">#{{ order.order_no }}</text>
        <text class="order-status" :class="'status-' + order.status">{{ getStatusText(order.status) }}</text>
      </view>

      <!-- 时间线 -->
      <view class="section">
        <view class="section-title">订单进度</view>
        <view class="timeline">
          <view v-for="(log, i) in logs" :key="i" class="timeline-item">
            <view class="timeline-dot" :class="{ first: i === 0 }"></view>
            <view class="timeline-content">
              <text class="timeline-action">{{ log.action }}</text>
              <text class="timeline-desc">{{ log.description }}</text>
              <text class="timeline-time">{{ formatTime(log.created_at) }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 服务信息 -->
      <view class="section">
        <view class="section-title">服务信息</view>
        <view class="info-row"><text class="info-label">服务项目</text><text class="info-value">{{ order.service_name }}</text></view>
        <view class="info-row"><text class="info-label">预约时间</text><text class="info-value">{{ order.appointment_date }} {{ order.appointment_time }}</text></view>
        <view class="info-row"><text class="info-label">服务地址</text><text class="info-value">{{ order.customer_address }}</text></view>
        <view v-if="order.remark" class="info-row"><text class="info-label">备注</text><text class="info-value">{{ order.remark }}</text></view>
        <view v-if="order.price" class="info-row"><text class="info-label">实收金额</text><text class="info-value">¥{{ order.price }}</text></view>
      </view>

      <!-- 师傅信息 -->
      <view v-if="order.technician_id && technician" class="section">
        <view class="section-title">师傅信息</view>
        <view class="technician-card">
          <text class="technician-name">{{ technician.name }}</text>
          <text class="technician-phone" @click="callPhone(technician.phone)">📞 {{ technician.phone }}</text>
          <text class="technician-rating" v-if="technician.rating_avg">⭐ {{ technician.rating_avg }} · 好评率{{ (technician.rating_avg / 5 * 100).toFixed(0) }}%</text>
        </view>
      </view>

      <!-- 评价 -->
      <view v-if="order.status === 'completed'" class="section">
        <view class="section-title">
          {{ evaluation ? '我的评价' : '评价服务' }}
        </view>
        <view v-if="!evaluation" class="evaluate-form">
          <view class="rating-row">
            <text>服务态度</text>
            <view class="stars">
              <text v-for="s in 5" :key="s" class="star" :class="{ active: s <= ratingAttitude }" @click="ratingAttitude = s">★</text>
            </view>
          </view>
          <view class="rating-row">
            <text>技术水平</text>
            <view class="stars">
              <text v-for="s in 5" :key="s" class="star" :class="{ active: s <= ratingSkill }" @click="ratingSkill = s">★</text>
            </view>
          </view>
          <view class="rating-row">
            <text>准时度</text>
            <view class="stars">
              <text v-for="s in 5" :key="s" class="star" :class="{ active: s <= ratingPunctuality }" @click="ratingPunctuality = s">★</text>
            </view>
          </view>
          <textarea class="evaluate-textarea" v-model="evaluateComment" placeholder="写下您的评价（选填）" />
          <button class="submit-btn" @click="submitEvaluate">提交评价</button>
        </view>
        <view v-else class="evaluation-display">
          <view class="rating-row">
            <text>服务态度</text>
            <text class="stars">{{ '★'.repeat(evaluation.rating_attitude) }}{{ '☆'.repeat(5 - evaluation.rating_attitude) }}</text>
          </view>
          <view class="rating-row">
            <text>技术水平</text>
            <text class="stars">{{ '★'.repeat(evaluation.rating_skill) }}{{ '☆'.repeat(5 - evaluation.rating_skill) }}</text>
          </view>
          <view class="rating-row">
            <text>准时度</text>
            <text class="stars">{{ '★'.repeat(evaluation.rating_punctuality) }}{{ '☆'.repeat(5 - evaluation.rating_punctuality) }}</text>
          </view>
          <text v-if="evaluation.comment" class="evaluate-comment">{{ evaluation.comment }}</text>
        </view>
      </view>

      <!-- 底部操作 -->
      <view class="bottom-actions">
        <button
          v-if="order.status === 'pending'"
          class="action-btn danger"
          @click="cancelOrder"
        >取消订单</button>
        <button
          v-if="order.technician_id && order.status !== 'completed' && order.status !== 'cancelled'"
          class="action-btn"
          @click="callPhone(technician?.phone)"
        >联系师傅</button>
        <button
          v-if="order.status === 'completed'"
          class="action-btn"
          @click="rebook"
        >再次预约</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import api from '@/api'
import { getStatusText, formatTime } from '@/utils'

const orderNo = ref('')
const order = ref<any>(null)
const logs = ref<any[]>([])
const technician = ref<any>(null)
const evaluation = ref<any>(null)
const ratingAttitude = ref(5)
const ratingSkill = ref(5)
const ratingPunctuality = ref(5)
const evaluateComment = ref('')

onLoad((query) => {
  if (query?.orderNo) {
    orderNo.value = query.orderNo
    loadOrderDetail()
  }
})

async function loadOrderDetail() {
  try {
    const res = await api.getOrderDetail(orderNo.value)
    if (res.data) {
      order.value = res.data
      logs.value = res.data.logs || []
      technician.value = res.data.technician
      evaluation.value = res.data.evaluation
    }
  } catch (err) {
    console.error('加载订单详情失败', err)
  }
}

async function cancelOrder() {
  uni.showModal({
    title: '取消订单',
    content: '确定要取消此订单吗？接单前取消无责，接单后15分钟内取消需支付爽约金。',
    success: async (res) => {
      if (res.confirm) {
        try {
          await api.cancelOrder(orderNo.value)
          uni.showToast({ title: '订单已取消', icon: 'success' })
          loadOrderDetail()
        } catch (err) {
          console.error('取消失败', err)
        }
      }
    }
  })
}

async function submitEvaluate() {
  try {
    await api.evaluateOrder(orderNo.value, {
      rating_attitude: ratingAttitude.value,
      rating_skill: ratingSkill.value,
      rating_punctuality: ratingPunctuality.value,
      comment: evaluateComment.value || undefined
    })
    uni.showToast({ title: '评价成功', icon: 'success' })
    loadOrderDetail()
  } catch (err) {
    console.error('评价失败', err)
  }
}

function callPhone(phone: string) {
  if (phone) uni.makePhoneCall({ phoneNumber: phone })
}

function rebook() {
  uni.switchTab({ url: '/pages/user/booking' })
}
</script>

<style lang="scss" scoped>
.order-detail-page {
  min-height: 100vh;
  background: #F5F5F5;
  padding-bottom: 120rpx;
}

.status-header {
  background: #FFFFFF;
  padding: 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  .order-no { font-size: 24rpx; color: #999; }
  .order-status { font-size: 28rpx; font-weight: 500; }
}

.section {
  background: #FFFFFF;
  margin: 20rpx 30rpx;
  border-radius: 16rpx;
  padding: 30rpx;
  .section-title {
    font-size: 28rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 20rpx;
  }
}

.timeline {
  .timeline-item {
    display: flex;
    padding-bottom: 24rpx;
    position: relative;
    &:last-child { padding-bottom: 0; }
    .timeline-dot {
      width: 16rpx;
      height: 16rpx;
      border-radius: 50%;
      background: #D9D9D9;
      margin-top: 8rpx;
      margin-right: 20rpx;
      position: relative;
      &::after {
        content: '';
        position: absolute;
        top: 20rpx;
        left: 50%;
        transform: translateX(-50%);
        width: 2rpx;
        height: calc(100% - 10rpx);
        background: #E8E8E8;
      }
      &.first {
        background: #1677FF;
        width: 20rpx;
        height: 20rpx;
      }
    }
    &:last-child .timeline-dot::after { display: none; }
    .timeline-content {
      flex: 1;
      .timeline-action { font-size: 26rpx; color: #333; font-weight: 500; }
      .timeline-desc { font-size: 24rpx; color: #666; display: block; margin-top: 4rpx; }
      .timeline-time { font-size: 22rpx; color: #999; display: block; margin-top: 4rpx; }
    }
  }
}

.info-row {
  display: flex;
  padding: 12rpx 0;
  .info-label { font-size: 26rpx; color: #666; width: 160rpx; flex-shrink: 0; }
  .info-value { font-size: 26rpx; color: #333; flex: 1; }
}

.technician-card {
  .technician-name { font-size: 28rpx; color: #333; font-weight: 500; display: block; }
  .technician-phone { font-size: 26rpx; color: #1677FF; margin-top: 8rpx; display: block; }
  .technician-rating { font-size: 24rpx; color: #FAAD14; margin-top: 8rpx; display: block; }
}

.evaluate-form {
  .rating-row {
    display: flex;
    align-items: center;
    margin-bottom: 16rpx;
    font-size: 26rpx;
    color: #333;
    .stars { margin-left: 16rpx; }
    .star { font-size: 36rpx; color: #D9D9D9; margin-right: 8rpx; &.active { color: #FAAD14; } }
  }
  .evaluate-textarea {
    width: 100%;
    height: 160rpx;
    padding: 20rpx;
    border-radius: 8rpx;
    background: #F5F5F5;
    font-size: 26rpx;
    box-sizing: border-box;
    margin-top: 16rpx;
  }
  .submit-btn {
    margin-top: 24rpx;
    height: 72rpx;
    line-height: 72rpx;
    background: #1677FF;
    color: #FFFFFF;
    border-radius: 36rpx;
    font-size: 28rpx;
  }
}

.evaluation-display {
  .rating-row { margin-bottom: 12rpx; display: flex; align-items: center; font-size: 26rpx; color: #333; .stars { margin-left: 16rpx; color: #FAAD14; } }
  .evaluate-comment { font-size: 26rpx; color: #666; display: block; margin-top: 12rpx; }
}

.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #FFFFFF;
  padding: 20rpx 30rpx;
  display: flex;
  gap: 20rpx;
  box-shadow: 0 -4rpx 12rpx rgba(0,0,0,0.06);
  .action-btn {
    flex: 1;
    height: 80rpx;
    line-height: 80rpx;
    border-radius: 40rpx;
    border: 2rpx solid #1677FF;
    color: #1677FF;
    background: #FFFFFF;
    font-size: 28rpx;
    &.danger {
      border-color: #FF4D4F;
      color: #FF4D4F;
    }
  }
}
</style>
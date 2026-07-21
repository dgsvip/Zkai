<template>
  <view class="agreement-page">
    <view class="agreement-header">
      <text class="agreement-type">{{ type === 'booking' ? '预约协议' : '平台服务协议' }}</text>
      <text class="agreement-version">版本号: v1.0.0</text>
    </view>
    <view class="agreement-content">
      <text class="content-text">
        【重要提示】欢迎使用佳乐家平台服务。在您使用本平台服务前，请仔细阅读以下协议内容。

        {{ type === 'booking' ? `
        一、预约服务说明
        1. 用户通过本平台预约服务，需提供真实、准确的个人信息和联系方式。
        2. 预约时间以用户选择的时间为准，师傅将按照预约时间上门服务。
        3. 用户可在师傅接单前无责取消订单；师傅接单后15分钟内取消需支付爽约金；超过15分钟需联系客服处理。

        二、双方权利与义务
        1. 用户有权了解服务项目、价格、师傅信息等基本信息。
        2. 用户应保证提供准确的服务地址，并确保服务现场具备安全作业条件。
        3. 平台不对师傅的服务质量作任何明示或暗示的担保，但会协助用户与师傅进行沟通协调。

        三、免责条款
        1. 因不可抗力因素导致服务无法正常进行的，平台不承担责任。
        2. 因用户提供的信息不准确导致的任何损失，由用户自行承担。
        ` : `
        一、服务条款
        1. 佳乐家平台（以下简称"本平台"）为用户提供本地生活服务信息撮合服务。
        2. 用户在使用本平台服务前，应确认已充分理解并同意本协议的全部内容。

        二、注册与账号
        1. 用户使用手机号验证码登录，验证通过后即获得平台使用资格。
        2. 用户不得将账号转让、出借给他人使用，否则由此产生的风险由用户承担。

        三、服务规范
        1. 平台展示的服务价格仅供参考，实际价格以师傅上门后确认为准。
        2. 用户评价应客观真实，不得包含虚假、恶意或侮辱性内容。

        四、隐私保护
        1. 平台承诺保护用户个人信息安全，未经用户同意不会向第三方提供个人信息。
        2. 平台可能会对用户的手机号进行脱敏处理后再展示给师傅。

        五、法律适用与争议解决
        1. 本协议适用中华人民共和国法律。
        2. 因本协议引起的争议，双方应友好协商解决；协商不成的，提交平台所在地有管辖权的人民法院诉讼解决。
        ` }}
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const type = ref('booking')

onLoad((query) => {
  if (query?.type) type.value = query.type
})
</script>

<style lang="scss" scoped>
.agreement-page {
  padding: 30rpx;
  .agreement-header {
    text-align: center;
    margin-bottom: 30rpx;
    .agreement-type { font-size: 32rpx; font-weight: 600; color: #333; display: block; }
    .agreement-version { font-size: 24rpx; color: #999; display: block; margin-top: 8rpx; }
  }
  .agreement-content {
    background: #FFFFFF;
    border-radius: 16rpx;
    padding: 30rpx;
    .content-text {
      font-size: 26rpx;
      color: #333;
      line-height: 1.8;
      white-space: pre-wrap;
    }
  }
}
</style>
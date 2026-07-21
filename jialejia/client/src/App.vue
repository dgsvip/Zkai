<template>
  <view>
    <u-safe-bottom></u-safe-bottom>
  </view>
</template>

<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'

onLaunch(() => {
  console.log('佳乐家 App 启动')
})

onShow(() => {
  console.log('App 显示')
})

onHide(() => {
  console.log('App 隐藏')
})
</script>

<style lang="scss">
/* 每个页面公共css */
@import 'uview-plus/index.scss';
</style>
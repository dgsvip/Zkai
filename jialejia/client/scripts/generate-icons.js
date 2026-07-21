/**
 * 生成 TabBar 占位图标
 * 运行: node scripts/generate-icons.js
 * 需要在有 canvas 或有 ImageMagick 的环境中运行
 * 如果无法生成，请手动替换为实际图标文件
 */
const fs = require('fs')
const path = require('path')

const icons = [
  { name: 'booking', label: '预约', color: '#1677FF' },
  { name: 'booking_active', label: '预约', color: '#1677FF' },
  { name: 'orders', label: '查单', color: '#1677FF' },
  { name: 'orders_active', label: '查单', color: '#1677FF' },
  { name: 'profile', label: '我的', color: '#1677FF' },
  { name: 'profile_active', label: '我的', color: '#1677FF' },
]

const dir = path.join(__dirname, '..', 'src', 'static', 'tabbar')
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true })
}

icons.forEach(icon => {
  const filePath = path.join(dir, `${icon.name}.png`)
  // 创建最小 PNG 占位文件
  // 实际使用时请替换为真实图标
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, Buffer.alloc(0))
    console.log(`创建占位: ${icon.name}.png`)
  }
})

console.log('图标占位文件创建完成，请替换为实际图标文件')
console.log('图标尺寸建议: 48x48px (png)')
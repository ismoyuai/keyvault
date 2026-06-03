#!/usr/bin/env node
/**
 * KeyVault Extension Icon Generator
 *
 * 生成扩展所需的图标文件
 * 需要安装 canvas: npm install canvas
 */

const { createCanvas } = require('canvas')
const fs = require('fs')
const path = require('path')

// 图标尺寸
const sizes = [16, 32, 48, 128]

// 颜色配置
const colors = {
  background: '#6c63ff',
  foreground: '#ffffff',
  lock: '#ffffff'
}

/**
 * 生成图标
 */
function generateIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // 背景
  ctx.fillStyle = colors.background
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, size * 0.2)
  ctx.fill()

  // 锁的尺寸
  const lockWidth = size * 0.5
  const lockHeight = size * 0.4
  const lockX = (size - lockWidth) / 2
  const lockY = size * 0.35

  // 锁扣
  ctx.strokeStyle = colors.lock
  ctx.lineWidth = size * 0.08
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(lockX + lockWidth / 2, lockY, lockWidth * 0.35, Math.PI, 0)
  ctx.stroke()

  // 锁体
  ctx.fillStyle = colors.lock
  ctx.beginPath()
  ctx.roundRect(lockX, lockY, lockWidth, lockHeight, size * 0.05)
  ctx.fill()

  // 钥匙孔
  ctx.fillStyle = colors.background
  ctx.beginPath()
  ctx.arc(lockX + lockWidth / 2, lockY + lockHeight * 0.4, lockWidth * 0.12, 0, Math.PI * 2)
  ctx.fill()

  return canvas.toBuffer('image/png')
}

// 生成所有尺寸的图标
sizes.forEach(size => {
  const icon = generateIcon(size)
  const iconPath = path.join(__dirname, 'icons', `icon${size}.png`)
  fs.writeFileSync(iconPath, icon)
  console.log(`Generated icon${size}.png`)
})

console.log('All icons generated successfully!')

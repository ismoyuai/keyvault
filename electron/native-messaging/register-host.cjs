#!/usr/bin/env node
'use strict'

/**
 * KeyVault Native Messaging Host 注册脚本
 *
 * 在 Windows 注册表中注册 native messaging host
 * 使 Chrome/Firefox 能够发现并连接到 KeyVault
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

// 配置
const HOST_NAME = 'com.keyvault.extension'
const MANIFEST_PATH = path.join(__dirname, 'manifest.json')

/**
 * 获取 manifest 内容
 */
function getManifest() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  manifest.path = path.resolve(__dirname, 'host.cjs')
  return JSON.stringify(manifest, null, 2)
}

/**
 * 注册 Chrome native messaging host
 */
function registerForChrome() {
  const manifest = getManifest()
  const manifestPath = path.join(__dirname, 'chrome-manifest.json')

  // 写入带完整路径的 manifest
  fs.writeFileSync(manifestPath, manifest, 'utf8')

  // Windows 注册表路径
  const regKey = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`

  try {
    execSync(`reg add "${regKey}" /ve /t REG_SZ /d "${manifestPath}" /f`, {
      stdio: 'pipe'
    })
    console.log('✓ Chrome native messaging host registered')
  } catch (error) {
    console.error('✗ Failed to register for Chrome:', error.message)
  }
}

/**
 * 注册 Firefox native messaging host
 */
function registerForFirefox() {
  const manifest = getManifest()
  const manifestPath = path.join(__dirname, 'firefox-manifest.json')

  // 写入带完整路径的 manifest
  fs.writeFileSync(manifestPath, manifest, 'utf8')

  // Windows 注册表路径
  const regKey = `HKCU\\Software\\Mozilla\\NativeMessagingHosts\\${HOST_NAME}`

  try {
    execSync(`reg add "${regKey}" /ve /t REG_SZ /d "${manifestPath}" /f`, {
      stdio: 'pipe'
    })
    console.log('✓ Firefox native messaging host registered')
  } catch (error) {
    console.error('✗ Failed to register for Firefox:', error.message)
  }
}

/**
 * 注销 native messaging host
 */
function unregister() {
  const chromeRegKey = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`
  const firefoxRegKey = `HKCU\\Software\\Mozilla\\NativeMessagingHosts\\${HOST_NAME}`

  try {
    execSync(`reg delete "${chromeRegKey}" /f`, { stdio: 'pipe' })
    console.log('✓ Chrome native messaging host unregistered')
  } catch {
    // 忽略不存在的键
  }

  try {
    execSync(`reg delete "${firefoxRegKey}" /f`, { stdio: 'pipe' })
    console.log('✓ Firefox native messaging host unregistered')
  } catch {
    // 忽略不存在的键
  }
}

// 命令行参数
const command = process.argv[2]

switch (command) {
  case 'register':
    registerForChrome()
    registerForFirefox()
    break
  case 'unregister':
    unregister()
    break
  default:
    console.log('Usage:')
    console.log('  node register-host.cjs register    - Register native messaging host')
    console.log('  node register-host.cjs unregister  - Unregister native messaging host')
}

/**
 * KeyVault Browser Extension - Background Service Worker
 *
 * 处理与 Native Messaging Host 的通信
 * 管理扩展状态和凭据缓存
 */

const NATIVE_HOST_NAME = 'com.keyvault.extension'
const CONNECTION_TIMEOUT = 5000
const CACHE_TTL = 5 * 60 * 1000 // 5 分钟

// 状态
let nativePort = null
let connected = false
let connectionAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 3

// 凭据缓存
const credentialCache = new Map()

/**
 * 连接到 Native Messaging Host
 */
function connectToNativeHost() {
  if (nativePort) {
    nativePort.disconnect()
  }

  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME)

    nativePort.onMessage.addListener((message) => {
      handleNativeMessage(message)
    })

    nativePort.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError
      console.log('Native host disconnected:', error?.message || 'Unknown reason')
      connected = false
      nativePort = null

      // 自动重连
      if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
        connectionAttempts++
        setTimeout(connectToNativeHost, 1000 * connectionAttempts)
      }
    })

    // 发送 ping 验证连接
    sendMessage({ type: 'ping' })
      .then(() => {
        connected = true
        connectionAttempts = 0
        console.log('Connected to KeyVault native host')
      })
      .catch((error) => {
        console.error('Failed to connect:', error)
        connected = false
      })
  } catch (error) {
    console.error('Failed to connect to native host:', error)
    connected = false
  }
}

/**
 * 发送消息到 Native Messaging Host
 */
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    if (!nativePort) {
      reject(new Error('Not connected to native host'))
      return
    }

    const timeout = setTimeout(() => {
      reject(new Error('Message timeout'))
    }, CONNECTION_TIMEOUT)

    const listener = (response) => {
      clearTimeout(timeout)
      nativePort.onMessage.removeListener(listener)

      if (response.success) {
        resolve(response.data)
      } else {
        reject(new Error(response.error?.message || 'Unknown error'))
      }
    }

    nativePort.onMessage.addListener(listener)
    nativePort.postMessage(message)
  })
}

/**
 * 处理来自 Native Messaging Host 的消息
 */
function handleNativeMessage(message) {
  // 处理推送消息（如密码保存提示）
  if (message.type === 'save-prompt') {
    // 通知 content script 显示保存提示
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'show-save-prompt',
          data: message.data
        })
      }
    })
  }
}

/**
 * 查询凭据
 */
async function searchCredentials(query, domain) {
  // 检查缓存
  const cacheKey = `${query || ''}:${domain || ''}`
  const cached = credentialCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  try {
    const result = await sendMessage({
      type: 'query',
      action: 'search',
      params: { query, domain }
    })

    // 更新缓存
    credentialCache.set(cacheKey, {
      data: result.entries,
      timestamp: Date.now()
    })

    return result.entries
  } catch (error) {
    console.error('Search failed:', error)
    return []
  }
}

/**
 * 匹配当前页面的凭据
 */
async function matchCredentials(url) {
  try {
    const result = await sendMessage({
      type: 'query',
      action: 'match',
      params: { url }
    })
    return result.entries || []
  } catch (error) {
    console.error('Match failed:', error)
    return []
  }
}

/**
 * 获取单个凭据详情
 */
async function getCredential(id) {
  try {
    const result = await sendMessage({
      type: 'query',
      action: 'get',
      params: { id }
    })
    return result.entry
  } catch (error) {
    console.error('Get credential failed:', error)
    return null
  }
}

/**
 * 保存凭据
 */
async function saveCredential(data) {
  try {
    const result = await sendMessage({
      type: 'query',
      action: 'save',
      params: data
    })
    return result
  } catch (error) {
    console.error('Save credential failed:', error)
    throw error
  }
}

/**
 * 检查连接状态
 */
function isConnected() {
  return connected
}

/**
 * 断开连接
 */
function disconnect() {
  if (nativePort) {
    sendMessage({ type: 'disconnect' }).catch(() => {})
    nativePort.disconnect()
    nativePort = null
    connected = false
  }
}

// 监听来自 content script 和 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type, ...data } = request

  switch (type) {
    case 'search':
      searchCredentials(data.query, data.domain)
        .then(sendResponse)
        .catch((error) => sendResponse({ error: error.message }))
      return true // 保持消息通道开放

    case 'match':
      matchCredentials(data.url)
        .then(sendResponse)
        .catch((error) => sendResponse({ error: error.message }))
      return true

    case 'get':
      getCredential(data.id)
        .then(sendResponse)
        .catch((error) => sendResponse({ error: error.message }))
      return true

    case 'save':
      saveCredential(data)
        .then(sendResponse)
        .catch((error) => sendResponse({ error: error.message }))
      return true

    case 'status':
      sendResponse({ connected: isConnected() })
      return false

    case 'connect':
      connectToNativeHost()
      sendResponse({ connecting: true })
      return false

    case 'disconnect':
      disconnect()
      sendResponse({ disconnected: true })
      return false

    default:
      sendResponse({ error: 'Unknown message type' })
      return false
  }
})

// 扩展安装或更新时连接
chrome.runtime.onInstalled.addListener(() => {
  connectToNativeHost()
})

// 扩展启动时连接
chrome.runtime.onStartup.addListener(() => {
  connectToNativeHost()
})

// 初始连接
connectToNativeHost()

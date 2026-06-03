#!/usr/bin/env node
'use strict'

/**
 * KeyVault Native Messaging Host
 *
 * 处理浏览器扩展的通信请求
 * 协议：Native Messaging (stdin/stdout, JSON)
 *
 * 设计原则：
 * - 此模块不直接访问数据库或解密数据
 * - 通过 Named Pipe 与主进程通信
 * - 主进程负责所有加密/解密操作
 */

const net = require('net')

// 配置
const TIMEOUT_MS = 30000  // 增加超时时间到 30 秒
const SOCKET_PATH = process.platform === 'win32'
  ? '\\\\.\\pipe\\keyvault-native-messaging'
  : '/tmp/keyvault-native-messaging.sock'

// 日志文件（调试用）
const LOG_PATH = process.platform === 'win32'
  ? `${process.env.APPDATA || process.env.USERPROFILE}\\keyvault-host.log`
  : '/tmp/keyvault-host.log'

// 状态
let socket = null
let connected = false
let pendingRequests = new Map()
let requestId = 0
let buffer = Buffer.alloc(0)

/**
 * 写入日志
 */
function log(msg) {
  const fs = require('fs')
  const timestamp = new Date().toISOString()
  fs.appendFileSync(LOG_PATH, `[${timestamp}] ${msg}\n`)
}

/**
 * 读取 Native Messaging 消息
 * 协议：4 字节长度前缀 + JSON 数据
 */
function readMessage() {
  return new Promise((resolve, reject) => {
    const chunks = []
    let totalLength = 0
    let resolved = false

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        cleanup()
        reject(new Error('Connection timeout'))
      }
    }, TIMEOUT_MS)

    function onData(chunk) {
      if (resolved) return
      chunks.push(chunk)
      totalLength += chunk.length

      if (totalLength >= 4) {
        const buf = Buffer.concat(chunks)
        const messageLength = buf.readUInt32LE(0)

        if (buf.length >= 4 + messageLength) {
          resolved = true
          cleanup()
          const message = buf.slice(4, 4 + messageLength).toString('utf8')
          try {
            resolve(JSON.parse(message))
          } catch (e) {
            reject(new Error('Invalid JSON message'))
          }
        }
      }
    }

    function onError(err) {
      if (!resolved) {
        resolved = true
        cleanup()
        reject(err)
      }
    }

    function onEnd() {
      if (!resolved) {
        resolved = true
        cleanup()
        reject(new Error('Connection closed'))
      }
    }

    function cleanup() {
      clearTimeout(timeout)
      process.stdin.removeListener('data', onData)
      process.stdin.removeListener('error', onError)
      process.stdin.removeListener('end', onEnd)
    }

    process.stdin.on('data', onData)
    process.stdin.on('error', onError)
    process.stdin.on('end', onEnd)
  })
}

/**
 * 发送 Native Messaging 消息到浏览器
 */
function sendMessage(response) {
  try {
    const json = JSON.stringify(response)
    const buffer = Buffer.from(json, 'utf8')
    const lengthBuffer = Buffer.alloc(4)
    lengthBuffer.writeUInt32LE(buffer.length, 0)

    process.stdout.write(lengthBuffer)
    process.stdout.write(buffer)
  } catch (e) {
    log('sendMessage error: ' + e.message)
  }
}

/**
 * 发送错误响应
 */
function sendError(code, message) {
  log('sendError: ' + code + ' - ' + message)
  sendMessage({
    success: false,
    error: { code, message }
  })
}

/**
 * 发送成功响应
 */
function sendSuccess(data) {
  sendMessage({
    success: true,
    data
  })
}

/**
 * 连接到主进程 Socket
 */
function connectToMainProcess() {
  return new Promise((resolve, reject) => {
    if (socket && !socket.destroyed && connected) {
      resolve(socket)
      return
    }

    log('Connecting to main process at ' + SOCKET_PATH)

    try {
      socket = net.createConnection(SOCKET_PATH)

      socket.on('connect', () => {
        connected = true
        log('Connected to main process')
        setupSocketListener()
        resolve(socket)
      })

      socket.on('error', (err) => {
        log('Socket error: ' + err.message + ' (code: ' + err.code + ')')
        connected = false
        socket = null

        if (err.code === 'ECONNREFUSED' || err.code === 'ENOENT') {
          reject(new Error('KeyVault app is not running. Please start the app first.'))
        } else {
          reject(err)
        }
      })

      socket.on('close', () => {
        log('Socket closed')
        connected = false
        socket = null
      })

      // 设置超时
      socket.setTimeout(TIMEOUT_MS, () => {
        log('Socket timeout')
        if (socket) socket.destroy()
        reject(new Error('Connection to main process timed out'))
      })
    } catch (e) {
      log('createConnection error: ' + e.message)
      reject(e)
    }
  })
}

/**
 * 设置 Socket 监听器（接收主进程响应）
 */
function setupSocketListener() {
  if (!socket) return

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk])

    while (buffer.length >= 4) {
      const messageLength = buffer.readUInt32LE(0)
      if (buffer.length >= 4 + messageLength) {
        const messageData = buffer.slice(4, 4 + messageLength)
        buffer = buffer.slice(4 + messageLength)
        handleMainProcessResponse(messageData)
      } else {
        break
      }
    }
  })
}

/**
 * 向主进程发送请求并等待响应
 */
async function sendToMainProcess(request) {
  const sock = await connectToMainProcess()

  return new Promise((resolve, reject) => {
    const id = ++requestId
    const timeout = setTimeout(() => {
      pendingRequests.delete(id)
      reject(new Error('Request to main process timed out'))
    }, TIMEOUT_MS)

    pendingRequests.set(id, { resolve, reject, timeout })

    // 发送请求（带 ID 用于匹配响应）
    const message = JSON.stringify({ ...request, _id: id })
    const msgBuffer = Buffer.from(message, 'utf8')
    const lengthBuffer = Buffer.alloc(4)
    lengthBuffer.writeUInt32LE(msgBuffer.length, 0)

    try {
      sock.write(lengthBuffer)
      sock.write(msgBuffer)
      log('Sent request to main process: ' + request.type + '/' + request.action)
    } catch (e) {
      clearTimeout(timeout)
      pendingRequests.delete(id)
      reject(new Error('Failed to send request: ' + e.message))
    }
  })
}

/**
 * 处理主进程响应
 */
function handleMainProcessResponse(data) {
  try {
    const response = JSON.parse(data.toString('utf8'))
    const { _id, ...rest } = response

    log('Received response from main process, id=' + _id)

    if (_id && pendingRequests.has(_id)) {
      const { resolve, reject, timeout } = pendingRequests.get(_id)
      clearTimeout(timeout)
      pendingRequests.delete(_id)

      if (rest.success === false) {
        reject(new Error(rest.error?.message || 'Main process error'))
      } else {
        resolve(rest)
      }
    }
  } catch (e) {
    log('handleMainProcessResponse error: ' + e.message)
  }
}

/**
 * 处理查询请求（转发给主进程）
 */
async function handleQuery(request) {
  try {
    const response = await sendToMainProcess({
      type: 'native-messaging',
      action: 'query',
      ...request
    })

    if (response.success) {
      sendSuccess(response.data)
    } else {
      sendError(response.error?.code || 'QUERY_ERROR', response.error?.message || 'Query failed')
    }
  } catch (error) {
    sendError('MAIN_PROCESS_ERROR', error.message)
  }
}

/**
 * 处理认证请求（转发给主进程）
 */
async function handleAuth(request) {
  try {
    const response = await sendToMainProcess({
      type: 'native-messaging',
      action: 'auth',
      ...request
    })

    if (response.success) {
      sendSuccess(response.data)
    } else {
      sendError(response.error?.code || 'AUTH_ERROR', response.error?.message || 'Auth failed')
    }
  } catch (error) {
    sendError('MAIN_PROCESS_ERROR', error.message)
  }
}

/**
 * 处理消息
 */
async function handleMessage(message) {
  const { type, ...rest } = message

  log('handleMessage: ' + type)

  switch (type) {
    case 'auth':
      await handleAuth(rest)
      break

    case 'query':
      await handleQuery(rest)
      break

    case 'ping':
      sendSuccess({ pong: true, connected })
      break

    case 'disconnect':
      connected = false
      sendSuccess({ disconnected: true })
      if (socket) socket.destroy()
      process.exit(0)
      break

    default:
      sendError('UNKNOWN_TYPE', `Unknown message type: ${type}`)
  }
}

/**
 * 主函数
 */
async function main() {
  log('=== Native Messaging Host Started ===')
  log('Platform: ' + process.platform)
  log('Socket path: ' + SOCKET_PATH)
  log('Node version: ' + process.version)

  // 设置二进制模式
  process.stdin.setEncoding(null)
  process.stdout.setEncoding(null)

  // 初始化与主进程的连接
  try {
    await connectToMainProcess()
    log('Connected to main process successfully')
  } catch (error) {
    log('Failed to connect to main process: ' + error.message)
    sendError('CONNECTION_ERROR', error.message)
    process.exit(1)
    return
  }

  // 消息循环
  while (true) {
    try {
      const message = await readMessage()
      log('Received message from browser: ' + message.type)
      await handleMessage(message)
    } catch (error) {
      if (error.message === 'Connection closed' || error.message === 'Connection timeout') {
        log('Connection ended: ' + error.message)
        process.exit(0)
      }
      log('Error in message loop: ' + error.message)
      sendError('INTERNAL_ERROR', error.message)
    }
  }
}

// 启动
main().catch((error) => {
  log('Fatal error: ' + error.message)
  sendError('STARTUP_ERROR', error.message)
  process.exit(1)
})

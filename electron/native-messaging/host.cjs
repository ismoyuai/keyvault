#!/usr/bin/env node
'use strict'

/**
 * KeyVault Native Messaging Host
 *
 * 处理浏览器扩展的通信请求
 * 协议：Native Messaging (stdin/stdout, JSON)
 */

const { createClient } = require('sql.js')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

// 配置
const DB_PATH = path.join(process.env.APPDATA || process.env.HOME, 'KeyVault', 'keyvault.db')
const TIMEOUT_MS = 5000

// 状态
let db = null
let encryptionKey = null
let connected = false

/**
 * 读取 Native Messaging 消息
 * 协议：4 字节长度前缀 + JSON 数据
 */
function readMessage() {
  return new Promise((resolve, reject) => {
    const chunks = []
    let totalLength = 0

    process.stdin.on('data', (chunk) => {
      chunks.push(chunk)
      totalLength += chunk.length

      // 检查是否收到完整消息
      if (totalLength >= 4) {
        const buffer = Buffer.concat(chunks)
        const messageLength = buffer.readUInt32LE(0)

        if (buffer.length >= 4 + messageLength) {
          const message = buffer.slice(4, 4 + messageLength).toString('utf8')
          try {
            resolve(JSON.parse(message))
          } catch (e) {
            reject(new Error('Invalid JSON message'))
          }
        }
      }
    })

    process.stdin.on('error', reject)
    process.stdin.on('end', () => reject(new Error('Connection closed')))

    // 超时处理
    setTimeout(() => reject(new Error('Connection timeout')), TIMEOUT_MS)
  })
}

/**
 * 发送 Native Messaging 消息
 */
function sendMessage(response) {
  const json = JSON.stringify(response)
  const buffer = Buffer.from(json, 'utf8')
  const lengthBuffer = Buffer.alloc(4)
  lengthBuffer.writeUInt32LE(buffer.length, 0)

  process.stdout.write(lengthBuffer)
  process.stdout.write(buffer)
}

/**
 * 发送错误响应
 */
function sendError(code, message) {
  sendMessage({
    success: false,
    error: {
      code,
      message
    }
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
 * 初始化数据库连接
 */
async function initDatabase() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      throw new Error('Database not found')
    }

    const SQL = await createClient()
    const fileBuffer = fs.readFileSync(DB_PATH)
    db = await SQL.Database(fileBuffer)

    return true
  } catch (error) {
    console.error('Database initialization failed:', error)
    return false
  }
}

/**
 * 设置加密密钥
 */
function setEncryptionKey(key) {
  encryptionKey = Buffer.from(key, 'hex')
}

/**
 * 解密字段
 */
function decryptField(encrypted) {
  if (!encrypted || !encryptionKey) return null

  try {
    const buffer = Buffer.from(encrypted, 'base64')
    const iv = buffer.slice(0, 12)
    const authTag = buffer.slice(12, 28)
    const data = buffer.slice(28)

    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(data)
    decrypted = Buffer.concat([decrypted, decipher.final()])

    return decrypted.toString('utf8')
  } catch (error) {
    console.error('Decryption failed:', error)
    return null
  }
}

/**
 * 处理认证请求
 */
async function handleAuth(request) {
  const { action, masterPassword } = request

  if (action !== 'unlock') {
    sendError('INVALID_ACTION', 'Invalid auth action')
    return
  }

  // 验证主密码（这里简化处理，实际应该验证 Argon2id 哈希）
  // 安全考虑：应该从主进程获取验证结果，而不是在这里验证
  sendError('NOT_IMPLEMENTED', 'Auth should be handled by main app')
}

/**
 * 处理查询请求
 */
async function handleQuery(request) {
  const { action, params } = request

  switch (action) {
    case 'search': {
      const { query, domain } = params || {}
      let sql = 'SELECT id, title, username_encrypted, url, template_id FROM entries WHERE 1=1'
      const args = []

      if (query) {
        sql += ' AND (title LIKE ? OR url LIKE ?)'
        args.push(`%${query}%`, `%${query}%`)
      }

      if (domain) {
        sql += ' AND url LIKE ?'
        args.push(`%${domain}%`)
      }

      sql += ' ORDER BY last_accessed_at DESC LIMIT 20'

      const results = db.exec(sql, args)
      const entries = results.length > 0 ? results[0].values.map(row => ({
        id: row[0],
        title: row[1],
        username: decryptField(row[2]),
        url: row[3],
        templateId: row[4]
      })) : []

      sendSuccess({ entries })
      break
    }

    case 'get': {
      const { id } = params || {}
      if (!id) {
        sendError('MISSING_PARAM', 'Entry ID is required')
        return
      }

      const results = db.exec(
        'SELECT id, title, username_encrypted, password_encrypted, url, template_id, custom_fields_encrypted FROM entries WHERE id = ?',
        [id]
      )

      if (results.length === 0 || results[0].values.length === 0) {
        sendError('NOT_FOUND', 'Entry not found')
        return
      }

      const row = results[0].values[0]
      const entry = {
        id: row[0],
        title: row[1],
        username: decryptField(row[2]),
        password: decryptField(row[3]),
        url: row[4],
        templateId: row[5],
        customFields: row[6] ? JSON.parse(decryptField(row[6]) || '[]') : []
      }

      sendSuccess({ entry })
      break
    }

    case 'match': {
      const { url: targetUrl } = params || {}
      if (!targetUrl) {
        sendError('MISSING_PARAM', 'URL is required')
        return
      }

      // 提取域名
      let domain
      try {
        const urlObj = new URL(targetUrl)
        domain = urlObj.hostname
      } catch {
        domain = targetUrl
      }

      const results = db.exec(
        'SELECT id, title, username_encrypted, url, template_id FROM entries WHERE url LIKE ? AND template_id = "password" ORDER BY last_accessed_at DESC',
        [`%${domain}%`]
      )

      const entries = results.length > 0 ? results[0].values.map(row => ({
        id: row[0],
        title: row[1],
        username: decryptField(row[2]),
        url: row[3],
        templateId: row[4]
      })) : []

      sendSuccess({ entries, domain })
      break
    }

    case 'save': {
      // 保存新凭据（需要额外验证）
      sendError('NOT_IMPLEMENTED', 'Save should be handled by main app')
      break
    }

    default:
      sendError('UNKNOWN_ACTION', `Unknown action: ${action}`)
  }
}

/**
 * 处理消息
 */
async function handleMessage(message) {
  const { type, ...rest } = message

  switch (type) {
    case 'auth':
      await handleAuth(rest)
      break

    case 'query':
      await handleQuery(rest)
      break

    case 'ping':
      sendSuccess({ pong: true, connected: true })
      break

    case 'disconnect':
      connected = false
      sendSuccess({ disconnected: true })
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
  // 设置二进制模式
  process.stdin.setEncoding(null)
  process.stdout.setEncoding(null)

  // 初始化数据库
  const dbInitialized = await initDatabase()
  if (!dbInitialized) {
    sendError('DB_ERROR', 'Failed to initialize database')
    process.exit(1)
  }

  connected = true

  // 消息循环
  while (connected) {
    try {
      const message = await readMessage()
      await handleMessage(message)
    } catch (error) {
      if (error.message === 'Connection closed' || error.message === 'Connection timeout') {
        process.exit(0)
      }
      sendError('INTERNAL_ERROR', error.message)
    }
  }
}

// 启动
main().catch((error) => {
  sendError('STARTUP_ERROR', error.message)
  process.exit(1)
})

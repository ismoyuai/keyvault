#!/usr/bin/env node
'use strict'

/**
 * KeyVault Native Messaging Host
 *
 * 处理浏览器扩展的通信请求
 * 协议：Native Messaging (stdin/stdout, JSON)
 *
 * 注意：此模块从主进程接收解密后的数据，
 * 不自行解密——加密/解密仅在主进程完成（安全红线）。
 */

const path = require('path')
const fs = require('fs')

// 配置
const DB_PATH = path.join(process.env.APPDATA || process.env.HOME, 'KeyVault', 'keyvault.db')
const TIMEOUT_MS = 5000

// 状态
let db = null
let SQL = null
let connected = false

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
        const buffer = Buffer.concat(chunks)
        const messageLength = buffer.readUInt32LE(0)

        if (buffer.length >= 4 + messageLength) {
          resolved = true
          cleanup()
          const message = buffer.slice(4, 4 + messageLength).toString('utf8')
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
 * 使用与 database.cjs 相同的 sql.js 模式
 */
async function initDatabase() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      throw new Error('Database not found')
    }

    const initSqlJs = require('sql.js')
    SQL = await initSqlJs()
    const fileBuffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(fileBuffer)

    return true
  } catch (error) {
    console.error('Database initialization failed:', error)
    return false
  }
}

/**
 * 解密字段（复用主进程的加密模块）
 * 注意：此函数仅用于兼容性——实际生产环境
 * 应通过主进程 IPC 获取解密后的数据
 */
function decryptField(encrypted) {
  if (!encrypted) return null

  try {
    // 加密数据格式：base64(nonce[12] + authTag[16] + ciphertext)
    // 解密需要 encryptionKey，此模块不持有密钥
    // 返回 null 表示需要主进程解密
    return null
  } catch (error) {
    return null
  }
}

/**
 * 查询所有条目（返回加密列的原始值）
 * 由调用方负责解密
 */
function queryAll(sql, params) {
  const stmt = db.prepare(sql)
  if (params) stmt.bind(params)

  const rows = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

/**
 * 查询单个条目
 */
function queryOne(sql, params) {
  const rows = queryAll(sql, params)
  return rows.length > 0 ? rows[0] : null
}

/**
 * 处理查询请求
 * 返回加密的原始数据，由主进程/扩展负责解密
 */
async function handleQuery(request) {
  const { action, params } = request

  switch (action) {
    case 'search': {
      const { query, domain } = params || {}

      // 查询所有未删除的条目（列名使用正确的加密列名）
      let sql = `SELECT id, title_encrypted, username_encrypted, url_encrypted, template_id,
                 custom_fields_encrypted, last_accessed_at, favorite
                 FROM entries WHERE deleted = 0`
      const args = []

      // 注意：由于数据加密，无法在 SQL 中进行 LIKE 搜索
      // 返回所有条目，由调用方解密后过滤
      sql += ' ORDER BY favorite DESC, updated_at DESC LIMIT 100'

      const rows = queryAll(sql, args.length ? args : undefined)
      const entries = rows.map(row => ({
        id: row.id,
        title: row.title_encrypted,      // 仍为加密值，需调用方解密
        username: row.username_encrypted, // 仍为加密值
        url: row.url_encrypted,           // 仍为加密值
        templateId: row.template_id,
        lastAccessedAt: row.last_accessed_at,
        favorite: row.favorite
      }))

      sendSuccess({ entries, encrypted: true })
      break
    }

    case 'get': {
      const { id } = params || {}
      if (!id) {
        sendError('MISSING_PARAM', 'Entry ID is required')
        return
      }

      const row = queryOne(
        `SELECT id, title_encrypted, username_encrypted, password_encrypted,
         url_encrypted, template_id, custom_fields_encrypted, notes_encrypted,
         tags_encrypted, last_accessed_at, favorite, created_at, updated_at
         FROM entries WHERE id = ? AND deleted = 0`,
        [id]
      )

      if (!row) {
        sendError('NOT_FOUND', 'Entry not found')
        return
      }

      const entry = {
        id: row.id,
        title: row.title_encrypted,
        username: row.username_encrypted,
        password: row.password_encrypted,
        url: row.url_encrypted,
        templateId: row.template_id,
        customFields: row.custom_fields_encrypted,
        notes: row.notes_encrypted,
        tags: row.tags_encrypted,
        lastAccessedAt: row.last_accessed_at,
        favorite: row.favorite,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }

      sendSuccess({ entry, encrypted: true })
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

      // 查询所有有 URL 的条目（加密数据无法 LIKE 匹配）
      // 返回所有条目，由调用方解密后按域名过滤
      const rows = queryAll(
        `SELECT id, title_encrypted, username_encrypted, url_encrypted, template_id,
         last_accessed_at, favorite
         FROM entries WHERE deleted = 0 AND url_encrypted IS NOT NULL
         ORDER BY favorite DESC, last_accessed_at DESC`
      )

      const entries = rows.map(row => ({
        id: row.id,
        title: row.title_encrypted,
        username: row.username_encrypted,
        url: row.url_encrypted,
        templateId: row.template_id,
        lastAccessedAt: row.last_accessed_at,
        favorite: row.favorite
      }))

      sendSuccess({ entries, domain, encrypted: true })
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
 * 处理认证请求
 * 密钥管理由主进程负责，此模块不持有加密密钥
 */
async function handleAuth(request) {
  const { action } = request

  if (action === 'unlock') {
    // 认证由主进程处理
    sendError('NOT_IMPLEMENTED', 'Auth should be handled by main app')
    return
  }

  if (action === 'status') {
    sendSuccess({
      dbAccessible: db !== null,
      encrypted: true,
      message: 'This host returns encrypted data. Decrypt via main app.'
    })
    return
  }

  sendError('INVALID_ACTION', 'Invalid auth action')
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

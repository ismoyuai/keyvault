const crypto = require('crypto')
const { upload, download, getLastModified } = require('./webdav-client.cjs')

const REMOTE_PATH = '/keyvault/data.kv'

async function push(localData, deviceId) {
  const payload = {
    version: 1, device_id: deviceId,
    exported_at: new Date().toISOString(),
    data: localData,
    checksum: computeChecksum(localData),
  }
  await upload(REMOTE_PATH, JSON.stringify(payload))
  return { success: true, exported_at: payload.exported_at }
}

async function pull() {
  const content = await download(REMOTE_PATH)
  if (!content) return { data: null, remoteTime: null }
  const payload = JSON.parse(content)
  const expected = computeChecksum(payload.data)
  if (payload.checksum !== expected) throw new Error('数据校验失败，文件可能被篡改')
  return { data: payload.data, remoteTime: payload.exported_at, device_id: payload.device_id }
}

async function getStatus() {
  const remoteTime = await getLastModified(REMOTE_PATH)
  return { lastRemoteSync: remoteTime }
}

function computeChecksum(data) {
  const str = JSON.stringify(data, Object.keys(data).sort())
  return crypto.createHash('sha256').update(str).digest('hex')
}

module.exports = { push, pull, getStatus }

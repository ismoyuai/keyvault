const crypto = require('crypto')
const { upload, download, getLastModified } = require('./webdav-client.cjs')

const REMOTE_PATH = '/keyvault/data.kv'

async function push(localData, deviceId, lastSyncTime) {
  // Only send entries updated since last sync
  let entriesToSend = localData.entries
  if (lastSyncTime) {
    entriesToSend = localData.entries.filter(e => e.updated_at > lastSyncTime)
  }

  const payload = {
    version: 2,
    device_id: deviceId,
    exported_at: new Date().toISOString(),
    data: {
      ...localData,
      entries: entriesToSend,
    },
    checksum: computeChecksum({ ...localData, entries: entriesToSend }),
  }
  await upload(REMOTE_PATH, JSON.stringify(payload))
  return { success: true, exported_at: payload.exported_at, entriesSent: entriesToSend.length }
}

async function pull() {
  const content = await download(REMOTE_PATH)
  if (!content) return { data: null, remoteTime: null }
  const payload = JSON.parse(content)
  const expected = computeChecksum(payload.data)
  if (payload.checksum !== expected) throw new Error('数据校验失败，文件可能被篡改')
  return {
    data: payload.data,
    remoteTime: payload.exported_at,
    device_id: payload.device_id,
    version: payload.version || 1,
  }
}

async function getStatus() {
  const remoteTime = await getLastModified(REMOTE_PATH)
  return { lastRemoteSync: remoteTime }
}

function mergeEntries(localEntries, remoteEntries) {
  const merged = new Map()
  const conflicts = []

  // Add local entries first
  for (const entry of localEntries) {
    merged.set(entry.id, entry)
  }

  // Merge remote entries
  for (const remote of remoteEntries) {
    const local = merged.get(remote.id)
    if (!local) {
      // Remote has, local doesn't -> add
      merged.set(remote.id, remote)
    } else if (remote.updated_at > local.updated_at) {
      // Remote is newer -> overwrite local
      merged.set(remote.id, remote)
    }
    // Local is newer or same -> keep local (do nothing)
  }

  return {
    entries: Array.from(merged.values()),
    conflicts,
  }
}

function computeChecksum(data) {
  const str = JSON.stringify(data, (key, value) => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return Object.keys(value).sort().reduce((sorted, k) => {
        sorted[k] = value[k]
        return sorted
      }, {})
    }
    return value
  })
  return crypto.createHash('sha256').update(str).digest('hex')
}

module.exports = { push, pull, getStatus, mergeEntries }

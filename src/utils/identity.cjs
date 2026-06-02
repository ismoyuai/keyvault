const { v4: uuidv4 } = require('uuid')
const crypto = require('crypto')

let deviceId = null

function getDeviceId(getSetting, setSetting) {
  if (deviceId) return deviceId
  deviceId = getSetting('device_id')
  if (!deviceId) { deviceId = uuidv4(); setSetting('device_id', deviceId) }
  return deviceId
}

function generateId() { return uuidv4() }
function now() { return new Date().toISOString() }
function sha256(data) { return crypto.createHash('sha256').update(data).digest('hex') }

module.exports = { getDeviceId, generateId, now, sha256 }

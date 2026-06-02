const { createClient } = require('webdav')

let client = null

function createWebDAVClient(config) {
  client = createClient(config.url, { username: config.username, password: config.password })
  return client
}

async function testConnection(config) {
  try {
    const testClient = createClient(config.url, { username: config.username, password: config.password })
    await testClient.getDirectoryContents('/')
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
}

async function upload(remotePath, data) {
  if (!client) throw new Error('WebDAV client not initialized')
  const dir = remotePath.substring(0, remotePath.lastIndexOf('/'))
  if (dir) { try { await client.createDirectory(dir, { recursive: true }) } catch {} }
  await client.putFileContents(remotePath, data, { overwrite: true })
}

async function download(remotePath) {
  if (!client) throw new Error('WebDAV client not initialized')
  try {
    const exists = await client.exists(remotePath)
    if (!exists) return null
    return await client.getFileContents(remotePath, { format: 'text' })
  } catch (e) { if (e.status === 404) return null; throw e }
}

async function getLastModified(remotePath) {
  if (!client) throw new Error('WebDAV client not initialized')
  try {
    const stat = await client.stat(remotePath)
    return stat.lastmod ? new Date(stat.lastmod).toISOString() : null
  } catch { return null }
}

module.exports = { createWebDAVClient, testConnection, upload, download, getLastModified }

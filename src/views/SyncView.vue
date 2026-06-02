<template>
  <div class="sync-page">
    <h2 class="page-title">☁️ WebDAV 同步</h2>

    <div class="sync-card">
      <h3>连接配置</h3>
      <el-form :model="config" label-position="top" class="sync-form">
        <el-form-item label="WebDAV 服务器地址">
          <el-input v-model="config.url" placeholder="https://nas.example.com/dav/keyvault/" />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="config.username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="config.password" type="password" show-password />
        </el-form-item>
        <div class="form-actions">
          <el-button @click="testConn" :loading="testing">测试连接</el-button>
          <el-button type="primary" @click="saveConfig">保存配置</el-button>
        </div>
      </el-form>
      <div v-if="testResult" :class="['test-result', testResult.success ? 'success' : 'error']">
        {{ testResult.success ? '✅ 连接成功' : '❌ ' + testResult.error }}
      </div>
    </div>

    <div class="sync-card" v-if="configured">
      <h3>同步操作</h3>
      <div class="sync-info" v-if="status.lastRemoteSync">
        上次远程同步: {{ new Date(status.lastRemoteSync).toLocaleString('zh-CN') }}
      </div>
      <div class="sync-actions">
        <el-button type="primary" @click="doPush" :loading="syncing">
          ⬆️ 推送到云端
        </el-button>
        <el-button @click="doPull" :loading="syncing">
          ⬇️ 从云端拉取
        </el-button>
      </div>
      <div v-if="syncMessage" class="sync-message">{{ syncMessage }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const config = ref({ url: '', username: '', password: '' })
const configured = ref(false)
const testing = ref(false)
const testResult = ref(null)
const syncing = ref(false)
const syncMessage = ref('')
const status = ref({})

onMounted(async () => {
  const settings = await window.keyvault.settings.get()
  if (settings.webdav) {
    config.value = { ...settings.webdav }
    configured.value = true
    loadStatus()
  }
})

async function loadStatus() {
  try { status.value = await window.keyvault.sync.status() } catch {}
}

async function testConn() {
  testing.value = true
  testResult.value = null
  try {
    testResult.value = await window.keyvault.sync.test(config.value)
  } catch (e) {
    testResult.value = { success: false, error: e.message }
  } finally {
    testing.value = false
  }
}

async function saveConfig() {
  await window.keyvault.sync.configure(config.value)
  configured.value = true
  ElMessage.success('配置已保存')
}

async function doPush() {
  syncing.value = true
  syncMessage.value = ''
  try {
    const result = await window.keyvault.sync.push()
    syncMessage.value = '✅ 推送成功'
    loadStatus()
  } catch (e) {
    syncMessage.value = '❌ ' + e.message
  } finally {
    syncing.value = false
  }
}

async function doPull() {
  syncing.value = true
  syncMessage.value = ''
  try {
    const result = await window.keyvault.sync.pull()
    syncMessage.value = result.data ? '✅ 拉取成功' : '⚠️ 云端没有数据'
  } catch (e) {
    syncMessage.value = '❌ ' + e.message
  } finally {
    syncing.value = false
  }
}
</script>

<style scoped>
.sync-page { padding: 20px; max-width: 600px; }
.page-title { font-size: 20px; margin-bottom: 20px; color: var(--text-primary); }
.sync-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 16px;
}
.sync-card h3 { color: var(--text-primary); margin-bottom: 16px; font-size: 16px; }
.sync-form :deep(.el-form-item__label) { color: var(--text-secondary) !important; }
.form-actions { display: flex; gap: 8px; margin-top: 8px; }
.test-result {
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
}
.test-result.success { background: rgba(103,194,58,0.1); color: var(--success); }
.test-result.error { background: rgba(245,108,108,0.1); color: var(--danger); }
.sync-info { color: var(--text-secondary); font-size: 13px; margin-bottom: 16px; }
.sync-actions { display: flex; gap: 12px; }
.sync-message { margin-top: 12px; font-size: 14px; color: var(--text-primary); }
</style>

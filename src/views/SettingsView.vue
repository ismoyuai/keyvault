<template>
  <div class="settings-page">
    <h2 class="page-title">⚙️ 设置</h2>

    <div class="settings-card">
      <h3>安全</h3>
      <div class="setting-item">
        <div class="setting-label">自动锁定</div>
        <el-select v-model="settings.autoLockMinutes" @change="save">
          <el-option :value="5" label="5 分钟" />
          <el-option :value="15" label="15 分钟" />
          <el-option :value="30" label="30 分钟" />
          <el-option :value="0" label="从不" />
        </el-select>
      </div>
      <div class="setting-item">
        <div class="setting-label">剪贴板自动清除</div>
        <el-select v-model="settings.clipboardClearSeconds" @change="save">
          <el-option :value="10" label="10 秒" />
          <el-option :value="30" label="30 秒" />
          <el-option :value="60" label="60 秒" />
        </el-select>
      </div>
    </div>

    <div class="settings-card">
      <h3>外观</h3>
      <div class="setting-item">
        <div class="setting-label">主题</div>
        <el-select v-model="themePreference" @change="setTheme">
          <el-option value="dark" label="暗色" />
          <el-option value="light" label="浅色" />
          <el-option value="system" label="跟随系统" />
        </el-select>
      </div>
    </div>

    <div class="settings-card">
      <h3>密码管理</h3>
      <button class="btn-outline" @click="showChangePwd = true">修改 Master Password</button>
    </div>

    <div class="settings-card">
      <h3>浏览器扩展</h3>
      <div class="extension-status">
        <div class="status-item">
          <span class="status-label">Chrome:</span>
          <span :class="['status-badge', nativeStatus.chromeRegistered ? 'status-success' : 'status-error']">
            {{ nativeStatus.chromeRegistered ? '已注册' : '未注册' }}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">Firefox:</span>
          <span :class="['status-badge', nativeStatus.firefoxRegistered ? 'status-success' : 'status-error']">
            {{ nativeStatus.firefoxRegistered ? '已注册' : '未注册' }}
          </span>
        </div>
      </div>
      <div class="extension-actions">
        <button class="btn-primary" @click="registerNativeHost" :disabled="nativeLoading">
          {{ nativeLoading ? '处理中...' : '注册浏览器扩展' }}
        </button>
        <button class="btn-outline" @click="unregisterNativeHost" :disabled="nativeLoading">
          注销浏览器扩展
        </button>
      </div>
      <p class="extension-hint">
        注册后，Chrome/Firefox 可以通过 Native Messaging 与 KeyVault 通信。
        请确保 KeyVault 应用正在运行。
      </p>
    </div>

    <div class="settings-card">
      <h3>关于</h3>
      <div class="about-info">
        <p>KeyVault v1.0.0</p>
        <p>本地加密密码管理器</p>
        <p>AES-256-GCM + Argon2id</p>
      </div>
    </div>

    <el-dialog v-model="showChangePwd" title="修改 Master Password" width="400px" :append-to-body="true">
      <el-form label-position="top">
        <el-form-item label="当前密码">
          <el-input v-model="pwdForm.old" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.new" type="password" show-password />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="pwdForm.confirm" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showChangePwd = false">取消</el-button>
        <el-button type="primary" @click="changePassword">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useTheme } from '@/composables/useTheme'

const { themePreference, setTheme } = useTheme()

const settings = ref({ autoLockMinutes: 15, clipboardClearSeconds: 30 })
const showChangePwd = ref(false)
const pwdForm = ref({ old: '', new: '', confirm: '' })
const nativeStatus = ref({ chromeRegistered: false, firefoxRegistered: false })
const nativeLoading = ref(false)

onMounted(async () => {
  const s = await window.keyvault.settings.get()
  settings.value = { ...settings.value, ...s }
  await checkNativeStatus()
})

async function save() {
  await window.keyvault.settings.update(settings.value)
  ElMessage.success('已保存')
}

async function changePassword() {
  if (pwdForm.value.new !== pwdForm.value.confirm) {
    ElMessage.error('两次输入的新密码不一致')
    return
  }
  if (pwdForm.value.new.length < 8) {
    ElMessage.error('新密码至少 8 个字符')
    return
  }
  try {
    await window.keyvault.settings.changePassword(pwdForm.value.old, pwdForm.value.new)
    showChangePwd.value = false
    pwdForm.value = { old: '', new: '', confirm: '' }
    ElMessage.success('密码已修改')
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function checkNativeStatus() {
  try {
    nativeStatus.value = await window.keyvault.nativeMessaging.status()
  } catch (e) {
    console.error('Failed to check native status:', e)
  }
}

async function registerNativeHost() {
  nativeLoading.value = true
  try {
    await window.keyvault.nativeMessaging.register()
    await checkNativeStatus()
    ElMessage.success('浏览器扩展注册成功')
  } catch (e) {
    ElMessage.error('注册失败: ' + e.message)
  } finally {
    nativeLoading.value = false
  }
}

async function unregisterNativeHost() {
  nativeLoading.value = true
  try {
    await window.keyvault.nativeMessaging.unregister()
    await checkNativeStatus()
    ElMessage.success('浏览器扩展已注销')
  } catch (e) {
    ElMessage.error('注销失败: ' + e.message)
  } finally {
    nativeLoading.value = false
  }
}
</script>

<style scoped>
.settings-page { padding: 20px; max-width: 600px; }
.page-title { font-size: 20px; margin-bottom: 20px; color: var(--text-primary); }
.settings-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 16px;
}
.settings-card h3 { color: var(--text-primary); margin-bottom: 16px; font-size: 16px; }
.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}
.setting-label { color: var(--text-primary); font-size: 14px; }
.btn-outline {
  padding: 8px 16px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}
.btn-outline:hover { border-color: var(--accent); color: var(--accent); }
.btn-primary {
  padding: 8px 16px;
  background: var(--accent-primary);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s ease;
}
.btn-primary:hover { background: var(--accent-hover); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.extension-status { margin-bottom: 16px; }
.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}
.status-label { color: var(--text-secondary); font-size: 14px; }
.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}
.status-success { background: rgba(76, 175, 80, 0.2); color: #4caf50; }
.status-error { background: rgba(244, 67, 54, 0.2); color: #f44336; }
.extension-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.extension-hint {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}
.about-info { color: var(--text-secondary); font-size: 14px; line-height: 1.8; }
</style>

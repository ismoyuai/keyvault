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
      <h3>密码管理</h3>
      <button class="btn-outline" @click="showChangePwd = true">修改 Master Password</button>
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

const settings = ref({ autoLockMinutes: 15, clipboardClearSeconds: 30 })
const showChangePwd = ref(false)
const pwdForm = ref({ old: '', new: '', confirm: '' })

onMounted(async () => {
  const s = await window.keyvault.settings.get()
  settings.value = { ...settings.value, ...s }
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
.about-info { color: var(--text-secondary); font-size: 14px; line-height: 1.8; }
</style>

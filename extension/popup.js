/**
 * KeyVault Browser Extension - Popup Script
 *
 * 弹出窗口的交互逻辑
 */

// DOM 元素
const statusIndicator = document.getElementById('statusIndicator')
const statusText = document.getElementById('statusText')
const searchInput = document.getElementById('searchInput')
const credentialsList = document.getElementById('credentialsList')
const connectBtn = document.getElementById('connectBtn')
const openAppBtn = document.getElementById('openAppBtn')

// 状态
let isConnected = false
let credentials = []

/**
 * 初始化
 */
async function init() {
  // 检查连接状态
  checkConnectionStatus()

  // 加载凭据
  await loadCredentials()

  // 事件监听
  setupEventListeners()
}

/**
 * 检查连接状态
 */
function checkConnectionStatus() {
  chrome.runtime.sendMessage({ type: 'status' }, (response) => {
    isConnected = response?.connected || false
    updateStatusUI()
  })
}

/**
 * 更新状态 UI
 */
function updateStatusUI() {
  if (isConnected) {
    statusIndicator.classList.add('connected')
    statusText.textContent = '已连接'
    connectBtn.textContent = '断开连接'
    connectBtn.classList.remove('popup-btn-primary')
    connectBtn.classList.add('popup-btn-danger')
  } else {
    statusIndicator.classList.remove('connected')
    statusText.textContent = '未连接'
    connectBtn.textContent = '连接 KeyVault'
    connectBtn.classList.remove('popup-btn-danger')
    connectBtn.classList.add('popup-btn-primary')
  }
}

/**
 * 加载凭据
 */
async function loadCredentials() {
  if (!isConnected) {
    credentialsList.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <p>请先连接到 KeyVault</p>
      </div>
    `
    return
  }

  // 获取当前标签页的 URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentUrl = tabs[0]?.url || ''

    chrome.runtime.sendMessage(
      { type: 'match', url: currentUrl },
      (response) => {
        if (response && !response.error) {
          credentials = response
          renderCredentials()
        } else {
          credentialsList.innerHTML = `
            <div class="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
              <p>未找到匹配的凭据</p>
            </div>
          `
        }
      }
    )
  })
}

/**
 * 渲染凭据列表
 */
function renderCredentials() {
  if (credentials.length === 0) {
    credentialsList.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.3-4.3"/>
        </svg>
        <p>未找到匹配的凭据</p>
      </div>
    `
    return
  }

  credentialsList.innerHTML = credentials.map((cred) => `
    <div class="credential-item" data-id="${cred.id}">
      <div class="credential-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <div class="credential-info">
        <div class="credential-title">${escapeHtml(cred.title)}</div>
        <div class="credential-username">${escapeHtml(cred.username || '无用户名')}</div>
      </div>
      <div class="credential-actions">
        <button class="copy-btn copy-username" data-id="${cred.id}" title="复制用户名">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
          </svg>
        </button>
        <button class="copy-btn copy-password" data-id="${cred.id}" title="复制密码">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('')

  // 添加事件监听
  document.querySelectorAll('.copy-username').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      copyCredential(btn.dataset.id, 'username')
    })
  })

  document.querySelectorAll('.copy-password').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      copyCredential(btn.dataset.id, 'password')
    })
  })

  document.querySelectorAll('.credential-item').forEach((item) => {
    item.addEventListener('click', () => {
      fillCredential(item.dataset.id)
    })
  })
}

/**
 * 复制凭据
 */
async function copyCredential(id, field) {
  chrome.runtime.sendMessage(
    { type: 'get', id },
    (response) => {
      if (response && !response.error) {
        const value = response[field]
        if (value) {
          navigator.clipboard.writeText(value).then(() => {
            showToast(`${field === 'username' ? '用户名' : '密码'}已复制`)
          })
        }
      }
    }
  )
}

/**
 * 填充凭据到当前页面
 */
function fillCredential(id) {
  chrome.runtime.sendMessage(
    { type: 'get', id },
    (response) => {
      if (response && !response.error) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'fill',
              username: response.username,
              password: response.password
            })
            window.close()
          }
        })
      }
    }
  )
}

/**
 * 搜索凭据
 */
async function searchCredentials(query) {
  if (!isConnected) return

  chrome.runtime.sendMessage(
    { type: 'search', query },
    (response) => {
      if (response && !response.error) {
        credentials = response
        renderCredentials()
      }
    }
  )
}

/**
 * 设置事件监听
 */
function setupEventListeners() {
  // 搜索
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim()
    if (query) {
      searchCredentials(query)
    } else {
      loadCredentials()
    }
  })

  // 连接/断开按钮
  connectBtn.addEventListener('click', () => {
    if (isConnected) {
      chrome.runtime.sendMessage({ type: 'disconnect' }, () => {
        isConnected = false
        updateStatusUI()
        loadCredentials()
      })
    } else {
      chrome.runtime.sendMessage({ type: 'connect' }, () => {
        setTimeout(() => {
          checkConnectionStatus()
          loadCredentials()
        }, 1000)
      })
    }
  })

  // 打开应用按钮
  openAppBtn.addEventListener('click', () => {
    // 尝试打开 KeyVault 应用
    chrome.runtime.sendMessage({ type: 'open-app' })
  })
}

/**
 * 显示提示消息
 */
function showToast(message) {
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = message
  document.body.appendChild(toast)

  setTimeout(() => {
    toast.classList.add('show')
  }, 10)

  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 300)
  }, 2000)
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// 初始化
document.addEventListener('DOMContentLoaded', init)

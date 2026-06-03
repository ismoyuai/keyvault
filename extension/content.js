/**
 * KeyVault Browser Extension - Content Script
 *
 * 检测页面中的登录表单
 * 提供自动填充功能
 * 显示密码保存提示
 */

(function() {
  'use strict'

  // 配置
  const FILL_BUTTON_CLASS = 'keyvault-fill-button'
  const SAVE_PROMPT_CLASS = 'keyvault-save-prompt'
  const HIGHLIGHT_CLASS = 'keyvault-highlight'

  // 状态
  let fillButton = null
  let savePrompt = null
  let currentInput = null
  let matchedCredentials = []
  let isInitialized = false

  /**
   * 初始化
   */
  function init() {
    if (isInitialized) return
    isInitialized = true

    // 检测登录表单
    detectLoginForm()

    // 监听 DOM 变化
    const observer = new MutationObserver(() => {
      detectLoginForm()
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    // 监听来自 background 的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'show-save-prompt') {
        showSavePrompt(request.data)
        sendResponse({ success: true })
      }
    })
  }

  /**
   * 检测登录表单
   */
  function detectLoginForm() {
    // 查找密码输入框
    const passwordInputs = document.querySelectorAll('input[type="password"]')
    if (passwordInputs.length === 0) return

    // 查找用户名输入框
    const usernameInputs = document.querySelectorAll(
      'input[type="text"], input[type="email"], input[name*="user"], input[name*="email"], input[id*="user"], input[id*="email"]'
    )

    // 为每个密码输入框添加填充按钮
    passwordInputs.forEach((passwordInput) => {
      if (passwordInput.dataset.keyvaultProcessed) return
      passwordInput.dataset.keyvaultProcessed = 'true'

      // 查找对应的用户名输入框
      const form = passwordInput.closest('form')
      const usernameInput = form
        ? form.querySelector('input[type="text"], input[type="email"]')
        : usernameInputs[0]

      // 添加填充按钮
      addFillButton(passwordInput, usernameInput)

      // 监听输入框聚焦
      passwordInput.addEventListener('focus', () => {
        currentInput = passwordInput
        matchCredentialsForCurrentDomain()
      })

      if (usernameInput) {
        usernameInput.addEventListener('focus', () => {
          currentInput = usernameInput
          matchCredentialsForCurrentDomain()
        })
      }
    })

    // 监听表单提交
    document.querySelectorAll('form').forEach((form) => {
      if (form.dataset.keyvaultProcessed) return
      form.dataset.keyvaultProcessed = 'true'

      form.addEventListener('submit', (event) => {
        handleFormSubmit(form, event)
      })
    })
  }

  /**
   * 添加填充按钮
   */
  function addFillButton(input, usernameInput) {
    const button = document.createElement('div')
    button.className = FILL_BUTTON_CLASS
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    `
    button.title = 'KeyVault - 填充密码'

    // 定位按钮
    const inputRect = input.getBoundingClientRect()
    button.style.position = 'absolute'
    button.style.left = `${inputRect.right - 24}px`
    button.style.top = `${inputRect.top + (inputRect.height - 16) / 2}px`
    button.style.zIndex = '2147483647'

    // 点击事件
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      showCredentialPicker(input, usernameInput)
    })

    document.body.appendChild(button)

    // 监听输入框位置变化
    const resizeObserver = new ResizeObserver(() => {
      const newRect = input.getBoundingClientRect()
      button.style.left = `${newRect.right - 24}px`
      button.style.top = `${newRect.top + (newRect.height - 16) / 2}px`
    })
    resizeObserver.observe(input)
  }

  /**
   * 匹配当前域名的凭据
   */
  function matchCredentialsForCurrentDomain() {
    chrome.runtime.sendMessage(
      { type: 'match', url: window.location.href },
      (response) => {
        if (response && !response.error) {
          matchedCredentials = response
        }
      }
    )
  }

  /**
   * 显示凭据选择器
   */
  function showCredentialPicker(passwordInput, usernameInput) {
    // 移除已存在的选择器
    const existingPicker = document.querySelector('.keyvault-picker')
    if (existingPicker) {
      existingPicker.remove()
    }

    // 创建选择器
    const picker = document.createElement('div')
    picker.className = 'keyvault-picker'

    // 获取匹配的凭据
    chrome.runtime.sendMessage(
      { type: 'match', url: window.location.href },
      (response) => {
        if (response && !response.error && response.length > 0) {
          const list = document.createElement('div')
          list.className = 'keyvault-picker-list'

          response.forEach((credential) => {
            const item = document.createElement('div')
            item.className = 'keyvault-picker-item'
            item.innerHTML = `
              <div class="keyvault-picker-title">${escapeHtml(credential.title)}</div>
              <div class="keyvault-picker-username">${escapeHtml(credential.username || '')}</div>
            `

            item.addEventListener('click', () => {
              fillCredential(credential.id, passwordInput, usernameInput)
              picker.remove()
            })

            list.appendChild(item)
          })

          picker.appendChild(list)
        } else {
          picker.innerHTML = '<div class="keyvault-picker-empty">未找到匹配的凭据</div>'
        }

        // 添加搜索功能
        const searchContainer = document.createElement('div')
        searchContainer.className = 'keyvault-picker-search'
        searchContainer.innerHTML = `
          <input type="text" placeholder="搜索凭据..." class="keyvault-picker-search-input" />
        `
        picker.insertBefore(searchContainer, picker.firstChild)

        // 定位选择器
        const inputRect = passwordInput.getBoundingClientRect()
        picker.style.position = 'absolute'
        picker.style.left = `${inputRect.left}px`
        picker.style.top = `${inputRect.bottom + 4}px`
        picker.style.zIndex = '2147483647'

        document.body.appendChild(picker)

        // 搜索功能
        const searchInput = picker.querySelector('.keyvault-picker-search-input')
        searchInput.addEventListener('input', (e) => {
          const query = e.target.value.toLowerCase()
          const items = picker.querySelectorAll('.keyvault-picker-item')
          items.forEach((item) => {
            const title = item.querySelector('.keyvault-picker-title').textContent.toLowerCase()
            const username = item.querySelector('.keyvault-picker-username').textContent.toLowerCase()
            if (title.includes(query) || username.includes(query)) {
              item.style.display = 'block'
            } else {
              item.style.display = 'none'
            }
          })
        })

        // 点击外部关闭
        document.addEventListener('click', function closePicker(e) {
          if (!picker.contains(e.target) && !e.target.closest(`.${FILL_BUTTON_CLASS}`)) {
            picker.remove()
            document.removeEventListener('click', closePicker)
          }
        })

        searchInput.focus()
      }
    )
  }

  /**
   * 填充凭据
   */
  function fillCredential(credentialId, passwordInput, usernameInput) {
    chrome.runtime.sendMessage(
      { type: 'get', id: credentialId },
      (response) => {
        if (response && !response.error) {
          const { username, password } = response

          if (usernameInput && username) {
            setInputValue(usernameInput, username)
          }

          if (passwordInput && password) {
            setInputValue(passwordInput, password)
          }

          // 高亮填充的字段
          if (usernameInput) highlightInput(usernameInput)
          highlightInput(passwordInput)
        }
      }
    )
  }

  /**
   * 设置输入框的值（触发 React/Vue 等框架的事件）
   */
  function setInputValue(input, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set
    nativeInputValueSetter.call(input, value)

    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }

  /**
   * 高亮输入框
   */
  function highlightInput(input) {
    input.classList.add(HIGHLIGHT_CLASS)
    setTimeout(() => {
      input.classList.remove(HIGHLIGHT_CLASS)
    }, 2000)
  }

  /**
   * 处理表单提交
   */
  function handleFormSubmit(form, event) {
    const passwordInput = form.querySelector('input[type="password"]')
    if (!passwordInput || !passwordInput.value) return

    const usernameInput = form.querySelector(
      'input[type="text"], input[type="email"]'
    )

    const url = window.location.href
    const title = document.title || url

    // 发送保存请求到 background
    chrome.runtime.sendMessage({
      type: 'save',
      url,
      title,
      username: usernameInput?.value || '',
      password: passwordInput.value,
      domain: window.location.hostname
    })
  }

  /**
   * 显示密码保存提示
   */
  function showSavePrompt(data) {
    if (savePrompt) {
      savePrompt.remove()
    }

    savePrompt = document.createElement('div')
    savePrompt.className = SAVE_PROMPT_CLASS
    savePrompt.innerHTML = `
      <div class="keyvault-save-prompt-content">
        <div class="keyvault-save-prompt-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div class="keyvault-save-prompt-text">
          <div class="keyvault-save-prompt-title">保存密码到 KeyVault？</div>
          <div class="keyvault-save-prompt-url">${escapeHtml(data.domain)}</div>
        </div>
        <div class="keyvault-save-prompt-actions">
          <button class="keyvault-save-prompt-save">保存</button>
          <button class="keyvault-save-prompt-dismiss">忽略</button>
        </div>
      </div>
    `

    // 保存按钮
    savePrompt.querySelector('.keyvault-save-prompt-save').addEventListener('click', () => {
      chrome.runtime.sendMessage({
        type: 'save',
        ...data
      })
      savePrompt.remove()
      savePrompt = null
    })

    // 忽略按钮
    savePrompt.querySelector('.keyvault-save-prompt-dismiss').addEventListener('click', () => {
      savePrompt.remove()
      savePrompt = null
    })

    document.body.appendChild(savePrompt)

    // 自动关闭
    setTimeout(() => {
      if (savePrompt) {
        savePrompt.remove()
        savePrompt = null
      }
    }, 10000)
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()

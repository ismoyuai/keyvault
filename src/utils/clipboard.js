let clearTimer = null
let lastCopied = ''

/**
 * 复制文本到剪贴板，30秒后自动清除
 * @param {string} text - 要复制的文本
 * @param {number} clearAfter - 清除延迟（毫秒），默认30000
 */
export async function copyToClipboard(text, clearAfter = 30000) {
  // 清除之前的定时器
  if (clearTimer) {
    clearTimeout(clearTimer)
    clearTimer = null
  }

  // 复制到剪贴板
  if (window.keyvault && window.keyvault.clipboard) {
    await window.keyvault.clipboard.copy(text)
  } else {
    await navigator.clipboard.writeText(text)
  }

  lastCopied = text

  // 设置自动清除
  clearTimer = setTimeout(async () => {
    try {
      // 仅当剪贴板内容仍是我们复制的内容时才清除
      const current = await navigator.clipboard.readText()
      if (current === lastCopied) {
        await navigator.clipboard.writeText('')
      }
    } catch {
      // 某些平台不允许读取剪贴板，忽略
    }
    clearTimer = null
    lastCopied = ''
  }, clearAfter)
}

/**
 * 取消待执行的清除定时器
 */
export function cancelClipboardClear() {
  if (clearTimer) {
    clearTimeout(clearTimer)
    clearTimer = null
  }
}

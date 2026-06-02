let lockTimer = null
let lockCallback = null
let timeoutMs = 15 * 60 * 1000 // 默认 15 分钟

const events = ['mousedown', 'keydown', 'scroll', 'touchstart']

/**
 * 初始化自动锁定
 * @param {Function} onLock - 锁定时的回调
 * @param {number} timeout - 超时时间（毫秒）
 */
export function initAutoLock(onLock, timeout) {
  lockCallback = onLock
  if (timeout) timeoutMs = timeout

  events.forEach(event => {
    document.addEventListener(event, resetTimer, { passive: true })
  })

  resetTimer()
}

/**
 * 重置锁定计时器
 */
function resetTimer() {
  if (lockTimer) clearTimeout(lockTimer)
  lockTimer = setTimeout(() => {
    if (lockCallback) lockCallback()
  }, timeoutMs)
}

/**
 * 更新超时时间
 */
export function setLockTimeout(timeout) {
  timeoutMs = timeout
  resetTimer()
}

/**
 * 停止自动锁定
 */
export function stopAutoLock() {
  if (lockTimer) clearTimeout(lockTimer)
  events.forEach(event => {
    document.removeEventListener(event, resetTimer)
  })
}

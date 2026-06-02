import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { ElMessage } from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import './styles/global.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ElementPlus)

// Global error boundary
app.config.errorHandler = (err, vm, info) => {
  console.error('Unhandled error:', err, info)
  ElMessage.error('发生了一个错误，请重试')
}

// Unhandled promise rejection
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
  ElMessage.error('操作失败，请重试')
})

app.mount('#app')

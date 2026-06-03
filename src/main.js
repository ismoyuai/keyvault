import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as LucideIcons from '@lucide/vue'
import App from './App.vue'
import router from './router'
import './styles/global.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)

// Register commonly used Lucide icons globally
const iconsToRegister = [
  'Key', 'Code', 'FileText', 'Server', 'Cloud', 'Package', 'User',
  'Wallet', 'Terminal', 'File', 'Search', 'Plus', 'Star', 'Heart',
  'Copy', 'Eye', 'EyeOff', 'Trash2', 'Edit', 'Settings', 'Lock',
  'LogOut', 'Folder', 'Globe', 'Shield', 'ChevronRight', 'ChevronLeft',
  'X', 'Check', 'AlertTriangle', 'RefreshCw', 'Download', 'Upload',
  'Sun', 'Moon', 'Monitor', 'Menu', 'MoreVertical', 'ExternalLink',
  'Clock', 'ArrowLeft', 'Home', 'Import', 'Palette', 'Minus', 'Square',
  'Inbox', 'LayoutList',
]
iconsToRegister.forEach(name => {
  if (LucideIcons[name]) {
    app.component(name, LucideIcons[name])
  }
})

app.mount('#app')

// Global error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error)
})
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason)
})

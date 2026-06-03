<template>
  <div class="entry-card" :class="{ selected }" @click="$emit('click')">
    <div class="card-icon">
      <component :is="iconComponent" :size="20" />
    </div>
    <div class="card-info">
      <div class="card-title">{{ entry.title }}</div>
      <div class="card-subtitle">
        <span v-if="entry.username" class="subtitle-user">{{ entry.username }}</span>
        <span v-if="entry.url" class="subtitle-url">{{ displayUrl }}</span>
      </div>
    </div>
    <div class="card-meta">
      <span class="meta-time">{{ timeAgo }}</span>
    </div>
    <div class="card-actions" @click.stop>
      <button v-if="entry.username" class="action-btn" @click="$emit('copyUsername')" title="复制用户名">
        <User :size="14" />
      </button>
      <button class="action-btn" @click="$emit('copyPassword')" title="复制密码">
        <Copy :size="14" />
      </button>
      <button class="action-btn" @click="$emit('toggleFavorite')" title="收藏">
        <Star :size="14" :fill="entry.favorite ? 'currentColor' : 'none'" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { TEMPLATES } from '@/constants/templates'

const props = defineProps({
  entry: { type: Object, required: true },
  selected: { type: Boolean, default: false },
})

defineEmits(['click', 'copyUsername', 'copyPassword', 'toggleFavorite'])

const iconComponent = computed(() => {
  const template = TEMPLATES[props.entry.template_id || props.entry.type]
  return template ? template.icon : 'File'
})

const displayUrl = computed(() => {
  if (!props.entry.url) return ''
  try { return new URL(props.entry.url).hostname } catch { return props.entry.url }
})

const timeAgo = computed(() => {
  const date = props.entry.last_accessed_at || props.entry.updated_at
  if (!date) return ''
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return new Date(date).toLocaleDateString('zh-CN')
})
</script>

<style scoped>
.entry-card {
  display: flex; align-items: center; gap: 12px; padding: 12px 16px;
  background: var(--bg-secondary); border-radius: 8px; cursor: pointer;
  transition: all 0.15s; border: 1px solid transparent;
}
.entry-card:hover { background: var(--bg-hover); border-color: var(--border); }
.entry-card.selected { border-color: var(--accent); background: var(--bg-hover); }
.card-icon {
  width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
  background: var(--bg-tertiary); border-radius: 8px; color: var(--accent); flex-shrink: 0;
}
.card-info { flex: 1; min-width: 0; }
.card-title { font-size: 14px; color: var(--text-primary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-subtitle { display: flex; gap: 8px; font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.subtitle-user { color: var(--accent); }
.subtitle-url { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-meta { flex-shrink: 0; }
.meta-time { font-size: 11px; color: var(--text-secondary); }
.card-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s; }
.entry-card:hover .card-actions { opacity: 1; }
.action-btn {
  width: 28px; height: 28px; border: none; background: var(--bg-tertiary);
  border-radius: 6px; cursor: pointer; color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center; transition: all 0.15s;
}
.action-btn:hover { background: var(--accent); color: white; }
</style>

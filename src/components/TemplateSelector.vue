<template>
  <el-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)"
             title="选择类型" width="520px" :append-to-body="true">
    <div class="template-grid">
      <div v-for="template in TEMPLATE_LIST" :key="template.id"
           class="template-card" @click="selectTemplate(template.id)">
        <div class="template-icon">
          <component :is="template.icon" :size="24" />
        </div>
        <div class="template-name">{{ template.name }}</div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { TEMPLATE_LIST } from '@/constants/templates'

defineProps({ modelValue: { type: Boolean, default: false } })
const emit = defineEmits(['update:modelValue', 'select'])

function selectTemplate(templateId) {
  emit('select', templateId)
  emit('update:modelValue', false)
}
</script>

<style scoped>
.template-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 8px 0; }
.template-card {
  display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px 12px;
  background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 12px;
  cursor: pointer; transition: all 0.15s;
}
.template-card:hover { border-color: var(--accent); background: var(--bg-hover); transform: translateY(-2px); }
.template-icon {
  width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
  background: var(--bg-primary); border-radius: 10px; color: var(--accent);
}
.template-name { font-size: 12px; color: var(--text-primary); text-align: center; }
</style>

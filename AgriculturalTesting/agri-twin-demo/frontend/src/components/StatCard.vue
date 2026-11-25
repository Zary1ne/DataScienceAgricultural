<template>
  <div class="card stat-card">
    <div class="stat-icon" :style="iconStyle">{{ icon }}</div>
    <div class="stat-body">
      <div class="stat-value num">{{ value }}</div>
      <div class="stat-label">{{ label }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  label: String,
  value: [String, Number],
  icon: String,
  color: { type: String, default: "#0071e3" },
});

const iconStyle = computed(() => ({
  color: props.color,
  background: props.color + "1a",
}));
</script>

<style scoped>
.stat-card {
  flex-direction: row;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
}

.stat-icon {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex: 0 0 auto;
}

.stat-value {
  font-size: 30px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1;
  color: #1d1d1f;
}

.stat-label {
  font-size: 13px;
  color: #6e6e73;
  margin-top: 4px;
}
</style>

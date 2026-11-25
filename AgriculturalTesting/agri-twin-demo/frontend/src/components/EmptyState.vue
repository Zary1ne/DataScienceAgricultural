<template>
  <div class="empty-state">
    <div class="empty-icon">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
        <path d="M3 7l9 6 9-6" />
      </svg>
    </div>
    <div class="empty-title">{{ title || "暂无数据" }}</div>
    <div class="empty-hint">{{ hint }}</div>
  </div>
</template>

<script setup>
defineProps({
  title: String,
  hint: String,
});
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.05);
  color: #8e8e93;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
}

.empty-title {
  font-size: 15px;
  font-weight: 500;
  color: #1d1d1f;
}

.empty-hint {
  font-size: 13px;
  color: #8e8e93;
  margin-top: 6px;
}
</style>

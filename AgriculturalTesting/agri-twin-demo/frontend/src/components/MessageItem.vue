<template>
  <div
    class="message-item"
    :class="{ unread: !message.isRead, expanded }"
    @click="$emit('toggle', message)"
  >
    <span v-if="!message.isRead" class="unread-dot"></span>
    <div class="msg-body">
      <div class="msg-top">
        <span class="tag" :class="message.type === 'admin' ? 'tag-orange' : 'tag-blue'">
          {{ message.type === 'admin' ? '管理员' : '系统' }}
        </span>
        <span class="msg-title" :class="{ bold: !message.isRead }">{{ message.title }}</span>
      </div>
      <p class="msg-content" :class="{ clamped: !expanded }">{{ message.content }}</p>
      <div class="msg-time num">{{ message.createdAt }}</div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  message: { type: Object, required: true },
  expanded: Boolean,
});

defineEmits(["toggle"]);
</script>

<style scoped>
.message-item {
  display: flex;
  gap: 12px;
  padding: 16px 18px;
  border-radius: 16px;
  background: linear-gradient(158deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015));
  border: 1px solid rgba(236, 230, 216, 0.07);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.message-item:hover {
  transform: translateY(-1px);
  border-color: rgba(232, 198, 110, 0.24);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.35);
}

.message-item.unread {
  background: rgba(232, 198, 110, 0.07);
  border-color: rgba(232, 198, 110, 0.18);
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e8c66e;
  box-shadow: 0 0 8px rgba(232, 198, 110, 0.6);
  margin-top: 6px;
  flex: 0 0 auto;
}

.msg-body {
  flex: 1;
  min-width: 0;
}

.msg-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.msg-title {
  font-size: 15px;
  color: var(--agri-ink);
}

.msg-title.bold {
  font-weight: 600;
}

.msg-content {
  font-size: 14px;
  color: var(--agri-muted);
  line-height: 1.6;
  margin-top: 8px;
}

.msg-content.clamped {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.msg-time {
  font-size: 12px;
  color: var(--agri-muted);
  margin-top: 8px;
}
</style>

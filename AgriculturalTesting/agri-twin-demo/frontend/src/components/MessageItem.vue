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
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.message-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.message-item.unread {
  background: rgba(255, 255, 255, 0.95);
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #0071e3;
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
  color: #1d1d1f;
}

.msg-title.bold {
  font-weight: 600;
}

.msg-content {
  font-size: 14px;
  color: #6e6e73;
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
  color: #8e8e93;
  margin-top: 8px;
}
</style>

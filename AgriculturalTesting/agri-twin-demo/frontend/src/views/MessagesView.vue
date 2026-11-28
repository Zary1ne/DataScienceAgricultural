<template>
  <div class="page-container">
    <div class="page-head">
      <h1 class="page-title">消息中心</h1>
      <button class="pill-btn pill-btn-ghost" :disabled="!hasUnread" @click="readAll">
        全部标为已读
      </button>
    </div>

    <div class="filters">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="filter-btn"
        :class="{ active: activeTab === t.key }"
        @click="activeTab = t.key"
      >
        {{ t.label }}
      </button>
    </div>

    <div v-if="error" class="error-tip">消息加载失败：后端未连接</div>
    <div v-else-if="filtered.length === 0" class="empty-wrap">
      <EmptyState title="暂无消息" hint="这里会展示系统与管理员的站内消息" />
    </div>
    <div v-else class="msg-list">
      <MessageItem
        v-for="m in filtered"
        :key="m.id"
        :message="m"
        :expanded="expandedId === m.id"
        @toggle="onToggle"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import state, { setUnread, notify } from "../store.js";
import MessageItem from "../components/MessageItem.vue";
import EmptyState from "../components/EmptyState.vue";
import { getMessages, markRead, markAllRead } from "../api.js";

const messages = ref([]);
const error = ref(false);
const activeTab = ref("all");
const expandedId = ref(null);

const tabs = [
  { key: "all", label: "全部" },
  { key: "system", label: "系统消息" },
  { key: "admin", label: "管理员消息" },
];

const filtered = computed(() => {
  if (activeTab.value === "all") return messages.value;
  return messages.value.filter((m) => m.type === activeTab.value);
});

const hasUnread = computed(() => messages.value.some((m) => !m.isRead));

function syncUnread() {
  setUnread(messages.value.filter((m) => !m.isRead).length);
}

async function onToggle(m) {
  expandedId.value = expandedId.value === m.id ? null : m.id;
  if (!m.isRead) {
    try {
      await markRead(m.id);
      m.isRead = true;
      syncUnread();
    } catch (err) {
      notify("操作失败：后端未连接");
    }
  }
}

async function readAll() {
  try {
    await markAllRead();
    messages.value.forEach((m) => (m.isRead = true));
    syncUnread();
  } catch (err) {
    notify("操作失败：后端未连接");
  }
}

onMounted(async () => {
  try {
    messages.value = await getMessages();
    syncUnread();
  } catch (err) {
    error.value = true;
  }
});
</script>

<style scoped>
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.filters {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
}

.filter-btn {
  border: 1px solid var(--agri-line-soft);
  background: rgba(236, 230, 216, 0.04);
  color: var(--agri-muted);
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 980px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.filter-btn:hover {
  color: var(--agri-ink);
}

.filter-btn.active {
  background: rgba(232, 198, 110, 0.14);
  color: var(--agri-gold-bright);
  border-color: rgba(232, 198, 110, 0.36);
  font-weight: 500;
}

.empty-wrap {
  padding: 40px 0;
}

.msg-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 760px;
}
</style>

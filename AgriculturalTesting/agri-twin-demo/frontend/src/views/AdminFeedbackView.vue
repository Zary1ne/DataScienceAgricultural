<template>
  <div>
    <div class="filters">
      <button
        v-for="f in filters"
        :key="f.key"
        class="filter-btn"
        :class="{ active: activeFilter === f.key }"
        @click="activeFilter = f.key"
      >
        {{ f.label }}
      </button>
    </div>

    <div v-if="error" class="error-tip">建议加载失败：后端未连接</div>
    <div v-else-if="filtered.length === 0" class="empty-wrap">
      <EmptyState title="暂无建议" hint="这里会展示用户提交的建议与反馈" />
    </div>
    <div v-else class="feedback-list">
      <div v-for="f in filtered" :key="f.id" class="card feedback-card">
        <div class="fb-head">
          <div class="fb-user">{{ f.user }}</div>
          <span class="tag" :class="f.status === 'pending' ? 'tag-orange' : 'tag-gray'">
            {{ f.status === "pending" ? "待处理" : "已处理" }}
          </span>
        </div>
        <p class="fb-content">{{ f.content }}</p>
        <div class="fb-foot">
          <div class="fb-meta">
            <span class="tag tag-blue">{{ f.category }}</span>
            <span class="fb-time num">{{ f.createdAt }}</span>
          </div>
          <button
            v-if="f.status === 'pending'"
            class="pill-btn pill-btn-sm"
            @click="handle(f)"
          >
            标记已处理
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import EmptyState from "../components/EmptyState.vue";
import { getFeedback, handleFeedback } from "../api.js";
import { notify } from "../store.js";

const list = ref([]);
const error = ref(false);
const activeFilter = ref("all");

const filters = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待处理" },
  { key: "handled", label: "已处理" },
];

const filtered = computed(() => {
  if (activeFilter.value === "all") return list.value;
  return list.value.filter((f) => f.status === activeFilter.value);
});

async function handle(f) {
  try {
    await handleFeedback(f.id);
    f.status = "handled";
    notify("已标记为已处理");
  } catch (err) {
    notify("操作失败：后端未连接");
  }
}

onMounted(async () => {
  try {
    list.value = await getFeedback();
  } catch (err) {
    error.value = true;
  }
});
</script>

<style scoped>
.filters {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
}

.filter-btn {
  border: none;
  background: rgba(236, 230, 216, 0.05);
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
  background: rgba(232, 198, 110, 0.1);
  color: var(--agri-ink);
  font-weight: 500;
}

.empty-wrap {
  padding: 40px 0;
}

.feedback-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feedback-card {
  gap: 0;
}

.fb-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.fb-user {
  font-size: 15px;
  font-weight: 600;
  color: var(--agri-ink);
}

.fb-content {
  font-size: 14px;
  color: var(--agri-ink);
  line-height: 1.6;
  margin-top: 10px;
}

.fb-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(236, 230, 216, 0.09);
}

.fb-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.fb-time {
  font-size: 12px;
  color: var(--agri-muted);
}
</style>

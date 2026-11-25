<template>
  <div>
    <div class="yellow-banner audit-tip">
      ⚠ 社区内容审核流程：用户发布 → 管理员审核 → 公开展示
    </div>

    <div v-if="error" class="error-tip">帖子加载失败：后端未连接</div>
    <div v-else-if="list.length === 0" class="empty-wrap">
      <EmptyState title="暂无待审核帖子" hint="用户发布的帖子会出现在这里" />
    </div>
    <div v-else class="post-list">
      <div v-for="p in list" :key="p.id" class="card audit-card">
        <div class="audit-main">
          <div class="audit-title">{{ p.title }}</div>
          <div class="audit-meta">
            <span class="audit-author">{{ p.author }}</span>
            <span class="tag" :class="p.source === 'miniprogram' ? 'tag-green' : 'tag-blue'">
              {{ p.source === "miniprogram" ? "小程序" : "Web" }}
            </span>
            <span class="audit-time num">{{ p.createdAt }}</span>
          </div>
        </div>
        <div class="audit-right">
          <span class="tag" :class="p.status === 'approved' ? 'tag-green' : 'tag-orange'">
            {{ p.status === "approved" ? "已通过" : "待审核" }}
          </span>
          <button v-if="p.status === 'pending'" class="pill-btn pill-btn-sm" @click="approve(p)">
            通过
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import EmptyState from "../components/EmptyState.vue";
import { getAdminPosts, approvePost } from "../api.js";
import { notify } from "../store.js";

const list = ref([]);
const error = ref(false);

async function approve(p) {
  try {
    await approvePost(p.id);
    p.status = "approved";
    notify("已审核通过");
  } catch (err) {
    notify("操作失败：后端未连接");
  }
}

onMounted(async () => {
  try {
    list.value = await getAdminPosts();
  } catch (err) {
    error.value = true;
  }
});
</script>

<style scoped>
.audit-tip {
  margin-bottom: 18px;
}

.empty-wrap {
  padding: 40px 0;
}

.post-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.audit-card {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.audit-title {
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
}

.audit-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.audit-author {
  font-size: 13px;
  color: #6e6e73;
}

.audit-time {
  font-size: 12px;
  color: #8e8e93;
}

.audit-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
}
</style>

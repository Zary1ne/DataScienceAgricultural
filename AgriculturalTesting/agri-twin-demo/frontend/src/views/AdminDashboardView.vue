<template>
  <div>
    <div v-if="error" class="error-tip">数据加载失败：后端未连接</div>

    <div class="stat-grid">
      <StatCard label="总用户数" :value="dash.stats.totalUsers" icon="👥" color="#0071e3" />
      <StatCard label="今日识别次数" :value="dash.stats.todayDetections" icon="🔍" color="#af52de" />
      <StatCard label="社区帖子数" :value="dash.stats.communityPosts" icon="📝" color="#34c759" />
      <StatCard label="待处理建议" :value="dash.stats.pendingFeedback" icon="💬" color="#ff9f0a" />
    </div>

    <section class="card admin-section">
      <h3 class="card-title">模块开发进度</h3>
      <div class="module-list">
        <div v-for="m in dash.moduleProgress" :key="m.name" class="module-row">
          <div class="module-info">
            <div class="module-name">{{ m.name }}</div>
            <div class="module-owner">{{ m.owner }} · {{ m.status }}</div>
          </div>
          <div class="module-bar">
            <div class="progress">
              <span :style="{ width: m.progress + '%', background: progressColor(m.progress) }"></span>
            </div>
            <span class="module-pct num">{{ m.progress }}%</span>
          </div>
        </div>
      </div>
    </section>

    <section class="card admin-section">
      <h3 class="card-title">最近活动</h3>
      <ul class="timeline">
        <li v-for="(a, i) in dash.recentActivities" :key="i" class="timeline-item">
          <span class="timeline-dot"></span>
          <span class="timeline-text">{{ a.text }}</span>
          <span class="timeline-time num">{{ a.time }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import StatCard from "../components/StatCard.vue";
import { getAdminDashboard } from "../api.js";

const dash = ref({
  stats: { totalUsers: 0, todayDetections: 0, communityPosts: 0, pendingFeedback: 0 },
  moduleProgress: [],
  recentActivities: [],
});
const error = ref(false);

function progressColor(p) {
  if (p >= 80) return "#34c759";
  if (p >= 40) return "#0071e3";
  return "#8e8e93";
}

onMounted(async () => {
  try {
    dash.value = await getAdminDashboard();
  } catch (err) {
    error.value = true;
  }
});
</script>

<style scoped>
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.admin-section {
  gap: 0;
  margin-bottom: 24px;
}

.module-list {
  margin-top: 8px;
}

.module-row {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.module-row:last-child {
  border-bottom: none;
}

.module-info {
  width: 220px;
  flex: 0 0 auto;
}

.module-name {
  font-size: 15px;
  font-weight: 500;
  color: #1d1d1f;
}

.module-owner {
  font-size: 12px;
  color: #8e8e93;
  margin-top: 3px;
}

.module-bar {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 14px;
}

.module-bar .progress {
  flex: 1;
}

.module-pct {
  width: 44px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: #1d1d1f;
}

.timeline {
  margin-top: 8px;
}

.timeline-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.timeline-item:last-child {
  border-bottom: none;
}

.timeline-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #0071e3;
  flex: 0 0 auto;
}

.timeline-text {
  flex: 1;
  font-size: 14px;
  color: #1d1d1f;
}

.timeline-time {
  font-size: 12px;
  color: #8e8e93;
}
</style>

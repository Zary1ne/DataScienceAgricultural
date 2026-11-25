<template>
  <div class="moss-home">
    <!-- 完整滚动故事：漂浮苔藓岛 → 飞入 → 愿景 → 核算/热点 → 站点 → 解决方案 -->
    <MossStory />

    <!-- 农场主体内容 -->
    <main class="moss-main">
      <section class="welcome">
        <div>
          <span class="m-chip">Welcome</span>
          <h2 class="welcome-title">你好，{{ state.user.name }}</h2>
          <p class="welcome-sub">你的农场实时监测中，今日 1 条告警待查看</p>
        </div>
        <button class="m-btn" @click="$router.push('/twin')">
          前往孪生平台 <span class="m-btn-arrow">→</span>
        </button>
      </section>

      <div class="cols">
        <section class="col">
          <div class="sec-head">
            <span class="m-chip">Policy</span>
            <h2 class="sec-title">政策资讯</h2>
          </div>
          <div v-if="error" class="error-tip">数据加载失败：后端未连接</div>
          <NewsCard v-for="p in data.policies" :key="p.id" :news="p" />
        </section>

        <section class="col">
          <div class="sec-head">
            <span class="m-chip">Market</span>
            <h2 class="sec-title">农业股票</h2>
          </div>
          <StockCard v-for="s in data.stocks" :key="s.code" :stock="s" />
        </section>
      </div>

      <section class="notice">
        <div class="sec-head">
          <span class="m-chip">Notice</span>
          <h2 class="sec-title">平台公告</h2>
        </div>
        <ul class="notice-list">
          <li v-for="a in data.announcements" :key="a.id" class="notice-item">
            <span class="notice-title">{{ a.title }}</span>
            <span class="m-mono notice-date">{{ a.date }}</span>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import state from "../store.js";
import MossStory from "../components/MossStory.vue";
import NewsCard from "../components/NewsCard.vue";
import StockCard from "../components/StockCard.vue";
import { getHome } from "../api.js";

const data = ref({ policies: [], stocks: [], announcements: [] });
const error = ref(false);

onMounted(async () => {
  try {
    data.value = await getHome();
  } catch (err) {
    error.value = true;
  }
});
</script>

<style scoped>
.moss-home {
  background: var(--mist);
  font-family: var(--sans);
  color: var(--ink);
  min-height: 100%;
}

.moss-main {
  max-width: 1280px;
  margin: 0 auto;
  padding: 56px 24px 80px;
}

.welcome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  margin-bottom: 48px;
}

.welcome-title {
  font-size: clamp(30px, 3.4vw, 46px);
  font-weight: 500;
  letter-spacing: -0.03em;
  color: var(--ink);
  margin-top: 14px;
}

.welcome-sub {
  font-size: 15px;
  color: var(--ink2);
  margin-top: 8px;
}

.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 48px;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sec-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 6px;
}

.sec-title {
  font-size: 24px;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--ink);
}

.notice {
  border-top: 1px solid rgba(16, 41, 26, 0.1);
  padding-top: 40px;
}

.notice-list {
  display: flex;
  flex-direction: column;
}

.notice-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid rgba(16, 41, 26, 0.1);
}

.notice-item:last-child {
  border-bottom: none;
}

.notice-title {
  font-size: 15px;
  color: var(--ink);
}

.notice-date {
  white-space: nowrap;
  color: var(--ink2);
  opacity: 0.7;
}

.error-tip {
  font-size: 13px;
  color: #d70015;
  padding: 20px 0;
}

@media (max-width: 820px) {
  .cols {
    grid-template-columns: 1fr;
  }
  .moss-main {
    padding: 40px 18px 60px;
  }
}
</style>

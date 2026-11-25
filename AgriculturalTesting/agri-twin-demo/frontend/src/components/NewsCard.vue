<template>
  <article class="m-card news-card">
    <div class="news-top">
      <span class="m-chip">政策</span>
      <span class="m-mono news-date">{{ news.date }}</span>
    </div>
    <h3 class="news-title">{{ news.title }}</h3>
    <p class="news-summary">{{ news.summary }}</p>
    <div class="news-foot">
      <span class="news-source">{{ news.source }}</span>
      <span class="news-arrow">→</span>
    </div>
  </article>
</template>

<script setup>
defineProps({
  news: { type: Object, required: true },
});
</script>

<style scoped>
.news-card {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.news-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.news-date {
  opacity: 0.7;
}

.news-title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--ink);
  line-height: 1.4;
}

.news-summary {
  font-size: 14px;
  color: var(--ink2);
  margin-top: 8px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(16, 41, 26, 0.08);
}

.news-source {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--ink2);
  opacity: 0.85;
}

.news-arrow {
  font-size: 15px;
  color: var(--ink2);
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.news-card:hover .news-arrow {
  transform: translateX(4px);
  color: #4f8a12;
}
</style>

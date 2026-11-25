<template>
  <div class="card card-hover post-card" @click="$emit('open', post)">
    <div class="post-head">
      <div class="avatar post-avatar" :style="avatarStyle">{{ post.avatar }}</div>
      <div class="post-author">
        <div class="post-author-name">{{ post.author }}</div>
        <div class="post-tags-line">
          <span class="tag" :class="sourceClass">{{ sourceLabel }}</span>
          <span v-if="post.authorRole === 'admin'" class="tag tag-orange">管理员</span>
          <span class="post-time num">{{ post.createdAt }}</span>
        </div>
      </div>
    </div>

    <h3 class="post-title">{{ post.title }}</h3>
    <p class="post-content">{{ post.content }}</p>

    <div v-if="post.tags && post.tags.length" class="post-hashtags">
      <span v-for="t in post.tags" :key="t" class="post-tag">#{{ t }}</span>
    </div>

    <div class="post-foot">
      <button
        class="post-stat post-like"
        :class="{ liked }"
        @click.stop="$emit('like', post)"
      >
        <span class="like-icon">👍</span> {{ post.likes }}
      </button>
      <button class="post-stat post-like" @click.stop="$emit('open', post)">
        <span class="like-icon">💬</span> {{ post.comments }}
      </button>
      <span class="post-more">查看详情 →</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  post: { type: Object, required: true },
  liked: { type: Boolean, default: false },
});

defineEmits(["like", "open"]);

const sourceLabel = computed(() =>
  props.post.source === "miniprogram" ? "小程序" : "Web"
);

const sourceClass = computed(() =>
  props.post.source === "miniprogram" ? "tag-green" : "tag-blue"
);

const avatarStyle = computed(() => {
  const palette = ["#0071e3", "#34c759", "#ff9f0a", "#af52de", "#ff375f", "#5e5ce6"];
  const char = props.post.avatar || "用";
  let sum = 0;
  for (let i = 0; i < char.length; i++) sum += char.charCodeAt(i);
  return { background: palette[sum % palette.length] };
});
</script>

<style scoped>
.post-card {
  gap: 0;
}

.post-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.post-avatar {
  width: 40px;
  height: 40px;
  font-size: 16px;
}

.post-author {
  flex: 1;
  min-width: 0;
}

.post-author-name {
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
}

.post-tags-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.post-time {
  font-size: 12px;
  color: #8e8e93;
}

.post-title {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #1d1d1f;
  margin-top: 16px;
}

.post-content {
  font-size: 14px;
  color: #6e6e73;
  line-height: 1.6;
  margin-top: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.post-hashtags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.post-tag {
  font-size: 12px;
  color: #0071e3;
  background: rgba(0, 113, 227, 0.08);
  padding: 3px 10px;
  border-radius: 980px;
}

.post-foot {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.post-stat {
  font-size: 13px;
  color: #8e8e93;
}

.post-like {
  border: none;
  background: rgba(0, 0, 0, 0.04);
  padding: 6px 12px;
  border-radius: 980px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.2s ease;
}

.post-like:hover {
  background: rgba(0, 0, 0, 0.08);
}

.post-like.liked {
  background: rgba(0, 113, 227, 0.12);
  color: #0071e3;
}

.like-icon {
  font-size: 13px;
}

.post-more {
  margin-left: auto;
  font-size: 12px;
  color: #aeaeb2;
}
</style>

<template>
  <div class="card card-hover post-card" @click="$emit('open', post)">
    <div class="post-head">
      <Avatar
        :name="post.author"
        :seed="post.userId || post.author"
        :url="post.authorAvatar"
        :size="40"
      />
      <div class="post-author">
        <div class="post-author-name">{{ post.author }}</div>
        <div class="post-tags-line">
          <span class="tag" :class="sourceClass">{{ sourceLabel }}</span>
          <span v-if="post.authorRole === 'admin'" class="tag tag-orange">管理员</span>
          <span v-if="post.status === 'pending'" class="tag tag-orange">审核中</span>
          <span v-if="post.readme" class="tag tag-blue">README</span>
          <span v-if="post.attachments && post.attachments.length" class="tag tag-gray">
            附件 {{ post.attachments.length }}
          </span>
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
      <button
        class="post-stat post-like"
        :class="{ favorited }"
        @click.stop="$emit('favorite', post)"
      >
        <span class="like-icon">{{ favorited ? "★" : "☆" }}</span>
        {{ favorited ? "已收藏" : "收藏" }}
      </button>
      <button class="post-stat post-like" @click.stop="$emit('open', post)">
        <span class="like-icon">💬</span> {{ post.comments }}
      </button>
      <span v-if="canEdit || canDelete" class="post-manage">
        <button v-if="canEdit" class="mini-link" @click.stop="$emit('edit', post)">编辑</button>
        <button v-if="canDelete" class="mini-link danger" @click.stop="$emit('delete', post)">
          删除
        </button>
      </span>
      <span class="post-more">查看详情 →</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import Avatar from "./Avatar.vue";

const props = defineProps({
  post: { type: Object, required: true },
  liked: { type: Boolean, default: false },
  favorited: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: false },
  canDelete: { type: Boolean, default: false },
});

defineEmits(["like", "favorite", "edit", "delete", "open"]);

const sourceLabel = computed(() =>
  props.post.source === "miniprogram" ? "小程序" : "Web"
);

const sourceClass = computed(() =>
  props.post.source === "miniprogram" ? "tag-green" : "tag-blue"
);
</script>

<style scoped>
.post-card {
  gap: 0;
  border-radius: 20px;
  overflow: hidden;
  cursor: pointer;
}

.post-card::after {
  content: "";
  position: absolute;
  left: 0;
  top: 20px;
  bottom: 20px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--agri-lime-deep);
  opacity: 0;
  transform: scaleY(0.35);
  transition: opacity 0.45s var(--agri-ease), transform 0.45s var(--agri-ease);
}

.post-card:hover::after {
  opacity: 1;
  transform: scaleY(1);
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
  font-size: 14.5px;
  font-weight: 600;
  color: var(--agri-ink);
}

.post-tags-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.post-time {
  font-size: 11.5px;
  color: var(--agri-muted);
}

.post-title {
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.025em;
  color: var(--agri-ink);
  margin-top: 16px;
}

.post-content {
  font-size: 13.5px;
  color: var(--agri-muted);
  line-height: 1.65;
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
  font-size: 11.5px;
  color: #ecd9a4;
  background: rgba(232, 198, 110, 0.12);
  padding: 3px 10px;
  border-radius: 999px;
}

.post-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--agri-line-soft);
}

.post-stat {
  font-size: 12.5px;
  color: var(--agri-muted);
}

.post-like {
  border: 1px solid transparent;
  background: rgba(236, 230, 216, 0.06);
  padding: 6px 11px;
  border-radius: 999px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.25s var(--agri-ease);
}

.post-like:hover {
  background: rgba(236, 230, 216, 0.1);
  color: var(--agri-ink);
}

.post-like.liked {
  background: rgba(232, 198, 110, 0.18);
  color: #f0dca8;
  border-color: rgba(232, 198, 110, 0.4);
}

.post-like.favorited {
  background: rgba(231, 180, 90, 0.14);
  color: #f0c083;
  border-color: rgba(231, 180, 90, 0.3);
}

.post-manage {
  display: inline-flex;
  gap: 10px;
}

.mini-link {
  border: none;
  background: transparent;
  color: var(--agri-muted);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
}

.mini-link:hover {
  color: #e8c66e;
}

.mini-link.danger:hover {
  color: #ff3b30;
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

<template>
  <div class="page-container">
    <div class="page-head">
      <h1 class="page-title">共享社区</h1>
      <button class="pill-btn" @click="openModal">发布案例</button>
    </div>

    <div class="yellow-banner community-tip">
      ⚠ 社区内容审核功能开发中，当前发布的帖子仅本地可见
    </div>

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

    <div v-if="error" class="error-tip">帖子加载失败：后端未连接</div>
    <div v-else-if="filteredPosts.length === 0" class="empty-wrap">
      <EmptyState title="暂无帖子" hint="换个筛选条件试试" />
    </div>
    <div v-else class="post-list">
      <PostCard
        v-for="p in filteredPosts"
        :key="p.id"
        :post="p"
        :liked="isLiked(p.id)"
        @like="onLike"
        @open="openDetail"
      />
    </div>

    <transition name="fade">
      <div v-if="detailOpen" class="modal-mask" @click.self="closeDetail">
        <div class="modal card detail-modal">
          <div class="detail-head">
            <div>
              <h3 class="detail-title">{{ detailPost.title }}</h3>
              <div class="detail-meta">
                <span>{{ detailPost.author }}</span>
                <span class="detail-time num">{{ detailPost.createdAt }}</span>
              </div>
            </div>
            <button class="detail-close" @click="closeDetail">×</button>
          </div>
          <p class="detail-content">{{ detailPost.content }}</p>
          <div v-if="detailPost.tags && detailPost.tags.length" class="post-hashtags">
            <span v-for="t in detailPost.tags" :key="t" class="post-tag">#{{ t }}</span>
          </div>

          <div class="comment-head">评论 · {{ comments.length }}</div>
          <div class="comment-list">
            <div v-for="c in comments" :key="c.id" class="comment-item">
              <div class="avatar cm-avatar">{{ c.avatar }}</div>
              <div class="cm-body">
                <div class="cm-meta">
                  <span class="cm-author">{{ c.author }}</span>
                  <span class="cm-time num">{{ c.createdAt }}</span>
                </div>
                <div class="cm-content">{{ c.content }}</div>
              </div>
            </div>
            <div v-if="!comments.length" class="comment-empty">还没有评论，来说两句吧</div>
          </div>

          <div class="comment-form">
            <input
              v-model="commentText"
              placeholder="写下你的看法…"
              @keyup.enter="submitComment"
            />
            <button
              class="pill-btn"
              :disabled="!commentText.trim() || commenting"
              @click="submitComment"
            >
              {{ commenting ? "发送中…" : "发送" }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div v-if="modalOpen" class="modal-mask" @click.self="closeModal">
        <div class="modal card">
          <h3 class="card-title">发布案例</h3>
          <label class="field">
            <span class="field-label">标题</span>
            <input v-model="form.title" placeholder="请输入标题" />
          </label>
          <label class="field">
            <span class="field-label">内容</span>
            <textarea v-model="form.content" rows="5" placeholder="分享你的种植经验……"></textarea>
          </label>
          <label class="field">
            <span class="field-label">标签（用逗号分隔）</span>
            <input v-model="form.tags" placeholder="水稻, 病害防治" />
          </label>
          <div v-if="formError" class="login-error">{{ formError }}</div>
          <div class="modal-actions">
            <button class="pill-btn pill-btn-ghost" @click="closeModal">取消</button>
            <button class="pill-btn" :disabled="submitting" @click="submitPost">
              {{ submitting ? "发布中…" : "发布" }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import state from "../store.js";
import PostCard from "../components/PostCard.vue";
import EmptyState from "../components/EmptyState.vue";
import { getPosts, createPost, likePost, getComments, addComment } from "../api.js";
import { notify } from "../store.js";

const posts = ref([]);
const error = ref(false);
const activeFilter = ref("all");
const modalOpen = ref(false);
const submitting = ref(false);
const form = ref({ title: "", content: "", tags: "" });
const formError = ref("");

// —— 点赞 ——
const likedIds = ref([]);

function isLiked(id) {
  return likedIds.value.includes(id);
}

async function onLike(post) {
  try {
    const res = await likePost(post.id);
    post.likes = res.likes;
    if (res.liked) {
      if (!likedIds.value.includes(post.id)) likedIds.value.push(post.id);
    } else {
      likedIds.value = likedIds.value.filter((id) => id !== post.id);
    }
  } catch (err) {
    notify("点赞失败：后端未连接");
  }
}

// —— 帖子详情与评论 ——
const detailOpen = ref(false);
const detailPost = ref({});
const comments = ref([]);
const commentText = ref("");
const commenting = ref(false);

async function openDetail(post) {
  detailPost.value = post;
  comments.value = [];
  detailOpen.value = true;
  try {
    comments.value = await getComments(post.id);
  } catch (err) {
    // 后端离线时保持空列表
  }
}

function closeDetail() {
  detailOpen.value = false;
  commentText.value = "";
}

async function submitComment() {
  const content = commentText.value.trim();
  if (!content || commenting.value) return;
  commenting.value = true;
  try {
    const res = await addComment(detailPost.value.id, content);
    comments.value.push(res.comment);
    detailPost.value.comments = res.comments;
    commentText.value = "";
  } catch (err) {
    notify("评论发送失败：后端未连接");
  } finally {
    commenting.value = false;
  }
}

const filters = [
  { key: "all", label: "全部" },
  { key: "mine", label: "我的发布" },
  { key: "mini", label: "来自小程序" },
  { key: "admin", label: "管理员发布" },
];

const filteredPosts = computed(() => {
  if (activeFilter.value === "all") return posts.value;
  if (activeFilter.value === "mine") {
    return posts.value.filter((p) => p.author === (state.user && state.user.name));
  }
  if (activeFilter.value === "mini") {
    return posts.value.filter((p) => p.source === "miniprogram");
  }
  if (activeFilter.value === "admin") {
    return posts.value.filter((p) => p.authorRole === "admin");
  }
  return posts.value;
});

function openModal() {
  form.value = { title: "", content: "", tags: "" };
  formError.value = "";
  modalOpen.value = true;
}

function closeModal() {
  modalOpen.value = false;
}

async function submitPost() {
  if (!form.value.title.trim() || !form.value.content.trim()) {
    formError.value = "标题和内容不能为空";
    return;
  }
  submitting.value = true;
  formError.value = "";
  try {
    const tags = form.value.tags
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const post = await createPost({
      title: form.value.title.trim(),
      content: form.value.content.trim(),
      tags,
    });
    posts.value.unshift(post);
    closeModal();
    notify("发布成功（本地可见）");
  } catch (err) {
    formError.value = err.code === "NETWORK_ERROR" ? "后端未连接" : "发布失败";
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  try {
    posts.value = await getPosts();
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

.community-tip {
  margin-bottom: 18px;
}

.filters {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
}

.filter-btn {
  border: none;
  background: rgba(0, 0, 0, 0.04);
  color: #6e6e73;
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 980px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.filter-btn:hover {
  color: #1d1d1f;
}

.filter-btn.active {
  background: rgba(0, 113, 227, 0.12);
  color: #0071e3;
  font-weight: 500;
}

.empty-wrap {
  padding: 40px 0;
}

.post-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* —— 帖子详情与评论 —— */
.detail-modal {
  width: 560px;
  max-height: 82vh;
  overflow-y: auto;
  gap: 14px;
  background: rgba(255, 255, 255, 0.97);
}

.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.detail-title {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #1d1d1f;
}

.detail-meta {
  display: flex;
  gap: 10px;
  margin-top: 6px;
  font-size: 12px;
  color: #8e8e93;
}

.detail-close {
  border: none;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  color: #8e8e93;
  cursor: pointer;
  padding: 0 2px;
}

.detail-close:hover {
  color: #1d1d1f;
}

.detail-content {
  font-size: 14px;
  line-height: 1.7;
  color: #3c3c43;
}

.post-hashtags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.post-tag {
  font-size: 12px;
  color: #0071e3;
  background: rgba(0, 113, 227, 0.08);
  padding: 3px 10px;
  border-radius: 980px;
}

.comment-head {
  font-size: 13px;
  font-weight: 600;
  color: #1d1d1f;
  padding-top: 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.comment-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 260px;
  overflow-y: auto;
}

.comment-item {
  display: flex;
  gap: 10px;
}

.cm-avatar {
  width: 32px;
  height: 32px;
  font-size: 13px;
  flex: 0 0 auto;
}

.cm-body {
  flex: 1;
  min-width: 0;
}

.cm-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cm-author {
  font-size: 13px;
  font-weight: 500;
  color: #1d1d1f;
}

.cm-time {
  font-size: 11px;
  color: #aeaeb2;
}

.cm-content {
  font-size: 13px;
  line-height: 1.65;
  color: #6e6e73;
  margin-top: 4px;
}

.comment-empty {
  font-size: 13px;
  color: #aeaeb2;
  padding: 10px 0;
}

.comment-form {
  display: flex;
  gap: 10px;
}

.comment-form input {
  flex: 1;
  border: none;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 14px;
  color: #1d1d1f;
  outline: none;
}

.comment-form input:focus {
  background: rgba(0, 113, 227, 0.06);
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.15);
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 24px;
}

.modal {
  width: 480px;
  max-width: 100%;
  gap: 16px;
  background: rgba(255, 255, 255, 0.95);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  color: #6e6e73;
}

.field input,
.field textarea {
  border: none;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 15px;
  color: #1d1d1f;
  outline: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.field input:focus,
.field textarea:focus {
  background: rgba(0, 113, 227, 0.06);
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.15);
}

.field textarea {
  resize: vertical;
}

.login-error {
  font-size: 13px;
  color: #ff3b30;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>

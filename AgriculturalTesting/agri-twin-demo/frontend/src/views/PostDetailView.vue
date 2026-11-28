<template>
  <div class="post-page">
    <div class="post-topbar">
      <button class="back-btn" @click="router.push('/community')">← 返回社区</button>
      <div class="top-actions">
        <button class="ghost-btn" :class="{ active: post.favorited }" @click="toggleFavorite">
          {{ post.favorited ? "已收藏" : "收藏" }}
        </button>
        <button v-if="canDelete" class="ghost-btn danger" @click="removePost">删除</button>
      </div>
    </div>

    <div v-if="loading" class="state-tip">正在加载帖子…</div>
    <div v-else-if="error" class="state-tip error">
      帖子不存在或尚未通过审核
      <button class="link-btn" @click="router.push('/community')">返回社区</button>
    </div>

    <template v-else>
      <header class="post-hero">
        <div class="hero-top">
          <Avatar
            :name="post.author"
            :seed="post.userId || post.author"
            :url="post.authorAvatar"
            :size="46"
          />
          <div class="hero-author">
            <div class="author-name">{{ post.author }}</div>
            <div class="author-meta num">{{ post.createdAt }}</div>
          </div>
          <span class="tag" :class="post.status === 'approved' ? 'tag-green' : 'tag-orange'">
            {{ post.status === "approved" ? "已发布" : "审核中" }}
          </span>
        </div>
        <h1 class="post-title">{{ post.title }}</h1>
        <p class="post-lede">{{ post.content }}</p>
        <div v-if="post.tags && post.tags.length" class="post-tags">
          <span v-for="tag in post.tags" :key="tag" class="post-tag">#{{ tag }}</span>
        </div>
        <div class="hero-stats num">
          <span>{{ post.likes }} 赞同</span>
          <span>{{ post.comments }} 评论</span>
          <span>{{ (post.attachments || []).length }} 个附件</span>
        </div>
      </header>

      <div class="post-layout">
        <main ref="readerRef" class="readme-card" :class="{ fullscreen: fullscreen }">
          <div class="readme-toolbar">
            <div class="readme-label">
              <span class="readme-dot"></span>
              README
            </div>
            <button class="ghost-btn small" @click="toggleFullscreen">
              {{ fullscreen ? "退出全屏" : "全屏阅读" }}
            </button>
          </div>
          <article class="markdown-body" v-html="renderedReadme"></article>
        </main>

        <aside class="post-side">
          <section class="side-card">
            <h3 class="side-title">附件</h3>
            <div v-if="!(post.attachments || []).length" class="side-empty">暂无附件</div>
            <a
              v-for="file in post.attachments"
              :key="file.url"
              class="file-item"
              :href="file.url"
              :download="file.name"
              target="_blank"
              rel="noopener"
            >
              <span class="file-name">{{ file.name }}</span>
              <span class="file-size num">{{ formatSize(file.size) }}</span>
            </a>
          </section>
          <section class="side-card">
            <h3 class="side-title">关于作者</h3>
            <div class="author-card">
              <Avatar
                :name="post.author"
                :seed="post.userId || post.author"
                :url="post.authorAvatar"
                :size="44"
              />
              <div>
                <div class="author-name">{{ post.author }}</div>
                <div class="author-role">
                  {{ post.authorRole === "admin" ? "管理员" : "社区用户" }}
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <section class="replies">
        <div class="replies-head">
          <h2>评论 · {{ post.comments }}</h2>
        </div>

        <div class="composer">
          <Avatar
            :name="(state.user && state.user.name) || ''"
            :seed="(state.user && state.user.id) || ''"
            :url="(state.user && state.user.avatar) || ''"
            :size="40"
          />
          <div class="composer-body">
            <textarea
              v-model="draft"
              rows="2"
              :placeholder="replyTo ? `回复 @${replyTo.author}…` : '发布你的评论…'"
            ></textarea>
            <div class="composer-foot">
              <span v-if="replyTo" class="reply-hint">
                回复 @{{ replyTo.author }}
                <button class="link-btn" @click="replyTo = null">取消</button>
              </span>
              <button
                class="reply-submit"
                :disabled="!draft.trim() || posting"
                @click="submitComment"
              >
                {{ posting ? "发送中…" : "回复" }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="!topComments.length" class="replies-empty">还没有评论，来说两句吧</div>

        <article v-for="comment in topComments" :key="comment.id" class="reply">
          <Avatar
            :name="comment.author"
            :seed="comment.userId || comment.author"
            :url="comment.avatarUrl"
            :size="40"
          />
          <div class="reply-body">
            <div class="reply-meta">
              <span class="reply-author">{{ comment.author }}</span>
              <span class="reply-handle">@{{ comment.userId || "user" }}</span>
              <span class="reply-time num">{{ comment.createdAt }}</span>
            </div>
            <p class="reply-text">{{ comment.content }}</p>
            <div class="reply-actions">
              <button @click="setReply(comment)">回复</button>
              <button :class="{ liked: comment.liked }" @click="like(comment)">
                ♥ {{ comment.likes }}
              </button>
              <button v-if="canDeleteComment(comment)" class="danger" @click="removeComment(comment)">
                删除
              </button>
            </div>

            <div v-for="child in childrenOf(comment.id)" :key="child.id" class="reply child">
              <Avatar
                :name="child.author"
                :seed="child.userId || child.author"
                :url="child.avatarUrl"
                :size="32"
              />
              <div class="reply-body">
                <div class="reply-meta">
                  <span class="reply-author">{{ child.author }}</span>
                  <span class="reply-handle">@{{ child.userId || "user" }}</span>
                  <span class="reply-time num">{{ child.createdAt }}</span>
                </div>
                <p class="reply-text">
                  <span class="mention">回复 @{{ comment.author }}</span>
                  {{ child.content }}
                </p>
                <div class="reply-actions">
                  <button @click="setReply(comment, child)">回复</button>
                  <button :class="{ liked: child.liked }" @click="like(child)">
                    ♥ {{ child.likes }}
                  </button>
                  <button
                    v-if="canDeleteComment(child)"
                    class="danger"
                    @click="removeComment(child)"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { marked } from "marked";
import DOMPurify from "dompurify";
import state, { notify } from "../store.js";
import Avatar from "../components/Avatar.vue";
import {
  getPost,
  getComments,
  addComment,
  likeComment,
  deleteComment,
  deletePost,
  favoritePost,
  unfavoritePost,
} from "../api.js";

marked.setOptions({ gfm: true, breaks: true });

const route = useRoute();
const router = useRouter();
const postId = route.params.id;

const post = ref({});
const comments = ref([]);
const loading = ref(true);
const error = ref(false);
const draft = ref("");
const posting = ref(false);
const replyTo = ref(null);
const readerRef = ref(null);
const fullscreen = ref(false);

const renderedReadme = computed(() => {
  const source =
    post.value.readme ||
    `# ${post.value.title || ""}\n\n${post.value.content || "暂无 README 内容"}`;
  return DOMPurify.sanitize(marked.parse(source));
});

const topComments = computed(() => comments.value.filter((item) => !item.parentId));

function childrenOf(parentId) {
  return comments.value.filter((item) => item.parentId === parentId);
}

function currentUserId() {
  return state.user && state.user.id;
}

const canDelete = computed(() => {
  if (!currentUserId()) return false;
  return post.value.userId === currentUserId() || (state.user && state.user.role === "admin");
});

function canDeleteComment(comment) {
  return (
    (!!currentUserId() && comment.userId === currentUserId()) ||
    (state.user && state.user.role === "admin")
  );
}

function formatSize(size) {
  const value = Number(size) || 0;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

async function toggleFavorite() {
  try {
    if (post.value.favorited) {
      await unfavoritePost(post.value.id);
      post.value.favorited = false;
    } else {
      await favoritePost(post.value.id);
      post.value.favorited = true;
    }
  } catch (err) {
    notify("收藏操作失败：后端未连接");
  }
}

async function removePost() {
  if (!window.confirm(`确定删除帖子「${post.value.title}」吗？`)) return;
  try {
    await deletePost(post.value.id);
    notify("帖子已删除");
    router.push("/community");
  } catch (err) {
    notify(err.message || "删除失败");
  }
}

function setReply(comment, child = null) {
  replyTo.value = child || comment;
}

async function submitComment() {
  const content = draft.value.trim();
  if (!content || posting.value) return;
  posting.value = true;
  try {
    const res = await addComment(post.value.id, content, replyTo.value ? replyTo.value.id : null);
    comments.value.push(res.comment);
    post.value.comments = res.comments;
    draft.value = "";
    replyTo.value = null;
  } catch (err) {
    notify(err.message || "评论发送失败");
  } finally {
    posting.value = false;
  }
}

async function like(comment) {
  try {
    const res = await likeComment(comment.id);
    comment.likes = res.likes;
    comment.liked = res.liked;
  } catch (err) {
    notify("点赞失败：后端未连接");
  }
}

async function removeComment(comment) {
  if (!window.confirm("确定删除该评论吗？删除后其回复也会一并移除。")) return;
  try {
    await deleteComment(comment.id);
    const removed = comments.value.filter(
      (item) => item.id === comment.id || item.parentId === comment.id
    ).length;
    comments.value = comments.value.filter(
      (item) => item.id !== comment.id && item.parentId !== comment.id
    );
    post.value.comments = Math.max(0, (post.value.comments || 0) - removed);
    notify("评论已删除");
  } catch (err) {
    notify(err.message || "删除失败");
  }
}

function toggleFullscreen() {
  fullscreen.value = !fullscreen.value;
  document.body.style.overflow = fullscreen.value ? "hidden" : "";
}

function onKeydown(event) {
  if (event.key === "Escape" && fullscreen.value) {
    toggleFullscreen();
  }
}

onMounted(async () => {
  document.addEventListener("keydown", onKeydown);
  try {
    const [detail, list] = await Promise.all([getPost(postId), getComments(postId)]);
    post.value = detail;
    comments.value = list;
  } catch (err) {
    error.value = true;
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
  document.body.style.overflow = "";
});
</script>

<style scoped>
.post-page {
  max-width: 1120px;
  margin: 0 auto;
  padding: 24px 24px 80px;
}

.post-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.back-btn {
  border: none;
  background: transparent;
  color: var(--agri-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 6px 0;
}

.back-btn:hover {
  color: var(--agri-ink);
}

.top-actions {
  display: flex;
  gap: 10px;
}

.ghost-btn {
  border: 1px solid var(--agri-line);
  background: rgba(236, 230, 216, 0.05);
  color: var(--agri-ink);
  font-size: 13px;
  padding: 7px 14px;
  border-radius: 980px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ghost-btn:hover {
  border-color: rgba(232, 198, 110, 0.4);
  color: var(--agri-ink);
}

.ghost-btn.active {
  background: rgba(255, 159, 10, 0.14);
  border-color: rgba(255, 159, 10, 0.4);
  color: #b26a00;
}

.ghost-btn.danger {
  color: #b03a3a;
  border-color: rgba(255, 59, 48, 0.3);
}

.ghost-btn.small {
  padding: 5px 12px;
  font-size: 12px;
}

.state-tip {
  padding: 80px 0;
  text-align: center;
  color: var(--agri-muted);
  font-size: 15px;
}

.state-tip.error {
  color: #b03a3a;
}

.post-hero {
  padding-bottom: 26px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.hero-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hero-author {
  flex: 1;
  min-width: 0;
}

.author-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--agri-ink);
}

.author-meta {
  font-size: 12px;
  color: var(--agri-muted);
  margin-top: 2px;
}

.author-role {
  font-size: 12px;
  color: var(--agri-muted);
  margin-top: 2px;
}

.post-title {
  font-size: clamp(28px, 3vw, 40px);
  font-weight: 650;
  letter-spacing: -0.03em;
  color: var(--agri-ink);
  margin-top: 20px;
  line-height: 1.2;
}

.post-lede {
  font-size: 16px;
  line-height: 1.75;
  color: #3c3c43;
  margin-top: 14px;
  white-space: pre-wrap;
}

.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.post-tag {
  font-size: 12px;
  color: var(--agri-ink);
  background: rgba(232, 198, 110, 0.08);
  padding: 3px 10px;
  border-radius: 980px;
}

.hero-stats {
  display: flex;
  gap: 20px;
  margin-top: 18px;
  font-size: 12px;
  color: var(--agri-muted);
}

.post-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 24px;
  margin-top: 24px;
  align-items: start;
}

.readme-card {
  background: #0b1220;
  border: 1px solid rgba(236, 230, 216, 0.1);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.35);
}

.readme-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  border-bottom: 1px solid rgba(236, 230, 216, 0.08);
  background: #0e1624;
}

.readme-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--agri-ink);
}

.readme-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f0dca8;
  box-shadow: 0 0 8px rgba(232, 198, 110, 0.55);
}

.readme-card.fullscreen {
  position: fixed;
  inset: 0;
  z-index: 200;
  margin: 0;
  border-radius: 0;
  border: none;
  overflow-y: auto;
}

.markdown-body {
  padding: 28px 32px 40px;
  font-size: 15px;
  line-height: 1.75;
  color: #d6dee9;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  font-weight: 600;
  line-height: 1.3;
  margin: 24px 0 12px;
  letter-spacing: -0.01em;
}

.markdown-body :deep(h1) {
  font-size: 28px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(236, 230, 216, 0.12);
}

.markdown-body :deep(h2) {
  font-size: 21px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(236, 230, 216, 0.09);
}

.markdown-body :deep(h3) {
  font-size: 17px;
}

.markdown-body :deep(p) {
  margin: 10px 0;
}

.markdown-body :deep(a) {
  color: #8ab4f8;
}

.markdown-body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.9em;
  background: rgba(236, 230, 216, 0.09);
  padding: 2px 5px;
  border-radius: 5px;
}

.markdown-body :deep(pre) {
  background: #0d1522;
  border: 1px solid rgba(236, 230, 216, 0.08);
  border-radius: 10px;
  padding: 14px 16px;
  overflow-x: auto;
  margin: 14px 0;
}

.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
}

.markdown-body :deep(blockquote) {
  margin: 14px 0;
  padding: 6px 16px;
  border-left: 3px solid rgba(232, 198, 110, 0.5);
  color: #a5b0c0;
  background: rgba(232, 198, 110, 0.05);
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 24px;
  margin: 10px 0;
}

.markdown-body :deep(li) {
  margin: 4px 0;
}

.markdown-body :deep(table) {
  border-collapse: collapse;
  margin: 16px 0;
  width: 100%;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid rgba(236, 230, 216, 0.12);
  padding: 7px 12px;
  font-size: 14px;
  text-align: left;
}

.markdown-body :deep(th) {
  background: #0e1624;
}

.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 8px;
}

.post-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 16px;
}

.side-card {
  background: #0b1220;
  border: 1px solid rgba(236, 230, 216, 0.09);
  border-radius: 14px;
  padding: 16px;
}

.side-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--agri-muted);
  margin-bottom: 10px;
}

.side-empty {
  font-size: 13px;
  color: var(--agri-muted);
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 9px;
  background: rgba(236, 230, 216, 0.05);
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--agri-ink);
}

.file-item:hover {
  background: rgba(232, 198, 110, 0.1);
  color: var(--agri-gold-bright);
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  color: var(--agri-muted);
  font-size: 11px;
  flex: 0 0 auto;
}

.author-card {
  display: flex;
  align-items: center;
  gap: 10px;
}

.replies {
  margin-top: 40px;
  border-top: 1px solid rgba(236, 230, 216, 0.09);
  padding-top: 26px;
  max-width: 760px;
}

.replies-head h2 {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--agri-ink);
}

.composer {
  display: flex;
  gap: 12px;
  padding: 16px 0 18px;
  border-bottom: 1px solid rgba(236, 230, 216, 0.08);
}

.composer-body {
  flex: 1;
  min-width: 0;
}

.composer textarea {
  width: 100%;
  border: none;
  outline: none;
  resize: vertical;
  font-size: 15px;
  line-height: 1.6;
  color: var(--agri-ink);
  font-family: inherit;
  background: transparent;
}

.composer-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.reply-hint {
  margin-right: auto;
  font-size: 12px;
  color: var(--agri-muted);
}

.reply-submit {
  border: 1px solid rgba(232, 198, 110, 0.4);
  background: linear-gradient(135deg, #f6e2a8, #dfb65a);
  color: #191204;
  font-size: 14px;
  font-weight: 600;
  padding: 8px 20px;
  border-radius: 980px;
  cursor: pointer;
  transition: filter 0.2s ease;
}

.reply-submit:hover {
  filter: brightness(1.06);
}

.reply-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.replies-empty {
  padding: 30px 0;
  font-size: 14px;
  color: var(--agri-muted);
}

.reply {
  display: flex;
  gap: 12px;
  padding: 18px 0;
  border-bottom: 1px solid rgba(236, 230, 216, 0.08);
}

.reply.child {
  padding: 12px 0 0;
  border-bottom: none;
}

.reply-body {
  flex: 1;
  min-width: 0;
}

.reply-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.reply-author {
  font-size: 14px;
  font-weight: 600;
  color: var(--agri-ink);
}

.reply-handle,
.reply-time {
  font-size: 12px;
  color: var(--agri-muted);
}

.reply-text {
  font-size: 14px;
  line-height: 1.65;
  color: var(--agri-ink);
  margin-top: 6px;
  white-space: pre-wrap;
}

.mention {
  color: #e8c66e;
  margin-right: 4px;
}

.reply-actions {
  display: flex;
  gap: 18px;
  margin-top: 10px;
}

.reply-actions button {
  border: none;
  background: transparent;
  font-size: 12px;
  color: var(--agri-muted);
  cursor: pointer;
  padding: 0;
  transition: color 0.2s ease;
}

.reply-actions button:hover {
  color: #e8c66e;
}

.reply-actions button.liked {
  color: #f91880;
}

.reply-actions button.danger:hover {
  color: #b03a3a;
}

.link-btn {
  border: none;
  background: transparent;
  color: #e8c66e;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}

@media (max-width: 900px) {
  .post-layout {
    grid-template-columns: 1fr;
  }

  .post-side {
    position: static;
  }

  .markdown-body {
    padding: 20px 18px 30px;
  }
}
</style>

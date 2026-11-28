<template>
  <div class="page-container">
    <div class="page-head">
      <div>
        <h1 class="page-title">共享社区</h1>
        <p class="page-subtitle">发布案例、上传文件，用 README 记录完整经验</p>
      </div>
      <button class="pill-btn" @click="openModal">发布案例</button>
    </div>

    <div class="yellow-banner community-tip">
      ℹ 发布的帖子需管理员审核，通过后将对所有用户公开展示
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
      <input v-model="search" class="search-input" placeholder="搜索标题、内容或标签…" />
    </div>

    <div v-if="error" class="error-tip">帖子加载失败：后端未连接</div>
    <div v-else-if="filteredPosts.length === 0" class="empty-wrap">
      <EmptyState title="暂无帖子" hint="换个筛选条件，或发布第一个案例" />
    </div>
    <div v-else class="post-list">
      <PostCard
        v-for="p in filteredPosts"
        :key="p.id"
        :post="p"
        :liked="isLiked(p.id)"
        :favorited="isFavorited(p.id)"
        :can-edit="canEdit(p)"
        :can-delete="canDelete(p)"
        @like="onLike"
        @favorite="onFavorite"
        @edit="openEdit"
        @delete="removePost"
        @open="openDetail"
      />
    </div>

    <transition name="fade">
      <div v-if="modalOpen" class="modal-mask" @click.self="closeModal">
        <div class="modal card">
          <h3 class="card-title">{{ editingId ? "编辑帖子" : "发布案例" }}</h3>
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

          <template v-if="!editingId">
            <label class="field">
              <span class="field-label">README 文件（可选，.md / .txt）</span>
              <input ref="readmeInput" type="file" accept=".md,.markdown,.txt" @change="onReadmeChange" />
            </label>
            <div v-if="readmeFile" class="file-picked">
              已选择 README：{{ readmeFile.name }}
              <button class="link-btn" @click="clearReadme">移除</button>
            </div>
            <label class="field">
              <span class="field-label">附件（可选，最多 10 个，单个不超过 5MB）</span>
              <input ref="filesInput" type="file" multiple @change="onFilesChange" />
            </label>
            <div v-if="attachments.length" class="file-picked">
              <div v-for="(f, i) in attachments" :key="i" class="file-line">
                {{ f.name }}
                <button class="link-btn" @click="removeAttachment(i)">移除</button>
              </div>
            </div>
            <p class="form-hint">
              不传 README 时，系统会根据标题、正文、标签和附件自动生成一份 README。
            </p>
          </template>

          <div v-if="formError" class="login-error">{{ formError }}</div>
          <div class="modal-actions">
            <button class="pill-btn pill-btn-ghost" @click="closeModal">取消</button>
            <button class="pill-btn" :disabled="submitting" @click="submitPost">
              {{ submitting ? "提交中…" : editingId ? "保存修改" : "发布" }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import state, { notify } from "../store.js";
import PostCard from "../components/PostCard.vue";
import EmptyState from "../components/EmptyState.vue";
import {
  getPosts,
  likePost,
  favoritePost,
  unfavoritePost,
  updatePost,
  deletePost,
  createPostWithFiles,
} from "../api.js";

const router = useRouter();
const posts = ref([]);
const error = ref(false);
const activeFilter = ref("all");
const search = ref("");
const modalOpen = ref(false);
const submitting = ref(false);
const form = ref({ title: "", content: "", tags: "" });
const formError = ref("");
const editingId = ref("");
const readmeFile = ref(null);
const attachments = ref([]);
const readmeInput = ref(null);
const filesInput = ref(null);

const likedIds = ref([]);
const favoritedIds = ref([]);

function isLiked(id) {
  return likedIds.value.includes(id);
}

function isFavorited(id) {
  return favoritedIds.value.includes(id);
}

function currentUserId() {
  return state.user && state.user.id;
}

function canEdit(post) {
  return !!currentUserId() && post.userId === currentUserId();
}

function canDelete(post) {
  return canEdit(post) || (state.user && state.user.role === "admin");
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

async function onFavorite(post) {
  const favorited = isFavorited(post.id);
  try {
    if (favorited) {
      await unfavoritePost(post.id);
      favoritedIds.value = favoritedIds.value.filter((id) => id !== post.id);
    } else {
      await favoritePost(post.id);
      if (!favoritedIds.value.includes(post.id)) favoritedIds.value.push(post.id);
    }
  } catch (err) {
    notify("收藏操作失败：后端未连接");
  }
}

function openDetail(post) {
  router.push(`/community/posts/${post.id}`);
}

async function removePost(post) {
  if (!window.confirm(`确定删除帖子「${post.title}」吗？`)) return;
  try {
    await deletePost(post.id);
    posts.value = posts.value.filter((p) => p.id !== post.id);
    notify("帖子已删除");
  } catch (err) {
    notify(err.message || "删除失败");
  }
}

const filters = [
  { key: "all", label: "全部" },
  { key: "mine", label: "我的发布" },
  { key: "fav", label: "我的收藏" },
  { key: "file", label: "带文件" },
  { key: "admin", label: "管理员发布" },
];

const filteredPosts = computed(() => {
  let list = posts.value;
  if (activeFilter.value === "mine") {
    const uid = currentUserId();
    list = list.filter((p) =>
      p.userId ? p.userId === uid : p.author === (state.user && state.user.name)
    );
  } else if (activeFilter.value === "fav") {
    list = list.filter((p) => isFavorited(p.id));
  } else if (activeFilter.value === "file") {
    list = list.filter((p) => (p.attachments && p.attachments.length) || p.readme);
  } else if (activeFilter.value === "admin") {
    list = list.filter((p) => p.authorRole === "admin");
  }

  const keyword = search.value.trim().toLowerCase();
  if (keyword) {
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(keyword) ||
        p.content.toLowerCase().includes(keyword) ||
        (p.tags || []).some((t) => String(t).toLowerCase().includes(keyword))
    );
  }
  return list;
});

function openModal() {
  editingId.value = "";
  form.value = { title: "", content: "", tags: "" };
  formError.value = "";
  readmeFile.value = null;
  attachments.value = [];
  if (readmeInput.value) readmeInput.value.value = "";
  if (filesInput.value) filesInput.value.value = "";
  modalOpen.value = true;
}

function openEdit(post) {
  editingId.value = post.id;
  form.value = {
    title: post.title,
    content: post.content,
    tags: (post.tags || []).join(", "),
  };
  formError.value = "";
  modalOpen.value = true;
}

function closeModal() {
  modalOpen.value = false;
}

function onReadmeChange(event) {
  const file = event.target.files && event.target.files[0];
  readmeFile.value = file || null;
}

function onFilesChange(event) {
  const picked = Array.from(event.target.files || []);
  attachments.value = picked.slice(0, 10);
}

function clearReadme() {
  readmeFile.value = null;
  if (readmeInput.value) readmeInput.value.value = "";
}

function removeAttachment(index) {
  attachments.value.splice(index, 1);
  if (filesInput.value) filesInput.value.value = "";
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
    if (editingId.value) {
      const updated = await updatePost(editingId.value, {
        title: form.value.title.trim(),
        content: form.value.content.trim(),
        tags,
      });
      const index = posts.value.findIndex((p) => p.id === updated.id);
      if (index >= 0) posts.value.splice(index, 1, updated);
      closeModal();
      notify("已保存，修改后需重新审核");
    } else {
      const post = await createPostWithFiles(
        {
          title: form.value.title.trim(),
          content: form.value.content.trim(),
          tags,
        },
        readmeFile.value,
        attachments.value
      );
      posts.value.unshift(post);
      closeModal();
      notify("发布成功，等待管理员审核");
    }
  } catch (err) {
    formError.value =
      err.code === "NETWORK_ERROR" ? "后端未连接" : err.message || "提交失败";
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  try {
    posts.value = await getPosts();
    likedIds.value = posts.value.filter((p) => p.liked).map((p) => p.id);
    favoritedIds.value = posts.value.filter((p) => p.favorited).map((p) => p.id);
  } catch (err) {
    error.value = true;
  }
});
</script>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.page-subtitle {
  margin: 6px 0 0;
}

.community-tip {
  margin-bottom: 18px;
}

.filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}

.filter-btn {
  border: 1px solid var(--agri-line-soft);
  background: rgba(236, 230, 216, 0.04);
  color: var(--agri-muted);
  font-size: 13px;
  padding: 8px 16px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.3s var(--agri-ease);
}

.filter-btn:hover {
  color: var(--agri-ink);
  border-color: rgba(236, 230, 216, 0.2);
}

.filter-btn.active {
  background: rgba(232, 198, 110, 0.14);
  color: var(--agri-gold-bright);
  border-color: rgba(232, 198, 110, 0.36);
  font-weight: 500;
  box-shadow: none;
}

.search-input {
  margin-left: auto;
  min-width: 230px;
  border: 1px solid var(--agri-line);
  background: rgba(4, 8, 14, 0.55);
  border-radius: 999px;
  padding: 9px 16px;
  font-size: 13px;
  color: var(--agri-ink);
  outline: none;
  transition: all 0.3s var(--agri-ease);
}

.search-input:focus {
  background: rgba(4, 8, 14, 0.8);
  border-color: var(--agri-gold-deep);
  box-shadow: 0 0 0 4px rgba(232, 198, 110, 0.16);
}

.empty-wrap {
  padding: 40px 0;
}

.post-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  width: 520px;
  max-width: 100%;
  max-height: 86vh;
  overflow-y: auto;
  gap: 14px;
  background: linear-gradient(160deg, rgba(20, 29, 44, 0.98), rgba(9, 14, 23, 0.99));
  border: 1px solid rgba(236, 230, 216, 0.12);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  color: var(--agri-muted);
}

.field input,
.field textarea {
  border: 1px solid var(--agri-line);
  background: rgba(4, 8, 14, 0.55);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 15px;
  color: var(--agri-ink);
  outline: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.field input[type="file"] {
  font-size: 13px;
  padding: 9px 12px;
}

.field input:focus,
.field textarea:focus {
  background: rgba(4, 8, 14, 0.8);
  border-color: var(--agri-gold-deep);
  box-shadow: 0 0 0 3px rgba(232, 198, 110, 0.16);
}

.field textarea {
  resize: vertical;
}

.file-picked {
  font-size: 12px;
  color: var(--agri-muted);
  background: rgba(236, 230, 216, 0.04);
  border-radius: 10px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.link-btn {
  border: none;
  background: transparent;
  color: #ff3b30;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}

.form-hint {
  font-size: 12px;
  color: #8e8e93;
  line-height: 1.6;
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

@media (max-width: 700px) {
  .search-input {
    margin-left: 0;
    width: 100%;
  }
}
</style>

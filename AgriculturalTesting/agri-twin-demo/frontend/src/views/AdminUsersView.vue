<template>
  <div>
    <div class="toolbar">
      <button class="pill-btn" @click="openModal">发送站内消息</button>
    </div>

    <div v-if="error" class="error-tip">用户数据加载失败：后端未连接</div>
    <div v-else class="card table-card">
      <table class="user-table">
        <thead>
          <tr>
            <th>用户名</th>
            <th>邮箱</th>
            <th>角色</th>
            <th>状态</th>
            <th>注册时间</th>
            <th>最后登录</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in list" :key="u.id">
            <td class="cell-name">{{ u.name }}</td>
            <td class="cell-muted">{{ u.email }}</td>
            <td>
              <span class="tag" :class="u.role === 'admin' ? 'tag-orange' : 'tag-gray'">
                {{ u.role === "admin" ? "管理员" : "用户" }}
              </span>
            </td>
            <td>
              <span class="tag" :class="u.status === 'active' ? 'tag-green' : 'tag-red'">
                {{ u.status === "active" ? "启用" : "禁用" }}
              </span>
            </td>
            <td class="cell-muted num">{{ u.createdAt }}</td>
            <td class="cell-muted num">{{ u.lastLogin }}</td>
            <td>
              <button class="row-btn" @click="toggleStatus(u)">
                {{ u.status === "active" ? "禁用" : "启用" }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <transition name="fade">
      <div v-if="modalOpen" class="modal-mask" @click.self="closeModal">
        <div class="modal card">
          <h3 class="card-title">发送站内消息</h3>
          <label class="field">
            <span class="field-label">选择用户</span>
            <select v-model="form.userId">
              <option v-for="u in list" :key="u.id" :value="u.id">{{ u.name }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">标题</span>
            <input v-model="form.title" placeholder="请输入消息标题" />
          </label>
          <label class="field">
            <span class="field-label">内容</span>
            <textarea v-model="form.content" rows="4" placeholder="请输入消息内容"></textarea>
          </label>
          <div v-if="formError" class="form-error">{{ formError }}</div>
          <div class="modal-actions">
            <button class="pill-btn pill-btn-ghost" @click="closeModal">取消</button>
            <button class="pill-btn" :disabled="sending" @click="submit">
              {{ sending ? "发送中…" : "发送" }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { getAdminUsers, setUserStatus, sendMessage } from "../api.js";
import { notify } from "../store.js";

const list = ref([]);
const error = ref(false);
const modalOpen = ref(false);
const sending = ref(false);
const form = ref({ userId: "", title: "", content: "" });
const formError = ref("");

async function toggleStatus(u) {
  const next = u.status === "active" ? "disabled" : "active";
  try {
    await setUserStatus(u.id, next);
    u.status = next;
  } catch (err) {
    notify("操作失败：后端未连接");
  }
}

function openModal() {
  form.value = { userId: list.value[0] ? list.value[0].id : "", title: "", content: "" };
  formError.value = "";
  modalOpen.value = true;
}

function closeModal() {
  modalOpen.value = false;
}

async function submit() {
  if (!form.value.userId || !form.value.title.trim() || !form.value.content.trim()) {
    formError.value = "请填写完整的用户、标题和内容";
    return;
  }
  sending.value = true;
  formError.value = "";
  try {
    await sendMessage({
      userId: form.value.userId,
      title: form.value.title.trim(),
      content: form.value.content.trim(),
    });
    closeModal();
    notify("消息发送成功");
  } catch (err) {
    formError.value = err.code === "NETWORK_ERROR" ? "后端未连接" : "发送失败";
  } finally {
    sending.value = false;
  }
}

onMounted(async () => {
  try {
    list.value = await getAdminUsers();
  } catch (err) {
    error.value = true;
  }
});
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 18px;
}

.table-card {
  padding: 8px 16px;
  overflow-x: auto;
}

.user-table {
  width: 100%;
  border-collapse: collapse;
}

.user-table th,
.user-table td {
  text-align: left;
  padding: 14px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  font-size: 14px;
  white-space: nowrap;
}

.user-table th {
  font-size: 12px;
  font-weight: 500;
  color: #8e8e93;
}

.user-table tbody tr {
  transition: background 0.2s ease;
}

.user-table tbody tr:hover {
  background: rgba(0, 0, 0, 0.02);
}

.cell-name {
  font-weight: 500;
  color: #1d1d1f;
}

.cell-muted {
  color: #6e6e73;
}

.row-btn {
  border: none;
  background: rgba(0, 113, 227, 0.1);
  color: #0071e3;
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 980px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.row-btn:hover {
  background: rgba(0, 113, 227, 0.16);
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
.field textarea,
.field select {
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
.field textarea:focus,
.field select:focus {
  background: rgba(0, 113, 227, 0.06);
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.15);
}

.field textarea {
  resize: vertical;
}

.form-error {
  font-size: 13px;
  color: #ff3b30;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>

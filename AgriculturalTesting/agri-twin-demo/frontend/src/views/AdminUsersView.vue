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
            <th>帖子数</th>
            <th>注册时间</th>
            <th>最后登录</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in list" :key="u.id">
            <td class="cell-name">
              {{ u.name }}
              <span v-if="isSelf(u)" class="tag tag-gray">我</span>
            </td>
            <td class="cell-muted">{{ u.email }}</td>
            <td>
              <select
                class="role-select"
                :value="u.role"
                :disabled="isSelf(u)"
                @change="changeRole(u, $event.target.value)"
              >
                <option value="user">用户</option>
                <option value="admin">管理员</option>
              </select>
            </td>
            <td>
              <span class="tag" :class="u.status === 'active' ? 'tag-green' : 'tag-red'">
                {{ u.status === "active" ? "启用" : "禁用" }}
              </span>
            </td>
            <td class="cell-muted num">{{ u.postCount || 0 }}</td>
            <td class="cell-muted num">{{ u.createdAt }}</td>
            <td class="cell-muted num">{{ u.lastLogin }}</td>
            <td class="row-actions">
              <button class="row-btn" :disabled="isSelf(u)" @click="toggleStatus(u)">
                {{ u.status === "active" ? "禁用" : "启用" }}
              </button>
              <button class="row-btn row-btn-ghost" @click="openReset(u)">重置密码</button>
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
              <option value="">全员广播</option>
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
    <transition name="fade">
      <div v-if="resetOpen" class="modal-mask" @click.self="closeReset">
        <div class="modal card">
          <h3 class="card-title">重置密码</h3>
          <p class="reset-hint">
            为用户「{{ resetTarget.name }}」设置新密码，提交后该用户所有设备将退出登录。
          </p>
          <label class="field">
            <span class="field-label">新密码（至少 6 位）</span>
            <input v-model="resetPassword" type="password" placeholder="请输入新密码" />
          </label>
          <div v-if="resetError" class="form-error">{{ resetError }}</div>
          <div class="modal-actions">
            <button class="pill-btn pill-btn-ghost" @click="closeReset">取消</button>
            <button class="pill-btn" :disabled="resetting" @click="submitReset">
              {{ resetting ? "提交中…" : "确认重置" }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { getAdminUsers, updateAdminUser, resetUserPassword, sendMessage } from "../api.js";
import state, { notify } from "../store.js";

const list = ref([]);
const error = ref(false);
const modalOpen = ref(false);
const sending = ref(false);
const form = ref({ userId: "", title: "", content: "" });
const formError = ref("");

const resetOpen = ref(false);
const resetTarget = ref({});
const resetPassword = ref("");
const resetError = ref("");
const resetting = ref(false);

function isSelf(u) {
  return !!(state.user && state.user.id === u.id);
}

async function changeRole(u, role) {
  if (role === u._currentRole) return;
  try {
    const updated = await updateAdminUser(u.id, { role });
    Object.assign(u, updated);
    u._currentRole = updated.role;
    notify("角色已更新");
  } catch (err) {
    notify(err.message || "操作失败");
    // 用新对象替换，强制下拉框回退到修改前的角色
    const index = list.value.findIndex((item) => item.id === u.id);
    if (index >= 0) {
      list.value.splice(index, 1, { ...u, role: u._currentRole });
    }
  }
}

async function toggleStatus(u) {
  const next = u.status === "active" ? "disabled" : "active";
  try {
    const updated = await updateAdminUser(u.id, { status: next });
    Object.assign(u, updated);
    notify(next === "disabled" ? "用户已禁用" : "用户已启用");
  } catch (err) {
    notify(err.message || "操作失败");
  }
}

function openReset(u) {
  resetTarget.value = u;
  resetPassword.value = "";
  resetError.value = "";
  resetOpen.value = true;
}

function closeReset() {
  resetOpen.value = false;
}

async function submitReset() {
  if (resetPassword.value.length < 6) {
    resetError.value = "密码长度不能少于 6 位";
    return;
  }
  resetting.value = true;
  resetError.value = "";
  try {
    await resetUserPassword(resetTarget.value.id, resetPassword.value);
    closeReset();
    notify("密码已重置，该用户需重新登录");
  } catch (err) {
    resetError.value = err.message || "重置失败";
  } finally {
    resetting.value = false;
  }
}

function openModal() {
  form.value = { userId: "", title: "", content: "" };
  formError.value = "";
  modalOpen.value = true;
}

function closeModal() {
  modalOpen.value = false;
}

async function submit() {
  if (!form.value.title.trim() || !form.value.content.trim()) {
    formError.value = "请填写完整的标题和内容";
    return;
  }
  sending.value = true;
  formError.value = "";
  try {
    await sendMessage({
      userId: form.value.userId || null,
      title: form.value.title.trim(),
      content: form.value.content.trim(),
    });
    closeModal();
    notify(form.value.userId ? "消息发送成功" : "全员广播已发送");
  } catch (err) {
    formError.value = err.code === "NETWORK_ERROR" ? "后端未连接" : err.message || "发送失败";
  } finally {
    sending.value = false;
  }
}

onMounted(async () => {
  try {
    list.value = await getAdminUsers();
    list.value.forEach((u) => {
      u._currentRole = u.role;
    });
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
  border-bottom: 1px solid rgba(236, 230, 216, 0.09);
  font-size: 14px;
  white-space: nowrap;
}

.user-table th {
  font-size: 12px;
  font-weight: 500;
  color: var(--agri-muted);
}

.user-table tbody tr {
  transition: background 0.2s ease;
}

.user-table tbody tr:hover {
  background: rgba(236, 230, 216, 0.03);
}

.cell-name {
  font-weight: 500;
  color: var(--agri-ink);
}

.cell-muted {
  color: var(--agri-muted);
}

.row-btn {
  border: none;
  background: rgba(232, 198, 110, 0.12);
  color: var(--agri-ink);
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 980px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.row-btn:hover {
  background: rgba(232, 198, 110, 0.18);
}

.row-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.row-btn-ghost {
  background: rgba(236, 230, 216, 0.06);
  color: var(--agri-muted);
  margin-left: 8px;
}

.row-btn-ghost:hover {
  background: rgba(236, 230, 216, 0.1);
}

.role-select {
  border: none;
  background: rgba(236, 230, 216, 0.05);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
  color: var(--agri-ink);
  outline: none;
  cursor: pointer;
}

.role-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reset-hint {
  font-size: 13px;
  color: var(--agri-muted);
  line-height: 1.6;
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
.field textarea,
.field select {
  border: none;
  background: rgba(236, 230, 216, 0.05);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 15px;
  color: var(--agri-ink);
  outline: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.field input:focus,
.field textarea:focus,
.field select:focus {
  background: rgba(232, 198, 110, 0.06);
  box-shadow: 0 0 0 3px rgba(232, 198, 110, 0.15);
}

.field textarea {
  resize: vertical;
}

.form-error {
  font-size: 13px;
  color: #b03a3a;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>

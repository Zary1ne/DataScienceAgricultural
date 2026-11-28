<template>
  <div class="page-container">
    <div class="page-head">
      <div>
        <h1 class="page-title">个人设置</h1>
        <p class="page-subtitle">管理账号资料、农场信息与通知偏好</p>
      </div>
      <button class="pill-btn" :disabled="saving" @click="save">
        {{ saving ? "保存中…" : "保存修改" }}
      </button>
    </div>

    <div v-if="loadError" class="error-tip">资料加载失败：后端未连接，当前显示默认值</div>

    <div class="settings-grid">
      <section class="card">
        <h2 class="section-title">账号资料</h2>
        <div class="profile-head">
          <Avatar
            :name="form.name"
            :seed="(state.user && state.user.id) || ''"
            :url="avatarUrl"
            :size="48"
          />
          <div class="profile-brief">
            <div class="profile-name">{{ form.name || "未设置" }}</div>
            <div class="profile-email">{{ form.email }}</div>
          </div>
          <div class="avatar-actions">
            <button class="mini-btn" :disabled="uploading" @click="pickAvatar">
              {{ uploading ? "上传中…" : "更换头像" }}
            </button>
            <button v-if="avatarUrl" class="mini-btn ghost" @click="clearAvatar">
              恢复默认
            </button>
            <input
              ref="avatarInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              @change="onAvatarChange"
            />
          </div>
        </div>
        <label class="field">
          <span class="field-label">姓名</span>
          <input v-model="form.name" placeholder="请输入姓名" />
        </label>
        <label class="field">
          <span class="field-label">手机号</span>
          <input v-model="form.phone" placeholder="请输入手机号" />
        </label>
        <label class="field">
          <span class="field-label">邮箱</span>
          <input :value="form.email" disabled />
        </label>
      </section>

      <section class="card">
        <h2 class="section-title">农场信息</h2>
        <label class="field">
          <span class="field-label">农场名称</span>
          <input v-model="form.farmName" placeholder="请输入农场名称" />
        </label>
        <label class="field">
          <span class="field-label">所在地区</span>
          <input v-model="form.location" placeholder="请输入所在地区" />
        </label>
        <div class="field-row">
          <label class="field">
            <span class="field-label">种植面积（亩）</span>
            <input v-model.number="form.area" type="number" min="0" />
          </label>
          <label class="field">
            <span class="field-label">主要作物（逗号分隔）</span>
            <input v-model="form.cropsText" placeholder="水稻" />
          </label>
        </div>
        <div class="farm-summary">
          <div class="fs-item">
            <span class="fs-value num">{{ form.area || 0 }}</span>
            <span class="fs-label">亩</span>
          </div>
          <div class="fs-item">
            <span class="fs-value num">{{ crops.length }}</span>
            <span class="fs-label">种作物</span>
          </div>
          <div class="fs-item">
            <span class="fs-value num">12</span>
            <span class="fs-label">在线设备</span>
          </div>
        </div>
      </section>

      <section class="card">
        <h2 class="section-title">通知偏好</h2>
        <div class="switch-row">
          <div>
            <div class="switch-title">告警通知</div>
            <div class="switch-desc">设备异常、墒情越界时提醒</div>
          </div>
          <button
            class="switch"
            :class="{ on: form.notify.alert }"
            @click="form.notify.alert = !form.notify.alert"
          >
            <span></span>
          </button>
        </div>
        <div class="switch-row">
          <div>
            <div class="switch-title">每日农情简报</div>
            <div class="switch-desc">每天 08:00 推送农场概况</div>
          </div>
          <button
            class="switch"
            :class="{ on: form.notify.daily }"
            @click="form.notify.daily = !form.notify.daily"
          >
            <span></span>
          </button>
        </div>
        <div class="switch-row">
          <div>
            <div class="switch-title">社区动态</div>
            <div class="switch-desc">有人回复或点赞我的帖子时提醒</div>
          </div>
          <button
            class="switch"
            :class="{ on: form.notify.community }"
            @click="form.notify.community = !form.notify.community"
          >
            <span></span>
          </button>
        </div>
      </section>

      <section class="card">
        <h2 class="section-title">意见反馈</h2>
        <label class="field">
          <span class="field-label">反馈类型</span>
          <select v-model="fb.category">
            <option>功能建议</option>
            <option>问题反馈</option>
            <option>体验反馈</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">反馈内容</span>
          <textarea v-model="fb.content" rows="4" placeholder="请描述你遇到的问题或建议…"></textarea>
        </label>
        <div v-if="fbError" class="form-error">{{ fbError }}</div>
        <button class="pill-btn" :disabled="fbSubmitting" @click="sendFeedback">
          {{ fbSubmitting ? "提交中…" : "提交反馈" }}
        </button>

        <div class="fb-list">
          <div class="fb-list-title">我的反馈</div>
          <div v-if="!myFeedback.length" class="fb-empty">还没有提交过反馈</div>
          <div v-for="item in myFeedback" :key="item.id" class="fb-item">
            <div class="fb-item-head">
              <span class="tag" :class="item.status === 'handled' ? 'tag-green' : 'tag-orange'">
                {{ item.status === "handled" ? "已处理" : "待处理" }}
              </span>
              <span class="fb-category">{{ item.category }}</span>
              <span class="fb-time num">{{ item.createdAt }}</span>
            </div>
            <div class="fb-content">{{ item.content }}</div>
          </div>
        </div>
      </section>

      <section class="card">
        <h2 class="section-title">账号安全</h2>
        <div class="security-row">
          <div>
            <div class="switch-title">登录账号</div>
            <div class="switch-desc">{{ form.email }}</div>
          </div>
          <span class="tag tag-green">已登录</span>
        </div>
        <div class="security-row">
          <div>
            <div class="switch-title">角色</div>
            <div class="switch-desc">{{ state.user && state.user.role === "admin" ? "管理员账号" : "普通农户账号" }}</div>
          </div>
        </div>
        <div class="pwd-block">
          <div class="switch-title">修改密码</div>
          <label class="field">
            <span class="field-label">原密码</span>
            <input v-model="pwd.old" type="password" autocomplete="current-password" />
          </label>
          <label class="field">
            <span class="field-label">新密码</span>
            <input v-model="pwd.next" type="password" placeholder="至少 6 位" autocomplete="new-password" />
          </label>
          <label class="field">
            <span class="field-label">确认新密码</span>
            <input v-model="pwd.confirm" type="password" autocomplete="new-password" />
          </label>
          <div v-if="pwdError" class="form-error">{{ pwdError }}</div>
          <button class="pill-btn" :disabled="pwdSaving" @click="savePassword">
            {{ pwdSaving ? "保存中…" : "保存新密码" }}
          </button>
        </div>
        <div class="danger-row">
          <button class="pill-btn pill-btn-ghost logout-btn" @click="doLogout">退出登录</button>
          <button class="pill-btn pill-btn-ghost logout-btn" @click="doLogoutAll">退出全部设备</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import state, { logout, notify } from "../store.js";
import Avatar from "../components/Avatar.vue";
import {
  getProfile,
  updateProfile,
  updateAvatar,
  resetAvatar,
  logoutApi,
  changePassword,
  logoutAll,
  submitFeedback,
  getMyFeedback,
} from "../api.js";

const router = useRouter();
const saving = ref(false);
const loadError = ref(false);
const avatarUrl = ref((state.user && state.user.avatar) || "");
const avatarInput = ref(null);
const uploading = ref(false);

function pickAvatar() {
  if (avatarInput.value) avatarInput.value.click();
}

async function onAvatarChange(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    notify("头像仅支持 JPG / PNG / WebP");
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    notify("头像不能超过 2MB");
    return;
  }
  uploading.value = true;
  try {
    const res = await updateAvatar(file);
    avatarUrl.value = res.avatarUrl;
    if (state.user) state.user.avatar = res.avatarUrl;
    notify("头像已更新");
  } catch (err) {
    notify(err.message || "头像上传失败");
  } finally {
    uploading.value = false;
  }
}

async function clearAvatar() {
  try {
    await resetAvatar();
    avatarUrl.value = "";
    if (state.user) state.user.avatar = "";
    notify("已恢复默认头像");
  } catch (err) {
    notify(err.message || "操作失败");
  }
}

const pwd = reactive({ old: "", next: "", confirm: "" });
const pwdSaving = ref(false);
const pwdError = ref("");

const fb = reactive({ category: "功能建议", content: "" });
const myFeedback = ref([]);
const fbSubmitting = ref(false);
const fbError = ref("");

const form = reactive({
  name: (state.user && state.user.name) || "",
  email: (state.user && state.user.email) || "",
  phone: "",
  farmName: "",
  location: "",
  area: 0,
  cropsText: "",
  notify: { alert: true, daily: true, community: false },
});

const crops = computed(() =>
  form.cropsText
    .split(/[,，]/)
    .map((c) => c.trim())
    .filter(Boolean)
);

function fill(profile) {
  form.name = profile.name || form.name;
  form.email = profile.email || form.email;
  form.phone = profile.phone || "";
  form.farmName = profile.farmName || "";
  form.location = profile.location || "";
  form.area = profile.area ?? 0;
  form.cropsText = (profile.crops || []).join(", ");
  form.notify = Object.assign({ alert: true, daily: true, community: false }, profile.notify || {});
}

async function save() {
  if (!form.name.trim()) {
    notify("姓名不能为空");
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      phone: form.phone,
      farmName: form.farmName,
      location: form.location,
      area: form.area,
      crops: crops.value,
      notify: { ...form.notify },
    };
    const updated = await updateProfile(payload);
    fill(updated);
    if (state.user) {
      state.user.name = updated.name;
      state.user.email = updated.email;
    }
    notify("已保存个人设置");
  } catch (err) {
    notify("保存失败：后端未连接");
  } finally {
    saving.value = false;
  }
}

async function sendFeedback() {
  const content = fb.content.trim();
  if (!content) {
    fbError.value = "请输入反馈内容";
    return;
  }
  fbSubmitting.value = true;
  fbError.value = "";
  try {
    const created = await submitFeedback({ category: fb.category, content });
    myFeedback.value.unshift(created);
    fb.content = "";
    notify("反馈已提交，感谢你的建议");
  } catch (err) {
    fbError.value = err.message || "提交失败";
  } finally {
    fbSubmitting.value = false;
  }
}

async function savePassword() {
  if (!pwd.old) {
    pwdError.value = "请输入原密码";
    return;
  }
  if (pwd.next.length < 6) {
    pwdError.value = "新密码长度不能少于 6 位";
    return;
  }
  if (pwd.next !== pwd.confirm) {
    pwdError.value = "两次输入的新密码不一致";
    return;
  }
  pwdSaving.value = true;
  pwdError.value = "";
  try {
    await changePassword(pwd.old, pwd.next);
    pwd.old = "";
    pwd.next = "";
    pwd.confirm = "";
    notify("密码已修改，其他设备已退出登录");
  } catch (err) {
    pwdError.value = err.message || "修改失败";
  } finally {
    pwdSaving.value = false;
  }
}

function doLogout() {
  logoutApi().catch(() => {});
  logout();
  router.push("/login");
}

async function doLogoutAll() {
  try {
    await logoutAll();
  } catch (err) {
    // 网络异常时仍然清理本地登录态
  }
  logout();
  router.push("/login");
}

onMounted(async () => {
  try {
    fill(await getProfile());
  } catch (err) {
    loadError.value = true;
  }
  try {
    myFeedback.value = await getMyFeedback();
  } catch (err) {
    // 反馈列表加载失败时保持空列表
  }
});
</script>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}

.page-subtitle {
  margin: 6px 0 0;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.section-title {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--agri-ink);
  margin-bottom: 16px;
}

.profile-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}

.avatar-actions {
  margin-left: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
}

.mini-btn {
  border: 1px solid var(--agri-line-soft);
  background: rgba(236, 230, 216, 0.06);
  color: var(--agri-ink);
  font-size: 12px;
  padding: 5px 12px;
  border-radius: 980px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.mini-btn:hover {
  background: rgba(232, 198, 110, 0.14);
  color: var(--agri-gold-bright);
}

.mini-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mini-btn.ghost {
  background: rgba(236, 230, 216, 0.04);
  color: var(--agri-muted);
}

.mini-btn.ghost:hover {
  background: rgba(236, 230, 216, 0.09);
}

.profile-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--agri-ink);
}

.profile-email {
  font-size: 12px;
  color: var(--agri-muted);
  margin-top: 3px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.field-label {
  font-size: 13px;
  color: var(--agri-muted);
}

.field input,
.field textarea,
.field select {
  border: 1px solid var(--agri-line);
  background: rgba(4, 8, 14, 0.5);
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 14px;
  color: var(--agri-ink);
  outline: none;
  transition: all 0.25s ease;
}

.field textarea {
  resize: vertical;
  min-height: 90px;
}

.field input:focus,
.field textarea:focus,
.field select:focus {
  background: rgba(4, 8, 14, 0.75);
  border-color: var(--agri-gold-deep);
  box-shadow: 0 0 0 3px rgba(232, 198, 110, 0.16);
}

.field input:disabled {
  color: var(--agri-muted);
  cursor: not-allowed;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.farm-summary {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

.fs-item {
  flex: 1;
  padding: 12px;
  border-radius: 12px;
  background: rgba(236, 230, 216, 0.04);
  border: 1px solid var(--agri-line-soft);
  text-align: center;
}

.fs-value {
  display: block;
  font-size: 20px;
  font-weight: 600;
  color: var(--agri-ink);
}

.fs-label {
  display: block;
  font-size: 11px;
  color: var(--agri-muted);
  margin-top: 2px;
}

.switch-row,
.security-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(236, 230, 216, 0.07);
}

.switch-row:last-of-type,
.security-row:last-of-type {
  border-bottom: none;
}

.switch-title {
  font-size: 14px;
  color: var(--agri-ink);
}

.switch-desc {
  font-size: 12px;
  color: var(--agri-muted);
  margin-top: 3px;
}

.switch {
  width: 46px;
  height: 26px;
  border-radius: 980px;
  border: none;
  background: rgba(236, 230, 216, 0.16);
  cursor: pointer;
  padding: 3px;
  transition: all 0.25s ease;
  flex: 0 0 auto;
}

.switch span {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.25s ease;
}

.switch.on {
  background: linear-gradient(135deg, #e8c66e, #b98d34);
}

.switch.on span {
  transform: translateX(20px);
}

.pwd-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 6px;
  padding-top: 14px;
  border-top: 1px solid rgba(236, 230, 216, 0.07);
}

.pwd-block .field {
  margin-bottom: 0;
}

.form-error {
  font-size: 13px;
  color: #b03a3a;
}

.fb-list {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid rgba(236, 230, 216, 0.07);
}

.fb-list-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--agri-ink);
  margin-bottom: 10px;
}

.fb-empty {
  font-size: 13px;
  color: var(--agri-muted);
}

.fb-item {
  padding: 10px 0;
  border-bottom: 1px solid rgba(236, 230, 216, 0.06);
}

.fb-item:last-child {
  border-bottom: none;
}

.fb-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fb-category {
  font-size: 12px;
  color: var(--agri-muted);
}

.fb-time {
  font-size: 11px;
  color: var(--agri-muted);
  margin-left: auto;
}

.fb-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--agri-ink-soft);
  margin-top: 6px;
  white-space: pre-wrap;
}

.danger-row {
  display: flex;
  gap: 10px;
}

.logout-btn {
  margin-top: 14px;
  color: #b03a3a;
  border-color: rgba(255, 59, 48, 0.3);
}

.danger-row .logout-btn {
  flex: 1;
  margin-top: 14px;
}

@media (max-width: 900px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>

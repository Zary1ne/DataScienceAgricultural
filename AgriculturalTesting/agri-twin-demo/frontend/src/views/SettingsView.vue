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
          <div class="avatar big-avatar">{{ (form.name || "用").charAt(0) }}</div>
          <div class="profile-brief">
            <div class="profile-name">{{ form.name || "未设置" }}</div>
            <div class="profile-email">{{ form.email }}</div>
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
            <div class="switch-desc">普通农户账号</div>
          </div>
        </div>
        <button class="pill-btn pill-btn-ghost logout-btn" @click="doLogout">退出登录</button>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import state, { logout, notify } from "../store.js";
import { getProfile, updateProfile } from "../api.js";

const router = useRouter();
const saving = ref(false);
const loadError = ref(false);

const form = reactive({
  name: "张农户",
  email: "user@demo.com",
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

function doLogout() {
  logout();
  router.push("/login");
}

onMounted(async () => {
  try {
    fill(await getProfile());
  } catch (err) {
    loadError.value = true;
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
  color: #1d1d1f;
  margin-bottom: 16px;
}

.profile-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}

.big-avatar {
  width: 56px;
  height: 56px;
  font-size: 22px;
  background: #0071e3;
}

.profile-name {
  font-size: 16px;
  font-weight: 600;
  color: #1d1d1f;
}

.profile-email {
  font-size: 12px;
  color: #8e8e93;
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
  color: #6e6e73;
}

.field input {
  border: none;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 14px;
  color: #1d1d1f;
  outline: none;
  transition: all 0.25s ease;
}

.field input:focus {
  background: rgba(0, 113, 227, 0.06);
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.15);
}

.field input:disabled {
  color: #8e8e93;
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
  background: rgba(0, 0, 0, 0.03);
  text-align: center;
}

.fs-value {
  display: block;
  font-size: 20px;
  font-weight: 600;
  color: #0071e3;
}

.fs-label {
  display: block;
  font-size: 11px;
  color: #8e8e93;
  margin-top: 2px;
}

.switch-row,
.security-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.switch-row:last-of-type,
.security-row:last-of-type {
  border-bottom: none;
}

.switch-title {
  font-size: 14px;
  color: #1d1d1f;
}

.switch-desc {
  font-size: 12px;
  color: #8e8e93;
  margin-top: 3px;
}

.switch {
  width: 46px;
  height: 26px;
  border-radius: 980px;
  border: none;
  background: rgba(0, 0, 0, 0.12);
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
  background: #34c759;
}

.switch.on span {
  transform: translateX(20px);
}

.logout-btn {
  margin-top: 14px;
  color: #ff3b30;
  border-color: rgba(255, 59, 48, 0.3);
}

@media (max-width: 900px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>

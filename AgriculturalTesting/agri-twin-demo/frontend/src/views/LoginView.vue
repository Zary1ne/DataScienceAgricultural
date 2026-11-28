<template>
  <div class="login-page">
    <div class="login-bg" aria-hidden="true">
      <span class="steel-mesh"></span>
      <BrandEmblem class="login-emblem" :size="560" />
    </div>

    <div class="login-card card">
      <div class="login-eyebrow"><span class="dot"></span>AGRI DIGITAL TWIN</div>
      <h1 class="login-title">智慧农业数字孪生平台</h1>
      <p class="login-sub">演示版本 · 数据为模拟数据</p>

      <form class="login-form" @submit.prevent="submit">
        <label class="field">
          <span class="field-label">邮箱</span>
          <input v-model="email" type="email" placeholder="user@demo.com" autocomplete="username" />
        </label>
        <label class="field">
          <span class="field-label">密码</span>
          <input v-model="password" type="password" placeholder="demo123" autocomplete="current-password" />
        </label>
        <div v-if="error" class="login-error">{{ error }}</div>
        <button class="pill-btn login-btn" type="submit" :disabled="loading">
          {{ loading ? "登录中…" : "登录" }}
        </button>
      </form>

      <div class="quick">
        <div class="quick-label">快速登录（演示账号）</div>
        <div class="quick-btns">
          <button class="pill-btn pill-btn-ghost" @click="quick('user@demo.com', 'demo123')">
            以普通用户身份进入
          </button>
          <button class="pill-btn pill-btn-ghost" @click="quick('admin@demo.com', 'demo123')">
            以管理员身份进入
          </button>
        </div>
      </div>

      <div class="back-row">
        <span>还没有账号？</span>
        <RouterLink to="/register" class="link">立即注册</RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from "vue";
import { useRouter } from "vue-router";
import { login } from "../api.js";
import { loginUser, beginGate, openGate, endGate } from "../store.js";
import BrandEmblem from "../components/BrandEmblem.vue";

const router = useRouter();
const email = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function doLogin(e, p) {
  loading.value = true;
  error.value = "";
  try {
    const data = await login(e, p);
    loginUser(data);
    // 先合上钢板盖住登录页，路由切过去后再拉开，避免登录页残留在中间
    beginGate();
    await nextTick();
    await wait(80);
    await router.push(data.user.role === "admin" ? "/admin/dashboard" : "/home");
    await wait(140);
    openGate();
    await wait(960);
    endGate();
  } catch (err) {
    error.value =
      err.code === "NETWORK_ERROR" ? "后端未连接，请先启动服务" : "邮箱或密码错误";
  } finally {
    loading.value = false;
  }
}

function submit() {
  doLogin(email.value, password.value);
}

function quick(e, p) {
  email.value = e;
  password.value = p;
  doLogin(e, p);
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: radial-gradient(circle at 50% 16%, #232a33 0%, #14181e 46%, #0a0d12 100%);
  position: relative;
  overflow: hidden;
}

.login-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.steel-mesh {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.035) 0 1px,
      transparent 1px 9px
    ),
    repeating-linear-gradient(-45deg, rgba(0, 0, 0, 0.35) 0 1px, transparent 1px 9px);
  mask-image: radial-gradient(circle at 50% 40%, #000 0, rgba(0, 0, 0, 0.55) 55%, transparent 82%);
}

.login-emblem {
  position: relative;
  opacity: 0.16;
  filter: saturate(110%);
  transform: rotate(-6deg);
}

.login-page::before,
.login-page::after {
  content: "";
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.login-page::before {
  width: 560px;
  height: 560px;
  border: 1px solid rgba(236, 230, 216, 0.07);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.login-page::after {
  width: 820px;
  height: 820px;
  border: 1px solid rgba(236, 230, 216, 0.04);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.login-card {
  width: 440px;
  max-width: 100%;
  padding: 42px;
  border-radius: 26px;
  background: linear-gradient(160deg, rgba(24, 32, 46, 0.92), rgba(10, 15, 24, 0.96));
  border: 1px solid rgba(236, 230, 216, 0.12);
  box-shadow: 0 40px 90px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  animation: agri-rise 0.7s var(--agri-ease) both;
}

@media (max-height: 760px) {
  .login-card {
    padding: 28px 34px;
  }

  .login-form {
    margin-top: 18px;
    gap: 12px;
  }

  .quick {
    margin-top: 18px;
    padding-top: 16px;
  }

  .login-title {
    font-size: 24px;
  }
}

.login-eyebrow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: var(--agri-mono);
  font-size: 10px;
  letter-spacing: 0.24em;
  color: var(--agri-muted);
  margin-bottom: 14px;
}

.login-eyebrow .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--agri-lime-deep);
  animation: agri-pulse 2.4s ease-in-out infinite;
}

.login-title {
  font-size: 27px;
  font-weight: 650;
  letter-spacing: -0.035em;
  color: var(--agri-ink);
  text-align: center;
  line-height: 1.2;
}

.login-sub {
  font-size: 13px;
  color: var(--agri-muted);
  text-align: center;
  margin-top: 10px;
  letter-spacing: 0.02em;
}

.login-form {
  margin-top: 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12.5px;
  font-weight: 550;
  color: var(--agri-ink-soft);
}

.field input,
.field textarea,
.field select {
  border: 1px solid var(--agri-line);
  background: rgba(4, 8, 14, 0.55);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 14px;
  color: var(--agri-ink);
  outline: none;
  transition: all 0.3s var(--agri-ease);
}

.field input:focus,
.field textarea:focus,
.field select:focus {
  background: rgba(4, 8, 14, 0.8);
  border-color: var(--agri-gold-deep);
  box-shadow: 0 0 0 4px rgba(232, 198, 110, 0.16);
}

.field textarea {
  resize: vertical;
  min-height: 100px;
}

.login-error {
  font-size: 13px;
  color: #b03a3a;
}

.login-btn {
  margin-top: 4px;
  padding: 13px;
  font-size: 15px;
}

.quick {
  margin-top: 26px;
  padding-top: 22px;
  border-top: 1px solid rgba(236, 230, 216, 0.09);
}

.quick-label {
  font-size: 12px;
  color: var(--agri-muted);
  text-align: center;
  margin-bottom: 12px;
  letter-spacing: 0.04em;
}

.quick-btns {
  display: flex;
  gap: 10px;
}

.quick-btns .pill-btn {
  flex: 1;
  font-size: 13px;
  padding: 10px 8px;
}

.back-row {
  margin-top: 18px;
  text-align: center;
  font-size: 12.5px;
  color: var(--agri-muted);
}

.back-row .link {
  color: var(--agri-gold-bright);
  margin-left: 6px;
  font-weight: 550;
  text-decoration: underline;
  text-decoration-color: rgba(232, 198, 110, 0.6);
  text-underline-offset: 3px;
}
</style>

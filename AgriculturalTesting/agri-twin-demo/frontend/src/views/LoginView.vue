<template>
  <div class="login-page">
    <div class="login-card card">
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
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { login } from "../api.js";
import { loginUser } from "../store.js";

const router = useRouter();
const email = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");

async function doLogin(e, p) {
  loading.value = true;
  error.value = "";
  try {
    const data = await login(e, p);
    loginUser(data);
    router.push(data.user.role === "admin" ? "/admin/dashboard" : "/home");
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
  background: linear-gradient(160deg, #f5f5f7 0%, #eef2f7 50%, #eef7f2 100%);
}

.login-card {
  width: 420px;
  max-width: 100%;
  padding: 40px;
}

.login-title {
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #1d1d1f;
  text-align: center;
}

.login-sub {
  font-size: 14px;
  color: #6e6e73;
  text-align: center;
  margin-top: 8px;
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
  min-height: 100px;
}

.login-error {
  font-size: 13px;
  color: #ff3b30;
}

.login-btn {
  margin-top: 4px;
  padding: 13px;
  font-size: 16px;
}

.quick {
  margin-top: 26px;
  padding-top: 22px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.quick-label {
  font-size: 13px;
  color: #8e8e93;
  text-align: center;
  margin-bottom: 12px;
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
</style>

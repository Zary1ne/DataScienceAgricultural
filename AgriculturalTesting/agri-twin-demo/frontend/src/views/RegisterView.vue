<template>
  <div class="login-page">
    <div class="login-bg" aria-hidden="true">
      <span class="steel-mesh"></span>
      <BrandEmblem class="login-emblem" :size="560" />
    </div>

    <div class="login-card card">
      <div class="login-eyebrow"><span class="dot"></span>XIANG FARMER · 湘小农</div>
      <h1 class="login-title">注册账号</h1>
      <p class="login-sub">智慧农业数字孪生平台</p>

      <form class="login-form" @submit.prevent="submit">
        <label class="field">
          <span class="field-label">姓名</span>
          <input v-model="name" type="text" placeholder="请输入姓名" autocomplete="name" />
        </label>
        <label class="field">
          <span class="field-label">邮箱</span>
          <input v-model="email" type="email" placeholder="you@example.com" autocomplete="username" />
        </label>
        <label class="field">
          <span class="field-label">密码</span>
          <input v-model="password" type="password" placeholder="至少 6 位" autocomplete="new-password" />
        </label>
        <label class="field">
          <span class="field-label">确认密码</span>
          <input v-model="confirm" type="password" placeholder="再次输入密码" autocomplete="new-password" />
        </label>
        <div v-if="error" class="login-error">{{ error }}</div>
        <button class="pill-btn login-btn" type="submit" :disabled="loading">
          {{ loading ? "注册中…" : "注册并登录" }}
        </button>
      </form>

      <div class="back-row">
        <span>已有账号？</span>
        <RouterLink to="/login" class="link">返回登录</RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from "vue";
import { useRouter } from "vue-router";
import { register } from "../api.js";
import { loginUser, beginGate, openGate, endGate } from "../store.js";
import BrandEmblem from "../components/BrandEmblem.vue";

const router = useRouter();
const name = ref("");
const email = ref("");
const password = ref("");
const confirm = ref("");
const loading = ref(false);
const error = ref("");

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function submit() {
  if (!name.value.trim()) {
    error.value = "请输入姓名";
    return;
  }
  if (!EMAIL_PATTERN.test(email.value.trim())) {
    error.value = "请输入有效邮箱";
    return;
  }
  if (password.value.length < 6) {
    error.value = "密码长度不能少于 6 位";
    return;
  }
  if (password.value !== confirm.value) {
    error.value = "两次输入的密码不一致";
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const data = await register(name.value.trim(), email.value.trim(), password.value);
    loginUser(data);
    beginGate();
    await nextTick();
    await wait(80);
    await router.push("/home");
    await wait(140);
    openGate();
    await wait(960);
    endGate();
  } catch (err) {
    if (err.code === "NETWORK_ERROR") {
      error.value = "后端未连接，请先启动服务";
    } else {
      error.value = err.message || "注册失败";
    }
  } finally {
    loading.value = false;
  }
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

.login-card {
  width: 440px;
  max-width: 100%;
  padding: 38px 40px;
  border-radius: 26px;
  background: linear-gradient(160deg, rgba(24, 32, 46, 0.92), rgba(10, 15, 24, 0.96));
  border: 1px solid rgba(236, 230, 216, 0.12);
  box-shadow: 0 40px 90px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  animation: agri-rise 0.7s var(--agri-ease) both;
  position: relative;
  z-index: 1;
}

@media (max-height: 820px) {
  .login-card {
    padding: 26px 32px;
  }

  .login-form {
    margin-top: 18px;
    gap: 12px;
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
  background: var(--agri-gold);
  animation: agri-pulse 2.4s ease-in-out infinite;
}

.login-title {
  font-size: 26px;
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
  margin-top: 8px;
  letter-spacing: 0.02em;
}

.login-form {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
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

.field input {
  border: 1px solid var(--agri-line);
  background: rgba(4, 8, 14, 0.55);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 14px;
  color: var(--agri-ink);
  outline: none;
  transition: all 0.3s var(--agri-ease);
}

.field input:focus {
  background: rgba(4, 8, 14, 0.8);
  border-color: var(--agri-gold-deep);
  box-shadow: 0 0 0 4px rgba(232, 198, 110, 0.16);
}

.login-error {
  font-size: 13px;
  color: #ffb3b3;
}

.login-btn {
  margin-top: 4px;
  padding: 13px;
  font-size: 15px;
}

.back-row {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(236, 230, 216, 0.09);
  text-align: center;
  font-size: 13px;
  color: var(--agri-muted);
}

.link {
  color: var(--agri-gold-bright);
  margin-left: 6px;
  text-decoration: underline;
  text-decoration-color: rgba(232, 198, 110, 0.6);
  text-underline-offset: 3px;
}
</style>

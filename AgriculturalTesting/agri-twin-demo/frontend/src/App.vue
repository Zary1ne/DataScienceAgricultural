<template>
  <div class="app-root">
    <!-- 全局呼吸氛围层：青柠、林地、麦穗三种光晕缓慢漂移 -->
    <div class="ambient-layer" aria-hidden="true">
      <span class="ambient-orb orb-lime"></span>
      <span class="ambient-orb orb-sage"></span>
      <span class="ambient-orb orb-amber"></span>
      <span class="ambient-grain"></span>
    </div>

    <!-- 后端未连接提示 -->
    <transition name="fade">
      <div v-if="state.backendDown" class="conn-banner">
        <span class="conn-dot"></span>
        <span>后端未连接 — 请先启动 FastAPI 服务：<code>uvicorn main:app --reload --port 8000</code></span>
        <button class="conn-retry" @click="retry">重试</button>
      </div>
    </transition>

    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>

    <!-- 登录/注册成功的分屏转场：盖在路由之上，先合上再拉开 -->
    <AccessGate v-if="state.gateActive" :open="state.gateOpen" />

    <!-- 全局轻提示 -->
    <transition name="fade">
      <div v-if="state.toast" class="toast">{{ state.toast }}</div>
    </transition>
  </div>
</template>

<script setup>
import state from "./store.js";
import { getHome } from "./api.js";
import AccessGate from "./components/AccessGate.vue";

async function retry() {
  try {
    await getHome();
  } catch (err) {
    // 失败时 api.js 已再次将 backendDown 置为 true
  }
}
</script>

<style scoped>
.app-root {
  min-height: 100vh;
  position: relative;
  z-index: 1;
}

.ambient-layer {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.ambient-orb {
  position: absolute;
  display: block;
  border-radius: 50%;
  filter: blur(90px);
  will-change: transform, opacity;
}

.orb-lime {
  top: -20%;
  right: -10%;
  width: 52vw;
  height: 52vw;
  background: radial-gradient(circle, rgba(232, 198, 110, 0.16), transparent 66%);
  animation: agri-drift-a 26s ease-in-out infinite;
}

.orb-sage {
  bottom: -24%;
  left: -14%;
  width: 56vw;
  height: 56vw;
  background: radial-gradient(circle, rgba(38, 62, 108, 0.36), transparent 68%);
  animation: agri-drift-b 32s ease-in-out infinite;
}

.orb-amber {
  top: 34%;
  left: 40%;
  width: 34vw;
  height: 34vw;
  background: radial-gradient(circle, rgba(195, 154, 69, 0.14), transparent 66%);
  animation: agri-drift-c 28s ease-in-out infinite;
}

.ambient-grain {
  position: absolute;
  inset: 0;
  opacity: 0.5;
  background-image: radial-gradient(rgba(236, 230, 216, 0.14) 0.6px, transparent 0.6px);
  background-size: 4px 4px;
  mix-blend-mode: screen;
}

@keyframes agri-drift-a {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(-5%, 6%, 0) scale(1.12);
  }
}

@keyframes agri-drift-b {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(6%, -5%, 0) scale(1.08);
  }
}

@keyframes agri-drift-c {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0.5;
  }
  50% {
    transform: translate3d(-4%, 4%, 0) scale(1.16);
    opacity: 0.8;
  }
}

.conn-banner {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 18px;
  font-size: 13px;
  color: #ece6d8;
  background: rgba(12, 20, 34, 0.94);
  border: 1px solid rgba(236, 230, 216, 0.14);
  backdrop-filter: saturate(150%) blur(20px);
  -webkit-backdrop-filter: saturate(150%) blur(20px);
  border-radius: 980px;
  box-shadow: 0 14px 42px rgba(0, 0, 0, 0.5);
}

.conn-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff3b30;
  flex: 0 0 auto;
}

.conn-retry {
  border: none;
  background: #ff3b30;
  color: #fff;
  font-size: 12px;
  padding: 5px 14px;
  border-radius: 980px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.conn-retry:active {
  transform: scale(0.97);
}

.toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  padding: 11px 20px;
  font-size: 14px;
  color: #191204;
  background: linear-gradient(135deg, #f6e2a8, #dfb65a);
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: saturate(150%) blur(20px);
  -webkit-backdrop-filter: saturate(150%) blur(20px);
  border-radius: 980px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}
</style>

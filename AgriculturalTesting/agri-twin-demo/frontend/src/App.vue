<template>
  <div class="app-root">
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

    <!-- 全局轻提示 -->
    <transition name="fade">
      <div v-if="state.toast" class="toast">{{ state.toast }}</div>
    </transition>
  </div>
</template>

<script setup>
import state from "./store.js";
import { getHome } from "./api.js";

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
  color: #1d1d1f;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-radius: 980px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.06);
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
  color: #fff;
  background: rgba(29, 29, 31, 0.9);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-radius: 980px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}
</style>

<template>
  <div class="admin-layout">
    <aside class="sidebar">
      <div class="side-logo">AgriTwin · 管理后台</div>
      <nav class="side-menu">
        <RouterLink to="/admin/dashboard" active-class="active">仪表盘</RouterLink>
        <RouterLink to="/admin/feedback" active-class="active">用户建议</RouterLink>
        <RouterLink to="/admin/community" active-class="active">社区审核</RouterLink>
        <RouterLink to="/admin/users" active-class="active">用户管理</RouterLink>
      </nav>
      <div class="side-bottom">
        <button class="side-btn" @click="go('/home')">返回用户端</button>
        <button class="side-btn danger" @click="doLogout">退出登录</button>
      </div>
    </aside>

    <section class="admin-main">
      <header class="admin-topbar">
        <h1 class="admin-title">{{ currentTitle }}</h1>
      </header>
      <div class="admin-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { logout } from "../store.js";

const route = useRoute();
const router = useRouter();

const currentTitle = computed(() => route.meta.title || "管理后台");

function go(path) {
  router.push(path);
}

function doLogout() {
  logout();
  router.push("/login");
}
</script>

<style scoped>
.admin-layout {
  height: 100vh;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 240px;
  flex: 0 0 240px;
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-right: 1px solid rgba(0, 0, 0, 0.08);
}

.side-logo {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #1d1d1f;
  padding: 0 12px 24px;
}

.side-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.side-menu a {
  font-size: 15px;
  color: #6e6e73;
  padding: 11px 14px;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.side-menu a:hover {
  background: rgba(0, 0, 0, 0.04);
  color: #1d1d1f;
}

.side-menu a.active {
  background: rgba(0, 113, 227, 0.1);
  color: #0071e3;
  font-weight: 500;
}

.side-bottom {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.side-btn {
  border: none;
  background: transparent;
  text-align: left;
  font-size: 14px;
  color: #6e6e73;
  padding: 10px 14px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.side-btn:hover {
  background: rgba(0, 0, 0, 0.04);
  color: #1d1d1f;
}

.side-btn.danger:hover {
  color: #ff3b30;
}

.admin-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.admin-topbar {
  height: 64px;
  flex: 0 0 64px;
  display: flex;
  align-items: center;
  padding: 0 28px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.4);
}

.admin-title {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #1d1d1f;
}

.admin-content {
  flex: 1;
  overflow-y: auto;
  padding: 28px;
}
</style>

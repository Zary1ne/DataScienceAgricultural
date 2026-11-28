<template>
  <div class="admin-layout">
    <aside class="sidebar">
      <div class="side-logo">
        <span class="side-mark" aria-hidden="true">XF</span>
        <span class="side-logo-text">
          <strong>湘小农</strong>
          <em>管理后台</em>
        </span>
      </div>
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
  position: relative;
}

.sidebar {
  width: 244px;
  flex: 0 0 244px;
  display: flex;
  flex-direction: column;
  padding: 26px 16px 20px;
  background: linear-gradient(172deg, #0b1422 0%, #0a101b 60%, #070b12 100%);
  color: rgba(236, 230, 216, 0.82);
  border-right: 1px solid rgba(236, 230, 216, 0.08);
  position: relative;
  overflow: hidden;
}

.sidebar::after {
  content: "";
  position: absolute;
  top: -120px;
  right: -90px;
  width: 240px;
  height: 240px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(232, 198, 110, 0.18), transparent 68%);
  pointer-events: none;
}

.side-logo {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 10px 28px;
  position: relative;
  z-index: 1;
}

.side-mark {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: linear-gradient(135deg, #f6e2a8 0%, #e0b95c 44%, #b98d34 78%, #f2d68f 100%);
  color: #161006;
  font-size: 15px;
  font-weight: 700;
  font-family: var(--agri-mono);
  box-shadow: 0 8px 22px rgba(232, 198, 110, 0.18);
}

.side-logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.side-logo-text strong {
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: #ece6d8;
}

.side-logo-text em {
  font-style: normal;
  font-size: 9.5px;
  letter-spacing: 0.24em;
  color: rgba(236, 230, 216, 0.45);
  margin-top: 4px;
}

.side-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  position: relative;
  z-index: 1;
}

.side-menu a {
  font-size: 13.5px;
  color: rgba(236, 230, 216, 0.6);
  padding: 11px 14px;
  border-radius: 11px;
  transition: all 0.3s var(--agri-ease);
}

.side-menu a:hover {
  background: rgba(236, 230, 216, 0.06);
  color: #ece6d8;
}

.side-menu a.active {
  background: rgba(232, 198, 110, 0.14);
  color: #f6e2a8;
  font-weight: 600;
  box-shadow: inset 0 0 0 1px rgba(232, 198, 110, 0.3);
}

.side-bottom {
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
  z-index: 1;
}

.side-btn {
  border: none;
  background: transparent;
  text-align: left;
  font-size: 13px;
  color: rgba(236, 230, 216, 0.5);
  padding: 10px 14px;
  border-radius: 11px;
  cursor: pointer;
  transition: all 0.3s var(--agri-ease);
}

.side-btn:hover {
  background: rgba(236, 230, 216, 0.06);
  color: #ece6d8;
}

.side-btn.danger:hover {
  color: #ff9b9b;
}

.admin-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}

.admin-topbar {
  height: 72px;
  flex: 0 0 72px;
  display: flex;
  align-items: center;
  padding: 0 32px;
  border-bottom: 1px solid rgba(236, 230, 216, 0.08);
  background: rgba(7, 11, 18, 0.72);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.admin-title {
  font-size: 21px;
  font-weight: 650;
  letter-spacing: -0.03em;
  color: var(--agri-ink);
}

.admin-content {
  flex: 1;
  overflow-y: auto;
  padding: 30px 32px 56px;
}

@media (max-width: 900px) {
  .sidebar {
    width: 200px;
    flex-basis: 200px;
  }

  .admin-content {
    padding: 22px 18px 44px;
  }
}
</style>

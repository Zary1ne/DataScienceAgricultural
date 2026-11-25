<template>
  <div class="user-layout">
    <header class="topnav">
      <div class="topnav-inner">
        <RouterLink to="/home" class="logo">AgriTwin 智慧农业</RouterLink>

        <nav class="nav-links">
          <RouterLink to="/home" active-class="active">首页</RouterLink>
          <RouterLink to="/community" active-class="active">共享社区</RouterLink>
          <RouterLink to="/detect" active-class="active">病害识别</RouterLink>
          <RouterLink to="/twin" active-class="active">孪生平台</RouterLink>
        </nav>

        <div class="nav-right">
          <RouterLink to="/messages" class="msg-link" title="消息中心">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span v-if="state.unread" class="msg-badge num">{{ state.unread }}</span>
          </RouterLink>

          <div ref="menuWrap" class="user-menu">
            <div class="avatar menu-avatar" :style="avatarStyle" @click="toggleMenu">{{ avatarChar }}</div>
            <transition name="fade">
              <div v-if="menuOpen" class="dropdown">
                <div class="dropdown-user">
                  <div class="name">{{ state.user.name }}</div>
                  <div class="email">{{ state.user.email }}</div>
                </div>
                <button class="dropdown-item" @click="go('/messages')">消息中心</button>
                <button class="dropdown-item" @click="go('/settings')">个人设置</button>
                <button v-if="isAdmin" class="dropdown-item" @click="go('/admin/dashboard')">管理后台</button>
                <button class="dropdown-item danger" @click="doLogout">退出登录</button>
              </div>
            </transition>
          </div>
        </div>
      </div>
    </header>

    <main class="content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import state, { logout, setUnread } from "../store.js";
import { getMessages } from "../api.js";

const router = useRouter();
const menuOpen = ref(false);
const menuWrap = ref(null);

const avatarChar = computed(() =>
  state.user && state.user.name ? state.user.name.charAt(0) : "用"
);

const avatarStyle = computed(() => {
  const palette = ["#0071e3", "#34c759", "#ff9f0a", "#af52de", "#ff375f", "#5e5ce6"];
  const name = state.user && state.user.name ? state.user.name : "";
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return { background: palette[sum % palette.length] };
});

const isAdmin = computed(() => state.user && state.user.role === "admin");

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

function go(path) {
  menuOpen.value = false;
  router.push(path);
}

function doLogout() {
  menuOpen.value = false;
  logout();
  router.push("/login");
}

function onClickOutside(e) {
  if (menuWrap.value && !menuWrap.value.contains(e.target)) menuOpen.value = false;
}

onMounted(async () => {
  document.addEventListener("click", onClickOutside);
  try {
    const list = await getMessages();
    setUnread(list.filter((m) => !m.isRead).length);
  } catch (err) {
    // 后端未连接由 App 顶部提示条统一处理
  }
});

onBeforeUnmount(() => document.removeEventListener("click", onClickOutside));
</script>

<style scoped>
.user-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.topnav {
  position: relative;
  z-index: 100;
  flex: 0 0 64px;
  height: 64px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.topnav-inner {
  max-width: 1280px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  gap: 24px;
}

.logo {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #1d1d1f;
  white-space: nowrap;
}

.nav-links {
  display: flex;
  gap: 4px;
  flex: 1;
  justify-content: center;
}

.nav-links a {
  font-size: 15px;
  color: #6e6e73;
  padding: 8px 14px;
  border-radius: 980px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-links a:hover {
  color: #1d1d1f;
}

.nav-links a.active {
  color: #0071e3;
  font-weight: 500;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.msg-link {
  position: relative;
  display: flex;
  align-items: center;
  color: #6e6e73;
  padding: 8px;
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.msg-link:hover {
  color: #1d1d1f;
  background: rgba(0, 0, 0, 0.05);
}

.msg-badge {
  position: absolute;
  top: 2px;
  right: 0;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  color: #fff;
  background: #ff3b30;
  border-radius: 980px;
}

.user-menu {
  position: relative;
}

.menu-avatar {
  width: 36px;
  height: 36px;
  font-size: 15px;
  cursor: pointer;
}

.dropdown {
  position: absolute;
  top: 46px;
  right: 0;
  min-width: 200px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16), 0 4px 12px rgba(0, 0, 0, 0.06);
  z-index: 50;
}

.dropdown-user {
  padding: 8px 12px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  margin-bottom: 6px;
}

.dropdown-user .name {
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
}

.dropdown-user .email {
  font-size: 12px;
  color: #6e6e73;
  margin-top: 2px;
}

.dropdown-item {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 14px;
  color: #1d1d1f;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

.dropdown-item.danger {
  color: #ff3b30;
}

.content {
  flex: 1;
  overflow-y: auto;
}
</style>

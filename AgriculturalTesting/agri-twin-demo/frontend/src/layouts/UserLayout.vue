<template>
  <div class="user-layout">
    <header class="topnav">
      <div class="topnav-inner">
        <RouterLink to="/home" class="logo">
          <span class="logo-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M12 21c5.2-2.1 8-6.1 8-11.1 0-3-1.9-6-5-7.4-3 3.1-4.2 7.2-3.2 11.6-2.1-2.8-5-4.4-8.8-4.6.2 6.2 4 10.6 9 11.5Z"
                fill="currentColor"
              />
              <path d="M12 21c-.2-5 .7-9.3 3-13" stroke="#3a2a08" stroke-width="1.2" />
            </svg>
          </span>
          <span class="logo-text">
            <strong>湘小农</strong>
            <em>XIANG FARMER</em>
          </span>
        </RouterLink>

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
            <Avatar
              class="menu-avatar"
              :name="(state.user && state.user.name) || ''"
              :seed="(state.user && state.user.id) || ''"
              :url="(state.user && state.user.avatar) || ''"
              :size="36"
              @click="toggleMenu"
            />
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
import { getMessages, logoutApi } from "../api.js";
import Avatar from "../components/Avatar.vue";

const router = useRouter();
const menuOpen = ref(false);
const menuWrap = ref(null);

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
  logoutApi().catch(() => {});
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
  position: relative;
}

.topnav {
  position: relative;
  z-index: 100;
  flex: 0 0 72px;
  height: 72px;
  background: rgba(7, 11, 18, 0.78);
  backdrop-filter: saturate(160%) blur(22px);
  -webkit-backdrop-filter: saturate(160%) blur(22px);
  border-bottom: 1px solid rgba(236, 230, 216, 0.08);
}

.topnav::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(232, 198, 110, 0.65),
    rgba(236, 230, 216, 0.16),
    transparent
  );
  opacity: 0.8;
}

.topnav-inner {
  max-width: 1360px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  gap: 24px;
}

.logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.logo-mark {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: linear-gradient(135deg, #f6e2a8 0%, #e0b95c 44%, #b98d34 78%, #f2d68f 100%);
  color: #161006;
  box-shadow: 0 6px 18px rgba(232, 198, 110, 0.22);
}

.logo-mark svg {
  width: 19px;
  height: 19px;
}

.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.logo-text strong {
  font-size: 15.5px;
  font-weight: 650;
  letter-spacing: -0.03em;
  color: var(--agri-ink);
}

.logo-text em {
  font-style: normal;
  font-size: 9.5px;
  letter-spacing: 0.24em;
  color: var(--agri-muted);
  margin-top: 3px;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(236, 230, 216, 0.04);
  border: 1px solid rgba(236, 230, 216, 0.07);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.nav-links a {
  position: relative;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--agri-muted);
  padding: 8px 17px;
  border-radius: 999px;
  transition: color 0.3s var(--agri-ease), background 0.3s var(--agri-ease);
}

.nav-links a:hover {
  color: var(--agri-ink);
  background: rgba(236, 230, 216, 0.06);
}

.nav-links a.active {
  color: #f6e2a8;
  background: rgba(232, 198, 110, 0.14);
  box-shadow: inset 0 0 0 1px rgba(232, 198, 110, 0.32);
}

.nav-links a.active::before {
  content: "";
  position: absolute;
  left: 9px;
  top: 50%;
  width: 5px;
  height: 5px;
  margin-top: -2.5px;
  border-radius: 50%;
  background: var(--agri-lime);
  animation: agri-pulse 2.6s ease-in-out infinite;
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
  color: var(--agri-muted);
  padding: 8px;
  border-radius: 50%;
  transition: all 0.3s var(--agri-ease);
}

.msg-link:hover {
  color: var(--agri-gold-bright);
  background: rgba(236, 230, 216, 0.06);
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
  color: #191204;
  background: linear-gradient(135deg, #f6e2a8, #dfb65a);
  border-radius: 999px;
  font-weight: 600;
}

.user-menu {
  position: relative;
}

.menu-avatar {
  width: 38px;
  height: 38px;
  font-size: 15px;
  cursor: pointer;
  box-shadow: 0 0 0 2px rgba(7, 11, 18, 0.9), 0 0 0 3px rgba(236, 230, 216, 0.18);
  transition: transform 0.35s var(--agri-ease), box-shadow 0.35s var(--agri-ease);
}

.menu-avatar:hover {
  transform: translateY(-1px) scale(1.04);
  box-shadow: 0 0 0 2px rgba(7, 11, 18, 0.9), 0 0 0 3px rgba(232, 198, 110, 0.65);
}

.dropdown {
  position: absolute;
  top: 50px;
  right: 0;
  min-width: 220px;
  padding: 8px;
  background: rgba(11, 18, 32, 0.97);
  backdrop-filter: saturate(160%) blur(22px);
  -webkit-backdrop-filter: saturate(160%) blur(22px);
  border: 1px solid rgba(236, 230, 216, 0.1);
  border-radius: 18px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
  z-index: 50;
}

.dropdown-user {
  padding: 10px 12px 13px;
  border-bottom: 1px solid rgba(236, 230, 216, 0.08);
  margin-bottom: 6px;
}

.dropdown-user .name {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--agri-ink);
}

.dropdown-user .email {
  font-size: 12px;
  color: var(--agri-muted);
  margin-top: 2px;
}

.dropdown-item {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 13.5px;
  color: var(--agri-ink-soft);
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s var(--agri-ease);
}

.dropdown-item:hover {
  background: rgba(232, 198, 110, 0.12);
  color: var(--agri-gold-bright);
}

.dropdown-item.danger {
  color: #b03a3a;
}

.dropdown-item.danger:hover {
  background: rgba(214, 69, 69, 0.1);
}

.content {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

@media (max-width: 860px) {
  .topnav-inner {
    padding: 0 16px;
    gap: 12px;
  }

  .logo-text em {
    display: none;
  }

  .nav-links {
    gap: 0;
  }

  .nav-links a {
    padding: 8px 10px;
    font-size: 12.5px;
  }

  .nav-links a.active::before {
    display: none;
  }
}
</style>

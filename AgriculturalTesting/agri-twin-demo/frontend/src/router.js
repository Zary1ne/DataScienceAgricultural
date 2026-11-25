import { createRouter, createWebHistory } from "vue-router";
import { isLoggedIn, isAdmin, notify } from "./store.js";

import LoginView from "./views/LoginView.vue";
import UserLayout from "./layouts/UserLayout.vue";
import AdminLayout from "./layouts/AdminLayout.vue";

import HomeView from "./views/HomeView.vue";
import CommunityView from "./views/CommunityView.vue";
import DetectView from "./views/DetectView.vue";
import TwinView from "./views/TwinView.vue";
import MessagesView from "./views/MessagesView.vue";
import SettingsView from "./views/SettingsView.vue";

import AdminDashboardView from "./views/AdminDashboardView.vue";
import AdminFeedbackView from "./views/AdminFeedbackView.vue";
import AdminUsersView from "./views/AdminUsersView.vue";
import AdminCommunityView from "./views/AdminCommunityView.vue";
import TwinStudioView from "./views/TwinStudioView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/home" },
    { path: "/login", name: "login", component: LoginView },
    {
      path: "/",
      component: UserLayout,
      children: [
        { path: "home", name: "home", component: HomeView },
        { path: "community", name: "community", component: CommunityView },
        { path: "detect", name: "detect", component: DetectView },
        { path: "twin", name: "twin", component: TwinView },
        { path: "messages", name: "messages", component: MessagesView },
        { path: "settings", name: "settings", component: SettingsView },
      ],
    },
    { path: "/twin/studio", name: "twin-studio", component: TwinStudioView, meta: { fullscreen: true } },
    {
      path: "/admin",
      component: AdminLayout,
      meta: { requiresAdmin: true },
      children: [
        { path: "", redirect: "/admin/dashboard" },
        { path: "dashboard", name: "admin-dashboard", component: AdminDashboardView, meta: { title: "仪表盘" } },
        { path: "feedback", name: "admin-feedback", component: AdminFeedbackView, meta: { title: "用户建议" } },
        { path: "community", name: "admin-community", component: AdminCommunityView, meta: { title: "社区审核" } },
        { path: "users", name: "admin-users", component: AdminUsersView, meta: { title: "用户管理" } },
      ],
    },
    { path: "/:pathMatch(.*)*", redirect: "/home" },
  ],
});

router.beforeEach((to) => {
  // 已登录访问登录页 → 跳对应端
  if (to.path === "/login") {
    if (isLoggedIn()) return isAdmin() ? "/admin/dashboard" : "/home";
    return true;
  }

  // 未登录访问受保护路由 → 跳登录页
  if (!isLoggedIn()) return "/login";

  // 非 admin 访问 /admin/* → 跳首页并提示
  if (to.meta.requiresAdmin || to.path.startsWith("/admin")) {
    if (!isAdmin()) {
      notify("无权限访问管理后台");
      return "/home";
    }
  }
  return true;
});

export default router;

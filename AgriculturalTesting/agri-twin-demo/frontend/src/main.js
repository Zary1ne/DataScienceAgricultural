import { createApp } from "vue";
import App from "./App.vue";
import router from "./router.js";
import { logout, notify } from "./store.js";
import "./style.css";
import "./mossline.css";
import "./design.css";

// token 失效时统一清理登录态并回到登录页
let redirecting = false;
window.addEventListener("agri:unauthorized", async () => {
  if (redirecting) return;
  redirecting = true;
  logout();
  if (router.currentRoute.value.path !== "/login") {
    notify("登录已失效，请重新登录");
    await router.push("/login");
  }
  redirecting = false;
});

createApp(App).use(router).mount("#app");

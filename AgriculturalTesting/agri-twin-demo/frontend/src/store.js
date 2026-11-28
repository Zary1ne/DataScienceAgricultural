import { reactive } from "vue";

const STORAGE_KEY = "agri_user";

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

const saved = loadSaved();

// 全局响应式状态
const state = reactive({
  token: saved ? saved.token : null,
  user: saved ? saved.user : null,
  unread: 0, // 未读消息数（用于顶部红点）
  backendDown: false, // 后端是否未连接
  toast: null, // 全局轻提示
  gateActive: false, // 登录/注册成功的分屏转场是否挂载
  gateOpen: false, // 两块钢板是否已向两侧拉开
});

let toastTimer = null;

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: state.token, user: state.user }));
}

export function loginUser(payload) {
  state.token = payload.token;
  state.user = payload.user;
  persist();
}

export function logout() {
  state.token = null;
  state.user = null;
  state.unread = 0;
  localStorage.removeItem(STORAGE_KEY);
}

export function isLoggedIn() {
  return !!state.token;
}

export function isAdmin() {
  return !!(state.user && state.user.role === "admin");
}

export function setUnread(n) {
  state.unread = n;
}

export function setBackendDown(down) {
  state.backendDown = down;
}

export function notify(msg) {
  state.toast = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    state.toast = null;
  }, 2600);
}

// 登录/注册成功的分屏转场：先合上盖住旧页面，路由切换后再向两侧拉开
export function beginGate() {
  state.gateActive = true;
  state.gateOpen = false;
}

export function openGate() {
  state.gateOpen = true;
}

export function endGate() {
  state.gateActive = false;
  state.gateOpen = false;
}

export default state;

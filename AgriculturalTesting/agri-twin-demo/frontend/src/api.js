// 所有前后端通信统一封装在此文件
// baseURL 指向 FastAPI 后端，请求自动携带 token 与 role 请求头
import { setBackendDown } from "./store.js";

const BASE_URL = "http://localhost:8000";
const STORAGE_KEY = "agri_user";
const REQUEST_TIMEOUT_MS = 15_000;

function getAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

async function request(path, options = {}) {
  const auth = getAuth();
  const headers = { ...(options.headers || {}) };
  if (auth && auth.token) headers["X-Token"] = auth.token;
  if (auth && auth.user) headers["X-Role"] = auth.user.role;

  let res;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers, signal: controller.signal });
  } catch (err) {
    setBackendDown(true);
    const timedOut = err.name === "AbortError";
    const e = new Error(timedOut ? "后端响应超时，请检查 FastAPI 服务" : "后端未连接，请先启动 FastAPI 服务");
    e.code = timedOut ? "TIMEOUT" : "NETWORK_ERROR";
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  setBackendDown(false);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = typeof body?.detail === "string"
      ? body.detail
      : `请求失败（HTTP ${res.status}）`;
    const e = new Error(message);
    e.code = "HTTP_ERROR";
    e.status = res.status;
    throw e;
  }
  return res.json();
}

function jsonPost(path, body) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function jsonPut(path, body) {
  return request(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// —— 认证 ——
export function login(email, password) {
  return jsonPost("/api/auth/login", { email, password });
}

// —— 首页 ——
export function getHome() {
  return request("/api/home/news");
}

// —— 社区 ——
export function getPosts() {
  return request("/api/community/posts");
}

export function createPost(data) {
  return jsonPost("/api/community/posts", data);
}

export function likePost(id) {
  return request(`/api/community/posts/${id}/like`, { method: "POST" });
}

export function getComments(id) {
  return request(`/api/community/posts/${id}/comments`);
}

export function addComment(id, content) {
  return jsonPost(`/api/community/posts/${id}/comments`, { content });
}

// —— 病害识别 ——
export function detectImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  return request("/api/detect", { method: "POST", body: formData });
}

export function getDetectStatus() {
  return request("/api/detect/status");
}

export function getDetectHistory() {
  return request("/api/detect/history");
}

export function getDetectLibrary() {
  return request("/api/detect/library");
}

// —— 数字孪生 ——
export function getScene() {
  return request("/api/twin/scene");
}

export function getOverview() {
  return request("/api/twin/overview");
}

export function getTwinState() {
  return request("/api/twin/state");
}

export function getTwinWeather(latitude, longitude) {
  const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) });
  return request(`/api/twin/weather?${params.toString()}`);
}

export function toggleDevice(id, key, value) {
  return jsonPost(`/api/twin/devices/${id}/toggle`, { key, value });
}

export function getSoilProfile() {
  return request("/api/twin/soil-profile");
}

// —— 个人资料 ——
export function getProfile() {
  return request("/api/user/profile");
}

export function updateProfile(data) {
  return jsonPut("/api/user/profile", data);
}

// —— 消息 ——
export function getMessages() {
  return request("/api/messages");
}

export function markRead(id) {
  return request(`/api/messages/${id}/read`, { method: "POST" });
}

export function markAllRead() {
  return request("/api/messages/read-all", { method: "POST" });
}

// —— 管理端 ——
export function getAdminDashboard() {
  return request("/api/admin/dashboard");
}

export function getFeedback() {
  return request("/api/admin/feedback");
}

export function handleFeedback(id) {
  return request(`/api/admin/feedback/${id}/handle`, { method: "POST" });
}

export function getAdminUsers() {
  return request("/api/admin/users");
}

export function setUserStatus(id, status) {
  return jsonPost(`/api/admin/users/${id}/status`, { status });
}

export function sendMessage(data) {
  return jsonPost("/api/admin/send-message", data);
}

export function getAdminPosts() {
  return request("/api/admin/community/posts");
}

export function approvePost(id) {
  return request(`/api/admin/community/posts/${id}/approve`, { method: "POST" });
}

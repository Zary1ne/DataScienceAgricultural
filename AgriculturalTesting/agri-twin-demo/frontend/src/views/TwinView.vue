<template>
  <div class="page-container">
    <div class="page-head">
      <h1 class="page-title">我的农场</h1>
      <div class="head-actions">
        <button class="pill-btn pill-btn-ghost" @click="$router.push('/messages')">
          查看消息
          <span v-if="state.unread" class="pill-badge num">{{ state.unread }}</span>
        </button>
        <button class="pill-btn" @click="$router.push('/twin/studio')">进入孪生操作界面</button>
      </div>
    </div>

    <div class="stat-grid">
      <StatCard label="地块数" :value="overview.plots" icon="🌱" color="#34c759" />
      <StatCard label="在线设备" :value="overview.onlineDevices" icon="📡" color="#0071e3" />
      <StatCard label="今日识别次数" :value="overview.todayDetections" icon="🔍" color="#af52de" />
      <StatCard label="未读消息" :value="state.unread" icon="💬" color="#ff9f0a" />
    </div>

    <div class="twin-main">
      <div class="twin-scene">
        <SceneViewer ref="sceneRef" :objects="sceneObjects" @select="onSelect" />
        <div v-if="selectedObj" class="obj-info">
          <div class="obj-info-head">
            <span class="obj-info-name">{{ selectedObj.name }}</span>
            <span class="obj-badge" :class="statusClass(selectedObj.status)">{{ statusText(selectedObj.status) }}</span>
          </div>
          <p class="obj-info-desc">{{ selectedObj.desc }}</p>
          <div class="obj-info-metrics">
            <div v-for="m in selectedObj.metrics || []" :key="m.label" class="obj-info-metric">
              <span class="obj-info-label">{{ m.label }}</span>
              <span class="obj-info-value num">{{ m.value }}{{ m.unit }}</span>
            </div>
          </div>
        </div>
        <div v-else class="scene-overlay">点击场景中的田块或设备查看数据</div>
        <button class="enter-studio" @click="$router.push('/twin/studio')">进入全屏操作界面 →</button>
      </div>

      <div class="twin-side">
        <section class="card">
          <h3 class="card-title">最近告警</h3>
          <ul class="alert-list">
            <li v-for="a in alerts" :key="a.id" class="alert-item">
              <span class="alert-dot"></span>
              <div class="alert-body">
                <div class="alert-text">{{ a.text }}</div>
                <div class="alert-time num">{{ a.time }}</div>
              </div>
            </li>
          </ul>
        </section>

        <section class="card">
          <h3 class="card-title">快捷入口</h3>
          <div class="quick-grid">
            <button class="quick-btn" @click="$router.push('/detect')">病害识别</button>
            <button class="quick-btn" @click="$router.push('/community')">共享社区</button>
            <button class="quick-btn" @click="$router.push('/messages')">消息中心</button>
            <button class="quick-btn" @click="onSettings">个人设置</button>
          </div>
        </section>
      </div>
    </div>

    <section class="card demo-card">
      <div>
        <h3 class="card-title">数据联动演示</h3>
        <p class="card-subtitle">点击按钮，模拟选中水田子区域出现巡检提示</p>
      </div>
      <button class="pill-btn pill-btn-ghost" @click="triggerAlert">模拟告警触发</button>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import state, { setUnread } from "../store.js";
import SceneViewer from "../components/SceneViewer.vue";
import StatCard from "../components/StatCard.vue";
import { getScene, getOverview } from "../api.js";

const router = useRouter();
const sceneRef = ref(null);
const sceneObjects = ref([]);
const alerts = ref([
  { id: "field-ready", text: "水稻田块参数正常", time: "刚刚" },
]);
const selectedObj = ref(null);
const overview = ref({ plots: 0, onlineDevices: 0, todayDetections: 0 });

function onSelect(obj) {
  selectedObj.value = obj;
}

function statusText(s) {
  return s === "warning" ? "告警" : s === "danger" ? "故障" : "正常";
}

function statusClass(s) {
  return s === "warning" ? "is-warning" : s === "danger" ? "is-danger" : "is-normal";
}

function onSettings() {
  router.push("/settings");
}

function nowTime() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function triggerAlert() {
  alerts.value.unshift({
    id: "al-" + Date.now(),
    text: "水田子区域巡检提示（模拟告警）",
    time: nowTime(),
  });
  if (sceneRef.value) sceneRef.value.flashObject("field_1", 0xff3b30);
}

onMounted(async () => {
  try {
    const scene = await getScene();
    sceneObjects.value = scene.objects;
  } catch (err) {
    // 后端未连接由顶部提示条处理
  }
  try {
    const ov = await getOverview();
    overview.value = ov;
    setUnread(ov.unreadMessages);
  } catch (err) {
    // 后端未连接由顶部提示条处理
  }
});
</script>

<style scoped>
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pill-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  margin-left: 8px;
  font-size: 12px;
  background: #ff3b30;
  color: #fff;
  border-radius: 980px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.twin-main {
  display: grid;
  grid-template-columns: 65fr 35fr;
  gap: 20px;
  margin-bottom: 20px;
}

.twin-scene {
  position: relative;
  height: 460px;
}

.scene-overlay {
  position: absolute;
  top: 16px;
  left: 16px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 8px 14px;
  border-radius: 980px;
  pointer-events: none;
}

/* —— 选中对象信息卡 —— */
.obj-info {
  position: absolute;
  top: 14px;
  left: 14px;
  width: 252px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
  animation: fadeUp 0.24s ease;
  pointer-events: none;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.obj-info-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.obj-info-name {
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
}

.obj-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 980px;
}

.obj-badge.is-normal {
  color: #1a8f56;
  background: rgba(52, 199, 89, 0.14);
}

.obj-badge.is-warning {
  color: #b26a00;
  background: rgba(255, 159, 10, 0.16);
}

.obj-badge.is-danger {
  color: #c0281f;
  background: rgba(255, 59, 48, 0.14);
}

.obj-info-desc {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: #6e6e73;
}

.obj-info-metrics {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.obj-info-metric {
  padding: 7px 9px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.04);
}

.obj-info-label {
  display: block;
  font-size: 11px;
  color: #8e8e93;
}

.obj-info-value {
  display: block;
  margin-top: 2px;
  font-size: 14px;
  font-weight: 600;
  color: #1d1d1f;
}

.enter-studio {
  position: absolute;
  right: 16px;
  bottom: 16px;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  padding: 10px 18px;
  border-radius: 980px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.enter-studio:hover {
  background: #0071e3;
  transform: translateY(-1px);
}

.twin-side {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.alert-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.alert-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.alert-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff9f0a;
  margin-top: 6px;
  flex: 0 0 auto;
}

.alert-text {
  font-size: 14px;
  color: #1d1d1f;
}

.alert-time {
  font-size: 12px;
  color: #8e8e93;
  margin-top: 3px;
}

.quick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.quick-btn {
  border: none;
  background: rgba(0, 0, 0, 0.04);
  color: #1d1d1f;
  font-size: 14px;
  padding: 14px 8px;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.quick-btn:hover {
  background: rgba(0, 113, 227, 0.1);
  color: #0071e3;
}

.demo-card {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
</style>

<template>
  <div class="page-container">
    <div class="page-head">
      <div>
        <h1 class="page-title">病害识别</h1>
        <p class="page-subtitle">上传水稻叶片图片，由分类模型识别常见病害类别；结果仅供田间复核参考</p>
      </div>
      <div class="head-badge" :class="modelStatusClass">模型状态：{{ modelStatusLabel }}</div>
    </div>

    <div class="detect-layout">
      <div class="detect-left card">
        <div
          class="dropzone"
          :class="{ dragging }"
          @click="pick"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <div class="dz-icon">＋</div>
          <div class="dz-text">点击或拖拽图片到此处（支持多选）</div>
          <div class="dz-sub">支持 JPG / PNG / WebP，单张不超过 5MB，一次最多 {{ maxFiles }} 张</div>
        </div>
        <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden @change="onFile" />

        <div v-if="queue.length" class="queue">
          <div v-for="(q, i) in queue" :key="q.id" class="queue-item">
            <img :src="q.url" class="q-thumb" alt="" />
            <div class="q-body">
              <div class="q-name">{{ q.name }}</div>
              <div class="q-status" :class="'is-' + q.status">
                {{ statusText(q.status) }}
              </div>
              <div v-if="q.error" class="q-error" role="alert">{{ q.error }}</div>
            </div>
            <button class="q-remove" :disabled="busy" @click.stop="removeItem(i)">×</button>
          </div>
        </div>

        <div class="detect-actions">
          <button class="pill-btn" :disabled="!queue.length || busy" @click="runDetect">
            {{ busy ? `识别中 ${doneCount}/${queue.length}` : "开始批量识别" }}
          </button>
          <button v-if="queue.length && !busy" class="pill-btn pill-btn-ghost" @click="clearQueue">清空</button>
        </div>
      </div>

      <div class="detect-right card">
        <div class="model-banner" :class="modelBannerClass" role="status">{{ modelBanner }}</div>

        <div v-if="!results.length && !busy" class="empty-wrap">
          <EmptyState title="暂无识别结果" hint="上传图片后，诊断结果将显示在这里" />
        </div>
        <div v-else-if="busy && !results.length" class="loading-box">
          <div class="spinner"></div>
          <div class="loading-text">正在识别…</div>
        </div>
        <div v-else class="result-list">
          <div v-for="r in results" :key="r.image_id || r.filename" class="result-card">
            <div class="result-head">
              <div class="result-title-wrap">
                <h3 class="result-name">{{ r.results[0].disease }}</h3>
                <span class="result-file">{{ r.filename }}</span>
              </div>
              <span class="tag" :class="severityClass(r.results[0].severity)">{{ r.results[0].severity }}</span>
            </div>
            <div class="result-conf">
              <div class="conf-label">置信度</div>
              <div class="conf-row">
                <div class="progress conf-progress">
                  <span :style="{ width: (r.results[0].confidence * 100).toFixed(0) + '%' }"></span>
                </div>
                <span class="conf-num num">{{ (r.results[0].confidence * 100).toFixed(0) }}%</span>
              </div>
            </div>
            <div class="result-line"><b>症状</b> {{ r.results[0].symptoms }}</div>
            <div class="result-line solution"><b>防治建议</b><br />{{ r.results[0].solution }}</div>
          </div>
        </div>
      </div>
    </div>

    <section class="card library">
      <div class="section-head">
        <h2 class="section-title">病害知识库</h2>
        <span class="section-hint">常见病害症状与防治要点，供人工复核参考</span>
      </div>
      <div class="library-grid">
        <div v-for="item in library" :key="item.id" class="lib-card">
          <div class="lib-head">
            <span class="lib-crop">{{ item.crop }}</span>
            <span class="tag" :class="severityClass(item.severity)">{{ item.severity }}</span>
          </div>
          <h3 class="lib-name">{{ item.disease }}</h3>
          <div class="lib-row"><b>症状</b>{{ item.symptoms }}</div>
          <div class="lib-row"><b>防治</b>{{ item.solution }}</div>
        </div>
      </div>
      <div v-if="libraryError" class="error-tip">病害知识库加载失败：后端未连接</div>
    </section>

    <section class="card history">
      <div class="section-head">
        <h2 class="section-title">识别历史</h2>
        <span class="section-hint num">共 {{ history.length }} 条</span>
      </div>
      <div v-if="historyError" class="error-tip">历史记录加载失败：后端未连接</div>
      <div v-else-if="!history.length" class="empty-wrap small">
        <EmptyState title="暂无识别记录" hint="完成一次识别后，记录会保存在这里" />
      </div>
      <div v-else class="history-list">
        <div v-for="h in history" :key="h.id" class="history-item">
          <div class="thumb">🌿</div>
          <div class="h-body">
            <div class="h-disease">{{ h.disease }}</div>
            <div class="h-meta num">{{ (h.confidence * 100).toFixed(0) }}% · {{ h.time }}</div>
            <div class="h-file">{{ h.image }}</div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import EmptyState from "../components/EmptyState.vue";
import { detectImage, getDetectHistory, getDetectLibrary, getDetectStatus } from "../api.js";

const maxFiles = 5;
const fileInput = ref(null);
const queue = ref([]);
const results = ref([]);
const busy = ref(false);
const dragging = ref(false);
const modelStatus = ref(null);
const library = ref([]);
const libraryError = ref(false);
const history = ref([]);
const historyError = ref(false);
let uid = 0;

const doneCount = computed(() => queue.value.filter((q) => q.status === "done" || q.status === "error").length);
const modelStatusLabel = computed(() => {
  if (!modelStatus.value) return "检查中";
  return modelStatus.value.status === "ready" ? "已连接" : "不可用";
});
const modelStatusClass = computed(() => (
  modelStatus.value?.status === "ready" ? "is-ready" : "is-unavailable"
));
const modelBannerClass = computed(() => (
  modelStatus.value?.status === "ready" ? "is-ready" : "is-unavailable"
));
const modelBanner = computed(() => {
  if (!modelStatus.value) return "正在检查模型状态…";
  if (modelStatus.value.status === "ready") {
    return `水稻分类模型已加载（${modelStatus.value.version}，${modelStatus.value.classes} 类）。模型不评估病害程度，请结合田间情况复核。`;
  }
  return `模型当前不可用：${modelStatus.value.message || "请确认后端服务和模型依赖已启动。"}`;
});

function pick() {
  if (busy.value) return;
  fileInput.value && fileInput.value.click();
}

function addFiles(files) {
  for (const file of files) {
    if (queue.value.length >= maxFiles) break;
    if (!file.type.startsWith("image/")) continue;
    if (file.size > 5 * 1024 * 1024) continue;
    queue.value.push({
      id: "q" + ++uid,
      file,
      name: file.name,
      url: URL.createObjectURL(file),
      status: "pending",
      result: null,
      error: "",
    });
  }
}

function onFile(e) {
  const files = Array.from(e.target.files || []);
  e.target.value = "";
  addFiles(files);
}

function onDrop(e) {
  dragging.value = false;
  addFiles(Array.from(e.dataTransfer.files || []));
}

function removeItem(i) {
  const item = queue.value[i];
  if (item && item.url) URL.revokeObjectURL(item.url);
  queue.value.splice(i, 1);
}

function clearQueue() {
  queue.value.forEach((q) => q.url && URL.revokeObjectURL(q.url));
  queue.value = [];
  results.value = [];
}

function statusText(s) {
  return s === "running" ? "识别中…" : s === "done" ? "已完成" : s === "error" ? "失败" : "待识别";
}

async function runDetect() {
  if (!queue.value.length || busy.value) return;
  busy.value = true;
  results.value = [];
  for (const item of queue.value) {
    if (item.status === "done") continue;
    item.status = "running";
    item.error = "";
    try {
      const data = await detectImage(item.file);
      item.status = "done";
      item.result = data;
      results.value.push(data);
    } catch (err) {
      item.status = "error";
      item.error = err.message || "识别失败，请检查图片或后端模型状态";
    }
  }
  busy.value = false;
  refreshHistory();
}

async function refreshHistory() {
  try {
    history.value = await getDetectHistory();
    historyError.value = false;
  } catch (err) {
    historyError.value = true;
  }
}

function severityClass(sev) {
  if (!sev || sev === "无") return "tag-green";
  if (sev === "轻度" || sev === "中度" || sev === "待评估") return "tag-orange";
  return "tag-red";
}

async function refreshModelStatus() {
  try {
    modelStatus.value = await getDetectStatus();
  } catch (err) {
    modelStatus.value = { status: "unavailable", message: err.message };
  }
}

onMounted(async () => {
  refreshHistory();
  refreshModelStatus();
  try {
    library.value = await getDetectLibrary();
  } catch (err) {
    libraryError.value = true;
  }
});

onBeforeUnmount(() => {
  queue.value.forEach((q) => q.url && URL.revokeObjectURL(q.url));
});
</script>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.page-subtitle {
  margin: 6px 0 0;
}

.head-badge {
  flex: 0 0 auto;
  font-size: 13px;
  color: #b26a00;
  background: rgba(255, 159, 10, 0.14);
  border: 1px solid rgba(255, 159, 10, 0.32);
  padding: 7px 14px;
  border-radius: 980px;
}

.head-badge.is-ready {
  color: #167447;
  background: rgba(52, 199, 89, 0.12);
  border-color: rgba(52, 199, 89, 0.28);
}

.head-badge.is-unavailable {
  color: #a45b00;
}

.detect-layout {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 24px;
  align-items: stretch;
  margin-bottom: 24px;
}

.detect-left {
  gap: 16px;
}

.dropzone {
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed rgba(0, 0, 0, 0.14);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 24px;
}

.dropzone:hover,
.dropzone.dragging {
  border-color: #0071e3;
  background: rgba(0, 113, 227, 0.04);
}

.dz-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.05);
  color: #8e8e93;
  font-size: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.dz-text {
  font-size: 15px;
  color: #1d1d1f;
  font-weight: 500;
}

.dz-sub {
  font-size: 13px;
  color: #8e8e93;
  margin-top: 8px;
}

.queue {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

.queue-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.03);
}

.q-thumb {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  object-fit: cover;
  flex: 0 0 auto;
}

.q-body {
  min-width: 0;
  flex: 1;
}

.q-name {
  font-size: 12px;
  color: #1d1d1f;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.q-status {
  font-size: 11px;
  margin-top: 3px;
  color: #8e8e93;
}

.q-status.is-done {
  color: #1a8f56;
}

.q-status.is-error {
  color: #c0281f;
}

.q-status.is-running {
  color: #0071e3;
}

.q-error {
  margin-top: 4px;
  color: #c0281f;
  font-size: 11px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.q-remove {
  border: none;
  background: transparent;
  color: #8e8e93;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 2px;
}

.q-remove:hover {
  color: #ff3b30;
}

.detect-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.detect-right {
  min-height: 320px;
}

.model-banner {
  padding: 10px 12px;
  border: 1px solid rgba(255, 159, 10, 0.28);
  border-radius: 12px;
  color: #8a5700;
  background: rgba(255, 159, 10, 0.1);
  font-size: 12px;
  line-height: 1.55;
}

.model-banner.is-ready {
  color: #176b3f;
  border-color: rgba(52, 199, 89, 0.26);
  background: rgba(52, 199, 89, 0.09);
}

.empty-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 0;
}

.empty-wrap.small {
  padding: 16px 0;
}

.loading-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 60px 0;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top-color: #0071e3;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 14px;
  color: #6e6e73;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 16px;
  overflow-y: auto;
  max-height: 560px;
}

.result-card {
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.03);
  padding: 16px;
}

.result-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.result-name {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #1d1d1f;
}

.result-file {
  display: block;
  font-size: 11px;
  color: #8e8e93;
  margin-top: 3px;
  word-break: break-all;
}

.result-conf {
  margin-top: 12px;
}

.conf-label {
  font-size: 12px;
  color: #8e8e93;
  margin-bottom: 6px;
}

.conf-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.conf-progress {
  flex: 1;
}

.conf-num {
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
}

.result-line {
  font-size: 13px;
  color: #6e6e73;
  line-height: 1.65;
  margin-top: 10px;
}

.result-line b {
  color: #1d1d1f;
  font-weight: 600;
  margin-right: 6px;
}

.result-line.solution {
  white-space: pre-line;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.section-title {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #1d1d1f;
}

.section-hint {
  font-size: 12px;
  color: #8e8e93;
}

.library {
  margin-bottom: 24px;
}

.library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.lib-card {
  padding: 16px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid transparent;
  transition: all 0.25s ease;
}

.lib-card:hover {
  border-color: rgba(0, 113, 227, 0.24);
  background: #fff;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
}

.lib-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.lib-crop {
  font-size: 12px;
  color: #0071e3;
  background: rgba(0, 113, 227, 0.08);
  padding: 2px 8px;
  border-radius: 980px;
}

.lib-name {
  font-size: 16px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 10px 0 8px;
}

.lib-row {
  font-size: 12px;
  line-height: 1.65;
  color: #6e6e73;
  margin-top: 6px;
}

.lib-row b {
  color: #1d1d1f;
  margin-right: 6px;
}

.history {
  gap: 0;
}

.history-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.03);
}

.thumb {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex: 0 0 auto;
}

.h-body {
  min-width: 0;
}

.h-disease {
  font-size: 14px;
  font-weight: 500;
  color: #1d1d1f;
}

.h-meta {
  font-size: 12px;
  color: #8e8e93;
  margin-top: 3px;
}

.h-file {
  font-size: 11px;
  color: #aeaeb2;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 900px) {
  .detect-layout {
    grid-template-columns: 1fr;
  }
}
</style>

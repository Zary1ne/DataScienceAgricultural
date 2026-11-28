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
        <div class="history-head-right">
          <span class="section-hint num">共 {{ history.length }} 条</span>
          <button v-if="history.length" class="clear-btn" @click="exportHistory">导出 CSV</button>
          <button v-if="history.length" class="clear-btn" @click="clearHistory">清空</button>
        </div>
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
          <button class="item-del" @click.stop="removeHistory(h)">删除</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import EmptyState from "../components/EmptyState.vue";
import { detectImage, getDetectHistory, getDetectLibrary, getDetectStatus, deleteDetectHistory, clearDetectHistory } from "../api.js";
import { notify } from "../store.js";

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

async function removeHistory(h) {
  try {
    await deleteDetectHistory(h.id);
    history.value = history.value.filter((item) => item.id !== h.id);
    notify("识别记录已删除");
  } catch (err) {
    notify("删除失败，请稍后重试");
  }
}

async function clearHistory() {
  try {
    await clearDetectHistory();
    history.value = [];
    notify("识别历史已清空");
  } catch (err) {
    notify("清空失败，请稍后重试");
  }
}

function exportHistory() {
  if (!history.value.length) return;
  const header = ["识别时间", "病害类别", "置信度", "严重程度", "文件名"];
  const rows = history.value.map((h) => [
    h.time,
    h.disease,
    `${(h.confidence * 100).toFixed(1)}%`,
    h.severity || "",
    h.image,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  // 加 BOM，确保 Excel 打开中文不乱码
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `识别历史_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
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
  color: #f0c083;
  background: rgba(255, 159, 10, 0.14);
  border: 1px solid rgba(255, 159, 10, 0.32);
  padding: 7px 14px;
  border-radius: 980px;
}

.head-badge.is-ready {
  color: #fff8e6;
  background-image: repeating-linear-gradient(
      115deg,
      rgba(246, 226, 168, 0) 0 6px,
      rgba(246, 226, 168, 0.22) 6px 7px,
      rgba(246, 226, 168, 0) 7px 14px
    ),
    linear-gradient(135deg, rgba(255, 248, 230, 0.2), rgba(232, 198, 110, 0.12));
  border-color: rgba(246, 226, 168, 0.38);
  text-shadow: 0 0 10px rgba(232, 198, 110, 0.5);
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
  border: 2px dashed rgba(236, 230, 216, 0.18);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 24px;
}

.dropzone:hover,
.dropzone.dragging {
  border-color: var(--agri-gold);
  background: rgba(232, 198, 110, 0.05);
}

.dz-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(236, 230, 216, 0.06);
  color: var(--agri-muted);
  font-size: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.dz-text {
  font-size: 15px;
  color: var(--agri-ink);
  font-weight: 500;
}

.dz-sub {
  font-size: 13px;
  color: var(--agri-muted);
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
  background: rgba(236, 230, 216, 0.04);
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
  color: var(--agri-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.q-status {
  font-size: 11px;
  margin-top: 3px;
  color: var(--agri-muted);
}

.q-status.is-done {
  color: #f0dca8;
}

.q-status.is-error {
  color: #c0281f;
}

.q-status.is-running {
  color: var(--agri-ink);
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
  color: var(--agri-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 2px;
}

.q-remove:hover {
  color: #b03a3a;
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
  color: #fff8e6;
  border-color: rgba(246, 226, 168, 0.3);
  background: rgba(246, 226, 168, 0.1);
  text-shadow: 0 0 10px rgba(232, 198, 110, 0.4);
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
  border: 3px solid rgba(236, 230, 216, 0.12);
  border-top-color: var(--agri-gold);
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
  color: var(--agri-muted);
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
  background: rgba(236, 230, 216, 0.04);
  border: 1px solid var(--agri-line-soft);
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
  color: var(--agri-ink);
}

.result-file {
  display: block;
  font-size: 11px;
  color: var(--agri-muted);
  margin-top: 3px;
  word-break: break-all;
}

.result-conf {
  margin-top: 12px;
}

.conf-label {
  font-size: 12px;
  color: var(--agri-muted);
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
  color: var(--agri-ink);
}

.result-line {
  font-size: 13px;
  color: var(--agri-muted);
  line-height: 1.65;
  margin-top: 10px;
}

.result-line b {
  color: var(--agri-ink);
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
  color: var(--agri-ink);
}

.section-hint {
  font-size: 12px;
  color: var(--agri-muted);
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
  background: rgba(236, 230, 216, 0.035);
  border: 1px solid var(--agri-line-soft);
  transition: all 0.25s ease;
}

.lib-card:hover {
  border-color: rgba(232, 198, 110, 0.3);
  background: rgba(232, 198, 110, 0.06);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
}

.lib-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.lib-crop {
  font-size: 12px;
  color: #ecd9a4;
  background: rgba(232, 198, 110, 0.1);
  padding: 2px 8px;
  border-radius: 980px;
}

.lib-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--agri-ink);
  margin: 10px 0 8px;
}

.lib-row {
  font-size: 12px;
  line-height: 1.65;
  color: var(--agri-muted);
  margin-top: 6px;
}

.lib-row b {
  color: var(--agri-ink);
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

.history-head-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.clear-btn {
  font-size: 12px;
  color: var(--agri-muted);
  background: none;
  border: 1px solid var(--agri-line);
  border-radius: 8px;
  padding: 3px 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-btn:hover {
  color: #b03a3a;
  border-color: rgba(255, 59, 48, 0.35);
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(236, 230, 216, 0.04);
  border: 1px solid var(--agri-line-soft);
}

.item-del {
  margin-left: auto;
  flex: 0 0 auto;
  font-size: 12px;
  color: var(--agri-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 2px;
  transition: color 0.2s ease;
}

.item-del:hover {
  color: #b03a3a;
}

.thumb {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(236, 230, 216, 0.07);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex: 0 0 auto;
}

.h-body {
  min-width: 0;
  flex: 1;
}

.h-disease {
  font-size: 14px;
  font-weight: 500;
  color: var(--agri-ink);
}

.h-meta {
  font-size: 12px;
  color: var(--agri-muted);
  margin-top: 3px;
}

.h-file {
  font-size: 11px;
  color: var(--agri-muted);
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

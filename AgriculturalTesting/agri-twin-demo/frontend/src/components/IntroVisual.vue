<template>
  <div class="iv-shell" :class="'kind-' + kind">
    <div class="mini-chrome">
      <span class="dots"><i></i><i></i><i></i></span>
      <span class="chrome-name">{{ chrome }}</span>
      <span class="chrome-live"><span class="pulse"></span>LIVE</span>
    </div>

    <div class="mini-body">
      <!-- 病害识别 -->
      <template v-if="kind === 'detect'">
        <div class="scan">
          <svg class="leaf" viewBox="0 0 140 96" aria-hidden="true">
            <defs>
              <linearGradient id="ivLeaf" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#f2dda6" />
                <stop offset="0.5" stop-color="#c9a45c" />
                <stop offset="1" stop-color="#7a5a1d" />
              </linearGradient>
            </defs>
            <path
              d="M10 84C26 30 68 10 130 12c-8 44-44 76-120 72Z"
              fill="url(#ivLeaf)"
              opacity="0.9"
            />
            <path d="M16 78C46 58 80 34 124 18" stroke="#f0e3bd" stroke-opacity="0.55" stroke-width="1.4" fill="none" />
            <path d="M46 54c8-4 14-2 20 2M64 42c8-4 15-2 21 2M84 30c8-4 14-2 20 2" stroke="#f0e3bd" stroke-opacity="0.35" stroke-width="1" fill="none" />
          </svg>
          <div class="bbox"><span>稻瘟病 · 92.4%</span></div>
          <div class="scanline"></div>
          <div class="corner tl"></div>
          <div class="corner tr"></div>
          <div class="corner bl"></div>
          <div class="corner br"></div>
        </div>
        <div class="detect-rows">
          <div v-for="d in diseases" :key="d.name" class="d-row">
            <span class="d-name">{{ d.name }}</span>
            <span class="d-bar"><i :style="{ width: d.pct + '%' }"></i></span>
            <b class="d-pct">{{ d.pct }}%</b>
          </div>
        </div>
      </template>

      <!-- 共享社区 -->
      <template v-else-if="kind === 'community'">
        <div class="post">
          <div class="p-head">
            <span class="ava"></span>
            <div class="p-meta">
              <b>田埂观察员</b>
              <em>3 分钟前 · 湖南常德</em>
            </div>
            <span class="p-tag">求助</span>
          </div>
          <p class="p-text">叶片出现褐色梭形病斑，边缘发黄，是稻瘟病吗？在线等。</p>
          <div class="p-imgs"><i></i><i></i><i></i></div>
          <div class="p-actions">
            <span>
              <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z" /></svg>
              128
            </span>
            <span>
              <svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z" /></svg>
              24
            </span>
            <span class="p-share">分享</span>
          </div>
        </div>
        <div class="reply">
          <span class="ava sm"></span>
          <p><b>农技站</b> 建议先排水晒田，用三环唑喷雾，间隔 7 天再补一次。</p>
        </div>
      </template>

      <!-- 数字孪生 -->
      <template v-else-if="kind === 'twin'">
        <div class="twin">
          <div class="field">
            <div class="field-plane">
              <i
                v-for="(p, i) in plots"
                :key="i"
                class="plot"
                :class="p.cls"
                :style="{ animationDelay: i * 0.12 + 's' }"
              ></i>
            </div>
            <div class="field-sweep"></div>
          </div>
          <div class="twin-side">
            <div class="gauge">
              <svg viewBox="0 0 80 46">
                <path d="M8 40a32 32 0 0 1 64 0" fill="none" stroke="rgba(236,230,216,0.14)" stroke-width="6" stroke-linecap="round" />
                <path d="M8 40a32 32 0 0 1 64 0" fill="none" stroke="#e8c66e" stroke-width="6" stroke-linecap="round" stroke-dasharray="70 100" />
              </svg>
              <b>72<span>%</span></b>
            </div>
            <div class="chips">
              <span>土壤 23.4℃</span>
              <span>湿度 68%</span>
              <span>光照 4.2 万lx</span>
            </div>
          </div>
        </div>
      </template>

      <!-- 消息中心 -->
      <template v-else-if="kind === 'messages'">
        <div class="msg-list">
          <div v-for="(m, i) in messages" :key="i" class="m-row" :class="{ unread: m.unread }">
            <span class="m-dot"></span>
            <div class="m-main">
              <div class="m-top">
                <b>{{ m.title }}</b>
                <em>{{ m.time }}</em>
              </div>
              <p>{{ m.text }}</p>
            </div>
          </div>
        </div>
        <div class="msg-foot">
          <span class="m-badge">2 条未读</span>
          <span class="m-link">全部标为已读 →</span>
        </div>
      </template>

      <!-- 管理后台（仅预览） -->
      <template v-else>
        <div class="admin">
          <div class="kpis">
            <div v-for="k in kpis" :key="k.label" class="kpi">
              <em>{{ k.label }}</em>
              <b>{{ k.value }}</b>
              <span>{{ k.delta }}</span>
            </div>
          </div>
          <div class="bars">
            <span v-for="(h, i) in bars" :key="i" :style="{ height: h + '%', animationDelay: i * 0.08 + 's' }"></span>
          </div>
          <div class="admin-foot">
            <span class="lock">
              <svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
            </span>
            <div>
              <b>管理员视图预览</b>
              <em>普通账号可查看，但无法进入与操作</em>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  kind: { type: String, default: "detect" },
});

const labels = {
  detect: "detect · 病害识别",
  community: "community · 共享社区",
  twin: "digital twin · 数字孪生",
  messages: "inbox · 消息中心",
  admin: "admin · 管理后台",
};
const chrome = computed(() => labels[props.kind] || labels.detect);

const diseases = [
  { name: "稻瘟病", pct: 92 },
  { name: "纹枯病", pct: 63 },
  { name: "白叶枯病", pct: 28 },
];

// 4 × 3 田块，颜色代表不同长势
const plots = [
  { cls: "p1" }, { cls: "p2" }, { cls: "p3" }, { cls: "p1" },
  { cls: "p2" }, { cls: "p3" }, { cls: "p1" }, { cls: "p2" },
  { cls: "p3" }, { cls: "p1" }, { cls: "p2" }, { cls: "p3" },
];

const messages = [
  { title: "病害检测完成", time: "刚刚", unread: true, text: "3 号田块检测到疑似稻瘟病，置信度 92.4%，请及时查看。" },
  { title: "管理员回复了你的建议", time: "1 小时前", unread: true, text: "感谢反馈，自选行情排序已在最新版本中上线。" },
  { title: "系统维护通知", time: "昨天", unread: false, text: "本周日 02:00–04:00 进行例行维护，期间行情刷新可能延迟。" },
];

const kpis = [
  { label: "注册用户", value: "128", delta: "+12" },
  { label: "社区帖子", value: "346", delta: "+28" },
  { label: "待审内容", value: "7", delta: "3 条紧急" },
];
const bars = [42, 58, 36, 72, 64, 88, 54, 76, 62, 92, 70, 48];
</script>

<style scoped>
.iv-shell {
  --line: rgba(236, 230, 216, 0.1);
  --dim: #8b94a5;
  position: relative;
  width: 100%;
  border-radius: 18px;
  border: 1px solid rgba(236, 230, 216, 0.11);
  background: linear-gradient(160deg, rgba(18, 28, 46, 0.96), rgba(8, 13, 22, 0.98));
  box-shadow: 0 26px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  overflow: hidden;
  font-size: 12px;
  color: #e6e1d5;
}

.iv-shell::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at 70% -10%, rgba(232, 198, 110, 0.12), transparent 52%);
}

.mini-chrome {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.025);
}

.dots {
  display: flex;
  gap: 5px;
}

.dots i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(236, 230, 216, 0.18);
}

.dots i:first-child {
  background: rgba(232, 198, 110, 0.7);
}

.chrome-name {
  flex: 1;
  font-family: var(--agri-mono, monospace);
  font-size: 10.5px;
  letter-spacing: 0.1em;
  color: #97a1b3;
  text-transform: lowercase;
}

.chrome-live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--agri-mono, monospace);
  font-size: 9.5px;
  letter-spacing: 0.14em;
  color: #e8c66e;
}

.chrome-live .pulse {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #e8c66e;
  animation: iv-pulse 2s ease-in-out infinite;
}

.mini-body {
  padding: 16px;
  position: relative;
  min-height: 250px;
}

/* —— 病害识别 —— */
.scan {
  position: relative;
  height: 132px;
  border-radius: 12px;
  background: radial-gradient(circle at 30% 20%, rgba(232, 198, 110, 0.12), transparent 62%),
    linear-gradient(150deg, #131c2b, #0b1119);
  border: 1px solid var(--line);
  overflow: hidden;
}

.leaf {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 78%;
  transform: translate(-50%, -50%) rotate(-4deg);
}

.bbox {
  position: absolute;
  left: 22%;
  top: 24%;
  width: 46%;
  height: 52%;
  border: 1.5px solid rgba(232, 198, 110, 0.85);
  border-radius: 6px;
  box-shadow: 0 0 0 1px rgba(232, 198, 110, 0.15), 0 0 26px rgba(232, 198, 110, 0.18) inset;
}

.bbox span {
  position: absolute;
  top: -22px;
  left: -1px;
  font-size: 10px;
  font-family: var(--agri-mono, monospace);
  letter-spacing: 0.04em;
  color: #1a1405;
  background: linear-gradient(135deg, #f6e2a8, #dfb65a);
  padding: 2px 7px;
  border-radius: 4px;
  white-space: nowrap;
}

.scanline {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(232, 198, 110, 0.85), transparent);
  animation: iv-scan 3.4s ease-in-out infinite;
}

.corner {
  position: absolute;
  width: 10px;
  height: 10px;
  border: 1.5px solid rgba(236, 230, 216, 0.35);
}

.corner.tl { left: 8px; top: 8px; border-right: none; border-bottom: none; }
.corner.tr { right: 8px; top: 8px; border-left: none; border-bottom: none; }
.corner.bl { left: 8px; bottom: 8px; border-right: none; border-top: none; }
.corner.br { right: 8px; bottom: 8px; border-left: none; border-top: none; }

.detect-rows {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.d-row {
  display: grid;
  grid-template-columns: 62px 1fr 44px;
  align-items: center;
  gap: 10px;
}

.d-name {
  font-size: 11.5px;
  color: #b9c2d1;
}

.d-bar {
  height: 5px;
  border-radius: 999px;
  background: rgba(236, 230, 216, 0.09);
  overflow: hidden;
}

.d-bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #b1852f, #f2d68f);
}

.d-pct {
  font-family: var(--agri-mono, monospace);
  font-size: 11px;
  color: #e8c66e;
  text-align: right;
}

/* —— 共享社区 —— */
.post {
  border-radius: 13px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.028);
  padding: 13px;
}

.p-head {
  display: flex;
  align-items: center;
  gap: 9px;
}

.ava {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f2d68f, #b1852f);
  box-shadow: 0 0 0 2px rgba(232, 198, 110, 0.16);
  flex: 0 0 auto;
}

.ava.sm {
  width: 22px;
  height: 22px;
  background: linear-gradient(135deg, #8ea3c4, #4a5f84);
}

.p-meta {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.p-meta b {
  font-size: 12px;
  color: #eee8db;
}

.p-meta em {
  font-style: normal;
  font-size: 10px;
  color: var(--dim);
  margin-top: 1px;
}

.p-tag {
  font-size: 10px;
  color: #e8c66e;
  border: 1px solid rgba(232, 198, 110, 0.32);
  padding: 2px 7px;
  border-radius: 999px;
}

.p-text {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.65;
  color: #c9d0dc;
}

.p-imgs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-top: 10px;
}

.p-imgs i {
  height: 54px;
  border-radius: 8px;
  border: 1px solid rgba(236, 230, 216, 0.08);
  background: linear-gradient(140deg, rgba(232, 198, 110, 0.22), rgba(92, 70, 28, 0.5));
}

.p-imgs i:nth-child(2) {
  background: linear-gradient(140deg, rgba(168, 130, 62, 0.6), rgba(34, 26, 12, 0.8));
}

.p-imgs i:nth-child(3) {
  background: linear-gradient(140deg, rgba(232, 198, 110, 0.1), rgba(36, 50, 74, 0.9));
}

.p-actions {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 11px;
  font-size: 11px;
  color: var(--dim);
}

.p-actions span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.p-actions svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
}

.p-share {
  margin-left: auto;
  color: #e8c66e;
}

.reply {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  margin-top: 11px;
  padding: 11px 12px;
  border-radius: 11px;
  background: rgba(232, 198, 110, 0.06);
  border: 1px solid rgba(232, 198, 110, 0.14);
}

.reply p {
  font-size: 11px;
  line-height: 1.6;
  color: #c6bfae;
}

.reply b {
  color: #e8c66e;
  font-weight: 600;
  margin-right: 4px;
}

/* —— 数字孪生 —— */
.twin {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  position: relative;
  height: 168px;
  border-radius: 13px;
  border: 1px solid var(--line);
  background: radial-gradient(circle at 50% 30%, rgba(110, 88, 40, 0.32), transparent 68%),
    linear-gradient(160deg, #0e1725, #090e17);
  overflow: hidden;
  perspective: 640px;
}

.field-plane {
  position: absolute;
  left: 50%;
  top: 52%;
  width: 190px;
  height: 142px;
  transform: translate(-50%, -50%) rotateX(56deg) rotateZ(-38deg);
  transform-style: preserve-3d;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 5px;
}

.plot {
  border-radius: 4px;
  border: 1px solid rgba(236, 230, 216, 0.12);
  animation: plot-glow 5s ease-in-out infinite;
}

.plot.p1 {
  background: linear-gradient(140deg, rgba(206, 174, 108, 0.85), rgba(112, 86, 36, 0.9));
}

.plot.p2 {
  background: linear-gradient(140deg, rgba(196, 170, 92, 0.8), rgba(110, 88, 36, 0.9));
}

.plot.p3 {
  background: linear-gradient(140deg, rgba(108, 146, 178, 0.65), rgba(38, 60, 84, 0.9));
}

.field-sweep {
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 38%, rgba(232, 198, 110, 0.16) 50%, transparent 62%);
  animation: field-sweep 5.5s ease-in-out infinite;
}

.twin-side {
  display: flex;
  gap: 12px;
  align-items: center;
}

.gauge {
  position: relative;
  width: 104px;
  flex: 0 0 auto;
  border-radius: 11px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.025);
  padding: 8px 10px 6px;
}

.gauge svg {
  width: 100%;
  display: block;
}

.gauge b {
  display: block;
  text-align: center;
  font-family: var(--agri-mono, monospace);
  font-size: 16px;
  color: #f0dca8;
  margin-top: -6px;
}

.gauge b span {
  font-size: 9px;
  color: var(--dim);
  margin-left: 1px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chips span {
  font-size: 10px;
  color: #b6c0cf;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.02);
}

/* —— 消息中心 —— */
.msg-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.m-row {
  display: flex;
  gap: 9px;
  padding: 10px 11px;
  border-radius: 11px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.022);
}

.m-row.unread {
  background: rgba(232, 198, 110, 0.07);
  border-color: rgba(232, 198, 110, 0.16);
}

.m-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-top: 5px;
  background: transparent;
  flex: 0 0 auto;
}

.m-row.unread .m-dot {
  background: #e8c66e;
  box-shadow: 0 0 8px rgba(232, 198, 110, 0.7);
}

.m-main {
  min-width: 0;
}

.m-top {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.m-top b {
  font-size: 11.5px;
  color: #e9e3d5;
  font-weight: 600;
}

.m-top em {
  font-style: normal;
  font-size: 9.5px;
  color: var(--dim);
  margin-left: auto;
}

.m-main p {
  font-size: 10.5px;
  line-height: 1.55;
  color: #a9b2c1;
  margin-top: 3px;
}

.msg-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}

.m-badge {
  font-size: 10px;
  color: #1a1405;
  background: linear-gradient(135deg, #f6e2a8, #dfb65a);
  border-radius: 999px;
  padding: 3px 9px;
  font-weight: 600;
}

.m-link {
  font-size: 10.5px;
  color: #e8c66e;
}

/* —— 管理后台 —— */
.admin {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px 10px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.025);
}

.kpi em {
  font-style: normal;
  font-size: 9.5px;
  color: var(--dim);
}

.kpi b {
  font-family: var(--agri-mono, monospace);
  font-size: 17px;
  color: #f2e6c6;
}

.kpi span {
  font-size: 9px;
  color: #f0dca8;
}

.bars {
  display: flex;
  align-items: flex-end;
  gap: 5px;
  height: 76px;
  padding: 8px 10px;
  border-radius: 11px;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent);
}

.bars span {
  flex: 1;
  border-radius: 3px 3px 1px 1px;
  background: linear-gradient(180deg, #e8c66e, rgba(176, 132, 44, 0.45));
  animation: bar-grow 3.6s ease-in-out infinite;
  transform-origin: bottom;
}

.admin-foot {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 11px;
  border-radius: 11px;
  border: 1px dashed rgba(232, 198, 110, 0.3);
  background: rgba(232, 198, 110, 0.05);
}

.lock {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: rgba(232, 198, 110, 0.14);
  flex: 0 0 auto;
}

.lock svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: #e8c66e;
  stroke-width: 1.6;
}

.admin-foot b {
  display: block;
  font-size: 11px;
  color: #f0dca8;
  font-weight: 600;
}

.admin-foot em {
  display: block;
  font-style: normal;
  font-size: 9.5px;
  color: var(--dim);
  margin-top: 2px;
}

/* —— 动效 —— */
@keyframes iv-pulse {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
}

@keyframes iv-scan {
  0%,
  100% {
    top: 12%;
    opacity: 0.2;
  }
  50% {
    top: 84%;
    opacity: 0.9;
  }
}

@keyframes plot-glow {
  0%,
  100% {
    filter: brightness(0.92);
  }
  50% {
    filter: brightness(1.12);
  }
}

@keyframes field-sweep {
  0%,
  100% {
    transform: translateX(-30%);
    opacity: 0.2;
  }
  50% {
    transform: translateX(30%);
    opacity: 0.8;
  }
}

@keyframes bar-grow {
  0%,
  100% {
    transform: scaleY(0.82);
  }
  50% {
    transform: scaleY(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .scanline,
  .plot,
  .bars span,
  .field-sweep,
  .chrome-live .pulse {
    animation: none;
  }
}
</style>

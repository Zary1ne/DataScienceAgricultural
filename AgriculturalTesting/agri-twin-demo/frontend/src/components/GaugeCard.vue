<script setup>
/**
 * GaugeCard — 纯 CSS conic-gradient 环形仪表盘
 * Props:
 *   value      当前值 (number)
 *   max        最大值 (number, 默认 100)
 *   unit       单位字符串 (默认 "")
 *   safeRange  [min, max] 安全区间 (默认 null = 永远安全)
 *   label      标签文字
 *   size       圆环大小 px (默认 88)
 */
import { computed } from "vue";
import TransitionNum from "./TransitionNum.vue";

const props = defineProps({
  value:     { type: Number, required: true },
  max:       { type: Number, default: 100 },
  unit:      { type: String,  default: "" },
  safeRange: { type: Array,   default: null },
  label:     { type: String,  default: "" },
  size:      { type: Number,  default: 88 },
  tone:      { type: String,  default: null },
  hint:      { type: String,  default: "" },
});

// 百分比（clamp 到 [0, 1]）
const pct = computed(() => Math.max(0, Math.min(1, props.value / props.max)));

// 角度（0 度在 12 点位置，顺时针）
const deg = computed(() => Math.round(pct.value * 360));

// 状态：safe / low / high
const status = computed(() => {
  if (!props.safeRange) return "safe";
  const [lo, hi] = props.safeRange;
  if (props.value < lo) return "low";
  if (props.value > hi) return "high";
  return "safe";
});

const effectiveTone = computed(() => {
  if (props.tone === "danger" || props.tone === "warning" || props.tone === "normal") {
    return props.tone;
  }
  if (status.value === "low") return "warning";
  if (status.value === "high") return "danger";
  return "normal";
});

// 颜色
const color = computed(() => {
  switch (effectiveTone.value) {
    case "warning": return "#fbbf24"; // amber — 偏离适宜区
    case "danger":  return "#f43f5e"; // rose  — 危险值
    default:        return "#34d399"; // green — 安全
  }
});

const trackColor = computed(() => "rgba(255, 255, 255, 0.07)");

// 圆环背景 — conic-gradient 一圈
const ringStyle = computed(() => ({
  background: `conic-gradient(${color.value} 0deg ${deg.value}deg, ${trackColor.value} ${deg.value}deg 360deg)`,
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: "50%",
  position: "relative",
  transition: "background 0.4s ease-out",
}));

const innerStyle = computed(() => ({
  position: "absolute",
  inset: "6px",
  borderRadius: "50%",
  background: "rgba(10, 16, 26, 0.85)",
  backdropFilter: "blur(6px)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
}));

const glowStyle = computed(() => {
  if (effectiveTone.value === "normal") {
    return { boxShadow: `0 0 14px rgba(52, 211, 153, 0.35)` };
  } else if (effectiveTone.value === "warning") {
    return { boxShadow: `0 0 14px rgba(251, 191, 36, 0.35)` };
  }
  return { boxShadow: `0 0 14px rgba(244, 63, 94, 0.30)` };
});

const valStyle = computed(() => ({
  fontSize: `${Math.round(props.size * 0.22)}px`,
  fontWeight: 700,
  color: color.value,
  fontFamily: "JetBrains Mono, Consolas, monospace",
  lineHeight: 1,
}));

const unitStyle = computed(() => ({
  fontSize: `${Math.round(props.size * 0.11)}px`,
  color: "#8ca5ae",
  marginTop: "2px",
}));

const statusText = computed(() => {
  if (effectiveTone.value === "warning") return "偏离";
  if (effectiveTone.value === "danger") return "危险";
  return "正常";
});
</script>

<template>
  <div class="gauge-card" :style="glowStyle">
    <div class="gauge-ring" :style="ringStyle">
      <div class="gauge-inner" :style="innerStyle">
        <div class="gauge-value" :style="valStyle">
          <slot name="value">
            <TransitionNum :value="value" :decimals="value % 1 === 0 ? 0 : 1" />
          </slot>
        </div>
        <div v-if="unit" class="gauge-unit" :style="unitStyle">{{ unit }}</div>
      </div>
    </div>
    <div class="gauge-label">
      <span>{{ label }}</span>
      <span v-if="safeRange" class="gauge-range">安全 {{ safeRange[0] }}-{{ safeRange[1] }}{{ unit }}</span>
      <span class="gauge-status" :class="effectiveTone">{{ statusText }}</span>
      <span v-if="hint" class="gauge-hint">{{ hint }}</span>
    </div>
  </div>
</template>

<style scoped>
.gauge-card {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 8px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: box-shadow 0.3s ease;
}
.gauge-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  font-weight: 600;
  color: #a0b4bd;
  letter-spacing: 0.04em;
}
.gauge-range {
  font-size: 9.5px;
  font-weight: 400;
  color: #5c7a85;
}
.gauge-status {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 8px;
  border-radius: 8px;
  background: rgba(52, 211, 153, 0.12);
  color: var(--status, #34d399);
  margin-top: 2px;
}
.gauge-status.normal  { background: rgba(52, 211, 153, 0.12); color: #34d399; }
.gauge-status.warning { background: rgba(251, 191, 36, 0.12); color: #fbbf24; }
.gauge-status.danger  { background: rgba(244, 63, 94, 0.12); color: #f43f5e; }
.gauge-hint {
  max-width: 118px;
  color: #708b96;
  font-size: 9px;
  font-weight: 400;
  line-height: 1.35;
  text-align: center;
}
</style>

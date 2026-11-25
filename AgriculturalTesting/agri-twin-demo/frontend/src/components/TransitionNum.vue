<script setup>
/**
 * TransitionNum — 数字平滑补间 (400ms easeOutCubic)
 * Props:
 *   value    目标值 (number)
 *   duration 动画时长 ms (默认 400)
 *   decimals 小数位数 (默认 1，value % 1 === 0 时自动 0)
 */
import { ref, watch, onBeforeUnmount } from "vue";

const props = defineProps({
  value:    { type: Number, required: true },
  duration: { type: Number, default: 400 },
  decimals: { type: Number, default: -1 }, // -1 = auto
});

const displayValue = ref(props.value);

let rafId = null;

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function animate(from, to) {
  if (rafId !== null) cancelAnimationFrame(rafId);
  if (from === to) { displayValue.value = to; return; }
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / props.duration);
    const v = from + (to - from) * easeOutCubic(t);
    displayValue.value = v;
    if (t < 1) rafId = requestAnimationFrame(step);
    else { displayValue.value = to; rafId = null; }
  }
  rafId = requestAnimationFrame(step);
}

watch(() => props.value, (next, prev) => {
  if (prev === undefined) { displayValue.value = next; return; }
  animate(prev, next);
}, { immediate: true });

onBeforeUnmount(() => {
  if (rafId !== null) cancelAnimationFrame(rafId);
});

// 计算显示小数位
function format(n) {
  if (props.decimals >= 0) return n.toFixed(props.decimals);
  // auto: 整数不显示小数，否则 1 位
  return Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1);
}
</script>

<template>
  <span class="transition-num" :class="$attrs.class">{{ format(displayValue) }}</span>
</template>

<style scoped>
.transition-num {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
</style>

<template>
  <canvas ref="canvasRef" class="rice-field" aria-hidden="true"></canvas>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

// 金色稻田：由 XIANG FARMER 的字母方块铺成一片有透视的稻海。
// 每一块稻田方块按错峰节奏轻轻跳动，近处的方块能读出字母，远处融成金色纹理。
const LETTERS = "XIANG FARMER".replace(/\s/g, "").split("");

const canvasRef = ref(null);
let ctx = null;
let rafId = 0;
let observer = null;
let tiles = [];
let ears = [];
let size = { w: 0, h: 0, dpr: 1 };
let reduceMotion = false;

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function goldColor(t, light = 0) {
  // 从暗铜一路过渡到亮金，light 用于穗尖提亮
  const r = Math.round(lerp(74, 246, t) + light);
  const g = Math.round(lerp(56, 226, t) + light * 0.92);
  const b = Math.round(lerp(22, 168, t) + light * 0.7);
  return `rgb(${Math.min(r, 255)}, ${Math.min(g, 255)}, ${Math.min(b, 255)})`;
}

// 预计算所有稻田方块：按透视分行，近大远小、近亮远暗
function buildField() {
  const { w, h } = size;
  tiles = [];
  const horizon = h * 0.55;
  const rows = 23;
  const span = h - horizon;

  for (let r = 0; r < rows; r += 1) {
    const t = r / (rows - 1);
    const y = horizon + Math.pow(t, 1.55) * span * 1.02;
    const cell = 3.2 + Math.pow(t, 1.65) * 14;
    const step = cell * 1.24;
    const count = Math.min(250, Math.ceil(w / step) + 2);
    for (let c = 0; c < count; c += 1) {
      const seed = r * 131 + c * 7;
      const isNear = t > 0.72;
      const withLetter = isNear && hash(seed * 3.1) > 0.62;
      const shade = t * 0.86;
      tiles.push({
        x: c * step - step * 0.5 + (r % 2 ? step * 0.62 : 0) + (hash(seed) - 0.5) * step * 0.34,
        y: y - hash(seed * 1.7) * cell * 1.6,
        size: cell,
        t,
        phase: hash(seed * 5.3) * Math.PI * 2,
        amp: 0.5 + t * 3.4,
        color: goldColor(shade),
        tip: goldColor(Math.min(shade + 0.1, 0.96), 12),
        letter: withLetter ? LETTERS[Math.floor(hash(seed * 9.7) * LETTERS.length)] : null,
        // 少量“稻穗尖”：在方块上方再叠两三块，形成矮稻穗
        sprout: isNear && hash(seed * 11.3) > 0.86 ? 2 + Math.round(hash(seed) * 2) : 0,
      });
    }
  }

  // 散落在近处的稻穗：让稻海不只是方块，还能看出水稻
  ears = [];
  const earCount = Math.max(16, Math.round(w / 42));
  for (let i = 0; i < earCount; i += 1) {
    const t = 0.56 + hash(i * 3.7) * 0.44;
    const cell = 4.5 + Math.pow(t, 1.3) * 12;
    ears.push({
      x: hash(i * 7.3) * w,
      y: horizon + Math.pow(t, 1.55) * span * 1.02 + hash(i * 11.1) * 10,
      cell,
      t,
      color: goldColor(t * 0.9),
      tip: goldColor(Math.min(t * 0.9 + 0.08, 0.96), 10),
      phase: hash(i * 5.9) * Math.PI * 2,
      amp: 1.2 + t * 3,
    });
  }
}

function draw(time) {
  if (!ctx) return;
  const { w, h } = size;
  ctx.clearRect(0, 0, w, h);

  const horizon = h * 0.55;
  // 地平线金色气团
  const glow = ctx.createRadialGradient(w / 2, horizon, 0, w / 2, horizon, w * 0.55);
  glow.addColorStop(0, "rgba(232, 198, 110, 0.22)");
  glow.addColorStop(0.55, "rgba(195, 154, 69, 0.07)");
  glow.addColorStop(1, "rgba(195, 154, 69, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, horizon - h * 0.3, w, h * 0.75);

  const seconds = time / 1000;

  // 先画远景再画近景，保证近处覆盖在上层
  for (let i = 0; i < tiles.length; i += 1) {
    const p = tiles[i];
    const wave = reduceMotion
      ? 0
      : Math.sin(seconds * 1.35 + p.phase + p.x * 0.006) * p.amp;
    const s = p.size;
    const y = p.y + wave;
    const tw = s * 0.82;
    const th = s * 1.08;
    ctx.globalAlpha = 0.26 + p.t * 0.7;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - tw / 2, y - th / 2, tw, th);

    if (p.sprout) {
      ctx.fillStyle = p.tip;
      for (let k = 1; k <= p.sprout; k += 1) {
        const sw = tw * (0.9 - k * 0.12);
        ctx.fillRect(p.x - sw / 2, y - th / 2 - k * s * 0.92, sw, sw * 1.15);
      }
    }

    if (p.letter) {
      ctx.globalAlpha = 0.34 + p.t * 0.18;
      ctx.fillStyle = "#2a1d06";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${Math.max(6, s * 0.56)}px "Cascadia Mono", Consolas, monospace`;
      ctx.fillText(p.letter, p.x, y);
    }
  }
  ctx.globalAlpha = 1;

  // 地平线薄雾，让稻田从夜色里长出来
  const haze = ctx.createLinearGradient(0, horizon - h * 0.1, 0, horizon + h * 0.13);
  haze.addColorStop(0, "rgba(7, 11, 18, 0.96)");
  haze.addColorStop(0.5, "rgba(7, 11, 18, 0.55)");
  haze.addColorStop(1, "rgba(7, 11, 18, 0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - h * 0.1, w, h * 0.24);

  // 底部压暗，收住画面
  const shade = ctx.createLinearGradient(0, h * 0.9, 0, h);
  shade.addColorStop(0, "rgba(7, 11, 18, 0)");
  shade.addColorStop(1, "rgba(7, 11, 18, 0.6)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, h * 0.9, w, h * 0.1);

  // 近处零散的稻穗，轻轻摆动
  ears.forEach((e) => {
    const bob = reduceMotion
      ? 0
      : Math.sin(seconds * 1.25 + e.phase + e.x * 0.01) * e.amp;
    const s = e.cell;
    const y = e.y + bob;
    ctx.globalAlpha = 0.55 + e.t * 0.4;
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x - s / 2, y - s, s, s);
    ctx.fillRect(e.x - s / 2, y - s * 2, s, s);
    const widths = [1, 1, 2, 2, 1];
    widths.forEach((width, wi) => {
      ctx.globalAlpha = 0.6 + e.t * 0.4;
      ctx.fillStyle = wi < 2 ? e.tip : e.color;
      const start = -Math.floor((width - 1) / 2);
      for (let j = 0; j < width; j += 1) {
        ctx.fillRect(
          e.x + (start + j) * s * 1.02 - s / 2,
          y - s * (3 + wi),
          s,
          s
        );
      }
    });
  });
  ctx.globalAlpha = 1;
}

function frame(time) {
  draw(time);
  if (!reduceMotion) rafId = requestAnimationFrame(frame);
}

function resize() {
  const el = canvasRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  size = { w: rect.width, h: rect.height, dpr };
  el.width = Math.round(rect.width * dpr);
  el.height = Math.round(rect.height * dpr);
  ctx = el.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildField();
  draw(performance.now());
}

onMounted(() => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  reduceMotion = media.matches;
  resize();
  observer = new ResizeObserver(resize);
  if (canvasRef.value) observer.observe(canvasRef.value);
  if (!reduceMotion) rafId = requestAnimationFrame(frame);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId);
  if (observer) observer.disconnect();
});
</script>

<style scoped>
.rice-field {
  display: block;
  width: 100%;
  height: 100%;
}
</style>

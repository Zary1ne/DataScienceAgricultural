<template>
  <svg
    class="brand-emblem"
    :style="{ width: size + 'px', height: size + 'px' }"
    viewBox="0 0 320 320"
    role="img"
    aria-label="湘小农金色水稻徽章"
  >
    <defs>
      <linearGradient id="emGold" x1="0" y1="0" x2="0.9" y2="1">
        <stop offset="0" stop-color="#fbeecb" />
        <stop offset="0.34" stop-color="#e9c97f" />
        <stop offset="0.64" stop-color="#bd8f36" />
        <stop offset="0.9" stop-color="#f4dc9c" />
      </linearGradient>
      <linearGradient id="emGoldDeep" x1="0" y1="0" x2="0.8" y2="1">
        <stop offset="0" stop-color="#d3ab5b" />
        <stop offset="0.5" stop-color="#a8792a" />
        <stop offset="1" stop-color="#e6c684" />
      </linearGradient>
      <radialGradient id="emHalo" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#e8c66e" stop-opacity="0.28" />
        <stop offset="1" stop-color="#e8c66e" stop-opacity="0" />
      </radialGradient>
    </defs>

    <circle cx="160" cy="160" r="156" fill="url(#emHalo)" />
    <circle cx="160" cy="160" r="148" fill="none" stroke="rgba(232, 198, 110, 0.5)" stroke-width="1.6" />
    <circle cx="160" cy="160" r="139" fill="none" stroke="rgba(236, 230, 216, 0.16)" stroke-width="1" />

    <!-- 外圈刻度 -->
    <g opacity="0.42">
      <line
        v-for="t in ticks"
        :key="'t' + t.i"
        :x1="t.x1"
        :y1="t.y1"
        :x2="t.x2"
        :y2="t.y2"
        stroke="#d9b96f"
        stroke-width="1"
      />
    </g>

    <!-- 左右半圆稻穗 -->
    <g>
      <g v-for="(c, i) in arcs" :key="'a' + i" :transform="`translate(${c.x} ${c.y}) rotate(${c.a})`">
        <g class="em-cell" :style="{ animationDelay: (i * 0.045).toFixed(2) + 's' }">
          <rect
            :x="-c.s / 2"
            :y="-c.s / 2"
            :width="c.s"
            :height="c.s"
            :rx="c.s * 0.28"
            :fill="c.inner ? 'url(#emGoldDeep)' : 'url(#emGold)'"
            :opacity="c.o"
          />
          <text
            v-if="c.letter"
            class="em-letter"
            :y="c.s * 0.3"
            text-anchor="middle"
            :font-size="c.s * 0.9"
          >
            {{ c.letter }}
          </text>
        </g>
      </g>
    </g>

    <!-- 中心稻株 -->
    <g>
      <g v-for="(c, i) in core" :key="'c' + i" :transform="`translate(${c.x} ${c.y}) rotate(${c.a})`">
        <g class="em-cell" :style="{ animationDelay: (i * 0.06).toFixed(2) + 's' }">
          <rect
            v-if="!c.rect"
            :x="-c.s / 2"
            :y="-c.s / 2"
            :width="c.s"
            :height="c.s"
            :rx="c.s * 0.26"
            fill="url(#emGold)"
            :opacity="c.o"
          />
          <rect
            v-else
            :x="-c.w / 2"
            :y="-c.h / 2"
            :width="c.w"
            :height="c.h"
            :rx="c.h * 0.4"
            fill="url(#emGoldDeep)"
            :opacity="c.o"
          />
          <text
            v-if="c.letter"
            class="em-letter"
            :y="c.s * 0.31"
            text-anchor="middle"
            :font-size="c.s * 0.88"
          >
            {{ c.letter }}
          </text>
        </g>
      </g>
    </g>
  </svg>
</template>

<script setup>
defineProps({
  size: { type: Number, default: 220 },
});

const LETTERS = "XIANG FARMER".replace(/\s/g, "").split("");

// 外圈刻度
const ticks = [];
for (let i = 0; i < 60; i += 1) {
  if (i % 5 === 0) continue;
  const a = (i / 60) * Math.PI * 2;
  ticks.push({
    i,
    x1: 160 + Math.cos(a) * 141,
    y1: 160 + Math.sin(a) * 141,
    x2: 160 + Math.cos(a) * 146,
    y2: 160 + Math.sin(a) * 146,
  });
}

// 左右两侧的半圆稻穗（国徽式包裹）
const arcs = [];
let letterCursor = 0;
const rows = [
  { r: 129, s: 7.2, inner: false },
  { r: 117, s: 6.6, inner: true },
  { r: 105, s: 6, inner: true },
];
rows.forEach((row, ri) => {
  const start = ri === 0 ? 104 : 112;
  const end = ri === 0 ? 256 : 248;
  for (let a = start; a <= end; a += 5.4) {
    const rad = (a * Math.PI) / 180;
    const skip = (Math.round(a) + ri * 7) % 23 === 0;
    if (skip) continue;
    const x = 160 + Math.cos(rad) * row.r;
    const y = 160 + Math.sin(rad) * row.r;
    const showLetter = ri === 0 && Math.round(a) % 3 === 0;
    arcs.push({
      x,
      y,
      s: row.s,
      a: a + 90,
      o: 0.86,
      inner: row.inner,
      letter: showLetter ? LETTERS[letterCursor++ % LETTERS.length] : "",
    });
    // 右侧镜像
    const mx = 160 - Math.cos(rad) * row.r;
    const my = 160 + Math.sin(rad) * row.r;
    arcs.push({
      x: mx,
      y: my,
      s: row.s,
      a: -a - 90,
      o: 0.86,
      inner: row.inner,
      letter: showLetter ? LETTERS[letterCursor++ % LETTERS.length] : "",
    });
  }
});

// 中心稻株
const core = [];
function pushStem(p0, c, p1, count, s0, s1) {
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    const mt = 1 - t;
    const x = mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x;
    const y = mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y;
    const dx = 2 * mt * (c.x - p0.x) + 2 * t * (p1.x - c.x);
    const dy = 2 * mt * (c.y - p0.y) + 2 * t * (p1.y - c.y);
    core.push({
      x,
      y,
      s: s0 + (s1 - s0) * t,
      a: (Math.atan2(dy, dx) * 180) / Math.PI,
      o: 0.95,
      letter: "",
    });
  }
}

pushStem({ x: 160, y: 244 }, { x: 154, y: 196 }, { x: 160, y: 148 }, 12, 6.6, 5.4);

// 麦穗
for (let i = 0; i <= 8; i += 1) {
  const t = i / 8;
  const mt = 1 - t;
  const sx = mt * mt * 160 + 2 * mt * t * 166 + t * t * 178;
  const sy = mt * mt * 148 + 2 * mt * t * 116 + t * t * 88;
  const perp = Math.PI / 2 - t * 0.5;
  [-1, 0, 1].forEach((r) => {
    core.push({
      x: sx + Math.cos(perp) * r * 7,
      y: sy + Math.sin(perp) * r * 6,
      s: r === 0 ? 8.4 - t * 2 : 6.6 - t * 1.8,
      a: -32,
      o: 0.95,
      letter: "",
    });
  });
}
core.push({ x: 181, y: 84, s: 5, a: -40, o: 0.95, letter: "" });

// 两片叶
function pushLeaf(p0, c, p1) {
  for (let i = 0; i <= 10; i += 1) {
    const t = i / 10;
    const mt = 1 - t;
    const x = mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x;
    const y = mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y;
    const dx = 2 * mt * (c.x - p0.x) + 2 * t * (p1.x - c.x);
    const dy = 2 * mt * (c.y - p0.y) + 2 * t * (p1.y - c.y);
    core.push({
      x,
      y,
      rect: true,
      w: 7.4 * (1 - t * 0.6) + 2,
      h: 3.6 * (1 - t * 0.5) + 1.2,
      s: 4,
      a: (Math.atan2(dy, dx) * 180) / Math.PI,
      o: 0.9,
      letter: "",
    });
  }
}

pushLeaf({ x: 158, y: 214 }, { x: 130, y: 196 }, { x: 112, y: 172 });
pushLeaf({ x: 162, y: 198 }, { x: 190, y: 182 }, { x: 208, y: 158 });
</script>

<style scoped>
.brand-emblem {
  display: block;
  overflow: visible;
}

.em-cell {
  transform-box: fill-box;
  transform-origin: center;
  animation: em-breathe 6s ease-in-out infinite;
}

.em-letter {
  font-family: "SFMono-Regular", "Cascadia Mono", "JetBrains Mono", Consolas, monospace;
  font-weight: 700;
  fill: #2c1f06;
  opacity: 0.7;
}

@keyframes em-breathe {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.88;
  }
  50% {
    transform: translateY(-1.4px);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .em-cell {
    animation: none;
  }
}
</style>

<template>
  <span class="agri-avatar" :style="wrapStyle">
    <img
      v-if="url && !broken"
      :src="url"
      alt=""
      class="avatar-img"
      @error="broken = true"
    />
    <svg
      v-else
      class="avatar-svg"
      viewBox="-1.75 -1.75 10.5 10.5"
      preserveAspectRatio="xMidYMid meet"
      shape-rendering="crispEdges"
    >
      <rect
        v-for="cell in cells"
        :key="cell.key"
        :x="cell.x"
        :y="cell.y"
        width="1"
        height="1"
        :fill="cell.fill"
      />
    </svg>
  </span>
</template>

<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
  name: { type: String, default: "" },
  seed: { type: String, default: "" },
  url: { type: String, default: "" },
  size: { type: [Number, String], default: 40 },
  rounded: { type: Boolean, default: true },
});

const broken = ref(false);

watch(
  () => props.url,
  () => {
    broken.value = false;
  }
);

const wrapStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: props.rounded ? "50%" : "22%",
}));

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// GitHub 风格：5×5 左右镜像像素块，由用户标识确定性生成
const palette = computed(() => {
  const key = props.seed || props.name || "agri";
  const hash = hashString(key);
  const hue = hash % 360;
  return {
    bg: "#f0f0f0",
    fg: `hsl(${hue}, 58%, 48%)`,
  };
});

const bgColor = computed(() => palette.value.bg);

const cells = computed(() => {
  const key = props.seed || props.name || "agri";
  const hash = hashString(key);
  const random = mulberry32(hash);
  const grid = [];
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 4; x++) {
      if (random() > 0.35) {
        grid.push({ x, y });
        if (x < 3) grid.push({ x: 6 - x, y });
      }
    }
  }
  if (!grid.length) grid.push({ x: 3, y: 3 });
  return grid.map((cell, index) => ({
    ...cell,
    key: `${cell.x}-${cell.y}-${index}`,
    fill: palette.value.fg,
  }));
});
</script>

<style scoped>
.agri-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex: 0 0 auto;
  background: v-bind(bgColor);
  user-select: none;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-svg {
  width: 100%;
  height: 100%;
  display: block;
}
</style>

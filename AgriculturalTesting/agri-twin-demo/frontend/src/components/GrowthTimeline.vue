<script setup>
// P3: 底部水稻生长时间轴 —— 播放/暂停、倍速、拖拽回溯
// 性能：天数推进与 DAY 数字跳动都在本组件内部完成，避免每 0.1 秒触发整页重渲染
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps({
  day: { type: Number, default: 1 },
  totalDays: { type: Number, default: 140 },
  stageLabel: { type: String, default: "发芽期" },
  playing: { type: Boolean, default: false },
  speed: { type: Number, default: 1 },
  // 1x 下每秒推进的模拟天数（140 天 / 70 秒 = 2）
  daysPerSecond: { type: Number, default: 2 },
  embedded: { type: Boolean, default: false },
});

const emit = defineEmits(["toggle-play", "update:speed", "seek", "tick", "end"]);

const speedOptions = [1, 2, 5, 10];
const marks = [
  { day: 1, label: "播种" },
  { day: 31, label: "分蘖" },
  { day: 81, label: "抽穗" },
  { day: 101, label: "灌浆" },
  { day: 140, label: "成熟" },
];

// 组件内部显示用天数（10Hz 更新，只重渲染这条时间轴）
const displayDay = ref(props.day);
let rafId = 0;
let lastTs = 0;
let accumSec = 0;
let endEmitted = false;

watch(
  () => props.day,
  (value) => {
    displayDay.value = value;
  }
);

watch(
  () => props.playing,
  (playing) => {
    lastTs = 0;
    accumSec = 0;
    if (playing) endEmitted = false;
  }
);

function step(timestamp) {
  if (lastTs) {
    const dtSec = Math.min(0.1, Math.max(0, (timestamp - lastTs) / 1000));
    if (props.playing && dtSec > 0) {
      accumSec += dtSec;
      if (accumSec >= 0.1) {
        const dtDays = accumSec * props.speed * props.daysPerSecond;
        accumSec = 0;
        const nextDay = Math.min(props.totalDays, displayDay.value + dtDays);
        const appliedDays = nextDay - displayDay.value;
        displayDay.value = nextDay;
        if (appliedDays > 0) emit("tick", appliedDays);
        if (nextDay >= props.totalDays && !endEmitted) {
          endEmitted = true;
          emit("end");
        }
      }
    } else {
      accumSec = 0;
    }
  }
  lastTs = timestamp;
  rafId = requestAnimationFrame(step);
}

onMounted(() => {
  rafId = requestAnimationFrame(step);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId);
});

const percent = computed(() => {
  const span = Math.max(1, props.totalDays - 1);
  return Math.min(100, Math.max(0, ((displayDay.value - 1) / span) * 100));
});

function markLeft(markDay) {
  const span = Math.max(1, props.totalDays - 1);
  return `${((markDay - 1) / span) * 100}%`;
}

function onSeek(event) {
  const value = Number(event.target.value);
  displayDay.value = value;
  emit("seek", value);
}
</script>

<template>
  <section class="growth-timeline" :class="{ embedded }" aria-label="水稻生长时间轴">
    <div class="gt-head">
      <div class="gt-day">
        <span class="gt-day-label">DAY</span>
        <span class="gt-day-num num">{{ Math.round(displayDay) }}</span>
        <span class="gt-day-total num">/ {{ totalDays }}</span>
      </div>
      <span class="gt-stage">{{ stageLabel }}</span>
      <div class="gt-controls">
        <button
          class="gt-play"
          type="button"
          :aria-label="playing ? '暂停推演' : '播放推演'"
          :title="playing ? '暂停' : '播放'"
          @click="emit('toggle-play')"
        >
          <svg v-if="!playing" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5l10 6.5-10 6.5z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="7" y="5" width="3.6" height="14" rx="1" />
            <rect x="13.4" y="5" width="3.6" height="14" rx="1" />
          </svg>
        </button>
        <div class="gt-speeds">
          <button
            v-for="option in speedOptions"
            :key="option"
            class="gt-speed"
            :class="{ active: speed === option }"
            type="button"
            @click="emit('update:speed', option)"
          >{{ option }}x</button>
        </div>
      </div>
    </div>

    <div class="gt-track-area">
      <div class="gt-track">
        <div class="gt-fill" :style="{ width: percent + '%' }"></div>
        <div class="gt-knob" :style="{ left: percent + '%' }"></div>
        <input
          class="gt-range"
          type="range"
          min="1"
          :max="totalDays"
          step="0.1"
          :value="displayDay"
          aria-label="推演天数"
          @input="onSeek"
        />
      </div>
      <div class="gt-marks">
        <span
          v-for="mark in marks"
          :key="mark.day"
          class="gt-mark"
          :class="{ 'is-end': mark.day === totalDays }"
          :style="{ left: markLeft(mark.day) }"
        >{{ mark.label }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.growth-timeline {
  position: absolute;
  bottom: 104px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 49;
  width: min(760px, calc(100vw - 60px));
  padding: 12px 18px 26px;
  border-radius: 18px;
  background: rgba(9, 16, 26, 0.72);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(64, 208, 214, 0.28);
  box-shadow:
    0 10px 40px rgba(0, 0, 0, 0.55),
    0 0 22px rgba(45, 212, 191, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.growth-timeline.embedded {
  position: relative;
  bottom: auto;
  left: auto;
  width: min(1120px, calc(100vw - 28px));
  margin: 8px auto 0;
  transform: none;
  padding: 10px 18px 16px;
  border-radius: 12px;
}

.gt-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 10px;
}

.gt-day {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: #9ff3e4;
}

.gt-day-label {
  font-size: 10px;
  letter-spacing: 0.18em;
  color: #5f8b96;
}

.gt-day-num {
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  color: #e6fffb;
  text-shadow: 0 0 14px rgba(94, 234, 212, 0.45);
}

.gt-day-total {
  font-size: 11px;
  color: #6b8a94;
}

.gt-stage {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #a7f3d0;
  background: rgba(16, 185, 129, 0.14);
  border: 1px solid rgba(52, 211, 153, 0.32);
}

.gt-controls {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}

.gt-play {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid rgba(94, 234, 212, 0.4);
  background: rgba(20, 184, 166, 0.16);
  color: #a7f3d0;
  cursor: pointer;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.gt-play:hover {
  background: rgba(20, 184, 166, 0.3);
  box-shadow: 0 0 14px rgba(45, 212, 191, 0.45);
}

.gt-play svg {
  width: 16px;
  height: 16px;
}

.gt-speeds {
  display: flex;
  gap: 4px;
}

.gt-speed {
  padding: 4px 9px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.04);
  color: #7fa3ad;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.gt-speed:hover {
  color: #c7f5ee;
}

.gt-speed.active {
  color: #062621;
  background: #5eead4;
  border-color: #5eead4;
  box-shadow: 0 0 12px rgba(94, 234, 212, 0.5);
}

.gt-track-area {
  position: relative;
}

.gt-track {
  position: relative;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  overflow: visible;
}

.gt-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  background: linear-gradient(90deg, #2dd4bf, #86efac 60%, #facc15);
  box-shadow: 0 0 12px rgba(45, 212, 191, 0.55);
}

.gt-knob {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: #eafffb;
  border: 2px solid #2dd4bf;
  box-shadow: 0 0 14px rgba(94, 234, 212, 0.8);
  pointer-events: none;
}

.gt-range {
  position: absolute;
  inset: -8px 0;
  width: 100%;
  height: 22px;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.gt-marks {
  position: relative;
  height: 16px;
  margin-top: 6px;
}

.gt-mark {
  position: absolute;
  transform: translateX(-50%);
  font-size: 10px;
  color: #6b8a94;
  white-space: nowrap;
}

.gt-mark.is-end {
  transform: translateX(-100%);
}
</style>

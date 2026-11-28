<template>
  <section class='region-entry' role='dialog' aria-label='湖南省种植区域选择'>
    <header class='entry-head'>
      <div class='entry-brand'>
        <span class='entry-brand-mark'>A</span>
        <div>
          <strong>AgriTwin · 湖南省种植区域</strong>
          <span>HUNAN AGRICULTURAL REGIONS</span>
        </div>
      </div>
      <button type='button' class='entry-exit' @click='exitMap'>返回平台</button>
    </header>

    <div class='entry-content'>
      <section class='map-panel'>
        <div class='map-heading'>
          <span class='map-eyebrow'>PROVINCE SELECT</span>
          <h1>选择种植产区</h1>
          <p>点击地图中的区域查看产区资料，再进入数字孪生场景。</p>
        </div>

        <div class='map-frame'>
          <div class='map-fog'></div>
          <svg class='hunan-map' :viewBox='HUNAN_MAP_VIEWBOX' role='img' aria-label='湖南省五个种植区域地图'>
            <defs>
              <clipPath id='hunan-outline-clip'><path :d='HUNAN_PROVINCE_PATH' /></clipPath>
              <filter id='region-glow' x='-30%' y='-30%' width='160%' height='160%'>
                <feGaussianBlur stdDeviation='8' result='blur' />
                <feMerge><feMergeNode in='blur' /><feMergeNode in='SourceGraphic' /></feMerge>
              </filter>
            </defs>

            <path class='province-shadow' :d='HUNAN_PROVINCE_PATH' />
            <g clip-path='url(#hunan-outline-clip)'>
              <g
                v-for='region in regions'
                :key='region.key'
                class='map-region'
                :class='[`region-${region.key}`, { selected: selectedKey === region.key }]'
                role='button'
                tabindex='0'
                :aria-label='region.name'
                @click='selectRegion(region)'
                @keydown.enter.prevent='selectRegion(region)'
              >
                <template v-for='cityName in HUNAN_REGION_CITY_NAMES[region.key]' :key='cityName'>
                  <path
                    v-for='(cityPath, pathIndex) in HUNAN_CITY_PATHS[cityName]'
                    :key='`${cityName}-${pathIndex}`'
                    class='region-shape'
                    :d='cityPath'
                  />
                </template>
                <text class='region-label' :x='HUNAN_REGION_LABELS[region.key].x' :y='HUNAN_REGION_LABELS[region.key].y'>{{ region.short }}</text>
              </g>
            </g>
            <path class='province-outline' :d='HUNAN_PROVINCE_PATH' />
          </svg>
          <div class='map-caption'>
            <span><i></i> 已选产区</span>
            <span>湖南省 · 五大种植区域示意</span>
          </div>
        </div>
      </section>

      <aside class='entry-info'>
        <template v-if='selectedRegion'>
          <div class='entry-info-kicker'><span class='entry-info-dot'></span><span>SELECTED REGION</span></div>
          <h2>{{ selectedRegion.name }}</h2>
          <p class='entry-description'>{{ selectedRegion.description }}</p>
          <dl class='entry-facts'>
            <div><dt>地形</dt><dd>{{ selectedRegion.terrain }}</dd></div>
            <div><dt>气候</dt><dd>{{ selectedRegion.climate }}</dd></div>
            <div><dt>土壤</dt><dd>{{ selectedRegion.soil }}</dd></div>
            <div><dt>主要风险</dt><dd>{{ selectedRegion.risk }}</dd></div>
          </dl>
          <div class='entry-location'>
            <span>参考坐标</span>
            <strong class='num'>{{ selectedRegion.coordinates.latitude.toFixed(2) }}°N · {{ selectedRegion.coordinates.longitude.toFixed(2) }}°E</strong>
          </div>
          <button type='button' class='entry-enter' @click='enterRegion(selectedRegion)'>
            进入 {{ selectedRegion.short }} 产区 <span aria-hidden='true'>→</span>
          </button>
        </template>
        <div v-else class='entry-info-empty'>
          <span class='entry-info-dot'></span>
          <h2>选择一个产区</h2>
          <p>点击湖南省地图中的区域，查看该地区的种植条件与主要风险。</p>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import {
  HUNAN_MAP_VIEWBOX,
  HUNAN_PROVINCE_PATH,
  HUNAN_CITY_PATHS,
  HUNAN_REGION_CITY_NAMES,
  HUNAN_REGION_LABELS,
} from '../scene/hunanMapData.js';

const props = defineProps({
  regions: { type: Array, required: true },
  selectedKey: { type: String, default: null },
});

const emit = defineEmits(['select', 'enter', 'exit']);

const selectedRegion = computed(() => props.regions.find((region) => region.key === props.selectedKey) || null);
function selectRegion(region) { emit('select', region); }
function enterRegion(region) { emit('enter', region); }
function exitMap() { emit('exit'); }
</script>

<style scoped>
.region-entry {
  position: fixed;
  inset: 0;
  z-index: 160;
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 100vh;
  overflow: hidden;
  color: #dce6e7;
  background:
    radial-gradient(circle at 48% 34%, rgba(119, 135, 137, 0.2), transparent 38%),
    linear-gradient(145deg, #1c2224 0%, #2a3031 48%, #171d20 100%);
}

.region-entry::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(115deg, rgba(255, 255, 255, 0.045), transparent 30%),
    repeating-linear-gradient(0deg, transparent 0 3px, rgba(255, 255, 255, 0.014) 3px 4px);
  opacity: 0.8;
}

.entry-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  padding: 12px 28px;
  border-bottom: 1px solid rgba(220, 235, 236, 0.1);
}

.entry-brand {
  display: flex;
  align-items: center;
  gap: 11px;
}

.entry-brand-mark {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid rgba(184, 214, 214, 0.35);
  border-radius: 8px;
  color: #c4e3df;
  font: 600 15px/1 ui-monospace, monospace;
}

.entry-brand strong,
.entry-brand span {
  display: block;
}

.entry-brand strong {
  color: #eef7f7;
  font-size: 12px;
}

.entry-brand span {
  margin-top: 3px;
  color: #7e9294;
  font-size: 8px;
  letter-spacing: 0.16em;
}

.entry-exit {
  padding: 7px 13px;
  border: 1px solid rgba(217, 234, 234, 0.18);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.035);
  color: #aebfc1;
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.entry-content {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(310px, 0.7fr);
  flex: 1;
  align-items: center;
  gap: 30px;
  width: min(1360px, calc(100vw - 64px));
  min-height: 0;
  margin: 0 auto;
  padding: 10px 0 26px;
}

.map-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.map-heading {
  margin-bottom: 12px;
}

.map-eyebrow {
  color: #8ca3a4;
  font-size: 9px;
  letter-spacing: 0.18em;
}

.map-heading h1 {
  margin: 8px 0 6px;
  color: #edf5f4;
  font-size: clamp(24px, 3vw, 38px);
  font-weight: 500;
  letter-spacing: 0;
}

.map-heading p {
  margin: 0;
  color: #8d9d9e;
  font-size: 11px;
}

.map-frame {
  position: relative;
  overflow: visible;
  height: min(64vh, 570px);
  min-height: 420px;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.map-fog {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 21% 72%, rgba(171, 185, 184, 0.13), transparent 38%),
    radial-gradient(ellipse at 78% 23%, rgba(134, 151, 151, 0.1), transparent 42%);
}

.hunan-map {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.province-shadow {
  fill: rgba(0, 0, 0, 0.24);
  transform: translate(9px, 13px);
}

.province-outline {
  fill: none;
  stroke: rgba(220, 235, 233, 0.24);
  stroke-width: 1.2;
  pointer-events: none;
}

.map-region {
  cursor: pointer;
  outline: none;
  transform-box: fill-box;
  transform-origin: center;
  transition: transform 0.28s ease, filter 0.28s ease;
}

.region-shape {
  stroke: rgba(217, 232, 230, 0.07);
  stroke-width: 0.7;
  transition: fill 0.28s ease, stroke 0.28s ease;
}

.region-plain .region-shape { fill: #577668; }
.region-hill .region-shape { fill: #68785a; }
.region-south .region-shape { fill: #5d7569; }
.region-east .region-shape { fill: #61736e; }
.region-mountain .region-shape { fill: #596e61; }

.region-label {
  fill: rgba(242, 248, 247, 0.8);
  font-size: 13px;
  font-weight: 600;
  text-anchor: middle;
  pointer-events: none;
}

.region-selected-edge {
  fill: none;
  stroke: #b1eee3;
  stroke-width: 2.4;
  opacity: 0;
  pointer-events: none;
}

.map-region.selected {
  transform: translateY(-12px);
  filter: url(#region-glow);
}

.map-region.selected .region-shape {
  fill: #79aa90;
  stroke: rgba(201, 249, 238, 0.28);
}

.map-region.selected .region-selected-edge { opacity: 1; }

.map-caption {
  position: absolute;
  right: 18px;
  bottom: 14px;
  left: 18px;
  display: flex;
  justify-content: space-between;
  color: #788d8e;
  font-size: 9px;
}

.map-caption span:first-child {
  display: flex;
  align-items: center;
  gap: 6px;
}

.map-caption i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #9be8dc;
  box-shadow: 0 0 10px rgba(155, 232, 220, 0.8);
}

.entry-info {
  align-self: center;
  min-height: 390px;
  max-height: calc(100vh - 116px);
  overflow-y: auto;
  padding: 25px;
  border: 1px solid rgba(218, 234, 234, 0.15);
  border-radius: 12px;
  background: rgba(27, 34, 35, 0.62);
  backdrop-filter: blur(18px) saturate(0.62);
}

.entry-info-kicker {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #8aa3a2;
  font-size: 8px;
  letter-spacing: 0.16em;
}

.entry-info-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #9bd8ce;
  box-shadow: 0 0 11px rgba(155, 216, 206, 0.65);
}

.entry-info h2 {
  margin: 14px 0 10px;
  color: #edf7f5;
  font-size: 24px;
  font-weight: 500;
  letter-spacing: 0;
}

.entry-description {
  margin: 0 0 18px;
  color: #a4b4b4;
  font-size: 11px;
  line-height: 1.8;
}

.entry-facts {
  display: grid;
  gap: 1px;
  margin: 0;
  overflow: hidden;
  border: 1px solid rgba(218, 234, 234, 0.1);
  border-radius: 8px;
  background: rgba(218, 234, 234, 0.08);
}

.entry-facts > div {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr);
  gap: 10px;
  padding: 10px;
  background: rgba(23, 30, 31, 0.82);
}

.entry-facts dt { color: #7f9494; font-size: 9px; }
.entry-facts dd { margin: 0; color: #cfdddc; font-size: 10px; line-height: 1.6; }

.entry-location {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 13px;
  color: #718686;
  font-size: 9px;
}

.entry-location strong { color: #a9bfbc; font-size: 9px; font-weight: 500; }

.entry-enter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-top: 22px;
  padding: 12px 14px;
  border: 1px solid rgba(159, 224, 211, 0.36);
  border-radius: 8px;
  background: rgba(112, 172, 158, 0.14);
  color: #e2fbf5;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.entry-enter:hover {
  border-color: rgba(159, 224, 211, 0.72);
  background: rgba(112, 172, 158, 0.24);
}

.entry-info-empty {
  display: grid;
  min-height: 340px;
  place-content: center;
  text-align: center;
}

.entry-info-empty .entry-info-dot { margin: 0 auto 12px; }
.entry-info-empty p { max-width: 250px; margin: 0; color: #8fa1a0; font-size: 10px; line-height: 1.7; }

@media (max-width: 900px) {
  .region-entry {
    height: auto;
    overflow: auto;
  }

  .entry-content {
    grid-template-columns: minmax(0, 1fr);
    width: min(720px, calc(100vw - 28px));
    padding: 22px 0 28px;
  }

  .map-frame,
  .hunan-map {
    height: 430px;
    min-height: 430px;
  }

  .entry-info { min-height: auto; }
}

@media (max-width: 560px) {
  .entry-head { padding: 10px 14px; }
  .entry-brand span { display: none; }
  .map-frame,
  .hunan-map {
    height: 350px;
    min-height: 350px;
  }
  .map-heading h1 { font-size: 25px; }
  .map-caption { gap: 8px; font-size: 8px; }
}
</style>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  createPlotPlantLayout,
  getRicePartVisibility,
  maturityCompactAt,
  riceHeightScaleAt,
} from "../scene/riceBatchMath.js";
import {
  ProceduralRiceFactory,
  PROCEDURAL_RICE_MODEL_KEY,
} from "../scene/proceduralRiceFactory.js";

const PREVIEW_PLANT_COUNT = 96;
const PREVIEW_PLOT_SIZE = 9;
const STAGE_COLOR = {
  seedling: 0xb9c75a,
  tillering: 0x73a744,
  jointing: 0x55943c,
  heading: 0x4f8838,
  filling: 0x58823a,
  maturity: 0x71803a,
};
const PANICLE_COLOR = {
  seedling: 0x69923d,
  tillering: 0x69923d,
  jointing: 0x69923d,
  heading: 0x84a344,
  filling: 0xd3b34d,
  maturity: 0xd1a943,
};

const props = defineProps({
  plotId: { type: String, required: true },
  plotName: { type: String, default: "" },
  params: { type: Object, required: true },
  stage: { type: String, default: "germination" },
  stageLabel: { type: String, default: "" },
  progress: { type: Number, default: 0 },
  warningCount: { type: Number, default: 0 },
});

const STAGE_LABELS = {
  germination: "发芽期",
  seedling: "幼苗期",
  tillering: "分蘖期",
  jointing: "拔节期",
  heading: "抽穗期",
  filling: "灌浆期",
  maturity: "成熟期",
};

const displayStageLabel = computed(
  () => props.stageLabel || STAGE_LABELS[props.stage] || "生长期"
);
const displayProgress = computed(() =>
  THREE.MathUtils.clamp(Number(props.progress) || 0, 0, 100)
);
const displayHealth = computed(() =>
  THREE.MathUtils.clamp(Number(props.params.healthPct) || 0, 0, 100)
);
const displayWaterLevel = computed(() => Number(props.params.waterLevelCm) || 0);
const autoRotate = ref(false);

const container = ref(null);
let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let resizeObserver = null;
let waterMesh = null;
let plantBatches = [];
let plantLayout = [];
let animationFrame = 0;
let lastRenderAt = 0;
const geometries = new Set();
const materials = new Set();
const scratchObject = new THREE.Object3D();
const scratchColor = new THREE.Color();
const dryColor = new THREE.Color(0xd0c45b);

function createTerrain() {
  const mudGeometry = new THREE.BoxGeometry(10, 0.3, 10);
  const mudMaterial = new THREE.MeshStandardMaterial({
    color: 0x594432,
    roughness: 1,
  });
  const mud = new THREE.Mesh(mudGeometry, mudMaterial);
  mud.position.y = -0.15;
  scene.add(mud);
  geometries.add(mudGeometry);
  materials.add(mudMaterial);

  const waterGeometry = new THREE.PlaneGeometry(10, 10);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x48a9c5,
    transparent: true,
    opacity: 0.76,
    roughness: 0.18,
    metalness: 0.08,
    depthWrite: false,
  });
  waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
  waterMesh.position.y = 0.04;
  scene.add(waterMesh);
  geometries.add(waterGeometry);
  materials.add(waterMaterial);

  const leveeGeometry = new THREE.BoxGeometry(10.4, 0.38, 0.4);
  const leveeMaterial = new THREE.MeshStandardMaterial({
    color: 0x81704e,
    roughness: 1,
  });
  for (const z of [-5.2, 5.2]) {
    const levee = new THREE.Mesh(leveeGeometry, leveeMaterial);
    levee.position.set(0, 0.19, z);
    scene.add(levee);
  }
  const sideLeveeGeometry = new THREE.BoxGeometry(0.4, 0.38, 10);
  for (const x of [-5.2, 5.2]) {
    const levee = new THREE.Mesh(sideLeveeGeometry, leveeMaterial);
    levee.position.set(x, 0.19, 0);
    scene.add(levee);
  }
  geometries.add(leveeGeometry);
  geometries.add(sideLeveeGeometry);
  materials.add(leveeMaterial);
}

function applyPlantColor(partKey, growthStage, healthPct, target) {
  if (partKey === "seed") {
    return target.setHex(0xc9a55a);
  }
  let colorHex = STAGE_COLOR[growthStage] || STAGE_COLOR.tillering;
  if (partKey === "panicle") {
    colorHex = PANICLE_COLOR[growthStage] || PANICLE_COLOR.heading;
  } else if (partKey === "grains") {
    colorHex = growthStage === "maturity" ? 0xe0bd55 : 0xd7bd62;
  }
  target.setHex(colorHex);
  const drought = 1 - THREE.MathUtils.clamp(healthPct / 100, 0, 1);
  if (partKey === "leaves" || partKey === "mainStem" || partKey === "tillerStems") {
    target.lerp(dryColor, drought * 0.72);
  }
  return target;
}

function syncPreview() {
  if (!renderer || !props.params) return;
  const stage = props.stage || props.params.growthStage || "tillering";
  const progress = THREE.MathUtils.clamp(Number(props.progress) || 0, 0, 100);
  const partVisibility = getRicePartVisibility(progress);
  const maturityCompact = maturityCompactAt(progress);
  const height = riceHeightScaleAt(progress);
  const health = Number.isFinite(props.params.healthPct) ? props.params.healthPct : 100;
  const waterLevel = THREE.MathUtils.clamp(
    (Number(props.params.waterLevelCm) || 0) / 100,
    0,
    0.12
  );
  waterMesh.position.y = waterLevel;

  for (const batch of plantBatches) {
    const partKey = batch.userData.partKey;
    batch.visible = partVisibility[partKey] === true;
    for (let index = 0; index < PREVIEW_PLANT_COUNT; index += 1) {
      const plant = plantLayout[index];
      scratchObject.position.set(plant.x, 0.015, plant.z);
      scratchObject.rotation.set(plant.tiltX, plant.yaw, plant.tiltZ);
      const scaleY = plant.height * height;
      const width = (1.02 + plant.height * 0.14) * (1 + maturityCompact * 0.08);
      scratchObject.scale.set(width, scaleY, width);
      scratchObject.updateMatrix();
      batch.setMatrixAt(index, scratchObject.matrix);
      batch.setColorAt(index, applyPlantColor(batch.userData.partKey, stage, health, scratchColor));
    }
    batch.instanceMatrix.needsUpdate = true;
    if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
    batch.userData.growth.array.fill(progress / 100);
    batch.userData.growth.needsUpdate = true;
  }
  renderOnce();
}

function renderOnce() {
  if (renderer) renderer.render(scene, camera);
}

function renderLoop(timestamp = performance.now()) {
  if (!renderer) return;
  animationFrame = requestAnimationFrame(renderLoop);
  if (document.hidden || timestamp - lastRenderAt < 1000 / 30) return;
  lastRenderAt = timestamp;
  if (controls) controls.update();
  renderer.render(scene, camera);
}

function zoomBy(factor) {
  if (!camera || !controls) return;
  const offset = camera.position.clone().sub(controls.target);
  const distance = THREE.MathUtils.clamp(
    offset.length() * factor,
    controls.minDistance,
    controls.maxDistance
  );
  camera.position.copy(controls.target).add(offset.setLength(distance));
  controls.update();
}

function resetView() {
  if (!controls) return;
  autoRotate.value = false;
  controls.autoRotate = false;
  controls.reset();
  controls.update();
}

function toggleAutoRotate() {
  if (!controls) return;
  autoRotate.value = !autoRotate.value;
  controls.autoRotate = autoRotate.value;
}

function stopAutoRotateOnInteraction() {
  if (!autoRotate.value) return;
  autoRotate.value = false;
  if (controls) controls.autoRotate = false;
}

function onResize() {
  if (!renderer || !container.value) return;
  const width = Math.max(container.value.clientWidth, 1);
  const height = Math.max(container.value.clientHeight, 1);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderOnce();
}

onMounted(() => {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x10201e);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x66745c, 1.8));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(4, 9, 5);
  scene.add(sun);

  const factory = new ProceduralRiceFactory();
  const prototype = factory.createPlant(PROCEDURAL_RICE_MODEL_KEY);
  const prototypeMeshes = [];
  prototype.traverse((object) => {
    if (object.isMesh && object.userData.batchPartKey) prototypeMeshes.push(object);
  });

  plantLayout = createPlotPlantLayout(
    props.plotId,
    PREVIEW_PLANT_COUNT,
    PREVIEW_PLOT_SIZE,
    PREVIEW_PLOT_SIZE
  );
  for (const mesh of prototypeMeshes) {
    const growth = new THREE.InstancedBufferAttribute(
      new Float32Array(PREVIEW_PLANT_COUNT),
      1
    );
    growth.setUsage(THREE.DynamicDrawUsage);
    const visible = new THREE.InstancedBufferAttribute(
      new Float32Array(PREVIEW_PLANT_COUNT).fill(1),
      1
    );
    const phase = new THREE.InstancedBufferAttribute(
      new Float32Array(plantLayout.map((plant) => plant.phase)),
      1
    );
    const swayAmp = new THREE.InstancedBufferAttribute(
      new Float32Array(PREVIEW_PLANT_COUNT),
      1
    );
    mesh.geometry.setAttribute("aGrowth", growth);
    mesh.geometry.setAttribute("aVisible", visible);
    mesh.geometry.setAttribute("aPhase", phase);
    mesh.geometry.setAttribute("aSwayAmp", swayAmp);
    const batch = new THREE.InstancedMesh(
      mesh.geometry,
      mesh.material,
      PREVIEW_PLANT_COUNT
    );
    batch.name = `PlotCloseup_${mesh.userData.batchPartKey}`;
    batch.userData.partKey = mesh.userData.batchPartKey;
    batch.userData.plotId = props.plotId;
    batch.userData.growth = growth;
    batch.userData.phase = phase;
    batch.castShadow = false;
    batch.receiveShadow = false;
    batch.frustumCulled = false;
    scene.add(batch);
    plantBatches.push(batch);
    geometries.add(mesh.geometry);
    materials.add(mesh.material);
  }
  createTerrain();

  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(9.2, 9.6, 11.4);

  // 近景工作台需要持续渲染，保证拖拽阻尼与自动旋转足够顺滑
  renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.style.touchAction = "none";
  container.value.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.78, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 0.9;
  controls.minDistance = 5.8;
  controls.maxDistance = 21;
  controls.minPolarAngle = 0.24;
  controls.maxPolarAngle = 1.43;
  controls.autoRotateSpeed = 0.72;
  controls.addEventListener("start", stopAutoRotateOnInteraction);
  controls.update();
  controls.saveState();

  onResize();
  syncPreview();
  animationFrame = requestAnimationFrame(renderLoop);

  resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container.value);
});

watch(
  () => [
    props.plotId,
    props.stage,
    props.progress,
    props.params.healthPct,
    props.params.waterLevelCm,
  ],
  () => {
    if (plantBatches.length && props.plotId !== plantBatches[0].userData.plotId) {
      plantLayout = createPlotPlantLayout(
        props.plotId,
        PREVIEW_PLANT_COUNT,
        PREVIEW_PLOT_SIZE,
        PREVIEW_PLOT_SIZE
      );
      plantBatches.forEach((batch) => {
        batch.userData.plotId = props.plotId;
        batch.userData.phase.array.set(plantLayout.map((plant) => plant.phase));
        batch.userData.phase.needsUpdate = true;
      });
    }
    syncPreview();
  }
);

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame);
  if (resizeObserver) resizeObserver.disconnect();
  if (controls) controls.dispose();
  plantBatches.forEach((batch) => batch.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  if (renderer) {
    renderer.dispose();
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }
});
</script>

<template>
  <section class="plot-closeup">
    <div class="plot-closeup-head">
      <div class="plot-closeup-title">
        <span class="plot-closeup-kicker">INTERACTIVE FIELD VIEW</span>
        <strong>{{ plotName || "田块近景" }}</strong>
      </div>
      <div class="plot-closeup-head-meta">
        <span class="plot-closeup-id">{{ plotId }}</span>
        <span v-if="warningCount" class="plot-closeup-warning">{{ warningCount }} 项预警</span>
      </div>
    </div>
    <div class="plot-closeup-stage-row">
      <span class="plot-closeup-stage"><i></i>{{ displayStageLabel }}</span>
      <span class="plot-closeup-progress">生理进度 <strong>{{ displayProgress.toFixed(1) }}%</strong></span>
    </div>
    <div class="plot-closeup-viewport">
      <div ref="container" class="plot-closeup-canvas"></div>
      <div class="plot-closeup-toolbar" role="toolbar" aria-label="田块近景视图控制">
        <button
          type="button"
          title="放大"
          aria-label="放大田块近景"
          @pointerdown.stop
          @click="zoomBy(0.82)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4M8 11h6M11 8v6" />
          </svg>
        </button>
        <button
          type="button"
          title="缩小"
          aria-label="缩小田块近景"
          @pointerdown.stop
          @click="zoomBy(1.22)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4M8 11h6" />
          </svg>
        </button>
        <button
          type="button"
          :class="{ active: autoRotate }"
          :aria-pressed="autoRotate"
          title="自动旋转"
          aria-label="自动旋转田块近景"
          @pointerdown.stop
          @click="toggleAutoRotate"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 7v5h-5" />
            <path d="M19 12a7 7 0 1 0-2.2 5.1" />
          </svg>
        </button>
        <button
          type="button"
          title="复位视角"
          aria-label="复位田块近景视角"
          @pointerdown.stop
          @click="resetView"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
        </button>
      </div>
      <div class="plot-closeup-readout">
        <span><i class="readout-dot is-water"></i>水位 <strong>{{ displayWaterLevel.toFixed(1) }} cm</strong></span>
        <span><i class="readout-dot is-health"></i>健康 <strong>{{ displayHealth.toFixed(0) }}%</strong></span>
        <span>稻株 <strong>96</strong></span>
      </div>
    </div>
    <div class="plot-closeup-caption">
      <span>{{ displayStageLabel }} · {{ displayProgress.toFixed(1) }}%</span>
      <span>{{ params.temperatureC.toFixed(1) }}°C · 湿度 {{ params.humidityPct.toFixed(0) }}%</span>
    </div>
  </section>
</template>

<style scoped>
.plot-closeup {
  flex: 0 0 auto;
  min-height: 350px;
  overflow: hidden;
  border: 1px solid rgba(115, 180, 190, 0.2);
  border-radius: 12px;
  background: linear-gradient(160deg, rgba(14, 33, 39, 0.98), rgba(8, 18, 27, 0.96));
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24);
}

.plot-closeup-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 11px 12px 8px;
  color: #d7eff0;
}

.plot-closeup-title {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.plot-closeup-title strong {
  overflow: hidden;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plot-closeup-kicker {
  color: #5d8d97;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.13em;
}

.plot-closeup-head-meta {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

.plot-closeup-id {
  color: #7da6af;
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
}

.plot-closeup-warning {
  padding: 2px 6px;
  border: 1px solid rgba(251, 191, 36, 0.32);
  border-radius: 999px;
  background: rgba(251, 191, 36, 0.1);
  color: #f6c766;
  font-size: 9px;
  white-space: nowrap;
}

.plot-closeup-stage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 12px 8px;
}

.plot-closeup-stage {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #b9f7df;
  font-size: 10px;
  font-weight: 700;
}

.plot-closeup-stage i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 9px rgba(52, 211, 153, 0.82);
}

.plot-closeup-progress {
  color: #708f98;
  font-size: 9px;
}

.plot-closeup-progress strong {
  color: #b8e9ed;
  font-size: 10px;
}

.plot-closeup-viewport {
  position: relative;
  isolation: isolate;
}

.plot-closeup-canvas {
  height: clamp(260px, 34vh, 360px);
  min-height: 260px;
  background: #10201e;
}

.plot-closeup-canvas :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
}

.plot-closeup-canvas :deep(canvas:active) {
  cursor: grabbing;
}

.plot-closeup-toolbar {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  display: grid;
  grid-template-columns: repeat(2, 30px);
  gap: 6px;
}

.plot-closeup-toolbar button {
  display: grid;
  width: 30px;
  height: 30px;
  padding: 0;
  place-items: center;
  border: 1px solid rgba(139, 210, 217, 0.28);
  border-radius: 8px;
  background: rgba(7, 20, 27, 0.76);
  color: #b8d4da;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.plot-closeup-toolbar button:hover,
.plot-closeup-toolbar button.active {
  border-color: rgba(94, 234, 212, 0.66);
  background: rgba(24, 77, 78, 0.84);
  color: #8ff8e1;
}

.plot-closeup-toolbar button:focus-visible {
  outline: 2px solid #5eead4;
  outline-offset: 2px;
}

.plot-closeup-toolbar svg {
  width: 15px;
  height: 15px;
}

.plot-closeup-readout {
  position: absolute;
  right: 10px;
  bottom: 10px;
  left: 10px;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  padding: 7px 9px;
  border: 1px solid rgba(122, 183, 192, 0.2);
  border-radius: 8px;
  background: rgba(5, 17, 23, 0.72);
  color: #8caab1;
  font-size: 9px;
  backdrop-filter: blur(9px);
}

.plot-closeup-readout span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.plot-closeup-readout strong {
  color: #d6f5f6;
  font-size: 10px;
}

.readout-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.readout-dot.is-water {
  background: #38bdf8;
  box-shadow: 0 0 7px rgba(56, 189, 248, 0.75);
}

.readout-dot.is-health {
  background: #34d399;
  box-shadow: 0 0 7px rgba(52, 211, 153, 0.7);
}

.plot-closeup-caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px 10px;
  color: #7d999e;
  font-size: 9px;
  line-height: 1.45;
}

.plot-closeup-caption span {
  min-width: 0;
}

@media (min-width: 1181px) and (max-height: 820px) {
  .plot-closeup-canvas {
    height: 260px;
  }
}

@media (max-width: 760px) {
  .plot-closeup {
    min-height: 410px;
  }

  .plot-closeup-canvas {
    height: 290px;
    min-height: 290px;
  }

  .plot-closeup-caption {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
  }
}
</style>

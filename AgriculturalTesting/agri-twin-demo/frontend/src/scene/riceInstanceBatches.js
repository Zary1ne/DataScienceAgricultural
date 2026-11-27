import * as THREE from "three";
import { REGION_CONFIGS } from "./regionConfigs.ts";
import {
  createPlotPlantLayout,
  createVisibilityMask,
  getRicePartVisibility,
  getPlotInstanceRange,
  hash01,
  MAX_PLANT_COUNT,
  maturityCompactAt,
  maturityVisibleCountAt,
  PLANTS_PER_PLOT,
  riceHeightScaleAt,
  VISIBLE_PLANT_COUNT,
} from "./riceBatchMath.js";
import {
  ProceduralRiceFactory,
  PROCEDURAL_RICE_MODEL_KEY,
} from "./proceduralRiceFactory.js";
import { createRicePartMaterial } from "./riceMaterial.js";
import { computeWindStrength } from "./weatherState.js";

// 叶/茎颜色：[进度, 色值]
const LEAF_KEYFRAMES = [
  [0, 0xbcd25e],   // 嫩绿
  [14, 0x97c052],
  [28, 0x6fa543],
  [43, 0x4f8a37],  // 深绿
  [57, 0x4a8434],
  [72, 0x6f8f38],  // 黄绿
  [85, 0x9d9640],
  [100, 0xbc9a3e], // 金黄枯黄
];
const PANICLE_KEYFRAMES = [
  [57, 0x8fae4a],
  [72, 0xc9c05a],
  [85, 0xd8b34a],
  [100, 0xc29a33],
];
const GRAIN_KEYFRAMES = [
  [57, 0xa9b552],
  [75, 0xd8c465],
  [100, 0xd0ad45],
];
const DRY_COLOR = 0xd6c46a;
// P3 收割后稻茬颜色（灰褐）
const STUBBLE_COLOR = 0x8b8574;
const STAGE_FALLBACK_PROGRESS = {
  seedling: 15,
  tillering: 32,
  jointing: 50,
  heading: 65,
  filling: 80,
  maturity: 92,
};
// 颜色采样用的临时对象，避免每帧 new Color 造成 GC 抖动
const scratchColorA = new THREE.Color();
const scratchColorB = new THREE.Color();
const scratchBaseColor = new THREE.Color();
const scratchPlantColor = new THREE.Color();
const dryTargetColor = new THREE.Color(DRY_COLOR);

function sampleKeyframeValue(keyframes, progress) {
  if (progress <= keyframes[0][0]) return keyframes[0][1];
  for (let i = 1; i < keyframes.length; i += 1) {
    if (progress <= keyframes[i][0]) {
      const [p0, v0] = keyframes[i - 1];
      const [p1, v1] = keyframes[i];
      const t = (progress - p0) / Math.max(1e-6, p1 - p0);
      return v0 + (v1 - v0) * t;
    }
  }
  return keyframes[keyframes.length - 1][1];
}

function sampleKeyframeColor(keyframes, progress, target) {
  if (progress <= keyframes[0][0]) return target.setHex(keyframes[0][1]);
  for (let i = 1; i < keyframes.length; i += 1) {
    if (progress <= keyframes[i][0]) {
      const [p0, c0] = keyframes[i - 1];
      const [p1, c1] = keyframes[i];
      const t = (progress - p0) / Math.max(1e-6, p1 - p0);
      return target
        .copy(scratchColorA.setHex(c0))
        .lerp(scratchColorB.setHex(c1), t);
    }
  }
  return target.setHex(keyframes[keyframes.length - 1][1]);
}

/** 分蘖期丛生程度：进度 32% 附近达到峰值 */
function bushinessAt(progress) {
  const rise = THREE.MathUtils.smoothstep(progress, 18, 32);
  const fall = 1 - THREE.MathUtils.smoothstep(progress, 45, 58);
  return rise * fall;
}

/** 成熟期稻穗压弯程度（0~0.22rad） */
function droopAt(progress) {
  return THREE.MathUtils.smoothstep(progress, 86, 100) * 0.22;
}

// WIND_SPEED_BY_WEATHER 已迁移到 weatherState.js 的 computeWindStrength(snapshot)

function addAttributeRange(attribute, start, count, itemSize) {
  attribute.addUpdateRange(start * itemSize, count * itemSize);
  attribute.needsUpdate = true;
}

function createBatchMaterial(partKey, windUniforms) {
  return createRicePartMaterial(partKey, { windUniforms });
}

function createInstancedAttribute(geometry, name) {
  const attribute = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_PLANT_COUNT),
    1
  );
  attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute(name, attribute);
  return attribute;
}

function createBatch(mesh, windUniforms) {
  const geometry = mesh.geometry;
  const material = createBatchMaterial(mesh.userData.batchPartKey, windUniforms);
  const instancedMesh = new THREE.InstancedMesh(
    geometry,
    material,
    MAX_PLANT_COUNT
  );
  instancedMesh.name = `RiceBatch_${mesh.userData.batchPartKey}`;
  instancedMesh.count = MAX_PLANT_COUNT;
  instancedMesh.castShadow = false;
  instancedMesh.receiveShadow = false;
  instancedMesh.frustumCulled = false;
  instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const attributes = {
    visible: createInstancedAttribute(geometry, "aVisible"),
    phase: createInstancedAttribute(geometry, "aPhase"),
    swayAmp: createInstancedAttribute(geometry, "aSwayAmp"),
    growth: createInstancedAttribute(geometry, "aGrowth"),
  };
  return { key: mesh.userData.batchPartKey, mesh: instancedMesh, attributes };
}

// P2: 按生理进度采样部件颜色；胁迫/健康度低时向枯黄快速靠拢
function baseColorForPart(partKey, progress, dryAmount, target) {
  if (partKey === "seed") {
    target.setHex(0xc9a55a);
  } else if (partKey === "panicle") {
    sampleKeyframeColor(PANICLE_KEYFRAMES, progress, target);
  } else if (partKey === "grains") {
    sampleKeyframeColor(GRAIN_KEYFRAMES, progress, target);
  } else {
    sampleKeyframeColor(LEAF_KEYFRAMES, progress, target);
    target.lerp(dryTargetColor, dryAmount);
  }
  return target;
}

function createIdentityMatrix() {
  const matrix = new THREE.Matrix4();
  matrix.identity();
  return matrix;
}

export function getRiceDetailProfile(plotCount) {
  const count = Math.max(1, Number(plotCount) || 1);
  const detailFactor = THREE.MathUtils.clamp(1 + (25 - count) / 24 * 0.36, 1, 1.36);
  return {
    detailFactor,
    nearCount: Math.min(PLANTS_PER_PLOT, Math.round(VISIBLE_PLANT_COUNT * detailFactor)),
    farCount: Math.min(PLANTS_PER_PLOT, Math.round(48 * detailFactor)),
    midCount: Math.min(PLANTS_PER_PLOT, Math.round(68 * detailFactor)),
    farDistance: count <= 8 ? 235 : count <= 15 ? 205 : 180,
    midDistance: count <= 8 ? 170 : 145,
  };
}

export function createRiceInstanceBatches(
  plotStates = {},
  regions = REGION_CONFIGS,
  selectedPlotId = null
) {
  const configuredModelKeys = new Set(
    regions.flatMap((region) => region.cells.map((cell) => cell.plantModelKey))
  );
  if (configuredModelKeys.size > 1) {
    throw new Error("All plots must use the same plant model for shared instancing");
  }
  const plantModelKey = configuredModelKeys.values().next().value || PROCEDURAL_RICE_MODEL_KEY;
  const factory = new ProceduralRiceFactory();
  const prototype = factory.createPlant(plantModelKey);
  const prototypeMeshes = [];
  prototype.traverse((object) => {
    if (object.isMesh && object.userData.batchPartKey) prototypeMeshes.push(object);
  });
  const windUniforms = {
    uTime: { value: 0 },
    // 默认晴天风摆系数，与 weatherState.computeWindStrength({wind:1}) 等价
    uWindSpeed: { value: 0.1 },
  };
  // P4 性能：随镜头距离动态调整每地块渲染株数（LOD）
  const plotCount = regions.reduce((total, region) => total + region.cells.length, 0);
  const {
    nearCount: LOD_NEAR_COUNT,
    farCount: LOD_FAR_COUNT,
    midCount: LOD_MID_COUNT,
    farDistance: LOD_FAR_DISTANCE,
    midDistance: LOD_MID_DISTANCE,
  } = getRiceDetailProfile(plotCount);
  let lodVisibleCount = LOD_NEAR_COUNT;
  const batches = new Map(
    prototypeMeshes.map((mesh) => [
      mesh.userData.batchPartKey,
      createBatch(mesh, windUniforms),
    ])
  );
  const root = new THREE.Group();
  root.name = "RicePlantBatches";
  batches.forEach(({ mesh }) => root.add(mesh));

  // P3: 根部暗色圆片 —— 俯视时填补株间空隙，模拟水面阴影/倒影，成本仅 10 段圆
  const clumpShadowGeometry = new THREE.CircleGeometry(0.38, 10);
  clumpShadowGeometry.rotateX(-Math.PI / 2);
  const clumpShadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x142c18,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  const clumpShadows = new THREE.InstancedMesh(
    clumpShadowGeometry,
    clumpShadowMaterial,
    MAX_PLANT_COUNT
  );
  clumpShadows.name = "RiceClumpShadows";
  clumpShadows.count = MAX_PLANT_COUNT;
  clumpShadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  clumpShadows.frustumCulled = false;
  root.add(clumpShadows);

  const plots = new Map();
  const plotRanges = new Map();
  const scratchObject = new THREE.Object3D();
  const stubbleColor = new THREE.Color(STUBBLE_COLOR);
  // P3: 收割进度 0~1（1 秒内由外部 rAF 推到 1）
  let harvestAmount = 0;
  let plotOrdinal = 0;

  function updatePlot(plot, force = false) {
    const state = plotStates[plot.id];
    const params = state ? state.params : plot.config.defaultParams;
    const selected = plot.id === selectedPlotId;
    const progress = Number.isFinite(state?.physiologicalProgress)
      ? THREE.MathUtils.clamp(state.physiologicalProgress, 0, 100)
      : (STAGE_FALLBACK_PROGRESS[params.growthStage] ?? 32);
    const partVisibility = getRicePartVisibility(progress);
    const maturityCompact = maturityCompactAt(progress);
    const baseVisibleCount = selected ? PLANTS_PER_PLOT : lodVisibleCount;
    const visibleCount = maturityVisibleCountAt(baseVisibleCount, progress);
    const healthPct = Number.isFinite(params.healthPct) ? params.healthPct : 100;
    // 环境胁迫（P1 的 PlotState.stressed）或健康值过低 → 枯黄 + 停止长高
    const stressed = Boolean(state?.stressed) || healthPct < 35;
    // 收割进度分档，避免 1 秒动画期间每帧重写全量缓冲
    const harvestStep = Math.round(harvestAmount * 20) / 20;
    const colorHarvestStep = Math.round(harvestAmount * 10) / 10;
    if (harvestStep >= 0.5) {
      partVisibility.panicle = false;
      partVisibility.grains = false;
    }
    const partsKey = Object.entries(partVisibility)
      .filter(([, visible]) => visible)
      .map(([part]) => part)
      .join("|");

    // 进度每变化 0.8% 才写一次实例缓冲（1x 下约 1.1 秒），避免每帧全量刷写
    const matrixChanged =
      force ||
      plot.progress == null ||
      Math.abs(plot.progress - progress) >= 0.8 ||
      plot.stressed !== stressed ||
      plot.harvest !== harvestStep ||
      plot.visibleCount !== visibleCount;
    // 颜色变化比高度慢得多，单独用 2% 阈值，避免每次长高都重写全部颜色缓冲
    const colorChanged =
      force ||
      plot.colorProgress == null ||
      Math.abs(plot.colorProgress - progress) >= 2 ||
      plot.colorHarvest !== colorHarvestStep ||
      plot.stressed !== stressed ||
      (plot.healthPct != null && Math.abs(plot.healthPct - healthPct) >= 0.5);
    const visibilityChanged =
      force ||
      plot.visibleCount !== visibleCount ||
      plot.partsKey !== partsKey;
    const growthChanged =
      force ||
      plot.growthProgress == null ||
      Math.abs(plot.growthProgress - progress) >= 0.15;
    if (!matrixChanged && !colorChanged && !visibilityChanged && !growthChanged) return;

    // 先刷新可见性掩码，保证矩阵写入跳过的是「本次」隐藏的植株
    if (visibilityChanged) {
      plot.mask = createVisibilityMask(plot.id, visibleCount);
    }

    if (matrixChanged) {
      const heightScale =
        riceHeightScaleAt(progress) *
        (stressed ? 0.9 : 1) *
        (1 - 0.82 * harvestStep);
      const bush = bushinessAt(progress);
      const droop = droopAt(progress) * (stressed ? 1.6 : 1);
      for (let plantIndex = 0; plantIndex < PLANTS_PER_PLOT; plantIndex += 1) {
        // LOD 隐藏的植株不必重算矩阵，省下约 27% 的 CPU 写入
        if (plot.mask && plot.mask[plantIndex] !== 1) continue;
        const plant = plot.layout[plantIndex];
        scratchObject.position.set(
          plot.worldX + plant.x,
          plot.mudY + 0.015,
          plot.worldZ + plant.z
        );
        // 分蘖期加大水平随机倾斜模拟丛生；成熟期稻穗压弯茎秆
        scratchObject.rotation.set(
          plant.tiltX * (1 + bush * 0.5) + droop * Math.sin(plant.yaw),
          plant.yaw,
          plant.tiltZ * (1 + bush * 0.5) + droop * Math.cos(plant.yaw)
        );
        const widthScale =
          (1.02 + plant.height * 0.14) *
          (1 + bush * 0.24) *
          (1 + maturityCompact * 0.08);
        scratchObject.scale.set(widthScale, plant.height * heightScale, widthScale);
        scratchObject.updateMatrix();
        for (const batch of batches.values()) {
          batch.mesh.setMatrixAt(plot.range.start + plantIndex, scratchObject.matrix);
        }
      }
      for (const batch of batches.values()) {
        addAttributeRange(batch.mesh.instanceMatrix, plot.range.start, PLANTS_PER_PLOT, 16);
      }
    }

    if (growthChanged) {
      for (const batch of batches.values()) {
        batch.attributes.growth.array.fill(
          progress / 100,
          plot.range.start,
          plot.range.end
        );
        addAttributeRange(batch.attributes.growth, plot.range.start, PLANTS_PER_PLOT, 1);
      }
    }

    if (colorChanged) {
      // 胁迫/健康度差 → 叶片快速向枯黄靠拢，即使在幼苗期也直观可见
      const dryAmount = THREE.MathUtils.clamp(
        (1 - healthPct / 100) * 0.55 + (stressed ? 0.25 : 0),
        0,
        0.75
      );
      for (const batch of batches.values()) {
        baseColorForPart(batch.key, progress, dryAmount, scratchBaseColor);
        // 收割后统一向灰褐稻茬色过渡
        if (colorHarvestStep > 0) {
          scratchBaseColor.lerp(stubbleColor, colorHarvestStep * 0.85);
        }
        for (let plantIndex = 0; plantIndex < PLANTS_PER_PLOT; plantIndex += 1) {
          const variation = 0.96 + hash01(plot.id, plantIndex, "color") * 0.08;
          scratchPlantColor.copy(scratchBaseColor).multiplyScalar(variation);
          batch.mesh.setColorAt(plot.range.start + plantIndex, scratchPlantColor);
        }
        addAttributeRange(batch.mesh.instanceColor, plot.range.start, PLANTS_PER_PLOT, 3);
      }
      plot.colorProgress = progress;
    }

    if (visibilityChanged) {
      const densityMask = plot.mask;
      for (const batch of batches.values()) {
        const visibleAttribute = batch.attributes.visible;
        const partVisible = partVisibility[batch.key] === true;
        for (let plantIndex = 0; plantIndex < PLANTS_PER_PLOT; plantIndex += 1) {
          const visible = densityMask[plantIndex] === 1 && partVisible;
          visibleAttribute.array[plot.range.start + plantIndex] = visible ? 1 : 0;
        }
        addAttributeRange(visibleAttribute, plot.range.start, PLANTS_PER_PLOT, 1);
      }
    }

    plot.progress = progress;
    plot.growthProgress = progress;
    plot.harvest = harvestStep;
    plot.colorHarvest = colorHarvestStep;
    plot.healthPct = healthPct;
    plot.stressed = stressed;
    plot.visibleCount = visibleCount;
    plot.partsKey = partsKey;
  }

  for (const region of regions) {
    for (const cell of region.cells) {
      const range = getPlotInstanceRange(plotOrdinal);
      const layout = createPlotPlantLayout(
        cell.id,
        PLANTS_PER_PLOT,
        cell.widthM,
        cell.depthM
      );
      const plot = {
        id: cell.id,
        config: cell,
        layout,
        range,
        worldX: region.originXZ.x + cell.centerXZ.x,
        worldZ: region.originXZ.z + cell.centerXZ.z,
        mudY: cell.elevationM ?? 0,
        progress: null,
        growthProgress: null,
        colorProgress: null,
        colorHarvest: null,
        harvest: null,
        mask: null,
        healthPct: null,
        stressed: null,
        visibleCount: null,
        partsKey: null,
      };
      plots.set(cell.id, plot);
      plotRanges.set(cell.id, range);
      updatePlot(plot, true);

      // 根部暗色圆片：每株一个，静态矩阵，只在初始化时写一次
      for (let plantIndex = 0; plantIndex < PLANTS_PER_PLOT; plantIndex += 1) {
        const plant = layout[plantIndex];
        const shadowScale = 0.82 + hash01(cell.id, plantIndex, "clump-shadow") * 0.36;
        scratchObject.position.set(
          plot.worldX + plant.x,
          plot.mudY + 0.012,
          plot.worldZ + plant.z
        );
        scratchObject.rotation.set(0, 0, 0);
        scratchObject.scale.set(shadowScale, 1, shadowScale);
        scratchObject.updateMatrix();
        clumpShadows.setMatrixAt(range.start + plantIndex, scratchObject.matrix);
      }
      addAttributeRange(clumpShadows.instanceMatrix, range.start, PLANTS_PER_PLOT, 16);

      for (const batch of batches.values()) {
        const { phase, swayAmp } = batch.attributes;
        for (let plantIndex = 0; plantIndex < PLANTS_PER_PLOT; plantIndex += 1) {
          const index = range.start + plantIndex;
          phase.array[index] = layout[plantIndex].phase;
          swayAmp.array[index] = layout[plantIndex].swayAmp;
        }
        addAttributeRange(phase, range.start, PLANTS_PER_PLOT, 1);
        addAttributeRange(swayAmp, range.start, PLANTS_PER_PLOT, 1);
      }
      plotOrdinal += 1;
    }
  }

  function update(
    time,
    weatherSnapshot,
    nextSelectedPlotId = selectedPlotId,
    cameraDistance = 0,
    nextHarvestAmount = 0
  ) {
    selectedPlotId = nextSelectedPlotId;
    harvestAmount = THREE.MathUtils.clamp(Number(nextHarvestAmount) || 0, 0, 1);
    // LOD：镜头越远，渲染的植株越少；阈值切换时重写一次 aVisible
    const nextLod = cameraDistance > LOD_FAR_DISTANCE
      ? LOD_FAR_COUNT
      : cameraDistance > LOD_MID_DISTANCE
        ? LOD_MID_COUNT
        : LOD_NEAR_COUNT;
    if (nextLod !== lodVisibleCount) {
      lodVisibleCount = nextLod;
      plots.forEach((plot) => {
        plot.visibleCount = null;
      });
    }
    // 根部暗色圆片在远景下属于纯填充成本，拉近后再显示
    clumpShadows.visible = cameraDistance <= LOD_MID_DISTANCE;
    windUniforms.uTime.value = time;
    // 消费 weatherSnapshot（来自 weatherState.js）
    // 向后兼容：如果调用方还传旧的 weather 字符串，临时转成 snapshot 计算风摆
    const snap = typeof weatherSnapshot === "string"
      ? { wind: weatherSnapshot === "sunny" ? 1 : weatherSnapshot === "cloudy" ? 2 : weatherSnapshot === "rain" ? 3 : 12 }
      : weatherSnapshot;
    windUniforms.uWindSpeed.value = computeWindStrength(snap);
    plots.forEach((plot) => updatePlot(plot));
  }

  function setGlobalInstanceLimit(count) {
    if (!Number.isInteger(count) || count < 0 || count > MAX_PLANT_COUNT) {
      throw new RangeError(`Global instance limit must be from 0 to ${MAX_PLANT_COUNT}`);
    }
    batches.forEach(({ mesh }) => {
      mesh.count = count;
    });
    clumpShadows.count = count;
  }

  function dispose() {
    for (const batch of batches.values()) {
      batch.mesh.dispose();
      batch.mesh.geometry.dispose();
      batch.mesh.material.dispose();
    }
    clumpShadows.dispose();
    clumpShadowGeometry.dispose();
    clumpShadowMaterial.dispose();
  }

  return { root, batches, plotRanges, update, setGlobalInstanceLimit, dispose };
}

import * as THREE from "three";
import {
  PLAIN_REGION_CONFIG,
  TERRACE_REGION_CONFIG,
} from "./regionConfigs.ts";
import { createRiceInstanceBatches } from "./riceInstanceBatches.js";
import {
  createFarmComponentVisual,
  disposeFarmComponentVisual,
  setFarmComponentVisualEnabled,
} from "./farmComponentVisualFactory.js";
import { ZERO_COMPONENT_EFFECTS } from "./farmComponentRates.js";
import { GLOBAL_PLOT_ID } from "./farmComponents.js";

const MUD_LAYER_DEPTH_M = 0.4;
const SELECTION_RING_CLEARANCE_M = 0.02;
const LEVEE_HEIGHT_M = 0.4;

function mudElevationForRow(region, row) {
  if (region.type === "terrace") return region.terraceLevelsByRow[row - 1];
  return region.mudElevationM;
}

function addMesh(parent, geometry, material, x, y, z) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = false;
  object.receiveShadow = false;
  parent.add(object);
  return object;
}

function buildRegion(root, region, plotStates, registry, pickables, resources) {
  const regionRoot = new THREE.Group();
  regionRoot.name = region.rootName;
  regionRoot.position.set(region.originXZ.x, 0, region.originXZ.z);
  root.add(regionRoot);

  const mudMaterial = new THREE.MeshLambertMaterial({
    color: 0x594432,
  });
  const leveeMaterial = new THREE.MeshLambertMaterial({
    color: 0x81704e,
  });
  const waterMaterial = new THREE.MeshLambertMaterial({
    color: 0x48a9c5,
    transparent: true,
    opacity: 0.76,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  resources.materials.add(mudMaterial);
  resources.materials.add(leveeMaterial);
  resources.materials.add(waterMaterial);

  const mudGeometry = new THREE.BoxGeometry(
    region.cellSizeM,
    MUD_LAYER_DEPTH_M,
    region.cellSizeM
  );
  // Water covers the 10 m net cell only; the separately built 0.4 m levees are excluded.
  const waterGeometry = new THREE.PlaneGeometry(
    region.cellSizeM,
    region.cellSizeM
  );
  waterGeometry.rotateX(-Math.PI / 2);
  resources.geometries.add(mudGeometry);
  resources.geometries.add(waterGeometry);

  const scratchObject = new THREE.Object3D();
  const mudInstances = new THREE.InstancedMesh(mudGeometry, mudMaterial, region.cells.length);
  mudInstances.name = `${region.rootName}_MudInstances`;
  mudInstances.castShadow = false;
  mudInstances.receiveShadow = false;
  mudInstances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  resources.instanced.add(mudInstances);
  let mudIndex = 0;

  region.cells.forEach((cell) => {
    const mudY = mudElevationForRow(region, cell.row);
    const state = plotStates[cell.id];
    const params = state ? state.params : cell.defaultParams;
    const plotGroup = new THREE.Group();
    plotGroup.name = cell.id;
    plotGroup.position.set(cell.centerXZ.x, mudY, cell.centerXZ.z);
    plotGroup.userData.plotId = cell.id;
    regionRoot.add(plotGroup);

    scratchObject.position.set(cell.centerXZ.x, mudY - MUD_LAYER_DEPTH_M / 2, cell.centerXZ.z);
    scratchObject.rotation.set(0, 0, 0);
    scratchObject.scale.set(1, 1, 1);
    scratchObject.updateMatrix();
    mudInstances.setMatrixAt(mudIndex, scratchObject.matrix);
    mudIndex += 1;

    // The plot group's Y is the mud surface, so world water Y is mud Y plus waterLevelCm / 100.
    const waterY = params.waterLevelCm / 100;
    const water = addMesh(plotGroup, waterGeometry, waterMaterial, 0, waterY, 0);
    water.userData.objectId = cell.id;
    pickables.push(water);

    const metrics = [
      { label: "水位", value: params.waterLevelCm, unit: "cm" },
      { label: "CO₂", value: params.co2Ppm, unit: "ppm" },
      { label: "温度", value: params.temperatureC, unit: "°C" },
      { label: "湿度", value: params.humidityPct, unit: "%" },
      { label: "光照", value: params.lightLux, unit: "lux" },
      { label: "生长阶段", value: params.growthStage, unit: "" },
      { label: "健康值", value: params.healthPct, unit: "%" },
    ];

    registry.set(cell.id, {
      group: plotGroup,
      top: waterY + SELECTION_RING_CLEARANCE_M,
      waterMesh: water,
      targetWaterY: waterY,   // P4: 目标水位，用于 lerp 平滑过渡
      meta: {
        id: cell.id,
        name: `${region.name} ${cell.row}行${cell.column}格`,
        type: "plot",
        regionId: region.id,
        row: cell.row,
        column: cell.column,
        status: "normal",
        desc: "独立参数容器；当前显示初始化演示值。",
        mudElevationM: mudY,
        plantCountTarget: cell.plantCountTarget,
        plantModelKey: cell.plantModelKey,
        metrics,
      },
    });
  });
  mudInstances.instanceMatrix.needsUpdate = true;
  regionRoot.add(mudInstances);

  const total = region.totalWidthM;
  const half = total / 2;
  const spacing = region.cellSizeM + region.leveeWidthM;
  const acrossCellLevee = new THREE.BoxGeometry(
    region.leveeWidthM,
    LEVEE_HEIGHT_M,
    region.cellSizeM
  );
  resources.geometries.add(acrossCellLevee);

  const acrossCellLevees = new THREE.InstancedMesh(
    acrossCellLevee,
    leveeMaterial,
    region.rows * (region.columns + 1)
  );
  acrossCellLevees.name = `${region.rootName}_AcrossCellLevees`;
  acrossCellLevees.castShadow = false;
  acrossCellLevees.receiveShadow = false;
  acrossCellLevees.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  resources.instanced.add(acrossCellLevees);
  let acrossCellLeveeIndex = 0;
  for (let row = 1; row <= region.rows; row += 1) {
    const mudY = mudElevationForRow(region, row);
    const centerZ = (row - 3) * spacing;
    for (let boundary = 0; boundary <= region.columns; boundary += 1) {
      const centerX = -half + boundary * spacing + region.leveeWidthM / 2;
      scratchObject.position.set(centerX, mudY + LEVEE_HEIGHT_M / 2, centerZ);
      scratchObject.rotation.set(0, 0, 0);
      scratchObject.scale.set(1, 1, 1);
      scratchObject.updateMatrix();
      acrossCellLevees.setMatrixAt(acrossCellLeveeIndex, scratchObject.matrix);
      acrossCellLeveeIndex += 1;
    }
  }
  acrossCellLevees.instanceMatrix.needsUpdate = true;
  regionRoot.add(acrossCellLevees);

  const boundaryZ = (index) => -half + index * spacing + region.leveeWidthM / 2;
  const acrossRowLeveeGeometry = new THREE.BoxGeometry(total, 1, region.leveeWidthM);
  resources.geometries.add(acrossRowLeveeGeometry);
  const acrossRowLevees = new THREE.InstancedMesh(
    acrossRowLeveeGeometry,
    leveeMaterial,
    region.rows + 1
  );
  acrossRowLevees.name = `${region.rootName}_AcrossRowLevees`;
  acrossRowLevees.castShadow = false;
  acrossRowLevees.receiveShadow = false;
  acrossRowLevees.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  resources.instanced.add(acrossRowLevees);
  for (let boundary = 0; boundary <= region.rows; boundary += 1) {
    let lowY;
    let highY;
    if (boundary === 0) {
      lowY = highY = mudElevationForRow(region, 1);
    } else if (boundary === region.rows) {
      lowY = highY = mudElevationForRow(region, region.rows);
    } else {
      const before = mudElevationForRow(region, boundary);
      const after = mudElevationForRow(region, boundary + 1);
      lowY = Math.min(before, after);
      highY = Math.max(before, after);
    }
    const height = highY - lowY + LEVEE_HEIGHT_M;
    scratchObject.position.set(0, lowY + height / 2, boundaryZ(boundary));
    scratchObject.rotation.set(0, 0, 0);
    scratchObject.scale.set(1, height, 1);
    scratchObject.updateMatrix();
    acrossRowLevees.setMatrixAt(boundary, scratchObject.matrix);
  }
  acrossRowLevees.instanceMatrix.needsUpdate = true;
  regionRoot.add(acrossRowLevees);
}

function componentPlacement(type) {
  const placements = {
    irrigation: { x: -4.25, z: 0, rotationY: -Math.PI / 2 },
    ventilation: { x: 4.25, z: 0, rotationY: Math.PI / 2 },
    co2Supply: { x: 0, z: -4.25, rotationY: Math.PI },
    camera: { x: 0, z: 4.25, rotationY: 0 },
    // P6: 新增三种设备落位（放在田块四角/中央，互相不重叠）
    pestLamp: { x: -4.25, z: -4.25, rotationY: Math.PI / 4 },
    sunshade: { x: 0, z: 0, rotationY: 0 },            // 罩在田块正中
    heater: { x: 4.25, z: -4.25, rotationY: -Math.PI / 4 },
    // P15: 智能排水泵放在右前角，排水口朝向田块内侧
    drainage: { x: 4.05, z: 4.05, rotationY: -Math.PI / 2 },
  };
  // 兜底：未登记的型号也给一个合法落位，避免 syncComponents 因 placement 为 undefined 抛错
  return placements[type] || { x: 0, z: 0, rotationY: 0 };
}

// P9: 程序化草地纹理（Canvas 噪点），避免田外是一整片纯色/网格虚空
function createGrassTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#24432b";
  ctx.fillRect(0, 0, size, size);
  const shades = ["#1f3b26", "#2c5233", "#37633d", "#29492f", "#3f6d45"];
  for (let i = 0; i < 5200; i += 1) {
    ctx.fillStyle = shades[i % shades.length];
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(26, 14);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createPaddyFieldScene(plotStates = {}, componentManager = null) {
  const root = new THREE.Group();
  root.name = "OpenRiceFields";
  const registry = new Map();
  const componentRegistry = new Map();
  const pickables = [];
  const componentPickables = [];
  const componentVisuals = new Map();
  const resources = {
    geometries: new Set(),
    materials: new Set(),
    textures: new Set(),
    instanced: new Set(),
  };
  const riceBatches = createRiceInstanceBatches(plotStates);
  let simulationAccumulator = 0;
  let elapsedSeconds = 0;

  buildRegion(root, PLAIN_REGION_CONFIG, plotStates, registry, pickables, resources);
  buildRegion(root, TERRACE_REGION_CONFIG, plotStates, registry, pickables, resources);
  root.add(riceBatches.root);

  // P9: 大田外围草地底板 —— 带纹理的草绿平面（同时作为全局设备的拾取面）
  // 位于田块下方（y=-0.62），不会遮挡任何稻田
  const groundGeometry = new THREE.PlaneGeometry(170, 90);
  groundGeometry.rotateX(-Math.PI / 2);
  const groundTexture = createGrassTexture();
  const groundMaterial = new THREE.MeshLambertMaterial({ map: groundTexture });
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.name = "GlobalGround";
  groundMesh.position.set(40, -0.62, 0);
  groundMesh.userData.isGlobalGround = true;
  groundMesh.receiveShadow = false;
  root.add(groundMesh);
  resources.geometries.add(groundGeometry);
  resources.materials.add(groundMaterial);
  resources.textures.add(groundTexture);

  function syncComponents() {
    const components = componentManager ? componentManager.components : [];
    const componentsById = new Map(components.map((component) => [component.id, component]));

    for (const [componentId, visual] of componentVisuals) {
      if (componentsById.has(componentId)) continue;
      if (visual.parent) visual.parent.remove(visual);
      disposeFarmComponentVisual(visual);
      componentVisuals.delete(componentId);
      componentRegistry.delete(componentId);
    }

    for (const component of components) {
      const existingVisual = componentVisuals.get(component.id);
      if (existingVisual) {
        setFarmComponentVisualEnabled(existingVisual, component.enabled);
        continue;
      }

      const isGlobal = component.plotId === GLOBAL_PLOT_ID;
      const plot = isGlobal ? null : registry.get(component.plotId);
      if (!isGlobal && !plot) continue;

      const visual = createFarmComponentVisual(component);
      if (isGlobal) {
        // P7: 大田外围设备 —— 直接放在世界坐标，不挂到任何地块 group
        const placement = component.placement || { x: 40, z: -18, rotationY: 0 };
        // 底板平面在 y=-0.62，模型底座贴地
        visual.position.set(placement.x, -0.6, placement.z);
        visual.rotation.y = placement.rotationY ?? 0;
        root.add(visual);
      } else {
        const placement = component.placement || componentPlacement(component.type);
        visual.position.set(placement.x, 0.02, placement.z);
        visual.rotation.y = placement.rotationY ?? 0;
        plot.group.add(visual);
        // P5: 灌溉喷水粒子 — 延迟注入 placement 和 plot 边界信息
        if (visual.userData.sprinkler) {
          visual.userData.sprinkler.configure(placement, 5, placement.rotationY ?? 0);
        }
      }
      componentVisuals.set(component.id, visual);
      componentRegistry.set(component.id, {
        group: visual,
        component,
        plotId: component.plotId,
      });
      componentPickables.push(visual);
    }

    for (let index = componentPickables.length - 1; index >= 0; index -= 1) {
      if (!componentVisuals.has(componentPickables[index].userData.componentId)) {
        componentPickables.splice(index, 1);
      }
    }
  }

  syncComponents();

  let lastDispatchContext = {};

  function syncComponentActivity() {
    if (!componentManager) return;
    componentManager.components.forEach((component) => {
      const visual = componentVisuals.get(component.id);
      if (visual) {
        const active = componentManager.isControlComponent(component.id)
          ? componentManager.isActive(component.id)
          : component.enabled;
        setFarmComponentVisualEnabled(visual, active);
      }
    });
  }

  function runDispatchTick(context = {}, dtSeconds = 1) {
    lastDispatchContext = { ...lastDispatchContext, ...context };
    const environment = {
      weather: lastDispatchContext.weather,
      weatherSnapshot: lastDispatchContext.weatherSnapshot,
      selectedPlotId: lastDispatchContext.selectedPlotId,
      elapsedSeconds,
    };
    componentManager?.beginAutoControlCycle();
    Object.values(plotStates).forEach((state) => {
      // 自然环境先推进一次，避免每个组件重复执行天气和回归。
      state.update?.(dtSeconds, {
        ...environment,
        componentEffects: { ...ZERO_COMPONENT_EFFECTS },
      });
      // 随后按固定优先级逐个组件执行，每个组件都基于最新状态重新判断。
      const components = componentManager?.listDispatchComponents(state.id) || [];
      components.forEach((component) => {
        const componentEffects = componentManager.effectsForComponent(state.id, component, {
          params: state.params,
          stage: state.currentStage,
        });
        state.applyComponentStep?.(dtSeconds, componentEffects);
      });
      const plot = registry.get(state.id);
      if (plot) {
        const waterY = state.params.waterLevelCm / 100;
        plot.targetWaterY = waterY;
        plot.top = waterY + SELECTION_RING_CLEARANCE_M;
      }
    });
    syncComponentActivity();
  }

  return {
    root,
    registry,
    componentRegistry,
    pickables,
    componentPickables,
    groundMesh,
    riceBatches,
    syncComponents,
    dispatchNow() {
      elapsedSeconds += 1;
      runDispatchTick(lastDispatchContext, 1);
      return true;
    },
    update(time, dt, context = {}) {
      simulationAccumulator += Math.min(Math.max(dt, 0), 1);
      // —— 每秒一次的模拟 tick（参数更新）——
      while (simulationAccumulator >= 1) {
        simulationAccumulator -= 1;
        elapsedSeconds += 1;
        runDispatchTick(context, 1);
      }

      // —— 每帧都做：水面 lerp 平滑升降 ——
      // speed=4 ≈ 0.25s 到达目标，视觉上"缓缓升起"但不拖慢
      const lerp = Math.min(1, dt * 4);
      registry.forEach((plot) => {
        if (plot.waterMesh) {
          const cur = plot.waterMesh.position.y;
          const tgt = plot.targetWaterY ?? cur;
          if (Math.abs(cur - tgt) > 0.0005) {
            plot.waterMesh.position.y = cur + (tgt - cur) * lerp;
          }
        }
      });

      riceBatches.update(
        time,
        context.weatherSnapshot || context.weather,
        context.selectedPlotId,
        context.cameraDistance || 0,
        context.harvestAmount || 0
      );

      // P5: 每帧更新灌溉喷水粒子（只有 enabled=true 时才物理模拟）
      // 性能保底：直接遍历 Map，跳过 disabled 的
      componentVisuals.forEach((group) => {
        if (!group.userData.enabled) return;
        const sprinkler = group.userData.sprinkler;
        if (sprinkler) sprinkler.update(dt);
        const irrigationJets = group.userData.irrigationJets;
        if (irrigationJets) {
          irrigationJets.forEach((jet, index) => {
            const pulse = 0.9 + Math.sin(time * 5.2 + index * 1.7) * 0.1;
            jet.scale.set(1, pulse, 1);
          });
        }
        const humidifierMist = group.userData.humidifierMist;
        if (humidifierMist) {
          humidifierMist.forEach((puff, index) => {
            const pulse = 0.82 + Math.sin(time * 2.8 + index * 1.1) * 0.18;
            puff.scale.setScalar(pulse);
          });
        }
        const dehumidifierFan = group.userData.dehumidifierFan;
        if (dehumidifierFan) {
          const fans = Array.isArray(dehumidifierFan) ? dehumidifierFan : [dehumidifierFan];
          fans.forEach((fan) => {
            fan.rotation.z += dt * 5.2;
          });
        }
      });
    },
    dispose() {
      for (const visual of componentVisuals.values()) {
        if (visual.parent) visual.parent.remove(visual);
        disposeFarmComponentVisual(visual);
      }
      componentVisuals.clear();
      componentRegistry.clear();
      componentPickables.length = 0;
      riceBatches.dispose();
      resources.instanced.forEach((mesh) => mesh.dispose());
      resources.instanced.clear();
      resources.geometries.forEach((geometry) => geometry.dispose());
      resources.materials.forEach((material) => material.dispose());
      resources.textures.forEach((texture) => texture.dispose());
    },
  };
}

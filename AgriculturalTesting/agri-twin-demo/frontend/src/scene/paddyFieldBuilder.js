import * as THREE from "three";
import { PLAIN_REGION_CONFIG } from './regionConfigs.ts';
import { createRiceInstanceBatches } from "./riceInstanceBatches.js";
import { PLANTS_PER_PLOT } from "./riceBatchMath.js";
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

function addMesh(parent, geometry, material, x, y, z) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = false;
  object.receiveShadow = false;
  parent.add(object);
  return object;
}

function buildRegion(root, region, plotStates, registry, pickables, resources, previewMode = false) {
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

  const mudGeometry = new THREE.BoxGeometry(1, MUD_LAYER_DEPTH_M, 1);
  const waterGeometry = new THREE.PlaneGeometry(1, 1);
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
    const mudY = cell.elevationM ?? 0;
    const state = plotStates[cell.id];
    const params = state ? state.params : cell.defaultParams;
    const plotGroup = new THREE.Group();
    plotGroup.name = cell.id;
    plotGroup.position.set(cell.centerXZ.x, mudY, cell.centerXZ.z);
    plotGroup.userData.plotId = cell.id;
    regionRoot.add(plotGroup);

    scratchObject.position.set(cell.centerXZ.x, mudY - MUD_LAYER_DEPTH_M / 2, cell.centerXZ.z);
    scratchObject.rotation.set(0, 0, 0);
    scratchObject.scale.set(cell.widthM, 1, cell.depthM);
    scratchObject.updateMatrix();
    mudInstances.setMatrixAt(mudIndex, scratchObject.matrix);
    mudIndex += 1;

    // The plot group's Y is the mud surface, so world water Y is mud Y plus waterLevelCm / 100.
    const waterY = params.waterLevelCm / 100;
    const water = addMesh(plotGroup, waterGeometry, waterMaterial, 0, waterY, 0);
    water.scale.set(cell.widthM, cell.depthM, 1);
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
        widthM: cell.widthM,
        depthM: cell.depthM,
        elevationM: mudY,
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

  const leveeGeometry = new THREE.BoxGeometry(1, 1, 1);
  resources.geometries.add(leveeGeometry);
  const levees = new THREE.InstancedMesh(leveeGeometry, leveeMaterial, region.cells.length * 4);
  levees.name = `${region.rootName}_PlotLevees`;
  levees.castShadow = false;
  levees.receiveShadow = false;
  levees.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  resources.instanced.add(levees);

  let leveeIndex = 0;
  for (const cell of region.cells) {
    const { x, z } = cell.centerXZ;
    const halfWidth = cell.widthM / 2;
    const halfDepth = cell.depthM / 2;
    const y = (cell.elevationM ?? 0) + LEVEE_HEIGHT_M / 2 - 0.04;
    const strips = [
      { x: x - halfWidth, z, sx: region.leveeWidthM, sz: cell.depthM + region.leveeWidthM },
      { x: x + halfWidth, z, sx: region.leveeWidthM, sz: cell.depthM + region.leveeWidthM },
      { x, z: z - halfDepth, sx: cell.widthM + region.leveeWidthM, sz: region.leveeWidthM },
      { x, z: z + halfDepth, sx: cell.widthM + region.leveeWidthM, sz: region.leveeWidthM },
    ];
    for (const strip of strips) {
      scratchObject.position.set(strip.x, y, strip.z);
      scratchObject.rotation.set(0, 0, 0);
      scratchObject.scale.set(strip.sx, LEVEE_HEIGHT_M, strip.sz);
      scratchObject.updateMatrix();
      levees.setMatrixAt(leveeIndex, scratchObject.matrix);
      leveeIndex += 1;
    }
  }
  levees.instanceMatrix.needsUpdate = true;
  regionRoot.add(levees);
  if (!previewMode) buildTerrainDecor(regionRoot, region, resources);
}

function addTerrainMesh(parent, geometry, material, position, scale, rotationY = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position.x, position.y, position.z);
  mesh.rotation.y = rotationY;
  mesh.scale.set(scale.x, scale.y, scale.z);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

function createMountainMassifGeometry(width, depth, height, seed = 1) {
  const columns = 18;
  const rows = 8;
  const positions = [];
  const colors = [];
  const indices = [];
  const low = new THREE.Color(0x304a31);
  const middle = new THREE.Color(0x4b633b);
  const high = new THREE.Color(0x69736a);

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    for (let column = 0; column <= columns; column += 1) {
      const u = (column / columns) * 2 - 1;
      const edge = Math.max(0, 1 - u * u) ** 0.62;
      // Near the field edge (v = 1) the terrain starts at ground level and rises away from it.
      const frontRise = Math.pow(1 - v, 0.82);
      const ridge =
        0.76 +
        0.16 * Math.sin((u * 3.1 + seed * 1.7) * Math.PI) +
        0.08 * Math.sin((u * 7.3 - seed * 0.9) * Math.PI);
      const y = height * edge * frontRise * ridge;
      positions.push(u * width / 2, y, (v - 0.5) * depth);

      const level = THREE.MathUtils.clamp(y / Math.max(height, 0.001), 0, 1);
      const color = new THREE.Color();
      if (level < 0.52) color.copy(low).lerp(middle, level / 0.52);
      else color.copy(middle).lerp(high, (level - 0.52) / 0.48);
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + 1;
      const c = a + columns + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addMountainMassif(parent, resources, x, z, width, depth, height, seed) {
  const geometry = createMountainMassifGeometry(width, depth, height, seed);
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, 0, z);
  mesh.userData.terrainLandform = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  resources.geometries.add(geometry);
  resources.materials.add(material);
  return mesh;
}

function terrainNoise(seed, salt) {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function createForestPatch(options) {
  const {
    centerX,
    centerZ,
    width,
    depth,
    count,
    minScale = 1.25,
    maxScale = 2.25,
    baseY = 0,
    seed = 1,
    field = null,
  } = options;
  const positions = [];
  const clearance = maxScale * 1.8;
  for (let index = 0; index < count; index += 1) {
    const angle = terrainNoise(seed + index, 1) * Math.PI * 2;
    const radius = Math.sqrt(terrainNoise(seed + index, 2));
    const x = centerX + Math.cos(angle) * width * 0.5 * radius;
    const z = centerZ + Math.sin(angle) * depth * 0.5 * radius;
    if (
      field &&
      x > field.minX - clearance &&
      x < field.maxX + clearance &&
      z > field.minZ - clearance &&
      z < field.maxZ + clearance
    ) {
      continue;
    }
    const scale = minScale + (maxScale - minScale) * terrainNoise(seed + index, 3);
    const y = baseY + (terrainNoise(seed + index, 4) - 0.5) * 0.28;
    positions.push([x, y, z, scale]);
  }
  return positions;
}

function addForest(parent, resources, positions) {
  if (!positions.length) return;
  const ordered = [...positions].sort(
    (a, b) => terrainNoise(a[0] * 0.37 + a[2] * 0.19, 19) - terrainNoise(b[0] * 0.37 + b[2] * 0.19, 19)
  );
  const spaced = [];
  for (const candidate of ordered) {
    const candidateRadius = candidate[3] * 1.45;
    const overlaps = spaced.some((other) => {
      const dx = candidate[0] - other[0];
      const dz = candidate[2] - other[2];
      const minimum = candidateRadius + other[3] * 1.45;
      return dx * dx + dz * dz < minimum * minimum;
    });
    if (!overlaps) spaced.push(candidate);
  }
  positions = spaced;
  if (!positions.length) return;
  parent.userData.forestTrees = [...(parent.userData.forestTrees || []), ...positions];
  const trunkGeometry = new THREE.CylinderGeometry(1, 1, 1, 6);
  const lowerGeometry = new THREE.ConeGeometry(1, 1, 8);
  const upperGeometry = new THREE.ConeGeometry(1, 1, 7);
  const broadleafGeometry = new THREE.DodecahedronGeometry(1, 0);
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x5a422c });
  const foliageMaterial = new THREE.MeshLambertMaterial({ color: 0x315c37, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, positions.length);
  const coniferPositions = positions.filter((_, index) => index % 4 !== 0);
  const broadleafPositions = positions.filter((_, index) => index % 4 === 0);
  const lowerCanopy = new THREE.InstancedMesh(lowerGeometry, foliageMaterial, coniferPositions.length);
  const upperCanopy = new THREE.InstancedMesh(upperGeometry, foliageMaterial, coniferPositions.length);
  const broadleafCanopy = new THREE.InstancedMesh(broadleafGeometry, foliageMaterial, broadleafPositions.length);
  const scratch = new THREE.Object3D();
  const color = new THREE.Color();
  let coniferIndex = 0;
  let broadleafIndex = 0;

  positions.forEach(([x, y, z, scale], index) => {
    const treeScale = scale * 1.65;
    const rotation = Math.sin(x * 1.7 + z * 0.9) * Math.PI;
    scratch.position.set(x, y + 0.6 * treeScale, z);
    scratch.rotation.set(0, rotation, 0);
    scratch.scale.set(0.11 * treeScale, 1.2 * treeScale, 0.11 * treeScale);
    scratch.updateMatrix();
    trunks.setMatrixAt(index, scratch.matrix);

    if (index % 4 === 0) {
      scratch.position.set(x, y + 1.45 * treeScale, z);
      scratch.scale.set(0.8 * treeScale, 0.88 * treeScale, 0.8 * treeScale);
      scratch.updateMatrix();
      broadleafCanopy.setMatrixAt(broadleafIndex, scratch.matrix);
      color.setHSL(0.28 + (index % 6) * 0.006, 0.32, 0.25 + (index % 4) * 0.02);
      broadleafCanopy.setColorAt(broadleafIndex, color);
      broadleafIndex += 1;
      return;
    }

    scratch.position.set(x, y + 1.35 * treeScale, z);
    scratch.scale.set(0.72 * treeScale, 1.5 * treeScale, 0.72 * treeScale);
    scratch.updateMatrix();
    lowerCanopy.setMatrixAt(coniferIndex, scratch.matrix);

    scratch.position.set(x, y + 2.05 * treeScale, z);
    scratch.scale.set(0.48 * treeScale, 1.15 * treeScale, 0.48 * treeScale);
    scratch.updateMatrix();
    upperCanopy.setMatrixAt(coniferIndex, scratch.matrix);

    color.setHSL(0.31 + (index % 5) * 0.006, 0.34, 0.2 + (index % 4) * 0.022);
    lowerCanopy.setColorAt(coniferIndex, color);
    upperCanopy.setColorAt(coniferIndex, color.clone().offsetHSL(0, 0, 0.025));
    coniferIndex += 1;
  });

  trunks.instanceMatrix.needsUpdate = true;
  lowerCanopy.instanceMatrix.needsUpdate = true;
  upperCanopy.instanceMatrix.needsUpdate = true;
  broadleafCanopy.instanceMatrix.needsUpdate = true;
  if (lowerCanopy.instanceColor) lowerCanopy.instanceColor.needsUpdate = true;
  if (upperCanopy.instanceColor) upperCanopy.instanceColor.needsUpdate = true;
  if (broadleafCanopy.instanceColor) broadleafCanopy.instanceColor.needsUpdate = true;
  parent.add(trunks, lowerCanopy, upperCanopy, broadleafCanopy);
  resources.instanced.add(trunks);
  resources.instanced.add(lowerCanopy);
  resources.instanced.add(upperCanopy);
  resources.instanced.add(broadleafCanopy);
  resources.geometries.add(trunkGeometry);
  resources.geometries.add(lowerGeometry);
  resources.geometries.add(upperGeometry);
  resources.geometries.add(broadleafGeometry);
  resources.materials.add(trunkMaterial);
  resources.materials.add(foliageMaterial);
}

export function buildTerrainDecor(regionRoot, region, resources) {
  const halfW = region.totalWidthM / 2;
  const halfD = region.totalDepthM / 2;
  const field = {
    minX: Math.min(...region.cells.map((cell) => cell.centerXZ.x - cell.widthM / 2)),
    maxX: Math.max(...region.cells.map((cell) => cell.centerXZ.x + cell.widthM / 2)),
    minZ: Math.min(...region.cells.map((cell) => cell.centerXZ.z - cell.depthM / 2)),
    maxZ: Math.max(...region.cells.map((cell) => cell.centerXZ.z + cell.depthM / 2)),
  };
  const earth = new THREE.MeshLambertMaterial({ color: 0x53623e });
  const terraceEarth = new THREE.MeshLambertMaterial({ color: 0x465f31 });
  const rock = new THREE.MeshLambertMaterial({ color: 0x7b8580 });
  const bank = new THREE.MeshLambertMaterial({ color: 0x6b684f });
  const water = new THREE.MeshLambertMaterial({ color: 0x2e7186, transparent: true, opacity: 0.72 });
  resources.materials.add(earth);
  resources.materials.add(terraceEarth);
  resources.materials.add(rock);
  resources.materials.add(bank);
  resources.materials.add(water);

  const box = new THREE.BoxGeometry(1, 1, 1);
  const mound = new THREE.ConeGeometry(1, 1, 7);
  const crag = new THREE.DodecahedronGeometry(1, 0);
  resources.geometries.add(box);
  resources.geometries.add(mound);
  resources.geometries.add(crag);

  if (region.terrain === 'plain') {
    return;
  }

  if (region.terrain === 'hill') {
    const mounds = [
      [-halfW - 13, -6, 7, 5], [halfW + 13, 5, 8, 6], [-8, -halfD - 12, 9, 5],
      [11, halfD + 13, 8, 4],
    ];
    for (const [x, z, sx, sy] of mounds) {
      addTerrainMesh(regionRoot, mound, earth, { x, y: sy / 2 - 0.45, z }, { x: sx, y: sy, z: sx * 0.72 }, x * 0.07);
    }
    addMountainMassif(regionRoot, resources, 0, -halfD - 17, 86, 28, 9, 3);
    addMountainMassif(regionRoot, resources, 0, -halfD - 51, 58, 22, 13, 23);
    const forest = [
      ...createForestPatch({ centerX: 0, centerZ: -halfD - 8, width: halfW * 2 + 24, depth: 13, count: 46, minScale: 1.45, maxScale: 2.45, seed: 31, field }),
      ...createForestPatch({ centerX: -halfW - 9, centerZ: -2, width: 12, depth: halfD * 2 + 18, count: 26, minScale: 1.4, maxScale: 2.4, seed: 37, field }),
      ...createForestPatch({ centerX: halfW + 9, centerZ: -2, width: 12, depth: halfD * 2 + 18, count: 26, minScale: 1.4, maxScale: 2.4, seed: 41, field }),
      ...createForestPatch({ centerX: -halfW - 6, centerZ: halfD + 7, width: 13, depth: 11, count: 14, minScale: 1.35, maxScale: 2.25, seed: 43, field }),
      ...createForestPatch({ centerX: halfW + 6, centerZ: halfD + 7, width: 13, depth: 11, count: 14, minScale: 1.35, maxScale: 2.25, seed: 47, field }),
      ...createForestPatch({ centerX: -halfW - 18, centerZ: -halfD - 14, width: 12, depth: 14, count: 18, minScale: 1.35, maxScale: 2.3, seed: 51, field }),
      ...createForestPatch({ centerX: halfW + 18, centerZ: -halfD - 14, width: 12, depth: 14, count: 18, minScale: 1.35, maxScale: 2.3, seed: 57, field }),
    ];
    addForest(regionRoot, resources, forest);
    return;
  }

  if (region.terrain === 'karst') {
    const crags = [
      [-halfW - 10, -halfD + 1, 4.2, 8], [halfW + 11, -halfD - 3, 4.6, 9],
      [-halfW - 11, halfD - 2, 3.8, 6.5], [halfW + 10, halfD + 3, 4.1, 7.2],
      [0, -halfD - 11, 5.4, 10.5], [-halfW - 15, -3, 3.4, 5.8],
      [halfW + 15, 1, 3.7, 6.2], [-halfW - 13, -halfD - 10, 4.7, 8.7],
      [halfW + 14, -halfD - 12, 4.9, 9.1],
    ];
    for (const [x, z, width, height] of crags) {
      addTerrainMesh(regionRoot, crag, rock, { x, y: height / 2 - 0.5, z }, { x: width, y: height / 2, z: width * 0.72 }, x * 0.05);
    }
    addMountainMassif(regionRoot, resources, 0, -halfD - 16, 48, 18, 7.5, 13);
    const forest = [
      ...createForestPatch({ centerX: 0, centerZ: -halfD - 7.2, width: halfW * 2 + 12, depth: 8, count: 20, minScale: 1.4, maxScale: 2.35, seed: 53, field }),
      ...createForestPatch({ centerX: -halfW - 7, centerZ: 1, width: 6, depth: 18, count: 9, minScale: 1.3, maxScale: 2.1, seed: 59, field }),
      ...createForestPatch({ centerX: -halfW - 6, centerZ: halfD + 7, width: 10, depth: 9, count: 9, minScale: 1.3, maxScale: 2.1, seed: 61, field }),
      ...createForestPatch({ centerX: halfW + 6, centerZ: halfD + 7, width: 10, depth: 9, count: 9, minScale: 1.3, maxScale: 2.1, seed: 67, field }),
    ];
    addForest(regionRoot, resources, forest);
    return;
  }

  if (region.terrain === 'terrace') {
    // 主田后方布置四级退台，每级都留出独立水面和挡土墙，避免山体压住田面。
    for (let index = 0; index < 4; index += 1) {
      const shelfWidth = region.totalWidthM + 8 - index * 3.2;
      const shelfDepth = 3.25 + (index % 2) * 0.55;
      const shelfY = 0.55 + index * 0.92;
      const shelfZ = -halfD - 4.8 - index * 5.35;
      const segmentCount = index % 2 === 0 ? 3 : 4;
      const gap = 0.55;
      const segmentWidth = (shelfWidth - gap * (segmentCount - 1)) / segmentCount;
      for (let segment = 0; segment < segmentCount; segment += 1) {
        const x = -shelfWidth / 2 + segmentWidth / 2 + segment * (segmentWidth + gap) + Math.sin(index * 2.7 + segment * 1.3) * 0.35;
        const z = shelfZ + Math.cos(index * 1.9 + segment * 1.7) * 0.32;
        const y = shelfY + Math.sin(segment * 1.4 + index) * 0.06;
        addTerrainMesh(regionRoot, box, terraceEarth, { x, y, z }, { x: segmentWidth, y: 0.34, z: shelfDepth });
        addTerrainMesh(regionRoot, box, bank, { x, y: y - 0.48, z: z + shelfDepth / 2 + 0.16 }, { x: segmentWidth, y: 1.05, z: 0.32 });
        addTerrainMesh(regionRoot, box, water, { x, y: y + 0.2, z: z - 0.12 }, { x: segmentWidth - 0.8, y: 0.04, z: shelfDepth - 1.35 });
      }
    }
    for (const side of [-1, 1]) {
      for (let index = 0; index < 3; index += 1) {
        const shelfWidth = 2.8;
        const shelfDepth = 8.6 - index * 1.15;
        const shelfY = 0.6 + index * 0.78;
        const shelfX = side * (halfW + 3.9 + index * 3.15);
        const shelfZ = -1.1 + index * 1.45;
        addTerrainMesh(regionRoot, box, terraceEarth, { x: shelfX, y: shelfY, z: shelfZ }, { x: shelfWidth, y: 0.32, z: shelfDepth });
        addTerrainMesh(regionRoot, box, bank, { x: shelfX - side * (shelfWidth / 2 + 0.16), y: shelfY - 0.42, z: shelfZ }, { x: 0.34, y: 1.0, z: shelfDepth });
        addTerrainMesh(regionRoot, box, water, { x: shelfX, y: shelfY + 0.2, z: shelfZ }, { x: shelfWidth - 0.65, y: 0.04, z: shelfDepth - 0.8 });
      }
    }
    for (let step = 0; step < 5; step += 1) {
      addTerrainMesh(regionRoot, box, bank, { x: -halfW - 2.3 - step * 1.1, y: 0.16 + step * 0.27, z: -2.8 }, { x: 1.05, y: 0.34, z: 1.3 });
    }
    addTerrainMesh(regionRoot, box, bank, { x: 0, y: 0.2, z: halfD + 2.4 }, { x: region.totalWidthM + 9, y: 1.2, z: 1.5 });
    addMountainMassif(regionRoot, resources, 0, -halfD - 43, 42, 26, 17, 5);
    addMountainMassif(regionRoot, resources, -halfW - 30, -halfD - 16, 27, 22, 12, 9);
    addMountainMassif(regionRoot, resources, halfW + 31, -halfD - 17, 28, 23, 13, 15);
    const forest = [
      ...createForestPatch({ centerX: -halfW - 10, centerZ: -halfD - 12, width: 10, depth: 28, count: 30, minScale: 1.55, maxScale: 2.8, seed: 71, field }),
      ...createForestPatch({ centerX: halfW + 10, centerZ: -halfD - 12, width: 10, depth: 28, count: 30, minScale: 1.55, maxScale: 2.8, seed: 79, field }),
      ...createForestPatch({ centerX: 0, centerZ: -halfD - 27, width: halfW * 2 + 26, depth: 15, count: 38, minScale: 1.45, maxScale: 2.55, seed: 83, field }),
      ...createForestPatch({ centerX: -halfW - 18, centerZ: -halfD - 2, width: 8, depth: 14, count: 14, minScale: 1.35, maxScale: 2.35, seed: 89, field }),
      ...createForestPatch({ centerX: halfW + 18, centerZ: -halfD - 2, width: 8, depth: 14, count: 14, minScale: 1.35, maxScale: 2.35, seed: 97, field }),
      ...createForestPatch({ centerX: -halfW - 7, centerZ: halfD + 7, width: 10, depth: 10, count: 10, minScale: 1.4, maxScale: 2.4, seed: 103, field }),
      ...createForestPatch({ centerX: halfW + 7, centerZ: halfD + 7, width: 10, depth: 10, count: 10, minScale: 1.4, maxScale: 2.4, seed: 109, field }),
    ];
    addForest(regionRoot, resources, forest);
    return;
  }

  addTerrainMesh(regionRoot, box, water, { x: 0, y: -0.42, z: halfD + 4.6 }, { x: region.totalWidthM + 18, y: 0.16, z: 3.6 });
  addTerrainMesh(regionRoot, box, bank, { x: 0, y: -0.05, z: halfD + 2.55 }, { x: region.totalWidthM + 18, y: 0.75, z: 0.6 });
  addMountainMassif(regionRoot, resources, 0, -halfD - 14, 38, 18, 8, 6);
  addMountainMassif(regionRoot, resources, -halfW - 17, -halfD - 7, 20, 16, 6, 10);
  addMountainMassif(regionRoot, resources, halfW + 18, -halfD - 9, 21, 17, 6.5, 14);
  const forest = [
    ...createForestPatch({ centerX: 0, centerZ: -halfD - 8.2, width: halfW * 2 + 20, depth: 9, count: 30, minScale: 1.4, maxScale: 2.55, seed: 101, field }),
    ...createForestPatch({ centerX: -halfW - 9, centerZ: -halfD - 1, width: 7, depth: 18, count: 12, minScale: 1.3, maxScale: 2.25, seed: 107, field }),
    ...createForestPatch({ centerX: halfW + 9, centerZ: -halfD - 1, width: 7, depth: 18, count: 12, minScale: 1.3, maxScale: 2.25, seed: 113, field }),
    ...createForestPatch({ centerX: -halfW - 7, centerZ: halfD + 7, width: 11, depth: 9, count: 11, minScale: 1.35, maxScale: 2.25, seed: 127, field }),
    ...createForestPatch({ centerX: halfW + 7, centerZ: halfD + 7, width: 11, depth: 9, count: 11, minScale: 1.35, maxScale: 2.25, seed: 131, field }),
  ];
  addForest(regionRoot, resources, forest);
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

export function createPaddyFieldScene(
  plotStates = {},
  componentManager = null,
  regionOrRegions = PLAIN_REGION_CONFIG,
  options = {}
) {
  const regions = Array.isArray(regionOrRegions) ? regionOrRegions : [regionOrRegions];
  const previewMode = Boolean(options.previewMode);
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
  let riceBatches;
  if (previewMode) {
    const previewRoot = new THREE.Group();
    previewRoot.name = 'RicePreviewPlaceholder';
    riceBatches = {
      root: previewRoot,
      update() {},
      setGlobalInstanceLimit() {},
      dispose() { previewRoot.clear(); },
    };
  } else {
    riceBatches = createRiceInstanceBatches(plotStates, regions);
    const totalPlotCount = regions.reduce((total, region) => total + region.cells.length, 0);
    riceBatches.setGlobalInstanceLimit(totalPlotCount * PLANTS_PER_PLOT);
  }
  let simulationAccumulator = 0;
  let elapsedSeconds = 0;

  regions.forEach((region) => {
    buildRegion(root, region, plotStates, registry, pickables, resources, previewMode);
  });
  root.add(riceBatches.root);

  // P9: 大田外围草地底板 —— 带纹理的草绿平面（同时作为全局设备的拾取面）
  // 位于田块下方（y=-0.62），不会遮挡任何稻田
  const worldBounds = regions.flatMap((region) => region.cells.map((cell) => ({
    minX: region.originXZ.x + cell.centerXZ.x - cell.widthM / 2,
    maxX: region.originXZ.x + cell.centerXZ.x + cell.widthM / 2,
    minZ: region.originXZ.z + cell.centerXZ.z - cell.depthM / 2,
    maxZ: region.originXZ.z + cell.centerXZ.z + cell.depthM / 2,
  })));
  const minX = worldBounds.length ? Math.min(...worldBounds.map((item) => item.minX)) : 0;
  const maxX = worldBounds.length ? Math.max(...worldBounds.map((item) => item.maxX)) : 80;
  const minZ = worldBounds.length ? Math.min(...worldBounds.map((item) => item.minZ)) : -20;
  const maxZ = worldBounds.length ? Math.max(...worldBounds.map((item) => item.maxZ)) : 20;
  const groundGeometry = new THREE.PlaneGeometry(
    Math.max(130, maxX - minX + 74),
    Math.max(82, maxZ - minZ + 54)
  );
  groundGeometry.rotateX(-Math.PI / 2);
  const groundTexture = createGrassTexture();
  const groundMaterial = new THREE.MeshLambertMaterial({ map: groundTexture });
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.name = "GlobalGround";
  groundMesh.position.set(
    (minX + maxX) / 2,
    -0.62,
    (minZ + maxZ) / 2
  );
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
    previewMode,
    regionConfig: regions[0] || null,
    regionConfigs: regions,
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

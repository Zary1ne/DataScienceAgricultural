import * as THREE from "three";
import { COMPONENT_TYPES } from "./farmComponentRates.js";
import { GLOBAL_PLOT_ID } from "./farmComponents.js";

// P4 性能优化：全组件材质从 MeshStandardMaterial(PBR) → MeshLambertMaterial(漫反射)
// MeshStandardMaterial 的片元着色器复杂度是 Lambert 的 3-5 倍
function addMesh(parent, geometry, color, position, options = {}) {
  // 默认 Lambert：快、够好看
  const materialOptions = { color };
  if (options.transparent) materialOptions.transparent = true;
  if (options.opacity != null) materialOptions.opacity = options.opacity;
  if (options.side) materialOptions.side = options.side;
  if (options.emissive) materialOptions.emissive = new THREE.Color(options.emissive);
  if (options.emissiveIntensity) materialOptions.emissiveIntensity = options.emissiveIntensity;

  const material = options.basic
    ? new THREE.MeshBasicMaterial(materialOptions)
    : new THREE.MeshLambertMaterial(materialOptions);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position.x, position.y, position.z);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

function createIrrigationModel(group) {
  addMesh(
    group,
    new THREE.CylinderGeometry(0.1, 0.1, 0.78, 6),       // 8→6 面数降 25%
    0x54b8d0,
    { x: 0, y: 0.58, z: 0 }
  ).rotation.z = Math.PI / 2;
  addMesh(
    group,
    new THREE.CylinderGeometry(0.055, 0.07, 0.42, 6),
    0x6d8790,
    { x: 0, y: 0.22, z: 0 }
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.3, 0.16, 0.28),
    0x37a9c2,
    { x: 0.34, y: 0.58, z: 0 }
  );
  // P5: 喷水粒子系统（只有 irrigation 才有）
  group.userData.sprinkler = createSprinklerParticles();
  group.add(group.userData.sprinkler.points);
}

// P5: 灌溉喷水粒子 — 抛物线物理 + 朝向 plot 中心 + 边界检测
// ⚠️ sprinkler 在 createFarmComponentVisual 里创建时还不知道 placement
//    所以暴露 configure(placement, plotHalfSize) 延迟注入
function createSprinklerParticles() {
  const COUNT = 30;
  // 喷头在组件 group 的 local 坐标（未放大 3.5x 之前）
  const NOZZLE_LOCAL = new THREE.Vector3(0.39, 0.58, 0);
  const positions = new Float32Array(COUNT * 3);
  const velocities = new Float32Array(COUNT * 3);
  const lifetimes = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = NOZZLE_LOCAL.x;
    positions[i * 3 + 1] = NOZZLE_LOCAL.y;
    positions[i * 3 + 2] = NOZZLE_LOCAL.z;
    velocities[i * 3] = 0; velocities[i * 3 + 1] = 0; velocities[i * 3 + 2] = 0;
    lifetimes[i] = Math.random() * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0x87ceeb, size: 0.08, transparent: true, opacity: 0.65,
    depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.visible = false;
  points.frustumCulled = false;

  const sprinkler = {
    points, geometry, material,
    nozzleLocal: NOZZLE_LOCAL.clone(),
    velocities, lifetimes,
    // 延迟注入：syncComponents 调 configure() 传入 placement offset
    // placementOffset = 组件 group 在 plot group 里的 local 坐标（未放大）
    // plotHalfSize = 地块半宽（cellSizeM/2）= 5m
    configure(placementOffset, plotHalfSize = 5, rotationY = 0) {
      this.placementOffset = new THREE.Vector3(placementOffset.x, placementOffset.y ?? 0, placementOffset.z);
      this.plotHalfSize = plotHalfSize;
      this.rotationY = rotationY;
      this._cosR = Math.cos(-rotationY);
      this._sinR = Math.sin(-rotationY);
    },
    resetParticle(i) {
      // 1. 喷头 → plot 中心方向（plot local 坐标系）
      const pOx = this.placementOffset.x + this.nozzleLocal.x;
      const pOz = this.placementOffset.z + this.nozzleLocal.z;
      const dist = Math.hypot(pOx, pOz) || 1;
      let aimX = -pOx / dist;
      let aimZ = -pOz / dist;

      // 2. 扇形散开 ±25°
      const sa = (Math.random() - 0.5) * THREE.MathUtils.degToRad(50);
      const c = Math.cos(sa), sn = Math.sin(sa);
      const fX = aimX * c - aimZ * sn;
      const fZ = aimX * sn + aimZ * c;

      // 3. plot local → component local（反向旋转 rotationY）
      const lX = fX * this._cosR - fZ * this._sinR;
      const lZ = fX * this._sinR + fZ * this._cosR;

      // 4. 速度：仰角 20-35°，水平 1.4-2.0 m/s
      const hSpeed = 1.4 + Math.random() * 0.6;
      const vSpeed = 2.0 + Math.random() * 1.0;
      this.velocities[i * 3] = lX * hSpeed;
      this.velocities[i * 3 + 1] = vSpeed;
      this.velocities[i * 3 + 2] = lZ * hSpeed;
      this.lifetimes[i] = 1.0 + Math.random() * 1.0;
    },
    update(dt) {
      if (!this.placementOffset) { this.configure({ x: 0, z: 0 }); }
      const arr = this.geometry.attributes.position.array;
      const scale = SCALE;
      const cosR = Math.cos(this.rotationY);
      const sinR = Math.sin(this.rotationY);
      const gravity = 9.8 * dt * scale * 0.25;
      for (let i = 0; i < COUNT; i++) {
        const li = i * 3;
        this.lifetimes[i] -= dt;
        this.velocities[li + 1] -= gravity;
        arr[li] += this.velocities[li] * dt;
        arr[li + 1] += this.velocities[li + 1] * dt;
        arr[li + 2] += this.velocities[li + 2] * dt;
        // 边界检测：
        // placementOffset 已在 plot group 坐标系，不该乘 SCALE
        // 只有 component local (compX,compZ) 需要先旋转再乘 SCALE
        const compX = arr[li];
        const compZ = arr[li + 2];
        const pLX = this.placementOffset.x + (compX * cosR + compZ * sinR) * scale;
        const pLZ = this.placementOffset.z + (-compX * sinR + compZ * cosR) * scale;
        if (
          arr[li + 1] < 0 ||
          this.lifetimes[i] <= 0 ||
          Math.abs(pLX) > this.plotHalfSize ||
          Math.abs(pLZ) > this.plotHalfSize
        ) {
          arr[li] = this.nozzleLocal.x;
          arr[li + 1] = this.nozzleLocal.y;
          arr[li + 2] = this.nozzleLocal.z;
          this.resetParticle(i);
        }
      }
      this.geometry.attributes.position.needsUpdate = true;
    },
    dispose() { this.geometry.dispose(); this.material.dispose(); },
  };
  return sprinkler;
}

// 和 createFarmComponentVisual 里 group.scale.setScalar 保持一致
const SCALE = 3.5;

function createVentilationModel(group) {
  addMesh(group, new THREE.CylinderGeometry(0.075, 0.11, 0.78, 6), 0x798c8c, { x: 0, y: 0.39, z: 0 });
  addMesh(group, new THREE.BoxGeometry(0.52, 0.44, 0.2), 0x42a7a5, { x: 0, y: 0.92, z: 0 });
  const hub = addMesh(group, new THREE.CylinderGeometry(0.075, 0.075, 0.24, 6), 0xc4e4db, { x: 0, y: 0.92, z: 0.14 });
  hub.rotation.x = Math.PI / 2;
  for (let index = 0; index < 3; index += 1) {
    const blade = addMesh(group, new THREE.BoxGeometry(0.06, 0.28, 0.035), 0xd3e8df, { x: 0, y: 0.92, z: 0.28 });
    blade.rotation.z = (Math.PI * 2 * index) / 3;
  }
}

function createCo2SupplyModel(group) {
  addMesh(group, new THREE.CylinderGeometry(0.19, 0.19, 0.76, 8), 0x4c9f81, { x: 0, y: 0.48, z: 0 });
  addMesh(group, new THREE.CylinderGeometry(0.07, 0.09, 0.16, 6), 0xd5c98d, { x: 0, y: 0.94, z: 0 });
  addMesh(group, new THREE.BoxGeometry(0.24, 0.18, 0.1), 0x263c3a, { x: 0.19, y: 0.76, z: 0 });
}

// P9: 大田外围监控塔 —— 15m 细立杆 + 顶部云台球机 + 航标灯
// 独立建模，不复用田内短杆摄像头；所有尺寸为模型局部单位（整体再 ×3.5）
function createCameraTowerModel(group) {
  const BASE_HEIGHT = 0.16;
  const POLE_HEIGHT = 4.29;                       // 4.29 × 3.5 ≈ 15m
  const poleBottom = BASE_HEIGHT;
  const poleTop = BASE_HEIGHT + POLE_HEIGHT;

  // 混凝土基座
  addMesh(group, new THREE.CylinderGeometry(0.32, 0.38, BASE_HEIGHT, 12), 0x2f3a42, {
    x: 0, y: BASE_HEIGHT / 2, z: 0,
  });
  // 细长主立杆（下粗上细）
  addMesh(group, new THREE.CylinderGeometry(0.055, 0.085, POLE_HEIGHT, 8), 0x39444c, {
    x: 0, y: poleBottom + POLE_HEIGHT / 2, z: 0,
  });
  // 杆身加强环
  for (const ratio of [0.33, 0.66, 0.92]) {
    addMesh(group, new THREE.CylinderGeometry(0.075, 0.075, 0.03, 8), 0x4c5a63, {
      x: 0, y: poleBottom + POLE_HEIGHT * ratio, z: 0,
    });
  }
  // 顶部安装平台
  addMesh(group, new THREE.CylinderGeometry(0.17, 0.17, 0.035, 10), 0x4c5a63, {
    x: 0, y: poleTop, z: 0,
  });

  // 云台球机：白色球体 + 深色下球罩 + 镜头
  const ballY = poleTop + 0.17;
  addMesh(group, new THREE.SphereGeometry(0.16, 14, 10), 0xeef4f5, { x: 0, y: ballY, z: 0 });
  addMesh(
    group,
    new THREE.SphereGeometry(0.165, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    0x2c3d4a,
    { x: 0, y: ballY, z: 0 }
  );
  const lens = addMesh(
    group,
    new THREE.CylinderGeometry(0.062, 0.062, 0.11, 10),
    0x0e1f2a,
    { x: 0, y: ballY, z: -0.16 }
  );
  lens.rotation.x = Math.PI / 2;
  // 顶部红色航标灯 + 短天线
  addMesh(
    group,
    new THREE.SphereGeometry(0.045, 8, 6),
    0xff4b3e,
    { x: 0, y: ballY + 0.19, z: 0 },
    { basic: true }
  );
  addMesh(group, new THREE.CylinderGeometry(0.012, 0.02, 0.34, 6), 0x9aa7ae, {
    x: 0.12, y: ballY + 0.14, z: 0, 
  });

  // 巡检机位取球机中心（世界高度约 15m）
  group.userData.cameraHeadY = ballY;
}

function createCameraModel(group, options = {}) {
  // P9: 全局摄像头彻底独立建模，不复用田内短杆造型
  if (options.fieldWide) {
    createCameraTowerModel(group);
    return;
  }

  // 田内摄像头：原有短杆
  addMesh(group, new THREE.CylinderGeometry(0.045, 0.07, 1, 6), 0x798891, { x: 0, y: 0.5, z: 0 });
  addMesh(group, new THREE.CylinderGeometry(0.18, 0.2, 0.08, 8), 0x52636c, { x: 0, y: 0.06, z: 0 });
  addMesh(group, new THREE.BoxGeometry(0.42, 0.28, 0.34), 0xd4e1e2, { x: 0, y: 1.06, z: 0 });
  const lens = addMesh(group, new THREE.CylinderGeometry(0.09, 0.09, 0.12, 8), 0x253d52, {
    x: 0, y: 1.06, z: -0.22,
  });
  lens.rotation.x = Math.PI / 2;
  group.userData.cameraHeadY = 1.06;
}

function createPestLampModel(group) {
  // 底座（深色）
  addMesh(group, new THREE.CylinderGeometry(0.16, 0.2, 0.08, 8), 0x3f4550, { x: 0, y: 0.04, z: 0 });
  // 高杆：局部高 0.72 → 放大 3.5x 后约 2.5m，符合真实杀虫灯高度
  addMesh(group, new THREE.CylinderGeometry(0.035, 0.045, 0.72, 6), 0x5a616b, { x: 0, y: 0.44, z: 0 });
  // 三根横向支撑臂（撑起灯罩）
  for (let index = 0; index < 3; index += 1) {
    const arm = addMesh(group, new THREE.BoxGeometry(0.02, 0.02, 0.32), 0x4b535e, { x: 0, y: 0.78, z: 0 });
    arm.rotation.y = (Math.PI * 2 * index) / 3;
  }
  // 伞状灯罩（下宽上窄的圆锥）
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.34, 0.16, 8),
    new THREE.MeshLambertMaterial({ color: 0x39414d })
  );
  cap.position.set(0, 0.87, 0);
  cap.castShadow = false;
  cap.receiveShadow = false;
  group.add(cap);
  // 悬挂的发光灯泡：MeshBasicMaterial 亮青色，跳过光照计算
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x67e8f9 })
  );
  bulb.position.set(0, 0.7, 0);
  bulb.name = "PestLampBulb";
  bulb.castShadow = false;
  bulb.receiveShadow = false;
  group.add(bulb);
  group.userData.pestLampBulb = bulb;
}

function createSunshadeModel(group) {
  // P15: 遮阳棚放大到约 9.2m 见方（局部 ±1.32 × 3.5），罩住整块 10×10m 子地块
  const HALF = 1.32;         // 局部半宽 → 实际约 ±4.62m
  const POST_HEIGHT = 0.63;  // → 实际约 2.2m，棚顶悬在水稻上方
  const POST_RADIUS = 0.03;  // → 约 10cm 粗的立柱
  const corners = [
    [-HALF, -HALF], [HALF, -HALF], [-HALF, HALF], [HALF, HALF],
  ];
  corners.forEach(([px, pz]) => {
    addMesh(
      group,
      new THREE.CylinderGeometry(POST_RADIUS, POST_RADIUS * 1.25, POST_HEIGHT, 6),
      0x4d5763,
      { x: px, y: POST_HEIGHT / 2, z: pz }
    );
  });
  // 四周横梁，避免棚顶看起来悬空
  const beamLength = HALF * 2;
  [
    { x: 0, z: -HALF, rotY: 0 },
    { x: 0, z: HALF, rotY: 0 },
    { x: -HALF, z: 0, rotY: Math.PI / 2 },
    { x: HALF, z: 0, rotY: Math.PI / 2 },
  ].forEach(({ x, z, rotY }) => {
    const beam = addMesh(
      group,
      new THREE.BoxGeometry(beamLength, 0.035, 0.035),
      0x4d5763,
      { x, y: POST_HEIGHT, z }
    );
    beam.rotation.y = rotY;
  });
  // 半透明深黑棚顶（覆盖整格水稻；opacity 降到 0.4 控制大面积半透明 overdraw）
  const canopy = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2, HALF * 2),
    new THREE.MeshBasicMaterial({
      color: 0x0b1220,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,     // 防止半透明面遮挡下方水稻
    })
  );
  canopy.rotation.x = -Math.PI / 2;
  canopy.position.set(0, POST_HEIGHT, 0);
  canopy.castShadow = false;
  canopy.receiveShadow = false;
  // 保留自身材质状态，不被通用 enabled 逻辑改成不透明
  canopy.userData.keepMaterialState = true;
  group.add(canopy);
  group.userData.canopy = canopy;
}

// P13: 大田外围集中供暖站 —— 集装箱机房 + 三台大型散热风扇 + 粗管道 + 橙红指示灯
// 尺寸约为田内小控制箱的 6 倍（整体再 ×3.5 → 约 7.4m 长、3.7m 高）
function createCentralHeatingPlant(group) {
  const BODY = 0x3c4f5c;
  const TRIM = 0x2b3942;
  const PIPE = 0x67787f;

  // 设备底座
  addMesh(group, new THREE.BoxGeometry(2.2, 0.14, 1.5), 0x27323a, { x: 0, y: 0.07, z: 0 });
  // 集装箱式主机房
  addMesh(group, new THREE.BoxGeometry(2.1, 1.05, 1.4), BODY, { x: 0, y: 0.665, z: 0 });
  // 顶盖
  addMesh(group, new THREE.BoxGeometry(2.2, 0.08, 1.5), TRIM, { x: 0, y: 1.23, z: 0 });
  // 正面检修门 + 散热百叶
  addMesh(group, new THREE.BoxGeometry(0.78, 0.78, 0.04), 0x33434e, { x: -0.55, y: 0.63, z: -0.71 });
  for (let i = 0; i < 3; i += 1) {
    addMesh(group, new THREE.BoxGeometry(0.62, 0.05, 0.03), 0x22303a, {
      x: -0.55, y: 0.9 - i * 0.14, z: -0.735,
    });
  }

  // 顶部三台大直径散热风扇
  group.userData.heaterTubes = [];
  [-0.62, 0, 0.62].forEach((px) => {
    addMesh(group, new THREE.CylinderGeometry(0.34, 0.34, 0.1, 16), 0x1d2830, { x: px, y: 1.32, z: 0 });
    const ring = addMesh(group, new THREE.TorusGeometry(0.34, 0.025, 6, 18), 0x82939b, {
      x: px, y: 1.38, z: 0,
    });
    ring.rotation.x = Math.PI / 2;
    for (let b = 0; b < 4; b += 1) {
      const blade = addMesh(group, new THREE.BoxGeometry(0.5, 0.02, 0.09), 0x384852, {
        x: px, y: 1.38, z: 0,
      });
      blade.rotation.y = Math.PI / 4 + b * (Math.PI / 2);
    }
    // 风扇中心热轴（随开关状态变色的发光件）
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.16, 10),
      new THREE.MeshBasicMaterial({ color: 0xff6a3d })
    );
    hub.position.set(px, 1.4, 0);
    hub.castShadow = false;
    hub.receiveShadow = false;
    group.add(hub);
    group.userData.heaterTubes.push(hub);
  });

  // 侧面两根粗管道（立管 + 接入机身的横管 + 法兰底座）
  [-0.42, 0.42].forEach((pz) => {
    addMesh(group, new THREE.CylinderGeometry(0.11, 0.11, 0.9, 10), PIPE, { x: 1.2, y: 0.45, z: pz });
    addMesh(group, new THREE.BoxGeometry(0.35, 0.2, 0.2), PIPE, { x: 1.03, y: 0.82, z: pz });
    addMesh(group, new THREE.CylinderGeometry(0.13, 0.13, 0.08, 10), 0x4a5961, { x: 1.2, y: 0.02, z: pz });
  });
  // 排烟管
  addMesh(group, new THREE.CylinderGeometry(0.09, 0.11, 0.6, 8), 0x2c3942, { x: -0.85, y: 1.55, z: 0.45 });

  // 状态指示灯 + 侧面发光条
  const indicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff8a5c })
  );
  indicator.position.set(0.55, 1.12, -0.72);
  indicator.name = "HeaterIndicator";
  group.add(indicator);
  group.userData.heaterIndicator = indicator;
  addMesh(
    group,
    new THREE.BoxGeometry(1.3, 0.05, 0.02),
    0xff6a3d,
    { x: 0.15, y: 1.15, z: -0.715 },
    { basic: true }
  );
}

// P6: 智能增温器 — 田内为金属控制箱；全局为大田外围集中供暖站
function createHeaterModel(group, options = {}) {
  // P13: 全局放置 → 大型集中供暖机组
  if (options.fieldWide) {
    createCentralHeatingPlant(group);
    return;
  }
  // 金属控制箱
  addMesh(group, new THREE.BoxGeometry(0.34, 0.22, 0.26), 0x9aa3ad, { x: 0, y: 0.11, z: 0 });
  addMesh(group, new THREE.BoxGeometry(0.36, 0.03, 0.28), 0x6f7883, { x: 0, y: 0.235, z: 0 });
  // 两根竖向加热管（MeshBasicMaterial 微红，直接发热观感）
  group.userData.heaterTubes = [];
  [-0.09, 0.09].forEach((px) => {
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.34, 8),
      new THREE.MeshBasicMaterial({ color: 0xff5a3c })
    );
    tube.position.set(px, 0.4, 0);
    tube.name = "HeaterTube";
    tube.castShadow = false;
    tube.receiveShadow = false;
    group.add(tube);
    group.userData.heaterTubes.push(tube);
  });
  // 指示灯
  const indicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff8a5c })
  );
  indicator.position.set(0.13, 0.14, 0.14);
  indicator.name = "HeaterIndicator";
  group.add(indicator);
  group.userData.heaterIndicator = indicator;
}

// P15: 智能排水泵 — 方形控制箱 + 两根 L 型排水管，开启时管口有蓝色水流
function createDrainageModel(group) {
  const PIPE = 0x4e6b7c;
  const DARK_PIPE = 0x2f3f48;
  // 方形底座控制箱
  addMesh(group, new THREE.BoxGeometry(0.44, 0.26, 0.36), 0x4c6a7a, { x: 0, y: 0.13, z: 0 });
  addMesh(group, new THREE.BoxGeometry(0.48, 0.04, 0.4), 0x33454f, { x: 0, y: 0.28, z: 0 });
  // 控制面板 + 散热格栅
  addMesh(group, new THREE.BoxGeometry(0.2, 0.12, 0.02), 0x22323b, { x: -0.06, y: 0.16, z: -0.19 });
  addMesh(group, new THREE.BoxGeometry(0.14, 0.02, 0.01), 0x86d7ff, { x: -0.06, y: 0.18, z: -0.2 }, { basic: true });

  // 两根 L 型排水管：立管 → 横向弯头 → 向下的排水口
  const jets = [];
  [-1, 1].forEach((side) => {
    addMesh(
      group,
      new THREE.CylinderGeometry(0.05, 0.05, 0.36, 8),
      PIPE,
      { x: side * 0.3, y: 0.2, z: 0.08 }
    );
    // 弯头
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshLambertMaterial({ color: DARK_PIPE }));
    elbow.position.set(side * 0.3, 0.38, 0.08);
    group.add(elbow);
    // 横向排水臂
    const arm = addMesh(
      group,
      new THREE.CylinderGeometry(0.045, 0.045, 0.32, 8),
      PIPE,
      { x: side * 0.46, y: 0.38, z: 0.08 }
    );
    arm.rotation.z = Math.PI / 2;
    // 向下的排水口
    addMesh(
      group,
      new THREE.CylinderGeometry(0.045, 0.055, 0.18, 8),
      DARK_PIPE,
      { x: side * 0.62, y: 0.29, z: 0.08 }
    );
    // 蓝色水流（仅开启时可见）
    const jet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.05, 0.2, 8),
      new THREE.MeshBasicMaterial({
        color: 0x5cc8ff,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
      })
    );
    jet.position.set(side * 0.62, 0.13, 0.08);
    jet.visible = false;
    jet.userData.keepMaterialState = true;
    group.add(jet);
    jets.push(jet);
  });
  group.userData.drainageJets = jets;

  // 状态指示灯（开启时变绿）
  const indicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.026, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x6b7c86 })
  );
  indicator.position.set(0.14, 0.22, -0.19);
  group.add(indicator);
  group.userData.drainageIndicator = indicator;
}

// P16: 排涝泵站 — 大田外围的总排渠泵站（混凝土基座 + 泵房 + 双出水管 + 排水瀑布）
// 整体 ×3.5 后约 9m 宽，与集中供暖站同级；只在大田外围（global）布置
function createDrainageStationModel(group) {
  const BODY = 0x3f5d6b;
  const TRIM = 0x2c3e48;
  const PIPE = 0x5d7d8d;

  // 混凝土基座
  addMesh(group, new THREE.BoxGeometry(2.6, 0.14, 1.8), 0x8d99a3, { x: 0, y: 0.07, z: 0 });
  // 泵房主体
  addMesh(group, new THREE.BoxGeometry(2.2, 0.95, 1.45), BODY, { x: 0, y: 0.62, z: 0 });
  // 顶盖
  addMesh(group, new THREE.BoxGeometry(2.35, 0.08, 1.6), TRIM, { x: 0, y: 1.135, z: 0 });
  // 正面检修门 + 通风格栅
  addMesh(group, new THREE.BoxGeometry(0.7, 0.7, 0.04), 0x35505c, { x: -0.6, y: 0.6, z: -0.735 });
  for (let i = 0; i < 3; i += 1) {
    addMesh(group, new THREE.BoxGeometry(0.58, 0.04, 0.03), 0x22343d, {
      x: -0.6, y: 0.85 - i * 0.13, z: -0.758,
    });
  }
  // 控制柜与蓝色液位屏
  addMesh(group, new THREE.BoxGeometry(0.28, 0.5, 0.18), 0x243842, { x: 0.85, y: 0.39, z: -0.78 });
  addMesh(group, new THREE.BoxGeometry(0.18, 0.1, 0.02), 0x62c6ff, { x: 0.85, y: 0.52, z: -0.875 }, { basic: true });

  // 屋顶散热风机
  addMesh(group, new THREE.CylinderGeometry(0.24, 0.24, 0.08, 14), 0x1d2830, { x: 0.55, y: 1.19, z: 0 });
  const ring = addMesh(group, new THREE.TorusGeometry(0.24, 0.02, 6, 16), 0x82939b, { x: 0.55, y: 1.23, z: 0 });
  ring.rotation.x = Math.PI / 2;

  // 两根进水管（伸向田块一侧，-X）
  [-0.42, 0.42].forEach((pz) => {
    const intake = addMesh(
      group,
      new THREE.CylinderGeometry(0.11, 0.11, 0.62, 8),
      PIPE,
      { x: -1.28, y: 0.32, z: pz }
    );
    intake.rotation.z = Math.PI / 2;
    addMesh(group, new THREE.CylinderGeometry(0.13, 0.13, 0.06, 10), 0x4a5961, {
      x: -1.56, y: 0.32, z: pz,
    }).rotation.z = Math.PI / 2;
  });

  // 两根大出水管（+X 排向排渠）+ 排水瀑布
  const jets = [];
  [-0.42, 0.42].forEach((pz) => {
    const outlet = addMesh(
      group,
      new THREE.CylinderGeometry(0.15, 0.15, 0.9, 10),
      PIPE,
      { x: 1.5, y: 0.55, z: pz }
    );
    outlet.rotation.z = Math.PI / 2;
    // 弯头朝下
    const elbow = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshLambertMaterial({ color: TRIM })
    );
    elbow.position.set(1.95, 0.55, pz);
    group.add(elbow);
    addMesh(group, new THREE.CylinderGeometry(0.15, 0.15, 0.42, 10), TRIM, { x: 1.95, y: 0.35, z: pz });

    // 蓝色排水瀑布（仅开启时可见）
    const jet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.05, 0.36, 10),
      new THREE.MeshBasicMaterial({
        color: 0x5cc8ff,
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
      })
    );
    jet.position.set(1.95, 0.06, pz);
    jet.visible = false;
    jet.userData.keepMaterialState = true;
    group.add(jet);
    jets.push(jet);
  });
  group.userData.drainageJets = jets;

  // 顶部警示灯（开启时变绿）
  const indicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x6b7c86 })
  );
  indicator.position.set(-0.85, 1.25, 0);
  group.add(indicator);
  group.userData.drainageIndicator = indicator;
}

// 全局灌溉站 — 大田外围的集中供水泵房、储水罐、双路供水管和喷流
function createIrrigationStationModel(group) {
  const BODY = 0x2f7180;
  const TRIM = 0x244b57;
  const PIPE = 0x5f9bab;
  const WATER = 0x55d7ff;

  addMesh(group, new THREE.BoxGeometry(2.6, 0.14, 1.8), 0x8d99a3, { x: 0, y: 0.07, z: 0 });
  addMesh(group, new THREE.BoxGeometry(1.2, 0.94, 1.4), BODY, { x: 0.58, y: 0.61, z: 0 });
  addMesh(group, new THREE.BoxGeometry(1.32, 0.08, 1.52), TRIM, { x: 0.58, y: 1.12, z: 0 });

  // 储水罐与加固环
  addMesh(group, new THREE.CylinderGeometry(0.56, 0.56, 1.28, 12), BODY, { x: -0.58, y: 0.78, z: 0 });
  addMesh(group, new THREE.CylinderGeometry(0.6, 0.6, 0.08, 12), TRIM, { x: -0.58, y: 1.45, z: 0 });
  [0.42, 0.82, 1.16].forEach((y) => {
    const band = addMesh(group, new THREE.TorusGeometry(0.57, 0.018, 5, 14), TRIM, {
      x: -0.58, y, z: 0,
    });
    band.rotation.x = Math.PI / 2;
  });

  // 检修门、控制柜和供水压力屏
  addMesh(group, new THREE.BoxGeometry(0.48, 0.66, 0.04), 0x315f6a, { x: 0.52, y: 0.6, z: -0.725 });
  addMesh(group, new THREE.BoxGeometry(0.26, 0.48, 0.16), 0x18343d, { x: 0.98, y: 0.38, z: -0.76 });
  addMesh(group, new THREE.BoxGeometry(0.18, 0.09, 0.02), WATER, { x: 0.98, y: 0.5, z: -0.845 }, { basic: true });

  // 两路供水管伸向田块一侧，并配置可见喷流
  const jets = [];
  [-0.42, 0.42].forEach((pz) => {
    const supply = addMesh(
      group,
      new THREE.CylinderGeometry(0.13, 0.13, 0.94, 9),
      PIPE,
      { x: -1.42, y: 0.5, z: pz }
    );
    supply.rotation.z = Math.PI / 2;
    addMesh(group, new THREE.SphereGeometry(0.15, 9, 7), TRIM, { x: -1.9, y: 0.5, z: pz });
    addMesh(group, new THREE.CylinderGeometry(0.13, 0.09, 0.34, 9), TRIM, { x: -1.9, y: 0.33, z: pz });

    const jet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.035, 0.42, 9),
      new THREE.MeshBasicMaterial({
        color: WATER,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      })
    );
    jet.position.set(-1.9, 0.12, pz);
    jet.visible = false;
    jet.userData.keepMaterialState = true;
    group.add(jet);
    jets.push(jet);
  });
  group.userData.irrigationJets = jets;

  const indicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x6b7c86 })
  );
  indicator.position.set(-0.58, 1.54, 0);
  group.add(indicator);
  group.userData.irrigationIndicator = indicator;
}

function createHumidifierMist(color = 0x9be8ff) {
  const mist = [];
  for (let index = 0; index < 4; index += 1) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.08 + index * 0.018, 8, 6),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.2 - index * 0.025,
        depthWrite: false,
      })
    );
    puff.position.set(0, 0.72 + index * 0.1, 0);
    puff.visible = false;
    puff.userData.keepMaterialState = true;
    group.add(puff);
    mist.push(puff);
  }
  return mist;
}

function createHumidifierModel(group) {
  addMesh(group, new THREE.BoxGeometry(0.58, 0.08, 0.46), 0x71818b, { x: 0, y: 0.04, z: 0 });
  addMesh(group, new THREE.CylinderGeometry(0.18, 0.2, 0.42, 10), 0x3f8796, { x: 0, y: 0.27, z: 0 });
  addMesh(group, new THREE.CylinderGeometry(0.08, 0.08, 0.24, 8), 0x8fc8d7, { x: 0, y: 0.58, z: 0 });
  addMesh(group, new THREE.BoxGeometry(0.34, 0.13, 0.28), 0x56aebe, { x: 0, y: 0.67, z: 0 });
  addMesh(group, new THREE.CylinderGeometry(0.045, 0.06, 0.16, 8), 0x7bd7ef, { x: 0, y: 0.8, z: 0 });
  group.userData.humidifierMist = createHumidifierMist();
  const indicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x6b7c86 })
  );
  indicator.position.set(0.13, 0.72, -0.13);
  group.add(indicator);
  group.userData.humidifierIndicator = indicator;
}

function createHumidifierStationModel(group) {
  addMesh(group, new THREE.BoxGeometry(2.4, 0.14, 1.7), 0x8d99a3, { x: 0, y: 0.07, z: 0 });
  addMesh(group, new THREE.CylinderGeometry(0.72, 0.72, 1.25, 12), 0x3f7f8e, { x: -0.45, y: 0.76, z: 0 });
  addMesh(group, new THREE.CylinderGeometry(0.76, 0.76, 0.08, 12), 0x244b57, { x: -0.45, y: 1.42, z: 0 });
  addMesh(group, new THREE.BoxGeometry(1.05, 0.88, 1.28), 0x2f7180, { x: 0.62, y: 0.58, z: 0 });
  addMesh(group, new THREE.BoxGeometry(0.24, 0.44, 0.16), 0x18343d, { x: 1.1, y: 0.4, z: -0.7 });
  addMesh(group, new THREE.BoxGeometry(0.16, 0.08, 0.02), 0x9be8ff, { x: 1.1, y: 0.51, z: -0.79 }, { basic: true });

  const mist = [];
  [-0.62, 0, 0.62].forEach((x, index) => {
    addMesh(group, new THREE.CylinderGeometry(0.07, 0.1, 0.3, 8), 0x7bd7ef, {
      x, y: 0.75, z: -0.72,
    });
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.2 + index * 0.03, 9, 7),
      new THREE.MeshBasicMaterial({
        color: 0x9be8ff,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      })
    );
    puff.position.set(x, 0.92, -0.86);
    puff.visible = false;
    puff.userData.keepMaterialState = true;
    group.add(puff);
    mist.push(puff);
  });
  group.userData.humidifierMist = mist;

  const indicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x6b7c86 })
  );
  indicator.position.set(-0.45, 1.52, 0);
  group.add(indicator);
  group.userData.humidifierIndicator = indicator;
}

function createGrowLightModel(group) {
  addMesh(group, new THREE.CylinderGeometry(0.18, 0.22, 0.08, 10), 0x39444f, { x: 0, y: 0.04, z: 0 });
  addMesh(group, new THREE.CylinderGeometry(0.045, 0.055, 0.86, 8), 0x667985, { x: 0, y: 0.47, z: 0 });
  addMesh(group, new THREE.BoxGeometry(0.42, 0.12, 0.24), 0x35434d, { x: 0, y: 0.93, z: 0 });
  const glow = addMesh(group, new THREE.BoxGeometry(0.36, 0.025, 0.18), 0xffe9a3, {
    x: 0, y: 0.85, z: 0,
  }, { basic: true });
  glow.userData.keepMaterialState = true;
  group.userData.growLightGlows = [glow];
  const indicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x6b7c86 })
  );
  indicator.position.set(0.14, 0.72, -0.12);
  group.add(indicator);
  group.userData.growLightIndicator = indicator;
}

function createGrowLightStationModel(group) {
  addMesh(group, new THREE.BoxGeometry(2.5, 0.14, 1.7), 0x8d99a3, { x: 0, y: 0.07, z: 0 });
  addMesh(group, new THREE.BoxGeometry(2.25, 0.14, 1.3), 0x35434d, { x: 0, y: 1.35, z: 0 });
  [-0.82, 0, 0.82].forEach((x) => {
    addMesh(group, new THREE.CylinderGeometry(0.05, 0.05, 1.22, 8), 0x667985, { x, y: 0.72, z: 0 });
  });
  const glows = [-0.82, 0, 0.82].map((x) => {
    const glow = addMesh(group, new THREE.BoxGeometry(0.62, 0.03, 0.24), 0xffedb0, {
      x, y: 1.25, z: 0,
    }, { basic: true });
    glow.userData.keepMaterialState = true;
    return glow;
  });
  group.userData.growLightGlows = glows;
  const indicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x6b7c86 })
  );
  indicator.position.set(0, 1.57, 0);
  group.add(indicator);
  group.userData.growLightIndicator = indicator;
}

function createDehumidifierFan(radius, position) {
  const fan = new THREE.Group();
  fan.position.set(position.x, position.y, position.z);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, 0.08, 8),
    new THREE.MeshLambertMaterial({ color: 0x8fb9c4 })
  );
  hub.rotation.x = Math.PI / 2;
  fan.add(hub);
  for (let index = 0; index < 3; index += 1) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.14, radius * 0.9, 0.02),
      new THREE.MeshLambertMaterial({ color: 0xb8dce2 })
    );
    blade.position.y = radius * 0.38;
    blade.rotation.z = (Math.PI * 2 * index) / 3;
    fan.add(blade);
  }
  return fan;
}

function createDehumidifierModel(group) {
  addMesh(group, new THREE.BoxGeometry(0.62, 0.62, 0.46), 0x3d6d76, { x: 0, y: 0.34, z: 0 });
  addMesh(group, new THREE.CylinderGeometry(0.2, 0.2, 0.04, 12), 0x213d45, { x: 0, y: 0.38, z: -0.25 })
    .rotation.x = Math.PI / 2;
  const fan = createDehumidifierFan(0.17, { x: 0, y: 0.38, z: -0.28 });
  group.add(fan);
  group.userData.dehumidifierFan = fan;
  addMesh(group, new THREE.BoxGeometry(0.18, 0.08, 0.02), 0x9be8ff, { x: 0, y: 0.58, z: -0.245 }, { basic: true });
  const indicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x6b7c86 })
  );
  indicator.position.set(0.2, 0.62, -0.2);
  group.add(indicator);
  group.userData.dehumidifierIndicator = indicator;
}

function createDehumidifierStationModel(group) {
  addMesh(group, new THREE.BoxGeometry(2.5, 0.14, 1.8), 0x8d99a3, { x: 0, y: 0.07, z: 0 });
  addMesh(group, new THREE.BoxGeometry(2.2, 1.2, 1.45), 0x315d67, { x: 0, y: 0.74, z: 0 });
  addMesh(group, new THREE.BoxGeometry(2.32, 0.08, 1.58), 0x203b43, { x: 0, y: 1.38, z: 0 });
  const fans = [-0.58, 0.58].map((x) => {
    const ring = addMesh(group, new THREE.TorusGeometry(0.36, 0.035, 6, 16), 0x91a4aa, { x, y: 0.76, z: -0.74 });
    ring.rotation.x = Math.PI / 2;
    const fan = createDehumidifierFan(0.31, { x, y: 0.76, z: -0.78 });
    group.add(fan);
    return fan;
  });
  group.userData.dehumidifierFan = fans;
  const indicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x6b7c86 })
  );
  indicator.position.set(0, 1.48, 0);
  group.add(indicator);
  group.userData.dehumidifierIndicator = indicator;
}

const MODEL_BUILDERS = Object.freeze({
  [COMPONENT_TYPES.IRRIGATION]: createIrrigationModel,
  [COMPONENT_TYPES.VENTILATION]: createVentilationModel,
  [COMPONENT_TYPES.CO2_SUPPLY]: createCo2SupplyModel,
  [COMPONENT_TYPES.CAMERA]: createCameraModel,
  [COMPONENT_TYPES.PEST_LAMP]: createPestLampModel,
  [COMPONENT_TYPES.SUNSHADE]: createSunshadeModel,
  [COMPONENT_TYPES.HEATER]: createHeaterModel,
  [COMPONENT_TYPES.DRAINAGE]: createDrainageModel,
  [COMPONENT_TYPES.DRAINAGE_STATION]: createDrainageStationModel,
  [COMPONENT_TYPES.IRRIGATION_STATION]: createIrrigationStationModel,
  [COMPONENT_TYPES.HUMIDIFIER]: createHumidifierModel,
  [COMPONENT_TYPES.HUMIDIFIER_STATION]: createHumidifierStationModel,
  [COMPONENT_TYPES.GROW_LIGHT]: createGrowLightModel,
  [COMPONENT_TYPES.GROW_LIGHT_STATION]: createGrowLightStationModel,
  [COMPONENT_TYPES.DEHUMIDIFIER]: createDehumidifierModel,
  [COMPONENT_TYPES.DEHUMIDIFIER_STATION]: createDehumidifierStationModel,
});

export function createFarmComponentVisual(component) {
  const builder = MODEL_BUILDERS[component.type];
  if (!builder) {
    throw new RangeError(`No visual model for component type: ${component.type}`);
  }
  const group = new THREE.Group();
  group.name = `FarmComponent_${component.type}_${component.id}`;
  group.userData.componentId = component.id;
  group.userData.componentType = component.type;
  builder(group, {
    // P7: 大田外围设备使用加高立杆造型
    fieldWide: component.plotId === GLOBAL_PLOT_ID,
  });
  // P5: 放大模型 3.5x — 远视角（相机距离 50m+）下也能一眼看到
  // 灌溉原管道 0.78m → 放大后 2.73m；遮阳网伞面 0.55m → 1.93m
  group.scale.setScalar(3.5);
  // 设置所有子 mesh 的 componentId（方便 raycaster 直接命中）
  group.traverse((obj) => {
    if (obj.isMesh) obj.userData.componentId = component.id;
  });
  setFarmComponentVisualEnabled(group, component.enabled);
  return group;
}

export function setFarmComponentVisualEnabled(group, enabled) {
  const on = Boolean(enabled);
  group.userData.enabled = on;
  // P5: 灌溉的喷水粒子 — enabled 时才显示
  if (group.userData.sprinkler) {
    group.userData.sprinkler.points.visible = on;
  }
  // P15: 排水泵水流 + 指示灯
  if (group.userData.drainageJets) {
    group.userData.drainageJets.forEach((jet) => {
      jet.visible = on;
    });
  }
  if (group.userData.drainageIndicator) {
    group.userData.drainageIndicator.material.color.setHex(on ? 0x54e08a : 0x6b7c86);
  }
  // 全局灌溉站供水喷流 + 指示灯
  if (group.userData.irrigationJets) {
    group.userData.irrigationJets.forEach((jet) => {
      jet.visible = on;
    });
  }
  if (group.userData.irrigationIndicator) {
    group.userData.irrigationIndicator.material.color.setHex(on ? 0x55d7ff : 0x6b7c86);
  }
  if (group.userData.humidifierMist) {
    group.userData.humidifierMist.forEach((puff) => {
      puff.visible = on;
    });
  }
  if (group.userData.humidifierIndicator) {
    group.userData.humidifierIndicator.material.color.setHex(on ? 0x9be8ff : 0x6b7c86);
  }
  if (group.userData.growLightGlows) {
    group.userData.growLightGlows.forEach((glow) => {
      glow.visible = on;
    });
  }
  if (group.userData.growLightIndicator) {
    group.userData.growLightIndicator.material.color.setHex(on ? 0xffe889 : 0x6b7c86);
  }
  if (group.userData.dehumidifierIndicator) {
    group.userData.dehumidifierIndicator.material.color.setHex(on ? 0x5ad6f0 : 0x6b7c86);
  }
  group.traverse((object) => {
    if (!object.isMesh) return;
    // 遮阳网棚顶等需要保留自身半透明状态，不参与通用 opacity 改写
    if (object.userData.keepMaterialState) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      material.transparent = !on ? true : (material.transparent ?? false);
      material.opacity = on ? (material.opacity === undefined ? 1 : Math.max(material.opacity, 0.7)) : 0.4;
      material.depthWrite = on;
    });
  });
}

export function disposeFarmComponentVisual(group) {
  const geometries = new Set();
  const materials = new Set();
  group.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => materials.add(material));
    } else if (object.material) {
      materials.add(object.material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

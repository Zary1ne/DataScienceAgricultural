// 通用环境与设备模型库；稻株不在此处生成，露天田块由 paddyFieldBuilder 负责
// 供 SceneViewer（浅色预览）等旧版通用场景使用
import * as THREE from "three";
import {
  grassTexture,
  soilTexture,
  gravelTexture,
  concreteTexture,
  metalTexture,
  solarTexture,
  woodTexture,
  seededRandom,
} from "./textures.js";

export const STATUS_COLORS = {
  normal: 0x34d399,
  warning: 0xff9f0a,
  danger: 0xff3b30,
};

export const REGION_VARIANTS = {
  plain: {
    name: "洞庭湖平原区",
    ground: 0x8dbf74,
    soil: 0x7a6858,
    water: 0x4bb5ff,
    accent: 0x9de0ff,
    description: "湖区平原，水网密布，排水与土壤保水是关键。",
  },
  hill: {
    name: "湘中丘陵区",
    ground: 0x789863,
    soil: 0x81715d,
    water: 0x59c6ff,
    accent: 0x99e8c1,
    description: "丘陵地势起伏明显，坡面汇水和排水效率决定病害风险。",
  },
  south: {
    name: "湘南丘陵区",
    ground: 0x78945e,
    soil: 0x7d6957,
    water: 0x53c5f5,
    accent: 0x9de5b0,
    description: "亚热带湿润气候，暴雨和高湿环境显著增加病害压力。",
  },
  mountain: {
    name: "湘西山区",
    ground: 0x586f59,
    soil: 0x76624d,
    water: 0x4fb9ff,
    accent: 0x8bcfc6,
    description: "山地小气候明显，梯田与低温阴雨是主要风险因素。",
  },
  east: {
    name: "湘东山地过渡带",
    ground: 0x657d63,
    soil: 0x786850,
    water: 0x53bdec,
    accent: 0xa2dfbd,
    description: "山地、丘陵与河谷交错，一季稻和双季稻并存。",
  },
};

function palette(theme, region = "plain") {
  const dark = theme !== "light";
  const regionConfig = REGION_VARIANTS[region] || REGION_VARIANTS.plain;
  return {
    dark,
    ground: regionConfig.ground,
    groundTex: dark ? 0x5a7a52 : 0x9dbb84,
    frame: dark ? 0x8ee6f2 : 0xe3e7ea,
    cover: dark ? 0x9fe8ff : 0xeaf7ff,
    coverOpacity: dark ? 0.16 : 0.2,
    pad: dark ? 0x8f9ba0 : 0xc7cbce,
    metal: dark ? 0x9fb4bb : 0xc2cad0,
    darkMetal: dark ? 0x2f444b : 0x5a6368,
    soil: regionConfig.soil,
    soilTop: dark ? 0x5a5142 : 0x6f5537,
    clay: dark ? 0x7d6248 : 0xa87b45,
    sand: dark ? 0x8a7d62 : 0xc3a16b,
    gravel: dark ? 0x5f6163 : 0x86898b,
    wood: dark ? 0x5a4a3a : 0x9a7448,
    door: dark ? 0x9fdfea : 0xf0f2f3,
    white: dark ? 0xd3e8f0 : 0xf2f4f6,
    water: regionConfig.water,
    tree: dark ? 0x2f7a4e : 0x4f8a3c,
    trunk: dark ? 0x453427 : 0x6b4a30,
  };
}

function makeMaterials(P) {
  const soilMap = soilTexture("#7b6450", 2, 9);
  return {
    frame: new THREE.MeshLambertMaterial({ color: P.frame, metalness: 0.6, roughness: 0.3 }),
    cover: new THREE.MeshLambertMaterial({
      color: P.cover,
      transparent: true,
      opacity: P.coverOpacity,
      roughness: 0.12,
      metalness: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    pad: new THREE.MeshLambertMaterial({ color: P.pad, map: concreteTexture(2), roughness: 0.9 }),
    concrete: new THREE.MeshLambertMaterial({ color: P.pad, map: concreteTexture(1), roughness: 0.95 }),
    metal: new THREE.MeshLambertMaterial({ color: P.metal, map: metalTexture(2), metalness: 0.7, roughness: 0.35 }),
    darkMetal: new THREE.MeshLambertMaterial({ color: P.darkMetal, metalness: 0.65, roughness: 0.4 }),
    soil: new THREE.MeshLambertMaterial({ color: P.soil, map: soilMap, roughness: 1 }),
    soilTop: new THREE.MeshLambertMaterial({ color: P.soilTop, map: soilTexture("#6f5537", 2, 13), roughness: 1 }),
    clay: new THREE.MeshLambertMaterial({ color: P.clay, map: soilTexture("#a87b45", 1, 17), roughness: 1 }),
    sand: new THREE.MeshLambertMaterial({ color: P.sand, map: soilTexture("#c3a16b", 1, 19), roughness: 1 }),
    gravel: new THREE.MeshLambertMaterial({ color: P.gravel, map: gravelTexture(1), roughness: 1 }),
    wood: new THREE.MeshLambertMaterial({ color: P.wood, map: woodTexture(1), roughness: 0.9 }),
    door: new THREE.MeshLambertMaterial({ color: P.door, metalness: 0.3, roughness: 0.5 }),
    white: new THREE.MeshLambertMaterial({ color: P.white, roughness: 0.55 }),
    solar: new THREE.MeshLambertMaterial({ map: solarTexture(1), metalness: 0.5, roughness: 0.22 }),
    lamp: new THREE.MeshLambertMaterial({ color: 0xfff2d0, emissive: 0xffcf8a, emissiveIntensity: 0.05, roughness: 0.4 }),
    water: new THREE.MeshLambertMaterial({ color: P.water, transparent: true, opacity: 0.7, roughness: 0.15, metalness: 0.1 }),
    trunk: new THREE.MeshLambertMaterial({ color: P.trunk, roughness: 1 }),
    leaf: new THREE.MeshLambertMaterial({ color: P.tree, roughness: 0.85, flatShading: true }),
  };
}

// —— 通用几何辅助 ——
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

// 两点之间生成圆柱（用于管道、拉杆、梯子、支腿）
function beam(parent, from, to, radius, mat, segments = 8) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const dir = end.clone().sub(start);
  const len = dir.length();
  if (len < 0.001) return null;
  const geo = new THREE.CylinderGeometry(radius, radius, len, segments);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(start).add(end).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = false;
  parent.add(m);
  return m;
}

// ============ 各类模型 ============

function buildField(P, mats, obj, rand) {
  const g = new THREE.Group();
  const W = 10;
  const D = 10;

  g.add(mesh(new THREE.BoxGeometry(W, 0.46, D), mats.soil, 0, 0.23, 0));

  // 木边框
  const bw = 0.16;
  g.add(mesh(new THREE.BoxGeometry(W + bw, 0.34, bw), mats.wood, 0, 0.4, D / 2));
  g.add(mesh(new THREE.BoxGeometry(W + bw, 0.34, bw), mats.wood, 0, 0.4, -D / 2));
  g.add(mesh(new THREE.BoxGeometry(bw, 0.34, D + bw), mats.wood, W / 2, 0.4, 0));
  g.add(mesh(new THREE.BoxGeometry(bw, 0.34, D + bw), mats.wood, -W / 2, 0.4, 0));

  // 灌溉支管（沿田块两侧）
  beam(g, [-W / 2 + 0.9, 0.55, -D / 2 + 0.7], [W / 2 - 0.9, 0.55, -D / 2 + 0.7], 0.05, mats.darkMetal);
  beam(g, [-W / 2 + 0.9, 0.55, D / 2 - 0.7], [W / 2 - 0.9, 0.55, D / 2 - 0.7], 0.05, mats.darkMetal);

  return { group: g, top: 1.3 };
}

function buildWeatherStation(P, mats, obj, rand) {
  const g = new THREE.Group();

  g.add(mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.14, 18), mats.pad, 0, 0.07, 0));

  // 三脚架支腿
  const legTop = 1.35;
  for (let i = 0; i < 3; i++) {
    const ang = (i * Math.PI * 2) / 3;
    beam(g, [Math.sin(ang) * 0.62, 0.14, Math.cos(ang) * 0.62], [0, legTop, 0], 0.035, mats.metal);
  }

  // 主杆
  g.add(mesh(new THREE.CylinderGeometry(0.055, 0.07, 4.7, 10), mats.metal, 0, 2.45, 0));

  // 风速仪（旋转）
  const spin = new THREE.Group();
  spin.position.set(0, 4.55, 0);
  for (let i = 0; i < 3; i++) {
    const ang = (i * Math.PI * 2) / 3;
    beam(spin, [0, 0, 0], [Math.sin(ang) * 0.46, 0, Math.cos(ang) * 0.46], 0.022, mats.darkMetal, 6);
    const cup = mesh(new THREE.SphereGeometry(0.1, 10, 8), mats.white, Math.sin(ang) * 0.48, 0, Math.cos(ang) * 0.48);
    spin.add(cup);
  }
  g.add(spin);
  g.add(mesh(new THREE.SphereGeometry(0.09, 10, 8), mats.darkMetal, 0, 4.55, 0));

  // 风向标
  const vane = new THREE.Group();
  vane.position.set(0, 4.15, 0);
  beam(vane, [0, 0, -0.35], [0, 0, 0.42], 0.018, mats.darkMetal, 6);
  const fin = mesh(new THREE.BoxGeometry(0.02, 0.22, 0.34), mats.white, 0, 0, 0.52);
  vane.add(fin);
  const tip = mesh(new THREE.ConeGeometry(0.09, 0.24, 8), mats.white, 0, 0, -0.5);
  tip.rotation.x = -Math.PI / 2;
  vane.add(tip);
  g.add(vane);

  // 雨量计
  const gauge = new THREE.Group();
  gauge.position.set(0.55, 3.35, 0.1);
  const funnel = mesh(new THREE.ConeGeometry(0.26, 0.3, 16, 1, true), mats.white, 0, 0.28, 0);
  funnel.rotation.x = Math.PI;
  gauge.add(funnel);
  gauge.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 12), mats.white, 0, 0, 0));
  g.add(gauge);

  // 防辐射罩
  const shield = new THREE.Group();
  shield.position.set(-0.5, 3.5, 0);
  for (let i = 0; i < 4; i++) {
    shield.add(mesh(new THREE.CylinderGeometry(0.24 - i * 0.02, 0.24 - i * 0.02, 0.035, 14), mats.white, 0, i * 0.11, 0));
  }
  shield.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 10), mats.white, 0, 0.2, 0));
  g.add(shield);

  // 太阳能板
  const panel = mesh(new THREE.BoxGeometry(0.78, 0.03, 0.5), mats.solar, 0, 2.85, -0.42);
  panel.rotation.x = -0.5;
  g.add(panel);
  beam(g, [0, 2.55, -0.3], [0, 2.74, -0.42], 0.03, mats.metal);

  // 采集箱 + 指示灯
  g.add(mesh(new THREE.BoxGeometry(0.42, 0.5, 0.26), mats.darkMetal, 0, 2.1, 0.3));
  const led = mesh(new THREE.SphereGeometry(0.035, 8, 8), mats.white, 0.12, 2.24, 0.44);
  g.add(led);

  const animate = (t) => {
    spin.rotation.y = t * 2.6;
    vane.rotation.y = Math.sin(t * 0.7) * 0.5;
    led.material.emissive = new THREE.Color(0x66ff99);
    led.material.emissiveIntensity = 0.6 + Math.sin(t * 3) * 0.4;
  };

  return { group: g, top: 4.9, animate };
}

function buildSoilSensor(P, mats, obj, rand) {
  const g = new THREE.Group();

  // 三根探针插入土壤
  for (const sx of [-0.1, 0, 0.1]) {
    beam(g, [sx, 0.42, 0], [sx, -0.12, 0], 0.014, mats.metal, 6);
  }
  // 立杆
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), mats.darkMetal, 0, 0.45, 0));
  // 采集盒
  g.add(mesh(new THREE.BoxGeometry(0.26, 0.2, 0.12), mats.white, 0, 0.98, 0));
  g.add(mesh(new THREE.BoxGeometry(0.28, 0.03, 0.14), mats.darkMetal, 0, 1.09, 0));
  // 小太阳能板
  const panel = mesh(new THREE.BoxGeometry(0.34, 0.02, 0.22), mats.solar, 0, 1.16, 0);
  panel.rotation.x = -0.35;
  g.add(panel);

  const led = mesh(new THREE.SphereGeometry(0.028, 8, 8), mats.white, 0.08, 0.98, 0.07);
  g.add(led);

  // 土壤湿度可视化：探针周围的湿润圈
  const ring = mesh(new THREE.RingGeometry(0.18, 0.3, 20), mats.water, 0, 0.03, 0);
  ring.rotation.x = -Math.PI / 2;
  ring.material = new THREE.MeshBasicMaterial({ color: P.water, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
  g.add(ring);

  const animate = (t) => {
    led.material.emissive = new THREE.Color(0x66e0ff);
    led.material.emissiveIntensity = 0.4 + Math.sin(t * 2.4 + 1.2) * 0.35;
  };

  return { group: g, top: 1.3, animate };
}

function buildPumpHouse(P, mats, obj, rand) {
  const g = new THREE.Group();

  g.add(mesh(new THREE.BoxGeometry(3.6, 0.16, 3.6), mats.pad, 0, 0.08, 0));

  // 墙体
  g.add(mesh(new THREE.BoxGeometry(3.2, 2.3, 2.8), mats.concrete, 0, 1.31, 0));
  // 屋顶
  const roof = mesh(new THREE.BoxGeometry(3.5, 0.14, 3.1), mats.darkMetal, 0, 2.53, 0);
  g.add(roof);
  // 门
  g.add(mesh(new THREE.BoxGeometry(1.0, 1.9, 0.08), mats.door, -0.7, 1.11, 1.44));
  // 窗
  g.add(mesh(new THREE.BoxGeometry(0.8, 0.6, 0.05), mats.cover, 0.75, 1.65, 1.44));
  // 通风口
  g.add(mesh(new THREE.BoxGeometry(0.45, 0.3, 0.06), mats.darkMetal, 0.75, 2.2, 1.44));

  // 内部水泵电机
  const motor = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.75, 14), mats.darkMetal, 0.4, 1.06, 0.1);
  motor.rotation.z = Math.PI / 2;
  g.add(motor);

  // 进出水管
  beam(g, [-1.5, 0.55, 1.2], [-2.6, 0.55, 1.2], 0.09, mats.metal);
  beam(g, [1.5, 0.55, -0.9], [2.7, 0.55, -0.9], 0.09, mats.metal);
  // 立管
  beam(g, [-2.6, 0.2, 1.2], [-2.6, 1.5, 1.2], 0.09, mats.metal);

  // 标识牌
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.34, 0.05), mats.white, -1.05, 2.2, 1.44));

  return { group: g, top: 2.9 };
}

function buildWaterTank(P, mats, obj, rand) {
  const g = new THREE.Group();

  // 四条支腿
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    beam(g, [sx * 1.05, 0, sz * 1.05], [sx * 0.72, 2.0, sz * 0.72], 0.09, mats.metal);
  }

  // 罐体
  g.add(mesh(new THREE.CylinderGeometry(1.35, 1.35, 2.3, 24), mats.metal, 0, 3.15, 0));
  // 顶盖（半球）
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.35, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.metal);
  dome.position.set(0, 4.3, 0);
  dome.castShadow = false;
  g.add(dome);
  // 底锥
  const cone = mesh(new THREE.ConeGeometry(1.35, 0.5, 24, 1, true), mats.metal, 0, 1.75, 0);
  cone.rotation.x = Math.PI;
  g.add(cone);

  // 水位环
  const level = mesh(new THREE.CylinderGeometry(1.37, 1.37, 0.08, 24), mats.water, 0, 3.0, 0);
  g.add(level);

  // 爬梯
  for (let i = 0; i < 6; i++) {
    beam(g, [1.42, 1.8 + i * 0.36, 0.2], [1.72, 1.8 + i * 0.36, 0.2], 0.03, mats.darkMetal);
  }
  beam(g, [1.45, 1.8, 0.2], [1.45, 4.1, 0.2], 0.03, mats.darkMetal);
  beam(g, [1.72, 1.8, 0.2], [1.72, 4.1, 0.2], 0.03, mats.darkMetal);

  // 进出口
  beam(g, [-1.3, 2.4, 0], [-2.2, 1.2, 0], 0.08, mats.metal);

  // 水位计
  g.add(mesh(new THREE.BoxGeometry(0.16, 0.6, 0.1), mats.white, 1.2, 2.8, 0.7));

  return { group: g, top: 5.1 };
}

function buildSolarArray(P, mats, obj, rand) {
  const g = new THREE.Group();
  const rows = 2;
  const cols = 3;
  const pw = 1.9;
  const pd = 1.15;
  const gapX = 0.25;
  const gapZ = 0.5;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c - (cols - 1) / 2) * (pw + gapX);
      const z = (r - (rows - 1) / 2) * (pd + gapZ);
      const panel = mesh(new THREE.BoxGeometry(pw, 0.06, pd), mats.solar, x, 1.25, z);
      panel.rotation.x = -0.42;
      g.add(panel);
      // 支架
      beam(g, [x - pw / 2 + 0.12, 0.05, z + pd / 2 - 0.1], [x - pw / 2 + 0.12, 1.28, z - 0.2], 0.04, mats.metal);
      beam(g, [x + pw / 2 - 0.12, 0.05, z + pd / 2 - 0.1], [x + pw / 2 - 0.12, 1.28, z - 0.2], 0.04, mats.metal);
      beam(g, [x - pw / 2 + 0.12, 0.05, z - pd / 2 + 0.1], [x - pw / 2 + 0.12, 0.85, z - 0.2], 0.04, mats.metal);
      beam(g, [x + pw / 2 - 0.12, 0.05, z - pd / 2 + 0.1], [x + pw / 2 - 0.12, 0.85, z - 0.2], 0.04, mats.metal);
    }
  }

  // 汇流箱
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.7, 0.22), mats.darkMetal, (cols * (pw + gapX)) / 2 + 0.3, 0.9, 0));

  return { group: g, top: 1.9 };
}

function buildCameraPole(P, mats, obj, rand) {
  const g = new THREE.Group();

  g.add(mesh(new THREE.CylinderGeometry(0.08, 0.11, 3.8, 10), mats.metal, 0, 1.9, 0));

  // 摄像头（云台）
  const head = new THREE.Group();
  head.position.set(0, 3.8, 0);
  head.add(mesh(new THREE.BoxGeometry(0.42, 0.3, 0.68), mats.white, 0, 0.1, 0));
  const lens = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 12), mats.darkMetal, 0, 0, 0.4);
  lens.rotation.x = Math.PI / 2;
  head.add(lens);
  // 红外灯环
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    head.add(mesh(new THREE.SphereGeometry(0.022, 6, 6), mats.white, Math.cos(ang) * 0.13, Math.sin(ang) * 0.13, 0.42));
  }
  head.rotation.y = -0.35;
  g.add(head);

  // 顶部小光伏
  const panel = mesh(new THREE.BoxGeometry(0.5, 0.03, 0.34), mats.solar, 0, 4.15, 0);
  panel.rotation.x = -0.3;
  g.add(panel);
  g.add(mesh(new THREE.BoxGeometry(0.34, 0.42, 0.2), mats.darkMetal, 0, 2.9, 0));

  const animate = (t) => {
    head.rotation.y = -0.35 + Math.sin(t * 0.35) * 0.55;
  };

  return { group: g, top: 4.4, animate };
}

function buildIrrigation(P, mats, obj, rand) {
  const g = new THREE.Group();

  // 立管
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.35, 12), mats.pad, 0, 0.17, 0));

  const arms = [];
  const posts = [
    [-3.2, 0, -2.2],
    [3.2, 0, -2.2],
    [-3.2, 0, 2.2],
    [3.2, 0, 2.2],
  ];

  posts.forEach(([x, y, z], i) => {
    g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.2, 8), mats.metal, x, 0.6 + y, z));
    const arm = new THREE.Group();
    arm.position.set(x, 1.2 + y, z);
    beam(arm, [0, 0, 0], [0.42, 0, 0], 0.02, mats.darkMetal, 6);
    beam(arm, [0, 0, 0], [-0.42, 0, 0], 0.02, mats.darkMetal, 6);
    arm.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10), mats.darkMetal, 0.42, 0, 0));
    arm.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10), mats.darkMetal, -0.42, 0, 0));
    arm.rotation.y = i * 0.8;
    g.add(arm);
    arms.push(arm);
  });

  // 主管道
  beam(g, [-4.2, 0.35, 0], [4.2, 0.35, 0], 0.05, mats.darkMetal);

  const animate = (t, dt, state) => {
    const speed = state && state.irrigation ? 3.2 : 0.35;
    arms.forEach((a) => (a.rotation.y += dt * speed));
  };

  return { group: g, top: 1.5, animate };
}

// 场景中的树木（装饰，带轻微摆动）
function buildTrees(root, P, mats, rand) {
  const spots = [
    [-21, -13],
    [21, -11],
    [-23, 3],
    [22, 7],
    [-21, 16],
    [18, 17],
    [-9, -18],
    [11, -18],
  ];
  spots.forEach(([x, z], i) => {
    const t = new THREE.Group();
    const h = 1.5 + rand() * 1.2;
    const trunk = mesh(new THREE.CylinderGeometry(0.14, 0.22, h, 8), mats.trunk, 0, h / 2, 0);
    t.add(trunk);
    for (let k = 0; k < 3; k++) {
      const foliage = mesh(new THREE.ConeGeometry(0.95 - k * 0.16, 1.25, 7), mats.leaf, 0, h + 0.25 + k * 0.75, 0);
      foliage.rotation.y = rand() * Math.PI;
      t.add(foliage);
    }
    t.position.set(x, 0, z);
    const phase = i * 0.7;
    root.add(t);
    // 摆动放到 update 里由 createFarm 统一登记
    t.userData.sway = true;
    t.userData.phase = phase;
  });
}

// 土壤剖面块（展示土层结构：表土 / 黏土 / 砂土 / 砾石层 + 根系）
function buildSoilCutaway(root, P, mats) {
  const g = new THREE.Group();
  const W = 6.4;
  const D = 4.4;

  const layers = [
    { h: 0.34, shrink: 0, mat: mats.soilTop },
    { h: 0.62, shrink: 0.12, mat: mats.clay },
    { h: 0.62, shrink: 0.24, mat: mats.sand },
    { h: 0.5, shrink: 0.36, mat: mats.gravel },
  ];

  let y = 0;
  layers.forEach((L, i) => {
    const w = W - L.shrink;
    const d = D - L.shrink * 0.6;
    const m = mesh(new THREE.BoxGeometry(w, L.h, d), L.mat, -L.shrink * 0.25, y + L.h / 2, 0);
    g.add(m);
    y += L.h;
  });

  const cap = mesh(new THREE.BoxGeometry(W + 0.06, 0.1, D + 0.02), mats.soilTop, 0, y + 0.05, 0);
  g.add(cap);

  // 根系（伸入表土与黏土层）
  const rootMat = new THREE.LineBasicMaterial({ color: P.dark ? 0xb08a5a : 0x7a5a34, transparent: true, opacity: 0.8 });
  const pts = [];
  for (let i = 0; i < 7; i++) {
    const x0 = -2 + i * 0.62;
    const x1 = x0 + (randSign(i) * (0.3 + (i % 3) * 0.12));
    pts.push(x0, y, 0.2, x0, y - 0.42, 0.2);
    pts.push(x0, y - 0.42, 0.2, x1, y - 0.9, 0.2);
  }
  const rootGeo = new THREE.BufferGeometry();
  rootGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(rootGeo, rootMat));

  // 剖面标注桩
  for (let i = 0; i < 4; i++) {
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), mats.white, W / 2 + 0.2, 0.2 + i * 0.62, 0));
  }

  g.position.set(-18.5, 0, 6.5);
  root.add(g);
}

function randSign(i) {
  return i % 2 === 0 ? 1 : -1;
}

// 场地道路
function buildRoad(root, P, mats) {
  const road = mesh(new THREE.BoxGeometry(3.2, 0.06, 34), mats.concrete, -13.5, 0.03, 0);
  road.material = new THREE.MeshLambertMaterial({ color: P.dark ? 0x2a3438 : 0xb9b6ae, map: concreteTexture(6), roughness: 0.95 });
  root.add(road);

  // 道路两侧标线
  const lineMat = new THREE.MeshBasicMaterial({ color: P.dark ? 0x2f7f8f : 0xffffff, transparent: true, opacity: P.dark ? 0.35 : 0.55 });
  for (let z = -14; z <= 14; z += 4) {
    const dash = mesh(new THREE.BoxGeometry(0.5, 0.01, 1.6), lineMat, -13.5, 0.075, z);
    root.add(dash);
  }
}

// 场地草地
const TERRAIN_PROFILES = {
  hill: {
    height: 7.5,
    spread: 9,
    maxHeight: 7,
    anchors: [[-37, -31, 0.82], [-23, -41, 0.75], [8, -39, 0.7], [38, -28, 0.9], [42, 8, 0.72], [25, 39, 0.78], [-16, 42, 0.72], [-41, 20, 0.78]],
  },
  south: {
    height: 10.5,
    spread: 7.8,
    maxHeight: 10,
    anchors: [[-39, -33, 0.92], [-25, -5, 0.85], [-8, -39, 0.82], [11, -23, 0.76], [36, -36, 0.95], [42, 1, 0.9], [25, 27, 0.82], [-34, 38, 0.95], [5, 42, 0.82], [41, 37, 0.9]],
  },
  mountain: {
    height: 18,
    spread: 7.2,
    maxHeight: 17,
    anchors: [[-39, -38, 0.86], [-20, -40, 0.94], [3, -43, 0.78], [31, -39, 1], [43, -15, 0.9], [41, 14, 0.84], [24, 40, 0.94], [0, 42, 0.83], [-29, 39, 1], [-43, 6, 0.9]],
  },
  east: {
    height: 13,
    spread: 8.5,
    maxHeight: 12,
    anchors: [[-42, -25, 0.72], [-37, -3, 0.85], [-29, 17, 0.95], [-12, 31, 0.88], [7, 39, 1], [27, 37, 0.92], [41, 26, 0.82]],
  },
};

function regionalHeight(x, z, region) {
  const profile = TERRAIN_PROFILES[region];
  if (!profile) return 0;

  const elevation = profile.anchors.reduce((height, [peakX, peakZ, scale]) => {
    const dx = x - peakX;
    const dz = z - peakZ;
    return height + profile.height * scale * Math.exp(-(dx * dx + dz * dz) / (2 * profile.spread * profile.spread));
  }, 0);
  const distanceFromFarm = Math.max(Math.abs(x), Math.abs(z));
  const transition = THREE.MathUtils.clamp((distanceFromFarm - 19) / 12, 0, 1);
  const smoothTransition = transition * transition * (3 - 2 * transition);
  const ridgeTexture = 1 + 0.07 * Math.sin(x * 0.31 + z * 0.18) * Math.cos(z * 0.27);
  return Math.min(elevation * ridgeTexture, profile.maxHeight) * smoothTransition;
}

function buildGround(root, P, mats, theme, region = "plain") {
  const tex = grassTexture(16, theme === "light" ? 5 : 8);
  const groundMat = new THREE.MeshLambertMaterial({
    color: P.ground || (P.dark ? 0x36543a : 0xa9c78f),
    map: tex,
    roughness: 1,
    metalness: 0,
  });
  const segments = region === "plain" ? 1 : 96;
  const geometry = new THREE.PlaneGeometry(92, 92, segments, segments);
  if (region !== "plain") {
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      positions.setZ(i, regionalHeight(positions.getX(i), -positions.getY(i), region));
    }
    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();
  } else {
    geometry.rotateX(-Math.PI / 2);
  }
  const ground = mesh(geometry, groundMat, 0, 0, 0);
  ground.receiveShadow = false;
  root.add(ground);
  if (tex) tex.repeat.set(16, 16);

  if (region === "plain") {
    const canal = new THREE.Mesh(
      new THREE.BoxGeometry(24, 0.08, 2.8),
      new THREE.MeshLambertMaterial({ color: P.water, transparent: true, opacity: 0.75 })
    );
    canal.position.set(10, 0.06, 18);
    root.add(canal);
  }
}

// 喷灌水滴
function buildWaterSystem(cx, cz, spreadX = 4.4, spreadZ = 4.4, count = 460, maxHeight = 3.5, size = 0.1) {
  const positions = new Float32Array(count * 3);
  const r = seededRandom(77);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = cx + (r() - 0.5) * spreadX * 2;
    positions[i * 3 + 1] = 0.4 + r() * (maxHeight - 0.4);
    positions[i * 3 + 2] = cz + (r() - 0.5) * spreadZ * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x7fd8ff,
    size,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  let level = 0;

  return {
    points,
    update(t, dt, state) {
      const on = state && state.irrigation;
      const target = on ? 0.9 : 0;
      level += (target - level) * Math.min(1, dt * 4);
      mat.opacity = level;
      if (level < 0.03) return;
      const arr = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        arr[i * 3 + 1] -= dt * (1.1 + (i % 9) * 0.16);
        if (arr[i * 3 + 1] < 0.35) {
          arr[i * 3 + 1] = maxHeight;
          arr[i * 3] = cx + (Math.random() - 0.5) * spreadX * 2;
          arr[i * 3 + 2] = cz + (Math.random() - 0.5) * spreadZ * 2;
        }
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// ============ 组装 ============

const BUILDERS = {
  field: buildField,
  weatherStation: buildWeatherStation,
  soilSensor: buildSoilSensor,
  pumpHouse: buildPumpHouse,
  waterTank: buildWaterTank,
  solarArray: buildSolarArray,
  cameraPole: buildCameraPole,
  irrigation: buildIrrigation,
};

export function createFarm({ objects = [], theme = "dark", region = "plain" }) {
  const P = palette(theme, region);
  const mats = makeMaterials(P);
  const root = new THREE.Group();
  const registry = new Map();
  const pickables = [];
  const animated = [];
  const rand = seededRandom(theme === "light" ? 17 : 29);

  buildGround(root, P, mats, theme, region);
  buildSoilCutaway(root, P, mats);
  buildRoad(root, P, mats);
  buildTrees(root, P, mats, rand);

  // 树木风摆
  root.children.forEach((c) => {
    if (c.userData && c.userData.sway) {
      const phase = c.userData.phase;
      animated.push({
        update(t, dt, state) {
          const wind = state?.weather === "wind" ? 0.11 : 0.02;
          c.rotation.z = Math.sin(t * (state?.weather === "wind" ? 1.8 : 0.6) + phase) * wind;
          c.rotation.x = Math.cos(t * (state?.weather === "wind" ? 1.5 : 0.5) + phase) * wind * 0.75;
        },
      });
    }
  });

  const fieldObj = objects.find((o) => o.type === "field");
  if (fieldObj) {
    const [fx, , fz] = fieldObj.position || [0, 0, 0];
    const water = buildWaterSystem(fx, fz);
    root.add(water.points);
    animated.push(water);
  }

  objects.forEach((obj, index) => {
    const builder = BUILDERS[obj.type];
    if (!builder) return;
    const built = builder(P, mats, obj, rand);
    const [x, y, z] = obj.position || [0, 0, 0];
    built.group.position.set(x, y, z);
    built.group.userData.objectId = obj.id;

    // 状态指示灯
    const color = STATUS_COLORS[obj.status] || STATUS_COLORS.normal;
    const lightMat = new THREE.MeshLambertMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.2,
      roughness: 0.4,
    });
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), lightMat);
    light.position.set(0, built.top, 0);
    light.userData.statusLight = true;
    built.group.add(light);

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 10, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false })
    );
    halo.position.copy(light.position);
    built.group.add(halo);

    const phase = index * 1.3;
    animated.push({
      update(t) {
        lightMat.emissiveIntensity = 1.05 + Math.sin(t * 2 + phase) * 0.35;
        const s = 1 + Math.sin(t * 2 + phase) * 0.14;
        halo.scale.setScalar(s);
      },
    });

    // 不可见拾取盒：扩大点击命中范围，避免细小部件难以点中
    const HIT_SIZE = {
      field: [10.8, 1.6, 10.8],
      weatherStation: [2, 5.4, 2],
      soilSensor: [1.1, 1.7, 1.1],
      pumpHouse: [4.4, 3.4, 4.4],
      waterTank: [3.4, 5.6, 3.4],
      solarArray: [7.6, 2.4, 3.6],
      cameraPole: [1.5, 5, 1.5],
      irrigation: [9.6, 2, 5.6],
    };
    const hitSize = HIT_SIZE[obj.type] || [2.2, 2.2, 2.2];
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(hitSize[0], hitSize[1], hitSize[2]),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hitbox.position.y = hitSize[1] / 2;
    hitbox.userData.objectId = obj.id;
    built.group.add(hitbox);
    pickables.push(hitbox);

    if (built.animate) animated.push({ update: built.animate });
    root.add(built.group);
    registry.set(obj.id, {
      group: built.group,
      light,
      top: built.top,
      meta: obj,
    });
  });

  // 场景 fog / 主题背景由调用方设置

  return {
    root,
    registry,
    pickables,
    materials: mats,
    update(t, dt, state) {
      const clamped = Math.min(dt, 0.05);
      animated.forEach((a) => a.update && a.update(t, clamped, state || {}));
    },
    setStatus(id, status) {
      const entry = registry.get(id);
      if (!entry) return;
      const color = STATUS_COLORS[status] || STATUS_COLORS.normal;
      entry.light.material.color.setHex(color);
      entry.light.material.emissive.setHex(color);
      if (entry.meta) entry.meta.status = status;
    },
    dispose() {
      root.traverse((o) => {
        if (o.isMesh || o.isPoints || o.isLineSegments) {
          if (o.geometry) o.geometry.dispose();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((mm) => mm && mm.dispose && mm.dispose());
          else if (m && m.dispose) m.dispose();
        }
      });
    },
  };
}

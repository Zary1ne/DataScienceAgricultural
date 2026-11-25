import * as THREE from "three";
import { createRicePartMaterial } from "./riceMaterial.js";
import { RICE_PART_FACE_BUDGET } from "./riceBatchMath.js";

export const PROCEDURAL_RICE_MODEL_KEY = "rice-programmatic-v1";

function createBuilder() {
  return {
    vertices: [],
    swayWeights: [],
    shades: [],
    partPhases: [],
    tips: [],
  };
}

function addTriangle(builder, a, b, c, weight, shade = 1, partPhase = 0) {
  for (const point of [a, b, c]) {
    builder.vertices.push(point[0], point[1], point[2]);
    builder.swayWeights.push(weight);
    builder.shades.push(shade);
    builder.partPhases.push(partPhase);
    builder.tips.push(point[3] || 0);
  }
}

function addQuad(builder, a, b, c, d, weight, shade = 1, partPhase = 0) {
  addTriangle(builder, a, b, c, weight, shade, partPhase);
  addTriangle(builder, a, c, d, weight, shade, partPhase);
}

function leafHalfWidth(t) {
  if (t < 0.16) return 0.22 + t * 4.2;
  return Math.max(0.035, 1.0 - (t - 0.16) * 1.02);
}

function addRibbonPath(builder, points, width, weight, partPhase = 0) {
  for (let segment = 0; segment < points.length - 1; segment += 1) {
    const from = points[segment];
    const to = points[segment + 1];
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    const distance = Math.max(1e-5, Math.hypot(dx, dz));
    const sideX = -dz / distance;
    const sideZ = dx / distance;
    const fromWidth = width * leafHalfWidth(from[3]);
    const toWidth = width * leafHalfWidth(to[3]);
    const a = [from[0] + sideX * fromWidth, from[1], from[2] + sideZ * fromWidth, from[3]];
    const b = [to[0] + sideX * toWidth, to[1], to[2] + sideZ * toWidth, to[3]];
    const c = [to[0] - sideX * toWidth, to[1], to[2] - sideZ * toWidth, to[3]];
    const d = [from[0] - sideX * fromWidth, from[1], from[2] - sideZ * fromWidth, from[3]];
    addQuad(
      builder,
      a,
      b,
      c,
      d,
      weight,
      0.76 + (1 - from[3]) * 0.18,
      partPhase
    );
  }
}

function rotateAroundZ(point, angle, centerY = 0) {
  const x = point[0];
  const y = point[1] - centerY;
  return [
    x * Math.cos(angle) - y * Math.sin(angle),
    centerY + x * Math.sin(angle) + y * Math.cos(angle),
    point[2],
    point[3] || 0,
  ];
}

function createGeometry(builder) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(builder.vertices, 3)
  );
  geometry.setAttribute(
    "aSwayWeight",
    new THREE.Float32BufferAttribute(builder.swayWeights, 1)
  );
  geometry.setAttribute(
    "aPartPhase",
    new THREE.Float32BufferAttribute(builder.partPhases, 1)
  );
  geometry.setAttribute(
    "aTip",
    new THREE.Float32BufferAttribute(builder.tips, 1)
  );
  const colors = [];
  for (const shade of builder.shades) {
    colors.push(shade, shade, shade);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createSeedGeometry() {
  const builder = createBuilder();
  const sides = 6;
  const rings = [
    { y: 0.08, radius: 0.032, shade: 0.72 },
    { y: 0.17, radius: 0.085, shade: 0.98 },
    { y: 0.27, radius: 0.055, shade: 0.84 },
  ];
  const transformedRings = rings.map((ring) =>
    Array.from({ length: sides }, (_, index) => {
      const angle = (index / sides) * Math.PI * 2;
      return rotateAroundZ(
        [Math.cos(angle) * ring.radius, ring.y, Math.sin(angle) * ring.radius * 0.62],
        0.82,
        0.18
      );
    })
  );
  const bottom = rotateAroundZ([0, 0.035, 0], 0.82, 0.18);
  const top = rotateAroundZ([0, 0.32, 0], 0.82, 0.18);

  for (let index = 0; index < sides; index += 1) {
    const next = (index + 1) % sides;
    addTriangle(builder, bottom, transformedRings[0][index], transformedRings[0][next], 0.02, 0.68);
    addTriangle(builder, top, transformedRings[2][next], transformedRings[2][index], 0.02, 0.96);
    addTriangle(builder, transformedRings[0][index], transformedRings[1][index], transformedRings[1][next], 0.02, rings[1].shade);
    addTriangle(builder, transformedRings[0][index], transformedRings[1][next], transformedRings[0][next], 0.02, rings[0].shade);
    addTriangle(builder, transformedRings[1][index], transformedRings[2][index], transformedRings[2][next], 0.02, rings[2].shade);
    addTriangle(builder, transformedRings[1][index], transformedRings[2][next], transformedRings[1][next], 0.02, rings[1].shade);
  }
  return createGeometry(builder);
}

function stemPoint(angle, radius, y, tip) {
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius, tip];
}

function createMainStemGeometry() {
  const builder = createBuilder();
  addRibbonPath(
    builder,
    [
      stemPoint(0, 0, 0, 0),
      stemPoint(0, 0.006, 0.24, 0.2),
      stemPoint(0, 0.015, 0.5, 0.4),
      stemPoint(0, 0.018, 0.78, 0.6),
      stemPoint(0, 0.014, 1.04, 0.8),
      stemPoint(0, 0.006, 1.28, 1),
    ],
    0.018,
    0.2
  );
  return createGeometry(builder);
}

function createTillerGeometry() {
  const builder = createBuilder();
  const tillerCount = 8;
  for (let tiller = 0; tiller < tillerCount; tiller += 1) {
    const angle = (tiller / tillerCount) * Math.PI * 2 + Math.PI / 8;
    const height = 0.82 + (tiller % 3) * 0.11;
    const lean = 0.23 + (tiller % 2) * 0.06;
    const phase = 0.215 + tiller * 0.018;
    addRibbonPath(
      builder,
      Array.from({ length: 5 }, (_, index) => {
        const t = index / 4;
        return stemPoint(angle, lean * (0.08 + t * t), height * t, t);
      }),
      0.014,
      0.2,
      phase
    );
  }
  return createGeometry(builder);
}

function leafPoint(angle, startY, length, reach, t) {
  const radial = reach * (0.8 * t * t + 0.08 * t);
  const lift = length * (0.58 * t + 0.56 * t * t - 0.14 * t * t * t);
  return [Math.cos(angle) * radial, startY + lift, Math.sin(angle) * radial, t];
}

function createLeafGeometry() {
  const builder = createBuilder();
  const leafPhases = [0.072, 0.09, 0.112, 0.138, 0.17, 0.225, 0.285, 0.355, 0.445, 0.545];
  for (let leaf = 0; leaf < leafPhases.length; leaf += 1) {
    const angle = (leaf / leafPhases.length) * Math.PI * 2 + 0.18;
    const phase = leafPhases[leaf];
    const early = leaf < 4;
    const length = early ? 0.62 + leaf * 0.025 : 0.78 + (leaf % 4) * 0.06;
    const reach = early ? 0.46 + leaf * 0.025 : 0.63 + (leaf % 3) * 0.07;
    const startY = 0.055 + Math.min(0.2, leaf * 0.017);
    addRibbonPath(
      builder,
      Array.from({ length: 7 }, (_, index) =>
        leafPoint(angle, startY, length, reach, index / 6)
      ),
      0.052,
      1,
      phase
    );
  }
  return createGeometry(builder);
}

function panicleHeadPoint(angle, radius, y, tip) {
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius, tip];
}

function createPanicleGeometry() {
  const builder = createBuilder();
  const headCount = 5;
  for (let head = 0; head < headCount; head += 1) {
    const angle = (head / headCount) * Math.PI * 2 + 0.25;
    const centerRadius = 0.11 + (head % 2) * 0.035;
    const topY = 1.2 + (head % 3) * 0.035;
    const axis = [
      panicleHeadPoint(angle, centerRadius, topY, 0),
      panicleHeadPoint(angle, centerRadius + 0.055, topY + 0.035, 0.28),
      panicleHeadPoint(angle, centerRadius + 0.13, topY + 0.01, 0.62),
      panicleHeadPoint(angle, centerRadius + 0.205, topY - 0.075, 1),
    ];
    addRibbonPath(builder, axis, 0.009, 0.9, 0.57);

    for (let branch = 0; branch < 5; branch += 1) {
      const t = (branch + 0.5) / 5;
      const source = axis[Math.min(axis.length - 1, 1 + Math.floor(t * 2))];
      const side = branch % 2 === 0 ? 1 : -1;
      const branchAngle = angle + side * (0.9 + (branch % 3) * 0.16);
      const length = 0.075 + (branch % 2) * 0.025;
      const end = [
        source[0] + Math.cos(branchAngle) * length,
        source[1] - 0.04 - (branch % 3) * 0.012,
        source[2] + Math.sin(branchAngle) * length,
        1,
      ];
      addRibbonPath(
        builder,
        [
          [source[0], source[1], source[2], t],
          [end[0], end[1], end[2], 1],
        ],
        0.006,
        0.93,
        0.57
      );
    }
  }
  return createGeometry(builder);
}

function addGrain(builder, center, radius, angle) {
  const sideX = Math.cos(angle) * radius;
  const sideZ = Math.sin(angle) * radius * 0.65;
  const top = [center[0], center[1] + radius * 1.35, center[2]];
  const bottom = [center[0], center[1] - radius * 1.35, center[2]];
  const left = [center[0] - sideX, center[1], center[2] - sideZ];
  const right = [center[0] + sideX, center[1], center[2] + sideZ];
  addTriangle(builder, top, left, right, 0.85, 0.98);
  addTriangle(builder, bottom, right, left, 0.85, 0.78);
}

function createGrainGeometry() {
  const builder = createBuilder();
  const headCount = 5;
  const grainsPerHead = 8;
  for (let head = 0; head < headCount; head += 1) {
    const headAngle = (head / headCount) * Math.PI * 2 + 0.25;
    const centerRadius = 0.11 + (head % 2) * 0.035;
    const topY = 1.2 + (head % 3) * 0.035;
    for (let grain = 0; grain < grainsPerHead; grain += 1) {
      const t = (grain + 0.5) / grainsPerHead;
      const side = grain % 2 === 0 ? 1 : -1;
      const radial = centerRadius + 0.03 + t * 0.17;
      const spread = side * (0.025 + (grain % 3) * 0.012);
      const center = [
        Math.cos(headAngle) * radial + Math.cos(headAngle + Math.PI / 2) * spread,
        topY + 0.025 - t * 0.16,
        Math.sin(headAngle) * radial + Math.sin(headAngle + Math.PI / 2) * spread,
      ];
      addGrain(builder, center, 0.018, headAngle + side * 0.55);
    }
  }
  return createGeometry(builder);
}

export function createProceduralRicePlant(modelKey = PROCEDURAL_RICE_MODEL_KEY) {
  if (modelKey !== PROCEDURAL_RICE_MODEL_KEY) {
    throw new Error(`Unknown rice plant model key: ${modelKey}`);
  }

  const group = new THREE.Group();
  group.name = "ProceduralRicePlant";
  const parts = [
    ["seed", createSeedGeometry()],
    ["mainStem", createMainStemGeometry()],
    ["tillerStems", createTillerGeometry()],
    ["leaves", createLeafGeometry()],
    ["panicle", createPanicleGeometry()],
    ["grains", createGrainGeometry()],
  ];

  for (const [partKey, geometry] of parts) {
    const mesh = new THREE.Mesh(geometry, createRicePartMaterial(partKey));
    mesh.name = `Rice_${partKey}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.batchPartKey = partKey;
    mesh.userData.triangleBudget = RICE_PART_FACE_BUDGET[partKey];
    group.add(mesh);
  }

  return group;
}

export class ProceduralRiceFactory {
  createPlant(modelKey) {
    return createProceduralRicePlant(modelKey);
  }
}

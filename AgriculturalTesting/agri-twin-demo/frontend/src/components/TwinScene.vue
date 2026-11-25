<script setup>
// 全屏露天水田场景：支持子区域拾取、自由视角与天气演示
import { ref, reactive, onMounted, onBeforeUnmount, watch } from "vue";
import * as THREE from "three";
import { createPaddyFieldScene } from "../scene/paddyFieldBuilder.js";
import {
  ACTUAL_WEATHER_DEFAULTS,
  shouldShowRain,
  computeWindStrength,
} from "../scene/weatherState.js";
import { GLOBAL_PLOT_ID } from "../scene/farmComponents.js";

const props = defineProps({
  plotStates: { type: Object, default: () => ({}) },
  /** 旧 prop：天气 key 字符串，向后兼容 */
  weather: { type: String, default: "sunny" },
  /** 新 prop：来自 weatherState.js 的 WeatherSnapshot */
  weatherSnapshot: { type: Object, default: null },
  componentManager: { type: Object, default: null },
  /** P3: 收割进度 0~1 —— 驱动水稻变矮、变灰成为稻茬 */
  harvestAmount: { type: Number, default: 0 },
});

const emit = defineEmits(["select", "component-select", "ground-click", "view-change"]);

const container = ref(null);
const label = reactive({ visible: false, x: 0, y: 0, name: "", status: "" });
const showFps = import.meta.env.DEV;
const fps = ref("--");

let renderer = null;
let scene = null;
let camera = null;
let rafId = 0;
let resizeObserver = null;
let farm = null;
let starField = null;
let selectionRing = null;
let hoverRing = null;
let clock = null;
let weatherGroup = null;
let rainStreaks = null;
let windStreaks = null;
let rainGeometry = null;
let windGeometry = null;
let rainPositions = null;
let windPositions = null;
let rainUniforms = null;
let rainLineCount = 0;
let rainQualityScale = 1;
let renderPixelScale = 1;
let weatherUpdateAccumulator = 0;
let cloudGroup = null;
let cloudMaterial = null;
let clouds = [];
let sunGroup = null;
let sunLight = null;
let ambientLight = null;
let hemisphereLight = null;

const flashes = new Map();
let currentSnapshot = props.weatherSnapshot || ACTUAL_WEATHER_DEFAULTS;
let currentWeather = currentSnapshot.key;
let selectedId = null;
let hoveredId = null;
let inspectionMode = false;
let savedOrbitState = null;
// P6: 巡检云台（PTZ）状态 —— 相机位置固定，只做 ±90° 水平摇头
// 注意只更新相机姿态，不触发场景重建
let inspectionCameraPos = null;      // 进入巡检时的相机世界坐标（固定不动）
let inspectionBaseForward = null;    // 进入巡检时的初始朝向
let inspectionYaw = 0;               // 当前实际偏航角（弧度）
let inspectionYawTarget = 0;         // 目标偏航角（键盘/拖拽累加，rAF 插值逼近）
let inspectionPitch = 0;             // 当前实际俯仰角（相对初始视角）
let inspectionPitchTarget = 0;       // 目标俯仰角
let inspectionDragging = false;
let inspectionLastX = 0;
let inspectionLastY = 0;
// P6: 进入巡检时的镜头过渡（500ms 平滑推进，避免瞬移）
let inspectionTransition = null;
const INSPECTION_TRANSITION_MS = 500;
const INSPECTION_MAX_YAW = Math.PI / 2;   // ±90°
const INSPECTION_Y_AXIS = new THREE.Vector3(0, 1, 0);
const inspectionForward = new THREE.Vector3();
const inspectionLookAt = new THREE.Vector3();
const inspectionRight = new THREE.Vector3();
// P11: 俯仰（Pitch）—— 相对初始视角最多 ±60°，同时保证不会越过天顶/地底导致倒转
const INSPECTION_MAX_PITCH = Math.PI / 3;          // ±60°
const INSPECTION_SAFE_PITCH = Math.PI / 2 - 0.09;  // 距水平 ±85° 的安全边界
// P12: 缩放（Zoom）—— 通过 FOV 实现，20°（最远放大）~ 80°（最广视野）
const INSPECTION_MIN_FOV = 20;
const INSPECTION_MAX_FOV = 80;
let inspectionFovTarget = null;
// P10: 全场几何中心（平原 (0,0) 与梯田 (80,0) 的中点）
const SCENE_CENTER = new THREE.Vector3(40, 0.6, 0);
const REGION_TARGET_X = Object.freeze({ all: 40, plain: 0, terrace: 80 });
// 全局巡检时适当放大视野，尽量把两块田同时纳入画面
const INSPECTION_GLOBAL_FOV = 70;
let inspectionBaseFov = null;
const weatherCenterX = 40;
const weatherHalfWidth = 75;
const weatherHalfDepth = 40;

const target = new THREE.Vector3(40, 1.5, 0);
let radius = 150;
let theta = 0;
let phi = Math.PI / 3;
let dragging = false;
let panning = false;
let lastX = 0;
let lastY = 0;
let downX = 0;
let downY = 0;
let autoRotate = false;
let canvasDown = false;
let cameraTransition = null;
let fpsFrameCount = 0;
let fpsWindowStart = 0;
let componentDragging = false;
let draggedComponentId = null;
let componentDragMoved = false;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const panRight = new THREE.Vector3();
const panUp = new THREE.Vector3();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const dragWorldPoint = new THREE.Vector3();

function updateCamera() {
  camera.position.set(
    target.x + radius * Math.sin(phi) * Math.sin(theta),
    Math.max(1.2, target.y + radius * Math.cos(phi)),
    target.z + radius * Math.sin(phi) * Math.cos(theta)
  );
  camera.lookAt(target);
}

function overviewRadius() {
  const aspect = camera?.aspect || 1.4;
  const halfVertical = THREE.MathUtils.degToRad((camera?.fov || 42) / 2);
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
  return THREE.MathUtils.clamp(72 / Math.tan(halfHorizontal) * 1.12, 135, 280);
}

// P11: 俯仰限幅 —— 相对初始视角不超过 ±60°，同时保证总俯仰不越过 ±85°（防止倒转）
function clampInspectionPitch(pitch) {
  if (!inspectionBaseForward) return pitch;
  const basePitch = Math.asin(THREE.MathUtils.clamp(inspectionBaseForward.y, -1, 1));
  const min = Math.max(-INSPECTION_MAX_PITCH, -INSPECTION_SAFE_PITCH - basePitch);
  const max = Math.min(INSPECTION_MAX_PITCH, INSPECTION_SAFE_PITCH - basePitch);
  return THREE.MathUtils.clamp(pitch, min, max);
}

// P12: 缩放目标 —— delta > 0 拉远（FOV 变大），delta < 0 放大（FOV 变小）
function adjustInspectionZoom(delta) {
  if (!inspectionMode) return;
  const base = inspectionFovTarget ?? camera.fov;
  inspectionFovTarget = THREE.MathUtils.clamp(base + delta, INSPECTION_MIN_FOV, INSPECTION_MAX_FOV);
}

// P6: 巡检云台 —— 相机原地不动，绕自身 Y 轴摇头（±90°）+ 俯仰（±60°）
// 每帧只改 camera 的位置/朝向，不触碰场景对象，零重排
function updateInspectionCamera(dt) {
  if (!inspectionMode || !inspectionCameraPos || !inspectionBaseForward) return;
  // 1) 进入巡检的 500ms 推进：位置 lerp + 朝向 slerp
  if (inspectionTransition) {
    const transition = inspectionTransition;
    transition.elapsed += dt * 1000;
    const progress = Math.min(1, transition.elapsed / transition.duration);
    const eased = progress * progress * (3 - 2 * progress);   // smoothstep
    camera.position.lerpVectors(transition.fromPos, transition.toPos, eased);
    camera.quaternion.slerpQuaternions(transition.fromQuat, transition.toQuat, eased);
    if (transition.fromFov !== transition.toFov) {
      camera.fov = transition.fromFov + (transition.toFov - transition.fromFov) * eased;
      camera.updateProjectionMatrix();
    }
    if (progress >= 1) inspectionTransition = null;
    return;
  }
  // 2) 稳态：机位固定，只做 ±90° 摇头
  const diff = inspectionYawTarget - inspectionYaw;
  // 平滑插值（指数逼近），避免键盘/拖拽造成的突跳
  inspectionYaw = Math.abs(diff) > 0.0005
    ? inspectionYaw + diff * Math.min(1, dt * 10)
    : inspectionYawTarget;

  // P11: 俯仰同样做阻尼插值
  const pitchDiff = inspectionPitchTarget - inspectionPitch;
  inspectionPitch = Math.abs(pitchDiff) > 0.0005
    ? inspectionPitch + pitchDiff * Math.min(1, dt * 10)
    : inspectionPitchTarget;

  // P12: 缩放阻尼 —— FOV 平滑逼近目标值，避免滚轮/按键造成画面抖动
  if (inspectionFovTarget != null) {
    const fovDiff = inspectionFovTarget - camera.fov;
    if (Math.abs(fovDiff) > 0.05) {
      camera.fov += fovDiff * Math.min(1, dt * 8);
      camera.updateProjectionMatrix();
    } else if (camera.fov !== inspectionFovTarget) {
      camera.fov = inspectionFovTarget;
      camera.updateProjectionMatrix();
    }
  }

  camera.position.copy(inspectionCameraPos);
  // 先绕世界 Y 轴偏航，再绕"局部右向量"俯仰 —— 两者互不干扰，不会发生万向节翻转
  inspectionForward.copy(inspectionBaseForward).applyAxisAngle(INSPECTION_Y_AXIS, inspectionYaw);
  inspectionRight.crossVectors(inspectionForward, INSPECTION_Y_AXIS).normalize();
  inspectionForward.applyAxisAngle(inspectionRight, inspectionPitch);
  inspectionLookAt.copy(camera.position).add(inspectionForward);
  camera.lookAt(inspectionLookAt);
}

function shortestAngleDelta(from, to) {
  const fullTurn = Math.PI * 2;
  return ((to - from + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
}

function transitionCameraTo(nextTarget, nextRadius, nextTheta, nextPhi) {
  if (inspectionMode) return;
  cameraTransition = {
    fromTarget: target.clone(),
    toTarget: nextTarget.clone(),
    fromRadius: radius,
    toRadius: nextRadius,
    fromTheta: theta,
    thetaDelta: shortestAngleDelta(theta, nextTheta),
    fromPhi: phi,
    toPhi: nextPhi,
    elapsed: 0,
    duration: 0.45,
  };
}

function updateCameraTransition(dt) {
  if (inspectionMode || !cameraTransition) return;
  const transition = cameraTransition;
  transition.elapsed = Math.min(transition.elapsed + dt, transition.duration);
  const progress = transition.elapsed / transition.duration;
  const eased = progress * progress * (3 - 2 * progress);
  target.lerpVectors(transition.fromTarget, transition.toTarget, eased);
  radius = THREE.MathUtils.lerp(transition.fromRadius, transition.toRadius, eased);
  theta = transition.fromTheta + transition.thetaDelta * eased;
  phi = THREE.MathUtils.lerp(transition.fromPhi, transition.toPhi, eased);
  updateCamera();
  if (progress >= 1) cameraTransition = null;
}

function setupRings() {
  const ringGeo = new THREE.RingGeometry(4.1, 4.5, 48);
  ringGeo.rotateX(-Math.PI / 2);
  selectionRing = new THREE.Mesh(
    ringGeo,
    new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
  );
  selectionRing.position.y = 0.04;
  scene.add(selectionRing);

  const hoverGeo = new THREE.RingGeometry(3.9, 4.2, 40);
  hoverGeo.rotateX(-Math.PI / 2);
  hoverRing = new THREE.Mesh(
    hoverGeo,
    new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
  );
  hoverRing.position.y = 0.03;
  scene.add(hoverRing);
}

function createWeatherStreaks(count, isRain) {
  const positions = new Float32Array(count * 6);
  const linePhases = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const offset = i * 6;
    const x = (Math.random() - 0.5) * weatherHalfWidth * 2;
    const y = isRain ? 9 + Math.random() * 13 : 7 + Math.random() * 6;
    const z = (Math.random() - 0.5) * weatherHalfDepth * 2;
    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = z;
    positions[offset + 3] = x + (isRain ? 0.22 : 2.8);
    positions[offset + 4] = y - (isRain ? 1.25 : 0.08);
    positions[offset + 5] = z + 0.08;
    const phase = Math.random() * 24;
    linePhases[i * 2] = phase;
    linePhases[i * 2 + 1] = phase;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aLinePhase", new THREE.BufferAttribute(linePhases, 1));
  const uniforms = isRain
    ? {
        uTime: { value: 0 },
        uSpeed: { value: 26 },
        uColor: { value: new THREE.Color(0x9bdcff) },
        uOpacity: { value: 0.72 },
      }
    : null;
  const material = isRain
    ? new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        vertexShader: `
          attribute float aLinePhase;
          uniform float uTime;
          uniform float uSpeed;
          void main() {
            vec3 p = position;
            float travel = mod(uTime * uSpeed + aLinePhase, 24.0);
            p.y = mod(p.y - travel + 24.0, 24.0);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uOpacity;
          void main() {
            gl_FragColor = vec4(uColor, uOpacity);
          }
        `,
      })
    : new THREE.LineBasicMaterial({
        color: 0xc3d1db,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  lines.visible = false;
  return { lines, geometry, positions: isRain ? null : positions, uniforms };
}

function setupWeatherEffects() {
  weatherGroup = new THREE.Group();
  weatherGroup.position.x = weatherCenterX;
  scene.add(weatherGroup);

  const rain = createWeatherStreaks(180, true);
  rainStreaks = rain.lines;
  rainGeometry = rain.geometry;
  rainUniforms = rain.uniforms;
  rainLineCount = 180;
  weatherGroup.add(rainStreaks);

  const wind = createWeatherStreaks(100, false);
  windStreaks = wind.lines;
  windGeometry = wind.geometry;
  windPositions = wind.positions;
  weatherGroup.add(windStreaks);

  cloudGroup = new THREE.Group();
  cloudMaterial = new THREE.MeshBasicMaterial({
    color: 0x8999a8,
    transparent: true,
    opacity: 0.84,
    depthTest: false,
    depthWrite: false,
  });
  const cloudShape = new THREE.SphereGeometry(1, 12, 8);
  for (let i = 0; i < 5; i++) {
    const cloud = new THREE.Group();
    const width = 3.5 + Math.random() * 1.3;
    cloud.position.set((i - 3) * 3.5 + (Math.random() - 0.5), 2.5 + Math.random() * 2.5, -15);
    cloud.scale.set(width, 1.15 + Math.random() * 0.6, 1.8 + Math.random() * 1.4);
    for (let puff = 0; puff < 3; puff++) {
      const mesh = new THREE.Mesh(cloudShape, cloudMaterial);
      mesh.position.set((puff - 1.5) * 0.52, Math.sin(puff * 1.7) * 0.12, (puff % 2) * 0.2);
      mesh.scale.set(0.75 + Math.random() * 0.3, 0.5 + Math.random() * 0.28, 0.68 + Math.random() * 0.24);
      cloud.add(mesh);
    }
    cloud.userData.phase = i * 1.9;
    clouds.push(cloud);
    cloudGroup.add(cloud);
  }
  cloudGroup.visible = false;
  camera.add(cloudGroup);

  sunGroup = new THREE.Group();
  sunGroup.position.set(-6, 4.5, -15);
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(2.1, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd77b })
  );
  const sunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(3.5, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xffc763, transparent: true, opacity: 0.17, depthWrite: false })
  );
  sunGroup.add(sunHalo, sunDisc);
  sunGroup.visible = false;
  camera.add(sunGroup);
}

function setupStars() {
  const count = 520;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 90 + Math.random() * 60;
    const a = Math.random() * Math.PI * 2;
    const b = Math.random() * Math.PI * 0.5;
    positions[i * 3] = Math.cos(a) * Math.cos(b) * r;
    positions[i * 3 + 1] = Math.sin(b) * r + 6;
    positions[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  starField = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0x9fc8ff, size: 0.7, transparent: true, opacity: 0.55, depthWrite: false })
  );
  scene.add(starField);
}

function applyWeather() {
  if (!weatherGroup) return;
  // 视觉效果按 snapshot 数值阈值触发（交接文档 P1 要求）
  const isRain = shouldShowRain(currentSnapshot);
  const windStrength = computeWindStrength(currentSnapshot); // 0~1
  const isCloudy = currentSnapshot.key === "cloudy" || currentSnapshot.light < 12000;
  const isSunny = !isRain && !isCloudy && currentSnapshot.wind < 3;
  const isWindy = windStrength > 0.5;

  rainStreaks.visible = isRain;
  windStreaks.visible = isWindy;
  cloudGroup.visible = isCloudy || isRain || isWindy;
  sunGroup.visible = isSunny;
  cloudMaterial.opacity = isRain ? 0.97 : isCloudy ? 0.78 : 0.46;
  cloudMaterial.color.setHex(isRain ? 0x586776 : isCloudy ? 0x7d8c99 : 0xa6b8c5);

  if (sunLight) sunLight.intensity = isSunny ? 1.65 : isRain ? 0.52 : isCloudy ? 0.76 : 0.96;
  if (ambientLight) ambientLight.intensity = isSunny ? 0.88 : isRain ? 0.46 : isCloudy ? 0.62 : 0.7;
  if (hemisphereLight) hemisphereLight.intensity = isSunny ? 0.8 : isRain ? 0.4 : isCloudy ? 0.58 : 0.66;

  scene.background.setHex(isRain ? 0x172431 : isCloudy ? 0x273440 : isWindy ? 0x263645 : 0x344c61);
  scene.fog.color.setHex(isRain ? 0x172431 : isCloudy ? 0x202c36 : isWindy ? 0x1b2b38 : 0x0a0e17);
  scene.fog.near = isRain ? 28 : isCloudy ? 36 : 40;
  scene.fog.far = isRain ? 250 : isCloudy ? 290 : 320;
  if (starField) starField.visible = false;
  if (!isRain && renderPixelScale !== 1) setRenderPixelScale(1);
}

function setRenderPixelScale(scale) {
  if (!renderer) return;
  const next = THREE.MathUtils.clamp(scale, 0.65, 1);
  if (Math.abs(next - renderPixelScale) < 0.01) return;
  renderPixelScale = next;
  renderer.setPixelRatio(next);
}

function adjustRainQuality(fpsValue) {
  if (!rainGeometry || !rainUniforms) return;
  const nextScale = fpsValue > 0 && fpsValue < 26
    ? 0.5
    : fpsValue < 30
      ? 0.68
      : fpsValue < 35
        ? 0.84
      : 1;
  if (nextScale !== rainQualityScale) {
    rainQualityScale = nextScale;
    const lines = Math.max(48, Math.floor(rainLineCount * nextScale));
    rainGeometry.setDrawRange(0, lines * 2);
    rainUniforms.uOpacity.value = nextScale < 1 ? 0.6 : 0.72;
  }
  const pixelScale = fpsValue > 0 && fpsValue < 27
    ? 0.72
    : fpsValue < 32
      ? 0.84
      : 1;
  setRenderPixelScale(pixelScale);
}

function updateWeatherEffects(t, dt) {
  if (rainUniforms) rainUniforms.uTime.value = t;
  if (computeWindStrength(currentSnapshot) > 0.5 && windPositions) {
    for (let i = 0; i < windPositions.length; i += 6) {
      windPositions[i] += dt * 12;
      windPositions[i + 3] += dt * 12;
      if (windPositions[i] > weatherHalfWidth) {
        const x = -weatherHalfWidth;
        const y = 7 + Math.random() * 6;
        const z = (Math.random() - 0.5) * weatherHalfDepth * 2;
        windPositions[i] = x;
        windPositions[i + 1] = y;
        windPositions[i + 2] = z;
        windPositions[i + 3] = x + 2.8;
        windPositions[i + 4] = y - 0.08;
        windPositions[i + 5] = z + 0.08;
      }
    }
    windGeometry.attributes.position.needsUpdate = true;
  }
  if (cloudGroup && cloudGroup.visible) {
    const drift = computeWindStrength(currentSnapshot) > 0.5
      ? 2.3
      : shouldShowRain(currentSnapshot)
      ? 0.52
      : 0.28;
    clouds.forEach((cloud) => {
      cloud.position.x += dt * drift;
      cloud.position.y += dt * Math.sin(t * 0.4 + cloud.userData.phase) * 0.08;
      if (cloud.position.x > 36) cloud.position.x = -36;
    });
  }
}

// —— 拾取 ——
function pickAt(clientX, clientY) {
  if (!farm || !renderer) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const componentHits = raycaster.intersectObjects(farm.componentPickables, true);
  for (const hit of componentHits) {
    let object = hit.object;
    while (object && !object.userData.componentId) object = object.parent;
    if (object) return { kind: "component", id: object.userData.componentId };
  }

  const hits = raycaster.intersectObjects(farm.pickables, false);
  for (const hit of hits) {
    const id = hit.object.userData.objectId;
    if (id) return { kind: "plot", id, point: hit.point.clone() };
  }

  // P7: 大田外围底板 —— 给全局设备提供落点
  if (farm.groundMesh) {
    const groundHits = raycaster.intersectObject(farm.groundMesh, false);
    if (groundHits.length) {
      return { kind: "ground", point: groundHits[0].point.clone() };
    }
  }
  return null;
}

function pointOnHorizontalPlane(clientX, clientY, planeY) {
  if (!renderer || !camera) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  dragPlane.constant = -planeY;
  return raycaster.ray.intersectPlane(dragPlane, dragWorldPoint)
    ? dragWorldPoint.clone()
    : null;
}

function moveDraggedComponent(clientX, clientY) {
  if (!farm || !draggedComponentId) return;
  const entry = farm.componentRegistry.get(draggedComponentId);
  const component = entry?.component;
  if (!component) return;
  const isGlobal = component.plotId === GLOBAL_PLOT_ID;

  if (isGlobal) {
    const point = pointOnHorizontalPlane(clientX, clientY, -0.6);
    if (!point) return;
    const placement = {
      x: THREE.MathUtils.clamp(point.x, -42, 122),
      z: THREE.MathUtils.clamp(point.z, -42, 42),
      rotationY: component.placement?.rotationY ?? 0,
    };
    componentManagerUpdatePlacement(component.id, placement);
    entry.group.position.set(placement.x, -0.6, placement.z);
    entry.group.rotation.y = placement.rotationY;
    entry.group.updateMatrixWorld(true);
    return;
  }

  const plot = farm.registry.get(component.plotId);
  if (!plot) return;
  const plotWorld = plot.group.getWorldPosition(new THREE.Vector3());
  const point = pointOnHorizontalPlane(clientX, clientY, plotWorld.y);
  if (!point) return;
  const localPoint = plot.group.worldToLocal(point.clone());
  const x = THREE.MathUtils.clamp(localPoint.x, -4.2, 4.2);
  const z = THREE.MathUtils.clamp(localPoint.z, -4.2, 4.2);
  const rotationY = component.type === "sunshade" ? 0 : Math.atan2(x, z);
  const placement = { x, z, rotationY };
  componentManagerUpdatePlacement(component.id, placement);
  entry.group.position.set(x, 0.02, z);
  entry.group.rotation.y = rotationY;
  entry.group.updateMatrixWorld(true);
}

function componentManagerUpdatePlacement(componentId, placement) {
  props.componentManager?.updatePlacement?.(componentId, placement);
}

function onPointerDown(e) {
  // P6: 巡检模式下，左键拖拽 = 云台左右摇镜头 / 上下俯仰
  if (inspectionMode) {
    inspectionDragging = true;
    inspectionLastX = e.clientX;
    inspectionLastY = e.clientY;
    if (renderer) renderer.domElement.style.cursor = "move";
    return;
  }
  if (e.button === 0 && !e.altKey) {
    const picked = pickAt(e.clientX, e.clientY);
    if (picked?.kind === "component") {
      componentDragging = true;
      draggedComponentId = picked.id;
      componentDragMoved = false;
      canvasDown = true;
      dragging = false;
      panning = false;
      downX = e.clientX;
      downY = e.clientY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (renderer) renderer.domElement.style.cursor = "move";
      e.preventDefault();
      return;
    }
  }
  cameraTransition = null;
  // 左键平移，右键或 Alt+左键旋转，贴近地图/看片操作。
  panning = e.button === 1 || (e.button === 0 && !e.altKey);
  if (panning) e.preventDefault();
  canvasDown = true;
  dragging = true;
  autoRotate = false;
  if (renderer) renderer.domElement.style.cursor = "grabbing";
  lastX = e.clientX;
  lastY = e.clientY;
  downX = e.clientX;
  downY = e.clientY;
}

function onPointerMove(e) {
  // P6: 巡检云台拖拽 —— 右拖看右（偏航角减小），限制 ±90°
  if (inspectionMode) {
    if (!inspectionDragging) return;
    const dx = e.clientX - inspectionLastX;
    const dy = e.clientY - inspectionLastY;
    inspectionLastX = e.clientX;
    inspectionLastY = e.clientY;
    inspectionYawTarget = THREE.MathUtils.clamp(
      inspectionYawTarget - dx * 0.004,
      -INSPECTION_MAX_YAW,
      INSPECTION_MAX_YAW
    );
    // P11: 上拖抬头、下拖低头（相对初始视角 ±60°，并做安全限幅）
    inspectionPitchTarget = clampInspectionPitch(inspectionPitchTarget - dy * 0.004);
    return;
  }
  if (componentDragging) {
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 2) {
      componentDragMoved = true;
    }
    lastX = e.clientX;
    lastY = e.clientY;
    if (componentDragMoved) moveDraggedComponent(e.clientX, e.clientY);
    return;
  }
  if (dragging) {
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    if (panning) {
      camera.updateMatrixWorld();
      panRight.setFromMatrixColumn(camera.matrixWorld, 0);
      panRight.y = 0;
      panRight.normalize();
      panUp.setFromMatrixColumn(camera.matrixWorld, 1);
      panUp.y = 0;
      panUp.normalize();
      const scale = radius * 0.0018;
      target.addScaledVector(panRight, -dx * scale);
      target.addScaledVector(panUp, -dy * scale);
      target.x = THREE.MathUtils.clamp(target.x, -20, 120);
      target.z = THREE.MathUtils.clamp(target.z, -60, 60);
    } else {
      theta -= dx * 0.005;
      phi -= dy * 0.004;
      phi = Math.max(0.18, Math.min(Math.PI / 2 - 0.05, phi));
    }
    updateCamera();
    return;
  }
  const picked = pickAt(e.clientX, e.clientY);
  hoveredId = picked?.kind === "plot" ? picked.id : null;
  if (renderer) {
    renderer.domElement.style.cursor =
      picked?.kind === "plot" || picked?.kind === "component" ? "pointer" : "grab";
  }
}

function onPointerUp(e) {
  if (inspectionMode) {
    inspectionDragging = false;
    if (renderer) renderer.domElement.style.cursor = "move";
    return;
  }
  if (componentDragging) {
    const componentId = draggedComponentId;
    const moved = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY);
    componentDragging = false;
    draggedComponentId = null;
    componentDragMoved = false;
    canvasDown = false;
    if (renderer) renderer.domElement.style.cursor = "grab";
    if (componentId) {
      const entry = farm?.componentRegistry.get(componentId);
      if (entry?.component) {
        setSelected(null, { focusCamera: false });
        emit("component-select", entry.component);
      }
    }
    return;
  }
  if (!canvasDown) return;
  canvasDown = false;
  const moved = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY);
  dragging = false;
  panning = false;
  if (e.button === 0 && moved < 6) {
    const picked = pickAt(e.clientX, e.clientY);
    if (picked?.kind === "component") {
      hoveredId = null;
      // 选中装置只更新详情面板，不改变用户当前观察视角。
      setSelected(null, { focusCamera: false });
      const entry = farm.componentRegistry.get(picked.id);
      const component = entry?.component || null;
      emit("component-select", component);
    } else if (picked?.kind === "ground") {
      // P7: 命中大田外围底板 —— 交给上层判断是否处于放置模式
      hoveredId = null;
      setSelected(null);
      emit("select", null);
      emit("ground-click", { point: picked.point });
    } else {
      const id = picked?.id || null;
      setSelected(id);
      const entry = id ? farm.registry.get(id) : null;
      const meta = entry?.meta || null;
      const localPoint = picked?.point && entry?.group
        ? entry.group.worldToLocal(picked.point.clone())
        : null;
      emit(
        "select",
        meta
          ? {
              ...meta,
              placementPoint: localPoint
                ? { x: localPoint.x, z: localPoint.z }
                : null,
            }
          : null
      );
    }
  }
  if (renderer) renderer.domElement.style.cursor = "grab";
}

function onWheel(e) {
  e.preventDefault();
  // P12: 巡检模式下滚轮缩放镜头（上滚放大 / 下滚拉远），由 FOV 阻尼插值实现
  if (inspectionMode) {
    adjustInspectionZoom(e.deltaY * 0.02);
    return;
  }
  cameraTransition = null;
  radius += e.deltaY * 0.022;
  radius = Math.max(8, Math.min(240, radius));
  updateCamera();
}

function onContextMenu(e) {
  e.preventDefault();
}

// P6: 巡检云台键盘控制 —— A/← 左摇，D/→ 右摇，限幅 ±90°
function onInspectionKeyDown(e) {
  if (!inspectionMode) return;
  // 正在输入框/滑块里操作时不抢键
  const target = e.target;
  const tagName = target?.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target?.isContentEditable) {
    return;
  }
  const key = e.key;
  if (key === "a" || key === "A" || key === "ArrowLeft") {
    inspectionYawTarget = Math.min(inspectionYawTarget + 0.12, INSPECTION_MAX_YAW);
    e.preventDefault();
  } else if (key === "d" || key === "D" || key === "ArrowRight") {
    inspectionYawTarget = Math.max(inspectionYawTarget - 0.12, -INSPECTION_MAX_YAW);
    e.preventDefault();
  } else if (key === "w" || key === "W" || key === "ArrowUp") {
    // P11: 抬头
    inspectionPitchTarget = clampInspectionPitch(inspectionPitchTarget + 0.08);
    e.preventDefault();
  } else if (key === "s" || key === "S" || key === "ArrowDown") {
    // P11: 低头
    inspectionPitchTarget = clampInspectionPitch(inspectionPitchTarget - 0.08);
    e.preventDefault();
  } else if (key === "q" || key === "Q" || key === "+" || key === "=") {
    // P12: 放大（FOV 变小）
    adjustInspectionZoom(-2);
    e.preventDefault();
  } else if (key === "e" || key === "E" || key === "-" || key === "_") {
    // P12: 拉远（FOV 变大）
    adjustInspectionZoom(2);
    e.preventDefault();
  }
}

function setSelected(id, { focusCamera = true } = {}) {
  const previousId = selectedId;
  selectedId = id;
  if (!id || !farm) {
    label.visible = false;
    if (previousId && focusCamera) {
      transitionCameraTo(new THREE.Vector3(40, 1.5, 0), 150, 0, Math.PI / 3);
    }
    return;
  }
  const entry = farm.registry.get(id);
  if (!entry) {
    label.visible = false;
    return;
  }
  const worldPosition = entry.group.getWorldPosition(new THREE.Vector3());
  selectionRing.position.set(
    worldPosition.x,
    worldPosition.y + entry.top + 0.03,
    worldPosition.z
  );
  label.name = entry.meta?.name || id;
  label.status = entry.meta?.status || "normal";
  label.visible = true;
  if (focusCamera) {
    transitionCameraTo(
      new THREE.Vector3(worldPosition.x, worldPosition.y + 0.5, worldPosition.z),
      18,
      theta,
      phi
    );
  }
}

function flashObject(id, color = 0xff3b30, duration = 1400, scaleUp = true) {
  if (!farm) return;
  const entry = farm.registry.get(id);
  if (!entry) return;

  const existing = flashes.get(id);
  if (existing) {
    clearTimeout(existing.timer);
    existing.light.parent && existing.light.parent.remove(existing.light);
    // 先把上一次放大还原，否则连续点击会不断叠加缩放
    entry.group.scale.setScalar(existing.baseScale);
    flashes.delete(id);
  }

  const light = new THREE.PointLight(color, 3, 14, 2);
  light.position.set(0, entry.top + 0.2, 0);
  entry.group.add(light);
  const baseScale = entry.group.scale.x;
  // 关闭设备时只做光效，不再放大，保证取消后回到原始大小
  if (scaleUp) entry.group.scale.setScalar(baseScale * 1.08);

  const timer = setTimeout(() => {
    entry.group.scale.setScalar(baseScale);
    if (light.parent) light.parent.remove(light);
    flashes.delete(id);
  }, duration);
  flashes.set(id, { light, timer, baseScale });
}

function focusObject(id) {
  setSelected(id);
}

// P7: 告警聚合高亮 —— 一次性点亮同类全部地块（矩形边框 + 半透明填充）
let alertHighlightGroup = null;
let alertHighlightTimer = 0;
let alertHighlightMaterials = [];

function clearPlotHighlights() {
  if (alertHighlightTimer) {
    clearTimeout(alertHighlightTimer);
    alertHighlightTimer = 0;
  }
  if (!alertHighlightGroup) return;
  alertHighlightGroup.children.forEach((child) => child.geometry?.dispose());
  alertHighlightGroup.clear();
  alertHighlightMaterials.forEach((material) => material.dispose());
  alertHighlightMaterials = [];
}

function highlightPlots(ids, color = 0xfbbf24, duration = 3000) {
  if (!farm || !Array.isArray(ids) || ids.length === 0) return;
  if (!alertHighlightGroup) {
    alertHighlightGroup = new THREE.Group();
    alertHighlightGroup.name = "AlertHighlights";
    scene.add(alertHighlightGroup);
  }
  clearPlotHighlights();

  const fillMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const edgeMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
  alertHighlightMaterials = [fillMaterial, edgeMaterial];

  ids.forEach((id) => {
    const entry = farm.registry.get(id);
    if (!entry?.waterMesh) return;
    const world = entry.group.getWorldPosition(new THREE.Vector3());
    const size = (entry.waterMesh.geometry?.parameters?.width ?? 10) - 0.6;
    const plane = new THREE.PlaneGeometry(size, size);
    const fill = new THREE.Mesh(plane, fillMaterial);
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(world.x, world.y + (entry.top ?? 0.05) + 0.02, world.z);
    // 亮色边框（地块四边），比纯填充更容易在俯视视角看清
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(plane), edgeMaterial);
    edges.rotation.x = -Math.PI / 2;
    edges.position.set(fill.position.x, fill.position.y + 0.01, fill.position.z);
    alertHighlightGroup.add(fill, edges);
  });

  alertHighlightTimer = setTimeout(clearPlotHighlights, duration);
}

function resetView() {
  if (inspectionMode) exitInspectionView();
  autoRotate = false;
  setSelected(null, { focusCamera: false });
  emit("select", null);
  focusRegion("all");
}

function focusRegion(region = "all") {
  if (inspectionMode) exitInspectionView();
  autoRotate = false;
  const normalized = Object.prototype.hasOwnProperty.call(REGION_TARGET_X, region)
    ? region
    : "all";
  emit("view-change", normalized);
  transitionCameraTo(
    new THREE.Vector3(REGION_TARGET_X[normalized], 1.5, 0),
    normalized === "all" ? overviewRadius() : 86,
    0,
    Math.PI / 3
  );
}

function enterInspectionView(componentId) {
  if (inspectionMode || !farm) return false;
  const entry = farm.componentRegistry.get(componentId);
  if (!entry || entry.component.type !== "camera" || !entry.component.enabled) {
    return false;
  }

  cameraTransition = null;
  autoRotate = false;
  savedOrbitState = {
    target: target.clone(),
    radius,
    theta,
    phi,
  };

  const position = entry.group.getWorldPosition(new THREE.Vector3());
  const rotation = entry.group.getWorldQuaternion(new THREE.Quaternion());
  const deviceForward = new THREE.Vector3(0, 0, -1).applyQuaternion(rotation).normalize();

  // P10: 全局摄像头没有所属地块 —— 初始 lookAt 强制死盯全场几何中心 (40, 0, 0)
  const isGlobalCamera = entry.component.plotId === GLOBAL_PLOT_ID;
  const plotCenter = isGlobalCamera
    ? SCENE_CENTER.clone()
    : entry.group.parent
      ? entry.group.parent.getWorldPosition(new THREE.Vector3())
      : position.clone().addScaledVector(deviceForward, 8);

  // P7: 机位高度按模型实际云台高度计算（全局塔顶约 15.6m，田内约 3.7m），不能贴地
  const headLocalY = entry.group.userData.cameraHeadY ?? 1.06;
  const worldScaleY = entry.group.getWorldScale(new THREE.Vector3()).y || 1;
  const cameraPosition = position.clone().addScaledVector(deviceForward, 1.15);
  cameraPosition.y = position.y + headLocalY * worldScaleY + 0.06;
  // 注视点：全局摄像头死盯全场中心；田内摄像头望向所属地块中心
  const inspectionTarget = isGlobalCamera
    ? SCENE_CENTER.clone()
    : new THREE.Vector3(plotCenter.x, plotCenter.y + 0.6, plotCenter.z);

  // P10: 打印机位 / 注视点 / 模型前向，便于核对朝向是否正确
  console.log(
    `[巡检] ${componentId} 机位=(${cameraPosition.x.toFixed(2)}, ${cameraPosition.y.toFixed(2)}, ${cameraPosition.z.toFixed(2)})`,
    `lookAt=(${inspectionTarget.x.toFixed(2)}, ${inspectionTarget.y.toFixed(2)}, ${inspectionTarget.z.toFixed(2)})`,
    `模型前向=(${deviceForward.x.toFixed(2)}, ${deviceForward.y.toFixed(2)}, ${deviceForward.z.toFixed(2)})`
  );

  const offset = cameraPosition.clone().sub(inspectionTarget);
  radius = Math.max(offset.length(), 1);
  theta = Math.atan2(offset.x, offset.z);
  phi = Math.acos(THREE.MathUtils.clamp(offset.y / radius, -1, 1));
  target.copy(inspectionTarget);

  // P6: 云台基准 —— 机位固定，正前方即 baseYaw = 0，左右各 ±90°
  inspectionCameraPos = cameraPosition.clone();
  inspectionBaseForward = inspectionTarget.clone().sub(cameraPosition).normalize();
  inspectionYaw = 0;
  inspectionYawTarget = 0;
  inspectionPitch = 0;
  inspectionPitchTarget = 0;
  inspectionDragging = false;

  // 500ms 平滑推进：位置 lerp + 朝向 slerp，从当前全局视角切入巡检机位
  const targetQuat = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(inspectionCameraPos, inspectionTarget, camera.up)
  );
  // P10: 全局巡检时视野放大到 70°，过渡期间平滑过渡 FOV
  inspectionBaseFov = camera.fov;
  const targetFov = isGlobalCamera ? INSPECTION_GLOBAL_FOV : camera.fov;
  inspectionFovTarget = targetFov;
  inspectionTransition = {
    elapsed: 0,
    duration: INSPECTION_TRANSITION_MS,
    fromPos: camera.position.clone(),
    toPos: inspectionCameraPos.clone(),
    fromQuat: camera.quaternion.clone(),
    toQuat: targetQuat,
    fromFov: camera.fov,
    toFov: targetFov,
  };

  inspectionMode = true;
  if (renderer) renderer.domElement.style.cursor = "move";
  return true;
}

function exitInspectionView() {
  if (!inspectionMode || !savedOrbitState) return false;
  cameraTransition = null;
  inspectionMode = false;
  // P6: 清空云台状态，回到轨道相机
  inspectionCameraPos = null;
  inspectionBaseForward = null;
  inspectionYaw = 0;
  inspectionYawTarget = 0;
  inspectionPitch = 0;
  inspectionPitchTarget = 0;
  inspectionDragging = false;
  inspectionTransition = null;
  inspectionFovTarget = null;
  if (inspectionBaseFov != null) {
    camera.fov = inspectionBaseFov;
    camera.updateProjectionMatrix();
    inspectionBaseFov = null;
  }
  target.copy(savedOrbitState.target);
  radius = savedOrbitState.radius;
  theta = savedOrbitState.theta;
  phi = savedOrbitState.phi;
  savedOrbitState = null;
  if (renderer) renderer.domElement.style.cursor = "grab";
  updateCamera();
  return true;
}

defineExpose({
  flashObject,
  focusObject,
  focusRegion,
  resetView,
  selectObject: setSelected,
  syncComponents: () => farm?.syncComponents(),
  dispatchNow: () => farm?.dispatchNow(),
  enterInspectionView,
  exitInspectionView,
  highlightPlots,
  clearPlotHighlights,
});

function rebuild() {
  clearPlotHighlights();
  if (farm) {
    scene.remove(farm.root);
    farm.dispose();
  }
  farm = createPaddyFieldScene(props.plotStates, props.componentManager);
  scene.add(farm.root);
  setSelected(selectedId);
}

function disposeGroupResources(group) {
  const geometries = new Set();
  const materials = new Set();
  group.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
    else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

onMounted(() => {
  const el = container.value;
  const w = el.clientWidth || 1;
  const h = el.clientHeight || 1;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0e17);
  scene.fog = new THREE.Fog(0x0a0e17, 120, 320);

  camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 500);

  renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  // P4 性能优化：pixelRatio 锁 1（GPU 像素量 -75% on HiDPI 屏）
  renderer.setPixelRatio(1);
  renderer.setSize(w, h);
  // P4 性能优化：彻底关阴影（稻田大面积阴影计算极贵）
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = "block";
  el.appendChild(renderer.domElement);

  hemisphereLight = new THREE.HemisphereLight(0x8fd9ff, 0x1c2a26, 0.65);
  scene.add(hemisphereLight);
  ambientLight = new THREE.AmbientLight(0x22304a, 0.9);
  scene.add(ambientLight);

  sunLight = new THREE.DirectionalLight(0xfff3d6, 1.6);
  sunLight.position.set(24, 34, 16);
  // P4: 关阴影投射
  sunLight.castShadow = false;
  scene.add(sunLight);

  const rim = new THREE.PointLight(0x00e5ff, 1.6, 80);
  rim.position.set(-18, 14, -14);
  scene.add(rim);
  const rim2 = new THREE.PointLight(0x3d8bff, 1.1, 70);
  rim2.position.set(22, 10, 18);
  scene.add(rim2);

  clock = new THREE.Clock();
  setupRings();
  setupWeatherEffects();
  setupStars();
  rebuild();
  applyWeather();

  radius = overviewRadius();
  updateCamera();

  const dom = renderer.domElement;
  dom.addEventListener("pointerdown", onPointerDown);
  dom.addEventListener("contextmenu", onContextMenu);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onInspectionKeyDown);
  dom.addEventListener("wheel", onWheel, { passive: false });

  resizeObserver = new ResizeObserver(() => {
    const nw = el.clientWidth;
    const nh = el.clientHeight;
    if (!nw || !nh) return;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });
  resizeObserver.observe(el);

  const tmp = new THREE.Vector3();

  const animate = () => {
    rafId = requestAnimationFrame(animate);
    if (showFps) {
      const now = performance.now();
      if (!fpsWindowStart) fpsWindowStart = now;
      fpsFrameCount += 1;
      const elapsed = now - fpsWindowStart;
      if (elapsed >= 1000) {
        const fpsValue = Math.round((fpsFrameCount * 1000) / elapsed);
        fps.value = String(fpsValue);
        adjustRainQuality(fpsValue);
        fpsFrameCount = 0;
        fpsWindowStart = now;
      }
    }

    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    if (autoRotate && !dragging) {
      theta += dt * 0.09;
      updateCamera();
    }

    updateCameraTransition(dt);
    // P6: 巡检云台插值（只改相机姿态，不触发场景重建）
    updateInspectionCamera(dt);
    farm.update(t, dt, {
      weather: currentWeather,              // 旧字段，向后兼容
      weatherSnapshot: currentSnapshot,      // 新字段，来自 weatherState.js
      selectedPlotId: selectedId,
      // P3 性能：给水稻实例批次做距离 LOD（巡检视角恒为近距）
      cameraDistance: inspectionMode ? 0 : camera.position.distanceTo(target),
      harvestAmount: props.harvestAmount,
    });

    updateWeatherEffects(t, dt);

    if (starField) starField.rotation.y += dt * 0.008;

    // 选中 / 悬停指示环
    if (selectionRing) {
      const want = selectedId ? 0.55 : 0;
      selectionRing.material.opacity += (want - selectionRing.material.opacity) * Math.min(1, dt * 6);
      selectionRing.scale.setScalar(1 + Math.sin(t * 2.4) * 0.05);
      const selectedEntry = selectedId && farm.registry.get(selectedId);
      if (selectedEntry) {
        const worldPosition = selectedEntry.group.getWorldPosition(new THREE.Vector3());
        selectionRing.position.set(
          worldPosition.x,
          worldPosition.y + selectedEntry.top + 0.03,
          worldPosition.z
        );
      }
    }
    if (hoverRing) {
      const hoverEntry = hoveredId && farm.registry.get(hoveredId);
      if (hoverEntry) {
        const worldPosition = hoverEntry.group.getWorldPosition(new THREE.Vector3());
        hoverRing.position.set(
          worldPosition.x,
          worldPosition.y + hoverEntry.top + 0.02,
          worldPosition.z
        );
      }
      const want = hoverEntry && hoveredId !== selectedId ? 0.28 : 0;
      hoverRing.material.opacity += (want - hoverRing.material.opacity) * Math.min(1, dt * 8);
    }

    // 选中标签跟随投影
    if (label.visible && selectedId && farm) {
      const entry = farm.registry.get(selectedId);
      if (entry) {
        const worldPosition = entry.group.getWorldPosition(new THREE.Vector3());
        tmp.set(worldPosition.x, worldPosition.y + entry.top + 0.9, worldPosition.z);
        tmp.project(camera);
        const rect = renderer.domElement.getBoundingClientRect();
        label.x = (tmp.x * 0.5 + 0.5) * rect.width;
        label.y = (-tmp.y * 0.5 + 0.5) * rect.height;
        label.visible = tmp.z < 1;
      }
    }

    renderer.render(scene, camera);
  };
  animate();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId);
  if (resizeObserver) resizeObserver.disconnect();
  const dom = renderer && renderer.domElement;
  if (dom) {
    dom.removeEventListener("pointerdown", onPointerDown);
    dom.removeEventListener("contextmenu", onContextMenu);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("keydown", onInspectionKeyDown);
    dom.removeEventListener("wheel", onWheel);
  }
  flashes.forEach((f) => clearTimeout(f.timer));
  flashes.clear();
  clearPlotHighlights();
  if (alertHighlightGroup) {
    scene.remove(alertHighlightGroup);
    alertHighlightGroup = null;
  }
  if (farm) farm.dispose();
  if (weatherGroup) disposeGroupResources(weatherGroup);
  if (cloudGroup) disposeGroupResources(cloudGroup);
  if (sunGroup) disposeGroupResources(sunGroup);
  if (starField) disposeGroupResources(starField);
  if (selectionRing) disposeGroupResources(selectionRing);
  if (hoverRing) disposeGroupResources(hoverRing);
  if (renderer) {
    renderer.dispose();
    if (dom && dom.parentNode) dom.parentNode.removeChild(dom);
  }
});

watch(
  () => props.plotStates,
  () => rebuild(),
  { deep: false }
);

watch(
  () => props.componentManager?.components.map((component) => [component.id, component.enabled]),
  () => farm?.syncComponents(),
  { deep: true }
);

watch(
  () => props.weatherSnapshot,
  (snap) => {
    if (snap) {
      currentSnapshot = snap;
      currentWeather = snap.key;
    } else {
      // fallback 到旧 weather prop
      currentSnapshot = ACTUAL_WEATHER_DEFAULTS;
      currentWeather = props.weather;
    }
    applyWeather();
  },
  { immediate: true }
);

// 旧 weather prop 也 watch 一下，向后兼容（没有传 weatherSnapshot 时用）
watch(
  () => props.weather,
  (w) => {
    if (!props.weatherSnapshot) {
      currentSnapshot = ACTUAL_WEATHER_DEFAULTS;
      currentWeather = w;
      applyWeather();
    }
  }
);

</script>

<template>
  <div class="twin-scene">
    <div ref="container" class="scene-canvas"></div>
    <button class="view-reset" type="button" aria-label="复位场景视角" @click="resetView">复位视角</button>
    <div v-if="showFps" class="fps-badge">FPS {{ fps }}</div>
    <div
      v-if="label.visible"
      class="obj-label"
      :class="'is-' + label.status"
      :style="{ left: label.x + 'px', top: label.y + 'px' }"
    >
      <span class="dot"></span>{{ label.name }}
    </div>
  </div>
</template>

<style scoped>
.twin-scene {
  position: absolute;
  inset: 0;
  background: #0a0e17;
  overflow: hidden;
}

.scene-canvas {
  width: 100%;
  height: 100%;
  touch-action: none;
}

.view-reset {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 2;
  padding: 7px 12px;
  border: 1px solid rgba(126, 181, 220, 0.28);
  border-radius: 999px;
  background: rgba(10, 20, 32, 0.76);
  color: #b7d8e8;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.fps-badge {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 20;
  padding: 6px 9px;
  border: 1px solid rgba(100, 230, 180, 0.34);
  border-radius: 8px;
  background: rgba(5, 17, 22, 0.82);
  color: #8af0bd;
  font: 600 11px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace;
  pointer-events: none;
}

.view-reset:hover {
  border-color: rgba(0, 229, 255, 0.55);
  background: rgba(13, 61, 81, 0.9);
  color: #e2fbff;
}

.view-reset:focus-visible {
  outline: 2px solid #5bd8f0;
  outline-offset: 2px;
}

.obj-label {
  position: absolute;
  transform: translate(-50%, -100%);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #dff4ff;
  background: rgba(10, 20, 32, 0.78);
  border: 1px solid rgba(0, 229, 255, 0.45);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
  pointer-events: none;
  white-space: nowrap;
}

.obj-label .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34d399;
}

.obj-label.is-warning .dot {
  background: #ff9f0a;
}

.obj-label.is-danger .dot {
  background: #ff3b30;
}

.scene-hint {
  position: absolute;
  left: 16px;
  bottom: 14px;
  font-size: 12px;
  color: rgba(190, 225, 240, 0.55);
  pointer-events: none;
  letter-spacing: 0.4px;
}
</style>

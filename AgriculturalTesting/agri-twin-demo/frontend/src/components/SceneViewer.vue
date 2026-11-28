<script setup>
// 浅色 3D 农场预览：用于孪生平台总览页，支持点击选中与高亮
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import * as THREE from "three";
import { createFarm } from "../scene/farmModels.js";

const props = defineProps({
  objects: { type: Array, default: () => [] },
});
const emit = defineEmits(["select"]);

const container = ref(null);

let renderer = null;
let scene = null;
let camera = null;
let rafId = 0;
let resizeObserver = null;
let farm = null;
let clock = null;
let selectionRing = null;
let selectedId = null;

const flashes = new Map();

const target = new THREE.Vector3(0, 1.5, 0);
let radius = 38;
let theta = Math.PI / 5;
let phi = Math.PI / 3;
let dragging = false;
let lastX = 0;
let lastY = 0;
let downX = 0;
let downY = 0;
let autoRotate = true;
let autoRotatePausedUntil = 0;
let canvasDown = false;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function updateCamera() {
  camera.position.set(
    target.x + radius * Math.sin(phi) * Math.sin(theta),
    Math.max(1.2, target.y + radius * Math.cos(phi)),
    target.z + radius * Math.sin(phi) * Math.cos(theta)
  );
  camera.lookAt(target);
}

function pickAt(clientX, clientY) {
  if (!farm || !renderer) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(farm.pickables, false);
  for (const hit of hits) {
    const id = hit.object.userData.objectId;
    if (id) return id;
  }
  return null;
}

function onPointerDown(e) {
  canvasDown = true;
  dragging = true;
  autoRotate = false;
  lastX = e.clientX;
  lastY = e.clientY;
  downX = e.clientX;
  downY = e.clientY;
}

function onPointerMove(e) {
  if (dragging) {
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    theta -= dx * 0.005;
    phi -= dy * 0.004;
    phi = Math.max(0.18, Math.min(Math.PI / 2 - 0.05, phi));
    updateCamera();
    return;
  }
  const id = pickAt(e.clientX, e.clientY);
  if (renderer) renderer.domElement.style.cursor = id ? "pointer" : "grab";
}

function onPointerUp(e) {
  if (!canvasDown) return;
  canvasDown = false;
  const moved = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY);
  dragging = false;
  if (moved < 6) {
    const id = pickAt(e.clientX, e.clientY);
    selectObject(id);
    emit("select", id ? farm.registry.get(id)?.meta || null : null);
  }
  autoRotatePausedUntil = performance.now() + 3000;
}

function onWheel(e) {
  e.preventDefault();
  radius += e.deltaY * 0.022;
  radius = Math.max(12, Math.min(70, radius));
  updateCamera();
}

function selectObject(id) {
  selectedId = id;
  if (!id || !farm) return;
  const entry = farm.registry.get(id);
  if (!entry) return;
  selectionRing.position.x = entry.group.position.x;
  selectionRing.position.z = entry.group.position.z;
}

function flashObject(id, color = 0xff3b30, duration = 1400) {
  if (!farm) return;
  const entry = farm.registry.get(id);
  if (!entry) return;
  const existing = flashes.get(id);
  if (existing) {
    clearTimeout(existing.timer);
    if (existing.light.parent) existing.light.parent.remove(existing.light);
    // 先把上一次放大还原，否则连续点击会不断叠加缩放
    entry.group.scale.setScalar(existing.baseScale);
  }
  const light = new THREE.PointLight(color, 3, 16, 2);
  light.position.set(0, entry.top + 0.2, 0);
  entry.group.add(light);
  const baseScale = entry.group.scale.x;
  entry.group.scale.setScalar(baseScale * 1.08);
  const timer = setTimeout(() => {
    entry.group.scale.setScalar(baseScale);
    if (light.parent) light.parent.remove(light);
    flashes.delete(id);
  }, duration);
  flashes.set(id, { light, timer, baseScale });
}

function focusObject(id) {
  const entry = farm && farm.registry.get(id);
  if (!entry) return;
  selectObject(id);
  target.set(entry.group.position.x, 1.2, entry.group.position.z);
  radius = 22;
  updateCamera();
}

function resetView() {
  target.set(0, 1.5, 0);
  radius = 38;
  theta = Math.PI / 5;
  phi = Math.PI / 3;
  selectObject(null);
  updateCamera();
}

defineExpose({ flashObject, focusObject, resetView, selectObject });

function rebuild() {
  if (farm) {
    scene.remove(farm.root);
    farm.dispose();
  }
  farm = createFarm({ objects: props.objects, theme: "light" });
  scene.add(farm.root);
  if (selectedId) selectObject(selectedId);
}

onMounted(() => {
  const el = container.value;
  const w = el.clientWidth || 1;
  const h = el.clientHeight || 1;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9eff2);
  scene.fog = new THREE.Fog(0xe9eff2, 55, 140);

  camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 400);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = "block";
  el.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa88f, 0.85));
  scene.add(new THREE.AmbientLight(0xbcd6e6, 0.55));

  const sun = new THREE.DirectionalLight(0xfff6e2, 2.1);
  sun.position.set(26, 36, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -34;
  sun.shadow.camera.right = 34;
  sun.shadow.camera.top = 34;
  sun.shadow.camera.bottom = -34;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 100;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xdcefff, 0.55);
  fill.position.set(-16, 12, -14);
  scene.add(fill);

  clock = new THREE.Clock();

  const ringGeo = new THREE.RingGeometry(1.9, 2.3, 48);
  ringGeo.rotateX(-Math.PI / 2);
  selectionRing = new THREE.Mesh(
    ringGeo,
    new THREE.MeshBasicMaterial({ color: 0xfff3d6, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
  );
  selectionRing.position.y = 0.04;
  scene.add(selectionRing);

  rebuild();
  updateCamera();

  const dom = renderer.domElement;
  dom.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
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

  const animate = () => {
    rafId = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (autoRotate && !dragging && performance.now() > autoRotatePausedUntil) {
      theta += dt * 0.07;
      updateCamera();
    }
    farm.update(t, dt, {});
    if (selectionRing) {
      const want = selectedId ? 0.6 : 0;
      selectionRing.material.opacity += (want - selectionRing.material.opacity) * Math.min(1, dt * 6);
      selectionRing.scale.setScalar(1 + Math.sin(t * 2.2) * 0.05);
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
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    dom.removeEventListener("wheel", onWheel);
  }
  flashes.forEach((f) => clearTimeout(f.timer));
  flashes.clear();
  if (farm) farm.dispose();
  if (renderer) {
    renderer.dispose();
    if (dom && dom.parentNode) dom.parentNode.removeChild(dom);
  }
});

watch(
  () => props.objects,
  () => rebuild(),
  { deep: true }
);
</script>

<template>
  <div class="scene-viewer">
    <div ref="container" class="scene-canvas"></div>
    <div class="viewer-hint">拖拽旋转 · 滚轮缩放 · 点击对象查看详情</div>
  </div>
</template>

<style scoped>
.scene-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 20px;
  overflow: hidden;
  background: #0a111c;
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.3);
}

.scene-canvas {
  width: 100%;
  height: 100%;
}

.viewer-hint {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  font-size: 12px;
  color: rgba(236, 230, 216, 0.72);
  background: rgba(8, 13, 22, 0.72);
  padding: 4px 12px;
  border-radius: 980px;
  pointer-events: none;
  backdrop-filter: blur(8px);
}
</style>

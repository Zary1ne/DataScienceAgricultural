// 程序化纹理：用 Canvas 生成，避免依赖外部图片资源，离线也能正常显示
import * as THREE from "three";

const cache = new Map();

// 确定性随机，保证每次重建场景的纹理/植被分布一致
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(size) {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return c;
}

function build(key, size, draw, repeat) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = makeCanvas(size);
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

// 草地 / 作物层
export function grassTexture(repeat = 1, seed = 3) {
  return build(`grass-${repeat}-${seed}`, 256, (ctx, s) => {
    const r = seededRandom(seed);
    ctx.fillStyle = "#557b40";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 5200; i++) {
      const x = r() * s;
      const y = r() * s;
      const g = 86 + r() * 74;
      const alpha = 0.25 + r() * 0.45;
      ctx.fillStyle = `rgba(${34 + r() * 30}, ${g}, ${30 + r() * 26}, ${alpha})`;
      ctx.fillRect(x, y, 1 + r() * 1.6, 2 + r() * 4);
    }
    // 少量枯草点缀
    for (let i = 0; i < 420; i++) {
      const x = r() * s;
      const y = r() * s;
      ctx.fillStyle = `rgba(${150 + r() * 40}, ${140 + r() * 30}, 70, 0.35)`;
      ctx.fillRect(x, y, 1.2, 3 + r() * 3);
    }
  }, repeat);
}

// 土壤（按色相区分土层）
export function soilTexture(color, repeat = 1, seed = 9) {
  return build(`soil-${color}-${repeat}-${seed}`, 256, (ctx, s) => {
    const r = seededRandom(seed);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 3800; i++) {
      const x = r() * s;
      const y = r() * s;
      const v = r();
      ctx.fillStyle = v > 0.5
        ? `rgba(255, 255, 255, ${0.05 + r() * 0.09})`
        : `rgba(0, 0, 0, ${0.06 + r() * 0.12})`;
      ctx.fillRect(x, y, 1 + r() * 3, 1 + r() * 3);
    }
    // 团粒结构
    for (let i = 0; i < 260; i++) {
      ctx.beginPath();
      ctx.arc(r() * s, r() * s, 1.2 + r() * 3.4, 0, Math.PI * 2);
      ctx.fillStyle = r() > 0.5 ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.08)";
      ctx.fill();
    }
  }, repeat);
}

// 砂石 / 砾石层
export function gravelTexture(repeat = 1) {
  return build(`gravel-${repeat}`, 256, (ctx, s) => {
    const r = seededRandom(21);
    ctx.fillStyle = "#6f6f6f";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const x = r() * s;
      const y = r() * s;
      const rad = 1.5 + r() * 5;
      const tone = 90 + r() * 90;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${tone}, ${tone}, ${tone - 6})`;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }, repeat);
}

// 混凝土
export function concreteTexture(repeat = 1) {
  return build(`concrete-${repeat}`, 256, (ctx, s) => {
    const r = seededRandom(31);
    ctx.fillStyle = "#b9bcbb";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2400; i++) {
      const x = r() * s;
      const y = r() * s;
      ctx.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)";
      ctx.fillRect(x, y, 1 + r() * 2, 1 + r() * 2);
    }
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      let x = r() * s;
      let y = r() * s;
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (r() - 0.5) * 46;
        y += (r() - 0.5) * 46;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, repeat);
}

// 拉丝金属
export function metalTexture(repeat = 1) {
  return build(`metal-${repeat}`, 256, (ctx, s) => {
    const r = seededRandom(41);
    ctx.fillStyle = "#aeb6ba";
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x++) {
      const tone = 150 + r() * 60;
      ctx.fillStyle = `rgba(${tone}, ${tone + 4}, ${tone + 8}, 0.28)`;
      ctx.fillRect(x, 0, 1, s);
    }
    const grad = ctx.createLinearGradient(0, 0, s, s);
    grad.addColorStop(0, "rgba(255,255,255,0.22)");
    grad.addColorStop(0.45, "rgba(255,255,255,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.16)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
  }, repeat);
}

// 光伏板
export function solarTexture(repeat = 1) {
  return build(`solar-${repeat}`, 256, (ctx, s) => {
    ctx.fillStyle = "#16233f";
    ctx.fillRect(0, 0, s, s);
    const cols = 6;
    const rows = 6;
    const cw = s / cols;
    const ch = s / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? "#1c3157" : "#18294a";
        ctx.fillRect(i * cw + 3, j * ch + 3, cw - 6, ch - 6);
        const g = ctx.createLinearGradient(i * cw, j * ch, (i + 1) * cw, (j + 1) * ch);
        g.addColorStop(0, "rgba(120,170,255,0.22)");
        g.addColorStop(0.5, "rgba(80,120,220,0.05)");
        g.addColorStop(1, "rgba(20,40,80,0.3)");
        ctx.fillStyle = g;
        ctx.fillRect(i * cw + 3, j * ch + 3, cw - 6, ch - 6);
      }
    }
    ctx.strokeStyle = "rgba(160,200,255,0.35)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= cols; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cw, 0);
      ctx.lineTo(i * cw, s);
      ctx.stroke();
    }
    for (let j = 0; j <= rows; j++) {
      ctx.beginPath();
      ctx.moveTo(0, j * ch);
      ctx.lineTo(s, j * ch);
      ctx.stroke();
    }
  }, repeat);
}

// 木板
export function woodTexture(repeat = 1) {
  return build(`wood-${repeat}`, 256, (ctx, s) => {
    const r = seededRandom(51);
    ctx.fillStyle = "#8a6742";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) {
      const y = r() * s;
      ctx.strokeStyle = `rgba(${60 + r() * 30}, ${40 + r() * 26}, 22, ${0.12 + r() * 0.2})`;
      ctx.lineWidth = 0.6 + r() * 1.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(s * 0.33, y + (r() - 0.5) * 8, s * 0.66, y + (r() - 0.5) * 8, s, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * s;
      ctx.strokeStyle = "rgba(40,26,14,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(s, y);
      ctx.stroke();
    }
  }, repeat);
}

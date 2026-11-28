<template>
  <div class="story-root">
    <div ref="story" class="story">
      <div ref="stage" class="stage">
        <!-- 相机盒：画布(视频帧) + 高清静止图 + 浮石 -->
        <div ref="cam" class="cam">
          <canvas ref="cv" class="cv"></canvas>
          <img ref="plate" class="plate" :src="A.hero" alt="" />
          <div class="mist"></div>
          <div class="rock rk1" data-x="-0.3" data-y="-0.6" data-d="1.3"><span class="bob"><img :src="A.rocks" alt="" /></span></div>
          <div class="rock rk3" data-x="1" data-y="0.55" data-d="1.8"><span class="bob"><img :src="A.rocks" alt="" /></span></div>
        </div>

        <!-- 前景抠图浮岛（遮挡标题下缘） -->
        <div ref="camF" class="cam camF"><img :src="A.cutout" alt="" /></div>

        <!-- L0 主标题 -->
        <div ref="l0" class="layer l0">
          <div class="hero-copy">
            <span class="m-chip">Smart Agri · Digital Twin</span>
            <h1 class="hero-title">
              <span class="line"><span class="rise">数字孪生</span></span>
              <span class="line"><span class="rise">每一寸土地</span></span>
            </h1>
          </div>
        </div>

        <!-- L1 HUD + 说明 + 提示 -->
        <div ref="l1" class="layer l1">
          <div class="hud">
            <span class="m-chip">土壤墒情</span>
            <pre class="hud-pre">北纬 34.0922° / 东经 116.2432° / 海拔 842 M</pre>
          </div>
          <div class="caption">实时农田洞察。<br />由多源传感器与可信数据驱动。</div>
          <div class="scroll-hint"><span>向下滚动探索</span><span class="hint-circle">⌄</span></div>
        </div>

        <!-- L2 愿景 -->
        <div ref="l2" class="layer l2">
          <div class="vision">
            <span class="m-chip chip-v">我们的愿景</span>
            <h2 class="vision-title">
              <span v-for="(w, i) in visionWords" :key="i" class="vw">{{ w }}</span>
            </h2>
            <p class="vision-para">智慧农业领域的突破，<br />为精准种植与科学管理而生。</p>
          </div>
        </div>

        <!-- L3 监测 + 热点 -->
        <div ref="l3" class="layer l3">
          <p class="acct">
            <span v-for="(w, i) in acctWords" :key="i" class="w">{{ w }}</span>
          </p>
          <div class="hotspots">
            <div
              v-for="(h, i) in hotspots"
              :key="i"
              class="hot"
              :style="{ left: h.left, top: h.top }"
              @click="toggleHot(i)"
              :class="{ on: hotOn === i }"
            >
              <span class="hot-dot"><span class="plus"></span></span>
              <span class="hot-label">{{ h.label }}</span>
              <em class="hot-value">{{ h.value }}</em>
            </div>
          </div>
        </div>

        <!-- L4 站点 -->
        <div ref="l4" class="layer l4">
          <div class="cred">
            <span class="cred-tag">✕ 田间站点 07</span>
            <h3 class="cred-title">农业数字化管理的科学可信度</h3>
          </div>

          <div class="carbon">
            <h4>本季产量<br />预测</h4>
            <div class="carbon-note">地块 07 · 本生长季</div>
            <div class="carbon-big">
              <span ref="carbonNum" class="carbon-num">0</span><span class="carbon-unit">吨</span>
            </div>
            <span class="carbon-tag">+2.6 吨</span>
            <svg class="spark" viewBox="0 0 220 70">
              <polyline ref="sparkLine" class="spark-line" points="0,60 30,55 60,57 90,44 120,46 150,30 180,24 214,10" />
              <circle class="spark-dot" cx="90" cy="44" r="2.4" />
              <circle class="spark-dot" cx="150" cy="30" r="2.4" />
              <circle class="spark-dot-lime" cx="214" cy="10" r="3.4" />
            </svg>
            <div class="carbon-foot">播种 · 苗期 · 抽穗 · 成熟</div>
          </div>

          <ul class="feats">
            <li v-for="(f, i) in feats" :key="i" class="feat" @click="toggleFeat(i)" :class="{ on: featOn === i }">
              <span class="feat-idx">{{ pad(i + 1) }}</span>
              <span class="feat-label">{{ f }}</span>
              <span class="feat-arrow">→</span>
            </li>
          </ul>
        </div>

        <div class="prog"><span ref="progBar"></span></div>
      </div>
    </div>

    <!-- 解决方案区 -->
    <section ref="sol" class="sol">
      <div class="sol-head">
        <div>
          <span class="m-chip">Our Solutions</span>
          <h2 class="sol-title">让农田的生长与产出可被验证</h2>
        </div>
        <p class="sol-para">田间传感器、气象站与卫星数据，融合为一份可追溯记录——让每一吨产出都能追溯回它生长的土地。</p>
      </div>

      <div class="sol-cards">
        <article v-for="(c, i) in solCards" :key="i" class="sol-card" @pointermove="tilt($event, i)">
          <div class="sol-bg" :style="{ backgroundImage: `url(${c.img})`, backgroundPosition: c.pos, backgroundSize: c.size }"></div>
          <div class="sol-overlay"></div>
          <div class="sol-top"><span class="sol-label">{{ c.label }}</span><span class="sol-arrow">→</span></div>
          <div class="sol-bottom">
            <h3 class="sol-card-title">{{ c.title }}</h3>
            <p class="sol-card-body">{{ c.body }}</p>
          </div>
        </article>
      </div>

      <div class="sol-stats">
        <div v-for="(s, i) in stats" :key="i" class="stat">
          <div class="stat-num num" :data-value="s.value" :data-decimals="s.decimals">0</div>
          <div class="stat-label">{{ s.label }}</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";

const A = {
  hero: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261106_031618_8ce6dca1-972d-429d-8d13-bf0691c37848.png&w=2400&q=88",
  cutout: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261106_031657_baaa3380-5ece-482a-a623-a1838fd7653c.png&w=2400&q=90",
  rocks: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261106_025635_82593f6a-1cf7-41c1-94ac-96fb89ebfd1a.png&w=2400&q=85",
  mast: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261106_025630_9a37a1e0-2547-4973-8160-c75205993914.png&w=1400&q=82",
  clouds: "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261106_025545_b003e5cc-e68f-4fee-b686-c217a5d81eea.png&w=1400&q=82",
  video: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261106_025717_906b686d-9a9a-4dea-bab4-ae2454f8390e.mp4",
};

const story = ref(null);
const stage = ref(null);
const cam = ref(null);
const camF = ref(null);
const cv = ref(null);
const plate = ref(null);
const progBar = ref(null);
const sol = ref(null);
const l0 = ref(null);
const l1 = ref(null);
const l2 = ref(null);
const l3 = ref(null);
const l4 = ref(null);
const carbonNum = ref(null);
const sparkLine = ref(null);

const visionWords = ["从数据混沌到", "科学可信的", "可执行洞察"];
const acctWords = ["我们的", "数字孪生", "将复杂的", "田间数据", "转化为", "可验证、", "可溯源的", "生长指标", "让每一次", "灌溉", "与", "施药", "都有", "数据支撑", "而不是", "停留在经验判断"];
const hotspots = [
  { left: "12%", top: "58%", label: "土壤墒情", value: "62 %" },
  { left: "33%", top: "41%", label: "冠层温湿度", value: "71 % RH" },
  { left: "70%", top: "66%", label: "病害指数", value: "1.2 级" },
  { left: "83%", top: "47%", label: "微气候", value: "14.2 °C" },
];
const feats = ["标准化田间观测", "气象与土壤多源监测", "病害识别与预警算法", "数据可追溯", "面向规模化种植设计"];
const solCards = [
  { label: "[ 智慧灌溉 ]", title: "精准灌溉 · 节水增产", body: "土壤墒情与气象数据驱动灌溉决策，让每一滴水都用在该用的地方。", img: A.mast, pos: "22% 70%", size: "260%" },
  { label: "[ 病害识别 ]", title: "AI 病害 · 早期预警", body: "图像识别与微气候监测，在病害爆发前给出预警与防治建议。", img: A.clouds, pos: "50% 50%", size: "190%" },
  { label: "[ 数字孪生 ]", title: "地块级 · 数字孪生", body: "为每一块农田建立实时数字映射，实现从播种到收获的全周期可视化。", img: A.mast, pos: "62% 30%", size: "230%" },
];
const stats = [
  { value: 1240, decimals: 0, label: "已部署传感器" },
  { value: 38, decimals: 0, label: "覆盖地块" },
  { value: 96.8, decimals: 1, label: "% 病害识别准确率" },
  { value: 99.4, decimals: 1, label: "% 数据在线率" },
];

const hotOn = ref(-1);
const featOn = ref(-1);

// —— 滚动/指针状态 ——
let sp = 0, sx = 0, sy = 0, mx = 0, my = 0;
let rafId = 0, last = 0;
let vWordEls = [], aWordEls = [], hotEls = [], featEls = [], cardEls = [], statEls = [];
// 每帧要写的静态节点先缓存，避免每帧 querySelector 触发额外开销
let rockEls = [], heroCopyEl = null, hudEl = null, capHintEls = [];
let chipVEl = null, paraVEl = null, credEl = null, carbonEl = null, contentEl = null;
let denom = 0;

// —— 视频帧缓存状态 ——
let NF = 2, frames = [], shown = -1, busy = false, want = 0, grabbing = false;
let videoOk = false, videoFailed = false;
let videoEl = null, grabCanvas = null, gctx = null, ctx = null;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const pad = (n) => String(n).padStart(2, "0");

function toggleHot(i) {
  hotOn.value = hotOn.value === i ? -1 : i;
}
function toggleFeat(i) {
  featOn.value = featOn.value === i ? -1 : i;
}

function tilt(e, i) {
  const el = cardEls[i];
  if (!el) return;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  el.style.transform = `perspective(1000px) rotateY(${x * 6}deg) rotateX(${y * -6}deg)`;
}

// —— 视频帧缓存 ——
function sizeCanvas() {
  const c = cv.value;
  if (!c) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  c.width = Math.max(1, Math.round(c.clientWidth * dpr));
  c.height = Math.max(1, Math.round(c.clientHeight * dpr));
  ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "medium";
}

// 串行抓帧：同一时间只做一次编码，避免逐帧 JPEG/WebP 编码把主线程打满
function grabTo(i, cb) {
  if (frames[i]) {
    cb && cb();
    return;
  }
  // 隔帧抓取：一半的编码量，配合 nearest() 取样肉眼无差别
  if (grabbing || i % 2 !== 0) {
    cb && cb();
    return;
  }
  grabbing = true;
  try {
    gctx.drawImage(videoEl, 0, 0, grabCanvas.width, grabCanvas.height);
    grabCanvas.toBlob(
      (blob) => {
        grabbing = false;
        frames[i] = blob;
        cb && cb();
      },
      "image/jpeg",
      0.82
    );
  } catch (e) {
    grabbing = false;
    videoFailed = true;
    cb && cb();
  }
}

function nearest(target) {
  for (let k = 0; k < NF; k++) {
    if (target - k >= 0 && frames[target - k]) return target - k;
    if (target + k < NF && frames[target + k]) return target + k;
  }
  return -1;
}

async function drawWant() {
  if (busy || videoFailed || !ctx) return;
  const i = nearest(want);
  if (i < 0 || i === shown) return;
  const blob = frames[i];
  if (!blob) return;
  busy = true;
  try {
    const bmp = await createImageBitmap(blob);
    const c = cv.value;
    const bw = bmp.width, bh = bmp.height;
    const s = Math.max(c.width / bw, c.height / bh);
    const dw = bw * s, dh = bh * s;
    const dx = (c.width - dw) / 2, dy = (c.height - dh) / 2;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, dx, dy, dw, dh);
    bmp.close();
    shown = i;
  } catch (e) {
    videoFailed = true;
  }
  busy = false;
  if (want !== i && !videoFailed) drawWant();
}

function seekFallback(i) {
  if (i >= NF) return;
  videoEl.currentTime = Math.min(i / 24, videoEl.duration - 0.01);
  const onSeek = () => {
    videoEl.removeEventListener("seeked", onSeek);
    grabTo(i, () => {
      if (i === want) drawWant();
      seekFallback(i + 1);
    });
  };
  videoEl.addEventListener("seeked", onSeek);
}

function initVideo() {
  try {
    videoEl = document.createElement("video");
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.preload = "auto";
    videoEl.crossOrigin = "anonymous";
    videoEl.src = A.video;
    grabCanvas = document.createElement("canvas");
    grabCanvas.width = 1280;
    grabCanvas.height = 720;
    gctx = grabCanvas.getContext("2d");

    const onReady = () => {
      if (videoOk || videoFailed) return;
      try {
        const vw = videoEl.videoWidth || 1600;
        const vh = videoEl.videoHeight || 900;
        const fit = Math.min(1, 1600 / vw, 900 / vh);
        grabCanvas.width = Math.round(vw * fit);
        grabCanvas.height = Math.round(vh * fit);
        gctx.imageSmoothingEnabled = true;
        gctx.imageSmoothingQuality = "medium";
        NF = Math.max(2, Math.round(videoEl.duration * 24));
        frames = new Array(NF);
        grabTo(0, () => drawWant());
        videoOk = true;
        if (videoEl.requestVideoFrameCallback) {
          videoEl.play().catch(() => seekFallback(1));
          const cb = (_now, meta) => {
            if (videoFailed) return;
            const i = Math.min(NF - 1, Math.round(meta.mediaTime * 24));
            if (i > 0 && !frames[i]) grabTo(i);
            if (i === want) drawWant();
            if (!videoEl.ended) videoEl.requestVideoFrameCallback(cb);
          };
          videoEl.requestVideoFrameCallback(cb);
        } else {
          seekFallback(1);
        }
      } catch (e) {
        videoFailed = true;
      }
    };
    videoEl.addEventListener("loadeddata", onReady);
    videoEl.addEventListener("error", () => (videoFailed = true));
    if (videoEl.readyState >= 2) onReady();
    setTimeout(() => {
      if (!videoOk) videoFailed = true;
    }, 9000);
  } catch (e) {
    videoFailed = true;
  }
}

function setVis(el, show) {
  if (!el) return;
  const v = show ? "visible" : "hidden";
  if (el.style.visibility !== v) el.style.visibility = v;
}

function applyFrame() {
  const vp = ease(seg(sp, 0.05, 0.7));
  want = Math.round(vp * (NF - 1));
  if (videoOk) drawWant();

  // 相机变换
  const camT = `translate3d(${-sx * 18}px, ${-sy * 12 + (1 - vp) * window.innerHeight * 0.06}px, 0) scale(${1 + 0.02 * (1 - vp)})`;
  if (cam.value) cam.value.style.transform = camT;
  if (camF.value) camF.value.style.transform = camT;

  // 视频交接：视频可用时淡出静止图，否则静止图做“推进”缩放
  const ho = shown < 0 ? 0 : shown === 0 ? seg(sp, 0.06, 0.105) : 1;
  if (plate.value) {
    if (!videoOk) {
      plate.value.style.opacity = "1";
      plate.value.style.transform = `scale(${1 + vp * 0.32}) translate(${-vp * 3}%, ${vp * 7}%)`;
    } else {
      plate.value.style.opacity = String(1 - ho);
      plate.value.style.transform = "none";
      setVis(plate.value, 1 - ho > 0.01);
    }
  }
  if (camF.value) {
    if (!videoOk) {
      camF.value.style.opacity = String(1 - vp);
      setVis(camF.value, vp < 0.98);
    } else {
      camF.value.style.opacity = String(1 - ho);
      setVis(camF.value, 1 - ho > 0.01);
    }
  }

  // 浮石飞掠
  const fp = seg(sp, 0.02, 0.2);
  if (fp < 1) {
    rockEls.forEach((r) => {
      const x = parseFloat(r.dataset.x || "0");
      const y = parseFloat(r.dataset.y || "0");
      const d = parseFloat(r.dataset.d || "1");
      const fe = fp * fp;
      r.style.transform = `translate3d(${x * fp * 70 + sx * -24 * d}vw, ${y * fp * 60 + sy * -16 * d}vh, 0) scale(${1 + fe * 1.6 * d})`;
      r.style.filter = `blur(${fe * 5 * d}px)`;
    });
  }
  rockEls.forEach((r) => setVis(r, fp < 1));

  // —— L0 / L1 主标题 ——
  const h = seg(sp, 0.02, 0.1);
  if (heroCopyEl) {
    heroCopyEl.style.transform = `translate3d(${-sx * 10}px, ${-h * 80 - sy * 6}px, 0) scale(${1 + h * 0.12})`;
    heroCopyEl.style.filter = `blur(${h * 14}px)`;
    heroCopyEl.style.opacity = String(1 - h);
  }
  if (hudEl) {
    hudEl.style.transform = `translate3d(${sx * 26}px, ${sy * 18 - h * 40}px, 0)`;
    hudEl.style.opacity = String(1 - seg(sp, 0.02, 0.08));
  }
  capHintEls.forEach((el) => (el.style.opacity = String(1 - seg(sp, 0.01, 0.05))));
  setVis(l0.value, h < 1);
  setVis(l1.value, h < 1);

  // —— L2 愿景 ——
  const vIn = seg(sp, 0.16, 0.27), vOut = seg(sp, 0.34, 0.42);
  const l2Show = vIn > 0.001 && vOut < 0.999;
  // 仅在可见时写样式，避免不可见图层每帧重绘 filter/blur
  if (l2Show) {
    vWordEls.forEach((el, i) => {
      const k = clamp(vIn * 1.6 - i * 0.08, 0, 1);
      el.style.transform = `translate3d(0, ${(1 - k) * 30 - vOut * 60}px, 0)`;
      el.style.filter = `blur(${(1 - k) * 12 + vOut * 14}px)`;
      el.style.opacity = String(k * (1 - vOut));
    });
    [chipVEl, paraVEl].forEach((el) => {
      if (!el) return;
      el.style.opacity = String(clamp(vIn * 2 - 0.6, 0, 1) * (1 - vOut));
      el.style.transform = `translateY(${-vOut * 50}px)`;
    });
  }
  setVis(l2.value, l2Show);

  // —— L3 监测 + 热点 ——
  const aIn = seg(sp, 0.45, 0.55), aOut = seg(sp, 0.63, 0.68);
  const l3Show = aIn > 0.001 && aOut < 0.999;
  if (l3Show) {
    aWordEls.forEach((el, i) => {
      const k = clamp(aIn * 2.2 - (i / aWordEls.length) * 1.2, 0, 1);
      el.style.opacity = String((0.15 + 0.85 * k) * (1 - aOut));
      el.style.filter = `blur(${(1 - k) * 6 + aOut * 10}px)`;
    });
    hotEls.forEach((el, i) => {
      const k = seg(sp, 0.49 + i * 0.02, 0.53 + i * 0.02);
      el.style.transform = `translate3d(${sx * -30}px, ${sy * -20}px, 0) scale(${k * (1 - aOut)})`;
    });
  }
  setVis(l3.value, l3Show);

  // —— L4 站点 ——
  const sIn = seg(sp, 0.72, 0.82);
  if (credEl) {
    credEl.style.opacity = String(sIn);
    credEl.style.transform = `translateY(${(1 - sIn) * 30}px)`;
    credEl.style.filter = `blur(${(1 - sIn) * 8}px)`;
  }
  const cIn = ease(seg(sp, 0.74, 0.86));
  if (carbonEl) {
    carbonEl.style.opacity = String(cIn);
    carbonEl.style.transform = `translate3d(${sx * -14}px, ${(1 - cIn) * 60 + sy * -10}px, 0) rotateY(${sx * 8}deg) rotateX(${sy * -8}deg)`;
  }
  if (carbonNum.value) carbonNum.value.textContent = String(Math.round(24 * seg(sp, 0.76, 0.9)));
  if (sparkLine.value) {
    sparkLine.value.style.strokeDashoffset = String(300 * (1 - seg(sp, 0.77, 0.92)));
  }
  if (sIn > 0.001) {
    featEls.forEach((el, i) => {
      const k = ease(seg(sp, 0.76 + i * 0.025, 0.82 + i * 0.025));
      el.style.opacity = String(k);
      el.style.transform = `translateX(${(1 - k) * 40}px)`;
    });
  }
  setVis(l4.value, sIn > 0.001);

  // 进度条
  if (progBar.value) progBar.value.style.transform = `scaleX(${sp})`;
}

let statsStarted = false, statsT0 = 0, statsDone = false;
function startStats() {
  if (statsStarted) return;
  statsStarted = true;
  statsT0 = performance.now();
}

function renderStats(now) {
  if (!statsStarted || statsDone) return;
  const t = clamp((now - statsT0) / 1600, 0, 1);
  const k = ease(t);
  statEls.forEach((el) => {
    const v = parseFloat(el.dataset.value);
    const d = parseInt(el.dataset.decimals || "0", 10);
    const cur = v * k;
    const txt =
      d === 0 ? Math.round(cur).toLocaleString("en-US") : cur.toFixed(d);
    el.textContent = txt;
  });
  if (t >= 1) statsDone = true;
}

function tick(now) {
  rafId = requestAnimationFrame(tick);
  let dt = now - last;
  last = now;
  if (dt > 64) dt = 64;

  const st = story.value, sg = stage.value;
  if (!st || !sg) return;
  if (!contentEl) {
    contentEl = st.closest(".content");
    denom = st.offsetHeight - (contentEl ? contentEl.clientHeight : window.innerHeight);
  }
  const s = contentEl
    ? contentEl.getBoundingClientRect().top - st.getBoundingClientRect().top
    : -st.getBoundingClientRect().top;
  const p = clamp(s / (denom || 1), 0, 1);
  sp += (p - sp) * (1 - Math.pow(0.86, dt / 16.7));
  if (Math.abs(p - sp) < 0.0002) sp = p;
  sx += (mx - sx) * 0.06;
  sy += (my - sy) * 0.06;

  renderStats(now);
  applyFrame();
}

function onResize() {
  sizeCanvas();
  contentEl = null;
}

function onPointer(e) {
  mx = e.clientX / window.innerWidth - 0.5;
  my = e.clientY / window.innerHeight - 0.5;
}

onMounted(() => {
  vWordEls = Array.from(l2.value ? l2.value.querySelectorAll(".vw") : []);
  aWordEls = Array.from(l3.value ? l3.value.querySelectorAll(".acct .w") : []);
  hotEls = Array.from(l3.value ? l3.value.querySelectorAll(".hot") : []);
  featEls = Array.from(l4.value ? l4.value.querySelectorAll(".feat") : []);
  cardEls = Array.from(document.querySelectorAll(".sol-card"));
  statEls = Array.from(document.querySelectorAll(".stat-num"));

  rockEls = Array.from(document.querySelectorAll(".rock"));
  heroCopyEl = l0.value ? l0.value.querySelector(".hero-copy") : null;
  hudEl = l1.value ? l1.value.querySelector(".hud") : null;
  capHintEls = Array.from(l1.value ? l1.value.querySelectorAll(".caption, .scroll-hint") : []);
  chipVEl = l2.value ? l2.value.querySelector(".chip-v") : null;
  paraVEl = l2.value ? l2.value.querySelector(".vision-para") : null;
  credEl = l4.value ? l4.value.querySelector(".cred") : null;
  carbonEl = l4.value ? l4.value.querySelector(".carbon") : null;

  // 统计数字进入视口后再启动，避免每帧 getBoundingClientRect
  if (sol.value && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          startStats();
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(sol.value);
  }

  sizeCanvas();
  initVideo();
  window.addEventListener("resize", onResize);
  window.addEventListener("pointermove", onPointer);
  document.querySelectorAll(".sol-card").forEach((el) =>
    el.addEventListener("pointerleave", () => {
      el.style.transform = "none";
    })
  );

  last = performance.now();
  rafId = requestAnimationFrame(tick);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId);
  window.removeEventListener("resize", onResize);
  window.removeEventListener("pointermove", onPointer);
  if (videoEl) {
    videoEl.pause();
    videoEl.src = "";
  }
});
</script>

<style scoped>
.story-root {
  position: relative;
  font-family: var(--sans);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

.story {
  position: relative;
  height: 640vh;
}

.stage {
  position: sticky;
  top: 0;
  height: calc(100vh - 64px);
  overflow: hidden;
  background: #dfe3e0;
}

/* 相机盒 */
.cam {
  position: absolute;
  inset: -9% -3% -3%;
  will-change: transform;
  overflow: hidden;
}

.cv {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.plate {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 38%;
  will-change: transform, opacity;
}

.mist {
  position: absolute;
  inset: -10%;
  background:
    radial-gradient(40% 30% at 20% 80%, rgba(255, 255, 255, 0.28), transparent 70%),
    radial-gradient(35% 25% at 85% 30%, rgba(255, 255, 255, 0.2), transparent 70%);
  animation: drift 18s ease-in-out infinite alternate;
  pointer-events: none;
}

/* 前景抠图浮岛 */
.camF {
  visibility: hidden;
  pointer-events: none;
}

.camF img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  -webkit-mask-image: linear-gradient(90deg, transparent 25%, #000 27.5%, #000 71.5%, transparent 74%);
  mask-image: linear-gradient(90deg, transparent 25%, #000 27.5%, #000 71.5%, transparent 74%);
}

/* 浮石 */
.rock {
  position: absolute;
  overflow: hidden;
  pointer-events: none;
}
.rk1 { left: 4%; top: 13%; width: 7.5vw; aspect-ratio: 260 / 295; }
.rk3 { left: 80%; top: 58%; width: 14vw; aspect-ratio: 265 / 270; }
.bob {
  position: absolute;
  inset: 0;
  animation: bob 7s ease-in-out infinite alternate;
}
.rk1 .bob { animation-duration: 6s; }
.rk3 .bob { animation-duration: 8.5s; animation-delay: -3s; }
.bob img { position: absolute; max-width: none; }
.rk1 .bob img { width: 461.5%; left: -11.5%; top: -67.8%; }
.rk3 .bob img { width: 452.8%; left: -337.7%; top: -88.9%; }

/* 图层 */
.layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.layer > * { pointer-events: auto; }

/* L0 主标题 */
.l0 { z-index: 3; }
.hero-copy {
  position: absolute;
  left: 0;
  right: 0;
  top: 6%;
  text-align: center;
  will-change: transform, opacity, filter;
}
.hero-title {
  font-size: clamp(44px, 6.4vw, 104px);
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.01em;
  color: var(--ink);
  margin-top: 18px;
  text-shadow: 0 2px 40px rgba(255, 255, 255, 0.28), 0 1px 3px rgba(255, 255, 255, 0.2);
}
.hero-title .line {
  display: block;
  overflow: hidden;
  padding-bottom: 0.06em;
  white-space: nowrap;
}
.hero-title .rise {
  display: inline-block;
  animation: rise 1.1s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
@keyframes rise {
  from { transform: translateY(105%); }
  to { transform: none; }
}

/* L1 HUD + 说明 */
.l1 { z-index: 4; }
.hud {
  position: absolute;
  left: 53.5%;
  top: 62%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  will-change: transform, opacity;
}
.hud-pre {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  line-height: 1.65;
  color: #fff;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
  background: rgba(40, 58, 44, 0.28);
  backdrop-filter: blur(8px);
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.4);
}
.caption {
  position: absolute;
  left: 34px;
  bottom: 34px;
  padding-left: 16px;
  border-left: 2px solid var(--lime2);
  font-family: var(--mono);
  font-size: 11.5px;
  line-height: 1.75;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--ink2);
}
.scroll-hint {
  position: absolute;
  right: 34px;
  bottom: 36px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink2);
}
.hint-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.3px solid var(--ink2);
  font-size: 13px;
  animation: hint-nudge 1.6s ease-in-out infinite;
}
@keyframes hint-nudge {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(2px); }
}

/* L2 愿景 */
.l2 { z-index: 5; visibility: hidden; }
.vision {
  position: absolute;
  left: 50%;
  top: 16%;
  transform: translate(-50%, 0);
  width: min(820px, 90vw);
  text-align: center;
  color: #fff;
}
.vision-title {
  font-size: clamp(34px, 4.6vw, 70px);
  font-weight: 400;
  line-height: 1.12;
  letter-spacing: 0.01em;
  margin: 18px 0 20px;
  text-shadow: 0 2px 40px rgba(10, 30, 15, 0.55), 0 1px 3px rgba(10, 30, 15, 0.3);
}
.vision-title .vw {
  display: block;
  will-change: transform, opacity, filter;
}
.vision-para {
  font-size: 16px;
  line-height: 1.45;
  text-shadow: 0 1px 14px rgba(10, 30, 15, 0.7);
}

/* L3 监测 + 热点 */
.l3 { z-index: 6; visibility: hidden; }
.acct {
  position: absolute;
  left: 34px;
  top: 14vh;
  width: min(560px, 86vw);
  font-size: clamp(20px, 1.9vw, 29px);
  line-height: 1.3;
  letter-spacing: -0.02em;
  color: var(--ink);
  text-shadow: 0 0 24px rgba(255, 255, 255, 0.4);
}
.acct .w {
  display: inline-block;
  margin-right: 0.25em;
  will-change: opacity, filter;
}
.hotspots { position: absolute; inset: 0; }
.hot {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  cursor: pointer;
  will-change: transform;
}
.hot-dot {
  position: relative;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--lime);
  animation: ping 2.4s ease-out infinite;
  transition: transform 0.3s ease;
}
.hot:hover .hot-dot { transform: scale(1.15); }
.plus::before,
.plus::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  background: var(--ink);
  transform: translate(-50%, -50%);
}
.plus::before { width: 10px; height: 1.4px; }
.plus::after { width: 1.4px; height: 10px; }
.hot-label {
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink);
  padding: 6px 9px;
  border-radius: 4px;
  background: rgba(246, 248, 245, 0.72);
  backdrop-filter: blur(8px);
}
.hot-value {
  font-style: normal;
  font-size: 14px;
  color: #4f8a12;
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.45s ease;
}
.hot.on .hot-value,
.hot:hover .hot-value {
  max-height: 20px;
}
@keyframes ping {
  0% { box-shadow: 0 0 0 0 rgba(169, 221, 58, 0.7); }
  70% { box-shadow: 0 0 0 14px rgba(169, 221, 58, 0); }
  100% { box-shadow: 0 0 0 0 rgba(169, 221, 58, 0); }
}

/* L4 站点 */
.l4 { z-index: 7; visibility: hidden; }
.cred {
  position: absolute;
  left: 34px;
  top: 13vh;
  max-width: 380px;
  color: var(--ink);
  will-change: transform, opacity, filter;
}
.cred-tag {
  display: flex;
  width: max-content;
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.1em;
  padding: 4px 8px;
  border-radius: 3px;
  background: var(--lime);
  color: var(--ink);
}
.cred-title {
  font-size: clamp(22px, 2vw, 30px);
  line-height: 1.08;
  letter-spacing: -0.025em;
  margin-top: 12px;
  text-shadow: 0 0 24px rgba(255, 255, 255, 0.4);
}

.carbon {
  position: absolute;
  left: 38%;
  top: 38vh;
  width: 250px;
  padding: 18px;
  border-radius: 10px;
  background: rgba(40, 58, 44, 0.32);
  border: 1px solid rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(16px) saturate(1.2);
  color: #fff;
  will-change: transform, opacity;
}
.carbon h4 { font-size: 15px; font-weight: 500; line-height: 1.2; }
.carbon-note { font-family: var(--mono); font-size: 9.5px; opacity: 0.7; margin-top: 6px; }
.carbon-big { margin-top: 14px; }
.carbon-num { font-size: 46px; font-weight: 500; letter-spacing: -0.04em; }
.carbon-unit { font-family: var(--mono); font-size: 10px; opacity: 0.8; margin-left: 4px; }
.carbon-tag {
  position: absolute;
  right: 16px;
  top: 96px;
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.1em;
  background: var(--lime);
  color: var(--ink);
  padding: 4px 8px;
  border-radius: 3px;
}
.spark { width: 220px; height: 70px; margin-top: 14px; }
.spark-line {
  fill: none;
  stroke: var(--lime);
  stroke-width: 1.6;
  stroke-dasharray: 300;
  stroke-dashoffset: 300;
}
.spark-dot { fill: #fff; }
.spark-dot-lime { fill: var(--lime); }
.carbon-foot {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  opacity: 0.7;
  margin-top: 6px;
}

.feats {
  position: absolute;
  right: 34px;
  top: 30vh;
  width: min(400px, 36vw);
  padding: 6px 16px;
  border-radius: 10px;
  background: rgba(246, 248, 245, 0.62);
  backdrop-filter: blur(14px);
  list-style: none;
}
.feat {
  display: grid;
  grid-template-columns: 30px 1fr 16px;
  gap: 8px;
  align-items: center;
  padding: 11px 0;
  border-bottom: 1px solid rgba(16, 41, 26, 0.14);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.3s ease;
  will-change: transform, opacity;
}
.feat:last-child { border-bottom: none; }
.feat-idx { opacity: 0.6; }
.feat-arrow { transition: transform 0.3s ease; }
.feat:hover,
.feat.on {
  color: #4f8a12;
  padding-left: 6px;
}
.feat:hover .feat-arrow,
.feat.on .feat-arrow {
  transform: translateX(4px);
}

/* 进度条 */
.prog {
  position: absolute;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  width: 120px;
  height: 2px;
  background: rgba(16, 41, 26, 0.18);
  border-radius: 2px;
}
.prog > span {
  display: block;
  height: 100%;
  background: var(--lime2);
  transform-origin: left center;
  transform: scaleX(0);
}

/* ===== 解决方案区 ===== */
.sol {
  position: relative;
  z-index: 5;
  margin-top: -30vh;
  background: #fff;
  border-radius: 22px 22px 0 0;
  padding: 70px 34px 90px;
  box-shadow: 0 -30px 60px rgba(16, 41, 26, 0.12);
}
.sol-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 40px;
  flex-wrap: wrap;
}
.sol-title {
  font-size: clamp(34px, 3.9vw, 58px);
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.04em;
  max-width: 640px;
  margin-top: 20px;
  color: var(--ink);
}
.sol-para {
  font-size: 15px;
  max-width: 360px;
  color: #4a5a4f;
}
.sol-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 54px;
}
.sol-card {
  position: relative;
  height: 440px;
  border-radius: 12px;
  overflow: hidden;
  background: #1b3122;
  color: #fff;
  cursor: pointer;
  transition: transform 0.4s ease;
  will-change: transform;
}
.sol-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  transition: transform 1.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.sol-card:hover .sol-bg { transform: scale(1.07); }
.sol-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(10, 25, 15, 0.45), transparent 35%, transparent 55%, rgba(10, 25, 15, 0.75));
}
.sol-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px;
}
.sol-label {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.9;
}
.sol-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--lime);
  color: var(--ink);
  transition: transform 0.4s ease;
}
.sol-card:hover .sol-arrow { transform: rotate(-45deg); }
.sol-bottom {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 24px;
}
.sol-card-title {
  font-size: 25px;
  font-weight: 500;
  letter-spacing: -0.03em;
  line-height: 1.05;
}
.sol-card-body {
  font-size: 13.5px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.85);
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.6s ease;
}
.sol-card:hover .sol-card-body { max-height: 80px; }

.sol-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin-top: 60px;
  border-top: 1px solid #e0e5e0;
}
.stat { padding-top: 22px; }
.stat-num {
  font-size: 44px;
  font-weight: 500;
  letter-spacing: -0.04em;
  color: var(--ink);
}
.stat-label {
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #6a7a6f;
  margin-top: 6px;
}

@media (max-width: 820px) {
  .hero-title { font-size: clamp(40px, 12vw, 64px); }
  .hud { left: 50%; top: 66%; }
  .caption { left: 18px; right: 18px; bottom: 70px; }
  .scroll-hint { right: 18px; bottom: 24px; }
  .rk1 { width: 16vw; }
  .rk3 { width: 30vw; top: 70%; }
  .acct { left: 18px; }
  .cred { left: 18px; top: 11vh; max-width: 80vw; }
  .carbon { left: 18px; bottom: 6vh; top: auto; width: 210px; }
  .feats { right: 18px; bottom: 6vh; top: auto; width: 45vw; font-size: 9.5px; }
  .feat-arrow { display: none; }
  .sol { padding: 50px 18px 70px; }
  .sol-cards { grid-template-columns: 1fr; }
  .sol-card { height: 340px; }
  .sol-stats { grid-template-columns: 1fr 1fr; }
}
</style>

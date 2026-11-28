<template>
  <div class="home-page">
    <!-- 首页 Hero：字母铺成的金色稻田 + 白金描金大标题 -->
    <section class="hero">
      <div class="hero-field" aria-hidden="true">
        <PixelRiceHero />
      </div>
      <div class="hero-veil" aria-hidden="true"></div>

      <div class="hero-content">
        <p class="hero-eyebrow"><span class="hero-dot"></span>XIANG FARMER</p>
        <h1 class="hero-title">湘小农</h1>
      </div>

      <div class="hero-words" aria-label="让每一株水稻，都得到关注">
        <span class="hw hw-1">让每一株水稻，</span>
        <span class="hw hw-2">都得到关注</span>
        <span class="hw hw-4">EVERY RICE PLANT MATTERS</span>
      </div>

      <div class="hero-scroll">向下了解功能<span>↓</span></div>
    </section>

    <!-- 五张功能介绍卡 -->
    <section class="features">
      <header class="features-head">
        <p class="sec-kicker">WHAT'S INSIDE</p>
        <h2>五件事，把一季稻种明白</h2>
        <p class="sec-desc">
          每个模块都可以单独使用，也可以连在一起，构成从识病到决策的完整闭环。
        </p>
      </header>

      <article
        v-for="(f, i) in features"
        :key="f.id"
        class="feature-card"
        :class="{ reverse: i % 2 === 1, highlight: f.highlight }"
      >
        <div class="fc-copy">
          <div class="fc-eyebrow">
            <span class="fc-num">{{ f.index }}</span>
            <span class="fc-kicker">{{ f.kicker }}</span>
          </div>
          <h3 class="fc-title">{{ f.title }}</h3>
          <p class="fc-desc">{{ f.desc }}</p>
          <ul class="fc-points">
            <li v-for="p in f.points" :key="p"><span class="tick"></span>{{ p }}</li>
          </ul>
          <RouterLink v-if="!f.adminOnly || isAdmin" :to="f.to" class="fc-cta">
            {{ f.cta }}<span class="cta-arrow">→</span>
          </RouterLink>
          <button v-else class="fc-cta fc-cta-locked" @click="adminPreview">
            {{ f.cta }}<span class="cta-lock">仅管理员</span>
          </button>
        </div>
        <div class="fc-visual">
          <IntroVisual :kind="f.visual" />
        </div>
        <RiceCorner v-if="f.highlight" class="corner-mark" />
      </article>
    </section>

    <div class="terminal">
    <!-- 顶部滚动行情条 -->
    <div class="ticker-bar">
      <div class="ticker-label">实时行情</div>
      <div class="ticker-view">
        <div class="ticker-run">
          <div v-for="(item, i) in tickerLoop" :key="i" class="ticker-item">
            <span class="t-code">{{ item.code }}</span>
            <span class="t-name">{{ item.name }}</span>
            <span class="t-price num">{{ fmt(item.price) }}</span>
            <span class="t-pct num" :class="trendClass(item.pct)">{{ signed(item.pct) }}%</span>
          </div>
        </div>
      </div>
      <div class="ticker-time num">{{ clockText }}</div>
    </div>

    <div class="t-shell">
      <!-- 标题与欢迎语 -->
      <header class="term-head">
        <div class="brand">
          <span class="brand-mark">AGRI</span>
          <h1>农业行情终端</h1>
          <span class="brand-sub">农业股 · 农产品现货与期货</span>
        </div>
        <div class="head-right">
          <span class="market-status" :class="marketLive ? 'live' : 'sample'">{{ marketStatusText }}</span>
          <span class="hello">你好，<strong>{{ userName }}</strong></span>
          <span class="session">交易日 · 已收盘</span>
        </div>
      </header>

      <!-- 指数概览 -->
      <section class="index-grid">
        <article v-for="idx in indices" :key="idx.code" class="index-card">
          <div class="idx-top">
            <span class="idx-name">{{ idx.name }}</span>
            <span class="idx-code num">{{ idx.code }}</span>
          </div>
          <div class="idx-value num" :class="trendClass(idx.pct)">{{ fmt(idx.value) }}</div>
          <div class="idx-meta num">
            <span :class="trendClass(idx.pct)">{{ signed(idx.pct) }}%</span>
            <span class="idx-change" :class="trendClass(idx.change)">{{ signed(idx.change) }}</span>
          </div>
          <svg class="spark" viewBox="0 0 120 34" preserveAspectRatio="none" aria-hidden="true">
            <polyline
              :points="sparkPoints(idx.spark, 120, 34)"
              fill="none"
              :stroke="idx.pct >= 0 ? '#ff6b6b' : '#4ade80'"
              stroke-width="1.6"
            />
          </svg>
        </article>
      </section>

      <div class="main-grid">
        <!-- 左侧：K线 + 自选 -->
        <div class="col-main">
          <section class="panel chart-panel">
            <div class="panel-head">
              <div class="panel-title">
                <span class="panel-kicker">标的</span>
                <select v-model="klineCode" class="stock-select" @change="onKlineChange">
                  <option v-for="s in stocks" :key="s.code" :value="s.code">
                    {{ s.name }} {{ s.code }}
                  </option>
                </select>
                <span class="tag">日K</span>
              </div>
              <div class="ma-legend num">
                <span class="ma5">MA5 {{ maLast("ma5") }}</span>
                <span class="ma10">MA10 {{ maLast("ma10") }}</span>
                <span class="ma20">MA20 {{ maLast("ma20") }}</span>
              </div>
            </div>

            <div class="chart-wrap">
              <div v-if="klineIsSample" class="sample-badge">示例数据</div>
              <svg
                class="kline"
                :viewBox="`0 0 ${chart.W} ${chart.H}`"
                @mousemove="onChartMove"
                @mouseleave="hover = -1"
              >
                <!-- 价格网格与刻度 -->
                <g class="grid">
                  <line
                    v-for="t in chart.priceTicks"
                    :key="'gl' + t.v"
                    :x1="chart.pad.left"
                    :x2="chart.W - chart.pad.right"
                    :y1="t.y"
                    :y2="t.y"
                  />
                  <text
                    v-for="t in chart.priceTicks"
                    :key="'gt' + t.v"
                    :x="chart.pad.left - 8"
                    :y="t.y + 3.5"
                    text-anchor="end"
                  >
                    {{ fmt(t.v, 0) }}
                  </text>
                </g>

                <!-- 悬停高亮列 -->
                <rect
                  v-if="hoverBar"
                  class="hover-col"
                  :x="hoverBar.x - chart.step / 2"
                  :y="chart.pad.top"
                  :width="chart.step"
                  :height="chart.volBottom - chart.pad.top"
                />

                <!-- 成交量 -->
                <g>
                  <text class="vol-label" :x="chart.pad.left" :y="chart.pad.volTop - 6">成交量</text>
                  <rect
                    v-for="b in chart.bars"
                    :key="'v' + b.i"
                    :x="b.x - chart.candleW / 2"
                    :y="b.volY"
                    :width="chart.candleW"
                    :height="b.volH"
                    :class="b.up ? 'vol-up' : 'vol-down'"
                  />
                  <line
                    class="axis-line"
                    :x1="chart.pad.left"
                    :x2="chart.W - chart.pad.right"
                    :y1="chart.volBottom"
                    :y2="chart.volBottom"
                  />
                </g>

                <!-- K线 -->
                <g>
                  <g v-for="b in chart.bars" :key="'c' + b.i">
                    <line
                      :x1="b.x"
                      :x2="b.x"
                      :y1="b.highY"
                      :y2="b.lowY"
                      :class="b.up ? 'wick-up' : 'wick-down'"
                    />
                    <rect
                      :x="b.x - chart.candleW / 2"
                      :y="b.bodyY"
                      :width="chart.candleW"
                      :height="b.bodyH"
                      :class="b.up ? 'body-up' : 'body-down'"
                    />
                  </g>
                </g>

                <!-- 均线 -->
                <g>
                  <path :d="chart.maPaths.ma5" class="ma-line ma5" />
                  <path :d="chart.maPaths.ma10" class="ma-line ma10" />
                  <path :d="chart.maPaths.ma20" class="ma-line ma20" />
                </g>

                <!-- 日期 -->
                <g>
                  <text
                    v-for="t in chart.dateTicks"
                    :key="'d' + t.i"
                    class="x-label"
                    :x="t.x"
                    :y="chart.volBottom + 16"
                    text-anchor="middle"
                  >
                    {{ t.label }}
                  </text>
                </g>

                <!-- 十字光标 -->
                <g v-if="hoverBar">
                  <line
                    class="cross-v"
                    :x1="hoverBar.x"
                    :x2="hoverBar.x"
                    :y1="chart.pad.top"
                    :y2="chart.volBottom"
                  />
                  <line
                    class="cross-h"
                    :x1="chart.pad.left"
                    :x2="chart.W - chart.pad.right"
                    :y1="hoverBar.closeY"
                    :y2="hoverBar.closeY"
                  />
                </g>
              </svg>

              <div v-if="hoverInfo" class="chart-tip" :style="{ left: tipLeft + '%' }">
                <div class="tip-head">
                  <span class="num">{{ hoverInfo.date }}</span>
                  <span class="num" :class="trendClass(hoverInfo.pct)">{{ signed(hoverInfo.pct) }}%</span>
                </div>
                <dl class="tip-grid num">
                  <div><dt>开盘</dt><dd>{{ fmt(hoverInfo.open) }}</dd></div>
                  <div><dt>最高</dt><dd>{{ fmt(hoverInfo.high) }}</dd></div>
                  <div><dt>最低</dt><dd>{{ fmt(hoverInfo.low) }}</dd></div>
                  <div><dt>收盘</dt><dd>{{ fmt(hoverInfo.close) }}</dd></div>
                  <div><dt>涨跌</dt><dd :class="trendClass(hoverInfo.pct)">{{ signed(hoverInfo.change) }}</dd></div>
                  <div><dt>成交</dt><dd>{{ formatVol(hoverInfo.volume) }}</dd></div>
                </dl>
              </div>
            </div>

            <div class="chart-stats num">
              <span><i>开</i>{{ fmt(latestCandle.open) }}</span>
              <span><i>高</i>{{ fmt(latestCandle.high) }}</span>
              <span><i>低</i>{{ fmt(latestCandle.low) }}</span>
              <span><i>收</i>{{ fmt(latestCandle.close) }}</span>
              <span><i>量</i>{{ formatVol(latestCandle.volume) }}</span>
              <span><i>日期</i>{{ latestCandle.date }}</span>
            </div>
          </section>

          <section class="panel stock-panel">
            <div class="panel-head">
              <div class="panel-title">
                <h2>农业自选</h2>
                <span class="tag">{{ stocks.length }} 只</span>
              </div>
              <div class="panel-actions">
                <button class="watch-manage" @click="openWatchlist">管理自选</button>
                <span class="panel-note">点击表头按涨跌幅 / 成交额排序</span>
              </div>
            </div>
            <div class="table-scroll">
              <table class="stock-table">
                <thead>
                  <tr>
                    <th>代码</th>
                    <th>名称</th>
                    <th class="ta-r">现价</th>
                    <th class="ta-r">涨跌额</th>
                    <th
                      class="ta-r sortable"
                      :class="{ active: sortKey === 'pct' }"
                      @click="toggleSort('pct')"
                    >
                      涨跌幅<span class="arrow">{{ sortArrow("pct") }}</span>
                    </th>
                    <th
                      class="ta-r sortable"
                      :class="{ active: sortKey === 'amount' }"
                      @click="toggleSort('amount')"
                    >
                      成交额<span class="arrow">{{ sortArrow("amount") }}</span>
                    </th>
                    <th class="ta-r">换手率</th>
                    <th>趋势</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="s in sortedStocks" :key="s.code">
                    <td class="code num">{{ s.code }}</td>
                    <td class="name">{{ s.name }}</td>
                    <td class="ta-r num" :class="trendClass(s.pct)">{{ fmt(s.price) }}</td>
                    <td class="ta-r num" :class="trendClass(s.pct)">{{ signed(s.change) }}</td>
                    <td class="ta-r num pct-cell" :class="trendClass(s.pct)">{{ signed(s.pct) }}%</td>
                    <td class="ta-r num">{{ formatAmount(s.amount) }}</td>
                    <td class="ta-r num">{{ fmt(s.turnover) }}%</td>
                    <td>
                      <svg class="mini" viewBox="0 0 72 22" preserveAspectRatio="none" aria-hidden="true">
                        <polyline
                          :points="sparkPoints(s.trend, 72, 22)"
                          fill="none"
                          :stroke="s.pct >= 0 ? '#ff6b6b' : '#4ade80'"
                          stroke-width="1.4"
                        />
                      </svg>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <!-- 右侧：板块 / 现货 / 快讯 -->
        <aside class="col-side">
          <section class="panel">
            <div class="panel-head">
              <h2>板块热力图</h2>
              <span class="panel-note">颜色与面积反映涨跌幅</span>
            </div>
            <div class="heat-grid">
              <div
                v-for="sec in sectors"
                :key="sec.name"
                class="heat-cell"
                :class="{ wide: sec.wide }"
                :style="heatStyle(sec.pct)"
              >
                <span class="heat-name">{{ sec.name }}</span>
                <span class="heat-pct num">{{ signed(sec.pct) }}%</span>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-head">
              <h2>农产品现货 / 期货</h2>
              <span class="panel-note">主力连续</span>
            </div>
            <div class="quote-list">
              <div v-for="q in quotes" :key="q.name" class="quote-row">
                <span class="q-name">{{ q.name }} <em>{{ q.contract }}</em></span>
                <span class="q-price num">{{ fmt(q.price) }}</span>
                <span class="q-unit">{{ q.unit }}</span>
                <span class="q-pct num" :class="trendClass(q.pct)">{{ signed(q.pct) }}%</span>
              </div>
            </div>
          </section>

          <section class="panel news-panel">
            <div class="panel-head">
              <h2>市场快讯</h2>
              <span class="panel-note">农业 · 行情</span>
            </div>
            <ul class="news-list">
              <li v-for="n in news" :key="n.time + n.title">
                <span class="news-time num">{{ n.time }}</span>
                <span class="news-text">{{ n.title }}</span>
              </li>
            </ul>
          </section>
        </aside>
      </div>

      <footer class="term-foot">
        <span>{{ marketLive ? "行情数据来自东方财富公开接口，每 30 秒自动刷新" : "数据为前端模拟生成，仅用于界面展示" }}</span>
        <span class="num">AGRI TERMINAL · 2026</span>
      </footer>
    </div>

    <div v-if="watchOpen" class="wl-mask" @click.self="closeWatchlist">
      <div class="wl-modal">
        <div class="wl-head">
          <h3>管理农业自选</h3>
          <button class="wl-close" @click="closeWatchlist">×</button>
        </div>
        <input
          v-model="watchSearch"
          class="wl-search"
          placeholder="搜索代码或名称"
        />
        <div class="wl-list">
          <label v-for="item in filteredPool" :key="item.code" class="wl-item">
            <input v-model="watchDraft" type="checkbox" :value="item.code" />
            <span class="wl-code num">{{ item.code }}</span>
            <span class="wl-name">{{ item.name }}</span>
          </label>
        </div>
        <div v-if="watchError" class="wl-error">{{ watchError }}</div>
        <div class="wl-foot">
          <span class="wl-count num">已选 {{ watchDraft.length }} / {{ watchMax }} 只</span>
          <div class="wl-buttons">
            <button class="wl-cancel" @click="closeWatchlist">取消</button>
            <button class="wl-save" :disabled="watchSaving" @click="saveWatchlist">
              {{ watchSaving ? "保存中…" : "保存自选" }}
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>

    <!-- Apple 式页脚 -->
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-top">
          <div class="footer-brand">
            <span class="footer-mark">湘小农</span>
            <p>让每一株水稻，都得到关注。</p>
            <span class="footer-en">XIANG FARMER</span>
          </div>
          <nav class="footer-cols">
            <div>
              <h4>功能</h4>
              <RouterLink to="/detect">病害识别</RouterLink>
              <RouterLink to="/community">共享社区</RouterLink>
              <RouterLink to="/twin">数字孪生</RouterLink>
              <RouterLink to="/messages">消息中心</RouterLink>
            </div>
            <div>
              <h4>数据</h4>
              <span>农业行情终端</span>
              <span>农产品现货 / 期货</span>
              <span>板块热力图</span>
            </div>
            <div>
              <h4>作者</h4>
              <span>Zaryn</span>
              <span>Pearrc</span>
              <span>Amour-zyz</span>
            </div>
          </nav>
        </div>
        <div class="footer-bottom">
          <span>© 2026 湘小农 XIANG FARMER · 演示版本，数据为模拟数据</span>
          <span>Vue 3 · FastAPI</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import state, { notify } from "../store.js";
import { getMarketOverview, getMarketKline, getMarketPool, getMarketWatchlist, saveMarketWatchlist } from "../api.js";
import PixelRiceHero from "../components/PixelRiceHero.vue";
import IntroVisual from "../components/IntroVisual.vue";
import RiceCorner from "../components/RiceCorner.vue";

// 固定种子的伪随机数生成器，保证刷新后行情形态稳定
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round2 = (n) => Math.round(n * 100) / 100;

// 生成交易日（跳过周末），以 2026-11-27 为最后一个交易日
function tradingDates(count) {
  const dates = [];
  const d = new Date(2026, 10, 27);
  while (dates.length < count) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(
        `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      );
    }
    d.setDate(d.getDate() - 1);
  }
  return dates.reverse();
}

// 生成 90 根日 K
function buildCandles(count, seed) {
  const rand = mulberry32(seed);
  const dates = tradingDates(count);
  const list = [];
  let price = 2600 + rand() * 60;
  for (let i = 0; i < count; i += 1) {
    const open = price;
    const move = (rand() - 0.47) * 0.03;
    const close = open * (1 + move);
    const top = Math.max(open, close);
    const bottom = Math.min(open, close);
    const high = top * (1 + rand() * 0.009);
    const low = bottom * (1 - rand() * 0.009);
    const volume = Math.round(80000 + rand() * 160000 + Math.abs(move) * 2600000);
    list.push({
      date: dates[i],
      open: round2(open),
      close: round2(close),
      high: round2(high),
      low: round2(low),
      volume,
    });
    price = close;
  }
  return list;
}

// 默认使用本地生成的示例 K 线，接口成功后再替换为真实数据
const sampleCandles = buildCandles(90, 20261127);
const candles = ref(sampleCandles);
const klineName = ref("隆平高科");
const klineCode = ref("000998");
const klineIsSample = ref(true);

// 自选管理
const watchOpen = ref(false);
const watchPool = ref([]);
const watchDraft = ref([]);
const watchMax = ref(20);
const watchSearch = ref("");
const watchSaving = ref(false);
const watchError = ref("");

const filteredPool = computed(() => {
  const keyword = watchSearch.value.trim().toLowerCase();
  if (!keyword) return watchPool.value;
  return watchPool.value.filter(
    (item) =>
      item.code.toLowerCase().includes(keyword) ||
      item.name.toLowerCase().includes(keyword)
  );
});

function movingAverage(values, period) {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j += 1) sum += values[j];
    return sum / period;
  });
}

const closes = computed(() => candles.value.map((c) => c.close));
const ma5 = computed(() => movingAverage(closes.value, 5));
const ma10 = computed(() => movingAverage(closes.value, 10));
const ma20 = computed(() => movingAverage(closes.value, 20));

// 折线迷你图的采样序列
function buildSeries(seed, length, drift) {
  const rand = mulberry32(seed);
  const out = [];
  let value = 100;
  for (let i = 0; i < length; i += 1) {
    value += (rand() - 0.5) * 2.4 + drift;
    out.push(value);
  }
  return out;
}

// 把数值序列转成 SVG polyline 的 points 字符串
function sparkPoints(values, width = 120, height = 34, pad = 2) {
  if (!values || values.length === 0) return "";
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 1e-6) {
    max += 1;
    min -= 1;
  }
  const stepX = (width - pad * 2) / Math.max(1, values.length - 1);
  return values
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + ((max - v) / (max - min)) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

// 指数概览
const indexDefs = [
  { code: "AGRI", name: "农业综合指数", base: 3421.56, pct: 1.28, seed: 11, drift: 0.2 },
  { code: "SEED", name: "种业指数", base: 1893.42, pct: 2.11, seed: 22, drift: 0.3 },
  { code: "LIVE", name: "养殖指数", base: 2576.08, pct: -0.63, seed: 33, drift: -0.12 },
  { code: "CFI", name: "农产品期货指数", base: 1128.75, pct: 0.44, seed: 44, drift: 0.06 },
];

const indices = ref(
  indexDefs.map((item) => {
    const change = round2((item.base * item.pct) / 100);
    return {
      ...item,
      value: item.base,
      change,
      spark: buildSeries(item.seed, 24, item.drift),
    };
  })
);

// 农业股自选
const stockDefs = [
  { code: "000998", name: "隆平高科", base: 13.42 },
  { code: "002041", name: "登海种业", base: 12.18 },
  { code: "002385", name: "大北农", base: 5.64 },
  { code: "600598", name: "北大荒", base: 15.26 },
  { code: "601952", name: "苏垦农发", base: 9.87 },
  { code: "002714", name: "牧原股份", base: 46.35 },
  { code: "300498", name: "温氏股份", base: 18.72 },
  { code: "000876", name: "新希望", base: 9.43 },
  { code: "002311", name: "海大集团", base: 51.28 },
  { code: "000895", name: "双汇发展", base: 25.64 },
  { code: "000930", name: "中粮科技", base: 6.58 },
  { code: "600127", name: "金健米业", base: 7.21 },
  { code: "600354", name: "敦煌种业", base: 4.36 },
];

const stockRand = mulberry32(20261128);
const stocks = ref(
  stockDefs.map((item, i) => {
    const dir = i % 4 === 1 ? -1 : 1;
    const rawPct = dir * (0.2 + stockRand() * 4.4);
    const price = round2(item.base * (1 + rawPct / 100));
    const change = round2(price - item.base);
    const pct = item.base ? round2((change / item.base) * 100) : 0;
    return {
      code: item.code,
      name: item.name,
      price,
      change,
      pct,
      // 统一为“元”存储，渲染时再按万/亿格式化
      amount: round2((0.8 + stockRand() * 17) * 1e8),
      turnover: round2(0.4 + stockRand() * 7.2),
      trend: buildSeries(9000 + i * 37, 20, (pct / 100) * 0.4),
    };
  })
);

// 顶部滚动行情条：指数 + 农业股
const tickerItems = computed(() => [
  ...indices.value.map((it) => ({ code: it.code, name: it.name, price: it.value, pct: it.pct })),
  ...stocks.value.slice(0, 9).map((s) => ({ code: s.code, name: s.name, price: s.price, pct: s.pct })),
]);
const tickerLoop = computed(() => [...tickerItems.value, ...tickerItems.value]);

// 板块热力图
const sectorDefs = [
  { name: "种业", pct: 2.86 },
  { name: "种植", pct: 1.12 },
  { name: "养殖", pct: -0.74 },
  { name: "饲料", pct: 0.35 },
  { name: "农机", pct: -1.26 },
  { name: "农产品加工", pct: 0.58 },
  { name: "化肥", pct: 1.64 },
  { name: "水产", pct: -0.42 },
];
const sectors = sectorDefs.map((s) => ({ ...s, wide: Math.abs(s.pct) >= 1.5 }));

// 现货 / 期货报价（玉米与示例 K 线最新收盘保持一致）
const lastBar = sampleCandles[sampleCandles.length - 1];
const prevBar = sampleCandles[sampleCandles.length - 2];
const cornPct = prevBar ? round2(((lastBar.close - prevBar.close) / prevBar.close) * 100) : 0;
const quotes = [
  { name: "玉米", contract: "主力", price: lastBar.close, unit: "元/吨", pct: cornPct },
  { name: "大豆", contract: "主力", price: 4826, unit: "元/吨", pct: 1.04 },
  { name: "小麦", contract: "主力", price: 2918, unit: "元/吨", pct: -0.35 },
  { name: "稻谷", contract: "现货", price: 2732, unit: "元/吨", pct: 0.18 },
  { name: "生猪", contract: "现货", price: 17.42, unit: "元/公斤", pct: -1.12 },
  { name: "豆粕", contract: "主力", price: 3158, unit: "元/吨", pct: 0.88 },
];

// 市场快讯
const news = [
  { time: "15:02", title: "农业农村部：全国秋粮收获进度已过九成，玉米收购价格总体平稳。" },
  { time: "14:48", title: "大商所玉米主力合约日内涨逾 1%，持仓量较上一交易日增加 3.2 万手。" },
  { time: "14:26", title: "机构调研：种业板块景气度回升，头部企业转基因品种审定推进顺利。" },
  { time: "13:55", title: "生猪现货价格小幅回落，北方产区出栏节奏加快，屠宰企业压价收购。" },
  { time: "11:30", title: "海关总署数据显示，10 月大豆进口量环比增长 6.8%，压榨利润修复。" },
  { time: "10:16", title: "农机购置补贴政策落地，丘陵山区小型农机需求明显提升。" },
];

// K 线绘图区尺寸
const CHART_W = 960;
const CHART_H = 470;
const PAD = { left: 58, right: 18, top: 18, priceBottom: 312, volTop: 336, volBottom: 446 };

const chart = computed(() => {
  const n = candles.value.length;
  const plotW = CHART_W - PAD.left - PAD.right;
  const step = plotW / Math.max(1, n);
  const candleW = Math.max(2, Math.min(10, step * 0.6));

  let min = Infinity;
  let max = -Infinity;
  candles.value.forEach((c) => {
    min = Math.min(min, c.low);
    max = Math.max(max, c.high);
  });
  [ma5.value, ma10.value, ma20.value].forEach((series) => {
    series.forEach((v) => {
      if (v != null) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    });
  });
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 1;
  }
  if (max - min < 1e-6) {
    const center = (max + min) / 2 || 1;
    min = center - 1;
    max = center + 1;
  }
  const padPrice = (max - min) * 0.04;
  min -= padPrice;
  max += padPrice;
  const range = max - min;
  const priceH = PAD.priceBottom - PAD.top;

  const yPrice = (v) => PAD.top + ((max - v) / range) * priceH;
  const xFor = (i) => PAD.left + (i + 0.5) * step;

  const volMax = Math.max(...candles.value.map((c) => c.volume), 1);
  const yVol = (v) => PAD.volBottom - (v / volMax) * (PAD.volBottom - PAD.volTop);

  const bars = candles.value.map((c, i) => {
    const x = xFor(i);
    const openY = yPrice(c.open);
    const closeY = yPrice(c.close);
    const volH = Math.max(1, PAD.volBottom - yVol(c.volume));
    return {
      ...c,
      i,
      x,
      openY,
      closeY,
      highY: yPrice(c.high),
      lowY: yPrice(c.low),
      up: c.close >= c.open,
      bodyY: Math.min(openY, closeY),
      bodyH: Math.max(1, Math.abs(closeY - openY)),
      volY: PAD.volBottom - volH,
      volH,
    };
  });

  const buildPath = (values) => {
    let d = "";
    let started = false;
    values.forEach((v, i) => {
      if (v == null) return;
      d += `${started ? " L" : "M"}${xFor(i).toFixed(1)} ${yPrice(v).toFixed(1)}`;
      started = true;
    });
    return d;
  };

  const priceTicks = [];
  for (let i = 0; i <= 4; i += 1) {
    const v = max - (range * i) / 4;
    priceTicks.push({ v, y: yPrice(v) });
  }

  const dateTicks = [];
  const tickEvery = Math.max(1, Math.round(n / 6));
  for (let i = 0; i < n; i += tickEvery) {
    dateTicks.push({ i, x: xFor(i), label: candles.value[i].date });
  }

  return {
    W: CHART_W,
    H: CHART_H,
    pad: PAD,
    step,
    candleW,
    bars,
    priceTicks,
    dateTicks,
    volBottom: PAD.volBottom,
    maPaths: {
      ma5: buildPath(ma5.value),
      ma10: buildPath(ma10.value),
      ma20: buildPath(ma20.value),
    },
  };
});

const latestCandle = computed(() => candles.value[candles.value.length - 1]);

// 悬停交互
const hover = ref(-1);
const hoverBar = computed(() => (hover.value >= 0 ? chart.value.bars[hover.value] : null));
const hoverInfo = computed(() => {
  if (hover.value < 0) return null;
  const c = candles.value[hover.value];
  const prevClose = hover.value > 0 ? candles.value[hover.value - 1].close : c.open;
  const pct = prevClose ? ((c.close - prevClose) / prevClose) * 100 : 0;
  return { ...c, pct, change: round2(c.close - prevClose) };
});
const tipLeft = computed(() => {
  if (!hoverBar.value) return 50;
  return Math.min(88, Math.max(12, (hoverBar.value.x / CHART_W) * 100));
});

function onChartMove(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  if (!rect.width) return;
  const x = ((event.clientX - rect.left) / rect.width) * CHART_W;
  if (x < PAD.left || x > CHART_W - PAD.right) {
    hover.value = -1;
    return;
  }
  const index = Math.floor((x - PAD.left) / chart.value.step);
  hover.value = Math.max(0, Math.min(candles.value.length - 1, index));
}

// 表格排序
const sortKey = ref("pct");
const sortDir = ref("desc");
const sortedStocks = computed(() => {
  const list = stocks.value.slice();
  const key = sortKey.value;
  const sign = sortDir.value === "asc" ? 1 : -1;
  list.sort((a, b) => (a[key] - b[key]) * sign);
  return list;
});
function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === "desc" ? "asc" : "desc";
  } else {
    sortKey.value = key;
    sortDir.value = "desc";
  }
}
function sortArrow(key) {
  if (sortKey.value !== key) return "↕";
  return sortDir.value === "desc" ? "↓" : "↑";
}

// 格式化工具
function fmt(n, digits = 2) {
  if (!Number.isFinite(n)) return "--";
  return n.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
function signed(n, digits = 2) {
  if (!Number.isFinite(n)) return "--";
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
}
function trendClass(v) {
  if (v > 0) return "up";
  if (v < 0) return "down";
  return "flat";
}
function formatVol(v) {
  if (!Number.isFinite(v)) return "--";
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(1)}万`;
  return String(v);
}
function formatAmount(v) {
  if (!Number.isFinite(v)) return "--";
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(2)}万`;
  return v.toFixed(2);
}
function maLast(key) {
  const series = key === "ma5" ? ma5.value : key === "ma10" ? ma10.value : ma20.value;
  const v = series[series.length - 1];
  return v == null ? "--" : fmt(v);
}
function heatStyle(pct) {
  const magnitude = Math.min(Math.abs(pct) / 3, 1);
  const alpha = 0.12 + magnitude * 0.5;
  const rgb = pct >= 0 ? "255, 77, 79" : "0, 192, 135";
  return {
    background: `rgba(${rgb}, ${alpha.toFixed(2)})`,
    borderColor: `rgba(${rgb}, ${(alpha + 0.25).toFixed(2)})`,
  };
}

// 顶部时钟与行情状态
const now = ref(new Date());
const clockText = computed(() => now.value.toLocaleTimeString("zh-CN", { hour12: false }));
const marketLive = ref(false);
const marketClock = ref("");
const marketStatusText = computed(() =>
  marketLive.value
    ? `实时行情 · ${marketClock.value} 更新`
    : "示例行情 · 实时接口不可用"
);

function seedFrom(text) {
  let hash = 0;
  for (const ch of String(text)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash || 1;
}

async function loadMarket() {
  try {
    const data = await getMarketOverview();
    const idxList = Array.isArray(data && data.indices) ? data.indices : [];
    const stockList = Array.isArray(data && data.stocks) ? data.stocks : [];
    if (!idxList.length && !stockList.length) throw new Error("行情数据为空");

    if (idxList.length) {
      indices.value = idxList.map((it, i) => ({
        code: it.code,
        name: it.name,
        value: Number(it.price),
        change: Number(it.change),
        pct: Number(it.pct),
        spark: buildSeries(seedFrom(it.code) + i, 24, ((Number(it.pct) || 0) / 100) * 0.2),
      }));
    }
    if (stockList.length) {
      stocks.value = stockList.map((it, i) => ({
        code: it.code,
        name: it.name,
        price: Number(it.price),
        change: Number(it.change),
        pct: Number(it.pct),
        amount: Number(it.amount),
        turnover: Number(it.turnover),
        trend: buildSeries(9000 + i * 37, 20, ((Number(it.pct) || 0) / 100) * 0.4),
      }));
    }

    marketClock.value = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    marketLive.value = true;

    // 自选被修改后，保证 K 线选择仍然有效
    if (stocks.value.length && !stocks.value.some((s) => s.code === klineCode.value)) {
      klineCode.value = stocks.value[0].code;
      klineName.value = stocks.value[0].name;
      loadKline();
    }
  } catch (err) {
    marketLive.value = false;
  }
}

async function loadKline() {
  try {
    const data = await getMarketKline(klineCode.value);
    const list = Array.isArray(data && data.klines) ? data.klines : [];
    if (!list.length) return;
    candles.value = list.map((k) => ({
      date: String(k.date || "").slice(5),
      open: Number(k.open),
      close: Number(k.close),
      high: Number(k.high),
      low: Number(k.low),
      volume: Number(k.volume),
      amount: Number(k.amount),
    }));
    if (data.name) klineName.value = data.name;
    klineIsSample.value = false;
  } catch (err) {
    // 拉取失败时保留本地示例图，并继续标注“示例数据”
    klineIsSample.value = true;
  }
}

function onKlineChange() {
  const selected = stocks.value.find((s) => s.code === klineCode.value);
  if (selected) klineName.value = selected.name;
  klineIsSample.value = true;
  loadKline();
}

async function openWatchlist() {
  watchOpen.value = true;
  watchError.value = "";
  watchSearch.value = "";
  try {
    const [poolData, watchData] = await Promise.all([
      getMarketPool(),
      getMarketWatchlist(),
    ]);
    watchPool.value = Array.isArray(poolData.stocks) ? poolData.stocks : [];
    watchDraft.value = Array.isArray(watchData.codes) ? [...watchData.codes] : [];
    watchMax.value = Number(watchData.max) || 20;
  } catch (err) {
    watchError.value = "自选数据加载失败，请检查登录状态";
  }
}

function closeWatchlist() {
  watchOpen.value = false;
  watchError.value = "";
}

async function saveWatchlist() {
  if (!watchDraft.value.length) {
    watchError.value = "请至少选择一只股票";
    return;
  }
  if (watchDraft.value.length > watchMax.value) {
    watchError.value = `最多选择 ${watchMax.value} 只股票`;
    return;
  }
  watchSaving.value = true;
  watchError.value = "";
  try {
    const res = await saveMarketWatchlist(watchDraft.value);
    watchDraft.value = Array.isArray(res.codes) ? [...res.codes] : watchDraft.value;
    watchOpen.value = false;
    await loadMarket();
    if (!stocks.value.some((s) => s.code === klineCode.value)) {
      const first = stocks.value[0];
      if (first) {
        klineCode.value = first.code;
        klineName.value = first.name;
        klineIsSample.value = true;
        await loadKline();
      }
    }
  } catch (err) {
    watchError.value = err.message || "保存失败，请稍后重试";
  } finally {
    watchSaving.value = false;
  }
}

let clockTimer = null;
let pollTimer = null;
onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = new Date();
  }, 1000);
  loadMarket();
  loadKline();
  pollTimer = setInterval(loadMarket, 30000);
});
onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer);
  if (pollTimer) clearInterval(pollTimer);
});

const userName = computed(() => (state.user && state.user.name) || "农友");
const isAdmin = computed(() => !!(state.user && state.user.role === "admin"));

// 首页五张介绍卡
const features = [
  {
    id: "detect",
    index: "01",
    kicker: "DISEASE DETECTION",
    title: "病害识别",
    desc: "上传一张叶片照片，模型在几秒内框出病斑、给出病害名称与置信度，并把结果存进检测历史，方便回看与对比。",
    points: ["覆盖 12 类水稻常见病害", "像素级病斑框选与置信度", "检测记录自动归档"],
    to: "/detect",
    cta: "进入病害识别",
    visual: "detect",
    highlight: true,
  },
  {
    id: "community",
    index: "02",
    kicker: "SHARED COMMUNITY",
    title: "共享社区",
    desc: "把田里的问题发出来，让农技站和种田老手一起看。支持长文、图片附件、评论与点赞，像读一份情况说明一样读完一条帖子。",
    points: ["发帖可附图片与说明文档", "评论、回复与点赞完整链路", "帖子可展开为全屏阅读页"],
    to: "/community",
    cta: "去社区看看",
    visual: "community",
  },
  {
    id: "twin",
    index: "03",
    kicker: "DIGITAL TWIN",
    title: "数字孪生",
    desc: "把整片稻田搬进浏览器。按田块查看长势、土壤、光照与设备状态，用同一套参数推演不同管理方案的结果。",
    points: ["田块级长势与设备状态", "可切换的天气与生长阶段", "参数化场景推演"],
    to: "/twin",
    cta: "打开孪生平台",
    visual: "twin",
  },
  {
    id: "messages",
    index: "04",
    kicker: "MESSAGE CENTER",
    title: "消息中心",
    desc: "检测完成、社区回复、审核结果与系统通知集中在一处。未读数字实时同步到顶部导航，不会漏掉该处理的事。",
    points: ["系统消息与管理员消息分类", "未读状态实时同步", "一键全部标为已读"],
    to: "/messages",
    cta: "查看消息",
    visual: "messages",
  },
  {
    id: "admin",
    index: "05",
    kicker: "ADMIN CONSOLE",
    title: "管理后台",
    desc: "用户、帖子、反馈与审核在一张仪表盘里。这里展示的是管理员视角的动态预览，普通账号可以了解它能做什么，但不能进入或改动任何数据。",
    points: ["用户与权限管理", "社区内容审核", "意见反馈处理"],
    to: "/admin/dashboard",
    cta: "进入管理后台",
    visual: "admin",
    adminOnly: true,
    highlight: true,
  },
];

function adminPreview() {
  notify("管理后台仅管理员可进入，这里展示的是管理员视角预览");
}
</script>

<style scoped>
.terminal {
  --bg: #070b12;
  --panel: #0b1422;
  --line: #1b2740;
  --line-soft: #121d2e;
  --text: #dfe6f2;
  --muted: #8b96ab;
  --dim: #5b6a82;
  --up: #ff6b6b;
  --down: #4ade80;
  --gold: #e8c66e;
  --mono: "SFMono-Regular", "Cascadia Mono", "JetBrains Mono", Consolas, "Courier New", monospace;
  min-height: 100%;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 13px;
  line-height: 1.4;
}

.num {
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
  letter-spacing: -0.01em;
}

.up {
  color: var(--up);
}
.down {
  color: var(--down);
}
.flat {
  color: var(--muted);
}

/* —— 顶部滚动行情条 —— */
.ticker-bar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: stretch;
  height: 34px;
  background: #080e18;
  border-bottom: 1px solid var(--line);
  overflow: hidden;
  font-size: 12px;
}

.ticker-label {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 0 14px;
  background: var(--gold);
  color: #151005;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.ticker-view {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  position: relative;
}

.ticker-run {
  display: flex;
  width: max-content;
  height: 100%;
  animation: ticker-scroll 48s linear infinite;
}

.ticker-view:hover .ticker-run {
  animation-play-state: paused;
}

.ticker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 18px;
  border-right: 1px solid var(--line-soft);
  white-space: nowrap;
}

.t-code {
  color: var(--dim);
}
.t-name {
  color: #aeb9c7;
}
.t-price {
  color: var(--text);
}
.t-pct {
  font-weight: 600;
}

.ticker-time {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 0 14px;
  border-left: 1px solid var(--line);
  background: #080e18;
  color: var(--muted);
  font-size: 12px;
}

@keyframes ticker-scroll {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

/* —— 页面框架 —— */
.t-shell {
  max-width: 1440px;
  margin: 0 auto;
  padding: 16px 20px 28px;
}

.term-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 2px 2px 14px;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.brand-mark {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #151005;
  background: var(--gold);
  padding: 2px 6px;
  border-radius: 2px;
}

.brand h1 {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #e8eef6;
}

.brand-sub {
  font-size: 12px;
  color: var(--dim);
}

.head-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.hello {
  font-size: 12px;
  color: var(--muted);
}
.hello strong {
  color: #dce5ef;
  font-weight: 600;
}

.session {
  font-size: 11px;
  color: var(--muted);
  border: 1px solid var(--line);
  padding: 3px 8px;
  border-radius: 3px;
}

.market-status {
  font-size: 11px;
  padding: 3px 8px;
  border: 1px solid var(--line);
  border-radius: 3px;
  white-space: nowrap;
}

.market-status.live {
  color: var(--gold);
  border-color: rgba(232, 198, 110, 0.4);
}

.market-status.sample {
  color: var(--muted);
}

/* —— 指数概览 —— */
.index-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.index-card {
  background: linear-gradient(180deg, #101a2b, #0b131f);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 10px 12px 6px;
  min-width: 0;
  overflow: hidden;
}

.idx-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.idx-name {
  font-size: 12px;
  color: #b9c4d2;
  white-space: nowrap;
}

.idx-code {
  font-size: 10px;
  color: var(--dim);
  letter-spacing: 0.08em;
}

.idx-value {
  margin: 6px 0 2px;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.idx-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
}

.spark {
  display: block;
  width: 100%;
  height: 34px;
  margin-top: 4px;
  opacity: 0.9;
}

/* —— 主区域布局 —— */
.main-grid {
  display: grid;
  grid-template-columns: minmax(0, 2.05fr) minmax(320px, 1fr);
  gap: 12px;
  align-items: start;
}

.col-main,
.col-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
/* —— 面板通用 —— */
.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 12px 14px;
  min-width: 0;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-bottom: 10px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--line-soft);
}

.panel-head h2 {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #e3ebf4;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag {
  font-size: 10px;
  color: var(--gold);
  border: 1px solid rgba(232, 198, 110, 0.35);
  padding: 1px 6px;
  border-radius: 2px;
  letter-spacing: 0.08em;
}

.panel-note {
  font-size: 11px;
  color: var(--dim);
}

.ma-legend {
  display: flex;
  gap: 14px;
  font-size: 11px;
}

.ma-legend .ma5 {
  color: #e8c66e;
}
.ma-legend .ma10 {
  color: #4dabf7;
}
.ma-legend .ma20 {
  color: #b197fc;
}

/* —— K 线图 —— */
.chart-wrap {
  position: relative;
}

.sample-badge {
  position: absolute;
  top: 8px;
  right: 10px;
  z-index: 4;
  padding: 2px 7px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: rgba(6, 10, 18, 0.88);
  color: var(--muted);
  font-size: 11px;
  letter-spacing: 0.06em;
  pointer-events: none;
}

.kline {
  display: block;
  width: 100%;
  height: auto;
  min-width: 0;
}

.kline .grid line {
  stroke: #182338;
  stroke-width: 1;
  stroke-dasharray: 3 4;
}

.kline .grid text {
  fill: var(--dim);
  font-family: var(--mono);
  font-size: 11px;
}

.kline .vol-label {
  fill: var(--dim);
  font-size: 10px;
  letter-spacing: 0.08em;
}

.kline .x-label {
  fill: var(--dim);
  font-family: var(--mono);
  font-size: 10.5px;
}

.kline .axis-line {
  stroke: #243149;
  stroke-width: 1;
}

.kline .hover-col {
  fill: rgba(255, 255, 255, 0.045);
}

.kline .vol-up {
  fill: rgba(255, 77, 79, 0.42);
}
.kline .vol-down {
  fill: rgba(0, 192, 135, 0.42);
}

.kline .wick-up {
  stroke: var(--up);
  stroke-width: 1;
}
.kline .wick-down {
  stroke: var(--down);
  stroke-width: 1;
}

.kline .body-up {
  fill: var(--up);
}
.kline .body-down {
  fill: var(--down);
}

.kline .ma-line {
  fill: none;
  stroke-width: 1.4;
  opacity: 0.95;
}
.kline .ma-line.ma5 {
  stroke: #e8c66e;
}
.kline .ma-line.ma10 {
  stroke: #4dabf7;
}
.kline .ma-line.ma20 {
  stroke: #b197fc;
}

.kline .cross-v,
.kline .cross-h {
  stroke: #8a96a8;
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.chart-tip {
  position: absolute;
  top: 8px;
  transform: translateX(-50%);
  min-width: 158px;
  padding: 8px 10px;
  background: rgba(6, 10, 18, 0.94);
  border: 1px solid #2a3852;
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  pointer-events: none;
  z-index: 5;
}

.tip-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 6px;
  margin-bottom: 6px;
  border-bottom: 1px solid var(--line-soft);
  font-size: 11px;
  color: var(--muted);
}

.tip-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 12px;
  margin: 0;
  font-size: 11px;
}

.tip-grid div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.tip-grid dt {
  color: var(--dim);
}
.tip-grid dd {
  margin: 0;
  color: #cfd8e3;
}
.tip-grid dd.up {
  color: var(--up);
}
.tip-grid dd.down {
  color: var(--down);
}

.chart-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  padding-top: 10px;
  margin-top: 8px;
  border-top: 1px solid var(--line-soft);
  font-size: 12px;
  color: #c3cedb;
}

.chart-stats i {
  font-style: normal;
  font-size: 11px;
  color: var(--dim);
  margin-right: 5px;
}
/* —— 自选股表格 —— */
.table-scroll {
  max-height: 524px;
  overflow: auto;
}

.stock-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  white-space: nowrap;
}

.stock-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 8px 10px;
  background: #0d1624;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-size: 11px;
  font-weight: 500;
  text-align: left;
}

.stock-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--line-soft);
  color: #c6d0dc;
}

.stock-table td.up {
  color: var(--up);
}
.stock-table td.down {
  color: var(--down);
}

.stock-table tbody tr:hover {
  background: #111b2c;
}

.stock-table tbody tr:last-child td {
  border-bottom: none;
}

.ta-r {
  text-align: right !important;
}

.stock-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.stock-table th.sortable:hover,
.stock-table th.sortable.active {
  color: var(--gold);
}

.arrow {
  margin-left: 2px;
  font-size: 10px;
  opacity: 0.85;
}

.stock-table .code {
  color: var(--muted);
}

.stock-table .name {
  color: #e3eaf3;
  font-weight: 500;
}

.stock-table .pct-cell {
  font-weight: 600;
}

.mini {
  display: block;
  width: 72px;
  height: 22px;
}

/* —— 板块热力图 —— */
.heat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.heat-cell {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  min-height: 62px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 4px;
  transition: transform 0.15s ease;
}

.heat-cell.wide {
  grid-column: span 2;
}

.heat-cell:hover {
  transform: translateY(-1px);
}

.heat-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.88);
}

.heat-pct {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
}

/* —— 农产品报价 —— */
.quote-list {
  display: flex;
  flex-direction: column;
}

.quote-row {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  align-items: baseline;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line-soft);
}

.quote-row:last-child {
  border-bottom: none;
}

.q-name {
  font-size: 12px;
  color: #d2dbe6;
}

.q-name em {
  font-style: normal;
  font-size: 10px;
  color: var(--dim);
  margin-left: 5px;
}

.q-price {
  font-size: 13px;
  color: #e6edf5;
}

.q-unit {
  font-size: 10px;
  color: var(--dim);
}

.q-pct {
  min-width: 52px;
  font-size: 12px;
  font-weight: 600;
  text-align: right;
}

/* —— 市场快讯 —— */
.news-list {
  display: flex;
  flex-direction: column;
}

.news-list li {
  display: flex;
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px solid var(--line-soft);
  line-height: 1.5;
}

.news-list li:last-child {
  border-bottom: none;
}

.news-time {
  flex: 0 0 auto;
  padding-top: 1px;
  font-size: 11px;
  color: var(--gold);
}

.news-text {
  font-size: 12px;
  color: #c0cad7;
}

/* —— 底部说明 —— */
.term-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid var(--line-soft);
  font-size: 11px;
  color: var(--dim);
}

/* —— 滚动条 —— */
.table-scroll::-webkit-scrollbar,
.chart-wrap::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.table-scroll::-webkit-scrollbar-thumb,
.chart-wrap::-webkit-scrollbar-thumb {
  background: #243149;
  border-radius: 4px;
}

.table-scroll::-webkit-scrollbar-track,
.chart-wrap::-webkit-scrollbar-track {
  background: transparent;
}

/* —— 响应式 —— */
@media (max-width: 1180px) {
  .index-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .main-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .t-shell {
    padding: 12px 12px 24px;
  }
  .ticker-label {
    padding: 0 8px;
    letter-spacing: 0.08em;
  }
  .ticker-time {
    display: none;
  }
  .brand h1 {
    font-size: 15px;
  }
  .brand-sub {
    display: none;
  }
  .index-grid {
    gap: 8px;
  }
  .idx-value {
    font-size: 20px;
  }
  .heat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .chart-wrap {
    overflow-x: auto;
  }
  .kline {
    min-width: 560px;
  }
  .chart-tip {
    display: none;
  }
  .table-scroll {
    max-height: 420px;
  }
}

/* —— 自选切换与管理 —— */
.stock-select {
  border: 1px solid var(--line);
  background: #0f1828;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  padding: 5px 9px;
  border-radius: 6px;
  outline: none;
  cursor: pointer;
}

.panel-kicker {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--muted);
  text-transform: uppercase;
}

.stock-select:focus {
  border-color: var(--gold);
}

.panel-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.watch-manage {
  border: 1px solid rgba(232, 198, 110, 0.4);
  background: rgba(232, 198, 110, 0.08);
  color: var(--gold);
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.watch-manage:hover {
  background: rgba(232, 198, 110, 0.16);
}

.wl-mask {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(4px);
}

.wl-modal {
  width: 520px;
  max-width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  background: #0b1422;
  border: 1px solid var(--line);
  border-radius: 14px;
  color: var(--text);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
}

.wl-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wl-head h3 {
  font-size: 15px;
  font-weight: 600;
}

.wl-close {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.wl-close:hover {
  color: var(--text);
}

.wl-search {
  border: 1px solid var(--line);
  background: #0f1828;
  color: var(--text);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  outline: none;
}

.wl-search:focus {
  border-color: var(--gold);
}

.wl-list {
  flex: 1;
  min-height: 180px;
  max-height: 44vh;
  overflow-y: auto;
  border-top: 1px solid var(--line-soft);
  border-bottom: 1px solid var(--line-soft);
}

.wl-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px;
  border-bottom: 1px solid var(--line-soft);
  font-size: 13px;
  cursor: pointer;
}

.wl-item:last-child {
  border-bottom: none;
}

.wl-item:hover {
  background: rgba(255, 255, 255, 0.03);
}

.wl-item input {
  accent-color: var(--gold);
}

.wl-code {
  width: 66px;
  color: var(--muted);
  font-size: 12px;
}

.wl-name {
  color: var(--text);
}

.wl-error {
  font-size: 12px;
  color: #ff7875;
}

.wl-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.wl-count {
  font-size: 12px;
  color: var(--muted);
}

.wl-buttons {
  display: flex;
  gap: 10px;
}

.wl-cancel,
.wl-save {
  border: none;
  border-radius: 7px;
  padding: 7px 14px;
  font-size: 13px;
  cursor: pointer;
}

.wl-cancel {
  background: rgba(255, 255, 255, 0.07);
  color: var(--text);
}

.wl-save {
  background: var(--gold);
  color: #151a22;
  font-weight: 600;
}

.wl-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ================= 首页：Hero / 功能卡 / 页脚 ================= */
.home-page {
  background: #070b12;
  color: #ece6d8;
}

.hero {
  position: relative;
  overflow: hidden;
  min-height: calc(100vh - 72px);
  padding: 104px 40px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  isolation: isolate;
}

.hero-field {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.hero-field svg {
  width: 100%;
  height: 100%;
}

.hero-veil {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: radial-gradient(
      ellipse 62% 46% at 50% 44%,
      rgba(7, 11, 18, 0.86) 0%,
      rgba(7, 11, 18, 0.5) 46%,
      rgba(7, 11, 18, 0) 74%
    ),
    linear-gradient(180deg, rgba(7, 11, 18, 0.9) 0%, rgba(7, 11, 18, 0) 32%),
    linear-gradient(0deg, rgba(7, 11, 18, 0.94) 0%, rgba(7, 11, 18, 0) 38%);
}

.hero-content {
  position: relative;
  z-index: 3;
  text-align: center;
  pointer-events: none;
}

.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.44em;
  color: rgba(240, 220, 168, 0.78);
  margin-bottom: 10px;
}

.hero-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #e8c66e;
  animation: agri-pulse 2.6s ease-in-out infinite;
}

/* 大标题：整体白色，内部有金色纹路，边缘一圈金色光晕 */
.hero-title {
  margin: 0;
  font-size: clamp(120px, 19vw, 280px);
  font-weight: 750;
  line-height: 0.92;
  letter-spacing: 0.01em;
  color: transparent;
  background-image: repeating-linear-gradient(
      112deg,
      rgba(232, 198, 110, 0) 0 16px,
      rgba(232, 198, 110, 0.62) 16px 18px,
      rgba(232, 198, 110, 0) 18px 34px
    ),
    repeating-linear-gradient(
      -38deg,
      rgba(246, 226, 168, 0) 0 24px,
      rgba(246, 226, 168, 0.34) 24px 25.5px,
      rgba(246, 226, 168, 0) 25.5px 50px
    ),
    linear-gradient(
      104deg,
      #ffffff 0%,
      #ffffff 34%,
      #fffdf6 50%,
      #ffffff 64%,
      #fffdf8 82%,
      #ffffff 100%
    );
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-stroke: 2.5px rgba(246, 226, 168, 0.88);
  filter: drop-shadow(0 0 26px rgba(232, 198, 110, 0.36))
    drop-shadow(0 0 78px rgba(232, 198, 110, 0.22));
  animation: title-breathe 9s ease-in-out infinite;
}

@keyframes title-breathe {
  0%,
  100% {
    filter: drop-shadow(0 0 22px rgba(232, 198, 110, 0.3))
      drop-shadow(0 0 66px rgba(232, 198, 110, 0.16));
  }
  50% {
    filter: drop-shadow(0 0 34px rgba(232, 198, 110, 0.46))
      drop-shadow(0 0 100px rgba(232, 198, 110, 0.28));
  }
}

/* 副标题：镂空金色描边，散落在标题四周 */
.hero-words {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.hw {
  position: absolute;
  color: transparent;
  -webkit-text-stroke: 1.3px rgba(232, 198, 110, 0.85);
  font-weight: 600;
  letter-spacing: 0.08em;
  white-space: nowrap;
  text-shadow: 0 2px 18px rgba(7, 11, 18, 0.95), 0 0 42px rgba(7, 11, 18, 0.9);
  animation: word-float 11s ease-in-out infinite;
  isolation: isolate;
}

.hw::before {
  content: "";
  position: absolute;
  inset: -26px -34px;
  z-index: -1;
  background: radial-gradient(closest-side, rgba(7, 11, 18, 0.78), rgba(7, 11, 18, 0) 72%);
  filter: blur(6px);
  pointer-events: none;
}

.hw-1 {
  left: 5%;
  top: 21%;
  font-size: clamp(17px, 1.7vw, 26px);
  animation-delay: -2s;
}

.hw-2 {
  right: 5%;
  top: 21%;
  font-size: clamp(26px, 2.9vw, 46px);
  -webkit-text-stroke-width: 1.6px;
  animation-delay: -5s;
}

.hw-4 {
  right: 8%;
  bottom: 26%;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.4em;
  -webkit-text-stroke-width: 0.8px;
  opacity: 0.88;
  animation-delay: -3.5s;
}

@keyframes word-float {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.72;
  }
  50% {
    transform: translateY(-8px);
    opacity: 0.95;
  }
}

.hero-scroll {
  position: absolute;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  letter-spacing: 0.16em;
  color: #677184;
}

.hero-scroll span {
  display: inline-block;
  animation: hero-bob 2.4s ease-in-out infinite;
}

@media (max-width: 900px) {
  .hero {
    min-height: max(600px, calc(100vh - 64px));
    padding: 84px 20px 32px;
  }

  .hero-title {
    font-size: clamp(92px, 26vw, 160px);
  }

  .hw-1 {
    left: 5%;
    top: 22%;
  }

  .hw-2 {
    right: 5%;
    top: 20%;
  }

  .hw-4 {
    display: none;
  }
}

@media (max-height: 740px) and (min-width: 901px) {
  .hero {
    padding-top: 82px;
  }

  .hero-title {
    font-size: clamp(100px, 15vw, 200px);
  }
}

/* —— 功能卡 —— */
.features {
  max-width: 1320px;
  margin: 0 auto;
  padding: 54px 40px 16px;
}

.features-head {
  max-width: 730px;
  margin-bottom: 40px;
}

.sec-kicker {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.3em;
  color: #b7a06a;
}

.features-head h2 {
  margin-top: 14px;
  font-size: clamp(30px, 3.4vw, 44px);
  font-weight: 650;
  line-height: 1.16;
  letter-spacing: -0.04em;
  color: #f2ecdd;
}

.sec-desc {
  margin-top: 14px;
  font-size: 14.5px;
  line-height: 1.8;
  color: #8b94a5;
}

.feature-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.14fr) minmax(0, 0.86fr);
  gap: clamp(26px, 5vw, 72px);
  align-items: center;
  padding: clamp(28px, 4vw, 58px);
  border-radius: 34px;
  border: 1px solid rgba(236, 230, 216, 0.08);
  background: linear-gradient(158deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.012) 62%);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  margin-bottom: 26px;
  overflow: hidden;
  transition: border-color 0.5s var(--agri-ease), transform 0.5s var(--agri-ease);
}

.feature-card::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at 82% 28%, rgba(232, 198, 110, 0.1), transparent 48%);
}

.feature-card:hover {
  border-color: rgba(232, 198, 110, 0.24);
  transform: translateY(-2px);
}

.feature-card.reverse .fc-copy {
  order: 2;
}

.feature-card.reverse .fc-visual {
  order: 1;
}

.fc-copy,
.fc-visual {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.fc-eyebrow {
  display: flex;
  align-items: center;
  gap: 12px;
}

.fc-num {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  color: #e8c66e;
  border: 1px solid rgba(232, 198, 110, 0.3);
  border-radius: 999px;
  padding: 3px 9px;
}

.fc-kicker {
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.24em;
  color: #7f8999;
}

.fc-title {
  margin-top: 20px;
  font-size: clamp(26px, 3vw, 36px);
  font-weight: 650;
  letter-spacing: -0.035em;
  color: #f3eddf;
}

.fc-desc {
  margin-top: 14px;
  max-width: 520px;
  font-size: 14.5px;
  line-height: 1.85;
  color: #98a1b1;
}

.fc-points {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: 22px;
}

.fc-points li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #c2cbd8;
}

.tick {
  width: 6px;
  height: 6px;
  border-radius: 1px;
  background: linear-gradient(135deg, #f6e2a8, #b1852f);
  box-shadow: 0 0 8px rgba(232, 198, 110, 0.4);
  flex: 0 0 auto;
}

.fc-cta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 30px;
  height: 44px;
  padding: 0 22px;
  border: 1px solid rgba(246, 226, 168, 0.55);
  border-radius: 999px;
  background: linear-gradient(135deg, #f8e7b8 0%, #d9b364 52%, #f7e7c0 100%);
  color: #211607;
  font-size: 13.5px;
  font-weight: 650;
  letter-spacing: 0.02em;
  text-decoration: none;
  cursor: pointer;
  box-shadow: 0 8px 22px rgba(201, 160, 74, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
  transition: transform 0.35s var(--agri-ease), box-shadow 0.35s var(--agri-ease),
    filter 0.35s var(--agri-ease), border-color 0.35s var(--agri-ease);
}

.fc-cta:hover {
  transform: translateY(-2px);
  filter: brightness(1.06);
  box-shadow: 0 12px 30px rgba(201, 160, 74, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.62);
}

.fc-cta:active {
  transform: translateY(0) scale(0.985);
}

.fc-cta .cta-arrow {
  transition: transform 0.35s var(--agri-ease);
}

.fc-cta:hover .cta-arrow {
  transform: translateX(4px);
}

.fc-cta-locked {
  background: rgba(236, 230, 216, 0.05);
  color: #d8cdb4;
  border-color: rgba(246, 226, 168, 0.26);
  box-shadow: none;
}

.fc-cta-locked:hover {
  transform: none;
  filter: none;
  border-color: rgba(246, 226, 168, 0.5);
  background: rgba(246, 226, 168, 0.08);
}

.fc-cta-locked .cta-lock {
  font-size: 10px;
  letter-spacing: 0.08em;
  color: #b6a273;
  border: 1px solid rgba(232, 198, 110, 0.24);
  border-radius: 999px;
  padding: 2px 8px;
}

.corner-mark {
  z-index: 2;
}

/* —— 页脚 —— */
.site-footer {
  margin-top: 30px;
  border-top: 1px solid rgba(236, 230, 216, 0.08);
  background: linear-gradient(180deg, transparent, rgba(232, 198, 110, 0.035));
}

.footer-inner {
  max-width: 1320px;
  margin: 0 auto;
  padding: 54px 40px 34px;
}

.footer-top {
  display: grid;
  grid-template-columns: 1.1fr 1.4fr;
  gap: 48px;
  padding-bottom: 32px;
  border-bottom: 1px solid rgba(236, 230, 216, 0.07);
}

.footer-mark {
  font-size: 24px;
  font-weight: 650;
  letter-spacing: -0.04em;
  color: #f2ecdd;
}

.footer-brand p {
  margin-top: 10px;
  font-size: 13.5px;
  color: #8b94a5;
}

.footer-en {
  display: block;
  margin-top: 18px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.3em;
  color: #5f6a7c;
}

.footer-cols {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.footer-cols h4 {
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 600;
  color: #e4ddcd;
  letter-spacing: 0.02em;
}

.footer-cols a,
.footer-cols span {
  display: block;
  padding: 5px 0;
  font-size: 12.5px;
  color: #8b94a5;
  transition: color 0.3s var(--agri-ease);
}

.footer-cols a:hover {
  color: #f0dca8;
}

.footer-bottom {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding-top: 22px;
  font-size: 11.5px;
  color: #677184;
}

@keyframes hero-bob {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.45;
  }
  50% {
    transform: translateY(4px);
    opacity: 1;
  }
}

@media (max-width: 900px) {
  .hero {
    padding: 52px 24px 20px;
  }

  .hero-inner {
    grid-template-columns: 1fr;
    gap: 8px;
    min-height: 0;
  }

  .hero-title {
    font-size: 64px;
  }

  .hero-art {
    max-width: 440px;
    margin: 0 auto;
  }

  .features {
    padding: 36px 20px 12px;
  }

  .feature-card {
    grid-template-columns: 1fr;
    gap: 26px;
    padding: 28px 24px;
    border-radius: 26px;
  }

  .feature-card.reverse .fc-copy,
  .feature-card.reverse .fc-visual {
    order: 0;
  }

  .footer-top {
    grid-template-columns: 1fr;
    gap: 28px;
  }

  .footer-inner {
    padding: 42px 22px 26px;
  }
}

@media (max-width: 560px) {
  .footer-cols {
    grid-template-columns: 1fr 1fr;
  }

  .hero-meta {
    flex-wrap: wrap;
    gap: 10px;
  }
}
</style>

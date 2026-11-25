/**
 * weatherState.js — 天气快照单一真相源
 *
 * 职责：
 *   1. 统一定义 WeatherSnapshot 结构（物理参数 + 派生速率 + 视觉标签 key）
 *   2. 提供两套构建函数：
 *        - buildSnapshotFromKey(key)      — 模拟天气 UI 的预设模式
 *        - buildSnapshotFromSliders({...}) — 模拟天气 UI 的滑块/custom 模式
 *        - buildSnapshotFromActual(raw)    — 实际天气（Open-Meteo 等外部源）
 *   3. 提供视觉阈值函数（shouldShowRain / computeWindStrength）
 *
 * 设计约束：
 *   - 本模块为纯逻辑，零 three 依赖，供 node:test 直接 import
 *   - 所有参数变化路径都经过此文件，消除 WEATHER_PROFILES / WIND_SPEED_BY_WEATHER 等散落映射表
 *   - P1.5 接入后端时，仅 weatherSource.js 的 fetchActualWeatherSnapshot 函数体需修改，本文件不动
 */

// —— 常量 ——
export const WEATHER_KEYS = Object.freeze(["sunny", "cloudy", "rain", "wind", "custom"]);
export const PRESET_KEYS = Object.freeze(["sunny", "cloudy", "rain", "wind"]);

// 滑块范围（模拟天气 UI）
export const SLIDER_RANGES = Object.freeze({
  temperature: Object.freeze({ min: 0, max: 45 }),
  humidity: Object.freeze({ min: 0, max: 100 }),
  waterLevelCm: Object.freeze({ min: 0, max: 12 }),
  light: Object.freeze({ min: 0, max: 30000 }),
  wind: Object.freeze({ min: 0, max: 15 }),
  rain: Object.freeze({ min: 0, max: 100 }),
});

// 四档预设 —— 保留原 WEATHER_PROFILES 的速率取值（已在阶段 1 验证）
// 物理参数基于交接文档描述 + 合理插值
export const WEATHER_PRESETS = Object.freeze({
  sunny: Object.freeze({
    temperature: 28,
    humidity: 60,
    light: 18000,
    wind: 1,
    rain: 0,
    rainfallCmPerSecond: 0,
    evaporationCmPerSecond: 0.004,
    co2VentilationRate: 0.003,
    ambientTemperatureC: 28,
  }),
  cloudy: Object.freeze({
    temperature: 24,
    humidity: 70,
    light: 9000,
    wind: 2,
    rain: 0,
    rainfallCmPerSecond: 0,
    evaporationCmPerSecond: 0.002,
    co2VentilationRate: 0.002,
    ambientTemperatureC: 24,
  }),
  rain: Object.freeze({
    temperature: 20,
    humidity: 90,
    light: 3000,
    wind: 3,
    rain: 12,          // mm/h —— 小雨级
    rainfallCmPerSecond: 0.018,
    evaporationCmPerSecond: 0.002,
    co2VentilationRate: 0.004,
    ambientTemperatureC: 20,
  }),
  wind: Object.freeze({
    temperature: 22,
    humidity: 55,
    light: 14000,
    wind: 12,
    rain: 0,
    rainfallCmPerSecond: 0,
    evaporationCmPerSecond: 0.006,
    co2VentilationRate: 0.02,
    ambientTemperatureC: 22,
  }),
});

// 实际天气不可用时的降级快照 —— 必须是合理的白天状态
// 否则 UI 会出现"天气暂不可用 + 光照 0 lux"的黑屏观感
export const ACTUAL_WEATHER_DEFAULTS = Object.freeze({
  ...buildSnapshotFromSliders({ temperature: 25, humidity: 65, light: 15000, wind: 2, rain: 0 }),
  key: "sunny",   // 视觉上按晴天渲染，不显示 "custom"
});

// —— 工具函数 ——
function clamp(v, min, max) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

// 降雨 mm/h → cm/s（1 mm/h = 0.1 cm/h = 0.1/3600 cm/s）
// 注意：四舍五入保留 6 位小数避免浮点噪声
function mmhToCmPerSecond(mmh) {
  const v = clamp(Number(mmh) || 0, 0, 500);
  return Math.round((v / 36000) * 1_000_000) / 1_000_000;
}

// —— 预设插值：给定物理数值，估算派生速率 ——
// 策略：按预设表范围线性插值，落到预设边界外时钳位
function interpolateRates({ wind, rain }) {
  // evaporation: 风大雨少时较高（风 0.006 / 无风 0.002~0.004）
  const evaporationBase = 0.002;
  const evaporationByWind = 0.004 * clamp(wind / 15, 0, 1);
  const evaporationByRain = rain > 0.1 ? -0.001 : 0;   // 下雨抑制蒸发
  const evaporationCmPerSecond = Math.max(0.001,
    evaporationBase + evaporationByWind + evaporationByRain
  );

  // co2Ventilation: 风越大通风越好
  const co2VentilationRate = 0.002 + 0.018 * clamp(wind / 15, 0, 1);

  return { evaporationCmPerSecond, co2VentilationRate };
}

// Open-Meteo weather_code → 语义 key（仅用于快照的视觉标签）
// 此映射表曾散落在 TwinStudioView.vue，现集中到 weatherState.js
export const WEATHER_CODE_MAP = Object.freeze({
  0: "sunny", 1: "sunny", 2: "cloudy", 3: "cloudy",
  45: "cloudy", 48: "cloudy",
  51: "rain", 53: "rain", 55: "rain", 56: "rain", 57: "rain",
  61: "rain", 63: "rain", 65: "rain", 66: "rain", 67: "rain",
  71: "cloudy", 73: "cloudy", 75: "cloudy", 77: "cloudy",
  80: "rain", 81: "rain", 82: "rain",
  85: "cloudy", 86: "cloudy",
  95: "rain", 96: "rain", 99: "rain",
});

function keyFromWeatherCode(code, precipitation) {
  const numeric = Number(code);
  if (Number.isFinite(numeric) && WEATHER_CODE_MAP[numeric]) return WEATHER_CODE_MAP[numeric];
  if (Number(precipitation) > 0.1) return "rain";
  return "cloudy";
}

// —— 构建函数 ——

/**
 * buildSnapshotFromKey(key) —— 预设构建
 * 用于：模拟天气 UI 点击预设按钮（晴/多云/小雨/大风）
 * @param {"sunny"|"cloudy"|"rain"|"wind"} key
 * @returns {WeatherSnapshot}
 */
export function buildSnapshotFromKey(key) {
  const validKey = PRESET_KEYS.includes(key) ? key : "sunny";
  const preset = WEATHER_PRESETS[validKey];
  return {
    key: validKey,
    ...preset,
  };
}

/**
 * buildSnapshotFromSliders({temperature, humidity, waterLevelCm, light, wind, rain}) —— 滑块/custom 构建
 * 用于：模拟天气 UI 调整滑块
 * @param {{temperature?:number, humidity?:number, waterLevelCm?:number, light?:number, wind?:number, rain?:number}} raw
 * @returns {WeatherSnapshot}  key 固定为 "custom"
 */
export function buildSnapshotFromSliders(raw = {}) {
  const s = WEATHER_PRESETS.sunny;   // 缺失字段回退到 sunny 预设

  function pickNum(field, fallback, lo, hi) {
    const v = raw[field];
    if (v === undefined || v === null) return fallback;
    return clamp(Number(v), lo, hi);
  }

  const temperature = pickNum("temperature", s.temperature, 0, 45);
  const humidity = pickNum("humidity", s.humidity, 0, 100);
  const waterLevelCm = pickNum("waterLevelCm", 2, 0, 12);
  const light = pickNum("light", s.light, 0, 30000);
  const wind = pickNum("wind", s.wind, 0, 15);
  const rain = pickNum("rain", s.rain, 0, 100);

  const { evaporationCmPerSecond, co2VentilationRate } = interpolateRates({ wind, rain });

  return {
    key: "custom",
    temperature,
    humidity,
    waterLevelCm,
    light,
    wind,
    rain,
    rainfallCmPerSecond: mmhToCmPerSecond(rain),
    evaporationCmPerSecond,
    co2VentilationRate,
    ambientTemperatureC: temperature,
  };
}

/**
 * buildSnapshotFromActual(raw) —— 实际天气构建
 * 用于：weatherSource.js 拿到 Open-Meteo / 其他外部源的响应后
 * @param {Object} raw —— Open-Meteo current 响应（或兼容结构）
 * @param {number} raw.temperature_2m       °C
 * @param {number} raw.relative_humidity_2m %
 * @param {number} raw.wind_speed_10m      km/h
 * @param {number} raw.precipitation       mm/h
 * @param {number} raw.weather_code        WMO weather code
 * @returns {WeatherSnapshot}  key 仅作视觉标签，物理参数全部用 raw 的真实数值
 */
export function buildSnapshotFromActual(raw = {}) {
  const s = WEATHER_PRESETS.sunny;

  // —— Open-Meteo 的风速单位是 km/h，m/s = km/h ÷ 3.6 ——
  const windKmh = Number(raw.wind_speed_10m);
  const wind = Number.isFinite(windKmh)
    ? clamp(Math.round((windKmh / 3.6) * 10) / 10, 0, 15)
    : s.wind;

  const temperature = Number.isFinite(Number(raw.temperature_2m))
    ? clamp(Number(raw.temperature_2m), -20, 45)
    : s.temperature;

  const humidity = Number.isFinite(Number(raw.relative_humidity_2m))
    ? clamp(Number(raw.relative_humidity_2m), 0, 100)
    : s.humidity;

  const rain = Number.isFinite(Number(raw.precipitation))
    ? clamp(Number(raw.precipitation), 0, 100)
    : 0;

  // —— Open-Meteo 不返回直接的 lux，用云量估算 ——
  // cloudcover 0-100%：lux ≈ 18000 × (1 - cloudcover/120)，雨天额外砍半
  const cloudcover = Number.isFinite(Number(raw.cloudcover)) ? Number(raw.cloudcover) : 50;
  let light = 18000 * (1 - clamp(cloudcover, 0, 100) / 120);
  if (rain > 0.5) light *= 0.5;
  light = Math.round(clamp(light, 0, 30000));

  const key = keyFromWeatherCode(raw.weather_code, raw.precipitation);

  const { evaporationCmPerSecond, co2VentilationRate } = interpolateRates({ wind, rain });

  return {
    key,
    temperature,
    humidity,
    light,
    wind,
    rain,
    rainfallCmPerSecond: mmhToCmPerSecond(rain),
    evaporationCmPerSecond,
    co2VentilationRate,
    ambientTemperatureC: temperature,
  };
}

// —— 视觉阈值 ——

/** 小雨以上显示雨效 */
export function shouldShowRain(snapshot) {
  if (!snapshot) return false;
  return Number(snapshot.rain) > 0.5;
}

/**
 * 风摆强度系数，给 shader uniform uWindSpeed 用
 * 原 riceInstanceBatches.js 硬编码 WIND_SPEED_BY_WEATHER，
 * 现在 = 0.24 + windKmhNormalized × 0.76，返回值 ~0.24–1.0
 */
export function computeWindStrength(snapshot) {
  if (!snapshot) return 0.24;
  const wind = Number(snapshot.wind) || 0;
  return Math.min(1, Math.max(0.1, wind / 15));
}

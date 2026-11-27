/**
 * weatherSource.js — 实际天气数据源（抽象层）
 *
 * 数据源策略（P5 改造）：
 *   1) 主源 wttr.in —— 国内网络可达，免费无 Key，返回 CORS `*`，字段覆盖
 *      温度/湿度/风速/降水/云量/天气码 + 3 天预报
 *   2) 备源 Open-Meteo —— 原主源，在部分网络不可达（校园网/内网），仅作兜底
 *   3) 都失败 → ACTUAL_WEATHER_DEFAULTS，status="unavailable"
 *
 * 设计原则：
 *   - 对外签名固定：fetchActualWeatherSnapshot() → Promise<{snapshot, raw?, source, status, error?}>
 *   - raw 统一归一化为 Open-Meteo 结构（current / daily / hourly），
 *     这样 UI 层（TwinStudioView 的逐小时预报、每日温度区间）无需关心真实来源
 *   - 失败/超时返回 defaults + status="unavailable"，让 UI 统一处理
 */

import {
  buildSnapshotFromActual,
  ACTUAL_WEATHER_DEFAULTS,
} from "./weatherState.js";

// 默认坐标：长沙（可后续配置化）
const DEFAULT_LAT = 28.2;
const DEFAULT_LON = 112.9;

// 单源超时：主源失败后仍要在可接受时间内完成兜底切换
const REQUEST_TIMEOUT_MS = 7000;

// 开发环境走 Vite 同源代理消除 CORS；生产直连
// 用可选链读取：Node 环境（测试脚本）没有 import.meta.env，此时视为生产直连
const IS_DEV = Boolean(import.meta.env?.DEV);
const OPEN_METEO_BASE_URL = IS_DEV
  ? "/api/open-meteo/forecast"
  : "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_BASE_URL = IS_DEV
  ? '/api/air-quality/v1/air-quality'
  : 'https://air-quality-api.open-meteo.com/v1/air-quality';

// wttr.in 支持 CORS(*)，前后端都可直连，无需代理
const WTTR_BASE_URL = "https://wttr.in";

/**
 * WW 天气码（wttr.in 使用）→ WMO 天气码（项目内部使用）
 * 仅保留项目 WEATHER_CODE_MAP 能识别的语义分组：晴 / 多云 / 雨 / 雪
 */
const WW_TO_WMO = Object.freeze({
  113: 0,                             // 晴
  116: 2,                             // 局部多云
  119: 3, 122: 3,                     // 多云 / 阴
  143: 45, 248: 45, 260: 45,          // 雾
  176: 51, 263: 51, 266: 53,          // 毛毛雨
  281: 56, 284: 57,                   // 冻毛毛雨
  293: 61, 296: 61, 299: 63, 302: 65, // 小雨 / 中雨 / 大雨
  305: 63, 308: 65, 311: 65, 314: 67, // 强降雨
  317: 71, 320: 71, 323: 71,          // 雨夹雪 / 小雪
  326: 71, 329: 73, 332: 75,          // 小雪 / 中雪 / 大雪
  335: 75, 338: 75, 350: 71,          // 暴雪 / 冰粒
  353: 80, 356: 81, 359: 82,          // 阵雨
  362: 85, 365: 85, 368: 85, 371: 86, // 阵性雨夹雪 / 阵雪
  386: 95, 389: 99, 392: 95, 395: 99, // 雷阵雨 / 雷暴伴冰雹
});

/**
 * WW → WMO，带降水/云量兜底：
 * 未收录的码（如部分地区返回的 149）先看实测降水，再看云量，
 * 避免晴空（cloudcover=0）被误判成多云。
 */
function wwToWmo(ww, precipMm, cloudcover) {
  const code = Number(ww);
  if (Number.isFinite(code) && WW_TO_WMO[code] !== undefined) return WW_TO_WMO[code];
  if (Number(precipMm) > 0.1) return 61;
  const cc = Number(cloudcover);
  if (Number.isFinite(cc)) {
    if (cc < 20) return 0;      // 晴
    if (cc < 60) return 2;      // 局部多云
  }
  return 3;                     // 多云/阴
}

/** "900" → "09:00"，"0" → "00:00" */
function hhmm(raw) {
  const s = String(raw).padStart(4, "0");
  return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
}

/**
 * 本机本地时间 → "YYYY-MM-DDTHH:MM"
 * wttr.in 只给 observation_time（无日期且疑似 UTC），直接用设备本地时间更稳妥，
 * 且与 hourly 里用的预报日期同属本地时区。
 */
function localNowIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/**
 * 把 wttr.in 的 j1 响应归一化成 Open-Meteo 结构
 * 返回 { current, daily, hourly }，字段名与 Open-Meteo 完全一致
 */
function normalizeWttr(data) {
  const condition = data?.current_condition?.[0];
  if (!condition) throw new Error("wttr.in 响应缺少 current_condition");

  const precipitation = Number(condition.precipMM);
  const cloudcover = Number(condition.cloudcover);
  const current = {
    time: localNowIso(),
    temperature_2m: Number(condition.temp_C),
    apparent_temperature: Number(condition.FeelsLikeC),
    relative_humidity_2m: Number(condition.humidity),
    wind_speed_10m: Number(condition.windspeedKmph),   // 与 Open-Meteo 同为 km/h
    wind_gusts_10m: Number(condition.WindGustKmph),
    wind_direction_10m: Number(condition.winddirDegree),
    precipitation: Number.isFinite(precipitation) ? precipitation : 0,
    cloudcover: Number.isFinite(cloudcover) ? cloudcover : 50,
    weather_code: wwToWmo(condition.weatherCode, precipitation, cloudcover),
    pressure_msl: Number(condition.pressure),
    visibility: Number(condition.visibility) * 1000,
    uv_index: Number(condition.uvIndex),
    dew_point_2m: Number(condition.DewPointC),
    weather_desc: condition.weatherDesc?.[0]?.value || condition.lang_zh?.[0]?.value || '',
  };

  const days = Array.isArray(data?.weather) ? data.weather : [];

  const daily = {
    time: days.map((d) => d.date),
    temperature_2m_min: days.map((d) => Number(d.mintempC)),
    temperature_2m_max: days.map((d) => Number(d.maxtempC)),
    // 取正午（第 5 个时段）天气码代表当天
    weather_code: days.map((d) => {
      const noon = d.hourly?.[4] || d.hourly?.[0] || {};
      return wwToWmo(noon.weatherCode, noon.precipMM, noon.cloudcover);
    }),
    precipitation_probability_max: days.map((d) => Math.max(...(d.hourly || []).map((slot) => Number(slot.chanceofrain) || 0), 0)),
    uv_index_max: days.map((d) => Math.max(...(d.hourly || []).map((slot) => Number(slot.uvIndex) || 0), 0)),
    sunrise: days.map((d) => d.astronomy?.[0]?.sunrise || ''),
    sunset: days.map((d) => d.astronomy?.[0]?.sunset || ''),
    wind_speed_10m_max: days.map((d) => Math.max(...(d.hourly || []).map((slot) => Number(slot.windspeedKmph) || 0), 0)),
    wind_direction_10m_dominant: days.map((d) => Number((d.hourly?.[4] || d.hourly?.[0] || {}).winddirDegree) || 0),
  };

  const hourly = {
    time: [],
    temperature_2m: [],
    apparent_temperature: [],
    weather_code: [],
    precipitation_probability: [],
    relative_humidity_2m: [],
    wind_speed_10m: [],
    wind_direction_10m: [],
    uv_index: [],
  };
  for (const day of days) {
    for (const slot of day.hourly || []) {
      hourly.time.push(`${day.date}T${hhmm(slot.time)}`);
      hourly.temperature_2m.push(Number(slot.tempC));
      hourly.apparent_temperature.push(Number(slot.FeelsLikeC));
      hourly.weather_code.push(wwToWmo(slot.weatherCode, slot.precipMM, slot.cloudcover));
      hourly.precipitation_probability.push(Number(slot.chanceofrain) || 0);
      hourly.relative_humidity_2m.push(Number(slot.humidity));
      hourly.wind_speed_10m.push(Number(slot.windspeedKmph));
      hourly.wind_direction_10m.push(Number(slot.winddirDegree));
      hourly.uv_index.push(Number(slot.uvIndex));
    }
  }

  return { current, daily, hourly };
}

/** 带超时的 fetch + JSON 解析 */
async function fetchJson(url, errorLabel, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`${errorLabel} HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** 主源：wttr.in（国内可达） */
async function fetchFromWttr(lat, lon) {
  // format=j1 返回完整 JSON（含 current_condition / weather 3 天 / hourly）
  const data = await fetchJson(`${WTTR_BASE_URL}/${lat},${lon}?format=j1`, "wttr.in");
  return normalizeWttr(data);
}

/** 备源：Open-Meteo（原有实现） */
async function fetchFromOpenMeteo(lat, lon) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    // 注意：time 字段是 Open-Meteo 自动返回的索引数组，不能作为请求字段，传了会 400
    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'wind_speed_10m',
      'wind_gusts_10m',
      'wind_direction_10m',
      'precipitation',
      'precipitation_probability',
      'weather_code',
      'cloud_cover',
      'pressure_msl',
      'visibility',
      'uv_index',
      'dew_point_2m',
    ].join(","),
    daily: [
      'temperature_2m_min',
      'temperature_2m_max',
      'apparent_temperature_min',
      'apparent_temperature_max',
      'weather_code',
      'precipitation_probability_max',
      'uv_index_max',
      'sunrise',
      'sunset',
      'wind_speed_10m_max',
      'wind_direction_10m_dominant',
    ].join(","),
    hourly: [
      'temperature_2m',
      'apparent_temperature',
      'weather_code',
      'precipitation_probability',
      'relative_humidity_2m',
      'wind_speed_10m',
      'wind_direction_10m',
      'uv_index',
    ].join(","),
    forecast_days: '7',
    timezone: "auto",
  });
  const data = await fetchJson(`${OPEN_METEO_BASE_URL}?${params.toString()}`, "Open-Meteo");
  if (data.current && data.current.cloudcover == null) {
    data.current.cloudcover = data.current.cloud_cover;
  }
  return {
    current: data.current || {},
    daily: data.daily || {},
    hourly: data.hourly || {},
  };
}

async function fetchAirQuality(lat, lon) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: ['european_aqi', 'us_aqi', 'pm2_5', 'pm10'].join(','),
    timezone: 'auto',
  });
  return fetchJson(`${AIR_QUALITY_BASE_URL}?${params.toString()}`, 'Open-Meteo Air Quality', 3000);
}

/**
 * 获取实际天气快照（多源自动降级）
 * @param {{ lat?: number, lon?: number }} [options]
 * @returns {Promise<{snapshot: object, raw?: object, source: string, status: string, error?: string}>}
 */
export async function fetchActualWeatherSnapshot(options = {}) {
  const lat = options.lat ?? DEFAULT_LAT;
  const lon = options.lon ?? DEFAULT_LON;
  const errors = [];

  const sources = [
    { name: "wttr.in", load: fetchFromWttr },
    { name: "open-meteo", load: fetchFromOpenMeteo },
  ];

  for (const source of sources) {
    try {
      const raw = await source.load(lat, lon);
      const current = raw.current;
      // 必要字段缺失 → 视为该源失败，继续降级
      if (!Number.isFinite(Number(current?.temperature_2m))) {
        throw new Error(`${source.name} 响应缺少必要字段 temperature_2m`);
      }
      try {
        raw.airQuality = await fetchAirQuality(lat, lon);
      } catch (airError) {
        raw.airQuality = null;
      }
      return {
        snapshot: buildSnapshotFromActual(current),
        raw,
        source: source.name,
        status: "ok",
      };
    } catch (err) {
      const message = err?.name === "AbortError"
        ? `${source.name} request timed out`
        : (err?.message || String(err));
      errors.push(`${source.name}: ${message}`);
    }
  }

  console.warn("[weatherSource] 所有天气源均不可用，降级为默认值：", errors.join(" | "));
  return {
    snapshot: ACTUAL_WEATHER_DEFAULTS,
    source: "default",
    status: "unavailable",
    error: errors.join(" | "),
  };
}

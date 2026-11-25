import { getStageProfile, STAGE_LABELS } from "./riceGrowthModel.js";

export const ENVIRONMENT_METRIC_DEFS = Object.freeze({
  waterLevelCm: Object.freeze({
    unit: "cm",
    digits: 1,
    dangerRange: Object.freeze([0.3, 10]),
    adviceLow: "开启灌溉装置或全局灌溉站补水",
    adviceHigh: "开启排水泵或排涝泵站排水",
  }),
  co2Ppm: Object.freeze({
    unit: "ppm",
    digits: 0,
    dangerRange: Object.freeze([300, 1500]),
    adviceLow: "开启 CO₂ 供给装置",
    adviceHigh: "开启通风装置降低 CO₂ 浓度",
  }),
  temperatureC: Object.freeze({
    unit: "°C",
    digits: 1,
    dangerRange: Object.freeze([10, 35]),
    adviceLow: "开启增温器或调高自定义温度",
    adviceHigh: "开启通风装置或调低自定义温度",
  }),
  humidityPct: Object.freeze({
    unit: "%",
    digits: 1,
    dangerRange: Object.freeze([40, 90]),
    adviceLow: "开启灌溉装置或全局灌溉站增湿",
    adviceHigh: "开启通风装置或排涝泵站降湿",
  }),
  lightLux: Object.freeze({
    unit: "lux",
    digits: 0,
    dangerRange: Object.freeze([1000, 28000]),
    adviceLow: "减少遮阳网或调高自定义光照",
    adviceHigh: "增加遮阳网或调低自定义光照",
  }),
});

function formatNumber(value, digits) {
  return Number(value).toFixed(digits).replace(/\.0+$/, "");
}

export function metricStatusForRange(
  value,
  idealRange,
  dangerRange,
  options = {}
) {
  const {
    stageLabel = "",
    unit = "",
    digits = 1,
    adviceLow = "",
    adviceHigh = "",
  } = options;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return { tone: "normal", direction: null, reason: "", advice: "" };
  }
  const [dangerLow, dangerHigh] = dangerRange;
  if (numeric < dangerLow) {
    return {
      tone: "danger",
      direction: "low",
      reason: `低于危险阈值 ${formatNumber(dangerLow, digits)}${unit}`,
      advice: adviceLow,
    };
  }
  if (numeric > dangerHigh) {
    return {
      tone: "danger",
      direction: "high",
      reason: `高于危险阈值 ${formatNumber(dangerHigh, digits)}${unit}`,
      advice: adviceHigh,
    };
  }
  if (numeric < idealRange[0]) {
    return {
      tone: "warning",
      direction: "low",
      reason: `低于${stageLabel}适宜范围 ${formatNumber(idealRange[0], digits)}-${formatNumber(idealRange[1], digits)}${unit}`,
      advice: adviceLow,
    };
  }
  if (numeric > idealRange[1]) {
    return {
      tone: "warning",
      direction: "high",
      reason: `高于${stageLabel}适宜范围 ${formatNumber(idealRange[0], digits)}-${formatNumber(idealRange[1], digits)}${unit}`,
      advice: adviceHigh,
    };
  }
  return { tone: "normal", direction: null, reason: "", advice: "" };
}

export function environmentMetricStatus(metricKey, value, stageKey) {
  const definition = ENVIRONMENT_METRIC_DEFS[metricKey];
  if (!definition) {
    return { tone: "normal", direction: null, reason: "", advice: "" };
  }
  const profile = getStageProfile(stageKey);
  return metricStatusForRange(
    value,
    profile.ideal[metricKey],
    definition.dangerRange,
    {
      stageLabel: STAGE_LABELS[profile.key] || "当前阶段",
      unit: definition.unit,
      digits: definition.digits,
      adviceLow: definition.adviceLow,
      adviceHigh: definition.adviceHigh,
    }
  );
}

export function worstTone(...tones) {
  if (tones.includes("danger")) return "danger";
  if (tones.includes("warning")) return "warning";
  return "normal";
}

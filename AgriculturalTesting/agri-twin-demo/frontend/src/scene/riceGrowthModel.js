// P1: 水稻全生命周期底层农学模型（纯逻辑，零 three 依赖，可在 Node 中直接单测）
// 时间轴：140 个模拟日压缩到 70 秒演示，1x 速度下 1 天 = 0.5 秒（2 天/秒）

export const RICE_STAGES = Object.freeze({
  GERMINATION: "germination", // 发芽
  SEEDLING: "seedling",       // 幼苗
  TILLERING: "tillering",     // 分蘖
  JOINTING: "jointing",       // 拔节
  HEADING: "heading",         // 抽穗
  FILLING: "filling",         // 灌浆
  MATURITY: "maturity",       // 成熟
});

export const RICE_STAGE_ORDER = Object.freeze([
  RICE_STAGES.GERMINATION,
  RICE_STAGES.SEEDLING,
  RICE_STAGES.TILLERING,
  RICE_STAGES.JOINTING,
  RICE_STAGES.HEADING,
  RICE_STAGES.FILLING,
  RICE_STAGES.MATURITY,
]);

export const STAGE_LABELS = Object.freeze({
  germination: "发芽期",
  seedling: "幼苗期",
  tillering: "分蘖期",
  jointing: "拔节期",
  heading: "抽穗期",
  filling: "灌浆期",
  maturity: "成熟期",
});

export const DEMO_TOTAL_DAYS = 140;
export const DEMO_DURATION_SECONDS = 70; // P3: 1x 下整周期 70 秒（2 天/秒）
export const DEMO_SECONDS_PER_DAY = DEMO_DURATION_SECONDS / DEMO_TOTAL_DAYS;
/** 环境完全适宜时，每天推进的生理进度（100% / 140 天） */
export const BASE_PROGRESS_PER_DAY = 100 / DEMO_TOTAL_DAYS;

// 环境偏差到"胁迫程度"的容忍度：超出适宜区这么远就记满 1.0
const TOLERANCE = Object.freeze({
  temperatureC: 8,
  waterLevelCm: 4,
  humidityPct: 25,
  co2Ppm: 600,
  lightLux: 12000,
});

// 各参数对环境胁迫的权重（合计 1.0）
const STRESS_WEIGHTS = Object.freeze({
  temperatureC: 0.3,
  waterLevelCm: 0.25,
  lightLux: 0.2,
  humidityPct: 0.15,
  co2Ppm: 0.1,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildStageProfile(config) {
  return Object.freeze({
    ...config,
    ideal: Object.freeze(config.ideal),
    progressRange: Object.freeze(config.progressRange),
    dayRange: Object.freeze(config.dayRange),
    progressPerDay: (config.progressRange[1] - config.progressRange[0]) /
      (config.dayRange[1] - config.dayRange[0] + 1),
  });
}

// 阶段定义：日历天 + 生理进度区间 + 适宜指标
// 进度按 140 天线性映射：Day 1 → 0%，Day 140 → 100%
export const STAGE_PROFILES = Object.freeze({
  germination: buildStageProfile({
    key: "germination",
    label: STAGE_LABELS.germination,
    dayRange: [1, 10],
    progressRange: [0, 100 * (10 / 140)],
    ideal: {
      waterLevelCm: [1, 3],
      temperatureC: [28, 32],
      humidityPct: [75, 90],
      co2Ppm: [400, 800],
      lightLux: [8000, 20000],
    },
  }),
  seedling: buildStageProfile({
    key: "seedling",
    label: STAGE_LABELS.seedling,
    dayRange: [11, 30],
    progressRange: [100 * (10 / 140), 100 * (30 / 140)],
    ideal: {
      waterLevelCm: [1, 3],
      temperatureC: [25, 30],
      humidityPct: [70, 85],
      co2Ppm: [400, 800],
      lightLux: [10000, 20000],
    },
  }),
  tillering: buildStageProfile({
    key: "tillering",
    label: STAGE_LABELS.tillering,
    dayRange: [31, 60],
    progressRange: [100 * (30 / 140), 100 * (60 / 140)],
    ideal: {
      waterLevelCm: [3, 5],
      temperatureC: [25, 30],
      humidityPct: [65, 80],
      co2Ppm: [400, 800],
      lightLux: [15000, 25000],
    },
  }),
  jointing: buildStageProfile({
    key: "jointing",
    label: STAGE_LABELS.jointing,
    dayRange: [61, 80],
    progressRange: [100 * (60 / 140), 100 * (80 / 140)],
    ideal: {
      waterLevelCm: [5, 7],
      temperatureC: [24, 28],
      humidityPct: [70, 85],
      co2Ppm: [500, 1000],
      lightLux: [18000, 28000],
    },
  }),
  heading: buildStageProfile({
    key: "heading",
    label: STAGE_LABELS.heading,
    dayRange: [81, 100],
    progressRange: [100 * (80 / 140), 100 * (100 / 140)],
    ideal: {
      waterLevelCm: [5, 8],
      temperatureC: [25, 28],
      humidityPct: [70, 85],
      co2Ppm: [500, 900],
      lightLux: [15000, 22000],
    },
  }),
  filling: buildStageProfile({
    key: "filling",
    label: STAGE_LABELS.filling,
    dayRange: [101, 120],
    progressRange: [100 * (100 / 140), 100 * (120 / 140)],
    ideal: {
      waterLevelCm: [2, 4],
      temperatureC: [22, 27],
      humidityPct: [65, 80],
      co2Ppm: [400, 800],
      lightLux: [15000, 25000],
    },
  }),
  maturity: buildStageProfile({
    key: "maturity",
    label: STAGE_LABELS.maturity,
    dayRange: [121, 140],
    progressRange: [100 * (120 / 140), 100],
    ideal: {
      // 成熟期需要晒田，水位适宜区间收紧到 0~1cm
      waterLevelCm: [0, 1],
      temperatureC: [20, 26],
      humidityPct: [45, 65],
      co2Ppm: [350, 600],
      lightLux: [15000, 25000],
    },
  }),
});

/** 根据生理进度（0~100）解析当前阶段 */
export function stageForProgress(progress) {
  const value = clamp(Number(progress) || 0, 0, 100);
  for (const key of RICE_STAGE_ORDER) {
    const profile = STAGE_PROFILES[key];
    if (value < profile.progressRange[1]) return key;
  }
  return RICE_STAGES.MATURITY;
}

export function getStageProfile(stageKey) {
  return STAGE_PROFILES[stageKey] || STAGE_PROFILES.germination;
}

/** 当前阶段各适宜区间的中位数，作为自动控制与模拟初始值的最优目标。 */
export function optimalStageValues(stageKey) {
  const ideal = getStageProfile(stageKey).ideal;
  const midpoint = (range) => (range[0] + range[1]) / 2;
  return {
    waterLevelCm: midpoint(ideal.waterLevelCm),
    co2Ppm: midpoint(ideal.co2Ppm),
    temperatureC: midpoint(ideal.temperatureC),
    humidityPct: midpoint(ideal.humidityPct),
    lightLux: midpoint(ideal.lightLux),
  };
}

/** 生理进度 → 等效模拟日（Day 1 ~ Day 140） */
export function progressToDay(progress) {
  const value = clamp(Number(progress) || 0, 0, 100);
  return 1 + (value / 100) * (DEMO_TOTAL_DAYS - 1);
}

function deviation(value, [low, high], tolerance) {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  if (v < low) return clamp((low - v) / tolerance, 0, 1);
  if (v > high) return clamp((v - high) / tolerance, 0, 1);
  return 0;
}

// 胁迫归因：把“权重最大的越界项”翻译成农学原因
const STRESS_UNITS = Object.freeze({
  temperatureC: "℃",
  waterLevelCm: "cm",
  lightLux: "lux",
  humidityPct: "%",
  co2Ppm: "ppm",
});

export function describeStressDetail(key, value, ideal) {
  const v = Number(value);
  const isLow = Number.isFinite(v) && v < ideal[0];
  const unit = STRESS_UNITS[key] || "";
  const formatted = Number.isFinite(v)
    ? (unit === "lux" || unit === "ppm" ? Math.round(v).toString() : v.toFixed(1))
    : "--";
  const range = `${ideal[0]}~${ideal[1]}${unit}`;
  switch (key) {
    case "temperatureC":
      return {
        reason: isLow ? "低温" : "高温",
        text: `当前温度${isLow ? "仅" : "高达"}${formatted}${unit}，${isLow ? "远低于" : "远高于"}适宜温度（${range}）`,
      };
    case "waterLevelCm":
      return {
        reason: isLow ? "缺水" : "积水",
        text: `当前水位${formatted}${unit}，${isLow ? "低于" : "高于"}适宜水位（${range}）`,
      };
    case "lightLux":
      return {
        reason: isLow ? "寡照" : "强光",
        text: `当前光照${formatted}${unit}，${isLow ? "低于" : "高于"}适宜光照（${range}）`,
      };
    case "humidityPct":
      return {
        reason: isLow ? "空气干燥" : "湿度过高",
        text: `当前湿度${formatted}${unit}，${isLow ? "低于" : "高于"}适宜湿度（${range}）`,
      };
    case "co2Ppm":
      return {
        reason: isLow ? "CO₂不足" : "CO₂过量",
        text: `当前CO₂浓度${formatted}${unit}，${isLow ? "低于" : "高于"}适宜浓度（${range}）`,
      };
    default:
      return { reason: "环境不适", text: "环境参数超出适宜区间" };
  }
}

/**
 * 计算环境偏差与胁迫程度
 * @returns {{ stress: number, deviations: Record<string, number>, stressReason: string|null, stressDetail: object|null }}
 */
export function evaluateEnvironment(environment, stageKey) {
  const profile = getStageProfile(stageKey);
  const env = environment || {};
  const deviations = {
    temperatureC: deviation(env.temperatureC, profile.ideal.temperatureC, TOLERANCE.temperatureC),
    waterLevelCm: deviation(env.waterLevelCm, profile.ideal.waterLevelCm, TOLERANCE.waterLevelCm),
    lightLux: deviation(env.lightLux, profile.ideal.lightLux, TOLERANCE.lightLux),
    humidityPct: deviation(env.humidityPct, profile.ideal.humidityPct, TOLERANCE.humidityPct),
    co2Ppm: deviation(env.co2Ppm, profile.ideal.co2Ppm, TOLERANCE.co2Ppm),
  };
  const stress = clamp(
    Object.keys(STRESS_WEIGHTS).reduce(
      (sum, key) => sum + STRESS_WEIGHTS[key] * deviations[key],
      0
    ),
    0,
    1
  );

  // 找权重最大的越界因素作为"受阻原因"
  let dominantKey = null;
  let dominantScore = 0;
  for (const key of Object.keys(STRESS_WEIGHTS)) {
    const score = STRESS_WEIGHTS[key] * deviations[key];
    if (score > dominantScore) {
      dominantScore = score;
      dominantKey = key;
    }
  }
  let stressReason = null;
  let stressDetail = null;
  if (dominantKey && dominantScore > 0.02) {
    const detail = describeStressDetail(
      dominantKey,
      env[dominantKey],
      profile.ideal[dominantKey]
    );
    stressReason = detail.reason;
    stressDetail = {
      key: dominantKey,
      value: env[dominantKey],
      ideal: [...profile.ideal[dominantKey]],
      ...detail,
    };
  }

  return { stress, deviations, stressReason, stressDetail };
}

/**
 * 单 tick 生长推演
 * @param {{ physiologicalProgress?: number, simulatedDay?: number }} state
 * @param {{ temperatureC: number, waterLevelCm: number, humidityPct: number, co2Ppm: number, lightLux: number }} environment
 * @param {number} dtDays 经过的模拟天数（1x 演示下每秒 ≈ 2 天）
 * @returns 更新后的进度、天数、阶段、生长速率与受阻标识
 */
export function calculateGrowth(state, environment, dtDays) {
  const current = state || {};
  const stepDays = Math.max(0, Number(dtDays) || 0);
  const previousProgress = clamp(Number(current.physiologicalProgress) || 0, 0, 100);
  const stageKey = stageForProgress(previousProgress);
  const profile = getStageProfile(stageKey);
  const simulatedDay = Math.max(1, (Number(current.simulatedDay) || 1) + stepDays);

  const { stress, deviations, stressReason, stressDetail } = evaluateEnvironment(
    environment,
    stageKey
  );
  // 环境整体越界越严重，生长越慢；极寒/极热直接停滞
  let growthFactor = clamp(1 - stress * 1.8, 0, 1);
  const temperatureC = Number(environment?.temperatureC);
  let finalReason = stressReason;
  let finalDetail = stressDetail;
  if (Number.isFinite(temperatureC) && (temperatureC <= 10 || temperatureC >= 40)) {
    growthFactor = 0;
    const detail = describeStressDetail(
      "temperatureC",
      temperatureC,
      profile.ideal.temperatureC
    );
    finalReason = detail.reason;
    finalDetail = {
      key: "temperatureC",
      value: temperatureC,
      ideal: [...profile.ideal.temperatureC],
      ...detail,
    };
  }

  const nextProgress = clamp(
    previousProgress + growthFactor * BASE_PROGRESS_PER_DAY * stepDays,
    0,
    100
  );
  const nextStageKey = stageForProgress(nextProgress);

  return {
    physiologicalProgress: nextProgress,
    simulatedDay,
    stage: nextStageKey,
    stageLabel: STAGE_LABELS[nextStageKey],
    progressPerDay: growthFactor * BASE_PROGRESS_PER_DAY,
    growthFactor,
    growthRatePct: Math.round(growthFactor * 100),
    stressed: growthFactor < 0.6,
    stalled: growthFactor <= 0.02,
    stress,
    deviations,
    // 生长受阻的主要原因（如“低温”“缺水”“寡照”），适宜时为 null
    stressReason: finalReason,
    stressDetail: finalDetail,
    // 本 tick 前所处阶段（用于跨阶段时做过渡判断）
    previousStage: stageKey,
    stageChanged: nextStageKey !== stageKey,
    profile,
  };
}

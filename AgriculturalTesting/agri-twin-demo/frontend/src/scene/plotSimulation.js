import { hash01 } from "./riceBatchMath.js";
import {
  AMBIENT_CO2_PPM,
  BASE_CO2_UPTAKE_PPM_PER_SECOND,
  CO2_PHYSICAL_LIMITS_PPM,
  CO2_VENTILATION_FLOOR_PPM,
  GROWTH_UPTAKE_FACTORS,
  MIN_LIGHT_LUX,
  SUNSHADE_LIGHT_STEP,
  TEMPERATURE_ENVIRONMENT_RETURN_RATE_PER_SECOND,
  TEMPERATURE_LIMITS_C,
  WATER_LEVEL_LIMITS_CM,
} from "./farmComponentRates.js";
import { ACTUAL_WEATHER_DEFAULTS, buildSnapshotFromKey } from "./weatherState.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// P8: 增温器智能恒温区间（℃）—— 30℃ 以下全力加热，32℃ 停止，避免无限升温
const HEATER_COMFORT_TEMP_C = 30;
const HEATER_CUTOFF_TEMP_C = 32;

/**
 * P16: 排水边界 —— 把排水速率限制在「当前水位 → 阶段安全下限」的余量内。
 * 到达下限（或已经低于下限）时返回 0，即自动停排；单次步进也不会冲过下限。
 * 只处理负向（排水）速率，增温/补气等正向效果原样返回。
 */
export function limitDrainageToFloor(componentEffects, waterLevelCm, floorCm, dt) {
  const rate = componentEffects?.waterLevelCmPerSecond ?? 0;
  if (!(rate < 0)) return componentEffects;
  const allowedDropCm = waterLevelCm - floorCm;
  if (allowedDropCm <= 0) {
    return { ...componentEffects, waterLevelCmPerSecond: 0 };
  }
  if (!(dt > 0)) return componentEffects;
  const maxDropCm = Math.abs(rate) * dt;
  if (maxDropCm > allowedDropCm) {
    return { ...componentEffects, waterLevelCmPerSecond: -allowedDropCm / dt };
  }
  return componentEffects;
}

/** 顺序调度时只应用单个组件的脉冲，不重复推进天气和环境回归。 */
export function applyComponentEffects(params, componentEffects, dt = 1) {
  if (!params) {
    throw new TypeError("Component simulation requires a parameter snapshot");
  }
  const effects = componentEffects || ZERO_COMPONENT_EFFECTS;
  const stepSeconds = Math.max(0, Number(dt) || 0);
  const waterLevelCm = clamp(
    params.waterLevelCm + (effects.waterLevelCmPerSecond || 0) * stepSeconds,
    WATER_LEVEL_LIMITS_CM.min,
    WATER_LEVEL_LIMITS_CM.max
  );
  const temperatureC = clamp(
    params.temperatureC + (effects.temperatureCPerSecond || 0) * stepSeconds,
    TEMPERATURE_LIMITS_C.min,
    TEMPERATURE_LIMITS_C.max
  );
  const humidityPct = clamp(
    params.humidityPct + (effects.humidityPctPerSecond || 0) * stepSeconds,
    0,
    100
  );
  const co2Ppm = clamp(
    params.co2Ppm +
      ((effects.co2SupplyPpmPerSecond || 0) +
        (AMBIENT_CO2_PPM - params.co2Ppm) * (effects.co2VentilationRate || 0)) *
        stepSeconds,
    CO2_PHYSICAL_LIMITS_PPM.min,
    CO2_PHYSICAL_LIMITS_PPM.max
  );
  const sunshadeFactor = clamp(
    1 - Math.max(0, effects.sunshadeCount || 0) * SUNSHADE_LIGHT_STEP,
    0.1,
    1
  );
  const lightLux = clamp(
    (Number(params.lightLux) || 0) * sunshadeFactor + (effects.lightLuxDelta || 0),
    MIN_LIGHT_LUX,
    30000
  );
  return {
    ...params,
    waterLevelCm,
    temperatureC,
    humidityPct,
    co2Ppm,
    lightLux: Math.round(lightLux),
    baseLightLux: params.baseLightLux ?? params.lightLux,
  };
}

export function update(dt, environment) {
  if (!environment || !environment.params) {
    throw new TypeError("Plot simulation requires a parameter snapshot");
  }
  if (!Number.isFinite(dt) || dt < 0) {
    throw new RangeError("Simulation delta must be a non-negative number");
  }

  const params = environment.params;
  const componentEffects = environment.componentEffects;
  // 消费 weatherSnapshot（来自 weatherState.js 的单一真相源）
  // 向后兼容：如果调用方还传旧的 weather 字符串，临时转成 snapshot
  let snap = environment.weatherSnapshot;
  if (!snap && environment.weather) {
    snap = buildSnapshotFromKey(environment.weather);
  }
  snap = snap || ACTUAL_WEATHER_DEFAULTS;
  const plotId = String(environment.plotId || "default-plot");
  const evaporationFactor = 0.9 + hash01(plotId, 0, "evaporation") * 0.2;
  const co2UptakeFactor = 0.9 + hash01(plotId, 0, "co2-uptake") * 0.2;
  const rainfallRate =
    snap.rainfallCmPerSecond * (0.9 + hash01(plotId, 0, "rainfall") * 0.2);
  const evaporationRate = snap.evaporationCmPerSecond * evaporationFactor;
  // 光照基准 —— 关键：绝不能拿上一次算完的结果当基准
  // 旧实现里 params.lightLux 既当输入又当输出，遮阳网每 tick 再乘一次 0.5，
  // 于是 18000 → 9000 → 4500 → … 十几秒后掉到 1 lux（指数衰减 bug）
  const hasExplicitSnapshot = Boolean(environment.weatherSnapshot);
  const baseLightLux = clamp(
    hasExplicitSnapshot && Number.isFinite(Number(snap.light))
      ? Number(snap.light)                                   // 有天气快照 → 跟随天气
      : Number(params.baseLightLux ?? params.lightLux) || 0,  // 否则沿用固定基准
    0,
    30000
  );
  // 遮阳网线性衰减：每片 -30%（1片 0.7 / 2片 0.4 / 3片 0.1），不再 0.5^n 断崖
  const sunshadeCount = Math.max(0, Math.floor(componentEffects.sunshadeCount || 0));
  const sunshadeFactor = clamp(1 - sunshadeCount * SUNSHADE_LIGHT_STEP, 0.1, 1);
  const supplementalLightLux = Math.max(0, componentEffects.lightLuxDelta || 0);
  // 最终光照：遮阳衰减后保底 100 lux，绝不掉到个位数
  const effectiveLightLux = clamp(
    baseLightLux * sunshadeFactor + supplementalLightLux,
    MIN_LIGHT_LUX,
    30000
  );
  const lightFactor = clamp(
    effectiveLightLux / 18000,
    0,
    1.5
  );
  const growthFactor = GROWTH_UPTAKE_FACTORS[params.growthStage] || 0.8;
  const uptakeRate =
    BASE_CO2_UPTAKE_PPM_PER_SECOND *
    lightFactor *
    growthFactor *
    co2UptakeFactor;
  const co2VentilationRate =
    snap.co2VentilationRate + componentEffects.co2VentilationRate;
  const temperatureReturnRate =
    TEMPERATURE_ENVIRONMENT_RETURN_RATE_PER_SECOND + co2VentilationRate;

  const waterLevelCm = clamp(
    params.waterLevelCm +
      (rainfallRate -
        evaporationRate +
        // P14: 水位已到 12cm 上限后，灌溉增量归零（负向效果仍允许）
        (params.waterLevelCm >= WATER_LEVEL_LIMITS_CM.max
          ? Math.min(0, componentEffects.waterLevelCmPerSecond)
          : componentEffects.waterLevelCmPerSecond)) *
        dt,
    WATER_LEVEL_LIMITS_CM.min,
    WATER_LEVEL_LIMITS_CM.max
  );
  // P14: CO2 供给到 2000ppm 后停止叠加；通风不允许把 CO2 抽到 350ppm 以下
  const co2SupplyGain =
    params.co2Ppm >= CO2_PHYSICAL_LIMITS_PPM.max
      ? Math.min(0, componentEffects.co2SupplyPpmPerSecond)
      : componentEffects.co2SupplyPpmPerSecond;
  const co2Delta = (AMBIENT_CO2_PPM - params.co2Ppm) * co2VentilationRate - uptakeRate;
  let co2Next = params.co2Ppm + (co2Delta + co2SupplyGain) * dt;
  if (co2VentilationRate > 0 && co2Next < CO2_VENTILATION_FLOOR_PPM && co2Next < params.co2Ppm) {
    // 拆出"不含通风"的结果：通风最多把 CO2 压到 350ppm，光合作用消耗另行受最终下限约束
    const withoutVentilation = params.co2Ppm + (-uptakeRate + co2SupplyGain) * dt;
    co2Next = Math.max(co2Next, Math.min(withoutVentilation, CO2_VENTILATION_FLOOR_PPM));
  }
  const co2Ppm = clamp(
    co2Next,
    CO2_PHYSICAL_LIMITS_PPM.min,
    CO2_PHYSICAL_LIMITS_PPM.max
  );
  // P8/P14: 温度主动调节 —— 升温 32℃ 截止；降温到 max(10℃, 环境温度) 截止
  const activeRate = componentEffects.temperatureCPerSecond;
  let activeScale = 1;
  if (activeRate > 0) {
    if (params.temperatureC >= HEATER_CUTOFF_TEMP_C) activeScale = 0;
    else if (params.temperatureC > HEATER_COMFORT_TEMP_C) {
      activeScale =
        (HEATER_CUTOFF_TEMP_C - params.temperatureC) /
        (HEATER_CUTOFF_TEMP_C - HEATER_COMFORT_TEMP_C);
    }
  } else if (activeRate < 0) {
    const coolingFloor = Math.max(10, Number(snap.ambientTemperatureC) || 10);
    if (params.temperatureC <= coolingFloor) activeScale = 0;
  }
  const temperatureC = clamp(
    params.temperatureC +
      ((snap.ambientTemperatureC - params.temperatureC) *
        temperatureReturnRate +
        activeRate * activeScale) *
        dt,
    TEMPERATURE_LIMITS_C.min,
    TEMPERATURE_LIMITS_C.max
  );

  // P5: 湿度更新 — 之前缺失！已补齐但环境回归太霸道，灌溉效果被吞没
  // 三项影响（按权重）：
  //  ① 组件直接影响：灌溉 +0.05/s（主要驱动力）
  //  ② 水位耦合：水面越高蒸发越快，湿度涨得越快（4cm → +0.032/s, 10cm → +0.08/s）
  //  ③ 环境回归：天气环境湿度往当前值拉（系数 0.003，比之前 0.008 温和很多）
  const ambientHumidityPct = Number(snap.humidity) || 60;
  // 通风会加快湿度回归速度（风越大湿气交换越快），但不直接改变目标湿度
  const ambientHumidityReturnRate = 0.003 + componentEffects.co2VentilationRate * 0.4;
  // 水位耦合：水越深，蒸发越多 → 空气中的湿度涨得越快
  // 4cm 水田 → 0.032/s；10cm → 0.08/s；溢出（>12cm）→ 0.096/s
  const waterCouplingRate = waterLevelCm * 0.008;
  // P14: 湿度到 100% 后，增湿类组件增量归零（除湿类仍允许）
  const humidityComponentGain =
    params.humidityPct >= 100
      ? Math.min(0, componentEffects.humidityPctPerSecond)
      : componentEffects.humidityPctPerSecond;
  // P15: 排水泵在土壤/空气湿度极高（>90%）时辅助降湿（要压过水面蒸发耦合）
  const drainageHumidityAssist =
    componentEffects.waterLevelCmPerSecond < 0 && params.humidityPct > 90 ? -0.06 : 0;
  const humidityPct = clamp(
    params.humidityPct +
      ((ambientHumidityPct - params.humidityPct) * ambientHumidityReturnRate +
        humidityComponentGain +
        drainageHumidityAssist +
        waterCouplingRate) *
        dt,
    0,
    100
  );
  return {
    ...params,
    waterLevelCm,
    co2Ppm,
    temperatureC,
    humidityPct,                             // 湿度实时更新
    baseLightLux,                            // 基准光照（不参与遮阳累积，供下个 tick 复用）
    lightLux: Math.round(effectiveLightLux), // 遮阳衰减后 + 保底 100 lux
  };
}

export const COMPONENT_TYPES = Object.freeze({
  IRRIGATION: "irrigation",
  VENTILATION: "ventilation",
  CO2_SUPPLY: "co2Supply",
  CAMERA: "camera",
  PEST_LAMP: "pestLamp",       // P4: 杀虫灯
  SUNSHADE: "sunshade",       // P4: 遮阳网
  HEATER: "heater",           // P5: 智能增温器
  DRAINAGE: "drainage",       // P15: 智能排水泵
  DRAINAGE_STATION: "drainageStation", // P16: 全局排涝泵站
  IRRIGATION_STATION: "irrigationStation", // 全局灌溉站
  HUMIDIFIER: "humidifier",   // 田块雾化增湿器
  HUMIDIFIER_STATION: "humidifierStation", // 全局集中增湿站
  GROW_LIGHT: "growLight",
  GROW_LIGHT_STATION: "growLightStation",
  DEHUMIDIFIER: "dehumidifier",
  DEHUMIDIFIER_STATION: "dehumidifierStation",
});

export const COMPONENT_TYPE_LABELS = Object.freeze({
  [COMPONENT_TYPES.IRRIGATION]: "灌溉装置",
  [COMPONENT_TYPES.VENTILATION]: "通风装置",
  [COMPONENT_TYPES.CO2_SUPPLY]: "CO₂ 供给装置",
  [COMPONENT_TYPES.CAMERA]: "高清巡检摄像头",
  [COMPONENT_TYPES.PEST_LAMP]: "杀虫灯",
  [COMPONENT_TYPES.SUNSHADE]: "遮阳网",
  [COMPONENT_TYPES.HEATER]: "智能增温器",
  [COMPONENT_TYPES.DRAINAGE]: "智能排水泵",
  [COMPONENT_TYPES.DRAINAGE_STATION]: "排涝泵站",
  [COMPONENT_TYPES.IRRIGATION_STATION]: "全局灌溉站",
  [COMPONENT_TYPES.HUMIDIFIER]: "雾化增湿器",
  [COMPONENT_TYPES.HUMIDIFIER_STATION]: "集中增湿站",
  [COMPONENT_TYPES.GROW_LIGHT]: "LED 补光灯",
  [COMPONENT_TYPES.GROW_LIGHT_STATION]: "集中补光站",
  [COMPONENT_TYPES.DEHUMIDIFIER]: "除湿机",
  [COMPONENT_TYPES.DEHUMIDIFIER_STATION]: "集中除湿站",
});

export const COMPONENT_EFFECT_FIELDS = Object.freeze([
  "waterLevelCmPerSecond",
  "co2SupplyPpmPerSecond",
  "co2VentilationRate",
  "temperatureCPerSecond",
  "humidityPctPerSecond",       // P4: 组件对湿度的直接影响
  "lightLuxDelta",
]);

export const ZERO_COMPONENT_EFFECTS = Object.freeze({
  waterLevelCmPerSecond: 0,
  co2SupplyPpmPerSecond: 0,
  co2VentilationRate: 0,
  temperatureCPerSecond: 0,
  humidityPctPerSecond: 0,
  lightLuxDelta: 0,
});

export const COMPONENT_EFFECTS_BY_TYPE = Object.freeze({
  [COMPONENT_TYPES.IRRIGATION]: Object.freeze({
    waterLevelCmPerSecond: 0.03,
    co2SupplyPpmPerSecond: 0,
    co2VentilationRate: 0,
    temperatureCPerSecond: -0.012, // 灌溉也降温
    humidityPctPerSecond: 0.06,
    lightLuxDelta: 0,
  }),
  [COMPONENT_TYPES.VENTILATION]: Object.freeze({
    waterLevelCmPerSecond: 0,
    co2SupplyPpmPerSecond: 0,
    co2VentilationRate: 0.025,
    temperatureCPerSecond: -0.025,
    humidityPctPerSecond: -0.025,
    lightLuxDelta: 0,
  }),
  [COMPONENT_TYPES.CO2_SUPPLY]: Object.freeze({
    waterLevelCmPerSecond: 0,
    co2SupplyPpmPerSecond: 0.8,
    co2VentilationRate: 0,
    temperatureCPerSecond: 0,
    humidityPctPerSecond: 0,
    lightLuxDelta: 0,
  }),
  [COMPONENT_TYPES.CAMERA]: ZERO_COMPONENT_EFFECTS,
  // P4: 杀虫灯 — 纯展示型，无直接参数影响
  [COMPONENT_TYPES.PEST_LAMP]: ZERO_COMPONENT_EFFECTS,
  // P4: 遮阳网 — 光照减半（lightLux multiplier 在 plotSimulation 里按 component.type 处理）+ 温度微降
  [COMPONENT_TYPES.SUNSHADE]: Object.freeze({
    waterLevelCmPerSecond: 0,
    co2SupplyPpmPerSecond: 0,
    co2VentilationRate: 0,
    temperatureCPerSecond: -0.02,
    humidityPctPerSecond: 0.006,
    lightLuxDelta: 0,
    // lightLux 处理：在 plotSimulation 里特殊读取 sunshade 类型做 multiplier
  }),
  // P7: 智能增温器 — 大棚级设备，一台对全田生效；+0.15°C/s，14℃ 环境约 30s 升过 16℃ 安全线
  [COMPONENT_TYPES.HEATER]: Object.freeze({
    waterLevelCmPerSecond: 0,
    co2SupplyPpmPerSecond: 0,
    co2VentilationRate: 0,
    temperatureCPerSecond: 0.20,
    humidityPctPerSecond: -0.012,
    lightLuxDelta: 0,
  }),
  // P15: 智能排水泵 — 强制排水，水位到 0 自动停止（clamp 兜底）
  [COMPONENT_TYPES.DRAINAGE]: Object.freeze({
    waterLevelCmPerSecond: -0.07,
    co2SupplyPpmPerSecond: 0,
    co2VentilationRate: 0,
    temperatureCPerSecond: 0,
    humidityPctPerSecond: 0,       // 湿度辅助降低在 plotSimulation 里按 >90% 条件触发
    lightLuxDelta: 0,
  }),
  // P16: 排涝泵站 — 大田外围的总排渠泵站，-0.12cm/s 对全图生效（4cm 约 33s 排干）
  [COMPONENT_TYPES.DRAINAGE_STATION]: Object.freeze({
    waterLevelCmPerSecond: -0.16,
    co2SupplyPpmPerSecond: 0,
    co2VentilationRate: 0,
    temperatureCPerSecond: 0,
    humidityPctPerSecond: -0.02,   // 大量排水会带走田间湿度
    lightLuxDelta: 0,
  }),
  // 全局灌溉站 — 大田外围的集中供水泵站，+0.10cm/s 对全图生效
  [COMPONENT_TYPES.IRRIGATION_STATION]: Object.freeze({
    waterLevelCmPerSecond: 0.14,
    co2SupplyPpmPerSecond: 0,
    co2VentilationRate: 0,
    temperatureCPerSecond: -0.015,
    humidityPctPerSecond: 0.08,
    lightLuxDelta: 0,
  }),
  // 独立增湿设备只改变空气湿度，不影响水位、温度和 CO₂
  [COMPONENT_TYPES.HUMIDIFIER]: Object.freeze({
    waterLevelCmPerSecond: 0,
    co2SupplyPpmPerSecond: 0,
    co2VentilationRate: 0,
    temperatureCPerSecond: 0,
    humidityPctPerSecond: 0.085,
    lightLuxDelta: 0,
  }),
  [COMPONENT_TYPES.HUMIDIFIER_STATION]: Object.freeze({
    waterLevelCmPerSecond: 0,
    co2SupplyPpmPerSecond: 0,
    co2VentilationRate: 0,
    temperatureCPerSecond: 0,
    humidityPctPerSecond: 0.14,
    lightLuxDelta: 0,
  }),
  // 补光设备只增加光照，除湿设备只降低湿度
  [COMPONENT_TYPES.GROW_LIGHT]: Object.freeze({
    waterLevelCmPerSecond: 0,
    co2SupplyPpmPerSecond: 0,
    co2VentilationRate: 0,
    temperatureCPerSecond: 0,
    humidityPctPerSecond: 0,
    lightLuxDelta: 8000,
  }),
  [COMPONENT_TYPES.GROW_LIGHT_STATION]: Object.freeze({
    waterLevelCmPerSecond: 0,
    co2SupplyPpmPerSecond: 0,
    co2VentilationRate: 0,
    temperatureCPerSecond: 0,
    humidityPctPerSecond: 0,
    lightLuxDelta: 14000,
  }),
  [COMPONENT_TYPES.DEHUMIDIFIER]: Object.freeze({
    waterLevelCmPerSecond: 0,
    co2SupplyPpmPerSecond: 0,
    co2VentilationRate: 0,
    temperatureCPerSecond: 0,
    humidityPctPerSecond: -0.085,
    lightLuxDelta: 0,
  }),
  [COMPONENT_TYPES.DEHUMIDIFIER_STATION]: Object.freeze({
    waterLevelCmPerSecond: 0,
    co2SupplyPpmPerSecond: 0,
    co2VentilationRate: 0,
    temperatureCPerSecond: 0,
    humidityPctPerSecond: -0.14,
    lightLuxDelta: 0,
  }),
});

// P4: 遮阳网对光照的倍率（默认 0.5，即光照减半）
// 注意：plotSimulation 已改为线性衰减（SUNSHADE_LIGHT_STEP），此常量仅作参考保留
export const SUNSHADE_LIGHT_MULTIPLIER = 0.5;

// P6: 遮阳网光照线性衰减步长（每片 -30%，下限 0.1）
// 用线性替代 0.5^n，避免多片叠加后光照断崖式趋近 0
export const SUNSHADE_LIGHT_STEP = 0.3;

// P7: 自然光照下限（lux）—— 白天不会低于这个值，杜绝 1 lux 之类的不合理读数
export const MIN_LIGHT_LUX = 100;

// P7: 允许放在大田外围（plotId = "global"）的设备类型
// 灌溉、遮阳网强绑定田块；增温器允许全局放置，但只有全局设备才影响全图
export const FIELD_WIDE_COMPONENT_TYPES = Object.freeze(
  new Set([
    COMPONENT_TYPES.CAMERA,
    COMPONENT_TYPES.PEST_LAMP,
    COMPONENT_TYPES.VENTILATION,
    COMPONENT_TYPES.CO2_SUPPLY,
    COMPONENT_TYPES.HEATER,
    COMPONENT_TYPES.DRAINAGE_STATION,
    COMPONENT_TYPES.IRRIGATION_STATION,
    COMPONENT_TYPES.HUMIDIFIER_STATION,
    COMPONENT_TYPES.GROW_LIGHT_STATION,
    COMPONENT_TYPES.DEHUMIDIFIER_STATION,
  ])
);

// P16: 只能布置在大田外围（全局生效）的设备类型
export const GLOBAL_ONLY_COMPONENT_TYPES = Object.freeze(
  new Set([
    COMPONENT_TYPES.DRAINAGE_STATION,
    COMPONENT_TYPES.IRRIGATION_STATION,
    COMPONENT_TYPES.HUMIDIFIER_STATION,
    COMPONENT_TYPES.GROW_LIGHT_STATION,
    COMPONENT_TYPES.DEHUMIDIFIER_STATION,
  ])
);

/** 组件是否必须放置到大田外围 */
export function isGlobalOnlyComponentType(type) {
  return GLOBAL_ONLY_COMPONENT_TYPES.has(type);
}

/** 组件是否允许放置到大田外围 */
export function canPlaceFieldWide(type) {
  return FIELD_WIDE_COMPONENT_TYPES.has(type);
}

// —— 天气速率常量已迁移至 weatherState.js 的 WEATHER_PRESETS ——
// 本文件仅保留组件效果相关常量与物理边界

export const AMBIENT_CO2_PPM = 420;
export const WATER_LEVEL_LIMITS_CM = Object.freeze({ min: 0, max: 12 });
export const CO2_PHYSICAL_LIMITS_PPM = Object.freeze({ min: 300, max: 2000 });
// P14: 通风可把 CO2 压到的最低值（光合作用极限），再低只能靠自然消耗
export const CO2_VENTILATION_FLOOR_PPM = 350;
export const TEMPERATURE_LIMITS_C = Object.freeze({ min: 0, max: 45 });
export const TEMPERATURE_ENVIRONMENT_RETURN_RATE_PER_SECOND = 0.012;
export const BASE_CO2_UPTAKE_PPM_PER_SECOND = 0.01;

export const GROWTH_UPTAKE_FACTORS = Object.freeze({
  germination: 0.45,
  seedling: 0.55,
  tillering: 0.8,
  jointing: 1,
  heading: 1.05,
  filling: 1.1,
  maturity: 0.45,
});

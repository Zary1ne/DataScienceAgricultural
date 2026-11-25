import { COMPONENT_TYPES } from "./farmComponentRates.js";

export const COMPONENT_SCOPES = Object.freeze({
  PLOT: "plot",
  GLOBAL: "global",
});

export const COMPONENT_CATEGORY_ORDER = Object.freeze([
  "water",
  "climate",
  "gasLight",
  "monitor",
]);

export const COMPONENT_CATEGORY_LABELS = Object.freeze({
  water: "水平衡",
  climate: "温湿调控",
  gasLight: "气体与光照",
  monitor: "监测展示",
});

export const FARM_COMPONENT_CATALOG = Object.freeze([
  { type: COMPONENT_TYPES.IRRIGATION, scope: "plot", category: "water", label: "灌溉器", primaryMetric: "水位" },
  { type: COMPONENT_TYPES.DRAINAGE, scope: "plot", category: "water", label: "排水泵", primaryMetric: "水位" },
  { type: COMPONENT_TYPES.HUMIDIFIER, scope: "plot", category: "climate", label: "雾化增湿", primaryMetric: "湿度" },
  { type: COMPONENT_TYPES.DEHUMIDIFIER, scope: "plot", category: "climate", label: "除湿机", primaryMetric: "湿度" },
  { type: COMPONENT_TYPES.HEATER, scope: "plot", category: "climate", label: "增温器", primaryMetric: "温度" },
  { type: COMPONENT_TYPES.VENTILATION, scope: "plot", category: "climate", label: "通风器", primaryMetric: "温湿度 / CO₂" },
  { type: COMPONENT_TYPES.CO2_SUPPLY, scope: "plot", category: "gasLight", label: "CO₂ 供给", primaryMetric: "CO₂" },
  { type: COMPONENT_TYPES.SUNSHADE, scope: "plot", category: "gasLight", label: "遮阳网", primaryMetric: "光照" },
  { type: COMPONENT_TYPES.GROW_LIGHT, scope: "plot", category: "gasLight", label: "LED 补光", primaryMetric: "光照" },
  { type: COMPONENT_TYPES.CAMERA, scope: "plot", category: "monitor", label: "巡检摄像头", primaryMetric: "监测" },
  { type: COMPONENT_TYPES.PEST_LAMP, scope: "plot", category: "monitor", label: "杀虫灯", primaryMetric: "展示" },
  { type: COMPONENT_TYPES.IRRIGATION_STATION, scope: "global", category: "water", label: "全局灌溉站", primaryMetric: "全部地块水位" },
  { type: COMPONENT_TYPES.DRAINAGE_STATION, scope: "global", category: "water", label: "排涝泵站", primaryMetric: "全部地块水位" },
  { type: COMPONENT_TYPES.HUMIDIFIER_STATION, scope: "global", category: "climate", label: "集中增湿站", primaryMetric: "全部地块湿度" },
  { type: COMPONENT_TYPES.DEHUMIDIFIER_STATION, scope: "global", category: "climate", label: "集中除湿站", primaryMetric: "全部地块湿度" },
  { type: COMPONENT_TYPES.HEATER, scope: "global", category: "climate", label: "集中增温站", primaryMetric: "全部地块温度" },
  { type: COMPONENT_TYPES.VENTILATION, scope: "global", category: "climate", label: "全局通风", primaryMetric: "全部地块温湿度 / CO₂" },
  { type: COMPONENT_TYPES.CO2_SUPPLY, scope: "global", category: "gasLight", label: "全局 CO₂ 供给", primaryMetric: "全部地块 CO₂" },
  { type: COMPONENT_TYPES.GROW_LIGHT_STATION, scope: "global", category: "gasLight", label: "集中补光站", primaryMetric: "全部地块光照" },
  { type: COMPONENT_TYPES.CAMERA, scope: "global", category: "monitor", label: "全局摄像头", primaryMetric: "监测" },
  { type: COMPONENT_TYPES.PEST_LAMP, scope: "global", category: "monitor", label: "全局杀虫灯", primaryMetric: "展示" },
]);

export function componentCatalogEntry(type, scope = COMPONENT_SCOPES.PLOT) {
  return FARM_COMPONENT_CATALOG.find((item) => item.type === type && item.scope === scope) || null;
}

export function componentToolsForScope(scope) {
  return COMPONENT_CATEGORY_ORDER.map((category) => ({
    category,
    label: COMPONENT_CATEGORY_LABELS[category],
    tools: FARM_COMPONENT_CATALOG.filter(
      (item) => item.scope === scope && item.category === category
    ),
  })).filter((group) => group.tools.length);
}

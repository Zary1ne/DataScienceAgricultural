import {
  COMPONENT_EFFECT_FIELDS,
  COMPONENT_EFFECTS_BY_TYPE,
  COMPONENT_TYPES,
  ZERO_COMPONENT_EFFECTS,
} from "./farmComponentRates.js";
import { getStageProfile } from "./riceGrowthModel.js";

const VALID_COMPONENT_TYPES = new Set(Object.values(COMPONENT_TYPES));

const CONTROL_PRIORITY = Object.freeze({
  [COMPONENT_TYPES.IRRIGATION]: 10,
  [COMPONENT_TYPES.IRRIGATION_STATION]: 10,
  [COMPONENT_TYPES.DRAINAGE]: 10,
  [COMPONENT_TYPES.DRAINAGE_STATION]: 10,
  [COMPONENT_TYPES.HEATER]: 20,
  [COMPONENT_TYPES.VENTILATION]: 20,
  [COMPONENT_TYPES.HUMIDIFIER]: 30,
  [COMPONENT_TYPES.HUMIDIFIER_STATION]: 30,
  [COMPONENT_TYPES.DEHUMIDIFIER]: 30,
  [COMPONENT_TYPES.DEHUMIDIFIER_STATION]: 30,
  [COMPONENT_TYPES.CO2_SUPPLY]: 40,
  [COMPONENT_TYPES.SUNSHADE]: 50,
  [COMPONENT_TYPES.GROW_LIGHT]: 50,
  [COMPONENT_TYPES.GROW_LIGHT_STATION]: 50,
});

function hasControlEffect(component) {
  return COMPONENT_EFFECT_FIELDS.some((field) => Math.abs(component.effects[field] || 0) > 0);
}

export function sortComponentsForDispatch(components) {
  return [...components].sort((a, b) => {
    const priorityDiff = (CONTROL_PRIORITY[a.type] || 90) - (CONTROL_PRIORITY[b.type] || 90);
    if (priorityDiff) return priorityDiff;
    return a.id.localeCompare(b.id);
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function targetControl(value, idealRange, minDeadband = 0.1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return { direction: 0, scale: 0, target: null, deadband: minDeadband };
  }
  const [low, high] = idealRange;
  const target = (low + high) / 2;
  const deadband = Math.max(minDeadband, (high - low) * 0.08);
  const delta = numeric - target;
  if (Math.abs(delta) <= deadband) {
    return { direction: 0, scale: 0, target, deadband };
  }
  const span = Math.max(deadband, (high - low) / 2);
  const scale = clamp((Math.abs(delta) - deadband) / span, 0.15, 1);
  return { direction: delta < 0 ? -1 : 1, scale, target, deadband };
}

function stageGain(idealRange, referenceWidth) {
  return clamp((idealRange[1] - idealRange[0]) / referenceWidth, 0.9, 1.35);
}

function automaticScale(component, context) {
  if (!context?.params) return 1;
  const params = context.params;
  const stageKey = context.stage || params.growthStage || "tillering";
  const ideal = getStageProfile(stageKey).ideal;
  const type = component.type;

  if (type === COMPONENT_TYPES.IRRIGATION || type === COMPONENT_TYPES.IRRIGATION_STATION) {
    const control = targetControl(params.waterLevelCm, ideal.waterLevelCm, 0.05);
    return control.direction < 0 ? control.scale * stageGain(ideal.waterLevelCm, 2) : 0;
  }
  if (type === COMPONENT_TYPES.DRAINAGE || type === COMPONENT_TYPES.DRAINAGE_STATION) {
    const control = targetControl(params.waterLevelCm, ideal.waterLevelCm, 0.05);
    return control.direction > 0 ? control.scale * stageGain(ideal.waterLevelCm, 2) : 0;
  }
  if (type === COMPONENT_TYPES.HUMIDIFIER || type === COMPONENT_TYPES.HUMIDIFIER_STATION) {
    const control = targetControl(params.humidityPct, ideal.humidityPct, 0.5);
    return control.direction < 0 ? control.scale * stageGain(ideal.humidityPct, 15) : 0;
  }
  if (type === COMPONENT_TYPES.DEHUMIDIFIER || type === COMPONENT_TYPES.DEHUMIDIFIER_STATION) {
    const control = targetControl(params.humidityPct, ideal.humidityPct, 0.5);
    return control.direction > 0 ? control.scale * stageGain(ideal.humidityPct, 15) : 0;
  }
  if (type === COMPONENT_TYPES.HEATER) {
    const control = targetControl(params.temperatureC, ideal.temperatureC, 0.2);
    return control.direction < 0 ? control.scale * stageGain(ideal.temperatureC, 5) : 0;
  }
  if (type === COMPONENT_TYPES.VENTILATION) {
    const controls = [
      [targetControl(params.temperatureC, ideal.temperatureC, 0.2), stageGain(ideal.temperatureC, 5)],
      [targetControl(params.humidityPct, ideal.humidityPct, 0.5), stageGain(ideal.humidityPct, 15)],
      [targetControl(params.co2Ppm, ideal.co2Ppm, 5), stageGain(ideal.co2Ppm, 400)],
    ];
    return controls.reduce(
      (scale, [control, gain]) => control.direction > 0
        ? Math.max(scale, control.scale * gain)
        : scale,
      0
    );
  }
  if (type === COMPONENT_TYPES.CO2_SUPPLY) {
    const control = targetControl(params.co2Ppm, ideal.co2Ppm, 5);
    return control.direction < 0 ? control.scale * stageGain(ideal.co2Ppm, 400) : 0;
  }
  if (type === COMPONENT_TYPES.SUNSHADE) {
    const baseLightLux = Number(params.baseLightLux ?? params.lightLux);
    const control = targetControl(baseLightLux, ideal.lightLux, 100);
    return control.direction > 0 ? control.scale * stageGain(ideal.lightLux, 10000) : 0;
  }
  if (type === COMPONENT_TYPES.GROW_LIGHT || type === COMPONENT_TYPES.GROW_LIGHT_STATION) {
    const control = targetControl(params.lightLux, ideal.lightLux, 100);
    return control.direction < 0 ? control.scale * stageGain(ideal.lightLux, 10000) : 0;
  }
  return 1;
}

// P7: 大田外围（全局）组件的特殊 plotId —— 效果作用于全图
export const GLOBAL_PLOT_ID = "global";

export class FarmComponent {
  constructor({ id, type, plotId, enabled = true, placement = null }) {
    if (!VALID_COMPONENT_TYPES.has(type)) {
      throw new RangeError(`Unsupported farm component type: ${type}`);
    }
    if (typeof plotId !== "string" || !plotId) {
      throw new TypeError("Farm component requires a plot ID");
    }

    this.id = id;
    this.type = type;
    this.plotId = plotId;
    this.enabled = Boolean(enabled);
    this.effects = { ...COMPONENT_EFFECTS_BY_TYPE[type] };
    this.activePlotIds = new Set();
    // P7: 全局设备（plotId === "global"）记录在大田外围的世界坐标
    this.placement = placement ? { ...placement } : null;
  }
}

export class FarmComponentManager {
  constructor() {
    this.components = [];
    this.nextId = 1;
  }

  attach(plotId, type, placement = null) {
    const existing = this.components.find(
      (component) => component.plotId === plotId && component.type === type
    );
    if (existing) {
      return { ok: false, reason: "duplicate-type", component: existing };
    }

    const component = new FarmComponent({
      id: `farm-component-${String(this.nextId).padStart(4, "0")}`,
      type,
      plotId,
      placement,
    });
    this.nextId += 1;
    this.components.push(component);
    return { ok: true, component };
  }

  getById(componentId) {
    return this.components.find((component) => component.id === componentId) || null;
  }

  listByPlot(plotId) {
    return this.components.filter((component) => component.plotId === plotId);
  }

  setEnabled(componentId, enabled) {
    const component = this.getById(componentId);
    if (!component) return { ok: false, reason: "not-found" };
    component.enabled = Boolean(enabled);
    component.activePlotIds.clear();
    return { ok: true, component };
  }

  updatePlacement(componentId, placement) {
    const component = this.getById(componentId);
    if (!component) return { ok: false, reason: "not-found" };
    if (!placement) return { ok: false, reason: "invalid-placement" };
    component.placement = { ...placement };
    return { ok: true, component };
  }

  beginAutoControlCycle() {
    for (const component of this.components) {
      component.activePlotIds.clear();
    }
  }

  isActive(componentId) {
    const component = this.getById(componentId);
    return Boolean(component?.enabled && component.activePlotIds.size);
  }

  isControlComponent(componentId) {
    const component = this.getById(componentId);
    return Boolean(component && hasControlEffect(component));
  }

  listDispatchComponents(plotId) {
    return sortComponentsForDispatch(
      this.components.filter((component) => {
        if (!component.enabled || !hasControlEffect(component)) return false;
        return component.plotId === plotId || component.plotId === GLOBAL_PLOT_ID;
      })
    );
  }

  effectsForComponent(plotId, component, controlContext = null) {
    const effects = { ...ZERO_COMPONENT_EFFECTS, sunshadeCount: 0 };
    if (!component?.enabled) return effects;
    const affectsPlot = component.plotId === plotId || component.plotId === GLOBAL_PLOT_ID;
    if (!affectsPlot) return effects;
    const controlScale = automaticScale(component, controlContext);
    if (controlScale <= 0) return effects;
    component.activePlotIds.add(plotId);
    for (const field of COMPONENT_EFFECT_FIELDS) {
      effects[field] += (component.effects[field] || 0) * controlScale;
    }
    if (component.type === COMPONENT_TYPES.SUNSHADE) {
      effects.sunshadeCount += controlScale;
    }
    return effects;
  }

  remove(componentId) {
    const index = this.components.findIndex((component) => component.id === componentId);
    if (index < 0) return { ok: false, reason: "not-found" };
    const [component] = this.components.splice(index, 1);
    return { ok: true, component };
  }

  aggregateEffects(plotId, controlContext = null) {
    const effects = { ...ZERO_COMPONENT_EFFECTS, sunshadeCount: 0 };
    for (const component of this.components) {
      if (!component.enabled) continue;
      // P8: 组件效果严格按 plotId 归属叠加 —— 放在某块小地的增温器只影响该地块；
      // 只有 plotId === "global" 的大田外围设备才作用于全部地块
      const affectsPlot =
        component.plotId === plotId || component.plotId === GLOBAL_PLOT_ID;
      if (!affectsPlot) continue;
      const componentEffects = this.effectsForComponent(plotId, component, controlContext);
      for (const field of COMPONENT_EFFECT_FIELDS) {
        effects[field] += componentEffects[field];
      }
      effects.sunshadeCount += componentEffects.sunshadeCount;
    }
    return effects;
  }
}

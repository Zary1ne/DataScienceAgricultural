import assert from "node:assert/strict";
import test from "node:test";
import { update, limitDrainageToFloor } from "../src/scene/plotSimulation.js";
import {
  COMPONENT_TYPES,
  ZERO_COMPONENT_EFFECTS,
} from "../src/scene/farmComponentRates.js";
import { FarmComponentManager, GLOBAL_PLOT_ID } from "../src/scene/farmComponents.js";
import { buildSnapshotFromKey } from "../src/scene/weatherState.js";

const baseParams = {
  waterLevelCm: 4,
  co2Ppm: 420,
  temperatureC: 25,
  humidityPct: 75,
  lightLux: 18000,
  growthStage: "tillering",
  healthPct: 90,
};

function makeEnvironment(overrides = {}, weather = "sunny", componentEffects = ZERO_COMPONENT_EFFECTS) {
  return {
    plotId: "Plain-R01-C01",
    weather,
    selectedPlotId: null,
    elapsedSeconds: 0,
    componentEffects: { ...componentEffects },
    params: { ...baseParams, ...overrides },
  };
}

function simulate(overrides = {}, dt = 1, weather = "sunny", componentEffects) {
  return update(dt, makeEnvironment(overrides, weather, componentEffects));
}

test("simulation returns new params without mutating its input snapshot", () => {
  const environment = makeEnvironment();
  const snapshot = structuredClone(environment);
  const next = update(1, environment);

  assert.notEqual(next, environment.params);
  assert.deepEqual(environment, snapshot);
  // P4: humidityPct 现在也会被实时更新（不再是常数）
  assert.ok(Object.hasOwn(next, "humidityPct"));
  assert.ok(typeof next.humidityPct === "number");
});

test("sun evaporates water and rain replenishes it", () => {
  const sunny = simulate({}, 10);
  const rainy = simulate({}, 10, "rain");

  assert.ok(sunny.waterLevelCm < baseParams.waterLevelCm);
  assert.ok(rainy.waterLevelCm > baseParams.waterLevelCm);
});

test("water, carbon dioxide, and temperature remain within physical limits", () => {
  const dry = simulate({ waterLevelCm: 0.001 }, 1000);
  const flooded = simulate({ waterLevelCm: 11.99 }, 1000, "rain");
  const lowCo2 = simulate({ co2Ppm: 100 }, 0);
  const highCo2 = simulate({ co2Ppm: 2500 }, 0);
  const cold = simulate({ temperatureC: -5 }, 0);
  const hot = simulate({ temperatureC: 50 }, 0);

  assert.equal(dry.waterLevelCm, 0);
  assert.equal(flooded.waterLevelCm, 12);
  assert.equal(lowCo2.co2Ppm, 300);
  assert.equal(highCo2.co2Ppm, 2000);
  assert.equal(cold.temperatureC, 0);
  assert.equal(hot.temperatureC, 45);
});

test("light gates carbon uptake and wind drives ventilation toward ambient", () => {
  const dark = simulate({ lightLux: 0, co2Ppm: 500 }, 60, "cloudy");
  const lit = simulate({ lightLux: 18000, co2Ppm: 500 }, 60, "cloudy");
  const windy = simulate({ lightLux: 0, co2Ppm: 500 }, 10, "wind");

  assert.ok(dark.co2Ppm > lit.co2Ppm);
  assert.ok(windy.co2Ppm < 500);
  assert.ok(windy.co2Ppm > 420);
});

test("temperature moves toward the weather-specific ambient temperature", () => {
  const warmRain = simulate({ temperatureC: 32 }, 10, "rain");
  const coolSunny = simulate({ temperatureC: 20 }, 10, "sunny");

  assert.ok(warmRain.temperatureC < 32);
  assert.ok(coolSunny.temperatureC > 20);
});

test("enabled irrigation, ventilation, and CO2 supply affect parameters in their configured directions", () => {
  const irrigationManager = new FarmComponentManager();
  irrigationManager.attach("Plain-R01-C01", COMPONENT_TYPES.IRRIGATION);
  const irrigated = update(5, makeEnvironment(
    { waterLevelCm: 5 },
    "sunny",
    irrigationManager.aggregateEffects("Plain-R01-C01")
  ));
  const noIrrigation = simulate({ waterLevelCm: 5 }, 5);
  assert.ok(irrigated.waterLevelCm > noIrrigation.waterLevelCm);
  // P4: 灌溉也会增加湿度（组件直接影响 + 水位耦合）
  assert.ok(irrigated.humidityPct > noIrrigation.humidityPct);
  // P4: 湿度限幅 0-100
  assert.ok(irrigated.humidityPct <= 100);
  assert.ok(irrigated.humidityPct >= 0);

  const ventilationManager = new FarmComponentManager();
  ventilationManager.attach("Plain-R01-C01", COMPONENT_TYPES.VENTILATION);
  const ventilated = update(5, makeEnvironment(
    { co2Ppm: 700, temperatureC: 30 },
    "cloudy",
    ventilationManager.aggregateEffects("Plain-R01-C01")
  ));
  const noVentilation = simulate({ co2Ppm: 700, temperatureC: 30 }, 5, "cloudy");
  assert.ok(ventilated.co2Ppm < noVentilation.co2Ppm);
  assert.ok(ventilated.temperatureC < noVentilation.temperatureC);

  const co2Manager = new FarmComponentManager();
  co2Manager.attach("Plain-R01-C01", COMPONENT_TYPES.CO2_SUPPLY);
  const supplied = update(5, makeEnvironment(
    { co2Ppm: 500 },
    "sunny",
    co2Manager.aggregateEffects("Plain-R01-C01")
  ));
  const noSupply = simulate({ co2Ppm: 500 }, 5);
  assert.ok(supplied.co2Ppm > noSupply.co2Ppm);
});

test("disabling or removing a component removes its parameter effect", () => {
  const manager = new FarmComponentManager();
  const attached = manager.attach("Plain-R01-C01", COMPONENT_TYPES.CO2_SUPPLY);
  const params = { co2Ppm: 500 };
  const baseline = simulate(params, 5);
  const active = update(5, makeEnvironment(
    params,
    "sunny",
    manager.aggregateEffects("Plain-R01-C01")
  ));
  assert.ok(active.co2Ppm > baseline.co2Ppm);

  manager.setEnabled(attached.component.id, false);
  const disabled = update(5, makeEnvironment(
    params,
    "sunny",
    manager.aggregateEffects("Plain-R01-C01")
  ));
  assert.deepEqual(disabled, baseline);

  manager.setEnabled(attached.component.id, true);
  manager.remove(attached.component.id);
  const removed = update(5, makeEnvironment(
    params,
    "sunny",
    manager.aggregateEffects("Plain-R01-C01")
  ));
  assert.deepEqual(removed, baseline);
});

test("display-only camera components do not affect parameters", () => {
  const manager = new FarmComponentManager();
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.CAMERA);

  const withDisplayPlugins = update(30, makeEnvironment(
    { waterLevelCm: 7, co2Ppm: 800, temperatureC: 31 },
    "wind",
    manager.aggregateEffects("Plain-R01-C01")
  ));
  const withoutPlugins = simulate(
    { waterLevelCm: 7, co2Ppm: 800, temperatureC: 31 },
    30,
    "wind"
  );
  assert.deepEqual(withDisplayPlugins, withoutPlugins);
});

test("deterministic plot factors produce independent trajectories", () => {
  const firstEnvironment = makeEnvironment({}, "rain");
  const secondEnvironment = {
    ...firstEnvironment,
    plotId: "Plain-R01-C02",
    params: { ...baseParams },
  };
  const first = update(30, firstEnvironment);
  const second = update(30, secondEnvironment);

  assert.notEqual(first.waterLevelCm, second.waterLevelCm);
  assert.notEqual(first.co2Ppm, second.co2Ppm);
});

test("P6: 遮阳网光照线性衰减，多 tick 不累积（不会衰减到 1 lux）", () => {
  const manager = new FarmComponentManager();
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.SUNSHADE);
  const componentEffects = manager.aggregateEffects("Plain-R01-C01");
  assert.equal(componentEffects.sunshadeCount, 1);

  // 连跑 30 个 tick：若仍按 0.5^n 自我累积，会掉到个位数 lux
  let params = { ...baseParams };
  for (let i = 0; i < 30; i += 1) {
    params = update(1, {
      plotId: "Plain-R01-C01",
      weather: "sunny",
      componentEffects,
      params,
    });
  }

  // 18000 × (1 - 0.3) = 12600，且必须稳定不衰减
  assert.equal(params.lightLux, Math.round(18000 * 0.7));
  assert.ok(params.lightLux > 1000);
});

test("P15: 排水泵每秒降低水位，排到 0 后自动停止", () => {
  const drainage = { ...ZERO_COMPONENT_EFFECTS, waterLevelCmPerSecond: -0.05 };
  const lowered = simulate({ waterLevelCm: 8 }, 10, "sunny", drainage);
  assert.ok(lowered.waterLevelCm < 8);

  const emptied = simulate({ waterLevelCm: 0.5 }, 60, "sunny", drainage);
  assert.equal(emptied.waterLevelCm, 0);
});

test("P15: 湿度 >90% 时排水泵辅助降湿", () => {
  const drainage = { ...ZERO_COMPONENT_EFFECTS, waterLevelCmPerSecond: -0.05 };
  const withPump = simulate({ humidityPct: 95, waterLevelCm: 8 }, 20, "rain", drainage);
  const withoutPump = simulate({ humidityPct: 95, waterLevelCm: 8 }, 20, "rain");
  assert.ok(withPump.humidityPct < withoutPump.humidityPct);
});

test("P16: 全局排涝泵站快速排水并同步降湿，见底自动停止", () => {
  const station = {
    ...ZERO_COMPONENT_EFFECTS,
    waterLevelCmPerSecond: -0.12,
    humidityPctPerSecond: -0.02,
  };
  const wet = simulate({ waterLevelCm: 6, humidityPct: 80 }, 10, "cloudy", station);
  const baseline = simulate({ waterLevelCm: 6, humidityPct: 80 }, 10, "cloudy");
  assert.ok(wet.waterLevelCm < 5.0, "10 秒至少排掉 1.2cm");
  assert.ok(wet.waterLevelCm < baseline.waterLevelCm, "比自然蒸发排得更快");
  assert.ok(wet.humidityPct < baseline.humidityPct, "大量排水会带走田间湿度");

  const dry = simulate({ waterLevelCm: 1 }, 30, "cloudy", station);
  assert.equal(dry.waterLevelCm, 0);
});

test("global irrigation station raises water and humidity without exceeding field limits", () => {
  const manager = new FarmComponentManager();
  manager.attach(GLOBAL_PLOT_ID, COMPONENT_TYPES.IRRIGATION_STATION, {
    x: 36,
    z: -24,
    rotationY: 0,
  });

  const effects = manager.aggregateEffects("Terrace-R05-C05");
  const baseline = simulate({ waterLevelCm: 4, humidityPct: 55 }, 10, "sunny");
  const irrigated = simulate({ waterLevelCm: 4, humidityPct: 55 }, 10, "sunny", effects);
  assert.ok(irrigated.waterLevelCm > baseline.waterLevelCm);
  assert.ok(irrigated.humidityPct > baseline.humidityPct);

  const saturated = simulate({ waterLevelCm: 11.95, humidityPct: 99.5 }, 60, "sunny", effects);
  assert.ok(saturated.waterLevelCm <= 12);
  assert.ok(saturated.humidityPct <= 100);
});

test("grow light supplements weather light without changing other parameters", () => {
  const growLight = { ...ZERO_COMPONENT_EFFECTS, lightLuxDelta: 6000 };
  const baseline = simulate({}, 1, "sunny");
  const lit = simulate({}, 1, "sunny", growLight);
  assert.ok(lit.lightLux > baseline.lightLux);
  assert.equal(lit.waterLevelCm, baseline.waterLevelCm);
  assert.equal(lit.temperatureC, baseline.temperatureC);
  assert.equal(lit.humidityPct, baseline.humidityPct);
});

// P16: 排水边界 —— 到当前阶段安全下限自动停排，且单步不冲过下限
test("P16: 排水到达阶段下限后自动停止", () => {
  const pump = { ...ZERO_COMPONENT_EFFECTS, waterLevelCmPerSecond: -0.12 };

  // 远高于下限：速率不变
  assert.equal(limitDrainageToFloor(pump, 6, 3, 1).waterLevelCmPerSecond, -0.12);
  // 距下限 0.05cm、单步会排 0.12cm：速率被压到刚好停在下限
  const limited = limitDrainageToFloor(pump, 3.05, 3, 1);
  assert.ok(Math.abs(limited.waterLevelCmPerSecond - -0.05) < 1e-9);
  // 已到 / 低于下限：停止排水
  assert.equal(limitDrainageToFloor(pump, 3, 3, 1).waterLevelCmPerSecond, 0);
  assert.equal(limitDrainageToFloor(pump, 2.4, 3, 1).waterLevelCmPerSecond, 0);

  // 连续排水最终停在下限，而不是 0
  let waterLevelCm = 4;
  for (let i = 0; i < 30; i += 1) {
    const effects = limitDrainageToFloor(pump, waterLevelCm, 3, 1);
    waterLevelCm = Math.max(0, waterLevelCm + effects.waterLevelCmPerSecond);
  }
  assert.ok(Math.abs(waterLevelCm - 3) < 1e-9, `应停在下限 3cm，实际 ${waterLevelCm}`);

  // 增温等正向效果不受影响
  const heater = { ...ZERO_COMPONENT_EFFECTS, temperatureCPerSecond: 0.15 };
  assert.equal(limitDrainageToFloor(heater, 3, 3, 1), heater);
});

test("P6: 移除遮阳网后光照恢复到基准值", () => {
  const manager = new FarmComponentManager();
  const attached = manager.attach("Plain-R01-C01", COMPONENT_TYPES.SUNSHADE);

  let params = { ...baseParams };
  for (let i = 0; i < 5; i += 1) {
    params = update(1, {
      plotId: "Plain-R01-C01",
      weather: "sunny",
      componentEffects: manager.aggregateEffects("Plain-R01-C01"),
      params,
    });
  }
  assert.equal(params.lightLux, Math.round(18000 * 0.7));

  manager.remove(attached.component.id);
  const restored = update(1, {
    plotId: "Plain-R01-C01",
    weather: "sunny",
    componentEffects: manager.aggregateEffects("Plain-R01-C01"),
    params,
  });
  assert.equal(restored.lightLux, 18000);
});

test("P6: 光照下限保底 100 lux，绝不出现个位数读数", () => {
  const darkSnapshot = { ...buildSnapshotFromKey("sunny"), light: 0 };
  const result = update(1, {
    plotId: "Plain-R01-C01",
    weatherSnapshot: darkSnapshot,
    componentEffects: { ...ZERO_COMPONENT_EFFECTS },
    params: { ...baseParams },
  });
  assert.equal(result.lightLux, 100);
});

test("P8: 增温器智能恒温，32℃ 后不再叠加升温", () => {
  const heaterEffects = { ...ZERO_COMPONENT_EFFECTS, temperatureCPerSecond: 0.15 };
  const run = (temperatureC) => update(10, {
    plotId: "Plain-R01-C01",
    weather: "sunny",
    componentEffects: heaterEffects,
    params: { ...baseParams, temperatureC },
  });

  const belowComfort = run(29);
  assert.ok(belowComfort.temperatureC > 29, "30℃ 以下应正常加热");

  // 30~32℃ 线性收油：31℃ 的 10s 升温幅度明显小于 29℃
  const tapering = run(31);
  assert.ok(
    tapering.temperatureC - 31 < belowComfort.temperatureC - 29,
    "30~32℃ 应降低加热功率"
  );

  const aboveCutoff = run(32.5);
  assert.ok(aboveCutoff.temperatureC < 32.5, "超过 32℃ 应停止加热，只受环境回归影响");
});

test("P14: 水位/CO2/湿度达到上限后组件增量归零，不会溢出", () => {
  const irrigation = { ...ZERO_COMPONENT_EFFECTS, waterLevelCmPerSecond: 0.02, humidityPctPerSecond: 0.05 };
  const flooded = update(120, {
    plotId: "Plain-R01-C01",
    weather: "rain",
    componentEffects: irrigation,
    params: { ...baseParams, waterLevelCm: 11.9, humidityPct: 100 },
  });
  assert.ok(flooded.waterLevelCm <= 12, "灌溉不应把水位推过 12cm");
  assert.ok(flooded.humidityPct <= 100, "湿度不应超过 100%");

  const co2Supply = { ...ZERO_COMPONENT_EFFECTS, co2SupplyPpmPerSecond: 0.5 };
  const saturated = update(120, {
    plotId: "Plain-R01-C01",
    weather: "sunny",
    componentEffects: co2Supply,
    params: { ...baseParams, co2Ppm: 1999 },
  });
  assert.ok(saturated.co2Ppm <= 2000, "CO2 供给不应超过 2000ppm");
});

test("P14: 通风降温到环境基准即停止，温度始终在 0~45℃ 内", () => {
  const vent = {
    ...ZERO_COMPONENT_EFFECTS,
    co2VentilationRate: 0.02,
    temperatureCPerSecond: -0.02,
  };
  const cooled = update(120, {
    plotId: "Plain-R01-C01",
    weather: "sunny",
    componentEffects: vent,
    params: { ...baseParams, temperatureC: 10 },
  });
  assert.ok(cooled.temperatureC >= 10, "通风不应把温度压到环境基准（≥10℃）以下");
  assert.ok(cooled.temperatureC <= 45);

  const overheated = update(600, {
    plotId: "Plain-R01-C01",
    weather: "sunny",
    componentEffects: { ...ZERO_COMPONENT_EFFECTS, temperatureCPerSecond: 0.15 },
    params: { ...baseParams, temperatureC: 44.9 },
  });
  assert.ok(overheated.temperatureC <= 45, "温度不得超过 45℃ 硬上限");
});


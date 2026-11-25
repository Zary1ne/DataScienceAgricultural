import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPONENT_EFFECT_FIELDS,
  COMPONENT_EFFECTS_BY_TYPE,
  COMPONENT_TYPE_LABELS,
  COMPONENT_TYPES,
  ZERO_COMPONENT_EFFECTS,
} from "../src/scene/farmComponentRates.js";
import {
  FarmComponentManager,
  GLOBAL_PLOT_ID,
  sortComponentsForDispatch,
} from "../src/scene/farmComponents.js";
import { applyComponentEffects } from "../src/scene/plotSimulation.js";

// P15: 智能排水泵只作用于所属地块，效果为负向水位
test("drainage pump lowers water only for its own plot", () => {
  const manager = new FarmComponentManager();
  const { component: pump } = manager.attach("Plain-R01-C01", COMPONENT_TYPES.DRAINAGE);

  assert.equal(pump.type, COMPONENT_TYPES.DRAINAGE);
  assert.equal(COMPONENT_TYPE_LABELS[COMPONENT_TYPES.DRAINAGE], "智能排水泵");
  assert.equal(
    manager.aggregateEffects("Plain-R01-C01").waterLevelCmPerSecond,
    COMPONENT_EFFECTS_BY_TYPE[COMPONENT_TYPES.DRAINAGE].waterLevelCmPerSecond
  );
  assert.equal(manager.aggregateEffects("Plain-R01-C02").waterLevelCmPerSecond, 0);
});

test("active component effects are summed by plot into a complete fixed shape", () => {
  const manager = new FarmComponentManager();
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.IRRIGATION);
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.VENTILATION);
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.CO2_SUPPLY);
  manager.attach("Plain-R01-C02", COMPONENT_TYPES.IRRIGATION);

  const effects = manager.aggregateEffects("Plain-R01-C01");
  // P4: aggregateEffects shape now includes sunshadeCount
  const expectedKeys = [...COMPONENT_EFFECT_FIELDS, "sunshadeCount"].sort();
  assert.deepEqual(Object.keys(effects).sort(), expectedKeys);
  for (const field of COMPONENT_EFFECT_FIELDS) {
    const expected =
      COMPONENT_EFFECTS_BY_TYPE[COMPONENT_TYPES.IRRIGATION][field] +
      COMPONENT_EFFECTS_BY_TYPE[COMPONENT_TYPES.VENTILATION][field] +
      COMPONENT_EFFECTS_BY_TYPE[COMPONENT_TYPES.CO2_SUPPLY][field];
    assert.equal(effects[field], expected);
  }
  assert.equal(effects.sunshadeCount, 0);
  assert.deepEqual(
    manager.aggregateEffects("Plain-R01-C03"),
    { ...ZERO_COMPONENT_EFFECTS, sunshadeCount: 0 }
  );
});

test("display-only camera components aggregate to all-zero effects", () => {
  const manager = new FarmComponentManager();
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.CAMERA);

  assert.deepEqual(
    manager.aggregateEffects("Plain-R01-C01"),
    { ...ZERO_COMPONENT_EFFECTS, sunshadeCount: 0 }
  );
  assert.deepEqual(COMPONENT_EFFECTS_BY_TYPE[COMPONENT_TYPES.CAMERA], ZERO_COMPONENT_EFFECTS);
});

test("a plot can mount only one component of each type and removal clears its effect", () => {
  const manager = new FarmComponentManager();
  const first = manager.attach("Plain-R01-C01", COMPONENT_TYPES.IRRIGATION);
  const duplicate = manager.attach("Plain-R01-C01", COMPONENT_TYPES.IRRIGATION);

  assert.equal(first.ok, true);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "duplicate-type");
  assert.equal(
    manager.aggregateEffects("Plain-R01-C01").waterLevelCmPerSecond,
    COMPONENT_EFFECTS_BY_TYPE[COMPONENT_TYPES.IRRIGATION].waterLevelCmPerSecond
  );

  const removed = manager.remove(first.component.id);
  assert.equal(removed.ok, true);
  assert.deepEqual(
    manager.aggregateEffects("Plain-R01-C01"),
    { ...ZERO_COMPONENT_EFFECTS, sunshadeCount: 0 }
  );
});

// P4: 新增组件类型测试
test("P4: pestLamp and sunshade are valid types with correct labels", () => {
  assert.ok(COMPONENT_TYPES.PEST_LAMP);
  assert.ok(COMPONENT_TYPES.SUNSHADE);
  const labels = {
    [COMPONENT_TYPES.PEST_LAMP]: "杀虫灯",
    [COMPONENT_TYPES.SUNSHADE]: "遮阳网",
  };
  for (const [type, label] of Object.entries(labels)) {
    assert.ok(COMPONENT_TYPE_LABELS[type]);
    assert.match(COMPONENT_TYPE_LABELS[type], new RegExp(label));
  }
});

test("P4: sunshade increments sunshadeCount in aggregateEffects", () => {
  const manager = new FarmComponentManager();
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.SUNSHADE);
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.PEST_LAMP);
  const effects = manager.aggregateEffects("Plain-R01-C01");
  assert.equal(effects.sunshadeCount, 1, "一片启用遮阳网 → count=1");
  assert.equal(effects.waterLevelCmPerSecond, 0);

  // 不同 plot 再挂一片
  manager.attach("Plain-R01-C02", COMPONENT_TYPES.SUNSHADE);
  const twoPlots = manager.aggregateEffects("Plain-R01-C02");
  assert.equal(twoPlots.sunshadeCount, 1);
  assert.equal(manager.aggregateEffects("Plain-R01-C01").sunshadeCount, 1);

  // 未挂载 plot → 0
  const single = manager.aggregateEffects("Plain-R01-C99");
  assert.equal(single.sunshadeCount, 0, "未挂载遮阳网 → count=0");
});

test("P7: global components apply to every plot and keep their field placement", () => {
  const manager = new FarmComponentManager();
  const result = manager.attach(GLOBAL_PLOT_ID, COMPONENT_TYPES.CO2_SUPPLY, {
    x: 12,
    z: -20,
    rotationY: 0.5,
  });
  assert.equal(result.ok, true);
  assert.equal(result.component.plotId, GLOBAL_PLOT_ID);
  assert.deepEqual(result.component.placement, { x: 12, z: -20, rotationY: 0.5 });

  const expected = COMPONENT_EFFECTS_BY_TYPE[COMPONENT_TYPES.CO2_SUPPLY].co2SupplyPpmPerSecond;
  for (const plotId of ["Plain-R01-C01", "Terrace-R05-C05"]) {
    assert.equal(manager.aggregateEffects(plotId).co2SupplyPpmPerSecond, expected);
  }

  // 停用后不再对任何地块生效
  manager.setEnabled(result.component.id, false);
  assert.equal(manager.aggregateEffects("Plain-R01-C01").co2SupplyPpmPerSecond, 0);
});

test("P8: plot heater only warms its own plot; global heater warms all plots", () => {
  const manager = new FarmComponentManager();
  const heaterRate = COMPONENT_EFFECTS_BY_TYPE[COMPONENT_TYPES.HEATER].temperatureCPerSecond;

  manager.attach("Plain-R01-C01", COMPONENT_TYPES.HEATER);
  assert.equal(manager.aggregateEffects("Plain-R01-C01").temperatureCPerSecond, heaterRate);
  assert.equal(manager.aggregateEffects("Plain-R01-C02").temperatureCPerSecond, 0);

  // 大田外围的全局增温器才对全部地块生效
  manager.attach(GLOBAL_PLOT_ID, COMPONENT_TYPES.HEATER, { x: 40, z: -20, rotationY: 0 });
  assert.equal(manager.aggregateEffects("Plain-R01-C02").temperatureCPerSecond, heaterRate);
  // 本地 + 全局效果叠加
  assert.equal(
    manager.aggregateEffects("Plain-R01-C01").temperatureCPerSecond,
    heaterRate * 2
  );
});

// P16: 排涝泵站是全局设备 —— 放在大田外围，一次排水作用于全部地块
test("P16: global drainage station lowers water for every plot", () => {
  const manager = new FarmComponentManager();
  const { component: station } = manager.attach(
    GLOBAL_PLOT_ID,
    COMPONENT_TYPES.DRAINAGE_STATION,
    { x: 44, z: -22, rotationY: 0.6 }
  );

  assert.equal(station.type, COMPONENT_TYPES.DRAINAGE_STATION);
  assert.equal(COMPONENT_TYPE_LABELS[COMPONENT_TYPES.DRAINAGE_STATION], "排涝泵站");
  assert.deepEqual(station.placement, { x: 44, z: -22, rotationY: 0.6 });

  for (const plotId of ["Plain-R01-C01", "Plain-R05-C05", "Terrace-R05-C05"]) {
    assert.equal(
      manager.aggregateEffects(plotId).waterLevelCmPerSecond,
      COMPONENT_EFFECTS_BY_TYPE[COMPONENT_TYPES.DRAINAGE_STATION].waterLevelCmPerSecond
    );
  }

  // 与地块内的智能排水泵叠加
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.DRAINAGE);
  assert.ok(
    Math.abs(
      manager.aggregateEffects("Plain-R01-C01").waterLevelCmPerSecond -
        (COMPONENT_EFFECTS_BY_TYPE[COMPONENT_TYPES.DRAINAGE_STATION].waterLevelCmPerSecond +
          COMPONENT_EFFECTS_BY_TYPE[COMPONENT_TYPES.DRAINAGE].waterLevelCmPerSecond)
    ) < 1e-9
  );

  // 停用后全图不再排水
  manager.setEnabled(station.id, false);
  assert.equal(manager.aggregateEffects("Terrace-R05-C05").waterLevelCmPerSecond, 0);
});

test("global irrigation station raises water for every plot and stacks with local irrigation", () => {
  const manager = new FarmComponentManager();
  const { component: station } = manager.attach(
    GLOBAL_PLOT_ID,
    COMPONENT_TYPES.IRRIGATION_STATION,
    { x: 36, z: -24, rotationY: -0.4 }
  );

  assert.equal(station.type, COMPONENT_TYPES.IRRIGATION_STATION);
  assert.equal(COMPONENT_TYPE_LABELS[COMPONENT_TYPES.IRRIGATION_STATION], "全局灌溉站");
  assert.deepEqual(station.placement, { x: 36, z: -24, rotationY: -0.4 });

  const stationRate = COMPONENT_EFFECTS_BY_TYPE[COMPONENT_TYPES.IRRIGATION_STATION].waterLevelCmPerSecond;
  for (const plotId of ["Plain-R01-C01", "Plain-R05-C05", "Terrace-R05-C05"]) {
    assert.equal(manager.aggregateEffects(plotId).waterLevelCmPerSecond, stationRate);
  }

  manager.attach("Plain-R01-C01", COMPONENT_TYPES.IRRIGATION);
  const localRate = COMPONENT_EFFECTS_BY_TYPE[COMPONENT_TYPES.IRRIGATION].waterLevelCmPerSecond;
  assert.ok(
    Math.abs(
      manager.aggregateEffects("Plain-R01-C01").waterLevelCmPerSecond - (stationRate + localRate)
    ) < 1e-9
  );

  manager.setEnabled(station.id, false);
  assert.equal(manager.aggregateEffects("Terrace-R05-C05").waterLevelCmPerSecond, 0);
  assert.equal(manager.aggregateEffects("Plain-R01-C01").waterLevelCmPerSecond, localRate);
});

test("plot components keep the clicked placement instead of a fixed preset", () => {
  const manager = new FarmComponentManager();
  const { component } = manager.attach("Plain-R01-C01", COMPONENT_TYPES.IRRIGATION, {
    x: 2.4,
    z: -3.1,
    rotationY: 0.65,
  });

  assert.deepEqual(component.placement, { x: 2.4, z: -3.1, rotationY: 0.65 });
});

test("placed components can be moved by updating their placement", () => {
  const manager = new FarmComponentManager();
  const { component } = manager.attach("Plain-R01-C01", COMPONENT_TYPES.IRRIGATION, {
    x: 2.4,
    z: -3.1,
    rotationY: 0.65,
  });
  const moved = manager.updatePlacement(component.id, { x: -1.2, z: 2.8, rotationY: 1.1 });
  assert.equal(moved.ok, true);
  assert.deepEqual(component.placement, { x: -1.2, z: 2.8, rotationY: 1.1 });
});

test("environmental components auto-stop inside the current stage target range", () => {
  const manager = new FarmComponentManager();
  for (const type of [
    COMPONENT_TYPES.IRRIGATION,
    COMPONENT_TYPES.DRAINAGE,
    COMPONENT_TYPES.HEATER,
    COMPONENT_TYPES.VENTILATION,
    COMPONENT_TYPES.CO2_SUPPLY,
    COMPONENT_TYPES.SUNSHADE,
  ]) {
    manager.attach("Plain-R01-C01", type);
  }

  const safeEffects = manager.aggregateEffects("Plain-R01-C01", {
    stage: "tillering",
    params: {
      waterLevelCm: 4,
      temperatureC: 27.5,
      humidityPct: 72.5,
      co2Ppm: 600,
      lightLux: 20000,
      baseLightLux: 20000,
    },
  });
  assert.equal(safeEffects.waterLevelCmPerSecond, 0);
  assert.equal(safeEffects.temperatureCPerSecond, 0);
  assert.equal(safeEffects.co2SupplyPpmPerSecond, 0);
  assert.equal(safeEffects.sunshadeCount, 0);
});

test("automatic control activates only the devices needed by the environment", () => {
  const manager = new FarmComponentManager();
  const { component: irrigation } = manager.attach("Plain-R01-C01", COMPONENT_TYPES.IRRIGATION);
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.DRAINAGE);
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.HEATER);
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.CO2_SUPPLY);
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.SUNSHADE);

  manager.beginAutoControlCycle();
  const dryColdEffects = manager.aggregateEffects("Plain-R01-C01", {
    stage: "tillering",
    params: {
      waterLevelCm: 2,
      temperatureC: 18,
      humidityPct: 70,
      co2Ppm: 350,
      lightLux: 30000,
      baseLightLux: 30000,
    },
  });

  assert.ok(dryColdEffects.waterLevelCmPerSecond > 0);
  assert.ok(dryColdEffects.temperatureCPerSecond > 0);
  assert.ok(dryColdEffects.co2SupplyPpmPerSecond > 0);
  assert.equal(dryColdEffects.sunshadeCount, 1);
  assert.equal(manager.isActive(irrigation.id), true);

  manager.beginAutoControlCycle();
  const floodedHotEffects = manager.aggregateEffects("Plain-R01-C01", {
    stage: "tillering",
    params: {
      waterLevelCm: 7,
      temperatureC: 32,
      humidityPct: 70,
      co2Ppm: 500,
      lightLux: 10000,
      baseLightLux: 10000,
    },
  });
  assert.ok(floodedHotEffects.waterLevelCmPerSecond < 0);
  assert.equal(manager.isActive(irrigation.id), false);
});

test("humidifiers change humidity only and remain idle inside the target range", () => {
  const manager = new FarmComponentManager();
  const { component: humidifier } = manager.attach("Plain-R01-C01", COMPONENT_TYPES.HUMIDIFIER);

  manager.beginAutoControlCycle();
  const dryAir = manager.aggregateEffects("Plain-R01-C01", {
    stage: "tillering",
    params: { waterLevelCm: 4, temperatureC: 27, humidityPct: 58, co2Ppm: 500, lightLux: 18000 },
  });
  assert.ok(dryAir.humidityPctPerSecond > 0);
  assert.equal(dryAir.waterLevelCmPerSecond, 0);
  assert.equal(dryAir.temperatureCPerSecond, 0);
  assert.equal(dryAir.co2SupplyPpmPerSecond, 0);
  assert.equal(manager.isActive(humidifier.id), true);

  manager.beginAutoControlCycle();
  const safeAir = manager.aggregateEffects("Plain-R01-C01", {
    stage: "tillering",
    params: { waterLevelCm: 4, temperatureC: 27.5, humidityPct: 72.5, co2Ppm: 600, lightLux: 20000 },
  });
  assert.equal(safeAir.humidityPctPerSecond, 0);
  assert.equal(manager.isActive(humidifier.id), false);
});

test("automatic control moves values inside the safe range toward the stage midpoint", () => {
  const manager = new FarmComponentManager();
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.DRAINAGE);
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.HEATER);

  const effects = manager.aggregateEffects("Plain-R01-C01", {
    stage: "tillering",
    params: {
      waterLevelCm: 4.5,
      temperatureC: 26.5,
      humidityPct: 72.5,
      co2Ppm: 600,
      lightLux: 20000,
      baseLightLux: 20000,
    },
  });
  assert.ok(effects.waterLevelCmPerSecond < 0);
  assert.ok(effects.temperatureCPerSecond > 0);
});

test("global humidifier station affects every plot without changing other parameters", () => {
  const manager = new FarmComponentManager();
  manager.attach(GLOBAL_PLOT_ID, COMPONENT_TYPES.HUMIDIFIER_STATION, {
    x: 40,
    z: -24,
    rotationY: 0,
  });

  for (const plotId of ["Plain-R01-C01", "Terrace-R05-C05"]) {
    const effects = manager.aggregateEffects(plotId, {
      stage: "tillering",
      params: { waterLevelCm: 4, temperatureC: 27, humidityPct: 58, co2Ppm: 500, lightLux: 18000 },
    });
    assert.ok(effects.humidityPctPerSecond > 0);
    assert.equal(effects.waterLevelCmPerSecond, 0);
    assert.equal(effects.temperatureCPerSecond, 0);
    assert.equal(effects.co2SupplyPpmPerSecond, 0);
  }
});

test("grow lights add light only and dehumidifiers remove humidity only", () => {
  const manager = new FarmComponentManager();
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.GROW_LIGHT);
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.DEHUMIDIFIER);

  const effects = manager.aggregateEffects("Plain-R01-C01", {
    stage: "tillering",
    params: {
      waterLevelCm: 4,
      temperatureC: 27.5,
      humidityPct: 86,
      co2Ppm: 600,
      lightLux: 10000,
      baseLightLux: 10000,
    },
  });
  assert.ok(effects.lightLuxDelta > 0);
  assert.ok(effects.humidityPctPerSecond < 0);
  assert.equal(effects.waterLevelCmPerSecond, 0);
  assert.equal(effects.temperatureCPerSecond, 0);
  assert.equal(effects.co2SupplyPpmPerSecond, 0);
});

test("grow light and dehumidifier wait inside the midpoint deadband", () => {
  const manager = new FarmComponentManager();
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.GROW_LIGHT);
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.DEHUMIDIFIER);
  const effects = manager.aggregateEffects("Plain-R01-C01", {
    stage: "tillering",
    params: {
      waterLevelCm: 4,
      temperatureC: 27.5,
      humidityPct: 72.5,
      co2Ppm: 600,
      lightLux: 20000,
      baseLightLux: 20000,
    },
  });
  assert.equal(effects.lightLuxDelta, 0);
  assert.equal(effects.humidityPctPerSecond, 0);
});

test("dispatch order is deterministic and excludes display-only components", () => {
  const manager = new FarmComponentManager();
  const heater = manager.attach("Plain-R01-C01", COMPONENT_TYPES.HEATER).component;
  const drainage = manager.attach("Plain-R01-C01", COMPONENT_TYPES.DRAINAGE).component;
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.CAMERA);

  const ordered = manager.listDispatchComponents("Plain-R01-C01");
  assert.deepEqual(ordered.map((component) => component.type), [
    COMPONENT_TYPES.DRAINAGE,
    COMPONENT_TYPES.HEATER,
  ]);
  assert.deepEqual(
    sortComponentsForDispatch([heater, drainage]).map((component) => component.type),
    [COMPONENT_TYPES.DRAINAGE, COMPONENT_TYPES.HEATER]
  );
});

test("sequential component application sees the state produced by the previous component", () => {
  const manager = new FarmComponentManager();
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.HEATER);
  manager.attach("Plain-R01-C01", COMPONENT_TYPES.DRAINAGE);
  let params = {
    waterLevelCm: 4.5,
    temperatureC: 26.5,
    humidityPct: 72.5,
    co2Ppm: 600,
    lightLux: 20000,
    baseLightLux: 20000,
  };
  for (const component of manager.listDispatchComponents("Plain-R01-C01")) {
    const effects = manager.effectsForComponent("Plain-R01-C01", component, {
      stage: "tillering",
      params,
    });
    params = applyComponentEffects(params, effects, 1);
  }
  assert.ok(params.waterLevelCm < 4.5);
  assert.ok(params.temperatureC > 26.5);
});

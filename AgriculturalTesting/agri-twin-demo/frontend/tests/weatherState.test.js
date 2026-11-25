import assert from "node:assert/strict";
import test from "node:test";
import {
  WEATHER_KEYS,
  PRESET_KEYS,
  WEATHER_PRESETS,
  ACTUAL_WEATHER_DEFAULTS,
  buildSnapshotFromKey,
  buildSnapshotFromSliders,
  buildSnapshotFromActual,
  shouldShowRain,
  computeWindStrength,
  SLIDER_RANGES,
  WEATHER_CODE_MAP,
} from "../src/scene/weatherState.js";

function validSnapshotShape(s) {
  assert.ok(s, "snapshot is defined");
  assert.ok(WEATHER_KEYS.includes(s.key), `snapshot.key must be one of ${WEATHER_KEYS}`);
  for (const field of [
    "temperature", "humidity", "light", "wind", "rain",
    "rainfallCmPerSecond", "evaporationCmPerSecond", "co2VentilationRate",
    "ambientTemperatureC",
  ]) {
    assert.ok(Number.isFinite(s[field]), `snapshot.${field} must be finite number`);
  }
}

// —— 预设路径 ——

test("buildSnapshotFromKey returns valid snapshot for every preset key", () => {
  for (const k of PRESET_KEYS) {
    const s = buildSnapshotFromKey(k);
    validSnapshotShape(s);
    assert.equal(s.key, k);
    assert.equal(s.ambientTemperatureC, s.temperature);
  }
});

test("buildSnapshotFromKey falls back to sunny for unknown key", () => {
  const s = buildSnapshotFromKey("not-a-weather");
  validSnapshotShape(s);
  assert.equal(s.key, "sunny");
  // 物理参数与 sunny preset 一致
  assert.equal(s.temperature, WEATHER_PRESETS.sunny.temperature);
  assert.equal(s.humidity, WEATHER_PRESETS.sunny.humidity);
  assert.equal(s.light, WEATHER_PRESETS.sunny.light);
});

test("ACTUAL_WEATHER_DEFAULTS 是合理的白天降级快照", () => {
  // 天气 API 不可用时必须回落到白天状态，绝不能是 0 lux 的黑屏
  assert.equal(ACTUAL_WEATHER_DEFAULTS.key, "sunny");
  assert.equal(ACTUAL_WEATHER_DEFAULTS.temperature, 25);
  assert.equal(ACTUAL_WEATHER_DEFAULTS.light, 15000);
  assert.ok(ACTUAL_WEATHER_DEFAULTS.light >= 15000);
  assert.equal(ACTUAL_WEATHER_DEFAULTS.rain, 0);
});

test("preset rain snapshot has non-zero rainfallCmPerSecond", () => {
  const s = buildSnapshotFromKey("rain");
  assert.ok(s.rainfallCmPerSecond > 0);
  assert.equal(s.rainfallCmPerSecond, WEATHER_PRESETS.rain.rainfallCmPerSecond);
});

test("preset wind snapshot has high co2VentilationRate", () => {
  const s = buildSnapshotFromKey("wind");
  assert.ok(s.co2VentilationRate > WEATHER_PRESETS.sunny.co2VentilationRate);
});

// —— 滑块/custom 路径 ——

test("buildSnapshotFromSliders returns valid snapshot with key=custom", () => {
  const s = buildSnapshotFromSliders({
    temperature: 25, humidity: 80, waterLevelCm: 5, light: 12000, wind: 5, rain: 5,
  });
  validSnapshotShape(s);
  assert.equal(s.key, "custom");
  assert.equal(s.temperature, 25);
  assert.equal(s.humidity, 80);
  assert.equal(s.waterLevelCm, 5);
  assert.equal(s.light, 12000);
  assert.equal(s.wind, 5);
  assert.equal(s.rain, 5);
  assert.equal(s.ambientTemperatureC, 25);
});

test("buildSnapshotFromSliders clamps out-of-range values into SLIDER_RANGES", () => {
  const s = buildSnapshotFromSliders({
    temperature: 1000, humidity: -10, waterLevelCm: 20, light: 99999, wind: -5, rain: 200,
  });
  validSnapshotShape(s);
  assert.equal(s.temperature, SLIDER_RANGES.temperature.max);   // 45
  assert.equal(s.humidity, SLIDER_RANGES.humidity.min);         // 0
  assert.equal(s.waterLevelCm, SLIDER_RANGES.waterLevelCm.max); // 12
  assert.equal(s.light, SLIDER_RANGES.light.max);               // 30000
  assert.equal(s.wind, SLIDER_RANGES.wind.min);                // 0
  assert.equal(s.rain, SLIDER_RANGES.rain.max);                 // 100
});

test("buildSnapshotFromSliders defaults to sunny preset fields when input is empty", () => {
  const s = buildSnapshotFromSliders();
  validSnapshotShape(s);
  assert.equal(s.key, "custom");
  assert.equal(s.temperature, WEATHER_PRESETS.sunny.temperature);
  assert.equal(s.humidity, WEATHER_PRESETS.sunny.humidity);
  assert.equal(s.waterLevelCm, 2);
});

test("buildSnapshotFromSliders does not mutate its input", () => {
  const raw = { temperature: 22, humidity: 77 };
  const before = JSON.stringify(raw);
  buildSnapshotFromSliders(raw);
  assert.equal(JSON.stringify(raw), before);
});

// —— 实际天气路径 ——

test("buildSnapshotFromActual maps Open-Meteo current response into valid snapshot", () => {
  // Open-Meteo wind_speed_10m is km/h → 8 km/h ≈ 2.2 m/s
  const raw = {
    temperature_2m: 26.5,
    relative_humidity_2m: 68,
    wind_speed_10m: 8,
    precipitation: 0.2,
    weather_code: 1,
    cloudcover: 30,
  };
  const s = buildSnapshotFromActual(raw);
  validSnapshotShape(s);
  assert.equal(s.temperature, 26.5);
  assert.equal(s.humidity, 68);
  assert.ok(s.wind > 1 && s.wind < 3);         // km/h → m/s
  assert.equal(s.rain, 0.2);
  assert.ok(s.light > 0 && s.light < 30000);
  assert.equal(s.ambientTemperatureC, 26.5);
  // weather_code 1 → sunny
  assert.equal(s.key, "sunny");
});

test("buildSnapshotFromActual derives 'rain' key from weather_code 65 (heavy rain)", () => {
  const raw = {
    temperature_2m: 19,
    relative_humidity_2m: 95,
    wind_speed_10m: 15,
    precipitation: 25,
    weather_code: 65,
  };
  const s = buildSnapshotFromActual(raw);
  assert.equal(s.key, "rain");
  assert.ok(s.rainfallCmPerSecond > 0);
  assert.ok(s.light < 8000);   // 雨天光照被 cloudcover + rain 联合压低
});

test("buildSnapshotFromActual handles missing fields by falling back to sunny preset", () => {
  const s = buildSnapshotFromActual({});
  validSnapshotShape(s);
  // 缺失的物理参数用 sunny preset 回退
  assert.equal(s.temperature, WEATHER_PRESETS.sunny.temperature);
  assert.equal(s.humidity, WEATHER_PRESETS.sunny.humidity);
  assert.equal(s.wind, WEATHER_PRESETS.sunny.wind);
  // light 由默认 cloudcover=50 估算 → 约 10500，在合理范围内
  assert.ok(s.light >= 8000 && s.light <= 13000);
});

// —— 降雨换算 ——

test("buildSnapshotFromActual rainfallCmPerSecond conversion: 36 mm/h → 0.001 cm/s", () => {
  // 36 mm/h = 0.036 cm/h = 0.00001 cm/s... wait, let's recalc.
  // 1 mm/h = 0.1 cm/h = 0.1 / 3600 cm/s = 1 / 36000 cm/s ≈ 0.0000278 cm/s
  // 36 mm/h = 36 / 36000 = 0.001 cm/s  ✓
  const s = buildSnapshotFromActual({
    temperature_2m: 20, relative_humidity_2m: 90,
    wind_speed_10m: 10, precipitation: 36, weather_code: 65,
  });
  assert.ok(Math.abs(s.rainfallCmPerSecond - 0.001) < 0.00001,
    `expected ~0.001 cm/s, got ${s.rainfallCmPerSecond}`);
});

test("buildSnapshotFromSliders rainfallCmPerSecond conversion: 0 mm/h → 0", () => {
  const s = buildSnapshotFromSliders({ rain: 0 });
  assert.equal(s.rainfallCmPerSecond, 0);
});

// —— 视觉阈值 ——

test("shouldShowRain triggers above 0.5 mm/h, not below", () => {
  assert.equal(shouldShowRain(buildSnapshotFromKey("sunny")), false);
  assert.equal(shouldShowRain(buildSnapshotFromKey("rain")), true);  // 12 mm/h
  assert.equal(
    shouldShowRain(buildSnapshotFromSliders({ rain: 0 })),
    false
  );
  assert.equal(
    shouldShowRain(buildSnapshotFromSliders({ rain: 0.51 })),
    true
  );
  assert.equal(shouldShowRain(null), false);
});

test("computeWindStrength returns non-zero baseline for calm, 1.0 for gale", () => {
  assert.ok(computeWindStrength(buildSnapshotFromKey("sunny")) >= 0.1);
  assert.ok(computeWindStrength({ wind: 0 }) >= 0.1);          // 有 baseline 0.1
  assert.ok(computeWindStrength({ wind: 15 }) >= 0.95);
  assert.ok(computeWindStrength({ wind: 12 }) > 0.7);
  assert.equal(computeWindStrength(null), 0.24);
});

// —— WEATHER_CODE_MAP 覆盖 ——

test("WEATHER_CODE_MAP maps rainy codes to 'rain' key", () => {
  const rainyCodes = [51, 55, 61, 63, 65, 80, 82, 95, 96, 99];
  for (const c of rainyCodes) {
    assert.equal(WEATHER_CODE_MAP[c], "rain", `code ${c} → rain`);
  }
});

test("WEATHER_CODE_MAP maps wind codes to valid key (no 'wind' preset — uses sunny/cloudy/rain)", () => {
  // Open-Meteo 没有单独的 "wind" code —— 风的物理参数由 wind_speed_10m 字段承载，
  // 预设 key "wind" 仅用于模拟天气 UI。实际天气 key 只是视觉标签。
  assert.ok(Object.values(WEATHER_CODE_MAP).every((k) =>
    PRESET_KEYS.includes(k)
  ));
});

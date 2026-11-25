import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PLOT_PARAMS, PlotState } from "../src/scene/regionConfigs.ts";

function createMaturePlot() {
  const state = new PlotState("Plain-R01-C01", {
    waterLevelCm: 4,
    co2Ppm: 420,
    temperatureC: 5,
    humidityPct: 80,
    lightLux: 1200,
    growthStage: "maturity",
    healthPct: 90,
  });
  state.physiologicalProgress = 90;
  state.simulatedDay = 125;
  state.currentStage = "maturity";
  state.growthRatePct = 0;
  state.stressed = true;
  state.growthStalled = true;
  return state;
}

test("custom weather sync recalculates growth immediately instead of waiting for interpolation", () => {
  const state = createMaturePlot();

  state.syncEnvironmentSnapshot({ temperature: 25, humidity: 55, waterLevelCm: 1, light: 18000 });

  assert.equal(state.params.temperatureC, 25);
  assert.equal(state.params.humidityPct, 55);
  assert.equal(state.params.waterLevelCm, 1);
  assert.equal(state.params.lightLux, 18000);
  assert.equal(state.growthStalled, false);
  assert.ok(state.growthRatePct > 0);
});

test("custom weather still marks stalls immediately for dangerous values", () => {
  const state = createMaturePlot();

  state.syncEnvironmentSnapshot({ temperature: 5, humidity: 80, light: 1200 });

  assert.equal(state.params.temperatureC, 5);
  assert.equal(state.growthStalled, true);
  assert.equal(state.growthRatePct, 0);
});

test("initial plot parameters use the germination-stage optimal midpoint", () => {
  assert.equal(DEFAULT_PLOT_PARAMS.waterLevelCm, 2);
  assert.equal(DEFAULT_PLOT_PARAMS.co2Ppm, 600);
  assert.equal(DEFAULT_PLOT_PARAMS.temperatureC, 30);
  assert.equal(DEFAULT_PLOT_PARAMS.humidityPct, 82.5);
  assert.equal(DEFAULT_PLOT_PARAMS.lightLux, 14000);
  assert.equal(DEFAULT_PLOT_PARAMS.healthPct, 100);
  assert.equal(DEFAULT_PLOT_PARAMS.growthStage, "germination");
});

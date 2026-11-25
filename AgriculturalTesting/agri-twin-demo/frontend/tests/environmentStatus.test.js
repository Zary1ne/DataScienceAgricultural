import assert from "node:assert/strict";
import test from "node:test";
import {
  environmentMetricStatus,
  metricStatusForRange,
} from "../src/scene/environmentStatus.js";

test("environment metrics use the same amber deviation and red danger rules", () => {
  const warning = environmentMetricStatus("temperatureC", 23, "tillering");
  assert.equal(warning.tone, "warning");
  assert.match(warning.reason, /低于分蘖期适宜范围/);

  const danger = environmentMetricStatus("temperatureC", 8, "tillering");
  assert.equal(danger.tone, "danger");
  assert.match(danger.reason, /低于危险阈值/);
  assert.match(danger.advice, /增温/);
});

test("safe environments are normal and outside-danger values are red in both directions", () => {
  assert.equal(environmentMetricStatus("waterLevelCm", 4, "tillering").tone, "normal");
  assert.equal(environmentMetricStatus("waterLevelCm", 11, "tillering").tone, "danger");
  assert.equal(environmentMetricStatus("co2Ppm", 280, "tillering").tone, "danger");
});

test("custom fixed ranges follow the same severity contract", () => {
  const status = metricStatusForRange(
    32,
    [16, 30],
    [10, 35],
    { stageLabel: "土壤温度", unit: "°C", digits: 1 }
  );
  assert.equal(status.tone, "warning");
  assert.equal(status.direction, "high");
});

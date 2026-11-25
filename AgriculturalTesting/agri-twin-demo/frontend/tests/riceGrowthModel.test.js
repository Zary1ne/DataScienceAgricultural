import test from "node:test";
import assert from "node:assert/strict";
import {
  BASE_PROGRESS_PER_DAY,
  DEMO_SECONDS_PER_DAY,
  STAGE_PROFILES,
  calculateGrowth,
  optimalStageValues,
  progressToDay,
  stageForProgress,
} from "../src/scene/riceGrowthModel.js";

// 发芽/幼苗期都适宜的温光水肥环境
const IDEAL_ENV = {
  waterLevelCm: 2,
  temperatureC: 29,
  humidityPct: 80,
  co2Ppm: 500,
  lightLux: 15000,
};

test("阶段边界：0~100 生理进度解析正确", () => {
  assert.equal(stageForProgress(0), "germination");
  assert.equal(stageForProgress(7), "germination");
  assert.equal(stageForProgress(8), "seedling");
  assert.equal(stageForProgress(25), "tillering");
  assert.equal(stageForProgress(50), "jointing");
  assert.equal(stageForProgress(65), "heading");
  assert.equal(stageForProgress(80), "filling");
  assert.equal(stageForProgress(90), "maturity");
  assert.equal(stageForProgress(100), "maturity");
});

test("阶段进度区间与日历天一一对应", () => {
  assert.deepEqual(STAGE_PROFILES.germination.dayRange, [1, 10]);
  assert.deepEqual(STAGE_PROFILES.filling.dayRange, [101, 120]);
  assert.deepEqual(STAGE_PROFILES.maturity.dayRange, [121, 140]);
  assert.equal(progressToDay(0), 1);
  assert.equal(progressToDay(100), 140);
  // 分蘖期 3~5cm 水位、灌浆期 2~4cm、成熟期晒田 0~1cm
  assert.deepEqual(STAGE_PROFILES.tillering.ideal.waterLevelCm, [3, 5]);
  assert.deepEqual(STAGE_PROFILES.filling.ideal.waterLevelCm, [2, 4]);
  assert.deepEqual(STAGE_PROFILES.maturity.ideal.waterLevelCm, [0, 1]);
});

test("适宜环境下 10 次 tick 持续推进并跨越阶段", () => {
  let state = { physiologicalProgress: 0, simulatedDay: 1 };
  let growth;
  let crossedStage = false;
  for (let i = 0; i < 10; i += 1) {
    growth = calculateGrowth(state, IDEAL_ENV, 2); // 每次 2 个模拟日
    if (growth.stageChanged) crossedStage = true;
    state = {
      physiologicalProgress: growth.physiologicalProgress,
      simulatedDay: growth.simulatedDay,
    };
  }
  const expected = 20 * BASE_PROGRESS_PER_DAY;
  assert.ok(Math.abs(growth.physiologicalProgress - expected) < 0.01, "进度应按基准速率推进");
  assert.equal(crossedStage, true, "过程中应至少跨过一个阶段");
  assert.equal(growth.stage, "seedling", "20 天后应进入幼苗期");
  assert.equal(growth.growthRatePct, 100);
  assert.equal(growth.stalled, false);
  assert.equal(growth.simulatedDay, 21);
});

test("极低温度 5℃：连续 10 次 tick 进度不增长且返回受阻", () => {
  let state = { physiologicalProgress: 0, simulatedDay: 1 };
  let growth;
  for (let i = 0; i < 10; i += 1) {
    growth = calculateGrowth(
      state,
      { ...IDEAL_ENV, temperatureC: 5 },
      2
    );
    state = {
      physiologicalProgress: growth.physiologicalProgress,
      simulatedDay: growth.simulatedDay,
    };
  }
  assert.equal(growth.physiologicalProgress, 0, "极寒应完全停滞");
  assert.equal(growth.growthRatePct, 0);
  assert.equal(growth.growthFactor, 0);
  assert.equal(growth.stalled, true);
  assert.equal(growth.stressed, true);
  assert.equal(growth.stressReason, "低温");
  assert.equal(growth.stressDetail?.key, "temperatureC");
  assert.match(growth.stressDetail?.text || "", /适宜温度/);
  assert.equal(growth.stage, "germination");
  assert.equal(growth.simulatedDay, 21, "日历日照常推进");
});

test("受阻原因归因：成熟期水位过高 → 积水", () => {
  const growth = calculateGrowth(
    { physiologicalProgress: 90, simulatedDay: 130 },
    { ...IDEAL_ENV, waterLevelCm: 6 },
    1
  );
  assert.equal(growth.stage, "maturity");
  assert.equal(growth.stressReason, "积水");
  assert.equal(growth.stressDetail?.key, "waterLevelCm");
  assert.deepEqual(growth.stressDetail?.ideal, [0, 1]);
});

test("环境完全适宜时不返回受阻原因", () => {
  const growth = calculateGrowth(
    { physiologicalProgress: 30, simulatedDay: 45 },
    { waterLevelCm: 4, temperatureC: 27, humidityPct: 72, co2Ppm: 600, lightLux: 20000 },
    1
  );
  assert.equal(growth.growthRatePct, 100);
  assert.equal(growth.stressReason, null);
  assert.equal(growth.stressDetail, null);
});

test("偏离适宜区只减速、不停滞", () => {
  const growth = calculateGrowth(
    { physiologicalProgress: 30, simulatedDay: 40 },
    { ...IDEAL_ENV, temperatureC: 20 },
    1
  );
  assert.ok(growth.growthFactor > 0 && growth.growthFactor < 1);
  assert.equal(growth.stressed, true);
  assert.equal(growth.stalled, false);
  assert.equal(growth.stage, "tillering");
});

test("演示时间轴：140 天压缩到 70 秒（1x 2 天/秒）", () => {
  assert.ok(Math.abs(DEMO_SECONDS_PER_DAY - 70 / 140) < 1e-9);
  assert.equal(Math.round(DEMO_SECONDS_PER_DAY * 140), 70);
});

test("optimal stage values use the midpoint of every suitable range", () => {
  assert.deepEqual(optimalStageValues("germination"), {
    waterLevelCm: 2,
    co2Ppm: 600,
    temperatureC: 30,
    humidityPct: 82.5,
    lightLux: 14000,
  });
});

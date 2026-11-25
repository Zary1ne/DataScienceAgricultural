import assert from "node:assert/strict";
import test from "node:test";
import {
  areGrainsStageVisible,
  createPlotPlantLayout,
  createVisibilityMask,
  getRicePartVisibility,
  getPlotInstanceRange,
  hash01,
  isPanicleStageVisible,
  maturityCompactAt,
  maturityVisibleCountAt,
  MAX_PLANT_COUNT,
  PLANTS_PER_PLOT,
  RICE_PART_FACE_BUDGET,
  RICE_TRIANGLES_PER_PLANT,
  riceHeightScaleAt,
  VISIBLE_PLANT_COUNT,
} from "../src/scene/riceBatchMath.js";
import {
  createProceduralRicePlant,
  PROCEDURAL_RICE_MODEL_KEY,
} from "../src/scene/proceduralRiceFactory.js";

test("plant face budget is 390 triangles by component", () => {
  assert.equal(PROCEDURAL_RICE_MODEL_KEY, "rice-programmatic-v1");
  assert.deepEqual(RICE_PART_FACE_BUDGET, {
    seed: 36,
    mainStem: 10,
    tillerStems: 64,
    leaves: 120,
    panicle: 80,
    grains: 80,
  });
  assert.equal(RICE_TRIANGLES_PER_PLANT, 390);

  const prototype = createProceduralRicePlant();
  const measured = {};
  prototype.traverse((object) => {
    if (object.isMesh && object.userData.batchPartKey) {
      measured[object.userData.batchPartKey] = object.geometry.attributes.position.count / 3;
    }
  });
  assert.deepEqual(measured, RICE_PART_FACE_BUDGET);
});

test("rice morphology reveals seed, leaves, tillers, panicles and grains by stage", () => {
  const seed = getRicePartVisibility(0);
  assert.equal(seed.seed, true);
  assert.equal(seed.mainStem, false);
  assert.equal(seed.leaves, false);

  const seedling = getRicePartVisibility(15);
  assert.equal(seedling.seed, false);
  assert.equal(seedling.mainStem, true);
  assert.equal(seedling.leaves, true);
  assert.equal(seedling.tillerStems, false);

  const tillering = getRicePartVisibility(32);
  assert.equal(tillering.tillerStems, true);
  assert.equal(tillering.panicle, false);

  const heading = getRicePartVisibility(60);
  assert.equal(heading.panicle, true);
  assert.equal(heading.grains, false);

  const maturity = getRicePartVisibility(95);
  assert.equal(maturity.grains, true);
});

test("maturity compact factor ramps in near harvest", () => {
  assert.equal(maturityCompactAt(80), 0);
  assert.ok(maturityCompactAt(94) > 0.2);
  assert.equal(maturityCompactAt(100), 1);
  assert.equal(maturityVisibleCountAt(VISIBLE_PLANT_COUNT, 80), VISIBLE_PLANT_COUNT);
  assert.equal(maturityVisibleCountAt(VISIBLE_PLANT_COUNT, 100), PLANTS_PER_PLOT);
  assert.ok(riceHeightScaleAt(100) > 1.65);
  assert.ok(riceHeightScaleAt(100) < 1.75);
  assert.ok(riceHeightScaleAt(100) > riceHeightScaleAt(60));
});

test("plot ranges are stable, contiguous, and cover all instance slots", () => {
  assert.deepEqual(getPlotInstanceRange(0), { start: 0, end: PLANTS_PER_PLOT });
  assert.deepEqual(getPlotInstanceRange(1), {
    start: PLANTS_PER_PLOT,
    end: PLANTS_PER_PLOT * 2,
  });
  assert.deepEqual(getPlotInstanceRange(49), {
    start: MAX_PLANT_COUNT - PLANTS_PER_PLOT,
    end: MAX_PLANT_COUNT,
  });
  assert.equal(MAX_PLANT_COUNT, 50 * PLANTS_PER_PLOT);
  assert.throws(() => getPlotInstanceRange(50), RangeError);
});

test("hash and plant layout are deterministic and plot-specific", () => {
  assert.equal(hash01("Plain-R01-C01", 4, "height"), hash01("Plain-R01-C01", 4, "height"));
  assert.notEqual(hash01("Plain-R01-C01", 4, "height"), hash01("Plain-R01-C02", 4, "height"));

  const first = createPlotPlantLayout("Plain-R01-C01", PLANTS_PER_PLOT);
  const repeated = createPlotPlantLayout("Plain-R01-C01", PLANTS_PER_PLOT);
  const otherPlot = createPlotPlantLayout("Plain-R01-C02", PLANTS_PER_PLOT);
  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first, otherPlot);
  assert.equal(createPlotPlantLayout("Plain-R01-C01", 96, 9, 9).length, 96);

  const minDistanceSquared = 0.3 ** 2;
  for (let i = 0; i < first.length; i += 1) {
    // P3: 植株铺满整格（左右各留 0.2m 田埂边距）
    assert.ok(first[i].x >= -4.8 && first[i].x <= 4.8);
    assert.ok(first[i].z >= -4.8 && first[i].z <= 4.8);
    for (let j = i + 1; j < first.length; j += 1) {
      const dx = first[i].x - first[j].x;
      const dz = first[i].z - first[j].z;
      assert.ok(dx * dx + dz * dz >= minDistanceSquared);
    }
  }
});

test("density masks select an exact deterministic subset", () => {
  const first = createVisibilityMask("Plain-R01-C01", VISIBLE_PLANT_COUNT);
  const repeated = createVisibilityMask("Plain-R01-C01", VISIBLE_PLANT_COUNT);
  const otherPlot = createVisibilityMask("Plain-R01-C02", VISIBLE_PLANT_COUNT);
  assert.equal(
    first.reduce((sum, visible) => sum + visible, 0),
    VISIBLE_PLANT_COUNT
  );
  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first, otherPlot);
  assert.ok(first.every((visible) => visible === 0 || visible === 1));
});

test("panicles and grains appear only in their configured growth stages", () => {
  assert.equal(isPanicleStageVisible("tillering"), false);
  assert.equal(isPanicleStageVisible("heading"), true);
  assert.equal(areGrainsStageVisible("heading"), false);
  assert.equal(areGrainsStageVisible("filling"), true);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  estimatePlotYieldKgPerMu,
  SETTLEMENT_BASE_YIELD_KG_PER_MU,
  summarizePlotSettlement,
} from "../src/scene/plotSettlement.js";

function plot(overrides = {}) {
  return {
    params: { healthPct: 90 },
    physiologicalProgress: 100,
    growthRatePct: 100,
    stressed: false,
    growthStalled: false,
    ...overrides,
  };
}

test("ideal harvest settlement keeps the base yield and health factor", () => {
  const summary = summarizePlotSettlement({ p1: plot(), p2: plot() });
  assert.equal(summary.averageHealthPct, 90);
  assert.equal(summary.blockedPlotRatio, 0);
  assert.equal(
    summary.estimatedYieldKgPerMu,
    Math.round(SETTLEMENT_BASE_YIELD_KG_PER_MU * 0.9)
  );
});

test("yield responds to growth rate, progress, stress and stalled states", () => {
  const ideal = estimatePlotYieldKgPerMu(plot());
  const slowed = estimatePlotYieldKgPerMu(plot({ growthRatePct: 45 }));
  const stressed = estimatePlotYieldKgPerMu(plot({ growthRatePct: 45, stressed: true }));
  const stalled = estimatePlotYieldKgPerMu(plot({ growthRatePct: 0, growthStalled: true }));

  assert.ok(slowed < ideal);
  assert.ok(stressed < slowed);
  assert.ok(stalled < stressed);
});

test("blocked ratio follows the current refreshed plot states", () => {
  const summary = summarizePlotSettlement({
    p1: plot({ stressed: true, growthRatePct: 50 }),
    p2: plot({ growthStalled: true, growthRatePct: 0 }),
    p3: plot(),
    p4: plot(),
  });
  assert.equal(summary.blockedPlotRatio, 0.5);
  assert.equal(summary.averageProgressPct, 100);
  assert.equal(summary.averageGrowthRatePct, 62.5);
});

test("empty settlement is explicit instead of reusing a stale yield", () => {
  assert.deepEqual(summarizePlotSettlement({}), {
    averageHealthPct: 100,
    averageProgressPct: 0,
    averageGrowthRatePct: 0,
    blockedPlotRatio: 0,
    estimatedYieldKgPerMu: 0,
  });
});

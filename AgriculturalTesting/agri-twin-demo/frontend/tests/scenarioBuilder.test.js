import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCENARIO_LIMITS,
  buildScenarioRegions,
  normalizeScenarioGroups,
} from '../src/scene/scenarioBuilder.js';

test('scenario limits cap each group and the total plot count', () => {
  const groups = normalizeScenarioGroups([
    { terrainKey: 'plain', plotCount: 40, areaMu: 1 },
    { terrainKey: 'hill', plotCount: 40, areaMu: 0.5 },
  ]);
  assert.equal(groups[0].plotCount, SCENARIO_LIMITS.maxPlotsPerGroup);
  assert.equal(groups[1].plotCount, SCENARIO_LIMITS.maxPlotsPerGroup);
  assert.equal(groups.reduce((sum, group) => sum + group.plotCount, 0), SCENARIO_LIMITS.maxTotalPlots);
});

test('scenario builder generates unique plots and two centered regions', () => {
  const built = buildScenarioRegions([
    { id: 'a', terrainKey: 'plain', plotCount: 25, areaMu: 1 },
    { id: 'b', terrainKey: 'hill', plotCount: 25, areaMu: 0.5 },
  ]);
  assert.equal(built.totalPlots, 50);
  assert.equal(built.regions.length, 2);
  const ids = built.regions.flatMap((region) => region.cells.map((cell) => cell.id));
  assert.equal(new Set(ids).size, 50);
  assert.ok(built.regions[0].originXZ.x < built.regions[1].originXZ.x);
  assert.ok(
    built.regions[1].originXZ.x - built.regions[0].originXZ.x >=
      (built.regions[0].totalWidthM + built.regions[1].totalWidthM) / 2 + 40
  );
  assert.ok(built.regions[0].cells.every((cell) => cell.widthM === 10));
  assert.ok(built.regions[1].cells.every((cell) => cell.widthM < 8));
});

test('entering no plots produces an empty scene preview', () => {
  const built = buildScenarioRegions([{ terrainKey: 'plain', plotCount: 0, areaMu: 1 }]);
  assert.equal(built.totalPlots, 0);
  assert.deepEqual(built.regions, []);
});

test('every terrain uses a maximum 5x5 grid, including 25-plot scenarios', () => {
  for (const terrainKey of ['plain', 'hill', 'south', 'mountain', 'east']) {
    for (const plotCount of [21, 24, 25]) {
      const built = buildScenarioRegions([{ terrainKey, plotCount, areaMu: 1 }]);
      assert.equal(built.regions[0].cells.length, plotCount);
      assert.ok(built.regions[0].rows <= 5);
      assert.ok(built.regions[0].columns <= 5);
      assert.equal(new Set(built.regions[0].cells.map((cell) => cell.id)).size, plotCount);
    }
  }
});

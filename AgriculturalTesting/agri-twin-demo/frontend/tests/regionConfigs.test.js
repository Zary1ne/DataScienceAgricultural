import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REGION_CONFIGS,
  REGION_CONFIG_BY_KEY,
  createInitialPlotStates,
} from '../src/scene/regionConfigs.ts';

test('five regions expose distinct terrain layouts', () => {
  assert.equal(REGION_CONFIGS.length, 5);
  assert.deepEqual(
    REGION_CONFIGS.map((region) => region.key),
    ['plain', 'hill', 'south', 'mountain', 'east']
  );
  assert.deepEqual(
    REGION_CONFIGS.map((region) => region.cells.length),
    [25, 15, 10, 1, 8]
  );
  assert.equal(new Set(REGION_CONFIGS.map((region) => region.terrain)).size, 5);
});

test('region cells have deterministic ids, dimensions and elevations', () => {
  const ids = new Set();
  for (const region of REGION_CONFIGS) {
    assert.equal(REGION_CONFIG_BY_KEY[region.key], region);
    for (const cell of region.cells) {
      assert.ok(!ids.has(cell.id), `duplicate plot id ${cell.id}`);
      ids.add(cell.id);
      assert.ok(cell.widthM > 0);
      assert.ok(cell.depthM > 0);
      assert.ok(Number.isFinite(cell.elevationM));
    }
  }
  assert.equal(Object.keys(createInitialPlotStates()).length, ids.size);
});

test('selected region bounds are centered around the shared scene origin', () => {
  for (const region of REGION_CONFIGS) {
    assert.ok(region.totalWidthM > 0);
    assert.ok(region.totalDepthM > 0);
    assert.ok(region.viewRadiusM > 0);
    assert.ok(Math.abs(region.sceneCenterXZ.x) < 2);
    assert.ok(Math.abs(region.sceneCenterXZ.z) < 2);
  }
});

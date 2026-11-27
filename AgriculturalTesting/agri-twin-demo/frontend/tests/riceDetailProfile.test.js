import test from 'node:test';
import assert from 'node:assert/strict';
import { getRiceDetailProfile } from '../src/scene/riceInstanceBatches.js';
import { PLANTS_PER_PLOT } from '../src/scene/riceBatchMath.js';

test('fewer plots receive denser rice rendering and longer LOD distance', () => {
  const plain = getRiceDetailProfile(25);
  const hill = getRiceDetailProfile(15);
  const mountain = getRiceDetailProfile(1);

  assert.equal(plain.nearCount, 100);
  assert.ok(hill.nearCount > plain.nearCount);
  assert.ok(mountain.nearCount > hill.nearCount);
  assert.ok(mountain.midCount > plain.midCount);
  assert.ok(mountain.farCount > plain.farCount);
  assert.ok(mountain.midDistance > plain.midDistance);
  assert.ok(mountain.farDistance > plain.farDistance);
  assert.ok(mountain.nearCount <= PLANTS_PER_PLOT);
});

test('detail profile is clamped for any plot count', () => {
  const tiny = getRiceDetailProfile(0);
  const huge = getRiceDetailProfile(100);
  assert.ok(tiny.nearCount <= PLANTS_PER_PLOT);
  assert.ok(tiny.farCount <= PLANTS_PER_PLOT);
  assert.equal(huge.detailFactor, 1);
});

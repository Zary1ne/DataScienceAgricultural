import test from "node:test";
import assert from "node:assert/strict";

import {
  SOIL_REGION_PROFILES,
  getSoilRegionProfile,
} from "../src/scene/soilProfiles.js";

const REGION_KEYS = ["plain", "hill", "south", "mountain", "east"];

test("every Hunan region exposes four distinct soil horizons", () => {
  for (const regionKey of REGION_KEYS) {
    const profile = getSoilRegionProfile(regionKey);
    assert.equal(profile.layers.length, 4);
    assert.equal(new Set(profile.layers.map((layer) => layer.key)).size, 4);
    assert.ok(profile.layers.every((layer) => layer.texture && layer.description));
    assert.ok(profile.layers.every((layer) => layer.depthCm[0] < layer.depthCm[1]));
  }
});

test("regional profiles use different surface soil names and colors", () => {
  const surfaces = REGION_KEYS.map((regionKey) => getSoilRegionProfile(regionKey).layers[0]);
  assert.ok(new Set(surfaces.map((layer) => layer.texture)).size >= 4);
  assert.equal(new Set(surfaces.map((layer) => layer.base)).size, REGION_KEYS.length);
  assert.equal(
    new Set(REGION_KEYS.map((regionKey) => getSoilRegionProfile(regionKey).regionName)).size,
    REGION_KEYS.length,
  );
  assert.equal(SOIL_REGION_PROFILES.mountain.regionName, "湘西山区");
});

test("unknown region keys fall back to the plain profile", () => {
  assert.equal(getSoilRegionProfile("unknown"), SOIL_REGION_PROFILES.plain);
});

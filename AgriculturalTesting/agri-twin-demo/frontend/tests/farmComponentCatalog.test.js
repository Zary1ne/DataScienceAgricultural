import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPONENT_CATEGORY_ORDER,
  componentCatalogEntry,
  componentToolsForScope,
} from "../src/scene/farmComponentCatalog.js";
import { COMPONENT_TYPES } from "../src/scene/farmComponentRates.js";

test("plot and global component tools are separated and grouped by function", () => {
  const plotGroups = componentToolsForScope("plot");
  const globalGroups = componentToolsForScope("global");

  assert.deepEqual(plotGroups.map((group) => group.category), COMPONENT_CATEGORY_ORDER);
  assert.ok(plotGroups.every((group) => group.tools.every((tool) => tool.scope === "plot")));
  assert.ok(globalGroups.every((group) => group.tools.every((tool) => tool.scope === "global")));
  assert.ok(plotGroups.flatMap((group) => group.tools).some((tool) => tool.type === COMPONENT_TYPES.HUMIDIFIER));
  assert.ok(plotGroups.flatMap((group) => group.tools).some((tool) => tool.type === COMPONENT_TYPES.DEHUMIDIFIER));
  assert.ok(plotGroups.flatMap((group) => group.tools).some((tool) => tool.type === COMPONENT_TYPES.GROW_LIGHT));
  assert.ok(globalGroups.flatMap((group) => group.tools).some((tool) => tool.type === COMPONENT_TYPES.HUMIDIFIER_STATION));
  assert.ok(globalGroups.flatMap((group) => group.tools).some((tool) => tool.type === COMPONENT_TYPES.DEHUMIDIFIER_STATION));
  assert.ok(globalGroups.flatMap((group) => group.tools).some((tool) => tool.type === COMPONENT_TYPES.GROW_LIGHT_STATION));
});

test("humidifier catalog entries declare humidity as the primary metric", () => {
  assert.equal(componentCatalogEntry(COMPONENT_TYPES.HUMIDIFIER, "plot").primaryMetric, "湿度");
  assert.equal(componentCatalogEntry(COMPONENT_TYPES.HUMIDIFIER_STATION, "global").primaryMetric, "全部地块湿度");
  assert.equal(componentCatalogEntry(COMPONENT_TYPES.GROW_LIGHT, "plot").primaryMetric, "光照");
  assert.equal(componentCatalogEntry(COMPONENT_TYPES.DEHUMIDIFIER_STATION, "global").primaryMetric, "全部地块湿度");
});

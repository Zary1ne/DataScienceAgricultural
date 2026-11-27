import {
  DEFAULT_PLOT_PARAMS,
  REGION_CONFIG_BY_KEY,
  makePlotId,
} from './regionConfigs.ts';

export const SCENARIO_LIMITS = Object.freeze({
  maxGroups: 2,
  maxPlotsPerGroup: 25,
  maxTotalPlots: 50,
  allowedAreasMu: Object.freeze([0.5, 1]),
});

export const SCENARIO_TERRAIN_KEYS = Object.freeze(['plain', 'hill', 'south', 'mountain', 'east']);

const TERRAIN_COLUMNS = Object.freeze({ plain: 5, hill: 5, south: 5, mountain: 5, east: 5 });
const TERRAIN_PREFIX = Object.freeze({ plain: 'Plain', hill: 'Hill', south: 'Karst', mountain: 'Mountain', east: 'Valley' });

function clampInteger(value, min, max) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

export function normalizeScenarioGroups(groups = []) {
  const normalized = [];
  let remaining = SCENARIO_LIMITS.maxTotalPlots;
  groups.slice(0, SCENARIO_LIMITS.maxGroups).forEach((group, index) => {
    const terrainKey = SCENARIO_TERRAIN_KEYS.includes(group?.terrainKey) ? group.terrainKey : 'plain';
    const maxForGroup = Math.min(SCENARIO_LIMITS.maxPlotsPerGroup, remaining);
    const plotCount = clampInteger(group?.plotCount, 0, maxForGroup);
    const areaMu = SCENARIO_LIMITS.allowedAreasMu.includes(Number(group?.areaMu)) ? Number(group.areaMu) : 1;
    normalized.push({ id: group?.id || `group-${index + 1}`, terrainKey, plotCount, areaMu });
    remaining -= plotCount;
  });
  return normalized;
}

function cellDimensions(areaMu) {
  const side = areaMu === 0.5 ? 7.1 : 10;
  return { widthM: side, depthM: side };
}

function cellLayout(terrainKey, count, areaMu, regionId) {
  if (count <= 0) return [];
  const columns = Math.min(TERRAIN_COLUMNS[terrainKey] || 5, count);
  const rows = Math.ceil(count / columns);
  const spacing = cellDimensions(areaMu).widthM + 0.4;
  const cells = [];
  let ordinal = 0;

  for (let row = 1; row <= rows; row += 1) {
    for (let column = 1; column <= columns && ordinal < count; column += 1) {
      const { widthM, depthM } = cellDimensions(areaMu);
      let x = (column - (columns + 1) / 2) * spacing;
      let z = (row - (rows + 1) / 2) * spacing;
      let elevationM = 0;
      if (terrainKey === 'hill') {
        elevationM = (rows - row) * 0.42;
        x += (row % 2 ? 0.32 : -0.32);
      } else if (terrainKey === 'south') {
        elevationM = row % 2 ? 0.16 : -0.04;
        x += column % 2 ? 0.42 : -0.42;
        z += row % 2 ? 0.22 : -0.22;
      } else if (terrainKey === 'mountain') {
        elevationM = (rows - row) * 0.82;
        x += Math.sin((row + column) * 1.6) * 0.5;
      } else if (terrainKey === 'east') {
        elevationM = row % 2 ? 0.38 : 0;
        z += Math.cos((row + column) * 1.2) * 0.28;
      }

      cells.push({
        id: makePlotId(regionId, row, column),
        row,
        column,
        centerXZ: { x, z },
        widthM,
        depthM,
        elevationM,
        areaMu,
        plantCountTarget: 150,
        plantModelKey: 'rice-programmatic-v1',
        defaultParams: { ...DEFAULT_PLOT_PARAMS },
      });
      ordinal += 1;
    }
  }
  return cells;
}

function finalizeRegion(cells, meta) {
  const minX = Math.min(...cells.map((cell) => cell.centerXZ.x - cell.widthM / 2));
  const maxX = Math.max(...cells.map((cell) => cell.centerXZ.x + cell.widthM / 2));
  const minZ = Math.min(...cells.map((cell) => cell.centerXZ.z - cell.depthM / 2));
  const maxZ = Math.max(...cells.map((cell) => cell.centerXZ.z + cell.depthM / 2));
  const totalWidthM = maxX - minX + 0.8;
  const totalDepthM = maxZ - minZ + 0.8;
  return {
    ...meta,
    originXZ: { x: 40, z: 0 },
    sceneCenterXZ: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
    rows: Math.max(0, ...cells.map((cell) => cell.row)),
    columns: Math.max(0, ...cells.map((cell) => cell.column)),
    cellSizeM: cells[0]?.widthM || 10,
    leveeWidthM: 0.4,
    totalWidthM,
    totalDepthM,
    viewRadiusM: Math.max(totalWidthM, totalDepthM) / 2 + 4,
    cells,
  };
}

export function buildScenarioRegions(groups = []) {
  const normalizedGroups = normalizeScenarioGroups(groups);
  const regions = normalizedGroups.map((group, index) => {
    const template = REGION_CONFIG_BY_KEY[group.terrainKey];
    const prefix = `G${index + 1}${TERRAIN_PREFIX[group.terrainKey]}`;
    const cells = cellLayout(group.terrainKey, group.plotCount, group.areaMu, prefix);
    return finalizeRegion(cells, {
      id: prefix,
      key: group.terrainKey,
      name: `${template.name}${index ? ` · 第 ${index + 1} 组` : ''}`,
      rootName: `Scenario_${prefix}`,
      terrain: template.terrain,
      scenarioGroupId: group.id,
      areaMu: group.areaMu,
    });
  }).filter((region) => region.cells.length > 0);

  // Terrain decoration can extend beyond each plot group, so leave a wide visual corridor.
  const gap = 48;
  const totalSpan = regions.reduce((sum, region) => sum + region.totalWidthM, 0) + gap * Math.max(0, regions.length - 1);
  let cursor = 40 - totalSpan / 2;
  for (const region of regions) {
    region.originXZ = { x: cursor + region.totalWidthM / 2, z: 0 };
    cursor += region.totalWidthM + gap;
  }

  return {
    regions,
    groups: normalizedGroups,
    totalPlots: regions.reduce((sum, region) => sum + region.cells.length, 0),
  };
}

export function scenarioSummary(groups = []) {
  const built = buildScenarioRegions(groups);
  return {
    ...built,
    signature: built.regions.map((region) => `${region.id}:${region.cells.length}:${region.cells[0]?.areaMu || 0}`).join('|'),
  };
}

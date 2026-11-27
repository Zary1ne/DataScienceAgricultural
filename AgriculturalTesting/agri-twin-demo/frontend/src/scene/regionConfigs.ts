import type { Object3D } from 'three';
import {
  applyComponentEffects,
  update as updatePlotSimulation,
  limitDrainageToFloor,
} from './plotSimulation.js';
import {
  calculateGrowth,
  getStageProfile,
  optimalStageValues,
  stageForProgress,
} from './riceGrowthModel.js';

export type GrowthStage =
  | 'germination'
  | 'seedling'
  | 'tillering'
  | 'jointing'
  | 'heading'
  | 'filling'
  | 'maturity';

export interface PlotParams {
  waterLevelCm: number;
  co2Ppm: number;
  temperatureC: number;
  humidityPct: number;
  lightLux: number;
  baseLightLux?: number;
  growthStage: GrowthStage;
  healthPct: number;
}

export interface PlotCellConfig {
  id: string;
  row: number;
  column: number;
  centerXZ: { x: number; z: number };
  widthM: number;
  depthM: number;
  elevationM: number;
  displayName?: string;
  plantCountTarget: number;
  plantModelKey: string;
  defaultParams: PlotParams;
}

export type RegionKey = 'plain' | 'hill' | 'south' | 'mountain' | 'east';
export type RegionTerrain = 'plain' | 'hill' | 'karst' | 'terrace' | 'valley';

export interface RegionConfig {
  id: string;
  key: RegionKey;
  name: string;
  rootName: string;
  originXZ: { x: number; z: number };
  sceneCenterXZ: { x: number; z: number };
  terrain: RegionTerrain;
  rows: number;
  columns: number;
  cellSizeM: number;
  leveeWidthM: number;
  totalWidthM: number;
  totalDepthM: number;
  viewRadiusM: number;
  cells: PlotCellConfig[];
}

export interface IPlantFactory {
  createPlant(modelKey: string): Object3D;
}

export class PlaceholderPlantFactory implements IPlantFactory {
  createPlant(modelKey: string): Object3D {
    throw new Error(`Plant model resource is not configured: ${modelKey}`);
  }
}

const INITIAL_OPTIMAL = optimalStageValues('germination');
export const DEFAULT_PLOT_PARAMS: Readonly<PlotParams> = Object.freeze({
  ...INITIAL_OPTIMAL,
  growthStage: 'germination',
  healthPct: 100,
});

// Built-in regions use 5x5, but user-defined scenarios may need more rows.
export const SCENARIO_GRID_MAX_INDEX = 50;

export function makePlotId(regionId: string, row: number, column: number): string {
  if (!Number.isInteger(row) || row < 1 || row > SCENARIO_GRID_MAX_INDEX) {
    throw new RangeError(`Plot row must be an integer from 1 to ${SCENARIO_GRID_MAX_INDEX}`);
  }
  if (!Number.isInteger(column) || column < 1 || column > SCENARIO_GRID_MAX_INDEX) {
    throw new RangeError(`Plot column must be an integer from 1 to ${SCENARIO_GRID_MAX_INDEX}`);
  }
  return `${regionId}-R${String(row).padStart(2, '0')}-C${String(column).padStart(2, '0')}`;
}

interface CellSeed {
  row: number;
  column: number;
  x: number;
  z: number;
  widthM?: number;
  depthM?: number;
  elevationM?: number;
  displayName?: string;
}

function createCell(regionId: string, seed: CellSeed): PlotCellConfig {
  return {
    id: makePlotId(regionId, seed.row, seed.column),
    row: seed.row,
    column: seed.column,
    centerXZ: { x: seed.x, z: seed.z },
    widthM: seed.widthM ?? 10,
    depthM: seed.depthM ?? 10,
    elevationM: seed.elevationM ?? 0,
    displayName: seed.displayName,
    plantCountTarget: 150,
    plantModelKey: 'rice-programmatic-v1',
    defaultParams: { ...DEFAULT_PLOT_PARAMS },
  };
}

function finalizeRegion(
  base: Omit<RegionConfig, 'sceneCenterXZ' | 'totalWidthM' | 'totalDepthM' | 'viewRadiusM'>,
  viewRadiusM: number
): RegionConfig {
  const minX = Math.min(...base.cells.map((cell) => cell.centerXZ.x - cell.widthM / 2));
  const maxX = Math.max(...base.cells.map((cell) => cell.centerXZ.x + cell.widthM / 2));
  const minZ = Math.min(...base.cells.map((cell) => cell.centerXZ.z - cell.depthM / 2));
  const maxZ = Math.max(...base.cells.map((cell) => cell.centerXZ.z + cell.depthM / 2));
  return {
    ...base,
    sceneCenterXZ: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
    totalWidthM: maxX - minX + base.leveeWidthM * 2,
    totalDepthM: maxZ - minZ + base.leveeWidthM * 2,
    viewRadiusM,
  };
}

const GRID_SPACING_M = 10.4;

function plainCells(regionId: string): PlotCellConfig[] {
  const cells: PlotCellConfig[] = [];
  for (let row = 1; row <= 5; row += 1) {
    for (let column = 1; column <= 5; column += 1) {
      cells.push(createCell(regionId, {
        row,
        column,
        x: (column - 3) * GRID_SPACING_M,
        z: (row - 3) * GRID_SPACING_M,
      }));
    }
  }
  return cells;
}

function hillCells(regionId: string): PlotCellConfig[] {
  const cells: PlotCellConfig[] = [];
  const elevations = [0, 0.55, 1.1];
  for (let row = 1; row <= 3; row += 1) {
    for (let column = 1; column <= 5; column += 1) {
      cells.push(createCell(regionId, {
        row,
        column,
        x: (column - 3) * 10.7 + (row - 2) * 0.45,
        z: (row - 2) * 11.4,
        widthM: 9.8,
        depthM: 10.2,
        elevationM: elevations[row - 1],
      }));
    }
  }
  return cells;
}

function karstCells(regionId: string): PlotCellConfig[] {
  const rows = [
    { row: 1, z: -11.3, xs: [-14.2, 0, 14.2], widths: [11, 10, 9.2] },
    { row: 2, z: 0, xs: [-18.1, -6.1, 6.1, 18.1], widths: [8.8, 8.8, 8.8, 8.8] },
    { row: 3, z: 11.3, xs: [-14.2, 0, 14.2], widths: [9.2, 10, 11] },
  ];
  const cells: PlotCellConfig[] = [];
  for (const rowConfig of rows) {
    rowConfig.xs.forEach((x, index) => {
      cells.push(createCell(regionId, {
        row: rowConfig.row,
        column: index + 1,
        x,
        z: rowConfig.z,
        widthM: rowConfig.widths[index],
        depthM: 8.8,
        elevationM: (rowConfig.row - 2) * 0.22,
      }));
    });
  }
  return cells;
}

function mountainCells(regionId: string): PlotCellConfig[] {
  return [
    createCell(regionId, {
      row: 1,
      column: 1,
      x: 0,
      z: 0,
      widthM: 16,
      depthM: 11,
      displayName: '主梯田',
    }),
  ];
}

function valleyCells(regionId: string): PlotCellConfig[] {
  const cells: PlotCellConfig[] = [];
  for (let row = 1; row <= 2; row += 1) {
    for (let column = 1; column <= 4; column += 1) {
      cells.push(createCell(regionId, {
        row,
        column,
        x: (column - 2.5) * 11.2,
        z: row === 1 ? -6.2 : 6.2,
        widthM: 10.4,
        depthM: 10.2,
        elevationM: row === 1 ? 0.45 : 0,
      }));
    }
  }
  return cells;
}

export const PLAIN_REGION_CONFIG = finalizeRegion({
  id: 'Plain',
  key: 'plain',
  name: '洞庭湖平原水田',
  rootName: 'RiceField_Plain',
  originXZ: { x: 40, z: 0 },
  terrain: 'plain',
  rows: 5,
  columns: 5,
  cellSizeM: 10,
  leveeWidthM: 0.4,
  cells: plainCells('Plain'),
}, 34);

export const HILL_REGION_CONFIG = finalizeRegion({
  id: 'Hill',
  key: 'hill',
  name: '湘中丘陵水田',
  rootName: 'RiceField_Hill',
  originXZ: { x: 40, z: 0 },
  terrain: 'hill',
  rows: 3,
  columns: 5,
  cellSizeM: 10,
  leveeWidthM: 0.4,
  cells: hillCells('Hill'),
}, 31);

export const SOUTH_REGION_CONFIG = finalizeRegion({
  id: 'Karst',
  key: 'south',
  name: '湘南喀斯特盆地水田',
  rootName: 'RiceField_Karst',
  originXZ: { x: 40, z: 0 },
  terrain: 'karst',
  rows: 3,
  columns: 4,
  cellSizeM: 10,
  leveeWidthM: 0.4,
  cells: karstCells('Karst'),
}, 32);

export const MOUNTAIN_REGION_CONFIG = finalizeRegion({
  id: 'Mountain',
  key: 'mountain',
  name: '湘西山地梯田',
  rootName: 'RiceField_Mountain',
  originXZ: { x: 40, z: 0 },
  terrain: 'terrace',
  rows: 1,
  columns: 1,
  cellSizeM: 10,
  leveeWidthM: 0.4,
  cells: mountainCells('Mountain'),
}, 18);

export const EAST_REGION_CONFIG = finalizeRegion({
  id: 'Valley',
  key: 'east',
  name: '湘东河谷过渡田',
  rootName: 'RiceField_Valley',
  originXZ: { x: 40, z: 0 },
  terrain: 'valley',
  rows: 2,
  columns: 4,
  cellSizeM: 10,
  leveeWidthM: 0.4,
  cells: valleyCells('Valley'),
}, 28);

// Compatibility alias for callers that still request the legacy terrace scene.
export const TERRACE_REGION_CONFIG = MOUNTAIN_REGION_CONFIG;

export const REGION_CONFIGS: readonly RegionConfig[] = [
  PLAIN_REGION_CONFIG,
  HILL_REGION_CONFIG,
  SOUTH_REGION_CONFIG,
  MOUNTAIN_REGION_CONFIG,
  EAST_REGION_CONFIG,
];

export const REGION_CONFIG_BY_KEY: Readonly<Record<RegionKey, RegionConfig>> = Object.freeze({
  plain: PLAIN_REGION_CONFIG,
  hill: HILL_REGION_CONFIG,
  south: SOUTH_REGION_CONFIG,
  mountain: MOUNTAIN_REGION_CONFIG,
  east: EAST_REGION_CONFIG,
});

export class PlotState {
  readonly id: string;
  params: PlotParams;
  physiologicalProgress = 0;
  simulatedDay = 1;
  currentStage: GrowthStage | 'germination' = 'germination';
  growthRatePct = 100;
  stressed = false;
  growthStalled = false;
  stressReason: string | null = null;
  stressDetail: {
    key: string;
    value: number;
    ideal: [number, number];
    reason: string;
    text: string;
  } | null = null;

  constructor(id: string, params: PlotParams) {
    this.id = id;
    this.params = { ...params };
  }

  update(
    dt: number,
    environment: {
      weather?: string;
      weatherSnapshot?: {
        key: string;
        temperature: number;
        humidity: number;
        light: number;
        wind: number;
        rain: number;
        rainfallCmPerSecond: number;
        evaporationCmPerSecond: number;
        co2VentilationRate: number;
        ambientTemperatureC: number;
      };
      selectedPlotId?: string | null;
      elapsedSeconds?: number;
      componentEffects: {
        waterLevelCmPerSecond: number;
        co2SupplyPpmPerSecond: number;
        co2VentilationRate: number;
        temperatureCPerSecond: number;
        humidityPctPerSecond?: number;
        lightLuxDelta?: number;
      };
    }
  ): void {
    const waterFloorCm = getStageProfile(this.currentStage).ideal.waterLevelCm[0];
    const limitedEffects = limitDrainageToFloor(
      environment.componentEffects,
      this.params.waterLevelCm,
      waterFloorCm,
      dt
    );
    this.params = updatePlotSimulation(dt, {
      ...environment,
      plotId: this.id,
      params: { ...this.params },
      componentEffects: limitedEffects,
    });
    this.refreshGrowthStatus();
  }

  syncEnvironmentSnapshot(snapshot: {
    temperature?: number;
    humidity?: number;
    waterLevelCm?: number;
    light?: number;
  }): void {
    if (!snapshot) return;
    const temperature = Number(snapshot.temperature);
    const humidity = Number(snapshot.humidity);
    const waterLevelCm = Number(snapshot.waterLevelCm);
    const light = Number(snapshot.light);
    if (Number.isFinite(temperature)) {
      this.params.temperatureC = Math.max(0, Math.min(45, temperature));
    }
    if (Number.isFinite(humidity)) {
      this.params.humidityPct = Math.max(0, Math.min(100, humidity));
    }
    if (Number.isFinite(waterLevelCm)) {
      this.params.waterLevelCm = Math.max(0, Math.min(12, waterLevelCm));
    }
    if (Number.isFinite(light)) {
      const clampedLight = Math.max(0, Math.min(30000, light));
      this.params.lightLux = Math.round(clampedLight);
      this.params.baseLightLux = Math.round(clampedLight);
    }
    this.refreshGrowthStatus();
  }

  applyComponentStep(dt: number, componentEffects: Record<string, number>): void {
    this.params = applyComponentEffects(this.params, componentEffects, dt);
    this.seekGrowth(this.physiologicalProgress, this.simulatedDay);
  }

  private growthEnvironment() {
    return {
      waterLevelCm: this.params.waterLevelCm,
      temperatureC: this.params.temperatureC,
      humidityPct: this.params.humidityPct,
      co2Ppm: this.params.co2Ppm,
      lightLux: this.params.lightLux,
    };
  }

  advanceGrowth(dtDays: number): void {
    if (!(dtDays > 0)) return;
    const growth = calculateGrowth(
      {
        physiologicalProgress: this.physiologicalProgress,
        simulatedDay: this.simulatedDay,
      },
      this.growthEnvironment(),
      dtDays
    );
    this.applyGrowth(growth);
  }

  seekGrowth(progress: number, simulatedDay: number): void {
    const nextProgress = Math.min(100, Math.max(0, progress));
    this.physiologicalProgress = nextProgress;
    this.simulatedDay = simulatedDay;
    this.currentStage = stageForProgress(nextProgress);
    this.refreshGrowthStatus();
  }

  private refreshGrowthStatus(): void {
    const growth = calculateGrowth(
      {
        physiologicalProgress: this.physiologicalProgress,
        simulatedDay: this.simulatedDay,
      },
      this.growthEnvironment(),
      0
    );
    this.applyGrowth(growth);
  }

  private applyGrowth(growth: ReturnType<typeof calculateGrowth>): void {
    this.physiologicalProgress = growth.physiologicalProgress;
    this.simulatedDay = growth.simulatedDay;
    this.currentStage = growth.stage;
    this.growthRatePct = growth.growthRatePct;
    this.stressed = growth.stressed;
    this.growthStalled = growth.stalled;
    this.stressReason = growth.stressReason ?? null;
    this.stressDetail = growth.stressDetail ?? null;
    this.params.growthStage = growth.stage;
  }
}

export function createInitialPlotStates(
  configs: readonly RegionConfig[] = REGION_CONFIGS
): Record<string, PlotState> {
  const states: Record<string, PlotState> = {};
  configs.forEach((region) => {
    region.cells.forEach((cell) => {
      states[cell.id] = new PlotState(cell.id, cell.defaultParams);
    });
  });
  return states;
}

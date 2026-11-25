import type { Object3D } from "three";
import {
  applyComponentEffects,
  update as updatePlotSimulation,
  limitDrainageToFloor,
} from "./plotSimulation.js";
import {
  calculateGrowth,
  getStageProfile,
  optimalStageValues,
  stageForProgress,
} from "./riceGrowthModel.js";

export type GrowthStage =
  | "germination"
  | "seedling"
  | "tillering"
  | "jointing"
  | "heading"
  | "filling"
  | "maturity";

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
  plantCountTarget: number;
  plantModelKey: string;
  defaultParams: PlotParams;
}

interface RegionConfigBase {
  id: string;
  name: string;
  rootName: string;
  originXZ: { x: number; z: number };
  rows: 5;
  columns: 5;
  cellSizeM: 10;
  leveeWidthM: 0.4;
  totalWidthM: 52.4;
  cells: PlotCellConfig[];
}

export interface PlainRegionConfig extends RegionConfigBase {
  type: "plain";
  mudElevationM: number;
}

export interface TerraceRegionConfig extends RegionConfigBase {
  type: "terrace";
  terraceLevelsByRow: readonly [number, number, number, number, number];
}

export type RegionConfig = PlainRegionConfig | TerraceRegionConfig;

export interface IPlantFactory {
  createPlant(modelKey: string): Object3D;
}

export class PlaceholderPlantFactory implements IPlantFactory {
  createPlant(modelKey: string): Object3D {
    throw new Error(`Plant model resource is not configured: ${modelKey}`);
  }
}

const INITIAL_OPTIMAL = optimalStageValues("germination");
export const DEFAULT_PLOT_PARAMS: Readonly<PlotParams> = Object.freeze({
  ...INITIAL_OPTIMAL,
  growthStage: "germination",
  healthPct: 100,
});

export function makePlotId(regionId: string, row: number, column: number): string {
  if (!Number.isInteger(row) || row < 1 || row > 5) {
    throw new RangeError("Plot row must be an integer from 1 to 5");
  }
  if (!Number.isInteger(column) || column < 1 || column > 5) {
    throw new RangeError("Plot column must be an integer from 1 to 5");
  }
  return `${regionId}-R${String(row).padStart(2, "0")}-C${String(column).padStart(2, "0")}`;
}

function createCells(regionId: string): PlotCellConfig[] {
  const cells: PlotCellConfig[] = [];
  // Net cells are 10 m wide; the 0.4 m levees add to the total footprint.
  // Adjacent cell centers are 10.4 m apart, including the levee between them.
  const centerOffset = (index: number) => (index - 2) * 10.4;

  for (let row = 1; row <= 5; row += 1) {
    for (let column = 1; column <= 5; column += 1) {
      cells.push({
        id: makePlotId(regionId, row, column),
        row,
        column,
        centerXZ: { x: centerOffset(column - 1), z: centerOffset(row - 1) },
        widthM: 10,
        depthM: 10,
        plantCountTarget: 150,
        plantModelKey: "rice-programmatic-v1",
        defaultParams: { ...DEFAULT_PLOT_PARAMS },
      });
    }
  }

  return cells;
}

function createRegionBase(
  id: string,
  name: string,
  rootName: string,
  originXZ: { x: number; z: number }
): RegionConfigBase {
  return {
    id,
    name,
    rootName,
    originXZ,
    rows: 5,
    columns: 5,
    cellSizeM: 10,
    leveeWidthM: 0.4,
    totalWidthM: 5 * 10 + 6 * 0.4,
    cells: createCells(id),
  };
}

export const PLAIN_REGION_CONFIG: PlainRegionConfig = {
  ...createRegionBase("Plain", "平原水田", "RiceField_Plain", { x: 0, z: 0 }),
  type: "plain",
  mudElevationM: 0,
};

export const TERRACE_REGION_CONFIG: TerraceRegionConfig = {
  ...createRegionBase("Terrace", "梯田水田", "RiceField_Terrace", { x: 80, z: 0 }),
  type: "terrace",
  terraceLevelsByRow: [0, 0.75, 1.5, 2.25, 3],
};

export const REGION_CONFIGS: readonly RegionConfig[] = [
  PLAIN_REGION_CONFIG,
  TERRACE_REGION_CONFIG,
];

export class PlotState {
  readonly id: string;
  params: PlotParams;
  /** P1: 生理进度 0~100，用于决定水稻形态与所处阶段 */
  physiologicalProgress = 0;
  /** P1: 模拟天数，初始为 Day 1 */
  simulatedDay = 1;
  /** P1: 当前生长阶段（由生理进度决定，受环境胁迫会滞后） */
  currentStage: GrowthStage | "germination" = "germination";
  /** P1: 当前生长速率百分比（100% = 环境完全适宜） */
  growthRatePct = 100;
  /** P1: 生长是否严重受阻 */
  stressed = false;
  /** P1: 生长是否完全停滞 */
  growthStalled = false;
  /** P1+: 生长受阻的主要原因（低温/缺水/寡照…），适宜时为 null */
  stressReason: string | null = null;
  /** P1+: 受阻详情，供 UI 生成农学告警文案 */
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
      /** 旧字段，向后兼容 */
      weather?: string;
      /** 新字段：来自 weatherState.js 的 WeatherSnapshot */
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
    // P16: 排水边界 —— 排到当前阶段安全区间下限就自动停止
    // （发芽 1cm / 分蘖 3cm / 成熟 0cm），不会把田排干后反而触发「水位过低」
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
    // 环境参数每秒都会变化，必须同步刷新受阻状态，否则结算报告会读取旧状态。
    this.refreshGrowthStatus();
  }

  /** 自定义天气应用后立即同步环境，避免生长状态等待物理插值。 */
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

  /** P3: 时间轴驱动 —— 按天数推进生长（受环境胁迫影响） */
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

  /** P3: 时间轴拖拽回溯 —— 直接把生理进度跳到指定值 */
  seekGrowth(progress: number, simulatedDay: number): void {
    const nextProgress = Math.min(100, Math.max(0, progress));
    this.physiologicalProgress = nextProgress;
    this.simulatedDay = simulatedDay;
    this.currentStage = stageForProgress(nextProgress);
    // 仍按当前环境刷新速率/受阻原因，但不推进进度
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

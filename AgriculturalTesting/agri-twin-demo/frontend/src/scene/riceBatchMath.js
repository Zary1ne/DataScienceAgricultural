// P4 性能平衡：单地块最多 140 株，远景只渲染其中 60 株
export const PLANTS_PER_PLOT = 140;
export const VISIBLE_PLANT_COUNT = 100;
export const MAX_PLANT_COUNT = 50 * PLANTS_PER_PLOT;

export const RICE_PART_FACE_BUDGET = Object.freeze({
  seed: 36,
  mainStem: 10,
  tillerStems: 64,
  leaves: 120,
  panicle: 80,
  grains: 80,
});

export const RICE_TRIANGLES_PER_PLANT = Object.values(
  RICE_PART_FACE_BUDGET
).reduce((total, faces) => total + faces, 0);

export const RICE_VISUAL_THRESHOLDS = Object.freeze({
  germinationEnd: (100 * 10) / 140,
  tilleringStart: (100 * 30) / 140,
  headingStart: (100 * 80) / 140,
  grainStart: (100 * 100) / 140,
  maturityCompactStart: 88,
});

export const RICE_HEIGHT_KEYFRAMES = Object.freeze([
  Object.freeze([0, 0.68]),
  Object.freeze([(100 * 10) / 140, 0.7]),
  Object.freeze([(100 * 30) / 140, 0.82]),
  Object.freeze([(100 * 60) / 140, 1.02]),
  Object.freeze([60, 1.12]),
  Object.freeze([(100 * 100) / 140, 1.34]),
  Object.freeze([(100 * 120) / 140, 1.56]),
  Object.freeze([100, 1.68]),
]);

export function clampRiceProgress(progress) {
  return Math.min(100, Math.max(0, Number(progress) || 0));
}

export function getRicePartVisibility(progress) {
  const value = clampRiceProgress(progress);
  return {
    seed: value < RICE_VISUAL_THRESHOLDS.germinationEnd,
    mainStem: value >= RICE_VISUAL_THRESHOLDS.germinationEnd,
    leaves: value >= RICE_VISUAL_THRESHOLDS.germinationEnd,
    tillerStems: value >= RICE_VISUAL_THRESHOLDS.tilleringStart,
    panicle: value >= RICE_VISUAL_THRESHOLDS.headingStart,
    grains: value >= RICE_VISUAL_THRESHOLDS.grainStart,
  };
}

export function maturityCompactAt(progress) {
  const value = clampRiceProgress(progress);
  const t = Math.min(
    1,
    Math.max(0, (value - RICE_VISUAL_THRESHOLDS.maturityCompactStart) /
      (100 - RICE_VISUAL_THRESHOLDS.maturityCompactStart))
  );
  return t * t * (3 - 2 * t);
}

export function maturityVisibleCountAt(baseVisibleCount, progress) {
  const count = Math.max(0, Math.round(Number(baseVisibleCount) || 0));
  return Math.min(
    PLANTS_PER_PLOT,
    count + Math.round(maturityCompactAt(progress) * 40)
  );
}

export function riceHeightScaleAt(progress) {
  const value = clampRiceProgress(progress);
  for (let index = 1; index < RICE_HEIGHT_KEYFRAMES.length; index += 1) {
    const [fromProgress, fromScale] = RICE_HEIGHT_KEYFRAMES[index - 1];
    const [toProgress, toScale] = RICE_HEIGHT_KEYFRAMES[index];
    if (value <= toProgress) {
      const t = (value - fromProgress) / Math.max(1e-6, toProgress - fromProgress);
      return fromScale + (toScale - fromScale) * t;
    }
  }
  return RICE_HEIGHT_KEYFRAMES[RICE_HEIGHT_KEYFRAMES.length - 1][1];
}

export function getPlotInstanceRange(plotOrdinal) {
  if (!Number.isInteger(plotOrdinal) || plotOrdinal < 0 || plotOrdinal >= 50) {
    throw new RangeError("Plot ordinal must be an integer from 0 to 49");
  }
  const start = plotOrdinal * PLANTS_PER_PLOT;
  return { start, end: start + PLANTS_PER_PLOT };
}

export function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function hash01(plotId, plantIndex, salt = "") {
  const hash = hashString(`${plotId}:${plantIndex}:${salt}`);
  return hash / 0x100000000;
}

export function createPlotPlantLayout(
  plotId,
  count = PLANTS_PER_PLOT,
  widthM = 10,
  depthM = 10,
  minSpacingM = 0.3,
  insetM = 0.2
) {
  if (!Number.isInteger(count) || count < 0 || count > PLANTS_PER_PLOT) {
    throw new RangeError(`Plant count must be from 0 to ${PLANTS_PER_PLOT}`);
  }
  if (!(widthM > 0) || !(depthM > 0) || !(minSpacingM > 0)) {
    throw new RangeError("Plot dimensions and plant spacing must be positive");
  }
  if (!(insetM >= 0) || insetM * 2 >= Math.min(widthM, depthM)) {
    throw new RangeError("Inset must leave a positive planting area");
  }

  const usableWidthM = widthM - insetM * 2;
  const usableDepthM = depthM - insetM * 2;
  const positions = [];
  const cells = new Map();
  const gridSize = minSpacingM / Math.SQRT2;
  const minSpacingSquared = minSpacingM * minSpacingM;

  for (let plantIndex = 0; plantIndex < count; plantIndex += 1) {
    let position = null;
    for (let attempt = 0; attempt < 4000; attempt += 1) {
      const candidate = {
        x: insetM + hash01(plotId, plantIndex, `scatter-x-${attempt}`) * usableWidthM,
        z: insetM + hash01(plotId, plantIndex, `scatter-z-${attempt}`) * usableDepthM,
      };
      const cellX = Math.floor(candidate.x / gridSize);
      const cellZ = Math.floor(candidate.z / gridSize);
      let separated = true;

      for (let dx = -2; dx <= 2 && separated; dx += 1) {
        for (let dz = -2; dz <= 2 && separated; dz += 1) {
          const bucket = cells.get(`${cellX + dx}:${cellZ + dz}`);
          if (!bucket) continue;
          separated = bucket.every((other) => {
            const x = candidate.x - other.x;
            const z = candidate.z - other.z;
            return x * x + z * z >= minSpacingSquared;
          });
        }
      }

      if (separated) {
        position = candidate;
        const key = `${cellX}:${cellZ}`;
        const bucket = cells.get(key) || [];
        bucket.push(candidate);
        cells.set(key, bucket);
        break;
      }
    }
    if (!position) {
      throw new Error(`Could not place rice plant ${plantIndex} in plot ${plotId}`);
    }

    positions.push({
      x: position.x - widthM / 2,
      z: position.z - depthM / 2,
      height: 0.86 + hash01(plotId, plantIndex, "height") * 0.28,
      yaw: hash01(plotId, plantIndex, "yaw") * Math.PI * 2,
      tiltX: (hash01(plotId, plantIndex, "tilt-x") - 0.5) * 0.16,
      tiltZ: (hash01(plotId, plantIndex, "tilt-z") - 0.5) * 0.16,
      phase: hash01(plotId, plantIndex, "phase") * Math.PI * 2,
      swayAmp: 0.65 + hash01(plotId, plantIndex, "sway") * 0.7,
    });
  }

  return positions;
}

export function createVisibilityMask(plotId, visibleCount, totalCount = PLANTS_PER_PLOT) {
  if (!Number.isInteger(totalCount) || totalCount < 0 || totalCount > PLANTS_PER_PLOT) {
    throw new RangeError(`Total plant count must be from 0 to ${PLANTS_PER_PLOT}`);
  }
  if (!Number.isInteger(visibleCount) || visibleCount < 0 || visibleCount > totalCount) {
    throw new RangeError("Visible plant count must be between zero and total count");
  }

  const rankedIndices = Array.from({ length: totalCount }, (_, index) => index);
  rankedIndices.sort((a, b) => hash01(plotId, a, "density") - hash01(plotId, b, "density"));
  const mask = new Uint8Array(totalCount);
  rankedIndices.slice(0, visibleCount).forEach((index) => {
    mask[index] = 1;
  });
  return mask;
}

export function isPanicleStageVisible(growthStage) {
  return ["heading", "filling", "maturity"].includes(growthStage);
}

export function areGrainsStageVisible(growthStage) {
  return ["filling", "maturity"].includes(growthStage);
}

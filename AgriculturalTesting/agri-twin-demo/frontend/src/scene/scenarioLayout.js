const DIRECTIONS = Object.freeze({
  up: { row: -1, column: 0 },
  down: { row: 1, column: 0 },
  left: { row: 0, column: -1 },
  right: { row: 0, column: 1 },
});

const TERRAIN_LABELS = Object.freeze({
  plain: "平原",
  hill: "丘陵",
  south: "喀斯特",
  mountain: "山地",
  east: "河谷",
});

function key(row, column) {
  return `${row}:${column}`;
}

function positiveNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function integerInRange(value, min, max) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) return null;
  return numeric;
}

function cellsOf(block) {
  const cells = [];
  for (let row = block.rowStart; row <= block.rowEnd; row += 1) {
    for (let column = block.colStart; column <= block.colEnd; column += 1) {
      cells.push({ row, column });
    }
  }
  return cells;
}

function cellsToRectangles(cells) {
  const remaining = new Set(cells.map((cell) => key(cell.row, cell.column)));
  const rectangles = [];
  while (remaining.size) {
    const ordered = [...remaining]
      .map((value) => value.split(":").map(Number))
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const [rowStart, colStart] = ordered[0];
    let colEnd = colStart;
    while (remaining.has(key(rowStart, colEnd + 1))) colEnd += 1;
    let rowEnd = rowStart;
    let canExtend = true;
    while (canExtend) {
      const nextRow = rowEnd + 1;
      for (let column = colStart; column <= colEnd; column += 1) {
        if (!remaining.has(key(nextRow, column))) canExtend = false;
      }
      if (canExtend) rowEnd = nextRow;
    }
    for (let row = rowStart; row <= rowEnd; row += 1) {
      for (let column = colStart; column <= colEnd; column += 1) {
        remaining.delete(key(row, column));
      }
    }
    rectangles.push({ rowStart, rowEnd, colStart, colEnd });
  }
  return rectangles;
}

function deriveRowElevations(region, rows) {
  return Array.from({ length: rows }, (_, index) => {
    const matching = (region?.cells || []).filter((cell) => cell.row === index + 1);
    if (!matching.length) return 0;
    return matching.reduce((sum, cell) => sum + (Number(cell.elevationM) || 0), 0) / matching.length;
  });
}

function blockDisplayName(region, block) {
  const terrain = TERRAIN_LABELS[region?.key] || "田块";
  const rowLabel = block.rowStart === block.rowEnd
    ? `${block.rowStart}行`
    : `${block.rowStart}-${block.rowEnd}行`;
  const colLabel = block.colStart === block.colEnd
    ? `${block.colStart}列`
    : `${block.colStart}-${block.colEnd}列`;
  return `${terrain} ${rowLabel}${colLabel}`;
}

export function createLayoutFromRegion(region) {
  const sourceCells = Array.isArray(region?.cells) ? region.cells : [];
  const rows = Math.max(
    1,
    Number(region?.rows) || Math.max(0, ...sourceCells.map((cell) => Number(cell.row) || 0)),
  );
  const columns = Math.max(
    1,
    Number(region?.columns) || Math.max(0, ...sourceCells.map((cell) => Number(cell.column) || 0)),
  );
  const firstCell = sourceCells[0];
  return {
    rows,
    columns,
    cellWidthM: positiveNumber(firstCell?.widthM, positiveNumber(region?.cellSizeM, 10)),
    cellDepthM: positiveNumber(firstCell?.depthM, positiveNumber(region?.cellSizeM, 10)),
    leveeWidthM: Math.max(0, Number(region?.leveeWidthM) || 0.4),
    areaMu: positiveNumber(region?.areaMu ?? firstCell?.areaMu, 1),
    rowElevations: deriveRowElevations(region, rows),
    blocks: sourceCells.map((cell) => ({
      id: cell.id,
      rowStart: cell.row,
      rowEnd: cell.row,
      colStart: cell.column,
      colEnd: cell.column,
    })),
  };
}

/**
 * Accepts only a non-overlapping rectangular partition that stays inside the
 * original grid. This keeps persisted layouts from changing the total boundary.
 */
export function normalizeLayoutForRegion(region, layout) {
  if (!region || !layout || !Array.isArray(layout.blocks)) return null;
  const rows = Number(region.rows) || Math.max(0, ...(region.cells || []).map((cell) => Number(cell.row) || 0));
  const columns = Number(region.columns) || Math.max(0, ...(region.cells || []).map((cell) => Number(cell.column) || 0));
  if (rows < 1 || columns < 1) return null;

  const firstCell = region.cells?.[0];
  const originalCells = new Set((region.cells || []).map((cell) => key(cell.row, cell.column)));
  const ids = new Set();
  const covered = new Set();
  const blocks = [];
  for (const sourceBlock of layout.blocks) {
    const id = typeof sourceBlock?.id === "string" ? sourceBlock.id.trim() : "";
    const rowStart = integerInRange(sourceBlock?.rowStart, 1, rows);
    const rowEnd = integerInRange(sourceBlock?.rowEnd, 1, rows);
    const colStart = integerInRange(sourceBlock?.colStart, 1, columns);
    const colEnd = integerInRange(sourceBlock?.colEnd, 1, columns);
    if (!id || ids.has(id) || rowStart == null || rowEnd == null || colStart == null || colEnd == null) return null;
    if (rowStart > rowEnd || colStart > colEnd) return null;
    ids.add(id);
    const block = { id, rowStart, rowEnd, colStart, colEnd };
    for (const cell of cellsOf(block)) {
      const cellKey = key(cell.row, cell.column);
      if (covered.has(cellKey)) return null;
      covered.add(cellKey);
    }
    blocks.push(block);
  }
  // A valid layout may merge or split blocks, but it must still own exactly the
  // same cells as the confirmed scenario. This blocks accidental land loss.
  if (covered.size !== originalCells.size || [...originalCells].some((cellKey) => !covered.has(cellKey))) {
    return null;
  }

  const rowElevations = Array.isArray(layout.rowElevations) && layout.rowElevations.length === rows
    ? layout.rowElevations.map((value) => Number(value) || 0)
    : deriveRowElevations(region, rows);

  return {
    rows,
    columns,
    cellWidthM: positiveNumber(layout.cellWidthM, positiveNumber(firstCell?.widthM, positiveNumber(region.cellSizeM, 10))),
    cellDepthM: positiveNumber(layout.cellDepthM, positiveNumber(firstCell?.depthM, positiveNumber(region.cellSizeM, 10))),
    leveeWidthM: Math.max(0, Number(layout.leveeWidthM) || Number(region.leveeWidthM) || 0.4),
    areaMu: positiveNumber(layout.areaMu ?? region.areaMu ?? firstCell?.areaMu, 1),
    rowElevations,
    blocks,
  };
}

export function regionFromLayout(baseRegion, layout) {
  const normalized = normalizeLayoutForRegion(baseRegion, layout);
  if (!normalized) return { ...baseRegion, cells: [] };

  const spacingX = normalized.cellWidthM + normalized.leveeWidthM;
  const spacingZ = normalized.cellDepthM + normalized.leveeWidthM;
  const gridWidth = normalized.columns * normalized.cellWidthM + (normalized.columns - 1) * normalized.leveeWidthM;
  const gridDepth = normalized.rows * normalized.cellDepthM + (normalized.rows - 1) * normalized.leveeWidthM;
  const left = -gridWidth / 2;
  const top = -gridDepth / 2;
  const baseCell = baseRegion.cells?.[0];
  const cells = [...normalized.blocks]
    .sort((a, b) => a.rowStart - b.rowStart || a.colStart - b.colStart)
    .map((block) => {
      const columnSpan = block.colEnd - block.colStart + 1;
      const rowSpan = block.rowEnd - block.rowStart + 1;
      const widthM = columnSpan * normalized.cellWidthM + (columnSpan - 1) * normalized.leveeWidthM;
      const depthM = rowSpan * normalized.cellDepthM + (rowSpan - 1) * normalized.leveeWidthM;
      const elevations = normalized.rowElevations.slice(block.rowStart - 1, block.rowEnd);
      return {
        id: block.id,
        row: block.rowStart,
        column: block.colStart,
        rowStart: block.rowStart,
        rowEnd: block.rowEnd,
        colStart: block.colStart,
        colEnd: block.colEnd,
        centerXZ: {
          x: left + (block.colStart - 1) * spacingX + widthM / 2,
          z: top + (block.rowStart - 1) * spacingZ + depthM / 2,
        },
        widthM,
        depthM,
        elevationM: elevations.length
          ? elevations.reduce((sum, value) => sum + value, 0) / elevations.length
          : 0,
        areaMu: normalized.areaMu * columnSpan * rowSpan,
        displayName: blockDisplayName(baseRegion, block),
        plantCountTarget: Math.round((baseCell?.plantCountTarget || 150) * columnSpan * rowSpan),
        plantModelKey: baseCell?.plantModelKey || "rice-programmatic-v1",
        defaultParams: { ...baseCell?.defaultParams },
      };
    });
  const totalWidthM = gridWidth + normalized.leveeWidthM * 2;
  const totalDepthM = gridDepth + normalized.leveeWidthM * 2;
  return {
    ...baseRegion,
    rows: normalized.rows,
    columns: normalized.columns,
    cellSizeM: normalized.cellWidthM,
    leveeWidthM: normalized.leveeWidthM,
    totalWidthM,
    totalDepthM,
    viewRadiusM: Math.max(totalWidthM, totalDepthM) / 2 + 4,
    cells,
  };
}

/**
 * Moves one adjacent grid strip from neighbouring blocks to the selected
 * block. Neighbours keep their remaining cells, split when needed, and are
 * removed when they no longer contain any cells.
 */
export function expandLayoutBlock(layout, blockId, direction) {
  const selected = layout?.blocks?.find((block) => block.id === blockId);
  if (!selected || !DIRECTIONS[direction]) {
    return { ok: false, reason: "invalid-request", layout };
  }

  let rowStart = selected.rowStart;
  let rowEnd = selected.rowEnd;
  let colStart = selected.colStart;
  let colEnd = selected.colEnd;
  if (direction === "up") rowStart -= 1;
  if (direction === "down") rowEnd += 1;
  if (direction === "left") colStart -= 1;
  if (direction === "right") colEnd += 1;
  if (rowStart < 1 || rowEnd > layout.rows || colStart < 1 || colEnd > layout.columns) {
    return { ok: false, reason: "boundary", layout };
  }

  const targetCells = [];
  if (direction === "up" || direction === "down") {
    const row = direction === "up" ? selected.rowStart - 1 : selected.rowEnd + 1;
    for (let column = selected.colStart; column <= selected.colEnd; column += 1) {
      targetCells.push({ row, column });
    }
  } else {
    const column = direction === "left" ? selected.colStart - 1 : selected.colEnd + 1;
    for (let row = selected.rowStart; row <= selected.rowEnd; row += 1) {
      targetCells.push({ row, column });
    }
  }
  const targetKeys = new Set(targetCells.map((cell) => key(cell.row, cell.column)));

  const affected = new Map();
  const coveredTargets = new Set();
  for (const block of layout.blocks) {
    if (block.id === blockId) continue;
    const blockedCells = cellsOf(block).filter((cell) => targetKeys.has(key(cell.row, cell.column)));
    if (!blockedCells.length) continue;
    affected.set(block.id, blockedCells);
    blockedCells.forEach((cell) => coveredTargets.add(key(cell.row, cell.column)));
  }
  // Empty grid holes are outside the owned farmland. Refuse the move instead
  // of silently growing the total area into unowned space.
  if (targetKeys.size === 0 || [...targetKeys].some((cellKey) => !coveredTargets.has(cellKey))) {
    return { ok: false, reason: "no-neighbor", layout };
  }

  const nextBlocks = [];
  const removedIds = [];
  const addedIds = [];
  const splitSources = [];
  const existingIds = new Set(layout.blocks.map((block) => block.id));
  for (const block of layout.blocks) {
    if (block.id === blockId) {
      nextBlocks.push({ ...block, rowStart, rowEnd, colStart, colEnd });
      continue;
    }
    if (!affected.has(block.id)) {
      nextBlocks.push(block);
      continue;
    }
    const blockedKeys = new Set(affected.get(block.id).map((cell) => key(cell.row, cell.column)));
    const remaining = cellsOf(block).filter((cell) => !blockedKeys.has(key(cell.row, cell.column)));
    if (!remaining.length) {
      removedIds.push(block.id);
      continue;
    }
    const rectangles = cellsToRectangles(remaining);
    rectangles.forEach((rectangle, index) => {
      let id = block.id;
      if (index > 0) {
        const baseId = `${block.id}-F${rectangle.rowStart}${rectangle.colStart}${rectangle.rowEnd}${rectangle.colEnd}`;
        id = baseId;
        let suffix = 2;
        while (existingIds.has(id)) {
          id = `${baseId}-${suffix}`;
          suffix += 1;
        }
        existingIds.add(id);
        addedIds.push(id);
        splitSources.push({ id, sourceId: block.id });
      }
      nextBlocks.push({ id, ...rectangle });
    });
  }

  return {
    ok: true,
    layout: { ...layout, blocks: nextBlocks },
    occupiedCells: targetCells.length,
    removedIds,
    addedIds,
    splitSources,
  };
}

export function blockSpan(layout, blockId) {
  const block = layout?.blocks?.find((item) => item.id === blockId);
  if (!block) return null;
  return {
    rows: block.rowEnd - block.rowStart + 1,
    columns: block.colEnd - block.colStart + 1,
    block,
  };
}

import test from "node:test";
import assert from "node:assert/strict";

import {
  createLayoutFromRegion,
  expandLayoutBlock,
  normalizeLayoutForRegion,
  regionFromLayout,
} from "../src/scene/scenarioLayout.js";

function makeRegion(rows = 3, columns = 3) {
  const cells = [];
  for (let row = 1; row <= rows; row += 1) {
    for (let column = 1; column <= columns; column += 1) {
      cells.push({
        id: `Plot-R${String(row).padStart(2, "0")}-C${String(column).padStart(2, "0")}`,
        row,
        column,
        centerXZ: { x: column * 10.4, z: row * 10.4 },
        widthM: 10,
        depthM: 10,
        elevationM: row,
        areaMu: 1,
        plantCountTarget: 150,
        defaultParams: { waterLevelCm: 3 },
      });
    }
  }
  return {
    id: "Plot",
    key: "plain",
    name: "Plain test",
    rows,
    columns,
    leveeWidthM: 0.4,
    cells,
  };
}

function allCells(layout) {
  return layout.blocks.flatMap((block) => {
    const cells = [];
    for (let row = block.rowStart; row <= block.rowEnd; row += 1) {
      for (let column = block.colStart; column <= block.colEnd; column += 1) {
        cells.push(`${row}:${column}`);
      }
    }
    return cells;
  });
}

test("expanding into a one-cell neighbour removes the consumed block", () => {
  const layout = createLayoutFromRegion(makeRegion());
  const result = expandLayoutBlock(layout, "Plot-R02-C02", "right");

  assert.equal(result.ok, true);
  assert.deepEqual(result.removedIds, ["Plot-R02-C03"]);
  assert.deepEqual(
    result.layout.blocks.find((block) => block.id === "Plot-R02-C02"),
    { id: "Plot-R02-C02", rowStart: 2, rowEnd: 2, colStart: 2, colEnd: 3 },
  );
});

test("a partially consumed neighbour is split without overlap", () => {
  const layout = {
    rows: 4,
    columns: 2,
    cellWidthM: 10,
    cellDepthM: 10,
    leveeWidthM: 0.4,
    areaMu: 1,
    rowElevations: [0, 0, 0, 0],
    blocks: [
      { id: "selected", rowStart: 2, rowEnd: 3, colStart: 1, colEnd: 1 },
      { id: "neighbour", rowStart: 1, rowEnd: 4, colStart: 2, colEnd: 2 },
    ],
  };
  const result = expandLayoutBlock(layout, "selected", "right");

  assert.equal(result.ok, true);
  assert.equal(result.removedIds.length, 0);
  assert.equal(result.addedIds.length, 1);
  assert.deepEqual(result.splitSources, [{ id: result.addedIds[0], sourceId: "neighbour" }]);
  assert.equal(allCells(result.layout).length, allCells(layout).length);
  assert.equal(new Set(allCells(result.layout)).size, allCells(result.layout).length);
});

test("boundary and empty-neighbour moves are rejected without mutation", () => {
  const layout = createLayoutFromRegion(makeRegion());
  const boundary = expandLayoutBlock(layout, "Plot-R01-C01", "left");
  assert.equal(boundary.ok, false);
  assert.equal(boundary.reason, "boundary");

  const layoutWithHole = {
    ...layout,
    blocks: layout.blocks.filter((block) => block.id !== "Plot-R02-C03"),
  };
  const emptyNeighbour = expandLayoutBlock(layoutWithHole, "Plot-R02-C02", "right");
  assert.equal(emptyNeighbour.ok, false);
  assert.equal(emptyNeighbour.reason, "no-neighbor");
});

test("every successful expansion preserves the total covered area", () => {
  const layout = createLayoutFromRegion(makeRegion(5, 5));
  let next = layout;
  for (const direction of ["right", "down", "left", "up", "right"]) {
    const result = expandLayoutBlock(next, "Plot-R03-C03", direction);
    assert.equal(result.ok, true);
    next = result.layout;
  }
  const covered = allCells(next);
  assert.equal(covered.length, 25);
  assert.equal(new Set(covered).size, 25);
  assert.equal(Math.min(...next.blocks.map((block) => block.rowStart)), 1);
  assert.equal(Math.max(...next.blocks.map((block) => block.rowEnd)), 5);
  assert.equal(Math.min(...next.blocks.map((block) => block.colStart)), 1);
  assert.equal(Math.max(...next.blocks.map((block) => block.colEnd)), 5);
});

test("regionFromLayout keeps the original boundary and scaled block metadata", () => {
  const base = makeRegion(3, 3);
  const layout = {
    rows: 3,
    columns: 3,
    cellWidthM: 10,
    cellDepthM: 10,
    leveeWidthM: 0.4,
    areaMu: 1,
    rowElevations: [1, 2, 3],
    blocks: [
      { id: "merged", rowStart: 1, rowEnd: 2, colStart: 1, colEnd: 2 },
      { id: "rest-1", rowStart: 1, rowEnd: 3, colStart: 3, colEnd: 3 },
      { id: "rest-2", rowStart: 3, rowEnd: 3, colStart: 1, colEnd: 2 },
    ],
  };
  const region = regionFromLayout(base, layout);
  const merged = region.cells.find((cell) => cell.id === "merged");

  assert.equal(region.totalWidthM, 31.6);
  assert.equal(region.totalDepthM, 31.6);
  assert.equal(merged.widthM, 20.4);
  assert.equal(merged.depthM, 20.4);
  assert.equal(merged.areaMu, 4);
  assert.equal(merged.plantCountTarget, 600);
});

test("normalization rejects overlapping or out-of-bound partitions", () => {
  const base = makeRegion(3, 3);
  const layout = createLayoutFromRegion(base);
  assert.ok(normalizeLayoutForRegion(base, layout));

  const overlap = {
    ...layout,
    blocks: [
      layout.blocks[0],
      { ...layout.blocks[1], rowStart: 1, rowEnd: 1, colStart: 1, colEnd: 1 },
    ],
  };
  assert.equal(normalizeLayoutForRegion(base, overlap), null);

  const outside = {
    ...layout,
    blocks: [{ ...layout.blocks[0], colEnd: 4 }],
  };
  assert.equal(normalizeLayoutForRegion(base, outside), null);

  const missingLand = {
    ...layout,
    blocks: layout.blocks.slice(1),
  };
  assert.equal(normalizeLayoutForRegion(base, missingLand), null);
});

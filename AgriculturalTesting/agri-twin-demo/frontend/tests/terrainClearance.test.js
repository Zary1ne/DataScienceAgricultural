import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildTerrainDecor } from '../src/scene/paddyFieldBuilder.js';
import { REGION_CONFIGS } from '../src/scene/regionConfigs.ts';

function fieldBounds(region) {
  const minX = Math.min(...region.cells.map((cell) => cell.centerXZ.x - cell.widthM / 2));
  const maxX = Math.max(...region.cells.map((cell) => cell.centerXZ.x + cell.widthM / 2));
  const minZ = Math.min(...region.cells.map((cell) => cell.centerXZ.z - cell.depthM / 2));
  const maxZ = Math.max(...region.cells.map((cell) => cell.centerXZ.z + cell.depthM / 2));
  return { minX, maxX, minZ, maxZ };
}

test('terrain decorations never overlap the playable field footprint', () => {
  for (const region of REGION_CONFIGS) {
    const root = new THREE.Group();
    const resources = {
      geometries: new Set(),
      materials: new Set(),
      textures: new Set(),
      instanced: new Set(),
    };
    buildTerrainDecor(root, region, resources);
    root.updateMatrixWorld(true);
    const field = fieldBounds(region);
    const landforms = [];

    root.traverse((object) => {
      if (!object.isMesh) return;
      if (object.userData.terrainLandform) {
        landforms.push(new THREE.Box3().setFromObject(object));
      }
      const boxes = [];
      if (object.isInstancedMesh) {
        object.geometry.computeBoundingBox();
        const instanceMatrix = new THREE.Matrix4();
        for (let index = 0; index < object.count; index += 1) {
          object.getMatrixAt(index, instanceMatrix);
          const box = object.geometry.boundingBox.clone()
            .applyMatrix4(instanceMatrix)
            .applyMatrix4(object.matrixWorld);
          boxes.push(box);
        }
      } else {
        boxes.push(new THREE.Box3().setFromObject(object));
      }
      for (const bounds of boxes) {
        const overlapsX = bounds.min.x < field.maxX && bounds.max.x > field.minX;
        const overlapsZ = bounds.min.z < field.maxZ && bounds.max.z > field.minZ;
        assert.equal(
          overlapsX && overlapsZ,
          false,
          `${region.key} terrain mesh intersects field bounds: ${JSON.stringify(bounds)}`
        );
      }
    });

    for (let first = 0; first < landforms.length; first += 1) {
      for (let second = first + 1; second < landforms.length; second += 1) {
        assert.equal(
          landforms[first].intersectsBox(landforms[second]),
          false,
          `${region.key} landforms overlap: ${first} and ${second}`
        );
      }
    }

    const trees = root.userData.forestTrees || [];
    for (let first = 0; first < trees.length; first += 1) {
      for (let second = first + 1; second < trees.length; second += 1) {
        const firstTree = trees[first];
        const secondTree = trees[second];
        const dx = firstTree[0] - secondTree[0];
        const dz = firstTree[2] - secondTree[2];
        const minimum = (firstTree[3] + secondTree[3]) * 1.45;
        assert.ok(
          dx * dx + dz * dz >= minimum * minimum,
          `${region.key} trees overlap: ${first} and ${second}`
        );
      }
    }

    if (region.key === 'hill') {
      assert.ok(trees.some((tree) => tree[0] < field.minX));
      assert.ok(trees.some((tree) => tree[0] > field.maxX));
      assert.ok(trees.some((tree) => tree[2] < field.minZ));
      assert.ok(trees.some((tree) => tree[2] > field.maxZ));
    }
  }
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const space = require('../src/lib/space.js');

const close = (a, b, tolerance = 1e-12) => Math.abs(a - b) < tolerance;

test('at rest the camera looks along y, with x right and z up', () => {
  const p = space.project({ x: 2, y: 5, z: 3 }, 0, 0);
  assert.equal(p.x, 2);
  assert.equal(p.y, 3);
  assert.equal(p.depth, 5);
});

test('a quarter turn swaps the horizontal axes', () => {
  const p = space.project({ x: 1, y: 0, z: 0 }, Math.PI / 2, 0);
  assert.ok(close(p.x, 0));
  assert.ok(close(p.depth, 1));
});

test('projection preserves length in the plane it turns', () => {
  const point = { x: 3, y: 4, z: 0 };
  for (const yaw of [0, 0.4, 1.2, Math.PI]) {
    const p = space.project(point, yaw, 0);
    assert.ok(close(Math.hypot(p.x, p.depth), 5, 1e-9), `yaw ${yaw}`);
  }
});

test('tilting all the way up looks straight down', () => {
  const p = space.project({ x: 0, y: 1, z: 0 }, 0, Math.PI / 2);
  assert.ok(close(p.y, -1));
  assert.ok(close(p.depth, 0, 1e-9));
});

test('depth grows away from the viewer', () => {
  const near = space.project({ x: 0, y: -1, z: 0 }, 0, 0);
  const far = space.project({ x: 0, y: 1, z: 0 }, 0, 0);
  assert.ok(far.depth > near.depth);
});

test('normalize maps a range onto minus one to one', () => {
  const range = { min: 10, max: 20 };
  assert.equal(space.normalize(10, range), -1);
  assert.equal(space.normalize(20, range), 1);
  assert.equal(space.normalize(15, range), 0);
});

test('normalize survives a range with no width', () => {
  assert.equal(space.normalize(5, { min: 5, max: 5 }), 0);
});

test('bounds ignores what is not finite', () => {
  assert.deepEqual(space.bounds([1, NaN, 3, Infinity, -2]), { min: -2, max: 3 });
  assert.equal(space.bounds([NaN, Infinity]), null);
});

test('bounds pads a flat set so it still has width', () => {
  const flat = space.bounds([7, 7, 7]);
  assert.ok(flat.max > flat.min);
  assert.ok(flat.min < 7 && flat.max > 7);
});

test('sortByDepth paints the far things first', () => {
  const sorted = space.sortByDepth([{ depth: 1 }, { depth: 5 }, { depth: 3 }]);
  assert.deepEqual(sorted.map((s) => s.depth), [5, 3, 1]);
});

test('the unit cube has twelve edges and eight corners', () => {
  const edges = space.boxEdges();
  assert.equal(edges.length, 12);
  const corners = new Set();
  edges.forEach(([a, b]) => {
    corners.add(`${a.x},${a.y},${a.z}`);
    corners.add(`${b.x},${b.y},${b.z}`);
  });
  assert.equal(corners.size, 8);
  edges.forEach(([a, b]) => {
    const length = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    assert.equal(length, 2, 'every edge is a side, not a diagonal');
  });
});

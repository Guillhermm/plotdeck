'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const view = require('../src/lib/view.js');

test('the centre does not move when the span changes', () => {
  const base = { min: -10, max: 10 };
  for (const factor of [0.01, 0.5, 1, 2, 100]) {
    assert.equal(view.center(view.zoom(base, factor)), 0, `factor ${factor}`);
  }
});

test('an off-centre range keeps its own centre', () => {
  const base = { min: 0, max: 10 };
  const zoomed = view.zoom(base, 0.5);
  assert.equal(view.center(zoomed), 5);
  assert.deepEqual(zoomed, { min: 2.5, max: 7.5 });
});

test('the span scales by exactly the factor', () => {
  const base = { min: -4, max: 6 };
  assert.equal(view.span(view.zoom(base, 3)), 30);
  assert.equal(view.span(view.zoom(base, 1)), 10);
});

test('position zero is the measured span', () => {
  assert.equal(view.factorFor(0), 1);
  const base = { min: -10, max: 10 };
  assert.deepEqual(view.zoom(base, view.factorFor(0)), base);
});

test('the slider spans four orders of magnitude, symmetrically', () => {
  assert.ok(Math.abs(view.factorFor(-view.STEPS) - 0.01) < 1e-12);
  assert.ok(Math.abs(view.factorFor(view.STEPS) - 100) < 1e-9);
  assert.ok(Math.abs(view.factorFor(10) - 10) < 1e-12);
});

test('every step is the same ratio', () => {
  const ratio = view.factorFor(1) / view.factorFor(0);
  for (const position of [-7, -1, 4, 12]) {
    assert.ok(Math.abs(view.factorFor(position + 1) / view.factorFor(position) - ratio) < 1e-12);
  }
});

test('positionFor inverts factorFor', () => {
  for (const position of [-20, -6, 0, 3, 20]) {
    assert.equal(view.positionFor(view.factorFor(position)), position);
  }
});

test('a degenerate range still produces a usable window', () => {
  const flat = view.zoom({ min: 2, max: 2 }, 1);
  assert.ok(flat.max > flat.min);
  assert.equal(view.center(flat), 2);
  const atZero = view.zoom({ min: 0, max: 0 }, 1);
  assert.ok(atZero.max > atZero.min);
});

test('zero centring puts zero in the middle and keeps the whole range', () => {
  const framed = view.frameFor({ min: -0.08, max: 1.08 }, true);
  assert.equal(view.center(framed), 0);
  assert.ok(framed.min <= -0.08 && framed.max >= 1.08);
  assert.deepEqual(framed, { min: -1.08, max: 1.08 });
});

test('zero centring leaves a window that only touches zero alone', () => {
  // time from 0, and the domain of a logarithm: centring these would waste half
  assert.deepEqual(view.frameFor({ min: 0, max: 10 }, true), { min: 0, max: 10 });
  assert.deepEqual(view.frameFor({ min: 0.01, max: 10 }, true), { min: 0.01, max: 10 });
  assert.deepEqual(view.frameFor({ min: -10, max: 0 }, true), { min: -10, max: 0 });
});

test('an already symmetric window is unchanged', () => {
  assert.deepEqual(view.frameFor({ min: -10, max: 10 }, true), { min: -10, max: 10 });
});

test('zero centring can be turned off', () => {
  const raw = { min: -0.08, max: 1.08 };
  assert.deepEqual(view.frameFor(raw, false), raw);
});

test('zero centring survives a range that is entirely tiny', () => {
  const framed = view.frameFor({ min: -1e-12, max: 1e-12 }, true);
  assert.equal(view.center(framed), 0);
  assert.ok(framed.max > framed.min);
});

test('zooming a zero centred window keeps zero in the middle', () => {
  const framed = view.frameFor({ min: -0.08, max: 1.08 }, true);
  for (const position of [-8, 0, 5, 20]) {
    assert.equal(view.center(view.zoom(framed, view.factorFor(position))), 0);
  }
});

test('a window that already holds the curve is left exactly as it was', () => {
  const frame = { min: -1, max: 1 };
  assert.equal(view.expandToHold(frame, { min: -0.5, max: 0.5 }), frame);
  assert.equal(view.expandToHold(frame, { min: -1, max: 1 }), frame);
});

test('a window grows past what it has to hold, so growth keeps reading as growth', () => {
  const grown = view.expandToHold({ min: -1, max: 1 }, { min: -3, max: 3 });
  assert.ok(grown.min < -3 && grown.max > 3);
  assert.equal(view.center(grown), 0);
});

test('growing only reacts to leaving, never to shrinking', () => {
  const frame = { min: -5, max: 5 };
  assert.equal(view.expandToHold(frame, { min: -0.1, max: 0.1 }), frame);
});

test('growing copes with nothing to hold', () => {
  const frame = { min: -1, max: 1 };
  assert.equal(view.expandToHold(frame, null), frame);
  assert.deepEqual(view.expandToHold(null, { min: 0, max: 2 }), { min: 0, max: 2 });
});

test('positions are clamped to the ends of the slider', () => {
  assert.equal(view.clampPosition(-99), -view.STEPS);
  assert.equal(view.clampPosition(99), view.STEPS);
  assert.equal(view.clampPosition(3.4), 3);
});

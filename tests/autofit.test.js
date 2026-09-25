'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const autofit = require('../src/lib/autofit.js');
const view = require('../src/lib/view.js');

const base = { min: -1, max: 1 };

test('the step that holds a range is the smallest one that does', () => {
  const step = autofit.stepToHold(base, { min: -3, max: 3 });
  const frame = view.zoom(base, view.factorFor(step));
  assert.ok(autofit.holds(frame, { min: -3, max: 3 }));
  const tighter = view.zoom(base, view.factorFor(step - 1));
  assert.ok(!autofit.holds(tighter, { min: -3, max: 3 }), 'one step in would not fit');
});

test('a position that still works is left alone, so small changes move the curve', () => {
  assert.equal(autofit.chooseStep(base, { min: -0.9, max: 0.9 }, 0), 0);
  assert.equal(autofit.chooseStep(base, { min: -0.5, max: 0.5 }, 0), 0);
});

/** Repeats the adjustment the way a viewer nudging a parameter would. */
const settle = (needed, start = 0, rounds = 12) => {
  let step = start;
  for (let i = 0; i < rounds; i += 1) {
    const next = autofit.chooseStep(base, needed, step);
    if (next === step) return step;
    step = next;
  }
  return step;
};

test('a curve that no longer fits opens the window until it does', () => {
  const needed = { min: -4, max: 4 };
  const step = settle(needed);
  assert.ok(step > 0);
  assert.ok(autofit.holds(view.zoom(base, view.factorFor(step)), needed));
});

test('a curve that has shrunk to nothing pulls the window back in', () => {
  const needed = { min: -0.02, max: 0.02 };
  const step = settle(needed);
  assert.ok(step < 0, 'the window was mostly empty, so it tightened');
  assert.ok(autofit.fillOf(view.zoom(base, view.factorFor(step)), needed) >= autofit.MIN_FILL);
});

test('settling stops rather than oscillating', () => {
  const needed = { min: -4, max: 4 };
  const step = settle(needed);
  assert.equal(autofit.chooseStep(base, needed, step), step);
});

test('fill is the share of the window the curve occupies', () => {
  assert.equal(autofit.fillOf({ min: -1, max: 1 }, { min: -0.5, max: 0.5 }), 0.5);
  assert.equal(autofit.fillOf({ min: 0, max: 0 }, { min: 0, max: 1 }), 0);
});

test('the variation window closes in on where a curve actually moves', () => {
  // flat, then a step in the middle, then flat again
  const samples = [];
  for (let i = 0; i <= 400; i += 1) {
    const x = -100 + (i / 400) * 200;
    samples.push({ x, y: 1 / (1 + Math.exp(-4 * x)) });
  }
  const window = autofit.variationWindow(samples, 0);
  assert.ok(window.max < 10, `expected a tight window, got ${window.max}`);
  assert.ok(window.max > 0.4);
  assert.equal((window.min + window.max) / 2, 0, 'and it stays centred');
});

test('a steeper transition gives a tighter window', () => {
  const build = (k) => {
    const samples = [];
    for (let i = 0; i <= 400; i += 1) {
      const x = -100 + (i / 400) * 200;
      samples.push({ x, y: 1 / (1 + Math.exp(-k * x)) });
    }
    return autofit.variationWindow(samples, 0);
  };
  assert.ok(build(20).max < build(1).max);
});

test('a curve that does nothing has no variation window', () => {
  const flat = [{ x: -1, y: 2 }, { x: 0, y: 2 }, { x: 1, y: 2 }];
  assert.equal(autofit.variationWindow(flat, 0), null);
});

test('values that are not finite do not count as variation', () => {
  const samples = [{ x: -1, y: NaN }, { x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: NaN }];
  const window = autofit.variationWindow(samples, 0);
  assert.ok(window && window.max > 0);
});

test('a curve nothing can hold leaves the control alone', () => {
  assert.equal(autofit.stepToHold(base, { min: -1e30, max: 1e30 }), null);
  assert.equal(autofit.chooseStep(base, { min: -1e30, max: 1e30 }, 2), 2);
});

test('one adjustment is enough, rather than several', () => {
  const far = { min: -60, max: 60 };
  const step = autofit.chooseStep(base, far, 0);
  assert.ok(autofit.holds(view.zoom(base, view.factorFor(step)), far));
  assert.equal(autofit.chooseStep(base, far, step), step, 'and it settles there');
});

test('the fit may be capped, so an unbounded curve cannot blow the window open', () => {
  const far = { min: -50, max: 50 };
  const free = autofit.chooseStep(base, far, 0);
  const capped = autofit.chooseStep(base, far, 0, { maxStep: autofit.MAX_WIDEN });
  assert.ok(free > autofit.MAX_WIDEN, 'without a cap it would go further');
  assert.equal(capped, autofit.MAX_WIDEN);
});

test('a cap does not stop the fit tightening', () => {
  const tiny = { min: -0.001, max: 0.001 };
  const step = autofit.chooseStep(base, tiny, 0, { maxStep: autofit.MAX_WIDEN });
  assert.ok(step < 0, 'zooming in is unaffected by a ceiling on zooming out');
});

test('nothing to fit leaves the slider where it is', () => {
  assert.equal(autofit.chooseStep(null, { min: 0, max: 1 }, 4), 4);
  assert.equal(autofit.chooseStep(base, null, -2), -2);
});

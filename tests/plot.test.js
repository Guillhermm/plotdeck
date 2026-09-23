'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { plan } = require('../src/lib/plan.js');
const plot = require('../src/lib/plot.js');

const BOX = { width: 300, height: 150, pad: 10 };
const planFor = (tex) => {
  const result = plan(tex);
  assert.equal(result.ok, true, tex);
  return result.plan;
};

test('sampling covers the domain end to end', () => {
  const points = plot.sample(planFor('y=x'), {}, 11);
  assert.equal(points.length, 11);
  assert.equal(points[0].x, -10);
  assert.equal(points[10].x, 10);
  assert.equal(points[5].y, 0);
});

test('sliders change the curve', () => {
  const p = planFor('y=kx');
  const flat = plot.sample(p, { k: 0 }, 5).map((s) => s.y);
  const steep = plot.sample(p, { k: 3 }, 5).map((s) => s.y);
  assert.ok(flat.every((y) => y === 0));
  assert.notDeepEqual(steep, flat);
});

test('a pole becomes a gap, not a vertical line', () => {
  const geo = plot.geometry(plot.sample(planFor('y=\\frac{1}{x}'), {}), BOX);
  assert.equal(geo.paths.length, 2);
});

test('the vertical range resists a single asymptote', () => {
  const geo = plot.geometry(plot.sample(planFor('y=\\frac{1}{x}'), {}), BOX);
  assert.ok(geo.range.max < 20, `range was ${geo.range.max}`);
  assert.ok(geo.range.min > -20);
});

test('a bounded curve keeps its own range', () => {
  const geo = plot.geometry(plot.sample(planFor('y=\\sin(x)'), {}), BOX);
  assert.ok(geo.range.min > -1.3 && geo.range.min < -1);
  assert.ok(geo.range.max < 1.3 && geo.range.max > 1);
});

test('geometry stays inside the box', () => {
  const geo = plot.geometry(plot.sample(planFor('y=x^3'), {}), BOX);
  const numbers = geo.paths.join(' ').match(/-?\d+\.\d+/g).map(Number);
  assert.ok(numbers.every((n) => n >= -0.01 && n <= 300.01));
});

test('a constant function still draws', () => {
  const geo = plot.geometry(plot.sample(planFor('y=2x-2x+1'), {}), BOX);
  assert.equal(geo.paths.length, 1);
  assert.ok(geo.range.min < 1 && geo.range.max > 1);
});

test('an everywhere-undefined curve reports nothing to draw', () => {
  const p = planFor('y=\\ln(x)');
  p.domain = { min: -10, max: -1 };
  assert.equal(plot.geometry(plot.sample(p, {}), BOX), null);
});

test('axis lines appear only when zero is in range', () => {
  const inRange = plot.geometry(plot.sample(planFor('y=\\sin(x)'), {}), BOX);
  assert.ok(inRange.axisY !== null && inRange.axisX !== null);
  const shifted = planFor('y=x+100');
  shifted.domain = { min: 1, max: 10 };
  const offRange = plot.geometry(plot.sample(shifted, {}), BOX);
  assert.equal(offRange.axisY, null);
  assert.equal(offRange.axisX, null);
});

test('a frozen frame lets a scale parameter change the picture', () => {
  const p = planFor('y=Lx');
  const base = plot.geometry(plot.sample(p, { L: 1 }), BOX);
  const bigger = plot.geometry(plot.sample(p, { L: 3.5 }), BOX, base.range);
  assert.notEqual(bigger.paths.join(), base.paths.join());
  assert.deepEqual(bigger.range, base.range, 'the frame must not move');
  assert.equal(bigger.escapes, true);
});

test('without a frozen frame a scale parameter is invisible', () => {
  const p = planFor('y=Lx');
  const one = plot.geometry(plot.sample(p, { L: 1 }), BOX);
  const many = plot.geometry(plot.sample(p, { L: 3.5 }), BOX);
  assert.equal(many.paths.join(), one.paths.join(), 'this is the bug the frame fixes');
});

test('escapes is false while the curve fits', () => {
  const p = planFor('y=Lx');
  const base = plot.geometry(plot.sample(p, { L: 1 }), BOX);
  const smaller = plot.geometry(plot.sample(p, { L: 0.5 }), BOX, base.range);
  assert.equal(smaller.escapes, false);
  assert.notEqual(smaller.paths.join(), base.paths.join());
});

test('ticks are round numbers inside the range', () => {
  const values = plot.ticks(-0.08, 1.08, 4);
  assert.deepEqual(values, [0, 0.5, 1]);
  assert.ok(plot.ticks(-10, 10, 4).includes(0));
  assert.ok(plot.ticks(0.01, 10, 4).every((v) => v >= 0.01 && v <= 10));
});

test('ticks survive a degenerate range', () => {
  assert.ok(Array.isArray(plot.ticks(1, 1, 4)));
  assert.ok(plot.ticks(0, 1e-9, 4).length <= 21);
});

test('unionRange takes the outer bounds', () => {
  assert.deepEqual(plot.unionRange({ min: 0, max: 1 }, { min: -2, max: 0.5 }),
    { min: -2, max: 1 });
  assert.deepEqual(plot.unionRange(null, { min: 0, max: 1 }), { min: 0, max: 1 });
});

test('the plot area leaves room for the labels', () => {
  const box = { width: 344, height: 176, padLeft: 40, padRight: 8, padTop: 10, padBottom: 20 };
  const geo = plot.geometry(plot.sample(planFor('y=\\sin(x)'), {}), box);
  assert.equal(geo.plot.left, 40);
  assert.equal(geo.plot.width, 344 - 48);
  assert.equal(geo.plot.height, 176 - 30);
  assert.ok(geo.yTicks.every((t) => t.y >= 10 && t.y <= 156));
});

test('format keeps numbers short', () => {
  assert.equal(plot.format(3.14159), '3.142');
  assert.equal(plot.format(120000), '1.2e+5');
  assert.equal(plot.format(0), '0');
});

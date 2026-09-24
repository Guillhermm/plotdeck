'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const session = require('../src/lib/session.js');

const slide = (tex, extra = {}) => Object.assign({
  tex,
  mode: 'series',
  values: { k: 1 },
  view: { x: 0, y: 0, zoom: 0, yaw: 35, pitch: 25 },
  zeroCentered: true,
  axesPick: [0, 1, 2],
  baseFrame: { min: 0, max: 1 }
}, extra);

test('a fragment is not a different page', () => {
  assert.equal(session.normalizeUrl('https://a.test/x#frag'), 'https://a.test/x');
  assert.equal(session.normalizeUrl('https://a.test/x'), 'https://a.test/x');
  assert.equal(session.normalizeUrl(''), '');
});

test('a slide is identified by its own expression', () => {
  assert.equal(session.keyFor({ tex: 'y = x ^ 2' }), session.keyFor({ tex: 'y=x^2' }));
  assert.notEqual(session.keyFor({ tex: 'y=x^2' }), session.keyFor({ tex: 'y=x^3' }));
});

test('capture and apply make a round trip', () => {
  const before = [slide('y=kx', { mode: 'surface', values: { k: 2.5 }, zeroCentered: false })];
  const state = session.captureState(before, 0);

  const after = [slide('y=kx')];
  const result = session.applyState(after, state);
  assert.equal(result.restored, 1);
  assert.equal(after[0].mode, 'surface');
  assert.equal(after[0].values.k, 2.5);
  assert.equal(after[0].zeroCentered, false);
});

test('the remembered slide is found again after a rescan reorders the page', () => {
  const state = session.captureState([slide('y=a'), slide('y=b', { values: { k: 4 } })], 1);
  const fresh = [slide('y=b'), slide('y=c'), slide('y=a')];
  const result = session.applyState(fresh, state);
  assert.equal(result.restored, 2);
  assert.equal(fresh[0].values.k, 4, 'y=b kept its own value even though it moved');
  assert.equal(fresh[1].values.k, 1, 'the new slide keeps its defaults');
});

test('a value that no longer exists is not forced back on', () => {
  const state = session.captureState([slide('y=kx', { values: { k: 3, gone: 9 } })], 0);
  const fresh = [slide('y=kx')];
  session.applyState(fresh, state);
  assert.equal(fresh[0].values.k, 3);
  assert.ok(!('gone' in fresh[0].values));
});

test('restoring clears the measured frame so it is taken again', () => {
  const fresh = [slide('y=kx')];
  session.applyState(fresh, session.captureState([slide('y=kx')], 0));
  assert.equal(fresh[0].baseFrame, null);
});

test('an index beyond the deck comes back to the start', () => {
  const fresh = [slide('y=a')];
  assert.equal(session.applyState(fresh, { index: 7, slides: [] }).index, 0);
  assert.equal(session.applyState(fresh, { index: -1, slides: [] }).index, 0);
});

test('nothing saved restores nothing, without throwing', () => {
  assert.deepEqual(session.applyState([slide('y=a')], null), { restored: 0, index: 0 });
  assert.deepEqual(session.applyState([slide('y=a')], {}), { restored: 0, index: 0 });
});

test('pruning keeps the most recent pages', () => {
  const sessions = {
    old: { savedAt: 1 }, mid: { savedAt: 5 }, fresh: { savedAt: 9 }
  };
  const kept = session.prune(sessions, 2);
  assert.deepEqual(Object.keys(kept).sort(), ['fresh', 'mid']);
});

test('pruning leaves a small store alone', () => {
  const sessions = { a: { savedAt: 1 } };
  assert.equal(session.prune(sessions, 40), sessions);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { nextIndex, swipeVerdict } = require('../src/lib/deck.js');

test('navigation stops at both ends instead of wrapping', () => {
  assert.equal(nextIndex(0, 5, -1), 0);
  assert.equal(nextIndex(4, 5, 1), 4);
  assert.equal(nextIndex(2, 5, 1), 3);
  assert.equal(nextIndex(2, 5, -1), 1);
});

test('navigation survives a jump beyond the ends', () => {
  assert.equal(nextIndex(0, 5, 99), 4);
  assert.equal(nextIndex(4, 5, -99), 0);
  assert.equal(nextIndex(0, 0, 1), 0);
});

test('a short drag is not a swipe', () => {
  assert.equal(swipeVerdict(10, 0), 0);
  assert.equal(swipeVerdict(-20, 0), 0);
});

test('a long horizontal drag moves one slide', () => {
  assert.equal(swipeVerdict(-90, 5), 1);
  assert.equal(swipeVerdict(90, 5), -1);
});

test('a mostly vertical drag scrolls rather than swipes', () => {
  assert.equal(swipeVerdict(-60, 200), 0);
  assert.equal(swipeVerdict(60, -200), 0);
});

test('the threshold is configurable', () => {
  assert.equal(swipeVerdict(-30, 0, 20), 1);
  assert.equal(swipeVerdict(-30, 0, 80), 0);
});

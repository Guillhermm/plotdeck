'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const extract = require('../src/lib/extract.js');

test('fingerprint ignores presentation differences', () => {
  const asMathml = '{\\displaystyle f(x)={\\frac {L}{1+e^{-k}}}}';
  const asImageAlt = '{\\displaystyle f(x)={\\frac{L}{1+e^{-k}}}}';
  assert.equal(extract.fingerprint(asMathml), extract.fingerprint(asImageAlt));
});

test('fingerprint still separates different formulas', () => {
  assert.notEqual(extract.fingerprint('x^2'), extract.fingerprint('x^3'));
});

test('every source names both a selector and a reader', () => {
  for (const source of extract.SOURCES) {
    assert.equal(typeof source.name, 'string');
    assert.equal(typeof source.selector, 'string');
    assert.equal(typeof source.read, 'function');
  }
});

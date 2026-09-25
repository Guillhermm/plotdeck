'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const extract = require('../src/lib/extract.js');

// extract() walks a DOM. These stand in for one, so the pairing logic that
// joins MathJax's sources back to its rendered containers can be tested here
// rather than only in a browser.
/** @type {any} */ (global).Node = { DOCUMENT_POSITION_FOLLOWING: 4, DOCUMENT_POSITION_PRECEDING: 2 };

/** @returns {any} a stand-in for an Element, with only what extract() touches */
function fakeElement(order) {
  const element = {
    order,
    compareDocumentPosition(other) {
      return other.order > element.order
        ? Node.DOCUMENT_POSITION_FOLLOWING
        : Node.DOCUMENT_POSITION_PRECEDING;
    }
  };
  return element;
}

/** @returns {any} a stand-in for a ParentNode, likewise */
function fakeHost(marked) {
  return {
    querySelectorAll: () => [],
    querySelector: (selector) => {
      const match = selector.match(/data-plotdeck-mathjax="(\d+)"/);
      return match ? (marked[match[1]] || null) : null;
    }
  };
}

test('fingerprint ignores presentation differences', () => {
  const asMathml = '{\\displaystyle f(x)={\\frac {L}{1+e^{-k}}}}';
  const asImageAlt = '{\\displaystyle f(x)={\\frac{L}{1+e^{-k}}}}';
  assert.equal(extract.fingerprint(asMathml), extract.fingerprint(asImageAlt));
});

test('fingerprint still separates different formulas', () => {
  assert.notEqual(extract.fingerprint('x^2'), extract.fingerprint('x^3'));
});

test('MathJax sources are paired back to their rendered containers', () => {
  const marked = { 0: fakeElement(1), 1: fakeElement(2) };
  const found = extract.extract(fakeHost(marked), [
    { index: 0, tex: 'y=x^2' },
    { index: 1, tex: 'y=x^3' }
  ]);
  assert.equal(found.length, 2);
  assert.deepEqual(found.map((item) => item.tex), ['y=x^2', 'y=x^3']);
  assert.ok(found.every((item) => item.source === 'mathjax-runtime'));
  assert.equal(found[0].element, marked[0]);
});

test('a source whose container has gone is skipped, not guessed at', () => {
  const found = extract.extract(fakeHost({ 0: fakeElement(1) }), [
    { index: 0, tex: 'y=x^2' },
    { index: 7, tex: 'y=x^3' }
  ]);
  assert.equal(found.length, 1);
  assert.equal(found[0].tex, 'y=x^2');
});

test('the same expression twice is still one entry', () => {
  const found = extract.extract(fakeHost({ 0: fakeElement(1), 1: fakeElement(2) }), [
    { index: 0, tex: 'y = x^2' },
    { index: 1, tex: 'y=x^{2}' }
  ]);
  assert.equal(found.length, 1);
});

test('an empty source is ignored', () => {
  assert.deepEqual(extract.extract(fakeHost({ 0: fakeElement(1) }), [{ index: 0, tex: '  ' }]), []);
  assert.deepEqual(extract.extract(fakeHost({}), null), []);
});

test('every source names both a selector and a reader', () => {
  for (const source of extract.SOURCES) {
    assert.equal(typeof source.name, 'string');
    assert.equal(typeof source.selector, 'string');
    assert.equal(typeof source.read, 'function');
  }
});

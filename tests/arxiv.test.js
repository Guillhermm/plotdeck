'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { htmlUrl } = require('../src/lib/arxiv.js');

test('a pdf address points at the HTML rendering', () => {
  assert.equal(htmlUrl('https://arxiv.org/pdf/2402.08954'), 'https://arxiv.org/html/2402.08954');
  assert.equal(htmlUrl('https://arxiv.org/pdf/2402.08954v1'), 'https://arxiv.org/html/2402.08954v1');
  assert.equal(htmlUrl('https://arxiv.org/pdf/2402.08954.pdf'), 'https://arxiv.org/html/2402.08954');
});

test('an abstract page does too, since the HTML has the whole paper', () => {
  assert.equal(htmlUrl('https://arxiv.org/abs/1706.03762'), 'https://arxiv.org/html/1706.03762');
});

test('the old identifiers with a subject prefix still work', () => {
  assert.equal(htmlUrl('https://arxiv.org/pdf/math/0309136'), 'https://arxiv.org/html/math/0309136');
});

test('www and a trailing slash make no difference', () => {
  assert.equal(htmlUrl('http://www.arxiv.org/abs/2402.08954/'), 'https://arxiv.org/html/2402.08954');
});

test('an address that is already the HTML is not offered again', () => {
  assert.equal(htmlUrl('https://arxiv.org/html/2402.08954v1'), null);
});

test('anything else is left alone', () => {
  assert.equal(htmlUrl('https://en.wikipedia.org/wiki/Logistic_function'), null);
  assert.equal(htmlUrl('https://arxiv.org/'), null);
  assert.equal(htmlUrl('https://arxiv.org/list/math.CO/recent'), null);
  assert.equal(htmlUrl(''), null);
  assert.equal(htmlUrl(null), null);
});

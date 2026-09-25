'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const exporter = require('../src/lib/export.js');

const WHEN = new Date(2026, 8, 24, 23, 15, 0);

test('the name says where it came from, what it is, and when', () => {
  const name = exporter.downloadName(
    'https://en.wikipedia.org/wiki/Logistic_function', 'f(x)', 'x', WHEN);
  assert.equal(name, 'en-wikipedia-org-wiki-logistic-function_f-x-vs-x_20260924-231500.png');
});

test('two plots from one page are told apart by what they draw', () => {
  const page = 'https://en.wikipedia.org/wiki/Normal_distribution';
  const first = exporter.downloadName(page, 'f(x)', 'x', WHEN);
  const second = exporter.downloadName(page, 'Q(x)', 'x', WHEN);
  assert.notEqual(first, second);
});

test('the same plot twice is told apart by the time', () => {
  const later = new Date(2026, 8, 24, 23, 15, 1);
  assert.notEqual(
    exporter.downloadName('https://a.test/x', 'y', 'x', WHEN),
    exporter.downloadName('https://a.test/x', 'y', 'x', later));
});

test('nothing awkward survives into the file name', () => {
  const name = exporter.downloadName(
    'https://pt.wikipedia.org/wiki/Função_logística', 'σ(θ)', 'θ', WHEN);
  assert.match(name, /^[a-z0-9._-]+\.png$/);
  assert.ok(!name.includes('/'));
  assert.ok(!name.includes(':'));
});

test('an address that is not a URL still yields a usable name', () => {
  assert.match(exporter.downloadName('not a url', 'y', 'x', WHEN), /^not-a-url_y-vs-x_\d{8}-\d{6}\.png$/);
  assert.match(exporter.downloadName('', '', '', WHEN), /^page_plot_\d{8}-\d{6}\.png$/);
});

test('a long address is cut rather than carried whole', () => {
  const long = 'https://example.test/' + 'section/'.repeat(30);
  const name = exporter.downloadName(long, 'y', 'x', WHEN);
  assert.ok(name.length < 120, `name was ${name.length} characters`);
});

test('the timestamp is padded so names sort', () => {
  assert.equal(exporter.stamp(new Date(2026, 0, 2, 3, 4, 5)), '20260102-030405');
});

test('slug keeps letters and digits and nothing else', () => {
  assert.equal(exporter.slug('Hello, World! 42'), 'hello-world-42');
  assert.equal(exporter.slug('---'), '');
});

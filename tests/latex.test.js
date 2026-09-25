'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const latex = require('../src/lib/latex.js');

/** The reason a ParseError carries, which assert.throws hands over untyped. */
const reasonOf = (err) => /** @type {any} */ (err).reason;
const { evaluate, freeSymbols, functionsOnAxis } = require('../src/lib/evaluate.js');

const at = (tex, scope) => evaluate(latex.parse(tex), scope);

test('normalize strips presentation markup', () => {
  assert.equal(latex.normalize('{\\displaystyle x+1}'), 'x+1');
  assert.equal(latex.normalize('$x$'), 'x');
  assert.equal(latex.normalize('\\left(x\\right)'), '(x)');
  assert.equal(latex.normalize('d_{\\text{model}}'), 'd_{model}');
});

test('normalize drops the punctuation that ends the sentence', () => {
  assert.equal(latex.normalize('{\\displaystyle H={\\frac {1}{2}}\\pi ^{2}r^{4}.}'),
    'H={\\frac {1}{2}}\\pi ^{2}r^{4}');
  assert.equal(latex.normalize('x+1,'), 'x+1');
  assert.equal(latex.normalize('y=2.5'), 'y=2.5', 'a decimal point is not punctuation');
});

test('splitBlocks turns a stacked environment into one line each', () => {
  const block = '{\\begin{aligned}x_{0}&=r\\cos \\psi \\\\x_{1}&=r\\sin \\psi \\end{aligned}}';
  const lines = latex.splitBlocks(block);
  assert.equal(lines.length, 2);
  assert.equal(lines[0], 'x_{0} =r\\cos \\psi');
  assert.ok(lines[1].startsWith('x_{1}'));
});

test('splitBlocks keeps the value and drops the condition in cases', () => {
  const block = '\\begin{cases}x & x>0 \\\\ -x & x<0\\end{cases}';
  assert.deepEqual(latex.splitBlocks(block), ['x', '-x']);
});

test('splitBlocks leaves a matrix alone, since it is one object', () => {
  const matrix = '\\begin{pmatrix}a\\\\b\\end{pmatrix}';
  assert.deepEqual(latex.splitBlocks(matrix), [matrix]);
});

test('splitBlocks always returns a list', () => {
  assert.deepEqual(latex.splitBlocks('x+1'), ['x+1']);
  assert.equal(latex.splitBlocks('').length, 1);
});

test('normalize keeps braces it cannot safely drop', () => {
  assert.equal(latex.normalize('{a}+{b}'), '{a}+{b}');
});

test('arithmetic and precedence', () => {
  assert.equal(at('1+2*3'), 7);
  assert.equal(at('2^3^2'), 512); // right associative
  assert.equal(at('-2^2'), -4);
  assert.equal(at('(1+2)*3'), 9);
});

test('implicit multiplication', () => {
  assert.equal(at('2x', { x: 5 }), 10);
  assert.equal(at('xy', { x: 3, y: 4 }), 12);
  assert.equal(at('2\\pi'), 2 * Math.PI);
  assert.equal(at('k(x-1)', { k: 2, x: 4 }), 6);
});

test('fractions, roots and powers', () => {
  assert.equal(at('\\frac{1}{4}'), 0.25);
  assert.equal(at('\\sqrt{9}'), 3);
  assert.ok(Math.abs(at('\\sqrt[3]{27}') - 3) < 1e-12);
  assert.equal(at('\\frac{x^2}{2}', { x: 4 }), 8);
});

test('functions, with and without parentheses', () => {
  assert.equal(at('\\sin(0)'), 0);
  assert.equal(at('\\cos 0'), 1);
  assert.ok(Math.abs(at('\\sin^{2}(x)+\\cos^{2}(x)', { x: 1.3 }) - 1) < 1e-12);
  assert.equal(at('\\ln(e)'), 1);
  assert.equal(at('|x|', { x: -4 }), 4);
});

test('subscripts become part of the symbol name', () => {
  assert.deepEqual(freeSymbols(latex.parse('x_{0}+x_1')), ['x_0', 'x_1']);
  assert.equal(at('x_{0}', { x_0: 7 }), 7);
});

test('e and pi are constants, not free symbols', () => {
  assert.deepEqual(freeSymbols(latex.parse('e^{x}+\\pi')), ['x']);
});

test('unsupported notation is rejected by name', () => {
  const cases = {
    '\\int_0^1 x': 'unsupported-integral',
    '\\sum_{i=1}^n i': 'unsupported-summation',
    '\\lim_{x\\to 0} x': 'unsupported-limit',
    '\\mathbf{v}': 'unsupported-vector or matrix',
    '\\begin{matrix}a\\end{matrix}': 'unsupported-environment',
    '\\frac{\\partial f}{\\partial x}': 'unsupported-derivative'
  };
  for (const [tex, reason] of Object.entries(cases)) {
    assert.throws(() => latex.parse(tex), (err) => reasonOf(err) === reason, tex);
  }
});

test('unknown commands are rejected rather than ignored', () => {
  assert.throws(() => latex.parse('\\foo{x}'), (err) => reasonOf(err) === 'unknown-command');
});

test('comparisons are not functions', () => {
  assert.throws(() => latex.parse('x < 1'), (err) => reasonOf(err) === 'not-a-function');
  assert.throws(() => latex.parse('x \\leq 1'), (err) => reasonOf(err) === 'not-a-function');
});

test('trailing input is an error, not silently dropped', () => {
  assert.throws(() => latex.parse('1+2)'), /trailing|expected/);
});

test('splitRelation splits only at the top level', () => {
  assert.deepEqual(latex.splitRelation('y=x+1'), ['y', 'x+1']);
  assert.deepEqual(latex.splitRelation('a=b=c').length, 3);
  assert.deepEqual(latex.splitRelation('f(x)=\\frac{a}{b}'), ['f(x)', '\\frac{a}{b}']);
});

test('functionsOnAxis ignores functions applied only to parameters', () => {
  const ast = latex.parse('\\frac{1}{\\sqrt{2\\pi s}}e^{-x}');
  assert.deepEqual(functionsOnAxis(ast, 'x'), []);
  assert.deepEqual(functionsOnAxis(latex.parse('\\sin(x)'), 'x'), ['sin']);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { plan } = require('../src/lib/plan.js');

const reason = (tex) => {
  const result = plan(tex);
  assert.equal(result.ok, false, `expected rejection for ${tex}`);
  return result.reason;
};

test('an explicit function declares its own axis', () => {
  const result = plan('f(x)=x^2');
  assert.equal(result.ok, true);
  assert.equal(result.plan.axis, 'x');
  assert.equal(result.plan.axisChoice, 'declared');
  assert.equal(result.plan.label, 'f(x)');
  assert.deepEqual(result.plan.sliders, []);
});

test('every symbol that is not the axis becomes a slider', () => {
  const result = plan('{\\displaystyle f(x)={\\frac {L}{1+e^{-k(x-x_{0})}}}}');
  assert.equal(result.ok, true);
  assert.deepEqual(result.plan.sliders.map((s) => s.name), ['L', 'k', 'x_0']);
  assert.ok(result.plan.sliders.every((s) => s.min < s.value && s.value < s.max));
});

test('the axis follows convention when the left side is a bare symbol', () => {
  assert.equal(plan('y=3t+1').plan.axis, 't');
  assert.equal(plan('y=a\\theta').plan.axis, 'theta');
  assert.equal(plan('y=3t+1').plan.axisChoice, 'convention');
  // n is conventional too, so a genuine fallback needs symbols outside the list
  assert.equal(plan('E=mc^2').plan.axisChoice, 'fallback');
});

test('a single unconventional symbol is still an axis', () => {
  const result = plan('N=2q');
  assert.equal(result.ok, true);
  assert.equal(result.plan.axis, 'q');
});

test('the domain reacts to the functions applied to the axis', () => {
  assert.deepEqual(plan('y=\\ln(x)').plan.domain, { min: 0.01, max: 10 });
  assert.equal(plan('y=\\sin(x)').plan.domain.max.toFixed(4), (2 * Math.PI).toFixed(4));
  assert.deepEqual(plan('y=x^2').plan.domain, { min: -10, max: 10 });
  // sqrt over a parameter must not clamp the axis to positives
  assert.equal(plan('f(x)=\\frac{1}{\\sqrt{2\\pi s}}e^{-x^2}').plan.domain.min, -10);
});

test('a bare expression is plotted as y', () => {
  const result = plan('\\frac{1}{1+e^{-x}}');
  assert.equal(result.ok, true);
  assert.equal(result.plan.kind, 'expression');
  assert.equal(result.plan.label, 'y');
  assert.equal(result.plan.axis, 'x');
});

test('a bare expression needs substance and a conventional variable', () => {
  assert.equal(reason('x'), 'trivial-expression');
  assert.equal(reason('abc'), 'no-axis-variable');
  assert.equal(reason('2+2'), 'constant');
});

test('each rejection has its own reason', () => {
  assert.equal(reason('a=b=c'), 'chained-relation');
  assert.equal(reason('x^2+y^2=1'), 'implicit-relation');
  assert.equal(reason('N=6'), 'constant');
  assert.equal(reason('\\int_0^1 f=1'), 'unsupported-integral');
  assert.equal(reason('y=\\sum_{i=1}^{n} i'), 'unsupported-summation');
  assert.equal(reason('y=ax+b+c+d+e_1'), 'too-many-parameters');
  assert.equal(reason('y=a+b+c+d+e_1+f_1'), 'no-axis-variable');
  assert.equal(reason('x=x'), 'self-referential');
});

test('asymptotic notation is not multiplication', () => {
  assert.equal(reason('O(n^2 d)'), 'asymptotic-notation');
  assert.equal(reason('T=O(n\\log n)'), 'asymptotic-notation');
  assert.equal(reason('y=\\Theta(n)'), 'asymptotic-notation');
  // a lone capital letter times a group is still ordinary multiplication
  assert.equal(plan('y=k(x-x_0)').ok, true);
});

test('an unknown operator name is rejected, a known one is a function', () => {
  assert.equal(reason('f(x)=\\mathrm{softmax}(x)'), 'unsupported-unknown operator');
  assert.equal(plan('y=\\mathrm{log}(x)').ok, true);
});

test('a multi-letter subscript stays part of the symbol name', () => {
  const { freeSymbols } = require('../src/lib/evaluate.js');
  const latex = require('../src/lib/latex.js');
  assert.deepEqual(freeSymbols(latex.parse('d_{\\mathrm{model}}')), ['d_model']);
});

test('a declared argument that never appears is rejected', () => {
  assert.equal(reason('f(x)=a+b'), 'argument-unused');
});

test('plans carry an evaluable tree', () => {
  const result = plan('y=x^2');
  const { evaluate } = require('../src/lib/evaluate.js');
  assert.equal(evaluate(result.plan.ast, { x: 3 }), 9);
});

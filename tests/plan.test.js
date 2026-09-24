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
  assert.equal(reason('x^2+y^2=1'), 'implicit-relation');
  assert.equal(reason('N=6'), 'constant');
  assert.equal(reason('\\int_0^1 f=1'), 'unsupported-integral');
  assert.equal(reason('y=\\sum_{i=1}^{n} i'), 'unsupported-summation');
  assert.equal(reason('y=ax+b+c+d+e_1'), 'too-many-parameters');
  assert.equal(reason('y=a+b+c+d+e_1+f_1'), 'no-axis-variable');
  assert.equal(reason('x=x'), 'self-referential');
});

test('a chain is read from its outer ends', () => {
  const result = plan('q=e^{\\tau \\psi }=\\cos \\psi +\\tau \\sin \\psi');
  assert.equal(result.ok, true);
  assert.equal(result.plan.label, 'q');
  assert.equal(result.plan.axis, 'psi');
  assert.deepEqual(result.plan.sliders.map((s) => s.name), ['tau']);
});

test('angles are conventional independent variables', () => {
  assert.equal(plan('x_0=r\\cos \\psi').plan.axis, 'psi');
  assert.equal(plan('y=a\\sin \\phi').plan.axis, 'phi');
  assert.equal(plan('y=a\\sin \\eta').plan.axis, 'eta');
});

test('the imaginary unit is refused, a real variable named i is not', () => {
  assert.equal(reason('z=x+iy'), 'complex-valued');
  assert.equal(reason('z_1=e^{i\\xi }\\sin \\eta'), 'complex-valued');
  assert.equal(reason('\\tau =(\\cos \\theta )i+(\\sin \\theta )j'), 'complex-valued');
  // an interest rate is a perfectly real i
  const real = plan('A=P(1+i)^n');
  assert.equal(real.ok, true);
  assert.ok(real.plan.sliders.map((s) => s.name).includes('i'));
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

test('every plan carries a series list', () => {
  const single = plan('y=x^2').plan;
  assert.equal(single.series.length, 1);
  assert.equal(single.series[0].label, 'y');
  assert.equal(plan('2x+1').plan.series.length, 1);
});

test('lines that share a parameter are grouped onto one pair of axes', () => {
  const latex = require('../src/lib/latex.js');
  const block = '\\begin{aligned}x_{0}&=r\\cos \\psi \\\\x_{1}&=r\\sin \\psi \\cos \\theta'
    + '\\\\x_{2}&=r\\sin \\psi \\sin \\theta \\end{aligned}';
  const plans = latex.splitBlocks(block).map((p) => plan(p)).filter((r) => r.ok).map((r) => r.plan);
  const group = require('../src/lib/plan.js').groupPlans(plans);
  assert.equal(group.ok, true);
  assert.equal(group.plan.kind, 'system');
  assert.equal(group.plan.axis, 'psi');
  assert.equal(group.plan.axisChoice, 'shared');
  assert.equal(group.plan.series.length, 3);
  assert.deepEqual(group.plan.sliders.map((s) => s.name), ['r', 'theta']);
  assert.deepEqual(group.members, [0, 1, 2]);
});

test('the shared axis is the one the most lines depend on', () => {
  const { groupPlans } = require('../src/lib/plan.js');
  const plans = ['y=at', 'z=bt', 'w=a'].map((t) => plan(t).plan);
  const group = groupPlans(plans);
  assert.equal(group.plan.axis, 't');
  assert.deepEqual(group.members, [0, 1], 'the line without the axis is left out');
});

test('grouping needs at least two lines that share the axis', () => {
  const { groupPlans } = require('../src/lib/plan.js');
  assert.equal(groupPlans([plan('y=x').plan]).ok, false);
  assert.equal(groupPlans(['y=ax', 'z=bt'].map((t) => plan(t).plan)).reason, 'no-shared-axis');
});

test('a group refuses more parameters than it can show', () => {
  const { groupPlans } = require('../src/lib/plan.js');
  // each line is fine on its own; together they need six sliders
  const plans = ['y=atbc', 'z=tdgh'].map((t) => plan(t).plan);
  assert.equal(groupPlans(plans).reason, 'too-many-parameters');
});

test('plans carry an evaluable tree', () => {
  const result = plan('y=x^2');
  const { evaluate } = require('../src/lib/evaluate.js');
  assert.equal(evaluate(result.plan.ast, { x: 3 }), 9);
});

/**
 * Turns an extracted LaTeX string into a plot plan, or says why it cannot.
 *
 * The rule that makes this work without a model: do not try to decide whether
 * an equation is "plottable". Pick the axis by convention, make every other
 * symbol a slider, and reject only notation that genuinely cannot be drawn.
 */
(function (root) {
  'use strict';

  var latex = root.PlotDeckLatex || (typeof require === 'function' ? require('./latex.js') : null);
  var evaluate = root.PlotDeckEvaluate || (typeof require === 'function' ? require('./evaluate.js') : null);

  // Conventional independent variables, most conventional first.
  var AXIS_PREFERENCE = ['x', 't', 'theta', 'u', 'v', 's', 'r', 'n', 'z', 'y'];
  var MAX_SLIDERS = 4;

  // Big-O and its relatives look exactly like multiplication by a symbol.
  var ASYMPTOTIC = /(^|[^a-zA-Z\\])[Oo]\s*\(|\\(?:Theta|Omega)\s*\(/;

  /** A bare symbol, or a function declaration such as f(x) or \sigma(t). */
  function readLeftSide(tex) {
    var s = latex.normalize(tex);
    var declaration = s.match(/^([a-zA-Z](?:_\{?[a-zA-Z0-9]+\}?)?|\\[a-zA-Z]+)\s*\(\s*([a-zA-Z](?:_\{?[a-zA-Z0-9]+\}?)?|\\[a-zA-Z]+)\s*\)$/);
    if (declaration) {
      return { form: 'function', name: clean(declaration[1]), argument: clean(declaration[2]) };
    }
    var symbol = s.match(/^([a-zA-Z](?:_\{?[a-zA-Z0-9]+\}?)?|\\[a-zA-Z]+)$/);
    if (symbol) {
      return { form: 'symbol', name: clean(symbol[1]) };
    }
    return { form: 'expression' };
  }

  function clean(name) {
    return name.replace(/^\\/, '').replace(/[{}]/g, '');
  }

  function domainFor(functions, symbols) {
    var has = function (name) { return functions.indexOf(name) !== -1; };
    if (has('ln') || has('log')) return { min: 0.01, max: 10 };
    if (has('sqrt')) return { min: 0, max: 10 };
    if (has('sin') || has('cos') || has('tan')) return { min: -2 * Math.PI, max: 2 * Math.PI };
    if (has('exp')) return { min: -4, max: 4 };
    if (symbols.indexOf('t') !== -1) return { min: 0, max: 10 };
    return { min: -10, max: 10 };
  }

  function slidersFor(names) {
    return names.map(function (name) {
      return { name: name, value: 1, min: -5, max: 5, step: 0.1 };
    });
  }

  /**
   * @param {string} tex
   * @returns {{ok: true, plan: object} | {ok: false, reason: string, detail?: string}}
   */
  function plan(tex) {
    var normalized = latex.normalize(tex);
    if (ASYMPTOTIC.test(normalized)) {
      return { ok: false, reason: 'asymptotic-notation' };
    }

    // Scan the whole relation first: notation we cannot draw is a more useful
    // answer than the structural complaint that would otherwise come first.
    try {
      latex.tokenize(latex.normalize(tex));
    } catch (err) {
      if (err.reason && err.reason !== 'parse-failed') {
        return { ok: false, reason: err.reason, detail: err.message };
      }
    }

    var parts;
    try {
      parts = latex.splitRelation(tex);
    } catch (err) {
      return { ok: false, reason: err.reason || 'parse-failed', detail: err.message };
    }

    if (parts.length > 2) return { ok: false, reason: 'chained-relation' };
    // A bare expression is still a curve: plot it as y, but only when it names
    // a conventional variable and is more than a single symbol, or every stray
    // letter on the page would become a slide.
    if (parts.length === 1) return planExpression(parts[0]);

    var left = readLeftSide(parts[0]);
    if (left.form === 'expression') return { ok: false, reason: 'implicit-relation' };

    var ast;
    try {
      ast = latex.parse(parts[1]);
    } catch (err) {
      return { ok: false, reason: err.reason || 'parse-failed', detail: err.message };
    }

    var symbols = evaluate.freeSymbols(ast);

    if (!symbols.length) return { ok: false, reason: 'constant' };

    var axis;
    var axisChoice = 'convention';
    if (left.form === 'function') {
      axisChoice = 'declared';
      axis = left.argument;
      if (symbols.indexOf(axis) === -1) return { ok: false, reason: 'argument-unused' };
    } else {
      for (var i = 0; i < AXIS_PREFERENCE.length && !axis; i += 1) {
        if (symbols.indexOf(AXIS_PREFERENCE[i]) !== -1) axis = AXIS_PREFERENCE[i];
      }
      if (!axis && symbols.length === 1) axis = symbols[0];
      // No conventional variable: fall back to the first symbol, but say so,
      // because the choice of axis is a guess rather than a convention.
      if (!axis && symbols.length <= 2) {
        axis = symbols[0];
        axisChoice = 'fallback';
      }
      if (!axis) return { ok: false, reason: 'no-axis-variable' };
      if (axis === left.name) return { ok: false, reason: 'self-referential' };
    }

    var parameters = symbols.filter(function (name) { return name !== axis; });
    if (parameters.length > MAX_SLIDERS) {
      return { ok: false, reason: 'too-many-parameters', detail: parameters.join(', ') };
    }

    var functions = evaluate.functionsOnAxis(ast, axis);
    return {
      ok: true,
      plan: {
        label: left.form === 'function' ? left.name + '(' + axis + ')' : left.name,
        kind: 'equation',
        axis: axis,
        axisChoice: axisChoice,
        ast: ast,
        sliders: slidersFor(parameters),
        domain: domainFor(functions, symbols),
        functions: functions
      }
    };
  }

  function nodeCount(node) {
    if (!node || typeof node !== 'object') return 0;
    return 1 + ['left', 'right', 'arg'].reduce(function (total, key) {
      return total + nodeCount(node[key]);
    }, 0);
  }

  function planExpression(tex) {
    var ast;
    try {
      ast = latex.parse(tex);
    } catch (err) {
      return { ok: false, reason: err.reason || 'parse-failed', detail: err.message };
    }
    if (nodeCount(ast) < 3) return { ok: false, reason: 'trivial-expression' };

    var symbols = evaluate.freeSymbols(ast);
    if (!symbols.length) return { ok: false, reason: 'constant' };

    var axis = null;
    for (var i = 0; i < AXIS_PREFERENCE.length && !axis; i += 1) {
      if (symbols.indexOf(AXIS_PREFERENCE[i]) !== -1) axis = AXIS_PREFERENCE[i];
    }
    if (!axis) return { ok: false, reason: 'no-axis-variable' };

    var parameters = symbols.filter(function (name) { return name !== axis; });
    if (parameters.length > MAX_SLIDERS) {
      return { ok: false, reason: 'too-many-parameters', detail: parameters.join(', ') };
    }

    return {
      ok: true,
      plan: {
        label: 'y',
        kind: 'expression',
        axis: axis,
        axisChoice: 'convention',
        ast: ast,
        sliders: slidersFor(parameters),
        domain: domainFor(evaluate.functionsOnAxis(ast, axis), symbols),
        functions: evaluate.functionsOnAxis(ast, axis)
      }
    };
  }

  var api = {
    plan: plan,
    planExpression: planExpression,
    readLeftSide: readLeftSide,
    AXIS_PREFERENCE: AXIS_PREFERENCE
  };
  root.PlotDeckPlan = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

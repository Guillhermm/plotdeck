/** Walks the tree produced by latex.js: numbers out, free symbols listed. */
(function (root) {
  'use strict';

  var latex = root.PlotDeckLatex || (typeof require === 'function' ? require('./latex.js') : null);

  function evaluate(node, scope) {
    switch (node.type) {
      case 'num': return node.value;
      case 'sym':
        if (Object.prototype.hasOwnProperty.call(latex.CONSTANTS, node.name)) {
          return latex.CONSTANTS[node.name];
        }
        if (node.name === 'e') return Math.E;
        if (scope && Object.prototype.hasOwnProperty.call(scope, node.name)) {
          return scope[node.name];
        }
        return NaN;
      case 'add': return evaluate(node.left, scope) + evaluate(node.right, scope);
      case 'sub': return evaluate(node.left, scope) - evaluate(node.right, scope);
      case 'mul': return evaluate(node.left, scope) * evaluate(node.right, scope);
      case 'div': return evaluate(node.left, scope) / evaluate(node.right, scope);
      case 'pow': return Math.pow(evaluate(node.left, scope), evaluate(node.right, scope));
      case 'neg': return -evaluate(node.arg, scope);
      case 'call': {
        var fn = latex.FUNCTIONS[node.name];
        if (!fn) return NaN;
        return fn(evaluate(node.arg, scope));
      }
      default: return NaN;
    }
  }

  /** Every symbol that is not a known constant, in first-appearance order. */
  function freeSymbols(node, found) {
    var out = found || [];
    if (!node || typeof node !== 'object') return out;
    if (node.type === 'sym') {
      var isConstant = Object.prototype.hasOwnProperty.call(latex.CONSTANTS, node.name)
        || node.name === 'e';
      if (!isConstant && out.indexOf(node.name) === -1) out.push(node.name);
      return out;
    }
    ['left', 'right', 'arg'].forEach(function (key) {
      if (node[key]) freeSymbols(node[key], out);
    });
    return out;
  }

  /** Which named functions the tree uses, so a domain can be chosen. */
  function functionsUsed(node, found) {
    var out = found || [];
    if (!node || typeof node !== 'object') return out;
    if (node.type === 'call' && out.indexOf(node.name) === -1) out.push(node.name);
    ['left', 'right', 'arg'].forEach(function (key) {
      if (node[key]) functionsUsed(node[key], out);
    });
    return out;
  }

  /** Functions whose argument actually contains the axis variable. */
  function functionsOnAxis(node, axis, found) {
    var out = found || [];
    if (!node || typeof node !== 'object') return out;
    if (node.type === 'call' && freeSymbols(node.arg).indexOf(axis) !== -1) {
      if (out.indexOf(node.name) === -1) out.push(node.name);
    }
    ['left', 'right', 'arg'].forEach(function (key) {
      if (node[key]) functionsOnAxis(node[key], axis, out);
    });
    return out;
  }

  var api = {
    evaluate: evaluate,
    freeSymbols: freeSymbols,
    functionsUsed: functionsUsed,
    functionsOnAxis: functionsOnAxis
  };
  root.PlotDeckEvaluate = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

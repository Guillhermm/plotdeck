/**
 * LaTeX to abstract syntax tree, for the subset of notation that can be drawn.
 *
 * Deliberately narrow. Anything outside the subset is rejected by name rather
 * than parsed badly, so the caller can report why an equation produced no
 * slide. No model, no heuristics beyond the notation itself.
 */
(function (root) {
  'use strict';

  var GREEK = ('alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta '
    + 'iota kappa lambda mu nu xi rho sigma varsigma tau upsilon phi varphi chi psi omega '
    + 'Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega').split(' ');

  // pi is a constant rather than a free symbol, so it is not in GREEK above.
  var CONSTANTS = { pi: Math.PI };

  var FUNCTIONS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    exp: Math.exp, ln: Math.log, log: Math.log10,
    sec: function (x) { return 1 / Math.cos(x); },
    csc: function (x) { return 1 / Math.sin(x); },
    cot: function (x) { return 1 / Math.tan(x); },
    abs: Math.abs, sgn: Math.sign, floor: Math.floor, ceil: Math.ceil,
    // \sqrt gets its own token because of the optional degree, but it still
    // needs an entry here for the evaluator to find.
    sqrt: Math.sqrt
  };

  /** Notation that is real mathematics but outside what a 2D plot can show. */
  var UNSUPPORTED = {
    int: 'integral', iint: 'integral', iiint: 'integral', oint: 'integral',
    sum: 'summation', prod: 'product', lim: 'limit', limsup: 'limit', liminf: 'limit',
    begin: 'environment', end: 'environment',
    partial: 'derivative', nabla: 'vector calculus',
    mathbf: 'vector or matrix', mathbb: 'set notation', vec: 'vector',
    binom: 'binomial', choose: 'binomial', substack: 'environment',
    infty: 'infinity', cdots: 'ellipsis', ldots: 'ellipsis', dots: 'ellipsis',
    vdots: 'ellipsis', ddots: 'ellipsis',
    forall: 'quantifier', exists: 'quantifier',
    pm: 'ambiguous sign', mp: 'ambiguous sign',
    operatorname: 'unknown operator', overline: 'notation', hat: 'notation',
    tilde: 'notation', bar: 'notation', dot: 'notation', ddot: 'notation'
  };

  var RELATIONS = {
    leq: '<=', geq: '>=', neq: '!=', approx: '~', equiv: '==', propto: 'prop',
    sim: '~', ll: '<', gg: '>', subset: 'subset', in: 'in', to: 'to', mapsto: 'to'
  };

  /** Strips presentation-only markup so the parser sees mathematics. */
  function normalize(tex) {
    var s = String(tex);
    s = s.replace(/^\s*\$+|\$+\s*$/g, '');
    s = s.replace(/\\(?:displaystyle|textstyle|scriptstyle|scriptscriptstyle|limits|nolimits)\b\s*/g, '');
    s = s.replace(/\\(?:left|right|big|Big|bigg|Bigg)\b\s*/g, '');
    s = s.replace(/\\[,;:!]|\\quad|\\qquad|\\ |~/g, ' ');
    s = s.replace(/\\(?:mathrm|mathit|text|textrm|mathsf|mathtt)\s*\{([^{}]*)\}/g,
      function (match, body, offset, whole) {
        var name = body.trim();
        if (name.length < 2) return name;
        // \mathrm{log} is the function, not the product l times o times g.
        if (Object.prototype.hasOwnProperty.call(FUNCTIONS, name.toLowerCase())) {
          return '\\' + name.toLowerCase();
        }
        // Inside a subscript it is a label, so it stays part of the name.
        var before = whole.slice(0, offset).replace(/\s+$/, '');
        if (/_\{?$/.test(before)) return name;
        // Anywhere else a multi-letter run is an operator we do not know.
        return '\\operatorname';
      });
    s = s.replace(/\\(?:cdot|times)\b/g, '*');
    s = s.replace(/\\div\b/g, '/');
    s = s.replace(/\\%/g, '%');
    s = s.trim();
    // A formula that ends a sentence carries the full stop inside the math.
    s = s.replace(/[.,;:]+$/, '').trim();
    // Unwrap a single pair of braces around the whole expression.
    while (/^\{[\s\S]*\}$/.test(s) && balanced(s.slice(1, -1))) {
      s = s.slice(1, -1).trim();
      s = s.replace(/[.,;:]+$/, '').trim();
    }
    return s;
  }

  function balanced(s) {
    var depth = 0;
    for (var i = 0; i < s.length; i += 1) {
      if (s[i] === '{') depth += 1;
      else if (s[i] === '}') depth -= 1;
      if (depth < 0) return false;
    }
    return depth === 0;
  }

  // Environments that stack one equation per line. Matrix environments are not
  // here on purpose: those are a single object, not a list.
  var SYSTEMS = /\\begin\{(aligned|align\*?|alignat\*?|gathered|gather\*?|split|cases|eqnarray\*?)\}(?:\{[^{}]*\})?([\s\S]*?)\\end\{\1\}/;

  /**
   * Splits a stacked environment into one expression per line. Everything else
   * comes back as a single item, so callers can always treat the result as a
   * list.
   */
  function splitBlocks(tex) {
    var match = String(tex).match(SYSTEMS);
    if (!match) return [String(tex)];
    var isCases = /^cases/.test(match[1]);
    return match[2]
      .split(/\\\\(?:\s*\[[^\]]*\])?/)
      .map(function (line) {
        // In cases the ampersand separates the value from its condition; in the
        // aligned family it only marks where the equals signs line up.
        var body = isCases ? line.split('&')[0] : line.replace(/&/g, ' ');
        return body.trim();
      })
      .filter(function (line) { return line.length > 0; });
  }

  function ParseError(message, reason) {
    this.name = 'ParseError';
    this.message = message;
    this.reason = reason || 'parse-failed';
  }
  ParseError.prototype = Object.create(Error.prototype);

  function tokenize(src) {
    var tokens = [];
    var i = 0;
    while (i < src.length) {
      var ch = src[i];
      if (/\s/.test(ch)) { i += 1; continue; }
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        var num = '';
        while (i < src.length && /[0-9.]/.test(src[i])) { num += src[i]; i += 1; }
        tokens.push({ type: 'number', value: parseFloat(num) });
        continue;
      }
      if (ch === '\\') {
        var name = '';
        i += 1;
        while (i < src.length && /[a-zA-Z]/.test(src[i])) { name += src[i]; i += 1; }
        if (!name) {
          // An escaped delimiter such as \{ or \|.
          tokens.push({ type: 'op', value: src[i] });
          i += 1;
          continue;
        }
        if (Object.prototype.hasOwnProperty.call(UNSUPPORTED, name)) {
          throw new ParseError('unsupported: \\' + name, 'unsupported-' + UNSUPPORTED[name]);
        }
        if (Object.prototype.hasOwnProperty.call(RELATIONS, name)) {
          throw new ParseError('relation: \\' + name, 'not-a-function');
        }
        if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
          tokens.push({ type: 'frac' });
        } else if (name === 'sqrt') {
          tokens.push({ type: 'sqrt' });
        } else if (Object.prototype.hasOwnProperty.call(FUNCTIONS, name)) {
          tokens.push({ type: 'func', value: name });
        } else if (GREEK.indexOf(name) !== -1 || Object.prototype.hasOwnProperty.call(CONSTANTS, name)) {
          tokens.push({ type: 'ident', value: name });
        } else {
          throw new ParseError('unknown command: \\' + name, 'unknown-command');
        }
        continue;
      }
      if (/[a-zA-Z]/.test(ch)) {
        tokens.push({ type: 'ident', value: ch });
        i += 1;
        continue;
      }
      if ('+-*/^_(){}[]|='.indexOf(ch) !== -1) {
        tokens.push({ type: 'op', value: ch });
        i += 1;
        continue;
      }
      if ('<>'.indexOf(ch) !== -1) {
        throw new ParseError('comparison: ' + ch, 'not-a-function');
      }
      throw new ParseError('unexpected character: ' + ch, 'parse-failed');
    }
    return tokens;
  }

  /** Recursive descent with implicit multiplication between adjacent atoms. */
  function Parser(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  Parser.prototype.peek = function (offset) {
    return this.tokens[this.pos + (offset || 0)] || null;
  };

  Parser.prototype.next = function () {
    var token = this.tokens[this.pos];
    this.pos += 1;
    return token;
  };

  Parser.prototype.expect = function (type, value) {
    var token = this.next();
    if (!token || token.type !== type || (value !== undefined && token.value !== value)) {
      throw new ParseError('expected ' + (value || type));
    }
    return token;
  };

  Parser.prototype.isOp = function (value, offset) {
    var token = this.peek(offset);
    return !!token && token.type === 'op' && token.value === value;
  };

  /** A braced group, or a single atom where LaTeX allows the braces to be dropped. */
  Parser.prototype.parseGroup = function () {
    if (this.isOp('{')) {
      this.next();
      var expr = this.parseExpression();
      this.expect('op', '}');
      return expr;
    }
    return this.parseAtomWithPower();
  };

  Parser.prototype.parseIdentifier = function () {
    var token = this.next();
    var name = token.value;
    if (this.isOp('_')) {
      this.next();
      name += '_' + this.parseSubscript();
    }
    return { type: 'sym', name: name };
  };

  /** Subscripts are part of the symbol name, not an operation. */
  Parser.prototype.parseSubscript = function () {
    if (this.isOp('{')) {
      this.next();
      var parts = [];
      var depth = 0;
      while (this.peek()) {
        if (this.isOp('}') && depth === 0) break;
        if (this.isOp('{')) depth += 1;
        if (this.isOp('}')) depth -= 1;
        var token = this.next();
        parts.push(token.value === undefined ? '' : String(token.value));
      }
      this.expect('op', '}');
      return parts.join('');
    }
    var single = this.next();
    if (!single) throw new ParseError('empty subscript');
    return String(single.value);
  };

  Parser.prototype.parseAtom = function () {
    var token = this.peek();
    if (!token) throw new ParseError('unexpected end of expression');

    if (token.type === 'number') {
      this.next();
      return { type: 'num', value: token.value };
    }
    if (token.type === 'ident') {
      return this.parseIdentifier();
    }
    if (token.type === 'frac') {
      this.next();
      var numerator = this.parseGroup();
      var denominator = this.parseGroup();
      return { type: 'div', left: numerator, right: denominator };
    }
    if (token.type === 'sqrt') {
      this.next();
      var degree = null;
      if (this.isOp('[')) {
        this.next();
        degree = this.parseExpression();
        this.expect('op', ']');
      }
      var radicand = this.parseGroup();
      if (!degree) return { type: 'call', name: 'sqrt', arg: radicand };
      return { type: 'pow', left: radicand, right: { type: 'div', left: { type: 'num', value: 1 }, right: degree } };
    }
    if (token.type === 'func') {
      this.next();
      var power = null;
      if (this.isOp('^')) {
        this.next();
        power = this.parseGroup();
      }
      var arg = this.parseFunctionArgument();
      var call = { type: 'call', name: token.value, arg: arg };
      return power ? { type: 'pow', left: call, right: power } : call;
    }
    if (token.type === 'op' && token.value === '(') {
      this.next();
      var inner = this.parseExpression();
      this.expect('op', ')');
      return inner;
    }
    if (token.type === 'op' && token.value === '{') {
      return this.parseGroup();
    }
    if (token.type === 'op' && token.value === '|') {
      this.next();
      var body = this.parseExpression();
      this.expect('op', '|');
      return { type: 'call', name: 'abs', arg: body };
    }
    if (token.type === 'op' && token.value === '-') {
      this.next();
      return { type: 'neg', arg: this.parseAtomWithPower() };
    }
    if (token.type === 'op' && token.value === '+') {
      this.next();
      return this.parseAtomWithPower();
    }
    throw new ParseError('unexpected token: ' + (token.value || token.type));
  };

  /** sin x binds one atom; sin(x) binds the parenthesised group. */
  Parser.prototype.parseFunctionArgument = function () {
    if (this.isOp('(')) {
      this.next();
      var inner = this.parseExpression();
      this.expect('op', ')');
      return inner;
    }
    return this.parseAtomWithPower();
  };

  Parser.prototype.parseAtomWithPower = function () {
    var base = this.parseAtom();
    if (this.isOp('^')) {
      this.next();
      var exponent = this.parseGroup();
      return { type: 'pow', left: base, right: exponent };
    }
    return base;
  };

  /** True when the next token could begin an atom, which means implicit times. */
  Parser.prototype.startsAtom = function () {
    var token = this.peek();
    if (!token) return false;
    if (token.type === 'number' || token.type === 'ident' || token.type === 'func'
      || token.type === 'frac' || token.type === 'sqrt') return true;
    return token.type === 'op' && (token.value === '(' || token.value === '{');
  };

  Parser.prototype.parseUnary = function () {
    if (this.isOp('-')) {
      this.next();
      return { type: 'neg', arg: this.parseUnary() };
    }
    if (this.isOp('+')) {
      this.next();
      return this.parseUnary();
    }
    var node = this.parseAtomWithPower();
    while (this.startsAtom()) {
      node = { type: 'mul', left: node, right: this.parseAtomWithPower() };
    }
    return node;
  };

  Parser.prototype.parseTerm = function () {
    var node = this.parseUnary();
    while (this.isOp('*') || this.isOp('/')) {
      var op = this.next().value;
      var right = this.parseUnary();
      node = { type: op === '*' ? 'mul' : 'div', left: node, right: right };
    }
    return node;
  };

  Parser.prototype.parseExpression = function () {
    var node = this.parseTerm();
    while (this.isOp('+') || this.isOp('-')) {
      var op = this.next().value;
      var right = this.parseTerm();
      node = { type: op === '+' ? 'add' : 'sub', left: node, right: right };
    }
    return node;
  };

  /** Parses a complete expression, rejecting trailing junk. */
  function parse(tex) {
    var tokens = tokenize(normalize(tex));
    if (!tokens.length) throw new ParseError('empty expression', 'empty');
    var parser = new Parser(tokens);
    var ast = parser.parseExpression();
    if (parser.pos < tokens.length) {
      var left = parser.peek();
      throw new ParseError('trailing input: ' + (left.value || left.type));
    }
    return ast;
  }

  /** Splits on the top-level = signs, ignoring any inside braces or brackets. */
  function splitRelation(tex) {
    var s = normalize(tex);
    var parts = [];
    var depth = 0;
    var current = '';
    for (var i = 0; i < s.length; i += 1) {
      var ch = s[i];
      if ('{[('.indexOf(ch) !== -1) depth += 1;
      if ('}])'.indexOf(ch) !== -1) depth -= 1;
      if (ch === '=' && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
      current += ch;
    }
    parts.push(current);
    return parts.map(function (part) { return part.trim(); });
  }

  var api = {
    CONSTANTS: CONSTANTS,
    FUNCTIONS: FUNCTIONS,
    GREEK: GREEK,
    UNSUPPORTED: UNSUPPORTED,
    ParseError: ParseError,
    normalize: normalize,
    splitBlocks: splitBlocks,
    tokenize: tokenize,
    parse: parse,
    splitRelation: splitRelation
  };

  root.PlotDeckLatex = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

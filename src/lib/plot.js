/** Sampling and geometry. Pure: takes a plan, returns numbers and path data. */
(function (root) {
  'use strict';

  var evaluate = root.PlotDeckEvaluate || (typeof require === 'function' ? require('./evaluate.js') : null);

  var SAMPLES = 480;

  function sample(plan, values, samples) {
    var count = samples || SAMPLES;
    var scope = Object.assign({}, values || {});
    var step = (plan.domain.max - plan.domain.min) / (count - 1);
    var points = new Array(count);
    for (var i = 0; i < count; i += 1) {
      var x = plan.domain.min + i * step;
      scope[plan.axis] = x;
      points[i] = { x: x, y: evaluate.evaluate(plan.ast, scope) };
    }
    return points;
  }

  /**
   * Samples a function of two variables over a rectangle, for a surface mesh.
   *
   * @returns {{a: number[], b: number[], z: number[][]}} z[i][j] is the value at
   *   a[i], b[j]. Values that are not finite are kept as they are, so the caller
   *   can leave a hole rather than guess.
   */
  function grid(ast, axisA, axisB, domainA, domainB, values, steps) {
    var count = steps || 24;
    var scope = Object.assign({}, values || {});
    var a = new Array(count);
    var b = new Array(count);
    var stepA = (domainA.max - domainA.min) / (count - 1);
    var stepB = (domainB.max - domainB.min) / (count - 1);
    for (var i = 0; i < count; i += 1) {
      a[i] = domainA.min + i * stepA;
      b[i] = domainB.min + i * stepB;
    }
    var z = new Array(count);
    for (var row = 0; row < count; row += 1) {
      z[row] = new Array(count);
      scope[axisA] = a[row];
      for (var column = 0; column < count; column += 1) {
        scope[axisB] = b[column];
        z[row][column] = evaluate.evaluate(ast, scope);
      }
    }
    return { a: a, b: b, z: z };
  }

  function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    var index = (sorted.length - 1) * q;
    var lower = Math.floor(index);
    var upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  }

  /** The band holding the middle of the values, ignoring the extreme tails. */
  function coreRange(points, low, high) {
    var ys = points.map(function (p) { return p.y; })
      .filter(function (y) { return Number.isFinite(y); })
      .sort(function (a, b) { return a - b; });
    if (!ys.length) return null;
    var min = quantile(ys, low === undefined ? 0.05 : low);
    var max = quantile(ys, high === undefined ? 0.95 : high);
    if (min === max) {
      var pad = Math.abs(min) > 1e-9 ? Math.abs(min) * 0.2 : 0.5;
      return { min: min - pad, max: max + pad };
    }
    return { min: min, max: max };
  }

  /**
   * A range that survives asymptotes. Using raw min and max would let a single
   * pole near a division by zero flatten the whole curve into a line.
   */
  function verticalRange(points) {
    var ys = points.map(function (p) { return p.y; })
      .filter(function (y) { return Number.isFinite(y); })
      .sort(function (a, b) { return a - b; });
    if (!ys.length) return null;

    var median = quantile(ys, 0.5);
    var spread = quantile(ys, 0.75) - quantile(ys, 0.25);
    var min = ys[0];
    var max = ys[ys.length - 1];
    if (spread > 0) {
      min = Math.max(min, median - 8 * spread);
      max = Math.min(max, median + 8 * spread);
    }
    if (min === max) {
      var pad = Math.abs(min) > 1e-9 ? Math.abs(min) * 0.2 : 1;
      min -= pad;
      max += pad;
    }
    var margin = (max - min) * 0.08;
    return { min: min - margin, max: max + margin };
  }

  /** The range that holds every series, so one frame fits them all. */
  function combinedRange(pointsList) {
    var total = null;
    for (var i = 0; i < pointsList.length; i += 1) {
      total = unionRange(total, verticalRange(pointsList[i]));
    }
    return total;
  }

  /** The smallest range containing both. */
  function unionRange(a, b) {
    if (!a) return b;
    if (!b) return a;
    return { min: Math.min(a.min, b.min), max: Math.max(a.max, b.max) };
  }

  /** A round step near span / count: 1, 2 or 5 times a power of ten. */
  function niceStep(span, count) {
    if (!(span > 0)) return 1;
    var raw = span / (count || 4);
    var magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    var normalized = raw / magnitude;
    var step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return step * magnitude;
  }

  /** Round values inside [min, max], for axis labels. */
  function ticks(min, max, count) {
    var step = niceStep(max - min, count);
    var out = [];
    var first = Math.ceil(min / step) * step;
    for (var value = first; value <= max + step * 1e-6; value += step) {
      out.push(Math.abs(value) < step * 1e-6 ? 0 : value);
      if (out.length > 20) break;
    }
    return out;
  }

  function padding(box) {
    if (typeof box.pad === 'number') {
      return { left: box.pad, right: box.pad, top: box.pad, bottom: box.pad };
    }
    return {
      left: box.padLeft || 0, right: box.padRight || 0,
      top: box.padTop || 0, bottom: box.padBottom || 0
    };
  }

  /**
   * Builds SVG path strings, broken wherever the curve leaves the view or the
   * value stops being finite, so poles are gaps rather than vertical lines.
   *
   * `frozen` holds the vertical frame still while a slider moves. It is used
   * rather than the natural range because a scale parameter stretches the data
   * and the natural axis by the same factor, so the drawing never changes. With
   * the frame fixed, the curve visibly grows and leaves the top, and the tick
   * labels stay put to say by how much. `escapes` reports that, so the caller
   * can offer to refit.
   */
  function geometry(points, box, frozen) {
    var natural = verticalRange(points);
    if (!natural) return null;
    var range = frozen || natural;
    var xMin = points[0].x;
    var xMax = points[points.length - 1].x;
    var pad = padding(box);
    var inner = {
      w: box.width - pad.left - pad.right,
      h: box.height - pad.top - pad.bottom
    };

    var toX = function (x) { return pad.left + ((x - xMin) / (xMax - xMin)) * inner.w; };
    var toY = function (y) { return pad.top + inner.h - ((y - range.min) / (range.max - range.min)) * inner.h; };

    var paths = [];
    var current = [];
    var span = range.max - range.min;
    // Generous, so a curve that grows past the frame is still drawn up to the
    // clip edge rather than vanishing.
    var slack = span * 6;
    var jump = span * 4;
    var previous = null;
    for (var i = 0; i < points.length; i += 1) {
      var p = points[i];
      var visible = Number.isFinite(p.y)
        && p.y > range.min - slack && p.y < range.max + slack;
      // A step this large between neighbours is a pole, not a steep curve.
      var broke = previous !== null && Number.isFinite(p.y)
        && Math.abs(p.y - previous) > jump;
      if (!visible || broke) {
        if (current.length > 1) paths.push(current.join(' '));
        current = [];
        previous = Number.isFinite(p.y) ? p.y : null;
        if (!visible) continue;
      }
      previous = p.y;
      current.push((current.length ? 'L' : 'M') + toX(p.x).toFixed(2) + ',' + toY(p.y).toFixed(2));
    }
    if (current.length > 1) paths.push(current.join(' '));

    return {
      paths: paths,
      range: range,
      natural: natural,
      escapes: natural.min < range.min - (range.max - range.min) * 0.02
        || natural.max > range.max + (range.max - range.min) * 0.02,
      xRange: { min: xMin, max: xMax },
      axisY: range.min <= 0 && range.max >= 0 ? toY(0) : null,
      axisX: xMin <= 0 && xMax >= 0 ? toX(0) : null,
      plot: { left: pad.left, top: pad.top, width: inner.w, height: inner.h },
      yTicks: ticks(range.min, range.max, 4).map(function (v) {
        return { value: v, y: toY(v) };
      }),
      xTicks: ticks(xMin, xMax, 4).map(function (v) {
        return { value: v, x: toX(v) };
      })
    };
  }

  function format(value) {
    if (!Number.isFinite(value)) return '';
    var abs = Math.abs(value);
    if (abs !== 0 && (abs < 0.001 || abs >= 10000)) return value.toExponential(1);
    return String(Math.round(value * 1000) / 1000);
  }

  var api = {
    sample: sample,
    grid: grid,
    verticalRange: verticalRange,
    coreRange: coreRange,
    unionRange: unionRange,
    combinedRange: combinedRange,
    niceStep: niceStep,
    ticks: ticks,
    geometry: geometry,
    format: format,
    SAMPLES: SAMPLES
  };
  root.PlotDeckPlot = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

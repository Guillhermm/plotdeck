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

  function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    var index = (sorted.length - 1) * q;
    var lower = Math.floor(index);
    var upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
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

  /**
   * Builds SVG path strings, broken wherever the curve leaves the view or the
   * value stops being finite, so poles are gaps rather than vertical lines.
   */
  function geometry(points, box) {
    var range = verticalRange(points);
    if (!range) return null;
    var xMin = points[0].x;
    var xMax = points[points.length - 1].x;
    var width = box.width;
    var height = box.height;
    var pad = box.pad || 0;
    var inner = { w: width - pad * 2, h: height - pad * 2 };

    var toX = function (x) { return pad + ((x - xMin) / (xMax - xMin)) * inner.w; };
    var toY = function (y) { return pad + inner.h - ((y - range.min) / (range.max - range.min)) * inner.h; };

    var paths = [];
    var current = [];
    var slack = (range.max - range.min) * 2;
    for (var i = 0; i < points.length; i += 1) {
      var p = points[i];
      var visible = Number.isFinite(p.y)
        && p.y > range.min - slack && p.y < range.max + slack;
      if (!visible) {
        if (current.length > 1) paths.push(current.join(' '));
        current = [];
        continue;
      }
      current.push((current.length ? 'L' : 'M') + toX(p.x).toFixed(2) + ',' + toY(p.y).toFixed(2));
    }
    if (current.length > 1) paths.push(current.join(' '));

    return {
      paths: paths,
      range: range,
      xRange: { min: xMin, max: xMax },
      axisY: range.min <= 0 && range.max >= 0 ? toY(0) : null,
      axisX: xMin <= 0 && xMax >= 0 ? toX(0) : null
    };
  }

  function format(value) {
    if (!Number.isFinite(value)) return '';
    var abs = Math.abs(value);
    if (abs !== 0 && (abs < 0.001 || abs >= 10000)) return value.toExponential(1);
    return String(Math.round(value * 1000) / 1000);
  }

  var api = { sample: sample, verticalRange: verticalRange, geometry: geometry, format: format, SAMPLES: SAMPLES };
  root.PlotDeckPlot = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

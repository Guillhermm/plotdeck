/**
 * Three dimensions on a flat screen. Pure: points in, points out.
 *
 * Orthographic rather than perspective, because these are graphs. A parallel
 * projection keeps equal steps equal everywhere, so a viewer can still read
 * distances off the picture after turning it.
 */
(function (root) {
  'use strict';

  /**
   * Turns the scene about the vertical axis, then tilts it towards the viewer.
   *
   * At yaw 0 and pitch 0 the camera looks along +y, so x runs to the right and
   * z runs up. `depth` grows away from the viewer, which is the order to paint
   * in, back to front.
   */
  function project(point, yaw, pitch) {
    var cosYaw = Math.cos(yaw);
    var sinYaw = Math.sin(yaw);
    var across = point.x * cosYaw - point.y * sinYaw;
    var into = point.x * sinYaw + point.y * cosYaw;
    var cosPitch = Math.cos(pitch);
    var sinPitch = Math.sin(pitch);
    return {
      x: across,
      y: point.z * cosPitch - into * sinPitch,
      depth: point.z * sinPitch + into * cosPitch
    };
  }

  /** Maps a value in [range.min, range.max] onto [-1, 1]. */
  function normalize(value, range) {
    var span = range.max - range.min;
    if (!(span > 0)) return 0;
    return ((value - range.min) / span) * 2 - 1;
  }

  function bounds(values) {
    var min = Infinity;
    var max = -Infinity;
    for (var i = 0; i < values.length; i += 1) {
      var value = values[i];
      if (!Number.isFinite(value)) continue;
      if (value < min) min = value;
      if (value > max) max = value;
    }
    if (min > max) return null;
    if (min === max) {
      var pad = Math.abs(min) > 1e-9 ? Math.abs(min) * 0.1 : 0.5;
      return { min: min - pad, max: max + pad };
    }
    return { min: min, max: max };
  }

  /** Far first, so nearer strokes land on top. */
  function sortByDepth(items) {
    return items.slice().sort(function (a, b) { return b.depth - a.depth; });
  }

  /** The twelve edges of the unit cube, as pairs of corners. */
  function boxEdges() {
    var corners = [];
    for (var i = 0; i < 8; i += 1) {
      corners.push({
        x: (i & 1) ? 1 : -1,
        y: (i & 2) ? 1 : -1,
        z: (i & 4) ? 1 : -1
      });
    }
    var edges = [];
    for (var a = 0; a < 8; a += 1) {
      for (var b = a + 1; b < 8; b += 1) {
        var differences = (corners[a].x !== corners[b].x ? 1 : 0)
          + (corners[a].y !== corners[b].y ? 1 : 0)
          + (corners[a].z !== corners[b].z ? 1 : 0);
        if (differences === 1) edges.push([corners[a], corners[b]]);
      }
    }
    return edges;
  }

  var api = {
    project: project,
    normalize: normalize,
    bounds: bounds,
    sortByDepth: sortByDepth,
    boxEdges: boxEdges
  };

  root.PlotDeckSpace = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

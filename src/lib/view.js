/**
 * The window on each axis: a centre that does not move and a span the viewer
 * controls. Pure, so the zoom behaviour can be tested without a browser.
 *
 * A span control rather than a pair of bounds means the curve stays centred by
 * construction, and one slider covers four orders of magnitude, which typing
 * bounds cannot do comfortably.
 */
(function (root) {
  'use strict';

  // Slider positions run from -STEPS to STEPS. Ten steps is one decade, so the
  // ends are 0.01x and 100x the measured span and every step is the same ratio.
  var STEPS = 20;
  var PER_DECADE = 10;

  function center(range) {
    return (range.min + range.max) / 2;
  }

  function span(range) {
    return range.max - range.min;
  }

  /** Position on the slider to a multiplier of the measured span. */
  function factorFor(position) {
    return Math.pow(10, position / PER_DECADE);
  }

  function positionFor(factor) {
    return Math.round(Math.log(factor) / Math.LN10 * PER_DECADE);
  }

  /** Scales a range about its own centre, so the middle stays put. */
  function zoom(range, factor) {
    if (!range) return null;
    var middle = center(range);
    var half = span(range) * factor / 2;
    if (!(half > 0)) half = Math.abs(middle) > 1e-9 ? Math.abs(middle) * 0.5 : 0.5;
    return { min: middle - half, max: middle + half };
  }

  function clampPosition(position) {
    if (position < -STEPS) return -STEPS;
    if (position > STEPS) return STEPS;
    return Math.round(position);
  }

  var api = {
    STEPS: STEPS,
    center: center,
    span: span,
    zoom: zoom,
    factorFor: factorFor,
    positionFor: positionFor,
    clampPosition: clampPosition
  };

  root.PlotDeckView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

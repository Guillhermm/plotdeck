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

  /** The smallest window about zero that still holds the whole range. */
  function centerZero(range) {
    var reach = Math.max(Math.abs(range.min), Math.abs(range.max));
    if (!(reach > 0)) reach = 0.5;
    return { min: -reach, max: reach };
  }

  /**
   * Puts zero in the middle when zero is genuinely inside the measured range.
   *
   * The test is strict on purpose. A window of 0 to 10 over time, or 0.01 to 10
   * under a logarithm, only touches zero at its edge, and centring those on
   * zero would spend half the picture where the function does not exist.
   */
  function frameFor(range, zeroCentered) {
    if (!range) return null;
    if (!zeroCentered) return range;
    if (!(range.min < 0 && range.max > 0)) return range;
    return centerZero(range);
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
    centerZero: centerZero,
    frameFor: frameFor,
    factorFor: factorFor,
    positionFor: positionFor,
    clampPosition: clampPosition
  };

  root.PlotDeckView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

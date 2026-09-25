/**
 * Choosing the window for you, through the controls rather than behind them.
 *
 * Auto-fitting by quietly moving the frame leaves the sliders describing a view
 * that is no longer on screen. So the fit is expressed as a slider position: the
 * control moves, the reading stays true, and the viewer can take it back.
 *
 * Because the slider is geometric the fit lands on discrete steps, which is also
 * what keeps a scale parameter visible. Between two steps the curve grows inside
 * a fixed frame, exactly as before; only when it no longer fits does the step,
 * and the slider, move.
 */
(function (root) {
  'use strict';

  var view = root.PlotDeckView || (typeof require === 'function' ? require('./view.js') : null);

  var MIN_FILL = 0.3;
  var VARIATION = 0.92;
  // How far the fit may open the horizontal window past what the planner chose.
  // A curve that grows without bound puts nearly all of its variation at the
  // edges, so the rule alone would zoom out until the interesting part is a
  // vertical line. The planner's window is the better starting guess.
  var MAX_WIDEN = 6;

  function holds(frame, needed) {
    return needed.min >= frame.min && needed.max <= frame.max;
  }

  function fillOf(frame, needed) {
    var span = frame.max - frame.min;
    if (!(span > 0)) return 0;
    return (needed.max - needed.min) / span;
  }

  /**
   * The lowest slider step whose window still contains what has to be seen, or
   * null when nothing on the slider can hold it. A curve that grows without
   * bound has no honest window, and forcing the control to its end would only
   * trade a curve off the top for a flat line at the bottom.
   */
  function stepToHold(base, needed) {
    if (!base || !needed) return null;
    for (var step = -view.STEPS; step <= view.STEPS; step += 1) {
      if (holds(view.zoom(base, view.factorFor(step)), needed)) return step;
    }
    return null;
  }

  /**
   * Where the slider should sit.
   *
   * The current position is kept while it works, so a small parameter change
   * moves the curve rather than the control. It gives way when the curve no
   * longer fits, or when it has shrunk so far that the picture is mostly empty.
   */
  function chooseStep(base, needed, current, options) {
    if (!base || !needed) return current;
    var settings = options || {};
    var minFill = settings.minFill || MIN_FILL;
    var frame = view.zoom(base, view.factorFor(current));
    if (holds(frame, needed) && fillOf(frame, needed) >= minFill) return current;

    // Measured against easing towards the answer over several adjustments: going
    // straight there kept more of the curve on screen on every page tried.
    var wanted = stepToHold(base, needed);
    if (wanted === null) return current;
    if (settings.maxStep !== undefined && wanted > settings.maxStep) return settings.maxStep;
    if (settings.minStep !== undefined && wanted < settings.minStep) return settings.minStep;
    return wanted;
  }

  /**
   * The part of the horizontal window where the curve actually does something.
   *
   * Sampled over the widest window the slider allows, this is the smallest
   * window about the centre holding most of the total variation, which is what
   * keeps a transition on screen when a parameter makes it narrow or wide.
   */
  function variationWindow(samples, center, fraction) {
    var want = fraction || VARIATION;
    var total = 0;
    var deltas = new Array(samples.length);
    for (var i = 1; i < samples.length; i += 1) {
      var previous = samples[i - 1].y;
      var value = samples[i].y;
      var step = (Number.isFinite(previous) && Number.isFinite(value))
        ? Math.abs(value - previous) : 0;
      deltas[i] = step;
      total += step;
    }
    if (!(total > 0)) return null;

    var middle = 0;
    for (var j = 1; j < samples.length; j += 1) {
      if (Math.abs(samples[j].x - center) < Math.abs(samples[middle].x - center)) middle = j;
    }

    var low = middle;
    var high = middle;
    var captured = 0;
    var target = total * want;
    while (captured < target && (low > 0 || high < samples.length - 1)) {
      var leftGain = low > 0 ? deltas[low] : -1;
      var rightGain = high < samples.length - 1 ? deltas[high + 1] : -1;
      if (rightGain >= leftGain) {
        high += 1;
        captured += rightGain;
      } else {
        low -= 1;
        captured += leftGain;
      }
    }

    var reach = Math.max(Math.abs(samples[low].x - center), Math.abs(samples[high].x - center));
    if (!(reach > 0)) return null;
    return { min: center - reach, max: center + reach };
  }

  var api = {
    MIN_FILL: MIN_FILL,
    VARIATION: VARIATION,
    MAX_WIDEN: MAX_WIDEN,
    holds: holds,
    fillOf: fillOf,
    stepToHold: stepToHold,
    chooseStep: chooseStep,
    variationWindow: variationWindow
  };

  root.PlotDeckAutofit = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

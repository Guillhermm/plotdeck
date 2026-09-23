/** Navigation arithmetic for the deck. Pure, so it can be tested directly. */
(function (root) {
  'use strict';

  /** Clamps rather than wraps: the ends of a deck should feel like ends. */
  function nextIndex(current, total, step) {
    if (total <= 0) return 0;
    var target = current + step;
    if (target < 0) return 0;
    if (target > total - 1) return total - 1;
    return target;
  }

  /**
   * Reads a drag. A gesture only counts when it is mostly horizontal, so
   * scrolling a tall slide never flips to the next one.
   *
   * @returns {-1|0|1} slides to move
   */
  function swipeVerdict(dx, dy, threshold) {
    var limit = threshold || 48;
    if (Math.abs(dx) < limit) return 0;
    if (Math.abs(dx) < Math.abs(dy) * 1.2) return 0;
    return dx < 0 ? 1 : -1;
  }

  var api = { nextIndex: nextIndex, swipeVerdict: swipeVerdict };
  root.PlotDeckDeck = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/**
 * Remembering a page between visits.
 *
 * What is worth keeping is not the equations, which take a few milliseconds to
 * read again and come back with live references into the document, but what the
 * viewer did with them: which slide, which parameters, which view. So a session
 * is keyed on the expression itself and reattached after a fresh scan.
 */
(function (root) {
  'use strict';

  var LIMIT = 40;

  /** The address without the fragment, since a hash is the same document. */
  function normalizeUrl(url) {
    var value = String(url || '');
    var hash = value.indexOf('#');
    return hash === -1 ? value : value.slice(0, hash);
  }

  /** Identifies a slide by its own content, so a rescan can find it again. */
  function keyFor(slide) {
    return String(slide.tex || '').replace(/\s+/g, '').slice(0, 160);
  }

  function captureState(slides, index) {
    return {
      index: index || 0,
      savedAt: Date.now(),
      slides: slides.map(function (slide) {
        return {
          key: keyFor(slide),
          mode: slide.mode,
          values: Object.assign({}, slide.values),
          view: Object.assign({}, slide.view),
          zeroCentered: slide.zeroCentered,
          autofit: slide.autofit,
          axesPick: slide.axesPick ? slide.axesPick.slice() : undefined
        };
      })
    };
  }

  /**
   * Puts a remembered session back onto freshly scanned slides.
   *
   * A page that changed since the visit simply matches fewer slides; anything
   * unmatched keeps its defaults rather than borrowing another slide's state.
   *
   * @returns {{restored: number, index: number}}
   */
  function applyState(slides, state) {
    if (!state || !Array.isArray(state.slides)) return { restored: 0, index: 0 };
    var byKey = {};
    state.slides.forEach(function (saved) {
      if (saved && saved.key && !byKey[saved.key]) byKey[saved.key] = saved;
    });

    var restored = 0;
    slides.forEach(function (slide) {
      var saved = byKey[keyFor(slide)];
      if (!saved) return;
      restored += 1;
      if (saved.mode) slide.mode = saved.mode;
      if (saved.zeroCentered !== undefined) slide.zeroCentered = saved.zeroCentered;
      if (saved.autofit !== undefined) slide.autofit = saved.autofit;
      if (saved.axesPick) slide.axesPick = saved.axesPick.slice();
      if (saved.view) slide.view = Object.assign({}, slide.view, saved.view);
      if (saved.values) {
        Object.keys(saved.values).forEach(function (name) {
          if (Object.prototype.hasOwnProperty.call(slide.values, name)) {
            slide.values[name] = saved.values[name];
          }
        });
      }
      slide.baseFrame = null;
    });

    var index = Number(state.index) || 0;
    if (index < 0 || index >= slides.length) index = 0;
    return { restored: restored, index: index };
  }

  /** Keeps the most recently saved pages and drops the rest. */
  function prune(sessions, limit) {
    var cap = limit || LIMIT;
    var keys = Object.keys(sessions || {});
    if (keys.length <= cap) return sessions;
    keys.sort(function (a, b) {
      return (sessions[b].savedAt || 0) - (sessions[a].savedAt || 0);
    });
    var kept = {};
    keys.slice(0, cap).forEach(function (key) { kept[key] = sessions[key]; });
    return kept;
  }

  var api = {
    LIMIT: LIMIT,
    normalizeUrl: normalizeUrl,
    keyFor: keyFor,
    captureState: captureState,
    applyState: applyState,
    prune: prune
  };

  root.PlotDeckSession = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

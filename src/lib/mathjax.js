/**
 * Reading MathJax's own record of the page.
 *
 * MathJax v2 left the TeX in the document as a script tag, which the ordinary
 * extractor finds. From v3 it keeps the source in its own objects instead, and
 * those live in the page's world rather than the extension's, so nothing in an
 * isolated content script can see them.
 *
 * `read` is therefore written to be handed to `chrome.scripting.executeScript`
 * with `world: "MAIN"`, which serializes the function and runs it in the page.
 * It must stay self contained: no closures, no references to anything outside
 * itself, or the serialized copy will fail once it lands.
 *
 * It cannot hand DOM nodes back across the boundary, so it leaves a marker
 * attribute on each rendered container and returns the sources alongside the
 * markers. The isolated side pairs them up again by attribute.
 */
(function (root) {
  'use strict';

  var ATTRIBUTE = 'data-plotdeck-mathjax';

  /**
   * @returns {Array<{index: number, tex: string, display: boolean}>}
   */
  function read() {
    var MARKER = 'data-plotdeck-mathjax';
    var found = [];
    try {
      var mathjax = /** @type {any} */ (window).MathJax;
      if (!mathjax || !mathjax.startup || !mathjax.startup.document) return found;
      var list = mathjax.startup.document.math;
      if (!list) return found;

      // v3 and v4 differ: toArray exists in some builds and not others, while
      // the list is iterable in both. The linked list is the last resort.
      var items = [];
      try {
        items = Array.from(list);
      } catch (err) {
        items = [];
      }
      if (!items.length && typeof list.toArray === 'function') {
        try {
          items = list.toArray();
        } catch (err) {
          items = [];
        }
      }
      if (!items.length && list.list) {
        var node = list.list.next;
        while (node && node !== list.list) {
          items.push(node.data === undefined ? node : node.data);
          node = node.next;
        }
      }

      for (var i = 0; i < items.length; i += 1) {
        var item = items[i];
        if (!item || !item.math || !item.typesetRoot) continue;
        if (!item.typesetRoot.setAttribute) continue;
        item.typesetRoot.setAttribute(MARKER, String(found.length));
        found.push({
          index: found.length,
          tex: String(item.math),
          display: !!item.display
        });
      }
    } catch (err) {
      return found;
    }
    return found;
  }

  var api = { ATTRIBUTE: ATTRIBUTE, read: read };
  root.PlotDeckMathJax = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/**
 * Pulls LaTeX out of rendered math. Every path here is markup the renderer
 * already wrote, so extraction is exact rather than recognised.
 *
 * MathJax v3 and v4 are the exception: they keep the TeX in their own data
 * structures rather than the DOM, so the content script reads those from the
 * page's main world and passes them in.
 */
(function (root) {
  'use strict';

  var SOURCES = [
    {
      name: 'mathml-alttext',
      selector: 'math[alttext]',
      read: function (el) { return el.getAttribute('alttext'); }
    },
    {
      name: 'tex-annotation',
      selector: 'annotation[encoding="application/x-tex"]',
      read: function (el) { return el.textContent; },
      anchor: function (el) { return el.closest('math, .katex, .katex-display') || el; }
    },
    {
      name: 'mathjax2-script',
      selector: 'script[type^="math/tex"]',
      read: function (el) { return el.textContent; },
      anchor: function (el) { return el.previousElementSibling || el.parentElement; }
    },
    {
      name: 'wikipedia-image',
      selector: 'img.mwe-math-fallback-image-inline, img.mwe-math-fallback-image-display',
      read: function (el) { return el.getAttribute('alt'); }
    }
  ];

  /** Ignores presentation differences so the same formula keys the same way. */
  function fingerprint(tex) {
    return tex
      .replace(/\\(?:displaystyle|textstyle|scriptstyle|limits|nolimits)\b/g, '')
      .replace(/[{}\s]/g, '')
      .trim();
  }

  /**
   * @param {ParentNode} scope
   * @returns {Array<{tex: string, source: string, element: Element}>} in document order
   */
  function extract(scope) {
    var host = scope || document;
    var found = [];
    var seen = new Set();

    SOURCES.forEach(function (source) {
      var nodes = host.querySelectorAll(source.selector);
      for (var i = 0; i < nodes.length; i += 1) {
        var el = nodes[i];
        var tex = (source.read(el) || '').trim();
        if (!tex) continue;
        var anchor = source.anchor ? source.anchor(el) : el;
        if (!anchor) continue;
        // Wikipedia publishes each formula twice, as MathML and as a fallback
        // image, and KaTeX nests an annotation inside its own container. Key on
        // the expression itself so one formula produces one slide.
        var key = fingerprint(tex);
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({ tex: tex, source: source.name, element: anchor });
      }
    });

    found.sort(function (a, b) {
      var relation = a.element.compareDocumentPosition(b.element);
      if (relation & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (relation & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
    return found;
  }

  /** Reads MathJax's own list, which only exists in the page's main world. */
  function mathjaxSnippets() {
    var MathJax = root.MathJax;
    if (!MathJax) return [];
    var items = [];
    try {
      var list = MathJax.startup && MathJax.startup.document && MathJax.startup.document.math;
      if (!list) return [];
      var array = typeof list.toArray === 'function' ? list.toArray() : Array.from(list);
      array.forEach(function (item) {
        if (item && item.math) {
          items.push({ tex: String(item.math), node: item.typesetRoot || null });
        }
      });
    } catch (err) {
      return [];
    }
    return items;
  }

  var api = {
    extract: extract,
    mathjaxSnippets: mathjaxSnippets,
    fingerprint: fingerprint,
    SOURCES: SOURCES
  };
  root.PlotDeckExtract = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

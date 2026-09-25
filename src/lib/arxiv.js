/**
 * arXiv's HTML, offered in place of its PDF.
 *
 * PDFs are out of reach: Chrome's viewer runs no extension code, and the maths
 * in a PDF carries no source to read even if it did. arXiv, though, publishes an
 * HTML rendering of every LaTeX submission since 2023, and that rendering keeps
 * the TeX in the markup. So for the one address where readers of mathematics
 * most often land on a PDF, there is somewhere better to send them.
 */
(function (root) {
  'use strict';

  // arxiv.org/pdf/2402.08954v1, /abs/2402.08954, and the old /pdf/math/0309136.
  var PAPER = /^https?:\/\/(?:www\.)?arxiv\.org\/(?:pdf|abs)\/([A-Za-z0-9.\-\/]+?)(?:\.pdf)?\/?$/;

  /**
   * @param {string} url
   * @returns {string|null} the HTML rendering, or null when this is not an
   *   arXiv paper address
   */
  function htmlUrl(url) {
    var match = String(url || '').match(PAPER);
    if (!match) return null;
    var id = match[1];
    if (!id || /^html\//.test(id)) return null;
    return 'https://arxiv.org/html/' + id;
  }

  var api = { htmlUrl: htmlUrl };
  root.PlotDeckArxiv = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

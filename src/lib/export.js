/**
 * Saving a plot as a picture.
 *
 * The plot is already an SVG this extension wrote, so there is nothing to
 * capture: the drawing is serialized, painted onto a canvas at twice the size
 * and handed over as a PNG. Nothing of the page is read or included, and no
 * download permission is needed, because the file is produced locally and
 * offered through an ordinary link.
 */
(function (root) {
  'use strict';

  var SCALE = 2;

  /**
   * Trims a string down to something a file system is happy to hold.
   * @param {string} text
   * @param {number} [limit]
   */
  function slug(text, limit) {
    var value = String(text || '')
      .normalize ? String(text || '').normalize('NFKD') : String(text || '');
    return value
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, limit || 48)
      .replace(/-+$/, '');
  }

  /**
   * 20260924-231500, which sorts and carries no characters to escape.
   * @param {Date} [date]
   */
  function stamp(date) {
    var when = date || new Date();
    var pad = function (value) { return String(value).padStart(2, '0'); };
    return String(when.getFullYear())
      + pad(when.getMonth() + 1) + pad(when.getDate())
      + '-' + pad(when.getHours()) + pad(when.getMinutes()) + pad(when.getSeconds());
  }

  /**
   * Where the page was, what was drawn, and when: enough to tell two downloads
   * apart a month later without opening them.
   *
   * @param {string} url the page the plot came from
   * @param {string} label what the slide is drawing
   * @param {string} axis what it is drawn against
   * @param {Date} [date]
   * @returns {string}
   */
  function downloadName(url, label, axis, date) {
    var where = 'page';
    try {
      var parsed = new URL(String(url));
      where = slug(parsed.hostname.replace(/^www\./, '') + parsed.pathname, 56);
    } catch (err) {
      where = slug(url, 56) || 'page';
    }
    // Built from the parts that exist, so an unnamed plot does not come out
    // called "vs".
    var parts = [slug(label, 18), slug(axis, 18)].filter(Boolean);
    var what = parts.length ? parts.join('-vs-') : 'plot';
    return [where || 'page', what, stamp(date)].join('_') + '.png';
  }

  /**
   * Paints an SVG element onto a canvas and returns it as a PNG.
   *
   * The background is painted first: the drawing takes its color from the
   * drawer's stylesheet, which does not travel with the serialized markup.
   *
   * @param {SVGElement} svg
   * @param {string} [background]
   * @param {number} [scale]
   * @returns {Promise<Blob>}
   */
  function toPng(svg, background, scale) {
    var factor = scale || SCALE;
    var width = Number(svg.getAttribute('width')) || svg.clientWidth;
    var height = Number(svg.getAttribute('height')) || svg.clientHeight;
    var markup = new XMLSerializer().serializeToString(svg);
    if (!/^<svg[^>]+xmlns=/.test(markup)) {
      markup = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    var source = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);

    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(width * factor);
        canvas.height = Math.round(height * factor);
        var context = canvas.getContext('2d');
        context.fillStyle = background || '#0d1117';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error('the canvas produced nothing'));
        }, 'image/png');
      };
      image.onerror = function () { reject(new Error('the drawing would not load')); };
      image.src = source;
    });
  }

  /** Offers a blob to the viewer as a file, through a link and nothing more. */
  function save(blob, name) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

  var api = { SCALE: SCALE, slug: slug, stamp: stamp, downloadName: downloadName, toPng: toPng, save: save };
  root.PlotDeckExport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

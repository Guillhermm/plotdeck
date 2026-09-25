/**
 * Scans the page for math, plans a plot for each, and shows the results as a
 * deck: one slide at a time, moved with the arrows, the keyboard or a swipe.
 * Injected on demand from the popup.
 */
(function () {
  'use strict';

  if (window.__plotdeck) return;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  // Asymmetric padding: the left gutter and the strip below hold tick labels.
  var BOX = { width: 344, height: 176, padLeft: 40, padRight: 8, padTop: 10, padBottom: 20 };
  // A projected cube needs room in both directions, so the spatial views are taller.
  var BOX3D = { width: 344, height: 264 };
  var MAX_SLIDES = 120;

  var latex = window.PlotDeckLatex;
  var extract = window.PlotDeckExtract;
  var planner = window.PlotDeckPlan;
  var plotter = window.PlotDeckPlot;
  var deck = window.PlotDeckDeck;
  var viewer = window.PlotDeckView;
  var space = window.PlotDeckSpace;
  var sessions = window.PlotDeckSession;
  var autofit = window.PlotDeckAutofit;
  var exporter = window.PlotDeckExport;
  var t = window.PlotDeckStrings.translator(window.PlotDeckStrings.pageLocale(document));

  var state = {
    host: null,
    shadow: null,
    slides: [],
    rejects: {},
    found: 0,
    index: 0,
    highlighted: null,
    mathjax: null,
    lastSwipe: 0,
    nodes: {}
  };

  var STYLE = [
    ':host { all: initial; }',
    '.panel { position: fixed; top: 0; right: 0; width: 392px; height: 100vh;',
    '  background: #11151c; color: #e6edf3; z-index: 2147483647; display: flex;',
    '  flex-direction: column; box-shadow: -8px 0 32px rgba(0,0,0,.45);',
    '  font: 13px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; outline: none; }',
    '.head { display: flex; align-items: center; gap: 8px; padding: 12px 14px;',
    '  border-bottom: 1px solid #222c38; flex: none; }',
    '.title { font-weight: 600; font-size: 14px; flex: 1; }',
    '.count { color: #8b99a8; font-size: 12px; font-variant-numeric: tabular-nums; }',
    'button { background: #1b2430; color: #e6edf3; border: 1px solid #2c3a4a;',
    '  border-radius: 5px; padding: 5px 10px; cursor: pointer; font: inherit; }',
    'button:hover:not([disabled]) { background: #24313f; }',
    'button[disabled] { opacity: .35; cursor: default; }',
    '.stage { flex: 1; overflow: hidden; position: relative; touch-action: pan-y; }',
    '.card { position: absolute; inset: 0; overflow-y: auto; padding: 14px;',
    '  box-sizing: border-box; }',
    '.card.enter-right { animation: fromRight .18s ease-out; }',
    '.card.enter-left { animation: fromLeft .18s ease-out; }',
    '@keyframes fromRight { from { transform: translateX(26px); opacity: 0 } }',
    '@keyframes fromLeft { from { transform: translateX(-26px); opacity: 0 } }',
    '.kind { color: #7d8b9a; font-size: 11px; margin-bottom: 8px; }',
    '.rendered { position: relative; background: #fff; color: #111; border-radius: 5px;',
    '  padding: 8px 10px; margin-bottom: 10px; overflow-x: auto; font-size: 16px;',
    '  cursor: pointer; }',
    '.rendered:hover { box-shadow: 0 0 0 1px #4f9dfd; }',
    '.copied { position: absolute; top: 4px; right: 6px; background: #11151c;',
    '  color: #7ee787; font: 10px system-ui, sans-serif; padding: 2px 6px;',
    '  border-radius: 3px; opacity: 0; transition: opacity .15s; pointer-events: none; }',
    '.copied.on { opacity: 1; }',
    '.legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-bottom: 10px;',
    '  font: 11px ui-monospace, Menlo, monospace; color: #9fb0c0; }',
    '.legend .entry { display: flex; align-items: center; gap: 5px; }',
    '.legend i { width: 9px; height: 2px; border-radius: 1px; display: block; }',
    'svg { display: block; background: #0d1117; border-radius: 5px; }',
    '.sliders { margin-top: 10px; display: grid; gap: 7px; }',
    '.slider { display: grid; grid-template-columns: 62px 1fr 44px; align-items: center; gap: 8px; }',
    '.axes { margin-top: 12px; padding-top: 10px; border-top: 1px solid #1b2430; }',
    '.modes { display: flex; gap: 6px; margin-bottom: 10px; }',
    'button.mini.on { border-color: #4f9dfd; color: #4f9dfd; }',
    '.picks { display: flex; gap: 10px; margin-top: 10px; }',
    '.pick { display: flex; align-items: center; gap: 5px; color: #7d8b9a; font-size: 11px; }',
    '.pick select { background: #0d1117; color: #e6edf3; border: 1px solid #2c3a4a;',
    '  border-radius: 4px; padding: 2px 4px; font: 11px ui-monospace, Menlo, monospace; }',
    '.slider span { font: 12px ui-monospace, Menlo, monospace; color: #9fb0c0; }',
    '.slider output { font: 11px ui-monospace, Menlo, monospace; color: #e6edf3; text-align: right; }',
    'input[type=range] { width: 100%; accent-color: #4f9dfd; }',
    '.meta { color: #7d8b9a; font-size: 11px; margin-top: 8px; }',
    '.figure-foot { display: flex; align-items: center; gap: 10px; margin-top: 8px; }',
    '.figure-foot .spacer { flex: 1; }',
    // Shrunk to the drawing, so the camera is placed against the plot's own
    // corner rather than the card's.
    '.figure { position: relative; width: max-content; max-width: 100%; }',
    'button.shot { position: absolute; top: 7px; right: 7px; width: 26px; height: 26px;',
    '  display: grid; place-items: center; padding: 0; border-radius: 7px;',
    '  border: 1px solid transparent; background: rgba(13, 17, 23, .55);',
    '  color: #7d8b9a; opacity: .5; cursor: pointer;',
    '  transition: opacity .16s ease, color .16s ease, background .16s ease,',
    '    border-color .16s ease; }',
    '.figure:hover button.shot { opacity: 1; }',
    'button.shot:hover:not([disabled]) { color: #e6edf3; border-color: #2c3a4a;',
    '  background: rgba(13, 17, 23, .92); }',
    'button.shot:focus-visible { opacity: 1; outline: 2px solid #4f9dfd; outline-offset: 1px; }',
    'button.shot[disabled] { opacity: .3; }',
    'button.shot.failed { color: #e3b341; border-color: #e3b341; opacity: 1; }',
    '.warn { color: #e3b341; font-size: 11px; }',
    '.toggle { display: flex; align-items: center; gap: 4px; color: #7d8b9a;',
    '  font-size: 11px; cursor: pointer; user-select: none; }',
    '.toggle input { accent-color: #4f9dfd; margin: 0; }',
    'button.mini { padding: 3px 8px; font-size: 11px; }',
    '.nav { display: flex; align-items: center; gap: 8px; padding: 10px 14px;',
    '  border-top: 1px solid #222c38; flex: none; }',
    '.nav .spacer { flex: 1; }',
    '.rail { height: 3px; background: #1b2430; border-radius: 2px; overflow: hidden; flex: none; }',
    '.rail i { display: block; height: 100%; background: #4f9dfd; }',
    '.summary { border-top: 1px solid #222c38; color: #8b99a8; font-size: 12px; flex: none; }',
    '.summary summary { padding: 9px 14px; cursor: pointer; }',
    '.summary dl { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px;',
    '  margin: 0; padding: 0 14px 12px; max-height: 132px; overflow-y: auto; }',
    '.summary dt { color: #7d8b9a; } .summary dd { margin: 0; font-variant-numeric: tabular-nums; }',
    '.empty { color: #8b99a8; padding: 28px 14px; text-align: center; }',
    '.card, .summary dl { scrollbar-width: thin; scrollbar-color: #2c3a4a transparent; }',
    '.rendered { scrollbar-width: thin; scrollbar-color: #c3ced8 transparent; }',
    '.card::-webkit-scrollbar, .summary dl::-webkit-scrollbar,',
    '.rendered::-webkit-scrollbar { width: 10px; height: 10px; }',
    '.card::-webkit-scrollbar-track, .summary dl::-webkit-scrollbar-track,',
    '.rendered::-webkit-scrollbar-track { background: transparent; }',
    '.card::-webkit-scrollbar-thumb, .summary dl::-webkit-scrollbar-thumb {',
    '  background: #2c3a4a; border-radius: 6px; border: 3px solid transparent;',
    '  background-clip: content-box; }',
    '.card::-webkit-scrollbar-thumb:hover, .summary dl::-webkit-scrollbar-thumb:hover {',
    '  background: #3d5068; background-clip: content-box; }',
    '.rendered::-webkit-scrollbar-thumb { background: #c3ced8; border-radius: 6px;',
    '  border: 3px solid transparent; background-clip: content-box; }',
    '.rendered::-webkit-scrollbar-thumb:hover { background: #9fb0c0; background-clip: content-box; }',
    '.card::-webkit-scrollbar-corner, .rendered::-webkit-scrollbar-corner { background: transparent; }'
  ].join('\n');

  /** Clipboard needs a user gesture, which a click on the formula is. */
  function copyText(text, feedback) {
    var done = function () {
      feedback.classList.add('on');
      setTimeout(function () { feedback.classList.remove('on'); }, 900);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
      return;
    }
    fallbackCopy(text, done);
  }

  function fallbackCopy(text, done) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      done();
    } catch (err) { /* nothing more to try */ }
    area.remove();
  }

  var STORE = 'plotdeck';
  var saveTimer = null;

  function storageReady() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  function sessionKey() {
    return sessions.normalizeUrl(location.href);
  }

  /** Keeps what the viewer did with this page, not the equations themselves. */
  function remember(immediate) {
    if (!storageReady() || !state.slides.length) return;
    var record = sessions.captureState(state.slides, state.index);
    var key = sessionKey();
    var write = function () {
      chrome.storage.local.get(STORE, function (data) {
        var store = (data && data[STORE]) || {};
        store[key] = record;
        var payload = {};
        payload[STORE] = sessions.prune(store);
        chrome.storage.local.set(payload);
      });
    };
    clearTimeout(saveTimer);
    if (immediate) {
      write();
      return;
    }
    saveTimer = setTimeout(write, 400);
  }

  function recall(done) {
    if (!storageReady()) {
      done(null);
      return;
    }
    chrome.storage.local.get(STORE, function (data) {
      var store = (data && data[STORE]) || {};
      done(store[sessionKey()] || null);
    });
  }

  function forget(done) {
    if (!storageReady()) {
      done();
      return;
    }
    var key = sessionKey();
    chrome.storage.local.get(STORE, function (data) {
      var store = (data && data[STORE]) || {};
      delete store[key];
      var payload = {};
      payload[STORE] = store;
      chrome.storage.local.set(payload, done);
    });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svgEl(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, String(attrs[key]));
    });
    return node;
  }

  /** The source math, copied for display. Scripts are stripped from the copy. */
  function cloneSource(element) {
    var copy = element.cloneNode(true);
    if (copy.querySelectorAll) {
      copy.querySelectorAll('script, iframe, object, embed').forEach(function (node) {
        node.remove();
      });
    }
    return copy;
  }

  var SERIES_COLORS = ['#4f9dfd', '#e3b341', '#7ee787', '#ff7b72', '#d2a8ff', '#79c0ff'];

  function drawSeries(slide) {
    var domain = viewer.zoom(
      viewer.frameFor(slide.baseDomain, slide.zeroCentered),
      viewer.factorFor(slide.view.x)
    );
    var series = slide.plan.series;
    var pointsList = series.map(function (item) {
      return plotter.sample(
        { axis: slide.plan.axis, ast: item.ast, domain: domain },
        slide.values
      );
    });

    // The frame is the first measurement scaled by the slider, and nothing
    // else. Anything that moves the view moves the control with it.
    if (!slide.baseFrame) slide.baseFrame = plotter.combinedRange(pointsList);
    var frame = slide.baseFrame
      ? viewer.zoom(
        viewer.frameFor(slide.baseFrame, slide.zeroCentered),
        viewer.factorFor(slide.view.y)
      )
      : null;

    var geos = pointsList.map(function (points) {
      return plotter.geometry(points, BOX, frame);
    });
    var reference = null;
    for (var i = 0; i < geos.length && !reference; i += 1) reference = geos[i];

    var svg = svgEl('svg', {
      width: BOX.width, height: BOX.height,
      viewBox: '0 0 ' + BOX.width + ' ' + BOX.height
    });

    if (!reference) {
      svg.appendChild(svgEl('rect', { x: 0, y: 0, width: BOX.width, height: BOX.height, fill: '#0d1117' }));
      var note = svgEl('text', {
        x: BOX.width / 2, y: BOX.height / 2, fill: '#7d8b9a',
        'font-size': 12, 'text-anchor': 'middle'
      });
      note.textContent = t('noFinite');
      svg.appendChild(note);
      return { svg: svg, geo: null, escapes: false };
    }

    var plotArea = reference.plot;
    var clipId = 'clip-' + Math.random().toString(36).slice(2, 9);
    var defs = svgEl('defs', {});
    var clip = svgEl('clipPath', { id: clipId });
    clip.appendChild(svgEl('rect', {
      x: plotArea.left, y: plotArea.top, width: plotArea.width, height: plotArea.height
    }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    reference.yTicks.forEach(function (tick) {
      svg.appendChild(svgEl('line', {
        x1: plotArea.left, y1: tick.y, x2: plotArea.left + plotArea.width, y2: tick.y,
        stroke: '#1b2430', 'stroke-width': 1
      }));
      var text = svgEl('text', {
        x: plotArea.left - 5, y: tick.y + 3.5, fill: '#7d8b9a',
        'font-size': 9, 'text-anchor': 'end', 'font-family': 'ui-monospace, Menlo, monospace'
      });
      text.textContent = plotter.format(tick.value);
      svg.appendChild(text);
    });

    reference.xTicks.forEach(function (tick) {
      svg.appendChild(svgEl('line', {
        x1: tick.x, y1: plotArea.top, x2: tick.x, y2: plotArea.top + plotArea.height,
        stroke: '#1b2430', 'stroke-width': 1
      }));
      var text = svgEl('text', {
        x: tick.x, y: BOX.height - 6, fill: '#7d8b9a',
        'font-size': 9, 'text-anchor': 'middle', 'font-family': 'ui-monospace, Menlo, monospace'
      });
      text.textContent = plotter.format(tick.value);
      svg.appendChild(text);
    });

    if (reference.axisY !== null) {
      svg.appendChild(svgEl('line', {
        x1: plotArea.left, y1: reference.axisY, x2: plotArea.left + plotArea.width,
        y2: reference.axisY, stroke: '#33445a', 'stroke-width': 1
      }));
    }
    if (reference.axisX !== null) {
      svg.appendChild(svgEl('line', {
        x1: reference.axisX, y1: plotArea.top, x2: reference.axisX,
        y2: plotArea.top + plotArea.height, stroke: '#33445a', 'stroke-width': 1
      }));
    }

    var curves = svgEl('g', { 'clip-path': 'url(#' + clipId + ')' });
    var escapes = false;
    geos.forEach(function (geo, index) {
      if (!geo) return;
      if (geo.escapes) escapes = true;
      var color = SERIES_COLORS[index % SERIES_COLORS.length];
      geo.paths.forEach(function (d) {
        curves.appendChild(svgEl('path', {
          d: d, fill: 'none', stroke: color,
          'stroke-width': 1.8, 'stroke-linejoin': 'round'
        }));
      });
    });
    svg.appendChild(curves);
    return { svg: svg, geo: reference, escapes: escapes };
  }

  /** Blends two hex colors, for shading a mesh by height. */
  function blend(from, to, amount) {
    var parse = function (hex) {
      return [1, 3, 5].map(function (offset) { return parseInt(hex.substr(offset, 2), 16); });
    };
    var a = parse(from);
    var b = parse(to);
    var mix = a.map(function (channel, index) {
      return Math.round(channel + (b[index] - channel) * Math.max(0, Math.min(1, amount)));
    });
    return 'rgb(' + mix.join(',') + ')';
  }

  function emptyPlot(message) {
    var svg = svgEl('svg', {
      width: BOX.width, height: BOX.height,
      viewBox: '0 0 ' + BOX.width + ' ' + BOX.height
    });
    svg.appendChild(svgEl('rect', { x: 0, y: 0, width: BOX.width, height: BOX.height, fill: '#0d1117' }));
    var note = svgEl('text', {
      x: BOX.width / 2, y: BOX.height / 2, fill: '#7d8b9a',
      'font-size': 12, 'text-anchor': 'middle'
    });
    note.textContent = message;
    svg.appendChild(note);
    return { svg: svg, geo: null, escapes: false };
  }

  /**
   * Screen placement shared by every spatial view. The zoom is its own control
   * rather than the vertical range, which in a surface belongs to the second
   * ground axis.
   */
  function camera(slide) {
    var yaw = (slide.view.yaw || 0) * Math.PI / 180;
    var pitch = (slide.view.pitch || 0) * Math.PI / 180;
    var inner = Math.min(BOX3D.width - 16, BOX3D.height - 24);
    // 1.5 rather than the worst case of sqrt(3): a corner-on cube may graze the
    // edge, which is a better trade than a small picture at every other angle.
    var scale = (inner / 2 / 1.5) * viewer.factorFor(slide.view.zoom || 0);
    var originX = BOX3D.width / 2;
    var originY = BOX3D.height / 2;
    return {
      place: function (point) {
        var p = space.project(point, yaw, pitch);
        return { x: originX + p.x * scale, y: originY - p.y * scale, depth: p.depth };
      }
    };
  }

  function drawBox(svg, view) {
    space.boxEdges().forEach(function (edge) {
      var a = view.place(edge[0]);
      var b = view.place(edge[1]);
      svg.appendChild(svgEl('line', {
        x1: a.x.toFixed(2), y1: a.y.toFixed(2), x2: b.x.toFixed(2), y2: b.y.toFixed(2),
        stroke: '#24313f', 'stroke-width': 1
      }));
    });
  }

  function newSvg() {
    return svgEl('svg', {
      width: BOX3D.width, height: BOX3D.height,
      viewBox: '0 0 ' + BOX3D.width + ' ' + BOX3D.height
    });
  }

  function parameterDomain(slide) {
    return viewer.zoom(
      viewer.frameFor(slide.baseDomain, slide.zeroCentered),
      viewer.factorFor(slide.view.x)
    );
  }

  function sampleSeries(slide, item, domain) {
    return plotter.sample({ axis: slide.plan.axis, ast: item.ast, domain: domain }, slide.values);
  }

  /** Two series read as one curve in the plane: x against y, not both against t. */
  function drawParametric2d(slide) {
    var domain = parameterDomain(slide);
    var pair = slide.plan.series.slice(0, 2);
    var xs = sampleSeries(slide, pair[0], domain).map(function (p) { return p.y; });
    var ys = sampleSeries(slide, pair[1], domain).map(function (p) { return p.y; });
    var xRange = space.bounds(xs);
    var yRange = space.bounds(ys);
    if (!xRange || !yRange) return emptyPlot(t('noFinite'));

    var inner = Math.min(BOX3D.width - 40, BOX3D.height - 34);
    var scale = (inner / 2) * viewer.factorFor(slide.view.zoom || 0);
    var originX = BOX3D.width / 2;
    var originY = BOX3D.height / 2 - 6;
    var place = function (x, y) {
      return {
        x: originX + space.normalize(x, xRange) * scale,
        y: originY - space.normalize(y, yRange) * scale
      };
    };

    var svg = newSvg();
    var frame = svgEl('rect', {
      x: originX - scale, y: originY - scale, width: scale * 2, height: scale * 2,
      fill: 'none', stroke: '#1b2430', 'stroke-width': 1
    });
    svg.appendChild(frame);

    var segments = [];
    var current = [];
    for (var i = 0; i < xs.length; i += 1) {
      if (!Number.isFinite(xs[i]) || !Number.isFinite(ys[i])) {
        if (current.length > 1) segments.push(current.join(' '));
        current = [];
        continue;
      }
      var point = place(xs[i], ys[i]);
      current.push((current.length ? 'L' : 'M') + point.x.toFixed(2) + ',' + point.y.toFixed(2));
    }
    if (current.length > 1) segments.push(current.join(' '));
    segments.forEach(function (d) {
      svg.appendChild(svgEl('path', {
        d: d, fill: 'none', stroke: '#4f9dfd', 'stroke-width': 1.8, 'stroke-linejoin': 'round'
      }));
    });

    var label = svgEl('text', {
      x: 6, y: BOX3D.height - 6, fill: '#7d8b9a', 'font-size': 9,
      'font-family': 'ui-monospace, Menlo, monospace'
    });
    label.textContent = pair[0].label + ' horizontal, ' + pair[1].label + ' vertical';
    svg.appendChild(label);
    return {
      svg: svg,
      geo: null,
      escapes: false,
      readout: pair[0].label + ': ' + plotter.format(xRange.min) + ' to ' + plotter.format(xRange.max)
        + '    ' + pair[1].label + ': ' + plotter.format(yRange.min) + ' to ' + plotter.format(yRange.max)
    };
  }

  /** Three series read as one curve in space. */
  function drawParametric3d(slide) {
    var domain = parameterDomain(slide);
    var picked = slide.axesPick.map(function (index) { return slide.plan.series[index]; });
    var tracks = picked.map(function (item) {
      return sampleSeries(slide, item, domain).map(function (p) { return p.y; });
    });
    var ranges = tracks.map(function (values) { return space.bounds(values); });
    if (ranges.some(function (range) { return !range; })) {
      return emptyPlot(t('noFinite'));
    }

    var view = camera(slide);
    var svg = newSvg();
    drawBox(svg, view);

    var segments = [];
    var current = [];
    for (var i = 0; i < tracks[0].length; i += 1) {
      var finite = tracks.every(function (values) { return Number.isFinite(values[i]); });
      if (!finite) {
        if (current.length > 1) segments.push(current.join(' '));
        current = [];
        continue;
      }
      var point = view.place({
        x: space.normalize(tracks[0][i], ranges[0]),
        y: space.normalize(tracks[1][i], ranges[1]),
        z: space.normalize(tracks[2][i], ranges[2])
      });
      current.push((current.length ? 'L' : 'M') + point.x.toFixed(2) + ',' + point.y.toFixed(2));
    }
    if (current.length > 1) segments.push(current.join(' '));
    segments.forEach(function (d) {
      svg.appendChild(svgEl('path', {
        d: d, fill: 'none', stroke: '#4f9dfd', 'stroke-width': 1.8, 'stroke-linejoin': 'round'
      }));
    });

    var label = svgEl('text', {
      x: 6, y: BOX3D.height - 6, fill: '#7d8b9a', 'font-size': 9,
      'font-family': 'ui-monospace, Menlo, monospace'
    });
    label.textContent = picked.map(function (item) { return item.label; }).join(' , ');
    svg.appendChild(label);
    return { svg: svg, geo: null, escapes: false, readout: label.textContent + '  as x, y, z' };
  }

  /** A function of two variables, drawn as a wireframe. */
  function drawSurface(slide) {
    var mode = currentMode(slide);
    var axisB = mode.second;
    var domainA = parameterDomain(slide);
    var domainB = viewer.zoom(
      viewer.frameFor(slide.baseDomain, slide.zeroCentered),
      viewer.factorFor(slide.view.y)
    );
    var mesh = plotter.grid(
      slide.plan.series[0].ast, slide.plan.axis, axisB, domainA, domainB, slide.values, 22
    );

    var flat = [];
    mesh.z.forEach(function (row) {
      row.forEach(function (value) { flat.push({ x: 0, y: value }); });
    });
    var zRange = plotter.verticalRange(flat);
    if (!zRange) return emptyPlot(t('noFinite'));

    var view = camera(slide);
    var svg = newSvg();
    drawBox(svg, view);

    var count = mesh.a.length;
    var vertexAt = function (row, column) {
      var value = mesh.z[row][column];
      if (!Number.isFinite(value)) return null;
      return view.place({
        x: space.normalize(mesh.a[row], domainA),
        y: space.normalize(mesh.b[column], domainB),
        z: Math.max(-1, Math.min(1, space.normalize(value, zRange)))
      });
    };

    var lines = [];
    var addLine = function (points, height) {
      var segments = [];
      var current = [];
      points.forEach(function (point) {
        if (!point) {
          if (current.length > 1) segments.push(current.join(' '));
          current = [];
          return;
        }
        current.push((current.length ? 'L' : 'M') + point.x.toFixed(2) + ',' + point.y.toFixed(2));
      });
      if (current.length > 1) segments.push(current.join(' '));
      if (!segments.length) return;
      var visible = points.filter(Boolean);
      var depth = visible.reduce(function (total, p) { return total + p.depth; }, 0) / visible.length;
      lines.push({ d: segments.join(' '), depth: depth, height: height });
    };

    for (var row = 0; row < count; row += 1) {
      var across = [];
      var heights = [];
      for (var column = 0; column < count; column += 1) {
        across.push(vertexAt(row, column));
        if (Number.isFinite(mesh.z[row][column])) heights.push(mesh.z[row][column]);
      }
      addLine(across, heights.length ? space.normalize(
        heights.reduce(function (a, b) { return a + b; }, 0) / heights.length, zRange) : 0);
    }
    for (var column2 = 0; column2 < count; column2 += 1) {
      var down = [];
      var heights2 = [];
      for (var row2 = 0; row2 < count; row2 += 1) {
        down.push(vertexAt(row2, column2));
        if (Number.isFinite(mesh.z[row2][column2])) heights2.push(mesh.z[row2][column2]);
      }
      addLine(down, heights2.length ? space.normalize(
        heights2.reduce(function (a, b) { return a + b; }, 0) / heights2.length, zRange) : 0);
    }

    space.sortByDepth(lines).forEach(function (line) {
      svg.appendChild(svgEl('path', {
        d: line.d, fill: 'none',
        stroke: blend('#4f9dfd', '#e3b341', (line.height + 1) / 2),
        'stroke-width': 1, 'stroke-linejoin': 'round', opacity: 0.9
      }));
    });

    var label = svgEl('text', {
      x: 6, y: BOX3D.height - 6, fill: '#7d8b9a', 'font-size': 9,
      'font-family': 'ui-monospace, Menlo, monospace'
    });
    label.textContent = slide.plan.axis + ' , ' + axisB + '  ->  ' + slide.plan.label;
    svg.appendChild(label);
    return {
      svg: svg,
      geo: null,
      escapes: false,
      readout: slide.plan.axis + ': ' + plotter.format(domainA.min) + ' to ' + plotter.format(domainA.max)
        + '    ' + axisB + ': ' + plotter.format(domainB.min) + ' to ' + plotter.format(domainB.max)
        + '    ' + slide.plan.label + ': ' + plotter.format(zRange.min) + ' to ' + plotter.format(zRange.max)
    };
  }

  function currentMode(slide) {
    var modes = planner.modesFor(slide.plan);
    for (var i = 0; i < modes.length; i += 1) {
      if (modes[i].id === slide.mode) return modes[i];
    }
    return modes[0];
  }

  function drawPlot(slide) {
    var mode = currentMode(slide);
    if (mode.id === 'parametric2d') return drawParametric2d(slide);
    if (mode.id === 'parametric3d') return drawParametric3d(slide);
    if (mode.id === 'surface') return drawSurface(slide);
    return drawSeries(slide);
  }

  /** A small line-art camera, drawn rather than fetched. */
  function cameraIcon() {
    var icon = svgEl('svg', {
      width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none',
      stroke: 'currentColor', 'stroke-width': 1.2,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    });
    icon.appendChild(svgEl('path', {
      d: 'M1.6 6a1.2 1.2 0 0 1 1.2-1.2h1.8l1-1.9h4.8l1 1.9h1.8A1.2 1.2 0 0 1 14.4 6v6a1.2 1.2 0 0 1-1.2 1.2H2.8A1.2 1.2 0 0 1 1.6 12z'
    }));
    icon.appendChild(svgEl('circle', { cx: 8, cy: 8.8, r: 2.6 }));
    return icon;
  }

  function buildLegend(series) {
    var legend = el('div', 'legend');
    series.forEach(function (item, index) {
      var entry = el('span', 'entry');
      var dot = el('i');
      dot.style.background = SERIES_COLORS[index % SERIES_COLORS.length];
      entry.appendChild(dot);
      entry.appendChild(el('span', null, item.label));
      legend.appendChild(entry);
    });
    return legend;
  }

  /**
   * Moves the axis controls so the curve stays framed after a parameter change.
   *
   * Horizontal first, because the window on the parameter decides what the
   * curve reaches, and only then vertical. Both are chosen as slider positions
   * rather than as frames, so the controls keep describing what is on screen.
   */
  function fitWindows(slide) {
    var anchorDomain = viewer.frameFor(slide.baseDomain, slide.zeroCentered);
    var shoot = function (item, domain) {
      return plotter.sample(
        { axis: slide.plan.axis, ast: item.ast, domain: domain }, slide.values
      );
    };

    var widest = viewer.zoom(anchorDomain, viewer.factorFor(viewer.STEPS));
    var middle = viewer.center(anchorDomain);
    var wanted = null;
    slide.plan.series.forEach(function (item) {
      var found = autofit.variationWindow(shoot(item, widest), middle);
      if (!found) return;
      if (!wanted || viewer.span(found) > viewer.span(wanted)) wanted = found;
    });
    slide.view.x = autofit.chooseStep(anchorDomain, wanted, slide.view.x,
      { maxStep: autofit.MAX_WIDEN });

    var domain = viewer.zoom(anchorDomain, viewer.factorFor(slide.view.x));
    var pointsList = slide.plan.series.map(function (item) { return shoot(item, domain); });
    if (!slide.baseFrame) slide.baseFrame = plotter.combinedRange(pointsList);
    slide.view.y = autofit.chooseStep(
      viewer.frameFor(slide.baseFrame, slide.zeroCentered),
      plotter.combinedRange(pointsList),
      slide.view.y
    );
  }

  function buildCard(slide) {
    var card = el('div', 'card');
    var kindLabel = slide.plan.kind === 'expression' ? t('expression')
      : slide.plan.kind === 'system' ? t('system', slide.plan.series.length)
        : t('equation');
    card.appendChild(el('div', 'kind', kindLabel));

    var rendered = el('div', 'rendered');
    rendered.title = t('copyHint');
    rendered.appendChild(cloneSource(slide.element));
    var copied = el('span', 'copied', t('copied'));
    rendered.appendChild(copied);
    rendered.addEventListener('click', function () {
      // A swipe that begins on the formula should not also copy it.
      if (Date.now() - state.lastSwipe < 400) return;
      copyText(slide.tex, copied);
    });
    card.appendChild(rendered);

    var modes = planner.modesFor(slide.plan);
    if (modes.length > 1) {
      var picker = el('div', 'modes');
      modes.forEach(function (mode) {
        var names = {
          series: slide.plan.series.length > 1 ? t('modeCurves') : t('modeCurve'),
          parametric2d: t('modeParametric'),
          parametric3d: t('modeParametric3d'),
          surface: t('modeSurface')
        };
        var button = el('button', 'mini' + (mode.id === currentMode(slide).id ? ' on' : ''),
          names[mode.id] || mode.label);
        button.addEventListener('click', function () {
          slide.mode = mode.id;
          slide.baseFrame = null;
          goTo(state.index, 0);
          remember();
        });
        picker.appendChild(button);
      });
      card.appendChild(picker);
    }

    if (currentMode(slide).id === 'series' && slide.plan.series.length > 1) {
      card.appendChild(buildLegend(slide.plan.series));
    }

    var warn = el('span', 'warn', '');
    var toggle = function (checked, label, hint, onChange) {
      var wrap = el('label', 'toggle');
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = checked;
      wrap.title = hint;
      wrap.appendChild(box);
      wrap.appendChild(el('span', null, label));
      box.addEventListener('change', function () { onChange(box.checked); });
      return wrap;
    };

    var fitLabel = toggle(slide.autofit, t('autoFit'), t('autoFitHint'), function (checked) {
      slide.autofit = checked;
      // Turning it on should show what it does straight away.
      if (checked) slide.fitNext = true;
      redraw();
      remember();
    });
    var zeroLabel = toggle(slide.zeroCentered, t('zeroCentered'), t('zeroCenteredHint'),
      function (checked) {
        slide.zeroCentered = checked;
        redraw();
        remember();
      });
    var refit = el('button', 'mini', t('refit'));
    refit.title = t('refitHint');
    var savePng = el('button', 'shot');
    savePng.title = t('savePngHint');
    savePng.setAttribute('aria-label', t('savePng'));
    savePng.appendChild(cameraIcon());

    savePng.addEventListener('click', function () {
      var drawing = figure.querySelector('svg');
      if (!drawing) return;
      savePng.disabled = true;
      exporter.toPng(drawing, '#0d1117').then(function (blob) {
        exporter.save(blob, exporter.downloadName(
          location.href, slide.plan.label, slide.plan.axis));
        savePng.disabled = false;
      }, function () {
        // Kept on the control rather than in the warning slot, which belongs
        // to the plot and may already be saying something about the frame.
        savePng.title = t('saveFailed');
        savePng.classList.add('failed');
        savePng.disabled = false;
      });
    });

    var figure = el('div', 'figure');
    figure.appendChild(savePng);
    card.appendChild(figure);
    var meta = el('div', 'meta');
    card.appendChild(meta);

    // Below the plot, because both of these are about what was just drawn.
    var figureFoot = el('div', 'figure-foot');
    figureFoot.appendChild(refit);
    figureFoot.appendChild(warn);
    figureFoot.appendChild(el('span', 'spacer'));
    figureFoot.appendChild(fitLabel);
    figureFoot.appendChild(zeroLabel);
    card.appendChild(figureFoot);

    function redraw() {
      if (slide.autofit && slide.fitNext && currentMode(slide).id === 'series') {
        fitWindows(slide);
        slide.fitNext = false;
        xControl.set(slide.view.x);
        if (yControl) yControl.set(slide.view.y);
      }
      var drawn = drawPlot(slide);
      figure.replaceChildren(drawn.svg, savePng);
      warn.textContent = drawn.escapes ? t('escapes') : '';
      if (drawn.readout) {
        meta.textContent = drawn.readout;
        return;
      }
      if (!drawn.geo) {
        meta.textContent = t('nothingHere');
        return;
      }
      meta.textContent = slide.plan.axis + ': '
        + plotter.format(drawn.geo.xRange.min) + ' to ' + plotter.format(drawn.geo.xRange.max)
        + '    ' + slide.plan.label + ': '
        + plotter.format(drawn.geo.range.min) + ' to ' + plotter.format(drawn.geo.range.max)
        + (slide.plan.axisChoice === 'fallback' ? '    (axis guessed)' : '');
    }

    refit.addEventListener('click', function () {
      slide.baseFrame = null;
      slide.view.y = 0;
      goTo(state.index, 0);
      remember();
    });

    /**
     * @returns {{row: Element, set: (value: number) => void}} so a control can be
     *   moved by the fit as well as by hand, and still read correctly.
     */
    function sliderRow(name, config, onInput) {
      var row = el('div', 'slider');
      row.appendChild(el('span', null, name));
      var input = document.createElement('input');
      input.type = 'range';
      input.min = String(config.min);
      input.max = String(config.max);
      input.step = String(config.step);
      input.value = String(config.value);
      var readout = document.createElement('output');
      readout.textContent = config.readout(config.value);
      input.addEventListener('input', function () {
        var value = Number(input.value);
        readout.textContent = config.readout(value);
        onInput(value);
        redraw();
        remember();
      });
      row.appendChild(input);
      row.appendChild(readout);
      return {
        row: row,
        set: function (value) {
          input.value = String(value);
          readout.textContent = config.readout(value);
        }
      };
    }

    if (slide.plan.sliders.length) {
      var sliders = el('div', 'sliders');
      slide.plan.sliders.forEach(function (config) {
        sliders.appendChild(sliderRow(config.name, {
          min: config.min, max: config.max, step: config.step,
          value: slide.values[config.name],
          readout: plotter.format
        }, function (value) {
          slide.values[config.name] = value;
          // A parameter moved, so the window may need to follow it.
          slide.fitNext = true;
        }).row);
      });
      card.appendChild(sliders);
    }

    // The view controls depend on how the slide is being drawn.
    var axes = el('div', 'sliders axes');
    var zoomConfig = function (position) {
      return {
        min: -viewer.STEPS, max: viewer.STEPS, step: 1, value: position,
        readout: function (value) {
          var factor = viewer.factorFor(value);
          return (factor >= 100 || factor < 0.1 ? factor.toPrecision(2)
            : String(Math.round(factor * 100) / 100)) + 'x';
        }
      };
    };
    var angleConfig = function (value) {
      return {
        min: -180, max: 180, step: 5, value: value,
        readout: function (degrees) { return degrees + '\u00b0'; }
      };
    };

    var mode = currentMode(slide);
    var xControl = sliderRow(t('range', slide.plan.axis), zoomConfig(slide.view.x),
      function (value) { slide.view.x = value; slide.fitNext = false; });
    axes.appendChild(xControl.row);
    var yControl = null;

    if (mode.id === 'series') {
      yControl = sliderRow(t('range', 'y'), zoomConfig(slide.view.y),
        function (value) { slide.view.y = value; slide.fitNext = false; });
      axes.appendChild(yControl.row);
    } else if (mode.id === 'surface') {
      axes.appendChild(sliderRow(t('range', mode.second), zoomConfig(slide.view.y),
        function (value) { slide.view.y = value; }).row);
    }

    if (mode.id !== 'series') {
      axes.appendChild(sliderRow(t('zoom'), zoomConfig(slide.view.zoom || 0),
        function (value) { slide.view.zoom = value; }).row);
    }

    if (mode.id === 'surface' || mode.id === 'parametric3d') {
      axes.appendChild(sliderRow(t('turn'), angleConfig(slide.view.yaw),
        function (value) { slide.view.yaw = value; }).row);
      axes.appendChild(sliderRow(t('tilt'), angleConfig(slide.view.pitch),
        function (value) { slide.view.pitch = value; }).row);
    }
    card.appendChild(axes);

    // With more than three lines available, say which three are the axes.
    if (mode.id === 'parametric3d' && slide.plan.series.length > 3) {
      var pickRow = el('div', 'picks');
      ['x', 'y', 'z'].forEach(function (name, position) {
        var wrap = el('label', 'pick');
        wrap.appendChild(el('span', null, name));
        var select = document.createElement('select');
        slide.plan.series.forEach(function (item, index) {
          var option = document.createElement('option');
          option.value = String(index);
          option.textContent = item.label;
          if (index === slide.axesPick[position]) option.selected = true;
          select.appendChild(option);
        });
        select.addEventListener('change', function () {
          slide.axesPick[position] = Number(select.value);
          redraw();
          remember();
        });
        wrap.appendChild(select);
        pickRow.appendChild(wrap);
      });
      card.appendChild(pickRow);
    }

    redraw();
    return card;
  }

  function goTo(index, step) {
    if (!state.slides.length) return;
    state.index = deck.nextIndex(index, state.slides.length, 0);
    var card = buildCard(state.slides[state.index]);
    if (step) card.classList.add(step > 0 ? 'enter-right' : 'enter-left');
    state.nodes.stage.replaceChildren(card);
    state.nodes.count.textContent = (state.index + 1) + ' / ' + state.slides.length;
    state.nodes.prev.disabled = state.index === 0;
    state.nodes.next.disabled = state.index === state.slides.length - 1;
    state.nodes.progress.style.width =
      ((state.index + 1) / state.slides.length * 100).toFixed(1) + '%';
    remember();
  }

  function move(step) {
    var target = deck.nextIndex(state.index, state.slides.length, step);
    if (target === state.index) return;
    goTo(target, step);
  }

  function focusSource() {
    var slide = state.slides[state.index];
    if (!slide) return;
    if (state.highlighted) state.highlighted.style.outline = '';
    slide.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    slide.element.style.outline = '2px solid #4f9dfd';
    state.highlighted = slide.element;
  }

  function attachSwipe(stage) {
    var start = null;
    stage.addEventListener('pointerdown', function (event) {
      if (event.target.tagName === 'INPUT') return;
      start = { x: event.clientX, y: event.clientY };
    });
    stage.addEventListener('pointerup', function (event) {
      if (!start) return;
      var step = deck.swipeVerdict(event.clientX - start.x, event.clientY - start.y);
      start = null;
      if (step) {
        state.lastSwipe = Date.now();
        move(step);
      }
    });
    stage.addEventListener('pointercancel', function () { start = null; });
  }

  function buildSummary() {
    var box = el('details', 'summary');
    var head = el('summary', null, t('summary', state.found, state.slides.length));
    box.appendChild(head);
    var reasons = Object.keys(state.rejects).sort(function (a, b) {
      return state.rejects[b] - state.rejects[a];
    });
    var list = el('dl');
    reasons.forEach(function (reason) {
      list.appendChild(el('dt', null, reason));
      list.appendChild(el('dd', null, String(state.rejects[reason])));
    });
    box.appendChild(list);
    return box;
  }

  function buildPanel() {
    var panel = el('div', 'panel');
    panel.tabIndex = -1;

    var head = el('div', 'head');
    head.appendChild(el('div', 'title', t('title')));
    state.nodes.count = el('div', 'count', '0 / 0');
    head.appendChild(state.nodes.count);
    var rescan = el('button', 'mini', t('rescan'));
    rescan.addEventListener('click', function () {
      forget(function () { open({ fresh: true }); });
    });
    head.appendChild(rescan);
    var close = el('button', 'mini', t('close'));
    close.addEventListener('click', teardown);
    head.appendChild(close);
    panel.appendChild(head);

    var stage = el('div', 'stage');
    state.nodes.stage = stage;
    panel.appendChild(stage);

    if (!state.slides.length) {
      stage.appendChild(el('div', 'empty', state.found ? t('nothingPlottable') : t('noMath')));
    } else {
      attachSwipe(stage);
    }

    var nav = el('div', 'nav');
    state.nodes.prev = el('button', null, '←');
    state.nodes.prev.title = t('previous');
    state.nodes.prev.addEventListener('click', function () { move(-1); });
    state.nodes.next = el('button', null, '→');
    state.nodes.next.title = t('next');
    state.nodes.next.addEventListener('click', function () { move(1); });

    var rail = el('div', 'rail');
    rail.style.flex = '1';
    state.nodes.progress = el('i');
    state.nodes.progress.style.width = '0%';
    rail.appendChild(state.nodes.progress);

    var show = el('button', null, t('showOnPage'));
    show.addEventListener('click', focusSource);

    nav.appendChild(state.nodes.prev);
    nav.appendChild(state.nodes.next);
    nav.appendChild(rail);
    nav.appendChild(show);
    panel.appendChild(nav);

    panel.appendChild(buildSummary());

    panel.addEventListener('keydown', function (event) {
      if (event.target.tagName === 'INPUT') return;
      if (event.key === 'ArrowRight') { move(1); event.preventDefault(); }
      else if (event.key === 'ArrowLeft') { move(-1); event.preventDefault(); }
      else if (event.key === 'Escape') teardown();
    });

    return panel;
  }

  function scan() {
    // Cached because a rescan happens inside the page, where there is no way to
    // run anything in the page's own world again.
    var items = extract.extract(document, state.mathjax);
    state.found = 0;
    state.slides = [];
    state.rejects = {};

    function addSlide(tex, item, plan) {
      if (state.slides.length >= MAX_SLIDES) return;
      var values = plotter.livelyValues(plan);
      plan.sliders.forEach(function (slider) {
        if (values[slider.name] === undefined) values[slider.name] = slider.value;
      });
      state.slides.push({
        tex: tex,
        element: item.element,
        source: item.source,
        plan: plan,
        values: values,
        baseDomain: { min: plan.domain.min, max: plan.domain.max },
        baseFrame: null,
        zeroCentered: true,
        autofit: false,
        mode: 'series',
        axesPick: [0, 1, 2],
        view: { x: 0, y: 0, zoom: 0, yaw: 35, pitch: 25 }
      });
    }

    items.forEach(function (item) {
      // A stacked environment holds one equation per line, so it is several
      // expressions wearing one set of delimiters.
      var pieces = latex.splitBlocks(item.tex);
      state.found += pieces.length;

      var planned = [];
      pieces.forEach(function (piece) {
        var result = planner.plan(piece);
        if (!result.ok) {
          state.rejects[result.reason] = (state.rejects[result.reason] || 0) + 1;
          return;
        }
        planned.push({ tex: piece, plan: result.plan });
      });
      if (!planned.length) return;

      // Lines that share a parameter belong on one pair of axes. The formula
      // shown is then the whole block, which is what those lines are.
      var group = planned.length > 1
        ? planner.groupPlans(planned.map(function (entry) { return entry.plan; }))
        : { ok: false };

      if (group.ok) {
        addSlide(item.tex, item, group.plan);
        planned.forEach(function (entry, index) {
          if (group.members.indexOf(index) === -1) addSlide(entry.tex, item, entry.plan);
        });
        return;
      }
      planned.forEach(function (entry) { addSlide(entry.tex, item, entry.plan); });
    });
  }

  function open(options) {
    var carried = (options && options.mathjax) || state.mathjax;
    teardown();
    state.mathjax = carried;
    scan();
    state.index = 0;
    state.host = document.createElement('div');
    state.host.setAttribute('data-plotdeck-ui', '1');
    state.shadow = state.host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = STYLE;
    state.shadow.appendChild(style);
    var panel = buildPanel();
    state.shadow.appendChild(panel);
    document.documentElement.appendChild(state.host);
    if (state.slides.length) goTo(0, 0);
    panel.focus({ preventScroll: true });

    // A page opened again should come back the way it was left.
    if (!(options && options.fresh)) {
      recall(function (record) {
        if (!record || !state.host) return;
        var result = sessions.applyState(state.slides, record);
        if (result.restored) goTo(result.index, 0);
      });
    }
    return report();
  }

  function teardown() {
    remember(true);
    if (state.highlighted) {
      state.highlighted.style.outline = '';
      state.highlighted = null;
    }
    if (state.host && state.host.isConnected) state.host.remove();
    state.host = null;
    state.shadow = null;
    state.nodes = {};
    return { open: false };
  }

  function report() {
    return {
      open: !!state.host,
      found: state.found,
      plotted: state.slides.length,
      index: state.index,
      rejects: state.rejects
    };
  }

  window.__plotdeck = {
    open: open,
    close: teardown,
    report: report,
    scan: scan,
    move: move,
    goTo: goTo,
    state: state
  };

  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) return;

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    try {
      if (message.type === 'plotdeck:open') sendResponse(open(message.options));
      else if (message.type === 'plotdeck:close') sendResponse(teardown());
      else if (message.type === 'plotdeck:status') sendResponse(report());
    } catch (err) {
      sendResponse({ error: String(err && err.message ? err.message : err) });
    }
    return true;
  });
})();

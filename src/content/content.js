/**
 * Scans the page for math, plans a plot for each, and shows the results as a
 * deck of slides in a drawer. Injected on demand from the popup.
 */
(function () {
  'use strict';

  if (window.__plotdeck) return;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var BOX = { width: 344, height: 172, pad: 10 };
  var MAX_SLIDES = 120;

  var extract = window.PlotDeckExtract;
  var planner = window.PlotDeckPlan;
  var plotter = window.PlotDeckPlot;

  var state = {
    host: null,
    shadow: null,
    slides: [],
    rejects: {},
    found: 0,
    index: 0,
    highlighted: null
  };

  var STYLE = [
    ':host { all: initial; }',
    '.panel { position: fixed; top: 0; right: 0; width: 392px; height: 100vh;',
    '  background: #11151c; color: #e6edf3; z-index: 2147483647; display: flex;',
    '  flex-direction: column; box-shadow: -8px 0 32px rgba(0,0,0,.45);',
    '  font: 13px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; }',
    '.head { display: flex; align-items: center; gap: 8px; padding: 12px 14px;',
    '  border-bottom: 1px solid #222c38; }',
    '.title { font-weight: 600; font-size: 14px; flex: 1; }',
    '.count { color: #8b99a8; font-size: 12px; }',
    'button { background: #1b2430; color: #e6edf3; border: 1px solid #2c3a4a;',
    '  border-radius: 5px; padding: 5px 10px; cursor: pointer; font: inherit; }',
    'button:hover:not([disabled]) { background: #24313f; }',
    'button[disabled] { opacity: .4; cursor: default; }',
    '.body { flex: 1; overflow-y: auto; padding: 14px; }',
    '.slide { border: 1px solid #222c38; border-radius: 8px; padding: 12px; margin-bottom: 12px;',
    '  background: #151b24; }',
    '.slide.active { border-color: #4f9dfd; }',
    '.label { font-weight: 600; margin-bottom: 2px; }',
    '.rendered { background: #fff; color: #111; border-radius: 5px; padding: 6px 8px;',
    '  margin: 8px 0; overflow-x: auto; font-size: 15px; }',
    '.tex { font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; color: #7d8b9a;',
    '  word-break: break-all; margin-bottom: 8px; }',
    'svg { display: block; background: #0d1117; border-radius: 5px; }',
    '.sliders { margin-top: 8px; display: grid; gap: 6px; }',
    '.slider { display: grid; grid-template-columns: 58px 1fr 44px; align-items: center; gap: 8px; }',
    '.slider span { font: 12px ui-monospace, Menlo, monospace; color: #9fb0c0; }',
    '.slider output { font: 11px ui-monospace, Menlo, monospace; color: #e6edf3; text-align: right; }',
    'input[type=range] { width: 100%; accent-color: #4f9dfd; }',
    '.meta { color: #7d8b9a; font-size: 11px; margin-top: 6px; }',
    '.summary { border-top: 1px solid #222c38; padding: 12px 14px; color: #8b99a8;',
    '  font-size: 12px; max-height: 148px; overflow-y: auto; flex: none; }',
    '.summary dl { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; margin: 6px 0 0; }',
    '.summary dt { color: #7d8b9a; } .summary dd { margin: 0; font-variant-numeric: tabular-nums; }',
    '.empty { color: #8b99a8; padding: 24px 4px; text-align: center; }'
  ].join('\n');

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

  function drawPlot(slide) {
    var points = plotter.sample(slide.plan, slide.values);
    var geo = plotter.geometry(points, BOX);
    var svg = svgEl('svg', { width: BOX.width, height: BOX.height, viewBox: '0 0 ' + BOX.width + ' ' + BOX.height });

    if (!geo) {
      svg.appendChild(svgEl('rect', { x: 0, y: 0, width: BOX.width, height: BOX.height, fill: '#0d1117' }));
      var note = svgEl('text', { x: BOX.width / 2, y: BOX.height / 2, fill: '#7d8b9a', 'font-size': 12, 'text-anchor': 'middle' });
      note.textContent = 'no finite values in this range';
      svg.appendChild(note);
      return { svg: svg, geo: null };
    }

    if (geo.axisY !== null) {
      svg.appendChild(svgEl('line', { x1: 0, y1: geo.axisY, x2: BOX.width, y2: geo.axisY, stroke: '#2c3a4a', 'stroke-width': 1 }));
    }
    if (geo.axisX !== null) {
      svg.appendChild(svgEl('line', { x1: geo.axisX, y1: 0, x2: geo.axisX, y2: BOX.height, stroke: '#2c3a4a', 'stroke-width': 1 }));
    }
    geo.paths.forEach(function (d) {
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: '#4f9dfd', 'stroke-width': 1.8, 'stroke-linejoin': 'round' }));
    });
    return { svg: svg, geo: geo };
  }

  function buildSlide(slide, position) {
    var card = el('div', 'slide');
    card.appendChild(el('div', 'label', slide.plan.label + '  vs  ' + slide.plan.axis));

    var rendered = el('div', 'rendered');
    rendered.appendChild(cloneSource(slide.element));
    card.appendChild(rendered);
    card.appendChild(el('div', 'tex', slide.tex));

    var figure = el('div');
    card.appendChild(figure);

    var meta = el('div', 'meta');
    card.appendChild(meta);

    function redraw() {
      var drawn = drawPlot(slide);
      figure.replaceChildren(drawn.svg);
      var domain = plotter.format(slide.plan.domain.min) + ' to ' + plotter.format(slide.plan.domain.max);
      var range = drawn.geo
        ? plotter.format(drawn.geo.range.min) + ' to ' + plotter.format(drawn.geo.range.max)
        : 'none';
      meta.textContent = slide.plan.axis + ': ' + domain + '   ' + slide.plan.label + ': ' + range
        + (slide.plan.axisChoice === 'fallback' ? '   (axis guessed)' : '');
    }

    if (slide.plan.sliders.length) {
      var sliders = el('div', 'sliders');
      slide.plan.sliders.forEach(function (config) {
        var row = el('div', 'slider');
        row.appendChild(el('span', null, config.name));
        var input = document.createElement('input');
        input.type = 'range';
        input.min = String(config.min);
        input.max = String(config.max);
        input.step = String(config.step);
        input.value = String(slide.values[config.name]);
        var readout = document.createElement('output');
        readout.textContent = plotter.format(slide.values[config.name]);
        input.addEventListener('input', function () {
          slide.values[config.name] = Number(input.value);
          readout.textContent = plotter.format(slide.values[config.name]);
          redraw();
        });
        row.appendChild(input);
        row.appendChild(readout);
        sliders.appendChild(row);
      });
      card.appendChild(sliders);
    }

    card.addEventListener('click', function (event) {
      if (event.target.tagName === 'INPUT') return;
      focusSource(position);
    });

    redraw();
    return card;
  }

  function focusSource(position) {
    var slide = state.slides[position];
    if (!slide) return;
    if (state.highlighted) state.highlighted.style.outline = '';
    slide.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    slide.element.style.outline = '2px solid #4f9dfd';
    state.highlighted = slide.element;
    var cards = state.shadow.querySelectorAll('.slide');
    for (var i = 0; i < cards.length; i += 1) {
      cards[i].classList.toggle('active', i === position);
    }
    state.index = position;
  }

  function buildSummary() {
    var box = el('div', 'summary');
    box.appendChild(el('div', null,
      state.found + ' expressions found, ' + state.slides.length + ' plotted.'));
    var reasons = Object.keys(state.rejects).sort(function (a, b) {
      return state.rejects[b] - state.rejects[a];
    });
    if (reasons.length) {
      var list = el('dl');
      reasons.forEach(function (reason) {
        list.appendChild(el('dt', null, reason));
        list.appendChild(el('dd', null, String(state.rejects[reason])));
      });
      box.appendChild(list);
    }
    return box;
  }

  function buildPanel() {
    var panel = el('div', 'panel');
    var head = el('div', 'head');
    head.appendChild(el('div', 'title', 'Plot deck'));
    head.appendChild(el('div', 'count', state.slides.length + ' slides'));
    var close = el('button', null, 'Close');
    close.addEventListener('click', teardown);
    head.appendChild(close);
    panel.appendChild(head);

    var body = el('div', 'body');
    if (!state.slides.length) {
      body.appendChild(el('div', 'empty',
        state.found ? 'Found math, but nothing on this page resolves to a curve.'
          : 'No math markup found on this page.'));
    } else {
      state.slides.forEach(function (slide, i) {
        body.appendChild(buildSlide(slide, i));
      });
    }
    panel.appendChild(body);
    panel.appendChild(buildSummary());
    return panel;
  }

  function scan() {
    var items = extract.extract(document);
    state.found = items.length;
    state.slides = [];
    state.rejects = {};

    items.forEach(function (item) {
      if (state.slides.length >= MAX_SLIDES) return;
      var result = planner.plan(item.tex);
      if (!result.ok) {
        state.rejects[result.reason] = (state.rejects[result.reason] || 0) + 1;
        return;
      }
      var values = {};
      result.plan.sliders.forEach(function (slider) { values[slider.name] = slider.value; });
      state.slides.push({
        tex: item.tex,
        element: item.element,
        source: item.source,
        plan: result.plan,
        values: values
      });
    });
  }

  function open() {
    teardown();
    scan();
    state.host = document.createElement('div');
    state.host.setAttribute('data-plotdeck-ui', '1');
    state.shadow = state.host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = STYLE;
    state.shadow.appendChild(style);
    state.shadow.appendChild(buildPanel());
    document.documentElement.appendChild(state.host);
    return report();
  }

  function teardown() {
    if (state.highlighted) {
      state.highlighted.style.outline = '';
      state.highlighted = null;
    }
    if (state.host && state.host.isConnected) state.host.remove();
    state.host = null;
    state.shadow = null;
    return { open: false };
  }

  function report() {
    return {
      open: !!state.host,
      found: state.found,
      plotted: state.slides.length,
      rejects: state.rejects
    };
  }

  window.__plotdeck = { open: open, close: teardown, report: report, scan: scan, state: state };

  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) return;

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    try {
      if (message.type === 'plotdeck:open') sendResponse(open());
      else if (message.type === 'plotdeck:close') sendResponse(teardown());
      else if (message.type === 'plotdeck:status') sendResponse(report());
    } catch (err) {
      sendResponse({ error: String(err && err.message ? err.message : err) });
    }
    return true;
  });
})();

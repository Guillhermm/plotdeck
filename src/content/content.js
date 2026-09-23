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
  var MAX_SLIDES = 120;

  var extract = window.PlotDeckExtract;
  var planner = window.PlotDeckPlan;
  var plotter = window.PlotDeckPlot;
  var deck = window.PlotDeckDeck;

  var state = {
    host: null,
    shadow: null,
    slides: [],
    rejects: {},
    found: 0,
    index: 0,
    highlighted: null,
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
    '.label { font-weight: 600; margin-bottom: 2px; }',
    '.kind { color: #7d8b9a; font-size: 11px; margin-bottom: 8px; }',
    '.rendered { background: #fff; color: #111; border-radius: 5px; padding: 8px 10px;',
    '  margin-bottom: 8px; overflow-x: auto; font-size: 16px; }',
    '.tex { font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; color: #7d8b9a;',
    '  word-break: break-all; margin-bottom: 10px; }',
    'svg { display: block; background: #0d1117; border-radius: 5px; }',
    '.sliders { margin-top: 10px; display: grid; gap: 7px; }',
    '.slider { display: grid; grid-template-columns: 58px 1fr 44px; align-items: center; gap: 8px; }',
    '.slider span { font: 12px ui-monospace, Menlo, monospace; color: #9fb0c0; }',
    '.slider output { font: 11px ui-monospace, Menlo, monospace; color: #e6edf3; text-align: right; }',
    'input[type=range] { width: 100%; accent-color: #4f9dfd; }',
    '.meta { color: #7d8b9a; font-size: 11px; margin-top: 8px; }',
    '.figure-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }',
    '.figure-head .spacer { flex: 1; }',
    '.warn { color: #e3b341; font-size: 11px; }',
    '.domain { display: flex; align-items: center; gap: 6px; margin-top: 10px;',
    '  color: #7d8b9a; font-size: 11px; }',
    '.domain input { width: 62px; background: #0d1117; color: #e6edf3;',
    '  border: 1px solid #2c3a4a; border-radius: 4px; padding: 3px 5px;',
    '  font: 11px ui-monospace, Menlo, monospace; }',
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
    '.empty { color: #8b99a8; padding: 28px 14px; text-align: center; }'
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
    // The frame is measured once per slide and then held, so moving a scale
    // parameter moves the curve instead of silently rescaling the axis.
    if (!slide.frame) {
      var first = plotter.geometry(points, BOX);
      slide.frame = first ? first.range : null;
    }
    var geo = plotter.geometry(points, BOX, slide.frame);
    var svg = svgEl('svg', {
      width: BOX.width, height: BOX.height,
      viewBox: '0 0 ' + BOX.width + ' ' + BOX.height
    });

    if (!geo) {
      svg.appendChild(svgEl('rect', { x: 0, y: 0, width: BOX.width, height: BOX.height, fill: '#0d1117' }));
      var note = svgEl('text', {
        x: BOX.width / 2, y: BOX.height / 2, fill: '#7d8b9a',
        'font-size': 12, 'text-anchor': 'middle'
      });
      note.textContent = 'no finite values in this range';
      svg.appendChild(note);
      return { svg: svg, geo: null };
    }

    var plotArea = geo.plot;
    var clipId = 'clip-' + Math.random().toString(36).slice(2, 9);
    var defs = svgEl('defs', {});
    var clip = svgEl('clipPath', { id: clipId });
    clip.appendChild(svgEl('rect', {
      x: plotArea.left, y: plotArea.top, width: plotArea.width, height: plotArea.height
    }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    geo.yTicks.forEach(function (tick) {
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

    geo.xTicks.forEach(function (tick) {
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

    if (geo.axisY !== null) {
      svg.appendChild(svgEl('line', {
        x1: plotArea.left, y1: geo.axisY, x2: plotArea.left + plotArea.width, y2: geo.axisY,
        stroke: '#33445a', 'stroke-width': 1
      }));
    }
    if (geo.axisX !== null) {
      svg.appendChild(svgEl('line', {
        x1: geo.axisX, y1: plotArea.top, x2: geo.axisX, y2: plotArea.top + plotArea.height,
        stroke: '#33445a', 'stroke-width': 1
      }));
    }

    var curves = svgEl('g', { 'clip-path': 'url(#' + clipId + ')' });
    geo.paths.forEach(function (d) {
      curves.appendChild(svgEl('path', {
        d: d, fill: 'none', stroke: '#4f9dfd',
        'stroke-width': 1.8, 'stroke-linejoin': 'round'
      }));
    });
    svg.appendChild(curves);
    return { svg: svg, geo: geo };
  }

  function buildCard(slide) {
    var card = el('div', 'card');
    card.appendChild(el('div', 'label', slide.plan.label + '  vs  ' + slide.plan.axis));
    card.appendChild(el('div', 'kind',
      slide.plan.kind === 'expression' ? 'expression, plotted as y' : 'equation'));

    var rendered = el('div', 'rendered');
    rendered.appendChild(cloneSource(slide.element));
    card.appendChild(rendered);
    card.appendChild(el('div', 'tex', slide.tex));

    var figureHead = el('div', 'figure-head');
    var warn = el('span', 'warn', '');
    var refit = el('button', 'mini', 'Refit');
    refit.title = 'Rescale the vertical axis to the current curve';
    figureHead.appendChild(warn);
    figureHead.appendChild(el('span', 'spacer'));
    figureHead.appendChild(refit);
    card.appendChild(figureHead);

    var figure = el('div');
    card.appendChild(figure);
    var meta = el('div', 'meta');
    card.appendChild(meta);

    function redraw() {
      var drawn = drawPlot(slide);
      figure.replaceChildren(drawn.svg);
      warn.textContent = drawn.geo && drawn.geo.escapes ? 'curve leaves the frame' : '';
      var range = drawn.geo
        ? plotter.format(drawn.geo.range.min) + ' to ' + plotter.format(drawn.geo.range.max)
        : 'none';
      meta.textContent = slide.plan.label + ' frame: ' + range
        + (slide.plan.axisChoice === 'fallback' ? '   (axis guessed)' : '');
    }

    refit.addEventListener('click', function () {
      slide.frame = null;
      redraw();
    });

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

    // Every slide gets at least these: the window on the axis.
    var domain = el('div', 'domain');
    domain.appendChild(el('span', null, slide.plan.axis + ' from'));
    ['min', 'max'].forEach(function (key, position) {
      if (position === 1) domain.appendChild(el('span', null, 'to'));
      var input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.value = String(Math.round(slide.plan.domain[key] * 1000) / 1000);
      input.addEventListener('change', function () {
        var value = Number(input.value);
        if (!Number.isFinite(value)) return;
        slide.plan.domain[key] = value;
        redraw();
      });
      domain.appendChild(input);
    });
    card.appendChild(domain);

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
      if (step) move(step);
    });
    stage.addEventListener('pointercancel', function () { start = null; });
  }

  function buildSummary() {
    var box = el('details', 'summary');
    var head = el('summary', null,
      state.found + ' expressions found, ' + state.slides.length + ' plotted');
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
    head.appendChild(el('div', 'title', 'Plot deck'));
    state.nodes.count = el('div', 'count', '0 / 0');
    head.appendChild(state.nodes.count);
    var close = el('button', null, 'Close');
    close.addEventListener('click', teardown);
    head.appendChild(close);
    panel.appendChild(head);

    var stage = el('div', 'stage');
    state.nodes.stage = stage;
    panel.appendChild(stage);

    if (!state.slides.length) {
      stage.appendChild(el('div', 'empty', state.found
        ? 'Found math, but nothing on this page resolves to a curve.'
        : 'No math markup found on this page.'));
    } else {
      attachSwipe(stage);
    }

    var nav = el('div', 'nav');
    state.nodes.prev = el('button', null, '←');
    state.nodes.prev.title = 'Previous slide';
    state.nodes.prev.addEventListener('click', function () { move(-1); });
    state.nodes.next = el('button', null, '→');
    state.nodes.next.title = 'Next slide';
    state.nodes.next.addEventListener('click', function () { move(1); });

    var rail = el('div', 'rail');
    rail.style.flex = '1';
    state.nodes.progress = el('i');
    state.nodes.progress.style.width = '0%';
    rail.appendChild(state.nodes.progress);

    var show = el('button', null, 'Show on page');
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
      if (message.type === 'plotdeck:open') sendResponse(open());
      else if (message.type === 'plotdeck:close') sendResponse(teardown());
      else if (message.type === 'plotdeck:status') sendResponse(report());
    } catch (err) {
      sendResponse({ error: String(err && err.message ? err.message : err) });
    }
    return true;
  });
})();

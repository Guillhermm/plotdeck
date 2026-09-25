/**
 * The extension has no bundler, so each module hangs its API off the shared
 * global of the content script's world. These declarations tell the type
 * checker what is there, taking the shapes from the implementations themselves
 * so the two cannot drift apart.
 */

interface Window {
  PlotDeckLatex: typeof import('../src/lib/latex.js');
  PlotDeckEvaluate: typeof import('../src/lib/evaluate.js');
  PlotDeckPlan: typeof import('../src/lib/plan.js');
  PlotDeckPlot: typeof import('../src/lib/plot.js');
  PlotDeckExtract: typeof import('../src/lib/extract.js');
  PlotDeckDeck: typeof import('../src/lib/deck.js');
  PlotDeckView: typeof import('../src/lib/view.js');
  PlotDeckSpace: typeof import('../src/lib/space.js');
  PlotDeckSession: typeof import('../src/lib/session.js');
  PlotDeckAutofit: typeof import('../src/lib/autofit.js');
  PlotDeckStrings: typeof import('../src/lib/strings.js');
  PlotDeckMathJax: typeof import('../src/lib/mathjax.js');
  PlotDeckExport: typeof import('../src/lib/export.js');

  /** The drawer's own handle, used by the popup and by the test harnesses. */
  __plotdeck?: {
    open: (options?: { fresh?: boolean }) => object;
    close: () => object;
    report: () => object;
    scan: () => void;
    move: (step: number) => void;
    goTo: (index: number, step: number) => void;
    state: any;
  };
}

/**
 * The popup loads this one as a plain script, so it is a bare global there.
 * `var` rather than `const`: only var and function declarations show up on
 * globalThis, which is what the module's own assignment writes to.
 */
declare var PlotDeckMathJax: typeof import('../src/lib/mathjax.js');

declare var PlotDeckArxiv: typeof import('../src/lib/arxiv.js');

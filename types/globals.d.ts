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

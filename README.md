# Plot deck

A Chrome extension (Manifest V3) that reads every equation on a page and draws it,
with a slider for each parameter. No model, no network, no build step.

Status: working prototype. Verified in Chrome 154 against seven live pages.

## Install locally

1. `chrome://extensions`, turn on Developer mode.
2. "Load unpacked", pick this folder.
3. Open a page with math, click the icon, press "Scan this page".

## How it works

Four stages, each of which can be checked on its own.

1. **Extract.** Rendered math already carries its own source: MathML `alttext`, the
   TeX `annotation` KaTeX writes, MathJax v2 script tags, and Wikipedia's fallback
   image `alt`. Nothing is recognised or guessed. Wikipedia publishes each formula
   twice, as MathML and as an image, so results are keyed on the expression itself.
2. **Parse.** A small recursive descent parser over the subset of LaTeX that can be
   drawn: arithmetic, implicit multiplication, fractions, roots, powers, the usual
   functions, subscripted symbol names. Everything else is rejected *by name*, so a
   skipped equation always says why.
3. **Plan.** The rule that removes the need for a model: do not try to decide whether
   an equation is plottable. Pick the axis by convention (`x`, then `t`, `theta`, …),
   turn every other free symbol into a slider, and choose the domain from the
   functions actually applied to the axis. A bare expression with no `=` is plotted
   as `y`.
4. **Draw.** Sampled at 480 points into an inline SVG. Poles become gaps rather than
   vertical lines, and the vertical range is clipped around the median so one
   asymptote cannot flatten the curve.

## Moving through the deck

One slide at a time, never a scrolling list. Only the current slide is built, so a
page with a hundred equations costs the same as a page with one.

- Arrow buttons in the footer, with a counter and a progress rail.
- Left and right arrow keys, while the panel has focus. Escape closes it.
- Swipe: drag horizontally across the slide. A mostly vertical drag scrolls the
  slide instead, so a tall slide never flips to the next one by accident.
- Both ends clamp rather than wrap, and the buttons disable there.
- Slider positions belong to the slide, so they survive leaving and coming back.
- "Show on page" scrolls the page to the equation and outlines it.

## Controls on a slide

Every slide has the axis window: `x from … to …`. A slide only gets sliders when the
equation actually has parameters, so `f(x)=1/(1+e^{-x})` has none and
`f(x)=L/(1+e^{-k(x-x_0)})` has three. On the Wikipedia article for the logistic
function, 11 of the 23 slides carry no parameters at all.

**The vertical frame is measured once per slide and then held.** This matters more
than it sounds. If the axis is refitted on every redraw, a scale parameter stretches
the data and the axis by exactly the same factor, so the curve is redrawn pixel for
pixel identical and the slider appears dead. On that same page, 12 of the 16 sliders
were affected: every one changed the numbers, only 4 changed the picture. With the
frame held, all 16 change the picture.

When a curve grows past the held frame it is clipped at the edge, the slide says
"curve leaves the frame", and **Refit** rescales to the current curve. Tick labels on
both axes make the size of the change readable rather than implied.

## Measured yield

Live pages, Chrome 154. "Found" counts distinct expressions after deduplication.

| Page | Found | Plotted | Time |
|---|---|---|---|
| Wikipedia: Logistic function | 143 | 23 | 20ms |
| Wikipedia: Exponential function | 129 | 18 | 13ms |
| Wikipedia: Sine and cosine | 168 | 13 | 19ms |
| Wikipedia: Quadratic equation | 90 | 13 | 17ms |
| Wikipedia: Normal distribution | 358 | 34 | 37ms |
| arXiv HTML: Attention Is All You Need | 105 | 2 | 10ms |
| katex.org | 5 | 0 | 3ms |

The shape of that table is the finding. A maths article yields a usable deck. A
machine learning paper yields nothing, because its equations are matrix identities,
dimension settings and asymptotic bounds rather than curves.

The drawer reports the same breakdown live, so a page always accounts for what it
skipped: `trivial-expression`, `implicit-relation`, `chained-relation`,
`unsupported-integral`, `asymptotic-notation` and so on.

## What it deliberately refuses

- Integrals, sums, products, limits, derivatives, matrices and vectors.
- Implicit relations such as `x^2+y^2=1`, which need a contour, not a curve.
- Big-O and its relatives, which are written exactly like multiplication.
- Unknown operator names: `\mathrm{softmax}(x)` is rejected, `\mathrm{log}(x)` is not.
- Anything with more than four free parameters.

## Known limits

- MathJax v3 and v4 keep the TeX in their own objects rather than the DOM.
  `extract.mathjaxSnippets` reads it, but wiring it up needs a `world: "MAIN"`
  content script, which is not yet done.
- PDFs are not supported at all. Chrome's built-in viewer does not run content
  scripts, and PDF math carries no source to extract.
- `parse-failed` is still the third largest reject bucket on Wikipedia. Those are
  real notation the subset does not cover yet, not crashes.
- The axis is a convention, not an understanding. `E=mc^2` plots `E` against `m`
  and says so with "(axis guessed)".

## Development

```sh
npm test          # 46 tests, node:test, no dependencies
npm run icons     # regenerates src/images/*.png
```

- `src/lib/latex.js`: normalize, tokenize, parse. Rejects by name.
- `src/lib/evaluate.js`: tree to number, free symbols, functions applied to an axis.
- `src/lib/plan.js`: axis choice, sliders, domain, and every rejection reason.
- `src/lib/plot.js`: sampling and SVG geometry, pure.
- `src/lib/extract.js`: the DOM sources.
- `src/lib/deck.js`: navigation arithmetic and the swipe verdict, pure.
- `src/content/content.js`: the drawer, in a shadow root.

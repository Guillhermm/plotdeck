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
   A stacked environment (`aligned`, `cases`, `gathered` and their relatives) holds
   one equation per line, so it is split into one unit per line. Matrix environments
   are left whole, because a matrix is one object rather than a list.
2. **Parse.** A small recursive descent parser over the subset of LaTeX that can be
   drawn: arithmetic, implicit multiplication, fractions, roots, powers, the usual
   functions, subscripted symbol names. Everything else is rejected *by name*, so a
   skipped equation always says why.
3. **Plan.** The rule that removes the need for a model: do not try to decide whether
   an equation is plottable. Pick the axis by convention (`x`, then `t`, `theta`, …),
   turn every other free symbol into a slider, and choose the domain from the
   functions actually applied to the axis. A bare expression with no `=` is plotted
   as `y`.

   Lines that came from the same stacked environment and depend on the same symbol
   are then grouped onto one pair of axes. A parametrisation gives `x_0`, `x_1`,
   `x_2`, `x_3` as functions of one angle: read one at a time they are unrelated
   curves, read together they are the object. The shared axis is the symbol the most
   lines depend on, the sliders are the union of what is left, and the formula shown
   is the whole block, which is what those lines are.
4. **Draw.** Sampled at 480 points into an inline SVG. Poles become gaps rather than
   vertical lines, and the vertical range is clipped around the median so one
   asymptote cannot flatten the curve.

## Ways to draw a slide

The same plan can be read more than one way, so a slide offers the readings that fit
it and remembers which one you chose.

- **curve**, or **curves** for a system: each series against the shared parameter.
  Always available.
- **parametric**: two series in one parameter are not two curves, they are one curve
  in the plane. `x=\cos t` with `y=\sin t` is a circle, not two waves.
- **parametric 3D**: three or more series become a curve in space. When there are
  more than three lines, three selects say which are x, y and z, so the four
  hyperspherical coordinates of a 3-sphere can be looked at three at a time.
- **surface**: an equation whose remaining symbol is itself a conventional variable,
  such as `z=x^2/a^2+y^2/b^2`, is a surface rather than a family of curves. It is
  drawn as a wireframe on a 22 by 22 grid, shaded by height, with the lines painted
  back to front so the far side sits behind the near one.

The spatial views are orthographic rather than perspective, because these are graphs:
a parallel projection keeps equal steps equal everywhere, so distances can still be
read off the picture after turning it. **Turn** and **tilt** rotate the scene,
**zoom** scales it, and the unit cube is drawn so the orientation stays legible.

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

## A slide

The formula is shown as the page rendered it, copied out of the document, and
clicking it copies the LaTeX. Under it come the curves, then the controls. A slide
built from several lines carries a legend naming each curve.

## Controls on a slide

A slide only gets parameter sliders when the equation has parameters, so
`f(x)=1/(1+e^{-x})` has none and `f(x)=L/(1+e^{-k(x-x_0)})` has three. On the
Wikipedia article for the logistic function, 11 of the 23 slides carry no parameters
at all.

Every slide, with parameters or without, gets a span control for each axis: **x range**
and **y range**. Each one scales its window about the window's own centre, so the
centre never moves and the curve cannot drift off to a corner the way a pair of typed
bounds allows. One step is a constant ratio and the ends are 0.01x and 100x the
measured span, which is four orders of magnitude on a control that typing two numbers
cannot cover comfortably. The readout is the factor, and the line under the plot gives
the resulting bounds on both axes.

**0 centred**, on by default, puts zero in the middle of both axes rather than the
middle of the data. So the logistic function, whose curve runs 0 to 1, gets a vertical
window of -1.08 to 1.08 with the zero line across the centre, and zooming keeps it
there. The test is strict: a window only gets recentred when zero lies *inside* it. A
domain of 0 to 10 over time, or 0.01 to 10 under a logarithm, touches zero only at its
edge, so it is left alone rather than spending half the picture where the function does
not exist. Turning the toggle off fits each axis to the data instead.

**The vertical frame is measured once per slide and then held.** This matters more
than it sounds. If the axis is refitted on every redraw, a scale parameter stretches
the data and the axis by exactly the same factor, so the curve is redrawn pixel for
pixel identical and the slider appears dead. On that same page, 12 of the 16 sliders
were affected: every one changed the numbers, only 4 changed the picture. With the
frame held, all 16 change the picture.

When a curve grows past the held frame it is clipped at the edge, the slide says
"curve leaves the frame", and **Refit** measures the frame again from the current
curve and returns the y range to 1x. Tick labels on
both axes make the size of the change readable rather than implied.

## Measured yield

Live pages, Chrome 154. "Found" counts distinct expressions after deduplication.

| Page | Units | Slides | Curves | Time |
|---|---|---|---|---|
| Wikipedia: Normal distribution | 401 | 48 | 49 | 40ms |
| Wikipedia: Logistic function | 152 | 33 | 33 | 26ms |
| Wikipedia: Exponential function | 134 | 21 | 21 | 26ms |
| Wikipedia: Quadratic equation | 90 | 17 | 17 | 22ms |
| Wikipedia: Sine and cosine | 205 | 14 | 16 | 32ms |
| Wikipedia: 3-sphere | 37 | 5 | 11 | 24ms |
| arXiv HTML: Attention Is All You Need | 105 | 2 | 2 | 17ms |

A slide can hold more than one curve, which is why the last two columns differ.

The shape of that table is the finding. A maths article yields a usable deck. A
machine learning paper yields nothing, because its equations are matrix identities,
dimension settings and asymptotic bounds rather than curves.

The drawer reports the same breakdown live, so a page always accounts for what it
skipped: `trivial-expression`, `implicit-relation`, `chained-relation`,
`unsupported-integral`, `asymptotic-notation` and so on.

## What it deliberately refuses

- Integrals, sums, products, limits, derivatives, matrices and vectors.
- Implicit relations such as `x^2+y^2=1`, which need a contour, not a curve. This
  also catches set-builder definitions, which look like equations but define a
  membership rather than a value.
- Implicit surfaces. `x^2+y^2+z^2=r^2` needs to be solved or marched before it can
  be drawn, and a 3-sphere cannot be drawn at all, since it is a hypersurface in four
  dimensions and any picture of it is a projection chosen by hand.
- Parametric surfaces, which need two parameters rather than one.
- Big-O and its relatives, which are written exactly like multiplication.
- Unknown operator names: `\mathrm{softmax}(x)` is rejected, `\mathrm{log}(x)` is not.
- Anything with more than four free parameters.
- Complex and quaternion expressions. The test is how `i` is used rather than whether
  it appears: as a factor beside another quantity (`x+iy`) or in an exponent of `e`
  it is the imaginary unit and the expression is refused, while standing alone, as in
  the interest rate of `P(1+i)^n`, it is an ordinary real variable and still plots.

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
npm test          # 99 tests, node:test, no dependencies
npm run icons     # regenerates src/images/*.png
```

- `src/lib/latex.js`: normalize, tokenize, parse. Rejects by name.
- `src/lib/evaluate.js`: tree to number, free symbols, functions applied to an axis.
- `src/lib/plan.js`: axis choice, sliders, domain, and every rejection reason.
- `src/lib/plot.js`: sampling and SVG geometry, pure.
- `src/lib/extract.js`: the DOM sources.
- `src/lib/deck.js`: navigation arithmetic and the swipe verdict, pure.
- `src/lib/view.js`: the axis windows, scaled about their centre, pure.
- `src/lib/space.js`: projection, normalisation and depth ordering, pure.
- `src/content/content.js`: the drawer, in a shadow root.

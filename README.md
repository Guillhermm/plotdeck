# Plot deck

A Chrome extension (Manifest V3) that reads every equation on a page and draws it,
with a slider for each parameter. No model, no network, no build step.

Status: 1.0.0, prepared for the Chrome Web Store and not yet published. Verified in
Chrome 154 against live pages, with the packaged archive loaded as an extension.

## Install locally

1. `chrome://extensions`, turn on Developer mode.
2. "Load unpacked", pick this folder.
3. Open a page with math, click the icon, press "Scan this page".

## How it works

Four stages, each of which can be checked on its own.

1. **Extract.** Rendered math already carries its own source: MathML `alttext`, the
   TeX `annotation` KaTeX writes, MathJax v2 script tags, and Wikipedia's fallback
   image `alt`. From MathJax v3 the TeX is no longer in the document at all: it
   lives in MathJax's own objects, in the page's world, where an isolated content
   script cannot reach it. A reader is therefore run in the page's world, which
   marks each rendered container and hands the sources back to be paired up again.
   Nothing is recognized or guessed. Wikipedia publishes each formula
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
- A camera in the plot's top corner saves the drawing as a PNG. It stays faint
  until the plot is hovered, so it costs no room: the row beneath the plot has only
  as much space as **Refit** and the two toggles, and putting the control there made
  it wrap the moment the frame warning appeared.

  Nothing is captured. The drawing is already an SVG this extension wrote, so it is
  serialized, painted onto a canvas at twice the size and offered through an ordinary
  link, with no download permission and nothing of the page included. The name carries
  where it came from, what it draws and when, as in
  `en-wikipedia-org-wiki-logistic-function_f-x-vs-x_20260924-231500.png`.

## Language

The drawer reads in American English unless the page says otherwise. A page that
declares its own language in `<html lang>` gets that language: British English for the
spellings, and Portuguese and Spanish in full. Anything else falls back to English,
one string at a time, so a partial translation is safe. There is no setting for this,
by design: the page decides.

## Coming back to a page

A page that has been read once opens straight into the deck the next time the toolbar
icon is clicked, at the slide it was left on, with the parameters, view and mode it
was left with.

What is stored is not the equations, which take tens of milliseconds to read again and
come back with live references into the document, but what the viewer did with them.
Each slide is keyed on its own expression, so a rescan reattaches the right state even
if the page has changed shape underneath, and a slide with no match keeps its defaults
rather than borrowing another's. The forty most recent pages are kept.

**Rescan**, in the drawer's header, throws that memory away and reads the page again
from scratch.

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
and **y range**. Each one scales its window about the window's own center, so the
center never moves and the curve cannot drift off to a corner the way a pair of typed
bounds allows. One step is a constant ratio and the ends are 0.01x and 100x the
measured span, which is four orders of magnitude on a control that typing two numbers
cannot cover comfortably. The readout is the factor, and the line under the plot gives
the resulting bounds on both axes.

**0 centered**, on by default and sitting below the plot beside **Refit**, puts zero
in the middle of both axes rather than the middle of the data. So the logistic function, whose curve runs 0 to 1, gets a vertical
window of -1.08 to 1.08 with the zero line across the center, and zooming keeps it
there. The test is strict: a window only gets recentered when zero lies *inside* it. A
domain of 0 to 10 over time, or 0.01 to 10 under a logarithm, touches zero only at its
edge, so it is left alone rather than spending half the picture where the function does
not exist. Turning the toggle off fits each axis to the data instead.

**auto fit**, off by default and sitting beside **0 centered**, lets both windows
follow the parameters through the controls. With it on, moving a parameter moves the
axis sliders with it: the horizontal one to keep the part of the curve that actually
does something, the vertical one to hold what the curve reaches inside that window.
Turning it on fits once straight away, so the effect is visible immediately.

The fit is chosen as a slider position, never as a hidden frame, so the controls
always describe what is on screen and any fit can be taken back by hand. Moving an
axis slider yourself suspends the fit for that slide until a parameter moves again.
It is off by default because a window you set yourself should stay where you put it.

Because the slider is geometric the fit lands on discrete steps, which is also what
keeps a scale parameter visible: between two steps the curve grows inside a fixed
frame, and only when it no longer fits does the step, and the control, move.

The horizontal fit takes the smallest window about the center holding 92% of the
curve's total variation, which is what keeps a transition on screen when a parameter
makes it narrow or wide. It may not open the window more than about 4x past what the
planner chose: a curve that grows without bound puts nearly all of its variation at
the edges, so the rule alone would zoom out until the interesting part is a vertical
line.

These rules were chosen by measurement rather than taste. Four strategies were swept
over eight slides and thirteen parameter values on three articles, scored on how much
of the curve stayed visible, how much of the frame it filled, and whether the
interesting horizontal range stayed in view:

| Strategy | Visible | Fill | x kept | Slider moves | Frame moves |
|---|---|---|---|---|---|
| Refit every draw | 0.94 | 1.00 | 0.21 | 0 | 94 |
| Hold and expand | 0.96 | 0.49 | 0.21 | 0 | 27 |
| Fit through the controls | 0.73 | 0.48 | **0.66** | 41 | 29 |

Refitting on every draw fills the frame perfectly and redraws an identical picture
while doing it: the curve changed on only 24 of 104 adjustments, which is the bug
that made sliders look dead. Holding the frame keeps the most on screen but moved it
silently 27 times without moving a single control. Fitting through the controls keeps
the interesting horizontal range three times as often, and every one of its frame
moves is a control move the viewer can see and undo.

Two refinements that seemed obviously right measured worse and were dropped: easing
towards the answer over several adjustments, and fitting with headroom to spare. Both
cost visibility on every page tried.

**Refit** pulls the vertical frame back to the current curve.

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

## How much of the deck is worth looking at

Counting slides says nothing about whether they are worth swiping through, so the
slides from five articles were dumped and read, with each curve classified by whether
it was flat, straight or actually curved.

| | Slides | Curved | Straight | Constant |
|---|---|---|---|---|
| Before | 133 | 78 | 45 | 10 |
| After | 115 | 85 | 29 | 1 |

Reading them turned a vague worry about noise into two specific faults.

**A function reference is not a product.** `P(t)` names a function at t. Read as an
expression it became P times t, and drew a straight line through a formula that was
never there. Nine slides across five articles were this. An expression that is exactly
one symbol applied to one other symbol is now refused as `function-reference`, while a
compound argument, as in `k(x-x_0)`, really is multiplication and still plots.

**One is the identity.** Every parameter started at one, and `b^x` with b at one is the
constant one; a logistic growth curve is flat whenever K equals P_0, at any value. Real
functions were arriving as flat lines because of their starting values, not their
mathematics. Parameters now start at values that leave the curve with something to
show, trying one first and spreading the values apart when a formula collapses wherever
two of its parameters agree.

Together those took the share of slides with nothing to see from 41% to 26%, and the
number of flat ones from ten to one. What remains straight is mostly genuine: `x=v_x t`
really is a line, and so are fragments like `\mu - n\sigma` that the bare-expression
mode picks up.

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

## Permissions and privacy

`activeTab`, `scripting` and `storage`. `minimum_chrome_version` is 95, which is where
`chrome.scripting` learned to run a function in the page's own world. Below that come
Manifest V3 and `chrome.scripting` themselves at 88, and `accent-color`, which tints
every slider, at 93. The themed scrollbars want 121 and fall back to the WebKit
pseudo-elements below that, so they do not gate anything.

`PRIVACY.md` is the disclosure that goes with the listing, and `store/LISTING.md` holds
the submission text: descriptions, the single-purpose statement, a justification for
each permission, and the data-usage answers. Neither is packaged.

`activeTab`, `scripting` and `storage`. There is no host permission and no content
script registered in the manifest, so nothing runs anywhere until the toolbar icon is
clicked on a specific tab. `storage` holds what you did with a page, locally. Nothing
is sent anywhere: there is no network call in the extension at all.

## Known limits

- A rescan from inside the drawer reuses the MathJax sources read when the deck was
  opened, because nothing inside the page can run code in the page's own world again.
  Reopening from the toolbar reads them afresh.
- PDFs are not supported at all. Chrome's built-in viewer does not run content
  scripts, and PDF math carries no source to extract. This is not a gap to be closed
  later: reading it would need optical recognition, which means a model, which is the
  one thing this extension is built without. For arXiv there is a way round, and the
  popup offers it: every LaTeX submission since 2023 has an HTML rendering that does
  carry its source, so opening a paper's PDF offers a link to that instead.
- `parse-failed` is still the third largest reject bucket on Wikipedia. Those are
  real notation the subset does not cover yet, not crashes.
- The axis is a convention, not an understanding. `E=mc^2` plots `E` against `m`
  and says so with "(axis guessed)".

## Development

```sh
npm test          # 166 tests, node:test
npm run typecheck # tsc over the JavaScript, no emit
npm run package   # builds dist/plotdeck-<version>.zip for the store
npm run icons     # regenerates src/images/*.png
```

The extension itself ships no dependencies: what reaches the browser is the
JavaScript in `src/`, unbundled. TypeScript and the type packages are development
only, and there is no zero-dependency way to type-check JavaScript, which is the
one thing that made them worth adding.

## Types

The source stays JavaScript and is checked as JavaScript: `checkJs` over JSDoc, with
`noEmit`, so nothing is compiled and nothing changes shape. Types the checker cannot
infer are written where they belong, as documentation that happens to be verified:
`PlotPlan` and `PlanResult` in `plan.js` describe what planning returns, and
`types/globals.d.ts` declares the module globals by taking their shapes from the
implementations, so the declarations cannot drift from the code.

It paid for itself on the first run: two `@returns` annotations used Closure syntax
that is not valid JSDoc and had been silently meaningless, and the popup held a
top-level `open` that collided with `window.open`.

## Packaging

`npm run package` writes `dist/plotdeck-<version>.zip`, holding the manifest and
`src/` and nothing else. Tests, tooling, types, configuration and this readme stay
behind.

Before writing anything it compares the two lists that have to agree: every file the
extension names, taken from the manifest, the popup's markup and the list of scripts
the popup injects, and every file the package would contain. A file the code asks for
but the package would omit fails the build, and so does a file the package would carry
that nothing loads. That is what catches a new module added to `src/lib` but never
wired into the popup's injection list.

The archive is written directly with `zlib`, so packaging needs no dependency either.
It is byte for byte reproducible: the same source always produces the same zip.

## Continuous integration

`.github/workflows/ci.yml` runs the type check and the tests on every push and pull
request, then builds the package and keeps it as an artifact. `release.yml` does the
same on a `v*` tag and refuses to package when the tag and the manifest version
disagree, which is the mistake that otherwise reaches the store unnoticed.

- `src/lib/latex.js`: normalize, tokenize, parse. Rejects by name.
- `src/lib/evaluate.js`: tree to number, free symbols, functions applied to an axis.
- `src/lib/plan.js`: axis choice, sliders, domain, and every rejection reason.
- `src/lib/plot.js`: sampling and SVG geometry, pure.
- `src/lib/extract.js`: the DOM sources.
- `src/lib/mathjax.js`: the reader that runs in the page's own world.
- `src/lib/arxiv.js`: a paper's PDF address to its HTML one, pure.
- `src/lib/export.js`: the plot to a PNG, and what to call the file.
- `src/lib/deck.js`: navigation arithmetic and the swipe verdict, pure.
- `src/lib/view.js`: the axis windows, scaled about their center, pure.
- `src/lib/space.js`: projection, normalization and depth ordering, pure.
- `src/lib/strings.js`: the drawer's words, per language, pure.
- `src/lib/session.js`: what to remember about a page and how to put it back, pure.
- `src/lib/autofit.js`: where the axis controls should sit, pure.
- `src/content/content.js`: the drawer, in a shadow root.

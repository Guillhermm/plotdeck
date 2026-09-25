# Chrome Web Store listing

Everything the submission form asks for, ready to paste. Keep this file in step with
`manifest.json` and `PRIVACY.md`; the store rejects a listing that disagrees with either.

## Name

Plot deck

## Short description (132 characters maximum)

Draws every equation on a page as an interactive graph, with a slider for each
parameter. No account, no network, no AI.

That is 121 characters.

## Category

Education

## Single purpose

Plot deck reads the mathematical notation already present in a web page and draws each
equation it can as a graph, in a panel beside the page. That is its only function.

## Detailed description

Reading an article about the logistic function, the normal distribution or the
exponential map, and wanting to see the curve rather than imagine it, usually means
retyping the equation into a graphing calculator. Plot deck removes that step.

Click the toolbar icon and it reads the equations the page has already published, then
opens a deck of slides beside it, one equation at a time. Every parameter becomes a
slider, so a formula like the logistic function arrives with its carrying capacity,
growth rate and midpoint ready to move, and the curve responds as you move them.

- Swipe, arrow keys or the on-screen arrows move through the deck
- Every parameter is a slider; the axis windows are sliders too
- Systems of equations sharing a parameter are drawn together on one pair of axes
- Two equations in one parameter can be read as a parametric curve, three as a curve in
  space, and an equation in two variables as a wireframe surface you can turn and tilt
- Click a formula to copy its LaTeX
- "Show on page" scrolls back to where the equation came from
- Reopening a page you have read before returns you to the slide you left

It works wherever mathematics is published as markup rather than as a picture, which
covers Wikipedia, arXiv's HTML papers, KaTeX and MathJax v2 pages, and most lecture
notes and course pages.

Nothing is guessed and nothing is generated. The equations are read from the notation
the page already carries, parsed, and drawn by rule. There is no model, no account, no
network request and no analytics. An expression the extension cannot draw is reported
with the reason rather than silently dropped, and the panel totals those reasons, so the
page always accounts for itself.

The extension reads a page only when you click its icon, and remembers only what you did
with it, on your own machine.

Known limits, stated plainly: equations rendered as images cannot be read, because there
is no notation to read; PDFs are not supported, because Chrome's PDF viewer runs no
extension code; and implicit relations, integrals, sums, matrices and complex-valued
expressions are refused rather than drawn wrongly.

## Permission justifications

**activeTab**
: Plot deck reads the mathematical notation in the page you are looking at. activeTab
  grants that access only for the tab you are on and only at the moment you click the
  toolbar icon. It is used in place of a host permission precisely so the extension has
  no standing access to any site.

**scripting**
: Once you have clicked, the extension places its reading and drawing code into that one
  tab. Nothing is registered to run automatically on any site, which is why there is no
  content script in the manifest.

**storage**
: To remember, locally, where you were on a page you have already read: the slide you
  were on and each slide's parameters, axis windows, mode and toggles. It uses local
  storage rather than synced storage, so nothing leaves the machine. The forty most
  recent pages are kept.

**Host permissions**
: None requested.

**Remote code**
: No. All code is contained in the package. Nothing is fetched, evaluated or loaded at
  runtime.

## Data usage disclosures

- Personally identifiable information: **no**
- Health information: **no**
- Financial information: **no**
- Authentication information: **no**
- Personal communications: **no**
- Location: **no**
- Web history: **no**. Page addresses are used as local keys for your own saved view
  state and are never transmitted.
- User activity: **no**
- Website content: **no**. Equations are read from the page into memory to be drawn and
  are not stored or transmitted.

Certifications: the data is not sold, is not used for any purpose unrelated to the
single purpose above, and is not used to determine creditworthiness or for lending.

## Privacy policy

`PRIVACY.md` in the repository, published at the repository's public URL.

## Screenshots

`store/screenshots/`, 1280x800, taken from live articles.

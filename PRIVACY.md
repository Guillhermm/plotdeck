# Privacy

Plot deck collects nothing, sends nothing and has nowhere to send it.

## What leaves your browser

Nothing. The extension makes no network request of any kind. There is no server, no
analytics, no telemetry, no error reporting and no account. It contains no code that
opens a connection, which you can check: search the source for `fetch`, `XMLHttpRequest`,
`WebSocket` or `sendBeacon` and you will find none.

Because there is no network call, no equation, page address, page content or anything
else can be transmitted, and none is.

## What is stored, and where

One thing, on your own machine, through the browser's extension storage:

**What you did with a page you have already read.** For each page, the slide you were
on and, for each slide, the parameter values, the axis windows, the drawing mode and
the two toggles. This is what lets the drawer reopen where you left it. Each entry is
keyed by the page address, which is stored so the entry can be found again. The forty
most recently used pages are kept and older ones are discarded.

**Not stored:** the equations themselves, the page's text, anything you typed, and any
personal information. Equations are read again from the page each time, in a few tens
of milliseconds.

This data never leaves your device. It is not synced between your browsers, because it
uses local storage rather than synced storage. Removing the extension removes it.

## What the extension reads

Only the page you are looking at, only when you ask. The extension has no permission to
read any site on its own. Clicking its toolbar icon grants it access to that one tab, at
that moment, and it uses that access to read the mathematical notation already present
in the page's markup and to show the drawer. It does not read other tabs, your browsing
history, your bookmarks or your cookies.

## Permissions, and why each one exists

- **activeTab**: to read the equations on the page you are looking at, and only when you
  click the toolbar icon. This is deliberately used instead of a site permission so the
  extension has no standing access to anything.
- **scripting**: to place the reading code and the drawer into that one tab once you
  have clicked. Nothing is registered to run automatically on any site.
- **storage**: to remember, locally, where you were on a page you have already read.

## Changes

Any change to this document ships with the version that changes the behavior it
describes. If a future version were ever to make a network request, this file would say
so before that version was published.

'use strict';

const FILES = [
  'src/lib/latex.js',
  'src/lib/evaluate.js',
  'src/lib/plan.js',
  'src/lib/plot.js',
  'src/lib/extract.js',
  'src/lib/deck.js',
  'src/lib/view.js',
  'src/lib/space.js',
  'src/lib/strings.js',
  'src/lib/session.js',
  'src/lib/autofit.js',
  'src/content/content.js'
];

const els = {
  status: document.getElementById('status'),
  toggle: /** @type {HTMLButtonElement} */ (document.getElementById('toggle')),
  stats: document.getElementById('stats'),
  found: document.getElementById('stat-found'),
  plotted: document.getElementById('stat-plotted'),
  rejects: document.getElementById('rejects')
};

let deckOpen = false;

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function restricted(tab) {
  if (!tab) return true;
  if (!tab.url) return false;
  return !/^(https?|file):/.test(tab.url);
}

async function send(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    return null;
  }
}

function render(result) {
  deckOpen = !!(result && result.open);
  els.toggle.textContent = deckOpen ? 'Close deck' : 'Scan this page';
  els.rejects.replaceChildren();
  if (!result || !deckOpen) {
    els.stats.hidden = true;
    els.status.textContent = 'Ready.';
    return;
  }
  els.stats.hidden = false;
  els.found.textContent = String(result.found);
  els.plotted.textContent = String(result.plotted);
  els.status.textContent = result.plotted
    ? 'Deck open on the right.'
    : 'Nothing on this page resolves to a curve.';

  const reasons = Object.entries(result.rejects || {}).sort((a, b) => b[1] - a[1]);
  for (const [reason, count] of reasons.slice(0, 6)) {
    const row = document.createElement('div');
    const label = document.createElement('span');
    label.textContent = reason;
    const value = document.createElement('span');
    value.textContent = String(count);
    row.append(label, value);
    els.rejects.appendChild(row);
  }
}

async function onToggle() {
  const tab = await currentTab();
  if (restricted(tab)) return;
  els.toggle.disabled = true;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: FILES });
    const result = deckOpen
      ? await send(tab.id, { type: 'plotdeck:close' })
      : await send(tab.id, { type: 'plotdeck:open' });
    if (!result) {
      els.status.textContent = 'The page did not respond. Reload it and try again.';
      return;
    }
    render(result);
    // The deck is on the page now, so the popup has nothing left to say.
    if (result.open) window.close();
  } catch (err) {
    els.status.textContent = /cannot be scripted|Cannot access/i.test(String(err.message))
      ? 'This page cannot be modified by extensions.'
      : String(err.message);
  } finally {
    els.toggle.disabled = false;
  }
}

/** True when this page has been scanned before, so the deck can just open. */
async function seenBefore(url) {
  if (!url) return false;
  const withoutHash = url.split('#')[0];
  const { plotdeck } = await chrome.storage.local.get('plotdeck');
  return !!(plotdeck && plotdeck[withoutHash]);
}

async function init() {
  const tab = await currentTab();
  if (restricted(tab)) {
    els.status.textContent = 'This page cannot be modified by extensions.';
    els.toggle.disabled = true;
    return;
  }
  els.toggle.addEventListener('click', onToggle);

  const status = await send(tab.id, { type: 'plotdeck:status' });
  render(status);
  // Nothing to decide on a page that was read before: open it.
  if (!(status && status.open) && await seenBefore(tab.url)) {
    onToggle();
  }
}

init();

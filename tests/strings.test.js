'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const strings = require('../src/lib/strings.js');

test('American English is the default', () => {
  assert.equal(strings.localeFor(''), 'en');
  assert.equal(strings.localeFor(null), 'en');
  assert.equal(strings.localeFor('en'), 'en');
  assert.equal(strings.localeFor('en-US'), 'en');
  assert.equal(strings.translator('en')('zeroCentered'), '0 centered');
});

test('British English keeps its own spelling', () => {
  assert.equal(strings.localeFor('en-GB'), 'en-gb');
  assert.equal(strings.localeFor('en-AU'), 'en-gb');
  assert.equal(strings.translator('en-gb')('zeroCentered'), '0 centred');
});

test('a language tag falls back to its base language', () => {
  assert.equal(strings.localeFor('pt-BR'), 'pt');
  assert.equal(strings.localeFor('pt_BR'), 'pt');
  assert.equal(strings.localeFor('es-419'), 'es');
});

test('an unknown language falls back to English', () => {
  assert.equal(strings.localeFor('ja'), 'en');
  assert.equal(strings.translator('ja')('close'), 'Close');
});

test('a missing key falls back one key at a time', () => {
  const t = strings.translator('en-gb');
  assert.equal(t('zeroCentered'), '0 centred', 'the table has this one');
  assert.equal(t('close'), 'Close', 'and falls back for the rest');
});

test('placeholders are filled in order', () => {
  assert.equal(strings.translator('en')('summary', 143, 23), '143 expressions found, 23 plotted');
  assert.equal(strings.translator('pt')('system', 4), '4 equações, eixo comum');
  assert.equal(strings.translator('en')('range', 'psi'), 'psi range');
});

test('an unfilled placeholder is left alone rather than printed as undefined', () => {
  assert.equal(strings.translator('en')('summary'), '{0} expressions found, {1} plotted');
});

test('an unknown key comes back as itself rather than blank', () => {
  assert.equal(strings.translator('en')('nothingNamedThis'), 'nothingNamedThis');
});

test('the page language is read from the html element', () => {
  const fake = (lang) => ({ documentElement: { getAttribute: () => lang } });
  assert.equal(strings.pageLocale(fake('pt-BR')), 'pt');
  assert.equal(strings.pageLocale(fake('en-GB')), 'en-gb');
  assert.equal(strings.pageLocale(fake(null)), 'en');
  assert.equal(strings.pageLocale(null), 'en');
});

test('every table only uses keys English also has', () => {
  const known = Object.keys(strings.TABLES.en);
  for (const [locale, table] of Object.entries(strings.TABLES)) {
    for (const key of Object.keys(table)) {
      assert.ok(known.includes(key), `${locale} has a stray key: ${key}`);
    }
  }
});

test('the full tables cover every English key', () => {
  const known = Object.keys(strings.TABLES.en);
  for (const locale of ['pt', 'es']) {
    for (const key of known) {
      assert.ok(key in strings.TABLES[locale], `${locale} is missing ${key}`);
    }
  }
});

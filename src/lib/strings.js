/**
 * The words in the drawer.
 *
 * American English is the default. A page that declares its own language gets
 * that language instead, so the drawer reads like the document it is sitting
 * on. Nothing here is configurable in this version: the page decides.
 *
 * Missing keys fall back to English one at a time, so a partial table is safe.
 */
(function (root) {
  'use strict';

  var TABLES = {
    en: {
      title: 'Plot deck',
      close: 'Close',
      rescan: 'Rescan',
      refit: 'Refit',
      refitHint: 'Measure the vertical frame again from the current curve',
      zeroCentered: '0 centered',
      zeroCenteredHint: 'Keep zero in the middle of both axes',
      showOnPage: 'Show on page',
      previous: 'Previous slide',
      next: 'Next slide',
      copyHint: 'Click to copy the LaTeX',
      copied: 'copied',
      equation: 'equation',
      expression: 'expression, plotted as y',
      system: '{0} equations, shared axis',
      modeCurve: 'curve',
      modeCurves: 'curves',
      modeParametric: 'parametric',
      modeParametric3d: 'parametric 3D',
      modeSurface: 'surface',
      range: '{0} range',
      zoom: 'zoom',
      turn: 'turn',
      tilt: 'tilt',
      escapes: 'curve leaves the frame',
      noFinite: 'no finite values in this range',
      nothingHere: 'nothing finite in this window',
      noMath: 'No math markup found on this page.',
      nothingPlottable: 'Found math, but nothing on this page resolves to a curve.',
      summary: '{0} expressions found, {1} plotted'
    },
    'en-gb': {
      zeroCentered: '0 centred',
      zeroCenteredHint: 'Keep zero in the middle of both axes',
      modeParametric3d: 'parametric 3D'
    },
    pt: {
      title: 'Painel de gráficos',
      close: 'Fechar',
      rescan: 'Reanalisar',
      refit: 'Reenquadrar',
      refitHint: 'Medir de novo o eixo vertical a partir da curva atual',
      zeroCentered: 'centrado no 0',
      zeroCenteredHint: 'Manter o zero no meio dos dois eixos',
      showOnPage: 'Ver na página',
      previous: 'Slide anterior',
      next: 'Próximo slide',
      copyHint: 'Clique para copiar o LaTeX',
      copied: 'copiado',
      equation: 'equação',
      expression: 'expressão, traçada como y',
      system: '{0} equações, eixo comum',
      modeCurve: 'curva',
      modeCurves: 'curvas',
      modeParametric: 'paramétrica',
      modeParametric3d: 'paramétrica 3D',
      modeSurface: 'superfície',
      range: 'faixa de {0}',
      zoom: 'ampliação',
      turn: 'girar',
      tilt: 'inclinar',
      escapes: 'a curva sai do quadro',
      noFinite: 'nenhum valor finito nesta faixa',
      nothingHere: 'nada finito nesta janela',
      noMath: 'Nenhuma marcação matemática encontrada nesta página.',
      nothingPlottable: 'Há matemática na página, mas nada que resulte em uma curva.',
      summary: '{0} expressões encontradas, {1} traçadas'
    },
    es: {
      title: 'Panel de gráficas',
      close: 'Cerrar',
      rescan: 'Volver a analizar',
      refit: 'Reajustar',
      refitHint: 'Volver a medir el eje vertical a partir de la curva actual',
      zeroCentered: 'centrado en 0',
      zeroCenteredHint: 'Mantener el cero en el medio de ambos ejes',
      showOnPage: 'Ver en la página',
      previous: 'Diapositiva anterior',
      next: 'Diapositiva siguiente',
      copyHint: 'Haz clic para copiar el LaTeX',
      copied: 'copiado',
      equation: 'ecuación',
      expression: 'expresión, trazada como y',
      system: '{0} ecuaciones, eje compartido',
      modeCurve: 'curva',
      modeCurves: 'curvas',
      modeParametric: 'paramétrica',
      modeParametric3d: 'paramétrica 3D',
      modeSurface: 'superficie',
      range: 'rango de {0}',
      zoom: 'ampliación',
      turn: 'girar',
      tilt: 'inclinar',
      escapes: 'la curva sale del marco',
      noFinite: 'ningún valor finito en este rango',
      nothingHere: 'nada finito en esta ventana',
      noMath: 'No se encontró notación matemática en esta página.',
      nothingPlottable: 'Hay matemáticas en la página, pero nada que produzca una curva.',
      summary: '{0} expresiones encontradas, {1} trazadas'
    }
  };

  /**
   * Picks a table for a language tag. British English is its own table because
   * the spelling differs; every other English is the default.
   */
  function localeFor(tag) {
    var value = String(tag || '').toLowerCase().replace('_', '-');
    if (!value) return 'en';
    if (value === 'en-gb' || value === 'en-au' || value === 'en-nz'
      || value === 'en-ie' || value === 'en-za' || value === 'en-in') {
      return 'en-gb';
    }
    var base = value.split('-')[0];
    if (Object.prototype.hasOwnProperty.call(TABLES, value)) return value;
    if (Object.prototype.hasOwnProperty.call(TABLES, base)) return base;
    return 'en';
  }

  /** Reads the page's declared language, if it declares one. */
  function pageLocale(documentNode) {
    var node = documentNode || (typeof document !== 'undefined' ? document : null);
    if (!node || !node.documentElement) return 'en';
    return localeFor(node.documentElement.getAttribute('lang'));
  }

  /** @returns {function(string, ...*): string} */
  function translator(locale) {
    var table = TABLES[locale] || TABLES.en;
    return function (key) {
      var text = Object.prototype.hasOwnProperty.call(table, key)
        ? table[key]
        : TABLES.en[key];
      if (text === undefined) return key;
      var args = Array.prototype.slice.call(arguments, 1);
      return text.replace(/\{(\d+)\}/g, function (match, index) {
        var value = args[Number(index)];
        return value === undefined ? match : String(value);
      });
    };
  }

  var api = { TABLES: TABLES, localeFor: localeFor, pageLocale: pageLocale, translator: translator };
  root.PlotDeckStrings = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

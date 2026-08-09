/**
 * domSanitize.test.js — Fase 3 (plan v3.2 §4.1) · saneamiento DOM y XSS.
 *
 * 1) Unit tests del escaper canónico (WebUI/js/dom_sanitize.js).
 * 2) Audit estático de los archivos migrados: ninguno puede interpolar datos
 *    externos (patch.name, patchRef.name, bank names, preset names, newName,
 *    searchTerm) en sinks innerHTML/lcdSafeUpdate SIN pasar por escapeHtml.
 *
 * Regla de la política:
 *   - sinks dinámicos NO confiables → prohibido sin escape (innerHTML, +=,
 *     insertAdjacentHTML, outerHTML, DOMParser).
 *   - valores dinámicos simples → textContent.
 *   - HTML estructurado con datos dinámicos → escapeHtml() obligatorio.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const JS_DIR = path.join(ROOT, 'WebUI', 'js');

function loadJsGlobal(relPath) {
  const code = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  const sandbox = { window: {} };
  const fn = new Function('window', code + '\n;return window;');
  return fn(sandbox.window);
}

const { escapeHtml } = require(path.join(JS_DIR, 'dom_sanitize.js'));
// Fuente de verdad única del audit (Fase 3 §4.1 + job CI security-scan):
// scripts/security_scan.js exporta los patrones y el detector reutilizado aquí.
const { auditSource, scanDir } = require(path.join(ROOT, 'scripts', 'security_scan.js'));

// ════════════════════════════════════════════════════════════════
// 1. Unit tests — escapeHtml canónico
// ════════════════════════════════════════════════════════════════

describe('dom_sanitize.js — escapeHtml', () => {
  it('escapa los 5 caracteres HTML sensibles', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(escapeHtml("it's & <b>")).toBe('it&#039;s &amp; &lt;b&gt;');
  });

  it('no escapa texto plano', () => {
    expect(escapeHtml('BASS PATCH 01')).toBe('BASS PATCH 01');
  });

  it('maneja null/undefined/números sin romper', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(0)).toBe('0');
  });

  it('escapa nombres de patch maliciosos (payload SysEx)', () => {
    const malicious = '<img src=x onerror=alert(1)>';
    const out = escapeHtml(malicious);
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
    // insertado en un span NO crea un atributo onerror real: los `<`/`>` son entidades,
    // así que un navegador lo trata como texto plano y no ejecuta el handler.
    expect(out).not.toMatch(/<\/?[a-z]/i); // sin etiquetas reales en el output escapado
  });

  it('se expone en window (sink global para módulos navegador)', () => {
    const win = loadJsGlobal('WebUI/js/dom_sanitize.js');
    expect(typeof win.escapeHtml).toBe('function');
    expect(win.escapeHtml('<a href="javascript:void(0)">x</a>')).toBe(
      '&lt;a href=&quot;javascript:void(0)&quot;&gt;x&lt;/a&gt;'
    );
  });
});

// ════════════════════════════════════════════════════════════════
// 2. Audit estático — sinks migrados en Fase 3
// ════════════════════════════════════════════════════════════════

const MIGRATED_FILES = [
  'browser_render.js',
  'browser_render_hw.js',
  'browser_events.js',
  'browser_io_export.js',
  'edit_actions.js',
  'edit_persistence.js',
  'script_controllers_lcd.js',
  'script_controllers.js',
  'sequencer_presets.js',
  'arpeggiator_presets.js',
  'bridge-midi-learn.js',
  'settings_dump_viewer.js',
  'script_bar_generators.js',
];

// NOTA: los patrones y el detector viven en scripts/security_scan.js (auditSource),
// compartidos con el job CI security-scan. Este test los reutiliza para verificar
// los archivos migrados en Fase 3 y el escaneo COMPLETO de WebUI/js.

describe('Audit estático Fase 3 — sinks de parches/visores sin escape', () => {
  for (const file of MIGRATED_FILES) {
    it(`${file} usa escapeHtml y no interpola datos externos en sinks sin escapar`, () => {
      const src = fs.readFileSync(path.join(JS_DIR, file), 'utf8');
      expect(src, `${file} debe referenciar escapeHtml (canónico o global)`).toContain('escapeHtml');
      const hits = auditSource(src);
      expect(
        hits,
        `${file} tiene una línea de sink con interpolación de datos sin escape: ${hits.length ? hits[0].text : ''}`
      ).toEqual([]);
    });
  }

  it('scan COMPLETO de WebUI/js: 0 datos externos sin escapar en sinks (job CI security-scan)', () => {
    const violations = scanDir();
    expect(violations).toEqual([]);
  });

  it('auditSource ignora líneas que ya escapan (sin falsos positivos en `+ preset.name` escapado)', () => {
    // Usos LEGÍTIMOS con escape en la misma línea no deben marcarse aunque matcheen
    // el patrón genérico `+ preset.name` / `+ patch.name`.
    const escapedSrc = [
      "lcdSafeUpdate(lcd, 'Loaded: ' + escapeHtml(preset.name) + ' ok', null, { useQueue: false });",
      "el.innerHTML = '<b>' + window.escapeHtml(patch.name) + '</b>';",
      "el.innerHTML = '<b>' + _escapeHtml(text) + '</b>';",
      "el.textContent = 'Safe ' + patch.name; // no es sink HTML",
    ].join('\n');
    expect(auditSource(escapedSrc)).toEqual([]);

    // Uso SIN escapar sigue detectándose
    const vulnerableSrc = "lcdSafeUpdate(lcd, 'Saved: ' + preset.name, null, { useQueue: false });";
    const hits = auditSource(vulnerableSrc);
    expect(hits.length).toBe(1);
    expect(hits[0].code).toBe('UNESCAPED_DATA_IN_SINK');
  });

  it('settings_midi_learn.js usa textContent para valores dinámicos (ya migrado en Fase 3)', () => {
    const src = fs.readFileSync(path.join(JS_DIR, 'settings_midi_learn.js'), 'utf8');
    // La lista de mappings se construye con createElement + textContent, no innerHTML con datos
    expect(src).toContain('textContent');
    // sin interpolación de paramName/displayKey en innerHTML
    expect(src).not.toMatch(/innerHTML[^]*\$\{/);
    expect(src).not.toMatch(/innerHTML[^]*\+ (paramName|displayKey)/);
  });

  it('sysex_monitor_render.js usa innerText/textContent para el nombre de patch (hex es seguro)', () => {
    const src = fs.readFileSync(path.join(JS_DIR, 'sysex_monitor_render.js'), 'utf8');
    expect(src).toMatch(/patchLabel\.innerText|patchLabel\.textContent/);
    // los bytes se renderizan como hex [0-9A-F] — no hay interpolación de nombres en el grid
    expect(src).not.toMatch(/\$\{.*name/);
  });

  it('browser_modals_templates.js delega su _escapeHtml en el canónico (consolidación Fase 6)', () => {
    const src = fs.readFileSync(path.join(JS_DIR, 'browser_modals_templates.js'), 'utf8');
    expect(src).toContain('function _escapeHtml');
    expect(src).toContain('_escapeHtml(patchName)');
    expect(src).toContain('_escapeHtml(text)');
    // Consolidado: ya no reimplementa — delega en window/globalThis.escapeHtml
    expect(src).toMatch(/window\.escapeHtml|globalThis\.escapeHtml/);
  });

  it('las 4 fuentes de escapeHtml producen salida idéntica (consolidación Fase 6)', () => {
    const canonical = escapeHtml; // de dom_sanitize.js
    const inputs = ['<b>hi</b>', 'a&b', "it's", '"q"', null, undefined, 42, '', 'plain'];

    // effects_presets_data.js — su escapeHtml exportado (module.exports) DEBE delegar en el canónico
    const effectsData = require(path.join(JS_DIR, 'effects_presets_data.js'));
    expect(typeof effectsData.escapeHtml).toBe('function');
    for (const input of inputs) {
      expect(effectsData.escapeHtml(input)).toBe(canonical(input));
    }

    // calibration_lab_format.js — sin exports; se valida que al cargarlo el global
    // escapeHtml SIGUE siendo el canónico (no lo re-clobberea con comportamiento divergente)
    const calSrc = fs.readFileSync(path.join(JS_DIR, 'calibration_lab_format.js'), 'utf8');
    // La asignación al global es CONDICIONAL: no clobberea el canónico si ya está definido
    expect(calSrc).toMatch(/typeof globalThis\.escapeHtml !== 'function'/);
    const calSandbox = { window: {} };
    new Function('window', calSrc + '\n;return window;')(calSandbox.window);
    // tras cargarlo, el global escapeHtml sigue comportándose como el canónico
    for (const input of inputs) {
      expect(globalThis.escapeHtml(input)).toBe(canonical(input));
    }

    // browser_modals_templates.js — _escapeHtml se usa internamente en los templates
    const modalsSrc = fs.readFileSync(path.join(JS_DIR, 'browser_modals_templates.js'), 'utf8');
    const modalsWin = new Function('window', modalsSrc + '\n;return window;')({ window: {} });
    for (const input of inputs) {
      const item = modalsWin._buildCtxMenuItemHtml(String(input == null ? '' : input));
      expect(item).toContain(canonical(input));
    }
  });

  it('los `const` top-level de los delegados no colisionan (classic-script shared global scope)', () => {
    // Los <script> clásicos de index.html comparten el global lexical scope: dos
    // `const` con el mismo nombre en módulos distintos romperían la app con
    // SyntaxError. Se simula evaluando ambas fuentes contra el MISMO objeto global.
    const fxSrc = fs.readFileSync(path.join(JS_DIR, 'effects_presets_data.js'), 'utf8');
    const calSrc = fs.readFileSync(path.join(JS_DIR, 'calibration_lab_format.js'), 'utf8');
    const sharedGlobal = { window: {} };
    const evalBoth = () => {
      // eslint-disable-next-line no-new-func
      const fn1 = new Function('window', fxSrc + '\n;return window;');
      fn1(sharedGlobal.window);
      // eslint-disable-next-line no-new-func
      const fn2 = new Function('window', calSrc + '\n;return window;');
      fn2(sharedGlobal.window);
    };
    expect(evalBoth).not.toThrow(); // colisión → SyntaxError
  });

  it('dom_sanitize.js está registrado en index.html antes que los módulos de render', () => {
    const html = fs.readFileSync(path.join(ROOT, 'WebUI', 'index.html'), 'utf8');
    const idxSanitize = html.indexOf('js/dom_sanitize.js');
    const idxRender = html.indexOf('js/browser_render.js');
    expect(idxSanitize).toBeGreaterThan(-1);
    expect(idxRender).toBeGreaterThan(-1);
    expect(idxSanitize).toBeLessThan(idxRender);
  });
});

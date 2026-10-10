/**
 * fxDropdownGating.test.js — el desplegable de efectos depende del MODELO.
 *
 * El rack de FX se pinta una vez, con las `<option>` embebidas en la plantilla
 * del modal y cacheadas. El corte entre "lo del DM12" y "lo pro" era un 35
 * escrito a mano en `fx_modal_templates.js` y era solo PRESENTACION: los dos
 * `<optgroup>` salian siempre, asi que en modo clasico (`deepmind_hw_controller`
 * / `deepmind_web_standalone`, que resuelven a `dm12_hardware`) el desplegable
 * ofrecia los 25 efectos "pro" que el DeepMind 12 no tiene.
 *
 * El corte sale ahora de `ModelCapabilities.getCapabilitiesForMode(mode)
 * .standardFxCount`, que a su vez se deriva del contrato FX. Este guard carga
 * los TRES scripts reales en un sandbox y comprueba el HTML que sale de verdad,
 * no una reimplementacion: si el corte se vuelve a escribir a mano en el
 * desplegable, el numero se desincroniza y aqui se nota.
 *
 * El sandbox replica lo que hace `index.html`: contrato FX (linea 49), luego
 * `model_capabilities.js` (129), luego `fx_modal_templates.js` (50). El orden
 * importa —los conteos se derivan del contrato al construir el modulo— y un
 * sandbox que los cargara al reves estaria midiendo otra cosa.
 *
 * Lo que NO cubre: el render en el navegador. Eso lo comprueba el paso manual
 * de la Fase 0; aqui se comprueba el HTML y la reevaluacion al cambiar de modo.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JS = path.resolve(__dirname, '..', 'js');

const RUTAS = {
  contrato: path.join(JS, 'fx_contract.gen.js'),
  capabilities: path.join(JS, 'model_capabilities.js'),
  templates: path.join(JS, 'components', 'fx_modal_templates.js'),
};

/** Numero de `<option>` de un HTML de desplegable, y el ultimo id que ofrece. */
function leerOpciones(html) {
  const ids = [...html.matchAll(/<option value="(\d+)"/g)].map((m) => Number(m[1]));
  const grupos = [...html.matchAll(/<optgroup label="([^"]+)"/g)].map((m) => m[1]);
  return { total: ids.length, maxId: ids.length ? Math.max(...ids) : -1, grupos };
}

/** Modo actual del bridge simulado, para poder cambiarlo como el usuario. */
let modoVigente = 'abyssmind_pro';

function montar() {
  const sandbox = {
    console: { warn() {}, error() {} },
    // fx_modal_templates.js consulta los <select> vivos al refrescar; aqui no
    // hay DOM, y con null/listado vacio el guard comprueba el HTML, no el render.
    document: { querySelectorAll: () => [] },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.module = undefined;          // scripts clasicos, no modulos
  sandbox.wasmBridge = { getMode: () => modoVigente };

  vm.createContext(sandbox);
  for (const clave of ['contrato', 'capabilities', 'templates']) {
    vm.runInContext(fs.readFileSync(RUTAS[clave], 'utf8'), sandbox, { filename: RUTAS[clave] });
  }
  return sandbox;
}

beforeEach(() => { modoVigente = 'abyssmind_pro'; });

describe('el desplegable de efectos se recorta por modelo', () => {
  it('en modo clasico ofrece SOLO los 35 nativos (y el Bypass), sin el grupo pro', () => {
    modoVigente = 'deepmind_hw_controller';
    const { window } = montar();
    const o = leerOpciones(window.FX_TYPE_OPTIONS);

    // Bypass (id 0) + los 35 nativos (ids 1..35).
    expect(o.total).toBe(36);
    expect(o.maxId).toBe(35);
    expect(o.grupos).toEqual(['--- STANDARD DM12 FX ---']);
    expect(o.grupos.join(' ')).not.toContain('ADVANCED');
  });

  it('los dos modos DM12 dan el mismo desplegable', () => {
    modoVigente = 'deepmind_hw_controller';
    const clasico = leerOpciones(montar().window.FX_TYPE_OPTIONS);
    modoVigente = 'deepmind_web_standalone';
    const standalone = leerOpciones(montar().window.FX_TYPE_OPTIONS);

    // Los dos resuelven a dm12_hardware: si difieren, uno de los dos se esta
    // saltando la resolucion y el modo clasico deja de ser una sola cosa.
    expect(standalone).toEqual(clasico);
  });

  it('en AbyssMind Pro ofrece el rack entero, con el grupo pro integro', () => {
    modoVigente = 'abyssmind_pro';
    const o = leerOpciones(montar().window.FX_TYPE_OPTIONS);

    expect(o.grupos).toEqual(['--- STANDARD DM12 FX ---', '--- ADVANCED PRO FX ---']);
    expect(o.maxId).toBe(60);
    // El contrato entero menos el Bypass.
    const contrato = montar().window.FxEffectsContract;
    expect(o.total).toBe(contrato.effects.length);
  });

  it('el corte sale de las capacidades, no de un numero escrito en el desplegable', () => {
    const { window } = montar();
    const corte = window.ModelCapabilities.getCapabilitiesForMode('deepmind_hw_controller').standardFxCount;
    const extendidos = window.ModelCapabilities.getCapabilitiesForMode('abyssmind_pro').advancedFxCount;

    modoVigente = 'deepmind_hw_controller';
    const clasico = leerOpciones(window.FX_TYPE_OPTIONS);
    modoVigente = 'abyssmind_pro';
    const pro = leerOpciones(window.FX_TYPE_OPTIONS);

    // Los nativos que salen son exactamente los que declara la capacidad, y el
    // grupo pro tiene exactamente los extendidos que declara. Si alguien vuelve
    // a teclear el 35 aqui, estos numeros dejan de cuadrar.
    expect(clasico.total - 1).toBe(corte);           // -1 por el Bypass
    expect(pro.total - clasico.total).toBe(extendidos);
  });
});

describe('cambiar de modelo reevalua el desplegable', () => {
  it('tras pintar en Pro y pasar a clasico, el getter ya no devuelve los extendidos', () => {
    // Es el fallo del que este guard existe: el HTML se cachea, y una cache sin
    // clave de modelo sigue sirviendo el rack del Pro para siempre.
    modoVigente = 'abyssmind_pro';
    const { window } = montar();

    const enPro = leerOpciones(window.FX_TYPE_OPTIONS);
    expect(enPro.total).toBeGreaterThan(36);

    modoVigente = 'deepmind_hw_controller';
    const enClasico = leerOpciones(window.FX_TYPE_OPTIONS);
    expect(enClasico.total).toBe(36);
    expect(enClasico.maxId).toBe(35);
  });

  it('refreshFxTypeOptions existe y devuelve el recuento que se queda', () => {
    modoVigente = 'deepmind_hw_controller';
    const { window } = montar();

    expect(typeof window.refreshFxTypeOptions).toBe('function');
    const r = window.refreshFxTypeOptions();
    expect(r.efectos).toBe(36);
    expect(r.modelo).toBe('deepmind_hw_controller');
  });

  it('setMode llama a los dos guards de modelo (buses y efectos)', () => {
    // El de los buses ya existe; si solo se refrescaran los buses, el rack
    // volvería a ofrecer los extendidos en cuanto se cerrara y abriera el modal.
    const puente = fs.readFileSync(path.join(JS, 'wasm_bridge.js'), 'utf8');
    expect(puente).toContain('window.refreshModMatrixSlots');
    expect(puente).toContain('window.refreshFxTypeOptions');
  });
});

describe('el modo clasico no se come el nombre del patch', () => {
  it('setMode no escribe en el LCD', () => {
    // El LCD tiene su propio protocolo (`lcd-label` + contenido) y muestra el
    // nombre del patch mientras no se toque nada. Escribir el modo ahi lo
    // borraba: ya paso una vez, cuando arreglar la llamada a lcdSafeUpdate hizo
    // que la escritura dejara de fallar y empezara a tener efecto.
    const puente = fs.readFileSync(path.join(JS, 'wasm_bridge.js'), 'utf8');
    const cuerpo = puente.slice(puente.indexOf('setMode(newMode)'), puente.indexOf('_updateModeUI()', puente.indexOf('setMode(newMode)')));
    expect(cuerpo).not.toContain('lcdSafeUpdate');
    expect(cuerpo).not.toContain("getElementById('lcd-text')");
  });
});
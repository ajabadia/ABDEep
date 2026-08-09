/**
 * bridgeParameterStore.test.js — Fase 2 · Integración del ParameterStore + FSM en el bridge
 *
 * Estrategia: cargar parameter_store.js / hardware_midi_service.js / sysex_assembler.js
 * vía eval (como bridgeDual.test.js) y definir un stub de DualMidiBridge con los
 * prototipos que bridge-parameter-store.js envuelve. Verifica el cableado real:
 *   - setParameter inicia transacción (originId 'ui') y confirma inmediato en JUCE
 *   - En HW mode la transacción queda pending; el eco NRPN la confirma (hook en
 *     bridge-midi-rx-nrpn-handlers.js) y NO re-escribe el slider
 *   - sweep TTL → rollback parameter_edit → reenvío del valor committed
 *   - isConnected alimenta la FSM (connected→syncing→ready)
 *   - sendNRPN alimenta transmitting
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

function _evalSource(relativePath) {
  const cleanPath = relativePath.replace(/^WebUI\//, '');
  const fullPath = path.resolve(__dirname, '..', cleanPath);
  const code = fs.readFileSync(fullPath, 'utf-8');
  return eval(code); // eslint-disable-line no-eval
}

/** Stub de DualMidiBridge con los prototipos que el módulo de integración envuelve */
class StubBridge {
  constructor() {
    this.isJuce = false;
    this.parameterCache = {};
    this.onParameterChangedCallbacks = [];
    this.paramToByteOffset = { 'vcf_cutoff': 39 };
    this.byteOffsetToParamIds = { 39: ['vcf_cutoff'] };
    this.midiChannel = 1;
    this.midiOutput = { send: vi.fn() };
    this.midiLearnActive = false;
    this.midiLearnMappings = {};
    this._nrpnRxBytes = 0;
    this._nrpnPktCount = 0;
    this._nrpnTrafficCallbacks = [];
    this._connectedResult = true; // controla isConnected (vía prototipo)
  }
  _normalizedToRaw(byteOffset, normalizedValue) {
    return Math.round(normalizedValue * 255);
  }
  _rawToNormalized(byteOffset, rawValue) {
    return rawValue / 255.0;
  }
  handleParameterChangeFromBackend(paramId, normalizedValue) {
    this.parameterCache[paramId] = normalizedValue;
    this.onParameterChangedCallbacks.forEach((cb) => cb(paramId, normalizedValue));
  }
  sendWebMidiParameter(paramId, normalizedValue) { /* stub */ }
  async isConnected() { return this._connectedResult; }
  sendNRPN() { /* stub */ }
  /** Espejo de bridge-dual_params.js (capturado por el wrapper en eval-time) */
  setParameter(paramId, normalizedValue, forceResend) {
    const cached = this.parameterCache[paramId];
    if (!forceResend && cached !== undefined && Math.abs(cached - normalizedValue) < 0.001) {
      this.parameterCache[paramId] = normalizedValue;
      return;
    }
    this.parameterCache[paramId] = normalizedValue;
    if (this.isJuce) {
      this.handleParameterChangeFromBackend(paramId, normalizedValue);
    } else {
      this.sendWebMidiParameter(paramId, normalizedValue);
      this.handleParameterChangeFromBackend(paramId, normalizedValue);
    }
  }
  _notifyNrpnTraffic() { /* stub */ }
  _captureMidiLearnMessage() { /* stub */ }
  _applyMidiLearnMapping() { return false; }
}

let _window;
let _bridge;

beforeEach(() => {
  vi.restoreAllMocks();

  _window = {
    console: global.console,
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    setInterval: global.setInterval,
    clearInterval: global.clearInterval,
    Date: global.Date,
    Promise: global.Promise,
    Uint8Array: global.Uint8Array,
    Array: global.Array,
    Math: global.Math,
    JSON: global.JSON,
    Error: global.Error,
    parseInt: global.parseInt,
    isNaN: global.isNaN,
  };
  vi.stubGlobal('window', _window);

  // Cargar los módulos Fase 2 (definen window.ParameterStore / HardwareMidiService / SysExAssembler)
  _evalSource('WebUI/js/parameter_store.js');
  _evalSource('WebUI/js/hardware_midi_service.js');
  _evalSource('WebUI/js/sysex_assembler.js');
  expect(_window.ParameterStore).toBeDefined();
  expect(_window.HardwareMidiService).toBeDefined();
  expect(_window.SysExAssembler).toBeDefined();

  // Definir el stub antes de evaluar el módulo de integración
  global.DualMidiBridge = StubBridge;
  _bridge = new StubBridge();
  _window.dualMidiBridge = _bridge;

  // Evaluar el módulo de integración (envuelve DualMidiBridge.prototype)
  _evalSource('WebUI/js/bridge-parameter-store.js');
});

afterEach(() => {
  delete global.DualMidiBridge;
  _bridge = null;
  _window = null;
  vi.unstubAllGlobals();
});

describe('setParameter transaccional', () => {
  it('inicia transacción pending en modo hardware', () => {
    _bridge.parameterCache['vcf_cutoff'] = 0.5;
    _bridge.setParameter('vcf_cutoff', 0.75);
    const store = _window.parameterStore;
    expect(store.getTransportStatus('vcf_cutoff')).toBe('pending');
    const tx = store.inspect().transactions.find((t) => t.parameterId === 'vcf_cutoff');
    expect(tx.originId).toBe('ui');
    expect(tx.expectedRawValue).toBe(191); // round(0.75*255)
  });

  it('confirma inmediato en modo JUCE', () => {
    _bridge.isJuce = true;
    _bridge.parameterCache['vcf_cutoff'] = 0.5;
    _bridge.setParameter('vcf_cutoff', 0.75);
    expect(_window.parameterStore.getTransportStatus('vcf_cutoff')).toBe('confirmed');
  });

  it('no transacciona parámetros virtuales (byteOffset >= 300)', () => {
    _bridge.paramToByteOffset['fx_feedback_gain'] = 304;
    _bridge.setParameter('fx_feedback_gain', 0.5);
    expect(_window.parameterStore.getTransportStatus('fx_feedback_gain')).toBe('synced');
  });

  it('no transacciona cuando el valor no cambia', () => {
    _bridge.parameterCache['vcf_cutoff'] = 0.75;
    _bridge.setParameter('vcf_cutoff', 0.75);
    expect(_window.parameterStore.getTransportStatus('vcf_cutoff')).toBe('synced');
  });
});

describe('eco NRPN — dedup UI/Hardware (hook en handlers)', () => {
  it('el eco confirma la transacción y no re-escribe el slider', () => {
    // Preparar un handler real que use el hook de dedup
    _evalSource('WebUI/js/bridge-midi-rx-nrpn-handlers.js');
    const handlerSpy = vi.spyOn(_bridge, 'handleParameterChangeFromBackend');

    _bridge.parameterCache['vcf_cutoff'] = 0.5;
    _bridge.setParameter('vcf_cutoff', 0.75); // tx pending con expectedRaw=191
    expect(_window.parameterStore.getTransportStatus('vcf_cutoff')).toBe('pending');
    handlerSpy.mockClear();

    // El hardware responde con el mismo valor (NRPN 0:39, raw=191 → dataMsb=1, dataLsb=63)
    _bridge._nrpnInMsb = 0;
    _bridge._nrpnInLsb = 39;
    _bridge._nrpnInDataMsb = 1;
    _bridge._handleIncomingNrpn(38, 63);

    // Transacción confirmada y el slider NO se re-escribió
    expect(_window.parameterStore.getTransportStatus('vcf_cutoff')).toBe('confirmed');
    expect(handlerSpy).not.toHaveBeenCalledWith('vcf_cutoff', expect.any(Number));
  });

  it('el override externo (valor distinto) sí actualiza la UI', () => {
    _evalSource('WebUI/js/bridge-midi-rx-nrpn-handlers.js');
    const handlerSpy = vi.spyOn(_bridge, 'handleParameterChangeFromBackend');

    _bridge.parameterCache['vcf_cutoff'] = 0.5;
    _bridge.setParameter('vcf_cutoff', 0.75); // expectedRaw=191
    handlerSpy.mockClear();

    // El hardware manda un valor distinto (raw=64 → dataMsb=0, dataLsb=64)
    _bridge._nrpnInMsb = 0;
    _bridge._nrpnInLsb = 39;
    _bridge._nrpnInDataMsb = 0;
    _bridge._handleIncomingNrpn(38, 64);

    expect(handlerSpy).toHaveBeenCalledWith('vcf_cutoff', 64 / 255);
    expect(_window.parameterStore.getTransportStatus('vcf_cutoff')).toBe('synced');
  });
});

describe('sweep TTL — rollback parameter_edit', () => {
  it('expira la transacción, restaura committed y reenvía el valor', () => {
    const store = _window.parameterStore;
    // committed previo
    store.commitExternal('vcf_cutoff', 0.5);
    _bridge.parameterCache['vcf_cutoff'] = 0.5;

    const resendSpy = vi.spyOn(_bridge, 'sendWebMidiParameter');
    _bridge.setParameter('vcf_cutoff', 0.9);
    expect(store.getTransportStatus('vcf_cutoff')).toBe('pending');

    // Avanzar el reloj del store (now es Date.now real; usamos sweep con reloj inyectado)
    // Como el store usa Date.now() por defecto, forzamos la expiración con sweep(now)
    const future = Date.now() + 10000;
    store.sweep(future);

    expect(store.getTransportStatus('vcf_cutoff')).toBe('out_of_sync');
    expect(_bridge.parameterCache['vcf_cutoff']).toBe(0.5); // restaurado
    expect(resendSpy).toHaveBeenCalledWith('vcf_cutoff', 0.5);
  });
});

describe('FSM del puerto — integración', () => {
  it('isConnected alimenta connected→syncing→ready', async () => {
    const svc = _window.hardwareMidiService;
    expect(svc.getState()).toBe('disconnected');
    await _bridge.isConnected();
    expect(svc.getState()).toBe('ready');
    expect(svc.inspect().metrics.syncCount).toBe(1);
  });

  it('isConnected fallido → resync_required', async () => {
    const svc = _window.hardwareMidiService;
    // El wrapper captura el prototipo en eval-time; el stub lee _connectedResult
    _bridge._connectedResult = false;
    await _bridge.isConnected();
    expect(svc.getState()).toBe('resync_required');
  });

  it('sendNRPN alimenta transmitting→ready', () => {
    const svc = _window.hardwareMidiService;
    svc.forceState('ready');
    const origSend = StubBridge.prototype.sendNRPN;
    _bridge.sendNRPN(39, 191);
    expect(svc.getState()).toBe('ready');
    expect(svc.inspect().metrics.transmissionCount).toBe(1);
    expect(origSend).toBeDefined();
  });

  it('crea el singleton sysexAssembler', () => {
    expect(_window.sysexAssembler).toBeDefined();
    expect(_window.sysexAssembler.getState()).toBe('waiting');
  });
});

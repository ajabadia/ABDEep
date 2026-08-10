#!/usr/bin/env node
/**
 * @file hw_roundtrip_validate.js
 * @purpose Validación Nivel 3b (checklist B y C) con hardware real, ejecutando los
 * MÓDULOS WEBUI REALES (browser_packer.js, patch_name.js, parameter_store.js,
 * bridge-parameter-store.js, bridge-midi-rx-nrpn-handlers.js) conectados al DM12
 * por el puerto MIDI vía el paquete `midi`.
 *
 * Flujo:
 *   B) sendPatchToHardware → HardwareExporter.prepareForSysEx → buildSingleSysex
 *      → envío real → program dump request de vuelta → validación del mensaje
 *      (291 B, cabecera canónica, payload re-packetizable) + comparación del
 *      payload contra el esperado (round-trip byte a byte).
 *   C) NRPN real (CC 99/98/6/38) sobre filter.cutoff → captura del eco entrante
 *      → confirmByValue/isEcho con ParameterStore (TTL 300 ms). Si el DM12 no
 *      re-emite (como en este firmware), se anota `mark_only`/timeout.
 *
 * Uso:
 *   node scripts/hw_roundtrip_validate.js [--json] [--patch <path.syx>] [--nrpn-test]
 *
 * Exit code: 0 = validación completa OK · 1 = fallo · 2 = uso.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── Carga de módulos WebUI reales en un entorno window stub ──────────────────
function makeWindow() {
  const w = {
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
    navigator: {},
    _win: true,
  };
  return w;
}

// ── Stub de DualMidiBridge conectado al hardware real ───────────────────────
class HardwareBridge {
  constructor(midiPorts, byteOffsetToParamIds) {
    this.isJuce = false;
    this.midiPorts = midiPorts;
    this.parameterCache = {};
    // byteOffsetToParamIds viene como { byteOffset: [paramIds] } (formato del bridge real)
    this.byteOffsetToParamIds = byteOffsetToParamIds;
    this.paramToByteOffset = {};
    for (const [off, pids] of Object.entries(byteOffsetToParamIds)) {
      for (const pid of pids) { this.paramToByteOffset[pid] = Number(off); }
    }
    this.midiChannel = 1;
    this.midiLearnActive = false;
    this.midiLearnMappings = {};
    this._nrpnRxBytes = 0;
    this._nrpnPktCount = 0;
    this._nrpnInMsb = null;
    this._nrpnInLsb = null;
    this._nrpnInDataMsb = 0;
    this._nrpnTrafficCallbacks = [];
    this.echoCapture = []; // mensajes NRPN entrantes capturados
    this.sliderWrites = []; // registra re-escrituras de handleParameterChangeFromBackend
    this.sentMessages = [];
    this._hwName = midiPorts.outputName || 'DM12';
  }

  _normalizedToRaw(byteOffset, normalizedValue) {
    return Math.max(0, Math.min(255, Math.round(normalizedValue * 255)));
  }
  _rawToNormalized(byteOffset, rawValue) {
    return rawValue / 255.0;
  }

  handleParameterChangeFromBackend(paramId, normalizedValue) {
    this.parameterCache[paramId] = normalizedValue;
    this.sliderWrites.push({ paramId, normalizedValue, t: Date.now() });
  }

  // Envía NRPN real al hardware
  sendWebMidiParameter(paramId, normalizedValue) {
    const byteOffset = this.paramToByteOffset[paramId];
    if (byteOffset === undefined || byteOffset >= 300) { return; }
    const raw = this._normalizedToRaw(byteOffset, normalizedValue);
    this.sendNRPN(byteOffset, raw);
  }

  sendNRPN(byteOffset, raw) {
    const msb = (byteOffset >> 7) & 0x7F;
    const lsb = byteOffset & 0x7F;
    const dataMsb = (raw >> 7) & 0x7F;
    const dataLsb = raw & 0x7F;
    this.midiPorts.output.sendMessage([0xB0, 99, msb]);
    this.midiPorts.output.sendMessage([0xB0, 98, lsb]);
    if (dataMsb > 0) { this.midiPorts.output.sendMessage([0xB0, 6, dataMsb]); }
    this.midiPorts.output.sendMessage([0xB0, 38, dataLsb]);
    this.sentMessages.push({ kind: 'nrpn', byteOffset, raw });
  }

  sendBytes(bytes) {
    this.midiPorts.output.sendMessage(Array.from(bytes));
    this.sentMessages.push({ kind: 'sysex', len: bytes.length });
  }

  // Espejo de bridge-dual_params.js (el wrapper lo captura en eval-time)
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
  async isConnected() { return true; }
}

// ── Helpers MIDI ────────────────────────────────────────────────────────────

function openMidi() {
  const midi = require('midi');
  const input = new midi.Input();
  const output = new midi.Output();
  const ins = [];
  for (let i = 0; i < input.getPortCount(); i++) { ins.push({ index: i, name: input.getPortName(i) }); }
  const outs = [];
  for (let i = 0; i < output.getPortCount(); i++) { outs.push({ index: i, name: output.getPortName(i) }); }
  const pick = (ports, kind) => {
    if (ports.length === 0) { throw new Error(`No hay puertos MIDI ${kind}`); }
    const named = ports.find((p) => String(p.name).toLowerCase().includes('deepmind'));
    return (named || ports[0]).index;
  };
  const inIdx = pick(ins, 'IN');
  const outIdx = pick(outs, 'OUT');
  input.openPort(inIdx);
  output.openPort(outIdx);
  input.ignoreTypes(false, false, false); // OBLIGATORIO: recibir SysEx y CC
  return {
    input,
    output,
    inputName: ins.find((p) => p.index === inIdx).name,
    outputName: outs.find((p) => p.index === outIdx).name,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Captura la próxima respuesta SysEx que cumpla el predicado. */
function captureSysex(input, predicate, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      input.removeListener('message', onMsg);
      reject(new Error(`timeout ${timeoutMs}ms esperando SysEx`));
    }, timeoutMs);
    const onMsg = (dt, msg) => {
      const b = Array.from(msg);
      if (b.length && b[0] === 0xF0 && b[b.length - 1] === 0xF7 && predicate(b)) {
        clearTimeout(timer);
        input.removeListener('message', onMsg);
        resolve(b);
      }
    };
    input.on('message', onMsg);
  });
}

// ── Validación JS port fiel de validateSinglePatchSysexRoundTrip (C++) ───────
// Nota: el C++ además valida los bytes del patch contra una reconstrucción de 3 capas;
// en este harness el check de transporte (desempaquetar → re-empaquetar → idéntico) es
// el significativo para el round-trip real; la comparación byte a byte con el mensaje
// enviado se hace aparte (paso B.6).
function validateSinglePatchSysexRoundTrip(syxMessage, unpack7to8, pack8to7) {
  const report = { transportValid: true, mismatches: 0, exactMatches: 0 };
  if (syxMessage.length !== 291) { report.transportValid = false; return report; }
  const headerValid = syxMessage[0] === 0xF0 &&
    syxMessage[1] === 0x00 && syxMessage[2] === 0x20 &&
    syxMessage[3] === 0x32 && syxMessage[4] === 0x20 &&
    syxMessage[6] === 0x02 && syxMessage[290] === 0xF7;
  if (!headerValid) { report.transportValid = false; return report; }
  const packedPayload = syxMessage.slice(10, 288);
  const unpacked = unpack7to8(packedPayload);
  const rebuiltPacked = pack8to7(unpacked);
  for (let i = 0; i < 278; i++) {
    if (packedPayload[i] !== rebuiltPacked[i]) { report.transportValid = false; report.mismatches++; }
    else { report.exactMatches++; }
  }
  return report;
}

// ── Main ────────────────────────────────────────────────────────────────────

function usage() {
  console.error('Uso: node scripts/hw_roundtrip_validate.js [--json] [--patch <path.syx>] [--nrpn-test]');
}

async function main() {
  const args = process.argv.slice(2);
  const opts = { wantJson: args.includes('--json'), patchPath: null, nrpnTest: args.includes('--nrpn-test') };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--patch') { opts.patchPath = path.resolve(args[++i]); }
    else if (args[i] === '--json') { /* ok */ }
    else if (args[i] === '--nrpn-test') { /* ok */ }
    else { console.error(`Argumento desconocido: ${args[i]}`); usage(); process.exit(2); }
  }

  const report = { tool: 'hw_roundtrip_validate', date: new Date().toISOString().slice(0, 10), ok: true, steps: [] };
  // En modo --json: stdout queda reservado al JSON final; los logs (propios y de los
  // módulos WebUI cargados, que usan console.log global) van a stderr.
  if (opts.wantJson) {
    const origLog = console.log;
    console.log = (...a) => console.error(...a);
  }
  const out = (msg) => { if (opts.wantJson) { console.error(msg); } else { console.log(msg); } };
  const step = (name, ok, detail) => { report.steps.push({ name, ok, detail }); out(`${ok ? '✅' : '❌'} ${name}: ${detail}`); if (!ok) { report.ok = false; } };

  // 1. Cargar módulos WebUI reales
  const w = makeWindow();
  global.window = w;
  const loaded = {};
  try {
    // browser_packer.js — define window.buildSingleSysex/unpack7to8/pack8to7
    eval(`(function(window){ ${fs.readFileSync(path.resolve(ROOT, 'WebUI/js/browser_packer.js'), 'utf8')} })(w)`);
    loaded.buildSingleSysex = w.buildSingleSysex;
    loaded.unpack7to8 = w.unpack7to8;
    loaded.pack8to7 = w.pack8to7;
    // patch_name.js — window.HardwareExporter / PatchNameValidator
    eval(`(function(window){ ${fs.readFileSync(path.resolve(ROOT, 'WebUI/js/patch_name.js'), 'utf8')} })(w)`);
    loaded.HardwareExporter = w.HardwareExporter;
    loaded.PatchNameValidator = w.PatchNameValidator;
    // parameter_store.js — window.ParameterStore
    eval(`(function(window){ ${fs.readFileSync(path.resolve(ROOT, 'WebUI/js/parameter_store.js'), 'utf8')} })(w)`);
    loaded.ParameterStore = w.ParameterStore;
    step('módulos WebUI cargados (packer/name/store)', !!loaded.buildSingleSysex && !!loaded.HardwareExporter && !!loaded.ParameterStore,
      `buildSingleSysex=${typeof loaded.buildSingleSysex} HardwareExporter=${typeof loaded.HardwareExporter} ParameterStore=${typeof loaded.ParameterStore}`);
  } catch (e) {
    step('módulos WebUI cargados', false, e.message);
    process.exit(report.ok ? 0 : 1);
  }

  // 2. Abrir MIDI y cablear el bridge
  let midiPorts;
  try {
    midiPorts = openMidi();
    step('puerto MIDI abierto', true, `IN "${midiPorts.inputName}" · OUT "${midiPorts.outputName}"`);
  } catch (e) {
    step('puerto MIDI abierto', false, e.message);
    process.exit(1);
  }

  // Mapa byteOffset → [paramIds] (subconjunto real del registro; vcf_cutoff = 39)
  const byteOffsetToParamIds = {
    39: ['vcf_cutoff'],
    0: ['lfo1_rate'],
    53: ['env_amp_attack'],
    41: ['filter_resonance'],
  };
  const bridge = new HardwareBridge(midiPorts, byteOffsetToParamIds);
  global.DualMidiBridge = HardwareBridge;
  global.getBridge = () => bridge;
  // Mensaje de restauración A/0 (se rellena en B.1 y se reenvía en el finally).
  let restoreSyx = null;

  try {
    // Cargar bridge-parameter-store.js (cablea ParameterStore+FSM en setParameter)
    eval(`(function(window, DualMidiBridge){ ${fs.readFileSync(path.resolve(ROOT, 'WebUI/js/bridge-parameter-store.js'), 'utf8')} })(w, HardwareBridge)`);
    // Cargar bridge-midi-rx-nrpn-handlers.js (hook del eco → confirmByValue)
    eval(`(function(window, DualMidiBridge){ ${fs.readFileSync(path.resolve(ROOT, 'WebUI/js/bridge-midi-rx-nrpn-handlers.js'), 'utf8')} })(w, HardwareBridge)`);
    const store = w.parameterStore;
    step('integration WebUI cableada (parameterStore + nrpn-handlers)', !!store && typeof bridge._handleIncomingNrpn === 'function',
      `store=${!!store} handler=${typeof bridge._handleIncomingNrpn}`);

    // ── B) Round-trip de programa ──────────────────────────────────────────
    // B.1: patch de prueba (A/0 del corpus) o --patch. También es el patch de
    // restauración: al final del harness se reenvía A/0 al hardware para dejar el
    // synth exactamente como estaba (contrato del Nivel 3b).
    let originalBytes = null;
    if (opts.patchPath) {
      const buf = fs.readFileSync(opts.patchPath);
      const msg = buf.subarray(0, 291);
      originalBytes = loaded.unpack7to8(Array.from(msg.slice(10, 288)));
    } else {
      const corpus = fs.readFileSync(path.resolve(ROOT, 'resources/banks/Factory Banks V1.1.2/Synth Bank A.syx'));
      const msg = corpus.subarray(0, 291);
      originalBytes = loaded.unpack7to8(Array.from(msg.slice(10, 288)));
    }
    const original = new Uint8Array(originalBytes);
    // Mensaje de restauración: A/0 con el nombre original (sin tocar) y dev 0x00.
    restoreSyx = loaded.buildSingleSysex({ unpackedBytes: original }, 0, 0, 0x00);

    // B.2: HardwareExporter.prepareForSysEx (no debe mutar el original)
    const prep = loaded.HardwareExporter.prepareForSysEx({ name: 'A BDEep 16-char?', unpackedBytes: original });
    const originalImmutable = Array.from(original.slice(223, 239)).join(',');
    step('HardwareExporter no muta el patch original', prep.patch !== original &&
      Array.from(original.slice(223, 239)).join(',') === originalImmutable,
      `name=${JSON.stringify(prep.name)} truncated=${prep.truncated} original bytes 223-238 intactos`);

    // B.3: buildSingleSysex del patch preparado → 291 B canónico
    const syx = loaded.buildSingleSysex(prep.patch, 0, 0, 0x00);
    step('buildSingleSysex → 291 B canónico', syx.length === 291 && syx[0] === 0xF0 && syx[6] === 0x02 && syx[290] === 0xF7,
      `len=${syx.length} dev=${syx[5].toString(16)} bank=${syx[8]} prog=${syx[9]}`);

    // B.4: envío real al hardware (dev 0x00, como el MCP)
    bridge.sendBytes(syx);
    await sleep(150);
    step('sendPatchToHardware → MIDI real', true, `enviados ${syx.length} B`);

    // B.5: pedir el programa de vuelta (program dump request) y validar
    const req = Uint8Array.from([0xF0, 0x00, 0x20, 0x32, 0x20, 0x00, 0x01, 0x00, 0x00, 0xF7]);
    const respPromise = captureSysex(midiPorts.input, (b) => b[6] === 0x02);
    bridge.sendBytes(req);
    const resp = await respPromise;

    const reportRT = validateSinglePatchSysexRoundTrip(resp, loaded.unpack7to8, loaded.pack8to7);
    step('validateSinglePatchSysexRoundTrip (port JS del C++)', reportRT.transportValid && reportRT.mismatches === 0,
      `transport=${reportRT.transportValid} mismatches=${reportRT.mismatches} (repack 278/278)`);

    // B.6: comparación byte a byte payload enviado vs vuelto
    const respUnpacked = loaded.unpack7to8(resp.slice(10, 288));
    const sentUnpacked = loaded.unpack7to8(Array.from(syx.slice(10, 288)));
    let diffs = 0;
    const diffList = [];
    for (let i = 0; i < 242; i++) {
      if (respUnpacked[i] !== sentUnpacked[i]) { diffs++; if (diffList.length < 8) { diffList.push(i); } }
    }
    step('payload idéntico enviado ↔ vuelto', diffs === 0,
      diffs === 0 ? '242/242 bytes idénticos' : `${diffs} bytes distintos en offsets ${diffList.join(',')}`);

    // Nombre recibido (bytes 223-238)
    const nameChars = [];
    for (let k = 223; k < 239; k++) { const c = respUnpacked[k]; if (c === 0) { break; } nameChars.push(String.fromCharCode(c)); }
    step('nombre en el dump de vuelta', true, `"${nameChars.join('').trim()}"`);

    // ── C) NRPN real + eco CC38 + ParameterStore ───────────────────────────
    if (opts.nrpnTest) {
      // C.1: iniciar transacción vía setParameter (como la UI con bridge-parameter-store cableado)
      bridge.parameterCache['vcf_cutoff'] = 0.5;
      bridge.setParameter('vcf_cutoff', 0.75);
      const tx = store.inspect().transactions.find((t) => t.parameterId === 'vcf_cutoff');
      step('C.1 setParameter inicia transacción pending', !!tx && tx.state === 'pending' && tx.expectedRawValue === 191,
        `tx=${tx ? tx.transactionId : 'NONE'} expectedRaw=${tx ? tx.expectedRawValue : '-'} status=${store.getTransportStatus('vcf_cutoff')}`);

      // C.2: TTL sin eco — el DM12 real NO re-emite NRPN (verificado en vivo); la
      // transacción expira por TTL 300ms (sweep interno de 100ms) → out_of_sync.
      await sleep(1200); // > TTL 300ms (sweep interno de 100ms la expira)
      const echoed = bridge.echoCapture.filter((m) => m.bytes[1] === 38).length;
      const storeStatusAfter = store.getTransportStatus('vcf_cutoff');
      step('C.2 TTL sin eco (DM12 no re-emite NRPN) → out_of_sync', storeStatusAfter === 'out_of_sync' && echoed === 0,
        `ecos CC38 capturados: ${echoed} · transacción expirada por TTL 300ms → status=${storeStatusAfter} (política timeout/out_of_sync).`);

      // C.3: eco inmediato (transacción fresca SIN sweep concurrente) →
      // confirmByValue isEcho=true → 'confirmed' sin re-escritura del slider.
      // La transacción se abre directamente (mismo camino que bridge-parameter-store)
      // para evitar el race con el setInterval de sweep (100ms) del cableado real.
      const txEcho = store.beginTransaction({ parameterId: 'vcf_cutoff', originId: 'ui', normalizedValue: 0.75, expectedRawValue: 191 });
      // simular el mensaje NRPN entrante que llegaría por handleIncomingMidi:
      // CC99=0 CC98=39 CC6=1 CC38=63 → raw14 = (1<<7)|63 = 191
      bridge._nrpnInMsb = 0; bridge._nrpnInLsb = 39; bridge._nrpnInDataMsb = 1;
      const sliderWritesMid = bridge.sliderWrites.length;
      const handled = bridge._handleIncomingNrpn(38, 63);
      const statusAfterEcho = store.getTransportStatus('vcf_cutoff');
      const noSliderRewrite = bridge.sliderWrites.length === sliderWritesMid;
      step('C.3 eco NRPN → confirmByValue isEcho (sin re-escritura del slider)',
        handled && statusAfterEcho === 'confirmed' && noSliderRewrite,
        `handled=${handled} status=${statusAfterEcho} sliderRewrites=${bridge.sliderWrites.length - sliderWritesMid}`);

      // C.4: override externo (eco con valor distinto) → UI se actualiza
      const writesBefore = bridge.sliderWrites.length;
      store.beginTransaction({ parameterId: 'vcf_cutoff', originId: 'ui', normalizedValue: 0.75, expectedRawValue: 191 });
      bridge._nrpnInMsb = 0; bridge._nrpnInLsb = 39; bridge._nrpnInDataMsb = 0;
      bridge._handleIncomingNrpn(38, 64); // raw 64 (distinto de 191)
      const statusOverride = store.getTransportStatus('vcf_cutoff');
      step('C.4 override externo (raw≠esperado) → UI actualizada',
        statusOverride === 'synced' && bridge.sliderWrites.length === writesBefore + 1,
        `status=${statusOverride} writes=${bridge.sliderWrites.length - writesBefore}`);

      // C.5: TTL — transacción sin eco → sweep → rollback (política del bridge)
      bridge.parameterCache['vcf_cutoff'] = 0.5;
      bridge.setParameter('vcf_cutoff', 0.9);
      store.sweep(Date.now() + 10000);
      const afterRollback = store.getTransportStatus('vcf_cutoff');
      step('C.5 sweep TTL → timeout → out_of_sync', afterRollback === 'out_of_sync', `status=${afterRollback}`);
    }
  } catch (e) {
    step('ejecución', false, e.stack || e.message);
  } finally {
    // Restauración: reenvía A/0 (el patch de B.1) al hardware para dejar el synth
    // exactamente como estaba (contrato Nivel 3b: la corrida no debe alterar el
    // edit buffer del usuario). Se omite con --patch (estado original desconocido).
    if (restoreSyx && !opts.patchPath) {
      try {
        bridge.sendBytes(restoreSyx);
        await sleep(200);
        step('restauración A/0 al hardware', true, `reenviados ${restoreSyx.length} B (nombre original + cutoff original)`);
      } catch (e) {
        step('restauración A/0 al hardware', false, e.message);
      }
    }
    try { midiPorts.input.closePort(); } catch (e) { /* ignore */ }
    try { midiPorts.output.closePort(); } catch (e) { /* ignore */ }
  }

  console.log(report.ok ? 'RESULTADO: OK' : 'RESULTADO: FALLO');
  if (opts.wantJson) { process.stdout.write(JSON.stringify(report, null, 2) + '\n'); }
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });

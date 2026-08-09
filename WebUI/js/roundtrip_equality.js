/**
 * @file roundtrip_equality.js
 * @purpose Fase 4 (plan v3.2 §5) — Batería de igualdad de round-trip en 3 niveles
 *          + property-based testing / fuzzing con recursos acotados.
 *
 * Niveles (matriz de pruebas del plan):
 *   - Nivel 1 `rawCodecEqual`         : Bytes → Pack → Unpack → Bytes.
 *   - Nivel 2 `semanticEqual`         : Patch → Parámetros → Patch, descartando
 *                                       bytes reservados (nombre 223-238 + cola
 *                                       239-241) y padding (bytes sin parámetro).
 *   - Nivel 3a `hardwareCanonicalEqual`: Comparación contra el corpus A–H
 *                                       registrando exact_match | canonical_match |
 *                                       semantic_match | known_exception.
 *   - `fuzzRoundTrip`                 : Property-based testing acotado
 *                                       (Max Payload 500B, Max Timeout 100ms/caso).
 *
 * Los codecs pack8to7/unpack7to8 son copias EXACTAS de browser_packer.js /
 * RoundTripValidator.cpp (paridad byte a byte, verificada por parityProgramDump.test.js
 * y validate_sysex_mapping.js). El registro de parámetros (registry.gen.js) se
 * resuelve por opción o desde window/globalThis.ParameterRegistry.
 *
 * UMD: window.RoundTripEquality (navegador) / module.exports (Node).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else if (typeof window !== 'undefined') { window.RoundTripEquality = factory(); }
  else { root.RoundTripEquality = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ────────────────────────────────────────────────────────────────
  // Constantes del protocolo (canónicas — idénticas a validate_sysex_mapping.js)
  // ────────────────────────────────────────────────────────────────
  let UNPACKED_LEN = 242;
  let SYSEX_MSG_LEN = 291;
  let SYSEX_HEADER_LEN = 10;   // bytes 0-9: F0 00 20 32 20 <dev> 02 <proto> <bank> <prog>
  let SYSEX_PACKED_LEN = 278;  // payload empaquetado (bytes 10-287)
  let SYSEX_TAIL_LEN = 3;      // bytes 288-290 (00 00 F7)
  let NAME_START = 223;        // nombre del patch (16 chars ASCII, verificado en dumps)
  let NAME_END = 238;
  let TAIL_START = 239;        // cola del payload
  let TAIL_END = 241;

  // Límites de recurso para el fuzzing (plan v3.2 §5)
  let FUZZ_MAX_PAYLOAD = 500;   // Max Payload por caso (bytes)
  let FUZZ_MAX_TIMEOUT_MS = 100; // Max Timeout por caso (ms)

  // Clasificaciones de Nivel 3a (plan §5)
  let EXACT = 'exact_match';
  let CANONICAL = 'canonical_match';
  let SEMANTIC = 'semantic_match';
  let KNOWN_EXCEPTION = 'known_exception';
  let NO_MATCH = 'no_match';

  // ────────────────────────────────────────────────────────────────
  // Codec 7/8 bits (copia exacta de browser_packer.js / RoundTripValidator.cpp)
  // ────────────────────────────────────────────────────────────────

  function unpack7to8(packedBytes) {
    let unpacked = new Uint8Array(UNPACKED_LEN);
    let writeIdx = 0;
    for (let i = 0; i < packedBytes.length; i += 8) {
      let msbFlags = packedBytes[i];
      for (let k = 1; k < 8; k++) {
        if (i + k >= packedBytes.length) { break; }
        if (writeIdx >= UNPACKED_LEN) { break; }
        let val = packedBytes[i + k];
        if (msbFlags & (1 << (k - 1))) {
          val |= 0x80;
        }
        unpacked[writeIdx++] = val;
      }
    }
    return unpacked;
  }

  function pack8to7(unpackedBytes) {
    let packed = new Uint8Array(SYSEX_PACKED_LEN);
    let readIdx = 0;
    let writeIdx = 0;
    while (readIdx < UNPACKED_LEN && writeIdx < SYSEX_PACKED_LEN) {
      let msbFlags = 0;
      let startWriteIdx = writeIdx;
      writeIdx++;
      for (let k = 1; k < 8; k++) {
        if (readIdx >= UNPACKED_LEN) { break; }
        let val = unpackedBytes[readIdx++];
        if (val & 0x80) {
          msbFlags |= (1 << (k - 1));
          val &= 0x7F;
        }
        packed[startWriteIdx + k] = val;
        writeIdx++;
      }
      packed[startWriteIdx] = msbFlags;
    }
    return packed;
  }

  // ────────────────────────────────────────────────────────────────
  // Helpers de entrada (aceptan Array | Uint8Array | Buffer)
  // ────────────────────────────────────────────────────────────────

  function toBytes(input) {
    if (input instanceof Uint8Array) { return input; }
    if (input && input.buffer instanceof ArrayBuffer && typeof input.length === 'number') {
      return new Uint8Array(input.buffer, input.byteOffset || 0, input.length);
    }
    return new Uint8Array(input);
  }

  function isUnpackedLength(n) { return n === UNPACKED_LEN; }
  function isPackedLength(n) { return n === SYSEX_PACKED_LEN; }
  function isSysexLength(n) { return n === SYSEX_MSG_LEN; }

  /** Convierte una entrada (242 unpacked, 278 packed o 291 sysex) a 242 unpacked. */
  function toUnpacked(input, opts) {
    let bytes = toBytes(input);
    if (isUnpackedLength(bytes.length)) { return { unpacked: bytes, kind: 'unpacked' }; }
    if (isPackedLength(bytes.length)) {
      return { unpacked: api.unpack7to8(bytes), kind: 'packed' };
    }
    if (isSysexLength(bytes.length)) {
      let headerOk = isCanonicalSysexHeader(bytes);
      if (!headerOk && opts && opts.requireHeader) {
        return { error: 'invalid_sysex_header' };
      }
      let payload = bytes.slice(SYSEX_HEADER_LEN, SYSEX_HEADER_LEN + SYSEX_PACKED_LEN);
      let bankNum = bytes[8] & 0x07;
      return {
        unpacked: api.unpack7to8(payload),
        packed: payload,
        kind: 'sysex',
        headerOk: headerOk,
        // Posición declarada en la cabecera (banco 0-7 = A-H, programa 0-127)
        header: { bank: bankNum, bankLetter: String.fromCharCode(65 + bankNum), prog: bytes[9] & 0x7F },
      };
    }
    return { error: 'invalid_length' };
  }

  /** Valida la cabecera canónica (F0 00 20 32 20 <dev> 02 <proto> <bank> <prog> ... F7). */
  function isCanonicalSysexHeader(msg) {
    return msg.length === SYSEX_MSG_LEN &&
      msg[0] === 0xF0 && msg[1] === 0x00 && msg[2] === 0x20 && msg[3] === 0x32 &&
      msg[4] === 0x20 && msg[6] === 0x02 && msg[290] === 0xF7;
  }

  function bytesEqual(a, b) {
    if (a.length !== b.length) { return false; }
    for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) { return false; } }
    return true;
  }

  /** Lista de offsets con diferencias raw entre dos buffers de igual longitud. */
  function diffOffsets(a, b) {
    let diffs = [];
    let n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) { if (a[i] !== b[i]) { diffs.push(i); } }
    return diffs;
  }

  function resolveRegistry(opts) {
    if (opts && opts.registry) { return opts.registry; }
    if (typeof window !== 'undefined' && window.ParameterRegistry) { return window.ParameterRegistry; }
    if (typeof globalThis !== 'undefined' && globalThis.ParameterRegistry) { return globalThis.ParameterRegistry; }
    return null;
  }

  function isReservedByte(i) { return i >= NAME_START && i <= TAIL_END; }

  // ────────────────────────────────────────────────────────────────
  // Nivel 1 — rawCodecEqual: Bytes → Pack → Unpack → Bytes
  // ────────────────────────────────────────────────────────────────

  /**
   * Verifica la invariante de Nivel 1: el codec pack→unpack es la identidad y
   * ambos lados coinciden byte a byte tras el round-trip.
   * Acepta entrada de 242 (unpacked), 278 (packed) o 291 (sysex) bytes.
   *
   * @returns {{equal:boolean, level:number, classification:string,
   *            roundTripExact:{a:boolean,b:boolean}, mismatches:number[], kind:string}}
   */
  function rawCodecEqual(aInput, bInput, opts) {
    let result = {
      level: 1,
      classification: 'mismatch',
      equal: false,
      roundTripExact: { a: false, b: false },
      mismatches: [],
      kind: 'unpacked',
    };

    let a = toUnpacked(aInput, opts);
    if (a.error) { result.error = 'a:' + a.error; return result; }
    let b = toUnpacked(bInput, opts);
    if (b.error) { result.error = 'b:' + b.error; return result; }
    if (a.kind !== b.kind) { result.kind = a.kind + '/' + b.kind; }

    // Invariante de codec: pack → unpack reproduce los bytes originales.
    result.roundTripExact.a = bytesEqual(a.unpacked, api.unpack7to8(api.pack8to7(a.unpacked)));
    result.roundTripExact.b = bytesEqual(b.unpacked, api.unpack7to8(api.pack8to7(b.unpacked)));

    // Igualdad tras el round-trip (mismo patch desempaquetado).
    result.mismatches = diffOffsets(a.unpacked, b.unpacked);
    result.equal = result.roundTripExact.a && result.roundTripExact.b && result.mismatches.length === 0;
    result.classification = result.equal ? 'exact' : 'mismatch';
    return result;
  }

  // ────────────────────────────────────────────────────────────────
  // Nivel 2 — semanticEqual: Patch → Parámetros → Patch
  // ────────────────────────────────────────────────────────────────

  /**
   * Compara dos patches en el espacio de parámetros (normalizado 0..1) usando el
   * registro (registry.gen.js). Descarta bytes reservados (nombre 223-238, cola
   * 239-241) y padding (bytes sin parámetro mapeado). También verifica la
   * estabilidad de re-encode Patch → Parámetros → Patch (±1 raw).
   *
   * @returns {{equal:boolean, level:number, classification:string,
   *            mismatches:Array<{byteOffset:number, paramIds:string[], rawA:number,
   *              rawB:number, normA:number, normB:number}>, ignoredBytes:number[],
   *            checkedBytes:number, reencodeStable:boolean}}
   */
  function semanticEqual(aInput, bInput, opts) {
    opts = opts || {};
    let tolerance = opts.tolerance !== undefined ? opts.tolerance : 1 / 255;
    let registry = resolveRegistry(opts);

    let result = {
      level: 2,
      classification: 'semantic',
      equal: false,
      mismatches: [],
      ignoredBytes: [],
      checkedBytes: 0,
      reencodeStable: true,
      registryAvailable: !!registry,
    };

    let a = toUnpacked(aInput, opts);
    if (a.error) { result.error = 'a:' + a.error; return result; }
    let b = toUnpacked(bInput, opts);
    if (b.error) { result.error = 'b:' + b.error; return result; }

    if (!registry) {
      // Sin registro no hay decodificación: degrada a comparación estructural.
      // Nota: el fallback NO puede distinguir padding (bytes sin parámetro) sin
      // byOffset, así que compara todos los bytes no reservados — más estricto
      // que el camino con registro (conservador a propósito).
      let rawMismatch = 0;
      for (let i = 0; i < UNPACKED_LEN; i++) {
        if (isReservedByte(i)) { result.ignoredBytes.push(i); continue; }
        result.checkedBytes++;
        if (a.unpacked[i] !== b.unpacked[i]) { rawMismatch++; }
      }
      result.equal = rawMismatch === 0;
      result.classification = result.equal ? 'semantic' : 'mismatch';
      return result;
    }

    for (let idx = 0; idx < UNPACKED_LEN; idx++) {
      let ids = registry.byOffset && registry.byOffset[idx];
      let hasParam = ids && ids.length > 0;

      // Bytes reservados (nombre + cola) y padding (sin parámetro) se descartan.
      if (isReservedByte(idx) || !hasParam) {
        result.ignoredBytes.push(idx);
        continue;
      }
      result.checkedBytes++;

      let rawA = a.unpacked[idx] & 0xFF;
      let rawB = b.unpacked[idx] & 0xFF;
      let normA = registry.rawToNormalized ? registry.rawToNormalized(idx, rawA) : rawA / 255;
      let normB = registry.rawToNormalized ? registry.rawToNormalized(idx, rawB) : rawB / 255;

      if (Math.abs(normA - normB) > tolerance) {
        result.classification = 'mismatch';
        result.mismatches.push({
          byteOffset: idx,
          paramIds: ids.slice(),
          rawA: rawA,
          rawB: rawB,
          normA: normA,
          normB: normB,
        });
      }

      // Estabilidad de re-encode (Patch → Parámetros → Patch): el raw reconstruido
      // desde el valor normalizado debe quedar dentro de ±1 del original. Para
      // enums solo se evalúa el rango válido [0..enumMax] — fuera de rango el
      // codec hace clamp (documentado en registryGen.test.js) y NO es inestabilidad.
      if (registry.normalizedToRaw) {
        let p = registry.byId && registry.byId[ids[0]];
        let enumMax = p && p.codecType === 'enum' ? p.enumMax : 255;
        if (rawA <= enumMax) {
          let rebuiltA = registry.normalizedToRaw(idx, normA);
          if (Math.abs(rebuiltA - rawA) > 1) { result.reencodeStable = false; }
        }
        if (rawB <= enumMax) {
          let rebuiltB = registry.normalizedToRaw(idx, normB);
          if (Math.abs(rebuiltB - rawB) > 1) { result.reencodeStable = false; }
        }
      }
    }

    result.equal = result.mismatches.length === 0;
    return result;
  }

  // ────────────────────────────────────────────────────────────────
  // Nivel 3a — hardwareCanonicalEqual: comparación contra el corpus A–H
  // ────────────────────────────────────────────────────────────────

  /**
   * Clasifica un entry del corpus contra un target:
   *   exact_match       → bytes desempaquetados idénticos Y misma posición
   *                       declarada (bank/prog de la cabecera del target)
   *   canonical_match   → bytes desempaquetados idénticos pero posición distinta
   *                       o desconocida (payload igual, cabecera de posición difiere)
   *   semantic_match    → semanticEqual sin violaciones de parámetros
   *   known_exception   → entry listado en opts.knownExceptions (bank/prog)
   *   no_match          → ninguno de los anteriores
   */
  function classifyCorpusMatch(targetUnpacked, entry, opts) {
    opts = opts || {};

    if (opts.knownExceptions && Array.isArray(opts.knownExceptions)) {
      for (let k = 0; k < opts.knownExceptions.length; k++) {
        let ex = opts.knownExceptions[k];
        if (ex.bank === entry.bank && ex.prog === entry.prog) {
          return { classification: KNOWN_EXCEPTION, reason: ex.reason || 'known exception' };
        }
      }
    }

    if (bytesEqual(targetUnpacked, entry.unpacked)) {
      let targetPos = opts.targetHeader;
      let samePosition = targetPos &&
        (targetPos.bankLetter === entry.bank || targetPos.bank === entry.bank) &&
        targetPos.prog === entry.prog;
      if (samePosition) {
        return { classification: EXACT, reason: 'byte-identical unpacked patch at the declared position' };
      }
      return { classification: CANONICAL, reason: 'byte-identical unpacked patch (position header differs or absent)' };
    }

    let sem = semanticEqual(targetUnpacked, entry.unpacked, opts);
    if (sem.equal) {
      return { classification: SEMANTIC, reason: 'semantically equal (parameters match within tolerance)' };
    }

    return { classification: NO_MATCH, reason: 'no correspondence in corpus' };
  }

  /**
   * Compara un target (242/278/291 bytes o {unpacked, bank, prog}) contra el corpus
   * A–H (array de {bank, prog, unpacked, packed}). Devuelve la mejor coincidencia.
   *
   * @returns {{matches:Array, best:string, bestMatch:object|null,
   *            knownExceptionApplied:boolean, corpusSize:number}}
   */
  function hardwareCanonicalEqual(targetInput, corpus, opts) {
    opts = opts || {};
    let registry = resolveRegistry(opts);

    // Forma de objeto {unpacked, bank, prog}: la posición declarada se extrae
    // igual que de una cabecera sysex (bytes idénticos + misma posición → exact).
    // El banco se acepta como número (0-7) o letra ('A'-'H').
    let t;
    if (targetInput && targetInput.unpacked) {
      t = { unpacked: toBytes(targetInput.unpacked) };
      if (targetInput.bank !== undefined && targetInput.prog !== undefined) {
        let bankRef = targetInput.bank;
        let bankNum;
        if (typeof bankRef === 'string' && bankRef.length > 0) {
          bankNum = (bankRef.toUpperCase().charCodeAt(0) - 65) & 0x07;
        } else {
          bankNum = Number(bankRef) & 0x07;
        }
        t.header = {
          bank: bankNum,
          bankLetter: String.fromCharCode(65 + bankNum),
          prog: Number(targetInput.prog) & 0x7F,
        };
      }
    } else {
      t = toUnpacked(targetInput, opts);
    }
    if (t.error) {
      return { matches: [], best: NO_MATCH, bestMatch: null, error: t.error, corpusSize: 0, knownExceptionApplied: false };
    }
    let targetUnpacked = t.unpacked;

    let matches = [];
    for (let i = 0; i < corpus.length; i++) {
      let entry = corpus[i];
      let m = classifyCorpusMatch(targetUnpacked, entry, {
        registry: registry,
        knownExceptions: opts.knownExceptions,
        tolerance: opts.tolerance,
        targetHeader: t.header || null,
      });
      m.bank = entry.bank;
      m.prog = entry.prog;
      matches.push(m);
    }

    let rank = {};
    rank[EXACT] = 4;
    rank[CANONICAL] = 3;
    rank[SEMANTIC] = 2;
    rank[KNOWN_EXCEPTION] = 1;
    rank[NO_MATCH] = 0;

    let best = NO_MATCH;
    let bestMatch = null;
    for (let j = 0; j < matches.length; j++) {
      if (rank[matches[j].classification] > rank[best]) {
        best = matches[j].classification;
        bestMatch = matches[j];
      }
    }

    return {
      matches: matches,
      best: best,
      bestMatch: bestMatch,
      knownExceptionApplied: best === KNOWN_EXCEPTION,
      corpusSize: corpus.length,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Fuzzing acotado (property-based testing, plan v3.2 §5)
  // ────────────────────────────────────────────────────────────────

  /** PRNG determinista mulberry32 — reproducibilidad en CI. */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomBytes(rng, len) {
    let out = new Uint8Array(len);
    for (let i = 0; i < len; i++) { out[i] = Math.floor(rng() * 256); }
    return out;
  }

  /**
   * Property-based testing con límites acotados (plan §5):
   *   - Invariante Nivel 1: unpack7to8(pack8to7(x)) === x para payloads aleatorios.
   *   - Invariante Nivel 2: decode(encode(params)) ≈ params (estabilidad ±1 raw).
   *   - Max Payload 500B por caso; Max Timeout 100ms por caso (se aborta si se excede).
   *
   * @param {{seed?:number, iterations?:number, maxPayload?:number,
   *          maxTimeoutMs?:number, registry?:object}} opts
   * @returns {{seed:number, iterations:number, maxPayload:number, maxTimeoutMs:number,
   *            passed:number, failed:number, maxCaseMs:number, violations:Array<object>,
   *            deterministic:boolean}}
   */
  function fuzzRoundTrip(opts) {
    opts = opts || {};
    let seed = opts.seed !== undefined ? (opts.seed >>> 0) : 0xC0FFEE;
    let iterations = opts.iterations || 100;
    let maxPayload = opts.maxPayload || FUZZ_MAX_PAYLOAD;
    let maxTimeoutMs = opts.maxTimeoutMs !== undefined ? opts.maxTimeoutMs : FUZZ_MAX_TIMEOUT_MS;
    let registry = resolveRegistry(opts);

    let rng = mulberry32(seed);
    let violations = [];
    let passed = 0;
    let failed = 0;
    let maxCaseMs = 0;

    for (let i = 0; i < iterations; i++) {
      let start = Date.now();
      let caseViolation = null;

      // Caso A — invariante de codec (Nivel 1) sobre payloads de 242 bytes.
      let data = randomBytes(rng, UNPACKED_LEN);
      let roundTripped = api.unpack7to8(api.pack8to7(data));
      if (!bytesEqual(roundTripped, data)) {
        caseViolation = { case: i, property: 'codec_invariance', detail: 'unpack7to8(pack8to7(x)) !== x', length: UNPACKED_LEN };
      }

      // Caso A2 — payload arbitrario dentro del límite (Max Payload 500B): el
      // codec no debe lanzar ni producir más de 242 bytes al desempaquetar.
      if (!caseViolation) {
        let anyLen = Math.floor(rng() * maxPayload) + 1;
        let anyPayload = randomBytes(rng, anyLen);
        try {
          let decoded = api.unpack7to8(anyPayload);
          if (decoded.length > UNPACKED_LEN) {
            caseViolation = { case: i, property: 'codec_payload_bound', detail: 'unpack produjo ' + decoded.length + ' bytes (> 242)', length: anyLen };
          }
        } catch (e) {
          caseViolation = { case: i, property: 'codec_throws', detail: String(e), length: anyLen };
        }
      }

      // Caso B — estabilidad decode/encode (Nivel 2) si hay registro.
      if (!caseViolation && registry && registry.rawToNormalized && registry.normalizedToRaw) {
        let patch = randomBytes(rng, UNPACKED_LEN);
        let unstable = [];
        for (let idx = 0; idx < UNPACKED_LEN; idx++) {
          if (isReservedByte(idx)) { continue; }
          let ids = registry.byOffset && registry.byOffset[idx];
          if (!ids || ids.length === 0) { continue; }
          let p = registry.byId && registry.byId[ids[0]];
          // Para enums se muestrea dentro del rango válido [0..enumMax]: fuera de
          // rango el codec clampa (comportamiento documentado, no inestabilidad).
          let enumMax = p && p.codecType === 'enum' ? p.enumMax : 255;
          let raw = (patch[idx] & 0xFF) % (enumMax + 1);
          let norm = registry.rawToNormalized(idx, raw);
          let back = registry.normalizedToRaw(idx, norm);
          if (Math.abs(back - raw) > 1) {
            unstable.push({ byteOffset: idx, raw: raw, rebuilt: back });
          }
        }
        if (unstable.length > 0) {
          caseViolation = { case: i, property: 'decode_encode_stability', detail: unstable.slice(0, 5) };
        }
      }

      let caseMs = Date.now() - start;
      if (caseMs > maxCaseMs) { maxCaseMs = caseMs; }
      if (caseMs > maxTimeoutMs) {
        violations.push({ case: i, property: 'timeout', caseMs: caseMs, maxTimeoutMs: maxTimeoutMs });
        failed++;
        continue;
      }
      if (caseViolation) {
        violations.push(caseViolation);
        failed++;
      } else {
        passed++;
      }
    }

    // `deterministic` es falso si hubo timeouts: dependen del reloj de pared.
    let deterministic = true;
    for (let v = 0; v < violations.length; v++) {
      if (violations[v].property === 'timeout') { deterministic = false; break; }
    }

    return {
      seed: seed,
      iterations: iterations,
      maxPayload: maxPayload,
      maxTimeoutMs: maxTimeoutMs,
      passed: passed,
      failed: failed,
      maxCaseMs: maxCaseMs,
      violations: violations,
      deterministic: deterministic,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Carga del corpus A–H (solo Node — usado por tests y scripts de CI)
  // ────────────────────────────────────────────────────────────────

  /**
   * Carga los 8 factory banks A–H (o los indicados) como corpus para
   * hardwareCanonicalEqual. Cada entry: {bank, prog, unpacked, packed}.
   * Requiere Node.js (fs). No disponible en navegador.
   */
  function loadCorpusFromBanks(banksDir, bankLetters) {
    if (typeof require !== 'function' || typeof process === 'undefined') {
      throw new Error('loadCorpusFromBanks solo disponible en Node.js');
    }
    let fs = require('fs');
    let path = require('path');
    let letters = bankLetters || ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    let corpus = [];

    for (let b = 0; b < letters.length; b++) {
      let letter = letters[b];
      let filePath = path.join(banksDir, 'Synth Bank ' + letter + '.syx');
      if (!fs.existsSync(filePath)) { continue; }
      let data = fs.readFileSync(filePath);
      let offset = 0;
      while (offset + SYSEX_MSG_LEN <= data.length) {
        let msg = data.slice(offset, offset + SYSEX_MSG_LEN);
        if (msg[0] !== 0xF0 || msg[1] !== 0x00 || msg[2] !== 0x20 || msg[3] !== 0x32) {
          offset += SYSEX_MSG_LEN;
          continue;
        }
        let payload = new Uint8Array(msg.slice(SYSEX_HEADER_LEN, SYSEX_HEADER_LEN + SYSEX_PACKED_LEN));
        let unpacked = api.unpack7to8(payload);
        corpus.push({
          bank: letter,
          prog: msg[9] & 0x7F, // programa declarado en la cabecera (no por orden)
          unpacked: unpacked,
          packed: payload,
        });
        offset += SYSEX_MSG_LEN;
      }
    }
    return corpus;
  }

  // ────────────────────────────────────────────────────────────────
  // API pública
  // ────────────────────────────────────────────────────────────────
  // Nota: las funciones internas invocan el codec a través de `api` (holder
  // mutable) para permitir la inyección de fallos en los tests de invariante.

  const api = {
    // constantes
    UNPACKED_LEN: UNPACKED_LEN,
    SYSEX_MSG_LEN: SYSEX_MSG_LEN,
    SYSEX_HEADER_LEN: SYSEX_HEADER_LEN,
    SYSEX_PACKED_LEN: SYSEX_PACKED_LEN,
    NAME_START: NAME_START,
    NAME_END: NAME_END,
    TAIL_START: TAIL_START,
    TAIL_END: TAIL_END,
    FUZZ_MAX_PAYLOAD: FUZZ_MAX_PAYLOAD,
    FUZZ_MAX_TIMEOUT_MS: FUZZ_MAX_TIMEOUT_MS,
    EXACT: EXACT,
    CANONICAL: CANONICAL,
    SEMANTIC: SEMANTIC,
    KNOWN_EXCEPTION: KNOWN_EXCEPTION,
    NO_MATCH: NO_MATCH,

    // codec (paridad con browser_packer.js / RoundTripValidator.cpp)
    unpack7to8: unpack7to8,
    pack8to7: pack8to7,

    // niveles 1 / 2 / 3a
    rawCodecEqual: rawCodecEqual,
    semanticEqual: semanticEqual,
    hardwareCanonicalEqual: hardwareCanonicalEqual,
    classifyCorpusMatch: classifyCorpusMatch,

    // fuzzing acotado
    fuzzRoundTrip: fuzzRoundTrip,
    mulberry32: mulberry32,

    // corpus (Node)
    loadCorpusFromBanks: loadCorpusFromBanks,
  };

  return api;
});

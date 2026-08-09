// WebUI/js/calibration_lab_tab_roundtrip.js — Round-Trip Validator tab for CalibrationLabPage
// Extracted from calibration_lab_tabs.js
//
// Dos modos (Fase 4, plan v3.2 §5):
//   - 'single' (por defecto): valida el round-trip de UN patch (bytes → parámetros → motor → bytes).
//   - 'ab': clasifica la comparación Patch A vs Patch B con RoundTripEquality
//           (exact_match / canonical_match / semantic_match / known_exception / no_match).

// ────────────────────────────────────────────────────────────────
// A/B Compare — clasificación con roundtrip_equality.js (Fase 4)
// ────────────────────────────────────────────────────────────────

const RT_AB_CLASS_META = {
  'exact_match':     { label: 'EXACT MATCH',     cls: 'cal-rt-ab-exact',     color: 'var(--accent-green,#65d36e)' },
  'canonical_match': { label: 'CANONICAL MATCH', cls: 'cal-rt-ab-canonical', color: 'var(--accent-teal,#1abc9c)' },
  'semantic_match':  { label: 'SEMANTIC MATCH',  cls: 'cal-rt-ab-semantic',  color: 'var(--accent-blue,#6ec7ff)' },
  'known_exception': { label: 'KNOWN EXCEPTION', cls: 'cal-rt-ab-exception', color: 'var(--accent-yellow,#f1c40f)' },
  'no_match':        { label: 'NO MATCH',        cls: 'cal-rt-ab-nomatch',   color: 'var(--accent-red,#e74c3c)' },
};

// ────────────────────────────────────────────────────────────────
// Known exceptions — registro desde la UI (por bankName/patchIndex)
// Persistencia: localStorage (clave versionada) con fallback en memoria
// (tests/entornos sin storage). Entrada: { bank: 'A'-'H', prog: 0-127, reason, createdAt }
// ────────────────────────────────────────────────────────────────

const RT_EX_STORAGE_KEY = 'abdeep.calibration.knownExceptions.v1';
let _rtExCache = null; // lazy: se carga de localStorage en el primer acceso

function rtExKey(bank, prog) {
  return String(bank).toUpperCase() + '/' + Number(prog);
}

function loadKnownExceptions() {
  if (_rtExCache !== null) { return _rtExCache; }
  let list = [];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(RT_EX_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) { list = parsed; }
      }
    }
  } catch (e) { /* storage no disponible — memoria */ }
  _rtExCache = list;
  return list;
}

function persistKnownExceptions() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(RT_EX_STORAGE_KEY, JSON.stringify(loadKnownExceptions()));
    }
  } catch (e) { /* sin storage — solo memoria */ }
}

function getKnownException(bank, prog) {
  const key = rtExKey(bank, prog);
  return loadKnownExceptions().find((ex) => rtExKey(ex.bank, ex.prog) === key) || null;
}

/**
 * Registra (o actualiza la razón de) una excepción conocida por posición
 * (bankName 'A'-'H' / patchIndex). Devuelve la entrada registrada.
 */
function addKnownException(bank, prog, reason) {
  const list = loadKnownExceptions();
  const key = rtExKey(bank, prog);
  const existing = list.find((ex) => rtExKey(ex.bank, ex.prog) === key);
  if (existing) {
    if (reason) { existing.reason = reason; }
    persistKnownExceptions(); // la actualización de razón también persiste
    return existing;
  }
  const entry = {
    bank: String(bank).toUpperCase(),
    prog: Number(prog),
    reason: reason || '',
    createdAt: new Date().toISOString(),
  };
  list.push(entry);
  persistKnownExceptions();
  return entry;
}

function removeKnownException(bank, prog) {
  const key = rtExKey(bank, prog);
  _rtExCache = loadKnownExceptions().filter((ex) => rtExKey(ex.bank, ex.prog) !== key);
  persistKnownExceptions();
}

function resetKnownExceptions() {
  _rtExCache = [];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(RT_EX_STORAGE_KEY);
    }
  } catch (e) { /* noop */ }
}

/**
 * Normaliza unpackedBytes del store: deepClone (JSON) convierte los Uint8Array en
 * objetos {0:.., 1:..} sin .length — se reconstruye un Uint8Array cuando el objeto
 * tiene 242+ claves numéricas contiguas.
 */
function coerceBytes(value) {
  if (!value) { return null; }
  if (typeof value.length === 'number') { return value; }
  const keys = Object.keys(value);
  if (keys.length >= 242 && keys.every((k) => /^\d+$/.test(String(k)))) {
    const out = new Uint8Array(keys.length);
    for (const k of keys) { out[Number(k)] = value[k] & 0xFF; }
    return out;
  }
  return value;
}

/**
 * Clasifica la comparación A/B con la batería de Fase 4 (roundtrip_equality.js):
 *   - rawCodecEqual  → invariante de codec + diferencias byte a byte.
 *   - semanticEqual  → igualdad en el espacio de parámetros (descarta región reservada/padding).
 *   - hardwareCanonicalEqual con corpus de 1 entry (Patch B) → exact/canonical/semantic.
 * Las posiciones (bankName 'A'-'H', patchIndex) de los patches alimentan la
 * clasificación exact vs canonical.
 *
 * @param {object} [opts] — { knownExceptions?: Array<{bank, prog, reason}> }
 * @returns {{raw:object, sem:object, cls:object, registryAvailable:boolean, error?:string}|null}
 */
function runABCompareReport(patchA, patchB, opts) {
  const RTE = window.RoundTripEquality;
  if (!RTE) { return { error: 'RoundTripEquality not loaded' }; }

  const bytesA = coerceBytes(patchA && patchA.unpackedBytes);
  const bytesB = coerceBytes(patchB && patchB.unpackedBytes);
  const okA = bytesA && typeof bytesA.length === 'number' && bytesA.length >= 242;
  const okB = bytesB && typeof bytesB.length === 'number' && bytesB.length >= 242;
  if (!okA || !okB) { return { error: 'invalid_patch_bytes' }; }

  const registry = window.ParameterRegistry || null;
  const a = bytesA.slice(0, 242);
  const b = bytesB.slice(0, 242);

  const raw = RTE.rawCodecEqual(a, b, { registry });
  const sem = RTE.semanticEqual(a, b, { registry });

  const target = { unpacked: a };
  if (patchA && patchA.bankName && Number.isFinite(patchA.patchIndex)) {
    target.bank = patchA.bankName;      // letra 'A'-'H' (aceptada por RoundTripEquality)
    target.prog = patchA.patchIndex;
  }

  const corpus = [{
    // Banco normalizado a MAYÚSCULAS: el matching de known_exceptions en
    // classifyCorpusMatch es estricto (ex.bank === entry.bank) y el registro
    // desde la UI guarda el banco en mayúscula.
    bank: (patchB && patchB.bankName) ? String(patchB.bankName).toUpperCase() : null,
    prog: (patchB && Number.isFinite(patchB.patchIndex)) ? patchB.patchIndex : null,
    unpacked: b,
    packed: RTE.pack8to7(b),
  }];

  // Excepciones conocidas: las registradas desde la UI (persistidas) o las
  // inyectadas por el llamador (tests/scripts). Tienen prioridad sobre exact.
  const knownExceptions = (opts && opts.knownExceptions) || loadKnownExceptions();

  const cls = RTE.hardwareCanonicalEqual(target, corpus, { registry, knownExceptions });

  return { raw, sem, cls, registryAvailable: !!registry };
}

// ────────────────────────────────────────────────────────────────
// Render
// ────────────────────────────────────────────────────────────────

CalibrationLabPage.prototype.renderRoundTripTab = function (store) {
  const state = store.getState();
  const mode = this._roundTripMode === 'ab' ? 'ab' : 'single';

  const modeSwitchHtml = `
    <div class="cal-rt-mode" role="group" aria-label="Round-Trip mode">
      <button id="rt-mode-single" class="cal-rt-mode-btn${mode === 'single' ? ' active' : ''}" type="button">Single Patch</button>
      <button id="rt-mode-ab" class="cal-rt-mode-btn${mode === 'ab' ? ' active' : ''}" type="button">A/B Compare</button>
    </div>
  `;

  if (mode === 'ab') {
    return this._renderRTABTab(store, state, modeSwitchHtml);
  }
  return this._renderRTSingleTab(store, state, modeSwitchHtml);
};

// ── Modo 'single' (comportamiento histórico) ──
CalibrationLabPage.prototype._renderRTSingleTab = function (store, state, modeSwitchHtml) {
  const report = this._roundTripReport || null;
  const hideExact = !!this._roundTripHideExact;

  let summaryHtml = '';
  let tableHtml = '';

  if (report) {
    const passed = report.mismatches === 0;
    const statusText = passed ? 'PASS' : 'FAIL';
    const statusColor = passed ? 'var(--accent-green,#65d36e)' : 'var(--accent-red,#e74c3c)';

    summaryHtml = `
      <div class="cal-rt-summary">
        <span class="cal-rt-status" style="--cal-rt-status-color: ${statusColor};">${statusText}</span>
        <span class="cal-rt-summary-count">Exact: <strong>${report.exactMatches}</strong></span>
        <span class="cal-rt-summary-count">Tolerated: <strong>${report.withinTolerance}</strong></span>
        <span class="cal-rt-summary-count">Mismatch: <strong class="cal-mismatch-count" style="--cal-mismatch-color: ${report.mismatches > 0 ? '#e74c3c' : 'inherit'};">${report.mismatches}</strong></span>
        <span class="cal-rt-summary-count">Alias: <strong>${report.aliasSharedCount}</strong></span>
        <span class="cal-rt-summary-count">Name: <strong>${report.nameBytesCount}</strong></span>
        <span class="cal-rt-summary-count">Special: <strong>${report.specialCaseCount}</strong></span>
      </div>
    `;

    let filtered = report.entries;
    if (hideExact) {
      filtered = filtered.filter(e => e.classification !== 'exact');
    }

    const headers = ['Offset', 'Param IDs', 'Original Raw', 'Normalized', 'Rebuilt Raw', 'Delta', 'Classification'];

    const rowsHtml = filtered.map(e => {
      const clsMap = {
        'exact': '',
        'within-tolerance': 'is-delta',
        'alias-shared': '',
        'name-byte': '',
        'special-case': '',
        'mismatch': 'is-changed',
      };
      const rowCls = clsMap[e.classification] || '';

      const classificationColor = {
        'exact': 'var(--accent-green,#65d36e)',
        'within-tolerance': 'var(--accent-yellow,#f1c40f)',
        'alias-shared': 'var(--accent-teal,#1abc9c)',
        'name-byte': 'var(--accent-blue,#6ec7ff)',
        'special-case': 'var(--text-faint,#555)',
        'mismatch': 'var(--accent-red,#e74c3c)',
      };

      return `
        <tr class="${rowCls}">
          <td class="mono">${e.byteOffset}</td>
          <td class="mono cal-rt-table-param">${escapeHtml(e.paramIds.join(', ') || '—')}</td>
          <td class="mono">${e.rawOriginal}</td>
          <td class="mono">${fmt(e.semanticNormalized, 4)}</td>
          <td class="mono">${e.rawRebuilt}</td>
          <td class="mono${e.delta > 0 ? ' is-delta' : ''}">${e.delta}</td>
          <td><span class="cal-rt-classification${e.classification === 'mismatch' ? ' mismatch' : ''}" style="--cal-rt-class-color: ${classificationColor[e.classification] || 'inherit'};">${e.classification}</span></td>
        </tr>
      `;
    }).join('');

    tableHtml = renderRowsTable(headers, rowsHtml);
  }

  const patchAName = escapeHtml(state.selectedPatchA?.name || 'none');

  return `
    <div class="cal-roundtrip-tab">
      <h4 class="cal-rt-title">3-Layer Round-Trip Validator</h4>
      <p class="cal-rt-desc">
        Validates that raw bytes → semantic normalized → engine state → rebuilt raw bytes produce an identical or tolerable result.
      </p>

      <div class="cal-rt-actions">
        ${modeSwitchHtml}
        <button id="rt-load-a" class="manager-btn" type="button">Load from Patch A</button>
        <button id="rt-load-b" class="manager-btn" type="button">Load from Patch B</button>
        <button id="rt-run" class="manager-btn btn-solid" type="button">Run RoundTrip</button>
        <label class="cal-inline ml-8">
          <input id="rt-hide-exact" type="checkbox" ${hideExact ? 'checked' : ''} />
          <span>Hide exact matches</span>
        </label>
      </div>

      <div class="cal-rt-source">
        Source patch: <strong class="cal-rt-source-name">${patchAName}</strong>
        <span id="rt-source-info" class="cal-rt-source-info"></span>
      </div>

      ${summaryHtml}
      ${tableHtml}
    </div>
  `;
};

// ── Modo 'ab' (Fase 4) ──
CalibrationLabPage.prototype._renderRTABTab = function (store, state, modeSwitchHtml) {
  const report = this._abReport || null;
  const patchAName = escapeHtml(state.selectedPatchA?.name || 'none');
  const patchBName = escapeHtml(state.selectedPatchB?.name || 'none');

  let bannerHtml = '';
  let tableHtml = '';
  let factsHtml = '';
  let exceptionsHtml = '';

  // Sección de known exceptions — solo cuando el Patch B tiene posición (bankName/patchIndex)
  const patchB = state.selectedPatchB;
  if (patchB && patchB.bankName && Number.isFinite(patchB.patchIndex)) {
    const existing = getKnownException(patchB.bankName, patchB.patchIndex);
    if (existing) {
      exceptionsHtml = `
        <div class="cal-rt-ab-exceptions">
          <span class="cal-rt-ab-ex-title">Known exception</span>
          <span class="cal-rt-ab-ex-badge" title="${escapeHtml(existing.reason || '')}">${escapeHtml(String(existing.bank))}/${existing.prog}${existing.reason ? ` · ${escapeHtml(existing.reason)}` : ''}</span>
          <button id="rt-ex-remove" class="manager-btn" type="button">Remove exception</button>
        </div>
      `;
    } else {
      exceptionsHtml = `
        <div class="cal-rt-ab-exceptions">
          <span class="cal-rt-ab-ex-title">Register as known exception (Patch B position)</span>
          <input id="rt-ex-reason" class="cal-rt-ex-reason" type="text" placeholder="reason (optional)" maxlength="80" />
          <button id="rt-ex-add" class="manager-btn btn-solid" type="button">Register</button>
        </div>
      `;
    }
  }

  if (report && report.error) {
    bannerHtml = `
      <div class="cal-rt-summary">
        <span class="cal-rt-status" style="--cal-rt-status-color: var(--accent-red,#e74c3c);">ERROR</span>
        <span class="cal-rt-summary-count">${escapeHtml(report.error)}</span>
      </div>
    `;
  } else if (report) {
    const meta = RT_AB_CLASS_META[report.cls.best] || RT_AB_CLASS_META['no_match'];
    const best = report.cls.bestMatch;
    // La posición solo se muestra cuando ambos metadatos existen (evita "Bank null · Prog null")
    const matchPos = best && best.bank != null && best.prog != null
      ? ` · matches B at Bank ${escapeHtml(String(best.bank))} · Prog ${best.prog}`
      : '';

    bannerHtml = `
      <div class="cal-rt-ab-banner ${meta.cls}">
        <span class="cal-rt-ab-class" style="--cal-rt-ab-color: ${meta.color};">${meta.label}</span>
        <span class="cal-rt-ab-reason">${escapeHtml(best ? best.reason : 'no correspondence')}${matchPos}</span>
      </div>
    `;

    const identical = report.raw.mismatches.length === 0;
    const semEqual = report.sem.equal;
    factsHtml = `
      <div class="cal-rt-summary">
        <span class="cal-rt-summary-count">Raw identical: <strong>${identical ? 'yes' : `${242 - report.raw.mismatches.length}/242`}</strong></span>
        <span class="cal-rt-summary-count">Semantic: <strong>${semEqual ? 'equal' : 'different'}</strong></span>
        <span class="cal-rt-summary-count">Re-encode stable: <strong>${report.sem.reencodeStable ? 'yes' : 'no'}</strong></span>
        <span class="cal-rt-summary-count">Registry: <strong>${report.registryAvailable ? 'loaded' : 'NOT loaded (structural only)'}</strong></span>
      </div>
    `;

    if (identical) {
      tableHtml = '<div class="cal-rt-ab-note">Both patches are byte-identical (242/242 bytes).</div>';
    } else if (report.sem.mismatches.length > 0) {
      const headers = ['Offset', 'Param IDs', 'Raw A', 'Raw B', 'Norm A', 'Norm B'];
      const rowsHtml = report.sem.mismatches.map(m => `
        <tr class="is-changed">
          <td class="mono">${m.byteOffset}</td>
          <td class="mono cal-rt-table-param">${escapeHtml(m.paramIds.join(', ') || '—')}</td>
          <td class="mono">${m.rawA}</td>
          <td class="mono">${m.rawB}</td>
          <td class="mono">${fmt(m.normA, 4)}</td>
          <td class="mono">${fmt(m.normB, 4)}</td>
        </tr>
      `).join('');
      tableHtml = renderRowsTable(headers, rowsHtml);
    } else {
      tableHtml = '<div class="cal-rt-ab-note">Bytes differ only in the reserved region (patch name / tail) — parameters are semantically equal.</div>';
    }
  }

  return `
    <div class="cal-roundtrip-tab">
      <h4 class="cal-rt-title">Round-Trip Validator — A/B Compare (Fase 4)</h4>
      <p class="cal-rt-desc">
        Classifies Patch A vs Patch B with RoundTripEquality: exact_match (same bytes, same position),
        canonical_match (same bytes, different position), semantic_match (same parameters within tolerance),
        no_match (parameters differ).
      </p>

      <div class="cal-rt-actions">
        ${modeSwitchHtml}
        <button id="rt-load-a" class="manager-btn" type="button">Load Patch A</button>
        <button id="rt-load-b" class="manager-btn" type="button">Load Patch B</button>
        <button id="rt-run" class="manager-btn btn-solid" type="button">Compare A vs B</button>
      </div>

      <div class="cal-rt-source">
        A: <strong class="cal-rt-source-name">${patchAName}</strong>
        <span class="cal-rt-source-info">B: ${patchBName}</span>
        <span id="rt-source-info" class="cal-rt-source-info"></span>
      </div>

      ${bannerHtml}
      ${factsHtml}
      ${exceptionsHtml}
      ${tableHtml}
    </div>
  `;
};

// ────────────────────────────────────────────────────────────────
// Events
// ────────────────────────────────────────────────────────────────

CalibrationLabPage.prototype.bindRoundTripEvents = function () {
  const loadA = this.querySelector('#rt-load-a');
  const loadB = this.querySelector('#rt-load-b');
  const runBtn = this.querySelector('#rt-run');
  const hideExactCb = this.querySelector('#rt-hide-exact');
  const sourceInfo = this.querySelector('#rt-source-info');
  const modeSingle = this.querySelector('#rt-mode-single');
  const modeAb = this.querySelector('#rt-mode-ab');

  // El modo se lee en tiempo de llamada (no capturado): si el usuario cambia el modo
  // entre binds, los handlers usan siempre el estado actual del elemento.
  const currentMode = () => (this._roundTripMode === 'ab' ? 'ab' : 'single');

  if (modeSingle) {
    modeSingle.onclick = () => {
      this._roundTripMode = 'single';
      this.render();
    };
  }
  if (modeAb) {
    modeAb.onclick = () => {
      this._roundTripMode = 'ab';
      this.render();
    };
  }

  const loadFromPatch = (side) => {
    const store = window.calibrationStore;
    if (!store) {return;}
    const state = store.getState();
    const patch = side === 'A' ? state.selectedPatchA : state.selectedPatchB;
    if (!patch || !patch.unpackedBytes || patch.unpackedBytes.length < 242) {
      if (sourceInfo) {sourceInfo.textContent = `Patch ${side} has no valid unpackedBytes`;}
      return;
    }

    if (currentMode() === 'ab') {
      if (side === 'A') {
        this._rtPatchA = patch;
      } else {
        this._rtPatchB = patch;
      }
      this._abReport = null;
      if (sourceInfo) {sourceInfo.textContent = `A: ${this._rtPatchA?.name || 'unnamed'} · B: ${this._rtPatchB?.name || 'not loaded'}`;}
    } else {
      this._roundTripBytes = patch.unpackedBytes.slice(0, 242);
      if (sourceInfo) {sourceInfo.textContent = `Loaded ${patch.name || 'unnamed'} (${side}) — ${this._roundTripBytes.length} bytes`;}
      this._roundTripReport = null;
    }
    this.render();
  };

  if (loadA) {loadA.onclick = () => loadFromPatch('A');}
  if (loadB) {loadB.onclick = () => loadFromPatch('B');}

  const rerunAbCompare = () => {
    const store = window.calibrationStore;
    const state = store ? store.getState() : { selectedPatchA: null, selectedPatchB: null };
    const patchA = this._rtPatchA || state.selectedPatchA;
    const patchB = this._rtPatchB || state.selectedPatchB;
    const report = runABCompareReport(patchA, patchB);
    if (report && report.error && sourceInfo) {sourceInfo.textContent = report.error;}
    this._abReport = report;
    this.render();
  };

  // Known exceptions — registro/eliminación por bankName/patchIndex del Patch B
  const exAdd = this.querySelector('#rt-ex-add');
  const exRemove = this.querySelector('#rt-ex-remove');
  const exReason = this.querySelector('#rt-ex-reason');
  if (exAdd) {
    exAdd.onclick = () => {
      const store = window.calibrationStore;
      const state = store ? store.getState() : {};
      const patchB = this._rtPatchB || state.selectedPatchB;
      if (!patchB || !patchB.bankName || !Number.isFinite(patchB.patchIndex)) { return; }
      addKnownException(patchB.bankName, patchB.patchIndex, exReason ? exReason.value : '');
      rerunAbCompare(); // re-clasifica con la excepción activa (known_exception gana)
    };
  }
  if (exRemove) {
    exRemove.onclick = () => {
      const store = window.calibrationStore;
      const state = store ? store.getState() : {};
      const patchB = this._rtPatchB || state.selectedPatchB;
      if (!patchB || !patchB.bankName || !Number.isFinite(patchB.patchIndex)) { return; }
      removeKnownException(patchB.bankName, patchB.patchIndex);
      rerunAbCompare(); // vuelve a la clasificación natural
    };
  }

  if (runBtn) {
    runBtn.onclick = async () => {
      if (currentMode() === 'ab') {
        rerunAbCompare();
        return;
      }

      if (!this._roundTripBytes || this._roundTripBytes.length < 242) {
        if (sourceInfo) {sourceInfo.textContent = 'Load a patch first';}
        return;
      }
      const bridge = getBridge();
      let report;
      if (bridge && typeof bridge.runRoundTripValidator === 'function') {
        const raw = await bridge.runRoundTripValidator(JSON.stringify(this._roundTripBytes));
        if (raw) {
          report = raw;
        }
      }
      if (!report) {
        report = runRoundTripValidation(this._roundTripBytes);
      }
      this._roundTripReport = report;
      this.render();
    };
  }

  if (hideExactCb) {
    hideExactCb.onchange = () => {
      this._roundTripHideExact = !!hideExactCb.checked;
      this.render();
    };
  }
};

globalThis.RT_AB_CLASS_META = RT_AB_CLASS_META;
globalThis.runABCompareReport = runABCompareReport;
globalThis.getKnownException = getKnownException;
globalThis.addKnownException = addKnownException;
globalThis.removeKnownException = removeKnownException;
globalThis.resetKnownExceptions = resetKnownExceptions;

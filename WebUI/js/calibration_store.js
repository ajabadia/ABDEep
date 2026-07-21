// WebUI/js/calibration_store.js
(function () {
  const DEFAULT_STATE = {
    diagnosticSnapshot: null,
    snapshotStatus: 'idle', // idle | loading | ready | error
    snapshotError: null,
    lastUpdatedAt: null,

    selectedPatchA: null,
    selectedPatchB: null,

    activeTab: 'raw', // raw | semantic | engine | effective
    selectedVoiceIndex: 0,
    selectedRowKey: null, // key del parámetro seleccionado para el drawer (CL-07)

    filters: {
      showOnlyDifferences: false,
      showOnlyCritical: false,
      showOnlyAliases: false,
      search: '',
    },

    // ── CL-08: Stratified Bank Run ─────────────────────────────────
    bankRunConfig: {
      sourceScope: 'loaded',       // 'loaded' (fase 1)
      bankNames: [],               // [] = todos los bancos cargados
      categoryFilter: '',          // '' = todas las categorías
      favoritesOnly: false,
      criticalOnly: false,
      sampleSize: 24,
      seed: 42,
    },
    bankRunItems: [],              // [{ runId, index, bankName, patchIndex, patchName, patchRef, meta, criticalCandidate, status, notes }]
    bankRunId: null,               // ID del run activo

    // ── CL-09: Workflow Session ────────────────────────────────────
    workflowSession: {
      runId: null,
      currentIndex: 0,
      startedAt: null,
      completedAt: null,
      itemStatuses: {},            // { [index]: 'pending'|'pass'|'review'|'fail'|'skip' }
      itemNotes: {},               // { [index]: string }
    },

    // ── CL-10: Live Validation ─────────────────────────────────────
    calibrationSpec: null,         // parsed JSON spec or null = use defaults
    liveScanActive: false,
    complianceReport: null,        // { compliant: bool, voiceResults: [...], totalCompliant: int }
    liveScanTimerId: null,
  };


  const DEFAULT_CALIBRATION_SPEC = {
    schemaVersion: 1,
    voice: {
      staticPitchCentsRange: 3.0,
      staticCutoffNormRange: 0.06,
      staticResNormRange: 0.04,
      staticEnvTimeNormRange: 0.16,
      cutoffDriftScale: 1.0,
      resonanceDriftScale: 0.5,
    },
    transfer: {
      vcfCutoff: { minHz: 50, maxHz: 20000, curveBase: 400 },
      vcfKeytrack: { referenceHz: 261.63, amountScale: 1.0 },
      vcfPitchBend: { cutoffScale: 0.3 },
      hpf: { minHz: 10, maxHz: 10000, modScaleHz: 500, bassBoostGain: 1.0 },
      envelopes: { driftToTimeScale: 0.3, minTimeSec: 0.002, exponentialBase: 32768 },
      lfo: { rateScale: 0.041, rateExp: 7.3747 },
    },
  };

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function normalizeVoice(voice, index) {
    const v = isObject(voice) ? voice : {};
    return {
      index,
      active: v.isActive === true || !!v.active,
      midiNote: Number.isFinite(v.midiNote) ? v.midiNote
        : (Number.isFinite(v.noteNumber) ? v.noteNumber : -1),
      velocity: Number.isFinite(v.velocity) ? v.velocity : 0,

      detuneSemitones: Number.isFinite(v.detuneSemitones) ? v.detuneSemitones
        : (Number.isFinite(v.detuneSemitonesEffective) ? v.detuneSemitonesEffective : 0),
      panPosition: Number.isFinite(v.panPosition) ? v.panPosition
        : (Number.isFinite(v.panBase) ? v.panBase : 0.5),
      panEffective: Number.isFinite(v.panEffective) ? v.panEffective
        : (Number.isFinite(v.panBase) ? v.panBase : 0.5),
      voicePanSpread: Number.isFinite(v.voicePanSpread) ? v.voicePanSpread : 0,

      modOsc1DetuneSemitones: Number.isFinite(v.modOsc1DetuneSemitones) ? v.modOsc1DetuneSemitones : 0,
      modOsc2DetuneSemitones: Number.isFinite(v.modOsc2DetuneSemitones) ? v.modOsc2DetuneSemitones : 0,
      modPan: Number.isFinite(v.modPan) ? v.modPan : 0,

      baseCutoffHz: Number.isFinite(v.baseCutoffHz) ? v.baseCutoffHz : null,
      effectiveCutoffHz: Number.isFinite(v.effectiveCutoffHz) ? v.effectiveCutoffHz : null,
      resonance: Number.isFinite(v.resonance) ? v.resonance : null,
      hpfCutoffHz: Number.isFinite(v.hpfCutoffHz) ? v.hpfCutoffHz : null,
      hpfBassBoostActive: v.hpfBassBoostActive === true,

      lfo1Value: Number.isFinite(v.lfo1Value) ? v.lfo1Value : null,
      lfo2Value: Number.isFinite(v.lfo2Value) ? v.lfo2Value : null,
      env1Value: Number.isFinite(v.env1Value) ? v.env1Value : null,
      env2Value: Number.isFinite(v.env2Value) ? v.env2Value : null,
      driftHz: Number.isFinite(v.driftHz) ? v.driftHz : null,

      cutoffFromEnv: Number.isFinite(v.cutoffFromEnv) ? v.cutoffFromEnv : null,
      cutoffFromLfo: Number.isFinite(v.cutoffFromLfo) ? v.cutoffFromLfo : null,
      cutoffFromDrift: Number.isFinite(v.cutoffFromDrift) ? v.cutoffFromDrift : null,
      cutoffFromKeytrack: Number.isFinite(v.cutoffFromKeytrack) ? v.cutoffFromKeytrack : null,

      envStage: Number.isFinite(v.envStage) ? v.envStage : null,
      sourceTag: Number.isFinite(v.sourceTag) ? v.sourceTag : null,

      driftOsc1Pitch: Number.isFinite(v.driftOsc1Pitch) ? v.driftOsc1Pitch : null,
      driftOsc2Pitch: Number.isFinite(v.driftOsc2Pitch) ? v.driftOsc2Pitch : null,
      driftVcfCutoff: Number.isFinite(v.driftVcfCutoff) ? v.driftVcfCutoff : null,
      driftVcfResonance: Number.isFinite(v.driftVcfResonance) ? v.driftVcfResonance : null,
      driftEnvTime: Number.isFinite(v.driftEnvTime) ? v.driftEnvTime : null,
    };
  }

  function normalizeSnapshot(raw) {
    if (!isObject(raw)) {
      throw new Error('Diagnostic snapshot inválido: payload no es objeto');
    }

    const schemaVersion = raw.diagnosticSchemaVersion;
    if (schemaVersion !== 1) {
      throw new Error(`diagnosticSchemaVersion no soportado: ${schemaVersion}`);
    }

    const voicesRaw = Array.isArray(raw.voices) ? raw.voices
      : (Array.isArray(raw.voiceSnapshots) ? raw.voiceSnapshots : []);
    const voices = voicesRaw.map((voice, index) => normalizeVoice(voice, index));

    return {
      diagnosticSchemaVersion: 1,
      capturedAt: raw.capturedAt || nowIso(),

      engine: {
        vcfOversample: Number.isFinite(raw.vcfOversample) ? raw.vcfOversample : 0,
        vcfVoicingMode: Number.isFinite(raw.vcfVoicingMode) ? raw.vcfVoicingMode : 0,
        driftAmount: Number.isFinite(raw.driftAmount) ? raw.driftAmount : 0,
        voiceMode: Number.isFinite(raw.voiceMode) ? raw.voiceMode : 0,
        polyChordNoteCount: Number.isFinite(raw.polyChordNoteCount) ? raw.polyChordNoteCount : 0,
        pitchBend: Number.isFinite(raw.pitchBend) ? raw.pitchBend : 0,
        modWheel: Number.isFinite(raw.modWheel) ? raw.modWheel : 0,
        aftertouch: Number.isFinite(raw.aftertouch) ? raw.aftertouch : 0,
        sustainPedal: Number.isFinite(raw.sustainPedal) ? raw.sustainPedal : 0,
        peakLevel: Number.isFinite(raw.peakLevel) ? raw.peakLevel : 0,
      },

      voices,
    };
  }

  function resolveSpec(spec) {
    if (isObject(spec) && isObject(spec.voice)) {return spec;}
    return DEFAULT_CALIBRATION_SPEC;
  }

  function validateLiveCompliance(snapshot, spec) {
    if (!isObject(snapshot) || !Array.isArray(snapshot.voices)) {
      return { compliant: false, voiceResults: [], totalCompliant: 0 };
    }
    const s = resolveSpec(spec);
    const sv = s.voice;
    const pitchRange = sv.staticPitchCentsRange / 2;
    const cutoffRange = sv.staticCutoffNormRange / 2;
    const resRange = sv.staticResNormRange / 2;
    const envRange = sv.staticEnvTimeNormRange / 2;

    const voiceResults = snapshot.voices.map((v, idx) => {
      const checks = [];

      if (Number.isFinite(v.driftOsc1Pitch)) {
        checks.push({
          param: 'driftOsc1Pitch', label: 'OSC1 Pitch Drift',
          value: v.driftOsc1Pitch, specLimit: pitchRange, unit: 'cents',
          passed: Math.abs(v.driftOsc1Pitch) <= pitchRange,
        });
      }
      if (Number.isFinite(v.driftOsc2Pitch)) {
        checks.push({
          param: 'driftOsc2Pitch', label: 'OSC2 Pitch Drift',
          value: v.driftOsc2Pitch, specLimit: pitchRange, unit: 'cents',
          passed: Math.abs(v.driftOsc2Pitch) <= pitchRange,
        });
      }
      if (Number.isFinite(v.driftVcfCutoff)) {
        checks.push({
          param: 'driftVcfCutoff', label: 'VCF Cutoff Drift',
          value: v.driftVcfCutoff, specLimit: cutoffRange, unit: 'norm',
          passed: Math.abs(v.driftVcfCutoff) <= cutoffRange,
        });
      }
      if (Number.isFinite(v.driftVcfResonance)) {
        checks.push({
          param: 'driftVcfResonance', label: 'VCF Resonance Drift',
          value: v.driftVcfResonance, specLimit: resRange, unit: 'norm',
          passed: Math.abs(v.driftVcfResonance) <= resRange,
        });
      }
      if (Number.isFinite(v.driftEnvTime)) {
        checks.push({
          param: 'driftEnvTime', label: 'Env Time Drift',
          value: v.driftEnvTime, specLimit: envRange, unit: 'norm',
          passed: Math.abs(v.driftEnvTime) <= envRange,
        });
      }

      const active = v.active === true;
      const failedChecks = checks.filter(c => !c.passed);
      const passed = !active || failedChecks.length === 0;

      return {
        voiceIndex: idx,
        active,
        midiNote: v.midiNote,
        velocity: v.velocity,
        passed,
        checks,
        failedCount: failedChecks.length,
      };
    });

    const totalCompliant = voiceResults.filter(r => r.passed).length;
    return {
      compliant: totalCompliant === voiceResults.length,
      voiceResults,
      totalCompliant,
    };
  }

  function createCalibrationStore(bridge) {
    let state = deepClone(DEFAULT_STATE);
    const listeners = new Set();

    function emit() {
      const snapshot = api.getState();
      listeners.forEach((listener) => {
        try {
          listener(snapshot);
        } catch (err) {
          console.error('[CalibrationStore] listener error:', err);
        }
      });
    }

    function setState(patch) {
      state = {
        ...state,
        ...patch,
      };
      emit();
    }

    const api = {
      getState() {
        return deepClone(state);
      },

      subscribe(listener) {
        listeners.add(listener);
        return function unsubscribe() {
          listeners.delete(listener);
        };
      },

      setActiveTab(tab) {
        if (!['raw', 'semantic', 'engine', 'effective', 'audio-ab', 'patchdiff', 'roundtrip', 'live'].includes(tab)) {return;}
        setState({ activeTab: tab });
      },

      setSelectedVoiceIndex(index) {
        const safeIndex = Math.max(0, Math.min(11, Number(index) || 0));
        setState({ selectedVoiceIndex: safeIndex });
      },

      setSelectedPatchA(patch) {
        setState({ selectedPatchA: patch || null });
      },

      setSelectedPatchB(patch) {
        setState({ selectedPatchB: patch || null });
      },

      setFilters(partialFilters) {
        const validKeys = ['showOnlyDifferences', 'showOnlyCritical', 'showOnlyAliases', 'search'];
        const cleaned = {};
        for (const key of validKeys) {
          if (partialFilters && key in partialFilters) {cleaned[key] = partialFilters[key];}
        }
        setState({
          filters: {
            ...state.filters,
            ...cleaned,
          },
        });
      },

      // ═══════════════════════════════════════════════════════════
      // CL-10: Live Validation
      // ═══════════════════════════════════════════════════════════

      setCalibrationSpec(spec) {
        const parsed = isObject(spec) ? spec : null;
        setState({ calibrationSpec: parsed });
      },

      setLiveScanActive(active) {
        const wasActive = state.liveScanActive;
        if (active && !wasActive) {
          setState({
            liveScanActive: true,
            liveScanTimerId: state.liveScanTimerId,
            complianceReport: state.complianceReport,
          });
          api.startLiveScan();
        } else if (!active && wasActive) {
          api.stopLiveScan();
          setState({
            liveScanActive: false,
            liveScanTimerId: null,
          });
        }
      },

      setComplianceReport(report) {
        setState({ complianceReport: report });
      },

      startLiveScan() {
        if (state.liveScanTimerId) {return;}
        const timerId = setInterval(async () => {
          await api.updateLiveScan();
        }, 250);
        setState({ liveScanTimerId: timerId });
        api.updateLiveScan();
      },

      stopLiveScan() {
        if (state.liveScanTimerId) {
          clearInterval(state.liveScanTimerId);
        }
        setState({ liveScanTimerId: null });
      },

      async updateLiveScan() {
        if (!bridge || typeof bridge.getDiagnosticSnapshot !== 'function') {return;}
        try {
          const raw = await bridge.getDiagnosticSnapshot();
          const normalized = normalizeSnapshot(raw);
          const spec = state.calibrationSpec || DEFAULT_CALIBRATION_SPEC;
          const report = validateLiveCompliance(normalized, spec);
          setState({
            complianceReport: report,
            diagnosticSnapshot: normalized,
            snapshotStatus: 'ready',
            lastUpdatedAt: nowIso(),
          });
        } catch (err) {
          // silent — live scan should not spam errors
        }
      },

      swapPatches() {
        const a = state.selectedPatchA;
        const b = state.selectedPatchB;
        setState({
          selectedPatchA: b,
          selectedPatchB: a,
        });
      },

      async loadDiagnosticSnapshot() {
        setState({
          snapshotStatus: 'loading',
          snapshotError: null,
        });

        try {
          if (!bridge || typeof bridge.getDiagnosticSnapshot !== 'function') {
            throw new Error('dualMidiBridge.getDiagnosticSnapshot() no disponible');
          }

          if (typeof bridge.waitForReady === 'function') {
            await bridge.waitForReady(3000);
          }

          const raw = await bridge.getDiagnosticSnapshot();
          const normalized = normalizeSnapshot(raw);

          setState({
            diagnosticSnapshot: normalized,
            snapshotStatus: 'ready',
            snapshotError: null,
            lastUpdatedAt: nowIso(),
          });

          return normalized;
        } catch (error) {
          setState({
            snapshotStatus: 'error',
            snapshotError: error?.message || String(error),
          });
          return null;
        }
      },

      getSelectedVoiceSnapshot() {
        const snap = state.diagnosticSnapshot;
        if (!snap || !Array.isArray(snap.voices)) {return null;}
        return snap.voices[state.selectedVoiceIndex] || null;
      },

      getEngineRows() {
        const snap = state.diagnosticSnapshot;
        if (!snap) {return [];}

        return [
          { key: 'pitchBend', label: 'Pitch Bend', value: snap.engine.pitchBend },
          { key: 'modWheel', label: 'Mod Wheel', value: snap.engine.modWheel },
          { key: 'aftertouch', label: 'Aftertouch', value: snap.engine.aftertouch },
          { key: 'sustainPedal', label: 'Sustain Pedal', value: snap.engine.sustainPedal },
          { key: 'peakLevel', label: 'Peak Level', value: snap.engine.peakLevel },
        ];
      },

      getEffectiveRowsScoped() {
        const voice = api.getSelectedVoiceSnapshot();
        if (!voice) {return [];}

        const rows = [
          {
            module: 'VCF',
            key: 'effectiveCutoffHz',
            label: 'VCF Effective Cutoff',
            value: voice.effectiveCutoffHz,
            supported: voice.effectiveCutoffHz !== null,
            contractVerified: true,
          },
          {
            module: 'VCF',
            key: 'resonance',
            label: 'VCF Resonance',
            value: voice.resonance,
            supported: voice.resonance !== null,
            contractVerified: true,
          },
          {
            module: 'HPF',
            key: 'hpfCutoffHz',
            label: 'HPF Cutoff',
            value: voice.hpfCutoffHz,
            supported: voice.hpfCutoffHz !== null,
            contractVerified: true,
          },
          {
            module: 'HPF',
            key: 'hpfBassBoostActive',
            label: 'HPF Bass Boost',
            value: voice.hpfBassBoostActive,
            supported: true,
            contractVerified: true,
          },
          {
            module: 'Drift',
            key: 'driftOsc1Pitch',
            label: 'Drift OSC1 Pitch',
            value: voice.driftOsc1Pitch,
            supported: voice.driftOsc1Pitch !== null,
            contractVerified: true,
          },
          {
            module: 'Drift',
            key: 'driftOsc2Pitch',
            label: 'Drift OSC2 Pitch',
            value: voice.driftOsc2Pitch,
            supported: voice.driftOsc2Pitch !== null,
            contractVerified: true,
          },
          {
            module: 'Drift',
            key: 'driftVcfCutoff',
            label: 'Drift VCF Cutoff',
            value: voice.driftVcfCutoff,
            supported: voice.driftVcfCutoff !== null,
            contractVerified: true,
          },
          {
            module: 'Drift',
            key: 'driftVcfResonance',
            label: 'Drift VCF Resonance',
            value: voice.driftVcfResonance,
            supported: voice.driftVcfResonance !== null,
            contractVerified: true,
          },
          {
            module: 'Drift',
            key: 'driftEnvTime',
            label: 'Drift Env Time',
            value: voice.driftEnvTime,
            supported: voice.driftEnvTime !== null,
            contractVerified: true,
          },
        ];

        return rows.filter((row) => row.supported);
      },

      getVoiceSummaryRows() {
        const voice = api.getSelectedVoiceSnapshot();
        if (!voice) {return [];}

        return [
          { key: 'active', label: 'Active', value: voice.active },
          { key: 'midiNote', label: 'MIDI Note', value: voice.midiNote },
          { key: 'velocity', label: 'Velocity', value: voice.velocity },
          { key: 'detuneSemitones', label: 'Detune', value: voice.detuneSemitones },
          { key: 'panPosition', label: 'Pan Base', value: voice.panPosition },
          { key: 'panEffective', label: 'Pan Effective', value: voice.panEffective },
          { key: 'modPan', label: 'Pan Mod', value: voice.modPan },
          { key: 'modOsc1DetuneSemitones', label: 'OSC1 Mod Detune', value: voice.modOsc1DetuneSemitones },
          { key: 'modOsc2DetuneSemitones', label: 'OSC2 Mod Detune', value: voice.modOsc2DetuneSemitones },
        ];
      },

      // ─────────────────────────────────────────────────────────
      // CL-07a: Selección de fila para el drawer
      // ─────────────────────────────────────────────────────────
      setSelectedRow(key) {
        setState({ selectedRowKey: key || null });
      },

      // ─────────────────────────────────────────────────────────
      // CL-07c: Mapa paramId → campos de voz en diagnosticSnapshot
      // Para cada entrada:
      //   voiceField: nombre del campo en normalizeVoice/getSelectedVoiceSnapshot
      //   label: etiqueta legible
      //   module: módulo DSP al que pertenece
      //   intermediate: true si es un valor intermedio (derivado)
      // ─────────────────────────────────────────────────────────
      PARAM_TO_VOICE: {
        'vcfcutoff':         { voiceField: 'effectiveCutoffHz',      label: 'VCF Cutoff (Hz)',          module: 'VCF',  intermediate: false },
        'vcfresonance':      { voiceField: 'resonance',              label: 'VCF Resonance',            module: 'VCF',  intermediate: false },
        'vcfpolemode':       { voiceField: null,                     label: 'VCF Pole Mode',            module: 'VCF',  intermediate: true },
        'vcfenvdepth':       { voiceField: null,                     label: 'VCF Env Depth',            module: 'VCF',  intermediate: true },
        'hpfcutoff':         { voiceField: 'hpfCutoffHz',            label: 'HPF Cutoff (Hz)',          module: 'HPF',  intermediate: false },
        'voicedrift':        { voiceField: 'driftVcfCutoff',         label: 'Voice Drift → Cutoff',    module: 'Drift', intermediate: false },
        'voicedrift_res':    { voiceField: 'driftVcfResonance',      label: 'Voice Drift → Res',        module: 'Drift', intermediate: false },
        'voicedrift_env':    { voiceField: 'driftEnvTime',           label: 'Voice Drift → Env Time',   module: 'Drift', intermediate: false },
        'oscdrift':          { voiceField: 'driftOsc1Pitch',         label: 'OSC1 Drift Pitch',         module: 'Drift', intermediate: false },
        'osc2_drift':        { voiceField: 'driftOsc2Pitch',         label: 'OSC2 Drift Pitch',         module: 'Drift', intermediate: false },
        'detune':            { voiceField: 'detuneSemitones',        label: 'Detune (semitones)',       module: 'OSC',  intermediate: false },
        'pan':               { voiceField: 'panEffective',           label: 'Pan Effective',            module: 'OSC',  intermediate: false },
        'midinote':          { voiceField: 'midiNote',               label: 'MIDI Note',                module: 'Voice', intermediate: false },
        'velocity':          { voiceField: 'velocity',               label: 'Velocity',                 module: 'Voice', intermediate: false },
      },

      // Retorna datos de trazado en vivo para un paramId dado.
      // Combina el valor almacenado en el patch (si hay patch seleccionado)
      // con el valor en vivo del engine vía diagnosticSnapshot.
      getParamTrace(paramId) {
        const paramIdLower = (paramId || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
        const mapping = api.PARAM_TO_VOICE[paramIdLower];
        const voice = api.getSelectedVoiceSnapshot();
        const engine = state.diagnosticSnapshot?.engine || {};

        const trace = {
          paramId: paramIdLower,
          label: mapping?.label || paramIdLower,
          module: mapping?.module || null,
          intermediate: mapping?.intermediate || false,
          patchValue: null,
          liveValue: null,
          liveVoice: voice ? { ...voice } : null,
          engineState: engine,
          derivedContributions: [],
        };

        if (mapping?.voiceField && voice) {
          trace.liveValue = voice[mapping.voiceField];
        }

        if (paramIdLower === 'vcfenvdepth' && voice) {
          trace.liveValue = voice.env1Value;
          trace.derivedContributions.push(
            { key: 'cutoffFromEnv', value: voice.cutoffFromEnv, unit: 'Hz' },
            { key: 'cutoffFromLfo', value: voice.cutoffFromLfo, unit: 'Hz' },
            { key: 'cutoffFromDrift', value: voice.cutoffFromDrift, unit: 'Hz' },
            { key: 'cutoffFromKeytrack', value: voice.cutoffFromKeytrack, unit: 'Hz' },
          );
        }

        if (paramIdLower === 'vcfpolemode' && voice) {
          trace.liveValue = voice.resonance !== null ? '4-pole (default)' : 'n/a';
        }

        return trace;
      },

      // ─────────────────────────────────────────────────────────
      // CL-05 / CL-03a: Clasificador central de badge por offset
      // Retorna: 'exact' | 'alias-shared' | 'stub' | 'mismatch' | 'info'
      // Nunca duplicar esta lógica en render — consumir siempre desde aquí.
      // ─────────────────────────────────────────────────────────
      classifyRow(paramId, rawA, rawB) {
        // Parámetros marcados explícitamente como stub en contrato
        const STUB_PARAMS = new Set(['vcfpolemode', 'vcf_pole_mode']);
        // Offsets compartidos conocidos — producen alias, no conflicto
        const ALIAS_PARAMS = new Set(['voicedrift', 'oscdrift', 'voice_drift', 'osc_drift']);

        if (STUB_PARAMS.has(paramId)) {return 'stub';}
        if (ALIAS_PARAMS.has(paramId)) {return 'alias-shared';}
        if (rawA === null || rawB === null) {return 'info';}
        if (rawA === rawB) {return 'exact';}
        return 'mismatch';
      },

      // ─────────────────────────────────────────────────────────
      // CL-03a: Resumen derivado de validación — testeable, sin
      // lógica duplicada en vista. Trabaja sobre los bytes visibles
      // actualmente en selectedPatchA / selectedPatchB.
      // ─────────────────────────────────────────────────────────
      getValidationSummary() {
        const patchA = state.selectedPatchA;
        const patchB = state.selectedPatchB;

        const empty = {
          total: 0,
          exact: 0,
          aliasShared: 0,
          stub: 0,
          mismatch: 0,
          info: 0,
          criticalWarnings: [],
        };

        if (!patchA || !patchB) {return empty;}

        const bytesA = Array.isArray(patchA.unpackedBytes) ? patchA.unpackedBytes : [];
        const bytesB = Array.isArray(patchB.unpackedBytes) ? patchB.unpackedBytes : [];
        const maps = (typeof window !== 'undefined' && window.dualMidiBridge)
          ? {
              paramToByteOffset: window.dualMidiBridge.paramToByteOffset || {},
              byteOffsetToParamIds: window.dualMidiBridge.byteOffsetToParamIds || {},
            }
          : { paramToByteOffset: {}, byteOffsetToParamIds: {} };

        const summary = { ...empty };
        const seenOffsets = new Set();

        // Iterar por parámetros mapeados (dominio semántico)
        Object.entries(maps.paramToByteOffset).forEach(([paramId, offset]) => {
          if (seenOffsets.has(offset)) {return;} // evitar double-count de aliases
          seenOffsets.add(offset);

          const rawA = Number.isFinite(bytesA[offset]) ? bytesA[offset] : null;
          const rawB = Number.isFinite(bytesB[offset]) ? bytesB[offset] : null;

          const badge = api.classifyRow(paramId, rawA, rawB);
          summary.total++;
          if (badge === 'exact') {summary.exact++;}
          else if (badge === 'alias-shared') {summary.aliasShared++;}
          else if (badge === 'stub') {summary.stub++;}
          else if (badge === 'mismatch') {summary.mismatch++;}
          else {summary.info++;}

          // Critical contract warnings: stub/mismatch en módulos sensibles
          const CRITICAL_PARAMS = new Set([
            'vcfcutoff', 'vcfresonance', 'vcfenvdepth', 'hpfcutoff',
            'vcfpolemode', 'voicedrift', 'oscdrift',
          ]);
          if ((badge === 'stub' || badge === 'mismatch') && CRITICAL_PARAMS.has(paramId)) {
            summary.criticalWarnings.push({
              paramId,
              offset,
              badge,
              rawA,
              rawB,
            });
          }
        });

        return summary;
      },

      // ═══════════════════════════════════════════════════════════
      // CL-08: Stratified Bank Run
      // ═══════════════════════════════════════════════════════════

      // Lectura de bancos cargados → shape normalizado de candidato
      getAllCandidatePatches() {
        const banks = (typeof window !== 'undefined' && window.loadedBanks) || {};
        const candidates = [];
        Object.entries(banks).forEach(([bankName, patchList]) => {
          if (!Array.isArray(patchList)) {return;}
          patchList.forEach((patch, patchIndex) => {
            if (!patch || !patch.unpackedBytes) {return;}
            candidates.push({
              bankName,
              patchIndex,
              patchName: (patch.name || `Patch ${patchIndex + 1}`).trim(),
              patchRef: patch,           // referencia viva — se congela al exportar
              meta: patch.meta || {},
            });
          });
        });
        return candidates;
      },

      filterCandidatePatches(candidates, config) {
        const { bankNames, categoryFilter, favoritesOnly } = config;
        return candidates.filter((c) => {
          if (bankNames.length > 0 && !bankNames.includes(c.bankName)) {return false;}
          if (favoritesOnly && !c.meta.favorite) {return false;}
          if (categoryFilter) {
            const cat = (c.meta.category || '').toLowerCase();
            if (!cat.includes(categoryFilter.toLowerCase())) {return false;}
          }
          return true;
        });
      },

      // Shuffle determinista tipo mulberry32 (PRNG seeded)
      seededShuffle(items, seed) {
        const arr = [...items];
        let s = (seed >>> 0) + 0x6d2b79f5;
        function next() {
          s = Math.imul(s ^ (s >>> 15), s | 1);
          s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
          return ((s ^ (s >>> 14)) >>> 0) / 0x100000000;
        }
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      },

      buildStratifiedRun(config) {
        const cfg = { ...state.bankRunConfig, ...(config || {}) };
        const runId = `run-${Date.now()}-${cfg.seed}`;

        let candidates = api.getAllCandidatePatches();
        candidates = api.filterCandidatePatches(candidates, cfg);

        // Estratificación: shuffle determinista, luego truncar
        const shuffled = api.seededShuffle(candidates, cfg.seed);
        const size = Math.max(0, Math.min(shuffled.length, cfg.sampleSize));
        const selected = shuffled.slice(0, size);

        const CRITICAL_PARAMS = new Set([
          'vcfcutoff', 'vcfresonance', 'vcfenvdepth', 'hpfcutoff',
          'vcfpolemode', 'voicedrift', 'oscdrift',
        ]);

        return selected.map((c, index) => {
          // criticalCandidate: el patch tiene valores no-cero en offsets críticos
          const maps = (typeof window !== 'undefined' && window.dualMidiBridge)
            ? window.dualMidiBridge.paramToByteOffset || {}
            : {};
          const bytes = c.patchRef.unpackedBytes;
          const criticalCandidate = [...CRITICAL_PARAMS].some((paramId) => {
            const off = maps[paramId];
            return Number.isFinite(off) && Number.isFinite(bytes[off]) && bytes[off] !== 0;
          });

          return {
            runId,
            index,
            bankName: c.bankName,
            patchIndex: c.patchIndex,
            patchName: c.patchName,
            patchRef: c.patchRef,      // referencia viva — congelar en export
            meta: deepClone(c.meta),   // snapshot inmutable del meta en t0
            criticalCandidate,
            status: 'pending',
            notes: '',
          };
        });
      },

      setBankRunConfig(partial) {
        setState({
          bankRunConfig: { ...state.bankRunConfig, ...(partial || {}) },
        });
      },

      generateBankRun() {
        const items = api.buildStratifiedRun(state.bankRunConfig);
        const runId = items.length > 0 ? items[0].runId : `run-empty-${Date.now()}`;
        setState({ bankRunItems: items, bankRunId: runId });
        return items;
      },

      clearBankRun() {
        setState({ bankRunItems: [], bankRunId: null });
        // También reinicia el workflow si su runId coincidía
        if (state.workflowSession.runId === state.bankRunId) {
          setState({
            workflowSession: deepClone(DEFAULT_STATE.workflowSession),
          });
        }
      },

      // ═══════════════════════════════════════════════════════════
      // CL-09: Workflow Session
      // ═══════════════════════════════════════════════════════════

      startWorkflowSession(runId) {
        const targetRunId = runId || state.bankRunId;
        setState({
          workflowSession: {
            runId: targetRunId,
            currentIndex: 0,
            startedAt: nowIso(),
            completedAt: null,
            itemStatuses: {},
            itemNotes: {},
          },
        });
      },

      selectWorkflowIndex(index) {
        const max = Math.max(0, state.bankRunItems.length - 1);
        const safe = Math.max(0, Math.min(max, Number(index) || 0));
        setState({
          workflowSession: { ...state.workflowSession, currentIndex: safe },
        });
      },

      nextWorkflowItem() {
        const next = state.workflowSession.currentIndex + 1;
        if (next < state.bankRunItems.length) {
          api.selectWorkflowIndex(next);
        }
      },

      prevWorkflowItem() {
        const prev = state.workflowSession.currentIndex - 1;
        if (prev >= 0) {
          api.selectWorkflowIndex(prev);
        }
      },

      markWorkflowItemStatus(index, status) {
        const VALID = new Set(['pass', 'review', 'fail', 'skip', 'pending']);
        if (!VALID.has(status)) {return;}
        const newStatuses = {
          ...state.workflowSession.itemStatuses,
          [String(index)]: status,
        };
        // Actualizar también bankRunItems[index].status (snapshot de items)
        const newItems = state.bankRunItems.map((item) =>
          item.index === index ? { ...item, status } : item
        );
        setState({
          bankRunItems: newItems,
          workflowSession: { ...state.workflowSession, itemStatuses: newStatuses },
        });
      },

      setWorkflowItemNotes(index, notes) {
        const newNotes = {
          ...state.workflowSession.itemNotes,
          [String(index)]: String(notes || ''),
        };
        const newItems = state.bankRunItems.map((item) =>
          item.index === index ? { ...item, notes: String(notes || '') } : item
        );
        setState({
          bankRunItems: newItems,
          workflowSession: { ...state.workflowSession, itemNotes: newNotes },
        });
      },

      getCurrentWorkflowItem() {
        const idx = state.workflowSession.currentIndex;
        return state.bankRunItems[idx] || null;
      },

      getWorkflowProgress() {
        const total = state.bankRunItems.length;
        if (total === 0) {return { total: 0, reviewed: 0, pct: 0 };}
        const statuses = state.workflowSession.itemStatuses;
        const reviewed = Object.values(statuses)
          .filter(s => s !== 'pending').length;
        return {
          total,
          reviewed,
          pct: Math.round((reviewed / total) * 100),
          currentIndex: state.workflowSession.currentIndex,
        };
      },

      // ═══════════════════════════════════════════════════════════
      // CL-10: Report snapshot — congelado en el momento de export
      // ═══════════════════════════════════════════════════════════

      getWorkflowReportSnapshot() {
        const cfg = deepClone(state.bankRunConfig);
        const session = deepClone(state.workflowSession);
        // Congelar patchRef → solo campos serializables, sin referencia viva
        const items = state.bankRunItems.map((item) => ({
          runId: item.runId,
          index: item.index,
          bankName: item.bankName,
          patchIndex: item.patchIndex,
          patchName: item.patchName,
          meta: deepClone(item.meta),
          criticalCandidate: item.criticalCandidate,
          status: state.workflowSession.itemStatuses[String(item.index)] || item.status,
          notes: state.workflowSession.itemNotes[String(item.index)] || item.notes,
          hasSysexData: Array.isArray(item.patchRef?.unpackedBytes) && item.patchRef.unpackedBytes.length > 0,
        }));

        const progress = api.getWorkflowProgress();
        const counts = items.reduce((acc, item) => {
          acc[item.status] = (acc[item.status] || 0) + 1;
          return acc;
        }, {});

        return {
          exportedAt: nowIso(),
          schemaVersion: 1,
          schema_version: '1.0.0',
          runId: state.bankRunId,
          config: cfg,
          session,
          progress,
          statusCounts: counts,
          items,
        };
      },

      buildReportRows() {
        const snap = api.getWorkflowReportSnapshot();
        return snap.items.map((item) => ({
          schema_version: snap.schema_version,
          runId: item.runId,
          index: item.index,
          bankName: item.bankName,
          patchIndex: item.patchIndex,
          patchName: item.patchName,
          category: item.meta.category || '',
          favorite: item.meta.favorite ? 'true' : 'false',
          status: item.status,
          criticalCandidate: item.criticalCandidate ? 'true' : 'false',
          latestBadge: '',           // relleno por el exporter si hay comparación activa
          notes: item.notes,
        }));
      },

      reset() {
        state = deepClone(DEFAULT_STATE);
        emit();
      },
    };


    return api;
  }

  if (typeof window !== 'undefined') {
    window.createCalibrationStore = createCalibrationStore;
    window.validateLiveCompliance = validateLiveCompliance;
  }
  if (typeof global !== 'undefined') {
    global.createCalibrationStore = createCalibrationStore;
    global.validateLiveCompliance = validateLiveCompliance;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createCalibrationStore, validateLiveCompliance };
  }
})();

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Simular el entorno de navegador básico antes de importar
if (typeof window === 'undefined') {
  global.window = {};
}

// Cargar la definición del store
import '../js/calibration_store.js';

describe('Calibration Store', () => {
  let mockBridge;

  beforeEach(() => {
    mockBridge = {
      getDiagnosticSnapshot: vi.fn(),
      waitForReady: vi.fn().mockResolvedValue(true)
    };
  });

  it('debe inicializarse con el estado por defecto correcto', () => {
    const createFn = window.createCalibrationStore || global.createCalibrationStore;
    const store = createFn(mockBridge);
    const state = store.getState();

    expect(state.snapshotStatus).toBe('idle');
    expect(state.diagnosticSnapshot).toBeNull();
    expect(state.activeTab).toBe('raw');
    expect(state.selectedVoiceIndex).toBe(0);
    expect(state.filters.showOnlyDifferences).toBe(false);
  });

  it('debe cambiar de tab activa', () => {
    const createFn = window.createCalibrationStore || global.createCalibrationStore;
    const store = createFn(mockBridge);
    store.setActiveTab('semantic');
    expect(store.getState().activeTab).toBe('semantic');

    // Ignorar tabs inválidas
    store.setActiveTab('invalid');
    expect(store.getState().activeTab).toBe('semantic');
  });

  it('debe validar y cargar un snapshot diagnóstico correcto', async () => {
    const createFn = window.createCalibrationStore || global.createCalibrationStore;
    const store = createFn(mockBridge);
    const mockSnap = {
      diagnosticSchemaVersion: 1,
      pitchBend: 0.1,
      modWheel: 0.2,
      voices: [
        { active: true, midiNote: 60, velocity: 100, effectiveCutoffHz: 1200 }
      ]
    };

    mockBridge.getDiagnosticSnapshot.mockResolvedValue(mockSnap);

    const result = await store.loadDiagnosticSnapshot();
    const state = store.getState();

    expect(result).not.toBeNull();
    expect(state.snapshotStatus).toBe('ready');
    expect(state.diagnosticSnapshot.engine.pitchBend).toBe(0.1);
    expect(state.diagnosticSnapshot.voices[0].midiNote).toBe(60);
    expect(state.diagnosticSnapshot.voices[0].effectiveCutoffHz).toBe(1200);
  });

  it('debe fallar con error si el schema es inválido o no soportado', async () => {
    const createFn = window.createCalibrationStore || global.createCalibrationStore;
    const store = createFn(mockBridge);
    mockBridge.getDiagnosticSnapshot.mockResolvedValue({
      diagnosticSchemaVersion: 2 // No soportada (espera 1)
    });

    const result = await store.loadDiagnosticSnapshot();
    const state = store.getState();

    expect(result).toBeNull();
    expect(state.snapshotStatus).toBe('error');
    expect(state.snapshotError).toContain('diagnosticSchemaVersion no soportado');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CL-05c: classifyRow — clasificador central de badge
// ─────────────────────────────────────────────────────────────────────────────
describe('classifyRow (CL-05c)', () => {
  let store;

  beforeEach(() => {
    const createFn = window.createCalibrationStore || global.createCalibrationStore;
    store = createFn(null);
  });

  it('devuelve "stub" para vcfpolemode independientemente de los valores', () => {
    expect(store.classifyRow('vcfpolemode', 0, 0)).toBe('stub');
    expect(store.classifyRow('vcfpolemode', 0, 1)).toBe('stub');
    expect(store.classifyRow('vcfpolemode', null, null)).toBe('stub');
  });

  it('devuelve "alias-shared" para offsets de drift conocidos', () => {
    expect(store.classifyRow('voicedrift', 50, 50)).toBe('alias-shared');
    expect(store.classifyRow('oscdrift', 50, 50)).toBe('alias-shared');
    expect(store.classifyRow('oscdrift', 10, 99)).toBe('alias-shared');
  });

  it('devuelve "info" cuando uno de los valores es null', () => {
    expect(store.classifyRow('vcfcutoff', null, 64)).toBe('info');
    expect(store.classifyRow('vcfcutoff', 64, null)).toBe('info');
  });

  it('devuelve "exact" cuando los bytes son iguales y el parámetro no es especial', () => {
    expect(store.classifyRow('vcfcutoff', 64, 64)).toBe('exact');
    expect(store.classifyRow('someParam', 0, 0)).toBe('exact');
  });

  it('devuelve "mismatch" cuando los bytes difieren y el parámetro no es especial', () => {
    expect(store.classifyRow('vcfcutoff', 64, 127)).toBe('mismatch');
    expect(store.classifyRow('osc1pitch', 30, 80)).toBe('mismatch');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CL-03c: getValidationSummary — resumen de validación testeable
// ─────────────────────────────────────────────────────────────────────────────
describe('getValidationSummary (CL-03c)', () => {
  let store;

  beforeEach(() => {
    const createFn = window.createCalibrationStore || global.createCalibrationStore;
    store = createFn(null);
  });

  it('devuelve resumen vacío cuando no hay patches seleccionados', () => {
    const summary = store.getValidationSummary();
    expect(summary.total).toBe(0);
    expect(summary.exact).toBe(0);
    expect(summary.mismatch).toBe(0);
    expect(summary.criticalWarnings).toHaveLength(0);
  });

  it('devuelve resumen vacío cuando solo hay un patch (falta el otro)', () => {
    store.setSelectedPatchA({ unpackedBytes: [64, 0, 10] });
    const summary = store.getValidationSummary();
    expect(summary.total).toBe(0);
  });

  it('devuelve contadores correctos con paramToByteOffset en window', () => {
    // Simular mapping mínimo via dualMidiBridge
    global.window.dualMidiBridge = {
      paramToByteOffset: {
        vcfcutoff:   0,
        vcfpolemode: 1,  // stub
        voicedrift:  2,  // alias-shared
        osc1pitch:   3,  // mismatch (bytes distintos)
      },
      byteOffsetToParamIds: {},
    };

    const bytesA = [64, 0, 50, 30];
    const bytesB = [64, 1, 50, 80]; // vcfpolemode y osc1pitch difieren

    store.setSelectedPatchA({ unpackedBytes: bytesA });
    store.setSelectedPatchB({ unpackedBytes: bytesB });

    const summary = store.getValidationSummary();

    expect(summary.total).toBe(4);
    expect(summary.exact).toBe(1);      // vcfcutoff igual
    expect(summary.stub).toBe(1);       // vcfpolemode
    expect(summary.aliasShared).toBe(1); // voicedrift
    expect(summary.mismatch).toBe(1);   // osc1pitch
    expect(summary.criticalWarnings.length).toBeGreaterThanOrEqual(1);
    expect(summary.criticalWarnings[0].paramId).toBe('vcfpolemode');

    // Cleanup
    delete global.window.dualMidiBridge;
  });

  it('no incluye critical warning cuando todos los parámetros críticos coinciden', () => {
    global.window.dualMidiBridge = {
      paramToByteOffset: { vcfcutoff: 0 },
      byteOffsetToParamIds: {},
    };

    store.setSelectedPatchA({ unpackedBytes: [64] });
    store.setSelectedPatchB({ unpackedBytes: [64] });

    const summary = store.getValidationSummary();
    expect(summary.criticalWarnings).toHaveLength(0);

    delete global.window.dualMidiBridge;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CL-07d: setSelectedRow — estado del drawer
// ─────────────────────────────────────────────────────────────────────────────
describe('setSelectedRow (CL-07d)', () => {
  let store;

  beforeEach(() => {
    const createFn = window.createCalibrationStore || global.createCalibrationStore;
    store = createFn(null);
  });

  it('initialState: selectedRowKey es null', () => {
    expect(store.getState().selectedRowKey).toBeNull();
  });

  it('setSelectedRow actualiza selectedRowKey correctamente', () => {
    store.setSelectedRow('sem-vcfcutoff-0');
    expect(store.getState().selectedRowKey).toBe('sem-vcfcutoff-0');
  });

  it('setSelectedRow con null cierra el drawer (limpia la selección)', () => {
    store.setSelectedRow('sem-vcfcutoff-0');
    store.setSelectedRow(null);
    expect(store.getState().selectedRowKey).toBeNull();
  });

  it('setSelectedRow con undefined también cierra el drawer', () => {
    store.setSelectedRow('sem-vcfcutoff-0');
    store.setSelectedRow(undefined);
    expect(store.getState().selectedRowKey).toBeNull();
  });

  it('cambiar de fila actualiza el contenido del drawer', () => {
    store.setSelectedRow('raw-5');
    expect(store.getState().selectedRowKey).toBe('raw-5');

    store.setSelectedRow('eff-effectiveCutoffHz');
    expect(store.getState().selectedRowKey).toBe('eff-effectiveCutoffHz');
  });

  it('notifica a los suscriptores cuando cambia la fila seleccionada', () => {
    const calls = [];
    store.subscribe((state) => calls.push(state.selectedRowKey));

    store.setSelectedRow('sem-vcfcutoff-0');
    store.setSelectedRow(null);

    expect(calls).toEqual(['sem-vcfcutoff-0', null]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CL-08e: buildStratifiedRun, seededShuffle, filterCandidatePatches
// ─────────────────────────────────────────────────────────────────────────────
describe('seededShuffle (CL-08e)', () => {
  let store;
  beforeEach(() => {
    const createFn = window.createCalibrationStore || global.createCalibrationStore;
    store = createFn(null);
  });

  it('produce la misma permutación para la misma seed', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const r1 = store.seededShuffle(arr, 42);
    const r2 = store.seededShuffle(arr, 42);
    expect(r1).toEqual(r2);
  });

  it('produce permutaciones distintas para seeds distintas', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const r1 = store.seededShuffle(arr, 1);
    const r2 = store.seededShuffle(arr, 9999);
    expect(r1).not.toEqual(r2);
  });

  it('preserva todos los elementos sin duplicados', () => {
    const arr = [10, 20, 30, 40, 50];
    const result = store.seededShuffle(arr, 7);
    expect(result).toHaveLength(arr.length);
    expect(new Set(result).size).toBe(arr.length);
  });

  it('no muta el array original', () => {
    const arr = [1, 2, 3];
    const copy = [...arr];
    store.seededShuffle(arr, 42);
    expect(arr).toEqual(copy);
  });
});

describe('filterCandidatePatches (CL-08e)', () => {
  let store;
  beforeEach(() => {
    const createFn = window.createCalibrationStore || global.createCalibrationStore;
    store = createFn(null);
  });

  const makeCandidates = () => [
    { bankName: 'Bank A', meta: { category: 'bass', favorite: true }, patchRef: { unpackedBytes: [] } },
    { bankName: 'Bank B', meta: { category: 'lead', favorite: false }, patchRef: { unpackedBytes: [] } },
    { bankName: 'Bank A', meta: { category: 'pad', favorite: false }, patchRef: { unpackedBytes: [] } },
    { bankName: 'Bank B', meta: { category: 'bass', favorite: true }, patchRef: { unpackedBytes: [] } },
  ];

  it('sin filtros activos devuelve todos los candidatos', () => {
    const result = store.filterCandidatePatches(makeCandidates(), {
      bankNames: [], categoryFilter: '', favoritesOnly: false,
    });
    expect(result).toHaveLength(4);
  });

  it('filtra por bankNames', () => {
    const result = store.filterCandidatePatches(makeCandidates(), {
      bankNames: ['Bank A'], categoryFilter: '', favoritesOnly: false,
    });
    expect(result).toHaveLength(2);
    result.forEach(c => expect(c.bankName).toBe('Bank A'));
  });

  it('filtra por categoryFilter (case-insensitive)', () => {
    const result = store.filterCandidatePatches(makeCandidates(), {
      bankNames: [], categoryFilter: 'BASS', favoritesOnly: false,
    });
    expect(result).toHaveLength(2);
  });

  it('filtra por favoritesOnly', () => {
    const result = store.filterCandidatePatches(makeCandidates(), {
      bankNames: [], categoryFilter: '', favoritesOnly: true,
    });
    expect(result).toHaveLength(2);
    result.forEach(c => expect(c.meta.favorite).toBe(true));
  });
});

describe('getAllCandidatePatches (CL-08e)', () => {
  let store;
  beforeEach(() => {
    const createFn = window.createCalibrationStore || global.createCalibrationStore;
    store = createFn(null);
  });

  it('devuelve array vacío cuando loadedBanks no existe', () => {
    const savedBanks = global.window.loadedBanks;
    delete global.window.loadedBanks;
    expect(store.getAllCandidatePatches()).toEqual([]);
    global.window.loadedBanks = savedBanks;
  });

  it('excluye slots sin unpackedBytes', () => {
    global.window.loadedBanks = {
      'Bank A': [
        { name: 'Patch 1', unpackedBytes: [1, 2, 3], meta: {} },
        null,
        { name: 'Patch 3' }, // sin unpackedBytes
      ],
    };
    const result = store.getAllCandidatePatches();
    expect(result).toHaveLength(1);
    expect(result[0].patchName).toBe('Patch 1');
    delete global.window.loadedBanks;
  });

  it('incluye patches de múltiples bancos con sus bankName', () => {
    global.window.loadedBanks = {
      'Bank A': [{ name: 'PA1', unpackedBytes: [0], meta: {} }],
      'Bank B': [{ name: 'PB1', unpackedBytes: [1], meta: {} }],
    };
    const result = store.getAllCandidatePatches();
    expect(result).toHaveLength(2);
    const bankNames = result.map(c => c.bankName);
    expect(bankNames).toContain('Bank A');
    expect(bankNames).toContain('Bank B');
    delete global.window.loadedBanks;
  });
});

describe('buildStratifiedRun (CL-08e)', () => {
  let store;
  beforeEach(() => {
    const createFn = window.createCalibrationStore || global.createCalibrationStore;
    store = createFn(null);
    global.window.loadedBanks = {
      'Bank A': Array.from({ length: 10 }, (_, i) => ({
        name: `Patch ${i}`, unpackedBytes: Array(242).fill(i), meta: { category: 'test', favorite: i % 2 === 0 }
      })),
    };
  });

  afterEach(() => { delete global.window.loadedBanks; });

  it('devuelve lista vacía si no hay bancos cargados', () => {
    delete global.window.loadedBanks;
    const items = store.buildStratifiedRun({ sampleSize: 5, seed: 1, bankNames: [], categoryFilter: '', favoritesOnly: false });
    expect(items).toEqual([]);
  });

  it('limita a sampleSize cuando hay más candidatos disponibles', () => {
    const items = store.buildStratifiedRun({ sampleSize: 3, seed: 42, bankNames: [], categoryFilter: '', favoritesOnly: false });
    expect(items).toHaveLength(3);
  });

  it('devuelve todos los candidatos si sampleSize > total', () => {
    const items = store.buildStratifiedRun({ sampleSize: 999, seed: 42, bankNames: [], categoryFilter: '', favoritesOnly: false });
    expect(items.length).toBeLessThanOrEqual(10);
    expect(items.length).toBe(10); // 10 patches en Bank A
  });

  it('es reproducible con la misma seed', () => {
    const cfg = { sampleSize: 5, seed: 77, bankNames: [], categoryFilter: '', favoritesOnly: false };
    const r1 = store.buildStratifiedRun(cfg).map(i => i.patchName);
    const r2 = store.buildStratifiedRun(cfg).map(i => i.patchName);
    expect(r1).toEqual(r2);
  });

  it('produce orden diferente con seed diferente', () => {
    const baseConfig = { sampleSize: 10, bankNames: [], categoryFilter: '', favoritesOnly: false };
    const r1 = store.buildStratifiedRun({ ...baseConfig, seed: 1 }).map(i => i.patchName);
    const r2 = store.buildStratifiedRun({ ...baseConfig, seed: 9999 }).map(i => i.patchName);
    expect(r1).not.toEqual(r2);
  });

  it('cada item tiene shape correcto con todos los campos requeridos', () => {
    const items = store.buildStratifiedRun({ sampleSize: 2, seed: 1, bankNames: [], categoryFilter: '', favoritesOnly: false });
    items.forEach(item => {
      expect(item).toHaveProperty('runId');
      expect(item).toHaveProperty('index');
      expect(item).toHaveProperty('bankName');
      expect(item).toHaveProperty('patchIndex');
      expect(item).toHaveProperty('patchName');
      expect(item).toHaveProperty('patchRef');
      expect(item).toHaveProperty('meta');
      expect(item).toHaveProperty('criticalCandidate');
      expect(item.status).toBe('pending');
      expect(item.notes).toBe('');
    });
  });

  it('no incluye duplicados de patch en el run', () => {
    const items = store.buildStratifiedRun({ sampleSize: 10, seed: 1, bankNames: [], categoryFilter: '', favoritesOnly: false });
    const keys = items.map(i => `${i.bankName}|${i.patchIndex}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CL-09e: Workflow Session
// ─────────────────────────────────────────────────────────────────────────────
describe('Workflow Session (CL-09e)', () => {
  let store;
  const setupRun = (s) => {
    global.window.loadedBanks = {
      'Bank A': Array.from({ length: 5 }, (_, i) => ({
        name: `Patch ${i}`, unpackedBytes: [i], meta: {}
      })),
    };
    s.generateBankRun();
    s.startWorkflowSession();
    delete global.window.loadedBanks;
  };

  beforeEach(() => {
    const createFn = window.createCalibrationStore || global.createCalibrationStore;
    store = createFn(null);
    store.setBankRunConfig({ sampleSize: 5, seed: 1 });
    setupRun(store);
  });

  it('startWorkflowSession inicializa en índice 0', () => {
    expect(store.getState().workflowSession.currentIndex).toBe(0);
  });

  it('nextWorkflowItem avanza el índice', () => {
    store.nextWorkflowItem();
    expect(store.getState().workflowSession.currentIndex).toBe(1);
  });

  it('prevWorkflowItem no baja de 0', () => {
    store.prevWorkflowItem();
    expect(store.getState().workflowSession.currentIndex).toBe(0);
  });

  it('nextWorkflowItem no supera el último índice', () => {
    for (let i = 0; i < 10; i++) {store.nextWorkflowItem();}
    expect(store.getState().workflowSession.currentIndex).toBe(4); // 5 items, índice máx = 4
  });

  it('markWorkflowItemStatus persiste status por índice', () => {
    store.markWorkflowItemStatus(0, 'pass');
    store.markWorkflowItemStatus(1, 'fail');
    const statuses = store.getState().workflowSession.itemStatuses;
    expect(statuses['0']).toBe('pass');
    expect(statuses['1']).toBe('fail');
  });

  it('markWorkflowItemStatus ignora status inválido', () => {
    store.markWorkflowItemStatus(0, 'invalid_status');
    expect(store.getState().workflowSession.itemStatuses['0']).toBeUndefined();
  });

  it('setWorkflowItemNotes persiste notas por índice', () => {
    store.setWorkflowItemNotes(2, 'suena raro');
    expect(store.getState().workflowSession.itemNotes['2']).toBe('suena raro');
  });

  it('getCurrentWorkflowItem devuelve el item del índice actual', () => {
    const item = store.getCurrentWorkflowItem();
    expect(item).not.toBeNull();
    expect(item.index).toBe(0);
  });

  it('getWorkflowProgress calcula porcentaje correcto', () => {
    store.markWorkflowItemStatus(0, 'pass');
    store.markWorkflowItemStatus(1, 'fail');
    const progress = store.getWorkflowProgress();
    expect(progress.total).toBe(5);
    expect(progress.reviewed).toBe(2);
    expect(progress.pct).toBe(40);
  });

  it('getWorkflowReportSnapshot congela datos serializables sin referencias vivas', () => {
    store.markWorkflowItemStatus(0, 'pass');
    store.setWorkflowItemNotes(0, 'nota test');
    const snap = store.getWorkflowReportSnapshot();

    expect(snap.schemaVersion).toBe(1);
    expect(snap.items).toBeDefined();
    expect(snap.items[0].status).toBe('pass');
    expect(snap.items[0].notes).toBe('nota test');
    // No debe tener patchRef viva — solo hasSysexData booleano
    expect(snap.items[0]).not.toHaveProperty('patchRef');
    expect(snap.items[0]).toHaveProperty('hasSysexData');
  });

  it('buildReportRows devuelve filas planas con campos CSV', () => {
    const rows = store.buildReportRows();
    expect(Array.isArray(rows)).toBe(true);
    if (rows.length > 0) {
      const row = rows[0];
      expect(row).toHaveProperty('runId');
      expect(row).toHaveProperty('bankName');
      expect(row).toHaveProperty('patchName');
      expect(row).toHaveProperty('status');
      expect(row).toHaveProperty('criticalCandidate');
      expect(row).toHaveProperty('notes');
    }
  });
});

// ── CL-10: validateLiveCompliance ──────────────────────────────────

describe('validateLiveCompliance', () => {
  let store;
  let validateFn;
  const spec = {
      voice: {
        staticPitchCentsRange: 3.0,
        staticCutoffNormRange: 0.06,
        staticResNormRange: 0.04,
        staticEnvTimeNormRange: 0.16,
      }
    };

    beforeEach(() => {
      const createFn = window.createCalibrationStore || global.createCalibrationStore;
      store = createFn(null);
      validateFn = window.validateLiveCompliance || global.validateLiveCompliance;
    });

    it('returns compliant=false for null/empty snapshot', () => {
      const r1 = validateFn(null, spec);
      expect(r1.compliant).toBe(false);
      expect(r1.voiceResults).toEqual([]);
      expect(r1.totalCompliant).toBe(0);

      const r2 = validateFn({ voices: null }, spec);
      expect(r2.compliant).toBe(false);

      const r3 = validateFn({}, spec);
      expect(r3.compliant).toBe(false);
    });

    it('passes all voices when drift is within tolerance', () => {
      const snapshot = {
        voices: [
          { active: true, midiNote: 60, velocity: 100, driftOsc1Pitch: 0.5, driftOsc2Pitch: -0.3, driftVcfCutoff: 0.01, driftVcfResonance: 0.005, driftEnvTime: 0.02 },
          { active: true, midiNote: 67, velocity: 80, driftOsc1Pitch: -0.8, driftOsc2Pitch: 0.2, driftVcfCutoff: -0.015, driftVcfResonance: -0.008, driftEnvTime: 0.03 },
        ]
      };
      const r = validateFn(snapshot, spec);
      expect(r.compliant).toBe(true);
      expect(r.totalCompliant).toBe(2);
      expect(r.voiceResults[0].passed).toBe(true);
      expect(r.voiceResults[1].passed).toBe(true);
    });

    it('fails specific voices when drift exceeds tolerance', () => {
      const snapshot = {
        voices: [
          { active: true, midiNote: 60, velocity: 100, driftOsc1Pitch: 2.0, driftOsc2Pitch: -0.3, driftVcfCutoff: 0.01, driftVcfResonance: 0.005, driftEnvTime: 0.02 },
          { active: true, midiNote: 67, velocity: 80, driftOsc1Pitch: 0.5, driftOsc2Pitch: 0.2, driftVcfCutoff: 0.05, driftVcfResonance: -0.008, driftEnvTime: 0.10 },
        ]
      };
      const r = validateFn(snapshot, spec);
      expect(r.compliant).toBe(false);
      expect(r.totalCompliant).toBe(0);
      // voice 0: OSC1 pitch exceeds 1.5 cents
      expect(r.voiceResults[0].failedCount).toBe(1);
      expect(r.voiceResults[0].checks.find(c => c.param === 'driftOsc1Pitch').passed).toBe(false);
      // voice 1: VCF cutoff drift 0.05 > 0.03, env time 0.10 > 0.08
      expect(r.voiceResults[1].failedCount).toBe(2);
      expect(r.voiceResults[1].checks.find(c => c.param === 'driftVcfCutoff').passed).toBe(false);
      expect(r.voiceResults[1].checks.find(c => c.param === 'driftEnvTime').passed).toBe(false);
    });

    it('ignores incomplete fields (missing drift params)', () => {
      const snapshot = {
        voices: [
          { active: true, midiNote: 60, velocity: 100, driftOsc1Pitch: 5.0 },
          { active: true, midiNote: 67, velocity: 80 },
        ]
      };
      const r = validateFn(snapshot, spec);
      // voice 0 fails OSC1 check, voice 1 has no checks so it passes
      expect(r.compliant).toBe(false);
      expect(r.voiceResults[0].passed).toBe(false);
      expect(r.voiceResults[0].failedCount).toBe(1);
      expect(r.voiceResults[1].passed).toBe(true);
      expect(r.voiceResults[1].failedCount).toBe(0);
    });

    it('defaults to DEFAULT_CALIBRATION_SPEC when spec is null', () => {
      const snapshot = {
        voices: [
          { active: true, midiNote: 60, velocity: 100, driftOsc1Pitch: 0.5, driftOsc2Pitch: -0.3, driftVcfCutoff: 0.01, driftVcfResonance: 0.005, driftEnvTime: 0.02 },
        ]
      };
      const r = validateFn(snapshot, null);
      expect(r.compliant).toBe(true);
      expect(r.totalCompliant).toBe(1);
    });
  });



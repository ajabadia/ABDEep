/**
 * parameterStore.test.js — Fase 2 §2.1 · ParameterStore transaccional
 *
 * Cobertura:
 *   - beginTransaction: campos del contrato PendingTransaction, TTL 300ms, revisiones
 *   - Supersede: nueva edición del mismo parámetro invalida la anterior (dedup por TTL)
 *   - confirm / confirmByValue (eco): isEcho true sin re-escritura; override externo isEcho false
 *   - sweep: expiración TTL → rollback 'parameter_edit' + transportStatus out_of_sync
 *   - rollback tipado: parameter_edit / patch_load / localstorage_migration
 *   - comparisonMode (§6.1): diff estructurado con clasificación quantization/divergence
 *   - inspect(): snapshot serializable
 */

import { describe, it, expect, beforeEach } from 'vitest';
import storeModule from '../js/parameter_store.js';

const { ParameterStore, PendingTransaction, TRANSACTION_TTL_MS, TX_STATES, TRANSPORT_STATUS, ROLLBACK_KINDS } = storeModule;

/** Reloj inyectable */
function makeClock() {
  let t = 1_000_000;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

function makeStore(extra = {}) {
  const clock = makeClock();
  const store = new ParameterStore({ now: clock.now, ...extra });
  return { store, clock };
}

describe('PendingTransaction — contrato §2.1', () => {
  it('TRANSACTION_TTL_MS = 300', () => {
    expect(TRANSACTION_TTL_MS).toBe(300);
  });

  it('expone los estados del contrato', () => {
    expect(TX_STATES).toEqual(['pending', 'confirmed', 'timeout', 'superseded', 'cancelled']);
    expect(TRANSPORT_STATUS).toEqual(['synced', 'pending', 'confirmed', 'out_of_sync']);
    expect(ROLLBACK_KINDS).toEqual(['parameter_edit', 'patch_load', 'localstorage_migration']);
  });

  it('crea una transacción con todos los campos del contrato', () => {
    const { store } = makeStore();
    const tx = store.beginTransaction({
      parameterId: 'vcf_cutoff',
      originId: 'ui',
      normalizedValue: 0.75,
      expectedRawValue: 191,
    });
    expect(tx).toBeInstanceOf(PendingTransaction);
    expect(tx.transactionId).toMatch(/^tx_/);
    expect(tx.parameterId).toBe('vcf_cutoff');
    expect(tx.originId).toBe('ui');
    expect(tx.revision).toBe(1);
    expect(tx.expectedRawValue).toBe(191);
    expect(tx.normalizedValue).toBe(0.75);
    expect(tx.state).toBe('pending');
    expect(tx.expiresAt - tx.createdAt).toBe(TRANSACTION_TTL_MS);
  });
});

describe('beginTransaction — dedup y revisiones', () => {
  let store, clock;
  beforeEach(() => { ({ store, clock } = makeStore()); });

  it('incrementa la revisión por parámetro', () => {
    const a = store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.5 });
    const b = store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.75 });
    expect(a.revision).toBe(1);
    expect(b.revision).toBe(2);
  });

  it('supersede la transacción anterior del mismo parámetro', () => {
    const a = store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.5 });
    store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.75 });
    expect(a.state).toBe('superseded');
    expect(store.getTransportStatus('vcf_cutoff')).toBe('pending');
  });

  it('lanza error sin parameterId', () => {
    expect(() => store.beginTransaction({})).toThrow(/parameterId/);
  });

  it('permite transacciones paralelas de parámetros distintos', () => {
    store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.5 });
    store.beginTransaction({ parameterId: 'vcf_resonance', normalizedValue: 0.25 });
    expect(store.inspect().transactionCount).toBe(2);
  });
});

describe('confirm / confirmByValue — confirmación explícita', () => {
  let store, clock;
  beforeEach(() => { ({ store, clock } = makeStore()); });

  it('confirm por transactionId marca confirmed y committed', () => {
    const tx = store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.75, expectedRawValue: 191 });
    const confirmed = store.confirm(tx.transactionId);
    expect(confirmed.state).toBe('confirmed');
    expect(store.getTransportStatus('vcf_cutoff')).toBe('confirmed');
    expect(store.inspect().committed['vcf_cutoff'].value).toBe(0.75);
  });

  it('confirmByValue con raw coincidente → isEcho true (sin re-escritura)', () => {
    store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.75, expectedRawValue: 191 });
    const res = store.confirmByValue('vcf_cutoff', 191);
    expect(res.isEcho).toBe(true);
    expect(res.tx.state).toBe('confirmed');
    // No hay transacción pending activa que la UI deba volver a escribir
    expect(store._byParameter.has('vcf_cutoff')).toBe(false);
  });

  it('confirmByValue con raw distinto → override externo, isEcho false', () => {
    store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.75, expectedRawValue: 191 });
    const res = store.confirmByValue('vcf_cutoff', 64);
    expect(res.isEcho).toBe(false);
    expect(res.tx.state).toBe('superseded');
  });

  it('confirmByValue sin transacción → isEcho false, tx null', () => {
    const res = store.confirmByValue('vcf_cutoff', 64);
    expect(res).toEqual({ isEcho: false, tx: null });
  });

  it('confirm de transacción ya no pending devuelve null', () => {
    const tx = store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.5 });
    store.confirm(tx.transactionId);
    expect(store.confirm(tx.transactionId)).toBeNull();
  });
});

describe('sweep — expiración TTL y rollback parameter_edit', () => {
  let store, clock;
  beforeEach(() => { ({ store, clock } = makeStore()); });

  it('expira la transacción tras el TTL y restaura committedValue', () => {
    store.commitExternal('vcf_cutoff', 0.5); // valor previo committed
    store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.9, expectedRawValue: 230 });
    expect(store.getTransportStatus('vcf_cutoff')).toBe('pending');

    clock.advance(TRANSACTION_TTL_MS + 1);
    const expired = store.sweep(clock.now());

    expect(expired.length).toBe(1);
    expect(expired[0].tx.state).toBe('timeout');
    expect(expired[0].committedValue).toBe(0.5); // restaurado
    expect(store.getTransportStatus('vcf_cutoff')).toBe('out_of_sync');
  });

  it('no expira antes del TTL', () => {
    store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.9 });
    clock.advance(TRANSACTION_TTL_MS - 1);
    expect(store.sweep(clock.now()).length).toBe(0);
    expect(store.getTransportStatus('vcf_cutoff')).toBe('pending');
  });

  it('timeoutPolicy mark_only no restaura el valor (solo transportStatus)', () => {
    const { store: s, clock: c } = makeStore({ timeoutPolicy: 'mark_only' });
    s.commitExternal('vcf_cutoff', 0.5);
    s.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.9 });
    c.advance(400);
    const expired = s.sweep(c.now());
    expect(expired.length).toBe(1);
    expect(expired[0].tx.state).toBe('timeout');
    expect(expired[0].committedValue).toBe(0.5);
    expect(s.getTransportStatus('vcf_cutoff')).toBe('out_of_sync');
  });
});

describe('rollback tipado — políticas §2.1', () => {
  let store, clock;
  beforeEach(() => { ({ store, clock } = makeStore()); });

  it('rollback parameter_edit → timeout + out_of_sync', () => {
    store.commitExternal('vcf_cutoff', 0.5);
    const tx = store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.9 });
    const restored = store.rollback(tx.transactionId, 'parameter_edit');
    expect(tx.state).toBe('timeout');
    expect(restored).toBe(0.5);
    expect(store.getTransportStatus('vcf_cutoff')).toBe('out_of_sync');
  });

  it('rollback patch_load → cancelled + conserva patch previo', () => {
    const previousPatch = { name: 'OLD', bytes: [1, 2, 3] };
    store.beginPatchLoad(previousPatch);
    const tx = store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.9 });
    const restored = store.rollback(tx.transactionId, 'patch_load');
    expect(tx.state).toBe('cancelled');
    expect(store.rollbackPatchLoad()).toBe(previousPatch);
  });

  it('rollback localstorage_migration → cancelled + restaura backup', () => {
    store.beginLocalStorageMigration('abd-eep-user-banks', { original: true });
    const tx = store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.9 });
    const restored = store.rollback(tx.transactionId, 'localstorage_migration');
    expect(tx.state).toBe('cancelled');
    expect(store.rollbackLocalStorageMigration('abd-eep-user-banks')).toEqual({ original: true });
  });

  it('rechaza reason inválido', () => {
    const tx = store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.5 });
    expect(() => store.rollback(tx.transactionId, 'nope')).toThrow(/inválido/);
  });

  it('rollback de transacción inexistente devuelve null', () => {
    expect(store.rollback('tx_fake', 'parameter_edit')).toBeNull();
  });

  it('rollback de transacción ya confirmada devuelve null (solo pending es rollback-able)', () => {
    const tx = store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.9 });
    store.confirm(tx.transactionId);
    expect(store.rollback(tx.transactionId, 'parameter_edit')).toBeNull();
    expect(store.getTransportStatus('vcf_cutoff')).toBe('confirmed'); // no corrompe el estado
  });

  it('override externo con normalizedValue adopta committed (no queda stale)', () => {
    store.commitExternal('vcf_cutoff', 0.5);
    store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.9, expectedRawValue: 230 });
    store.confirmByValue('vcf_cutoff', 64, 64 / 255); // override con normalized
    expect(store.getTransportStatus('vcf_cutoff')).toBe('synced');
    expect(store.inspect().committed['vcf_cutoff'].value).toBeCloseTo(64 / 255, 6);
    // un rollback posterior restaura el valor del hardware, no el stale
    const tx2 = store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.8 });
    expect(store.rollback(tx2.transactionId, 'parameter_edit')).toBeCloseTo(64 / 255, 6);
  });
});

describe('comparisonMode — feature flag §6.1', () => {
  it('está apagado por defecto y recordComparison no registra', () => {
    const { store } = makeStore();
    expect(store.isComparisonMode()).toBe(false);
    expect(store.recordComparison({ parameterId: 'vcf.cutoff', legacy: 0.5, value: 0.5 })).toBeNull();
    expect(store.getDiffs().length).toBe(0);
  });

  it('clasifica identical, quantization y divergence', () => {
    const { store } = makeStore({ comparisonMode: true });
    store.recordComparison({ parameterId: 'vcf.cutoff', legacy: 0.5, value: 0.5 });
    store.recordComparison({ parameterId: 'vcf.cutoff', legacy: 0.50196, value: 0.5 });
    store.recordComparison({ parameterId: 'vcf.cutoff', legacy: 0.5, value: 0.9 });
    const diffs = store.getDiffs();
    expect(diffs[0].classification).toBe('identical');
    expect(diffs[1].classification).toBe('quantization');
    expect(diffs[2].classification).toBe('divergence');
    expect(diffs[1]).toMatchObject({ parameterId: 'vcf.cutoff', legacy: 0.50196, value: 0.5 });
  });

  it('setComparisonMode activa/desactiva', () => {
    const { store } = makeStore();
    store.setComparisonMode(true);
    expect(store.isComparisonMode()).toBe(true);
    store.clearDiffs();
  });
});

describe('inspect y eventos', () => {
  let store, clock;
  beforeEach(() => { ({ store, clock } = makeStore()); });

  it('inspect expone transacciones, committed, transportStatus y flags', () => {
    store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.75, expectedRawValue: 191 });
    const snap = store.inspect();
    expect(snap.transactionCount).toBe(1);
    expect(snap.transactions[0].parameterId).toBe('vcf_cutoff');
    expect(snap.transportStatus['vcf_cutoff']).toBe('pending');
    expect(snap.ttlMs).toBe(300);
    expect(snap.comparisonMode).toBe(false);
    expect(snap.patchLoadActive).toBe(false);
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap); // serializable
  });

  it('emite eventos begin/confirmed/rollback', () => {
    const events = [];
    store.subscribe((e) => events.push(e.type));
    const tx = store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.5 });
    store.confirm(tx.transactionId);
    store.rollback(tx.transactionId, 'parameter_edit'); // ya confirmada → no emite
    expect(events).toContain('begin');
    expect(events).toContain('confirmed');
  });

  it('unsubscribe detiene los eventos', () => {
    const events = [];
    const unsub = store.subscribe((e) => events.push(e.type));
    unsub();
    store.beginTransaction({ parameterId: 'vcf_cutoff', normalizedValue: 0.5 });
    expect(events).toEqual([]);
  });

  it('commitExternal adopta el valor del hardware como synced', () => {
    store.commitExternal('vcf_cutoff', 0.31);
    expect(store.getTransportStatus('vcf_cutoff')).toBe('synced');
    expect(store.inspect().committed['vcf_cutoff'].value).toBe(0.31);
  });
});

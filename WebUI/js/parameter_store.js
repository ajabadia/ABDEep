/**
 * @purpose ParameterStore transaccional (Fase 2, plan v3.2 §2.1/§6): ciclo de vida de
 * ediciones de parámetros con PendingTransaction (TTL 300ms, revisiones, transactionId),
 * confirmación explícita por eco NRPN, políticas de rollback tipadas y transportStatus
 * por parámetro. Incluye el feature flag `comparisonMode` con diff estructurado.
 * @purpose_en Transactional ParameterStore (plan Fase 2 §2.1/§6): parameter edit lifecycle
 * with PendingTransaction (TTL 300ms, revisions, transactionId), explicit NRPN-echo
 * confirmation, typed rollback policies and per-parameter transportStatus. Also hosts the
 * `comparisonMode` feature flag with structured diff.
 * @classification Module/State/Transactional
 * @complexity High
 *
 * Fuera del hilo de audio: únicamente se usa en hilos de control/UI (regla §6.2).
 *
 * Uso:
 *   const store = new ParameterStore({ ttlMs: 300 });
 *   const tx = store.beginTransaction({ parameterId: 'vcf_cutoff', originId: 'ui',
 *                                        normalizedValue: 0.75, expectedRawValue: 191 });
 *   // ... el hardware confirma por eco:
 *   store.confirmByValue('vcf_cutoff', 191);          // → { isEcho: true, tx }
 *   // ... o el TTL expira:
 *   store.sweep(now);                                  // → rollback 'parameter_edit' + out_of_sync
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; }
    if (typeof window !== 'undefined') {
        window.ParameterStore = api.ParameterStore;   // clase para runtime
        window.ParameterStoreModule = api;            // api completa para tests/debug
    } else if (root) {
        root.ParameterStore = api.ParameterStore;
        root.ParameterStoreModule = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ── Constantes del contrato (§2.1) ──────────────────────────────────────────
    const TRANSACTION_TTL_MS = 300;
    const TX_STATES = ['pending', 'confirmed', 'timeout', 'superseded', 'cancelled'];
    const TRANSPORT_STATUS = ['synced', 'pending', 'confirmed', 'out_of_sync'];
    const ROLLBACK_KINDS = ['parameter_edit', 'patch_load', 'localstorage_migration'];
    const MAX_DIFFS = 256;

    let _txSeq = 0;

    /**
     * Transacción pendiente de un parámetro.
     */
    class PendingTransaction {
        /**
         * @param {object} opts
         * @param {string} opts.parameterId
         * @param {string} opts.originId
         * @param {number} opts.revision
         * @param {number|null} [opts.expectedRawValue] — raw esperado en el eco del hardware
         * @param {number} opts.normalizedValue — valor 0..1 que la UI ya escribió
         * @param {number} [opts.ttlMs] — TTL en ms (default TRANSACTION_TTL_MS = 300)
         * @param {number} [opts.createdAt] — timestamp inyectable (tests)
         */
        constructor(opts) {
            _txSeq += 1;
            const createdAt = opts.createdAt !== undefined ? opts.createdAt : Date.now();
            const ttlMs = opts.ttlMs !== undefined ? opts.ttlMs : TRANSACTION_TTL_MS;
            this.transactionId = opts.transactionId || ('tx_' + createdAt.toString(36) + '_' + _txSeq);
            this.parameterId = opts.parameterId;
            this.originId = opts.originId || 'unknown';
            this.revision = opts.revision;
            this.expectedRawValue = opts.expectedRawValue !== undefined ? opts.expectedRawValue : null;
            this.normalizedValue = opts.normalizedValue;
            this.createdAt = createdAt;
            this.expiresAt = createdAt + ttlMs;
            this.state = 'pending';
        }

        isPending() { return this.state === 'pending'; }
        isExpired(now) { return now >= this.expiresAt; }

        toJSON() {
            return {
                transactionId: this.transactionId,
                parameterId: this.parameterId,
                originId: this.originId,
                revision: this.revision,
                expectedRawValue: this.expectedRawValue,
                normalizedValue: this.normalizedValue,
                createdAt: this.createdAt,
                expiresAt: this.expiresAt,
                state: this.state,
            };
        }
    }

    /**
     * Store transaccional de parámetros.
     * - Una única transacción activa ('pending') por parámetro; una nueva edición
     *   marca la anterior como 'superseded' (deduplicación por TTL).
     * - `confirm()` / `confirmByValue()` → estado 'confirmed' y transportStatus='confirmed'
     *   SIN re-escribir la UI (evita escrituras redundantes al slider).
     * - `sweep()` expira los 'pending' vencidos → rollback tipado 'parameter_edit'
     *   (restaura committedValue) y transportStatus='out_of_sync'.
     * - `inspect()` expone el estado completo para depuración.
     */
    class ParameterStore {
        /**
         * @param {object} [opts]
         * @param {number} [opts.ttlMs] default 300
         * @param {boolean} [opts.comparisonMode] activa el feature flag de diff paralelo
         * @param {string} [opts.timeoutPolicy] 'rollback' (spec) | 'mark_only' (solo transportStatus)
         * @param {function} [opts.now] reloj inyectable para tests
         */
        constructor(opts) {
            opts = opts || {};
            this.ttlMs = opts.ttlMs !== undefined ? opts.ttlMs : TRANSACTION_TTL_MS;
            this.timeoutPolicy = opts.timeoutPolicy === 'mark_only' ? 'mark_only' : 'rollback';
            this._now = (typeof opts.now === 'function') ? opts.now : function () { return Date.now(); };

            this._transactions = new Map();      // txId → PendingTransaction
            this._byParameter = new Map();       // parameterId → txId (activa)
            this._committed = new Map();         // parameterId → { value, revision }
            this._revisions = new Map();         // parameterId → contador
            this._status = new Map();            // parameterId → transportStatus
            this._listeners = [];
            this._patchLoad = null;              // { active, previousPatch } | null
            this._storageBackups = new Map();    // key → backup

            // Feature flag §6.1 — comparación paralela legacy/nuevo
            this._comparisonMode = !!opts.comparisonMode;
            this._diffs = [];
        }

        // ── Suscripción a eventos ─────────────────────────────────────────────
        /**
         * @param {function} cb  recibe { type, tx?, parameterId?, restoredValue?, ... }
         * @returns {function} unsubscribe
         */
        subscribe(cb) {
            if (typeof cb !== 'function') { return function () {}; }
            this._listeners.push(cb);
            return () => {
                const i = this._listeners.indexOf(cb);
                if (i !== -1) { this._listeners.splice(i, 1); }
            };
        }

        _emit(evt) {
            for (const cb of this._listeners) {
                try { cb(evt); } catch (e) { /* los listeners no deben romper el store */ }
            }
        }

        _setStatus(parameterId, status) {
            this._status.set(parameterId, status);
            this._emit({ type: 'transportStatus', parameterId: parameterId, transportStatus: status });
        }

        getTransportStatus(parameterId) {
            return this._status.get(parameterId) || 'synced';
        }

        // ── Ciclo de vida transaccional ───────────────────────────────────────
        /**
         * Inicia una transacción para un parámetro. Si ya había una 'pending' para
         * el mismo parámetro, la anterior pasa a 'superseded' (dedup por TTL).
         *
         * @param {object} opts
         * @param {string} opts.parameterId
         * @param {string} [opts.originId] 'ui' | 'hardware' | 'patch' | 'calibration' | ...
         * @param {number} opts.normalizedValue — valor que la UI ya escribió (0..1)
         * @param {number|null} [opts.expectedRawValue] — raw esperado en el eco
         * @param {number} [opts.ttlMs]
         * @returns {PendingTransaction}
         */
        beginTransaction(opts) {
            if (!opts || !opts.parameterId) { throw new Error('[ParameterStore] beginTransaction requiere parameterId'); }
            const parameterId = opts.parameterId;
            const now = this._now();

            // Supersede la transacción anterior activa del mismo parámetro
            const prevTxId = this._byParameter.get(parameterId);
            if (prevTxId) {
                const prev = this._transactions.get(prevTxId);
                if (prev && prev.isPending()) {
                    prev.state = 'superseded';
                    this._emit({ type: 'superseded', tx: prev, parameterId: parameterId });
                }
                this._byParameter.delete(parameterId);
            }

            const revision = (this._revisions.get(parameterId) || 0) + 1;
            this._revisions.set(parameterId, revision);

            const tx = new PendingTransaction({
                parameterId: parameterId,
                originId: opts.originId || 'ui',
                revision: revision,
                expectedRawValue: opts.expectedRawValue !== undefined ? opts.expectedRawValue : null,
                normalizedValue: opts.normalizedValue,
                ttlMs: opts.ttlMs !== undefined ? opts.ttlMs : this.ttlMs,
                createdAt: now,
            });

            this._transactions.set(tx.transactionId, tx);
            this._byParameter.set(parameterId, tx.transactionId);
            this._setStatus(parameterId, 'pending');
            this._emit({ type: 'begin', tx: tx, parameterId: parameterId });
            return tx;
        }

        /**
         * Confirma una transacción por transactionId (p. ej. modo JUCE, síncrono).
         * @param {string} transactionId
         * @returns {PendingTransaction|null}
         */
        confirm(transactionId) {
            const tx = this._transactions.get(transactionId);
            if (!tx || !tx.isPending()) { return null; }
            tx.state = 'confirmed';
            this._byParameter.delete(tx.parameterId);
            this._committed.set(tx.parameterId, { value: tx.normalizedValue, revision: tx.revision });
            this._setStatus(tx.parameterId, 'confirmed');
            this._emit({ type: 'confirmed', tx: tx, parameterId: tx.parameterId });
            return tx;
        }

        /**
         * Confirma por eco del hardware (deduplicación UI/Hardware).
         * - Si hay una transacción 'pending' y el raw coincide con expectedRawValue
         *   → se confirma y devuelve { isEcho: true } (la UI NO debe re-escribirse).
         * - Si el raw no coincide → el hardware lo cambió antes; la transacción pasa
         *   a 'superseded' y devuelve { isEcho: false } (la UI debe actualizarse).
         *   Si se recibe normalizedValue, se adopta como committed (evita que un
         *   rollback posterior restaure un valor stale que pelee con el hardware).
         *
         * @param {string} parameterId
         * @param {number} rawValue
         * @param {number} [normalizedValue] — valor normalizado del override (si se conoce)
         * @returns {{ isEcho: boolean, tx: PendingTransaction|null }}
         */
        confirmByValue(parameterId, rawValue, normalizedValue) {
            const txId = this._byParameter.get(parameterId);
            const tx = txId ? this._transactions.get(txId) : null;
            if (!tx || !tx.isPending()) {
                return { isEcho: false, tx: null };
            }
            if (tx.expectedRawValue !== null && tx.expectedRawValue === rawValue) {
                this.confirm(tx.transactionId);
                return { isEcho: true, tx: tx };
            }
            // El hardware respondió con otro valor: edición externa, la nuestra queda superseded
            // y el valor del hardware se adopta (synced). La UI se actualiza con ese valor.
            tx.state = 'superseded';
            this._byParameter.delete(parameterId);
            if (typeof normalizedValue === 'number') {
                this.commitExternal(parameterId, normalizedValue);
            } else {
                this._setStatus(parameterId, 'synced');
            }
            this._emit({ type: 'superseded', tx: tx, parameterId: parameterId, reason: 'hardware_override' });
            return { isEcho: false, tx: tx };
        }

        /**
         * Confirma el valor que el hardware notificó (sin transacción previa): lo adopta
         * como committed y deja el transportStatus 'synced'.
         * @param {string} parameterId
         * @param {number} normalizedValue
         */
        commitExternal(parameterId, normalizedValue) {
            const revision = (this._revisions.get(parameterId) || 0) + 1;
            this._revisions.set(parameterId, revision);
            this._committed.set(parameterId, { value: normalizedValue, revision: revision });
            this._setStatus(parameterId, 'synced');
        }

        /**
         * Expira las transacciones 'pending' vencidas.
         * - timeoutPolicy 'rollback': aplica rollback 'parameter_edit' (restaura
         *   committedValue previo) y transportStatus='out_of_sync'.
         * - timeoutPolicy 'mark_only': solo marca 'timeout' + transportStatus.
         *
         * @param {number} [now]
         * @returns {Array<{tx: PendingTransaction, committedValue: number|null}>}
         */
        sweep(now) {
            now = now !== undefined ? now : this._now();
            const expired = [];
            for (const [parameterId, txId] of [...this._byParameter.entries()]) {
                const tx = this._transactions.get(txId);
                if (tx && tx.isPending() && tx.isExpired(now)) {
                    expired.push({ tx: tx, parameterId: parameterId });
                }
            }
            const results = [];
            for (const { tx, parameterId } of expired) {
                const restored = this.rollback(tx.transactionId, 'parameter_edit');
                results.push({ tx: tx, committedValue: restored });
            }
            return results;
        }

        /**
         * Rollback tipado de una transacción.
         * - 'parameter_edit': tx → 'timeout'; restaura committedValue previo; out_of_sync.
         * - 'patch_load': tx → 'cancelled'; conserva el patch previo; alerta resync.
         * - 'localstorage_migration': tx → 'cancelled'; restaura backup; configuración segura.
         *
         * @param {string} transactionId
         * @param {string} reason — uno de ROLLBACK_KINDS
         * @param {object} [opts]
         * @returns {number|null} valor restaurado (o null)
         */
        rollback(transactionId, reason) {
            const tx = this._transactions.get(transactionId);
            if (!tx || !tx.isPending()) { return null; } // solo 'pending' es rollback-able
            if (ROLLBACK_KINDS.indexOf(reason) === -1) {
                throw new Error('[ParameterStore] rollback reason inválido: ' + reason);
            }
            const parameterId = tx.parameterId;
            const committed = this._committed.get(parameterId);
            const restoredValue = committed ? committed.value : null;

            if (reason === 'parameter_edit') {
                tx.state = 'timeout';
                this._byParameter.delete(parameterId);
                this._setStatus(parameterId, 'out_of_sync');
            } else {
                tx.state = 'cancelled';
                this._byParameter.delete(parameterId);
            }

            this._emit({
                type: 'rollback',
                tx: tx,
                parameterId: parameterId,
                reason: reason,
                restoredValue: restoredValue,
                policy: this._describeRollbackPolicy(reason),
            });
            return restoredValue;
        }

        _describeRollbackPolicy(reason) {
            if (reason === 'parameter_edit') {
                return 'restaurar committedValue previo + transportStatus=out_of_sync';
            }
            if (reason === 'patch_load') {
                return 'conservar patch previo + alerta de resincronización';
            }
            return 'restaurar backup original + configuración segura de fábrica';
        }

        // ── Rollback de carga de patch (§2.1) ─────────────────────────────────
        beginPatchLoad(previousPatch) {
            this._patchLoad = { active: true, previousPatch: previousPatch || null };
            this._emit({ type: 'patch_load_begin', patch: previousPatch || null });
        }

        confirmPatchLoad() {
            const was = this._patchLoad;
            this._patchLoad = null;
            this._emit({ type: 'patch_load_confirm', patch: was ? was.previousPatch : null });
        }

        /**
         * Si la transmisión SysEx del preset completo falla, devuelve el patch previo
         * (el motor debe mantenerlo) y emite alerta de resincronización.
         * @returns {*} patch previo o null
         */
        rollbackPatchLoad() {
            const was = this._patchLoad;
            this._patchLoad = null;
            if (was && was.active) {
                this._emit({
                    type: 'patch_load_rollback',
                    patch: was.previousPatch,
                    policy: this._describeRollbackPolicy('patch_load'),
                });
            }
            return was ? was.previousPatch : null;
        }

        // ── Rollback de migración LocalStorage (§2.1) ──────────────────────────
        beginLocalStorageMigration(key, originalValue) {
            this._storageBackups.set(key, originalValue);
            this._emit({ type: 'storage_begin', key: key });
        }

        confirmLocalStorageMigration(key) {
            this._storageBackups.delete(key);
            this._emit({ type: 'storage_confirm', key: key });
        }

        /**
         * Ante un esquema corrupto: restaura el backup original y aplica la
         * configuración segura de fábrica (factory-safe fallback).
         * @param {string} key
         * @returns {*} backup original o null
         */
        rollbackLocalStorageMigration(key) {
            const backup = this._storageBackups.get(key);
            if (backup !== undefined) {
                this._storageBackups.delete(key);
                this._emit({
                    type: 'storage_rollback',
                    key: key,
                    backup: backup,
                    policy: this._describeRollbackPolicy('localstorage_migration'),
                });
            }
            return backup !== undefined ? backup : null;
        }

        // ── Feature flag §6.1: comparisonMode ──────────────────────────────────
        setComparisonMode(enabled) {
            this._comparisonMode = !!enabled;
            return this._comparisonMode;
        }

        isComparisonMode() { return this._comparisonMode; }

        /**
         * Registra un diff estructurado legacy/nuevo (solo si comparisonMode activo).
         * @param {object} entry { parameterId, legacy, value }
         * @returns {object|null} el diff registrado o null si el flag está apagado
         */
        recordComparison(entry) {
            if (!this._comparisonMode) { return null; }
            const legacy = entry.legacy;
            const value = entry.value;
            const difference = value - legacy;
            const classification = this._classifyDiff(legacy, value, difference);
            const diff = {
                parameterId: entry.parameterId,
                legacy: legacy,
                value: value,
                difference: difference,
                classification: classification,
                timestamp: this._now(),
            };
            this._diffs.push(diff);
            if (this._diffs.length > MAX_DIFFS) { this._diffs.shift(); }
            this._emit({ type: 'comparison', diff: diff });
            return diff;
        }

        _classifyDiff(legacy, value, difference) {
            if (Math.abs(difference) < 1e-9) { return 'identical'; }
            // Diferencia menor que medio paso de cuantización (1/255) → cuantización
            const halfStep = 0.5 / 255.0;
            if (Math.abs(difference) <= halfStep) { return 'quantization'; }
            return 'divergence';
        }

        getDiffs() { return this._diffs.slice(); }
        clearDiffs() { this._diffs = []; }

        // ── Inspección depurable (§2.1) ────────────────────────────────────────
        /**
         * Snapshot completo y serializable del estado del store.
         */
        inspect() {
            const transactions = [];
            for (const tx of this._transactions.values()) { transactions.push(tx.toJSON()); }
            const committed = {};
            for (const [k, v] of this._committed.entries()) { committed[k] = v; }
            const transportStatus = {};
            for (const [k, v] of this._status.entries()) { transportStatus[k] = v; }
            return {
                ttlMs: this.ttlMs,
                timeoutPolicy: this.timeoutPolicy,
                comparisonMode: this._comparisonMode,
                transactionCount: transactions.length,
                transactions: transactions,
                committed: committed,
                transportStatus: transportStatus,
                diffs: this._diffs.slice(),
                patchLoadActive: !!(this._patchLoad && this._patchLoad.active),
                storageBackups: [...this._storageBackups.keys()],
            };
        }

        /**
         * Limpia todo el estado (tests / teardown).
         */
        reset() {
            this._transactions.clear();
            this._byParameter.clear();
            this._committed.clear();
            this._revisions.clear();
            this._status.clear();
            this._diffs = [];
            this._patchLoad = null;
            this._storageBackups.clear();
        }
    }

    return {
        ParameterStore: ParameterStore,
        PendingTransaction: PendingTransaction,
        TRANSACTION_TTL_MS: TRANSACTION_TTL_MS,
        TX_STATES: TX_STATES,
        TRANSPORT_STATUS: TRANSPORT_STATUS,
        ROLLBACK_KINDS: ROLLBACK_KINDS,
    };
});

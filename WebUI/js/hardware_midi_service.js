/**
 * @purpose HardwareMidiService (Fase 2, plan v3.2 §2.2): FSM del puerto MIDI hardware.
 * Estados: disconnected → connected → syncing → ready → transmitting → resync_required.
 * Transiciones con guardas; emite eventos onStateChange; expose inspect() para depuración.
 * @purpose_en HardwareMidiService (plan Fase 2 §2.2): MIDI port FSM.
 * @classification Module/Connection/FSM
 * @complexity Medium
 *
 * FSM:
 *   disconnected ─connect()→ connected ─beginSync()→ syncing ─syncComplete()→ ready
 *   ready ─beginTransmission()→ transmitting ─transmissionComplete()→ ready
 *   syncing/transmitting/ready ─(fallo)→ resync_required ─beginSync()/connect()→ syncing/connected
 *   cualquier estado ─disconnect()→ disconnected
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; }
    if (typeof window !== 'undefined') {
        window.HardwareMidiService = api.HardwareMidiService;
        window.HardwareMidiServiceModule = api;
    } else if (root) {
        root.HardwareMidiService = api.HardwareMidiService;
        root.HardwareMidiServiceModule = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const PORT_STATES = ['disconnected', 'connected', 'syncing', 'ready', 'transmitting', 'resync_required'];

    // Matriz de transiciones válidas (origen → destinos)
    const TRANSITIONS = {
        disconnected: ['connected', 'resync_required'],
        connected: ['syncing', 'disconnected', 'resync_required'],
        syncing: ['ready', 'resync_required', 'disconnected', 'connected'],
        ready: ['transmitting', 'resync_required', 'disconnected', 'syncing'],
        transmitting: ['ready', 'resync_required', 'disconnected'],
        resync_required: ['syncing', 'connected', 'disconnected'],
    };

    class HardwareMidiService {
        /**
         * @param {object} [opts]
         * @param {string} [opts.initialState] 'disconnected' (default)
         */
        constructor(opts) {
            opts = opts || {};
            this._state = PORT_STATES.includes(opts.initialState) ? opts.initialState : 'disconnected';
            this._listeners = [];
            this._lastTransition = null;
            this._metrics = {
                syncCount: 0,
                transmissionCount: 0,
                resyncCount: 0,
                disconnectCount: 0,
            };
        }

        getState() { return this._state; }

        isIn(...states) { return states.includes(this._state); }
        isConnected() { return this._state !== 'disconnected'; }
        isReady() { return this._state === 'ready'; }
        isTransmitting() { return this._state === 'transmitting'; }

        /**
         * @param {function} cb  recibe { from, to, reason, ts }
         * @returns {function} unsubscribe
         */
        onStateChange(cb) {
            if (typeof cb !== 'function') { return function () {}; }
            this._listeners.push(cb);
            return () => {
                const i = this._listeners.indexOf(cb);
                if (i !== -1) { this._listeners.splice(i, 1); }
            };
        }

        /**
         * Intenta una transición. Devuelve true si fue válida y se aplicó.
         * @param {string} to
         * @param {string} [reason]
         * @returns {boolean}
         */
        transition(to, reason) {
            if (!PORT_STATES.includes(to)) { return false; }
            const allowed = TRANSITIONS[this._state] || [];
            if (!allowed.includes(to)) { return false; }
            const from = this._state;
            this._state = to;
            const ts = Date.now();
            this._lastTransition = { from: from, to: to, reason: reason || null, ts: ts };
            if (to === 'resync_required') { this._metrics.resyncCount += 1; }
            if (from === 'disconnected' && to === 'connected') { this._metrics.syncCount += 1; }
            if (from === 'ready' && to === 'transmitting') { this._metrics.transmissionCount += 1; }
            for (const cb of this._listeners) {
                try { cb({ from: from, to: to, reason: reason || null, ts: ts }); } catch (e) { /* noop */ }
            }
            return true;
        }

        // ── API semántica ──────────────────────────────────────────────────────
        connect(reason) { return this.transition('connected', reason || 'port_opened'); }
        beginSync(reason) { return this.transition('syncing', reason || 'sync_start'); }
        syncComplete(reason) { return this.transition('ready', reason || 'sync_done'); }
        syncFailed(reason) { return this.transition('resync_required', reason || 'sync_failed'); }
        beginTransmission(reason) { return this.transition('transmitting', reason || 'tx_start'); }
        transmissionComplete(reason) { return this.transition('ready', reason || 'tx_done'); }
        transmissionFailed(reason) { return this.transition('resync_required', reason || 'tx_failed'); }
        requestResync(reason) { return this.transition('resync_required', reason || 'resync'); }
        disconnect(reason) {
            const ok = this.transition('disconnected', reason || 'port_closed');
            if (ok) { this._metrics.disconnectCount += 1; }
            return ok;
        }

        /**
         * Atajo: establece directamente el estado deseado (refleja resultados externos
         * sin validar la matriz de transiciones). No-op true si ya está en ese estado.
         * @param {string} state
         * @param {string} [reason]
         * @returns {boolean}
         */
        forceState(state, reason) {
            if (!PORT_STATES.includes(state)) { return false; }
            if (state === this._state) { return true; }
            const from = this._state;
            this._state = state;
            this._lastTransition = { from: from, to: state, reason: reason || 'forced', ts: Date.now() };
            if (state === 'resync_required') { this._metrics.resyncCount += 1; }
            if (state === 'disconnected') { this._metrics.disconnectCount += 1; }
            if (state === 'transmitting') { this._metrics.transmissionCount += 1; }
            for (const cb of this._listeners) {
                try { cb({ from: from, to: state, reason: reason || 'forced', ts: Date.now() }); } catch (e) { /* noop */ }
            }
            return true;
        }

        /**
         * Snapshot serializable del FSM.
         */
        inspect() {
            return {
                state: this._state,
                lastTransition: this._lastTransition,
                metrics: { ...this._metrics },
            };
        }
    }

    return {
        HardwareMidiService: HardwareMidiService,
        PORT_STATES: PORT_STATES,
        TRANSITIONS: TRANSITIONS,
    };
});

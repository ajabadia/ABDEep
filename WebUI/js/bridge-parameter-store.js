/**
 * @purpose Integración Fase 2: ParameterStore transaccional + HardwareMidiService FSM +
 * SysExAssembler en el runtime de DualMidiBridge. Carga DESPUÉS de bridge-dual.js y
 * de los módulos de conexión/NRPN; envuelve prototipos de forma no destructiva.
 * @purpose_en Fase 2 integration: transactional ParameterStore + HardwareMidiService FSM +
 * SysExAssembler wired into the DualMidiBridge runtime.
 * @classification Module/Integration
 * @complexity High
 *
 * Qué hace:
 *  - `setParameter()` inicia una transacción (originId 'ui'). En modo JUCE (nativo,
 *    síncrono y autoritativo) se confirma inmediatamente. En modo hardware queda
 *    'pending' y el eco NRPN entrante la confirma (dedup UI/Hardware, sin bucles).
 *  - Parámetros virtuales (byteOffset >= 300) o sin byte físico no transaccionan
 *    (no tienen eco legítimo en el hardware).
 *  - Sweep cada 100ms: TTL vencido → rollback 'parameter_edit' → restaura el valor
 *    committed y marca out_of_sync (política §2.1).
 *  - `isConnected()`/`sendNRPN()` alimentan la FSM del puerto (§2.2).
 *  - `window.sysexAssembler` queda disponible como ensamblador SysEx independiente.
 */
(function () {
    'use strict';
    const Logger = globalThis.Logger || console;

    if (typeof DualMidiBridge === 'undefined') {
        Logger.warn('[Bridge-ParameterStore] DualMidiBridge not found — deferring...');
        return;
    }
    if (typeof window === 'undefined') { return; }

    // ── Singletons Fase 2 ──────────────────────────────────────────────────────
    if (!window.parameterStore && typeof window.ParameterStore === 'function') {
        window.parameterStore = new window.ParameterStore({ ttlMs: 300 });
    }
    if (!window.hardwareMidiService && typeof window.HardwareMidiService === 'function') {
        window.hardwareMidiService = new window.HardwareMidiService();
    }
    if (!window.sysexAssembler && typeof window.SysExAssembler === 'function') {
        window.sysexAssembler = new window.SysExAssembler({ timeoutMs: 2000, maxMessageLength: 1024 });
    }

    const store = window.parameterStore;
    const fsm = window.hardwareMidiService;

    // ── setParameter transaccional (§2.1) ─────────────────────────────────────
    const origSetParameter = DualMidiBridge.prototype.setParameter;
    DualMidiBridge.prototype.setParameter = function (paramId, normalizedValue, forceResend) {
        const cache = this.parameterCache;
        const cached = cache ? cache[paramId] : undefined;

        if (store && !forceResend &&
            (cached === undefined || Math.abs(cached - normalizedValue) >= 0.001)) {
            const byteOffset = this.paramToByteOffset ? this.paramToByteOffset[paramId] : undefined;
            const transactable = byteOffset !== undefined && byteOffset >= 0 && byteOffset < 300;
            if (transactable) {
                const expectedRaw = this._normalizedToRaw(byteOffset, normalizedValue);
                const tx = store.beginTransaction({
                    parameterId: paramId,
                    originId: 'ui',
                    normalizedValue: normalizedValue,
                    expectedRawValue: expectedRaw,
                });
                if (this.isJuce && tx) {
                    // Nativo: síncrono y autoritativo → confirmar inmediato
                    store.confirm(tx.transactionId);
                }
                // HW: la confirmación llega por el eco NRPN (dedup en bridge-midi-rx-nrpn-handlers.js)
            }
        }
        return origSetParameter.call(this, paramId, normalizedValue, forceResend);
    };

    // ── FSM del puerto (§2.2) ─────────────────────────────────────────────────
    const origIsConnected = DualMidiBridge.prototype.isConnected;
    DualMidiBridge.prototype.isConnected = async function () {
        const result = await origIsConnected.call(this);
        if (fsm) {
            if (result) {
                if (fsm.getState() === 'disconnected') { fsm.connect('identity_ok'); }
                fsm.beginSync('identity');
                fsm.syncComplete();
            } else {
                fsm.requestResync('no_response');
            }
        }
        return result;
    };

    const origSendNRPN = DualMidiBridge.prototype.sendNRPN;
    DualMidiBridge.prototype.sendNRPN = function () {
        if (fsm && fsm.isReady()) { fsm.beginTransmission('nrpn'); }
        const result = origSendNRPN.apply(this, arguments);
        if (fsm && fsm.isTransmitting()) { fsm.transmissionComplete(); }
        return result;
    };

    // ── Sweep TTL + rollback tipado (§2.1) ────────────────────────────────────
    function resendRestoredValue(bridge, parameterId, restoredValue) {
        if (restoredValue === null || restoredValue === undefined) { return; }
        if (!bridge || !bridge.parameterCache) { return; }
        bridge.parameterCache[parameterId] = restoredValue;
        if (typeof bridge.handleParameterChangeFromBackend === 'function') {
            bridge.handleParameterChangeFromBackend(parameterId, restoredValue);
        }
        if (!bridge.isJuce && typeof bridge.sendWebMidiParameter === 'function') {
            bridge.sendWebMidiParameter(parameterId, restoredValue);
        }
    }

    if (store) {
        store.subscribe(function (evt) {
            if (evt.type === 'rollback' && evt.reason === 'parameter_edit') {
                resendRestoredValue(window.dualMidiBridge, evt.parameterId, evt.restoredValue);
                Logger.warn('[ParameterStore] Rollback parameter_edit ' + evt.parameterId + ' → out_of_sync');
            } else if (evt.type === 'patch_load_rollback') {
                Logger.warn('[ParameterStore] Rollback carga de patch: mantener patch previo + resync');
            } else if (evt.type === 'storage_rollback') {
                Logger.warn('[ParameterStore] Rollback LocalStorage (' + evt.key + '): configuración segura aplicada');
            }
        });

        setInterval(function () {
            store.sweep();
        }, 100);
    }

    Logger.log('[Bridge] Fase 2 activa: ParameterStore + HardwareMidiService + SysExAssembler');
})();

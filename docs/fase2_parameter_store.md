# Fase 2 — ParameterStore Transaccional, FSM MIDI y Feature Flags

> Plan de Refactorización v3.2 congelado · Sección §2 «Ciclo de Vida Transaccional, Políticas de Rollback y FSM MIDI» y §6 «Feature Flags, Diff Comparativo y Logger Estructurado».
> Estado: **completado** · Fecha: 2026-08-09

---

## 1. Arquitectura entregada

```
┌──────────────────────────────────────────────────────────────────┐
│  ParameterStore (window.parameterStore)   — §2.1 ciclo de vida    │
│  PendingTransaction { transactionId, parameterId, originId,       │
│    revision, expectedRawValue, normalizedValue, createdAt,        │
│    expiresAt (TTL=300ms), state }                                 │
│    state: pending → confirmed | timeout | superseded | cancelled  │
│  + rollback tipado + transportStatus + comparisonMode (§6.1)      │
├──────────────────────────────────────────────────────────────────┤
│  HardwareMidiService (window.hardwareMidiService) — §2.2 FSM      │
│    disconnected → connected → syncing → ready → transmitting     │
│                                            ↘ resync_required      │
├──────────────────────────────────────────────────────────────────┤
│  SysExAssembler (window.sysexAssembler) — §2.2 FSM de mensajes    │
│    waiting → collecting → complete | malformed | timeout          │
├──────────────────────────────────────────────────────────────────┤
│  bridge-parameter-store.js — integración no destructiva con       │
│    DualMidiBridge (setParameter, eco NRPN, isConnected, sendNRPN) │
└──────────────────────────────────────────────────────────────────┘
```

## 2. ParameterStore — contrato §2.1

Archivo: `WebUI/js/parameter_store.js` (UMD: `window.ParameterStore` + `module.exports`).

### 2.1 `PendingTransaction`

```typescript
interface PendingTransaction {
  transactionId: string;      // 'tx_<time36>_<seq>'
  parameterId: string;        // 'vcf_cutoff', ...
  originId: string;           // 'ui' | 'hardware' | 'patch' | 'calibration' | ...
  revision: number;           // contador por parámetro (1, 2, 3...)
  expectedRawValue: number;   // raw (0-255) esperado en el eco NRPN del hardware
  normalizedValue: number;    // valor 0..1 que la UI ya escribió
  createdAt: number;
  expiresAt: number;          // createdAt + TTL (300 ms por defecto)
  state: 'pending' | 'confirmed' | 'timeout' | 'superseded' | 'cancelled';
}
```

### 2.2 API principal

| Método | Comportamiento |
|--------|----------------|
| `beginTransaction({parameterId, originId, normalizedValue, expectedRawValue, ttlMs})` | Crea la transacción; **supersede** la anterior 'pending' del mismo parámetro (dedup por TTL). `transportStatus → pending`. |
| `confirm(transactionId)` | Estado `confirmed` + `transportStatus=confirmed` **sin re-escribir el slider** (evita escrituras redundantes). Actualiza `committedValue`. |
| `confirmByValue(parameterId, rawValue)` | **Confirmación por eco**: si hay 'pending' y `expectedRawValue === rawValue` → `{isEcho:true}` (la UI NO debe re-escribirse). Si el raw difiere → override externo: `{isEcho:false}`, tx `superseded`, valor adoptado `synced`. |
| `sweep(now?)` | Expira 'pending' vencidas → rollback `parameter_edit` + `transportStatus=out_of_sync`. `timeoutPolicy: 'rollback'` (spec) o `'mark_only'`. |

> ⚠️ **Riesgo operativo (hardware sin eco NRPN):** con `timeoutPolicy: 'rollback'` (default, según
> spec §2.1 «si expira el TTL, el store restaura el valor previo»), una edición HW-mode que el
> hardware **no** confirme por eco se revierte a los 300ms aunque el NRPN sí se envió. Si el
> DM12 está configurado sin eco de NRPN recibido, usar `timeoutPolicy: 'mark_only'` (solo marca
> `out_of_sync`, no revierte) o confirmar por otra vía. El DeepMind 12 por defecto re-emite los
> cambios NRPN por su salida MIDI, por lo que el eco funciona en la configuración típica.
| `rollback(transactionId, reason)` | Rollback **tipado** (ver 2.3). |
| `commitExternal(parameterId, normalizedValue)` | Adopta un valor notificado por el hardware (sin tx previa) como `synced`. |
| `getTransportStatus(parameterId)` | `'synced' \| 'pending' \| 'confirmed' \| 'out_of_sync'`. |
| `inspect()` | Snapshot serializable completo (transacciones, committed, transportStatus, diffs, flags). |
| `subscribe(cb)` / unsubscribe | Eventos: `begin`, `confirmed`, `superseded`, `rollback`, `transportStatus`, `patch_load_*`, `storage_*`, `comparison`. |

### 2.3 Políticas de rollback tipadas

| Reason | Estado tx | Acción |
|--------|-----------|--------|
| `parameter_edit` | `timeout` | Restaura `committedValue` previo + `transportStatus=out_of_sync` (§2.1 «si expira el TTL...»). |
| `patch_load` | `cancelled` | Conserva el patch previo (`rollbackPatchLoad()` lo devuelve) + alerta de resincronización. |
| `localstorage_migration` | `cancelled` | Restaura el backup original (`rollbackLocalStorageMigration(key)`) + configuración segura de fábrica. |

### 2.4 Feature flag `comparisonMode` (§6.1)

- `setComparisonMode(bool)` / `isComparisonMode()` — flag de comparación paralela legacy/nuevo.
- `recordComparison({parameterId, legacy, value})` → diff estructurado con clasificación:
  - `identical` (|diff| < 1e-9)
  - `quantization` (|diff| ≤ 0.5/255 ≈ medio paso de cuantización)
  - `divergence` (resto)

```json
{
  "parameterId": "vcf.cutoff",
  "legacy": 0.50196,
  "new": 0.5,
  "difference": -0.00196,
  "classification": "quantization"
}
```

`getDiffs()` / `clearDiffs()` — ring buffer acotado (256).

## 3. HardwareMidiService — FSM del puerto (§2.2)

Archivo: `WebUI/js/hardware_midi_service.js`.

```
disconnected ─connect()→ connected ─beginSync()→ syncing ─syncComplete()→ ready
ready ─beginTransmission()→ transmitting ─transmissionComplete()→ ready
syncing/transmitting/ready ─(fallo)→ resync_required ─beginSync()/connect()→ syncing/connected
cualquier estado ─disconnect()→ disconnected
```

- `transition(to, reason)` con **guardas** (matriz `TRANSITIONS`); transiciones inválidas → `false`.
- `forceState(state, reason)` — setter directo para reflejar resultados externos (sin validar matriz).
- `onStateChange(cb)` recibe `{from, to, reason, ts}`.
- `inspect()` → `{state, lastTransition, metrics}` (syncCount, transmissionCount, resyncCount, disconnectCount).

## 4. SysExAssembler — FSM de mensajes (§2.2)

Archivo: `WebUI/js/sysex_assembler.js`. Independiente del puerto: recibe bytes y emite mensajes completos.

- `feed(data)` — acepta Uint8Array/Array/byte suelto; F0 inicia, F7 completa.
- Tolerante a basura previa al F0; doble F0 reinicia el buffer.
- `malformed`: F7 suelto (`stray_eox`) o desbordamiento (`overflow`, límite configurable).
- `timeout`: sin F7 dentro de `timeoutMs` (timers inyectables para tests).
- Un nuevo F0 tras `complete` reinicia automáticamente.
- `onComplete(bytes)` / `onMalformed(reason)` / `onTimeout()` / `getMessage()` / `inspect()`.

## 5. Integración con DualMidiBridge

Archivo: `WebUI/js/bridge-parameter-store.js` (carga después de bridge-dual.js + conexión/NRPN).

| Punto de integración | Comportamiento |
|----------------------|----------------|
| `setParameter(paramId, value, forceResend)` | Inicia transacción `originId='ui'` para params físicos (byteOffset 0-299). **JUCE**: confirm inmediato (síncrono/autoritativo). **HW**: queda `pending` hasta el eco NRPN. |
| `bridge-midi-rx-nrpn-handlers.js` (CC38) | Eco entrante → `confirmByValue(pid, raw)`: si `isEcho`, **no** re-escribe el slider (solo `transportStatus=confirmed`); si es override externo, actualiza UI con el valor del hardware. Guardado: sin `window.parameterStore` el comportamiento es legacy. |
| `isConnected()` | Alimenta la FSM: ok → `connected→syncing→ready`; fallo → `resync_required`. |
| `sendNRPN()` | `ready→transmitting→ready` alrededor del envío. |
| Sweep (100ms) | Expira TTLs; en `rollback` `parameter_edit` reenvía el valor committed restaurado y marca `out_of_sync`. |
| Singleton | `window.parameterStore`, `window.hardwareMidiService`, `window.sysexAssembler`. |

## 6. Verificación

- **Vitest**: 87 test files · **4457 tests · 0 fallos** (74 nuevos: 30 parameterStore + 16 hardwareMidiService + 17 sysexAssembler + 11 bridgeParameterStore).
- **ESLint**: 0 errores en los 4 módulos nuevos + hook + 4 suites.
- **Sin regresiones**: suite legacy completa verde; `bridgeDual.test.js` (eval de módulos reales del bridge) sigue pasando — el hook de eco está guardado y es no-op sin `window.parameterStore`.

## 7. Estado del plan

- [x] Fase 2: Implementar `ParameterStore` con `PendingTransaction` (TTL, revisiones, transactionId, rollback e inspección depurable de estado).
- [x] Fase 2: Implementar `HardwareMidiService` con FSM de puerto y `SysExAssembler` independiente.
- [x] Fase 2: Introducir **Feature Flag de comparación paralela** (`comparisonMode`) con diff estructurado.

Pendiente de Fases posteriores: sanitización DOM/ASCII (Fase 3), batería de tests 3 niveles + fuzzing (Fase 4), WASM/capabilities (Fase 5), retirada legacy + `Logger.deprecation` (Fase 6).

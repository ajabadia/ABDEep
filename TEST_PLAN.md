# 📋 Plan de Cobertura — Tests WebUI JS

**Baseline:** 3084/3084 tests pasando · 23 test files · 76 source files

---

## ✅ Completados

| # | Archivo | Tests | Fecha |
|---|---|---|---|
| 1 | `modmatrix.test.js` | 39 | 2026-07-12 |
| 2 | `scriptShortcuts.test.js` | 38 | 2026-07-12 |
| 3 | `scriptCurves.test.js` | 32 | 2026-07-12 |
| 4 | `editHistory.test.js` | 20 | 2026-07-12 |
| 5 | `editActions.test.js` | 22 | 2026-07-12 |
| 6 | `keyboardChordMemory.test.js` | 46 | 2026-07-12 |
| 7 | `editCacheMapper.test.js` | 68 | 2026-07-12 |
| 8 | `seqSim.test.js` | 37 | 2026-07-12 |
| 9 | `keyboardPolyChord.test.js` | 41 | 2026-07-12 |
| 10 | `browserPersistence.test.js` | 31 | 2026-07-12 |
| 11 | `settingsMidiLearn.test.js` | 33 | 2026-07-12 |
| 12 | `keyboardActiveNotes.test.js` | 40 | 2026-07-12 |
| 13 | `sequencerPresets.test.js` | 31 | 2026-07-12 |
| 14 | `effectsPresets.test.js` | 35 | 2026-07-12 |
| 15 | `settingsCurves.test.js` | 40 | 2026-07-12 |
| 16 | `editPersistence.test.js` | 37 | 2026-07-12 |
| 17 | `sequencerEditor.test.js` | 59 | 2026-07-12 |
| 18 | `settingsShortcuts.test.js` | 48 | 2026-07-12 |
| 19 | `settingsDumpViewer.test.js` | 47 | 2026-07-12 |
| 20 | `scriptRandomizer.test.js` | 68 | 2026-07-12 |
| 21 | `factoryFxPresets.test.js` | 70 | 2026-07-12 |
| 22 | `browserIo.test.js` | 42 | 2026-07-12 |
| 23 | `arpeggiatorCore.test.js` | 118 | 2026-07-12 |
| 24 | `panelGraphics.test.js` | 68 | 2026-07-12 |
| 25 | `effectsTemplates.test.js` | 61 | 2026-07-12 |
| 26 | `scriptControllers.test.js` | 57 | 2026-07-12 |
| 27 | `factorySeqPresets.test.js` | 14 | 2026-07-12 |
| 28 | `panelOscilloscope.test.js` | 37 | 2026-07-12 |
| **Total** | | **1379 nuevos tests** | |

---

## 🔴 Prioridad Alta

| # | Archivo | LOC | Funciones clave | Estrategia |
|---|---|---|---|---|
| 1 | **modmatrix.js** | 308 | `MOD_SOURCES` (25 items), `MOD_DESTINATIONS` (~130 items), `initModMatrix()`, `syncModMatrixUIFromState()` | Tests de constantes + sync de 8 slots con cache/bridge mockeado |
| 2 | **script_shortcuts.js** | 159 | `ShortcutConfig.load/save/get/set/reset/resetAll/formatCombo/matches` | Tests puros: localStorage stub, matching ctrl/shift/alt/meta, formatCombo |
| 3 | **script_curves.js** | 89 | `applyControllerCurve`, `applyBipolarCurve`, `_evalCustomCurve`, `getControllerCurve`, `setControllerCurve`, `getCustomCurvePoints` | Tests de curvas matemáticas: expo2/3, log, s-curve, custom piecewise |
| 4 | **edit_actions.js** | 116 | `initEditActions()`: clipboard copy/paste, undo/redo, key bindings | Tests de flujo: copiar preset, pegar en slot, factory bank protection |
| 5 | **edit_history.js** | 87 | `initEditHistory`, `triggerUndo`, `triggerRedo`, stack push/pop | Tests de pila: push states, undo, redo, límite profundidad |
| 6 | **edit_cache_mapper.js** | 278 | Mapping de parámetros | Tests de mapeo byte ↔ paramId ↔ normalized value |

## 🟡 Prioridad Media

| # | Archivo | LOC | Funciones clave |
|---|---|---|---|
| 7 | **keyboard_chord_memory.js** | 126 | `CHORD_INTERVALS`, `_captureChordMemory`, `_playChordMemory` |
| 8 | **keyboard_poly_chord.js** | 109 | Poly chord assignment per key |
| 9 | **keyboard_active_notes.js** | 123 | Active notes tracking |
| 10 | **seq-sim.js** | 94 | Sequencer simulator (browser mode) |
| 11 | **sequencer_presets.js** | 84 | Sequencer preset CRUD |
| 12 | **browser_persistence.js** | 103 | `_saveUserBanksToStorage`, `_loadUserBanksFromStorage` |
| 13 | **settings_midi_learn.js** | 122 | MIDI Learn config |

## 🟢 Prioridad Baja

| # | Archivo | LOC | Observación |
|---|---|---|---|
| 14 | **panel_templates.js** | 484 | Plantillas HTML — más fixture que lógica |
| 15 | **edit_persistence.js** | 225 | Persistencia de ediciones |
| 17 | **sequencer_editor.js** | 280 | 32-step grid interactivo |
| 18 | **effects_presets.js** | 162 | FX preset CRUD en localStorage |
| 19 | **settings_curves.js** | 331 | Curvas configurables |
| +20 | browser_mapper.js, browser_packer.js | 85/85 | Helpers de browser |
| +21 | panel_controls_*.js (5 archivos) | 643/208/145/300 | Panel controls |
| +22 | settings_curves.js, settings_dump_viewer.js, settings_shortcuts.js | 331/271/203 | Settings sub-módulos |
| +24 | components/* (21 archivos) | 26–369 c/u | Componentes UI |


---

## Metodología

Por cada archivo:
1. Extraer funciones puras del source (copiar + renombrar)
2. Stub dependencias (window, document, localStorage, bridge)
3. Probar: defaults, casos normales, edge cases, sin bridge
4. Ejecutar test específico + CI completo
5. Marcar como ✅ en este plan

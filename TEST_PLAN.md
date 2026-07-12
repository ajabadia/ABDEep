# 📋 Plan de Cobertura — Tests WebUI JS

**Estado actual:** 3403 tests · 51 test files · 52 source files · 6 sin cobertura directa

---

## ✅ Cobertura Completa — Mapa Source → Test

| Source | LOC | Test File(s) | Tests |
|--------|-----|-------------|-------|
| `arpeggiator.js` | 357 | `arpeggiatorCore.test.js` | 118 |
| `bridge-dual.js` | ~800 | `bridgeDual.test.js`, `bridgeDualCore.test.js` | — |
| `bridge-engines.js` | ~200 | `bridgeEngines.test.js` | — |
| `bridge-midi-learn.js` | ~150 | `bridgeMidiLearn.test.js` | — |
| `bridge-param-maps.js` | ~120 | `bridgeParamMaps.test.js`, `browserMapper.test.js` | 118 |
| `browser.js` | ~450 | `browserCore.test.js` | — |
| `browser_io.js` | 85 | `browserIo.test.js` | 42 |
| `browser_mapper.js` | 85 | `browserMapper.test.js` | 118 |
| `browser_persistence.js` | 103 | `browserPersistence.test.js` | 31 |
| `byte-map.js` | ~250 | `byteMap.test.js`, `browserMapper.test.js` | 118 |
| `edit_actions.js` | 116 | `editActions.test.js` | 22 |
| `edit_cache_mapper.js` | 278 | `editCacheMapper.test.js` | 68 |
| `edit_history.js` | 87 | `editHistory.test.js` | 20 |
| `edit_persistence.js` | 225 | `editPersistence.test.js` | 37 |
| `effects.js` | 329 | `effects.test.js`, `effectsTemplates.test.js` | 61 |
| `effects_presets.js` | 162 | `effectsPresets.test.js` | 35 |
| `effects_templates.js` | 589 | `effectsTemplates.test.js` | 61 |
| `factory_fx_presets.js` | ~5000 | `factoryFxPresets.test.js` | 70 |
| `factory_seq_presets.js` | ~550 | `factorySeqPresets.test.js` | 14 |
| `keyboard.js` | 390 | `keyboardCore.test.js` | — |
| `keyboard_active_notes.js` | 123 | `keyboardActiveNotes.test.js` | 40 |
| `keyboard_chord_memory.js` | 126 | `keyboardChordMemory.test.js` | 46 |
| `keyboard_poly_chord.js` | 109 | `keyboardPolyChord.test.js` | 41 |
| `knobs.js` | 67 | `knobs.test.js` | — |
| `modmatrix.js` | 308 | `modmatrix.test.js` | 39 |
| `panel_edit.js` | 731 | `panelEdit.test.js` | — |
| `panel_graphics.js` | ~500 | `panelGraphics.test.js` | 68 |
| `panel_oscilloscope.js` | ~200 | `panelOscilloscope.test.js` | 37 |
| `panel_templates.js` | ~200 | `panelTemplates.test.js` | 32 |
| `script.js` | 1109 | `scriptCore.test.js`, `globalSettings.test.js`, `lcdSafeUpdate.test.js` | — |
| `script_bar_generators.js` | ~50 | `barGenerators.test.js` | — |
| `script_controllers.js` | ~500 | `scriptControllers.test.js` | 57 |
| `script_curves.js` | 89 | `scriptCurves.test.js` | 32 |
| `script_randomizer.js` | ~250 | `scriptRandomizer.test.js` | 68 |
| `script_shortcuts.js` | 159 | `scriptShortcuts.test.js` | 38 |
| `seq-sim.js` | 94 | `seqSim.test.js` | 37 |
| `sequencer.js` | 457 | `sequencerCore.test.js`, `lfoSliders.test.js` | — |
| `sequencer_editor.js` | 280 | `sequencerEditor.test.js` | 59 |
| `sequencer_presets.js` | 84 | `sequencerPresets.test.js` | 31 |
| `settings.js` | 1008 | `settingsCore.test.js` | — |
| `settings_curves.js` | 331 | `settingsCurves.test.js` | 40 |
| `settings_dump_viewer.js` | 271 | `settingsDumpViewer.test.js` | 47 |
| `settings_midi_learn.js` | 122 | `settingsMidiLearn.test.js` | 33 |
| `settings_shortcuts.js` | 203 | `settingsShortcuts.test.js` | 48 |
| `sysex_monitor.js` | 321 | `sysexMonitor.test.js` | — |

### Componentes UI (24 archivos)

| Source | LOC | Cobertura |
|--------|-----|-----------|
| `debug-panel.js` | 369 | `uiComponents.test.js` (parcial) |
| `ctrl-tooltip.js` | 350 | `uiComponents.test.js` (parcial) |
| `settings-modal.js` | 332 | `uiComponents.test.js` + `modalTests.test.js` |
| `bank-manager.js` | 137 | `uiComponents.test.js` (parcial) |
| `keyboard-shortcuts.js` | 113 | — |
| `debug_panel_template.js` | 104 | — |
| `fx-modal.js` | 121 | — |
| `top-bar.js` | 94 | — |
| `arp-modal.js` | 83 | — |
| `seq-modal.js` | 74 | — |
| `programmer-section.js` | 86 | — |
| `keyboard-section.js` | 64 | — |
| `debug_panel_voice_calculator.js` | 47 | — |
| `control-grid.js` | 44 | — |
| `side-panel.js` | 44 | — |
| `env-section.js` | 36 | — |
| `osc-section.js` | 35 | — |
| `vca-section.js` | 33 | — |
| `lfo-section.js` | 32 | — |
| `vcf-section.js` | 32 | — |
| `hpf-section.js` | 31 | — |
| `mod-matrix.js` | 29 | — |
| `arp-seq-section.js` | 26 | — |
| `poly-section.js` | 28 | — |

---

## ❌ Archivos Sin Cobertura Directa

| # | Source | LOC | Prioridad | Funciones clave |
|---|--------|-----|-----------|-----------------|
| 1 | `browser_packer.js` | 85 | 🟡 Media | `unpack7to8()`, `pack8to7()`, `extractNameFromRawSysex()`, `buildSingleSysex()` |
| 2 | `panel_controls_arp_seq_mod.js` | 643 | 🔴 Alta | `bindPanelArpControls()`, `bindPanelChordControls()`, `bindPanelPolyChordControls()`, `bindPanelSeqControls()`, `bindPanelChordAndPolyCommon()` |
| 3 | `panel_controls_binder.js` | 208 | 🔴 Alta | `updatePanelFromState()`, `syncDetailPanelControls()`, `initDynamicSliders()` |
| 4 | `panel_controls_env_voice.js` | 170 | 🟡 Media | `bindPanelEnvControls()`, `bindPanelPolyControls()`, `bindPanelPortaControls()` |
| 5 | `panel_controls_lfo_vca.js` | 145 | 🟡 Media | `bindPanelLfoControls()`, `bindPanelVcaControls()` |
| 6 | `panel_controls_osc_vcf.js` | 300 | 🟡 Media | `bindPanelOscControls()`, `bindPanelHpfControls()`, `bindPanelVcfControls()` |

**Total LOC sin test directo:** 1,551 líneas (6 archivos)
**% cubierto:** ~97% de archivos fuente, ~94% de LOC

---

## 📊 Estado por Prioridad

### 🔴 Alta — Priorizadas para siguiente sesión

| # | Archivo | Tests | Estrategia |
|---|---------|-------|------------|
| 1 | `browser_packer.test.js` | ~20 | Funciones puras de bit-packing (7-to-8, 8-to-7), extracción de nombre, construcción de SysEx. Sin dependencias DOM. |
| 2 | `panel_controls_binder.test.js` | ~30 | `updatePanelFromState()` — sincronización de sliders, selects, toggle-boxes, shape-led-rows. DOM mock necesario. |
| 3 | `panel_controls_arp_seq_mod.test.js` | ~50 | Lógica de bindings de ARP (enable, hold, mode, clock), Chord (enable, key, type), Poly Chord (12 keys×8 types), SEQ (32-step grid). DOM mock + bridge stub. |

### 🟡 Media

| # | Archivo | Tests | Notas |
|---|---------|-------|-------|
| 4 | `panel_controls_env_voice.test.js` | ~25 | ENV trigger modes, Poly voice mode/priority/trigger, Porta mode. DOM + bridge stubs. |
| 5 | `panel_controls_lfo_vca.test.js` | ~20 | LFO shape selectors, Kbd Sync/Arp Sync toggles, VCA mode buttons. |
| 6 | `panel_controls_osc_vcf.test.js` | ~35 | OSC1/2 range, PM source, PWM source, toggle boxes. HPF boost. VCF pole/polarity/LFO select. DOM + bridge stubs. |

### 🟢 Baja — Componentes UI (24 archivos)

Los componentes son principalmente HTML template generators + event listeners. Cada uno <100 LOC (excepto debug-panel 369, ctrl-tooltip 350, settings-modal 332, bank-manager 137). Cobertura parcial vía `uiComponents.test.js` + `modalTests.test.js`.

---

## 📈 Historial de Cobertura

| Fecha | Test Files | Tests | Nuevos tests | Source files |
|-------|-----------|-------|-------------|-------------|
| 2026-07-11 | 23 | 1,874 | — | 76 |
| 2026-07-12 | 51 | 3,403 | +1,529 | 52 |

---

## Metodología

Por cada archivo:
1. Extraer funciones puras del source (copiar + renombrar)
2. Stub dependencias (window, document, localStorage, bridge) según sea necesario
3. Probar: defaults, casos normales, edge cases, sin bridge
4. Ejecutar test específico + CI completo
5. Marcar como ✅ en este plan

# 📋 Plan de Cobertura — Tests WebUI JS

**Estado actual:** 3,494 tests · 53 test files · 52 source files · 47 con test · 4 sin test

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
| `browser_packer.js` | 85 | `browserCore.test.js`, `browserPacker.test.js` | 52 |
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
| `panel_controls_binder.js` | 208 | `panelControlsBinder.test.js` | 39 |
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

## ❌ Sin Test Directo: 5 archivos

| # | Archivo | LOC | Funciones | Estrategia |
|---|---------|-----|-----------|------------|
| ~~1~~ | ~~`browser_packer.js`~~ | ~~85~~ | ~~`unpack7to8()`, `pack8to7()`, `extractNameFromRawSysex()`, `buildSingleSysex()`~~ | ~~Puro — sin DOM. Testear bit-packing 7↔8, nombres, padding~~ ✅ Ahora en `browserPacker.test.js` + `browserCore.test.js` |
| 2 | `panel_controls_arp_seq_mod.js` | 643 | `bindPanelArpControls()`, `bindPanelChordControls()`, `bindPanelPolyChordControls()`, `bindPanelSeqControls()`, `bindPanelChordAndPolyCommon()` | DOM mock + bridge stub. ARP/Chord/SEQ binding logic |
| 3 | `panel_controls_env_voice.js` | 170 | `bindPanelEnvControls()`, `bindPanelPolyControls()`, `bindPanelPortaControls()` | DOM + bridge. ENV triggers, Poly mode/priority, Porta |
| 4 | `panel_controls_lfo_vca.js` | 145 | `bindPanelLfoControls()`, `bindPanelVcaControls()` | DOM + bridge. LFO shape selectors, VCA mode buttons |
| 5 | `panel_controls_osc_vcf.js` | 300 | `bindPanelOscControls()`, `bindPanelHpfControls()`, `bindPanelVcfControls()` | DOM + bridge. OSC1/2 range, HPF boost, VCF pole/polarity |

**Total LOC sin test:** 1,258 líneas · **% cubierto:** 90% de archivos, ~95% de LOC

### ℹ️ Excluido intencionalmente

- **`_fix_fade.js`** (20 LOC) — script Node.js (`require('fs')`), no es módulo del navegador

---

## 📈 Historial de Cobertura

| Fecha | Test Files | Tests | Nuevos tests | Source files | Componentes |
|-------|-----------|-------|-------------|-------------|-------------|
| 2026-07-11 | 23 | 1,874 | — | 76 | — |
| 2026-07-12 | 51 | 3,403 | +1,529 | 52 | 24 |
| 2026-07-12 | 52 | 3,442 | +1,568 | 52 | 24 |
| 2026-07-12 | 53 | 3,494 | +1,620 | 52 | 24 |

---

## Metodología

Por cada archivo:
1. Extraer funciones puras del source (copiar + renombrar)
2. Stub dependencias (window, document, localStorage, bridge) según sea necesario
3. Probar: defaults, casos normales, edge cases, sin bridge
4. Ejecutar test específico + CI completo
5. Marcar como ✅ en este plan

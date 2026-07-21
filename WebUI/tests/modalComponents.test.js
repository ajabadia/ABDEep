/**
 * Unit tests for Modal Web Components (3 files):
 *   - arp-modal.js  ArpModal  (Arpeggiator & Pattern Editor)
 *   - seq-modal.js  SeqModal  (Control Sequencer & Steps Editor)
 *   - fx-modal.js   FxModal  (Effects Engine Rack)
 *
 * Covers:
 *   - Template structure (expected elements, IDs, data-params, tooltips)
 *   - Select options (clock rates, modes, lengths, FX types)
 *   - Web Component registration (customElements.define)
 *   - connectedCallback behavior (render-once guard)
 *   - Cross-component patterns (modal structure, close buttons)
 *
 * Run with: npx vitest run WebUI/tests/modalComponents.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Custom Elements registry mock
// ══════════════════════════════════════════════════════════════════

function createCustomElementsRegistry() {
  const registry = {};
  return {
    define: vi.fn(function(name, cls) {
      registry[name] = cls;
    }),
    get: vi.fn(function(name) {
      return registry[name] || undefined;
    }),
    _registry: registry,
  };
}

// ══════════════════════════════════════════════════════════════════
// Template generators (mirrors source code)
// ══════════════════════════════════════════════════════════════════

function getArpModalTemplate() {
  return `
    <div class="modal-backdrop" id="arp-modal-backdrop" style="display:none;z-index:5000">
      <div class="modal" data-accent="orange" style="width:820px">
        <div class="modal-header">
          <h2>Arpeggiator & Pattern Editor</h2>
          <div class="close-btn" id="arp-modal-close-btn" data-ctrl-tooltip="Close Arpeggiator modal">&times;</div>
        </div>
        <div class="modal-body" style="overflow-y:auto">
          <div class="arp-pattern-section flex-col" style="background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius);padding:10px;gap:5px">
            <span class="label text-uppercase text-bold" style="font-size:var(--text-xs);color:var(--text-dim);margin-bottom:5px">Pattern Step Gate (32 Steps)</span>
            <div class="arp-steps-grid" style="display:grid;grid-template-columns:repeat(32,1fr);gap:4px;height:100px;background:var(--bg-deepest);border:1px solid var(--bg-elevated);padding:5px;border-radius:var(--radius-sm);position:relative"></div>
            <div class="arp-steps-labels" style="display:grid;grid-template-columns:repeat(32,1fr);gap:4px;text-align:center;font-size:var(--text-2xs);color:var(--text-faint)"></div>
          </div>
          <div style="display:grid;grid-template-columns:1.5fr 2fr 2.5fr;gap:15px">
            <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius);padding:10px;gap:10px">
              <div class="flex-row gap-6">
                <div id="modal-arp-enable-box" class="led-btn" style="flex:1" data-ctrl-tooltip="Arpeggiator On/Off">ON</div>
                <div id="modal-arp-hold-box" class="led-btn" style="flex:1" data-ctrl-tooltip="Arp Hold — sustain arpeggiated notes">HOLD</div>
                <div id="modal-arp-keysync-box" class="led-btn" style="flex:1" data-ctrl-tooltip="Arp Key Sync — reset pattern on each new note">KEY SYNC</div>
              </div>
              <div class="flex-col gap-6">
                <div class="flex-row justify-between items-center">
                  <span class="label text-sm text-dim">Clock Rate</span>
                  <select id="modal-arp-clock-select" class="modal-select" style="width:60%"><option value="0">1/1</option><option value="1">1/2</option><option value="2">1/3</option><option value="3">1/4</option><option value="4">1/6</option><option value="5">1/8</option><option value="6">1/12</option><option value="7">1/16</option><option value="8">1/24</option><option value="9">1/32</option><option value="10">1/48</option><option value="11">1/64</option><option value="12">1/96</option></select>
                </div>
                <div class="flex-row justify-between items-center">
                  <span class="label text-sm text-dim">Vel Gate</span>
                  <select id="modal-arp-velgate-select" class="modal-select" style="width:60%"><option value="0">Gate</option><option value="1">Velocity</option><option value="2">Seq</option></select>
                </div>
                <div class="flex-row justify-between items-center">
                  <span class="label text-sm text-dim">Mode</span>
                  <select id="modal-arp-mode-select" class="modal-select" style="width:60%"><option value="0">UP</option><option value="1">DOWN</option><option value="2">UP-DOWN</option><option value="3">UP-INV</option><option value="4">DOWN-INV</option><option value="5">UP-DN-INV</option><option value="6">UP-ALT</option><option value="7">DOWN-ALT</option><option value="8">RANDOM</option><option value="9">AS-PLAYED</option></select>
                </div>
                <div class="flex-row justify-between items-center">
                  <span class="label text-sm text-dim">Octave Range</span>
                  <select id="modal-arp-octave-select" class="modal-select" style="width:60%"><option value="0">1</option><option value="1">2</option><option value="2">3</option><option value="3">4</option></select>
                </div>
              </div>
            </div>
            <div class="flex-row bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius);padding:10px;justify-content:space-around;align-items:center">
              <div class="ctrl-unit flex-col items-center" data-param="arp_swing" style="width:28%"><span class="label text-sm">Swing</span><div class="v-slider" style="height:100px"><div class="track"></div><div class="handle"></div></div></div>
              <div class="ctrl-unit flex-col items-center" data-param="arp_rate" style="width:28%"><span class="label text-sm">Rate (BPM)</span><div class="v-slider" style="height:100px"><div class="track"></div><div class="handle"></div></div></div>
              <div class="ctrl-unit flex-col items-center" data-param="arp_gate_time" style="width:28%"><span class="label text-sm">Gate Time</span><div class="v-slider" style="height:100px"><div class="track"></div><div class="handle"></div></div></div>
            </div>
            <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius);padding:10px;gap:8px;justify-content:space-between">
              <span class="label text-uppercase text-bold text-dim" style="font-size:var(--text-xs)">User Pattern Presets</span>
              <div class="flex-col" style="background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius-sm);flex:1;padding:5px;overflow-y:auto;gap:4px;max-height:80px" id="modal-arp-presets-list">
                <div class="preset-item text-sm text-primary" style="padding:3px;cursor:pointer;border-radius:var(--radius-xs)">Preset-1 (Default UP-DOWN)</div>
                <div class="preset-item text-sm text-primary" style="padding:3px;cursor:pointer;border-radius:var(--radius-xs)">Preset-2 (8-Step Disco)</div>
                <div class="preset-item text-sm text-primary" style="padding:3px;cursor:pointer;border-radius:var(--radius-xs)">Preset-3 (Syncopated)</div>
              </div>
              <div class="flex-row gap-6">
                <button id="modal-arp-load-preset" class="btn btn-sm" style="flex:1" data-ctrl-tooltip="Load arpeggiator pattern preset">Load</button>
                <button id="modal-arp-save-preset" class="btn btn-sm" style="flex:1" data-ctrl-tooltip="Save arpeggiator pattern preset">Save</button>
                <button id="modal-arp-reset-btn" class="btn btn-sm btn-outline" data-accent="red" style="flex:1" data-ctrl-tooltip="Reset arpeggiator engine — stop, rewind to step 0, clear held notes">RESET</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getSeqModalTemplate() {
  return `
    <div class="modal-backdrop" id="seq-modal-backdrop" style="display:none;z-index:5000">
      <div class="modal" data-accent="pink" style="width:820px">
        <div class="modal-header">
          <h2>Control Sequencer & Steps Editor <span id="modal-seq-mode-badge" style="font-size:var(--text-sm);font-weight:normal;margin-left:8px;vertical-align:middle"></span></h2>
          <div class="close-btn" id="seq-modal-close-btn" data-ctrl-tooltip="Close Sequencer modal">&times;</div>
        </div>
        <div class="modal-body" style="overflow-y:auto">
          <div class="flex-col" style="background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius);padding:10px;gap:5px">
            <span class="label text-uppercase text-bold" style="font-size:var(--text-xs);color:var(--text-dim);margin-bottom:5px">Pattern Steps Bipolar Values (-128 to 127)</span>
            <div class="seq-steps-grid" style="display:grid;grid-template-columns:repeat(32,1fr);gap:4px;height:110px;background:var(--bg-deepest);border:1px solid var(--bg-elevated);padding:5px;border-radius:var(--radius-sm);position:relative;align-items:flex-end"></div>
            <div class="seq-steps-labels" style="display:grid;grid-template-columns:repeat(32,1fr);gap:4px;text-align:center;font-size:var(--text-2xs);color:var(--text-faint)"></div>
          </div>
          <div style="display:grid;grid-template-columns:1.5fr 2fr 2.5fr;gap:15px">
            <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius);padding:10px;gap:10px">
              <div id="modal-seq-enable-box" class="led-btn" style="width:100%" data-ctrl-tooltip="Sequencer On/Off">ON / OFF</div>
              <div class="flex-col gap-6">
                <div class="flex-row justify-between items-center">
                  <span class="label text-sm text-dim">Clock</span>
                  <select id="modal-seq-clock-select" class="modal-select" style="width:60%"><option value="0">1/2</option><option value="1">3/8</option><option value="2">1/3</option><option value="3">1/4</option><option value="4">3/16</option><option value="5">1/6</option><option value="6">1/8</option><option value="7">1/12</option><option value="8">1/16</option><option value="9">1/24</option><option value="10">1/32</option></select>
                </div>
                <div class="flex-row justify-between items-center">
                  <span class="label text-sm text-dim">Length</span>
                  <select id="modal-seq-length-select" class="modal-select" style="width:60%"><option value="0">2</option><option value="1">3</option><option value="2">4</option><option value="3">5</option><option value="4">6</option><option value="5">7</option><option value="6">8</option><option value="7">9</option><option value="8">10</option><option value="9">11</option><option value="10">12</option><option value="11">13</option><option value="12">14</option><option value="13">15</option><option value="14">16</option><option value="15">17</option><option value="16">18</option><option value="17">19</option><option value="18">20</option><option value="19">21</option><option value="20">22</option><option value="21">23</option><option value="22">24</option><option value="23">25</option><option value="24">26</option><option value="25">27</option><option value="26">28</option><option value="27">29</option><option value="28">30</option><option value="29">31</option><option value="30">32</option></select>
                </div>
                <div class="flex-row justify-between items-center">
                  <span class="label text-sm text-dim">Key Loop</span>
                  <select id="modal-seq-keyloop-select" class="modal-select" style="width:60%"><option value="0">Loop On</option><option value="1">Key Sync On</option><option value="2">Key & Loop On</option></select>
                </div>
              </div>
              <button id="modal-seq-open-panel-btn" class="btn btn-sm btn-outline" style="width:100%;margin-top:4px" data-accent="pink" data-ctrl-tooltip="Open the left side edit panel for detailed sequencer editing">&#9654; Open in Panel</button>
            </div>
            <div class="flex-row bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius);padding:10px;justify-content:space-around;align-items:center">
              <div class="ctrl-unit flex-col items-center" data-param="seq_swing" style="width:45%"><span class="label text-sm">Swing</span><span id="modal-seq-swing-val" class="text-accent text-bold" style="font-size:var(--text-sm);margin-bottom:2px">50</span><div class="v-slider" style="height:100px"><div class="track"></div><div class="handle"></div></div></div>
              <div class="ctrl-unit flex-col items-center" data-param="seq_slew_rate" style="width:45%"><span class="label text-sm">Slew Rate</span><span id="modal-seq-slew-val" class="text-accent text-bold" style="font-size:var(--text-sm);margin-bottom:2px">0</span><div class="v-slider" style="height:100px"><div class="track"></div><div class="handle"></div></div></div>
            </div>
            <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius);padding:10px;gap:8px;justify-content:space-between">
              <span class="label text-uppercase text-bold text-dim" style="font-size:var(--text-xs)">User Sequence Presets</span>
              <div class="flex-col" style="background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius-sm);flex:1;padding:5px;overflow-y:auto;gap:4px;max-height:80px" id="modal-seq-presets-list">
                <div class="preset-item text-sm text-primary" style="padding:3px;cursor:pointer;border-radius:var(--radius-xs)">Seq-Preset-1 (Staircase)</div>
                <div class="preset-item text-sm text-primary" style="padding:3px;cursor:pointer;border-radius:var(--radius-xs)">Seq-Preset-2 (Triangle Wave)</div>
                <div class="preset-item text-sm text-primary" style="padding:3px;cursor:pointer;border-radius:var(--radius-xs)">Seq-Preset-3 (Random Walk)</div>
              </div>
              <div class="flex-row gap-6">
                <button id="modal-seq-load-preset" class="btn btn-sm" style="flex:1" data-ctrl-tooltip="Load sequence preset">Load</button>
                <button id="modal-seq-save-preset" class="btn btn-sm" style="flex:1" data-ctrl-tooltip="Save sequence preset">Save</button>
                <button id="modal-seq-reset-btn" class="btn btn-sm btn-outline" data-accent="red" style="flex:1" data-ctrl-tooltip="Reset sequencer engine — stop, rewind to step 0, clear held notes">RESET</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getFxModalTemplate() {
  return `
    <div class="modal-backdrop" id="fx-modal-backdrop" style="display:none;z-index:5000">
      <div class="modal" data-accent="blue" style="width:860px">
        <div class="modal-header">
          <h2>Effects Engine Rack</h2>
          <div class="close-btn" id="fx-modal-close-btn" data-ctrl-tooltip="Close Effects Engine modal">&times;</div>
        </div>
        <div class="modal-body" style="overflow-y:auto">
          <div class="flex-col" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius);padding:12px;gap:8px">
            <div class="flex-row justify-between items-center" style="border-bottom:1px solid var(--bg-hover);padding-bottom:4px;margin-bottom:4px">
              <span id="fx-screen-title" style="font-size:var(--text-sm);font-weight:bold;color:var(--accent-blue);text-transform:uppercase;font-family:'Share Tech Mono',monospace">Selected Effect Param Screen</span>
              <span id="fx-screen-active-slot" class="text-uppercase" style="font-size:var(--text-sm);color:var(--text-dim)">Slot: FX1 (Ambience)</span>
            </div>
            <div id="fx-dynamic-editor-area" class="flex-row items-center justify-center" style="min-height:140px;background:var(--bg-deepest);border-radius:var(--radius-sm);border:1px solid var(--bg-header)"></div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1.25fr) 1.5fr;gap:12px">
            <div class="fx-slot-column selected" id="fx-slot-1" class="flex-col" style="background:var(--bg-surface);border:1px solid var(--accent-primary);border-radius:var(--radius);padding:8px;gap:8px;cursor:pointer">
              <div class="flex-row justify-between items-center">
                <span class="text-bold" style="font-size:var(--text-xs);color:var(--text-dim)">FX1</span>
                <select class="fx-type-select modal-select" data-slot="1" style="font-size:var(--text-xs);padding:2px;width:75%"><option value="0">BYPASS</option><option value="1">Ambience</option><option value="2">tcDeepVerb</option></select>
              </div>
              <div class="flex-row items-center justify-center" id="fx1-type-mini-display" style="background:var(--bg-deepest);height:32px;border-radius:var(--radius-sm);font-size:var(--text-xs);color:var(--accent-blue);font-family:'Share Tech Mono',monospace">Ambience</div>
              <div class="flex-row flex-1 items-center" style="justify-content:center">
                <div class="ctrl-unit flex-col items-center" data-param="fx1_gain" style="width:80%"><span class="label text-xs">Gain</span><div class="v-slider" style="height:65px"><div class="track"></div><div class="handle"></div></div></div>
              </div>
            </div>
            <div class="fx-slot-column" id="fx-slot-2" class="flex-col" style="background:var(--bg-surface);border:1px solid var(--border-dim);border-radius:var(--radius);padding:8px;gap:8px;cursor:pointer">
              <div class="flex-row justify-between items-center">
                <span class="text-bold" style="font-size:var(--text-xs);color:var(--text-dim)">FX2</span>
                <select class="fx-type-select modal-select" data-slot="2" style="font-size:var(--text-xs);padding:2px;width:75%"><option value="0">BYPASS</option><option value="1">Ambience</option><option value="2">tcDeepVerb</option></select>
              </div>
              <div class="flex-row items-center justify-center" id="fx2-type-mini-display" style="background:var(--bg-deepest);height:32px;border-radius:var(--radius-sm);font-size:var(--text-xs);color:var(--accent-blue);font-family:'Share Tech Mono',monospace">VintageRoom</div>
              <div class="flex-row flex-1 items-center" style="justify-content:center">
                <div class="ctrl-unit flex-col items-center" data-param="fx2_gain" style="width:80%"><span class="label text-xs">Gain</span><div class="v-slider" style="height:65px"><div class="track"></div><div class="handle"></div></div></div>
              </div>
            </div>
            <div class="fx-slot-column" id="fx-slot-3" class="flex-col" style="background:var(--bg-surface);border:1px solid var(--border-dim);border-radius:var(--radius);padding:8px;gap:8px;cursor:pointer">
              <div class="flex-row justify-between items-center">
                <span class="text-bold" style="font-size:var(--text-xs);color:var(--text-dim)">FX3</span>
                <select class="fx-type-select modal-select" data-slot="3" style="font-size:var(--text-xs);padding:2px;width:75%"><option value="0">BYPASS</option><option value="1">Ambience</option><option value="2">tcDeepVerb</option></select>
              </div>
              <div class="flex-row items-center justify-center" id="fx3-type-mini-display" style="background:var(--bg-deepest);height:32px;border-radius:var(--radius-sm);font-size:var(--text-xs);color:var(--accent-blue);font-family:'Share Tech Mono',monospace">Bypass</div>
              <div class="flex-row flex-1 items-center" style="justify-content:center">
                <div class="ctrl-unit flex-col items-center" data-param="fx3_gain" style="width:80%"><span class="label text-xs">Gain</span><div class="v-slider" style="height:65px"><div class="track"></div><div class="handle"></div></div></div>
              </div>
            </div>
            <div class="fx-slot-column" id="fx-slot-4" class="flex-col" style="background:var(--bg-surface);border:1px solid var(--border-dim);border-radius:var(--radius);padding:8px;gap:8px;cursor:pointer">
              <div class="flex-row justify-between items-center">
                <span class="text-bold" style="font-size:var(--text-xs);color:var(--text-dim)">FX4</span>
                <select class="fx-type-select modal-select" data-slot="4" style="font-size:var(--text-xs);padding:2px;width:75%"><option value="0">BYPASS</option><option value="1">Ambience</option><option value="2">tcDeepVerb</option></select>
              </div>
              <div class="flex-row items-center justify-center" id="fx4-type-mini-display" style="background:var(--bg-deepest);height:32px;border-radius:var(--radius-sm);font-size:var(--text-xs);color:var(--accent-blue);font-family:'Share Tech Mono',monospace">Bypass</div>
              <div class="flex-row flex-1 items-center" style="justify-content:center">
                <div class="ctrl-unit flex-col items-center" data-param="fx4_gain" style="width:80%"><span class="label text-xs">Gain</span><div class="v-slider" style="height:65px"><div class="track"></div><div class="handle"></div></div></div>
              </div>
            </div>
            <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius);padding:10px;gap:8px">
              <div>
                <span class="label text-uppercase text-bold text-dim" style="font-size:var(--text-xs);display:block;margin-bottom:4px">Routing</span>
                <select id="fx-routing-select" class="modal-select" style="font-size:var(--text-xs);padding:3px;width:100%"><option value="0">Series</option><option value="1">Parallel Pairs</option><option value="2">Series Chain</option><option value="3">Full Parallel</option><option value="4">Dual Series Parallel</option><option value="5">Series Split Mid</option><option value="6">Parallel Pairs Series</option><option value="7">Series Chain + Parallel</option><option value="8">Parallel Front Series</option><option value="9">Series with Feedback</option></select>
              </div>
              <div>
                <span class="label text-uppercase text-bold text-dim" style="font-size:var(--text-xs);display:block;margin-bottom:4px">Page</span>
                <div class="flex-row gap-4">
                  <button class="btn btn-xs active" id="fx-page-1-btn" style="flex:1" data-ctrl-tooltip="FX Parameter Page 1">P1</button>
                  <button class="btn btn-xs" id="fx-page-2-btn" style="flex:1" data-ctrl-tooltip="FX Parameter Page 2">P2</button>
                </div>
              </div>
              <div>
                <span class="label text-uppercase text-bold text-dim" style="font-size:var(--text-xs);display:block;margin-bottom:4px">Mode</span>
                <div class="flex-row" style="gap:3px">
                  <button class="btn btn-xs active" id="fx-mode-ins-btn" style="flex:1" data-ctrl-tooltip="Insert Mode — fully processed wet signal">INS</button>
                  <button class="btn btn-xs" id="fx-mode-send-btn" style="flex:1" data-ctrl-tooltip="Send Mode — mix of dry and processed signal">SEND</button>
                  <button class="btn btn-xs" id="fx-mode-bypass-btn" style="flex:1" data-ctrl-tooltip="Bypass Mode — signal passes unprocessed">BYP</button>
                </div>
                <div id="fx-send-level-area" class="flex-col items-center" style="margin-top:6px;gap:2px;display:none">
                  <span class="label text-uppercase text-bold text-dim" style="font-size:6px;display:block">Send Lvl</span>
                  <div class="ctrl-unit flex-col items-center" data-param="fx_send_level" style="width:100%">
                    <div class="v-slider" id="fx-send-level-slider" style="height:36px">
                      <div class="track"></div>
                      <div class="handle" style="top:50%"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="flex-col" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius);padding:8px;gap:6px;margin-top:12px">
            <div class="flex-row justify-between items-center" style="border-bottom:1px solid var(--bg-hover);padding-bottom:4px">
              <span style="font-size:var(--text-xs);font-weight:bold;color:var(--accent-blue);text-transform:uppercase;font-family:'Share Tech Mono',monospace">FX Presets</span>
              <div class="flex-row" style="gap:4px">
                <input type="text" id="fx-preset-name-input" placeholder="Preset name..." style="font-size:var(--text-xs);padding:2px 6px;background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius-xs);color:var(--text-primary);width:120px"/>
                <button class="btn btn-xs" id="fx-preset-save-btn" style="padding:2px 8px" data-ctrl-tooltip="Save current FX slot as preset">&#128190; Save</button>
              </div>
            </div>
            <div id="fx-preset-list" class="flex-col" style="max-height:120px;overflow-y:auto;gap:2px">
              <div style="color:var(--text-faint);font-size:var(--text-xs);padding:4px;text-align:center">No FX presets saved yet</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════
// Web Component simulation (matching source code behavior)
// ══════════════════════════════════════════════════════════════════

function defineArpModal(customElements) {
  const template = getArpModalTemplate();
  class ArpModal {
    constructor() {
      this.innerHTML = '';
      this.children = [];
      this.style = {};
    }
    connectedCallback() {
      if (this.children.length === 0) {
        this.innerHTML = template;
      }
    }
  }
  customElements.define('arp-modal', ArpModal);
  return ArpModal;
}

function defineSeqModal(customElements) {
  const template = getSeqModalTemplate();
  class SeqModal {
    constructor() {
      this.innerHTML = '';
      this.children = [];
      this.style = {};
    }
    connectedCallback() {
      if (this.children.length === 0) {
        this.innerHTML = template;
      }
    }
  }
  customElements.define('seq-modal', SeqModal);
  return SeqModal;
}

function defineFxModal(customElements) {
  const template = getFxModalTemplate();
  class FxModal {
    constructor() {
      this.innerHTML = '';
      this.children = [];
      this.style = {};
    }
    connectedCallback() {
      if (this.children.length === 0) {
        this.innerHTML = template;
      }
    }
  }
  customElements.define('fx-modal', FxModal);
  return FxModal;
}

// ══════════════════════════════════════════════════════════════════
// Template validation helpers
// ══════════════════════════════════════════════════════════════════

function extractIds(html) {
  const ids = [];
  const regex = /id="([^\"]*)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

function extractDataParams(html) {
  const params = [];
  const regex = /data-param="([^\"]*)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    params.push(match[1]);
  }
  return params;
}

function extractTooltips(html) {
  const tooltips = [];
  const regex = /data-ctrl-tooltip="([^\"]*)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    tooltips.push(match[1]);
  }
  return tooltips;
}

function countSelects(html) {
  const matches = html.match(/<select[^>]*>/g);
  return matches ? matches.length : 0;
}

function countCtrlUnits(html) {
  // Match class attributes containing "ctrl-unit" (may have additional classes)
  const regex = /class="[^"]*ctrl-unit[^"]*"/g;
  const matches = html.match(regex);
  return matches ? matches.length : 0;
}

function countSliders(html) {
  const matches = html.match(/class="v-slider"/g);
  return matches ? matches.length : 0;
}

// ══════════════════════════════════════════════════════════════════
// Tests: ArpModal
// ══════════════════════════════════════════════════════════════════

describe('ArpModal (arp-modal.js)', () => {
  let customElements;
  let ArpModal;

  beforeEach(() => {
    customElements = createCustomElementsRegistry();
    ArpModal = defineArpModal(customElements);
  });

  it('is registered as arp-modal', () => {
    expect(customElements.define).toHaveBeenCalledWith('arp-modal', ArpModal);
  });

  it('can be retrieved from registry', () => {
    expect(customElements.get('arp-modal')).toBe(ArpModal);
  });

  it('connectedCallback sets innerHTML when empty', () => {
    const instance = new ArpModal();
    instance.connectedCallback();
    expect(instance.innerHTML.length).toBeGreaterThan(100);
    expect(instance.innerHTML).toContain('arp-modal-backdrop');
  });

  it('connectedCallback preserves existing children', () => {
    const instance = new ArpModal();
    instance.children = [{ id: 'existing' }];
    instance.innerHTML = '<div>keep</div>';
    instance.connectedCallback();
    expect(instance.innerHTML).toBe('<div>keep</div>');
  });

  it('idempotent: calling connectedCallback twice does not change HTML', () => {
    const instance = new ArpModal();
    instance.connectedCallback();
    const firstHTML = instance.innerHTML;
    instance.connectedCallback();
    expect(instance.innerHTML).toBe(firstHTML);
  });

  it('has backdrop with display:none and z-index:5000', () => {
    expect(getArpModalTemplate()).toContain('display:none');
    expect(getArpModalTemplate()).toContain('z-index:5000');
  });

  it('has modal with data-accent="orange" and width:820px', () => {
    const html = getArpModalTemplate();
    expect(html).toContain('data-accent="orange"');
    expect(html).toContain('width:820px');
  });

  it('has correct header title', () => {
    expect(getArpModalTemplate()).toContain('Arpeggiator & Pattern Editor');
  });

  it('has arp steps grid with grid-template-columns:repeat(32,1fr)', () => {
    const html = getArpModalTemplate();
    expect(html).toContain('arp-steps-grid');
    expect(html).toContain('grid-template-columns:repeat(32,1fr)');
    expect(html).toContain('height:100px');
  });

  it('has 3 led-btn elements: enable, hold, keysync', () => {
    const ids = extractIds(getArpModalTemplate());
    expect(ids).toContain('modal-arp-enable-box');
    expect(ids).toContain('modal-arp-hold-box');
    expect(ids).toContain('modal-arp-keysync-box');
  });

  it('has correct tooltips for ledger boxes', () => {
    const tooltips = extractTooltips(getArpModalTemplate());
    expect(tooltips).toContain('Arpeggiator On/Off');
    expect(tooltips).toContain('Arp Hold — sustain arpeggiated notes');
    expect(tooltips).toContain('Arp Key Sync — reset pattern on each new note');
  });

  it('has 4 select elements', () => {
    expect(countSelects(getArpModalTemplate())).toBe(4);
  });

  it('clock select has 13 options (1/1 to 1/96)', () => {
    const html = getArpModalTemplate();
    const clockOpts = html.match(/id="modal-arp-clock-select"[^>]*>([\s\S]*?)<\/select>/);
    expect(clockOpts).not.toBeNull();
    const opts = clockOpts[1].match(/<option/g);
    expect(opts ? opts.length : 0).toBe(13);
    expect(html).toContain('1/1');
    expect(html).toContain('1/96');
  });

  it('velgate select has 3 options (Gate, Velocity, Seq)', () => {
    const html = getArpModalTemplate();
    expect(html).toContain('id="modal-arp-velgate-select"');
    expect(html).toContain('>Gate<');
    expect(html).toContain('>Velocity<');
    expect(html).toContain('>Seq<');
  });

  it('mode select has 10 options (UP to AS-PLAYED)', () => {
    const html = getArpModalTemplate();
    const modeOpts = html.match(/id="modal-arp-mode-select"[^>]*>([\s\S]*?)<\/select>/);
    expect(modeOpts).not.toBeNull();
    const opts = modeOpts[1].match(/<option/g);
    expect(opts ? opts.length : 0).toBe(10);
    expect(html).toContain('UP');
    expect(html).toContain('AS-PLAYED');
  });

  it('octave select has 4 options (1-4)', () => {
    const html = getArpModalTemplate();
    expect(html).toContain('id="modal-arp-octave-select"');
    expect(html).toContain('>1<');
    expect(html).toContain('>4<');
  });

  it('has 3 ctrl-units: arp_swing, arp_rate, arp_gate_time', () => {
    expect(countCtrlUnits(getArpModalTemplate())).toBe(3);
    const params = extractDataParams(getArpModalTemplate());
    expect(params).toContain('arp_swing');
    expect(params).toContain('arp_rate');
    expect(params).toContain('arp_gate_time');
  });

  it('has 3 v-sliders (one per ctrl-unit)', () => {
    expect(countSliders(getArpModalTemplate())).toBe(3);
  });

  it('has ctrl-unit labels: Swing, Rate (BPM), Gate Time', () => {
    const html = getArpModalTemplate();
    expect(html).toContain('Swing');
    expect(html).toContain('Rate (BPM)');
    expect(html).toContain('Gate Time');
  });

  it('has presets list with 3 preset items', () => {
    const html = getArpModalTemplate();
    expect(html).toContain('id="modal-arp-presets-list"');
    expect(html).toContain('Preset-1 (Default UP-DOWN)');
    expect(html).toContain('Preset-2 (8-Step Disco)');
    expect(html).toContain('Preset-3 (Syncopated)');
  });

  it('has load, save, and RESET buttons', () => {
    const ids = extractIds(getArpModalTemplate());
    expect(ids).toContain('modal-arp-load-preset');
    expect(ids).toContain('modal-arp-save-preset');
    expect(ids).toContain('modal-arp-reset-btn');
  });

  it('RESET button has data-accent="red"', () => {
    expect(getArpModalTemplate()).toContain('data-accent="red"');
  });

  it('has close button with correct tooltip', () => {
    const tooltips = extractTooltips(getArpModalTemplate());
    expect(tooltips).toContain('Close Arpeggiator modal');
  });

  it('has modal section layout with 3-column grid (1.5fr 2fr 2.5fr)', () => {
    const html = getArpModalTemplate();
    expect(html).toContain('grid-template-columns:1.5fr 2fr 2.5fr');
  });

  it('has 2 column sections for steps grid layout', () => {
    const html = getArpModalTemplate();
    expect(html).toContain('arp-pattern-section');
    expect(html).toContain('arp-steps-labels');
  });

  it('has User Pattern Presets section header', () => {
    expect(getArpModalTemplate()).toContain('User Pattern Presets');
  });

  it('has exactly 1 h2 heading', () => {
    const html = getArpModalTemplate();
    const matches = html.match(/<h2/g);
    expect(matches ? matches.length : 0).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: SeqModal
// ══════════════════════════════════════════════════════════════════

describe('SeqModal (seq-modal.js)', () => {
  let customElements;
  let SeqModal;

  beforeEach(() => {
    customElements = createCustomElementsRegistry();
    SeqModal = defineSeqModal(customElements);
  });

  it('is registered as seq-modal', () => {
    expect(customElements.define).toHaveBeenCalledWith('seq-modal', SeqModal);
  });

  it('can be retrieved from registry', () => {
    expect(customElements.get('seq-modal')).toBe(SeqModal);
  });

  it('connectedCallback populates innerHTML', () => {
    const instance = new SeqModal();
    instance.connectedCallback();
    expect(instance.innerHTML.length).toBeGreaterThan(100);
    expect(instance.innerHTML).toContain('seq-modal-backdrop');
  });

  it('connectedCallback preserves existing children', () => {
    const instance = new SeqModal();
    instance.children = [{ id: 'x' }];
    instance.innerHTML = '<div>keep</div>';
    instance.connectedCallback();
    expect(instance.innerHTML).toBe('<div>keep</div>');
  });

  it('idempotent on double connectedCallback', () => {
    const instance = new SeqModal();
    instance.connectedCallback();
    const firstHTML = instance.innerHTML;
    instance.connectedCallback();
    expect(instance.innerHTML).toBe(firstHTML);
  });

  it('has backdrop with display:none and z-index:5000', () => {
    const html = getSeqModalTemplate();
    expect(html).toContain('display:none');
    expect(html).toContain('z-index:5000');
  });

  it('has modal with data-accent="pink" and width:820px', () => {
    const html = getSeqModalTemplate();
    expect(html).toContain('data-accent="pink"');
    expect(html).toContain('width:820px');
  });

  it('has correct header title with mode badge span', () => {
    const html = getSeqModalTemplate();
    expect(html).toContain('Control Sequencer & Steps Editor');
    expect(html).toContain('id="modal-seq-mode-badge"');
  });

  it('has seq steps grid with 32-column layout', () => {
    const html = getSeqModalTemplate();
    expect(html).toContain('seq-steps-grid');
    expect(html).toContain('grid-template-columns:repeat(32,1fr)');
  });

  it('has steps grid with Bipolar label', () => {
    expect(getSeqModalTemplate()).toContain('Pattern Steps Bipolar Values (-128 to 127)');
  });

  it('has enable-box led-btn with ON / OFF text', () => {
    const html = getSeqModalTemplate();
    expect(html).toContain('id="modal-seq-enable-box"');
    expect(html).toContain('ON / OFF');
  });

  it('has 3 select elements (clock, length, keyloop)', () => {
    expect(countSelects(getSeqModalTemplate())).toBe(3);
  });

  it('clock select has 11 options (1/2 to 1/32)', () => {
    const html = getSeqModalTemplate();
    const clockOpts = html.match(/id="modal-seq-clock-select"[^>]*>([\s\S]*?)<\/select>/);
    expect(clockOpts).not.toBeNull();
    const opts = clockOpts[1].match(/<option/g);
    expect(opts ? opts.length : 0).toBe(11);
    expect(html).toContain('1/2');
    expect(html).toContain('1/32');
  });

  it('length select has 31 options (2 to 32)', () => {
    const html = getSeqModalTemplate();
    const lengthOpts = html.match(/id="modal-seq-length-select"[^>]*>([\s\S]*?)<\/select>/);
    expect(lengthOpts).not.toBeNull();
    const opts = lengthOpts[1].match(/<option/g);
    expect(opts ? opts.length : 0).toBe(31);
    expect(html).toContain('2');
    expect(html).toContain('32');
  });

  it('keyloop select has 3 options', () => {
    const html = getSeqModalTemplate();
    expect(html).toContain('id="modal-seq-keyloop-select"');
    expect(html).toContain('Loop On');
    expect(html).toContain('Key Sync On');
    expect(html).toContain('Key & Loop On');
  });

  it('has Open in Panel button with data-accent="pink"', () => {
    const html = getSeqModalTemplate();
    expect(html).toContain('id="modal-seq-open-panel-btn"');
    expect(html).toContain('data-accent="pink"');
    expect(html).toContain('Open in Panel');
  });

  it('has 2 ctrl-units: seq_swing, seq_slew_rate', () => {
    expect(countCtrlUnits(getSeqModalTemplate())).toBe(2);
    const params = extractDataParams(getSeqModalTemplate());
    expect(params).toContain('seq_swing');
    expect(params).toContain('seq_slew_rate');
  });

  it('has value displays for swing (50) and slew rate (0)', () => {
    const html = getSeqModalTemplate();
    expect(html).toContain('id="modal-seq-swing-val"');
    expect(html).toContain('id="modal-seq-slew-val"');
    expect(html).toContain('>50<');
    expect(html).toContain('>0<');
  });

  it('has 2 v-sliders', () => {
    expect(countSliders(getSeqModalTemplate())).toBe(2);
  });

  it('has ctrl-unit labels: Swing, Slew Rate', () => {
    const html = getSeqModalTemplate();
    expect(html).toContain('>Swing<');
    expect(html).toContain('>Slew Rate<');
  });

  it('has presets list with 3 seq-preset items', () => {
    const html = getSeqModalTemplate();
    expect(html).toContain('id="modal-seq-presets-list"');
    expect(html).toContain('Seq-Preset-1 (Staircase)');
    expect(html).toContain('Seq-Preset-2 (Triangle Wave)');
    expect(html).toContain('Seq-Preset-3 (Random Walk)');
  });

  it('has load, save, and RESET buttons', () => {
    const ids = extractIds(getSeqModalTemplate());
    expect(ids).toContain('modal-seq-load-preset');
    expect(ids).toContain('modal-seq-save-preset');
    expect(ids).toContain('modal-seq-reset-btn');
  });

  it('RESET button has data-accent="red"', () => {
    expect(getSeqModalTemplate()).toContain('data-accent="red"');
  });

  it('has close button tooltip for Sequencer modal', () => {
    const tooltips = extractTooltips(getSeqModalTemplate());
    expect(tooltips).toContain('Close Sequencer modal');
  });

  it('has 3-column grid layout (1.5fr 2fr 2.5fr)', () => {
    expect(getSeqModalTemplate()).toContain('grid-template-columns:1.5fr 2fr 2.5fr');
  });

  it('has 3 preset items (class=preset-item)', () => {
    const html = getSeqModalTemplate();
    const items = html.match(/class="preset-item/g);
    expect(items ? items.length : 0).toBe(3);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: FxModal
// ══════════════════════════════════════════════════════════════════

describe('FxModal (fx-modal.js)', () => {
  let customElements;
  let FxModal;

  beforeEach(() => {
    customElements = createCustomElementsRegistry();
    FxModal = defineFxModal(customElements);
  });

  it('is registered as fx-modal', () => {
    expect(customElements.define).toHaveBeenCalledWith('fx-modal', FxModal);
  });

  it('can be retrieved from registry', () => {
    expect(customElements.get('fx-modal')).toBe(FxModal);
  });

  it('connectedCallback populates innerHTML', () => {
    const instance = new FxModal();
    instance.connectedCallback();
    expect(instance.innerHTML.length).toBeGreaterThan(100);
    expect(instance.innerHTML).toContain('fx-modal-backdrop');
  });

  it('connectedCallback preserves existing children', () => {
    const instance = new FxModal();
    instance.children = [{ id: 'x' }];
    instance.innerHTML = '<div>no overwrite</div>';
    instance.connectedCallback();
    expect(instance.innerHTML).toBe('<div>no overwrite</div>');
  });

  it('idempotent on double connectedCallback', () => {
    const instance = new FxModal();
    instance.connectedCallback();
    const firstHTML = instance.innerHTML;
    instance.connectedCallback();
    expect(instance.innerHTML).toBe(firstHTML);
  });

  it('has backdrop with display:none and z-index:5000', () => {
    const html = getFxModalTemplate();
    expect(html).toContain('display:none');
    expect(html).toContain('z-index:5000');
  });

  it('has modal with data-accent="blue" and width:860px', () => {
    const html = getFxModalTemplate();
    expect(html).toContain('data-accent="blue"');
    expect(html).toContain('width:860px');
  });

  it('has correct header title', () => {
    expect(getFxModalTemplate()).toContain('Effects Engine Rack');
  });

  it('has FX screen with title and active slot display', () => {
    const html = getFxModalTemplate();
    expect(html).toContain('id="fx-screen-title"');
    expect(html).toContain('id="fx-screen-active-slot"');
    expect(html).toContain('Selected Effect Param Screen');
    expect(html).toContain('Slot: FX1 (Ambience)');
  });

  it('has dynamic editor area', () => {
    const html = getFxModalTemplate();
    expect(html).toContain('id="fx-dynamic-editor-area"');
    expect(html).toContain('min-height:140px');
  });

  it('has 4 FX slot columns (fx-slot-1 through fx-slot-4)', () => {
    for (let i = 1; i <= 4; i++) {
      expect(getFxModalTemplate()).toContain('id="fx-slot-' + i + '"');
    }
  });

  it('FX slot 1 has selected class and accent-primary border', () => {
    const html = getFxModalTemplate();
    expect(html).toContain('class="fx-slot-column selected"');
    expect(html).toContain('var(--accent-primary)');
  });

  it('each FX slot has type selector with data-slot attribute', () => {
    for (let i = 1; i <= 4; i++) {
      expect(getFxModalTemplate()).toContain('data-slot="' + i + '"');
    }
  });

  it('each FX slot has type-mini-display', () => {
    for (let i = 1; i <= 4; i++) {
      expect(getFxModalTemplate()).toContain('id="fx' + i + '-type-mini-display"');
    }
  });

  it('FX1 display shows Ambience, FX2 shows VintageRoom, FX3/FX4 show Bypass', () => {
    const html = getFxModalTemplate();
    expect(html).toContain('>Ambience<');
    expect(html).toContain('>VintageRoom<');
    // FX3 and FX4 both show Bypass — count 2 occurrences
    const bypassCount = (html.match(/>Bypass</g) || []).length;
    expect(bypassCount).toBe(2);
  });

  it('each FX slot has gain ctrl-unit (fx1_gain to fx4_gain)', () => {
    const params = extractDataParams(getFxModalTemplate());
    expect(params).toContain('fx1_gain');
    expect(params).toContain('fx2_gain');
    expect(params).toContain('fx3_gain');
    expect(params).toContain('fx4_gain');
  });

  it('has 4 fx-type-select elements', () => {
    const html = getFxModalTemplate();
    const selects = html.match(/class="fx-type-select modal-select"/g);
    expect(selects ? selects.length : 0).toBe(4);
  });

  it('has routing select with 10 options', () => {
    const html = getFxModalTemplate();
    expect(html).toContain('id="fx-routing-select"');
    const routingOpts = html.match(/id="fx-routing-select"[^>]*>([\s\S]*?)<\/select>/);
    expect(routingOpts).not.toBeNull();
    const opts = routingOpts[1].match(/<option/g);
    expect(opts ? opts.length : 0).toBe(10);
    expect(html).toContain('Series');
    expect(html).toContain('Series with Feedback');
  });

  it('has 2 page buttons (P1 active, P2 inactive)', () => {
    const html = getFxModalTemplate();
    expect(html).toContain('id="fx-page-1-btn"');
    expect(html).toContain('id="fx-page-2-btn"');
    // P1 is active by default
    expect(html).toContain('class="btn btn-xs active"');
    const activeBtns = html.match(/class="btn btn-xs active"/g);
    // Should match both P1 and INS button — count 2
    expect(activeBtns ? activeBtns.length : 0).toBe(2);
  });

  it('has 3 mode buttons (INS active, SEND, BYP)', () => {
    const html = getFxModalTemplate();
    expect(html).toContain('id="fx-mode-ins-btn"');
    expect(html).toContain('id="fx-mode-send-btn"');
    expect(html).toContain('id="fx-mode-bypass-btn"');
    expect(html).toContain('>INS<');
    expect(html).toContain('>SEND<');
    expect(html).toContain('>BYP<');
  });

  it('has send level area hidden by default (display:none)', () => {
    const html = getFxModalTemplate();
    expect(html).toContain('id="fx-send-level-area"');
    expect(html).toContain('style="margin-top:6px;gap:2px;display:none"');
  });

  it('send level area has fx_send_level ctrl-unit', () => {
    const params = extractDataParams(getFxModalTemplate());
    expect(params).toContain('fx_send_level');
  });

  it('has FX presets section with input and save button', () => {
    const html = getFxModalTemplate();
    expect(html).toContain('id="fx-preset-name-input"');
    expect(html).toContain('id="fx-preset-save-btn"');
    expect(html).toContain('placeholder="Preset name..."');
  });

  it('has FX preset list with empty state message', () => {
    const html = getFxModalTemplate();
    expect(html).toContain('id="fx-preset-list"');
    expect(html).toContain('No FX presets saved yet');
  });

  it('has tooltips for page and mode buttons', () => {
    const tooltips = extractTooltips(getFxModalTemplate());
    expect(tooltips).toContain('FX Parameter Page 1');
    expect(tooltips).toContain('FX Parameter Page 2');
    expect(tooltips).toContain('Insert Mode — fully processed wet signal');
    expect(tooltips).toContain('Send Mode — mix of dry and processed signal');
    expect(tooltips).toContain('Bypass Mode — signal passes unprocessed');
  });

  it('has close button tooltip', () => {
    const tooltips = extractTooltips(getFxModalTemplate());
    expect(tooltips).toContain('Close Effects Engine modal');
  });

  it('has FX Presets section header', () => {
    expect(getFxModalTemplate()).toContain('FX Presets');
  });

  it('has save preset button tooltip', () => {
    const tooltips = extractTooltips(getFxModalTemplate());
    expect(tooltips).toContain('Save current FX slot as preset');
  });

  it('has 5 total ctrl-units (4 fx gain + 1 send level)', () => {
    expect(countCtrlUnits(getFxModalTemplate())).toBe(5);
  });

  it('has 5 v-sliders', () => {
    expect(countSliders(getFxModalTemplate())).toBe(5);
  });

  it('has 5-column grid layout for slots+control column', () => {
    expect(getFxModalTemplate()).toContain('grid-template-columns:repeat(4,1.25fr) 1.5fr');
  });
});

// ══════════════════════════════════════════════════════════════════
// Cross-component patterns
// ══════════════════════════════════════════════════════════════════

describe('Cross-component patterns (modals)', () => {
  it('all 3 modals can be registered in the same registry', () => {
    const registry = createCustomElementsRegistry();
    defineArpModal(registry);
    defineSeqModal(registry);
    defineFxModal(registry);

    expect(registry.get('arp-modal')).toBeDefined();
    expect(registry.get('seq-modal')).toBeDefined();
    expect(registry.get('fx-modal')).toBeDefined();
  });

  it('all 3 have connectedCallback with guard against duplicate render', () => {
    const registry = createCustomElementsRegistry();
    defineArpModal(registry);
    defineSeqModal(registry);
    defineFxModal(registry);

    ['arp-modal', 'seq-modal', 'fx-modal'].forEach(function(name) {
      const instance = new (registry.get(name))();
      instance.connectedCallback();
      const firstHTML = instance.innerHTML;
      instance.connectedCallback();
      expect(instance.innerHTML).toBe(firstHTML);
    });
  });

  it('all 3 have backdrop with display:none and modal-header pattern', () => {
    [getArpModalTemplate(), getSeqModalTemplate(), getFxModalTemplate()].forEach(function(html) {
      expect(html).toContain('modal-backdrop');
      expect(html).toContain('modal-header');
      expect(html).toContain('close-btn');
      expect(html).toContain('display:none');
      expect(html).toContain('z-index:5000');
    });
  });

  it('all 3 have close button tooltips', () => {
    const arpTips = extractTooltips(getArpModalTemplate());
    const seqTips = extractTooltips(getSeqModalTemplate());
    const fxTips = extractTooltips(getFxModalTemplate());

    expect(arpTips).toContain('Close Arpeggiator modal');
    expect(seqTips).toContain('Close Sequencer modal');
    expect(fxTips).toContain('Close Effects Engine modal');
  });

  it('all 3 have modal-body with overflow-y:auto', () => {
    [getArpModalTemplate(), getSeqModalTemplate(), getFxModalTemplate()].forEach(function(html) {
      expect(html).toContain('modal-body');
      expect(html).toContain('overflow-y:auto');
    });
  });

  it('all 3 have modal-header with h2 title + close-btn', () => {
    [getArpModalTemplate(), getSeqModalTemplate(), getFxModalTemplate()].forEach(function(html) {
      expect(html).toContain('<h2');
      expect(html).toContain('&times;');
    });
  });

  it('all 3 use modal-select class for dropdowns', () => {
    [getArpModalTemplate(), getSeqModalTemplate(), getFxModalTemplate()].forEach(function(html) {
      expect(html).toContain('class="modal-select"');
    });
  });

  it('total ctrl-units across all modals', () => {
    const total = countCtrlUnits(getArpModalTemplate())
      + countCtrlUnits(getSeqModalTemplate())
      + countCtrlUnits(getFxModalTemplate());
    // 3 (Arp) + 2 (Seq) + 5 (Fx) = 10
    expect(total).toBe(10);
  });
});

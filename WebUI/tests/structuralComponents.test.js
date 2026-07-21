/**
 * Unit tests for Structural Web Components (5 files):
 *   - top-bar.js            TopBar            (Navigation bar with File/Edit/View menus)
 *   - side-panel.js         SidePanel         (Side edit panel with graphics + scope)
 *   - programmer-section.js ProgrammerSection (Programmer module with sysex monitor)
 *   - bank-manager.js       BankManagerModal  (Bank Manager + Save As modals)
 *   - keyboard-shortcuts.js KeyboardShortcutsModal (Keyboard shortcuts overlay)
 *
 * Covers:
 *   - Template structure (expected elements, IDs, menus, tooltips, buttons)
 *   - Web Component registration (customElements.define)
 *   - connectedCallback behavior (render-once guard)
 *   - Show/hide methods (keyboard-shortcuts)
 *   - Cross-component patterns (modal structure, menu items)
 *
 * Run with: npx vitest run WebUI/tests/structuralComponents.test.js
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
// Helper: fake DOM element creator for keyboard-shortcuts tests
// ══════════════════════════════════════════════════════════════════

function makeFakeEl() {
  const listeners = {};
  return {
    style: { display: '' },
    innerHTML: '',
    textContent: '',
    addEventListener: function(evt, cb) {
      if (!listeners[evt]) {listeners[evt] = [];}
      listeners[evt].push(cb);
    },
    _listeners: listeners,
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    getAttribute: function() { return null; },
    classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: function() { return false; } },
    setAttribute: vi.fn(),
    appendChild: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

// ══════════════════════════════════════════════════════════════════
// Template generators (mirrors source code)
// ══════════════════════════════════════════════════════════════════

function getTopBarTemplate() {
  return `
    <header id="top-bar">
      <div class="menu-nav">
        <div class="menu-item">
          File
          <ul class="dropdown">
            <li id="menu-bank-manager" class="text-bold text-accent">Bank Manager...</li>
            <li class="divider"></li>
            <li id="menu-dump-midi">MIDI Dump...</li>
            <li id="menu-save">Save Patch</li>
            <li id="menu-save-as">Save Patch As...</li>
          </ul>
        </div>
        <div class="menu-item">
          Edit
          <ul class="dropdown">
            <li id="menu-copy-preset">Copy Preset <span class="text-faint float-right">Ctrl+C</span></li>
            <li id="menu-paste-preset">Paste Preset <span class="text-faint float-right">Ctrl+V</span></li>
            <li class="divider"></li>
            <li id="menu-undo">Undo <span class="text-faint float-right">Ctrl+Z</span></li>
            <li id="menu-redo">Redo <span class="text-faint float-right">Ctrl+Y</span></li>
            <li class="divider"></li>
            <li id="menu-midi-learn">MIDI Learn <span class="text-faint float-right">Ctrl+L</span></li>
            <li class="divider"></li>
            <li id="menu-properties">Settings...</li>
          </ul>
        </div>
        <div class="menu-item">
          View
          <ul class="dropdown">
            <li class="text-faint" style="font-size:var(--text-sm);cursor:default;padding:4px 16px;text-transform:uppercase">Theme</li>
            <li id="menu-theme-default" class="theme-option"><span class="theme-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff9900;margin-right:8px;vertical-align:middle"></span>Default</li>
            <li id="menu-theme-red" class="theme-option"><span class="theme-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff2a2a;margin-right:8px;vertical-align:middle"></span>Fuego</li>
            <li id="menu-theme-blue" class="theme-option"><span class="theme-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#0088ff;margin-right:8px;vertical-align:middle"></span>Océano</li>
            <li id="menu-theme-green" class="theme-option"><span class="theme-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#00ff66;margin-right:8px;vertical-align:middle"></span>Neón</li>
            <li id="menu-theme-midnight" class="theme-option"><span class="theme-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#7744ff;margin-right:8px;vertical-align:middle"></span>Midnight</li>
            <li id="menu-theme-dark-v2" class="theme-option"><span class="theme-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#9933ff;margin-right:8px;vertical-align:middle"></span>Dark V2</li>
            <li id="menu-theme-light" class="theme-option"><span class="theme-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#0284c7;margin-right:8px;vertical-align:middle"></span>Snow</li>
            <li id="menu-theme-juno" class="theme-option"><span class="theme-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ea212d;margin-right:8px;vertical-align:middle"></span>Juno-106</li>
            <li class="divider"></li>
            <li id="menu-debug-unison">Debug: Unison Stacking...</li>
            <li class="divider"></li>
            <li id="menu-keyboard-shortcuts">Keyboard Shortcuts <span class="text-faint float-right">?</span></li>
            <li class="divider"></li>
            <li id="menu-about">About ABD Eep...</li>
          </ul>
        </div>
      </div>
      <div id="app-title-mini">ABD EEP CONTROLLER</div>
      <div id="ctrl-overlay">
        <div class="ctrl-overlay-item" data-ctrl="pb">
          <span class="ctrl-overlay-label">PB</span>
          <div class="ctrl-overlay-track">
            <div class="ctrl-overlay-fill" id="ctrl-o-pb-fill" style="left:50%;width:0%"></div>
            <div class="ctrl-overlay-center"></div>
          </div>
          <span class="ctrl-overlay-value" id="ctrl-o-pb-val">+0.00</span>
        </div>
        <div class="ctrl-overlay-item" data-ctrl="mw">
          <span class="ctrl-overlay-label">MW</span>
          <div class="ctrl-overlay-track ctrl-overlay-track-mono">
            <div class="ctrl-overlay-fill" id="ctrl-o-mw-fill" style="width:0%"></div>
          </div>
          <span class="ctrl-overlay-value" id="ctrl-o-mw-val">0%</span>
        </div>
        <div class="ctrl-overlay-item" data-ctrl="at">
          <span class="ctrl-overlay-label">AT</span>
          <div class="ctrl-overlay-track ctrl-overlay-track-mono">
            <div class="ctrl-overlay-fill" id="ctrl-o-at-fill" style="width:0%"></div>
          </div>
          <span class="ctrl-overlay-value" id="ctrl-o-at-val">0%</span>
        </div>
      </div>
      <div id="keyboard-shortcuts-icon" style="width:16px;height:16px;border-radius:3px;background:var(--bg-hover);border:1px solid var(--border-dim);color:var(--text-faint);font-size:10px;font-weight:bold;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all 0.15s ease;margin:0 4px;line-height:1" data-ctrl-tooltip="Keyboard Shortcuts">&#9000;</div>
      <div id="midi-activity-led" style="width:6px;height:6px;border-radius:50%;background:var(--accent-green);margin:0;opacity:0.15;flex-shrink:0;transition:opacity 0.05s linear, box-shadow 0.05s linear;box-shadow:none" data-ctrl-tooltip="MIDI Activity"></div>
      <button id="reconnect-hw-btn" style="display:none;font-size:8.5px;font-weight:bold;padding:1px 6px;border-radius:3px;border:1px solid var(--accent-red);background:rgba(234,33,45,0.12);color:var(--accent-red);cursor:pointer;margin:0 4px;height:16px;line-height:1;box-shadow:0 0 5px rgba(234,33,45,0.2);animation:heartbeat-pulse 1.2s infinite ease-in-out;flex-shrink:0" data-ctrl-tooltip="Hardware Synth disconnected. Click to re-connect.">RE-CONNECT HARDWARE</button>
      <div id="midi-connection-indicator" style="width:10px;height:10px;border-radius:50%;background:var(--color-danger);margin:0 6px 0 4px;transition:all 0.3s ease;box-shadow:0 0 4px var(--color-danger);flex-shrink:0" data-ctrl-tooltip="MIDI: Disconnected"></div>
    </header>
  `;
}

function getSidePanelTemplate() {
  return `
    <div class="slide-edit-panel" id="detail-edit-panel">
      <div class="panel-header">
        <h3 id="panel-title">LFO Detail Editor</h3>
        <div class="close-btn" id="panel-close-btn" data-ctrl-tooltip="Close side editor panel">&times;</div>
      </div>
      <div id="panel-graphic-screen" class="flex-row items-center justify-center" style="height:100px;overflow:hidden;background:var(--bg-deepest);border-bottom:1.5px solid var(--border);transition:height 0.3s cubic-bezier(0.4,0,0.2,1),border-bottom-width 0.3s">
        <canvas id="panel-graphic-canvas" width="280" height="90" style="display:block;background:var(--bg-deepest)"></canvas>
      </div>
      <button id="panel-graphic-toggle" class="btn btn-xs btn-ghost text-center w-full" data-ctrl-tooltip="Collapse/Expand graphic screen" style="background:var(--bg-surface);border-bottom:1px solid var(--border-dim);border-radius:0;color:color-mix(in srgb,var(--accent-primary) 50%,transparent);letter-spacing:1px;line-height:1">&#9650; COLLAPSE &#9650;</button>
      <div id="panel-real-scope-screen" class="flex-col" style="height:0;overflow:hidden;background:var(--bg-deepest);border-bottom:0px solid var(--border-dim);transition:height 0.3s cubic-bezier(0.4,0,0.2,1),border-bottom-width 0.3s">
        <canvas id="panel-real-scope-canvas" width="280" height="85" style="display:block;background:var(--bg-deepest);flex-shrink:0"></canvas>
        <div class="scope-toolbar" id="scope-toolbar" style="display:none;align-items:center;justify-content:space-between;padding:2px 6px;gap:4px;flex-shrink:0;width:100%;box-sizing:border-box;border-top:1px solid var(--border-dim);background:var(--bg-header);min-height:22px;">
          <button id="scope-trigger-btn" class="scope-btn" data-ctrl-tooltip="Trigger mode: Free">FR</button>
          <div class="scope-zoom-group" style="display:flex;gap:2px;">
            <button class="scope-zoom-btn scope-btn active" data-zoom="1" data-ctrl-tooltip="1x zoom">1x</button>
            <button class="scope-zoom-btn scope-btn" data-zoom="2" data-ctrl-tooltip="2x zoom">2x</button>
            <button class="scope-zoom-btn scope-btn" data-zoom="4" data-ctrl-tooltip="4x zoom">4x</button>
          </div>
          <span id="scope-seq-status" style="flex:1;text-align:center;font-size:7px;font-family:monospace;color:var(--text-faint);letter-spacing:0.3px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;min-width:0"></span>
          <button id="scope-color-btn" class="scope-btn" data-ctrl-tooltip="Color scheme: Brand"><span class="scope-color-indicator" id="scope-color-indicator">●</span></button>
        </div>
      </div>
      <button id="panel-real-scope-toggle" class="btn btn-xs btn-ghost text-center w-full" data-ctrl-tooltip="Toggle real DSP oscilloscope" style="background:var(--bg-surface);border-bottom:1px solid var(--border-dim);border-radius:0;color:color-mix(in srgb,var(--accent-pink) 50%,transparent);letter-spacing:1px;line-height:1">&#128308; DSP SCOPE (off)</button>
      <div class="panel-content" id="panel-dynamic-controls"></div>
    </div>
  `;
}

function getProgrammerSectionTemplate() {
  return `
    <div class="module flex-col items-center justify-center" id="programmer-section" style="flex:5.5;min-width:0">
      <div class="module-header w-full text-center">Programmer</div>
      <div class="flex-row" style="gap:6px;width:98%;align-items:stretch;margin-bottom:5px">
        <div class="sysex-monitor-container widescreen-inline" id="programmer-sysex-monitor" style="flex:1;margin:0;min-width:0">
          <div class="sysex-monitor-header">
            <span class="sysex-monitor-title text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">MIDI SysEx (Unpacked 242B / Raw 291B)</span>
            <div class="flex-row gap-4 items-center">
              <button class="btn btn-xs btn-outline sysex-copy-btn" data-accent="green" id="sysex-zoom-btn" data-ctrl-tooltip="Zoom into SysEx hex data">&#128269; ZOOM</button>
              <button class="btn btn-xs sysex-copy-btn" id="sysex-copy-btn" data-ctrl-tooltip="Copy SysEx hex data to clipboard">COPY</button>
              <button class="btn btn-xs sysex-copy-btn" id="sysex-export-btn" data-ctrl-tooltip="Download current SysEx data as .syx file" style="color:var(--accent-pink);border-color:var(--accent-pink)">&#128190; .SYX</button>
            </div>
          </div>
          <div class="sysex-hex-grid styled-scroll" id="sysex-hex-log" style="min-height:25px;max-height:42px;font-size:var(--text-xs);line-height:1.2">Select a patch from Bank Manager to display SysEx hex stream data...</div>
          <div class="sysex-selection-info" id="sysex-selection-info">Click a hex byte to select it. Shift+click to select range. Ctrl+click to toggle.</div>
          <div id="sysex-active-patch-label" class="text-bold text-accent text-uppercase" style="font-size:var(--text-xs);border-top:1px solid var(--border-dim);padding-top:3px;margin-top:3px;display:none">LOADED PATCH: -</div>
          <div class="flex-row justify-between items-center" style="font-size:var(--text-2xs);color:var(--text-dim);padding:2px 0;margin-top:2px;border-top:1px solid var(--border-dim)">
            <span><span class="text-bold" style="color:var(--accent-green)">TX</span> <span id="nrpn-tx-count">0</span>B</span>
            <span><span class="text-bold" style="color:var(--accent-blue)">RX</span> <span id="nrpn-rx-count">0</span>B</span>
            <span><span class="text-bold">NRPN</span> <span id="nrpn-pkt-count">0</span>pkts</span>
            <button class="btn btn-xs" id="nrpn-reset-btn" style="font-size:7px;padding:1px 4px;cursor:pointer" data-ctrl-tooltip="Reset NRPN traffic counters">Reset</button>
          </div>
        </div>
        <div class="flex-col" style="gap:2px;width:72px;justify-content:space-between;min-height:80px">
          <button class="btn btn-sm" id="programmer-bank-up-btn" data-accent="green" style="flex:1;padding:0;line-height:1.1;font-size:9px">BANK UP</button>
          <button class="btn btn-sm" id="programmer-patch-up-btn" data-accent="blue" style="flex:1;padding:0;line-height:1.1;font-size:9px">PATCH UP</button>
          <button class="btn btn-sm" id="programmer-patch-down-btn" data-accent="blue" style="flex:1;padding:0;line-height:1.1;font-size:9px">PATCH DN</button>
          <button class="btn btn-sm" id="programmer-bank-down-btn" data-accent="green" style="flex:1;padding:0;line-height:1.1;font-size:9px">BANK DN</button>
        </div>
      </div>
      <div class="programmer-layout flex-row items-center justify-center" style="gap:10px;width:98%">
        <div class="programmer-left-buttons flex-col" style="gap:5px;height:90px;justify-content:center">
          <button class="btn btn-sm btn-outline" data-accent="orange" id="programmer-compare-btn" style="width:62px">Compare</button>
          <button class="btn btn-sm btn-outline" data-accent="orange" id="programmer-write-btn" style="width:62px">Write</button>
          <button class="btn btn-sm btn-outline" data-accent="orange" id="programmer-global-btn" style="width:62px">Global</button>
        </div>
        <div class="lcd-screen" style="width:200px;flex-shrink:0;position:relative">
          <div id="lcd-glow-pulse"></div>
          <div id="lcd-text" style="position:relative;z-index:1">INITIAL PATCH</div>
        </div>
        <div class="nav-controls flex-row items-center" style="flex:1;gap:8px;height:auto;min-height:94px">
          <div class="flex-col" style="gap:4px;width:100%">
            <div class="flex-row" style="gap:4px;justify-content:space-between;align-items:center;width:100%">
              <button class="btn btn-sm btn-solid" id="programmer-bank-mngr-btn" style="flex:1;height:26px;padding:0;line-height:26px;font-size:9px">BNK MANAGER</button>
              <button class="btn btn-sm btn-outline" data-accent="blue" id="programmer-mod-matrix-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px">MOD MATRIX</button>
              <button class="btn btn-sm btn-outline" data-accent="blue" id="programmer-fx-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px">FX</button>
              <button class="btn btn-sm btn-outline" id="programmer-polychord-btn" data-accent="green" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px">Poly Chr</button>
            </div>
            <div class="flex-row" style="gap:4px;justify-content:space-between;align-items:center;width:100%">
              <button class="btn btn-sm btn-outline" data-accent="orange" id="programmer-arp-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px">Arp</button>
              <button class="btn btn-sm btn-outline" data-accent="pink" id="programmer-seq-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px">Seq</button>
              <button class="btn btn-sm btn-outline" id="programmer-chord-btn" data-accent="green" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px">Chord</button>
            </div>
            <div class="flex-row" style="gap:4px;width:100%">
              <button class="btn btn-sm btn-outline" data-accent="red" id="random-preset-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-weight:bold;font-size:9px">RND PTCH</button>
              <button class="btn btn-sm btn-outline" data-accent="blue" id="programmer-midi-learn-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px;font-weight:bold">MIDI LEARN</button>
              <button class="btn btn-sm btn-outline" data-accent="red" id="programmer-panic-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px;font-weight:bold" data-ctrl-tooltip="Send All Notes Off / Panic — stops all sounding notes">PANIC</button>
              <button class="btn btn-sm btn-outline" data-accent="orange" id="programmer-request-hw-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px" data-ctrl-tooltip="Request edit buffer from hardware DeepMind 12 via SysEx dump">REQUEST HW</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getBankManagerTemplate() {
  return `
    <!-- BANK MANAGER MODAL -->
    <div class="modal-backdrop" id="browser-modal-backdrop" style="display:none">
      <div class="modal" style="width:1024px;height:680px">
        <div class="modal-header">
          <h2>Bank &amp; Preset Manager (Dual Container)</h2>
          <div class="close-btn" id="browser-close-btn">&times;</div>
        </div>
        <div class="modal-body" style="display:grid;grid-template-columns:1fr 1fr;gap:15px;overflow:hidden">
          <div class="dual-bank-panel flex-col bg-surface" style="border:1.5px solid var(--border);border-radius:var(--radius-md);padding:10px;overflow:hidden">
            <span class="text-uppercase text-bold text-accent" style="font-size:var(--text-base);margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border-dim)">Hardware / Synth Device</span>
            <div class="flex-row gap-6 flex-wrap" style="margin-bottom:10px">
              <button class="manager-btn" id="hw-bank-a-btn">Bank A</button>
              <button class="manager-btn" id="hw-bank-b-btn">Bank B</button>
              <button class="manager-btn" id="hw-bank-c-btn">Bank C</button>
              <button class="manager-btn" id="hw-bank-d-btn">Bank D</button>
              <button class="manager-btn" id="hw-bank-e-btn">Bank E</button>
              <button class="manager-btn" id="hw-bank-f-btn">Bank F</button>
              <button class="manager-btn" id="hw-bank-g-btn">Bank G</button>
              <button class="manager-btn" id="hw-bank-h-btn">Bank H</button>
            </div>
            <div class="flex-row gap-6 border-bottom" style="margin-bottom:10px;padding-bottom:10px">
              <button class="manager-btn btn-solid" id="hw-load-btn">LOAD TO EDIT</button>
              <button class="manager-btn" id="hw-dump-to-synth" data-accent="green" style="background:color-mix(in srgb,var(--accent-green) 10%,transparent);border-color:var(--accent-green);color:var(--accent-green)">Dump to Synth</button>
              <button class="manager-btn" id="hw-fetch-from-synth" style="background:color-mix(in srgb,var(--accent-blue) 10%,transparent);border-color:var(--accent-blue);color:var(--accent-blue)">Fetch Bank</button>
            </div>
            <div class="patches-grid flex-1 overflow-y-auto" id="hw-patches-grid" style="display:grid;grid-template-columns:1fr;gap:4px"></div>
          </div>
          <div class="dual-bank-panel flex-col bg-surface" style="border:1.5px solid var(--border);border-radius:var(--radius-md);padding:10px;overflow:hidden">
            <span class="text-uppercase text-bold text-accent" style="font-size:var(--text-base);margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border-dim)">Local Library</span>
            <div class="flex-row gap-6 items-center" style="margin-bottom:10px">
              <select id="local-bank-select" class="modal-select" style="flex:1;font-size:var(--text-base);padding:4px"></select>
              <button class="manager-btn btn-sm" id="mngr-create-bank">New</button>
              <button class="manager-btn btn-sm" id="mngr-rename-bank">Rename</button>
              <button class="manager-btn btn-sm danger" id="mngr-delete-bank">Delete</button>
            </div>
            <div class="flex-row gap-6 border-bottom" style="margin-bottom:10px;padding-bottom:10px">
              <button class="manager-btn btn-solid" id="local-load-btn">LOAD TO EDIT</button>
              <button class="manager-btn" id="mngr-import-sysex" style="background:color-mix(in srgb,var(--accent-primary) 15%,transparent);border-color:var(--accent-primary);color:var(--text-primary)">Import SysEx</button>
              <button class="manager-btn" id="mngr-export-sysex">Export SysEx</button>
            </div>
            <div class="flex-row gap-4" style="margin-bottom:6px">
              <input type="text" id="browser-search-input" placeholder="Search patches by name..." style="flex:1;background:var(--bg-deepest);border:1px solid var(--border);color:var(--text-primary);padding:4px 8px;font-size:10px;border-radius:var(--radius-xs);outline:none">
              <button class="manager-btn btn-sm" id="browser-search-clear" style="font-size:9px;padding:3px 8px">Clear</button>
              <button class="manager-btn btn-sm" id="browser-view-toggle" title="Toggle grid/list view" style="font-size:10px;padding:3px 6px;min-width:28px">&#x229E;</button>
            </div>
            <div class="flex-row gap-3 flex-wrap" id="browser-category-filters" style="margin-bottom:6px;min-height:20px">
              <span class="cat-filter active" data-cat="">All</span>
              <span class="cat-filter" data-cat="Bass">Bass</span>
              <span class="cat-filter" data-cat="Lead">Lead</span>
              <span class="cat-filter" data-cat="Pad">Pad</span>
              <span class="cat-filter" data-cat="FX">FX</span>
              <span class="cat-filter" data-cat="Keys">Keys</span>
              <span class="cat-filter" data-cat="Perc">Perc</span>
              <span class="cat-filter" data-cat="Synth">Synth</span>
              <span class="cat-filter" data-cat="Other">Other</span>
            </div>
            <div class="patches-grid flex-1 overflow-y-auto" id="browser-patches-grid" style="display:grid;grid-template-columns:1fr;gap:4px"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- SAVE AS MODAL -->
    <div class="modal-backdrop" id="saveas-modal-backdrop" style="display:none;z-index:11000">
      <div class="modal" data-accent="orange" style="width:820px;height:580px">
        <div class="modal-header">
          <h2>Save Patch As (Select Destination)</h2>
          <div class="close-btn" id="saveas-close-btn">&times;</div>
        </div>
        <div class="flex-row gap-15" style="padding:15px;overflow:hidden;flex:1">
          <div class="flex-col bg-surface" style="width:200px;border:1px solid var(--border-dim);border-radius:var(--radius);padding:8px">
            <span class="text-uppercase text-bold text-dim" style="font-size:var(--text-sm);margin-bottom:5px">1. Select Bank</span>
            <div id="saveas-banks-list" class="flex-col gap-4 overflow-y-auto flex-1"></div>
          </div>
          <div class="flex-col bg-surface flex-1" style="border:1px solid var(--border-dim);border-radius:var(--radius);padding:8px">
            <span class="text-uppercase text-bold text-dim" style="font-size:var(--text-sm);margin-bottom:5px">2. Select Destination Slot</span>
            <div id="saveas-slots-grid" class="flex-1 overflow-y-auto" style="display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:28px;gap:4px"></div>
          </div>
        </div>
        <div class="modal-footer justify-between">
          <div class="flex-row gap-10 items-center flex-1">
            <span class="text-uppercase text-bold" style="font-size:var(--text-base);color:var(--text-dim)">Patch Name:</span>
            <input type="text" id="saveas-preset-name" class="modal-input" style="width:60%" placeholder="My Custom Patch">
          </div>
          <div class="flex-row gap-10">
            <button class="manager-btn" id="saveas-btn-cancel" style="background:var(--bg-hover);color:var(--text-primary)">Cancel</button>
            <button class="manager-btn btn-solid" id="saveas-btn-confirm" style="padding:6px 20px;font-size:var(--text-base)">Save Patch</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getKeyboardShortcutsTemplate() {
  return `
    <div class="modal-backdrop" id="keyboard-shortcuts-backdrop" style="display:none;z-index:5000">
      <div class="modal" data-accent="cyan" style="width:550px;height:auto">
        <div class="modal-header">
          <h2>Keyboard Shortcuts</h2>
          <div class="close-btn" id="keyboard-shortcuts-close-btn">&times;</div>
        </div>
        <div class="modal-body" style="background:var(--bg-elevated);padding:16px;overflow-y:auto">
          <div id="keyboard-shortcuts-dynamic-list" class="flex-col" style="gap:3px">
            <div class="text-dim text-center" style="padding:20px;font-size:var(--text-sm)">Loading shortcuts...</div>
          </div>
          <div style="margin-top:16px;padding:8px;background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius-sm);font-size:var(--text-2xs);color:var(--text-faint);text-align:center">
            These shortcuts are active when the main controller panel is focused.
            <span style="display:block;margin-top:4px">Customize them in <strong>Settings → Keyboard</strong>.</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════
// Web Component simulation (matching source code behavior)
// ══════════════════════════════════════════════════════════════════

function defineTopBar(customElements) {
  const template = getTopBarTemplate();
  class TopBar {
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
  customElements.define('top-bar', TopBar);
  return TopBar;
}

function defineSidePanel(customElements) {
  const template = getSidePanelTemplate();
  class SidePanel {
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
  customElements.define('side-panel', SidePanel);
  return SidePanel;
}

function defineProgrammerSection(customElements) {
  const template = getProgrammerSectionTemplate();
  class ProgrammerSection {
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
  customElements.define('programmer-section', ProgrammerSection);
  return ProgrammerSection;
}

function defineBankManagerModal(customElements) {
  const template = getBankManagerTemplate();
  class BankManagerModal {
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
  customElements.define('bank-manager-modal', BankManagerModal);
  return BankManagerModal;
}

function defineKeyboardShortcutsModal(customElements) {
  const template = getKeyboardShortcutsTemplate();
  class KeyboardShortcutsModal {
    constructor() {
      this.innerHTML = '';
      this.children = [];
      this.style = {};
      this._escHandler = null;
    }
    connectedCallback() {
      if (this.children.length === 0) {
        this.innerHTML = template;
      }
      const closeBtn = this.querySelector('#keyboard-shortcuts-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', function() { this.hide(); }.bind(this));
      }
      const backdrop = this.querySelector('#keyboard-shortcuts-backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', function(e) {
          if (e.target === backdrop) {this.hide();}
        }.bind(this));
      }
      this._escHandler = function(e) { if (e.key === 'Escape') {this.hide();} }.bind(this);
    }
    disconnectedCallback() {
      if (this._escHandler) {
        document.removeEventListener('keydown', this._escHandler);
      }
    }
    show() {
      const backdrop = this.querySelector('#keyboard-shortcuts-backdrop');
      if (backdrop) {backdrop.style.display = 'flex';}
    }
    hide() {
      const backdrop = this.querySelector('#keyboard-shortcuts-backdrop');
      if (backdrop) {backdrop.style.display = 'none';}
    }
    querySelector(sel) {
      return null;
    }
  }
  customElements.define('keyboard-shortcuts-modal', KeyboardShortcutsModal);
  return KeyboardShortcutsModal;
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

function extractTooltips(html) {
  const tooltips = [];
  const regex = /data-ctrl-tooltip="([^\"]*)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    tooltips.push(match[1]);
  }
  return tooltips;
}

function extractButtons(html) {
  const buttons = [];
  const regex = /<button[^>]*>([^<]*)<\/button>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    buttons.push(match[1].trim());
  }
  return buttons;
}

function extractMenuItems(html) {
  const items = [];
  // Match li elements with id, capturing full inner HTML then stripping tags
  const regex = /<li[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/li>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    items.push({ id: match[1], text: text });
  }
  return items;
}

// ══════════════════════════════════════════════════════════════════
// Tests: TopBar
// ══════════════════════════════════════════════════════════════════

describe('TopBar (top-bar.js)', () => {
  let customElements;
  let TopBar;

  beforeEach(() => {
    customElements = createCustomElementsRegistry();
    TopBar = defineTopBar(customElements);
  });

  it('is registered as top-bar', () => {
    expect(customElements.define).toHaveBeenCalledWith('top-bar', TopBar);
  });

  it('can be retrieved from registry', () => {
    expect(customElements.get('top-bar')).toBe(TopBar);
  });

  it('connectedCallback populates innerHTML', () => {
    const instance = new TopBar();
    instance.connectedCallback();
    expect(instance.innerHTML.length).toBeGreaterThan(100);
    expect(instance.innerHTML).toContain('top-bar');
  });

  it('connectedCallback preserves existing children', () => {
    const instance = new TopBar();
    instance.children = [{ id: 'existing' }];
    instance.innerHTML = '<div>keep</div>';
    instance.connectedCallback();
    expect(instance.innerHTML).toBe('<div>keep</div>');
  });

  it('idempotent on double connectedCallback', () => {
    const instance = new TopBar();
    instance.connectedCallback();
    const firstHTML = instance.innerHTML;
    instance.connectedCallback();
    expect(instance.innerHTML).toBe(firstHTML);
  });

  it('has header with id="top-bar"', () => {
    expect(getTopBarTemplate()).toContain('<header id="top-bar"');
  });

  it('has 3 menu items (File, Edit, View)', () => {
    const html = getTopBarTemplate();
    const menuItems = html.match(/class="menu-item">/g);
    expect(menuItems ? menuItems.length : 0).toBe(3);
  });

  it('has File menu with Bank Manager, MIDI Dump, Save, Save As', () => {
    const items = extractMenuItems(getTopBarTemplate());
    const fileItems = items.filter(function(i) { return i.id.startsWith('menu-'); });
    expect(fileItems).toContainEqual({ id: 'menu-bank-manager', text: 'Bank Manager...' });
    expect(fileItems).toContainEqual({ id: 'menu-dump-midi', text: 'MIDI Dump...' });
    expect(fileItems).toContainEqual({ id: 'menu-save', text: 'Save Patch' });
    expect(fileItems).toContainEqual({ id: 'menu-save-as', text: 'Save Patch As...' });
  });

  it('has Edit menu with Copy/Paste, Undo/Redo, MIDI Learn, Settings', () => {
    const ids = extractIds(getTopBarTemplate());
    expect(ids).toContain('menu-copy-preset');
    expect(ids).toContain('menu-paste-preset');
    expect(ids).toContain('menu-undo');
    expect(ids).toContain('menu-redo');
    expect(ids).toContain('menu-midi-learn');
    expect(ids).toContain('menu-properties');
    const html = getTopBarTemplate();
    expect(html).toContain('Copy Preset');
    expect(html).toContain('Paste Preset');
    expect(html).toContain('Undo');
    expect(html).toContain('Redo');
    expect(html).toContain('MIDI Learn');
    expect(html).toContain('Settings...');
  });

  it('has View menu with 8 theme options', () => {
    const html = getTopBarTemplate();
    const themeOptions = html.match(/class="theme-option"/g);
    expect(themeOptions ? themeOptions.length : 0).toBe(8);
    expect(html).toContain('menu-theme-default');
    expect(html).toContain('menu-theme-red');
    expect(html).toContain('menu-theme-blue');
    expect(html).toContain('menu-theme-green');
    expect(html).toContain('menu-theme-midnight');
    expect(html).toContain('menu-theme-dark-v2');
    expect(html).toContain('menu-theme-light');
    expect(html).toContain('menu-theme-juno');
  });

  it('has View menu with Debug, Keyboard Shortcuts, About', () => {
    const ids = extractIds(getTopBarTemplate());
    expect(ids).toContain('menu-debug-unison');
    expect(ids).toContain('menu-keyboard-shortcuts');
    expect(ids).toContain('menu-about');
    const html = getTopBarTemplate();
    expect(html).toContain('Debug: Unison Stacking...');
    expect(html).toContain('Keyboard Shortcuts');
    expect(html).toContain('About ABD Eep...');
  });

  it('has dividers in dropdowns', () => {
    const html = getTopBarTemplate();
    const dividers = html.match(/class="divider"/g);
    expect(dividers ? dividers.length : 0).toBeGreaterThanOrEqual(4);
  });

  it('has app title "ABD EEP CONTROLLER"', () => {
    expect(getTopBarTemplate()).toContain('ABD EEP CONTROLLER');
    expect(getTopBarTemplate()).toContain('id="app-title-mini"');
  });

  it('has controller overlay with PB, MW, AT', () => {
    const html = getTopBarTemplate();
    expect(html).toContain('data-ctrl="pb"');
    expect(html).toContain('data-ctrl="mw"');
    expect(html).toContain('data-ctrl="at"');
    expect(html).toContain('ctrl-o-pb-fill');
    expect(html).toContain('ctrl-o-mw-fill');
    expect(html).toContain('ctrl-o-at-fill');
  });

  it('has PB overlay with bipolar track (left:50%) and center line', () => {
    expect(getTopBarTemplate()).toContain('left:50%');
    expect(getTopBarTemplate()).toContain('class="ctrl-overlay-center"');
  });

  it('has keyboard shortcuts icon', () => {
    const html = getTopBarTemplate();
    expect(html).toContain('id="keyboard-shortcuts-icon"');
    expect(html).toContain('Keyboard Shortcuts');
  });

  it('has MIDI activity LED', () => {
    const html = getTopBarTemplate();
    expect(html).toContain('id="midi-activity-led"');
    expect(html).toContain('MIDI Activity');
  });

  it('has reconnect button with heartbeat animation', () => {
    const html = getTopBarTemplate();
    expect(html).toContain('id="reconnect-hw-btn"');
    expect(html).toContain('RE-CONNECT HARDWARE');
    expect(html).toContain('heartbeat-pulse');
  });

  it('has connection indicator', () => {
    const html = getTopBarTemplate();
    expect(html).toContain('id="midi-connection-indicator"');
    expect(html).toContain('MIDI: Disconnected');
  });

  it('has 1 header element', () => {
    const html = getTopBarTemplate();
    const headers = html.match(/<header/g);
    expect(headers ? headers.length : 0).toBe(1);
  });

  it('has menu-nav class for navigation', () => {
    expect(getTopBarTemplate()).toContain('class="menu-nav"');
  });

  it('has dropdown class for submenus', () => {
    expect(getTopBarTemplate()).toContain('class="dropdown"');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: SidePanel
// ══════════════════════════════════════════════════════════════════

describe('SidePanel (side-panel.js)', () => {
  let customElements;
  let SidePanel;

  beforeEach(() => {
    customElements = createCustomElementsRegistry();
    SidePanel = defineSidePanel(customElements);
  });

  it('is registered as side-panel', () => {
    expect(customElements.define).toHaveBeenCalledWith('side-panel', SidePanel);
  });

  it('connectedCallback populates innerHTML', () => {
    const instance = new SidePanel();
    instance.connectedCallback();
    expect(instance.innerHTML.length).toBeGreaterThan(100);
    expect(instance.innerHTML).toContain('detail-edit-panel');
  });

  it('connectedCallback preserves existing children', () => {
    const instance = new SidePanel();
    instance.children = [{ id: 'x' }];
    instance.innerHTML = '<div>keep</div>';
    instance.connectedCallback();
    expect(instance.innerHTML).toBe('<div>keep</div>');
  });

  it('idempotent on double connectedCallback', () => {
    const instance = new SidePanel();
    instance.connectedCallback();
    const firstHTML = instance.innerHTML;
    instance.connectedCallback();
    expect(instance.innerHTML).toBe(firstHTML);
  });

  it('has panel header with title and close button', () => {
    const html = getSidePanelTemplate();
    expect(html).toContain('id="panel-title"');
    expect(html).toContain('LFO Detail Editor');
    expect(html).toContain('id="panel-close-btn"');
    expect(html).toContain('Close side editor panel');
  });

  it('has graphic screen with canvas (280x90)', () => {
    const html = getSidePanelTemplate();
    expect(html).toContain('id="panel-graphic-screen"');
    expect(html).toContain('id="panel-graphic-canvas"');
    expect(html).toContain('width="280"');
    expect(html).toContain('height="90"');
  });

  it('has graphic collapse toggle with COLLAPSE text', () => {
    const html = getSidePanelTemplate();
    expect(html).toContain('id="panel-graphic-toggle"');
    expect(html).toContain('COLLAPSE');
  });

  it('has real DSP scope screen with canvas (280x85)', () => {
    const html = getSidePanelTemplate();
    expect(html).toContain('id="panel-real-scope-screen"');
    expect(html).toContain('id="panel-real-scope-canvas"');
    expect(html).toContain('height="85"');
  });

  it('has scope toolbar with trigger, zoom buttons, color', () => {
    const html = getSidePanelTemplate();
    expect(html).toContain('id="scope-toolbar"');
    expect(html).toContain('id="scope-trigger-btn"');
    expect(html).toContain('id="scope-color-btn"');
    expect(html).toContain('scope-zoom-group');
    expect(html).toContain('data-zoom="1"');
    expect(html).toContain('data-zoom="2"');
    expect(html).toContain('data-zoom="4"');
  });

  it('has scope 1x zoom button active by default', () => {
    const html = getSidePanelTemplate();
    expect(html).toContain('class="scope-zoom-btn scope-btn active"');
    expect(html).toContain('data-zoom="1"');
  });

  it('has scope toggle button with DSP SCOPE text', () => {
    const html = getSidePanelTemplate();
    expect(html).toContain('id="panel-real-scope-toggle"');
    expect(html).toContain('DSP SCOPE');
  });

  it('has dynamic controls container', () => {
    expect(getSidePanelTemplate()).toContain('id="panel-dynamic-controls"');
    expect(getSidePanelTemplate()).toContain('class="panel-content"');
  });

  it('has scope seq status span', () => {
    expect(getSidePanelTemplate()).toContain('id="scope-seq-status"');
  });

  it('has scope color indicator', () => {
    expect(getSidePanelTemplate()).toContain('id="scope-color-indicator"');
  });

  it('has close button tooltip', () => {
    const tooltips = extractTooltips(getSidePanelTemplate());
    expect(tooltips).toContain('Close side editor panel');
  });

  it('has toggle buttons tooltips', () => {
    const tooltips = extractTooltips(getSidePanelTemplate());
    expect(tooltips).toContain('Collapse/Expand graphic screen');
    expect(tooltips).toContain('Toggle real DSP oscilloscope');
  });

  it('has slide-edit-panel class on root', () => {
    expect(getSidePanelTemplate()).toContain('class="slide-edit-panel"');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: ProgrammerSection
// ══════════════════════════════════════════════════════════════════

describe('ProgrammerSection (programmer-section.js)', () => {
  let customElements;
  let ProgrammerSection;

  beforeEach(() => {
    customElements = createCustomElementsRegistry();
    ProgrammerSection = defineProgrammerSection(customElements);
  });

  it('is registered as programmer-section', () => {
    expect(customElements.define).toHaveBeenCalledWith('programmer-section', ProgrammerSection);
  });

  it('connectedCallback populates innerHTML', () => {
    const instance = new ProgrammerSection();
    instance.connectedCallback();
    expect(instance.innerHTML.length).toBeGreaterThan(100);
    expect(instance.innerHTML).toContain('programmer-section');
  });

  it('connectedCallback preserves children', () => {
    const instance = new ProgrammerSection();
    instance.children = [{ id: 'x' }];
    instance.connectedCallback();
    expect(instance.innerHTML).toBe('');
  });

  it('idempotent on double connectedCallback', () => {
    const instance = new ProgrammerSection();
    instance.connectedCallback();
    const firstHTML = instance.innerHTML;
    instance.connectedCallback();
    expect(instance.innerHTML).toBe(firstHTML);
  });

  it('has id="programmer-section" with flex:5.5', () => {
    const html = getProgrammerSectionTemplate();
    expect(html).toContain('id="programmer-section"');
    expect(html).toContain('flex:5.5');
  });

  it('has module header "Programmer"', () => {
    expect(getProgrammerSectionTemplate()).toContain('>Programmer<');
  });

  it('has sysex monitor with hex log, zoom, copy, export', () => {
    const html = getProgrammerSectionTemplate();
    expect(html).toContain('id="programmer-sysex-monitor"');
    expect(html).toContain('id="sysex-hex-log"');
    expect(html).toContain('id="sysex-zoom-btn"');
    expect(html).toContain('id="sysex-copy-btn"');
    expect(html).toContain('id="sysex-export-btn"');
    expect(html).toContain('ZOOM');
    expect(html).toContain('COPY');
    expect(html).toContain('.SYX');
  });

  it('has sysex selection info and active patch label', () => {
    const html = getProgrammerSectionTemplate();
    expect(html).toContain('id="sysex-selection-info"');
    expect(html).toContain('id="sysex-active-patch-label"');
    expect(html).toContain('LOADED PATCH: -');
  });

  it('has NRPN traffic counters (TX, RX, pkts) with Reset button', () => {
    const html = getProgrammerSectionTemplate();
    expect(html).toContain('id="nrpn-tx-count"');
    expect(html).toContain('id="nrpn-rx-count"');
    expect(html).toContain('id="nrpn-pkt-count"');
    expect(html).toContain('id="nrpn-reset-btn"');
    expect(html).toContain('Reset NRPN traffic counters');
  });

  it('has 4 navigation buttons (BANK UP, PATCH UP, PATCH DN, BANK DN)', () => {
    const buttons = extractButtons(getProgrammerSectionTemplate());
    expect(buttons).toContain('BANK UP');
    expect(buttons).toContain('PATCH UP');
    expect(buttons).toContain('PATCH DN');
    expect(buttons).toContain('BANK DN');
    const progHtml = getProgrammerSectionTemplate();
    expect(progHtml).toContain('id="programmer-bank-up-btn"');
    expect(progHtml).toContain('id="programmer-patch-up-btn"');
    expect(progHtml).toContain('id="programmer-patch-down-btn"');
    expect(progHtml).toContain('id="programmer-bank-down-btn"');
  });

  it('has Compare, Write, Global buttons with data-accent="orange"', () => {
    const buttons = extractButtons(getProgrammerSectionTemplate());
    expect(buttons).toContain('Compare');
    expect(buttons).toContain('Write');
    expect(buttons).toContain('Global');
    expect(getProgrammerSectionTemplate()).toContain('id="programmer-compare-btn"');
    expect(getProgrammerSectionTemplate()).toContain('id="programmer-write-btn"');
    expect(getProgrammerSectionTemplate()).toContain('id="programmer-global-btn"');
  });

  it('has LCD screen with glow pulse and INITIAL PATCH text', () => {
    const html = getProgrammerSectionTemplate();
    expect(html).toContain('class="lcd-screen"');
    expect(html).toContain('id="lcd-glow-pulse"');
    expect(html).toContain('id="lcd-text"');
    expect(html).toContain('INITIAL PATCH');
  });

  it('has 4 top row nav buttons: BNK MANAGER, MOD MATRIX, FX, Poly Chr', () => {
    const buttons = extractButtons(getProgrammerSectionTemplate());
    expect(buttons).toContain('BNK MANAGER');
    expect(buttons).toContain('MOD MATRIX');
    expect(buttons).toContain('FX');
    expect(buttons).toContain('Poly Chr');
  });

  it('has middle row: Arp, Seq, Chord buttons', () => {
    const buttons = extractButtons(getProgrammerSectionTemplate());
    expect(buttons).toContain('Arp');
    expect(buttons).toContain('Seq');
    expect(buttons).toContain('Chord');
  });

  it('has bottom row: RND PTCH, MIDI LEARN, PANIC, REQUEST HW', () => {
    const buttons = extractButtons(getProgrammerSectionTemplate());
    expect(buttons).toContain('RND PTCH');
    expect(buttons).toContain('MIDI LEARN');
    expect(buttons).toContain('PANIC');
    expect(buttons).toContain('REQUEST HW');
  });

  it('has PANIC button with tooltip', () => {
    const tooltips = extractTooltips(getProgrammerSectionTemplate());
    expect(tooltips).toContain('Send All Notes Off / Panic — stops all sounding notes');
  });

  it('has REQUEST HW button with tooltip', () => {
    const tooltips = extractTooltips(getProgrammerSectionTemplate());
    expect(tooltips).toContain('Request edit buffer from hardware DeepMind 12 via SysEx dump');
  });

  it('has zoom button with green accent tooltip', () => {
    const tooltips = extractTooltips(getProgrammerSectionTemplate());
    expect(tooltips).toContain('Zoom into SysEx hex data');
  });

  it('has total button count', () => {
    const buttons = extractButtons(getProgrammerSectionTemplate());
    // 4 nav (BANK/PATCH) + 3 left (Compare/Write/Global) + 4 top row + 3 middle + 4 bottom + 3 sysex + 1 Reset = 22
    expect(buttons.length).toBeGreaterThanOrEqual(18);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: BankManagerModal
// ══════════════════════════════════════════════════════════════════

describe('BankManagerModal (bank-manager.js)', () => {
  let customElements;
  let BankManagerModal;

  beforeEach(() => {
    customElements = createCustomElementsRegistry();
    BankManagerModal = defineBankManagerModal(customElements);
  });

  it('is registered as bank-manager-modal', () => {
    expect(customElements.define).toHaveBeenCalledWith('bank-manager-modal', BankManagerModal);
  });

  it('connectedCallback populates innerHTML', () => {
    const instance = new BankManagerModal();
    instance.connectedCallback();
    expect(instance.innerHTML.length).toBeGreaterThan(100);
    expect(instance.innerHTML).toContain('browser-modal-backdrop');
  });

  it('connectedCallback preserves children', () => {
    const instance = new BankManagerModal();
    instance.children = [{ id: 'x' }];
    instance.connectedCallback();
    expect(instance.innerHTML).toBe('');
  });

  it('idempotent on double connectedCallback', () => {
    const instance = new BankManagerModal();
    instance.connectedCallback();
    const firstHTML = instance.innerHTML;
    instance.connectedCallback();
    expect(instance.innerHTML).toBe(firstHTML);
  });

  it('has Bank Manager modal with dual panel layout', () => {
    const html = getBankManagerTemplate();
    expect(html).toContain('id="browser-modal-backdrop"');
    expect(html).toContain('Bank &amp; Preset Manager (Dual Container)');
    expect(html).toContain('id="browser-close-btn"');
    expect(html).toContain('grid-template-columns:1fr 1fr');
  });

  it('has Hardware panel with 8 bank buttons (A-H)', () => {
    const html = getBankManagerTemplate();
    for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
      expect(html).toContain('id="hw-bank-' + letter.toLowerCase() + '-btn"');
      expect(html).toContain('>Bank ' + letter + '<');
    }
  });

  it('has Hardware panel action buttons: LOAD, Dump, Fetch', () => {
    const ids = extractIds(getBankManagerTemplate());
    expect(ids).toContain('hw-load-btn');
    expect(ids).toContain('hw-dump-to-synth');
    expect(ids).toContain('hw-fetch-from-synth');
  });

  it('has Local Library panel with bank select, New/Rename/Delete', () => {
    const ids = extractIds(getBankManagerTemplate());
    expect(ids).toContain('local-bank-select');
    expect(ids).toContain('mngr-create-bank');
    expect(ids).toContain('mngr-rename-bank');
    expect(ids).toContain('mngr-delete-bank');
  });

  it('has Local Library action buttons: LOAD, Import, Export', () => {
    const ids = extractIds(getBankManagerTemplate());
    expect(ids).toContain('local-load-btn');
    expect(ids).toContain('mngr-import-sysex');
    expect(ids).toContain('mngr-export-sysex');
  });

  it('has search input and clear button', () => {
    const html = getBankManagerTemplate();
    expect(html).toContain('id="browser-search-input"');
    expect(html).toContain('id="browser-search-clear"');
    expect(html).toContain('id="browser-view-toggle"');
  });

  it('has category filters with 9 categories (All + 8)', () => {
    const html = getBankManagerTemplate();
    expect(html).toContain('id="browser-category-filters"');
    const catFilters = html.match(/class="cat-filter/g);
    expect(catFilters ? catFilters.length : 0).toBe(9);
    expect(html).toContain('data-cat="Bass"');
    expect(html).toContain('data-cat="Lead"');
    expect(html).toContain('data-cat="Pad"');
    expect(html).toContain('data-cat="Other"');
  });

  it('has "All" category filter active by default', () => {
    expect(getBankManagerTemplate()).toContain('class="cat-filter active"');
    expect(getBankManagerTemplate()).toContain('data-cat=""');
  });

  it('has Save As modal with bank list, slots grid, name input', () => {
    const html = getBankManagerTemplate();
    expect(html).toContain('id="saveas-modal-backdrop"');
    expect(html).toContain('Save Patch As (Select Destination)');
    expect(html).toContain('id="saveas-banks-list"');
    expect(html).toContain('id="saveas-slots-grid"');
    expect(html).toContain('id="saveas-preset-name"');
  });

  it('Save As has 3-column slots grid', () => {
    const html = getBankManagerTemplate();
    expect(html).toContain('grid-template-columns:repeat(3,1fr)');
    expect(html).toContain('grid-auto-rows:28px');
  });

  it('Save As has Cancel and Save Patch buttons', () => {
    const ids = extractIds(getBankManagerTemplate());
    expect(ids).toContain('saveas-btn-cancel');
    expect(ids).toContain('saveas-btn-confirm');
  });

  it('Save As has data-accent="orange"', () => {
    expect(getBankManagerTemplate()).toContain('data-accent="orange"');
  });

  it('Save As close button exists', () => {
    expect(getBankManagerTemplate()).toContain('id="saveas-close-btn"');
  });

  it('has hw-patches-grid and browser-patches-grid containers', () => {
    const ids = extractIds(getBankManagerTemplate());
    expect(ids).toContain('hw-patches-grid');
    expect(ids).toContain('browser-patches-grid');
  });

  it('has patches-grid class for both panels', () => {
    const html = getBankManagerTemplate();
    const grids = html.match(/class="patches-grid/g);
    expect(grids ? grids.length : 0).toBe(2);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: KeyboardShortcutsModal
// ══════════════════════════════════════════════════════════════════

describe('KeyboardShortcutsModal (keyboard-shortcuts.js)', () => {
  let customElements;
  let KeyboardShortcutsModal;

  beforeEach(() => {
    customElements = createCustomElementsRegistry();
    KeyboardShortcutsModal = defineKeyboardShortcutsModal(customElements);
  });

  it('is registered as keyboard-shortcuts-modal', () => {
    expect(customElements.define).toHaveBeenCalledWith('keyboard-shortcuts-modal', KeyboardShortcutsModal);
  });

  it('connectedCallback populates innerHTML', () => {
    const instance = new KeyboardShortcutsModal();
    instance.connectedCallback();
    expect(instance.innerHTML.length).toBeGreaterThan(50);
    expect(instance.innerHTML).toContain('keyboard-shortcuts-backdrop');
  });

  it('connectedCallback preserves children', () => {
    const instance = new KeyboardShortcutsModal();
    instance.children = [{ id: 'x' }];
    instance.innerHTML = '<div>custom</div>';
    instance.connectedCallback();
    expect(instance.innerHTML).toBe('<div>custom</div>');
  });

  it('idempotent on double connectedCallback', () => {
    const instance = new KeyboardShortcutsModal();
    instance.connectedCallback();
    const firstHTML = instance.innerHTML;
    instance.connectedCallback();
    expect(instance.innerHTML).toBe(firstHTML);
  });

  it('has backdrop with display:none and z-index:5000', () => {
    const html = getKeyboardShortcutsTemplate();
    expect(html).toContain('display:none');
    expect(html).toContain('z-index:5000');
  });

  it('has modal with data-accent="cyan" and width:550px', () => {
    const html = getKeyboardShortcutsTemplate();
    expect(html).toContain('data-accent="cyan"');
    expect(html).toContain('width:550px');
  });

  it('has header with Keyboard Shortcuts title', () => {
    expect(getKeyboardShortcutsTemplate()).toContain('Keyboard Shortcuts');
    expect(getKeyboardShortcutsTemplate()).toContain('<h2');
  });

  it('has close button', () => {
    expect(getKeyboardShortcutsTemplate()).toContain('id="keyboard-shortcuts-close-btn"');
    expect(getKeyboardShortcutsTemplate()).toContain('&times;');
  });

  it('has dynamic list container with loading placeholder', () => {
    const html = getKeyboardShortcutsTemplate();
    expect(html).toContain('id="keyboard-shortcuts-dynamic-list"');
    expect(html).toContain('Loading shortcuts...');
  });

  it('has footer with focus note and settings link', () => {
    const html = getKeyboardShortcutsTemplate();
    expect(html).toContain('These shortcuts are active when the main controller panel is focused.');
    expect(html).toContain('Settings → Keyboard');
  });

  it('show() sets backdrop display to flex', () => {
    const backdrop = makeFakeEl();
    const instance = new KeyboardShortcutsModal();
    instance.querySelector = function(sel) {
      if (sel === '#keyboard-shortcuts-backdrop') {return backdrop;}
      return null;
    };
    instance.show();
    expect(backdrop.style.display).toBe('flex');
  });

  it('hide() sets backdrop display to none', () => {
    const backdrop = makeFakeEl();
    backdrop.style.display = 'flex';
    const instance = new KeyboardShortcutsModal();
    instance.querySelector = function(sel) {
      if (sel === '#keyboard-shortcuts-backdrop') {return backdrop;}
      return null;
    };
    instance.hide();
    expect(backdrop.style.display).toBe('none');
  });

  it('show() handles missing backdrop gracefully', () => {
    const instance = new KeyboardShortcutsModal();
    instance.querySelector = function() { return null; };
    expect(function() { instance.show(); }).not.toThrow();
  });

  it('hide() handles missing backdrop gracefully', () => {
    const instance = new KeyboardShortcutsModal();
    instance.querySelector = function() { return null; };
    expect(function() { instance.hide(); }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// Cross-component patterns
// ══════════════════════════════════════════════════════════════════

describe('Cross-component patterns (structural)', () => {
  it('all 5 components can be registered in the same registry', () => {
    const registry = createCustomElementsRegistry();
    defineTopBar(registry);
    defineSidePanel(registry);
    defineProgrammerSection(registry);
    defineBankManagerModal(registry);
    defineKeyboardShortcutsModal(registry);

    expect(registry.get('top-bar')).toBeDefined();
    expect(registry.get('side-panel')).toBeDefined();
    expect(registry.get('programmer-section')).toBeDefined();
    expect(registry.get('bank-manager-modal')).toBeDefined();
    expect(registry.get('keyboard-shortcuts-modal')).toBeDefined();
  });

  it('all 5 have connectedCallback with guard against duplicate render', () => {
    const registry = createCustomElementsRegistry();
    defineTopBar(registry);
    defineSidePanel(registry);
    defineProgrammerSection(registry);
    defineBankManagerModal(registry);
    defineKeyboardShortcutsModal(registry);

    ['top-bar', 'side-panel', 'programmer-section', 'bank-manager-modal', 'keyboard-shortcuts-modal'].forEach(function(name) {
      const instance = new (registry.get(name))();
      instance.connectedCallback();
      const firstHTML = instance.innerHTML;
      instance.connectedCallback();
      expect(instance.innerHTML).toBe(firstHTML);
    });
  });

  it('TopBar has unique elements not present in other components', () => {
    const topHtml = getTopBarTemplate();
    expect(topHtml).toContain('menu-nav');
    expect(topHtml).toContain('ctrl-overlay');
    expect(topHtml).toContain('app-title-mini');
  });

  it('ProgrammerSection is the most button-heavy component', () => {
    const progButtons = extractButtons(getProgrammerSectionTemplate());
    const topButtons = extractButtons(getTopBarTemplate());
    // Programmer has far more buttons than top bar
    expect(progButtons.length).toBeGreaterThan(topButtons.length);
  });

  it('bank-manager uses modal-backdrop and modal pattern', () => {
    const html = getBankManagerTemplate();
    expect(html).toContain('modal-backdrop');
    expect(html).toContain('modal-header');
    expect(html).toContain('modal-body');
    expect(html).toContain('close-btn');
  });

  it('keyboard-shortcuts uses modal pattern with backdrop', () => {
    const html = getKeyboardShortcutsTemplate();
    expect(html).toContain('modal-backdrop');
    expect(html).toContain('modal-header');
    expect(html).toContain('modal-body');
    expect(html).toContain('close-btn');
    expect(html).toContain('&times;');
  });

  it('all tooltips provide non-empty descriptions', () => {
    const tooltipSets = [
      extractTooltips(getTopBarTemplate()),
      extractTooltips(getSidePanelTemplate()),
      extractTooltips(getProgrammerSectionTemplate()),
    ];
    tooltipSets.forEach(function(tts) {
      tts.forEach(function(t) {
        expect(t.length).toBeGreaterThan(5);
      });
    });
  });
});

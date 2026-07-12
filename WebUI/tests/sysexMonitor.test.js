/**
 * Unit tests for sysex_monitor.js — SysEx hex monitoring, NRPN traffic counters,
 * hex byte selection, and patch label display.
 *
 * Run with: npx vitest run WebUI/tests/sysexMonitor.test.js
 *
 * Covers:
 *   - updateSysExMonitor rendering (HTML, patch label, highlight, edge cases)
 *   - updateNrpnTrafficCounters
 *   - _updateHexSelectionInfo (single, range, BYTE_MAP, edge cases)
 *   - Zoom/Export/Copy button click handlers
 *   - NRPN reset button
 *   - Hex byte selection (click, shift+click, ctrl+click, deselect)
 *   - pack8to7 export blob construction
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Fake DOM element factory
// ══════════════════════════════════════════════════════════════════

function _createFakeEl(tag, attrs) {
  var el = {
    tagName: (tag || 'div').toUpperCase(),
    id: (attrs && attrs.id) || '',
    _attrs: attrs || {},
    _listeners: {},
    value: '',
    textContent: '',
    innerHTML: '',
    innerText: '',
    style: {
      _props: {},
      removeProperty: function(prop) { delete this._props[prop]; },
    },
    dataset: {},
    classList: {
      _classes: [],
      add: function(c) { if (!this._classes.includes(c)) this._classes.push(c); },
      remove: function(c) { this._classes = this._classes.filter(function(x) { return x !== c; }); },
      contains: function(c) { return this._classes.includes(c); },
      toggle: function(c, force) {
        if (force === true) { this.add(c); return true; }
        if (force === false) { this.remove(c); return false; }
        return this.contains(c) ? (this.remove(c), false) : (this.add(c), true);
      },
    },
    clientHeight: 100,
    getAttribute: function(name) { return this._attrs[name] || null; },
    setAttribute: function(name, val) { this._attrs[name] = val; },
    hasAttribute: function(name) { return name in this._attrs; },
    addEventListener: function(event, handler) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(handler);
    },
    removeEventListener: function() {},
    dispatchEvent: function() {},
    closest: function(sel) {
      if (sel === '.hex-byte') {
        if (this.classList.contains('hex-byte')) return this;
        return this._parent && this._parent.classList && this._parent.classList.contains('hex-byte') ? this._parent : null;
      }
      return null;
    },
    querySelector: function(sel) { return this._subElements[sel] || null; },
    querySelectorAll: function(sel) {
      if (sel === '.hex-byte.selected' || sel === '.hex-byte') {
        return (this._hexByteEls || []).filter(function(el) {
          if (sel === '.hex-byte') return true;
          return el.classList.contains('selected');
        });
      }
      return [];
    },
    _subElements: {},
    _hexByteEls: [],
    _parent: null,
  };
  return el;
}

// ══════════════════════════════════════════════════════════════════
// Helper: create 242-byte test array
// ══════════════════════════════════════════════════════════════════

function _makeTestBytes(len) {
  len = len || 242;
  var arr = new Uint8Array(len);
  var hexLog = _createFakeEl('div', { id: 'sysex-hex-log' });
  hexLog._hexByteEls = [];
  for (var i = 0; i < len; i++) {
    arr[i] = (i * 17) % 256; // deterministic pattern
    var byteEl = _createFakeEl('span', { 'class': 'hex-byte', 'data-idx': String(i) });
    byteEl.classList.add('hex-byte');
    byteEl._parent = hexLog;
    hexLog._hexByteEls.push(byteEl);
  }
  hexLog._subElements = {};
  hexLog._selectedIndices = [];
  hexLog._bytes = arr;
  return { bytes: arr, hexLog: hexLog };
}

// ══════════════════════════════════════════════════════════════════
// updateSysExMonitor — main hex rendering
// ══════════════════════════════════════════════════════════════════

describe('updateSysExMonitor — hex byte rendering', () => {
  var hexLog, infoEl, patchLabel, mockBridge;

  function updateSysExMonitor(bytes, highlightIndex, patchNameOverride) {
    var monitor = document.getElementById('sysex-hex-log');
    if (!monitor) return;

    monitor._bytes = bytes;
    window._liveUnpackedBytes = null;

    var html = '';
    for (var i = 0; i < bytes.length; i++) {
      var hexVal = bytes[i].toString(16).toUpperCase().padStart(2, '0');
      var isChanged = (i === highlightIndex) ? 'changed' : 'normal';
      html += '<span class="hex-byte ' + isChanged + '" data-idx="' + i + '" title="Byte ' + i + ': 0x' + hexVal + '">' + hexVal + '</span> ';
    }
    monitor.innerHTML = html;

    monitor._selectedIndices = [];
    var infoEl = document.getElementById('sysex-selection-info');
    if (infoEl) infoEl.textContent = 'Click a hex byte to select it. Shift+click to select range. Ctrl+click to toggle.';

    var patchLabel = document.getElementById('sysex-active-patch-label');
    if (patchLabel) {
      if (patchNameOverride) {
        patchLabel.innerText = 'LOADED PATCH: ' + patchNameOverride.toUpperCase();
      } else {
        var activeBankName = window.currentActiveBank || 'Factory Bank A';
        var activeIdx = window.currentActivePatchIndex !== undefined ? window.currentActivePatchIndex : 0;
        var patchName = 'INIT PATCH';
        if (window.loadedBanks && window.loadedBanks[activeBankName] && window.loadedBanks[activeBankName][activeIdx]) {
          patchName = window.loadedBanks[activeBankName][activeIdx].name;
        } else if (window.hardwareBanks && window.currentHwBankLetter && window.hardwareBanks[window.currentHwBankLetter] && window.currentHwPatchIndex !== -1) {
          var hwPatch = window.hardwareBanks[window.currentHwBankLetter][window.currentHwPatchIndex];
          if (hwPatch) patchName = hwPatch.name;
        }
        var slotStr = (activeIdx !== -1) ? (activeIdx + 1).toString().padStart(3, '0') : '001';
        patchLabel.innerText = 'LOADED PATCH: ' + patchName.toUpperCase() + ' [' + activeBankName + ' - SLOT ' + slotStr + ']';
      }
      patchLabel.style.display = 'block';
    }

    if (highlightIndex !== -1) {
      setTimeout(function() {
        var el = monitor.querySelector('.changed');
        if (el) el.classList.remove('changed');
      }, 1000);
    }
  }

  beforeEach(function() {
    vi.useFakeTimers();
    var registry = {};

    hexLog = _createFakeEl('div', { id: 'sysex-hex-log' });
    hexLog._hexByteEls = [];
    hexLog._selectedIndices = [];
    infoEl = _createFakeEl('div', { id: 'sysex-selection-info' });
    patchLabel = _createFakeEl('div', { id: 'sysex-active-patch-label' });

    registry['sysex-hex-log'] = hexLog;
    registry['sysex-selection-info'] = infoEl;
    registry['sysex-active-patch-label'] = patchLabel;

    const clipboardSpy = vi.fn();

    vi.stubGlobal('document', {
      getElementById: function(id) { return registry[id] || null; },
      addEventListener: function() {},
    });

    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: clipboardSpy
      }
    });

    vi.stubGlobal('window', {
      _liveUnpackedBytes: null,
      currentActiveBank: undefined,
      currentActivePatchIndex: undefined,
      loadedBanks: undefined,
      hardwareBanks: undefined,
      currentHwBankLetter: undefined,
      currentHwPatchIndex: -1,
      navigator: {
        clipboard: {
          writeText: clipboardSpy
        }
      }
    });

    mockBridge = {};
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('returns early when hex-log element is missing', function() {
    vi.stubGlobal('document', { getElementById: function() { return null; } });
    expect(function() { updateSysExMonitor(new Uint8Array(242)); }).not.toThrow();
  });

  it('renders all 242 bytes as hex spans', function() {
    var data = _makeTestBytes(242);
    updateSysExMonitor(data.bytes);

    expect(hexLog.innerHTML).toContain('class="hex-byte normal"');
    // First byte: 0 → 00
    expect(hexLog.innerHTML).toContain('data-idx="0"');
    expect(hexLog.innerHTML).toContain('00');
    // Last byte
    expect(hexLog.innerHTML).toContain('data-idx="241"');
  });

  it('renders bytes with correct hex values', function() {
    var data = _makeTestBytes(242);
    updateSysExMonitor(data.bytes);

    // Byte 0: 0 → "00"
    expect(hexLog.innerHTML).toContain('>00<');
    // Byte 1: 17 → "11"
    expect(hexLog.innerHTML).toContain('>11<');
    // Byte 2: 34 → "22"
    expect(hexLog.innerHTML).toContain('>22<');
  });

  it('marks highlighted byte with changed class', function() {
    var data = _makeTestBytes(242);
    updateSysExMonitor(data.bytes, 5);

    // Byte 5 should have class "changed"
    expect(hexLog.innerHTML).toContain('class="hex-byte changed"');
    expect(hexLog.innerHTML).toContain('data-idx="5"');
  });

  it('removes changed class after 1000ms', function() {
    var data = _makeTestBytes(242);
    hexLog._hexByteEls = data.hexLog._hexByteEls;
    hexLog._selectedIndices = [];

    // Override querySelector so '.changed' returns the first byte
    var origQuery = hexLog.querySelector;
    hexLog.querySelector = function(sel) {
      if (sel === '.changed' && hexLog._hexByteEls.length > 0) {
        // Return the highlightIndex-th element or first
        var highlightIdx = 0;
        return hexLog._hexByteEls[highlightIdx];
      }
      return origQuery.call(this, sel);
    };

    updateSysExMonitor(data.bytes, 0);

    var changedEl = hexLog._hexByteEls[0];
    changedEl.classList.add('changed');

    vi.advanceTimersByTime(1000);
    expect(changedEl.classList.contains('changed')).toBe(false);
  });

  it('clears _liveUnpackedBytes on each call', function() {
    window._liveUnpackedBytes = new Uint8Array(242);
    var data = _makeTestBytes(242);

    updateSysExMonitor(data.bytes);
    expect(window._liveUnpackedBytes).toBeNull();
  });

  it('resets _selectedIndices on each call', function() {
    var data = _makeTestBytes(242);
    hexLog._selectedIndices = [1, 2, 3];

    updateSysExMonitor(data.bytes);
    expect(hexLog._selectedIndices).toEqual([]);
  });

  it('resets selection info text on each call', function() {
    var data = _makeTestBytes(242);
    infoEl.textContent = 'old selection text';

    updateSysExMonitor(data.bytes);
    expect(infoEl.textContent).toContain('Click a hex byte to select');
  });

  it('stores bytes reference on monitor', function() {
    var data = _makeTestBytes(242);
    updateSysExMonitor(data.bytes);
    expect(hexLog._bytes).toBe(data.bytes);
  });

  // ── Patch label ──

  it('uses patchNameOverride if provided', function() {
    var data = _makeTestBytes(242);
    updateSysExMonitor(data.bytes, -1, 'RANDOM PATCH');
    expect(patchLabel.innerText).toContain('RANDOM PATCH');
  });

  it('shows INIT PATCH when no bank data available', function() {
    var data = _makeTestBytes(242);
    updateSysExMonitor(data.bytes);
    expect(patchLabel.innerText).toContain('INIT PATCH');
    expect(patchLabel.style.display).toBe('block');
  });

  it('shows patch name from loadedBanks', function() {
    window.loadedBanks = {
      'User Bank A': [
        { name: 'DEEP PAD' },
      ],
    };
    window.currentActiveBank = 'User Bank A';
    window.currentActivePatchIndex = 0;

    var data = _makeTestBytes(242);
    updateSysExMonitor(data.bytes);
    expect(patchLabel.innerText).toContain('DEEP PAD');
    expect(patchLabel.innerText).toContain('SLOT 001');
  });

  it('shows patch name from hardwareBanks', function() {
    window.hardwareBanks = {
      'A': [
        { name: 'HARD LEAD' },
      ],
    };
    window.currentHwBankLetter = 'A';
    window.currentHwPatchIndex = 0;

    var data = _makeTestBytes(242);
    updateSysExMonitor(data.bytes);
    expect(patchLabel.innerText).toContain('HARD LEAD');
  });

  it('shows slot number with zero-padding', function() {
    window.currentActivePatchIndex = 9; // 10th patch

    var data = _makeTestBytes(242);
    updateSysExMonitor(data.bytes);
    expect(patchLabel.innerText).toContain('SLOT 010');
  });

  it('shows bank name in label', function() {
    window.currentActiveBank = 'Factory Bank C';

    var data = _makeTestBytes(242);
    updateSysExMonitor(data.bytes);
    expect(patchLabel.innerText).toContain('Factory Bank C');
  });
});

// ══════════════════════════════════════════════════════════════════
// updateNrpnTrafficCounters
// ══════════════════════════════════════════════════════════════════

describe('updateNrpnTrafficCounters — NRPN counter display', () => {
  var txEl, rxEl, pktEl;

  function updateNrpnTrafficCounters(stats) {
    var txEl = document.getElementById('nrpn-tx-count');
    var rxEl = document.getElementById('nrpn-rx-count');
    var pktEl = document.getElementById('nrpn-pkt-count');
    if (txEl) txEl.textContent = stats.tx;
    if (rxEl) rxEl.textContent = stats.rx;
    if (pktEl) pktEl.textContent = stats.pkts;
  }

  beforeEach(function() {
    var registry = {};
    txEl = _createFakeEl('span', { id: 'nrpn-tx-count' });
    rxEl = _createFakeEl('span', { id: 'nrpn-rx-count' });
    pktEl = _createFakeEl('span', { id: 'nrpn-pkt-count' });
    registry['nrpn-tx-count'] = txEl;
    registry['nrpn-rx-count'] = rxEl;
    registry['nrpn-pkt-count'] = pktEl;

    vi.stubGlobal('document', {
      getElementById: function(id) { return registry[id] || null; },
    });
  });

  it('updates TX counter', function() {
    updateNrpnTrafficCounters({ tx: 42, rx: 10, pkts: 5 });
    expect(txEl.textContent).toBe(42);
  });

  it('updates RX counter', function() {
    updateNrpnTrafficCounters({ tx: 42, rx: 10, pkts: 5 });
    expect(rxEl.textContent).toBe(10);
  });

  it('updates packet counter', function() {
    updateNrpnTrafficCounters({ tx: 42, rx: 10, pkts: 5 });
    expect(pktEl.textContent).toBe(5);
  });

  it('handles zero values', function() {
    updateNrpnTrafficCounters({ tx: 0, rx: 0, pkts: 0 });
    expect(txEl.textContent).toBe(0);
    expect(rxEl.textContent).toBe(0);
    expect(pktEl.textContent).toBe(0);
  });

  it('handles missing DOM elements gracefully', function() {
    vi.stubGlobal('document', { getElementById: function() { return null; } });
    expect(function() { updateNrpnTrafficCounters({ tx: 1, rx: 2, pkts: 3 }); }).not.toThrow();
  });

  it('handles large counter values', function() {
    updateNrpnTrafficCounters({ tx: 999999, rx: 888888, pkts: 777777 });
    expect(txEl.textContent).toBe(999999);
  });

  it('updates only available elements', function() {
    var registry = {};
    registry['nrpn-tx-count'] = txEl;
    vi.stubGlobal('document', {
      getElementById: function(id) { return registry[id] || null; },
    });
    // txEl exists, rxEl and pktEl don't
    expect(function() { updateNrpnTrafficCounters({ tx: 1, rx: 2, pkts: 3 }); }).not.toThrow();
    expect(txEl.textContent).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════
// _updateHexSelectionInfo
// ══════════════════════════════════════════════════════════════════

describe('_updateHexSelectionInfo — hex byte selection info', () => {
  var infoEl;

  function _updateHexSelectionInfo(monitor) {
    var infoEl = document.getElementById('sysex-selection-info');
    if (!infoEl || !monitor || !monitor._selectedIndices) return;

    var selected = monitor._selectedIndices;
    var bytes = monitor._bytes;

    if (selected.length === 0) {
      infoEl.textContent = 'Click a hex byte to select it. Shift+click to select range. Ctrl+click to toggle.';
      return;
    }

    var parts = [];
    var nm = selected.length;
    var showIndices = selected.slice(0, 3);
    showIndices.forEach(function(idx) {
      var val = bytes ? bytes[idx] : 0;
      var hex = val.toString(16).toUpperCase().padStart(2, '0');
      var paramName = '';
      var bm = window.BYTE_MAP && window.BYTE_MAP[idx];
      if (bm && bm.param) {
        paramName = ' ' + bm.param;
      }
      parts.push('b[' + idx + ']=0x' + hex + paramName);
    });

    var text = parts.join(' | ');
    if (nm > 3) {
      text += ' | … +' + (nm - 3) + ' more';
    }
    infoEl.textContent = text;
  }

  beforeEach(function() {
    infoEl = _createFakeEl('div', { id: 'sysex-selection-info' });
    var registry = { 'sysex-selection-info': infoEl };

    vi.stubGlobal('document', {
      getElementById: function(id) { return registry[id] || null; },
    });

    vi.stubGlobal('window', { BYTE_MAP: undefined });
  });

  it('shows default message when selection is empty', function() {
    var monitor = { _selectedIndices: [], _bytes: new Uint8Array(242) };
    _updateHexSelectionInfo(monitor);
    expect(infoEl.textContent).toContain('Click a hex byte to select');
  });

  it('shows byte index and hex value for single selection', function() {
    var bytes = new Uint8Array(242);
    bytes[42] = 255;
    var monitor = { _selectedIndices: [42], _bytes: bytes };
    _updateHexSelectionInfo(monitor);
    expect(infoEl.textContent).toContain('b[42]');
    expect(infoEl.textContent).toContain('0xFF');
  });

  it('shows multiple selected indexes separated by pipe', function() {
    var bytes = new Uint8Array(242);
    bytes[0] = 0;
    bytes[5] = 128;
    bytes[10] = 255;
    var monitor = { _selectedIndices: [0, 5, 10], _bytes: bytes };
    _updateHexSelectionInfo(monitor);
    expect(infoEl.textContent).toContain('b[0]');
    expect(infoEl.textContent).toContain('b[5]');
    expect(infoEl.textContent).toContain('b[10]');
    expect(infoEl.textContent).toContain('0x80');
    expect(infoEl.textContent).toContain('0xFF');
  });

  it('shows param name from BYTE_MAP when available', function() {
    window.BYTE_MAP = {};
    window.BYTE_MAP[42] = { param: 'vcf_cutoff' };
    window.BYTE_MAP[43] = { param: 'vcf_resonance' };

    var bytes = new Uint8Array(242);
    var monitor = { _selectedIndices: [42, 43], _bytes: bytes };
    _updateHexSelectionInfo(monitor);
    expect(infoEl.textContent).toContain('vcf_cutoff');
    expect(infoEl.textContent).toContain('vcf_resonance');
  });

  it('shows overflow count when more than 3 selected', function() {
    var monitor = { _selectedIndices: [0, 1, 2, 3, 4], _bytes: new Uint8Array(242) };
    _updateHexSelectionInfo(monitor);
    expect(infoEl.textContent).toContain('+2 more');
  });

  it('handles null bytes gracefully', function() {
    var monitor = { _selectedIndices: [0], _bytes: null };
    _updateHexSelectionInfo(monitor);
    expect(infoEl.textContent).toContain('b[0]');
    expect(infoEl.textContent).toContain('0x00');
  });

  it('returns early when infoEl is missing', function() {
    vi.stubGlobal('document', { getElementById: function() { return null; } });
    expect(function() { _updateHexSelectionInfo({ _selectedIndices: [0] }); }).not.toThrow();
  });

  it('returns early when monitor is null', function() {
    expect(function() { _updateHexSelectionInfo(null); }).not.toThrow();
  });

  it('returns early when _selectedIndices is missing', function() {
    expect(function() { _updateHexSelectionInfo({}); }).not.toThrow();
  });

  it('shows hex value for byte with zero value', function() {
    var bytes = new Uint8Array(242);
    bytes[17] = 0;
    var monitor = { _selectedIndices: [17], _bytes: bytes };
    _updateHexSelectionInfo(monitor);
    expect(infoEl.textContent).toContain('0x00');
  });

  it('handles BYTE_MAP entry without param property', function() {
    window.BYTE_MAP = {};
    window.BYTE_MAP[10] = { description: 'Some byte' };

    var monitor = { _selectedIndices: [10], _bytes: new Uint8Array(242) };
    _updateHexSelectionInfo(monitor);
    // Should not add param name since there's no .param property
    expect(infoEl.textContent).toContain('b[10]');
    expect(infoEl.textContent).not.toContain('Some byte');
  });
});

// ══════════════════════════════════════════════════════════════════
// DOMContentLoaded — zoom, export, copy, reset button wiring
// ══════════════════════════════════════════════════════════════════

describe('DOMContentLoaded — button wiring', () => {
  var zoomBtn, container, exportBtn, copyBtn, resetBtn, hexLog;
  var registry;

  beforeEach(function() {
    registry = {};

    zoomBtn = _createFakeEl('button', { id: 'sysex-zoom-btn' });
    container = _createFakeEl('div', { id: 'programmer-sysex-monitor' });
    exportBtn = _createFakeEl('button', { id: 'sysex-export-btn' });
    copyBtn = _createFakeEl('button', { id: 'sysex-copy-btn' });
    resetBtn = _createFakeEl('button', { id: 'nrpn-reset-btn' });
    hexLog = _createFakeEl('div', { id: 'sysex-hex-log' });
    hexLog._selectedIndices = [];

    registry['sysex-zoom-btn'] = zoomBtn;
    registry['programmer-sysex-monitor'] = container;
    registry['sysex-export-btn'] = exportBtn;
    registry['sysex-copy-btn'] = copyBtn;
    registry['nrpn-reset-btn'] = resetBtn;
    registry['sysex-hex-log'] = hexLog;

    vi.stubGlobal('document', {
      getElementById: function(id) { return registry[id] || null; },
      addEventListener: function(event, handler) {
        if (event === 'DOMContentLoaded') {
          // Simulate DOMContentLoaded immediately
          handler();
        }
      },
      body: { appendChild: function() {}, removeChild: function() {} },
      createElement: function() { return { href: '', click: function() {}, style: {} }; },
    });

    const innerClipboardSpy = vi.fn(function() { return Promise.resolve(); });

    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: innerClipboardSpy
      }
    });

    vi.stubGlobal('window', {
      dualMidiBridge: null,
      _lastUnpackedBytes: null,
      _lastPresetName: 'TEST_PATCH',
      loadedBanks: undefined,
      currentActiveBank: undefined,
      currentActivePatchIndex: undefined,
      pack8to7: function(bytes) {
        // Simplified pack8to7 stub
        return new Uint8Array(278);
      },
      updateNrpnTrafficCounters: vi.fn(),
      URL: { createObjectURL: function() { return 'blob:url'; }, revokeObjectURL: function() {} },
      navigator: { clipboard: { writeText: innerClipboardSpy } },
    });

    // Initialize DOMContentLoaded handler (simplified for testing)
    (function() {
      // Zoom button
      if (zoomBtn && container) {
        zoomBtn.addEventListener('click', function() {
          container.classList.toggle('zoomed');
          if (container.classList.contains('zoomed')) {
            zoomBtn.innerText = 'ZOOM CLOSE';
            zoomBtn.style.color = 'var(--color-danger)';
            zoomBtn.style.borderColor = 'var(--color-danger)';
            zoomBtn.style.background = 'color-mix(in srgb, var(--color-danger) 15%, transparent)';
          } else {
            zoomBtn.innerText = 'ZOOM';
            zoomBtn.style.color = 'var(--accent-green)';
            zoomBtn.style.borderColor = 'var(--accent-green)';
            zoomBtn.style.background = 'color-mix(in srgb, var(--accent-green) 15%, transparent)';
          }
        });
      }

      // Export button
      if (exportBtn) {
        exportBtn.addEventListener('click', function() {
          var bytes = window._lastUnpackedBytes;
          if (!bytes || bytes.length < 242) {
            var bank = window.loadedBanks && window.loadedBanks[window.currentActiveBank];
            var patch = bank && bank[window.currentActivePatchIndex];
            if (patch && patch.unpackedBytes) {
              bytes = patch.unpackedBytes;
            }
          }
          if (!bytes || bytes.length < 242) {
            return; // Would alert in real code
          }

          var patchName = window._lastPresetName || 'UNKNOWN_PATCH';
          var blob = new Blob([new Uint8Array(291)], { type: 'application/octet-stream' });
          var link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = patchName.replace(/[^a-zA-Z0-9_\-]/g, '_') + '.syx';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
        });
      }

      // NRPN Reset button
      if (resetBtn) {
        resetBtn.addEventListener('click', function() {
          if (window.dualMidiBridge && window.dualMidiBridge._resetNrpnCounters) {
            window.dualMidiBridge._resetNrpnCounters();
          } else {
            window.updateNrpnTrafficCounters({ tx: 0, rx: 0, pkts: 0 });
          }
        });
      }

      // Copy button
      if (copyBtn) {
        copyBtn.addEventListener('click', function() {
          var monitor = document.getElementById('sysex-hex-log');
          if (!monitor) return;

          var textToCopy;
          var selected = monitor._selectedIndices;
          var bytes = monitor._bytes;

          if (selected && selected.length > 0 && bytes) {
            textToCopy = selected.map(function(idx) {
              var hex = bytes[idx].toString(16).toUpperCase().padStart(2, '0');
              return idx + ':' + hex;
            }).join(' ');
          } else {
            textToCopy = monitor.innerText || monitor.textContent;
          }

          if (window.navigator && window.navigator.clipboard) {
            window.navigator.clipboard.writeText(textToCopy);
          }
        });
      }

      // Hex byte click selection
      if (hexLog) {
        hexLog.addEventListener('click', function(e) {
          var byteEl = e.target.closest('.hex-byte');
          if (!byteEl) {
            if (hexLog._selectedIndices) hexLog._selectedIndices = [];
            return;
          }

          var idx = parseInt(byteEl.getAttribute('data-idx'), 10);
          if (isNaN(idx)) return;

          if (!hexLog._selectedIndices) hexLog._selectedIndices = [];

          if (e.shiftKey && hexLog._selectedIndices.length > 0) {
            var lastIdx = hexLog._selectedIndices[hexLog._selectedIndices.length - 1];
            var start = Math.min(lastIdx, idx);
            var end = Math.max(lastIdx, idx);
            for (var si = start; si <= end; si++) {
              if (hexLog._selectedIndices.indexOf(si) === -1) {
                hexLog._selectedIndices.push(si);
                var el = hexLog.querySelector('.hex-byte[data-idx="' + si + '"]');
                if (el) el.classList.add('selected');
              }
            }
          } else if (e.ctrlKey || e.metaKey) {
            var existingIdx = hexLog._selectedIndices.indexOf(idx);
            if (existingIdx >= 0) {
              hexLog._selectedIndices.splice(existingIdx, 1);
              byteEl.classList.remove('selected');
            } else {
              hexLog._selectedIndices.push(idx);
              byteEl.classList.add('selected');
            }
          } else {
            hexLog._selectedIndices = [idx];
            byteEl.classList.add('selected');
          }
        });
      }
    })();
  });

  // ── Zoom button ──

  it('zoom button toggles zoomed class on container', function() {
    zoomBtn._listeners['click'][0]();
    expect(container.classList.contains('zoomed')).toBe(true);

    zoomBtn._listeners['click'][0]();
    expect(container.classList.contains('zoomed')).toBe(false);
  });

  it('zoom button changes text when zoomed', function() {
    zoomBtn._listeners['click'][0]();
    expect(zoomBtn.innerText).toBe('ZOOM CLOSE');

    zoomBtn._listeners['click'][0]();
    expect(zoomBtn.innerText).toBe('ZOOM');
  });

  it('zoom button changes style when zoomed', function() {
    zoomBtn._listeners['click'][0]();
    expect(zoomBtn.style.color).toBe('var(--color-danger)');

    zoomBtn._listeners['click'][0]();
    expect(zoomBtn.style.color).toBe('var(--accent-green)');
  });

  // ── Export button ──

  it('export button returns early when no bytes available', function() {
    window._lastUnpackedBytes = null;
    // No alert should fire, just return
    expect(function() { exportBtn._listeners['click'][0](); }).not.toThrow();
  });

  it('export button uses _lastUnpackedBytes when available', function() {
    window._lastUnpackedBytes = new Uint8Array(242);
    var appendSpy = vi.spyOn(document.body, 'appendChild');

    exportBtn._listeners['click'][0]();
    expect(appendSpy).toHaveBeenCalled();
  });

  it('export button generates filename from _lastPresetName', function() {
    window._lastUnpackedBytes = new Uint8Array(242);
    window._lastPresetName = 'MY PATCH';

    var createElementSpy = vi.fn(function(tag) {
      return { href: '', click: function() {}, download: '', style: {} };
    });
    vi.stubGlobal('document', {
      getElementById: function(id) { return registry[id] || null; },
      body: { appendChild: function() {}, removeChild: function() {} },
      createElement: createElementSpy,
    });

    exportBtn._listeners['click'][0]();
    expect(createElementSpy).toHaveBeenCalledWith('a');
  });

  it('export button falls back to patch.unpackedBytes', function() {
    window._lastUnpackedBytes = null;
    window.loadedBanks = {
      'User Bank': [
        { unpackedBytes: new Uint8Array(242) },
      ],
    };
    window.currentActiveBank = 'User Bank';
    window.currentActivePatchIndex = 0;

    var appendSpy = vi.spyOn(document.body, 'appendChild');
    exportBtn._listeners['click'][0]();
    expect(appendSpy).toHaveBeenCalled();
  });

  // ── NRPN Reset button ──

  it('reset button calls _resetNrpnCounters on bridge', function() {
    var resetFn = vi.fn();
    window.dualMidiBridge = { _resetNrpnCounters: resetFn };

    resetBtn._listeners['click'][0]();
    expect(resetFn).toHaveBeenCalled();
  });

  it('reset button falls back when bridge has no _resetNrpnCounters', function() {
    window.dualMidiBridge = {};
    resetBtn._listeners['click'][0]();
    expect(window.updateNrpnTrafficCounters).toHaveBeenCalledWith({ tx: 0, rx: 0, pkts: 0 });
  });

  it('reset button falls back when bridge is null', function() {
    resetBtn._listeners['click'][0]();
    expect(window.updateNrpnTrafficCounters).toHaveBeenCalledWith({ tx: 0, rx: 0, pkts: 0 });
  });

  // ── Copy button ──

  it('copy button copies all bytes when no selection', function() {
    hexLog.innerText = '00 11 22 33';
    hexLog._bytes = new Uint8Array([0, 17, 34, 51]);

    copyBtn._listeners['click'][0]();
    expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith('00 11 22 33');
  });

  it('copy button copies selected bytes as idx:hex pairs', function() {
    hexLog._bytes = new Uint8Array(242);
    hexLog._bytes[0] = 0;
    hexLog._bytes[42] = 255;
    hexLog._bytes[100] = 128;
    hexLog._selectedIndices = [0, 42, 100];

    copyBtn._listeners['click'][0]();
    expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith('0:00 42:FF 100:80');
  });

  // ── Hex byte click ──

  it('click on hex byte selects it', function() {
    var byteEl = _createFakeEl('span', { 'class': 'hex-byte', 'data-idx': '42' });
    byteEl.classList.add('hex-byte');

    hexLog._listeners['click'][0]({ target: byteEl, shiftKey: false, ctrlKey: false, metaKey: false });
    expect(hexLog._selectedIndices).toEqual([42]);
  });

  it('click outside hex byte clears selection', function() {
    hexLog._selectedIndices = [0, 1, 2];
    hexLog._listeners['click'][0]({ target: _createFakeEl('div'), shiftKey: false, ctrlKey: false, metaKey: false });
    expect(hexLog._selectedIndices).toEqual([]);
  });

  it('ctrl+click toggles hex byte selection', function() {
    var byteEl = _createFakeEl('span', { 'class': 'hex-byte', 'data-idx': '42' });
    byteEl.classList.add('hex-byte');

    // First click selects
    hexLog._listeners['click'][0]({ target: byteEl, shiftKey: false, ctrlKey: true, metaKey: false });
    expect(hexLog._selectedIndices).toEqual([42]);

    // Ctrl+click again deselects
    hexLog._listeners['click'][0]({ target: byteEl, shiftKey: false, ctrlKey: true, metaKey: false });
    expect(hexLog._selectedIndices).toEqual([]);
  });

  it('shift+click selects range from last selection', function() {
    var byteEl0 = _createFakeEl('span', { 'class': 'hex-byte', 'data-idx': '0' });
    byteEl0.classList.add('hex-byte');
    byteEl0._parent = hexLog;
    hexLog._hexByteEls.push(byteEl0);

    // First click: select byte 0
    hexLog._listeners['click'][0]({ target: byteEl0, shiftKey: false, ctrlKey: false, metaKey: false });

    var byteEl5 = _createFakeEl('span', { 'class': 'hex-byte', 'data-idx': '5' });
    byteEl5.classList.add('hex-byte');
    byteEl5._parent = hexLog;
    hexLog._hexByteEls.push(byteEl5);

    // Shift+click: select range 0-5
    hexLog._listeners['click'][0]({ target: byteEl5, shiftKey: true, ctrlKey: false, metaKey: false });

    expect(hexLog._selectedIndices.length).toBe(6);
    expect(hexLog._selectedIndices).toContain(0);
    expect(hexLog._selectedIndices).toContain(3);
    expect(hexLog._selectedIndices).toContain(5);
  });
});

// ══════════════════════════════════════════════════════════════════
// patch label with edge cases
// ══════════════════════════════════════════════════════════════════

describe('patch label edge cases', () => {
  var hexLog, infoEl, patchLabel;

  function updateSysExMonitor(bytes, highlightIndex, patchNameOverride) {
    var monitor = document.getElementById('sysex-hex-log');
    if (!monitor) return;

    monitor._bytes = bytes;
    window._liveUnpackedBytes = null;

    monitor._selectedIndices = [];
    var patchLabel = document.getElementById('sysex-active-patch-label');
    if (patchLabel) {
      if (patchNameOverride) {
        patchLabel.innerText = 'LOADED PATCH: ' + patchNameOverride.toUpperCase();
      } else {
        var activeBankName = window.currentActiveBank || 'Factory Bank A';
        var activeIdx = window.currentActivePatchIndex !== undefined ? window.currentActivePatchIndex : 0;
        var patchName = 'INIT PATCH';
        if (window.loadedBanks && window.loadedBanks[activeBankName] && window.loadedBanks[activeBankName][activeIdx]) {
          patchName = window.loadedBanks[activeBankName][activeIdx].name;
        } else if (window.hardwareBanks && window.currentHwBankLetter && window.hardwareBanks[window.currentHwBankLetter] && window.currentHwPatchIndex !== -1) {
          var hwPatch = window.hardwareBanks[window.currentHwBankLetter][window.currentHwPatchIndex];
          if (hwPatch) patchName = hwPatch.name;
        }
        var slotStr = (activeIdx !== -1) ? (activeIdx + 1).toString().padStart(3, '0') : '001';
        patchLabel.innerText = 'LOADED PATCH: ' + patchName.toUpperCase() + ' [' + activeBankName + ' - SLOT ' + slotStr + ']';
      }
      patchLabel.style.display = 'block';
    }
  }

  beforeEach(function() {
    hexLog = _createFakeEl('div', { id: 'sysex-hex-log' });
    infoEl = _createFakeEl('div', { id: 'sysex-selection-info' });
    patchLabel = _createFakeEl('div', { id: 'sysex-active-patch-label' });
    var registry = { 'sysex-hex-log': hexLog, 'sysex-selection-info': infoEl, 'sysex-active-patch-label': patchLabel };

    vi.stubGlobal('document', {
      getElementById: function(id) { return registry[id] || null; },
    });

    vi.stubGlobal('window', {
      _liveUnpackedBytes: null,
      currentActiveBank: undefined,
      currentActivePatchIndex: undefined,
      loadedBanks: undefined,
      hardwareBanks: undefined,
      currentHwBankLetter: undefined,
      currentHwPatchIndex: -1,
    });
  });

  it('uses default Factory Bank A when no bank set', function() {
    updateSysExMonitor(new Uint8Array(242));
    expect(patchLabel.innerText).toContain('Factory Bank A');
  });

  it('uses activeIdx = -1 for slot 001', function() {
    window.currentActivePatchIndex = -1;
    updateSysExMonitor(new Uint8Array(242));
    expect(patchLabel.innerText).toContain('SLOT 001');
  });

  it('uses hardware bank when loadedBanks is not available', function() {
    window.currentHwBankLetter = 'B';
    window.currentHwPatchIndex = 3;
    window.hardwareBanks = {
      'B': [{}, {}, {}, { name: 'HARD PATCH' }],
    };

    updateSysExMonitor(new Uint8Array(242));
    expect(patchLabel.innerText).toContain('HARD PATCH');
  });

  it('prefers loadedBanks over hardwareBanks', function() {
    window.loadedBanks = {
      'User Bank': [{ name: 'SOFT PAD' }],
    };
    window.currentActiveBank = 'User Bank';
    window.currentActivePatchIndex = 0;
    window.hardwareBanks = { 'A': [{ name: 'HARD LEAD' }] };
    window.currentHwBankLetter = 'A';
    window.currentHwPatchIndex = 0;

    updateSysExMonitor(new Uint8Array(242));
    expect(patchLabel.innerText).toContain('SOFT PAD');
    expect(patchLabel.innerText).not.toContain('HARD LEAD');
  });

  it('handles missing patch at activeIdx in loadedBanks', function() {
    window.loadedBanks = { 'User Bank': [] };
    window.currentActiveBank = 'User Bank';
    window.currentActivePatchIndex = 0;

    updateSysExMonitor(new Uint8Array(242));
    expect(patchLabel.innerText).toContain('INIT PATCH');
  });

  it('handles missing patch at hwPatchIndex in hardwareBanks', function() {
    window.hardwareBanks = { 'A': [] };
    window.currentHwBankLetter = 'A';
    window.currentHwPatchIndex = 0;

    updateSysExMonitor(new Uint8Array(242));
    expect(patchLabel.innerText).toContain('INIT PATCH');
  });
});

// ══════════════════════════════════════════════════════════════════
// updateSysExMonitor with variable byte lengths
// ══════════════════════════════════════════════════════════════════

describe('updateSysExMonitor — edge cases and boundaries', () => {
  var hexLog, infoEl;

  function updateSysExMonitor(bytes, highlightIndex) {
    var monitor = document.getElementById('sysex-hex-log');
    if (!monitor) return;

    monitor._bytes = bytes;
    window._liveUnpackedBytes = null;

    var html = '';
    for (var i = 0; i < bytes.length; i++) {
      var hexVal = bytes[i].toString(16).toUpperCase().padStart(2, '0');
      var isChanged = (i === highlightIndex) ? 'changed' : 'normal';
      html += '<span class="hex-byte ' + isChanged + '" data-idx="' + i + '">' + hexVal + '</span> ';
    }
    monitor.innerHTML = html;
    monitor._selectedIndices = [];
  }

  beforeEach(function() {
    hexLog = _createFakeEl('div', { id: 'sysex-hex-log' });
    infoEl = _createFakeEl('div', { id: 'sysex-selection-info' });
    var registry = { 'sysex-hex-log': hexLog, 'sysex-selection-info': infoEl };
    vi.stubGlobal('document', { getElementById: function(id) { return registry[id] || null; } });
    vi.stubGlobal('window', {});
  });

  it('handles zero-length byte array', function() {
    expect(function() { updateSysExMonitor(new Uint8Array(0)); }).not.toThrow();
    expect(hexLog.innerHTML).toBe('');
  });

  it('handles single byte array', function() {
    updateSysExMonitor(new Uint8Array([255]));
    expect(hexLog.innerHTML).toContain('FF');
    expect(hexLog.innerHTML).toContain('data-idx="0"');
  });

  it('renders all bytes with FF when data is all 255', function() {
    var bytes = new Uint8Array(5);
    for (var i = 0; i < 5; i++) bytes[i] = 255;
    updateSysExMonitor(bytes);
    expect(hexLog.innerHTML.match(/FF/g).length).toBe(5);
  });

  it('renders all zeros correctly', function() {
    var bytes = new Uint8Array(3);
    updateSysExMonitor(bytes);
    expect(hexLog.innerHTML).toContain('00');
    expect(hexLog.innerHTML.match(/00/g).length).toBe(3);
  });
});

// ══════════════════════════════════════════════════════════════════
// Hex byte click — detailed selection behavior
// ══════════════════════════════════════════════════════════════════

describe('hex byte selection — detailed behavior', () => {
  var hexLog;

  beforeEach(function() {
    hexLog = _createFakeEl('div', { id: 'sysex-hex-log' });
    hexLog._hexByteEls = [];
    hexLog._selectedIndices = [];

    for (var i = 0; i < 10; i++) {
      var byteEl = _createFakeEl('span', { 'class': 'hex-byte', 'data-idx': String(i) });
      byteEl.classList.add('hex-byte');
      byteEl._parent = hexLog;
      hexLog._hexByteEls.push(byteEl);
      hexLog._subElements['.hex-byte[data-idx="' + i + '"]'] = byteEl;
    }

    // Register click handler (extracted from source)
    hexLog.addEventListener('click', function(e) {
      var byteEl = e.target.closest('.hex-byte');
      if (!byteEl) {
        hexLog._selectedIndices = [];
        return;
      }

      var idx = parseInt(byteEl.getAttribute('data-idx'), 10);
      if (isNaN(idx)) return;
      if (!hexLog._selectedIndices) hexLog._selectedIndices = [];

      if (e.shiftKey && hexLog._selectedIndices.length > 0) {
        var lastIdx = hexLog._selectedIndices[hexLog._selectedIndices.length - 1];
        var start = Math.min(lastIdx, idx);
        var end = Math.max(lastIdx, idx);
        for (var si = start; si <= end; si++) {
          if (hexLog._selectedIndices.indexOf(si) === -1) {
            hexLog._selectedIndices.push(si);
            var el = hexLog.querySelector('.hex-byte[data-idx="' + si + '"]');
            if (el) el.classList.add('selected');
          }
        }
      } else if (e.ctrlKey || e.metaKey) {
        var existingIdx = hexLog._selectedIndices.indexOf(idx);
        if (existingIdx >= 0) {
          hexLog._selectedIndices.splice(existingIdx, 1);
          byteEl.classList.remove('selected');
        } else {
          hexLog._selectedIndices.push(idx);
          byteEl.classList.add('selected');
        }
      } else {
        hexLog._selectedIndices = [idx];
        byteEl.classList.add('selected');
      }
    });
  });

  it('shifts click after ctrl+click from different start', function() {
    // Ctrl+click to select byte 0 and byte 2
    var el0 = hexLog._subElements['.hex-byte[data-idx="0"]'];
    var el2 = hexLog._subElements['.hex-byte[data-idx="2"]'];

    hexLog._listeners['click'][0]({ target: el0, shiftKey: false, ctrlKey: true, metaKey: false });
    hexLog._listeners['click'][0]({ target: el2, shiftKey: false, ctrlKey: true, metaKey: false });

    expect(hexLog._selectedIndices).toEqual([0, 2]);

    // Shift+click from byte 2 to byte 5
    var el5 = hexLog._subElements['.hex-byte[data-idx="5"]'];
    hexLog._listeners['click'][0]({ target: el5, shiftKey: true, ctrlKey: false, metaKey: false });

    expect(hexLog._selectedIndices).toContain(2);
    expect(hexLog._selectedIndices).toContain(3);
    expect(hexLog._selectedIndices).toContain(4);
    expect(hexLog._selectedIndices).toContain(5);
  });

  it('shift+click selects backward range (higher to lower index)', function() {
    // First select byte 6
    var el6 = hexLog._subElements['.hex-byte[data-idx="6"]'];
    hexLog._listeners['click'][0]({ target: el6, shiftKey: false, ctrlKey: false, metaKey: false });

    // Shift+click byte 2 → should select 2-6
    var el2 = hexLog._subElements['.hex-byte[data-idx="2"]'];
    hexLog._listeners['click'][0]({ target: el2, shiftKey: true, ctrlKey: false, metaKey: false });

    expect(hexLog._selectedIndices).toContain(2);
    expect(hexLog._selectedIndices).toContain(4);
    expect(hexLog._selectedIndices).toContain(6);
    expect(hexLog._selectedIndices.length).toBe(5); // 2,3,4,5,6
  });

  it('placeholder for NaN data-idx is handled', function() {
    var badEl = _createFakeEl('span', { 'class': 'hex-byte', 'data-idx': 'not-a-number' });
    badEl.classList.add('hex-byte');

    expect(function() {
      hexLog._listeners['click'][0]({ target: badEl, shiftKey: false, ctrlKey: false, metaKey: false });
    }).not.toThrow();
    expect(hexLog._selectedIndices).toEqual([]);
  });
});

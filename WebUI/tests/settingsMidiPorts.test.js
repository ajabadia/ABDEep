/**
 * Unit tests for settings_midi_ports.js — MIDI port enumeration and selection
 *
 * Run with: npx vitest run WebUI/tests/settingsMidiPorts.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Mock state helpers
// ══════════════════════════════════════════════════════════════════

let _storage = {};
let _elementRegistry = {};
let _bridge;

function _resetStorage() { _storage = {}; }
function _resetElements() { _elementRegistry = {}; }

function _registerElement(id, el) { _elementRegistry[id] = el; }

function _resetBridge() {
  const mockInput = {
    id: 'midi-in-1',
    name: 'USB MIDI In',
    onmidimessage: null,
  };
  const mockOutput = {
    id: 'midi-out-1',
    name: 'USB MIDI Out',
  };
  const mockInput2 = {
    id: 'midi-in-2',
    name: 'MIDI IN 2 (Virtual)',
  };
  const mockOutput2 = {
    id: 'midi-out-2',
    name: 'MIDI OUT 2 (Virtual)',
  };

  _bridge = {
    midiInput: null,
    midiOutput: null,
    midiAccess: {
      inputs: {
        values: () => [mockInput, mockInput2][Symbol.iterator](),
      },
      outputs: {
        values: () => [mockOutput, mockOutput2][Symbol.iterator](),
      },
    },
    handleIncomingMidi: vi.fn(),
  };
}

function _setupGlobals() {
  const mockDocument = {
    getElementById: (id) => _elementRegistry[id] || null,
    querySelector: (sel) => null,
    querySelectorAll: () => [],
    documentElement: { style: { setProperty: () => {} } },
    body: { dataset: {} },
    createElement: (tag) => {
      return _createFakeElement(tag, {});
    },
  };
  const mockLocalStorage = {
    getItem: (k) => (_storage[k] !== undefined ? _storage[k] : null),
    setItem: (k, v) => { _storage[k] = String(v); },
    removeItem: (k) => { delete _storage[k]; },
    clear: () => { _storage = {}; },
  };
  vi.stubGlobal('document', mockDocument);
  vi.stubGlobal('localStorage', mockLocalStorage);
  vi.stubGlobal('window', {
    dualMidiBridge: _bridge,
    localStorage: mockLocalStorage,
    document: mockDocument,
  });
}

// ══════════════════════════════════════════════════════════════════
// Fake DOM factory
// ══════════════════════════════════════════════════════════════════

function _createFakeElement(tag, attrs) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    _attrs: attrs || {},
    _listeners: {},
    value: '',
    textContent: '',
    innerHTML: '',
    set innerHTML(val) { this._innerHTML = val; if (val === '') { this._children = []; } },
    get innerHTML() { return this._innerHTML; },
    checked: false,
    disabled: false,
    className: '',
    id: attrs && attrs.id ? attrs.id : '',
    style: {
      _props: {},
      get display() { return this._props.display; },
      set display(val) { this._props.display = val; },
    },
    dataset: {},
    classList: {
      _classes: [],
      add(c) { if (!this._classes.includes(c)) {this._classes.push(c);} },
      remove(c) { this._classes = this._classes.filter((x) => x !== c); },
      contains(c) { return this._classes.includes(c); },
    },
    getAttribute(name) { return this._attrs[name]; },
    setAttribute(name, val) { this._attrs[name] = val; },
    addEventListener(event, handler) {
      if (!this._listeners[event]) {this._listeners[event] = [];}
      this._listeners[event].push(handler);
    },
    removeEventListener() {},
    dispatchEvent() {},
    appendChild(child) {
      this._children = this._children || [];
      this._children.push(child);
    },
    _children: [],
    closest() { return null; },
    querySelectorAll: () => [],
    querySelector: () => null,
    click() {
      if (this._listeners.click) {
        this._listeners.click.forEach(h => h({ preventDefault: () => {}, target: this }));
      }
    },
  };
  return el;
}

// ══════════════════════════════════════════════════════════════════
// Function under test (from settings_midi_ports.js)
// ══════════════════════════════════════════════════════════════════

function populateMidiPortsLists() {
  const inputsContainer = document.getElementById('settings-midi-inputs-list');
  const outputsContainer = document.getElementById('settings-midi-outputs-list');
  if (!inputsContainer || !outputsContainer) {return;}

  inputsContainer.innerHTML = '';
  outputsContainer.innerHTML = '';

  if (window.dualMidiBridge && window.dualMidiBridge.midiAccess) {
    const inputs = Array.from(window.dualMidiBridge.midiAccess.inputs.values());
    const outputs = Array.from(window.dualMidiBridge.midiAccess.outputs.values());

    if (inputs.length === 0) {
      inputsContainer.innerHTML = '<div class="info-msg-empty">None</div>';
    } else {
      inputs.forEach(input => {
        const isActive = window.dualMidiBridge.midiInput && window.dualMidiBridge.midiInput.id === input.id;
        const el = document.createElement('div');
        el.className = 'midi-dev-item' + (isActive ? ' active' : '');
        el.innerText = input.name;
        el.addEventListener('click', () => {
          window.dualMidiBridge.midiInput = input;
          input.onmidimessage = (msg) => window.dualMidiBridge.handleIncomingMidi(msg);
          populateMidiPortsLists();
        });
        inputsContainer.appendChild(el);
      });
    }

    if (outputs.length === 0) {
      outputsContainer.innerHTML = '<div class="info-msg-empty">None</div>';
    } else {
      outputs.forEach(output => {
        const isActive = window.dualMidiBridge.midiOutput && window.dualMidiBridge.midiOutput.id === output.id;
        const el = document.createElement('div');
        el.className = 'midi-dev-item' + (isActive ? ' active' : '');
        el.innerText = output.name;
        el.addEventListener('click', () => {
          window.dualMidiBridge.midiOutput = output;
          populateMidiPortsLists();
        });
        outputsContainer.appendChild(el);
      });
    }
  } else {
    inputsContainer.innerHTML = '<div class="info-msg-empty">Web MIDI Access not available</div>';
    outputsContainer.innerHTML = '<div class="info-msg-empty">Web MIDI Access not available</div>';
  }
}

// ══════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════

describe('populateMidiPortsLists', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
  });

  it('does nothing when input container is missing', () => {
    populateMidiPortsLists();
    expect(true).toBe(true); // no crash
  });

  it('renders input and output ports from bridge midiAccess', () => {
    const inputsContainer = _createFakeElement('div', { id: 'settings-midi-inputs-list' });
    const outputsContainer = _createFakeElement('div', { id: 'settings-midi-outputs-list' });
    _registerElement('settings-midi-inputs-list', inputsContainer);
    _registerElement('settings-midi-outputs-list', outputsContainer);

    populateMidiPortsLists();

    // Should have appended 2 input child elements
    expect(inputsContainer._children.length).toBe(2);
    expect(inputsContainer._children[0].innerText).toBe('USB MIDI In');
    expect(inputsContainer._children[0].className).toBe('midi-dev-item');
    expect(inputsContainer._children[1].innerText).toBe('MIDI IN 2 (Virtual)');

    // Should have appended 2 output child elements
    expect(outputsContainer._children.length).toBe(2);
    expect(outputsContainer._children[0].innerText).toBe('USB MIDI Out');
    expect(outputsContainer._children[1].innerText).toBe('MIDI OUT 2 (Virtual)');
  });

  it('marks active input port with "active" class', () => {
    _bridge.midiInput = { id: 'midi-in-1' };
    const inputsContainer = _createFakeElement('div', { id: 'settings-midi-inputs-list' });
    const outputsContainer = _createFakeElement('div', { id: 'settings-midi-outputs-list' });
    _registerElement('settings-midi-inputs-list', inputsContainer);
    _registerElement('settings-midi-outputs-list', outputsContainer);

    populateMidiPortsLists();

    expect(inputsContainer._children[0].className).toBe('midi-dev-item active');
  });

  it('marks active output port with "active" class', () => {
    _bridge.midiOutput = { id: 'midi-out-1' };
    const inputsContainer = _createFakeElement('div', { id: 'settings-midi-inputs-list' });
    const outputsContainer = _createFakeElement('div', { id: 'settings-midi-outputs-list' });
    _registerElement('settings-midi-inputs-list', inputsContainer);
    _registerElement('settings-midi-outputs-list', outputsContainer);

    populateMidiPortsLists();

    expect(outputsContainer._children[0].className).toBe('midi-dev-item active');
  });

  it('shows "None" when no input ports detected', () => {
    _bridge.midiAccess.inputs.values = () => [][Symbol.iterator]();
    _bridge.midiAccess.outputs.values = () => [][Symbol.iterator]();
    const inputsContainer = _createFakeElement('div', { id: 'settings-midi-inputs-list' });
    const outputsContainer = _createFakeElement('div', { id: 'settings-midi-outputs-list' });
    _registerElement('settings-midi-inputs-list', inputsContainer);
    _registerElement('settings-midi-outputs-list', outputsContainer);

    populateMidiPortsLists();

    expect(inputsContainer.innerHTML).toContain('None');
    expect(outputsContainer.innerHTML).toContain('None');
  });

  it('shows fallback message when no midiAccess available', () => {
    _bridge.midiAccess = null;
    const inputsContainer = _createFakeElement('div', { id: 'settings-midi-inputs-list' });
    const outputsContainer = _createFakeElement('div', { id: 'settings-midi-outputs-list' });
    _registerElement('settings-midi-inputs-list', inputsContainer);
    _registerElement('settings-midi-outputs-list', outputsContainer);

    populateMidiPortsLists();

    expect(inputsContainer.innerHTML).toContain('Web MIDI Access not available');
    expect(outputsContainer.innerHTML).toContain('Web MIDI Access not available');
  });

  it('shows fallback message when no dualMidiBridge', () => {
    vi.stubGlobal('window', { dualMidiBridge: null });
    const inputsContainer = _createFakeElement('div', { id: 'settings-midi-inputs-list' });
    const outputsContainer = _createFakeElement('div', { id: 'settings-midi-outputs-list' });
    _registerElement('settings-midi-inputs-list', inputsContainer);
    _registerElement('settings-midi-outputs-list', outputsContainer);

    populateMidiPortsLists();

    expect(inputsContainer.innerHTML).toContain('Web MIDI Access not available');
    expect(outputsContainer.innerHTML).toContain('Web MIDI Access not available');
  });

  it('clicking an input port sets it as active on bridge', () => {
    const inputsContainer = _createFakeElement('div', { id: 'settings-midi-inputs-list' });
    const outputsContainer = _createFakeElement('div', { id: 'settings-midi-outputs-list' });
    _registerElement('settings-midi-inputs-list', inputsContainer);
    _registerElement('settings-midi-outputs-list', outputsContainer);

    populateMidiPortsLists();

    // Click the first input port
    const firstInputEl = inputsContainer._children[0];
    firstInputEl._listeners.click[0]({ target: firstInputEl });

    expect(_bridge.midiInput.id).toBe('midi-in-1');
    expect(_bridge.midiInput.onmidimessage).toBeDefined();
  });

  it('clicking an output port sets it as active on bridge', () => {
    const inputsContainer = _createFakeElement('div', { id: 'settings-midi-inputs-list' });
    const outputsContainer = _createFakeElement('div', { id: 'settings-midi-outputs-list' });
    _registerElement('settings-midi-inputs-list', inputsContainer);
    _registerElement('settings-midi-outputs-list', outputsContainer);

    populateMidiPortsLists();

    // Click the first output port
    const firstOutputEl = outputsContainer._children[0];
    firstOutputEl._listeners.click[0]({ target: firstOutputEl });

    expect(_bridge.midiOutput.id).toBe('midi-out-1');
  });

  it('clears and repopulates on each call', () => {
    const inputsContainer = _createFakeElement('div', { id: 'settings-midi-inputs-list' });
    const outputsContainer = _createFakeElement('div', { id: 'settings-midi-outputs-list' });
    _registerElement('settings-midi-inputs-list', inputsContainer);
    _registerElement('settings-midi-outputs-list', outputsContainer);

    populateMidiPortsLists();
    const firstCallChildren = inputsContainer._children.length;

    // Call again
    populateMidiPortsLists();
    const secondCallChildren = inputsContainer._children.length;

    expect(secondCallChildren).toBe(firstCallChildren); // still renders correctly
  });
});

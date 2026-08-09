/**
 * Unit tests for settings_theme.js — Theme selector (data-theme + localStorage)
 *
 * Run with: npx vitest run WebUI/tests/settingsTheme.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Mock state helpers
// ══════════════════════════════════════════════════════════════════

let _storage = {};
let _elementRegistry = {};

function _resetStorage() { _storage = {}; }
function _resetElements() { _elementRegistry = {}; }

function _registerElement(id, el) { _elementRegistry[id] = el; }

function _setupGlobals() {
  const mockDocument = {
    getElementById: (id) => _elementRegistry[id] || null,
    querySelector: (sel) => null,
    querySelectorAll: () => [],
    documentElement: { style: { setProperty: () => {} } },
    body: { dataset: {} },
    addEventListener: vi.fn(),
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
    checked: false,
    disabled: false,
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
    appendChild() {},
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

function _triggerChange(el, newValue) {
  el.value = newValue;
  const handlers = el._listeners.change || [];
  handlers.forEach((h) => h.call(el, { target: el }));
}

// ══════════════════════════════════════════════════════════════════
// Functions under test (from settings_theme.js)
// ══════════════════════════════════════════════════════════════════

function setActiveTheme(theme) {
  if (theme === 'default') {
    delete document.body.dataset.theme;
  } else {
    document.body.dataset.theme = theme;
  }
  localStorage.setItem('abd-eep-theme', theme);
  const themeSelect = document.getElementById('settings-theme-select');
  if (themeSelect) {themeSelect.value = theme;}
}

function initThemeSelector() {
  const themeSelect = document.getElementById('settings-theme-select');
  if (!themeSelect) {return;}
  const savedTheme = localStorage.getItem('abd-eep-theme') || 'default';
  setActiveTheme(savedTheme);
  themeSelect.value = savedTheme;
  themeSelect.addEventListener('change', () => {
    setActiveTheme(themeSelect.value);
  });
}

function initNavbarThemeSelector() {
  const themeMap = {
    'menu-theme-default': 'default',
    'menu-theme-red': 'red',
    'menu-theme-blue': 'blue',
    'menu-theme-green': 'green',
    'menu-theme-midnight': 'midnight',
    'menu-theme-dark-v2': 'dark-v2',
    'menu-theme-light': 'light',
    'menu-theme-juno': 'juno-106'
  };

  document.addEventListener('click', (e) => {
    const target = e.target.closest('.theme-option');
    if (target && target.id && themeMap[target.id]) {
      e.preventDefault();
      setActiveTheme(themeMap[target.id]);
    }
  });
}

// ══════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════

describe('setActiveTheme', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _setupGlobals();
  });

  it('sets red theme on body and saves to localStorage', () => {
    setActiveTheme('red');
    expect(document.body.dataset.theme).toBe('red');
    expect(_storage['abd-eep-theme']).toBe('red');
  });

  it('sets blue theme', () => {
    setActiveTheme('blue');
    expect(document.body.dataset.theme).toBe('blue');
  });

  it('sets green theme', () => {
    setActiveTheme('green');
    expect(document.body.dataset.theme).toBe('green');
  });

  it('sets midnight theme', () => {
    setActiveTheme('midnight');
    expect(document.body.dataset.theme).toBe('midnight');
  });

  it('sets dark-v2 theme', () => {
    setActiveTheme('dark-v2');
    expect(document.body.dataset.theme).toBe('dark-v2');
  });

  it('sets light theme', () => {
    setActiveTheme('light');
    expect(document.body.dataset.theme).toBe('light');
  });

  it('sets juno-106 theme', () => {
    setActiveTheme('juno-106');
    expect(document.body.dataset.theme).toBe('juno-106');
  });

  it('default theme deletes dataset.theme', () => {
    document.body.dataset.theme = 'red';
    setActiveTheme('default');
    expect(document.body.dataset.theme).toBeUndefined();
    expect(_storage['abd-eep-theme']).toBe('default');
  });

  it('updates theme select element if it exists', () => {
    const themeSelect = _createFakeElement('select', { id: 'settings-theme-select' });
    _registerElement('settings-theme-select', themeSelect);
    setActiveTheme('midnight');
    expect(themeSelect.value).toBe('midnight');
  });

  it('does not crash without theme select element', () => {
    setActiveTheme('green');
    expect(_storage['abd-eep-theme']).toBe('green');
  });
});

describe('initThemeSelector', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _setupGlobals();
  });

  it('restores saved theme and applies it', () => {
    _storage['abd-eep-theme'] = 'juno-106';
    const themeSelect = _createFakeElement('select', { id: 'settings-theme-select' });
    _registerElement('settings-theme-select', themeSelect);
    initThemeSelector();
    expect(themeSelect.value).toBe('juno-106');
    expect(document.body.dataset.theme).toBe('juno-106');
  });

  it('defaults to default theme when no saved value', () => {
    const themeSelect = _createFakeElement('select', { id: 'settings-theme-select' });
    _registerElement('settings-theme-select', themeSelect);
    initThemeSelector();
    expect(themeSelect.value).toBe('default');
  });

  it('change event saves and applies new theme', () => {
    const themeSelect = _createFakeElement('select', { id: 'settings-theme-select' });
    _registerElement('settings-theme-select', themeSelect);
    initThemeSelector();
    _triggerChange(themeSelect, 'light');
    expect(_storage['abd-eep-theme']).toBe('light');
    expect(document.body.dataset.theme).toBe('light');
  });

  it('does nothing when select element is missing', () => {
    initThemeSelector();
    expect(true).toBe(true); // no crash
  });
});

describe('initNavbarThemeSelector', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _setupGlobals();
  });

  it('registers a click handler on document', () => {
    initNavbarThemeSelector();
    expect(document.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('applies red theme when clicking a theme option', () => {
    initNavbarThemeSelector();
    // Simulate document click on a .theme-option element
    const fakeTarget = {
      closest: (sel) => {
        if (sel === '.theme-option') {
          return { id: 'menu-theme-red', closest: () => null };
        }
        return null;
      },
    };
    const clickHandler = document.addEventListener.mock.calls[0][1];
    clickHandler({ target: fakeTarget, preventDefault: () => {} });
    expect(_storage['abd-eep-theme']).toBe('red');
    expect(document.body.dataset.theme).toBe('red');
  });

  it('applies juno-106 theme via click', () => {
    initNavbarThemeSelector();
    const fakeTarget = {
      closest: (sel) => {
        if (sel === '.theme-option') {
          return { id: 'menu-theme-juno', closest: () => null };
        }
        return null;
      },
    };
    const clickHandler = document.addEventListener.mock.calls[0][1];
    clickHandler({ target: fakeTarget, preventDefault: () => {} });
    expect(_storage['abd-eep-theme']).toBe('juno-106');
    expect(document.body.dataset.theme).toBe('juno-106');
  });

  it('applies light theme via click', () => {
    initNavbarThemeSelector();
    const fakeTarget = {
      closest: (sel) => {
        if (sel === '.theme-option') {
          return { id: 'menu-theme-light', closest: () => null };
        }
        return null;
      },
    };
    const clickHandler = document.addEventListener.mock.calls[0][1];
    clickHandler({ target: fakeTarget, preventDefault: () => {} });
    expect(_storage['abd-eep-theme']).toBe('light');
  });

  it('ignores clicks not on .theme-option elements', () => {
    initNavbarThemeSelector();
    const fakeTarget = {
      closest: (sel) => null, // not a theme option
    };
    const clickHandler = document.addEventListener.mock.calls[0][1];
    clickHandler({ target: fakeTarget, preventDefault: () => {} });
    expect(_storage['abd-eep-theme']).toBeUndefined();
  });

  it('calls preventDefault on theme option clicks', () => {
    initNavbarThemeSelector();
    let prevented = false;
    const fakeTarget = {
      closest: (sel) => {
        if (sel === '.theme-option') {
          return { id: 'menu-theme-blue', closest: () => null };
        }
        return null;
      },
    };
    const clickHandler = document.addEventListener.mock.calls[0][1];
    clickHandler({ target: fakeTarget, preventDefault: () => { prevented = true; } });
    expect(prevented).toBe(true);
    expect(_storage['abd-eep-theme']).toBe('blue');
  });
});

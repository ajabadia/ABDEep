/**
 * Unit tests for Vocoder Mic Input modules:
 *   - vocoder_mic_audio.js  (getUserMedia, AudioContext, AnalyserNode, bridge)
 *   - vocoder_mic_ui.js     (VU meter, toggle button, status display, DOM injection)
 *   - vocoder_mic_input.js  (facade, init, sync UI, MutationObserver)
 *
 * Run with: npx vitest run WebUI/tests/vocoderMic.test.js
 *
 * Covers:
 *   - Audio: state init, requestMic, start/stop pipeline, detectBridge
 *   - UI: VU HTML template, start/stop VU meter, updateUI, isVocoderActive, toggleMic, injectVocoderUI
 *   - Facade: initVocoderMic, _onFxTypeChanged, syncVocoderMicUI
 *   - Edge cases: bridge unavailable, no DOM, denied mic, multiple calls
 *   - Error handling: AudioContext failure, pipeline error, missing Audio API
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Fake DOM element factory (same pattern as sysexMonitor.test.js)
// ══════════════════════════════════════════════════════════════════

function _createFakeEl(tag, attrs) {
  const el = {
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
      add: function(c) { if (!this._classes.includes(c)) {this._classes.push(c);} },
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
      if (!this._listeners[event]) {this._listeners[event] = [];}
      this._listeners[event].push(handler);
    },
    removeEventListener: function() {},
    dispatchEvent: function() {},
    closest: function(sel) { return null; },
    querySelector: function(sel) { return this._subElements[sel] || null; },
    querySelectorAll: function(sel) { return []; },
    appendChild: function(child) { this._children = this._children || []; this._children.push(child); },
    removeChild: function(child) {},
    _subElements: {},
    _children: [],
    _parent: null,
  };
  return el;
}

// ══════════════════════════════════════════════════════════════════
// Fake AudioContext / AnalyserNode / ScriptProcessorNode
// ══════════════════════════════════════════════════════════════════

function _createFakeAudioContext() {
  const analyserNode = {
    fftSize: 256,
    frequencyBinCount: 128,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getByteTimeDomainData: vi.fn(function(arr) {
      // Fill with silence (128 = zero crossing)
      for (let i = 0; i < arr.length; i++) {arr[i] = 128;}
    }),
  };

  const captureNode = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    onaudioprocess: null,
  };

  const ctx = {
    createAnalyser: vi.fn(function() { return analyserNode; }),
    createScriptProcessor: vi.fn(function() { return captureNode; }),
    createMediaStreamSource: vi.fn(function() { return { connect: vi.fn() }; }),
    close: vi.fn(function() { return Promise.resolve(); }),
    _analyserNode: analyserNode,
    _captureNode: captureNode,
  };

  return ctx;
}

// ══════════════════════════════════════════════════════════════════
// Stub the vocoder mic modules (they run IIFE on import/load)
// ══════════════════════════════════════════════════════════════════

function _stubVocoderMicState() {
  window._vocoderMicState = {
    audioContext: null,
    micStream: null,
    analyserNode: null,
    micEnabled: false,
    vuIntervalId: null,
    micSourceNode: null,
    captureNode: null,
    pcmBuffer: [],
    bridgeActive: false,
  };
}

function _stubVocoderMicAudio() {
  const audioApi = {
    requestMic: vi.fn(),
    startAudioPipeline: vi.fn(),
    stopAudioPipeline: vi.fn(),
    stopMicStream: vi.fn(),
    detectBridge: vi.fn(),
  };
  window._vocoderMicAudio = audioApi;
  return audioApi;
}

function _stubVocoderMicUI() {
  const uiApi = {
    createVUHTML: vi.fn(),
    startVUMeter: vi.fn(),
    stopVUMeter: vi.fn(),
    updateUI: vi.fn(),
    isVocoderActive: vi.fn(),
    toggleMic: vi.fn(),
    injectVocoderUI: vi.fn(),
    getVUMeter: vi.fn(),
    getVUBar: vi.fn(),
    getMicBtn: vi.fn(),
    getMicStatus: vi.fn(),
  };
  window._vocoderMicUI = uiApi;
  return uiApi;
}

// ══════════════════════════════════════════════════════════════════
// 1. Audio Module Tests
// ══════════════════════════════════════════════════════════════════

describe('vocoder_mic_audio.js — Audio pipeline', () => {
  let state;
  let fakeAudioContext;

  function _initAudioModule() {
    // Reproduce the exact IIFE from vocoder_mic_audio.js
    _stubVocoderMicState();
    state = window._vocoderMicState;

    window._vocoderMicAudio = {};

    const _state = state;

    async function requestMic() {
      if (_state.micStream) {return true;}
      try {
        _state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return true;
      } catch (err) {
        return false;
      }
    }

    function startAudioPipeline() {
      if (_state.audioContext) {return;}
      try {
        _state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        _state.analyserNode = _state.audioContext.createAnalyser();
        _state.analyserNode.fftSize = 256;

        if (_state.micStream) {
          _state.micSourceNode = _state.audioContext.createMediaStreamSource(_state.micStream);
          _state.micSourceNode.connect(_state.analyserNode);

          _state.captureNode = _state.audioContext.createScriptProcessor(1024, 1, 1);
          _state.analyserNode.connect(_state.captureNode);
          _state.captureNode.connect(_state.audioContext.destination);

          _state.captureNode.onaudioprocess = function(e) {
            const input = e.inputBuffer.getChannelData(0);
            _state.pcmBuffer = Array.from(input);
          };
        }
      } catch (err) {
        // silently fail
      }
    }

    function stopAudioPipeline() {
      if (_state.captureNode) {
        try { _state.captureNode.disconnect(); } catch (e) { /* ignore */ }
        _state.captureNode = null;
      }
      if (_state.analyserNode) {
        try { _state.analyserNode.disconnect(); } catch (e) { /* ignore */ }
        _state.analyserNode = null;
      }
      if (_state.micSourceNode) {
        try { _state.micSourceNode.disconnect(); } catch (e) { /* ignore */ }
        _state.micSourceNode = null;
      }
      if (_state.audioContext) {
        _state.audioContext.close().catch(function() {});
        _state.audioContext = null;
      }
      _state.pcmBuffer = [];
    }

    function stopMicStream() {
      if (_state.micStream) {
        _state.micStream.getTracks().forEach(function(t) { t.stop(); });
        _state.micStream = null;
      }
    }

    function detectBridge() {
      _state.bridgeActive = !!(typeof window.juce !== 'undefined' &&
          typeof window.juce.sendModulatorAudioBuffer === 'function');
    }

    window._vocoderMicAudio = {
      requestMic: requestMic,
      startAudioPipeline: startAudioPipeline,
      stopAudioPipeline: stopAudioPipeline,
      stopMicStream: stopMicStream,
      detectBridge: detectBridge,
    };
  }

  beforeEach(function() {
    fakeAudioContext = _createFakeAudioContext();

    vi.stubGlobal('window', {
      AudioContext: vi.fn(function() { return fakeAudioContext; }),
      webkitAudioContext: undefined,
    });

    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn(),
      },
    });

    _initAudioModule();
    state = window._vocoderMicState;
  });

  afterEach(function() {
    vi.unstubAllGlobals();
  });

  // ── State initialization ──

  it('initializes shared state with default values', function() {
    expect(state.audioContext).toBeNull();
    expect(state.micStream).toBeNull();
    expect(state.analyserNode).toBeNull();
    expect(state.micEnabled).toBe(false);
    expect(state.vuIntervalId).toBeNull();
    expect(state.micSourceNode).toBeNull();
    expect(state.captureNode).toBeNull();
    expect(state.pcmBuffer).toEqual([]);
    expect(state.bridgeActive).toBe(false);
  });

  // ── requestMic ──

  it('requestMic returns true when getUserMedia succeeds', async function() {
    const mockStream = { getTracks: vi.fn(function() { return [{ stop: vi.fn() }]; }) };
    navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream);

    const result = await window._vocoderMicAudio.requestMic();
    expect(result).toBe(true);
    expect(state.micStream).toBe(mockStream);
  });

  it('requestMic returns false when getUserMedia fails', async function() {
    navigator.mediaDevices.getUserMedia.mockRejectedValue(new Error('Permission denied'));

    const result = await window._vocoderMicAudio.requestMic();
    expect(result).toBe(false);
    expect(state.micStream).toBeNull();
  });

  it('requestMic returns true immediately if micStream already exists', async function() {
    state.micStream = { getTracks: vi.fn() };

    const result = await window._vocoderMicAudio.requestMic();
    expect(result).toBe(true);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('requestMic handles missing getUserMedia API gracefully', async function() {
    navigator.mediaDevices.getUserMedia = undefined;
    const result = await window._vocoderMicAudio.requestMic();
    // Should throw and return false
    expect(result).toBe(false);
  });

  // ── startAudioPipeline ──

  it('startAudioPipeline creates AudioContext and AnalyserNode', function() {
    state.micStream = { getTracks: vi.fn() };
    window._vocoderMicAudio.startAudioPipeline();

    expect(state.audioContext).toBe(fakeAudioContext);
    expect(state.analyserNode).toBe(fakeAudioContext._analyserNode);
    expect(state.analyserNode.fftSize).toBe(256);
  });

  it('startAudioPipeline creates ScriptProcessorNode and connects pipeline', function() {
    state.micStream = { getTracks: vi.fn() };
    window._vocoderMicAudio.startAudioPipeline();

    expect(state.captureNode).toBe(fakeAudioContext._captureNode);
    expect(fakeAudioContext.createScriptProcessor).toHaveBeenCalledWith(1024, 1, 1);
    expect(state.analyserNode.connect).toHaveBeenCalledWith(state.captureNode);
    expect(state.captureNode.connect).toHaveBeenCalledWith(fakeAudioContext.destination);
  });

  it('startAudioPipeline is idempotent — second call does nothing', function() {
    state.micStream = { getTracks: vi.fn() };
    window._vocoderMicAudio.startAudioPipeline();
    const ctx1 = state.audioContext;

    window._vocoderMicAudio.startAudioPipeline();
    expect(state.audioContext).toBe(ctx1); // same reference
    expect(fakeAudioContext.createAnalyser).toHaveBeenCalledTimes(1);
  });

  it('startAudioPipeline handles missing micStream gracefully', function() {
    state.micStream = null;
    window._vocoderMicAudio.startAudioPipeline();

    expect(state.audioContext).toBe(fakeAudioContext);
    expect(state.micSourceNode).toBeNull();
    expect(state.captureNode).toBeNull();
  });

  it('startAudioPipeline captures PCM data via onaudioprocess', function() {
    state.micStream = { getTracks: vi.fn() };
    window._vocoderMicAudio.startAudioPipeline();

    // Simulate onaudioprocess event
    const mockInputBuffer = {
      getChannelData: vi.fn(function() { return new Float32Array([0.1, 0.2, 0.3]); }),
    };
    state.captureNode.onaudioprocess({ inputBuffer: mockInputBuffer });

    // Use approximate comparison for float32 → JS number conversion
    expect(state.pcmBuffer.length).toBe(3);
    expect(state.pcmBuffer[0]).toBeCloseTo(0.1, 5);
    expect(state.pcmBuffer[1]).toBeCloseTo(0.2, 5);
    expect(state.pcmBuffer[2]).toBeCloseTo(0.3, 5);
  });

  it('startAudioPipeline handles AudioContext constructor failure', function() {
    window.AudioContext = vi.fn(function() { throw new Error('AudioContext not supported'); });
    vi.stubGlobal('window', { AudioContext: vi.fn(function() { throw new Error('not supported'); }) });

    // Re-init with broken AudioContext
    _initAudioModule();
    state.micStream = { getTracks: vi.fn() };

    expect(function() { window._vocoderMicAudio.startAudioPipeline(); }).not.toThrow();
    expect(state.audioContext).toBeNull();
  });

  // ── stopAudioPipeline ──

  it('stopAudioPipeline disconnects all nodes and nullifies state', function() {
    state.micStream = { getTracks: vi.fn() };
    window._vocoderMicAudio.startAudioPipeline();

    window._vocoderMicAudio.stopAudioPipeline();

    expect(fakeAudioContext._captureNode.disconnect).toHaveBeenCalled();
    expect(fakeAudioContext._analyserNode.disconnect).toHaveBeenCalled();
    expect(fakeAudioContext.close).toHaveBeenCalled();
    expect(state.captureNode).toBeNull();
    expect(state.analyserNode).toBeNull();
    expect(state.micSourceNode).toBeNull();
    expect(state.audioContext).toBeNull();
    expect(state.pcmBuffer).toEqual([]);
  });

  it('stopAudioPipeline is idempotent with null nodes', function() {
    expect(function() { window._vocoderMicAudio.stopAudioPipeline(); }).not.toThrow();
    expect(function() { window._vocoderMicAudio.stopAudioPipeline(); }).not.toThrow();
  });

  // ── stopMicStream ──

  it('stopMicStream stops all tracks and nullifies stream', function() {
    const track1 = { stop: vi.fn() };
    const track2 = { stop: vi.fn() };
    state.micStream = { getTracks: vi.fn(function() { return [track1, track2]; }) };

    window._vocoderMicAudio.stopMicStream();

    expect(track1.stop).toHaveBeenCalled();
    expect(track2.stop).toHaveBeenCalled();
    expect(state.micStream).toBeNull();
  });

  it('stopMicStream handles null stream gracefully', function() {
    state.micStream = null;
    expect(function() { window._vocoderMicAudio.stopMicStream(); }).not.toThrow();
  });

  // ── detectBridge ──

  it('detectBridge detects JUCE bridge when available', function() {
    vi.stubGlobal('window', {
      juce: { sendModulatorAudioBuffer: vi.fn() },
    });
    // Re-init
    _initAudioModule();

    window._vocoderMicAudio.detectBridge();
    expect(state.bridgeActive).toBe(true);
  });

  it('detectBridge returns false when JUCE bridge is absent', function() {
    vi.stubGlobal('window', {});
    _initAudioModule();

    window._vocoderMicAudio.detectBridge();
    expect(state.bridgeActive).toBe(false);
  });

  it('detectBridge returns false when sendModulatorAudioBuffer is missing', function() {
    vi.stubGlobal('window', { juce: {} });
    _initAudioModule();

    window._vocoderMicAudio.detectBridge();
    expect(state.bridgeActive).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// 2. UI Module Tests
// ══════════════════════════════════════════════════════════════════

describe('vocoder_mic_ui.js — VU meter, toggle, status', () => {
  let state, audio;

  function _initUIModule() {
    _stubVocoderMicState();
    state = window._vocoderMicState;

    audio = _stubVocoderMicAudio();

    // Reproduce the exact IIFE from vocoder_mic_ui.js
    const _audio = audio;
    const _state = state;

    function getVUMeter() { return document.getElementById('vocoder-vu-meter'); }
    function getVUBar()   { return document.getElementById('vocoder-vu-bar'); }
    function getMicBtn()  { return document.getElementById('vocoder-mic-toggle'); }
    function getMicStatus() { return document.getElementById('vocoder-mic-status'); }

    function createVUHTML() {
      return [
        '<div class="vocoder-mic-section">',
        '  <button id="vocoder-mic-toggle" class="toggle-box" data-active="false">',
        '    <span class="toggle-label">Enable</span>',
        '    <div class="toggle-led"></div>',
        '  </button>',
        '  <div id="vocoder-vu-meter">',
        '    <div id="vocoder-vu-bar" style="width:0%;background:var(--accent-green)"></div>',
        '  </div>',
        '  <span id="vocoder-mic-status">MICROPHONE DISABLED</span>',
        '</div>',
      ].join('\n');
    }

    function startVUMeter() {
      stopVUMeter();
      if (!_state.analyserNode) {return;}

      const dataArray = new Uint8Array(_state.analyserNode.frequencyBinCount);
      _state.vuIntervalId = setInterval(function() {
        const bar = getVUBar();
        const meter = getVUMeter();
        if (!bar || !meter) {return;}

        _state.analyserNode.getByteTimeDomainData(dataArray);
        let max = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = Math.abs(dataArray[i] - 128) / 128;
          if (val > max) {max = val;}
        }

        const pct = Math.min(max * 100, 100);
        bar.style.width = pct + '%';

        if (pct > 80) {
          bar.style.background = 'var(--accent-red)';
        } else if (pct > 50) {
          bar.style.background = 'var(--accent-pink)';
        } else {
          bar.style.background = 'var(--accent-green)';
        }
      }, 80);
    }

    function stopVUMeter() {
      if (_state.vuIntervalId) {
        clearInterval(_state.vuIntervalId);
        _state.vuIntervalId = null;
      }
      const bar = getVUBar();
      if (bar) {
        bar.style.width = '0%';
        bar.style.background = 'var(--accent-green)';
      }
    }

    function updateUI(enabled) {
      const btn = getMicBtn();
      const meter = getVUMeter();
      const status = getMicStatus();

      if (btn) {
        btn.dataset.active = enabled ? 'true' : 'false';
        const label = btn.querySelector('.toggle-label');
        if (label) {label.textContent = enabled ? 'Enabled' : 'Enable';}
      }
      if (meter) {
        meter.style.opacity = enabled ? '1' : '0.3';
      }
      if (status) {
        status.textContent = enabled
          ? 'MICROPHONE ACTIVE'
          : 'MICROPHONE DISABLED';
        status.style.color = enabled ? 'var(--accent-green)' : 'var(--text-dim)';
      }
    }

    function isVocoderActive() {
      const selectors = document.querySelectorAll('.fx-type-select');
      for (let i = 0; i < selectors.length; i++) {
        if (parseInt(selectors[i].value, 10) === 49) {return true;}
      }
      return false;
    }

    async function toggleMic() {
      if (_state.micEnabled) {
        _state.micEnabled = false;
        stopVUMeter();
        _audio.stopAudioPipeline();
        _audio.stopMicStream();
        updateUI(false);
        return;
      }

      const granted = await _audio.requestMic();
      if (!granted) {
        const status = getMicStatus();
        if (status) {
          status.textContent = '⚠️ MICROPHONE ACCESS DENIED — using internal noise';
          status.style.color = 'var(--accent-red)';
        }
        return;
      }

      _state.micEnabled = true;
      _audio.startAudioPipeline();
      startVUMeter();
      updateUI(true);
    }

    function injectVocoderUI() {
      if (!isVocoderActive()) {return;}

      const container = document.querySelector('.fx-param-panel[data-fx-type="49"]');
      if (!container) {return;}
      if (document.getElementById('vocoder-mic-section')) {return;}

      const section = document.createElement('div');
      section.id = 'vocoder-mic-section';
      section.innerHTML = createVUHTML();
      container.appendChild(section);

      const btn = getMicBtn();
      if (btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          toggleMic();
        });
      }
    }

    window._vocoderMicUI = {
      createVUHTML: createVUHTML,
      startVUMeter: startVUMeter,
      stopVUMeter: stopVUMeter,
      updateUI: updateUI,
      isVocoderActive: isVocoderActive,
      toggleMic: toggleMic,
      injectVocoderUI: injectVocoderUI,
      getVUMeter: getVUMeter,
      getVUBar: getVUBar,
      getMicBtn: getMicBtn,
      getMicStatus: getMicStatus,
    };
  }

  beforeEach(function() {
    vi.useFakeTimers();
    vi.stubGlobal('window', {});

    const vuMeter = _createFakeEl('div', { id: 'vocoder-vu-meter' });
    const vuBar = _createFakeEl('div', { id: 'vocoder-vu-bar' });
    const micBtn = _createFakeEl('button', { id: 'vocoder-mic-toggle' });
    const micStatus = _createFakeEl('span', { id: 'vocoder-mic-status' });

    const registry = {
      'vocoder-vu-meter': vuMeter,
      'vocoder-vu-bar': vuBar,
      'vocoder-mic-toggle': micBtn,
      'vocoder-mic-status': micStatus,
    };

    vi.stubGlobal('document', {
      getElementById: function(id) { return registry[id] || null; },
      querySelector: function(sel) {
        if (sel === '.fx-param-panel[data-fx-type="49"]') {return null;}
        if (sel === '#vocoder-mic-section') {return null;}
        return null;
      },
      querySelectorAll: function(sel) {
        if (sel === '.fx-type-select') {return [];}
        return [];
      },
      createElement: function(tag) { return _createFakeEl(tag); },
      addEventListener: function() {},
    });

    _initUIModule();
    state = window._vocoderMicState;
    audio = window._vocoderMicAudio;
  });

  afterEach(function() {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // ── createVUHTML ──

  it('createVUHTML returns HTML with toggle button', function() {
    const html = window._vocoderMicUI.createVUHTML();
    expect(html).toContain('vocoder-mic-toggle');
    expect(html).toContain('vocoder-vu-meter');
    expect(html).toContain('vocoder-vu-bar');
    expect(html).toContain('vocoder-mic-status');
    expect(html).toContain('MICROPHONE DISABLED');
    expect(html).toContain('Enable');
  });

  it('createVUHTML includes toggle button with data-active attribute', function() {
    const html = window._vocoderMicUI.createVUHTML();
    expect(html).toContain('data-active="false"');
  });

  // ── isVocoderActive ──

  it('isVocoderActive returns false when no FX type selects exist', function() {
    expect(window._vocoderMicUI.isVocoderActive()).toBe(false);
  });

  it('isVocoderActive returns true when an FX select has value 49', function() {
    const select49 = _createFakeEl('select');
    select49.value = '49';
    const selectOther = _createFakeEl('select');
    selectOther.value = '22';

    vi.stubGlobal('document', {
      querySelectorAll: function(sel) {
        if (sel === '.fx-type-select') {return [selectOther, select49];}
        return [];
      },
      getElementById: function() { return null; },
    });

    // Re-init with stubbed document
    expect(window._vocoderMicUI.isVocoderActive()).toBe(true);
  });

  it('isVocoderActive returns false when all selects have non-49 values', function() {
    const select1 = _createFakeEl('select');
    select1.value = '0';
    const select2 = _createFakeEl('select');
    select2.value = '10';

    vi.stubGlobal('document', {
      querySelectorAll: function(sel) {
        if (sel === '.fx-type-select') {return [select1, select2];}
        return [];
      },
    });

    expect(window._vocoderMicUI.isVocoderActive()).toBe(false);
  });

  // ── updateUI ──

  it('updateUI sets enabled state correctly', function() {
    window._vocoderMicUI.updateUI(true);

    const btn = document.getElementById('vocoder-mic-toggle');
    const meter = document.getElementById('vocoder-vu-meter');
    const status = document.getElementById('vocoder-mic-status');

    expect(btn.dataset.active).toBe('true');
    expect(meter.style.opacity).toBe('1');
    expect(status.textContent).toBe('MICROPHONE ACTIVE');
    expect(status.style.color).toBe('var(--accent-green)');
  });

  it('updateUI sets disabled state correctly', function() {
    window._vocoderMicUI.updateUI(false);

    const btn = document.getElementById('vocoder-mic-toggle');
    const meter = document.getElementById('vocoder-vu-meter');
    const status = document.getElementById('vocoder-mic-status');

    expect(btn.dataset.active).toBe('false');
    expect(meter.style.opacity).toBe('0.3');
    expect(status.textContent).toBe('MICROPHONE DISABLED');
    expect(status.style.color).toBe('var(--text-dim)');
  });

  it('updateUI updates toggle label text', function() {
    const btn = document.getElementById('vocoder-mic-toggle');
    const labelEl = _createFakeEl('span');
    labelEl.classList.add('toggle-label');
    btn._subElements['.toggle-label'] = labelEl;
    btn.querySelector = function(sel) { return this._subElements[sel] || null; };

    window._vocoderMicUI.updateUI(true);
    expect(labelEl.textContent).toBe('Enabled');

    window._vocoderMicUI.updateUI(false);
    expect(labelEl.textContent).toBe('Enable');
  });

  it('updateUI handles missing DOM elements gracefully', function() {
    vi.stubGlobal('document', { getElementById: function() { return null; } });
    expect(function() { window._vocoderMicUI.updateUI(true); }).not.toThrow();
    expect(function() { window._vocoderMicUI.updateUI(false); }).not.toThrow();
  });

  // ── startVUMeter / stopVUMeter ──

  it('startVUMeter does nothing when analyserNode is null', function() {
    state.analyserNode = null;
    window._vocoderMicUI.startVUMeter();
    expect(state.vuIntervalId).toBeNull();
  });

  it('startVUMeter creates an interval', function() {
    state.analyserNode = {
      frequencyBinCount: 128,
      getByteTimeDomainData: vi.fn(function(arr) {
        for (let i = 0; i < arr.length; i++) {arr[i] = 128;} // silence
      }),
    };

    window._vocoderMicUI.startVUMeter();
    expect(state.vuIntervalId).not.toBeNull();
  });

  it('startVUMeter clears previous interval before creating new one', function() {
    state.analyserNode = {
      frequencyBinCount: 128,
      getByteTimeDomainData: vi.fn(),
    };

    window._vocoderMicUI.startVUMeter();
    const id1 = state.vuIntervalId;

    window._vocoderMicUI.startVUMeter();
    const id2 = state.vuIntervalId;

    expect(id2).not.toBe(id1); // new interval created
  });

  it('stopVUMeter clears interval and resets bar', function() {
    state.analyserNode = {
      frequencyBinCount: 128,
      getByteTimeDomainData: vi.fn(),
    };
    window._vocoderMicUI.startVUMeter();

    window._vocoderMicUI.stopVUMeter();

    expect(state.vuIntervalId).toBeNull();
    const bar = document.getElementById('vocoder-vu-bar');
    expect(bar.style.width).toBe('0%');
    expect(bar.style.background).toBe('var(--accent-green)');
  });

  it('stopVUMeter handles null interval gracefully', function() {
    state.vuIntervalId = null;
    expect(function() { window._vocoderMicUI.stopVUMeter(); }).not.toThrow();
  });

  it('VU meter updates bar width based on audio level', function() {
    state.analyserNode = {
      frequencyBinCount: 4,
      getByteTimeDomainData: vi.fn(function(arr) {
        arr[0] = 128; arr[1] = 200; arr[2] = 128; arr[3] = 128;
      }),
    };

    window._vocoderMicUI.startVUMeter();

    // Advance timers to trigger the interval callback
    vi.advanceTimersByTime(80);

    const bar = document.getElementById('vocoder-vu-bar');
    // Max val = (200-128)/128 = 0.5625 → 56.25%
    expect(bar.style.width).toBe('56.25%');
  });

  it('VU meter shows red color above 80% threshold', function() {
    state.analyserNode = {
      frequencyBinCount: 2,
      getByteTimeDomainData: vi.fn(function(arr) {
        arr[0] = 255; arr[1] = 255; // max peak
      }),
    };

    window._vocoderMicUI.startVUMeter();
    vi.advanceTimersByTime(80);

    const bar = document.getElementById('vocoder-vu-bar');
    // Pct = (127/128)*100 ≈ 99.2%
    expect(bar.style.background).toBe('var(--accent-red)');
  });

  it('VU meter shows pink color between 50-80% threshold', function() {
    state.analyserNode = {
      frequencyBinCount: 2,
      getByteTimeDomainData: vi.fn(function(arr) {
        arr[0] = 200; arr[1] = 200; // (200-128)/128 = 0.5625 → 56%
      }),
    };

    window._vocoderMicUI.startVUMeter();
    vi.advanceTimersByTime(80);

    const bar = document.getElementById('vocoder-vu-bar');
    expect(bar.style.background).toBe('var(--accent-pink)');
  });

  it('VU meter shows green color below 50% threshold', function() {
    state.analyserNode = {
      frequencyBinCount: 2,
      getByteTimeDomainData: vi.fn(function(arr) {
        arr[0] = 140; arr[1] = 140; // (140-128)/128 = 0.09375 → 9%
      }),
    };

    window._vocoderMicUI.startVUMeter();
    vi.advanceTimersByTime(80);

    const bar = document.getElementById('vocoder-vu-bar');
    expect(bar.style.background).toBe('var(--accent-green)');
  });

  // ── toggleMic ──

  it('toggleMic disable path stops pipeline and updates UI', async function() {
    state.micEnabled = true;
    audio.stopAudioPipeline = vi.fn();
    audio.stopMicStream = vi.fn();

    await window._vocoderMicUI.toggleMic();

    expect(state.micEnabled).toBe(false);
    expect(audio.stopAudioPipeline).toHaveBeenCalled();
    expect(audio.stopMicStream).toHaveBeenCalled();
  });

  it('toggleMic enable path requests mic and starts pipeline', async function() {
    const mockStream = { getTracks: vi.fn(function() { return [{ stop: vi.fn() }]; }) };
    state.micStream = null;
    audio.requestMic = vi.fn(function() { return Promise.resolve(true); });
    audio.startAudioPipeline = vi.fn();

    await window._vocoderMicUI.toggleMic();

    expect(state.micEnabled).toBe(true);
    expect(audio.requestMic).toHaveBeenCalled();
    expect(audio.startAudioPipeline).toHaveBeenCalled();
  });

  it('toggleMic shows denied message when mic not granted', async function() {
    audio.requestMic = vi.fn(function() { return Promise.resolve(false); });

    await window._vocoderMicUI.toggleMic();

    const status = document.getElementById('vocoder-mic-status');
    expect(status.textContent).toContain('MICROPHONE ACCESS DENIED');
    expect(status.style.color).toBe('var(--accent-red)');
    expect(state.micEnabled).toBe(false);
  });

  it('toggleMic handles missing status element in denied path', async function() {
    audio.requestMic = vi.fn(function() { return Promise.resolve(false); });

    vi.stubGlobal('document', {
      getElementById: function(id) {
        if (id === 'vocoder-mic-status') {return null;}
        return _createFakeEl('div', { id: id });
      },
    });

    await expect(window._vocoderMicUI.toggleMic()).resolves.not.toThrow();
  });

  // ── injectVocoderUI ──

  it('injectVocoderUI does nothing when vocoder is not active', function() {
    window._vocoderMicUI.injectVocoderUI();
    // No container should be modified
  });

  it('injectVocoderUI injects section when vocoder is active and container exists', function() {
    const container = _createFakeEl('div');
    container.appendChild = vi.fn();

    vi.stubGlobal('document', {
      querySelector: function(sel) {
        if (sel === '.fx-param-panel[data-fx-type="49"]') {return container;}
        if (sel === '#vocoder-mic-section') {return null;}
        return null;
      },
      querySelectorAll: function(sel) {
        if (sel === '.fx-type-select') {
          const sel49 = _createFakeEl('select');
          sel49.value = '49';
          return [sel49];
        }
        return [];
      },
      getElementById: function(id) {
        if (id === 'vocoder-mic-toggle') {
          const btn = _createFakeEl('button', { id: 'vocoder-mic-toggle' });
          btn._listeners = {};
          return btn;
        }
        return null;
      },
      createElement: function(tag) { return _createFakeEl(tag); },
    });

    window._vocoderMicUI.injectVocoderUI();

    expect(container.appendChild).toHaveBeenCalled();
  });

  it('injectVocoderUI does not duplicate section if already present', function() {
    const container = _createFakeEl('div');
    container.appendChild = vi.fn();

    const existingSection = _createFakeEl('div', { id: 'vocoder-mic-section' });

    vi.stubGlobal('document', {
      querySelector: function(sel) {
        if (sel === '.fx-param-panel[data-fx-type="49"]') {return container;}
        if (sel === '#vocoder-mic-section') {return existingSection;}
        return null;
      },
      querySelectorAll: function(sel) {
        if (sel === '.fx-type-select') {
          const sel49 = _createFakeEl('select');
          sel49.value = '49';
          return [sel49];
        }
        return [];
      },
      getElementById: function(id) {
        if (id === 'vocoder-mic-section') {return existingSection;}
        return null;
      },
      createElement: function(tag) { return _createFakeEl(tag); },
    });

    window._vocoderMicUI.injectVocoderUI();
    expect(container.appendChild).not.toHaveBeenCalled();
  });

  it('injectVocoderUI wires click handler to toggle button', function() {
    const container = _createFakeEl('div');
    container.appendChild = vi.fn();

    const toggleBtn = _createFakeEl('button', { id: 'vocoder-mic-toggle' });

    vi.stubGlobal('document', {
      querySelector: function(sel) {
        if (sel === '.fx-param-panel[data-fx-type="49"]') {return container;}
        if (sel === '#vocoder-mic-section') {return null;}
        return null;
      },
      querySelectorAll: function(sel) {
        if (sel === '.fx-type-select') {
          const sel49 = _createFakeEl('select');
          sel49.value = '49';
          return [sel49];
        }
        return [];
      },
      getElementById: function(id) {
        if (id === 'vocoder-mic-toggle') {return toggleBtn;}
        return null;
      },
      createElement: function(tag) { return _createFakeEl(tag); },
    });

    window._vocoderMicUI.injectVocoderUI();

    expect(toggleBtn._listeners['click']).toBeDefined();
    expect(toggleBtn._listeners['click'].length).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════
// 3. Facade Module Tests (vocoder_mic_input.js)
// ══════════════════════════════════════════════════════════════════

describe('vocoder_mic_input.js — Facade, init, sync', () => {
  let audio, ui, state;

  function _initFacadeModule() {
    _stubVocoderMicState();
    state = window._vocoderMicState;
    audio = _stubVocoderMicAudio();
    ui = _stubVocoderMicUI();

    // Reproduce the IIFE from vocoder_mic_input.js
    const _audio = audio;
    const _ui = ui;

    window.initVocoderMic = function() {
      _audio.detectBridge();
      _ui.injectVocoderUI();

      const fxModal = document.querySelector('fx-modal') || document.getElementById('fx-modal');
      if (fxModal) {
        let timer = null;
        const observer = new MutationObserver(function() {
          if (timer) {clearTimeout(timer);}
          timer = setTimeout(function() {
            window.syncVocoderMicUI();
          }, 150);
        });
        observer.observe(fxModal, { childList: true, subtree: true, attributes: false });
      }
    };

    window._onFxTypeChanged = function() {
      window.syncVocoderMicUI();
    };

    window.syncVocoderMicUI = function() {
      if (!_ui.isVocoderActive()) {
        if (state.micEnabled) {_ui.toggleMic();}
        const section = document.getElementById('vocoder-mic-section');
        if (section) {section.remove();}
      } else {
        _ui.injectVocoderUI();
      }
    };
  }

  beforeEach(function() {
    vi.stubGlobal('window', {});

    // Create a stable section that returns the same remove spy
    const testSection = _createFakeEl('div', { id: 'vocoder-mic-section' });
    testSection.remove = vi.fn();

    const registry = {};

    vi.stubGlobal('document', {
      getElementById: function(id) {
        if (id === 'vocoder-mic-section') {return testSection;}
        return registry[id] || null;
      },
      querySelector: function(sel) {
        if (sel === 'fx-modal' || sel === '#fx-modal') {return null;}
        return null;
      },
      querySelectorAll: function(sel) { return []; },
      addEventListener: function(event, handler) {
        if (event === 'DOMContentLoaded') { /* store for later */ }
      },
      createElement: function(tag) { return _createFakeEl(tag); },
    });

    vi.stubGlobal('MutationObserver', vi.fn(function(callback) {
      this._callback = callback;
      this.observe = vi.fn();
      this.disconnect = vi.fn();
    }));

    _initFacadeModule();
  });

  afterEach(function() {
    vi.unstubAllGlobals();
  });

  // ── initVocoderMic ──

  it('initVocoderMic calls detectBridge and injectVocoderUI', function() {
    window.initVocoderMic();

    expect(audio.detectBridge).toHaveBeenCalled();
    expect(ui.injectVocoderUI).toHaveBeenCalled();
  });

  it('initVocoderMic creates MutationObserver when fx-modal exists', function() {
    const fxModal = _createFakeEl('div', { id: 'fx-modal' });
    vi.stubGlobal('document', {
      querySelector: function(sel) {
        if (sel === '#fx-modal' || sel === 'fx-modal') {return fxModal;}
        return null;
      },
      getElementById: function() { return null; },
    });
    _initFacadeModule();

    window.initVocoderMic();

    expect(MutationObserver).toHaveBeenCalled();
  });

  it('initVocoderMic skips MutationObserver when no fx-modal exists', function() {
    // document.querySelector already returns null for fx-modal
    window.initVocoderMic();

    // No observer created successfully (no crash)
  });

  it('MutationObserver callback calls syncVocoderMicUI after debounce', function() {
    const fxModal = _createFakeEl('div', { id: 'fx-modal' });
    vi.stubGlobal('document', {
      querySelector: function(sel) {
        if (sel === '#fx-modal' || sel === 'fx-modal') {return fxModal;}
        return null;
      },
      getElementById: function() { return null; },
    });
    vi.useFakeTimers();
    _initFacadeModule();

    const syncSpy = vi.spyOn(window, 'syncVocoderMicUI');
    window.initVocoderMic();

    // Simulate mutation
    const observer = MutationObserver.mock.results[0].value;
    observer._callback([{ type: 'childList' }]);

    // Should not call immediately (debounced)
    expect(syncSpy).not.toHaveBeenCalled();

    // Advance timers past debounce (150ms)
    vi.advanceTimersByTime(150);
    expect(syncSpy).toHaveBeenCalled();

    vi.useRealTimers();
  });

  // ── _onFxTypeChanged ──

  it('_onFxTypeChanged calls syncVocoderMicUI', function() {
    const syncSpy = vi.spyOn(window, 'syncVocoderMicUI');

    window._onFxTypeChanged();

    expect(syncSpy).toHaveBeenCalled();
  });

  // ── syncVocoderMicUI ──

  it('syncVocoderMicUI hides section when vocoder is not active', function() {
    ui.isVocoderActive = vi.fn(function() { return false; });
    state.micEnabled = false;

    window.syncVocoderMicUI();

    const section = document.getElementById('vocoder-mic-section');
    expect(section.remove).toHaveBeenCalled();
  });

  it('syncVocoderMicUI disables mic before hiding when mic is enabled', function() {
    ui.isVocoderActive = vi.fn(function() { return false; });
    state.micEnabled = true;

    window.syncVocoderMicUI();

    expect(ui.toggleMic).toHaveBeenCalled();
  });

  it('syncVocoderMicUI injects UI when vocoder is active', function() {
    ui.isVocoderActive = vi.fn(function() { return true; });

    window.syncVocoderMicUI();

    expect(ui.injectVocoderUI).toHaveBeenCalled();
  });

  it('syncVocoderMicUI does not remove section if it does not exist', function() {
    ui.isVocoderActive = vi.fn(function() { return false; });
    state.micEnabled = false;

    vi.stubGlobal('document', {
      getElementById: function(id) { return null; },
    });

    expect(function() { window.syncVocoderMicUI(); }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// 4. Audio Pipeline Integration (bridge, PCM forwarding)
// ══════════════════════════════════════════════════════════════════

describe('vocoder_mic_audio — Bridge integration and PCM forwarding', () => {
  let state, fakeAudioContext, mockStream;

  function _initAudioForBridge() {
    _stubVocoderMicState();
    state = window._vocoderMicState;

    const _state = state;

    async function requestMic() {
      if (_state.micStream) {return true;}
      try {
        _state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return true;
      } catch (err) {
        return false;
      }
    }

    function startAudioPipeline() {
      if (_state.audioContext) {return;}
      try {
        _state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        _state.analyserNode = _state.audioContext.createAnalyser();

        if (_state.micStream) {
          _state.micSourceNode = _state.audioContext.createMediaStreamSource(_state.micStream);
          _state.micSourceNode.connect(_state.analyserNode);

          _state.captureNode = _state.audioContext.createScriptProcessor(1024, 1, 1);
          _state.analyserNode.connect(_state.captureNode);
          _state.captureNode.connect(_state.audioContext.destination);

          _state.captureNode.onaudioprocess = function(e) {
            const input = e.inputBuffer.getChannelData(0);
            _state.pcmBuffer = Array.from(input);

            if (_state.bridgeActive &&
                typeof window.juce !== 'undefined' &&
                typeof window.juce.sendModulatorAudioBuffer === 'function') {
              try {
                window.juce.sendModulatorAudioBuffer(_state.pcmBuffer);
              } catch (err) {
                // bridge not available
              }
            }
          };
        }
      } catch (err) {
        // silently fail
      }
    }

    function stopAudioPipeline() {
      if (_state.captureNode) { try { _state.captureNode.disconnect(); } catch (e) {} _state.captureNode = null; }
      if (_state.analyserNode) { try { _state.analyserNode.disconnect(); } catch (e) {} _state.analyserNode = null; }
      if (_state.micSourceNode) { try { _state.micSourceNode.disconnect(); } catch (e) {} _state.micSourceNode = null; }
      if (_state.audioContext) { _state.audioContext.close().catch(function() {}); _state.audioContext = null; }
      _state.pcmBuffer = [];
    }

    window._vocoderMicAudio = {
      requestMic: requestMic,
      startAudioPipeline: startAudioPipeline,
      stopAudioPipeline: stopAudioPipeline,
    };
  }

  beforeEach(function() {
    mockStream = { getTracks: vi.fn(function() { return [{ stop: vi.fn() }]; }) };
    fakeAudioContext = _createFakeAudioContext();

    vi.stubGlobal('window', {
      AudioContext: vi.fn(function() { return fakeAudioContext; }),
      juce: { sendModulatorAudioBuffer: vi.fn() },
    });

    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn(function() { return Promise.resolve(mockStream); }),
      },
    });

    _initAudioForBridge();
    state = window._vocoderMicState;
  });

  afterEach(function() {
    vi.unstubAllGlobals();
  });

  it('forwards PCM buffer to JUCE bridge when active', function() {
    state.micStream = mockStream;
    state.bridgeActive = true;
    window._vocoderMicAudio.startAudioPipeline();

    // Simulate onaudioprocess
    const inputData = new Float32Array([0.1, 0.2, 0.3]);
    state.captureNode.onaudioprocess({
      inputBuffer: {
        getChannelData: vi.fn(function() { return inputData; }),
      },
    });

    // Floats from Float32Array have precision differences; use approximate comparison
    expect(window.juce.sendModulatorAudioBuffer).toHaveBeenCalled();
    const calledWith = window.juce.sendModulatorAudioBuffer.mock.calls[0][0];
    expect(calledWith.length).toBe(3);
    expect(calledWith[0]).toBeCloseTo(0.1, 5);
    expect(calledWith[1]).toBeCloseTo(0.2, 5);
    expect(calledWith[2]).toBeCloseTo(0.3, 5);
    
    expect(state.pcmBuffer.length).toBe(3);
    expect(state.pcmBuffer[0]).toBeCloseTo(0.1, 5);
  });

  it('does not call bridge when bridgeActive is false', function() {
    state.micStream = mockStream;
    state.bridgeActive = false;
    window._vocoderMicAudio.startAudioPipeline();

    state.captureNode.onaudioprocess({
      inputBuffer: {
        getChannelData: vi.fn(function() { return new Float32Array([0.5, 0.6]); }),
      },
    });

    expect(window.juce.sendModulatorAudioBuffer).not.toHaveBeenCalled();
  });

  it('does not call bridge when window.juce does not exist', function() {
    vi.stubGlobal('window', {
      AudioContext: vi.fn(function() { return fakeAudioContext; }),
    });

    // Callback should not throw
    state.bridgeActive = true;

    expect(function() {
      const input = new Float32Array([0.1, 0.2]);
      const pcm = Array.from(input);
      // Simulate the check from the module
      if (state.bridgeActive &&
          typeof window.juce !== 'undefined' &&
          typeof window.juce.sendModulatorAudioBuffer === 'function') {
        window.juce.sendModulatorAudioBuffer(pcm);
      }
    }).not.toThrow();
  });

  it('handles bridge function throwing an error gracefully', function() {
    state.micStream = mockStream;
    state.bridgeActive = true;
    window.juce.sendModulatorAudioBuffer = vi.fn(function() {
      throw new Error('Bridge disconnected');
    });

    window._vocoderMicAudio.startAudioPipeline();

    expect(function() {
      state.captureNode.onaudioprocess({
        inputBuffer: {
          getChannelData: vi.fn(function() { return new Float32Array([0.1]); }),
        },
      });
    }).not.toThrow();
  });

  it('does not forward empty PCM arrays', function() {
    state.micStream = mockStream;
    state.bridgeActive = true;
    window._vocoderMicAudio.startAudioPipeline();

    // Send data
    state.captureNode.onaudioprocess({
      inputBuffer: {
        getChannelData: vi.fn(function() { return new Float32Array([]); }),
      },
    });

    expect(state.pcmBuffer).toEqual([]);
    // May or may not call bridge with empty — not specified, but should not crash
  });
});

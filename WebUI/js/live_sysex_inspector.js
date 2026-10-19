/**
 * LiveSysExInspector & AboutDialog — Glue de componentes compartidos (@abdsynths/shared) para ABDEep.
 * ===================================================================================================
 * Consume la implementación canónica de `@abdsynths/shared/components` eliminando ~780 líneas
 * de código duplicado en ABDEep y cumpliendo los 3 requisitos del contrato de integración:
 *  1. Fuente de verdad del byte stream: trama real de 291 bytes de DeepMind 12
 *     (F0 00 20 32 20 7F 02 07 [bank] [prog] [278B packed 8-to-7] 00 00 F7).
 *  2. Actualización reactiva y resaltado de bytes (diff) al mover cualquier parámetro.
 *  3. Bidireccionalidad: exportación .syx válida para hardware e inyección inversa
 *     (importDeepMindSysExBuffer / importSysexBase64) hacia el motor y la UI.
 */

import {
  LiveSysExInspector,
  createLiveSysExInspector,
  toHexByte,
  decodeSysExHeader,
  AboutDialog,
  createAboutDialog,
} from '@abdsynths/shared/components';

/**
 * Empaquetado canónico 8-a-7 bits de DeepMind 12 (242 bytes -> 278 bytes).
 * @param {Uint8Array|Array<number>} unpackedBytes
 * @returns {Uint8Array}
 */
export function packDeepMind8to7(unpackedBytes) {
  if (typeof window !== 'undefined' && typeof window.pack8to7 === 'function') {
    try {
      return window.pack8to7(unpackedBytes);
    } catch (_) { /* fallback below */ }
  }
  const packed = new Uint8Array(278);
  let readIdx = 0;
  let writeIdx = 0;
  while (readIdx < 242 && writeIdx < 278) {
    let msbFlags = 0;
    const startWriteIdx = writeIdx;
    writeIdx++;
    for (let k = 1; k < 8; k++) {
      if (readIdx >= 242) {break;}
      let val = unpackedBytes[readIdx++] & 0xff;
      if (val & 0x80) {
        msbFlags |= (1 << (k - 1));
        val &= 0x7f;
      }
      packed[startWriteIdx + k] = val;
      writeIdx++;
    }
    packed[startWriteIdx] = msbFlags;
  }
  return packed;
}

/**
 * Desempaquetado canónico 7-a-8 bits de DeepMind 12 (278 bytes -> 242 bytes).
 * @param {Uint8Array|Array<number>} packedBytes
 * @returns {Uint8Array}
 */
export function unpackDeepMind7to8(packedBytes) {
  if (typeof window !== 'undefined' && typeof window.unpack7to8 === 'function') {
    try {
      return window.unpack7to8(packedBytes);
    } catch (_) { /* fallback below */ }
  }
  const unpacked = new Uint8Array(242);
  let writeIdx = 0;
  for (let i = 0; i < packedBytes.length; i += 8) {
    const msbFlags = packedBytes[i];
    for (let k = 1; k < 8; k++) {
      if (i + k >= packedBytes.length || writeIdx >= 242) {break;}
      let val = packedBytes[i + k] & 0x7f;
      if (msbFlags & (1 << (k - 1))) {
        val |= 0x80;
      }
      unpacked[writeIdx++] = val;
    }
  }
  return unpacked;
}

/**
 * Reconstruye los 242 bytes desempaquetados desde el cache de parámetros del bridge
 * si aún no existe `window._liveUnpackedBytes`.
 * @returns {Uint8Array|null}
 */
function buildUnpackedFromBridgeCache() {
  if (typeof window === 'undefined') {return null;}
  const bridge = typeof window.getBridge === 'function' ? window.getBridge() : window._bridgeInstance;
  if (!bridge || !bridge.parameterCache || !bridge.paramToByteOffset || typeof bridge._normalizedToRaw !== 'function') {
    return null;
  }
  const keys = Object.keys(bridge.parameterCache);
  if (keys.length === 0) {return null;}
  const out = new Uint8Array(242);
  for (let i = 0; i < keys.length; i++) {
    const paramId = keys[i];
    const offset = bridge.paramToByteOffset[paramId];
    if (typeof offset === 'number' && offset >= 0 && offset < 242) {
      out[offset] = bridge._normalizedToRaw(offset, bridge.parameterCache[paramId]) & 0xff;
    }
  }
  return out;
}

/**
 * Genera el mensaje SysEx completo de 291 bytes de DeepMind 12 a partir del Edit Buffer en vivo.
 * @param {Uint8Array|Array<number>} [overrideBytes] - 242 bytes desempaquetados o 291 bytes empaquetados
 * @returns {Uint8Array}
 */
export function getCurrentDeepMindSysExBuffer(overrideBytes) {
  if (overrideBytes && overrideBytes.length === 291 && overrideBytes[0] === 0xf0 && overrideBytes[290] === 0xf7) {
    return new Uint8Array(overrideBytes);
  }

  let bytes = overrideBytes || (typeof window !== 'undefined' ? (window._liveUnpackedBytes || window._lastUnpackedBytes) : null);
  if (!bytes || bytes.length < 242) {
    if (typeof window !== 'undefined' && window.loadedBanks && window.currentActiveBank) {
      const bank = window.loadedBanks[window.currentActiveBank];
      const patch = bank && bank[window.currentActivePatchIndex];
      if (patch && patch.unpackedBytes) {
        bytes = patch.unpackedBytes;
      }
    }
  }
  if (!bytes || bytes.length < 242) {
    bytes = buildUnpackedFromBridgeCache();
  }

  const syxMsg = new Uint8Array(291);
  syxMsg[0] = 0xf0;
  syxMsg[1] = 0x00;
  syxMsg[2] = 0x20;
  syxMsg[3] = 0x32; // Behringer manufacturer ID
  syxMsg[4] = 0x20; // DeepMind family ID
  syxMsg[5] = 0x7f; // Broadcast device ID
  syxMsg[6] = 0x02; // Program Dump Response
  syxMsg[7] = 0x07; // App / Comms version
  syxMsg[8] = 0x00; // Bank number (0..7)
  syxMsg[9] = (typeof window !== 'undefined' && typeof window.currentActivePatchIndex === 'number')
    ? (window.currentActivePatchIndex & 0x7f)
    : 0x00;

  if (bytes && bytes.length >= 242) {
    try {
      const packed = packDeepMind8to7(bytes);
      syxMsg.set(packed.subarray(0, 278), 10);
    } catch (_) { /* ignore */ }
  }

  syxMsg[290] = 0xf7;
  return syxMsg;
}

/**
 * Inyecta una trama SysEx de 291 bytes (o 242 bytes desempaquetados, o cadena hex)
 * de vuelta al Edit Buffer del motor y actualiza toda la UI y el inspector.
 * @param {Uint8Array|Array<number>|string} input
 * @returns {Uint8Array|null} Los 242 bytes desempaquetados aplicados, o null si es inválido.
 */
export function importDeepMindSysExBuffer(input) {
  let raw = null;
  if (typeof input === 'string') {
    const clean = input.trim();
    const hexTokens = clean.replace(/0x/gi, '').match(/[0-9a-fA-F]{2}/g);
    if (hexTokens && hexTokens.length >= 242) {
      raw = new Uint8Array(hexTokens.map((h) => parseInt(h, 16)));
    }
  } else if (input instanceof Uint8Array || Array.isArray(input)) {
    raw = new Uint8Array(input);
  }

  if (!raw) {return null;}

  let unpacked = null;
  if (raw.length >= 291 && raw[0] === 0xf0 && raw[1] === 0x00 && raw[2] === 0x20 && raw[3] === 0x32) {
    const packedPayload = raw.slice(10, 288);
    unpacked = unpackDeepMind7to8(packedPayload);
  } else if (raw.length === 242) {
    unpacked = new Uint8Array(raw);
  } else {
    return null;
  }

  let patchName = 'Imported SysEx';
  const nameChars = [];
  for (let i = 223; i <= 238 && i < unpacked.length; i++) {
    const c = unpacked[i];
    if (c >= 32 && c < 127) {
      nameChars.push(String.fromCharCode(c));
    } else if (c === 0) {
      break;
    }
  }
  if (nameChars.length > 0 && nameChars.join('').trim().length > 0) {
    patchName = nameChars.join('').trim();
  }

  if (typeof window !== 'undefined') {
    window._liveUnpackedBytes = new Uint8Array(unpacked);
    window._lastUnpackedBytes = new Uint8Array(unpacked);
    window._lastPresetName = patchName;
    if (typeof window.triggerMidiDump === 'function') {
      window.triggerMidiDump({ name: patchName, unpackedBytes: unpacked });
    }
  }

  updateLiveSysExInspector(unpacked);
  return unpacked;
}

/**
 * Importa una trama SysEx codificada en Base64 hacia el motor y el inspector.
 * @param {string} base64Str
 * @returns {Uint8Array|null}
 */
export function importSysexBase64(base64Str) {
  if (typeof base64Str !== 'string' || !base64Str.trim()) {return null;}
  try {
    const bin = typeof atob === 'function'
      ? atob(base64Str.trim())
      : Buffer.from(base64Str.trim(), 'base64').toString('binary');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i) & 0xff;
    }
    return importDeepMindSysExBuffer(bytes);
  } catch (_) {
    return null;
  }
}

let _instance = null;
let _isVisible = false;

export function getLiveSysExInspector() {
  if (!_instance) {
    const initialBuf = getCurrentDeepMindSysExBuffer();
    _instance = createLiveSysExInspector({
      title: 'DeepMind Live SysEx Inspector',
      floating: true,
      bytesPerRow: 16,
      initialBuffer: initialBuf,
      onClose: () => {
        _isVisible = false;
      },
      onOpen: () => {
        _isVisible = true;
      },
    });
    _instance.hide();
  }
  return _instance;
}

export function toggleLiveSysExInspector() {
  const inspector = getLiveSysExInspector();
  inspector.toggle();
  _isVisible = inspector.isOpen();
  if (_isVisible) {
    updateLiveSysExInspector();
  }
}

export function updateLiveSysExInspector(rawBytes) {
  if (!_instance || !_instance.isOpen()) {return;}
  const buf = getCurrentDeepMindSysExBuffer(rawBytes);
  _instance.updateBuffer(buf);
}

// ── AboutDialog compartido (@abdsynths/shared/components) ──
let _aboutDialogInstance = null;

export function getAboutDialog() {
  if (!_aboutDialogInstance && typeof document !== 'undefined') {
    _aboutDialogInstance = createAboutDialog({
      id: 'about-modal-backdrop',
      appName: 'ABD Eep',
      subtitle: 'Polyphonic Synthesizer & Hardware Controller — Native / Web',
      description: 'Controlador y editor avanzado unificado compatible con sintetizadores de hardware de la serie Behringer DeepMind y motor DSP TPT ZDF + PolyBLEP.',
      version: '0.2.35',
      buildNumber: 100,
      repo: 'ajabadia/ABDEep',
      manualUrl: 'https://github.com/ajabadia/ABDEep#readme',
      getJuceBackend: () => (typeof window !== 'undefined' && typeof window.getJuceBackend === 'function')
        ? window.getJuceBackend()
        : null,
    });

    if (typeof window !== 'undefined' && window.juce && typeof window.juce.getBuildInfo === 'function') {
      try {
        const res = window.juce.getBuildInfo();
        if (res && typeof res.then === 'function') {
          res.then((info) => {
            if (!info || !_aboutDialogInstance) {return;}
            if (info.version) {
              _aboutDialogInstance.options.version = String(info.version);
              if (_aboutDialogInstance.versionTextEl) {
                const v = String(info.version);
                _aboutDialogInstance.versionTextEl.textContent = v.startsWith('v') ? v : `v${v}`;
              }
            }
            if (info.buildNumber !== undefined && _aboutDialogInstance.rootEl) {
              _aboutDialogInstance.options.buildNumber = info.buildNumber;
              const buildEl = _aboutDialogInstance.rootEl.querySelector('.abd-about-build');
              if (buildEl) {
                buildEl.textContent = `Build #${info.buildNumber}${info.buildTimestamp ? ` (${info.buildTimestamp})` : ''}`;
              }
            }
          }).catch(() => {});
        }
      } catch (_) { /* ignore */ }
    }
  }
  return _aboutDialogInstance;
}

export function openAboutDialog(triggerCheck = false) {
  const dlg = getAboutDialog();
  if (!dlg) {return null;}
  dlg.open();
  if (triggerCheck) {
    dlg.checkForUpdates();
  }
  return dlg;
}

// Exposición en window para compatibilidad con scripts clásicos de ABDEep
if (typeof window !== 'undefined') {
  Object.assign(window, {
    toHexByte,
    decodeSysExHeader,
    LiveSysExInspector,
    createLiveSysExInspector,
    packDeepMind8to7,
    unpackDeepMind7to8,
    getCurrentDeepMindSysExBuffer,
    importDeepMindSysExBuffer,
    importSysexBase64,
    getLiveSysExInspector,
    toggleLiveSysExInspector,
    updateLiveSysExInspector,
    AboutDialog,
    createAboutDialog,
    getAboutDialog,
    openAboutDialog,
  });
}

// Inicialización de escuchadores globales en navegador
if (typeof document !== 'undefined') {
  const initInspectorListeners = () => {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        toggleLiveSysExInspector();
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('#menu-sysex-inspector')) {
        e.preventDefault();
        toggleLiveSysExInspector();
      }
    });

    const sysexLog = document.getElementById('sysex-hex-log');
    if (sysexLog) {
      sysexLog.style.cursor = 'pointer';
      sysexLog.title = 'Click to open Live SysEx Inspector (Ctrl+I)';
      sysexLog.addEventListener('click', (e) => {
        if (!e.shiftKey && !e.ctrlKey) {
          toggleLiveSysExInspector();
        }
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInspectorListeners, { once: true });
  } else {
    initInspectorListeners();
  }
}

export {
  toHexByte,
  decodeSysExHeader,
  LiveSysExInspector,
  createLiveSysExInspector,
  AboutDialog,
  createAboutDialog,
};

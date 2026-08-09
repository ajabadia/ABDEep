// eslint-disable-next-line no-var
var Logger = globalThis.Logger || console;

/**
 * @purpose Event wiring for the SysEx dump viewer: refresh, request HW, global dump, search.
 * @purpose_en Dump viewer button event handlers.
 */

function initDumpView() {
  const dumpBtn = document.querySelector('.btn[data-tab="dump"]');
  if (!dumpBtn) {return;}

  const refreshBtn = document.getElementById('dump-refresh-btn');
  const requestHwBtn = document.getElementById('dump-request-hw-btn');
  const searchInput = document.getElementById('dump-search-input');

  function refreshDump() {
    const bytes = window._lastUnpackedBytes;
    if (typeof window.renderDumpView === 'function') {
      window.renderDumpView(bytes);
    }
  }

  const requestGlobalBtn = document.getElementById('dump-request-global-btn');
  if (requestGlobalBtn) {
    requestGlobalBtn.addEventListener('click', async () => {
      const bridge = getBridge();
      if (!bridge) {
        alert('Bridge not initialized.');
        return;
      }
      requestGlobalBtn.disabled = true;
      requestGlobalBtn.textContent = '\u23f3 Requesting...';
      requestGlobalBtn.classList.add('btn-loading');
      try {
        const response = await bridge.requestMidiDump('global', 4000, 2);
        if (response && response.length >= 30) {
          Logger.log('[GlobalDump] \u2705 Global dump received:', response.length, 'bytes');
          if (typeof window.unpack7to8 === 'function') {
            window._lastUnpackedBytes = response;
            window._lastPresetName = 'GLOBAL SETTINGS DUMP';
            if (typeof window.renderDumpView === 'function') {
              window.renderDumpView(response);
            }
          }
        } else {
          Logger.warn('[GlobalDump] No response from hardware');
        }
      } catch (err) {
        Logger.error('[GlobalDump] Error:', err);
      } finally {
        requestGlobalBtn.disabled = false;
        requestGlobalBtn.textContent = '\ud83c\udf10 Global Dump';
        requestGlobalBtn.classList.remove('btn-loading');
      }
    });
  }

  if (requestHwBtn) {
    requestHwBtn.addEventListener('click', async () => {
      const bridge = getBridge();
      if (!bridge) {
        alert('Bridge not initialized.');
        return;
      }
      requestHwBtn.disabled = true;
      requestHwBtn.textContent = '\u23f3 Requesting...';
      requestHwBtn.classList.add('btn-loading');
      try {
        const response = await bridge.requestMidiDump('edit', 4000, 2);
        if (response && response.length >= 291) {
          const packedPayload = response.slice(8, 286);
          if (typeof window.unpack7to8 === 'function') {
            const unpackedBytes = window.unpack7to8(packedPayload);
            const name = (typeof window.extractNameFromRawSysex === 'function'
                ? window.extractNameFromRawSysex(response)
                : undefined) || 'EDIT BUFFER';
            window._lastUnpackedBytes = unpackedBytes;
            window._lastPresetName = name;
            if (typeof window.renderDumpView === 'function') {
              window.renderDumpView(unpackedBytes);
            }
            Logger.log('[DumpView] \u2705 Dump received and decoded:', name);
          }
        } else {
          Logger.warn('[DumpView] No response from hardware');
        }
      } catch (err) {
        Logger.error('[DumpView] Error requesting dump:', err);
      } finally {
        requestHwBtn.disabled = false;
        requestHwBtn.textContent = '\u2b07 Request from HW';
        requestHwBtn.classList.remove('btn-loading');
      }
    });
  }

  dumpBtn.addEventListener('click', () => {
    setTimeout(refreshDump, 50);
  });

  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshDump);
  }

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(refreshDump, 150);
    });
  }
}

window.initDumpView = initDumpView;

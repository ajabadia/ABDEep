/**
 * @purpose Global Dump request, button management and wiring.
 * Extraído de settings_modal_core.js.
 */

/** @type {typeof console} */
var Logger = globalThis.Logger || console;

/**
 * Request a Global Dump from the hardware and update the UI.
 * @param {string} [statusElId='settings-global-dump-status'] - Element ID for status feedback
 */
function requestGlobalDumpAndUpdate(statusElId) {
    if (!window.dualMidiBridge || !window.dualMidiBridge._connected) {return;}
    
    statusElId = statusElId || 'settings-global-dump-status';
    const statusEl = document.getElementById(statusElId);
    if (statusEl) {
        if (statusEl._hideTimer) {
            clearTimeout(statusEl._hideTimer);
            statusEl._hideTimer = null;
        }
        statusEl.style.display = '';
        void statusEl.offsetWidth;
        statusEl.classList.add('visible', 'spinner');
    }
    
    window.dualMidiBridge.requestMidiDump('global', 3000, 1)
        .then(function(globalResp) {
            if (globalResp && globalResp.length >= 30) {
                window.dualMidiBridge._parseGlobalDump(globalResp);
                if (typeof window.updateSettingsHardwareInfo === 'function') {
                    window.updateSettingsHardwareInfo();
                }
            }
            if (statusEl) {
                statusEl.classList.remove('visible', 'spinner');
                statusEl._hideTimer = setTimeout(function() {
                    statusEl.style.display = 'none';
                    statusEl._hideTimer = null;
                }, 350);
            }
        }).catch(function() {
            if (statusEl) {
                statusEl.classList.remove('visible', 'spinner');
                statusEl._hideTimer = setTimeout(function() {
                    statusEl.style.display = 'none';
                    statusEl._hideTimer = null;
                }, 350);
            }
        });
}

/**
 * Ensure the Global Dump request button exists in the Settings modal DOM.
 * Creates it lazily if not present.
 */
function ensureGlobalDumpButton() {
    if (document.getElementById('settings-request-global-dump')) {return;}
    const infoSection = document.querySelector('#settings-view-connections > .flex-col:last-child');
    if (!infoSection) {return;}
    const btn = document.createElement('button');
    btn.id = 'settings-request-global-dump';
    btn.className = 'btn btn-sm';
    btn.textContent = 'Refresh';
    btn.title = 'Request Global Dump from hardware to refresh MIDI Channel, Device ID, Master Tune and Transpose';
    btn.classList.add('settings-global-dump-btn');
    const container = infoSection.querySelector('.text-center.text-uppercase.text-dim');
    if (container) {
        container.appendChild(btn);
    }
}

/**
 * Wire the click event on the Global Dump request button.
 * Idempotent — only wires once using _wired flag.
 */
function wireGlobalDumpButton() {
    const btn = document.getElementById('settings-request-global-dump');
    if (!btn) {return;}
    if (btn._wired) {return;}
    btn._wired = true;
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        requestGlobalDumpAndUpdate();
    });
}

// Expose to window
window.requestGlobalDumpAndUpdate = requestGlobalDumpAndUpdate;
window.ensureGlobalDumpButton = ensureGlobalDumpButton;
window.wireGlobalDumpButton = wireGlobalDumpButton;

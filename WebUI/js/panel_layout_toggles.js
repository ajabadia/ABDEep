/**
 * @purpose Panel layout toggles: screen/scope height controls, audio waveform polling,
 *           and panel mutation observer for auto-start/stop animations.
 * Extraído de panel_animations.js para SRP.
 * @classification Module/Panel/Layout
 */

/* ── Screen & Scope Height Toggles ── */

window.updateScreenHeight = function() {
    const state = window.panelEditState;
    const screenEl = document.getElementById('panel-graphic-screen');
    const screenToggleBtn = document.getElementById('panel-graphic-toggle');
    const noScreenModes = ['POLY', 'PORTA', 'CHORD', 'POLY_CHORD'];
    if (!screenEl || !screenToggleBtn) {return;}
    if (noScreenModes.includes(state.currentPanelMode)) {
        screenEl.style.height = '0px';
        screenEl.style.borderBottomWidth = '0px';
        screenEl.style.display = 'none';
        screenToggleBtn.style.display = 'none';
    } else {
        screenEl.style.display = 'flex';
        screenToggleBtn.style.display = 'block';
        if (state.isScreenCollapsed) {
            screenEl.style.height = '0px';
            screenEl.style.borderBottomWidth = '0px';
            screenToggleBtn.innerHTML = '&#9660; EXPAND &#9660;';
        } else {
            screenEl.style.height = '100px';
            screenEl.style.borderBottomWidth = '1.5px';
            screenToggleBtn.innerHTML = '&#9650; COLLAPSE &#9650;';
        }
    }
};

window.updateRealScopeHeight = function() {
    const state = window.panelEditState;
    const realScopeScreenEl = document.getElementById('panel-real-scope-screen');
    const realScopeToggleBtn = document.getElementById('panel-real-scope-toggle');
    const noScopeModes = ['POLY', 'PORTA', 'CHORD', 'POLY_CHORD', 'ARP'];
    if (!realScopeScreenEl || !realScopeToggleBtn) {return;}
    const isJuce = window.dualMidiBridge && window.dualMidiBridge.isJuce;
    const hasWebAudio = window.wasmBridge && window.wasmBridge.isAudioStarted;
    const toolbar = document.getElementById('scope-toolbar');
    if (noScopeModes.includes(state.currentPanelMode)) {
        realScopeScreenEl.style.display = 'none';
        realScopeToggleBtn.style.display = 'none';
        _stopAudioWaveformPolling();
        return;
    }
    realScopeScreenEl.style.display = 'flex';
    realScopeToggleBtn.style.display = 'block';
    if (state.isRealScopeCollapsed) {
        realScopeScreenEl.style.height = '0px';
        realScopeScreenEl.style.borderBottomWidth = '0px';
        if (isJuce) {
            realScopeToggleBtn.innerHTML = '🔴 DSP SCOPE (off)';
        } else if (hasWebAudio) {
            realScopeToggleBtn.innerHTML = '🔴 WEB SCOPE (off)';
        } else {
            realScopeToggleBtn.innerHTML = '⚫ DSP SCOPE (no engine)';
        }
        if (toolbar) {toolbar.style.display = 'none';}
    } else {
        realScopeScreenEl.style.height = '113px';
        realScopeScreenEl.style.borderBottomWidth = '1.5px';
        if (isJuce) {
            realScopeToggleBtn.innerHTML = '🟢 DSP SCOPE (live)';
        } else if (hasWebAudio) {
            realScopeToggleBtn.innerHTML = '🟢 WEB SCOPE (live)';
        } else {
            realScopeToggleBtn.innerHTML = '⚫ DSP SCOPE (no engine)';
        }
        if (toolbar) {toolbar.style.display = 'flex';}
    }
};

/* ── Audio Waveform Polling ── */

let _audioWaveformTimer = null;

function _startAudioWaveformPolling() {
    if (_audioWaveformTimer) {return;}
    _audioWaveformTimer = setInterval(function() {
        const bridge = window.dualMidiBridge;
        if (!bridge || !bridge.isJuce) {return;}
        bridge.getAudioWaveform().catch(function() {});
    }, 33);
}

function _stopAudioWaveformPolling() {
    if (_audioWaveformTimer) {
        clearInterval(_audioWaveformTimer);
        _audioWaveformTimer = null;
    }
}

window._updateAudioWaveformPolling = function() {
    const hasBridge = window.dualMidiBridge;
    const isJuce = hasBridge && hasBridge.isJuce;
    const progToggle = window.programmerDisplayToggle;
    const isProgScopeActive = progToggle && progToggle.mode !== 'sysex';
    const panel = document.getElementById('detail-edit-panel');
    const state = window.panelEditState || {};
    const isSidePanelScopeActive = panel && panel.classList.contains('active') && !state.isRealScopeCollapsed;

    const shouldPoll = isJuce && (isProgScopeActive || isSidePanelScopeActive);
    if (shouldPoll) {
        _startAudioWaveformPolling();
    } else {
        _stopAudioWaveformPolling();
    }
};

/* ── Panel Mutation Observer ── */

window._initPanelObserver = function() {
    const panel = document.getElementById('detail-edit-panel');
    const state = window.panelEditState;
    const noScreenModes = ['POLY', 'PORTA', 'CHORD', 'POLY_CHORD'];
    if (!panel) {return;}

    const observer = new MutationObserver(function() {
        if (panel.classList.contains('active') && !noScreenModes.includes(state.currentPanelMode)) {
            if (typeof window._startCanvasAnimation === 'function') {
                window._startCanvasAnimation();
            }
            window._updateAudioWaveformPolling();
        } else if (!panel.classList.contains('active')) {
            window._updateAudioWaveformPolling();
        }
    });
    observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
};

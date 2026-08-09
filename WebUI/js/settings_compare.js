// eslint-disable-next-line no-var
var Logger = globalThis.Logger || console;

/**
 * @purpose Modo Compare Mode: snapshot/restore del buffer editado, diff count e indicadores LCD.
 * Extraído de settings.js como parte de la modularización.
 */

let compareActive = false;
let preCompareSnapshot = null;
let preComparePatchName = '';

/**
 * Compute the number of parameters that differ between the snapshot and current parameterCache.
 * @param {string} snapshotStr - JSON string of the snapshot
 * @returns {number} - Count of differing parameters
 */
function _computeCompareDiff(snapshotStr) {
    if (!snapshotStr || !window.dualMidiBridge) {return 0;}
    try {
        const snap = JSON.parse(snapshotStr);
        const cache = window.dualMidiBridge.parameterCache;
        let count = 0;
        for (const paramId in snap) {
            if (snap.hasOwnProperty(paramId)) {
                const cached = cache[paramId];
                const snapped = snap[paramId];
                if (typeof snapped === 'object' || typeof cached === 'object') {continue;}
                if (cached === undefined || Math.abs(cached - snapped) > 0.001) {
                    count++;
                }
            }
        }
        return count;
    } catch (e) {
        return 0;
    }
}

/**
 * Restore the edited buffer from the pre-compare snapshot.
 */
function _exitCompareMode() {
    if (!compareActive) {return;}
    const lcdText = document.getElementById('lcd-text');
    const compareBtn = document.getElementById('programmer-compare-btn');
    
    if (preCompareSnapshot && window.dualMidiBridge) {
        try {
            const cache = JSON.parse(preCompareSnapshot);
            const paramIds = Object.keys(cache);
            paramIds.forEach(function(paramId) {
                const val = cache[paramId];
                window.dualMidiBridge.parameterCache[paramId] = val;
                window.dualMidiBridge.onParameterChangedCallbacks.forEach(function(cb) {
                    try { cb(paramId, val); } catch(e) {}
                });
            });
            
            if (typeof window.updateLfoSlidersFromCurrentPreset === 'function') {window.updateLfoSlidersFromCurrentPreset();}
            if (typeof window.updateEnvSlidersFromCurrentPreset === 'function') {window.updateEnvSlidersFromCurrentPreset();}
            if (typeof window.updateOscSlidersFromCurrentPreset === 'function') {window.updateOscSlidersFromCurrentPreset();}
            
            if (lcdText && preComparePatchName) {
                const html = '<span class="lcd-label">COMPARE — RESTORED</span><br>'
                    + '<strong class="text-accent-green">' + preComparePatchName.toUpperCase() + '</strong><br>'
                    + '<span class="lcd-compare-original">EDITED BUFFER RESTORED</span>';
                window.lcdSafeUpdate(lcdText, html);
            }
        } catch (e) {
            Logger.warn('[Compare] Error restoring snapshot:', e);
        }
    }
    
    compareActive = false;
    preCompareSnapshot = null;
    if (compareBtn) {
        compareBtn.classList.remove('active');
        compareBtn.textContent = 'Compare';
    }
}

/**
 * Toggle Compare Mode ON/OFF.
 * ON: takes a snapshot of current parameterCache and loads the original preset.
 * OFF: restores the snapshot.
 */
function toggleCompareMode() {
    const lcdText = document.getElementById('lcd-text');
    const compareBtn = document.getElementById('programmer-compare-btn');
    if (!lcdText) {return;}

    if (!compareActive) {
        const bridge = window.dualMidiBridge;
        if (!bridge) {return;}
        
        const activeBank = window.loadedBanks[window.currentActiveBank];
        const activePatch = activeBank && activeBank[window.currentActivePatchIndex];
        preComparePatchName = activePatch ? activePatch.name : 'UNKNOWN PATCH';
        preCompareSnapshot = JSON.stringify(bridge.parameterCache);
        
        const initialDiff = _computeCompareDiff(preCompareSnapshot);
        if (activePatch && activePatch.unpackedBytes && window.triggerMidiDump) {
            window.triggerMidiDump(activePatch);
        }
        
        compareActive = true;
        if (compareBtn) {
            compareBtn.classList.add('active');
            compareBtn.textContent = 'Compare (' + initialDiff + ')';
        }
        
        lcdText.innerHTML = '<span class="lcd-label">COMPARE MODE</span><br>'
            + '<strong>' + preComparePatchName.toUpperCase() + '</strong><br>'
            + '<span class="lcd-compare-original">ORIGINAL PRESET</span>';
    } else {
        _exitCompareMode();
    }
}

/**
 * @returns {boolean} Whether Compare Mode is currently active.
 */
function isCompareActive() {
    return compareActive;
}

/**
 * Update the diff count on the Compare button (called on parameter change).
 */
function _updateCompareDiff() {
    if (compareActive) {
        const diff = _computeCompareDiff(preCompareSnapshot);
        const compareBtn = document.getElementById('programmer-compare-btn');
        if (compareBtn) {
            compareBtn.textContent = 'Compare (' + diff + ')';
            compareBtn.title = diff + ' parameters differ from original';
        }
    }
}

/**
 * Wire the Compare Mode button and parameter change listener.
 * Called during initialization after the facade is loaded.
 */
function initCompareMode() {
    const compareBtn = document.getElementById('programmer-compare-btn');
    if (compareBtn) {
        compareBtn.classList.add('compare-mode-btn');
        compareBtn.addEventListener('click', toggleCompareMode);
    }
    
    if (window.dualMidiBridge && typeof window.dualMidiBridge.onParameterChanged === 'function') {
        window.dualMidiBridge.onParameterChanged(function(_paramId, _val) {
            _updateCompareDiff();
        });
    }
}

// Expose for backward compatibility and tests
window.toggleCompareMode = toggleCompareMode;
window.isCompareActive = isCompareActive;
window._updateCompareDiff = _updateCompareDiff;
window._exitCompareMode = _exitCompareMode;
window._computeCompareDiff = _computeCompareDiff;
window.initCompareMode = initCompareMode;

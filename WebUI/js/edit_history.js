/**
 * @purpose Manages Undo/Redo stack history, state snapshot capture/restore, and parameter debounced history registration.
 * @purpose_en Undo/Redo history stack service.
 */

let undoStack = [];
window.undoStack = undoStack;
let redoStack = [];
window.redoStack = redoStack;
const maxHistory = 50;
let isHistoryAction = false;
window.isHistoryAction = isHistoryAction;

function captureParamSnapshot() {
    if (!window.dualMidiBridge) return null;
    return JSON.stringify(window.dualMidiBridge.parameterCache);
}
window.captureParamSnapshot = captureParamSnapshot;

function restoreParamSnapshot(snapshotStr) {
    if (!snapshotStr || !window.dualMidiBridge) return;
    window.isHistoryAction = true;
    isHistoryAction = true;
    
    const cache = JSON.parse(snapshotStr);
    Object.keys(cache).forEach(paramId => {
        const val = cache[paramId];
        window.dualMidiBridge.setParameter(paramId, val);
        window.dualMidiBridge.handleParameterChangeFromBackend(paramId, val);
    });

    if (typeof window.updateLfoSlidersFromCurrentPreset === 'function') window.updateLfoSlidersFromCurrentPreset();
    if (typeof window.updateEnvSlidersFromCurrentPreset === 'function') window.updateEnvSlidersFromCurrentPreset();
    if (typeof window.updateOscSlidersFromCurrentPreset === 'function') window.updateOscSlidersFromCurrentPreset();

    window.isHistoryAction = false;
    isHistoryAction = false;
    
    const lcdText = document.getElementById('lcd-text');
    if (lcdText) {
        lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">EDIT HISTORY</span><br><strong>STATE RESTORED</strong>`;
    }
}
window.restoreParamSnapshot = restoreParamSnapshot;

window.initEditHistory = function() {
    if (window.dualMidiBridge) {
        let changeTimeout = null;
        window.dualMidiBridge.onParameterChanged((paramId, val) => {
            if (window.isHistoryAction || isHistoryAction) return;

            clearTimeout(changeTimeout);
            changeTimeout = setTimeout(() => {
                const snap = captureParamSnapshot();
                if (snap) {
                    if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== snap) {
                        undoStack.push(snap);
                        if (undoStack.length > maxHistory) undoStack.shift();
                        redoStack.length = 0; // Clear redo
                    }
                }
            }, 400);
        });
    }
};

window.triggerUndo = function() {
    if (undoStack.length <= 1) {
        alert("No hay más cambios que deshacer.");
        return;
    }
    const current = undoStack.pop();
    redoStack.push(current);
    
    const previous = undoStack[undoStack.length - 1];
    restoreParamSnapshot(previous);
};

window.triggerRedo = function() {
    if (redoStack.length === 0) {
        alert("No hay cambios para rehacer.");
        return;
    }
    const nextState = redoStack.pop();
    undoStack.push(nextState);
    restoreParamSnapshot(nextState);
};

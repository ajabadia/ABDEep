// WebUI/js/settings_controls.js — Controller curves + write/bank button settings
// Extracted from settings.js (initControllerCurves, initWriteAndBankButtons)

function initControllerCurves() {
    const atCurveSel = document.getElementById('settings-curve-aftertouch');
    const mwCurveSel = document.getElementById('settings-curve-modwheel');
    const pbCurveSel = document.getElementById('settings-curve-pitchbend');
    if (atCurveSel) {
        const savedAt = window.getControllerCurve('aftertouch');
        atCurveSel.value = savedAt;
        atCurveSel.addEventListener('change', () => {
            window.setControllerCurve('aftertouch', atCurveSel.value);
            window.drawCurvePreview(atCurveSel.value);
        });
    }
    if (mwCurveSel) {
        const savedMw = window.getControllerCurve('modwheel');
        mwCurveSel.value = savedMw;
        mwCurveSel.addEventListener('change', () => {
            window.setControllerCurve('modwheel', mwCurveSel.value);
            window.drawCurvePreview(mwCurveSel.value);
        });
    }
    if (pbCurveSel) {
        const savedPb = window.getControllerCurve('pitchbend');
        pbCurveSel.value = savedPb;
        pbCurveSel.addEventListener('change', () => {
            window.setControllerCurve('pitchbend', pbCurveSel.value);
            window.drawCurvePreview(pbCurveSel.value, true);
        });
    }
    if (atCurveSel && typeof window.drawCurvePreview === 'function') {
        window.drawCurvePreview(atCurveSel.value);
    }
    if (typeof window._setupCustomCurveCanvas === 'function') {
        window._setupCustomCurveCanvas();
    }
}

function initWriteAndBankButtons() {
    const writeBtn = document.getElementById('programmer-write-btn');
    if (writeBtn) {
        writeBtn.addEventListener('click', () => {
            const saveBtn = document.getElementById('menu-save');
            if (saveBtn) {
                saveBtn.click();
            } else {
                alert('Selecciona primero un preset de usuario en el Bank Manager para sobrescribir.');
            }
        });
    }

    const bankUpBtn = document.getElementById('programmer-bank-up-btn');
    if (bankUpBtn) {
        bankUpBtn.addEventListener('click', () => {
            if (typeof window.playKeyLedAnimation === 'function') {window.playKeyLedAnimation('bank-up');}
            if (window.currentActivePatchIndex === -1) {return;}
            const nextIdx = (window.currentActivePatchIndex + 1) % 128;
            window.currentActivePatchIndex = nextIdx;
            const activeBank = window.loadedBanks[window.currentActiveBank];
            if (activeBank && activeBank[nextIdx]) {
                const patch = activeBank[nextIdx];
                if (window.triggerMidiDump) {window.triggerMidiDump(patch);}
                if (typeof window.renderPatchesForBank === 'function') {window.renderPatchesForBank(window.currentActiveBank);}
            }
        });
    }

    const bankDownBtn = document.getElementById('programmer-bank-down-btn');
    if (bankDownBtn) {
        bankDownBtn.addEventListener('click', () => {
            if (typeof window.playKeyLedAnimation === 'function') {window.playKeyLedAnimation('bank-down');}
            if (window.currentActivePatchIndex === -1) {return;}
            const prevIdx = (window.currentActivePatchIndex - 1 + 128) % 128;
            window.currentActivePatchIndex = prevIdx;
            const activeBank = window.loadedBanks[window.currentActiveBank];
            if (activeBank && activeBank[prevIdx]) {
                const patch = activeBank[prevIdx];
                if (window.triggerMidiDump) {window.triggerMidiDump(patch);}
                if (typeof window.renderPatchesForBank === 'function') {window.renderPatchesForBank(window.currentActiveBank);}
            }
        });
    }
}

// Expose for facade and tests
window.initControllerCurves = initControllerCurves;
window.initWriteAndBankButtons = initWriteAndBankButtons;

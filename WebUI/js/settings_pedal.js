// WebUI/js/settings_pedal.js — Pedal type, polarity, sustain mode settings
// Extracted from settings.js (initPedalPolaritySetting, initPedalSettings)

function initPedalPolaritySetting() {
    const sel = document.getElementById('settings-pedal-polarity');
    if (!sel) {return;}
    const saved = localStorage.getItem('abd-eep-pedal-polarity') || 'norm-open';
    sel.value = saved;
    sel.addEventListener('change', function() {
        localStorage.setItem('abd-eep-pedal-polarity', this.value);
        if (window.dualMidiBridge) {
            window.dualMidiBridge.setGlobalParameter('pedal_polarity', this.value === 'norm-closed' ? 1.0 : 0.0);
        }
    });
}

function initPedalSettings() {
    const pedalType = document.getElementById('settings-pedal-type');
    const sustain = document.getElementById('settings-pedal-sustain');
    const sustainMode = document.getElementById('settings-pedal-sustain-mode');
    if (pedalType) {
        const saved = localStorage.getItem('abd-eep-pedal-type') || 'foot-ctrl';
        pedalType.value = saved;
        pedalType.addEventListener('change', function() { localStorage.setItem('abd-eep-pedal-type', this.value); });
    }
    if (sustain) {
        const saved = localStorage.getItem('abd-eep-pedal-sustain') || 'norm-open';
        sustain.value = saved;
        sustain.addEventListener('change', function() { localStorage.setItem('abd-eep-pedal-sustain', this.value); });
    }
    if (sustainMode) {
        const saved = localStorage.getItem('abd-eep-pedal-sustain-mode') || 'sustain';
        sustainMode.value = saved;
        sustainMode.addEventListener('change', function() { localStorage.setItem('abd-eep-pedal-sustain-mode', this.value); });
    }
}

// Expose for facade and tests
window.initPedalPolaritySetting = initPedalPolaritySetting;
window.initPedalSettings = initPedalSettings;

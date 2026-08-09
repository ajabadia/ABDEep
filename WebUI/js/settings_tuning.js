// WebUI/js/settings_tuning.js — Master tune + transpose settings
// Extracted from settings.js (initMasterTuneSetting, initTransposeSetting)

function initMasterTuneSetting() {
    const sel = document.getElementById('settings-master-tune');
    if (!sel) {return;}
    const saved = localStorage.getItem('abd-eep-master-tune');
    if (saved) {sel.value = saved;}
    sel.addEventListener('change', function() {
        localStorage.setItem('abd-eep-master-tune', this.value);
        if (getBridge()) {
            const idx = parseInt(this.value.match(/[+-]?\d+/));
            getBridge().setGlobalParameter('global_tune', (idx + 128) / 255.0);
        }
    });
    if (saved && getBridge()) {
        const idx = parseInt(saved.match(/[+-]?\d+/));
        getBridge().setGlobalParameter('global_tune', (idx + 128) / 255.0);
    }
}

function initTransposeSetting() {
    const sel = document.getElementById('settings-transpose');
    if (!sel) {return;}
    const saved = localStorage.getItem('abd-eep-transpose');
    if (saved) {sel.value = saved;}
    sel.addEventListener('change', function() {
        localStorage.setItem('abd-eep-transpose', this.value);
        if (getBridge()) {
            const semitones = parseInt(this.value);
            getBridge().setGlobalParameter('transpose', (semitones + 48) / 96.0);
        }
    });
    if (saved && getBridge()) {
        const semitones = parseInt(saved);
        getBridge().setGlobalParameter('transpose', (semitones + 48) / 96.0);
    }
}

// Expose for facade and tests
window.initMasterTuneSetting = initMasterTuneSetting;
window.initTransposeSetting = initTransposeSetting;

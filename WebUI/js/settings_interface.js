// WebUI/js/settings_interface.js — Display/UI preference settings
// Extracted from settings.js (initFadeSpeed, initLcdTimeoutSetting, initLcdVelocitySetting,
//   initPbSensitivitySetting, initLcdContrastSetting, initBarStyleSetting, initPitchBendModeSetting)

function initFadeSpeed() {
    const fadeSel = document.getElementById('settings-fade-speed');
    if (!fadeSel) {return;}
    const saved = localStorage.getItem('abd-eep-fade-speed') || 'normal';
    fadeSel.value = saved;
    fadeSel.addEventListener('change', () => {
        localStorage.setItem('abd-eep-fade-speed', fadeSel.value);
    });
}

function initLcdTimeoutSetting() {
    const sel = document.getElementById('settings-lcd-timeout');
    if (!sel) {return;}
    const saved = localStorage.getItem('abd-eep-lcd-timeout') || '2000';
    sel.value = saved;
    sel.addEventListener('change', () => {
        localStorage.setItem('abd-eep-lcd-timeout', sel.value);
    });
}

function initLcdVelocitySetting() {
    const velSel = document.getElementById('settings-lcd-velocity');
    if (!velSel) {return;}
    const saved = localStorage.getItem('abd-eep-lcd-velocity') || 'show';
    velSel.value = saved;
    velSel.addEventListener('change', () => {
        localStorage.setItem('abd-eep-lcd-velocity', velSel.value);
    });
}

function initPbSensitivitySetting() {
    const pbSlider = document.getElementById('settings-pb-sensitivity');
    const pbVal = document.getElementById('settings-pb-sensitivity-val');
    if (!pbSlider) {return;}
    const saved = localStorage.getItem('abd-eep-pb-sensitivity') || '6';
    pbSlider.value = saved;
    if (pbVal) {pbVal.textContent = saved + 'px';}
    pbSlider.addEventListener('input', () => {
        const val = pbSlider.value;
        localStorage.setItem('abd-eep-pb-sensitivity', val);
        if (pbVal) {pbVal.textContent = val + 'px';}
    });
}

function initLcdContrastSetting() {
    const slider = document.getElementById('settings-lcd-contrast');
    const valEl = document.getElementById('settings-lcd-contrast-val');
    if (!slider) {return;}
    const saved = localStorage.getItem('abd-eep-lcd-contrast') || '70';
    slider.value = saved;
    if (valEl) {valEl.textContent = saved + '%';}
    window.updateLcdContrast = function(v) {
        const lcdEl = document.querySelector('.lcd-screen, #lcd-screen, .lcd');
        if (lcdEl) {lcdEl.style.opacity = (v / 100).toFixed(2);}
        document.documentElement.style.setProperty('--lcd-opacity', (v / 100).toFixed(2));
    };
    window.updateLcdContrast(parseInt(saved));
    slider.addEventListener('input', function() {
        const val = this.value;
        localStorage.setItem('abd-eep-lcd-contrast', val);
        if (valEl) {valEl.textContent = val + '%';}
        window.updateLcdContrast(parseInt(val));
        if (getBridge()) {
            getBridge().setGlobalParameter('lcd_contrast', parseInt(val) / 100.0);
        }
    });
}

function initBarStyleSetting() {
    const sel = document.getElementById('settings-bar-style');
    if (!sel) {return;}
    const saved = localStorage.getItem('abd-eep-bar-style') || 'solid';
    sel.value = saved;
    sel.addEventListener('change', () => {
        localStorage.setItem('abd-eep-bar-style', sel.value);
    });
}

function initPitchBendModeSetting() {
    const sel = document.getElementById('settings-pitch-bend-mode');
    if (!sel) {return;}
    const saved = localStorage.getItem('abd-eep-pitch-bend-mode') || 'all';
    sel.value = saved;
    sel.addEventListener('change', function() {
        localStorage.setItem('abd-eep-pitch-bend-mode', this.value);
    });
}

// Expose for facade and tests
window.initFadeSpeed = initFadeSpeed;
window.initLcdTimeoutSetting = initLcdTimeoutSetting;
window.initLcdVelocitySetting = initLcdVelocitySetting;
window.initPbSensitivitySetting = initPbSensitivitySetting;
window.initLcdContrastSetting = initLcdContrastSetting;
window.initBarStyleSetting = initBarStyleSetting;
window.initPitchBendModeSetting = initPitchBendModeSetting;
window.updateLcdContrast = window.updateLcdContrast || function() {};

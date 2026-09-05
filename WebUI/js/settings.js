/**
 * @purpose Fachada principal de Ajustes. Inicializa los submódulos especializados
 * (settings_theme.js, settings_midi_ports.js, settings_compare.js, settings_modal_core.js,
 *  settings_routing.js, settings_fx_presets.js, settings_interface.js, settings_velocity.js,
 *  settings_pedal.js, settings_tuning.js, settings_midi_config.js, settings_advanced.js,
 *  settings_calibration.js, settings_controls.js)
 * y expone las APIs globales en window para compatibilidad con tests y otros scripts.
 */

/* global initFadeSpeed, initLcdTimeoutSetting, initLcdVelocitySetting, initPbSensitivitySetting,
          initLcdContrastSetting, initBarStyleSetting, initPitchBendModeSetting,
          initRoutingSettings, initPolyChainSettings, initFxPresetsSetting,
          initVelocityCurveSetting, initPedalPolaritySetting, initPedalSettings,
          initMasterTuneSetting, initTransposeSetting, initMidiChannelSetting,
          initMidiClockSetting, initDeviceIdSetting, initAdvancedSettings,
          initCalibrationSettings, initControllerCurves, initWriteAndBankButtons */

function initSettingsAndModals() {
    // ── Initialize existing sub-modules ──
    if (typeof window.initThemeSelector === 'function') { window.initThemeSelector(); }
    if (typeof window.initNavbarThemeSelector === 'function') { window.initNavbarThemeSelector(); }
    if (typeof window.initSettingsModals === 'function') { window.initSettingsModals(); }
    if (typeof window.initCompareMode === 'function') { window.initCompareMode(); }

    if (typeof window.initResyncButton === 'function') { window.initResyncButton(); }
    if (typeof window.initSynthInfoRefresh === 'function') { window.initSynthInfoRefresh(); }
    if (typeof window.initGlobalRefreshButton === 'function') { window.initGlobalRefreshButton(); }

    // ── Initialize from settings_interface.js ──
    initFadeSpeed();
    initLcdTimeoutSetting();
    initLcdVelocitySetting();
    initPbSensitivitySetting();
    initLcdContrastSetting();
    initBarStyleSetting();
    initPitchBendModeSetting();

    // ── Initialize from settings_routing.js ──
    initRoutingSettings();
    initPolyChainSettings();

    // ── Initialize from settings_fx_presets.js ──
    initFxPresetsSetting();

    // ── Initialize from settings_velocity.js ──
    initVelocityCurveSetting();

    // ── Initialize from settings_pedal.js ──
    initPedalPolaritySetting();
    initPedalSettings();

    // ── Initialize from settings_tuning.js ──
    initMasterTuneSetting();
    initTransposeSetting();

    // ── Initialize from settings_midi_config.js ──
    initMidiChannelSetting();
    initMidiClockSetting();
    initDeviceIdSetting();
    initProtectUnsavedEditsSetting();

    // ── Initialize from settings_advanced.js ──
    initAdvancedSettings();

    // ── Initialize from settings_calibration.js ──
    initCalibrationSettings();

    // ── Initialize from settings_controls.js ──
    initControllerCurves();
    initWriteAndBankButtons();

    // ── Initialize external sub-modules ──
    if (typeof window.initKeyboardShortcutsSettings === 'function') {
        window.initKeyboardShortcutsSettings();
    }
}

// ── Lazy init helper for settings that depend on dualMidiBridge ──
function _initWithFallback(initFn, intervalMs) {
    if (getBridge()) {
        initFn();
    } else {
        const timer = setInterval(function() {
            if (getBridge()) {
                clearInterval(timer);
                initFn();
            }
        }, intervalMs || 100);
    }
}

// Expose facade and utility for tests
window.initSettingsAndModals = initSettingsAndModals;
window._initWithFallback = _initWithFallback;

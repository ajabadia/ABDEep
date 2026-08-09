/**
 * @purpose Shared state object for the detail editor slide panel.
 * @purpose_en Tracks current panel mode, active LFO/ENV/OSC, scope settings, and animation time.
 */

window.panelEditState = {
    currentPanelMode: 'LFO',
    panelActiveLfo: 1,
    panelActiveEnv: 1, // 1 = VCA, 2 = VCF, 3 = MOD
    panelActiveOsc: 1, // 1 or 2
    isScreenCollapsed: false,
    isRealScopeCollapsed: true,
    _scopeTriggerMode: 0,    // 0=Free, 1=Auto, 2=Normal
    _scopeZoom: 1,           // 1x, 2x, 4x
    _scopeColorScheme: 0,    // 0=Brand, 1=CRT Green, 2=Blue, 3=Amber
    _scopeLastSamples: null,
    _scopeAutoTriggerTime: 0,
    _animTime: 0
};

/**
 * @purpose Generates specialized HTML templates for the 35 DeepMind 12 effect types and controls dial drag/rotation logic.
 * @purpose_en Effects HTML template layouts and dial rotation services.
 *
 * Sub-modules extracted to:
 *   effects_theme.js             → FX_THEME_COLORS + _getFxTheme + _fxThemeStyle
 *   effects_render_params.js     → renderActiveEffectParams (with interactive controls)
 */

function _readFxParamValue(paramId, fallbackByte, defaultVal) {
    const bridge = getBridge();
    if (bridge && bridge.parameterCache && bridge.parameterCache[paramId] !== undefined) {
        return bridge.parameterCache[paramId];
    }
    if (typeof window.currentActivePatchIndex !== 'undefined' && window.currentActivePatchIndex !== -1) {
        const activeBank = window.loadedBanks[window.currentActiveBank];
        if (activeBank) {
            const patch = activeBank[window.currentActivePatchIndex];
            if (patch && patch.unpackedBytes && patch.unpackedBytes[fallbackByte] !== undefined) {
                return patch.unpackedBytes[fallbackByte] / 255.0;
            }
        }
    }
    return defaultVal;
}
window._readFxParamValue = _readFxParamValue;

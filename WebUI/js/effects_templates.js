/**
 * @purpose Generates specialized HTML templates for the 35 DeepMind 12 effect types and controls dial drag/rotation logic.
 * @purpose_en Effects HTML template layouts and dial rotation services.
 *
 * Sub-modules extracted to:
 *   effects_render_params.js     → renderActiveEffectParams (reparte o sincroniza)
 *   fx_slot_knobs.js             → los doce mandos de cada hueco
 *
 * Lo que hay aqui ya no son "plantillas de los 35 efectos": eso se fue con
 * `effects_renderers_*.js` y `effects_templates_renderers.js`, cuyos ids estaban
 * numerados contra una tabla de efectos que ya no es la de
 * `FXSlot_Factory.cpp`. Alli un amplificador de guitarra (id 7) se pintaba como
 * una plate reverb y un faser (id 9) como una reverb con puerta. La verdad de
 * quantos mandos tiene cada efecto esta ahora en el contrato, y la pinta
 * `fx_slot_knobs.js`.
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

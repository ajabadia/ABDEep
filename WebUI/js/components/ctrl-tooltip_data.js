/**
 * @module ctrl-tooltip_data
 * @purpose Data layer for CtrlTooltip: parameter metadata lookup and custom button text map.
 *   Extracted from ctrl-tooltip.js for SRP.
 * @classification Data
 */
window.buildTooltipParamMeta = function () {
    'use strict';
    const meta = {};
    const byteMap = window.BYTE_MAP || [];
    const bridge = window.dualMidiBridge;
    const paramToOffset = bridge ? (bridge.paramToByteOffset || {}) : {};

    // Index byte-map entries by param id (the name in the map)
    byteMap.forEach(function (info, idx) {
        if (!info) {return;}
        const nrpnMsb = idx < 128 ? 0 : 1;
        const nrpnLsb = idx < 128 ? idx : idx - 128;
        meta[info.param] = {
            name: info.param,
            region: info.region,
            byteOffset: idx,
            nrpn: 'NRPN ' + nrpnMsb + ':' + String(nrpnLsb).padStart(2, '0'),
            nrpnMsb: nrpnMsb,
            nrpnLsb: nrpnLsb,
            type: info.type,
            desc: info.desc || '',
            enumLabels: info.enumLabels || null
        };
    });

    // Build paramId -> meta from bridge's paramToByteOffset
    const paramMeta = {};
    for (const [paramId, byteOffset] of Object.entries(paramToOffset)) {
        const byteInfo = byteMap[byteOffset];
        const nrpnMsb = byteOffset < 128 ? 0 : 1;
        const nrpnLsb = byteOffset < 128 ? byteOffset : byteOffset - 128;

        paramMeta[paramId] = {
            name: byteInfo ? byteInfo.param : paramId.replace(/_/g, ' '),
            region: byteInfo ? byteInfo.region : '?',
            byteOffset: byteOffset,
            nrpn: 'NRPN ' + nrpnMsb + ':' + String(nrpnLsb).padStart(2, '0'),
            nrpnMsb: nrpnMsb,
            nrpnLsb: nrpnLsb,
            type: byteInfo ? byteInfo.type : 'value',
            desc: byteInfo ? (byteInfo.desc || '') : '',
            enumLabels: byteInfo ? (byteInfo.enumLabels || null) : null
        };
    }

    // Store for fallback lookups by byte-map name
    paramMeta._byteMap = meta;
    return paramMeta;
};

/** Get custom tooltip text for known programmer buttons by element id */
window.getTooltipCustomText = function (el) {
    'use strict';
    let idMap = window._TOOLTIP_BUTTON_MAP;
    if (!idMap) {
        idMap = {
            'programmer-bank-mngr-btn':    { name: 'Bank Manager',          desc: 'Load, save, and organize patches' },
            'programmer-mod-matrix-btn':   { name: 'Modulation Matrix',     desc: '8 configurable modulation slots' },
            'programmer-fx-btn':           { name: 'Effects Engine',        desc: '4 FX slots with routing' },
            'programmer-arp-btn':          { name: 'Arpeggiator',           desc: 'Pattern-based note sequencer' },
            'programmer-seq-btn':          { name: 'Sequencer',             desc: '32-step control sequencer' },
            'programmer-chord-btn':        { name: 'Chord Memory',          desc: 'One-touch chord playback' },
            'random-preset-btn':           { name: 'Random Preset Generator', desc: 'Musically-random patch generator' },
            'programmer-midi-learn-btn':   { name: 'MIDI Learn',            desc: 'Map hardware controls to parameters' },
            'programmer-polychord-btn':    { name: 'Poly Chord',            desc: 'Polyphonic chord memory' },
            'programmer-compare-btn':      { name: 'Compare Mode',          desc: 'Compare edited patch vs original' },
            'programmer-write-btn':        { name: 'Write Patch',           desc: 'Write current patch to selected bank slot' },
            'programmer-global-btn':       { name: 'Global Settings',       desc: 'Open global settings' },
            'programmer-request-hw-btn':   { name: 'Request HW',            desc: 'Request current edit buffer from hardware DeepMind 12 via SysEx dump' },
            'programmer-bank-up-btn':      { name: 'Bank Up',               desc: 'Scroll to next bank' },
            'programmer-bank-down-btn':    { name: 'Bank Down',             desc: 'Scroll to previous bank' },
            'programmer-patch-up-btn':     { name: 'Patch Up',              desc: 'Select next patch' },
            'programmer-patch-down-btn':   { name: 'Patch Down',            desc: 'Select previous patch' }
        };
        window._TOOLTIP_BUTTON_MAP = idMap;
    }
    return idMap[el.id] || null;
};

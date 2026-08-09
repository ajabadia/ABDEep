/**
 * @purpose FX preset list rendering and matching logic.
 * Extracted from effects_presets.js — DOM rendering + preset name matching.
 * Depends on: effects_presets_data.js (escapeHtml, DEFAULT_FX_PRESETS), effects_presets.js (_loadAllFxPresets)
 */

function _renderFxPresetList() {
    const listEl = document.getElementById('fx-preset-list');
    if (!listEl) {return;}
    const allPresets = window._loadAllFxPresets();
    if (allPresets.length === 0) {
        listEl.innerHTML = '<div class="fx-preset-empty">No FX presets saved yet</div>';
        return;
    }
    const filterMode = window._fxPresetFilterMode || 'active';
    const slot = window._selectedFxSlot || 1;
    const offsetType = slot === 1 ? 166 : (slot === 2 ? 179 : (slot === 3 ? 192 : 205));
    const activeTypeNorm = (typeof window._readFxParamValue === 'function') ? window._readFxParamValue('fx' + slot + '_type', offsetType, 0.0) : -1;
    const activeType = (activeTypeNorm >= 0) ? Math.round(activeTypeNorm * 56.0) : -1;
    const displayIndices = [];

    if (filterMode === 'active' && activeType >= 0) {
        for (let i = allPresets.length - 1; i >= 0; i--) {
            if (Math.round(allPresets[i].type * 56.0) === activeType) {displayIndices.push(i);}
        }
    } else {
        for (let i = allPresets.length - 1; i >= 0; i--) {displayIndices.push(i);}
    }

    const slotNum = slot;
    const filterLabel = (activeType >= 0) ? (window.FX_TYPE_NAMES[activeType] || ('FX' + slotNum)) : ('FX' + slotNum);

    let html = '<div class="fx-preset-filter-bar">' +
        '<button class="fx-preset-filter-btn' + (filterMode === 'active' ? ' active' : '') + '" data-filter="active">' + (typeof globalThis.escapeHtml === 'function' ? globalThis.escapeHtml(filterLabel) : filterLabel) + '</button>' +
        '<button class="fx-preset-filter-btn' + (filterMode === 'all' ? ' active' : '') + '" data-filter="all">Ver todos</button>' +
    '</div>';

    if (displayIndices.length === 0) {
        html += '<div class="fx-preset-empty">No presets for this FX type</div>';
    } else if (filterMode === 'all') {
        const groups = {};
        displayIndices.forEach(function(idx) {
            const p = allPresets[idx];
            const ti = Math.round(p.type * 56);
            if (!groups[ti]) {groups[ti] = [];}
            groups[ti].push(idx);
        });
        const typeOrder = [];
        displayIndices.forEach(function(idx) {
            const ti = Math.round(allPresets[idx].type * 56);
            if (typeOrder.indexOf(ti) === -1) {typeOrder.push(ti);}
        });
        let firstHeader = true;
        typeOrder.forEach(function(ti) {
            const tn = window.FX_TYPE_NAMES[ti] || '?';
            const cnt = groups[ti].length;
            const hdrClass = 'fx-preset-group-header' + (firstHeader ? '' : ' fx-preset-group-sep');
            html += '<div class="' + hdrClass + '">' + (typeof globalThis.escapeHtml === 'function' ? globalThis.escapeHtml(tn) : tn) + ' <span class="fx-preset-group-count">(' + cnt + ')</span></div>';
            firstHeader = false;
            groups[ti].forEach(function(idx) {
                const name = allPresets[idx].name;
                const safeName = typeof globalThis.escapeHtml === 'function' ? globalThis.escapeHtml(name) : name;
                html += '<div class="fx-preset-item" data-preset-index="' + idx + '">' +
                    '<div title="Apply ' + safeName + ' to FX' + slotNum + '">' +
                        '<span class="fx-preset-name">' + safeName + '</span> ' +
                    '</div>' +
                    '<button class="btn btn-xs fx-preset-delete-btn" data-ctrl-tooltip="Delete preset">\u2715</button>' +
                '</div>';
            });
        });
    } else {
        displayIndices.forEach(function(idx) {
            const name = allPresets[idx].name;
            const safeName = typeof globalThis.escapeHtml === 'function' ? globalThis.escapeHtml(name) : name;
            html += '<div class="fx-preset-item" data-preset-index="' + idx + '">' +
                '<div title="Apply ' + safeName + ' to FX' + slotNum + '">' +
                    '<span class="fx-preset-name">' + safeName + '</span> ' +
                '</div>' +
                '<button class="btn btn-xs fx-preset-delete-btn" data-ctrl-tooltip="Delete preset">\u2715</button>' +
            '</div>';
        });
    }
    listEl.innerHTML = html;

    listEl.querySelectorAll('.fx-preset-item').forEach(function(item) {
        const idx = parseInt(item.getAttribute('data-preset-index'));
        if (isNaN(idx) || idx < 0 || idx >= allPresets.length) {return;}
        item.querySelector('div[title]').addEventListener('click', function() {
            window.applyFxPreset(allPresets[idx], slot);
        });
        const delBtn = item.querySelector('.fx-preset-delete-btn');
        if (delBtn) {
            delBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                window.deleteFxPreset(allPresets[idx].name);
            });
        }
    });

    listEl.querySelectorAll('.fx-preset-filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            window._fxPresetFilterMode = btn.getAttribute('data-filter');
            _renderFxPresetList();
        });
    });
}
window._renderFxPresetList = _renderFxPresetList;

window.findMatchingFxPresetName = function(type, gain, params) {
    if (type === 0.0) {return 'Bypass';}
    
    // Buscar en presets de usuario primero
    const userPresets = window._loadAllFxPresets();
    for (let i = 0; i < userPresets.length; i++) {
        const p = userPresets[i];
        if (Math.round(p.type * 56) === Math.round(type * 56)) {
            let match = true;
            if (Math.abs(p.gain - gain) > 0.03) {match = false;}
            for (let j = 0; j < 12 && j < p.params.length; j++) {
                if (Math.abs(p.params[j] - params[j]) > 0.03) {
                    match = false;
                    break;
                }
            }
            if (match) {return p.name;}
        }
    }
    
    // Buscar en presets de fábrica (FACTORY_FX_PRESETS)
    if (window.FACTORY_FX_PRESETS) {
        for (let i = 0; i < window.FACTORY_FX_PRESETS.length; i++) {
            const p = window.FACTORY_FX_PRESETS[i];
if (Math.round(p.type * 56) === Math.round(type * 56)) {
                let match = true;
                if (Math.abs(p.gain - gain) > 0.03) {match = false;}
                for (let j = 0; j < 12 && j < p.params.length; j++) {
                    if (Math.abs(p.params[j] - params[j]) > 0.03) {
                        match = false;
                        break;
                    }
                }
                if (match) {return p.name;}
            }
        }
    }
    return null;
};

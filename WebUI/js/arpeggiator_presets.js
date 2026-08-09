/* --- ABDEEP ARPEGGIATOR PRESETS MODULE ---
   Arpeggiator pattern presets: data, localStorage CRUD, and list rendering.
   Extracted from arpeggiator.js — pure functions, no closure state.
   Depends on: nothing (Logger is optional, used in try/catch fallback).
*/
/* global Logger */

// ── Built-in default presets ─────────────────────────────────
const DEFAULT_ARP_PRESETS = [
    {
        name: 'Default (UP-DOWN)',
        steps: Array(32).fill(false).map((_, i) => i % 2 === 0)
    },
    {
        name: '8-Step Disco',
        steps: Array(32).fill(false).map((_, i) => i % 4 === 0 || i % 8 === 2)
    },
    {
        name: 'Syncopated',
        steps: Array(32).fill(false).map(() => Math.random() > 0.5)
    }
];

// ── localStorage CRUD ────────────────────────────────────────

/** Load user arp presets from localStorage. On first run, initialize with defaults. */
function loadUserArpPresets() {
    try {
        const raw = localStorage.getItem('abd-eep-arp-presets');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {return parsed;}
        } else {
            localStorage.setItem('abd-eep-arp-presets', JSON.stringify(DEFAULT_ARP_PRESETS));
            return DEFAULT_ARP_PRESETS;
        }
    } catch (e) {
        Logger.error('arp presets load error', e);
    }
    return [];
}

/** Save an arpeggiator preset. If name already exists, update in place; otherwise append. */
function saveArpPreset(name, steps) {
    const cleanName = String(name).trim().replace(/[<>"'&]/g, '');
    if (!cleanName) {return { success: false, error: 'Invalid name' };}

    const presets = loadUserArpPresets();
    const existingIdx = presets.findIndex(p => p.name === cleanName);
    const newPreset = { name: cleanName, steps: steps || Array(32).fill(false) };

    if (existingIdx >= 0) {
        presets[existingIdx] = newPreset;
    } else {
        presets.push(newPreset);
    }

    localStorage.setItem('abd-eep-arp-presets', JSON.stringify(presets));
    return { success: true, existingIdx: existingIdx >= 0, preset: newPreset };
}

/** Delete an arpeggiator preset by name. */
function deleteArpPreset(name) {
    let presets = loadUserArpPresets();
    presets = presets.filter(p => p.name !== name);
    localStorage.setItem('abd-eep-arp-presets', JSON.stringify(presets));
}

// ── DOM Rendering ────────────────────────────────────────────

/**
 * Render the arpeggiator preset list into a container element.
 * @param {HTMLElement} containerEl - The presets list container (e.g. #modal-arp-presets-list)
 * @param {function} selectedCallback - Called with (presetObject) when a preset is selected
 * @param {function} deleteCallback - Called with (presetObject) when delete button is clicked
 */
function renderArpPresetsList(containerEl, selectedCallback, deleteCallback) {
    if (!containerEl) {return;}
    containerEl.innerHTML = '';
    const presets = loadUserArpPresets();
    presets.forEach(p => {
        const item = document.createElement('div');
        item.className = 'seq-preset-list-item text-sm text-primary';
        item.innerHTML = '<span class="arp-preset-name">' + String(p.name).replace(/[<>"'&]/g, '') + '</span>' +
                         '<span class="delete-arp-preset-btn">\u2715</span>';

        item.addEventListener('click', function(e) {
            if (e.target.classList.contains('delete-arp-preset-btn')) {return;}
            // Deselect all siblings
            containerEl.querySelectorAll('.seq-preset-list-item').forEach(function(sibling) {
                sibling.style.background = 'transparent';
                sibling.classList.remove('selected');
            });
            item.style.background = 'color-mix(in srgb, var(--accent-primary) 20%, transparent)';
            item.classList.add('selected');
            if (typeof selectedCallback === 'function') {selectedCallback(p);}
        });

        const delBtn = item.querySelector('.delete-arp-preset-btn');
        if (delBtn) {
            delBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (typeof deleteCallback === 'function') {deleteCallback(p);}
            });
        }

        containerEl.appendChild(item);
    });
}

// ── Export ───────────────────────────────────────────────────
globalThis.DEFAULT_ARP_PRESETS = DEFAULT_ARP_PRESETS;
globalThis.loadUserArpPresets = loadUserArpPresets;
globalThis.saveArpPreset = saveArpPreset;
globalThis.deleteArpPreset = deleteArpPreset;
globalThis.renderArpPresetsList = renderArpPresetsList;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DEFAULT_ARP_PRESETS,
        loadUserArpPresets,
        saveArpPreset,
        deleteArpPreset,
        renderArpPresetsList,
    };
}

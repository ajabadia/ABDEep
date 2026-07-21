/**
 * @purpose Manages the MIDI Learn Mappings List, rendering items, deleting individual entries, and handling JSON exports/imports.
 * @purpose_en MIDI Learn mapping manager and JSON exporter/importer.
 */

function initMidiLearnEditor() {
    const learnTabBtn = document.querySelector('.btn[data-tab="midilearn"]');
    if (!learnTabBtn) {return;}

    function refreshMappingsList() {
        const container = document.getElementById('midi-learn-mappings-list');
        const countEl = document.getElementById('midi-learn-mapping-count');
        if (!container) {return;}
        const bridge = window.dualMidiBridge;
        if (!bridge || !bridge.midiLearnMappings || Object.keys(bridge.midiLearnMappings).length === 0) {
            container.innerHTML = '<div class="text-dim text-center" style="padding:20px;font-size:var(--text-sm)">No mappings yet. Use MIDI LEARN on the main panel to create mappings.</div>';
            if (countEl) {countEl.textContent = '0 mappings';}
            return;
        }
        let html = '';
        const keys = Object.keys(bridge.midiLearnMappings);
        keys.forEach(function(key) {
            const paramId = bridge.midiLearnMappings[key];
            const displayKey = key.replace('nrpn:', 'NRPN ').replace('cc:', 'CC ');
            const paramName = bridge._getParamName ? bridge._getParamName(paramId) : paramId;
            html += '<div style="display:flex;align-items:center;gap:8px;padding:4px 6px;border-bottom:1px solid var(--border-dim);font-size:var(--text-sm)">'
                + '<span style="color:var(--accent-blue);font-weight:bold;font-family:\'Share Tech Mono\',monospace;min-width:80px">' + displayKey + '</span>'
                + '<span style="color:var(--text-secondary)">→</span>'
                + '<span style="color:var(--brand-accent);flex:1">' + paramName.toUpperCase() + '</span>'
                + '<button class="midi-learn-del-btn" data-key="' + key + '" style="background:none;border:1px solid var(--color-danger);color:var(--color-danger);border-radius:2px;cursor:pointer;padding:1px 6px;font-size:9px">Delete</button>'
                + '</div>';
        });
        container.innerHTML = html;
        if (countEl) {countEl.textContent = keys.length + ' mapping' + (keys.length === 1 ? '' : 's');}

        container.querySelectorAll('.midi-learn-del-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const key = this.getAttribute('data-key');
                if (bridge.removeMidiLearnMapping) {
                    bridge.removeMidiLearnMapping(key);
                    refreshMappingsList();
                }
            });
        });
    }

    learnTabBtn.addEventListener('click', function() {
        setTimeout(refreshMappingsList, 50);
    });

    const clearBtn = document.getElementById('midi-learn-clear-all');
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            if (!window.dualMidiBridge) {return;}
            if (confirm('Delete all MIDI Learn mappings?')) {
                window.dualMidiBridge.clearMidiLearnMappings();
                refreshMappingsList();
                flashButton(clearBtn);
            }
        });
    }

    function flashButton(btn) {
        if (!btn) {return;}
        btn.classList.add('btn-flash');
        setTimeout(function() { btn.classList.remove('btn-flash'); }, 250);
    }

    const exportBtn = document.getElementById('midi-learn-export');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            const bridge = window.dualMidiBridge;
            if (!bridge || !bridge.midiLearnMappings) {return;}
            const json = JSON.stringify(bridge.midiLearnMappings, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'abd-eep-midi-learn-mappings.json';
            link.click();
            flashButton(exportBtn);
        });
    }

    const importBtn = document.getElementById('midi-learn-import');
    const importStatus = document.getElementById('midi-learn-import-status');
    if (importBtn) {
        importBtn.addEventListener('click', function() {
            flashButton(importBtn);
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file) {return;}
                const reader = new FileReader();
                reader.onload = function(ev) {
                    try {
                        const parsed = JSON.parse(ev.target.result);
                        const bridge = window.dualMidiBridge;
                        if (!bridge) {return;}
                        Object.keys(parsed).forEach(function(key) {
                            bridge.midiLearnMappings[key] = parsed[key];
                        });
                        if (bridge._saveMidiLearnMappings) {bridge._saveMidiLearnMappings();}
                        refreshMappingsList();
                        if (importStatus) {importStatus.textContent = '✅ Imported ' + Object.keys(parsed).length + ' mappings';}
                        setTimeout(function() { if (importStatus) {importStatus.textContent = '';} }, 3000);
                    } catch(e) {
                        if (importStatus) {importStatus.textContent = '❌ Invalid JSON';}
                        setTimeout(function() { if (importStatus) {importStatus.textContent = '';} }, 3000);
                    }
                };
                reader.readAsText(file);
            });
            input.click();
        });
    }

    window._refreshMidiLearnMappings = refreshMappingsList;
}

window.initMidiLearnEditor = initMidiLearnEditor;

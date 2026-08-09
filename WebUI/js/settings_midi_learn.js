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
        const bridge = getBridge();
        if (!bridge || !bridge.midiLearnMappings || Object.keys(bridge.midiLearnMappings).length === 0) {
            container.innerHTML = '<div class="midi-learn-empty">No mappings yet. Use MIDI LEARN on the main panel to create mappings.</div>';
            if (countEl) {countEl.textContent = '0 mappings';}
            return;
        }
        container.innerHTML = '';
        const keys = Object.keys(bridge.midiLearnMappings);
        keys.forEach(function(key) {
            const paramId = bridge.midiLearnMappings[key];
            const displayKey = key.replace('nrpn:', 'NRPN ').replace('cc:', 'CC ');
            const paramName = bridge._getParamName ? bridge._getParamName(paramId) : paramId;

            const row = document.createElement('div');
            row.className = 'midi-learn-row';

            const keySpan = document.createElement('span');
            keySpan.className = 'midi-learn-key';
            keySpan.textContent = displayKey;

            const arrowSpan = document.createElement('span');
            arrowSpan.className = 'midi-learn-arrow';
            arrowSpan.textContent = '→';

            const paramSpan = document.createElement('span');
            paramSpan.className = 'midi-learn-param';
            paramSpan.textContent = String(paramName).toUpperCase();

            const delBtn = document.createElement('button');
            delBtn.className = 'midi-learn-del-btn';
            delBtn.setAttribute('data-key', key);
            delBtn.textContent = 'Delete';

            row.appendChild(keySpan);
            row.appendChild(arrowSpan);
            row.appendChild(paramSpan);
            row.appendChild(delBtn);

            container.appendChild(row);
        });
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
            if (!getBridge()) {return;}
            if (confirm('Delete all MIDI Learn mappings?')) {
                getBridge().clearMidiLearnMappings();
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
            const bridge = getBridge();
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
                        const bridge = getBridge();
                        if (!bridge || typeof parsed !== 'object' || parsed === null) {throw new Error('Invalid payload');}
                        let addedCount = 0;
                        Object.keys(parsed).forEach(function(key) {
                            if ((key.startsWith('nrpn:') || key.startsWith('cc:')) && typeof parsed[key] === 'string') {
                                bridge.midiLearnMappings[key] = parsed[key];
                                addedCount++;
                            }
                        });
                        if (bridge._saveMidiLearnMappings) {bridge._saveMidiLearnMappings();}
                        refreshMappingsList();
                        if (importStatus) {importStatus.textContent = '✅ Imported ' + addedCount + ' mappings';}
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

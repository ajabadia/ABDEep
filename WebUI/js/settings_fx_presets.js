// WebUI/js/settings_fx_presets.js — FX presets export/import/clear settings
// Extracted from settings.js (initFxPresetsSetting)

function initFxPresetsSetting() {
    const countEl = document.getElementById('settings-fx-preset-count');
    const sizeEl = document.getElementById('settings-fx-preset-size');
    const exportBtn = document.getElementById('settings-fx-preset-export-btn');
    const importBtn = document.getElementById('settings-fx-preset-import-btn');
    const fileInput = document.getElementById('settings-fx-preset-file-input');
    const clearBtn = document.getElementById('settings-fx-preset-clear-btn');
    const statusEl = document.getElementById('settings-fx-preset-status');
    if (!countEl) { return; }

    const FX_KEY = 'abd-eep-fx-presets';

    function refreshStats() {
        try {
            const raw = localStorage.getItem(FX_KEY);
            if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) {
                    countEl.textContent = arr.length + ' preset' + (arr.length !== 1 ? 's' : '');
                    const bytes = new Blob([raw]).size;
                    sizeEl.textContent = bytes > 1024 ? (bytes / 1024).toFixed(1) + ' KB' : bytes + ' B';
                    return;
                }
            }
        } catch (e) { /* ignore */ }
        countEl.textContent = '0 presets';
        sizeEl.textContent = '\u2014';
    }

    function setStatus(msg, ms) {
        if (!statusEl) { return; }
        statusEl.textContent = msg;
        if (ms) { setTimeout(function() { statusEl.textContent = ''; }, ms); }
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            try {
                const raw = localStorage.getItem(FX_KEY);
                const arr = raw ? JSON.parse(raw) : [];
                if (!Array.isArray(arr) || arr.length === 0) {
                    setStatus('No presets to export', 3000);
                    return;
                }
                const blob = new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'abdeep_fx_presets_' + new Date().toISOString().slice(0, 10) + '.json';
                a.click();
                URL.revokeObjectURL(url);
                setStatus('Exported ' + arr.length + ' presets', 3000);
            } catch (e) {
                setStatus('Export failed', 3000);
            }
        });
    }

    if (importBtn && fileInput) {
        importBtn.addEventListener('click', function() { fileInput.click(); });
        fileInput.addEventListener('change', function() {
            const file = fileInput.files[0];
            if (!file) { return; }
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const imported = JSON.parse(e.target.result);
                    if (!Array.isArray(imported)) {
                        setStatus('Invalid file format', 3000);
                        return;
                    }
                    const existing = [];
                    try {
                        const raw = localStorage.getItem(FX_KEY);
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            if (Array.isArray(parsed)) { existing.push(...parsed); }
                        }
                    } catch (ex) { /* ignore */ }

                    let added = 0;
                    imported.forEach(function(p) {
                        if (p && p.name && typeof p.type === 'number') {
                            let found = -1;
                            for (let i = 0; i < existing.length; i++) {
                                if (existing[i].name === p.name && existing[i].slot === p.slot) {
                                    found = i;
                                    break;
                                }
                            }
                            if (found >= 0) { existing[found] = p; }
                            else { existing.push(p); }
                            added++;
                        }
                    });

                    localStorage.setItem(FX_KEY, JSON.stringify(existing));
                    refreshStats();
                    setStatus('Imported ' + added + ' presets (' + imported.length + ' in file)', 3000);
                } catch (ex) {
                    setStatus('Import failed: invalid JSON', 3000);
                }
                fileInput.value = '';
            };
            reader.readAsText(file);
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            const raw = localStorage.getItem(FX_KEY);
            let count = 0;
            try {
                if (raw) {
                    const arr = JSON.parse(raw);
                    if (Array.isArray(arr)) { count = arr.length; }
                }
            } catch (e) { /* ignore */ }
            if (count === 0) {
                setStatus('No presets to clear', 3000);
                return;
            }
            if (!confirm('Delete all ' + count + ' FX presets? This cannot be undone.')) { return; }
            localStorage.removeItem(FX_KEY);
            refreshStats();
            setStatus('Cleared ' + count + ' presets', 3000);
        });
    }

    refreshStats();
    window._syncFxPresetsSettingsUI = refreshStats;
}

// Expose for facade and tests
window.initFxPresetsSetting = initFxPresetsSetting;

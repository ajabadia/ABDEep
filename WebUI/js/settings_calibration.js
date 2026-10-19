// WebUI/js/settings_calibration.js — Calibration export/import settings
// Extracted from settings.js (initCalibrationSettings)

function initCalibrationSettings() {
    const exportBtn = document.getElementById('settings-cal-export-btn');
    const importBtn = document.getElementById('settings-cal-import-btn');
    const fileInput = document.getElementById('settings-cal-file-input');
    const statusEl = document.getElementById('settings-cal-status');
    const previewEl = document.getElementById('settings-cal-preview');
    if (!exportBtn) {return;}

    function setStatus(msg, duration) {
        statusEl.textContent = msg;
        if (duration) {setTimeout(function() { statusEl.textContent = ''; }, duration);}
    }

    exportBtn.addEventListener('click', function() {
        if (!getBridge() || !getBridge().getCalibration) {
            setStatus('Bridge not ready', 3000);
            return;
        }
        getBridge().getCalibration(function(payload) {
            if (!payload || typeof payload !== 'string') {
                setStatus('Failed to get calibration', 3000);
                return;
            }
            const isXml = payload.trimStart().startsWith('<');
            const blob = new Blob([payload], { type: isXml ? 'application/xml' : 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = isXml ? 'abdeep-calibration.xml' : 'abdeep-calibration.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setStatus('Exported', 3000);
        });
    });

    importBtn.addEventListener('click', function() {
        fileInput.click();
    });

    fileInput.addEventListener('change', function() {
        const file = this.files && this.files[0];
        if (!file) {return;}
        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            const trimmed = typeof text === 'string' ? text.trim() : '';
            if (trimmed.startsWith('<')) {
                previewEl.textContent = trimmed;
                previewEl.style.display = 'block';
            } else {
                try {
                    const parsed = JSON.parse(text);
                    previewEl.textContent = JSON.stringify(parsed, null, 2);
                    previewEl.style.display = 'block';
                } catch (err) {
                    previewEl.textContent = 'Invalid JSON: ' + err.message;
                    previewEl.style.display = 'block';
                }
            }
            if (!getBridge() || !getBridge().setCalibration) {
                setStatus('Bridge not ready', 3000);
                return;
            }
            getBridge().setCalibration(text, function(ok) {
                setStatus(ok ? 'Imported' : 'Import failed', 3000);
                if (ok) {previewEl.style.display = 'none';}
            });
        };
        reader.readAsText(file);
        this.value = '';
    });
}

// Expose for facade and tests
window.initCalibrationSettings = initCalibrationSettings;

// WebUI/js/settings_advanced.js — VCF oversample, voicing mode, build model constraints
// Extracted from settings.js (initAdvancedSettings)

function initAdvancedSettings() {
    const oversampleSelect = document.getElementById('settings-vcf-oversample');
    const voicingSelect = document.getElementById('settings-vcf-voicing');
    if (!oversampleSelect) {return;}

    function syncAdvancedUI() {
        const bridge = getBridge();
        if (!bridge) {return;}
        const valOversample = bridge.parameterCache && bridge.parameterCache['vcf_oversample'];
        if (valOversample !== undefined) {
            oversampleSelect.value = String(Math.round(valOversample * 2));
        }
        if (voicingSelect) {
            const valVoicing = bridge.parameterCache && bridge.parameterCache['vcf_voicing_mode'];
            if (valVoicing !== undefined) {
                voicingSelect.value = String(Math.round(valVoicing));
            }
        }
        applyVoicingConstraint();
    }

    function applyVoicingConstraint() {
        if (voicingSelect) {
            if (window.buildModel === 'Classic') {
                voicingSelect.value = '0';
                voicingSelect.disabled = true;
                voicingSelect.title = 'VCF Voicing is locked to DeepMind in Classic model';
            } else {
                voicingSelect.disabled = false;
                voicingSelect.title = '';
            }
        }
    }
    window._applyVoicingConstraint = applyVoicingConstraint;

    oversampleSelect.addEventListener('change', function() {
        const idx = parseInt(this.value) || 0;
        const normalized = idx / 2.0;
        if (getBridge()) {
            getBridge().setParameter('vcf_oversample', normalized);
        }
        localStorage.setItem('abd-eep-vcf-oversample', this.value);
    });

    if (voicingSelect) {
        voicingSelect.addEventListener('change', function() {
            if (window.buildModel === 'Classic') {
                this.value = '0';
                return;
            }
            const val = parseInt(this.value) || 0;
            if (getBridge()) {
                getBridge().setParameter('vcf_voicing_mode', val);
            }
            localStorage.setItem('abd-eep-vcf-voicing', this.value);
        });
        const savedVoicing = localStorage.getItem('abd-eep-vcf-voicing');
        if (savedVoicing) {voicingSelect.value = savedVoicing;}
    }

    const saved = localStorage.getItem('abd-eep-vcf-oversample');
    if (saved) {oversampleSelect.value = saved;}

    window._syncAdvancedSettingsUI = syncAdvancedUI;
}

// Expose for facade and tests
window.initAdvancedSettings = initAdvancedSettings;

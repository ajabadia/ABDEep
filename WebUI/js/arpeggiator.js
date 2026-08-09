/**
 * @purpose Fachada del Arpegiador — inicializa el modal, crea el editor de patrones de 32 pasos
 * y conecta los listeners de controles (extraídos a arpeggiator_step_pattern.js y arpeggiator_controls.js).
 *
 * syncArpModalUI y syncArpModalUIFromState en arpeggiator_ui_sync.js
 * Presets de patrón en arpeggiator_presets.js
 */

document.addEventListener('DOMContentLoaded', function() {
    initArpeggiatorModal();
});

function initArpeggiatorModal() {
    const arpBtn = document.getElementById('programmer-arp-btn');
    const backdrop = document.getElementById('arp-modal-backdrop');
    const closeBtn = document.getElementById('arp-modal-close-btn');
    const stepsGrid = document.querySelector('.arp-steps-grid');
    const stepsLabels = document.querySelector('.arp-steps-labels');

    if (!arpBtn || !backdrop || !closeBtn || !stepsGrid || !stepsLabels) { return; }

    // ── Modal open/close ────────────────────────────────────────
    arpBtn.addEventListener('click', function(e) {
        e.preventDefault();
        backdrop.style.display = 'flex';
        window.syncArpModalUI();
    });

    closeBtn.addEventListener('click', function() {
        backdrop.style.display = 'none';
    });

    backdrop.addEventListener('click', function(e) {
        if (e.target === backdrop) {
            backdrop.style.display = 'none';
        }
    });

    // ── Step Pattern Editor ────────────────────────────────────
    const stepEditor = window.createArpStepGrid(stepsGrid, stepsLabels, function(index, isOn) {
        // LCD feedback on step toggle
        const lcdText = document.getElementById('lcd-text');
        if (lcdText) {
            lcdText.innerHTML = '<span class="lcd-label">ARPEGGIATOR</span><br><strong>STEP ' + (index + 1) + ' GATE</strong><br><span class="lcd-value">' + (isOn ? 'ON' : 'OFF') + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') { window.setLcdParamDisplayTimer(lcdText); }
        }
    });

    // ── Preset Management ──────────────────────────────────────
    const presetsList = document.getElementById('modal-arp-presets-list');
    let selectedArpPreset = null;

    function renderArpPresets() {
        window.renderArpPresetsList(presetsList,
            function onSelect(p) { selectedArpPreset = p; },
            function onDelete(p) {
                window.deleteArpPreset(p.name);
                renderArpPresets();
            }
        );
    }

    renderArpPresets();

    // ── Control Listeners (extraídos a arpeggiator_controls.js) ──
    window.initArpControls(backdrop, stepEditor, {
        getSelectedPreset: function() { return selectedArpPreset; },
        onPresetRender: function() { renderArpPresets(); }
    });
}

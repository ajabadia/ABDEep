/**
 * @purpose Edit button setup for the detail editor panel: mode buttons, chord/polychord, close.
 * @purpose_en Opens panel modes, toggles chord/polychord with bridge, manages close/openSeqPanel.
 */

// eslint-disable-next-line no-unused-vars -- called from initDetailPanel
function initPanelButtons(panel) {
    const state = window.panelEditState;
    const closeBtn = document.getElementById('panel-close-btn');

    if (!panel || !closeBtn) {return false;}

    const lfoEditBtn = document.getElementById('lfo-edit-btn');
    const vcaEditBtn = document.getElementById('vca-edit-btn');
    const envEditBtn = document.getElementById('env-edit-btn');
    const hpfEditBtn = document.getElementById('hpf-edit-btn');
    const vcfEditBtn = document.getElementById('vcf-edit-btn');
    const oscEditBtn = document.getElementById('osc-edit-btn');
    const polyEditBtn = document.getElementById('poly-edit-btn');
    const portaEditBtn = document.getElementById('porta-edit-btn');
    const chordEditBtn = document.getElementById('programmer-chord-btn');
    const polychordEditBtn = document.getElementById('programmer-polychord-btn');

    const moduleSectionByMode = {
        'LFO': 'lfo-section',
        'VCA': 'vca-section',
        'ENV': 'env-section',
        'HPF': 'hpf-section',
        'VCF': 'vcf-section',
        'OSC': 'osc-section',
        'POLY': 'poly-section',
        'PORTA': 'porta-section',
        'ARP': 'arp-section',
        'SEQ': 'arp-section'
    };

    const modeBySectionId = {
        'lfo-section': 'LFO',
        'vca-section': 'VCA',
        'env-section': 'ENV',
        'hpf-section': 'HPF',
        'vcf-section': 'VCF',
        'osc-section': 'OSC',
        'poly-section': 'POLY',
        'porta-section': 'PORTA',
        'arp-section': 'ARP'
    };

    const updateActiveModuleHighlight = (activeMode) => {
        document.querySelectorAll('.module.module-editing-active').forEach(mod => {
            mod.classList.remove('module-editing-active');
        });
        document.querySelectorAll('.edit-panel-btn.active').forEach(b => {
            b.classList.remove('active');
        });
        if (!activeMode) {return;}
        const sectionId = moduleSectionByMode[activeMode];
        if (sectionId) {
            const mod = document.getElementById(sectionId);
            if (mod) {
                mod.classList.add('module-editing-active');
                const editBtn = mod.querySelector('.edit-panel-btn');
                if (editBtn) {editBtn.classList.add('active');}
            }
        }
    };
    window.updateActiveModuleHighlight = updateActiveModuleHighlight;

    const openOrSwitchPanel = (mode, toggleIfSame) => {
        if (toggleIfSame && panel.classList.contains('active') && state.currentPanelMode === mode) {
            panel.classList.remove('active');
            updateActiveModuleHighlight(null);
            return;
        }
        state.currentPanelMode = mode;
        if (typeof window.syncDetailPanelControls === 'function') {window.syncDetailPanelControls();}
        panel.classList.add('active');
        updateActiveModuleHighlight(mode);
    };

    // Opening modes listeners
    const setupOpenPanel = (btn, mode) => {
        if (!btn) {return;}
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openOrSwitchPanel(mode, true);
        });
    };

    setupOpenPanel(lfoEditBtn, 'LFO');
    setupOpenPanel(vcaEditBtn, 'VCA');
    setupOpenPanel(envEditBtn, 'ENV');
    setupOpenPanel(hpfEditBtn, 'HPF');
    setupOpenPanel(vcfEditBtn, 'VCF');
    setupOpenPanel(oscEditBtn, 'OSC');
    setupOpenPanel(polyEditBtn, 'POLY');
    setupOpenPanel(portaEditBtn, 'PORTA');

    // Delegación de eventos para asegurar apertura instantánea aunque los Web Components se inicialicen de forma asíncrona
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#lfo-edit-btn, #vca-edit-btn, #env-edit-btn, #hpf-edit-btn, #vcf-edit-btn, #osc-edit-btn, #poly-edit-btn, #porta-edit-btn');
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            const modeMap = {
                'lfo-edit-btn': 'LFO',
                'vca-edit-btn': 'VCA',
                'env-edit-btn': 'ENV',
                'hpf-edit-btn': 'HPF',
                'vcf-edit-btn': 'VCF',
                'osc-edit-btn': 'OSC',
                'poly-edit-btn': 'POLY',
                'porta-edit-btn': 'PORTA'
            };
            const mode = modeMap[btn.id];
            if (mode) {
                openOrSwitchPanel(mode, false);
            }
            return;
        }

        // Permitir abrir/cambiar de cajón haciendo clic directamente en la cabecera (.module-header) de cada tarjeta
        const header = e.target.closest('.module .module-header');
        if (header && !e.target.closest('button, input, select')) {
            const mod = header.closest('.module');
            if (mod && mod.id && modeBySectionId[mod.id]) {
                e.preventDefault();
                e.stopPropagation();
                openOrSwitchPanel(modeBySectionId[mod.id], true);
            }
        }
    });

    if (chordEditBtn) {
        chordEditBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (getBridge()) {
                const active = getBridge().parameterCache['chord_enable'] > 0.5;
                const nextVal = active ? 0.0 : 1.0;
                getBridge().setParameter('chord_enable', nextVal);
                if (nextVal > 0.5) {
                    getBridge().setParameter('poly_chord_enable', 0.0);
                }
            }
            openOrSwitchPanel('CHORD', false);
        });
    }

    if (polychordEditBtn) {
        polychordEditBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (getBridge()) {
                const active = getBridge().parameterCache['poly_chord_enable'] > 0.5;
                const nextVal = active ? 0.0 : 1.0;
                getBridge().setParameter('poly_chord_enable', nextVal);
                if (nextVal > 0.5) {
                    getBridge().setParameter('chord_enable', 0.0);
                }
            }
            openOrSwitchPanel('POLY_CHORD', false);
        });
    }

    window.openSeqPanel = function() {
        openOrSwitchPanel('SEQ', false);
    };

    closeBtn.addEventListener('click', () => {
        panel.classList.remove('active');
        updateActiveModuleHighlight(null);
    });

    return true;
}

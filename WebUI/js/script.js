/**
 * @purpose Orchestrates initialization of all script sub-modules and handles MIDI Learn, keyboard shortcuts, debug modals.
 * @purpose_en Facade: DOMContentLoaded init coordinator, MIDI Learn, shortcuts, debug/calibration modals.
 */

document.addEventListener('DOMContentLoaded', function () {
    // ── INIT MODULES ──
    initUIControls();
    initPanicButton();
    initRequestHwButton();
    initBlinkLoop();

    if (typeof window.initKeyboardAndWheels === 'function') {window.initKeyboardAndWheels();}
    if (typeof window.initKnobs === 'function') {window.initKnobs();}
    if (typeof window.initSettingsAndModals === 'function') {window.initSettingsAndModals();}
    if (typeof window.initEditActions === 'function') {window.initEditActions();}

    // ── DEBUG / CALIBRATION MODAL CLICK HANDLERS ──
    document.addEventListener('click', function (e) {
        if (e.target.closest('#menu-debug-unison')) {
            e.preventDefault();
            const debugModal = document.querySelector('debug-modal');
            if (debugModal && typeof debugModal.show === 'function') {
                debugModal.show();
            }
        }
        if (e.target.closest('#menu-calibration-lab')) {
            e.preventDefault();
            const calPage = document.querySelector('calibration-lab-page');
            if (calPage && typeof calPage.show === 'function') {
                calPage.show();
            }
        }
    });

    // ── MIDI LEARN ──
    function initMidiLearn() {
        const bridge = getBridge();
        if (!bridge) {return;}

        if (typeof bridge._loadMidiLearnMappings === 'function') {
            bridge._loadMidiLearnMappings();
        }

        const learnBtn = document.getElementById('programmer-midi-learn-btn');

        function toggleLearn() {
            if (!bridge) {return;}
            bridge.toggleMidiLearn();
        }

        document.addEventListener('click', function (e) {
            if (e.target.closest('#menu-midi-learn')) {
                e.preventDefault();
                if (typeof window.openSettingsModal === 'function') {
                    window.openSettingsModal('midilearn');
                } else if (typeof openSettingsModal === 'function') {
                    openSettingsModal('midilearn');
                } else {
                    const settingsModal = document.getElementById('settings-modal-backdrop');
                    if (settingsModal) {
                        settingsModal.style.display = 'flex';
                        settingsModal.classList.add('visible-flex');
                        if (typeof populateMidiPortsLists === 'function') {populateMidiPortsLists();}
                        if (typeof _updateSettingsHardwareInfo === 'function') {_updateSettingsHardwareInfo();}

                        const tabBtn = document.querySelector('.btn[data-tab="midilearn"]');
                        if (tabBtn) {tabBtn.click();}
                    }
                }
            }
        });

        if (learnBtn) {
            learnBtn.classList.add('midi-learn-btn');
            learnBtn.addEventListener('click', toggleLearn);
        }

        function updateButtonStyle(active, _targetParam) {
            if (!learnBtn) {return;}
            learnBtn.classList.toggle('is-active', active);
            learnBtn.textContent = active ? 'LEARN ON' : 'MIDI LEARN';
        }

        if (typeof bridge.onMidiLearnChange === 'function') {
            bridge.onMidiLearnChange(function (active, targetParam) {
                updateButtonStyle(active, targetParam);
            });
        }

        updateButtonStyle(false, null);
    }

    // ── MIDI LEARN: param-click-to-learn ──
    function initMidiLearnParamClick() {
        document.addEventListener('click', function (e) {
            const bridge = getBridge();
            if (!bridge || !bridge.midiLearnActive) {return;}

            const ctrlUnit = e.target.closest('[data-param]');
            if (!ctrlUnit) {return;}

            const paramId = ctrlUnit.getAttribute('data-param');
            if (!paramId) {return;}

            e.preventDefault();
            bridge.setMidiLearnTarget(paramId);
        }, true);
    }

    // ── KEYBOARD SHORTCUTS HELP ──
    document.addEventListener('click', function (e) {
        if (e.target.closest('#menu-keyboard-shortcuts')) {
            e.preventDefault();
            const modal = document.querySelector('keyboard-shortcuts-modal');
            if (modal && typeof modal.show === 'function') {
                modal.show();
            }
        }
    });

    const kbShortcutsIcon = document.getElementById('keyboard-shortcuts-icon');
    if (kbShortcutsIcon) {
        kbShortcutsIcon.classList.add('kb-shortcuts-icon');
        kbShortcutsIcon.addEventListener('click', function (e) {
            e.preventDefault();
            const modal = document.querySelector('keyboard-shortcuts-modal');
            if (modal && typeof modal.show === 'function') {
                modal.show();
            }
        });
    }

    // ── MIDI DUMP MENU ──
    document.addEventListener('click', function (e) {
        if (e.target.closest('#menu-dump-midi')) {
            e.preventDefault();
            if (getBridge()) {
                getBridge().requestMidiDump('edit');
                const lcdText = document.getElementById('lcd-text');
                if (lcdText) {
                    const html = '<span class="lcd-label">REQUESTING...</span><br><strong>MIDI DUMP</strong><br><span class="lcd-sub lcd-color-gold">EDIT BUFFER REQ</span>';
                    window.lcdSafeUpdate(lcdText, html);
                }
            }
        }
    });

    // ── INIT MIDI LEARN ──
    initMidiLearn();
    initMidiLearnParamClick();

    if (typeof window.initDumpView === 'function') {
        window.initDumpView();
    }
    if (typeof window.initMidiLearnEditor === 'function') {
        window.initMidiLearnEditor();
    }
});

/**
 * @purpose Gestión de diálogos modulares de Ajustes (Settings Modal) y Acerca de (About Modal), poblando puertos MIDI dinámicamente y manejando el Resync del sistema.
 * @purpose_en Manages Settings and About modals, dynamically listing MIDI ports and executing system resynchronization.
 */

function initSettingsAndModals() {
    const settingsMenuBtn = document.getElementById('menu-properties');
    const settingsModal = document.getElementById('settings-modal-backdrop');
    const settingsCloseBtn = document.getElementById('settings-modal-close-btn');

    const aboutMenuBtn = document.getElementById('menu-about');
    const aboutModal = document.getElementById('about-modal-backdrop');
    const aboutCloseBtn = document.getElementById('about-modal-close-btn');

    // CONFIGURACIÓN DEL MODAL ABOUT
    if (aboutMenuBtn && aboutModal && aboutCloseBtn) {
        aboutMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            aboutModal.style.display = 'flex';
        });
        aboutCloseBtn.addEventListener('click', () => {
            aboutModal.style.display = 'none';
        });
        aboutModal.addEventListener('click', (e) => {
            if (e.target === aboutModal) {
                aboutModal.style.display = 'none';
            }
        });
    }

    // CONFIGURACIÓN DEL MODAL DE AJUSTES
    if (settingsMenuBtn && settingsModal && settingsCloseBtn) {
        // Abrir Modal
        settingsMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            settingsModal.style.display = 'flex';
            populateMidiPortsLists();
        });

        // Función para poblar dinámicamente los dispositivos MIDI reales
        function populateMidiPortsLists() {
            const inputsContainer = document.getElementById('settings-midi-inputs-list');
            const outputsContainer = document.getElementById('settings-midi-outputs-list');
            if (!inputsContainer || !outputsContainer) return;

            // Limpiar listas
            inputsContainer.innerHTML = '';
            outputsContainer.innerHTML = '';

            if (window.dualMidiBridge && window.dualMidiBridge.midiAccess) {
                const inputs = Array.from(window.dualMidiBridge.midiAccess.inputs.values());
                const outputs = Array.from(window.dualMidiBridge.midiAccess.outputs.values());

                // Rellenar entradas
                if (inputs.length === 0) {
                    inputsContainer.innerHTML = '<div style="padding: 6px; font-size: 10px; color: #888; text-align: center;">None</div>';
                } else {
                    inputs.forEach(input => {
                        const isActive = window.dualMidiBridge.midiInput && window.dualMidiBridge.midiInput.id === input.id;
                        const el = document.createElement('div');
                        el.className = `midi-dev-item ${isActive ? 'active' : ''}`;
                        el.style.cssText = isActive ? 
                            'padding: 6px; font-size: 11px; background: linear-gradient(180deg, #504020, #302008); border: 1px solid #ff9900; border-radius: 3px; cursor: pointer; font-weight: bold; color: #fff;' :
                            'padding: 6px; font-size: 10px; color: #ccc; cursor: pointer; border-radius: 2px;';
                        el.innerText = input.name;
                        el.addEventListener('click', () => {
                            window.dualMidiBridge.midiInput = input;
                            input.onmidimessage = (msg) => window.dualMidiBridge.handleIncomingMidi(msg);
                            populateMidiPortsLists();
                        });
                        inputsContainer.appendChild(el);
                    });
                }

                // Rellenar salidas
                if (outputs.length === 0) {
                    outputsContainer.innerHTML = '<div style="padding: 6px; font-size: 10px; color: #888; text-align: center;">None</div>';
                } else {
                    outputs.forEach(output => {
                        const isActive = window.dualMidiBridge.midiOutput && window.dualMidiBridge.midiOutput.id === output.id;
                        const el = document.createElement('div');
                        el.className = `midi-dev-item ${isActive ? 'active' : ''}`;
                        el.style.cssText = isActive ? 
                            'padding: 6px; font-size: 11px; background: linear-gradient(180deg, #504020, #302008); border: 1px solid #ff9900; border-radius: 3px; cursor: pointer; font-weight: bold; color: #fff;' :
                            'padding: 6px; font-size: 10px; color: #ccc; cursor: pointer; border-radius: 2px;';
                        el.innerText = output.name;
                        el.addEventListener('click', () => {
                            window.dualMidiBridge.midiOutput = output;
                            populateMidiPortsLists();
                        });
                        outputsContainer.appendChild(el);
                    });
                }
            } else {
                inputsContainer.innerHTML = '<div style="padding: 6px; font-size: 10px; color: #888; text-align: center;">Web MIDI Access not available</div>';
                outputsContainer.innerHTML = '<div style="padding: 6px; font-size: 10px; color: #888; text-align: center;">Web MIDI Access not available</div>';
            }
        }

        // Cerrar Modal
        settingsCloseBtn.addEventListener('click', () => {
            settingsModal.style.display = 'none';
        });

        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.style.display = 'none';
            }
        });

        // Intercambio de Solapas (Tabs)
        const tabBtns = document.querySelectorAll('.settings-tab-btn');
        const panels = document.querySelectorAll('.settings-panel-view');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = '#2a2d33';
                    b.style.color = '#ccc';
                });

                btn.classList.add('active');
                btn.style.background = '#ff9900';
                btn.style.color = '#000';

                panels.forEach(p => p.style.display = 'none');

                const targetTab = btn.getAttribute('data-tab');
                const targetPanel = document.getElementById(`settings-view-${targetTab}`);
                if (targetPanel) {
                    if (targetTab === 'connections') {
                        targetPanel.style.display = 'flex';
                    } else {
                        targetPanel.style.display = 'block';
                    }
                }
            });
        });
    }

    // Botones de control del programador de hardware (GLOBAL, COMPARE, WRITE, BANK/UP, BANK/DOWN)
    const globalBtn = document.getElementById('programmer-global-btn');
    if (globalBtn && settingsModal) {
        globalBtn.addEventListener('click', () => {
            settingsModal.style.display = 'flex';
            if (typeof populateMidiPortsLists === 'function') populateMidiPortsLists();
        });
    }

    const compareBtn = document.getElementById('programmer-compare-btn');
    let compareActive = false;
    let preCompareSnapshot = null;
    if (compareBtn) {
        compareBtn.addEventListener('click', () => {
            const lcdText = document.getElementById('lcd-text');
            if (!lcdText) return;

            if (!compareActive) {
                // Capturar estado actual editado
                if (window.dualMidiBridge) {
                    preCompareSnapshot = JSON.stringify(window.dualMidiBridge.parameterCache);
                }
                
                // Cargar preset original guardado en disco/banco
                const activeBank = window.loadedBanks[window.currentActiveBank];
                if (activeBank && window.currentActivePatchIndex !== -1) {
                    const originalPatch = activeBank[window.currentActivePatchIndex];
                    if (originalPatch && window.triggerMidiDump) {
                        window.triggerMidiDump(originalPatch);
                    }
                }
                
                compareActive = true;
                compareBtn.style.background = 'var(--brand-accent)';
                compareBtn.style.color = '#000';
                lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">COMPARE MODE</span><br><strong>ORIGINAL PRESET</strong>`;
            } else {
                // Restaurar estado editado pre-compare
                if (preCompareSnapshot && window.dualMidiBridge) {
                    const cache = JSON.parse(preCompareSnapshot);
                    Object.keys(cache).forEach(paramId => {
                        const val = cache[paramId];
                        window.dualMidiBridge.setParameter(paramId, val);
                        window.dualMidiBridge.handleParameterChangeFromBackend(paramId, val);
                    });
                    if (typeof window.updateLfoSlidersFromCurrentPreset === 'function') window.updateLfoSlidersFromCurrentPreset();
                    if (typeof window.updateEnvSlidersFromCurrentPreset === 'function') window.updateEnvSlidersFromCurrentPreset();
                    if (typeof window.updateOscSlidersFromCurrentPreset === 'function') window.updateOscSlidersFromCurrentPreset();
                }
                
                compareActive = false;
                compareBtn.style.background = 'rgba(255, 153, 0, 0.2)';
                compareBtn.style.color = 'var(--brand-accent)';
                lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">COMPARE MODE</span><br><strong>EDITED BUFFER</strong>`;
            }
        });
    }

    const writeBtn = document.getElementById('programmer-write-btn');
    if (writeBtn) {
        writeBtn.addEventListener('click', () => {
            const saveBtn = document.getElementById('menu-save');
            if (saveBtn) {
                saveBtn.click();
            } else {
                alert("Selecciona primero un preset de usuario en el Bank Manager para sobrescribir.");
            }
        });
    }

    const bankUpBtn = document.getElementById('programmer-bank-up-btn');
    if (bankUpBtn) {
        bankUpBtn.addEventListener('click', () => {
            if (window.currentActivePatchIndex === -1) return;
            const nextIdx = (window.currentActivePatchIndex + 1) % 128;
            window.currentActivePatchIndex = nextIdx;
            
            const activeBank = window.loadedBanks[window.currentActiveBank];
            if (activeBank && activeBank[nextIdx]) {
                const patch = activeBank[nextIdx];
                if (window.triggerMidiDump) window.triggerMidiDump(patch);
                if (typeof window.renderPatchesForBank === 'function') window.renderPatchesForBank(window.currentActiveBank);
            }
        });
    }

    const bankDownBtn = document.getElementById('programmer-bank-down-btn');
    if (bankDownBtn) {
        bankDownBtn.addEventListener('click', () => {
            if (window.currentActivePatchIndex === -1) return;
            const prevIdx = (window.currentActivePatchIndex - 1 + 128) % 128;
            window.currentActivePatchIndex = prevIdx;

            const activeBank = window.loadedBanks[window.currentActiveBank];
            if (activeBank && activeBank[prevIdx]) {
                const patch = activeBank[prevIdx];
                if (window.triggerMidiDump) window.triggerMidiDump(patch);
                if (typeof window.renderPatchesForBank === 'function') window.renderPatchesForBank(window.currentActiveBank);
            }
        });
    }
}

// Exportar al ámbito de window
window.initSettingsAndModals = initSettingsAndModals;

/* --- ABDEEP ARPEGGIATOR MODAL & PATTERN EDITOR ---
   Gestor interactivo del arpegiador central y editor de patrones de 32 pasos
*/

document.addEventListener('DOMContentLoaded', () => {
    initArpeggiatorModal();
});

function initArpeggiatorModal() {
    const arpBtn = document.getElementById('programmer-arp-btn');
    const backdrop = document.getElementById('arp-modal-backdrop');
    const closeBtn = document.getElementById('arp-modal-close-btn');
    const stepsGrid = document.querySelector('.arp-steps-grid');
    const stepsLabels = document.querySelector('.arp-steps-labels');

    if (!arpBtn || !backdrop || !closeBtn || !stepsGrid || !stepsLabels) {return;}

    // Estado local para los 32 pasos del patrón
    let arpPatternSteps = Array(32).fill(false); // false = off, true = on

    // Mostrar modal
    arpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        backdrop.style.display = 'flex';
        syncArpModalUI();
    });

    // Ocultar modal
    closeBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
    });

    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            backdrop.style.display = 'none';
        }
    });

    // Generar dinámicamente los 32 pasos interactivos
    stepsGrid.innerHTML = '';
    stepsLabels.innerHTML = '';
    
    for (let i = 0; i < 32; i++) {
        const stepUnit = document.createElement('div');
        stepUnit.style.display = 'flex';
        stepUnit.style.flexDirection = 'column';
        stepUnit.style.justifyContent = 'flex-end';
        stepUnit.style.height = '100%';
        stepUnit.style.cursor = 'pointer';
        
        const stepBar = document.createElement('div');
        stepBar.style.width = '100%';
        stepBar.style.height = '15%'; // Gate por defecto bajo
        stepBar.style.background = 'var(--bg-hover)';
        stepBar.style.borderRadius = 'var(--radius-xs)';
        stepBar.style.transition = 'background 0.1s, height 0.1s';
        
        stepUnit.appendChild(stepBar);
        
        // Tooltip: show step number and gate state
        stepUnit.title = 'Step ' + (i + 1) + ': GATE OFF';
        
        // Click en el paso conmuta el Gate (on/off)
        stepUnit.addEventListener('click', () => {
            arpPatternSteps[i] = !arpPatternSteps[i];
            stepBar.style.height = arpPatternSteps[i] ? '90%' : '15%';
            stepBar.style.background = arpPatternSteps[i] ? 'var(--brand-accent)' : 'var(--bg-hover)';
            stepUnit.title = 'Step ' + (i + 1) + ': GATE ' + (arpPatternSteps[i] ? 'ON' : 'OFF');
            
            // Opcional: Enviar cambio del patrón por SysEx o parámetro si se soporta individualmente
            const lcdText = document.getElementById('lcd-text');
            if (lcdText) {
                lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">ARPEGGIATOR</span><br><strong>STEP ${i+1} GATE</strong><br><span style="font-size:15px; color:var(--color-gold);">${arpPatternSteps[i] ? 'ON' : 'OFF'}</span>`;
                if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcdText);}
            }
        });
        
        stepsGrid.appendChild(stepUnit);
        
        // Etiquetas de números 1-32
        const label = document.createElement('span');
        label.innerText = i + 1;
        stepsLabels.appendChild(label);
    }

    // Configurar listeners de controles dentro del modal
    const arpBox = document.getElementById('modal-arp-enable-box');
    if (arpBox) {
        arpBox.addEventListener('click', () => {
            const active = arpBox.classList.contains('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_enable', active ? 0.0 : 1.0);}
        });
    }

    const holdBox = document.getElementById('modal-arp-hold-box');
    if (holdBox) {
        holdBox.addEventListener('click', () => {
            const active = holdBox.classList.contains('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_hold', active ? 0.0 : 1.0);}
        });
    }

    const keySyncBox = document.getElementById('modal-arp-keysync-box');
    if (keySyncBox) {
        keySyncBox.addEventListener('click', () => {
            const active = keySyncBox.classList.contains('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_key_sync', active ? 0.0 : 1.0);}
        });
    }

    const selectClock = document.getElementById('modal-arp-clock-select');
    if (selectClock) {
        selectClock.addEventListener('change', () => {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_clock_divider', parseInt(selectClock.value) / 12.0);}
            const _clockNames_ = ['1/1','1/2','1/3','1/4','1/6','1/8','1/12','1/16','1/24','1/32','1/48','1/64','1/96'];
            const _clockIdx_ = parseInt(selectClock.value);
            const _lcd_ = document.getElementById('lcd-text');
            if (_lcd_) {
                _lcd_.innerHTML = '<span style="font-size:10px; opacity:0.6;">ARPEGGIATOR</span><br><strong style="color:var(--accent-primary);">CLOCK <span style="color:var(--accent-yellow);">' + _clockNames_[_clockIdx_] + '</span></strong>';
                if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(_lcd_);}
            }
        });
    }

    const selectVelGate = document.getElementById('modal-arp-velgate-select');
    if (selectVelGate) {
        selectVelGate.addEventListener('change', () => {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_velocity_gate', parseInt(selectVelGate.value) / 2.0);}
            const _vgNames_ = ['Gate','Velocity','Seq'];
            const _vgIdx_ = parseInt(selectVelGate.value);
            const _lcd_ = document.getElementById('lcd-text');
            if (_lcd_) {
                _lcd_.innerHTML = '<span style="font-size:10px; opacity:0.6;">ARPEGGIATOR</span><br><strong style="color:var(--accent-primary);">VEL GATE: <span style="color:var(--accent-teal);">' + _vgNames_[_vgIdx_] + '</span></strong>';
                if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(_lcd_);}
            }
        });
    }

    const selectMode = document.getElementById('modal-arp-mode-select');
    if (selectMode) {
        selectMode.addEventListener('change', () => {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_mode', parseInt(selectMode.value) / 10.0);}
            const _modeNames_ = ['UP','DOWN','UP-DOWN','UP-INV','DOWN-INV','UP-DN-INV','UP-ALT','DOWN-ALT','RANDOM','AS-PLAYED'];
            const _modeIdx_ = parseInt(selectMode.value);
            const _lcd_ = document.getElementById('lcd-text');
            if (_lcd_) {
                _lcd_.innerHTML = '<span style="font-size:10px; opacity:0.6;">ARPEGGIATOR</span><br><strong style="color:var(--accent-primary);">MODE: <span style="color:var(--accent-orange);">' + _modeNames_[_modeIdx_] + '</span></strong>';
                if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(_lcd_);}
            }
        });
    }

    const selectOctave = document.getElementById('modal-arp-octave-select');
    if (selectOctave) {
        selectOctave.addEventListener('change', () => {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_octave', parseInt(selectOctave.value) / 3.0);}
            const _octVal_ = parseInt(selectOctave.value) + 1;
            const _lcd_ = document.getElementById('lcd-text');
            if (_lcd_) {
                _lcd_.innerHTML = '<span style="font-size:10px; opacity:0.6;">ARPEGGIATOR</span><br><strong style="color:var(--accent-primary);">OCTAVE RANGE: <span style="color:var(--accent-cyan);">' + _octVal_ + '</span></strong>';
                if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(_lcd_);}
            }
        });
    }

    // Configurar listeners de faders en el modal
    backdrop.querySelectorAll('.v-slider').forEach(slider => {
        const ctrlUnit = slider.closest('[data-param]');
        if (!ctrlUnit) {return;}
        const paramId = ctrlUnit.getAttribute('data-param');
        const handle = slider.querySelector('.handle');

        let isDragging = false;

        const updateSliderPos = (clientY) => {
            const rect = slider.getBoundingClientRect();
            const handleHeight = 16;
            const limit = rect.height - handleHeight;
            let y = clientY - rect.top - (handleHeight / 2);
            y = Math.max(0, Math.min(limit, y));
            handle.style.top = y + 'px';

            const val = 1.0 - (y / limit);
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter(paramId, val);
            }
        };

        function onSliderMove(e) {
            if (isDragging) {updateSliderPos(e.clientY);}
        }
        function onSliderEnd() {
            isDragging = false;
            window.removeEventListener('mousemove', onSliderMove);
            window.removeEventListener('mouseup', onSliderEnd);
        }
        slider.addEventListener('mousedown', (e) => {
            isDragging = true;
            updateSliderPos(e.clientY);
            e.preventDefault();
            window.addEventListener('mousemove', onSliderMove);
            window.addEventListener('mouseup', onSliderEnd);
        });
    });

    // Gestión de presets locales del arpegiador
    const loadPresetBtn = document.getElementById('modal-arp-load-preset');
    const savePresetBtn = document.getElementById('modal-arp-save-preset');
    const presetsList = document.getElementById('modal-arp-presets-list');

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

    function _loadUserArpPresets() {
        try {
            const raw = localStorage.getItem('abd-eep-arp-presets');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {return parsed;}
            } else {
                localStorage.setItem('abd-eep-arp-presets', JSON.stringify(DEFAULT_ARP_PRESETS));
                return DEFAULT_ARP_PRESETS;
            }
        } catch (e) {}
        return [];
    }

    function renderArpPresetsList() {
        if (!presetsList) {return;}
        presetsList.innerHTML = '';
        const presets = _loadUserArpPresets();
        presets.forEach(p => {
            const item = document.createElement('div');
            item.className = 'preset-item text-sm text-primary';
            item.style.padding = '3px';
            item.style.cursor = 'pointer';
            item.style.borderRadius = 'var(--radius-xs)';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.innerHTML = `<span style="font-weight:bold;color:var(--accent-orange)">${p.name}</span>` +
                             '<span class="delete-arp-preset-btn" style="color:var(--text-faint);font-size:10px;cursor:pointer;padding:0 4px;">✕</span>';
            
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-arp-preset-btn')) {return;}
                presetsList.querySelectorAll('.preset-item').forEach(i => {
                    i.style.background = 'transparent';
                    i.classList.remove('selected');
                });
                item.style.background = 'color-mix(in srgb, var(--accent-primary) 20%, transparent)';
                item.classList.add('selected');
                selectedArpPreset = p;
            });

            const delBtn = item.querySelector('.delete-arp-preset-btn');
            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteArpPreset(p.name);
                });
            }

            presetsList.appendChild(item);
        });
    }

    let selectedArpPreset = null;

    function deleteArpPreset(name) {
        let presets = _loadUserArpPresets();
        presets = presets.filter(p => p.name !== name);
        localStorage.setItem('abd-eep-arp-presets', JSON.stringify(presets));
        renderArpPresetsList();
    }

    renderArpPresetsList();

    if (loadPresetBtn) {
        loadPresetBtn.addEventListener('click', () => {
            if (selectedArpPreset) {
                arpPatternSteps = [...selectedArpPreset.steps];
                
                // Reflejar cambios visuales en el editor de pasos
                const units = stepsGrid.children;
                for (let i = 0; i < 32; i++) {
                    const bar = units[i].querySelector('div');
                    bar.style.height = arpPatternSteps[i] ? '90%' : '15%';
                    bar.style.background = arpPatternSteps[i] ? 'var(--brand-accent)' : 'var(--bg-hover)';
                    units[i].title = 'Step ' + (i + 1) + ': GATE ' + (arpPatternSteps[i] ? 'ON' : 'OFF');
                }
            }
        });
    }

    if (savePresetBtn) {
        savePresetBtn.addEventListener('click', () => {
            if (window.currentActiveBank && window.currentActiveBank.startsWith('Factory Bank')) {
                alert('Cannot save arpeggiator patterns on factory patches. Please copy this patch to a User Bank first.');
                return;
            }
            const name = prompt('Enter a name for the new arpeggiator pattern preset:');
            if (name && name.trim()) {
                const cleanName = name.trim().replace(/[<>"'&]/g, '');
                if (!cleanName) {return;}

                const presets = _loadUserArpPresets();
                const existingIdx = presets.findIndex(p => p.name === cleanName);
                const newPreset = { name: cleanName, steps: [...arpPatternSteps] };

                if (existingIdx >= 0) {
                    presets[existingIdx] = newPreset;
                } else {
                    presets.push(newPreset);
                }

                localStorage.setItem('abd-eep-arp-presets', JSON.stringify(presets));
                renderArpPresetsList();
            }
        });
    }

    // ── RESET button — stop engine, rewind, clear notes ──
    const resetBtn = document.getElementById('modal-arp-reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            const bridge = window.dualMidiBridge;
            if (!bridge || !bridge._arpEngine) {return;}
            
            const wasRunning = bridge._arpEngine.running;
            bridge._arpEngine.stop();
            bridge._arpEngine.stepIndex = 0;
            bridge._arpEngine.heldNotes = [];
            bridge._arpEngine.currentDirection = 1;
            bridge._arpActiveNotes = [];
            // No re-start — el arp se reanudará automáticamente al presionar la siguiente tecla
            
            // Mostrar barra visual en el LCD
            window._arpLastResetTime = Date.now();
            window._arpResetCount++;
            const _aNotes_ = bridge._arpEngine.heldNotes.length;
            const _aStep_ = bridge._arpEngine.stepIndex;
            const _aBar_ = window._genFillBar(Math.round((_aNotes_ / 12) * 18), 18);
            const _lcdText_ = document.getElementById('lcd-text');
            if (_lcdText_) {
                const _arpHtml_ = window._genLcdBarHtml('arp', {
                    header: 'ARPEGGIATOR RESET (manual) #' + window._arpResetCount,
                    stepInfo: 'Step ' + _aStep_ + ' \u00B7 ' + _aNotes_ + ' notes held',
                    bar: _aBar_
                });
                window.lcdSafeUpdate(_lcdText_, _arpHtml_, 'arp_reset');
            }
            
            // Flash feedback en el botón
            const _rBtn_ = this;
            _rBtn_.style.transition = 'background 60ms ease-out, box-shadow 60ms ease-out';
            _rBtn_.style.background = 'color-mix(in srgb, var(--color-danger) 70%, transparent)';
            _rBtn_.style.boxShadow = '0 0 16px var(--color-danger)';
            _rBtn_.style.borderColor = 'var(--color-danger)';
            _rBtn_.style.color = 'var(--color-danger)';
            setTimeout(function() {
                _rBtn_.style.transition = 'background 300ms ease-out, box-shadow 300ms ease-out, border-color 300ms ease-out, color 300ms ease-out';
                _rBtn_.style.background = '';
                _rBtn_.style.boxShadow = '';
                _rBtn_.style.borderColor = '';
                _rBtn_.style.color = '';
                setTimeout(function() {
                    _rBtn_.style.transition = '';
                }, 320);
            }, 60);
        });
    }

    // Registrar actualizador global
    window.syncArpModalUIFromState = () => {
        if (backdrop.style.display !== 'none') {
            syncArpModalUI();
        }
    };
    
    function syncArpModalUI() {
        if (typeof currentActivePatchIndex === 'undefined' || currentActivePatchIndex === -1) {return;}
        const activeBank = loadedBanks[currentActiveBank];
        if (!activeBank) {return;}
        const patch = activeBank[currentActivePatchIndex];
        if (!patch || !patch.unpackedBytes) {return;}

        // Offsets corregidos del manual oficial: ARP (MSB=1, LSB 155-164)
        const arpEn = patch.unpackedBytes[155] > 0.5;
        const modeVal = patch.unpackedBytes[156] || 0;
        const clockVal = patch.unpackedBytes[158] || 0;
        const keySyncEn = patch.unpackedBytes[159] > 0.5;
        const holdEn = patch.unpackedBytes[161] > 0.5;
        const octaveVal = patch.unpackedBytes[164] || 0;
        const velGateVal = patch.unpackedBytes[112] || 0; // arp_velocity_gate no está en NRPN table del manual

        if (arpBox) {arpBox.classList.toggle('active', arpEn);}
        if (holdBox) {holdBox.classList.toggle('active', holdEn);}
        if (keySyncBox) {keySyncBox.classList.toggle('active', keySyncEn);}

        if (selectClock) {selectClock.value = Math.round(clockVal);}
        if (selectVelGate) {selectVelGate.value = Math.round(velGateVal);}
        if (selectMode) {selectMode.value = Math.round(modeVal);}
        if (selectOctave) {selectOctave.value = Math.round(octaveVal);}

        // Offsets corregidos del manual: arp_swing=163, arp_rate=157, arp_gate_time=160
        const sliders = [
            { id: 'arp_swing', val: patch.unpackedBytes[163] / 25.0 },
            { id: 'arp_rate', val: patch.unpackedBytes[157] / 255.0 },
            { id: 'arp_gate_time', val: patch.unpackedBytes[160] / 255.0 }
        ];

        sliders.forEach(sliderInfo => {
            const sliderEl = backdrop.querySelector(`[data-param="${sliderInfo.id}"] .v-slider`);
            if (sliderEl) {
                const handle = sliderEl.querySelector('.handle');
                const updatePos = () => {
                    const rect = sliderEl.getBoundingClientRect();
                    if (rect.height > 0) {
                        const handleHeight = 16;
                        const pos = (1.0 - sliderInfo.val) * (rect.height - handleHeight);
                        handle.style.top = pos + 'px';
                    } else {
                        setTimeout(updatePos, 100);
                    }
                };
                updatePos();
            }
        });
    }

    // Escuchar cambios de parámetros del arpegiador
    if (window.dualMidiBridge) {
        window.dualMidiBridge.onParameterChanged((paramId, val) => {
            if (backdrop.style.display === 'none') {return;}
            if (paramId === 'arp_enable' && arpBox) {
                arpBox.classList.toggle('active', val > 0.5);
                // Mostrar barra visual en el LCD cuando se activa el arp desde el modal
                if (val > 0.5 && window.dualMidiBridge._arpEngine) {
                    const _aNotes_ = window.dualMidiBridge._arpEngine.heldNotes.length;
                    const _aStep_ = window.dualMidiBridge._arpEngine.stepIndex;
                    window._arpLastResetTime = Date.now();
                    window._arpResetCount++;
                    const _aBar_ = window._genFillBar(Math.round((_aNotes_ / 12) * 18), 18);
                    const _lcdText_ = document.getElementById('lcd-text');
                    if (_lcdText_) {
                        const _arpHtml_ = window._genLcdBarHtml('arp', {
                            header: 'ARPEGGIATOR RESET #' + window._arpResetCount,
                            stepInfo: 'Step ' + _aStep_ + ' \u00B7 ' + _aNotes_ + ' notes held',
                            bar: _aBar_
                        });
                        window.lcdSafeUpdate(_lcdText_, _arpHtml_, 'arp_enable');                }
                }
            }
            if (paramId === 'arp_hold' && holdBox) {holdBox.classList.toggle('active', val > 0.5);}
            if (paramId === 'arp_key_sync' && keySyncBox) {keySyncBox.classList.toggle('active', val > 0.5);}
            if (paramId === 'arp_clock_divider' && selectClock) {selectClock.value = Math.round(val * 12.0);}
            if (paramId === 'arp_velocity_gate' && selectVelGate) {selectVelGate.value = Math.round(val * 2.0);}
            if (paramId === 'arp_mode' && selectMode) {selectMode.value = Math.round(val * 10.0);}
            if (paramId === 'arp_octave' && selectOctave) {selectOctave.value = Math.round(val * 3.0);}
            if (paramId === 'arp_swing' || paramId === 'arp_rate' || paramId === 'arp_gate_time') {
                const sliderEl = backdrop.querySelector(`[data-param="${paramId}"] .v-slider`);
                if (sliderEl) {
                    const handle = sliderEl.querySelector('.handle');
                    const rect = sliderEl.getBoundingClientRect();
                    if (rect.height > 0) {
                        const handleHeight = 16;
                        const pos = (1.0 - val) * (rect.height - handleHeight);
                        handle.style.top = pos + 'px';
                    }
                }
            }
        });
    }
}

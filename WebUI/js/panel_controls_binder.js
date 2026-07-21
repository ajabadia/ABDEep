/**
 * @purpose Binds DOM sliders, LED rows, toggles, and handles hover interactions for details panel controls.
 * @purpose_en Interactive control bindings and state synchronization for panel_edit details.
 */

window.updatePanelFromState = function(container) {
    if (!container) {container = document.getElementById('panel-dynamic-controls');}
    if (!container || !window.dualMidiBridge) {return;}

    container.querySelectorAll('.v-slider').forEach(slider => {
        const ctrlUnit = slider.closest('[data-param]');
        if (!ctrlUnit) {return;}
        const paramId = ctrlUnit.getAttribute('data-param');
        if (!paramId) {return;}
        const val = window.dualMidiBridge.parameterCache[paramId];
        if (val !== undefined) {
            const handle = slider.querySelector('.handle');
            if (handle) {
                const updatePos = () => {
                    const rect = slider.getBoundingClientRect();
                    if (rect.height > 0) {
                        const handleHeight = 16;
                        const pos = (1.0 - val) * (rect.height - handleHeight);
                        handle.style.top = pos + 'px';
                    } else {
                        setTimeout(updatePos, 50);
                    }
                };
                updatePos();
            }
        }
    });

    container.querySelectorAll('select[data-param]').forEach(sel => {
        const paramId = sel.getAttribute('data-param');
        const val = window.dualMidiBridge.parameterCache[paramId];
        if (val !== undefined) {
            const optionsCount = sel.options.length;
            sel.value = Math.round(val * (optionsCount - 1));
        }
    });

    container.querySelectorAll('.toggle-box[data-param]').forEach(box => {
        const paramId = box.getAttribute('data-param');
        const val = window.dualMidiBridge.parameterCache[paramId];
        if (val !== undefined) {
            if (paramId === 'vca_mode') {
                if (box.id === 'panel-vca-mode-transparent') {box.classList.toggle('active', val < 0.5);}
                if (box.id === 'panel-vca-mode-ballsy') {box.classList.toggle('active', val > 0.5);}
            } else if (paramId === 'vcf_pole_mode') {
                if (box.id === 'panel-vcf-pole-2') {box.classList.toggle('active', val < 0.5);}
                if (box.id === 'panel-vcf-pole-4') {box.classList.toggle('active', val > 0.5);}
            } else {
                box.classList.toggle('active', val > 0.5);
            }
        }
    });

    container.querySelectorAll('.shape-led-row').forEach(row => {
        let paramId = row.getAttribute('data-param');
        if (!paramId) {
            if (row.classList.contains('chord-key-led-row')) {paramId = 'chord_key';}
            if (row.classList.contains('chord-type-led-row')) {paramId = 'chord_type';}
        }
        if (!paramId) {return;}

        const val = window.dualMidiBridge.parameterCache[paramId];
        if (val !== undefined) {
            let maxVal = 6.0;
            if (row.hasAttribute('data-trig')) {maxVal = 4.0;}
            else if (paramId === 'note_priority') {maxVal = 2.0;}
            else if (paramId === 'trigger_mode') {maxVal = 3.0;}
            else if (paramId === 'osc1_range' || paramId === 'osc2_range') {maxVal = 2.0;}
            else if (paramId === 'osc1_pm_mode') {maxVal = 1.0;}
            else if (paramId === 'chord_key') {maxVal = 11.0;}
            else if (paramId === 'chord_type') {maxVal = 11.0;}
            
            const activeIndex = Math.round(val * maxVal);
            const currentIdx = parseInt(row.getAttribute('data-shape') || row.getAttribute('data-trig') || row.getAttribute('data-val') || '0');
            row.classList.toggle('active', currentIdx === activeIndex);
        }
    });

    if (typeof window.drawPanelGraphic === 'function') {
        window.drawPanelGraphic();
    }
};

window.syncDetailPanelControls = function() {
    if (!window.PANEL_TEMPLATES) {return;}

    const container = document.getElementById('panel-dynamic-controls');
    const titleEl = document.getElementById('panel-title');
    if (!container || !titleEl) {return;}

    const state = window.panelEditState || {};
    const currentPanelMode = state.currentPanelMode || 'LFO';

    if (typeof window.updateScreenHeight === 'function') {window.updateScreenHeight();}
    if (typeof window.updateRealScopeHeight === 'function') {window.updateRealScopeHeight();}

    if (currentPanelMode === 'LFO') {
        if (typeof window.bindPanelLfoControls === 'function') {window.bindPanelLfoControls(container, state, titleEl);}
    } else if (currentPanelMode === 'VCA') {
        if (typeof window.bindPanelVcaControls === 'function') {window.bindPanelVcaControls(container, state, titleEl);}
    } else if (currentPanelMode === 'ENV') {
        if (typeof window.bindPanelEnvControls === 'function') {window.bindPanelEnvControls(container, state, titleEl);}
    } else if (currentPanelMode === 'HPF') {
        if (typeof window.bindPanelHpfControls === 'function') {window.bindPanelHpfControls(container, state, titleEl);}
    } else if (currentPanelMode === 'VCF') {
        if (typeof window.bindPanelVcfControls === 'function') {window.bindPanelVcfControls(container, state, titleEl);}
    } else if (currentPanelMode === 'OSC') {
        if (typeof window.bindPanelOscControls === 'function') {window.bindPanelOscControls(container, state, titleEl);}
    } else if (currentPanelMode === 'POLY') {
        if (typeof window.bindPanelPolyControls === 'function') {window.bindPanelPolyControls(container, state, titleEl);}
    } else if (currentPanelMode === 'PORTA') {
        if (typeof window.bindPanelPortaControls === 'function') {window.bindPanelPortaControls(container, state, titleEl);}
    } else if (currentPanelMode === 'CHORD') {
        if (typeof window.bindPanelChordControls === 'function') {window.bindPanelChordControls(container, state, titleEl);}
    } else if (currentPanelMode === 'POLY_CHORD') {
        if (typeof window.bindPanelPolyChordControls === 'function') {window.bindPanelPolyChordControls(container, state, titleEl);}
    } else if (currentPanelMode === 'ARP') {
        if (typeof window.bindPanelArpControls === 'function') {window.bindPanelArpControls(container, state, titleEl);}
    } else if (currentPanelMode === 'SEQ') {
        if (typeof window.bindPanelSeqControls === 'function') {window.bindPanelSeqControls(container, state, titleEl);}
    }

    initDynamicSliders();
    window.updatePanelFromState(container);

    function initDynamicSliders() {
        container.querySelectorAll('.v-slider').forEach(slider => {
            const handle = slider.querySelector('.handle');
            if (!handle) {return;}

            let isDragging = false;

            const onStart = (clientY) => {
                isDragging = true;
                document.body.style.userSelect = 'none';
                updateValue(clientY);
            };

            const onMove = (clientY) => {
                if (!isDragging) {return;}
                updateValue(clientY);
            };

            const onEnd = () => {
                if (!isDragging) {return;}
                isDragging = false;
                document.body.style.userSelect = '';
            };

            function onTouchMove(e) {
                onMove(e.touches[0].clientY);
            }
            function onTouchEnd() {
                onEnd();
                document.removeEventListener('touchmove', onTouchMove);
                document.removeEventListener('touchend', onTouchEnd);
            }
            slider.addEventListener('touchstart', (e) => {
                onStart(e.touches[0].clientY);
                document.addEventListener('touchmove', onTouchMove, { passive: true });
                document.addEventListener('touchend', onTouchEnd);
            }, { passive: true });

            function onMouseMove(e) {
                onMove(e.clientY);
            }
            function onMouseEnd() {
                onEnd();
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseEnd);
            }
            slider.addEventListener('mousedown', (e) => {
                onStart(e.clientY);
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseEnd);
            });

            function updateValue(clientY) {
                const rect = slider.getBoundingClientRect();
                const handleHeight = 16;
                const totalH = rect.height - handleHeight;
                if (totalH <= 0) {return;}

                let relativeY = clientY - rect.top - (handleHeight / 2);
                relativeY = Math.max(0, Math.min(relativeY, totalH));

                const val = 1.0 - (relativeY / totalH);
                handle.style.top = relativeY + 'px';

                const ctrlUnit = slider.closest('[data-param]');
                if (ctrlUnit) {
                    const paramId = ctrlUnit.getAttribute('data-param');
                    if (paramId && window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter(paramId, val);
                        if (typeof window.drawPanelGraphic === 'function') {
                            window.drawPanelGraphic();
                        }
                    }
                }
            }
        });
    }
};

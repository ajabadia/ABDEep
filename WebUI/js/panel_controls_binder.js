/**
 * @purpose Binds DOM sliders, LED rows, toggles, and handles hover interactions for details panel controls.
 * @purpose_en Interactive control bindings and state synchronization for panel_edit details.
 * Sub-módulo: panel_controls_binder_sync.js contiene updatePanelFromState().
 */

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

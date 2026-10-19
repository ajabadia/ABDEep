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
    initDynamicTelemetryHooks();
    window.updatePanelFromState(container);

    function initDynamicSliders() {
        container.querySelectorAll('.v-slider').forEach(slider => {
            const handle = slider.querySelector('.handle');
            if (!handle) {return;}

            let isDragging = false;
            let lastClientY = 0;

            const getParamMeta = () => {
                const ctrlUnit = slider.closest('[data-param]');
                if (!ctrlUnit) {return { paramId: null, labelText: null };}
                const paramId = ctrlUnit.getAttribute('data-param');
                const lbl = ctrlUnit.querySelector('.label');
                const labelText = lbl ? lbl.textContent.trim() : paramId;
                return { paramId, labelText };
            };

            const applyNormalizedValue = (val) => {
                const clamped = Math.max(0.0, Math.min(1.0, val));
                const rect = slider.getBoundingClientRect();
                const handleHeight = 16;
                const totalH = (rect.height > 0 ? rect.height : 100) - handleHeight;
                if (totalH > 0) {
                    handle.style.top = ((1.0 - clamped) * totalH) + 'px';
                }

                const { paramId, labelText } = getParamMeta();
                if (paramId && getBridge()) {
                    getBridge().setParameter(paramId, clamped);
                    if (typeof window.drawPanelGraphic === 'function') {
                        window.drawPanelGraphic();
                    }
                    if (typeof window.updateParameterLcdReadout === 'function') {
                        window.updateParameterLcdReadout(paramId, clamped, labelText, currentPanelMode + ' PANEL');
                    }
                }
            };

            const onStart = (clientY, shiftKey) => {
                isDragging = true;
                lastClientY = clientY;
                document.body.style.userSelect = 'none';
                const { paramId } = getParamMeta();
                if (paramId && getBridge() && typeof getBridge().beginGesture === 'function') {
                    getBridge().beginGesture(paramId);
                }
                if (!shiftKey) {
                    updateValueFromY(clientY);
                }
            };

            const onMove = (clientY, shiftKey) => {
                if (!isDragging) {return;}
                if (shiftKey) {
                    const rect = slider.getBoundingClientRect();
                    const totalH = Math.max(40, (rect.height || 100) - 16);
                    const deltaY = lastClientY - clientY;
                    lastClientY = clientY;
                    const { paramId } = getParamMeta();
                    const currentVal = (paramId && getBridge() && getBridge().parameterCache[paramId] !== undefined)
                        ? getBridge().parameterCache[paramId]
                        : 0.5;
                    applyNormalizedValue(currentVal + (deltaY / totalH) * 0.2);
                } else {
                    lastClientY = clientY;
                    updateValueFromY(clientY);
                }
            };

            const onEnd = () => {
                if (!isDragging) {return;}
                isDragging = false;
                document.body.style.userSelect = '';
                const { paramId } = getParamMeta();
                if (paramId && getBridge() && typeof getBridge().endGesture === 'function') {
                    getBridge().endGesture(paramId);
                }
            };

            function onTouchMove(e) {
                onMove(e.touches[0].clientY, false);
            }
            function onTouchEnd() {
                onEnd();
                document.removeEventListener('touchmove', onTouchMove);
                document.removeEventListener('touchend', onTouchEnd);
            }
            slider.addEventListener('touchstart', (e) => {
                onStart(e.touches[0].clientY, false);
                document.addEventListener('touchmove', onTouchMove, { passive: true });
                document.addEventListener('touchend', onTouchEnd);
            }, { passive: true });

            function onMouseMove(e) {
                onMove(e.clientY, e.shiftKey);
            }
            function onMouseEnd() {
                onEnd();
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseEnd);
            }
            slider.addEventListener('mousedown', (e) => {
                onStart(e.clientY, e.shiftKey);
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseEnd);
            });

            slider.addEventListener('wheel', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const { paramId } = getParamMeta();
                if (!paramId || !getBridge()) {return;}
                const currentVal = getBridge().parameterCache[paramId] !== undefined
                    ? getBridge().parameterCache[paramId]
                    : 0.5;
                const step = e.shiftKey ? (1.0 / 255.0) : (4.0 / 255.0);
                const dir = e.deltaY < 0 ? 1 : -1;
                if (typeof getBridge().beginGesture === 'function') {getBridge().beginGesture(paramId);}
                applyNormalizedValue(currentVal + dir * step);
                if (typeof getBridge().endGesture === 'function') {getBridge().endGesture(paramId);}
            }, { passive: false });

            slider.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const { paramId } = getParamMeta();
                if (!paramId) {return;}
                const defVal = typeof window.getDefaultParamValue === 'function'
                    ? window.getDefaultParamValue(paramId)
                    : 0.0;
                if (getBridge() && typeof getBridge().beginGesture === 'function') {getBridge().beginGesture(paramId);}
                applyNormalizedValue(defVal);
                if (getBridge() && typeof getBridge().endGesture === 'function') {getBridge().endGesture(paramId);}
            });

            function updateValueFromY(clientY) {
                const rect = slider.getBoundingClientRect();
                const handleHeight = 16;
                const totalH = rect.height - handleHeight;
                if (totalH <= 0) {return;}

                let relativeY = clientY - rect.top - (handleHeight / 2);
                relativeY = Math.max(0, Math.min(relativeY, totalH));

                const val = 1.0 - (relativeY / totalH);
                applyNormalizedValue(val);
            }
        });
    }

    function initDynamicTelemetryHooks() {
        container.querySelectorAll('.toggle-box[data-param], .shape-led-row[data-param]').forEach(el => {
            el.addEventListener('click', () => {
                const paramId = el.getAttribute('data-param');
                if (!paramId || !getBridge() || typeof window.updateParameterLcdReadout !== 'function') {return;}
                const val = getBridge().parameterCache[paramId];
                if (val !== undefined) {
                    const lblEl = el.querySelector('.toggle-label, .shape-name');
                    const labelText = lblEl ? lblEl.textContent.trim() : paramId;
                    window.updateParameterLcdReadout(paramId, val, labelText, currentPanelMode + ' PANEL');
                }
            });
        });
    }
};

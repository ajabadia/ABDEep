/**
 * @purpose Interactive SEQ step editor DOM builder — creates 32 step elements
 * with mouse/touch drag, dblclick reset, and hover LCD preview.
 * Visual sync helpers (_updatePanelStepVisual, _syncPanelSeqFromCache) are
 * in panel_seq_editor.js.
 */

/**
 * Initialize the interactive SEQ step editor in the given container.
 * Creates 32 step elements with mouse drag, touch drag, dblclick reset,
 * and hover LCD preview.
 * @param {HTMLElement} stepsContainer - The container element for the step elements
 */
// eslint-disable-next-line no-unused-vars
function initPanelSeqEditor(stepsContainer) {
    if (!stepsContainer) {return;}

    stepsContainer.innerHTML = '';
    for (let psi = 0; psi < 32; psi++) {
        (function(stepIdx) {
            const stepWrap = document.createElement('div');
            stepWrap.className = 'seq-step-wrap';
            if (stepIdx >= 16) {stepWrap.classList.add('row-2');}

            const zLine = document.createElement('div');
            zLine.className = 'seq-zero-line';
            stepWrap.appendChild(zLine);

            const fillBar = document.createElement('div');
            fillBar.className = 'panel-seq-fill seq-fill-bar';
            stepWrap.appendChild(fillBar);

            const skipBadge = document.createElement('div');
            skipBadge.className = 'panel-seq-skip seq-skip-badge';
            skipBadge.textContent = 'SKIP';
            stepWrap.appendChild(skipBadge);

            const numLabel = document.createElement('div');
            numLabel.className = 'panel-seq-num seq-num-label';
            numLabel.textContent = String(stepIdx + 1);
            stepWrap.appendChild(numLabel);

            let _isEditing = false;

            stepWrap.addEventListener('dblclick', function(e) {
                const idx = stepIdx;
                window._panelLastSeqStep = idx;
                window._panelSeqValues[idx] = 0;
                window._panelSeqRaw[idx] = 128;
                if (getBridge()) {
                    getBridge().setParameter('seq_step_' + (idx + 1), 0.5);
                }
                if (typeof window._updatePanelStepVisual === 'function') {
                    window._updatePanelStepVisual(idx);
                }
                e.preventDefault();
                e.stopPropagation();
            });

            stepWrap.addEventListener('mousedown', function(e) {
                _isEditing = true;
                window._panelLastSeqStep = stepIdx;

                function _doEdit(clientY) {
                    const idx = stepIdx;
                    const wraps = stepsContainer ? stepsContainer.children : [];
                    if (idx < 0 || idx >= wraps.length) {return;}
                    const wrap = wraps[idx];
                    const rect = wrap.getBoundingClientRect();
                    const h = rect.height;
                    if (h <= 0) {return;}
                    let relY = 1.0 - (clientY - rect.top) / h;
                    relY = Math.max(0, Math.min(1, relY));
                    let bipolar = Math.round((relY * 255) - 128);
                    if (Math.abs(bipolar) <= 2) {bipolar = 0;}
                    window._panelSeqValues[idx] = bipolar;
                    const rawByte = Math.max(0, Math.min(255, bipolar + 128));
                    window._panelSeqRaw[idx] = rawByte;
                    const normalized = Math.max(0, Math.min(1, rawByte / 255.0));
                    if (getBridge()) {
                        getBridge().setParameter('seq_step_' + (idx + 1), normalized);
                    }
                    if (typeof window._updatePanelStepVisual === 'function') {
                        window._updatePanelStepVisual(idx);
                    }
                }

                _doEdit(e.clientY);
                e.preventDefault();

                function _onMove(ev) {
                    if (!_isEditing) {return;}
                    _doEdit(ev.clientY);
                }
                function _onUp() {
                    _isEditing = false;
                    document.removeEventListener('mousemove', _onMove);
                    document.removeEventListener('mouseup', _onUp);
                }
                document.addEventListener('mousemove', _onMove);
                document.addEventListener('mouseup', _onUp);
            });

            let _touchId = null;
            stepWrap.addEventListener('touchstart', function(e) {
                if (e.touches.length !== 1) {return;}
                const touch = e.changedTouches[0];
                _touchId = touch.identifier;
                _isEditing = true;

                function _doTouchEdit(touchY) {
                    const idx = stepIdx;
                    const wraps = stepsContainer ? stepsContainer.children : [];
                    if (idx < 0 || idx >= wraps.length) {return;}
                    const wrap = wraps[idx];
                    const rect = wrap.getBoundingClientRect();
                    const h = rect.height;
                    if (h <= 0) {return;}
                    let relY = 1.0 - (touchY - rect.top) / h;
                    relY = Math.max(0, Math.min(1, relY));
                    let bipolar = Math.round((relY * 255) - 128);
                    if (Math.abs(bipolar) <= 2) {bipolar = 0;}
                    window._panelSeqValues[idx] = bipolar;
                    const rawByte = Math.max(0, Math.min(255, bipolar + 128));
                    window._panelSeqRaw[idx] = rawByte;
                    const normalized = Math.max(0, Math.min(1, rawByte / 255.0));
                    if (getBridge()) {
                        getBridge().setParameter('seq_step_' + (idx + 1), normalized);
                    }
                    if (typeof window._updatePanelStepVisual === 'function') {
                        window._updatePanelStepVisual(idx);
                    }
                }

                _doTouchEdit(touch.clientY);

                function _onTouchMove(ev) {
                    if (!_isEditing) {return;}
                    let foundTouch = null;
                    for (let ti = 0; ti < ev.touches.length; ti++) {
                        if (ev.touches[ti].identifier === _touchId) {
                            foundTouch = ev.touches[ti];
                            break;
                        }
                    }
                    if (!foundTouch) {return;}
                    _doTouchEdit(foundTouch.clientY);
                    ev.preventDefault();
                }
                function _onTouchEnd() {
                    _isEditing = false;
                    _touchId = null;
                    document.removeEventListener('touchmove', _onTouchMove);
                    document.removeEventListener('touchend', _onTouchEnd);
                }
                document.addEventListener('touchmove', _onTouchMove, { passive: false });
                document.addEventListener('touchend', _onTouchEnd, { passive: false });
            }, { passive: false });

            stepWrap.addEventListener('mouseenter', (function(idx) {
                return function() {
                    const lcdText = document.getElementById('lcd-text');
                    if (!lcdText) {return;}
                    const v = window._panelSeqValues ? window._panelSeqValues[idx] : 0;
                    const r = window._panelSeqRaw ? window._panelSeqRaw[idx] : 128;
                    const isSkip = r === 0;
                    const sign = v >= 0 ? '+' : '';
                    const valStr = isSkip ? 'SKIP' : sign + v;
                    lcdText.innerHTML = '<span class=\"lcd-label\">CONTROL SEQ PANEL</span><br>'
                        + '<strong>STEP ' + (idx + 1) + ' VALUE</strong><br>'
                        + '<span class=\"seq-lcd-value\">' + valStr + ' (raw:' + r + ')</span>';
                    if (typeof window.setLcdParamDisplayTimer === 'function') {
                        window.setLcdParamDisplayTimer(lcdText);
                    }
                };
            })(stepIdx));

            stepsContainer.appendChild(stepWrap);
        })(psi);
    }
}

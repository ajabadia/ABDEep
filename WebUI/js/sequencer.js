/**
 * @purpose Gestor interactivo del secuenciador de control (Control Sequencer) central y editor de valores bipolares de 32 pasos.
 * @purpose_en Interactive manager for the central Control Sequencer and 32-step bipolar value editor.
 */

document.addEventListener('DOMContentLoaded', () => {
    initSequencerModal();
});

function initSequencerModal() {
    const seqBtn = document.getElementById('programmer-seq-btn');
    const backdrop = document.getElementById('seq-modal-backdrop');
    const closeBtn = document.getElementById('seq-modal-close-btn');
    const stepsGrid = document.querySelector('.seq-steps-grid');
    const stepsLabels = document.querySelector('.seq-steps-labels');

    if (!seqBtn || !backdrop || !closeBtn || !stepsGrid || !stepsLabels) {return;}

    let _modalActiveStep = -1;
    window._modalActiveStep = _modalActiveStep;
    let _modalActiveSkip = false;
    window._modalActiveSkip = _modalActiveSkip;

    if (typeof window.initSequencerEditor === 'function') {
        window.initSequencerEditor();
    }
    if (typeof window.initSequencerPresets === 'function') {
        window.initSequencerPresets();
    }
    if (typeof window.initSequencerCanvas === 'function') {
        window.initSequencerCanvas();
    }

    // Sequencer Canvas Toggle
    const seqToggleBtns = document.querySelectorAll('.seq-toggle-btn');
    const seqCanvas = document.querySelector('.seq-steps-canvas');
    seqToggleBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        const view = btn.getAttribute('data-view');
        seqToggleBtns.forEach(function(b) { b.classList.remove('active'); b.style.borderColor = 'var(--border)'; });
        btn.classList.add('active'); btn.style.borderColor = 'var(--accent-teal)';
        if (view === 'canvas') {
          document.querySelector('.seq-steps-grid').style.display = 'none';
          document.querySelector('.seq-steps-labels').style.display = 'none';
          if (seqCanvas) { seqCanvas.style.display = 'block'; if (seqCanvas._seqStepsCanvas) { seqCanvas._seqStepsCanvas.resize(); seqCanvas._seqStepsCanvas.syncFromValues(); } }
        } else {
          document.querySelector('.seq-steps-grid').style.display = 'flex';
          document.querySelector('.seq-steps-labels').style.display = 'flex';
          if (seqCanvas) {seqCanvas.style.display = 'none';}
        }
      });
    });

    seqBtn.addEventListener('click', (e) => {
        e.preventDefault();
        backdrop.style.display = 'flex';
        _updateSeqModalModeBadge();
        syncSeqModalUI();
        if (window.dualMidiBridge) {
            const curStep = window.dualMidiBridge.parameterCache['seq_current_step'];
            if (curStep !== undefined) {
                _modalActiveStep = Math.round(curStep);
                window._modalActiveStep = _modalActiveStep;
                _modalActiveSkip = (window.dualMidiBridge.parameterCache['seq_current_step_skip'] || 0) > 0.5;
                window._modalActiveSkip = _modalActiveSkip;
                _modalLastPolledStep = _modalActiveStep;
                if (typeof window.updateStepVisual === 'function') {
                    window.updateStepVisual(_modalActiveStep);
                }
            }
        }
    });

    function _hideSeqModal() {
        backdrop.style.display = 'none';
        _stopModalPolling();
        _clearModalActiveHighlight();
    }

    closeBtn.addEventListener('click', _hideSeqModal);

    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            _hideSeqModal();
        }
    });

    function _clearModalActiveHighlight() {
        for (let ci = 0; ci < 32; ci++) {
            const child = stepsGrid.children[ci];
            if (child) {
                child.style.outline = '';
                child.style.boxShadow = '';
                const numEl = child.querySelector('.seq-step-val');
                if (numEl) {numEl.style.boxShadow = '';}
                const rawEl = child.querySelector('.seq-step-raw');
                if (rawEl) {rawEl.style.color = '';}
            }
        }
        _modalActiveStep = -1;
        window._modalActiveStep = -1;
    }

    const seqBox = document.getElementById('modal-seq-enable-box');
    if (seqBox) {
        seqBox.addEventListener('click', () => {
            const active = seqBox.classList.contains('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('seq_enable', active ? 0.0 : 1.0);}
        });
    }

    const selectClock = document.getElementById('modal-seq-clock-select');
    if (selectClock) {
        selectClock.addEventListener('change', () => {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('seq_clock', parseInt(selectClock.value) / 15.0);}
        });
    }

    const selectLength = document.getElementById('modal-seq-length-select');
    if (selectLength) {
        selectLength.addEventListener('change', () => {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('seq_length', parseInt(selectLength.value) / 31.0);}
            for (let i = 0; i < 32; i++) {
                if (typeof window.updateStepVisual === 'function') {window.updateStepVisual(i);}
            }
        });
    }

    const selectKeyLoop = document.getElementById('modal-seq-keyloop-select');
    if (selectKeyLoop) {
        selectKeyLoop.addEventListener('change', () => {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('seq_key_loop', parseInt(selectKeyLoop.value) / 2.0);}
        });
    }

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

    const openPanelBtn = document.getElementById('modal-seq-open-panel-btn');
    if (openPanelBtn) {
        openPanelBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.openSeqPanel === 'function') {
                window.openSeqPanel();
            }
        });
    }

    const resetBtn = document.getElementById('modal-seq-reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            const bridge = window.dualMidiBridge;
            if (!bridge || !bridge._seqEngine) {return;}
            
            const wasRunning = bridge._seqEngine.running;
            bridge._seqEngine.stop();
            bridge._seqEngine.stepIndex = 0;
            bridge._seqEngine.heldNotes = [];
            bridge._seqEngine._forcedFreeRunning = false;
            for (let si = 0; si < bridge._seqEngine.previousValues.length; si++) {
                bridge._seqEngine.previousValues[si] = 0;
            }
            _clearModalActiveHighlight();
            _modalLastPolledStep = -1;
            
            if (wasRunning || (bridge.parameterCache['seq_enable'] || 0) > 0.5) {
                bridge._updateSeqEngine();
            }
            
            window._seqLastResetTime = Date.now();
            window._seqResetCount++;
            const _sNotes_ = bridge._seqEngine.heldNotes.length;
            const _sStep_ = bridge._seqEngine.stepIndex;
            const _sLen_ = Math.round((bridge.parameterCache['seq_length'] || 0) * 31) + 2;
            const _sBar_ = window._genPosBar(Math.round((_sStep_ / Math.max(_sLen_ - 1, 1)) * 18), 18);
            const _lcdText_ = document.getElementById('lcd-text');
            if (_lcdText_) {
                const _seqHtml_ = window._genLcdBarHtml('seq', {
                    header: 'SEQUENCER RESET (manual) #' + window._seqResetCount,
                    stepInfo: 'Step ' + _sStep_ + ' \u00B7 ' + _sNotes_ + ' notes \u00B7 ' + _sLen_ + ' steps',
                    bar: _sBar_
                });
                window.lcdSafeUpdate(_lcdText_, _seqHtml_, 'seq_reset');
            }
            
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

    window.syncSeqModalUIFromState = () => {
        if (backdrop.style.display !== 'none') {
            syncSeqModalUI();
        }
    };
    
    function syncSeqModalUI() {
        if (typeof window.currentActivePatchIndex === 'undefined' || window.currentActivePatchIndex === -1) {return;}
        const activeBank = window.loadedBanks[window.currentActiveBank];
        if (!activeBank) {return;}
        const patch = activeBank[window.currentActivePatchIndex];
        if (!patch || !patch.unpackedBytes) {return;}

        const seqEn = patch.unpackedBytes[117] > 0.5;
        const clockVal = patch.unpackedBytes[118] || 0;
        const lengthVal = patch.unpackedBytes[119] || 0;
        const keyloopVal = patch.unpackedBytes[121] || 0;

        if (seqBox) {seqBox.classList.toggle('active', seqEn);}

        if (selectClock) {selectClock.value = Math.round(clockVal);}
        if (selectLength) {selectLength.value = Math.round(lengthVal);}
        if (selectKeyLoop) {selectKeyLoop.value = Math.round(keyloopVal);}

        const sliders = [
            { id: 'seq_swing', val: patch.unpackedBytes[120] / 25.0 },
            { id: 'seq_slew_rate', val: patch.unpackedBytes[122] / 255.0 }
        ];

        sliders.forEach(sliderInfo => {
            if (sliderInfo.id === 'seq_swing') {
                const txt = document.getElementById('modal-seq-swing-val');
                if (txt) {txt.innerText = Math.round(50 + sliderInfo.val * 9);}
            } else if (sliderInfo.id === 'seq_slew_rate') {
                const txt = document.getElementById('modal-seq-slew-val');
                if (txt) {txt.innerText = Math.round(sliderInfo.val * 255);}
            }

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

        for (let i = 0; i < 32; i++) {
            const rawByte = patch.unpackedBytes[123 + i];
            window.seqStepsRaw[i] = rawByte;
            window.seqStepsValues[i] = rawByte === 0 ? 0 : rawByte - 128;
            if (typeof window.updateStepVisual === 'function') {window.updateStepVisual(i);}
        }
    }

    function _updateSeqModalModeBadge() {
        const badgeEl = document.getElementById('modal-seq-mode-badge');
        if (!badgeEl) {return;}
        const bridge = window.dualMidiBridge;
        if (!bridge) {return;}
        const keyLoopNorm = bridge.parameterCache['seq_key_loop'] || 0;
        const keyLoopVal = Math.round(keyLoopNorm * 2);
        const forcedMode = bridge._seqEngine && bridge._seqEngine._forcedFreeRunning;
        let label = '', color = '';
        if (forcedMode) {
            label = 'FREE*';
            color = 'var(--accent-yellow)';
        } else if (keyLoopVal === 0) {
            label = 'FREE';
            color = 'var(--accent-green)';
        } else if (keyLoopVal === 1) {
            label = 'KEY';
            color = 'var(--accent-blue)';
        } else {
            label = 'LOOP';
            color = 'var(--accent-teal)';
        }
        let tooltip = '';
        if (label === 'FREE*') {
            tooltip = ' title="Key Sync desactivado automáticamente — no había teclas presionadas al activar SEQ"';
        }
        const cursorStyle = label === 'FREE*' ? ';cursor:help' : '';
        badgeEl.innerHTML = '<span style="color:' + color + ';font-weight:bold;border:1px solid ' + color + ';padding:0 6px;border-radius:3px;font-size:10px' + cursorStyle + '"' + tooltip + '>' + label + '</span>';
    }

    let _modalPollTimer = null;
    let _modalLastPolledStep = -1;

    function _startModalPolling() {
        _stopModalPolling();
        _modalPollTimer = setInterval(function() {
            if (backdrop.style.display === 'none') {
                _stopModalPolling();
                return;
            }
            const bridge = window.dualMidiBridge;
            if (!bridge) {return;}
            
            const currentStep = bridge.parameterCache['seq_current_step'];
            const seqEn = bridge.parameterCache['seq_enable'] || 0;
            
            if (seqEn < 0.5) {
                if (_modalActiveStep !== -1) {
                    _clearModalActiveHighlight();
                }
                _modalLastPolledStep = -1;
                return;
            }
            
            if (currentStep === undefined || currentStep === null) {
                if (_modalActiveStep !== -1) {
                    _clearModalActiveHighlight();
                }
                _modalLastPolledStep = -1;
                return;
            }
            
            _updateSeqModalModeBadge();
            
            const stepIdx = Math.round(currentStep);
            const isSkip = (bridge.parameterCache['seq_current_step_skip'] || 0) > 0.5;
            
            if (stepIdx !== _modalLastPolledStep || isSkip !== _modalActiveSkip) {
                if (_modalActiveStep >= 0 && _modalActiveStep < 32) {
                    const prevEl = stepsGrid.children[_modalActiveStep];
                    if (prevEl) {
                        prevEl.style.outline = '';
                        prevEl.style.boxShadow = '';
                        const prevNum = prevEl.querySelector('.seq-step-val');
                        if (prevNum) {prevNum.style.boxShadow = '';}
                    }
                }
                _modalActiveStep = stepIdx;
                window._modalActiveStep = _modalActiveStep;
                _modalActiveSkip = isSkip;
                window._modalActiveSkip = _modalActiveSkip;
                _modalLastPolledStep = stepIdx;
                if (typeof window.updateStepVisual === 'function') {window.updateStepVisual(stepIdx);}
            }
        }, 100);
    }

    function _stopModalPolling() {
        if (_modalPollTimer) {
            clearInterval(_modalPollTimer);
            _modalPollTimer = null;
        }
    }

    window.addEventListener('beforeunload', _stopModalPolling);

    const _modalObserver = new MutationObserver(function() {
        if (backdrop.style.display === 'flex') {
            _clearModalActiveHighlight();
            _startModalPolling();
        } else if (backdrop.style.display === 'none') {
            _stopModalPolling();
            _clearModalActiveHighlight();
        }
    });
    _modalObserver.observe(backdrop, { attributes: true, attributeFilter: ['style'] });

    if (window.dualMidiBridge) {
        window.dualMidiBridge.onParameterChanged((paramId, val) => {
            if (backdrop.style.display === 'none') {return;}
            
            if (paramId === 'seq_enable' && seqBox) {
                seqBox.classList.toggle('active', val > 0.5);
                if (val < 0.5) {
                    _clearModalActiveHighlight();
                }
                if (val > 0.5 && window.dualMidiBridge._seqEngine) {
                    const _sNotes_ = window.dualMidiBridge._seqEngine.heldNotes.length;
                    const _sStep_ = window.dualMidiBridge._seqEngine.stepIndex;
                    const _sLen_ = Math.round((window.dualMidiBridge.parameterCache['seq_length'] || 0) * 31) + 2;
                    window._seqLastResetTime = Date.now();
                    window._seqResetCount++;
                    const _sBar_ = window._genPosBar(Math.round((_sStep_ / Math.max(_sLen_ - 1, 1)) * 18), 18);
                    const _lcdText_ = document.getElementById('lcd-text');
                    if (_lcdText_) {
                        const _seqHtml_ = window._genLcdBarHtml('seq', {
                            header: 'SEQUENCER RESET #' + window._seqResetCount,
                            stepInfo: 'Step ' + _sStep_ + ' \u00B7 ' + _sNotes_ + ' notes \u00B7 ' + _sLen_ + ' steps',
                            bar: _sBar_
                        });
                        window.lcdSafeUpdate(_lcdText_, _seqHtml_, 'seq_enable');
                    }
                }
            }
            if (paramId === 'seq_clock' && selectClock) {selectClock.value = Math.round(val * 15.0);}
            if (paramId === 'seq_length' && selectLength) {
                selectLength.value = Math.round(val * 31.0);
                for (let i = 0; i < 32; i++) {
                    if (typeof window.updateStepVisual === 'function') {window.updateStepVisual(i);}
                }
            }
            if (paramId === 'seq_key_loop' && selectKeyLoop) {selectKeyLoop.value = Math.round(val * 2.0);}
            if (paramId && paramId.startsWith('seq_step_')) {
                const stepIdx = parseInt(paramId.split('_')[2]) - 1;
                if (stepIdx >= 0 && stepIdx < 32) {
                    const rawByte = Math.round(val * 255);
                    window.seqStepsRaw[stepIdx] = rawByte;
                    window.seqStepsValues[stepIdx] = rawByte === 0 ? 0 : rawByte - 128;
                    if (typeof window.updateStepVisual === 'function') {window.updateStepVisual(stepIdx);}
                }
                return;
            }
            
            if (paramId === 'seq_swing' || paramId === 'seq_slew_rate') {
                if (paramId === 'seq_swing') {
                    const txt = document.getElementById('modal-seq-swing-val');
                    if (txt) {txt.innerText = Math.round(50 + val * 9);}
                } else if (paramId === 'seq_slew_rate') {
                    const txt = document.getElementById('modal-seq-slew-val');
                    if (txt) {txt.innerText = Math.round(val * 255);}
                }

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

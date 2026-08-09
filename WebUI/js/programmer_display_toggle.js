/**
 * @purpose Controls view switching for the central Programmer display module:
 *          1. 'sysex' (default): Unpacked hex grid, patch label, NRPN counters.
 *          2. 'scope': Real-time DSP oscilloscope waveform.
 *          3. 'fft': Real-time 512-bin FFT spectrum analyzer.
 *          4. 'dual': Split 50/50 view (oscilloscope top + FFT bottom).
 * @purpose_en Programmer central display mode manager.
 */

(function () {
    class ProgrammerDisplayToggle {
        constructor() {
            this.mode = localStorage.getItem('abd-eep-programmer-view-mode') || 'sysex';
            this.init();
        }

        init() {
            document.addEventListener('DOMContentLoaded', () => {
                this.bindEvents();
                this.applyMode(this.mode);
            });
        }

        bindEvents() {
            const tabContainer = document.querySelector('.programmer-tab-group');
            if (tabContainer) {
                tabContainer.addEventListener('click', (e) => {
                    const btn = e.target.closest('.programmer-tab-btn');
                    if (btn && btn.dataset.mode) {
                        this.setMode(btn.dataset.mode);
                    }
                });
            }
        }

        setMode(newMode) {
            if (!['sysex', 'scope', 'fft', 'dual'].includes(newMode)) {
                newMode = 'sysex';
            }
            this.mode = newMode;
            localStorage.setItem('abd-eep-programmer-view-mode', newMode);
            this.applyMode(newMode);
        }

        applyMode(mode) {
            const buttons = document.querySelectorAll('.programmer-tab-btn');
            buttons.forEach(btn => {
                const isActive = btn.dataset.mode === mode;
                btn.classList.toggle('active', isActive);
                if (isActive) {
                    btn.style.borderColor = 'var(--accent-primary, #ff9900)';
                    btn.style.color = 'var(--accent-primary, #ff9900)';
                } else {
                    btn.style.borderColor = 'var(--border, #444)';
                    btn.style.color = 'var(--text-secondary, #ccc)';
                }
            });

            const sysexBlock = document.getElementById('programmer-sysex-view-block');
            const scopeBlock = document.getElementById('programmer-scope-view-block');
            const sysexActions = document.getElementById('programmer-sysex-actions');
            const copyBtn = document.getElementById('sysex-copy-btn');
            const exportBtn = document.getElementById('sysex-export-btn');
            const zoomBtn = document.getElementById('sysex-zoom-btn');

            if (sysexBlock && scopeBlock) {
                if (mode === 'sysex') {
                    sysexBlock.style.display = 'block';
                    scopeBlock.style.display = 'none';
                    if (copyBtn) {copyBtn.style.display = 'inline-block';}
                    if (exportBtn) {exportBtn.style.display = 'inline-block';}
                } else {
                    sysexBlock.style.display = 'none';
                    scopeBlock.style.display = 'block';
                    if (copyBtn) {copyBtn.style.display = 'none';}
                    if (exportBtn) {exportBtn.style.display = 'none';}

                    // Update panelEditState view mode for scope renderer:
                    // 'scope' -> 1 (WAVE), 'fft' -> 2 (SPC), 'dual' -> 0 (DUAL)
                    if (window.panelEditState) {
                        window.panelEditState._scopeViewMode = (mode === 'scope') ? 1 : (mode === 'fft') ? 2 : 0;
                    }
                }

                if (sysexActions) {sysexActions.style.display = 'flex';}
                if (zoomBtn) {zoomBtn.style.display = 'inline-block';}
            }

            if (typeof window._updateAudioWaveformPolling === 'function') {
                window._updateAudioWaveformPolling();
            }
        }
    }

    window.programmerDisplayToggle = new ProgrammerDisplayToggle();
})();

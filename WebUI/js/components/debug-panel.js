/**
 * @component debug-modal
 * @purpose Modal overlay for monitoring real voice state from C++ DSP engine (facade)
 * Voice state reading extracted to debug-panel_voice.js
 * UI rendering extracted to debug-panel_state.js
 * @classification UI Component
 */
(function () {
    class DebugModal extends HTMLElement {
        constructor() {
            super();
            this._updateInterval = null;
            this._boundUpdate = function () { _updateFromCache.call(this); }.bind(this);
            this._vuSmoothed = 0.0;
            this._vuLastTime = Date.now();
            this._vuClipState = {};
            this._updating = false;
        }

        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = window.DEBUG_PANEL_TEMPLATE || '';
            }
            const closeBtn = this.querySelector('#debug-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', function () { this.hide(); }.bind(this));
            }
            const backdrop = this.querySelector('#debug-modal-backdrop');
            if (backdrop) {
                backdrop.addEventListener('click', function (e) {
                    if (e.target === backdrop) { this.hide(); }
                }.bind(this));
            }
            this._escHandler = function (e) { if (e.key === 'Escape') { this.hide(); } }.bind(this);
            document.addEventListener('keydown', this._escHandler);
            this._updateInterval = setInterval(this._boundUpdate, 250);
        }

        disconnectedCallback() {
            if (this._updateInterval) {
                clearInterval(this._updateInterval);
                this._updateInterval = null;
            }
            if (this._escHandler) {
                document.removeEventListener('keydown', this._escHandler);
            }
        }

        show() {
            const backdrop = this.querySelector('#debug-modal-backdrop');
            if (backdrop) { backdrop.style.display = 'flex'; }
            _updateFromCache.call(this);
        }

        hide() {
            const backdrop = this.querySelector('#debug-modal-backdrop');
            if (backdrop) { backdrop.style.display = 'none'; }
        }
    }

    async function _updateFromCache() {
        if (this._updating) { return; }
        this._updating = true;
        try {
            const backdrop = this.querySelector('#debug-modal-backdrop');
            if (!backdrop || backdrop.style.display === 'none') { return; }
            if (!window.dualMidiBridge) { return; }

            const bridge = window.dualMidiBridge;
            const cache = bridge.parameterCache || {};
            let raw = null;

            if (bridge.isJuce && typeof bridge.getVoiceState === 'function') {
                raw = await bridge.getVoiceState().catch(function () { return null; });
            }

            // Read voice state using extracted module
            const state = window.debugReadVoiceState(bridge, cache, raw);
            if (!state) { return; }

            // Update basic info
            window.debugSetText('debug-mode-name', state.voiceModeName);
            window.debugSetText('debug-stack-count', state.voicesPerNote + (state.voicesPerNote === 1 ? ' voice' : ' voices'));
            window.debugSetText('debug-detune-val', state.detuneVal);
            window.debugSetText('debug-pan-val', state.panVal);
            window.debugSetText('debug-data-source', state.dataSource);
            window.debugSetText('debug-active-count', String(state.activeCount) + '/' + String(state.voiceCount));

            // Chord / poly-chord status
            if (state.chordOn || state.polyChordOn) {
                window.debugSetHtml('debug-chord-status', state.chordStatus);
                window.debugSetHtml('debug-polychord-status', state.polyChordStatus);
            } else {
                window.debugSetText('debug-chord-status', '—');
                window.debugSetText('debug-polychord-status', '—');
            }

            // VU meter
            const vuResult = window.debugSmoothVU(state.peakLevel, this._vuSmoothed, this._vuLastTime);
            this._vuSmoothed = vuResult.smoothed;
            this._vuLastTime = vuResult.lastTime;
            this._vuClipState = window.debugRenderVU(this._vuSmoothed, state.peakLevel, this._vuClipState);

            // Controller bars
            window.debugRenderControllers({
                ctrlPitchBend: state.ctrlPitchBend,
                ctrlModWheel: state.ctrlModWheel,
                ctrlAftertouch: state.ctrlAftertouch,
                ctrlSustainPedal: state.ctrlSustainPedal
            });

            // Voice grid
            window.debugRenderVoiceGrid(state.voices, state.voiceMode);

        } catch (e) {
            // Silently handle errors during update
        } finally {
            this._updating = false;
        }
    }

    if (!customElements.get('debug-modal')) {
        customElements.define('debug-modal', DebugModal);
    }
})();

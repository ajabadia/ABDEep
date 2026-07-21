/**
 * @component debug-modal
 * @purpose Modal overlay for monitoring real voice state from C++ DSP engine
 * @classification UI Component
 * @complexity Medium
 */
(function() {
    class DebugModal extends HTMLElement {
        constructor() {
            super();
            this._updateInterval = null;
            this._boundUpdate = () => this._updateFromCache();
        }

        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = window.DEBUG_PANEL_TEMPLATE || '';
            }

            const closeBtn = this.querySelector('#debug-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.hide());
            }

            const backdrop = this.querySelector('#debug-modal-backdrop');
            if (backdrop) {
                backdrop.addEventListener('click', (e) => {
                    if (e.target === backdrop) {this.hide();}
                });
            }

            this._escHandler = (e) => { if (e.key === 'Escape') {this.hide();} };
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
            if (backdrop) {backdrop.style.display = 'flex';}
            this._updateFromCache();
        }

        hide() {
            const backdrop = this.querySelector('#debug-modal-backdrop');
            if (backdrop) {backdrop.style.display = 'none';}
        }

        async _updateFromCache() {
            if (this._updating) {return;}
            this._updating = true;
            try {
            const backdrop = this.querySelector('#debug-modal-backdrop');
            if (!backdrop || backdrop.style.display === 'none') {return;}
            if (!window.dualMidiBridge) {return;}

            const bridge = window.dualMidiBridge;
            const cache = bridge.parameterCache || {};
            const voiceMode = Math.min(12, Math.max(0, Math.round((cache['voice_mode'] || 0) * 12)));
            const voicesPerNote = window.DEBUG_VOICES_PER_MODE ? window.DEBUG_VOICES_PER_MODE[voiceMode] : 1;

            const setText = (id, txt) => { const el = this.querySelector('#' + id); if (el) {el.textContent = txt;} };
            setText('debug-mode-name', window.DEBUG_VOICE_MODE_NAMES ? window.DEBUG_VOICE_MODE_NAMES[voiceMode] : 'Poly');
            setText('debug-stack-count', voicesPerNote + (voicesPerNote === 1 ? ' voice' : ' voices'));

            const grid = this.querySelector('#debug-voice-grid');
            if (!grid) {return;}

            let activeCount = 0;
            let voices = [];
            let dataSource = '';
            let polyChordHeldCount = 0;
            let peakLevel = 0.0;

            if (bridge.isJuce) {
                dataSource = 'C++ Engine';
                setText('debug-detune-val', ((cache['unison_detune'] || 0) * 50.0).toFixed(1) + ' ¢');
                setText('debug-pan-val', Math.round((cache['vca_pan_spread'] || 0) * 100) + '%');
                const raw = (typeof bridge.getVoiceState === 'function') ? await bridge.getVoiceState().catch(() => null) : null;
                if (raw) {
                    peakLevel = raw.peakLevel !== undefined ? raw.peakLevel : 0.0;
                }
                if (raw && raw.voices && Array.isArray(raw.voices)) {
                    const voiceArray = raw.voices;
                    polyChordHeldCount = raw.polyChordNoteCount !== undefined ? raw.polyChordNoteCount : 0;
                    for (let i = 0; i < voiceArray.length; i++) {
                        const v = voiceArray[i];
                        const detuneCents = (v.detuneSemitones || 0) * 100.0;
                        const panPos = v.panPosition || 0.5;
                        const panSpread = v.voicePanSpread || 0;
                        const basePan = 0.5 + (panPos - 0.5) * panSpread;
                        const modOsc1DC = (v.modOsc1DetuneSemitones || 0) * 100.0;
                        const modOsc2DC = (v.modOsc2DetuneSemitones || 0) * 100.0;
                        const modPan = v.modPan !== undefined ? v.modPan : basePan;
                        const modVcfHz = v.modVcfCutoffHz || 0;
                        if (v.active) {activeCount++;}
                        voices.push({
                            voiceIndex: i,
                            active: v.active || false,
                            midiNote: v.active ? (v.midiNote || -1) : -1,
                            detuneCents: detuneCents,
                            basePan: basePan,
                            panOutput: modPan,
                            panRaw: panPos,
                            modOsc1DetuneCents: modOsc1DC,
                            modOsc2DetuneCents: modOsc2DC,
                            modVcfCutoffHz: modVcfHz
                        });
                    }
                } else {
                    for (let i = 0; i < 12; i++) {
                        voices.push({ voiceIndex: i, active: false, midiNote: -1, detuneCents: 0, panOutput: 0.5, panRaw: 0.5 });
                    }
                }
            } else {
                dataSource = 'Theoretical';
                const unisonDetune = cache['unison_detune'] || 0;
                const vcaPanSpread = cache['vca_pan_spread'] || 0;
                setText('debug-detune-val', (unisonDetune * 50.0).toFixed(1) + ' ¢');
                setText('debug-pan-val', Math.round(vcaPanSpread * 100) + '%');

                if (typeof window.calculateUnisonParams === 'function') {
                    voices = window.calculateUnisonParams(voiceMode, unisonDetune, vcaPanSpread);
                }
            }

            const chordOn = cache['chord_enable'] > 0.5;
            const polyChordOn = cache['poly_chord_enable'] > 0.5;
            const chordTypeIdx = Math.min(11, Math.max(0, Math.round((cache['chord_type'] || 0) * 11)));
            const chordTypeName = window.DEBUG_CHORD_TYPE_NAMES ? window.DEBUG_CHORD_TYPE_NAMES[chordTypeIdx] : '—';
            if (chordOn || polyChordOn) {
                const setHtml = (id, html) => { const el = this.querySelector('#' + id); if (el) {el.innerHTML = html;} };
                if (chordOn)
                    {setHtml('debug-chord-status', `<span style="color:var(--accent-green)">● ON</span> ${chordTypeName}`);}
                else
                    {setText('debug-chord-status', 'OFF');}
                if (polyChordOn) {
                    if (polyChordHeldCount > 0)
                        {setHtml('debug-polychord-status', `<span style="color:var(--accent-blue)">● ${polyChordHeldCount}</span> ${chordTypeName}`);}
                    else
                        {setHtml('debug-polychord-status', `<span style="color:var(--accent-blue)">● ON</span> ${chordTypeName}`);}
                } else
                    {setText('debug-polychord-status', 'OFF');}
            } else {
                setText('debug-chord-status', '—');
                setText('debug-polychord-status', '—');
            }

            setText('debug-data-source', dataSource);
            setText('debug-active-count', String(activeCount) + '/' + String(voices.length));

            if (this._vuSmoothed === undefined) {this._vuSmoothed = 0.0;}
            if (this._vuLastTime === undefined) {this._vuLastTime = Date.now();}
            const now = Date.now();
            const dt = Math.min(100, Math.max(1, now - this._vuLastTime));
            this._vuLastTime = now;
            
            const VU_ATTACK_MS = 5;
            const VU_RELEASE_MS = 300;
            
            if (peakLevel > this._vuSmoothed) {
                const attackCoeff = Math.exp(-dt / VU_ATTACK_MS);
                this._vuSmoothed = this._vuSmoothed * attackCoeff + peakLevel * (1 - attackCoeff);
            } else {
                const releaseCoeff = Math.exp(-dt / VU_RELEASE_MS);
                this._vuSmoothed = peakLevel + (this._vuSmoothed - peakLevel) * releaseCoeff;
            }
            if (this._vuSmoothed < 0.001) {this._vuSmoothed = 0.0;}
            
            const pct = Math.max(0, Math.min(1, this._vuSmoothed));
            const vuFill = document.getElementById('vu-fill');
            const vuVal = document.getElementById('vu-val');
            const vuClip = document.getElementById('vu-clip');
            if (vuFill) {
                const barW = Math.round(pct * 100);
                vuFill.style.width = barW + '%';

                if (pct < 0.001) {
                    vuFill.style.background = 'var(--text-faint)';
                } else if (pct < 0.06) {
                    vuFill.style.background = 'var(--accent-green)';
                } else if (pct < 0.5) {
                    vuFill.style.background = 'var(--accent-yellow)';
                } else if (pct < 0.7) {
                    vuFill.style.background = 'var(--accent-orange)';
                } else {
                    vuFill.style.background = 'var(--color-danger)';
                }

                if (peakLevel > 0.9) {
                    if (vuClip) {vuClip.style.opacity = '1';}
                    if (this._vuClipTimer) {
                        clearTimeout(this._vuClipTimer);
                        this._vuClipTimer = null;
                    }
                } else if (!this._vuClipTimer) {
                    this._vuClipTimer = setTimeout(() => {
                        if (vuClip) {vuClip.style.opacity = '0';}
                        this._vuClipTimer = null;
                    }, 500);
                }
            }
            if (vuVal) {
                if (this._vuSmoothed < 0.0001) {
                    vuVal.textContent = '-\u221E dB';
                } else {
                    const db = 20.0 * Math.log10(this._vuSmoothed);
                    vuVal.textContent = db.toFixed(1) + ' dB';
                    vuVal.style.color = db > -6.0 ? 'var(--accent-orange)' : db > -3.0 ? 'var(--color-danger)' : 'var(--text-secondary)';
                }
            }

            let ctrlPitchBend = 0.0;
            let ctrlModWheel = 0.0;
            let ctrlAftertouch = 0.0;
            let ctrlSustainPedal = 0.0;

            if (bridge.isJuce && raw) {
                ctrlPitchBend = raw.pitchBend !== undefined ? raw.pitchBend : 0.0;
                ctrlModWheel = raw.modWheel !== undefined ? raw.modWheel : 0.0;
                ctrlAftertouch = raw.aftertouch !== undefined ? raw.aftertouch : 0.0;
                ctrlSustainPedal = raw.sustainPedal !== undefined ? raw.sustainPedal : 0.0;
            } else {
                ctrlModWheel = cache['mod_wheel'] !== undefined ? cache['mod_wheel'] : 0.0;
                ctrlAftertouch = cache['aftertouch'] !== undefined ? cache['aftertouch'] : 0.0;
            }

            const pbFill = document.getElementById('ctrl-pitchBend-fill');
            const pbVal = document.getElementById('ctrl-pitchBend-val');
            if (pbFill) {
                const pbPct = Math.max(-1, Math.min(1, ctrlPitchBend));
                const center = 50;
                const left = pbPct >= 0 ? center : center + pbPct * 50;
                const width = Math.abs(pbPct) * 50;
                pbFill.style.left = left + '%';
                pbFill.style.width = width + '%';
                pbFill.style.background = pbPct >= 0 ? 'var(--accent-green)' : 'var(--accent-pink)';
            }
            if (pbVal) {
                const semitones = ctrlPitchBend * 2.0;
                pbVal.textContent = semitones.toFixed(2) + 'st';
                pbVal.style.color = ctrlPitchBend >= 0 ? 'var(--accent-green)' : 'var(--accent-pink)';
            }

            if (typeof window.applyControllerCurve === 'function') {
                ctrlAftertouch = window.applyControllerCurve(ctrlAftertouch, window.getControllerCurve('aftertouch'));
                ctrlModWheel = window.applyControllerCurve(ctrlModWheel, window.getControllerCurve('modwheel'));
            }

            const mwFill = document.getElementById('ctrl-modWheel-fill');
            const mwVal = document.getElementById('ctrl-modWheel-val');
            if (mwFill) {
                const mwPct = Math.max(0, Math.min(1, ctrlModWheel));
                mwFill.style.left = '0%';
                mwFill.style.width = Math.round(mwPct * 100) + '%';
                mwFill.style.background = mwPct > 0.01 ? 'var(--accent-blue)' : 'var(--text-faint)';
            }
            if (mwVal) {
                mwVal.textContent = Math.round(ctrlModWheel * 100) + '%';
                mwVal.style.color = ctrlModWheel > 0.01 ? 'var(--accent-blue)' : 'var(--text-faint)';
            }

            const atFill = document.getElementById('ctrl-aftertouch-fill');
            const atVal = document.getElementById('ctrl-aftertouch-val');
            if (atFill) {
                const atPct = Math.max(0, Math.min(1, ctrlAftertouch));
                atFill.style.left = '0%';
                atFill.style.width = Math.round(atPct * 100) + '%';
                atFill.style.background = atPct > 0.01 ? 'var(--accent-orange)' : 'var(--text-faint)';
            }
            if (atVal) {
                atVal.textContent = Math.round(ctrlAftertouch * 100) + '%';
                atVal.style.color = ctrlAftertouch > 0.01 ? 'var(--accent-orange)' : 'var(--text-faint)';
            }

            const susFill = document.getElementById('ctrl-sustainPedal-fill');
            const susVal = document.getElementById('ctrl-sustainPedal-val');
            if (susFill) {
                const susPct = Math.max(0, Math.min(1, ctrlSustainPedal));
                susFill.style.left = '0%';
                susFill.style.width = Math.round(susPct * 100) + '%';
                susFill.style.background = susPct > 0.5 ? 'var(--accent-green)' : 'var(--text-faint)';
            }
            if (susVal) {
                const isOn = ctrlSustainPedal > 0.5;
                susVal.textContent = isOn ? 'ON' : 'OFF';
                susVal.style.color = isOn ? 'var(--accent-green)' : 'var(--text-faint)';
            }

            if (voices.length === 0) {
                grid.innerHTML = `<div class="debug-no-stack">${window.DEBUG_VOICE_MODE_NAMES ? window.DEBUG_VOICE_MODE_NAMES[voiceMode] : 'Poly'} mode — no voices</div>`;
                return;
            }

            let html = '';
            for (const v of voices) {
                if (!v.active) {
                    html += `
                    <div class="debug-voice-slot" style="opacity:0.35">
                        <div class="debug-voice-header">
                            <span class="debug-voice-idx">V${v.voiceIndex}</span>
                            <span style="flex:1;font-size:var(--text-2xs);color:var(--text-faint)">inactive</span>
                        </div>
                    </div>`;
                    continue;
                }

                const hasMod = v.modOsc1DetuneCents !== undefined
                    && (Math.abs(v.modOsc1DetuneCents - v.detuneCents) > 0.5
                        || Math.abs(v.modOsc2DetuneCents - v.detuneCents) > 0.5);
                const vcfHz = v.modVcfCutoffHz || 0;
                const vcfLabel = vcfHz >= 1000 ? (vcfHz / 1000).toFixed(1) + 'k' : Math.round(vcfHz) + ' Hz';
                const noteName = typeof window.debugMidiNoteToName === 'function' ? window.debugMidiNoteToName(v.midiNote) : '—';
                const panLabel = v.panOutput < 0.33 ? 'L' : v.panOutput > 0.67 ? 'R' : 'C';
                const panLeft = Math.round(v.panOutput * 100);
                
                const detunePct = Math.min(1.0, Math.abs(v.detuneCents) / 50.0);
                const barW = Math.round(detunePct * 100);
                const detuneBarStyle = v.detuneCents >= 0
                    ? `margin-left:50%;width:${barW}%;background:var(--accent-teal)`
                    : `margin-left:${50 - barW}%;width:${barW}%;background:var(--accent-pink)`;

                function fmtDetune(cents) {
                    if (Math.abs(cents) < 0.1) {return '0.0¢';}
                    const s = cents >= 0 ? '+' : '';
                    return s + cents.toFixed(1) + '¢';
                }

                html += `
                    <div class="debug-voice-slot" style="border-left:3px solid var(--accent-green)">
                        <div class="debug-voice-header">
                            <span class="debug-voice-idx" style="color:var(--accent-green)">V${v.voiceIndex}</span>
                            <span style="font-size:var(--text-2xs);font-weight:700;font-family:'Share Tech Mono',monospace;color:var(--text-primary)">${noteName}</span>
                            <span style="font-size:var(--text-2xs);color:var(--text-dim)">N${v.midiNote}</span>
                            <span style="font-size:var(--text-2xs);font-weight:600;color:var(--text-faint)">base ${fmtDetune(v.detuneCents)}</span>
                            <span class="debug-voice-pan" style="color:var(--accent-blue)">${panLabel} ${Math.round(v.panOutput * 100)}%</span>
                            <span style="font-size:var(--text-2xs);color:var(--accent-purple);font-weight:600;font-family:'Share Tech Mono',monospace">${vcfLabel}</span>
                        </div>
                        ${hasMod ? `
                        <div style="display:flex;gap:6px;font-size:var(--text-2xs);font-family:'Share Tech Mono',monospace">
                            <span style="color:var(--accent-orange)">OSC1 ${fmtDetune(v.modOsc1DetuneCents)}</span>
                            <span style="color:var(--accent-yellow)">OSC2 ${fmtDetune(v.modOsc2DetuneCents)}</span>
                            <span style="margin-left:auto;color:var(--accent-blue)">pan ${panLabel} ${Math.round(v.panOutput * 100)}%</span>
                        </div>` : ''}
                        <div class="debug-voice-bars">
                            <div class="debug-bar-track">
                                <div class="debug-bar-fill" style="${detuneBarStyle}"></div>
                                <div class="debug-bar-center"></div>
                            </div>
                            <div class="debug-bar-track debug-bar-track-pan">
                                <div class="debug-bar-fill" style="margin-left:${panLeft}%;width:4px;background:var(--accent-blue)"></div>
                            </div>
                        </div>
                    </div>`;
            }
            grid.innerHTML = html;
            } finally {
                this._updating = false;
            }
        }
    }

    customElements.define('debug-modal', DebugModal);
})();

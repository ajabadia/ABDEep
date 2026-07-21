/**
 * @component fx-modal
 * @purpose Effects Engine Rack modal
 * @classification UI Component
 */
(function() {
    const FX_TYPE_OPTIONS = '<option value="0">BYPASS</option><option value="1">Ambience</option><option value="2">tcDeepVerb</option><option value="3">RoomRev</option><option value="4">VintageRoom</option><option value="5">HallReverb</option><option value="6">ChamberRev</option><option value="7">Plate Reverb</option><option value="8">Rich Plate</option><option value="9">Gated Reverb</option><option value="10">Reverse Reverb</option><option value="11">ChorusRev</option><option value="12">DelayRev</option><option value="13">FlangerRev</option><option value="14">MidasEQ</option><option value="15">Enhancer</option><option value="16">FairComp</option><option value="17">MBDistortion</option><option value="18">RackAmp</option><option value="19">Edison</option><option value="20">AutoPan/Trem</option><option value="21">NoiseGate</option><option value="22">Delay</option><option value="23">3Tap Delay</option><option value="24">4Tap Delay</option><option value="25">T-RayDelay</option><option value="26">DecimatorDelay</option><option value="27">ModDlyRev</option><option value="28">Stereo Chorus</option><option value="29">Chorus-D</option><option value="30">Stereo Flanger</option><option value="31">Stereo Phaser</option><option value="32">Mood Filter</option><option value="33">Dual Pitch</option><option value="34">Vintage Pitch</option><option value="35">Rotary Speaker</option>';

    function fxSlotHTML(id) {
        return `
            <div class="fx-slot-column flex-col${id === 1 ? ' selected' : ''}" id="fx-slot-${id}" style="background:var(--bg-surface);border:1px solid ${id === 1 ? 'var(--accent-primary)' : 'var(--border-dim)'};border-radius:var(--radius);padding:8px;gap:8px;cursor:pointer">
                <div class="flex-row justify-between items-center">
                    <span class="text-bold" style="font-size:var(--text-xs);color:var(--text-dim)">FX${id}</span>
                    <select class="fx-type-select modal-select" data-slot="${id}" style="font-size:var(--text-xs);padding:2px;width:75%">${FX_TYPE_OPTIONS}</select>
                </div>
                <div class="flex-row items-center justify-center" id="fx${id}-type-mini-display" style="background:var(--bg-deepest);height:32px;border-radius:var(--radius-sm);font-size:var(--text-xs);color:var(--accent-blue);font-family:'Share Tech Mono',monospace">${id === 1 ? 'Ambience' : id === 2 ? 'VintageRoom' : 'Bypass'}</div>
                <div class="flex-row flex-1 items-center" style="justify-content:center">
                    <div class="ctrl-unit flex-col items-center" data-param="fx${id}_gain" style="width:80%"><span class="label text-xs">Gain</span><div class="v-slider" style="height:65px"><div class="track"></div><div class="handle"></div></div></div>
                </div>
            </div>
        `;
    }

    const template = `
        <div class="modal-backdrop" id="fx-modal-backdrop" style="display:none;z-index:5000">
            <div class="modal" data-accent="blue" style="width:860px">
                <div class="modal-header">
                    <h2>Effects Engine Rack</h2>
                    <div class="close-btn" id="fx-modal-close-btn" data-ctrl-tooltip="Close Effects Engine modal">&times;</div>
                </div>
                
                <div class="modal-body" style="overflow-y:auto">
                    <div class="flex-col" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius);padding:12px;gap:8px">
                        <div class="flex-row justify-between items-center" style="border-bottom:1px solid var(--bg-hover);padding-bottom:4px;margin-bottom:4px">
                            <span id="fx-screen-title" style="font-size:var(--text-sm);font-weight:bold;color:var(--accent-blue);text-transform:uppercase;font-family:'Share Tech Mono',monospace">Selected Effect Param Screen</span>
                            <span id="fx-screen-active-slot" class="text-uppercase" style="font-size:var(--text-sm);color:var(--text-dim)">Slot: FX1 (Ambience)</span>
                        </div>
                        <div id="fx-dynamic-editor-area" class="flex-row items-center justify-center" style="min-height:140px;background:var(--bg-deepest);border-radius:var(--radius-sm);border:1px solid var(--bg-header)"></div>
                    </div>

                    <div style="display:grid;grid-template-columns:repeat(4,1.25fr) 1.5fr;gap:12px">
                        ${[1,2,3,4].map(fxSlotHTML).join('')}

                        <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius);padding:10px;gap:8px">
                            <div>
                                <span class="label text-uppercase text-bold text-dim" style="font-size:var(--text-xs);display:block;margin-bottom:4px">Routing</span>
                                <select id="fx-routing-select" class="modal-select" style="font-size:var(--text-xs);padding:3px;width:100%"><option value="0">Series</option><option value="1">Parallel Pairs</option><option value="2">Series Chain</option><option value="3">Full Parallel</option><option value="4">Dual Series Parallel</option><option value="5">Series Split Mid</option><option value="6">Parallel Pairs Series</option><option value="7">Series Chain + Parallel</option><option value="8">Parallel Front Series</option><option value="9">Series with Feedback</option></select>
                            </div>
                            <div>
                                <span class="label text-uppercase text-bold text-dim" style="font-size:var(--text-xs);display:block;margin-bottom:4px">Page</span>
                                <div class="flex-row gap-4">
                                    <button class="btn btn-xs active" id="fx-page-1-btn" style="flex:1" data-ctrl-tooltip="FX Parameter Page 1">P1</button>
                                    <button class="btn btn-xs" id="fx-page-2-btn" style="flex:1" data-ctrl-tooltip="FX Parameter Page 2">P2</button>
                                </div>
                            </div>
                            <div>
                                <span class="label text-uppercase text-bold text-dim" style="font-size:var(--text-xs);display:block;margin-bottom:4px">Mode</span>
                                <div class="flex-row" style="gap:3px">
                                    <button class="btn btn-xs active" id="fx-mode-ins-btn" style="flex:1" data-ctrl-tooltip="Insert Mode — fully processed wet signal">INS</button>
                                    <button class="btn btn-xs" id="fx-mode-send-btn" style="flex:1" data-ctrl-tooltip="Send Mode — mix of dry and processed signal">SEND</button>
                                    <button class="btn btn-xs" id="fx-mode-bypass-btn" style="flex:1" data-ctrl-tooltip="Bypass Mode — signal passes unprocessed">BYP</button>
                                </div>
                                <div id="fx-send-level-area" class="flex-col items-center" style="margin-top:6px;gap:2px;display:none">
                                    <span class="label text-uppercase text-bold text-dim" style="font-size:6px;display:block">Send Lvl</span>
                                    <div class="ctrl-unit flex-col items-center" data-param="fx_send_level" style="width:100%">
                                        <div class="v-slider" id="fx-send-level-slider" style="height:36px">
                                            <div class="track"></div>
                                            <div class="handle" style="top:50%"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- FX Presets Section -->
                    <div class="flex-col" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius);padding:8px;gap:6px;margin-top:12px">
                        <div class="flex-row justify-between items-center" style="border-bottom:1px solid var(--bg-hover);padding-bottom:4px">
                            <span style="font-size:var(--text-xs);font-weight:bold;color:var(--accent-blue);text-transform:uppercase;font-family:'Share Tech Mono',monospace">FX Presets</span>
                            <div class="flex-row" style="gap:4px">
                                <input type="text" id="fx-preset-name-input" placeholder="Preset name..." 
                                    style="font-size:var(--text-xs);padding:2px 6px;background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius-xs);color:var(--text-primary);width:120px"
                                    onkeydown="if(event.key==='Enter') window.saveFxPresetFromInput()"/>
                                <button class="btn btn-xs" id="fx-preset-save-btn" style="padding:2px 8px" 
                                    onclick="window.saveFxPresetFromInput()" data-ctrl-tooltip="Save current FX slot as preset">💾 Save</button>
                            </div>
                        </div>
                        <div id="fx-preset-list" class="flex-col" style="max-height:120px;overflow-y:auto;gap:2px">
                            <div style="color:var(--text-faint);font-size:var(--text-xs);padding:4px;text-align:center">No FX presets saved yet</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    class FxModal extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }
        }
    }
    customElements.define('fx-modal', FxModal);

    window.saveFxPresetFromInput = function() {
        if (window.currentActiveBank && window.currentActiveBank.startsWith('Factory Bank')) {
            alert('Cannot save FX presets on factory patches. Please copy this patch to a User Bank first.');
            return;
        }
        const input = document.getElementById('fx-preset-name-input');
        if (!input) {return;}
        const name = input.value.trim();
        if (name) {
            if (typeof window.saveFxPreset === 'function') {
                window.saveFxPreset(name);
            }
            input.value = '';
        }
    };
})();

/**
 * @component fx-modal-templates
 * @purpose HTML Templates and Options for Effects Engine Rack modal
 * @classification UI Component Submodule
 */
(function() {
    const FX_TYPE_OPTIONS = '<optgroup label="--- STANDARD DM12 FX ---"><option value="0">BYPASS</option><option value="1">Ambience</option><option value="2">tcDeepVerb</option><option value="3">RoomRev</option><option value="4">VintageRoom</option><option value="5">HallReverb</option><option value="6">ChamberRev</option><option value="7">Plate Reverb</option><option value="8">Rich Plate</option><option value="9">Gated Reverb</option><option value="10">Reverse Reverb</option><option value="11">ChorusRev</option><option value="12">DelayRev</option><option value="13">FlangerRev</option><option value="14">MidasEQ</option><option value="15">Enhancer</option><option value="16">FairComp</option><option value="17">MBDistortion</option><option value="18">RackAmp</option><option value="19">Edison</option><option value="20">AutoPan/Trem</option><option value="21">NoiseGate</option><option value="22">Delay</option><option value="23">3Tap Delay</option><option value="24">4Tap Delay</option><option value="25">T-RayDelay</option><option value="26">DecimatorDelay</option><option value="27">ModDlyRev</option><option value="28">Stereo Chorus</option><option value="29">Chorus-D</option><option value="30">Stereo Flanger</option><option value="31">Stereo Phaser</option><option value="32">Mood Filter</option><option value="33">Dual Pitch</option><option value="34">Vintage Pitch</option><option value="35">Rotary Speaker</option></optgroup><optgroup label="--- ADVANCED PRO FX ---"><option value="36">Roland BBD Chorus</option><option value="37">Solina Ensemble</option><option value="38">Ring Modulator</option><option value="39">Space Echo RE-201</option><option value="40">Analog Tape Delay</option><option value="41">Shimmer Delay</option><option value="42">Granular Delay</option><option value="43">Pattern Freeze</option><option value="44">Ducking Delay</option><option value="45">Spectral Dly</option><option value="46">Freq Shifter</option><option value="47">HarmonicReso</option><option value="48">Vocal Formant</option><option value="49">Bitcrusher</option><option value="50">Tube Saturator</option><option value="51">Tape Saturator</option><option value="52">LoFi Warming</option><option value="53">Wow & Flutter</option><option value="54">Dimension Expander</option><option value="55">Ensemble JX</option><option value="56">Junorus Chorus</option><option value="57">Slow Motion Chorus</option><option value="58">BBD Ensemble</option><option value="59">Phaser 8</option><option value="60">Micro Spat</option><option value="61">Multi Tap Chorus</option><option value="62">Tremolo Pan</option><option value="63">Auto Pan</option></optgroup>';

    const FX_TYPE_LABELS = {
        0:'Bypass',1:'Ambience',2:'tcDeepVerb',3:'RoomRev',4:'VintageRoom',5:'HallReverb',6:'ChamberRev',7:'PlateReverb',8:'RichPlate',9:'GatedRev',10:'ReverseRev',11:'ChorusRev',12:'DelayRev',13:'FlangerRev',14:'MidasEQ',15:'Enhancer',16:'FairComp',17:'MBDistortion',18:'RackAmp',19:'Edison',20:'AutoPan/Trem',21:'NoiseGate',22:'Delay',23:'3TapDelay',24:'4TapDelay',25:'T-RayDelay',26:'DecimatorDelay',27:'ModDlyRev',28:'StereoChorus',29:'Chorus-D',30:'StereoFlanger',31:'StereoPhaser',32:'MoodFilter',33:'DualPitch',34:'VintagePitch',35:'RotarySpkr',36:'RolandBBD',37:'SolinaEns',38:'RingMod',39:'SpaceEcho',40:'TapeDelay',41:'ShimmerDly',42:'GranularDly',43:'PatternFrz',44:'DuckingDly',45:'SpectralDly',46:'FreqShifter',47:'HarmonicReso',48:'VocalFormant',49:'Bitcrusher',50:'TubeSat',51:'TapeSat',52:'LoFiWarm',53:'WowFlutter',54:'DimExpander',55:'EnsembleJX',56:'JunorusChr',57:'SlowMoChr',58:'BBDEns',59:'Phaser8',60:'MicroSpat',61:'MultiTapChr',62:'TremoloPan',63:'AutoPan'
    };

    function fxSlotHTML(id) {
        return `
            <div class="fx-slot-column flex-col${id === 1 ? ' selected' : ''}" id="fx-slot-${id}" style="background:var(--bg-surface);border:1px solid ${id === 1 ? 'var(--accent-primary)' : 'var(--border-dim)'};border-radius:var(--radius);padding:8px;gap:6px;cursor:pointer">
                <div class="flex-row justify-between items-center">
                    <span class="text-bold" style="font-size:var(--text-xs);color:var(--text-dim)">FX${id}</span>
                    <select class="fx-type-select modal-select" data-slot="${id}" style="font-size:var(--text-xs);padding:2px;width:75%">${FX_TYPE_OPTIONS}</select>
                </div>
                <div class="flex-row items-center justify-center" id="fx${id}-type-mini-display" style="background:var(--bg-deepest);height:32px;border-radius:var(--radius-sm);font-size:var(--text-xs);color:var(--accent-blue);font-family:'Share Tech Mono',monospace">${id === 1 ? 'Ambience' : id === 2 ? 'VintageRoom' : 'Bypass'}</div>
                <div class="flex-col items-center" style="gap:3px">
                    <select class="fx-preset-select modal-select" data-slot="${id}" style="font-size:var(--text-2xs);padding:1px;width:100%">
                        <option value="" disabled selected>-- Select Preset --</option>
                    </select>
                    <div class="flex-row" style="gap:3px;width:100%">
                        <button class="btn btn-xs fx-preset-load-btn" data-slot="${id}" style="flex:1;font-size:var(--text-2xs);padding:2px 0" data-ctrl-tooltip="Load selected preset">Load</button>
                        <button class="btn btn-xs fx-preset-save-btn" data-slot="${id}" style="flex:1;font-size:var(--text-2xs);padding:2px 0" data-ctrl-tooltip="Save current slot as preset">Save</button>
                        <button class="btn btn-xs fx-preset-delete-btn" data-slot="${id}" style="flex:1;font-size:var(--text-2xs);padding:2px 0" data-ctrl-tooltip="Delete selected preset">Del</button>
                    </div>
                </div>
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

                    </div>
                </div>
            </div>
        </div>
    `;

    window.FX_TYPE_OPTIONS = FX_TYPE_OPTIONS;
    window.FX_TYPE_LABELS = FX_TYPE_LABELS;
    window.FX_MODAL_TEMPLATE = template;
})();

window.PANEL_TEMPLATES = window.PANEL_TEMPLATES || {};
window.PANEL_TEMPLATES.LFO = (prefix) => `
        <div class="panel-section-title">LFO Waveform Shape</div>
        <div class="shape-selector-container">
            <div class="shape-led-row" data-shape="0" data-param="${prefix}shape"><div class="led-dot"></div><span class="shape-name">Sine</span></div>
            <div class="shape-led-row" data-shape="1" data-param="${prefix}shape"><div class="led-dot"></div><span class="shape-name">Triangle</span></div>
            <div class="shape-led-row" data-shape="2" data-param="${prefix}shape"><div class="led-dot"></div><span class="shape-name">Square</span></div>
            <div class="shape-led-row" data-shape="3" data-param="${prefix}shape"><div class="led-dot"></div><span class="shape-name">Ramp Up</span></div>
            <div class="shape-led-row" data-shape="4" data-param="${prefix}shape"><div class="led-dot"></div><span class="shape-name">Ramp Down</span></div>
            <div class="shape-led-row" data-shape="5" data-param="${prefix}shape"><div class="led-dot"></div><span class="shape-name">Sample & Hold</span></div>
            <div class="shape-led-row" data-shape="6" data-param="${prefix}shape"><div class="led-dot"></div><span class="shape-name">Sample & Glide</span></div>
        </div>

        <div class="panel-section-title">Modulation, Rates & Phase</div>
        <div class="panel-row" style="margin-top:5px;margin-bottom:5px">
            <div class="ctrl-unit flex-col items-center" data-param="${prefix}rate" style="width:22%"><span class="label text-xs" style="margin-bottom:4px">Rate</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="${prefix}delay" style="width:22%"><span class="label text-xs" style="margin-bottom:4px">Delay</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="${prefix}slew" style="width:22%"><span class="label text-xs" style="margin-bottom:4px">Slew</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="${prefix}mono_mode" style="width:22%"><span class="label text-xs" style="margin-bottom:4px">Phase</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
        </div>

        <div class="panel-section-title">Sync Options</div>
        <div class="flex-row gap-8 w-full">
            <div class="toggle-box" id="lfo-key-sync-box" data-param="${prefix}key_sync" data-ctrl-tooltip="Reset LFO phase on each new note"><span class="toggle-label">Key Sync</span><div class="toggle-led"></div></div>
            <div class="toggle-box" id="lfo-arp-sync-box" data-param="${prefix}arp_sync" data-ctrl-tooltip="Sync LFO rate to arpeggiator/sequencer clock"><span class="toggle-label">Arp Sync</span><div class="toggle-led"></div></div>
        </div>
    `;
window.PANEL_TEMPLATES.VCA = () => `
        <div class="panel-section-title">VCA Sound Mode</div>
        <div class="flex-row gap-10 w-full" style="margin-bottom:5px">
            <div class="toggle-box" id="panel-vca-mode-transparent" data-param="vca_mode" style="flex:1" data-ctrl-tooltip="VCA Transparent — clean, undistorted output"><span class="toggle-label">Transparent</span><div class="toggle-led"></div></div>
            <div class="toggle-box" id="panel-vca-mode-ballsy" data-param="vca_mode" style="flex:1" data-ctrl-tooltip="VCA Ballsy — saturated, aggressive character"><span class="toggle-label">Ballsy</span><div class="toggle-led"></div></div>
        </div>

        <div class="panel-section-title">VCA Level & Modulation</div>
        <div class="panel-row" style="margin-top:5px;margin-bottom:5px;justify-content:space-around">
            <div class="ctrl-unit flex-col items-center" data-param="vca_level" style="width:23%"><span class="label text-xs" style="margin-bottom:4px">Level</span><div class="v-slider" style="height:100px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="vca_env_depth" style="width:23%"><span class="label text-xs" style="margin-bottom:4px">Env Depth</span><div class="v-slider" style="height:100px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="vca_vel_sens" style="width:23%"><span class="label text-xs" style="margin-bottom:4px">Vel Sens</span><div class="v-slider" style="height:100px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="vca_pan_spread" style="width:23%"><span class="label text-xs" style="margin-bottom:4px">Pan Spread</span><div class="v-slider" style="height:100px"><div class="track"></div><div class="handle"></div></div></div>
        </div>
    `;
window.PANEL_TEMPLATES.ENV = (prefix) => `
        <div class="panel-section-title">Envelope Curves (ADSR)</div>
        <div class="panel-row" style="margin-top:5px;margin-bottom:5px">
            <div class="ctrl-unit flex-col items-center" data-param="${prefix}attack_curve" style="width:23%"><span class="label text-xs" style="margin-bottom:4px">Atk Curv</span><div class="v-slider" style="height:70px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="${prefix}decay_curve" style="width:23%"><span class="label text-xs" style="margin-bottom:4px">Dec Curv</span><div class="v-slider" style="height:70px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="${prefix}sustain_curve" style="width:23%"><span class="label text-xs" style="margin-bottom:4px">Sus Curv</span><div class="v-slider" style="height:70px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="${prefix}release_curve" style="width:23%"><span class="label text-xs" style="margin-bottom:4px">Rel Curv</span><div class="v-slider" style="height:70px"><div class="track"></div><div class="handle"></div></div></div>
        </div>

        <div class="panel-section-title">Envelope Times / ADSR faders</div>
        <div class="panel-row" style="margin-top:5px;margin-bottom:5px">
            <div class="ctrl-unit flex-col items-center" data-param="${prefix}attack" style="width:23%"><span class="label text-xs" style="margin-bottom:4px">Attack</span><div class="v-slider" style="height:70px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="${prefix}decay" style="width:23%"><span class="label text-xs" style="margin-bottom:4px">Decay</span><div class="v-slider" style="height:70px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="${prefix}sustain" style="width:23%"><span class="label text-xs" style="margin-bottom:4px">Sustain</span><div class="v-slider" style="height:70px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="${prefix}release" style="width:23%"><span class="label text-xs" style="margin-bottom:4px">Release</span><div class="v-slider" style="height:70px"><div class="track"></div><div class="handle"></div></div></div>
        </div>

        <div class="panel-section-title">Envelope Trigger Source</div>
        <div class="shape-selector-container">
            <div class="shape-led-row" data-trig="0" data-param="${prefix}trigger_mode"><div class="led-dot"></div><span class="shape-name">Key</span></div>
            <div class="shape-led-row" data-trig="1" data-param="${prefix}trigger_mode"><div class="led-dot"></div><span class="shape-name">LFO 1</span></div>
            <div class="shape-led-row" data-trig="2" data-param="${prefix}trigger_mode"><div class="led-dot"></div><span class="shape-name">LFO 2</span></div>
            <div class="shape-led-row" data-trig="3" data-param="${prefix}trigger_mode"><div class="led-dot"></div><span class="shape-name">Loop</span></div>
            <div class="shape-led-row" data-trig="4" data-param="${prefix}trigger_mode"><div class="led-dot"></div><span class="shape-name">Sequence</span></div>
        </div>
    `;
window.PANEL_TEMPLATES.HPF = () => `
        <div class="panel-section-title">HPF Bass Boost</div>
        <div class="flex-row gap-10 w-full" style="margin-bottom:5px">
            <div class="toggle-box" id="panel-hpf-boost-off" style="flex:1" data-ctrl-tooltip="HPF Bass Boost: Off"><span class="toggle-label">Boost Off</span><div class="toggle-led"></div></div>
            <div class="toggle-box" id="panel-hpf-boost-on" style="flex:1" data-ctrl-tooltip="HPF Bass Boost: On — adds low-end presence"><span class="toggle-label">Boost On</span><div class="toggle-led"></div></div>
        </div>

        <div class="panel-section-title">HPF Cutoff Frequency</div>
        <div class="panel-row" style="margin-top:5px;margin-bottom:5px;justify-content:center">
            <div class="ctrl-unit flex-col items-center" data-param="hpf_cutoff" style="width:50%"><span class="label text-xs" style="margin-bottom:4px">Frequency</span><div class="v-slider" style="height:110px"><div class="track"></div><div class="handle"></div></div></div>
        </div>
    `;
window.PANEL_TEMPLATES.OSC1 = () => `
        <div class="panel-section-title">OSC 1 Waveforms</div>
        <div class="flex-row gap-8 w-full" style="margin-bottom:10px">
            <div class="toggle-box" id="panel-osc1-saw-box" data-param="osc1_saw_enable" style="flex:1" data-ctrl-tooltip="OSC 1 Sawtooth waveform — rich harmonics"><span class="toggle-label">Sawtooth</span><div class="toggle-led"></div></div>
            <div class="toggle-box" id="panel-osc1-square-box" data-param="osc1_square_enable" style="flex:1" data-ctrl-tooltip="OSC 1 Square/Pulse waveform — hollow tone"><span class="toggle-label">Square</span><div class="toggle-led"></div></div>
        </div>
        <div class="panel-section-title">OSC 1 Pitch Range</div>
        <div class="shape-selector-container" style="margin-bottom:10px">
            <div class="shape-led-row osc1-range-led-row" data-val="0" data-param="osc1_range"><div class="led-dot"></div><span class="shape-name text-xs">16'</span></div>
            <div class="shape-led-row osc1-range-led-row" data-val="1" data-param="osc1_range"><div class="led-dot"></div><span class="shape-name text-xs">8'</span></div>
            <div class="shape-led-row osc1-range-led-row" data-val="2" data-param="osc1_range"><div class="led-dot"></div><span class="shape-name text-xs">4'</span></div>
        </div>
        <div class="panel-section-title">Pitch Mod Destination Mode</div>
        <div class="shape-selector-container" style="margin-bottom:10px">
            <div class="shape-led-row osc1-pmode-led-row" data-val="0" data-param="osc1_pm_mode"><div class="led-dot"></div><span class="shape-name text-xs">OSC 1+2</span></div>
            <div class="shape-led-row osc1-pmode-led-row" data-val="1" data-param="osc1_pm_mode"><div class="led-dot"></div><span class="shape-name text-xs">OSC 1 Only</span></div>
        </div>
        <div class="panel-section-title">Modulation Sources Selection</div>
        <div class="w-full" style="margin-bottom:10px">
            <span class="label text-xs text-dim" style="display:block;margin-bottom:3px">P.MOD SOURCE</span>
            <select id="panel-osc1-pmod-src-select" class="modal-select w-full">
                <option value="0">LFO 1</option><option value="1">LFO 2</option><option value="2">ENV 1</option><option value="3">ENV 2</option><option value="4">ENV 3</option><option value="5">LFO 1 (Uni)</option><option value="6">LFO 2 (Uni)</option>
            </select>
        </div>
        <div class="w-full" style="margin-bottom:10px">
            <span class="label text-xs text-dim" style="display:block;margin-bottom:3px">PWM SOURCE</span>
            <select id="panel-osc1-pwm-src-select" class="modal-select w-full">
                <option value="0">Manual</option><option value="1">LFO 1</option><option value="2">LFO 2</option><option value="3">ENV 1</option><option value="4">ENV 2</option><option value="5">ENV 3</option>
            </select>
        </div>
        <div class="panel-section-title">OSC Settings</div>
        <div class="flex-row justify-center w-full" style="margin-bottom:10px">
            <div class="toggle-box" id="panel-osc-key-reset-box" data-param="osc_key_reset" style="width:80%" data-ctrl-tooltip="Reset oscillator phase at each new note for consistent attack"><span class="toggle-label">Key Down Reset</span><div class="toggle-led"></div></div>
        </div>
        <div class="panel-section-title">OSC 1 Faders</div>
        <div class="panel-row" style="margin-top:5px;margin-bottom:5px;justify-content:space-around">
            <div class="ctrl-unit flex-col items-center" data-param="osc1_pitch_mod" style="width:23%"><span class="label text-xs">Pitch Mod</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="osc1_pwm_amount" style="width:23%"><span class="label text-xs">PWM</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="osc1_lfo_aftertouch" style="width:23%"><span class="label text-xs">Aft>Pmod</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="osc1_lfo_modwheel" style="width:23%"><span class="label text-xs">Whl>Pmod</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
        </div>
    `;
window.PANEL_TEMPLATES.OSC2 = () => `
        <div class="panel-section-title">OSC 2 Pitch Range</div>
        <div class="shape-selector-container" style="margin-bottom:10px">
            <div class="shape-led-row osc2-range-led-row" data-val="0" data-param="osc2_range"><div class="led-dot"></div><span class="shape-name text-xs">16'</span></div>
            <div class="shape-led-row osc2-range-led-row" data-val="1" data-param="osc2_range"><div class="led-dot"></div><span class="shape-name text-xs">8'</span></div>
            <div class="shape-led-row osc2-range-led-row" data-val="2" data-param="osc2_range"><div class="led-dot"></div><span class="shape-name text-xs">4'</span></div>
        </div>
        <div class="panel-section-title">OSC Hard Sync</div>
        <div class="flex-row justify-center w-full" style="margin-bottom:10px">
            <div class="toggle-box" id="panel-osc-sync-box" data-param="osc_sync_enable" style="width:80%" data-ctrl-tooltip="OSC Hard Sync — forces OSC 2 to restart waveform at OSC 1 rate"><span class="toggle-label">Hard Sync Enable</span><div class="toggle-led"></div></div>
        </div>
        <div class="panel-section-title">Modulation Sources Selection</div>
        <div class="w-full" style="margin-bottom:10px">
            <span class="label text-xs text-dim" style="display:block;margin-bottom:3px">P.MOD SOURCE</span>
            <select id="panel-osc2-pmod-src-select" class="modal-select w-full">
                <option value="0">LFO 1</option><option value="1">LFO 2</option><option value="2">ENV 1</option><option value="3">ENV 2</option><option value="4">ENV 3</option><option value="5">LFO 1 (Uni)</option><option value="6">LFO 2 (Uni)</option>
            </select>
        </div>
        <div class="w-full" style="margin-bottom:10px">
            <span class="label text-xs text-dim" style="display:block;margin-bottom:3px">TONE MOD SOURCE</span>
            <select id="panel-osc2-tpm-src-select" class="modal-select w-full">
                <option value="0">Manual</option><option value="1">LFO 1</option><option value="2">LFO 2</option><option value="3">ENV 1</option><option value="4">ENV 2</option><option value="5">ENV 3</option>
            </select>
        </div>
        <div class="panel-section-title">OSC 2 Faders</div>
        <div class="panel-row" style="margin-top:5px;margin-bottom:5px;justify-content:space-around">
            <div class="ctrl-unit flex-col items-center" data-param="osc2_pitch_mod" style="width:16%"><span class="label text-xs">Pitch Mod</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="osc2_tone_mod" style="width:16%"><span class="label text-xs">Tone Mod</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="osc2_pitch" style="width:16%"><span class="label text-xs">Pitch</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="osc2_level" style="width:16%"><span class="label text-xs">Level</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="osc2_aftertouch_pitch" style="width:16%"><span class="label text-xs">Aft>Pmod</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="osc2_modwheel_pitch" style="width:16%"><span class="label text-xs">Whl>Pmod</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
        </div>
    `;

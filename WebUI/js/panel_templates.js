/**
 * @purpose Colección de plantillas HTML para los distintos módulos del Panel Deslizable Izquierdo.
 * @purpose_en HTML templates for the left sliding editor modules.
 */

window.PANEL_TEMPLATES = {
    LFO: (prefix) => `
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
    `,
    VCA: () => `
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
    `,
    ENV: (prefix) => `
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
    `,
    HPF: () => `
        <div class="panel-section-title">HPF Bass Boost</div>
        <div class="flex-row gap-10 w-full" style="margin-bottom:5px">
            <div class="toggle-box" id="panel-hpf-boost-off" style="flex:1" data-ctrl-tooltip="HPF Bass Boost: Off"><span class="toggle-label">Boost Off</span><div class="toggle-led"></div></div>
            <div class="toggle-box" id="panel-hpf-boost-on" style="flex:1" data-ctrl-tooltip="HPF Bass Boost: On — adds low-end presence"><span class="toggle-label">Boost On</span><div class="toggle-led"></div></div>
        </div>

        <div class="panel-section-title">HPF Cutoff Frequency</div>
        <div class="panel-row" style="margin-top:5px;margin-bottom:5px;justify-content:center">
            <div class="ctrl-unit flex-col items-center" data-param="hpf_cutoff" style="width:50%"><span class="label text-xs" style="margin-bottom:4px">Frequency</span><div class="v-slider" style="height:110px"><div class="track"></div><div class="handle"></div></div></div>
        </div>
    `,
    VCF: () => `
        <div class="panel-section-title">LPF Type</div>
        <div class="flex-row gap-8 w-full" style="margin-bottom:10px">
            <div class="toggle-box" id="panel-vcf-pole-2" style="flex:1" data-ctrl-tooltip="2-Pole (12dB/oct) — gentle filter slope"><span class="toggle-label">2-Pole</span><div class="toggle-led"></div></div>
            <div class="toggle-box" id="panel-vcf-pole-4" style="flex:1" data-ctrl-tooltip="4-Pole (24dB/oct) — steep classic filter slope"><span class="toggle-label">4-Pole</span><div class="toggle-led"></div></div>
        </div>
        <div class="panel-section-title">Envelope Polarity / Phase</div>
        <div class="flex-row gap-8 w-full" style="margin-bottom:10px">
            <div class="toggle-box" id="panel-vcf-pol-normal" style="flex:1" data-ctrl-tooltip="Envelope Polarity: Normal — envelope opens filter upward"><span class="toggle-label">Normal</span><div class="toggle-led"></div></div>
            <div class="toggle-box" id="panel-vcf-pol-inverted" style="flex:1" data-ctrl-tooltip="Envelope Polarity: Inverted — envelope sweeps cutoff downward"><span class="toggle-label">Inverted</span><div class="toggle-led"></div></div>
        </div>
        <div class="panel-section-title">Filter LFO Modulation Source</div>
        <div class="flex-row gap-8 w-full" style="margin-bottom:10px">
            <div class="toggle-box" id="panel-vcf-lfosrc-1" style="flex:1" data-ctrl-tooltip="LFO 1 as modulation source for filter cutoff"><span class="toggle-label">LFO 1</span><div class="toggle-led"></div></div>
            <div class="toggle-box" id="panel-vcf-lfosrc-2" style="flex:1" data-ctrl-tooltip="LFO 2 as modulation source for filter cutoff"><span class="toggle-label">LFO 2</span><div class="toggle-led"></div></div>
        </div>
        <div class="panel-section-title">VCF Faders & Modulators</div>
        <div class="panel-row" style="margin-top:5px;margin-bottom:5px">
            <div class="ctrl-unit flex-col items-center" data-param="vcf_cutoff" style="width:18%"><span class="label text-xs">Cutoff</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="vcf_resonance" style="width:18%"><span class="label text-xs">Res</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="vcf_env_depth" style="width:18%"><span class="label text-xs">Env Dep</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="vcf_env_vel" style="width:18%"><span class="label text-xs">Env Vel</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="vcf_lfo_depth" style="width:18%"><span class="label text-xs">LFO Dep</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
        </div>
        <div class="panel-row" style="margin-top:5px;margin-bottom:5px">
            <div class="ctrl-unit flex-col items-center" data-param="vcf_key_tracking" style="width:22%"><span class="label text-xs">Keyb</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="vcf_pitch_bend" style="width:22%"><span class="label text-xs">P.Bend</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="vcf_aftertouch_lfo" style="width:22%"><span class="label text-xs">Aft-LFO</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="vcf_modwheel_lfo" style="width:22%"><span class="label text-xs">MW-LFO</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
        </div>
    `,
    OSC1: () => `
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
    `,
    OSC2: () => `
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
    `,
    POLY: () => `
        <div class="panel-section-title">Polyphony / Voice Mode</div>
        <div class="w-full" style="margin-bottom:12px">
            <select id="panel-poly-mode-select" data-param="voice_mode" class="modal-select w-full" style="font-size:9.5px;padding:5px">
                <option value="0">Poly</option>
                <option value="1">Unison 2</option>
                <option value="2">Unison 3</option>
                <option value="3">Unison 4</option>
                <option value="4">Unison 6</option>
                <option value="5">Unison 12</option>
                <option value="6">Mono</option>
                <option value="7">Mono 2</option>
                <option value="8">Mono 3</option>
                <option value="9">Mono 4</option>
                <option value="10">Mono 6</option>
                <option value="11">Poly 6</option>
                <option value="12">Poly 8</option>
            </select>
        </div>

        <div class="panel-section-title">Note Priority</div>
        <div class="shape-selector-container" style="margin-bottom:12px">
            <div class="shape-led-row priority-led-row" data-val="0" data-param="note_priority"><div class="led-dot"></div><span class="shape-name text-xs">Lowest</span></div>
            <div class="shape-led-row priority-led-row" data-val="1" data-param="note_priority"><div class="led-dot"></div><span class="shape-name text-xs">Highest</span></div>
            <div class="shape-led-row priority-led-row" data-val="2" data-param="note_priority"><div class="led-dot"></div><span class="shape-name text-xs">Last</span></div>
        </div>

        <div class="panel-section-title">Envelope Trigger Mode</div>
        <div class="shape-selector-container" style="margin-bottom:12px">
            <div class="shape-led-row trigger-led-row" data-val="0" data-param="trigger_mode"><div class="led-dot"></div><span class="shape-name text-xs">Mono</span></div>
            <div class="shape-led-row trigger-led-row" data-val="1" data-param="trigger_mode"><div class="led-dot"></div><span class="shape-name text-xs">Retrig</span></div>
            <div class="shape-led-row trigger-led-row" data-val="2" data-param="trigger_mode"><div class="led-dot"></div><span class="shape-name text-xs">Legato</span></div>
            <div class="shape-led-row trigger-led-row" data-val="3" data-param="trigger_mode"><div class="led-dot"></div><span class="shape-name text-xs">One-Shot</span></div>
        </div>

        <div class="panel-section-title">Unison & Drift Faders</div>
        <div class="panel-row" style="margin-top:5px;margin-bottom:5px">
            <div class="ctrl-unit flex-col items-center" data-param="unison_detune" style="width:22%"><span class="label text-xs" style="margin-bottom:4px">Detune</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="voice_drift" style="width:22%"><span class="label text-xs" style="margin-bottom:4px">Drift</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="param_drift" style="width:22%"><span class="label text-xs" style="margin-bottom:4px">Par Drft</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="drift_rate" style="width:22%"><span class="label text-xs" style="margin-bottom:4px">Drft Rate</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
        </div>
    `,
    PORTA: () => `
        <div class="panel-section-title">Portamento Mode</div>
        <div class="w-full" style="margin-bottom:8px">
            <span class="label text-xs text-dim" style="display:block;margin-bottom:2px">PORTA MODE</span>
            <div class="shape-selector-container" style="display:grid;grid-template-columns:repeat(2,1fr);gap:2px">
                <div class="shape-led-row porta-mode-led-row" data-val="0"><div class="led-dot"></div><span class="shape-name" style="font-size:8px">Normal</span></div>
                <div class="shape-led-row porta-mode-led-row" data-val="1"><div class="led-dot"></div><span class="shape-name" style="font-size:8px">Fingered</span></div>
                <div class="shape-led-row porta-mode-led-row" data-val="2"><div class="led-dot"></div><span class="shape-name" style="font-size:8px">Fix-Rate</span></div>
                <div class="shape-led-row porta-mode-led-row" data-val="3"><div class="led-dot"></div><span class="shape-name" style="font-size:8px">Fix-Fing</span></div>
                <div class="shape-led-row porta-mode-led-row" data-val="4"><div class="led-dot"></div><span class="shape-name" style="font-size:8px">Exp</span></div>
                <div class="shape-led-row porta-mode-led-row" data-val="5"><div class="led-dot"></div><span class="shape-name" style="font-size:8px">Exp-Fing</span></div>
                <div class="shape-led-row porta-mode-led-row" data-val="6"><div class="led-dot"></div><span class="shape-name" style="font-size:8px">Fixed+2</span></div>
                <div class="shape-led-row porta-mode-led-row" data-val="7"><div class="led-dot"></div><span class="shape-name" style="font-size:8px">Fixed-2</span></div>
                <div class="shape-led-row porta-mode-led-row" data-val="8"><div class="led-dot"></div><span class="shape-name" style="font-size:8px">Fixed+5</span></div>
                <div class="shape-led-row porta-mode-led-row" data-val="9"><div class="led-dot"></div><span class="shape-name" style="font-size:8px">Fixed-5</span></div>
            </div>
        </div>
        <div class="panel-section-title">Note Priority</div>
        <div class="shape-selector-container" style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-bottom:8px">
            <div class="shape-led-row note-priority-led-row" data-val="0" data-param="note_priority"><div class="led-dot"></div><span class="shape-name" style="font-size:9px">Lowest</span></div>
            <div class="shape-led-row note-priority-led-row" data-val="1" data-param="note_priority"><div class="led-dot"></div><span class="shape-name" style="font-size:9px">Highest</span></div>
            <div class="shape-led-row note-priority-led-row" data-val="2" data-param="note_priority"><div class="led-dot"></div><span class="shape-name" style="font-size:9px">Last</span></div>
        </div>
        <div class="panel-section-title">Trigger Mode</div>
        <div class="shape-selector-container" style="display:grid;grid-template-columns:repeat(2,1fr);gap:2px;margin-bottom:8px">
            <div class="shape-led-row trigger-mode-led-row" data-val="0" data-param="trigger_mode"><div class="led-dot"></div><span class="shape-name" style="font-size:9px">Mono</span></div>
            <div class="shape-led-row trigger-mode-led-row" data-val="1" data-param="trigger_mode"><div class="led-dot"></div><span class="shape-name" style="font-size:9px">Retrig</span></div>
            <div class="shape-led-row trigger-mode-led-row" data-val="2" data-param="trigger_mode"><div class="led-dot"></div><span class="shape-name" style="font-size:9px">Legato</span></div>
            <div class="shape-led-row trigger-mode-led-row" data-val="3" data-param="trigger_mode"><div class="led-dot"></div><span class="shape-name" style="font-size:9px">One-Shot</span></div>
        </div>
        <div class="panel-section-title">Portamento / Tune Sliders</div>
        <div class="panel-row" style="margin-top:5px;margin-bottom:5px;justify-content:space-around">
            <div class="ctrl-unit flex-col items-center" data-param="global_portamento" style="width:22%"><span class="label text-xs">Porta Time</span><div class="v-slider" style="height:70px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="global_tune" style="width:22%"><span class="label text-xs">Tune</span><div class="v-slider" style="height:70px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="transpose" style="width:22%"><span class="label text-xs">Transp</span><div class="v-slider" style="height:70px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="porta_osc_bal" style="width:22%"><span class="label text-xs">Osc Bal</span><div class="v-slider" style="height:70px"><div class="track"></div><div class="handle"></div></div></div>
        </div>
        <div class="panel-section-title">Pitch Bend Range</div>
        <div class="panel-row" style="margin-top:5px;margin-bottom:5px;justify-content:space-around">
            <div class="ctrl-unit flex-col items-center" data-param="pitch_bend_up" style="width:45%"><span class="label text-xs">Bend Up</span><div class="v-slider" style="height:70px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="pitch_bend_down" style="width:45%"><span class="label text-xs">Bend Down</span><div class="v-slider" style="height:70px"><div class="track"></div><div class="handle"></div></div></div>
        </div>
    `,
    CHORD: () => `
        <div class="panel-section-title">Chord Memory Status</div>
        <div class="flex-row justify-center w-full" style="margin-bottom:12px">
            <div class="toggle-box" id="panel-chord-enable-box" data-param="chord_enable" style="width:80%" data-ctrl-tooltip="Chord Memory — one-touch chord playback"><span class="toggle-label">Chord Memory</span><div class="toggle-led"></div></div>
        </div>
        <div class="panel-section-title">Root Key</div>
        <div class="shape-selector-container" style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:8px">
            <div class="shape-led-row chord-key-led-row" data-val="0"><div class="led-dot"></div><span class="shape-name">C</span></div>
            <div class="shape-led-row chord-key-led-row" data-val="1"><div class="led-dot"></div><span class="shape-name">C#</span></div>
            <div class="shape-led-row chord-key-led-row" data-val="2"><div class="led-dot"></div><span class="shape-name">D</span></div>
            <div class="shape-led-row chord-key-led-row" data-val="3"><div class="led-dot"></div><span class="shape-name">D#</span></div>
            <div class="shape-led-row chord-key-led-row" data-val="4"><div class="led-dot"></div><span class="shape-name">E</span></div>
            <div class="shape-led-row chord-key-led-row" data-val="5"><div class="led-dot"></div><span class="shape-name">F</span></div>
            <div class="shape-led-row chord-key-led-row" data-val="6"><div class="led-dot"></div><span class="shape-name">F#</span></div>
            <div class="shape-led-row chord-key-led-row" data-val="7"><div class="led-dot"></div><span class="shape-name">G</span></div>
            <div class="shape-led-row chord-key-led-row" data-val="8"><div class="led-dot"></div><span class="shape-name">G#</span></div>
            <div class="shape-led-row chord-key-led-row" data-val="9"><div class="led-dot"></div><span class="shape-name">A</span></div>
            <div class="shape-led-row chord-key-led-row" data-val="10"><div class="led-dot"></div><span class="shape-name">A#</span></div>
            <div class="shape-led-row chord-key-led-row" data-val="11"><div class="led-dot"></div><span class="shape-name">B</span></div>
        </div>
        <div class="panel-section-title">Chord Type</div>
        <div class="shape-selector-container" style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;margin-bottom:8px">
            <div class="shape-led-row chord-type-led-row" data-val="0"><div class="led-dot"></div><span class="shape-name" style="font-size:9px">Memory</span></div>
            <div class="shape-led-row chord-type-led-row" data-val="1"><div class="led-dot"></div><span class="shape-name" style="font-size:9px">Major</span></div>
            <div class="shape-led-row chord-type-led-row" data-val="2"><div class="led-dot"></div><span class="shape-name" style="font-size:9px">Minor</span></div>
            <div class="shape-led-row chord-type-led-row" data-val="3"><div class="led-dot"></div><span class="shape-name" style="font-size:9px">Major 7th</span></div>
            <div class="shape-led-row chord-type-led-row" data-val="4"><div class="led-dot"></div><span class="shape-name" style="font-size:9px">Minor 7th</span></div>
            <div class="shape-led-row chord-type-led-row" data-val="5"><div class="led-dot"></div><span class="shape-name" style="font-size:9px">Dom 7th</span></div>
            <div class="shape-led-row chord-type-led-row" data-val="6"><div class="led-dot"></div><span class="shape-name" style="font-size:9px">Susp 4th</span></div>
            <div class="shape-led-row chord-type-led-row" data-val="7"><div class="led-dot"></div><span class="shape-name" style="font-size:9px">Power Chd</span></div>
            <div class="shape-led-row chord-type-led-row" data-val="8"><div class="led-dot"></div><span class="shape-name" style="font-size:9px">Aug</span></div>
            <div class="shape-led-row chord-type-led-row" data-val="9"><div class="led-dot"></div><span class="shape-name" style="font-size:9px">Dim</span></div>
            <div class="shape-led-row chord-type-led-row" data-val="10"><div class="led-dot"></div><span class="shape-name" style="font-size:9px">Sus2</span></div>
            <div class="shape-led-row chord-type-led-row" data-val="11"><div class="led-dot"></div><span class="shape-name" style="font-size:9px">7th</span></div>
        </div>
        <div class="panel-section-title" style="margin-top:10px">Hardware Connection</div>
        <div class="flex-row gap-8 w-full" style="margin-bottom:8px">
            <button id="panel-chord-load-btn" class="modal-btn" style="flex:1;font-size:9px;padding:5px;background:var(--bg-hover);border-color:var(--border-dim)" data-ctrl-tooltip="Load Chord Memory from hardware DeepMind 12">Load from HW</button>
            <button id="panel-chord-send-btn" class="modal-btn" style="flex:1;font-size:9px;padding:5px;background:var(--bg-hover);border-color:var(--border-dim)" data-ctrl-tooltip="Send Chord Memory to hardware DeepMind 12">Send to HW</button>
        </div>
    `,
    POLY_CHORD: () => `
        <div class="panel-section-title">Poly Chord Status</div>
        <div class="flex-row justify-center w-full" style="margin-bottom:12px">
            <div class="toggle-box" id="panel-poly-chord-enable-box" data-param="poly_chord_enable" style="width:80%" data-ctrl-tooltip="Poly Chord — polyphonic chord memory"><span class="toggle-label">Poly Chord</span><div class="toggle-led"></div></div>
        </div>
        <div class="w-full" style="margin-bottom:4px">
            <span class="label text-xs text-dim" style="display:block;margin-bottom:4px">SELECT KEY TO ASSIGN:</span>
            <div class="shape-selector-container" style="display:grid;grid-template-columns:repeat(6,1fr);gap:3px;margin-bottom:6px">
                <div class="shape-led-row poly-key-select-row" data-keyidx="0" style="padding:3px 2px"><span class="shape-name" style="font-size:9px">C</span></div>
                <div class="shape-led-row poly-key-select-row" data-keyidx="1" style="padding:3px 2px"><span class="shape-name" style="font-size:9px">C#</span></div>
                <div class="shape-led-row poly-key-select-row" data-keyidx="2" style="padding:3px 2px"><span class="shape-name" style="font-size:9px">D</span></div>
                <div class="shape-led-row poly-key-select-row" data-keyidx="3" style="padding:3px 2px"><span class="shape-name" style="font-size:9px">D#</span></div>
                <div class="shape-led-row poly-key-select-row" data-keyidx="4" style="padding:3px 2px"><span class="shape-name" style="font-size:9px">E</span></div>
                <div class="shape-led-row poly-key-select-row" data-keyidx="5" style="padding:3px 2px"><span class="shape-name" style="font-size:9px">F</span></div>
                <div class="shape-led-row poly-key-select-row" data-keyidx="6" style="padding:3px 2px"><span class="shape-name" style="font-size:9px">F#</span></div>
                <div class="shape-led-row poly-key-select-row" data-keyidx="7" style="padding:3px 2px"><span class="shape-name" style="font-size:9px">G</span></div>
                <div class="shape-led-row poly-key-select-row" data-keyidx="8" style="padding:3px 2px"><span class="shape-name" style="font-size:9px">G#</span></div>
                <div class="shape-led-row poly-key-select-row" data-keyidx="9" style="padding:3px 2px"><span class="shape-name" style="font-size:9px">A</span></div>
                <div class="shape-led-row poly-key-select-row" data-keyidx="10" style="padding:3px 2px"><span class="shape-name" style="font-size:9px">A#</span></div>
                <div class="shape-led-row poly-key-select-row" data-keyidx="11" style="padding:3px 2px"><span class="shape-name" style="font-size:9px">B</span></div>
            </div>
        </div>
        <div class="w-full" style="background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius-sm);padding:8px;margin-bottom:8px">
            <span class="label text-xs" style="display:block;margin-bottom:4px;color:var(--accent-blue)">ASSIGNED CHORD FOR KEY: <span id="poly-selected-key-label">C</span></span>
            <div style="margin-bottom:4px">
                <span class="label text-xs text-dim" style="display:block;margin-bottom:2px">ROOT KEY</span>
                <div class="shape-selector-container" id="poly-assign-root-keys" style="display:grid;grid-template-columns:repeat(6,1fr);gap:2px">
                    <div class="shape-led-row poly-root-row" data-val="0" style="padding:2px 0;font-size:8px">C</div>
                    <div class="shape-led-row poly-root-row" data-val="1" style="padding:2px 0;font-size:8px">C#</div>
                    <div class="shape-led-row poly-root-row" data-val="2" style="padding:2px 0;font-size:8px">D</div>
                    <div class="shape-led-row poly-root-row" data-val="3" style="padding:2px 0;font-size:8px">D#</div>
                    <div class="shape-led-row poly-root-row" data-val="4" style="padding:2px 0;font-size:8px">E</div>
                    <div class="shape-led-row poly-root-row" data-val="5" style="padding:2px 0;font-size:8px">F</div>
                    <div class="shape-led-row poly-root-row" data-val="6" style="padding:2px 0;font-size:8px">F#</div>
                    <div class="shape-led-row poly-root-row" data-val="7" style="padding:2px 0;font-size:8px">G</div>
                    <div class="shape-led-row poly-root-row" data-val="8" style="padding:2px 0;font-size:8px">G#</div>
                    <div class="shape-led-row poly-root-row" data-val="9" style="padding:2px 0;font-size:8px">A</div>
                    <div class="shape-led-row poly-root-row" data-val="10" style="padding:2px 0;font-size:8px">A#</div>
                    <div class="shape-led-row poly-root-row" data-val="11" style="padding:2px 0;font-size:8px">B</div>
                </div>
            </div>
            <div>
                <span class="label text-xs text-dim" style="display:block;margin-bottom:2px">CHORD TYPE</span>
                <div class="shape-selector-container" id="poly-assign-chord-types" style="display:grid;grid-template-columns:repeat(4,1fr);gap:2px">
                    <div class="shape-led-row poly-type-row" data-val="0" style="padding:2px 0;font-size:8px">Memory</div>
                    <div class="shape-led-row poly-type-row" data-val="1" style="padding:2px 0;font-size:8px">Major</div>
                    <div class="shape-led-row poly-type-row" data-val="2" style="padding:2px 0;font-size:8px">Minor</div>
                    <div class="shape-led-row poly-type-row" data-val="3" style="padding:2px 0;font-size:8px">Maj7</div>
                    <div class="shape-led-row poly-type-row" data-val="4" style="padding:2px 0;font-size:8px">Min7</div>
                    <div class="shape-led-row poly-type-row" data-val="5" style="padding:2px 0;font-size:8px">Dom7</div>
                    <div class="shape-led-row poly-type-row" data-val="6" style="padding:2px 0;font-size:8px">Sus4</div>
                    <div class="shape-led-row poly-type-row" data-val="7" style="padding:2px 0;font-size:8px">Pwr</div>
                    <div class="shape-led-row poly-type-row" data-val="8" style="padding:2px 0;font-size:8px">Aug</div>
                    <div class="shape-led-row poly-type-row" data-val="9" style="padding:2px 0;font-size:8px">Dim</div>
                    <div class="shape-led-row poly-type-row" data-val="10" style="padding:2px 0;font-size:8px">Sus2</div>
                    <div class="shape-led-row poly-type-row" data-val="11" style="padding:2px 0;font-size:8px">7th</div>
                </div>
            </div>
        </div>
        <div class="panel-section-title">Summary (all keys)</div>
        <div id="poly-chord-summary" style="display:grid;grid-template-columns:repeat(4,1fr);gap:2px;margin-bottom:8px">
            <div style="font-size:7px;color:var(--text-dim);padding:2px">C: Major</div>
            <div style="font-size:7px;color:var(--text-dim);padding:2px">C#: Minor</div>
            <div style="font-size:7px;color:var(--text-dim);padding:2px">D: Major</div>
            <div style="font-size:7px;color:var(--text-dim);padding:2px">D#: Minor</div>
            <div style="font-size:7px;color:var(--text-dim);padding:2px">E: Major</div>
            <div style="font-size:7px;color:var(--text-dim);padding:2px">F: Minor</div>
            <div style="font-size:7px;color:var(--text-dim);padding:2px">F#: Major</div>
            <div style="font-size:7px;color:var(--text-dim);padding:2px">G: Minor</div>
            <div style="font-size:7px;color:var(--text-dim);padding:2px">G#: Major</div>
            <div style="font-size:7px;color:var(--text-dim);padding:2px">A: Minor</div>
            <div style="font-size:7px;color:var(--text-dim);padding:2px">A#: Major</div>
            <div style="font-size:7px;color:var(--text-dim);padding:2px">B: Minor</div>
        </div>
        <div class="panel-section-title" style="margin-top:4px">Presets & Hardware</div>
        <div class="flex-row gap-6 w-full" style="margin-bottom:8px;flex-wrap:wrap">
            <button id="panel-polychord-defaults-btn" class="modal-btn" style="flex:1;font-size:9px;padding:4px;background:var(--bg-hover);border-color:var(--border-dim)" data-ctrl-tooltip="Reset all keys to default Major/Minor pattern">Reset Defaults</button>
            <button id="panel-polychord-load-btn" class="modal-btn" style="flex:1;font-size:9px;padding:4px;background:var(--bg-hover);border-color:var(--border-dim)" data-ctrl-tooltip="Load Poly Chord from hardware DeepMind 12">Load HW</button>
            <button id="panel-polychord-send-btn" class="modal-btn" style="flex:1;font-size:9px;padding:4px;background:var(--bg-hover);border-color:var(--border-dim)" data-ctrl-tooltip="Send Poly Chord to hardware DeepMind 12">Send HW</button>
        </div>
    `,
    ARP: () => `
        <div class="panel-section-title">Arpeggiator Status</div>
        <div class="flex-row" style="justify-content:space-between;margin-bottom:12px;gap:6px;flex-wrap:wrap">
            <div id="panel-arp-enable-box" class="led-btn" style="flex:1;min-width:50px">Arp On</div>
            <div id="panel-arp-hold-box" class="led-btn" style="flex:1;min-width:50px">Hold</div>
            <div id="panel-arp-keysync-box" class="led-btn" style="flex:1;min-width:50px">Key Sync</div>
        </div>
        <div class="panel-section-title">Arp Routing & Clock</div>
        <div class="w-full" style="margin-bottom:8px">
            <span class="label text-xs text-dim" style="display:block;margin-bottom:2px">CLOCK RATE / DIVIDER</span>
            <select id="panel-arp-clock-select" class="modal-select w-full" style="font-size:9px;padding:3px">
                <option value="0">1/1</option><option value="1">1/2</option><option value="2">1/3</option><option value="3">1/4</option><option value="4">1/6</option><option value="5">1/8</option><option value="6">1/12</option><option value="7">1/16</option><option value="8">1/24</option><option value="9">1/32</option><option value="10">1/48</option><option value="11">1/64</option><option value="12">1/96</option>
            </select>
        </div>
        <div class="w-full" style="margin-bottom:8px">
            <span class="label text-xs text-dim" style="display:block;margin-bottom:2px">VELOCITY GATE</span>
            <select id="panel-arp-velgate-select" class="modal-select w-full" style="font-size:9px;padding:3px">
                <option value="0">Gate</option><option value="1">Velocity</option><option value="2">Seq</option>
            </select>
        </div>
        <div class="panel-section-title">Mode & Range</div>
        <div class="w-full" style="margin-bottom:8px">
            <span class="label text-xs text-dim" style="display:block;margin-bottom:2px">ARPEGGIATOR MODE</span>
            <select id="panel-arp-mode-select" class="modal-select w-full" style="font-size:9px;padding:3px">
                <option value="0">UP</option><option value="1">DOWN</option><option value="2">UP-DOWN</option><option value="3">UP-INV</option><option value="4">DOWN-INV</option><option value="5">UP-DN-INV</option><option value="6">UP-ALT</option><option value="7">DOWN-ALT</option><option value="8">RANDOM</option><option value="9">AS-PLAYED</option>
            </select>
        </div>
        <div class="w-full" style="margin-bottom:12px">
            <span class="label text-xs text-dim" style="display:block;margin-bottom:2px">OCTAVE RANGE</span>
            <select id="panel-arp-octave-select" class="modal-select w-full" style="font-size:9px;padding:3px">
                <option value="0">1</option><option value="1">2</option><option value="2">3</option><option value="3">4</option>
            </select>
        </div>
        <div class="panel-section-title">Arpeggiator Faders</div>
        <div class="panel-row" style="margin-top:5px;margin-bottom:5px;justify-content:space-around">
            <div class="ctrl-unit flex-col items-center" data-param="arp_swing" style="width:30%"><span class="label text-xs">Swing</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="arp_rate" style="width:30%"><span class="label text-xs">Rate</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="arp_gate_time" style="width:30%"><span class="label text-xs">Gate Time</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div>            </div>
        </div>
    `,
    SEQ: () => `
        <div class="panel-section-title">Sequencer Status</div>
        <div class="flex-row" style="justify-content:space-between;margin-bottom:10px;gap:6px;flex-wrap:wrap">
            <div id="panel-seq-enable-box" class="led-btn" style="flex:1;min-width:40px">Seq On</div>
            <button id="panel-seq-skip-btn" class="modal-btn" style="flex:1;font-size:8px;background:var(--bg-hover);border-color:var(--color-danger);min-width:40px;color:var(--color-danger)" data-ctrl-tooltip="Toggle last-edited step between SKIP (raw 0) and center">Set Skip</button>
            <button id="panel-seq-open-modal-btn" class="modal-btn" style="flex:1;font-size:8px;background:var(--bg-hover);border-color:var(--border-dim);min-width:40px">Full Editor</button>
        </div>
        <div class="panel-section-title">Clock &amp; Length</div>
        <div class="w-full" style="margin-bottom:6px;display:flex;gap:6px;flex-wrap:wrap">
            <div style="flex:1;min-width:60px">
                <span class="label text-xs text-dim" style="display:block;margin-bottom:2px">CLOCK</span>
                <select id="panel-seq-clock-select" class="modal-select w-full" style="font-size:8px;padding:3px">
                    <option value="0">1/2</option><option value="1">3/8</option><option value="2">1/3</option><option value="3">1/4</option><option value="4">3/16</option>
                    <option value="5">1/6</option><option value="6">1/8</option><option value="7">1/12</option><option value="8">1/16</option>
                    <option value="9">1/24</option><option value="10">1/32</option><option value="11">1/48</option><option value="12">1/64</option>
                    <option value="13">1/96</option><option value="14">1/128</option><option value="15">1/192</option>
                </select>
            </div>
            <div style="flex:1;min-width:60px">
                <span class="label text-xs text-dim" style="display:block;margin-bottom:2px">LENGTH</span>
                <select id="panel-seq-length-select" class="modal-select w-full" style="font-size:8px;padding:3px">
                    <option value="0">2</option><option value="1">3</option><option value="2">4</option><option value="3">5</option><option value="4">6</option><option value="5">7</option><option value="6">8</option>
                    <option value="7">9</option><option value="8">10</option><option value="9">11</option><option value="10">12</option><option value="11">13</option><option value="12">14</option><option value="13">15</option>
                    <option value="14">16</option><option value="15">17</option><option value="16">18</option><option value="17">19</option><option value="18">20</option><option value="19">21</option><option value="20">22</option>
                    <option value="21">23</option><option value="22">24</option><option value="23">25</option><option value="24">26</option><option value="25">27</option><option value="26">28</option><option value="27">29</option>
                    <option value="28">30</option><option value="29">31</option><option value="30">32</option>
                </select>
            </div>
            <div style="flex:1;min-width:60px">
                <span class="label text-xs text-dim" style="display:block;margin-bottom:2px">KEY LOOP</span>
                <select id="panel-seq-keyloop-select" class="modal-select w-full" style="font-size:8px;padding:3px">
                    <option value="0">Loop (free)</option><option value="1">Key Sync</option><option value="2">Key &amp; Loop</option>
                </select>
            </div>
        </div>
        <div class="panel-section-title">Step Values <span style="font-size:7px;color:var(--text-faint);font-weight:normal">(drag up/down)</span></div>
        <div id="panel-seq-steps-container" style="display:grid;grid-template-columns:repeat(16,1fr);gap:2px;margin-bottom:6px;padding:4px;background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius-sm);height:90px"></div>
        <div class="panel-section-title">Swing &amp; Slew</div>
        <div class="panel-row" style="margin-top:5px;margin-bottom:5px;justify-content:space-around">
            <div class="ctrl-unit flex-col items-center" data-param="seq_swing" style="width:45%"><span class="label text-xs">Swing</span><div class="v-slider" style="height:60px"><div class="track"></div><div class="handle"></div></div></div>
            <div class="ctrl-unit flex-col items-center" data-param="seq_slew_rate" style="width:45%"><span class="label text-xs">Slew Rate</span><div class="v-slider" style="height:60px"><div class="track"></div><div class="handle"></div></div></div>
        </div>
    `
};

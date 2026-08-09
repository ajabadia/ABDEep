/**
 * @purpose VCF panel HTML template for the details panel controls.
 * Extraído de panel_templates.js para modularización.
 * @classification Module/Panel/Templates
 */

window.PANEL_TEMPLATES = window.PANEL_TEMPLATES || {};

window.PANEL_TEMPLATES.VCF = () => `
        <div class="panel-section-title">VCF Model</div>
        <div class="shape-selector-container" style="margin-bottom:10px">
            <div class="shape-led-row vcf-model-led-row" data-val="0" data-param="vcf_model" data-ctrl-tooltip="DM12 OTA — authentic DeepMind 12 analog-modeled filter"><div class="led-dot"></div><span class="shape-name text-xs">DM12</span></div>
            <div class="shape-led-row vcf-model-led-row" data-val="1" data-param="vcf_model" data-ctrl-tooltip="Moog Ladder — classic transistor cascade, warm and creamy"><div class="led-dot"></div><span class="shape-name text-xs">Moog</span></div>
            <div class="shape-led-row vcf-model-led-row" data-val="2" data-param="vcf_model" data-ctrl-tooltip="Korg MS-20 — Sallen-Key topology, aggressive and resonant"><div class="led-dot"></div><span class="shape-name text-xs">Korg</span></div>
        </div>
        <div id="vcf-subpanel-moog" class="vcf-subpanel" style="display:none">
            <div class="panel-section-title">Moog Filter Type</div>
            <div class="shape-selector-container" style="margin-bottom:10px">
                <div class="shape-led-row vcf-moog-submode-led-row" data-val="0" data-param="vcf_moog_submode" data-ctrl-tooltip="Lowpass — classic Moog ladder, warm low-end roll-off"><div class="led-dot"></div><span class="shape-name text-xs">Lowpass</span></div>
                <div class="shape-led-row vcf-moog-submode-led-row" data-val="1" data-param="vcf_moog_submode" data-ctrl-tooltip="Bandpass — band emphasis via stage 2 − stage 4 tap"><div class="led-dot"></div><span class="shape-name text-xs">Bandpass</span></div>
                <div class="shape-led-row vcf-moog-submode-led-row" data-val="2" data-param="vcf_moog_submode" data-ctrl-tooltip="Highpass — subtractive HP from input − 4-pole LP"><div class="led-dot"></div><span class="shape-name text-xs">Highpass</span></div>
            </div>
        </div>
        <div id="vcf-subpanel-korg" class="vcf-subpanel" style="display:none">
            <div class="panel-section-title">Korg Filter Type</div>
            <div class="shape-selector-container" style="margin-bottom:10px">
                <div class="shape-led-row vcf-korg-submode-led-row" data-val="0" data-param="vcf_korg_submode" data-ctrl-tooltip="K35 Lowpass — aggressive Sallen-Key LP cascade"><div class="led-dot"></div><span class="shape-name text-xs">K35 Lowpass</span></div>
                <div class="shape-led-row vcf-korg-submode-led-row" data-val="1" data-param="vcf_korg_submode" data-ctrl-tooltip="K35 Highpass — cascaded HP stages with diode clipper feedback"><div class="led-dot"></div><span class="shape-name text-xs">K35 Highpass</span></div>
            </div>
        </div>
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
    `;

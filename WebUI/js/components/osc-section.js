/**
 * @component OscSection
 * @purpose Web Component para el módulo Oscillators del control-grid
 * @classification UI Component
 * @complexity Low
 */
(function() {
    const template = `
        <div class="module" id="osc-section" style="flex:3.5">
            <div class="module-header flex-row justify-between items-center">
                <span>Oscillators</span>
                <button class="btn btn-xs btn-outline edit-panel-btn" data-accent="orange" id="osc-edit-btn" data-ctrl-tooltip="Open Oscillator detail editor">Edit</button>
            </div>
            <div class="flex-row justify-center w-full" style="margin-bottom:5px">
                <button class="btn btn-outline" data-accent="orange" id="osc-select-btn" style="width:80%" data-ctrl-tooltip="Toggle between OSC 1 and OSC 2 controls">OSC 1 ACTIVE</button>
            </div>
            <div class="controls-row">
                <div class="ctrl-unit" id="osc-ctrl-pitchmod" data-param="osc1_pitch_mod"><span class="label" id="osc-label-pitchmod">Pitch Mod</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
                <div class="ctrl-unit" id="osc-ctrl-pwm-tone" data-param="osc1_pwm_amount"><span class="label" id="osc-label-pwm-tone">PWM</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
                <div class="ctrl-unit" id="osc-ctrl-pitch" data-param="osc2_pitch" style="display:none"><span class="label">Pitch</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
                <div class="ctrl-unit" id="osc-ctrl-level" data-param="osc2_level" style="display:none"><span class="label">Level</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
                <div class="ctrl-unit" data-param="noise_level"><span class="label">Noise</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
            </div>
        </div>
    `;

    class OscSection extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }
        }
    }
    customElements.define('osc-section', OscSection);
})();

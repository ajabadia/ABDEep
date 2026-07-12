/**
 * @component EnvSection
 * @purpose Web Component para el módulo Envelopes del control-grid
 * @classification UI Component
 * @complexity Low
 */
(function() {
    const template = `
        <div class="module" id="env-section" style="flex:3">
            <div class="module-header flex-row justify-between items-center">
                <span>Envelopes</span>
                <button class="btn btn-xs btn-outline edit-panel-btn" data-accent="orange" id="env-edit-btn" data-ctrl-tooltip="Open Envelope detail editor">Edit</button>
            </div>
            <div class="flex-row justify-center gap-4 w-full" style="margin-bottom:5px">
                <button class="env-type-btn active" id="env-btn-vca" data-env="1" style="flex:1" data-ctrl-tooltip="VCA Envelope — amplitude/volume envelope">VCA</button>
                <button class="env-type-btn" id="env-btn-vcf" data-env="2" style="flex:1" data-ctrl-tooltip="VCF Envelope — filter cutoff envelope">VCF</button>
                <button class="env-type-btn" id="env-btn-mod" data-env="3" style="flex:1" data-ctrl-tooltip="Mod Envelope — modulation routing envelope">MOD</button>
            </div>
            <div class="controls-row">
                <div class="ctrl-unit" id="env-ctrl-attack" data-param="env1_attack"><span class="label" id="env-label-attack">A</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
                <div class="ctrl-unit" id="env-ctrl-decay" data-param="env1_decay"><span class="label" id="env-label-decay">D</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
                <div class="ctrl-unit" id="env-ctrl-sustain" data-param="env1_sustain"><span class="label" id="env-label-sustain">S</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
                <div class="ctrl-unit" id="env-ctrl-release" data-param="env1_release"><span class="label" id="env-label-release">R</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
            </div>
        </div>
    `;

    class EnvSection extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }
        }
    }
    customElements.define('env-section', EnvSection);
})();

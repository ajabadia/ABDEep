/**
 * @component VcfSection
 * @purpose Web Component para el módulo VCF del control-grid
 * @classification UI Component
 * @complexity Low
 */
(function() {
    const template = `
        <div class="module" id="vcf-section" style="flex:3.5">
            <div class="module-header flex-row justify-between items-center">
                <span>VCF</span>
                <button class="btn btn-xs btn-outline edit-panel-btn" data-accent="orange" id="vcf-edit-btn" data-ctrl-tooltip="Open VCF filter detail editor">Edit</button>
            </div>
            <div class="controls-row">
                <div class="ctrl-unit" data-param="vcf_cutoff"><span class="label">Freq</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
                <div class="ctrl-unit" data-param="vcf_resonance"><span class="label">Res</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
                <div class="ctrl-unit" data-param="vcf_env_depth"><span class="label">Env</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
                <div class="ctrl-unit" data-param="vcf_lfo_depth"><span class="label">LFO</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
                <div class="ctrl-unit" data-param="vcf_key_tracking"><span class="label">KYBD</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
            </div>
        </div>
    `;

    class VcfSection extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }
        }
    }
    customElements.define('vcf-section', VcfSection);
})();

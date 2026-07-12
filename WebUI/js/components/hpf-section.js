/**
 * @component HpfSection
 * @purpose Web Component para el módulo HPF del control-grid
 * @classification UI Component
 * @complexity Low
 */
(function() {
    const template = `
        <div class="module" id="hpf-section" style="flex:1.1">
            <div class="module-header flex-row justify-between items-center">
                <span>HPF</span>
                <button class="btn btn-xs btn-outline edit-panel-btn" data-accent="orange" id="hpf-edit-btn" data-ctrl-tooltip="Open HPF detail editor">Edit</button>
            </div>
            <div class="flex-row justify-center w-full" style="margin-bottom:5px">
                <button class="btn btn-outline" id="hpf-boost-btn" data-param="hpf_boost_enable" style="width:90%" data-ctrl-tooltip="Toggle HPF Bass Boost — adds low-end presence">BOOST OFF</button>
            </div>
            <div class="controls-row justify-center">
                <div class="ctrl-unit" data-param="hpf_cutoff"><span class="label">Freq</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
            </div>
        </div>
    `;

    class HpfSection extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }
        }
    }
    customElements.define('hpf-section', HpfSection);
})();

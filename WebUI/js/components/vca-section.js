/**
 * @component VcaSection
 * @purpose Web Component para el módulo VCA del control-grid
 * @classification UI Component
 * @complexity Low
 */
(function() {
    const template = `
        <div class="module" id="vca-section" style="flex:1.5">
            <div class="module-header flex-row justify-between items-center">
                <span>VCA</span>
                <button class="btn btn-xs btn-outline edit-panel-btn" data-accent="orange" id="vca-edit-btn" data-ctrl-tooltip="Open VCA detail editor">Edit</button>
            </div>
            <div class="flex-row justify-center w-full" style="margin-bottom:5px">
                <button class="btn btn-outline" id="vca-mode-btn" data-param="vca_mode" style="width:90%" data-ctrl-tooltip="Toggle VCA between Transparent (clean) and Ballsy (saturated) mode">TRANSPARENT</button>
            </div>
            <div class="controls-row justify-center">
                <div class="ctrl-unit" data-param="vca_level"><span class="label">Level</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
            </div>
        </div>
    `;

    class VcaSection extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }
        }
    }
    customElements.define('vca-section', VcaSection);
})();

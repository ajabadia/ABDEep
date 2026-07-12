/**
 * @component PolySection
 * @purpose Web Component para el módulo Poly del control-grid
 * @classification UI Component
 * @complexity Low
 */
(function() {
    const template = `
        <div class="module" id="poly-section" style="flex:1.2">
            <div class="module-header flex-row justify-between items-center">
                <span>Poly</span>
                <button class="btn btn-xs btn-outline edit-panel-btn" data-accent="orange" id="poly-edit-btn" data-ctrl-tooltip="Open Polyphony / Unison detail editor">Edit</button>
            </div>
            <div class="controls-row">
                <div class="ctrl-unit" data-param="unison_detune"><span class="label">Detune</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
            </div>
        </div>
    `;

    class PolySection extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }
        }
    }
    customElements.define('poly-section', PolySection);
})();

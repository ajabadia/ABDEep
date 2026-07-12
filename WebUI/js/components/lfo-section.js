/**
 * @component LfoSection
 * @purpose Web Component para el módulo LFO 1 & 2 del control-grid
 * @classification UI Component
 * @complexity Low
 */
(function() {
    const template = `
        <div class="module" id="lfo-section" style="flex:1.8">
            <div class="module-header flex-row justify-between items-center">
                <span>LFO 1 &amp; 2</span>
                <button class="btn btn-xs btn-outline edit-panel-btn" data-accent="orange" id="lfo-edit-btn" data-ctrl-tooltip="Open LFO detail editor">Edit</button>
            </div>
            <div class="flex-row justify-center w-full" style="margin-bottom:5px">
                <button class="btn btn-outline" id="lfo-select-btn" style="width:80%" data-accent="orange" data-ctrl-tooltip="Toggle between LFO 1 and LFO 2">LFO 1 ACTIVE</button>
            </div>
            <div class="controls-row">
                <div class="ctrl-unit" id="lfo-ctrl-rate" data-param="lfo1_rate"><span class="label" id="lfo-label-rate">LFO1 Rate</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
                <div class="ctrl-unit" id="lfo-ctrl-delay" data-param="lfo1_delay"><span class="label" id="lfo-label-delay">Delay</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
            </div>
        </div>
    `;

    class LfoSection extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }
        }
    }
    customElements.define('lfo-section', LfoSection);
})();

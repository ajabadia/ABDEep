/**
 * @component ArpSeqSection
 * @purpose Web Component para el módulo Arp/Seq del control-grid
 * @classification UI Component
 * @complexity Low
 */
(function() {
    const template = `
        <div class="module" id="arp-section" style="flex:1.5">
            <div class="module-header">Arp / Seq</div>
            <div class="controls-row">
                <div class="ctrl-unit" data-param="arp_rate"><span class="label">Rate</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
                <div class="ctrl-unit" data-param="arp_gate_time"><span class="label">Gate</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
            </div>
        </div>
    `;

    class ArpSeqSection extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }
        }
    }
    customElements.define('arp-seq-section', ArpSeqSection);
})();

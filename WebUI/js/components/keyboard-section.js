/**
 * @component KeyboardSection
 * @purpose Web Component para el teclado inferior y ruedas del sintetizador
 * @classification UI Component
 * @complexity Low
 */
(function() {
    const template = `
        <div class="keyboard-container">
            <div class="performance-wheels">
                <div class="wheel-slot" id="wheel-pitch">
                    <div class="wheel"></div>
                </div>
                <div class="wheel-slot" id="wheel-mod">
                    <div class="wheel"></div>
                </div>
            </div>

            <div class="performance-matrix-panel">
                <div class="matrix-row row-top">
                    <div class="matrix-cell col-porta">
                        <div class="ctrl-unit" data-param="global_portamento">
                            <span class="label text-xs text-dim">Porta</span>
                            <div class="knob-ring">
                                <div class="knob-pointer"></div>
                            </div>
                        </div>
                    </div>
                    <div class="matrix-cell col-volume">
                        <div class="ctrl-unit" data-param="global_volume">
                            <span class="label text-xs text-dim">Volume</span>
                            <div class="knob-ring">
                                <div class="knob-pointer"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="matrix-row row-bottom">
                    <div class="matrix-cell col-porta-edit">
                        <button class="btn btn-xs btn-outline" id="porta-edit-btn" data-accent="blue" style="width:34px;height:26px;padding:0" data-ctrl-tooltip="Open Portamento / Glide settings">Edit</button>
                    </div>
                    <div class="matrix-cell col-oct-down">
                        <button class="btn btn-sm" id="oct-down-btn" data-accent="orange" style="width:34px;height:26px;padding:0;color:var(--accent-primary)" data-ctrl-tooltip="Transpose keyboard down one octave">OCT -</button>
                    </div>
                    <div class="matrix-cell col-oct-up">
                        <button class="btn btn-sm" id="oct-up-btn" data-accent="orange" style="width:34px;height:26px;padding:0;color:var(--accent-primary)" data-ctrl-tooltip="Transpose keyboard up one octave">OCT +</button>
                    </div>
                </div>
            </div>

            <div id="ivory-keys-bed"></div>
        </div>
    `;

    class KeyboardSection extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }
        }
    }
    customElements.define('keyboard-section', KeyboardSection);
})();

/**
 * @component mod-matrix-modal
 * @purpose Modulation Matrix modal
 * @classification UI Component
 */
(function() {
    const template = `
        <div class="modal-backdrop" id="modmatrix-modal-backdrop" style="display:none;z-index:5000">
            <div class="modal" data-accent="blue" style="width:760px">
                <div class="modal-header">
                    <h2>Modulation Matrix</h2>
                    <div class="close-btn" id="modmatrix-close-btn" data-ctrl-tooltip="Close Modulation Matrix modal">&times;</div>
                </div>
                <div class="modal-body" style="display:block;overflow-y:auto">
                    <div class="modmatrix-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:15px"></div>
                </div>
            </div>
        </div>
    `;

    class ModMatrixModal extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }
        }
    }
    customElements.define('mod-matrix-modal', ModMatrixModal);
})();

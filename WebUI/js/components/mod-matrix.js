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
                    <div class="modmatrix-view-toggle" style="display:flex;gap:4px;margin-bottom:8px">
                        <button class="modmatrix-toggle-btn active" data-view="list" style="flex:1;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius);padding:4px 8px;font-size:var(--text-xs);color:var(--text-secondary);cursor:pointer;font-family:'Share Tech Mono',monospace">List View</button>
                        <button class="modmatrix-toggle-btn" data-view="graph" style="flex:1;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius);padding:4px 8px;font-size:var(--text-xs);color:var(--text-secondary);cursor:pointer;font-family:'Share Tech Mono',monospace">Graph View</button>
                    </div>
                    <div class="modmatrix-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:15px"></div>
                    <canvas class="modmatrix-canvas" style="display:none;width:100%;height:320px;border:1px solid var(--border-dim);border-radius:var(--radius-sm);background:var(--bg-deepest)"></canvas>
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

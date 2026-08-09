/**
 * @component mod-matrix-modal
 * @purpose Modulation Matrix modal (supports 8 slots in Standard mode, 32 slots in AbyssMind Pro mode)
 * @classification UI Component
 */
(function() {
    const template = `
        <div class="modal-backdrop" id="modmatrix-modal-backdrop" style="display:none;z-index:5000">
            <div class="modal" data-accent="blue" style="width:820px">
                <div class="modal-header">
                    <h2>Modulation Matrix</h2>
                    <div class="close-btn" id="modmatrix-close-btn" data-ctrl-tooltip="Close Modulation Matrix modal">&times;</div>
                </div>
                <div class="modal-body" style="display:block;overflow-y:auto">
                    <div class="modmatrix-controls-row flex-row justify-between items-center" style="margin-bottom:8px;gap:8px;flex-wrap:wrap">
                        <div class="modmatrix-view-toggle" style="display:flex;gap:4px">
                            <button class="modmatrix-toggle-btn active" data-view="list" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius);padding:4px 8px;font-size:var(--text-xs);color:var(--text-secondary);cursor:pointer;font-family:'Share Tech Mono',monospace">List View</button>
                            <button class="modmatrix-toggle-btn" data-view="graph" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius);padding:4px 8px;font-size:var(--text-xs);color:var(--text-secondary);cursor:pointer;font-family:'Share Tech Mono',monospace">Graph View</button>
                        </div>
                        
                        <div class="modmatrix-block-tabs flex-row gap-4" id="mod-block-tabs" style="display:flex;gap:4px">
                            <button class="btn btn-xs mod-block-tab active" data-block="1" style="font-size:var(--text-2xs);padding:4px 10px;font-family:'Share Tech Mono',monospace;cursor:pointer">B1 (1–8)</button>
                            <button class="btn btn-xs mod-block-tab" data-block="2" style="font-size:var(--text-2xs);padding:4px 10px;font-family:'Share Tech Mono',monospace;cursor:pointer">B2 (9–16)</button>
                            <button class="btn btn-xs mod-block-tab" data-block="3" style="font-size:var(--text-2xs);padding:4px 10px;font-family:'Share Tech Mono',monospace;cursor:pointer">B3 (17–24)</button>
                            <button class="btn btn-xs mod-block-tab" data-block="4" style="font-size:var(--text-2xs);padding:4px 10px;font-family:'Share Tech Mono',monospace;cursor:pointer">B4 (25–32)</button>
                        </div>

                         <button class="btn btn-xs" id="mod-compact-btn" style="font-size:var(--text-2xs);padding:3px 8px;margin-left:auto" data-ctrl-tooltip="Clean and compact active modulations to the top">🧹 Compact</button>
                    </div>
 
                    <div id="mod-block-banner" style="font-size:var(--text-xs);font-family:'Share Tech Mono',monospace;color:var(--accent-blue,#00e5ff);margin-bottom:10px;padding:4px 10px;background:color-mix(in srgb,var(--accent-blue,#00e5ff) 12%,transparent);border:1px solid color-mix(in srgb,var(--accent-blue,#00e5ff) 35%,transparent);border-radius:var(--radius-xs);display:flex;justify-content:space-between;align-items:center">
                        <span>🔷 <strong>BLOCK 1</strong> (SLOTS 1 TO 8)</span>
                        <span style="color:var(--text-faint,#888);font-size:9px">ABYSSMIND PRO MATRIX</span>
                    </div>

                    <div class="modmatrix-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:15px"></div>
                    <canvas class="modmatrix-canvas" style="display:none;width:100%;height:320px;border:1px solid var(--border-dim);border-radius:var(--radius-sm);background:var(--bg-deepest)"></canvas>
                </div>
            </div>
        </div>
        <style>
            .mod-block-tab {
                background: var(--bg-elevated,#1e1e1e);
                border: 1px solid var(--border,#333);
                color: var(--text-dim,#888);
                border-radius: var(--radius-xs,4px);
                transition: all 0.15s ease;
            }
            .mod-block-tab:hover {
                border-color: var(--accent-blue,#00e5ff);
                color: var(--text-primary,#fff);
            }
            .mod-block-tab.active {
                background: var(--accent-blue,#00e5ff) !important;
                border-color: var(--accent-blue,#00e5ff) !important;
                color: #000000 !important;
                font-weight: bold !important;
                box-shadow: 0 0 10px color-mix(in srgb, var(--accent-blue,#00e5ff) 60%, transparent) !important;
            }
        </style>
    `;

    class ModMatrixModal extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }
        }
    }
    if (!customElements.get('mod-matrix-modal')) {
        customElements.define('mod-matrix-modal', ModMatrixModal);
    }
})();

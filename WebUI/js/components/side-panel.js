/**
 * @component side-panel
 * @purpose Side Edit Panel (LFO/OSC detail editor)
 * @classification UI Component
 */
(function() {
    const template = `
        <div class="slide-edit-panel" id="detail-edit-panel">
            <div class="panel-header">
                <h3 id="panel-title">LFO Detail Editor</h3>
                <div class="close-btn" id="panel-close-btn" data-ctrl-tooltip="Close side editor panel">&times;</div>
            </div>
            <div id="panel-graphic-screen" class="flex-row items-center justify-center" style="height:100px;overflow:hidden;background:var(--bg-deepest);border-bottom:1.5px solid var(--border);transition:height 0.3s cubic-bezier(0.4,0,0.2,1),border-bottom-width 0.3s">
                <canvas id="panel-graphic-canvas" width="280" height="90" style="display:block;background:var(--bg-deepest)"></canvas>
            </div>
            <button id="panel-graphic-toggle" class="btn btn-xs btn-ghost text-center w-full" data-ctrl-tooltip="Collapse/Expand graphic screen" style="background:var(--bg-surface);border-bottom:1px solid var(--border-dim);border-radius:0;color:color-mix(in srgb,var(--accent-primary) 50%,transparent);letter-spacing:1px;line-height:1">&#9650; COLLAPSE &#9650;</button>
            <div class="panel-content" id="panel-dynamic-controls"></div>
        </div>
    `;

    class SidePanel extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }
        }
    }
    customElements.define('side-panel', SidePanel);
})();

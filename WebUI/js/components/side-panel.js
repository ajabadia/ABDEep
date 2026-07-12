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
            <!-- Second collapsible screen: Real DSP oscilloscope -->
            <div id="panel-real-scope-screen" class="flex-col" style="height:0;overflow:hidden;background:var(--bg-deepest);border-bottom:0px solid var(--border-dim);transition:height 0.3s cubic-bezier(0.4,0,0.2,1),border-bottom-width 0.3s">
                <canvas id="panel-real-scope-canvas" width="280" height="85" style="display:block;background:var(--bg-deepest);flex-shrink:0"></canvas>
                <div class="scope-toolbar" id="scope-toolbar" style="display:none;align-items:center;justify-content:space-between;padding:2px 6px;gap:4px;flex-shrink:0;width:100%;box-sizing:border-box;border-top:1px solid var(--border-dim);background:var(--bg-header);min-height:22px;">
                    <button id="scope-trigger-btn" class="scope-btn" data-ctrl-tooltip="Trigger mode: Free">FR</button>
                    <div class="scope-zoom-group" style="display:flex;gap:2px;">
                        <button class="scope-zoom-btn scope-btn active" data-zoom="1" data-ctrl-tooltip="1x zoom">1x</button>
                        <button class="scope-zoom-btn scope-btn" data-zoom="2" data-ctrl-tooltip="2x zoom">2x</button>
                        <button class="scope-zoom-btn scope-btn" data-zoom="4" data-ctrl-tooltip="4x zoom">4x</button>
                    </div>
                    <span id="scope-seq-status" style="flex:1;text-align:center;font-size:7px;font-family:monospace;color:var(--text-faint);letter-spacing:0.3px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;min-width:0"></span>
                    <button id="scope-color-btn" class="scope-btn" data-ctrl-tooltip="Color scheme: Brand"><span class="scope-color-indicator" id="scope-color-indicator">●</span></button>
                </div>
            </div>
            <button id="panel-real-scope-toggle" class="btn btn-xs btn-ghost text-center w-full" data-ctrl-tooltip="Toggle real DSP oscilloscope" style="background:var(--bg-surface);border-bottom:1px solid var(--border-dim);border-radius:0;color:color-mix(in srgb,var(--accent-pink) 50%,transparent);letter-spacing:1px;line-height:1">🔴 DSP SCOPE (off)</button>
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

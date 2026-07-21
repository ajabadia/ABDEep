/**
 * @component seq-modal
 * @purpose Control Sequencer & Steps Editor modal
 * @classification UI Component
 */
(function() {
    const template = `
        <div class="modal-backdrop" id="seq-modal-backdrop" style="display:none;z-index:5000">
            <div class="modal" data-accent="pink" style="width:820px">
                <div class="modal-header">
                    <h2>Control Sequencer & Steps Editor <span id="modal-seq-mode-badge" style="font-size:var(--text-sm);font-weight:normal;margin-left:8px;vertical-align:middle"></span></h2>
                    <div class="close-btn" id="seq-modal-close-btn" data-ctrl-tooltip="Close Sequencer modal">&times;</div>
                </div>
                
                <div class="modal-body" style="overflow-y:auto">
                    <div class="flex-col" style="background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius);padding:10px;gap:5px">
                        <div style="display:flex;justify-content:space-between;align-items:center">
                            <span class="label text-uppercase text-bold" style="font-size:var(--text-xs);color:var(--text-dim)">Pattern Steps Bipolar Values (-128 to 127)</span>
                            <div class="seq-view-toggle" style="display:flex;gap:3px">
                                <button class="seq-toggle-btn active" data-view="dom" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-xs);padding:2px 6px;font-size:var(--text-2xs);color:var(--text-secondary);cursor:pointer;font-family:'Share Tech Mono',monospace">DOM</button>
                                <button class="seq-toggle-btn" data-view="canvas" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-xs);padding:2px 6px;font-size:var(--text-2xs);color:var(--text-secondary);cursor:pointer;font-family:'Share Tech Mono',monospace">Canvas</button>
                            </div>
                        </div>
                        <div class="seq-steps-grid" style="display:grid;grid-template-columns:repeat(32,1fr);gap:4px;height:110px;background:var(--bg-deepest);border:1px solid var(--bg-elevated);padding:5px;border-radius:var(--radius-sm);position:relative;align-items:flex-end"></div>
                        <div class="seq-steps-labels" style="display:grid;grid-template-columns:repeat(32,1fr);gap:4px;text-align:center;font-size:var(--text-2xs);color:var(--text-faint)"></div>
                        <canvas class="seq-steps-canvas" style="display:none;width:100%;height:120px;border:1px solid var(--bg-elevated);border-radius:var(--radius-sm);background:var(--bg-deepest)"></canvas>
                    </div>

                    <div style="display:grid;grid-template-columns:1.5fr 2fr 2.5fr;gap:15px">
                        <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius);padding:10px;gap:10px">
                            <div id="modal-seq-enable-box" class="led-btn" style="width:100%" data-ctrl-tooltip="Sequencer On/Off">ON / OFF</div>
                            <div class="flex-col gap-6">
                                <div class="flex-row justify-between items-center">
                                    <span class="label text-sm text-dim">Clock</span>
                                    <select id="modal-seq-clock-select" class="modal-select" style="width:60%"><option value="0">1/2</option><option value="1">3/8</option><option value="2">1/3</option><option value="3">1/4</option><option value="4">3/16</option><option value="5">1/6</option><option value="6">1/8</option><option value="7">1/12</option><option value="8">1/16</option><option value="9">1/24</option><option value="10">1/32</option><option value="11">1/48</option><option value="12">1/64</option><option value="13">1/96</option><option value="14">1/128</option><option value="15">1/192</option></select>
                                </div>
                                <div class="flex-row justify-between items-center">
                                    <span class="label text-sm text-dim">Length</span>
                                    <select id="modal-seq-length-select" class="modal-select" style="width:60%"><option value="0">2</option><option value="1">3</option><option value="2">4</option><option value="3">5</option><option value="4">6</option><option value="5">7</option><option value="6">8</option><option value="7">9</option><option value="8">10</option><option value="9">11</option><option value="10">12</option><option value="11">13</option><option value="12">14</option><option value="13">15</option><option value="14">16</option><option value="15">17</option><option value="16">18</option><option value="17">19</option><option value="18">20</option><option value="19">21</option><option value="20">22</option><option value="21">23</option><option value="22">24</option><option value="23">25</option><option value="24">26</option><option value="25">27</option><option value="26">28</option><option value="27">29</option><option value="28">30</option><option value="29">31</option><option value="30">32</option></select>
                                </div>
                                <div class="flex-row justify-between items-center">
                                    <span class="label text-sm text-dim">Key Loop</span>
                                    <select id="modal-seq-keyloop-select" class="modal-select" style="width:60%"><option value="0">Loop On</option><option value="1">Key Sync On</option><option value="2">Key & Loop On</option></select>
                                </div>
                            </div>
                            <button id="modal-seq-open-panel-btn" class="btn btn-sm btn-outline" style="width:100%;margin-top:4px" data-accent="pink" data-ctrl-tooltip="Open the left side edit panel for detailed sequencer editing">&#9654; Open in Panel</button>
                        </div>

                        <div class="flex-row bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius);padding:10px;justify-content:space-around;align-items:center">
                            <div class="ctrl-unit flex-col items-center" data-param="seq_swing" style="width:45%"><span class="label text-sm">Swing</span><span id="modal-seq-swing-val" class="text-accent text-bold" style="font-size:var(--text-sm);margin-bottom:2px">50</span><div class="v-slider" style="height:100px"><div class="track"></div><div class="handle"></div></div></div>
                            <div class="ctrl-unit flex-col items-center" data-param="seq_slew_rate" style="width:45%"><span class="label text-sm">Slew Rate</span><span id="modal-seq-slew-val" class="text-accent text-bold" style="font-size:var(--text-sm);margin-bottom:2px">0</span><div class="v-slider" style="height:100px"><div class="track"></div><div class="handle"></div></div></div>
                        </div>

                        <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius);padding:10px;gap:8px;justify-content:space-between">
                            <span class="label text-uppercase text-bold text-dim" style="font-size:var(--text-xs)">User Sequence Presets</span>
                            <div class="flex-col" style="background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius-sm);flex:1;padding:5px;overflow-y:auto;gap:4px;max-height:80px" id="modal-seq-presets-list">
                                <div class="preset-item text-sm text-primary" style="padding:3px;cursor:pointer;border-radius:var(--radius-xs)">Seq-Preset-1 (Staircase)</div>
                                <div class="preset-item text-sm text-primary" style="padding:3px;cursor:pointer;border-radius:var(--radius-xs)">Seq-Preset-2 (Triangle Wave)</div>
                                <div class="preset-item text-sm text-primary" style="padding:3px;cursor:pointer;border-radius:var(--radius-xs)">Seq-Preset-3 (Random Walk)</div>
                            </div>
                            <div class="flex-row gap-6">
                                <button id="modal-seq-load-preset" class="btn btn-sm" style="flex:1" data-ctrl-tooltip="Load sequence preset">Load</button>
                                <button id="modal-seq-save-preset" class="btn btn-sm" style="flex:1" data-ctrl-tooltip="Save sequence preset">Save</button>
                                <button id="modal-seq-reset-btn" class="btn btn-sm btn-outline" data-accent="red" style="flex:1" data-ctrl-tooltip="Reset sequencer engine — stop, rewind to step 0, clear held notes">RESET</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    class SeqModal extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }
        }
    }
    customElements.define('seq-modal', SeqModal);
})();

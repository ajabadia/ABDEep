/**
 * @purpose HTML layout markup for debug-panel unison and voice state modal overlay.
 * @purpose_en Debug panel HTML templates.
 */

window.DEBUG_PANEL_TEMPLATE = `
    <div class="modal-backdrop" id="debug-modal-backdrop" style="display:none">
        <div class="modal" style="width:520px;height:520px">
            <div class="modal-header">
                <h2>Debug: Unison Stacking</h2>
                <div class="close-btn" id="debug-close-btn">&times;</div>
            </div>
            <div class="debug-content" style="flex:1;padding:12px;overflow-y:auto;display:flex;flex-direction:column;gap:10px">
                <!-- Resumen de parámetros -->
                <div class="debug-summary">
                    <div class="debug-summary-row">
                        <span class="debug-label">Mode</span>
                        <span id="debug-mode-name" class="debug-value debug-value-accent">Poly</span>
                    </div>
                    <div class="debug-summary-row">
                        <span class="debug-label">Stack</span>
                        <span id="debug-stack-count" class="debug-value">1 voice</span>
                    </div>
                    <div class="debug-summary-row">
                        <span class="debug-label">Active</span>
                        <span id="debug-active-count" class="debug-value debug-value-accent">0</span>
                    </div>
                    <div class="debug-summary-row">
                        <span class="debug-label">Chord</span>
                        <span id="debug-chord-status" class="debug-value">—</span>
                    </div>
                    <div class="debug-summary-row">
                        <span class="debug-label">Poly Chr</span>
                        <span id="debug-polychord-status" class="debug-value">—</span>
                    </div>
                    <div class="debug-summary-row">
                        <span class="debug-label">Data Source</span>
                        <span id="debug-data-source" class="debug-value">C++ Engine</span>
                    </div>
                </div>

                <!-- VU Meter de nivel de salida -->
                <div class="debug-vumeter">
                    <div class="debug-vumeter-title">Output Level</div>
                    <div class="debug-vumeter-row">
                        <span class="debug-ctrl-label">L</span>
                        <div class="debug-vumeter-track">
                            <div class="debug-vumeter-fill" id="vu-fill" style="width:0%"></div>
                            <div class="debug-vumeter-clip" id="vu-clip">CLIP</div>
                            <div class="debug-vumeter-segments" id="vu-segments"></div>
                        </div>
                        <span class="debug-ctrl-value" id="vu-val">-&#8734; dB</span>
                    </div>
                </div>

                <!-- Controladores MIDI en tiempo real -->
                <div class="debug-controllers" id="debug-controllers">
                    <div class="debug-controllers-title">Controllers</div>
                    <div class="debug-controller-row" data-ctrl="pitchBend">
                        <span class="debug-ctrl-label">Pitch</span>
                        <div class="debug-ctrl-track">
                            <div class="debug-ctrl-fill" id="ctrl-pitchBend-fill" style="left:50%;width:0%"></div>
                            <div class="debug-ctrl-center"></div>
                        </div>
                        <span class="debug-ctrl-value" id="ctrl-pitchBend-val">0.00</span>
                    </div>
                    <div class="debug-controller-row" data-ctrl="modWheel">
                        <span class="debug-ctrl-label">Mod</span>
                        <div class="debug-ctrl-track">
                            <div class="debug-ctrl-fill" id="ctrl-modWheel-fill" style="left:0%;width:0%"></div>
                        </div>
                        <span class="debug-ctrl-value" id="ctrl-modWheel-val">0%</span>
                    </div>
                    <div class="debug-controller-row" data-ctrl="aftertouch">
                        <span class="debug-ctrl-label">AT</span>
                        <div class="debug-ctrl-track">
                            <div class="debug-ctrl-fill" id="ctrl-aftertouch-fill" style="left:0%;width:0%"></div>
                        </div>
                        <span class="debug-ctrl-value" id="ctrl-aftertouch-val">0%</span>
                    </div>
                    <div class="debug-controller-row" data-ctrl="sustainPedal">
                        <span class="debug-ctrl-label">Sus</span>
                        <div class="debug-ctrl-track">
                            <div class="debug-ctrl-fill" id="ctrl-sustainPedal-fill" style="left:0%;width:0%"></div>
                        </div>
                        <span class="debug-ctrl-value" id="ctrl-sustainPedal-val">OFF</span>
                    </div>
                </div>

                <!-- Grid de voces -->
                <div class="debug-voice-grid" id="debug-voice-grid">
                    <div class="debug-no-stack">No voices active</div>
                </div>

                <div class="debug-legend">
                    <span class="debug-legend-item"><span class="debug-legend-dot" style="background:var(--accent-green)"></span>Active</span>
                    <span class="debug-legend-item"><span class="debug-legend-dot" style="background:var(--accent-teal)"></span>+detune</span>
                    <span class="debug-legend-item"><span class="debug-legend-dot" style="background:var(--accent-pink)"></span>−detune</span>
                    <span class="debug-legend-item"><span class="debug-legend-dot" style="background:var(--accent-blue)"></span>Pan pos</span>
                </div>
            </div>
        </div>
    </div>
`;

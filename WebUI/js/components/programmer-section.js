/**
 * @component ProgrammerSection
 * @purpose Web Component para el módulo Programmer del control-grid
 * @classification UI Component
 * @complexity Medium
 */
(function () {
    const template = `        <div class="module flex-col items-center justify-center" id="programmer-section" style="flex:5.5;min-width:0;position:relative">
            <div class="module-header w-full flex-row justify-between items-center" style="padding:0 10px;box-sizing:border-box">
                <div class="flex-row items-center" style="gap:15px">
                    <span>Programmer</span>
                    <!-- Compact MIDI & NRPN Counters in Header -->
                    <div class="flex-row items-center" style="gap:10px;font-size:8px;font-family:'Share Tech Mono',monospace;color:var(--text-dim);opacity:0.85">
                        <span><span style="color:var(--accent-green);font-weight:bold">TX:</span> <span id="nrpn-tx-count">0</span>B</span>
                        <span><span style="color:var(--accent-blue);font-weight:bold">RX:</span> <span id="nrpn-rx-count">0</span>B</span>
                        <span><span style="color:var(--text-faint);font-weight:bold">NRPN:</span> <span id="nrpn-pkt-count">0</span></span>
                    </div>
                </div>
                <div class="voice-leds-container flex-row" style="gap:3px;align-items:center">
                    <span style="font-size:7px;color:var(--text-dim);margin-right:2px;font-family:'Share Tech Mono',monospace;font-weight:bold">VOICES:</span>
                    <div class="voice-led" id="voice-led-0" data-ctrl-tooltip="Voice 1 State">1</div>
                    <div class="voice-led" id="voice-led-1" data-ctrl-tooltip="Voice 2 State">2</div>
                    <div class="voice-led" id="voice-led-2" data-ctrl-tooltip="Voice 3 State">3</div>
                    <div class="voice-led" id="voice-led-3" data-ctrl-tooltip="Voice 4 State">4</div>
                    <div class="voice-led" id="voice-led-4" data-ctrl-tooltip="Voice 5 State">5</div>
                    <div class="voice-led" id="voice-led-5" data-ctrl-tooltip="Voice 6 State">6</div>
                    <div class="voice-led" id="voice-led-6" data-ctrl-tooltip="Voice 7 State">7</div>
                    <div class="voice-led" id="voice-led-7" data-ctrl-tooltip="Voice 8 State">8</div>
                    <div class="voice-led" id="voice-led-8" data-ctrl-tooltip="Voice 9 State">9</div>
                    <div class="voice-led" id="voice-led-9" data-ctrl-tooltip="Voice 10 State">10</div>
                    <div class="voice-led" id="voice-led-10" data-ctrl-tooltip="Voice 11 State">11</div>
                    <div class="voice-led" id="voice-led-11" data-ctrl-tooltip="Voice 12 State">12</div>
                </div>
            </div>
            
            <div class="flex-row" style="gap:6px;width:98%;align-items:stretch;margin-bottom:2px">
                <div class="sysex-monitor-container widescreen-inline" id="programmer-sysex-monitor" style="flex:1;margin:0;min-width:0;box-sizing:border-box;overflow:hidden;height:86px;display:flex;flex-direction:column;justify-content:space-between">
                    <div class="sysex-monitor-header" style="gap:6px;flex-shrink:0">
                        <div class="programmer-tab-group flex-row gap-2" style="align-items:center">
                            <button class="btn btn-xs programmer-tab-btn active" id="prog-tab-sysex" data-mode="sysex" data-ctrl-tooltip="SysEx Hex Monitor View" style="font-size:8.5px;padding:1px 6px">📜 SYSEX</button>
                            <button class="btn btn-xs programmer-tab-btn" id="prog-tab-scope" data-mode="scope" data-ctrl-tooltip="Real DSP Oscilloscope View" style="font-size:8.5px;padding:1px 6px">🔴 SCOPE</button>
                            <button class="btn btn-xs programmer-tab-btn" id="prog-tab-fft" data-mode="fft" data-ctrl-tooltip="FFT Frequency Spectrum View" style="font-size:8.5px;padding:1px 6px">📊 FFT</button>
                            <button class="btn btn-xs programmer-tab-btn" id="prog-tab-dual" data-mode="dual" data-ctrl-tooltip="Combined Scope + FFT View" style="font-size:8.5px;padding:1px 6px">⚡ DUAL</button>
                        </div>
                        <div class="flex-row gap-4 items-center" id="programmer-sysex-actions">
                            <button class="btn btn-xs sysex-copy-btn" id="sysex-copy-btn" data-ctrl-tooltip="Copy SysEx hex data to clipboard">COPY</button>
                            <button class="btn btn-xs sysex-copy-btn" id="sysex-export-btn" data-ctrl-tooltip="Download current SysEx data as .syx file" style="color:var(--accent-pink);border-color:var(--accent-pink)">💾 .SYX</button>
                            <button class="btn btn-xs btn-outline sysex-copy-btn" data-accent="green" id="sysex-zoom-btn" data-ctrl-tooltip="Zoom into SysEx hex data">🔍 ZOOM</button>
                        </div>
                    </div>
                    <!-- Bloque SysEx Hex (por defecto) -->
                    <div id="programmer-sysex-view-block" style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:space-between">
                        <div class="sysex-hex-grid styled-scroll" id="sysex-hex-log" style="min-height:18px;max-height:32px;font-size:7.5px;line-height:1.1">Select a patch from Bank Manager to display SysEx hex stream data...</div>
                        <div class="sysex-selection-info" id="sysex-selection-info" style="font-size:7px;padding:0">Click a hex byte to select it. Shift+click to select range. Ctrl+click to toggle.</div>
                    </div>
                    <!-- Canvas Osciloscopio Real / FFT Central (height increased to 54px for maximum fidelity) -->
                    <div id="programmer-scope-view-block" style="display:none;width:100%;flex:1;min-height:0">
                        <canvas id="programmer-scope-canvas" width="480" height="54" style="display:block;width:100%;height:54px;background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius-xs);box-sizing:border-box"></canvas>
                    </div>
                </div>

                <div class="flex-col" style="gap:2px;width:72px;justify-content:space-between;min-height:84px">
                    <button class="btn btn-sm" id="programmer-bank-up-btn" data-accent="green" style="flex:1;padding:0;line-height:1.1;font-size:9px">BANK UP</button>
                    <button class="btn btn-sm" id="programmer-patch-up-btn" data-accent="blue" style="flex:1;padding:0;line-height:1.1;font-size:9px">PATCH UP</button>
                    <button class="btn btn-sm" id="programmer-patch-down-btn" data-accent="blue" style="flex:1;padding:0;line-height:1.1;font-size:9px">PATCH DN</button>
                    <button class="btn btn-sm" id="programmer-bank-down-btn" data-accent="green" style="flex:1;padding:0;line-height:1.1;font-size:9px">BANK DN</button>
                </div>
            </div>
 
            <div class="programmer-layout flex-row items-center justify-center" style="gap:10px;width:98%">
                <div class="programmer-left-buttons flex-col" style="gap:5px;height:90px;justify-content:center">
                    <button class="btn btn-sm btn-outline" data-accent="orange" id="programmer-compare-btn" style="width:62px">Compare</button>
                    <button class="btn btn-sm btn-outline" data-accent="orange" id="programmer-write-btn" style="width:62px">Write</button>
                    <button class="btn btn-sm btn-outline" data-accent="orange" id="programmer-global-btn" style="width:62px">Global</button>
                </div>

                <div class="lcd-screen" style="width:200px;flex-shrink:0;position:relative">
                    <div id="lcd-glow-pulse"></div>
                    <div id="lcd-text" style="position:relative;z-index:1">INITIAL PATCH</div>
                </div>

                <div class="nav-controls flex-row items-center" style="flex:1;gap:8px;height:auto;min-height:94px">
                    <div class="flex-col" style="gap:4px;width:100%">
                        <!-- Symmetric 4x3 Navigation Grid -->
                        <div class="flex-row" style="gap:4px;justify-content:space-between;align-items:center;width:100%">
                            <button class="btn btn-sm btn-outline" id="programmer-bank-mngr-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px">BNK MANAGER</button>
                            <button class="btn btn-sm btn-outline" data-accent="red" id="random-preset-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-weight:bold;font-size:9px">RND PTCH</button>
                            <button class="btn btn-sm btn-outline" data-accent="blue" id="programmer-mod-matrix-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px">MOD MATRIX</button>
                            <button class="btn btn-sm btn-outline" data-accent="blue" id="programmer-fx-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px">FX</button>
                        </div>
                        <div class="flex-row" style="gap:4px;justify-content:space-between;align-items:center;width:100%">
                            <button class="btn btn-sm btn-outline" data-accent="orange" id="programmer-arp-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px">ARP</button>
                            <button class="btn btn-sm btn-outline" data-accent="pink" id="programmer-seq-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px">SEQ</button>
                            <button class="btn btn-sm btn-outline" id="programmer-chord-btn" data-accent="green" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px">CHORD</button>
                            <button class="btn btn-sm btn-outline" id="programmer-polychord-btn" data-accent="green" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px">POLY CHR</button>
                        </div>
                        <div class="flex-row" style="gap:4px;justify-content:space-between;align-items:center;width:100%">
                            <button class="btn btn-sm btn-outline" data-accent="blue" id="programmer-midi-learn-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px;font-weight:bold">MIDI LEARN</button>
                            <button class="btn btn-sm btn-outline" id="nrpn-reset-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px;font-weight:bold" data-ctrl-tooltip="Reset NRPN and MIDI traffic counters">RESET</button>
                            <button class="btn btn-sm btn-outline" data-accent="red" id="programmer-panic-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px;font-weight:bold" data-ctrl-tooltip="Send All Notes Off / Panic — stops all sounding notes">PANIC</button>
                            <button class="btn btn-sm btn-outline" data-accent="orange" id="programmer-request-hw-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px" data-ctrl-tooltip="Request edit buffer from hardware DeepMind 12 via SysEx dump">REQUEST HW</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    class ProgrammerSection extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }

            // Registrar manejador para iluminar los 12 LEDs con las voces reales del DSP
            window._handleVoiceStates = (statesArray) => {
                if (Array.isArray(statesArray)) {
                    for (let i = 0; i < 12; ++i) {
                        const led = this.querySelector(`#voice-led-${i}`);
                        if (led) {
                            led.classList.toggle('active', !!statesArray[i]);
                        }
                    }
                }
            };
        }
    }
    customElements.define('programmer-section', ProgrammerSection);
})();

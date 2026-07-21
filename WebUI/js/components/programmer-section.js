/**
 * @component ProgrammerSection
 * @purpose Web Component para el módulo Programmer del control-grid
 * @classification UI Component
 * @complexity Medium
 */
(function () {
    const template = `
        <div class="module flex-col items-center justify-center" id="programmer-section" style="flex:5.5;min-width:0">
            <div class="module-header w-full flex-row justify-between items-center" style="padding:0 10px;box-sizing:border-box">
                <span>Programmer</span>
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
            
            <div class="flex-row" style="gap:6px;width:98%;align-items:stretch;margin-bottom:5px">
                <div class="sysex-monitor-container widescreen-inline" id="programmer-sysex-monitor" style="flex:1;margin:0;min-width:0">
                    <div class="sysex-monitor-header">
                        <span class="sysex-monitor-title text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">MIDI SysEx (Unpacked 242B / Raw 291B)</span>
                        <div class="flex-row gap-4 items-center">
                            <button class="btn btn-xs btn-outline sysex-copy-btn" data-accent="green" id="sysex-zoom-btn" data-ctrl-tooltip="Zoom into SysEx hex data">🔍 ZOOM</button>
                            <button class="btn btn-xs sysex-copy-btn" id="sysex-copy-btn" data-ctrl-tooltip="Copy SysEx hex data to clipboard">COPY</button>
                            <button class="btn btn-xs sysex-copy-btn" id="sysex-export-btn" data-ctrl-tooltip="Download current SysEx data as .syx file" style="color:var(--accent-pink);border-color:var(--accent-pink)">💾 .SYX</button>
                        </div>
                    </div>
                    <div class="sysex-hex-grid styled-scroll" id="sysex-hex-log" style="min-height:25px;max-height:42px;font-size:var(--text-xs);line-height:1.2">Select a patch from Bank Manager to display SysEx hex stream data...</div>
                    <div class="sysex-selection-info" id="sysex-selection-info">Click a hex byte to select it. Shift+click to select range. Ctrl+click to toggle.</div>
                    <div id="sysex-active-patch-label" class="text-bold text-accent text-uppercase" style="font-size:var(--text-xs);border-top:1px solid var(--border-dim);padding-top:3px;margin-top:3px;display:none">LOADED PATCH: -</div>
                    <div class="flex-row justify-between items-center" style="font-size:var(--text-2xs);color:var(--text-dim);padding:2px 0;margin-top:2px;border-top:1px solid var(--border-dim)">
                        <span><span class="text-bold" style="color:var(--accent-green)">TX</span> <span id="nrpn-tx-count">0</span>B</span>
                        <span><span class="text-bold" style="color:var(--accent-blue)">RX</span> <span id="nrpn-rx-count">0</span>B</span>
                        <span><span class="text-bold">NRPN</span> <span id="nrpn-pkt-count">0</span>pkts</span>
                        <button class="btn btn-xs" id="nrpn-reset-btn" style="font-size:7px;padding:1px 4px;cursor:pointer" data-ctrl-tooltip="Reset NRPN traffic counters">Reset</button>
                    </div>
                </div>

                <div class="flex-col" style="gap:2px;width:72px;justify-content:space-between;min-height:80px">
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
                        <div class="flex-row" style="gap:4px;justify-content:space-between;align-items:center;width:100%">
                            <button class="btn btn-sm btn-solid" id="programmer-bank-mngr-btn" style="flex:1;height:26px;padding:0;line-height:26px;font-size:9px">BNK MANAGER</button>
                            <button class="btn btn-sm btn-outline" data-accent="blue" id="programmer-mod-matrix-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px">MOD MATRIX</button>
                            <button class="btn btn-sm btn-outline" data-accent="blue" id="programmer-fx-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px">FX</button>
                            <button class="btn btn-sm btn-outline" id="programmer-polychord-btn" data-accent="green" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px">Poly Chr</button>
                        </div>
                        <div class="flex-row" style="gap:4px;justify-content:space-between;align-items:center;width:100%">
                            <button class="btn btn-sm btn-outline" data-accent="orange" id="programmer-arp-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px">Arp</button>
                            <button class="btn btn-sm btn-outline" data-accent="pink" id="programmer-seq-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px">Seq</button>
                            <button class="btn btn-sm btn-outline" id="programmer-chord-btn" data-accent="green" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px">Chord</button>
                        </div>
                        <div class="flex-row" style="gap:4px;width:100%">
                            <button class="btn btn-sm btn-outline" data-accent="red" id="random-preset-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-weight:bold;font-size:9px">RND PTCH</button>
                            <button class="btn btn-sm btn-outline" data-accent="blue" id="programmer-midi-learn-btn" style="flex:1;height:26px;padding:0;line-height:24px;font-size:9px;font-weight:bold">MIDI LEARN</button>
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

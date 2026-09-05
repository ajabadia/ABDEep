/**
 * @component arp-modal
 * @purpose Arpeggiator & Pattern Editor modal
 * @classification UI Component
 */
(function() {
    const template = `
        <div class="modal-backdrop" id="arp-modal-backdrop" style="display:none;z-index:5000">
            <div class="modal" data-accent="orange" style="width:820px">
                <div class="modal-header">
                    <h2>Arpeggiator & Pattern Editor</h2>
                    <div class="close-btn" id="arp-modal-close-btn" data-ctrl-tooltip="Close Arpeggiator modal">&times;</div>
                </div>
                
                <div class="modal-body" style="overflow-y:auto">
                    <div class="arp-pattern-section flex-col" style="background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius);padding:10px;gap:5px">
                        <span class="label text-uppercase text-bold" style="font-size:var(--text-xs);color:var(--text-dim);margin-bottom:5px">Pattern Step Gate (32 Steps)</span>
                        <div class="arp-steps-grid" style="display:grid;grid-template-columns:repeat(32,1fr);gap:4px;height:100px;background:var(--bg-deepest);border:1px solid var(--bg-elevated);padding:5px;border-radius:var(--radius-sm);position:relative"></div>
                        <div class="arp-steps-labels" style="display:grid;grid-template-columns:repeat(32,1fr);gap:4px;text-align:center;font-size:var(--text-2xs);color:var(--text-faint)"></div>
                    </div>

                    <div style="display:grid;grid-template-columns:1.5fr 2fr 2.5fr;gap:15px">
                        <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius);padding:10px;gap:10px">
                            <div class="flex-row gap-6">
                                <div id="modal-arp-enable-box" class="led-btn" style="flex:1" data-ctrl-tooltip="Arpeggiator On/Off">ON</div>
                                <div id="modal-arp-hold-box" class="led-btn" style="flex:1" data-ctrl-tooltip="Arp Hold — sustain arpeggiated notes">HOLD</div>
                                <div id="modal-arp-keysync-box" class="led-btn" style="flex:1" data-ctrl-tooltip="Arp Key Sync — reset pattern on each new note">KEY SYNC</div>
                            </div>
                            
                            <div class="flex-col gap-6">
                                <div class="flex-row justify-between items-center">
                                    <span class="label text-sm text-dim">Clock Rate</span>
                                    <select id="modal-arp-clock-select" data-param="arp_clock_divider" class="modal-select" style="width:60%"><option value="0">1/2</option><option value="1">3/8</option><option value="2">1/3</option><option value="3">1/4</option><option value="4">3/16</option><option value="5">1/6</option><option value="6">1/8</option><option value="7">3/32</option><option value="8">1/12</option><option value="9">1/16</option><option value="10">1/24</option><option value="11">1/32</option><option value="12">1/48</option></select>
                                </div>
                                <div class="flex-row justify-between items-center">
                                    <span class="label text-sm text-dim">Vel Gate</span>
                                    <select id="modal-arp-velgate-select" data-param="arp_velocity_gate" class="modal-select" style="width:60%"><option value="0">Gate</option><option value="1">Velocity</option><option value="2">Seq</option></select>
                                </div>
                                <div class="flex-row justify-between items-center">
                                    <span class="label text-sm text-dim">Mode</span>
                                    <select id="modal-arp-mode-select" data-param="arp_mode" class="modal-select" style="width:60%"><option value="0">UP</option><option value="1">DOWN</option><option value="2">UP-DOWN</option><option value="3">UP-INV</option><option value="4">DOWN-INV</option><option value="5">UP-DN-INV</option><option value="6">UP-ALT</option><option value="7">DOWN-ALT</option><option value="8">RANDOM</option><option value="9">AS-PLAYED</option></select>
                                </div>
                                <div class="flex-row justify-between items-center">
                                    <span class="label text-sm text-dim">Pattern</span>
                                    <select id="modal-arp-pattern-select" data-param="arp_pattern" class="modal-select" style="width:60%">
                                        <option value="0">None</option>
                                        <option value="1">Preset 1</option><option value="2">Preset 2</option><option value="3">Preset 3</option><option value="4">Preset 4</option><option value="5">Preset 5</option><option value="6">Preset 6</option><option value="7">Preset 7</option><option value="8">Preset 8</option><option value="9">Preset 9</option><option value="10">Preset 10</option><option value="11">Preset 11</option><option value="12">Preset 12</option><option value="13">Preset 13</option><option value="14">Preset 14</option><option value="15">Preset 15</option><option value="16">Preset 16</option><option value="17">Preset 17</option><option value="18">Preset 18</option><option value="19">Preset 19</option><option value="20">Preset 20</option><option value="21">Preset 21</option><option value="22">Preset 22</option><option value="23">Preset 23</option><option value="24">Preset 24</option><option value="25">Preset 25</option><option value="26">Preset 26</option><option value="27">Preset 27</option><option value="28">Preset 28</option><option value="29">Preset 29</option><option value="30">Preset 30</option><option value="31">Preset 31</option><option value="32">Preset 32</option>
                                        <option value="33">User 1</option><option value="34">User 2</option><option value="35">User 3</option><option value="36">User 4</option><option value="37">User 5</option><option value="38">User 6</option><option value="39">User 7</option><option value="40">User 8</option><option value="41">User 9</option><option value="42">User 10</option><option value="43">User 11</option><option value="44">User 12</option><option value="45">User 13</option><option value="46">User 14</option><option value="47">User 15</option><option value="48">User 16</option><option value="49">User 17</option><option value="50">User 18</option><option value="51">User 19</option><option value="52">User 20</option><option value="53">User 21</option><option value="54">User 22</option><option value="55">User 23</option><option value="56">User 24</option><option value="57">User 25</option><option value="58">User 26</option><option value="59">User 27</option><option value="60">User 28</option><option value="61">User 29</option><option value="62">User 30</option><option value="63">User 31</option><option value="64">User 32</option>
                                    </select>
                                </div>
                                <div class="flex-row justify-between items-center">
                                    <span class="label text-sm text-dim">Octave Range</span>
                                    <select id="modal-arp-octave-select" data-param="arp_octave" class="modal-select" style="width:60%"><option value="0">1</option><option value="1">2</option><option value="2">3</option><option value="3">4</option></select>
                                </div>
                            </div>
                        </div>

                        <div class="flex-row bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius);padding:10px;justify-content:space-around;align-items:center">
                            <div class="ctrl-unit flex-col items-center" data-param="arp_swing" style="width:28%"><span class="label text-sm">Swing</span><div class="v-slider" style="height:100px"><div class="track"></div><div class="handle"></div></div></div>
                            <div class="ctrl-unit flex-col items-center" data-param="arp_rate" style="width:28%"><span class="label text-sm">Rate (BPM)</span><div class="v-slider" style="height:100px"><div class="track"></div><div class="handle"></div></div></div>
                            <div class="ctrl-unit flex-col items-center" data-param="arp_gate_time" style="width:28%"><span class="label text-sm">Gate Time</span><div class="v-slider" style="height:100px"><div class="track"></div><div class="handle"></div></div></div>
                        </div>

                        <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius);padding:10px;gap:8px;justify-content:space-between">
                            <span class="label text-uppercase text-bold text-dim" style="font-size:var(--text-xs)">User Pattern Presets</span>
                            <div class="flex-col" style="background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius-sm);flex:1;padding:5px;overflow-y:auto;gap:4px;max-height:80px" id="modal-arp-presets-list">
                                <div class="preset-item text-sm text-primary" style="padding:3px;cursor:pointer;border-radius:var(--radius-xs)">Preset-1 (Default UP-DOWN)</div>
                                <div class="preset-item text-sm text-primary" style="padding:3px;cursor:pointer;border-radius:var(--radius-xs)">Preset-2 (8-Step Disco)</div>
                                <div class="preset-item text-sm text-primary" style="padding:3px;cursor:pointer;border-radius:var(--radius-xs)">Preset-3 (Syncopated)</div>
                            </div>
                            <div class="flex-row gap-6">
                                <button id="modal-arp-load-preset" class="btn btn-sm" style="flex:1" data-ctrl-tooltip="Load arpeggiator pattern preset">Load</button>
                                <button id="modal-arp-save-preset" class="btn btn-sm" style="flex:1" data-ctrl-tooltip="Save arpeggiator pattern preset">Save</button>
                                <button id="modal-arp-reset-btn" class="btn btn-sm btn-outline" data-accent="red" style="flex:1" data-ctrl-tooltip="Reset arpeggiator engine — stop, rewind to step 0, clear held notes">RESET</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    class ArpModal extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }
        }
    }
    customElements.define('arp-modal', ArpModal);
})();

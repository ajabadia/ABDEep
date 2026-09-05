/**
 * @purpose Panel templates: Arpeggiator (ARP) and Sequencer (SEQ).
 *          Appends to window.PANEL_TEMPLATES (initialized by panel_templates.js).
 * @classification UI/Templates
 */

(function () {
    const NS = window.PANEL_TEMPLATES = window.PANEL_TEMPLATES || {};

    function buildArpPatternOptions() {
        let opts = '<option value="0">None</option>';
        for (let i = 1; i <= 32; i++) {
            opts += '<option value="' + i + '">Preset ' + i + '</option>';
        }
        for (let i = 1; i <= 32; i++) {
            opts += '<option value="' + (i + 32) + '">User ' + i + '</option>';
        }
        return opts;
    }

    NS.ARP = function () { return [
        '<div class="panel-section-title">Arpeggiator Status</div>',
        '<div class="flex-row" style="justify-content:space-between;margin-bottom:12px;gap:6px;flex-wrap:wrap">',
        '    <div id="panel-arp-enable-box" class="led-btn" style="flex:1;min-width:50px" data-param="arp_enable">Arp On</div>',
        '    <div id="panel-arp-hold-box" class="led-btn" style="flex:1;min-width:50px" data-param="arp_hold">Hold</div>',
        '    <div id="panel-arp-keysync-box" class="led-btn" style="flex:1;min-width:50px" data-param="arp_key_sync">Key Sync</div>',
        '</div>',
        '<div class="panel-section-title">Arp Routing &amp; Clock</div>',
        '<div class="w-full" style="margin-bottom:8px">',
        '    <span class="label text-xs text-dim" style="display:block;margin-bottom:2px">CLOCK RATE / DIVIDER</span>',
        '    <select id="panel-arp-clock-select" data-param="arp_clock_divider" class="modal-select w-full" style="font-size:9px;padding:3px">',
        '        <option value="0">1/2</option><option value="1">3/8</option><option value="2">1/3</option><option value="3">1/4</option><option value="4">3/16</option><option value="5">1/6</option><option value="6">1/8</option><option value="7">3/32</option><option value="8">1/12</option><option value="9">1/16</option><option value="10">1/24</option><option value="11">1/32</option><option value="12">1/48</option>',
        '    </select>',
        '</div>',
        '<div class="w-full" style="margin-bottom:8px">',
        '    <span class="label text-xs text-dim" style="display:block;margin-bottom:2px">VELOCITY GATE</span>',
        '    <select id="panel-arp-velgate-select" data-param="arp_velocity_gate" class="modal-select w-full" style="font-size:9px;padding:3px">',
        '        <option value="0">Gate</option><option value="1">Velocity</option><option value="2">Seq</option>',
        '    </select>',
        '</div>',
        '<div class="panel-section-title">Mode, Pattern &amp; Range</div>',
        '<div class="w-full" style="margin-bottom:8px">',
        '    <span class="label text-xs text-dim" style="display:block;margin-bottom:2px">ARPEGGIATOR MODE</span>',
        '    <select id="panel-arp-mode-select" data-param="arp_mode" class="modal-select w-full" style="font-size:9px;padding:3px">',
        '        <option value="0">UP</option><option value="1">DOWN</option><option value="2">UP-DOWN</option><option value="3">UP-INV</option><option value="4">DOWN-INV</option><option value="5">UP-DN-INV</option><option value="6">UP-ALT</option><option value="7">DOWN-ALT</option><option value="8">RANDOM</option><option value="9">AS-PLAYED</option>',
        '    </select>',
        '</div>',
        '<div class="w-full" style="margin-bottom:8px">',
        '    <span class="label text-xs text-dim" style="display:block;margin-bottom:2px">ARP PATTERN</span>',
        '    <select id="panel-arp-pattern-select" data-param="arp_pattern" class="modal-select w-full" style="font-size:9px;padding:3px">',
        '        ' + buildArpPatternOptions(),
        '    </select>',
        '</div>',
        '<div class="w-full" style="margin-bottom:12px">',
        '    <span class="label text-xs text-dim" style="display:block;margin-bottom:2px">OCTAVE RANGE</span>',
        '    <select id="panel-arp-octave-select" data-param="arp_octave" class="modal-select w-full" style="font-size:9px;padding:3px">',
        '        <option value="0">1</option><option value="1">2</option><option value="2">3</option><option value="3">4</option>',
        '    </select>',
        '</div>',
        '<div class="panel-section-title">Arpeggiator Faders</div>',
        '<div class="panel-row" style="margin-top:5px;margin-bottom:5px;justify-content:space-around">',
        '    <div class="ctrl-unit flex-col items-center" data-param="arp_swing" style="width:30%"><span class="label text-xs">Swing</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>',
        '    <div class="ctrl-unit flex-col items-center" data-param="arp_rate" style="width:30%"><span class="label text-xs">Rate</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>',
        '    <div class="ctrl-unit flex-col items-center" data-param="arp_gate_time" style="width:30%"><span class="label text-xs">Gate Time</span><div class="v-slider" style="height:80px"><div class="track"></div><div class="handle"></div></div></div>',
        '</div>'
    ].join('\n'); };

    NS.SEQ = function () { return [
        '<div class="panel-section-title">Sequencer Status</div>',
        '<div class="flex-row" style="justify-content:space-between;margin-bottom:10px;gap:6px;flex-wrap:wrap">',
        '    <div id="panel-seq-enable-box" class="led-btn" style="flex:1;min-width:40px" data-param="seq_enable">Seq On</div>',
        '    <button id="panel-seq-skip-btn" class="modal-btn" style="flex:1;font-size:8px;background:var(--bg-hover);border-color:var(--color-danger);min-width:40px;color:var(--color-danger)" data-ctrl-tooltip="Toggle last-edited step between SKIP (raw 0) and center">Set Skip</button>',
        '    <button id="panel-seq-open-modal-btn" class="modal-btn" style="flex:1;font-size:8px;background:var(--bg-hover);border-color:var(--border-dim);min-width:40px">Full Editor</button>',
        '</div>',
        '<div class="panel-section-title">Clock &amp; Length</div>',
        '<div class="w-full" style="margin-bottom:6px;display:flex;gap:6px;flex-wrap:wrap">',
        '    <div style="flex:1;min-width:60px">',
        '        <span class="label text-xs text-dim" style="display:block;margin-bottom:2px">CLOCK</span>',
        '        <select id="panel-seq-clock-select" data-param="seq_clock" class="modal-select w-full" style="font-size:8px;padding:3px">',
        '            <option value="0">1/2</option><option value="1">3/8</option><option value="2">1/3</option><option value="3">1/4</option><option value="4">3/16</option>',
        '            <option value="5">1/6</option><option value="6">1/8</option><option value="7">1/12</option><option value="8">1/16</option>',
        '            <option value="9">1/24</option><option value="10">1/32</option><option value="11">1/48</option><option value="12">1/64</option>',
        '            <option value="13">1/96</option><option value="14">1/128</option><option value="15">1/192</option>',
        '        </select>',
        '    </div>',
        '    <div style="flex:1;min-width:60px">',
        '        <span class="label text-xs text-dim" style="display:block;margin-bottom:2px">LENGTH</span>',
        '        <select id="panel-seq-length-select" data-param="seq_length" class="modal-select w-full" style="font-size:8px;padding:3px">',
        '            <option value="0">2</option><option value="1">3</option><option value="2">4</option><option value="3">5</option><option value="4">6</option><option value="5">7</option><option value="6">8</option>',
        '            <option value="7">9</option><option value="8">10</option><option value="9">11</option><option value="10">12</option><option value="11">13</option><option value="12">14</option><option value="13">15</option>',
        '            <option value="14">16</option><option value="15">17</option><option value="16">18</option><option value="17">19</option><option value="18">20</option><option value="19">21</option><option value="20">22</option>',
        '            <option value="21">23</option><option value="22">24</option><option value="23">25</option><option value="24">26</option><option value="25">27</option><option value="26">28</option><option value="27">29</option>',
        '            <option value="28">30</option><option value="29">31</option><option value="30">32</option>',
        '        </select>',
        '    </div>',
        '    <div style="flex:1;min-width:60px">',
        '        <span class="label text-xs text-dim" style="display:block;margin-bottom:2px">KEY LOOP</span>',
        '        <select id="panel-seq-keyloop-select" data-param="seq_key_loop" class="modal-select w-full" style="font-size:8px;padding:3px">',
        '            <option value="0">Loop (free)</option><option value="1">Key Sync</option><option value="2">Key &amp; Loop</option>',
        '        </select>',
        '    </div>',
        '</div>',
        '<div class="panel-section-title">Step Values <span style="font-size:7px;color:var(--text-faint);font-weight:normal">(drag up/down)</span></div>',
        '<div id="panel-seq-steps-container" style="display:grid;grid-template-columns:repeat(16,1fr);gap:2px;margin-bottom:6px;padding:4px;background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius-sm);height:90px"></div>',
        '<div class="panel-section-title">Swing &amp; Slew</div>',
        '<div class="panel-row" style="margin-top:5px;margin-bottom:5px;justify-content:space-around">',
        '    <div class="ctrl-unit flex-col items-center" data-param="seq_swing" style="width:45%"><span class="label text-xs">Swing</span><div class="v-slider" style="height:60px"><div class="track"></div><div class="handle"></div></div></div>',
        '    <div class="ctrl-unit flex-col items-center" data-param="seq_slew_rate" style="width:45%"><span class="label text-xs">Slew Rate</span><div class="v-slider" style="height:60px"><div class="track"></div><div class="handle"></div></div></div>',
        '</div>'
    ].join('\n'); };
})();

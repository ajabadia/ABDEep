/**
 * @component settings-modal-tabs-connection
 * @purpose HTML Templates for Connections and Routing settings tabs
 * @classification UI Component Submodule
 */
(function () {
    // --- Connections Tab ---
    window.SETTINGS_TAB_CONNECTIONS = `
        <div class="settings-panel-view flex-col gap-15" id="settings-view-connections" style="display:flex">
            <div class="text-center text-uppercase border-bottom text-dim" style="font-size:var(--text-md);padding-bottom:4px">Connection</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
                <div class="flex-col bg-surface" style="border:1px solid var(--border);border-radius:var(--radius);padding:10px">
                    <div class="text-center text-bold text-uppercase" style="font-size:14px;margin-bottom:8px">Input Devices</div>
                    <div class="flex-col" style="background:var(--bg-deepest);border:1px solid var(--border-dim);min-height:120px;border-radius:var(--radius-sm);padding:4px;gap:4px" id="settings-midi-inputs-list">
                        <div class="text-dim text-center" style="padding:6px;font-size:var(--text-md)">None</div>
                        <div class="midi-dev-item active" style="padding:6px;font-size:var(--text-base);background:linear-gradient(180deg,color-mix(in srgb, var(--accent-primary) 28%, #111),color-mix(in srgb, var(--accent-primary) 10%, #000));border:1px solid var(--accent-primary);border-radius:var(--radius-sm);cursor:pointer;font-weight:bold;color:var(--text-primary)">LoopBe Internal MIDI</div>
                    </div>
                </div>
                <div class="flex-col bg-surface" style="border:1px solid var(--border);border-radius:var(--radius);padding:10px">
                    <div class="text-center text-bold text-uppercase" style="font-size:14px;margin-bottom:8px">Output Devices</div>
                    <div class="flex-col" style="background:var(--bg-deepest);border:1px solid var(--border-dim);min-height:120px;border-radius:var(--radius-sm);padding:4px;gap:4px" id="settings-midi-outputs-list">
                        <div style="padding:6px;font-size:var(--text-md);color:var(--text-primary);cursor:pointer;border-radius:var(--radius-xs)">None</div>
                        <div style="padding:6px;font-size:var(--text-md);color:var(--text-secondary);cursor:pointer;border-radius:var(--radius-xs)">Microsoft GS Wavetable Synth</div>
                        <div class="midi-dev-item active" style="padding:6px;font-size:var(--text-base);background:linear-gradient(180deg,color-mix(in srgb, var(--accent-primary) 28%, #111),color-mix(in srgb, var(--accent-primary) 10%, #000));border:1px solid var(--accent-primary);border-radius:var(--radius-sm);cursor:pointer;font-weight:bold;color:var(--text-primary)">LoopBe Internal MIDI</div>
                    </div>
                </div>
            </div>

            <div class="flex-row justify-between items-center" style="background:var(--bg-header);padding:10px;border-radius:var(--radius)">
                <div>
                    <button class="btn btn-sm" id="settings-connection-status" style="background:linear-gradient(180deg,var(--bg-header),var(--bg-hover));color:var(--text-primary);box-shadow:0 2px 4px rgba(0,0,0,0.4)">Disconnected</button>
                    <div class="text-dim text-center" id="settings-connection-type" style="font-size:var(--text-sm);margin-top:4px">Connection Type</div>
                </div>
                <button class="btn btn-sm btn-outline" data-accent="orange" id="settings-midi-resync">Rescan MIDI</button>
            </div>

            <div class="flex-col" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius);padding:8px">
                <div class="text-center text-uppercase text-dim" style="font-size:var(--text-sm);margin-bottom:6px;display:flex;align-items:center;justify-content:center;gap:6px">
                    <span>Synth Information</span>
                    <button id="settings-synth-info-refresh" class="btn btn-xs btn-outline" data-accent="blue" title="Re-query hardware identity" style="font-size:9px;padding:1px 5px;line-height:1.2">↻</button>
                    <span id="settings-global-dump-status" class="fade-indicator" style="font-size:9px;color:var(--accent-blue)">⏳ Requesting...</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;text-align:center;font-size:var(--text-sm)">
                    <div><div id="app-build-label" style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);font-weight:bold;margin-bottom:2px">v0.1 b100</div><span class="text-dim">App Version</span></div>
                    <div><div id="settings-synth-host-version" style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);color:var(--text-faint);margin-bottom:2px">-</div><span class="text-dim">Host Version</span></div>
                    <div><div id="settings-synth-voice-version" style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);color:var(--text-faint);margin-bottom:2px">-</div><span class="text-dim">Voice Version</span></div>
                    <div><div id="settings-synth-dsp-version" style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);color:var(--text-faint);margin-bottom:2px">-</div><span class="text-dim">DSP Version</span></div>
                    <div><div id="settings-synth-boot-version" style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);color:var(--text-faint);margin-bottom:2px">-</div><span class="text-dim">Boot Version</span></div>
                    <div><div id="settings-synth-wifi-version" style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);color:var(--text-faint);margin-bottom:2px">-</div><span class="text-dim">WiFi Version</span></div>
                    <div><div id="settings-synth-device-id" style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);color:var(--text-faint);margin-bottom:2px">-</div><span class="text-dim">Device ID</span></div>
                    <div><div id="settings-synth-midi-channel" style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);color:var(--text-faint);margin-bottom:2px">-</div><span class="text-dim">MIDI Channel</span></div>
                </div>
                <div class="text-center" style="font-size:9px;color:var(--text-faint);margin-top:4px;font-style:italic">Firmware versions require official Behringer app (USB). Web MIDI reports "\u2014" when unavailable.</div>
            </div>

            <div class="flex-col" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius);padding:8px">
                <div class="text-center text-uppercase text-dim" style="font-size:var(--text-sm);margin-bottom:6px">Global Parameters (from hardware)</div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;text-align:center;font-size:var(--text-sm)">
                    <div><div id="settings-global-device-id" style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);color:var(--text-faint);margin-bottom:2px">-</div><span class="text-dim">Device ID</span></div>
                    <div><div id="settings-global-midi-channel" style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);color:var(--text-faint);margin-bottom:2px">-</div><span class="text-dim">MIDI Channel</span></div>
                    <div><div id="settings-global-master-tune" style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);color:var(--text-faint);margin-bottom:2px">-</div><span class="text-dim">Master Tune</span></div>
                    <div><div id="settings-global-transpose" style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);color:var(--text-faint);margin-bottom:2px">-</div><span class="text-dim">Transpose</span></div>
                </div>
            </div>
        </div>`;

    // --- Routing Tab ---
    window.SETTINGS_TAB_ROUTING = `
        <div class="settings-panel-view" id="settings-view-routing" style="display:none">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:15px;text-align:center">
                <div class="flex-col bg-surface" style="border:1px solid var(--border);padding:10px;border-radius:var(--radius)">
                    <div class="text-uppercase text-bold text-dim border-bottom" style="font-size:var(--text-md);margin-bottom:8px;padding-bottom:3px">MIDI Settings</div>
                    <div class="flex-col" style="gap:8px">
                        <div class="flex-row justify-between items-center" style="font-size:var(--text-md)"><span>Midi Ctrl</span><select id="settings-midi-ctrl" class="modal-select" style="width:60px;font-size:var(--text-sm);padding:1px"><option>Off</option><option>Cc</option><option>Nrpn</option></select></div>
                        <div class="flex-row justify-between items-center" style="font-size:var(--text-md)"><span>Prog Change</span><select id="settings-midi-prog-change" class="modal-select" style="width:60px;font-size:var(--text-sm);padding:1px"><option>RX</option><option>TX</option><option>RX-TX</option><option>NONE</option></select></div>
                        <div class="flex-row justify-between items-center" style="font-size:var(--text-md)"><span>TX Channel</span><select id="settings-midi-tx-ch" class="modal-select" style="width:60px;font-size:var(--text-sm);padding:1px"><option>RxCh</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option></select></div>
                        <div class="flex-row justify-between items-center" style="font-size:var(--text-md)"><span>RX Channel</span><select id="settings-midi-rx-ch" class="modal-select" style="width:60px;font-size:var(--text-sm);padding:1px"><option>All</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option></select></div>
                        <div class="flex-row justify-between items-center text-sm" style="margin-top:5px"><span>Soft Thru</span><input id="settings-midi-soft-thru" type="checkbox"></div>
                        <div class="flex-row justify-between items-center text-sm"><span>MIDI > USB Thru</span><input id="settings-midi-usb-thru" type="checkbox"></div>
                        <div class="flex-row justify-between items-center text-sm"><span>MIDI > Wifi Thru</span><input id="settings-midi-wifi-thru" type="checkbox"></div>
                    </div>
                </div>

                <div class="flex-col bg-surface" style="border:1px solid var(--border);padding:10px;border-radius:var(--radius)">
                    <div class="text-uppercase text-bold text-dim border-bottom" style="font-size:var(--text-md);margin-bottom:8px;padding-bottom:3px">USB Settings</div>
                    <div class="flex-col" style="gap:8px">
                        <div class="flex-row justify-between items-center" style="font-size:var(--text-md)"><span>USB Ctrl</span><select id="settings-usb-ctrl" class="modal-select" style="width:60px;font-size:var(--text-sm);padding:1px"><option>Off</option><option>Cc</option><option>Nrpn</option></select></div>
                        <div class="flex-row justify-between items-center" style="font-size:var(--text-md)"><span>Prog Change</span><select id="settings-usb-prog-change" class="modal-select" style="width:60px;font-size:var(--text-sm);padding:1px"><option>RX</option><option>TX</option><option>RX-TX</option><option>NONE</option></select></div>
                        <div class="flex-row justify-between items-center" style="font-size:var(--text-md)"><span>TX Channel</span><select id="settings-usb-tx-ch" class="modal-select" style="width:60px;font-size:var(--text-sm);padding:1px"><option>RxCh</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option></select></div>
                        <div class="flex-row justify-between items-center" style="font-size:var(--text-md)"><span>RX Channel</span><select id="settings-usb-rx-ch" class="modal-select" style="width:60px;font-size:var(--text-sm);padding:1px"><option>All</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option></select></div>
                        <div class="flex-row justify-between items-center text-sm" style="margin-top:5px"><span>USB > MIDI Thru</span><input id="settings-usb-midi-thru" type="checkbox"></div>
                        <div class="flex-row justify-between items-center text-sm"><span>USB > Wifi Thru</span><input id="settings-usb-wifi-thru" type="checkbox"></div>
                    </div>
                </div>

                <div class="flex-col bg-surface" style="border:1px solid var(--border);padding:10px;border-radius:var(--radius)">
                    <div class="text-uppercase text-bold text-dim border-bottom" style="font-size:var(--text-md);margin-bottom:8px;padding-bottom:3px">WIFI Settings</div>
                    <div class="flex-col" style="gap:8px">
                        <div class="flex-row justify-between items-center" style="font-size:var(--text-md)"><span>WiFi Ctrl</span><select id="settings-wifi-ctrl" class="modal-select" style="width:60px;font-size:var(--text-sm);padding:1px"><option>Off</option><option>Cc</option><option>Nrpn</option></select></div>
                        <div class="flex-row justify-between items-center" style="font-size:var(--text-md)"><span>Prog Change</span><select id="settings-wifi-prog-change" class="modal-select" style="width:60px;font-size:var(--text-sm);padding:1px"><option>RX</option><option>TX</option><option>RX-TX</option><option>NONE</option></select></div>
                        <div class="flex-row justify-between items-center" style="font-size:var(--text-md)"><span>TX Channel</span><select id="settings-wifi-tx-ch" class="modal-select" style="width:60px;font-size:var(--text-sm);padding:1px"><option>All</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option></select></div>
                        <div class="flex-row justify-between items-center" style="font-size:var(--text-md)"><span>RX Channel</span><select id="settings-wifi-rx-ch" class="modal-select" style="width:60px;font-size:var(--text-sm);padding:1px"><option>RxCh</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option></select></div>
                        <div class="flex-row justify-between items-center text-sm" style="margin-top:5px"><span>Wifi > MIDI Thru</span><input id="settings-wifi-midi-thru" type="checkbox"></div>
                        <div class="flex-row justify-between items-center text-sm"><span>Wifi > USB Thru</span><input id="settings-wifi-usb-thru" type="checkbox"></div>
                    </div>
                </div>
            </div>
        </div>`;
})();

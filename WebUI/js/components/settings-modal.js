/**
 * @component settings-modal
 * @purpose Settings & Global Preferences + About modals
 * @classification UI Component
 */
(function() {
    const template = `
        <!-- SETTINGS MODAL -->
        <div class="modal-backdrop" id="settings-modal-backdrop" style="display:none;z-index:5000">
            <div class="modal" data-accent="orange" style="width:800px">
                <div class="modal-header">
                    <h2>Settings & Global Preferences</h2>
                    <div class="close-btn" id="settings-modal-close-btn">&times;</div>
                </div>
                
                <div class="modal-body" style="background:var(--bg-elevated);overflow-y:auto">
                    <div class="flex-row" style="gap:2px;background:var(--bg-elevated);padding:2px;border-radius:var(--radius)">
                        <button class="btn btn-sm btn-solid active" data-tab="connections" style="flex:1;font-size:var(--text-base);border:none">Connections</button>
                        <button class="btn btn-sm" data-tab="routing" style="flex:1;background:var(--bg-hover);color:var(--text-secondary);font-size:var(--text-base);border:none">Routing</button>
                        <button class="btn btn-sm" data-tab="misc" style="flex:1;background:var(--bg-hover);color:var(--text-secondary);font-size:var(--text-base);border:none">Misc</button>
                        <button class="btn btn-sm" data-tab="dump" style="flex:1;background:var(--bg-hover);color:var(--text-secondary);font-size:var(--text-base);border:none">Dump</button>
                        <button class="btn btn-sm" data-tab="midilearn" style="flex:1;background:var(--bg-hover);color:var(--text-secondary);font-size:var(--text-base);border:none">MIDI Learn</button>
                        <button class="btn btn-sm" data-tab="keyboard" style="flex:1;background:var(--bg-hover);color:var(--text-secondary);font-size:var(--text-base);border:none">Keyboard</button>
                    </div>

                    <div id="settings-tab-content" style="min-height:250px">
                        <div class="flex-col gap-15" id="settings-view-connections" style="display:flex">
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
                                    <div><div style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);font-weight:bold;margin-bottom:2px">v0.1 b100</div><span class="text-dim">App Version</span></div>
                                    <div><div id="settings-synth-host-version" style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);color:var(--text-faint);margin-bottom:2px">-</div><span class="text-dim">Host Version</span></div>
                                    <div><div id="settings-synth-voice-version" style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);color:var(--text-faint);margin-bottom:2px">-</div><span class="text-dim">Voice Version</span></div>
                                    <div><div id="settings-synth-dsp-version" style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);color:var(--text-faint);margin-bottom:2px">-</div><span class="text-dim">DSP Version</span></div>
                                    <div><div id="settings-synth-boot-version" style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);color:var(--text-faint);margin-bottom:2px">-</div><span class="text-dim">Boot Version</span></div>
                                    <div><div id="settings-synth-wifi-version" style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);color:var(--text-faint);margin-bottom:2px">-</div><span class="text-dim">WiFi Version</span></div>
                                    <div><div id="settings-synth-device-id" style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);color:var(--text-faint);margin-bottom:2px">-</div><span class="text-dim">Device ID</span></div>
                                    <div><div id="settings-synth-midi-channel" style="background:var(--bg-deepest);border:1px solid var(--border-dim);padding:4px;border-radius:var(--radius-xs);color:var(--text-faint);margin-bottom:2px">-</div><span class="text-dim">MIDI Channel</span></div>
                                </div>
                                <div class="text-center" style="font-size:9px;color:var(--text-faint);margin-top:4px;font-style:italic">Firmware versions require official Behringer app (USB). Web MIDI reports "—" when unavailable.</div>
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
                        </div>

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

                            <div class="flex-row justify-between items-center bg-surface" style="margin-top:15px;border:1px solid var(--border);padding:10px;border-radius:var(--radius)">
                                <span class="text-uppercase text-bold text-dim" style="font-size:var(--text-md)">Device ID</span>
                                <select id="settings-device-id" class="modal-select" style="width:80px;font-size:var(--text-md);padding:2px">
                                    ${Array.from({length: 16}, (_, i) => `<option value="${i+1}">${i+1}</option>`).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="settings-panel-view" id="settings-view-misc" style="display:none">
                            <!-- ===== GLOBAL PARAMETERS (SYSEX) — HARDWARE PANEL ===== -->
                            <div class="flex-col" style="background:linear-gradient(180deg,color-mix(in srgb,var(--accent-blue) 8%,var(--bg-elevated)),var(--bg-elevated));border:2px solid color-mix(in srgb,var(--accent-blue) 25%,var(--border));border-radius:var(--radius);padding:10px;margin-bottom:12px">
                                <div class="flex-row justify-between items-center" style="border-bottom:1px solid color-mix(in srgb,var(--accent-blue) 30%,var(--border-dim));padding-bottom:6px;margin-bottom:10px">
                                    <div class="flex-row items-center gap-4">
                                        <span style="font-size:var(--text-sm);font-weight:bold;color:var(--accent-blue);text-transform:uppercase;font-family:'Share Tech Mono',monospace;letter-spacing:1px">Global Parameters</span>
                                        <span style="font-size:8px;color:var(--text-faint);background:color-mix(in srgb,var(--accent-blue) 15%,transparent);padding:1px 6px;border-radius:var(--radius-xs);font-family:'Share Tech Mono',monospace">SYSEX 8-BIT</span>
                                    </div>
                                    <span id="settings-global-status" style="font-size:8px;color:var(--text-faint);font-family:'Share Tech Mono',monospace">⏳ Waiting for Global Dump...</span>
                                </div>
                                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:var(--text-sm)">
                                    <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius-sm);padding:6px;gap:4px">
                                        <span class="text-uppercase text-dim" style="font-size:8px;font-weight:bold">MIDI Channel</span>
                                        <div class="flex-row justify-between items-center">
                                            <select id="settings-midi-channel" class="modal-select" style="width:60px;font-size:var(--text-sm);padding:1px">${Array.from({length: 16}, (_, i) => `<option ${i+1 === 1 ? 'selected' : ''}>${i+1}</option>`).join('')}</select>
                                            <span id="settings-midi-channel-hw" style="font-size:8px;color:var(--accent-green);font-family:'Share Tech Mono',monospace;visibility:hidden">✓</span>
                                        </div>
                                    </div>
                                    <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius-sm);padding:6px;gap:4px">
                                        <span class="text-uppercase text-dim" style="font-size:8px;font-weight:bold">Master Tune</span>
                                        <div class="flex-row justify-between items-center">
                                            <select id="settings-master-tune" class="modal-select" style="width:80px;font-size:var(--text-sm);padding:1px">${Array.from({length: 256}, (_, i) => { const cents = i - 128; return `<option ${cents === 0 ? 'selected' : ''}>${cents > 0 ? '+' : ''}${cents}¢</option>`; }).join('')}</select>
                                        </div>
                                    </div>
                                    <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius-sm);padding:6px;gap:4px">
                                        <span class="text-uppercase text-dim" style="font-size:8px;font-weight:bold">Transpose</span>
                                        <div class="flex-row justify-between items-center">
                                            <select id="settings-transpose" class="modal-select" style="width:60px;font-size:var(--text-sm);padding:1px">${Array.from({length: 97}, (_, i) => `<option ${i-48 === -48 ? 'selected' : ''}>${i-48}</option>`).join('')}</select>
                                        </div>
                                    </div>
                                    <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius-sm);padding:6px;gap:4px">
                                        <span class="text-uppercase text-dim" style="font-size:8px;font-weight:bold">Velocity Curve</span>
                                        <div class="flex-row items-center" style="gap:6px">
                                            <select id="settings-velocity-curve" class="modal-select" style="width:100px;font-size:var(--text-sm);padding:1px"><option value="normal">Normal</option><option value="soft">Soft</option><option value="hard">Hard</option><option value="linear">Linear</option><option value="fixed">Fixed (100)</option></select>
                                            <canvas id="velocity-curve-preview" width="80" height="30" style="flex:none;background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:2px;width:80px;height:30px"></canvas>
                                        </div>
                                    </div>
                                    <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius-sm);padding:6px;gap:4px">
                                        <span class="text-uppercase text-dim" style="font-size:8px;font-weight:bold">Pedal Polarity</span>
                                        <div class="flex-row justify-between items-center">
                                            <select id="settings-pedal-polarity" class="modal-select" style="width:100px;font-size:var(--text-sm);padding:1px"><option value="norm-open">Norm-Open</option><option value="norm-closed">Norm-Closed</option></select>
                                        </div>
                                    </div>
                                    <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius-sm);padding:6px;gap:4px">
                                        <span class="text-uppercase text-dim" style="font-size:8px;font-weight:bold">LCD Contrast</span>
                                        <div class="flex-row justify-between items-center">
                                            <input type="range" id="settings-lcd-contrast" min="0" max="100" value="70" step="1" style="width:60px;height:14px;accent-color:var(--accent-primary);cursor:pointer">
                                            <span id="settings-lcd-contrast-val" style="width:28px;text-align:center;font-size:var(--text-sm);color:var(--brand-accent)">70%</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex-row justify-end" style="margin-top:8px;gap:6px">
                                    <button id="settings-global-refresh" class="btn btn-xs btn-outline" data-accent="blue" style="font-size:9px;padding:2px 8px" data-ctrl-tooltip="Request Global Dump from hardware to refresh all global params">↻ Refresh from HW</button>
                                    <span id="settings-global-dump-status-panel" class="fade-indicator" style="font-size:8px;color:var(--accent-blue);align-self:center"></span>
                                </div>
                            </div>

                            <!-- Poly Chain Settings -->
                            <div class="flex-col bg-surface" style="border:1px solid var(--border);padding:10px;border-radius:var(--radius);margin-bottom:12px">
                                <div class="text-uppercase text-bold text-dim border-bottom" style="font-size:var(--text-md);margin-bottom:8px;padding-bottom:3px">Poly Chain Settings</div>
                                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:var(--text-base)">
                                    <div class="flex-row justify-between items-center"><span>Chain On/Off</span><input id="settings-poly-chain" type="checkbox"></div>
                                    <div class="flex-row justify-between items-center"><span>Prog Link On/Off</span><input id="settings-poly-prog-link" type="checkbox" disabled></div>
                                    <div class="flex-row justify-between items-center"><span>Key Range On/Off</span><input id="settings-poly-key-range" type="checkbox"></div>
                                    <div class="flex-row justify-between items-center"><span>Range Lower</span><div class="flex-row" style="gap:3px"><select id="settings-poly-range-lower-note" class="modal-select" style="font-size:var(--text-sm);padding:1px">${["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].map(n => `<option value="${n}">${n}</option>`).join('')}</select><select id="settings-poly-range-lower-oct" class="modal-select" style="font-size:var(--text-sm);padding:1px">${Array.from({length: 11}, (_, i) => `<option value="${i-2}">${i-2}</option>`).join('')}</select></div></div>
                                    <div></div>
                                    <div class="flex-row justify-between items-center"><span>Range Upper</span><div class="flex-row" style="gap:3px"><select id="settings-poly-range-upper-note" class="modal-select" style="font-size:var(--text-sm);padding:1px">${["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].map(n => `<option value="${n}">${n}</option>`).join('')}</select><select id="settings-poly-range-upper-oct" class="modal-select" style="font-size:var(--text-sm);padding:1px">${Array.from({length: 11}, (_, i) => `<option value="${i-2}">${i-2}</option>`).join('')}</select></div></div>
                                </div>
                            </div>

                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px">
                                <div class="flex-col bg-surface" style="border:1px solid var(--border);padding:10px;border-radius:var(--radius)">
                                    <div class="text-uppercase text-bold text-dim border-bottom" style="font-size:var(--text-md);margin-bottom:8px;padding-bottom:3px">Pedal Settings</div>
                                    <div class="flex-col" style="gap:6px;font-size:var(--text-md)">
                                        <div class="flex-row justify-between items-center"><span>Pedal</span><select id="settings-pedal-type" class="modal-select" style="width:90px;font-size:var(--text-sm);padding:1px"><option value="foot-ctrl">Foot-ctrl</option><option value="mod-wheel">Mod-Wheel</option><option value="breath">Breath</option><option value="volume">Volume</option><option value="expression">Expression</option><option value="porta-time">Porta Time</option><option value="aftertouch">Aftertouch</option></select></div>
                                        <div class="flex-row justify-between items-center"><span>Sustain</span><select id="settings-pedal-sustain" class="modal-select" style="width:90px;font-size:var(--text-sm);padding:1px"><option value="norm-open">Norm-Open</option><option value="norm-closed">Norm-Closed</option><option value="tap-no">Tap-N.O</option><option value="tap-nc">Tap-N.C</option><option value="arp-plus-gate">Arp+Gate</option><option value="arp-minus-gate">Arp-Gate</option><option value="seq-plus-gate">Seq+Gate</option><option value="seq-minus-gate">Seq-Gate</option><option value="arp-seq-plus-gate">Arp&Seq+Gate</option><option value="arp-seq-minus-gate">Arp&Seq-Gate</option></select></div>
                                        <div class="flex-row justify-between items-center"><span>Mode</span><select id="settings-pedal-sustain-mode" class="modal-select" style="width:90px;font-size:var(--text-sm);padding:1px"><option value="sustain">Sustain</option><option value="sostenuto">Sostenuto</option></select></div>
                                    </div>
                                </div>

                                <div class="flex-col bg-surface" style="border:1px solid var(--border);padding:10px;border-radius:var(--radius)">
                                    <div class="text-uppercase text-bold text-dim border-bottom" style="font-size:var(--text-md);margin-bottom:8px;padding-bottom:3px">UI & Display Settings</div>
                                    <div class="flex-col" style="gap:5px;font-size:var(--text-md)">
                                        <div class="flex-row justify-between items-center" style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border-dim)"><span>UI Theme</span><select id="settings-theme-select" class="modal-select" style="width:90px;font-size:var(--text-sm);padding:1px"><option value="default">Default</option><option value="red">Fuego</option><option value="blue">Océano</option><option value="green">Neón</option><option value="midnight">Midnight</option><option value="dark-v2">Dark V2</option><option value="light">Snow</option></select></div>
                                        <div class="flex-row justify-between items-center" style="margin-top:4px"><span title="Caracteres usados en las barras unicode del LCD para visualizar niveles, posiciones de pasos y modulación.">Bar Style</span><select id="settings-bar-style" class="modal-select" style="width:90px;font-size:var(--text-sm);padding:1px"><option value="solid">█ / ░</option><option value="dark">▓ / ░</option><option value="medium">▒ / ░</option></select></div>
                                        <div class="flex-row justify-between items-center" style="margin-top:4px"><span title="Velocidad de la transición de fundido (fade out/in) al mostrar un nuevo parámetro en el LCD. Off = sin animación de fundido.">LCD Fade Speed</span><select id="settings-fade-speed" class="modal-select" style="width:80px;font-size:var(--text-sm);padding:1px"><option value="off">Off</option><option value="fast">Fast</option><option value="normal" selected>Normal</option><option value="slow">Slow</option></select></div>
                                        <div class="flex-row justify-between items-center" style="margin-top:4px"><span title="Muestra u oculta el valor de velocidad (velocity) en el LCD cuando se pulsa una tecla.">LCD Velocity</span><select id="settings-lcd-velocity" class="modal-select" style="width:80px;font-size:var(--text-sm);padding:1px"><option value="show">Show</option><option value="hide">Hide</option></select></div>
                                        <div class="flex-row justify-between items-center" style="margin-top:4px"><span title="Tiempo que el LCD muestra el valor de un parámetro después de cambiarlo, antes de volver al estado base (patch + banco). Off = no volver automáticamente.">LCD Timeout</span><select id="settings-lcd-timeout" class="modal-select" style="width:80px;font-size:var(--text-sm);padding:1px"><option value="off">Off</option><option value="500">0.5s</option><option value="1000">1s</option><option value="2000" selected>2s</option><option value="3000">3s</option></select></div>
                                        <div class="flex-row justify-between items-center" style="margin-top:4px"><span>PB Sensitivity</span><input type="range" id="settings-pb-sensitivity" min="1" max="12" value="6" step="1" style="width:80px;height:14px;accent-color:var(--accent-primary);cursor:pointer"><span id="settings-pb-sensitivity-val" style="width:22px;text-align:center;font-size:var(--text-sm);color:var(--brand-accent)">6px</span></div>
                                        <div class="flex-row justify-between items-center" style="margin-top:4px"><span>Pitch Bend Mode</span><select id="settings-pitch-bend-mode" class="modal-select" style="width:60px;font-size:var(--text-sm);padding:1px"><option value="all">All</option><option value="held">Held</option></select></div>
                                        <div class="flex-row justify-between items-center"><span>MIDI Clock</span><select id="settings-midi-clock" class="modal-select" style="width:80px;font-size:var(--text-sm);padding:1px"><option value="internal">Internal</option><option value="external">External</option></select></div>
                                    </div>
                                </div>

                                <div class="flex-col bg-surface" style="border:1px solid var(--border);padding:10px;border-radius:var(--radius)">
                                    <div class="text-uppercase text-bold text-dim border-bottom" style="font-size:var(--text-md);margin-bottom:8px;padding-bottom:3px">Controller Response Curves</div>
                                    <div class="flex-col" style="gap:6px;font-size:var(--text-md)">
                                        <div class="flex-row justify-between items-center"><span>Aftertouch</span><select id="settings-curve-aftertouch" class="modal-select" style="width:100px;font-size:var(--text-sm);padding:1px"><option value="linear">Linear</option><option value="expo2">Quadratic (x²)</option><option value="expo3">Cubic (x³)</option><option value="log">Log (√x)</option><option value="s-curve">S-Curve</option><option value="custom">Custom</option></select></div>
                                        <div class="flex-row justify-between items-center"><span>Mod Wheel</span><select id="settings-curve-modwheel" class="modal-select" style="width:100px;font-size:var(--text-sm);padding:1px"><option value="linear">Linear</option><option value="expo2">Quadratic (x²)</option><option value="expo3">Cubic (x³)</option><option value="log">Log (√x)</option><option value="s-curve">S-Curve</option><option value="custom">Custom</option></select></div>
                                        <div class="flex-row justify-between items-center" style="margin-top:2px;padding-top:2px;border-top:1px solid var(--border-dim)"><span>Pitch Bend</span><select id="settings-curve-pitchbend" class="modal-select" style="width:100px;font-size:var(--text-sm);padding:1px"><option value="linear">Linear</option><option value="expo2">Quadratic (x·|x|)</option><option value="expo3">Cubic (x³)</option><option value="log">Log (√|x|)</option><option value="s-curve">S-Curve</option><option value="custom">Custom</option></select></div>
                                        <div class="flex-row items-center" style="gap:8px;margin-top:4px">
                                            <span class="text-uppercase" style="font-size:var(--text-2xs);color:var(--text-faint);writing-mode:vertical-lr;text-orientation:mixed">Out</span>
                                            <canvas id="curve-preview-canvas" width="180" height="70" style="flex:1;background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius-xs);max-width:180px"></canvas>
                                            <span class="text-uppercase text-right" style="font-size:var(--text-2xs);color:var(--text-faint);align-self:flex-end">In →</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="settings-panel-view" id="settings-view-midilearn" style="display:none">
                            <div class="flex-col bg-surface" style="border:1px solid var(--border);padding:10px;border-radius:var(--radius);margin-bottom:12px">
                                <div class="text-uppercase text-bold text-dim border-bottom" style="font-size:var(--text-md);margin-bottom:8px;padding-bottom:3px">MIDI Learn Mappings</div>
                                <div style="font-size:var(--text-sm);color:var(--text-dim);margin-bottom:8px">View and manage CC/NRPN → parameter mappings. Click Delete to remove a mapping.</div>
                                <div id="midi-learn-mappings-list" style="background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius-sm);min-height:100px;max-height:250px;overflow-y:auto;padding:4px">
                                    <div class="text-dim text-center" style="padding:20px;font-size:var(--text-sm)">No mappings yet. Use MIDI LEARN on the main panel to create mappings.</div>
                                </div>
                                <div class="flex-row gap-6" style="margin-top:8px">
                                    <button id="midi-learn-clear-all" class="btn btn-sm danger" style="background:color-mix(in srgb,var(--color-danger) 15%,transparent);border:1px solid var(--color-danger);color:var(--color-danger);padding:4px 12px;border-radius:var(--radius-xs);cursor:pointer">Clear All</button>
                                    <span id="midi-learn-mapping-count" style="font-size:var(--text-sm);color:var(--text-dim);align-self:center">0 mappings</span>
                                </div>
                            </div>
                            <div class="flex-col bg-surface" style="border:1px solid var(--border);padding:10px;border-radius:var(--radius)">
                                <div class="text-uppercase text-bold text-dim border-bottom" style="font-size:var(--text-md);margin-bottom:8px;padding-bottom:3px">Export / Import</div>
                                <div class="flex-row gap-8" style="font-size:var(--text-sm)">
                                    <button id="midi-learn-export" class="btn btn-sm" style="background:var(--bg-hover);border:1px solid var(--border-dim);padding:4px 12px;border-radius:var(--radius-xs);cursor:pointer">Export JSON</button>
                                    <button id="midi-learn-import" class="btn btn-sm" style="background:var(--bg-hover);border:1px solid var(--border-dim);padding:4px 12px;border-radius:var(--radius-xs);cursor:pointer">Import JSON</button>
                                    <span id="midi-learn-import-status" style="color:var(--text-dim);align-self:center;font-size:var(--text-2xs)"></span>
                                </div>
                            </div>
                        </div>

                        <div class="settings-panel-view" id="settings-view-keyboard" style="display:none">
                            <div class="flex-col" style="gap:8px">
                                <div class="text-uppercase text-bold text-dim border-bottom" style="font-size:var(--text-md);margin-bottom:4px;padding-bottom:4px">Keyboard Shortcuts</div>
                                <div style="font-size:var(--text-sm);color:var(--text-dim);margin-bottom:8px">Click a shortcut row, then press the desired key combination to rebind it.</div>
                                <div id="keyboard-shortcuts-list" style="background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius-sm);min-height:120px;overflow-y:auto;padding:4px">
                                    <div class="text-dim text-center" style="padding:20px;font-size:var(--text-sm)">Loading shortcuts...</div>
                                </div>
                                <div class="flex-row gap-6" style="margin-top:6px">
                                    <button id="keyboard-shortcuts-reset-all" class="btn btn-sm" style="background:color-mix(in srgb,var(--accent-orange) 15%,transparent);border:1px solid var(--accent-orange);color:var(--accent-orange);padding:4px 12px;border-radius:var(--radius-xs);cursor:pointer">Reset All to Default</button>
                                    <span id="keyboard-shortcuts-feedback" style="font-size:var(--text-sm);color:var(--accent-green);align-self:center;opacity:0;transition:opacity 0.3s ease">✓ Saved</span>
                                </div>
                            </div>
                        </div>

                        <div class="settings-panel-view" id="settings-view-dump" style="display:none">
                            <div class="flex-col" style="gap:8px">
                                <div class="flex-row justify-between items-center">
                                    <div class="text-uppercase text-bold" style="font-size:var(--text-md)">
                                        <span class="text-dim">Hex Decode:</span>
                                        <span id="dump-patch-name">—</span>
                                    </div>
                                    <div class="flex-row" style="gap:6px">
                                        <button class="btn btn-sm" id="dump-request-hw-btn" style="font-size:10px" title="Solicita el Edit Buffer (preset actual) al hardware DeepMind 12 vía SysEx. El resultado se muestra en el visor hexadecimal con 242 bytes desempaquetados.">⬇ Request from HW</button>
                                        <button class="btn btn-sm" id="dump-request-global-btn" style="font-size:10px">🌐 Global Dump</button>
                                        <button class="btn btn-sm" id="dump-refresh-btn" style="font-size:10px">⟳ Refresh</button>
                                        <input type="text" id="dump-search-input" placeholder="Search byte / param…" style="background:var(--bg-deepest);border:1px solid var(--border);color:var(--text-primary);padding:3px 8px;font-size:10px;border-radius:var(--radius-xs);width:160px;outline:none" />
                                    </div>
                                </div>
                                <div id="dump-byte-grid" class="dump-byte-grid" style="font-family:'Share Tech Mono',monospace;font-size:9px;line-height:1.5;background:var(--bg-deepest);border:2px solid var(--border);border-radius:var(--radius);padding:8px;overflow-y:auto;max-height:420px;min-height:300px">
                                    <div class="text-dim text-center" style="padding:40px">No data loaded. Load a preset or click Refresh.</div>
                                </div>
                                <div class="flex-row justify-between items-center" style="font-size:var(--text-xs);color:var(--text-dim);padding:0 4px">
                                    <span id="dump-byte-summary">No bytes loaded</span>
                                    <span id="dump-selection-info"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ABOUT MODAL -->
        <div class="modal-backdrop" id="about-modal-backdrop" style="display:none;z-index:99999">
            <div class="modal" data-accent="orange" style="width:420px;height:auto">
                <div class="modal-header">
                    <h2>About ABD Eep</h2>
                    <div class="close-btn" id="about-modal-close-btn">&times;</div>
                </div>
                <div class="modal-body flex-col items-center text-center" style="padding:20px;gap:15px;background:var(--bg-elevated)">
                    <div class="text-uppercase text-bold text-accent" style="font-size:20px;letter-spacing:1.5px">ABD EEP CONTROLLER</div>
                    <div class="text-uppercase text-bold" style="font-size:var(--text-md);background:color-mix(in srgb,var(--accent-primary) 15%,transparent);border:1px solid var(--accent-primary);padding:3px 8px;border-radius:var(--radius-sm);color:var(--accent-primary)">Version v0.1 | Build 100</div>
                    <p class="text-secondary" style="margin:0;font-size:var(--text-base)">Controlador y editor avanzado unificado compatible con sintetizadores de hardware de la serie Behringer DeepMind.</p>
                    <p style="margin:0;font-size:var(--text-md);color:var(--text-dim);border-top:1px solid var(--border-dim);width:100%;padding-top:12px">Desarrollado con JUCE 8 y motor Webview2. &copy; 2026 ABDSynths.</p>
                </div>
            </div>
        </div>
    `;

    class SettingsModal extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }
        }
    }
    customElements.define('settings-modal', SettingsModal);
})();

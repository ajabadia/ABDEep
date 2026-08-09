/**
 * @component settings-modal-tabs-system
 * @purpose HTML Templates for Dump, Advanced, Global settings tabs, and About modal
 * @classification UI Component Submodule
 */
(function () {
    // --- Dump Tab ---
    window.SETTINGS_TAB_DUMP = `
        <div class="settings-panel-view" id="settings-view-dump" style="display:none">
            <div class="flex-col" style="gap:8px">
                <div class="flex-row justify-between items-center">
                    <div class="text-uppercase text-bold" style="font-size:var(--text-md)">
                        <span class="text-dim">Hex Decode:</span>
                        <span id="dump-patch-name">\u2014</span>
                    </div>
                    <div class="flex-row" style="gap:6px">
                        <button class="btn btn-sm" id="dump-request-hw-btn" style="font-size:10px" title="Request Edit Buffer (preset) from DeepMind 12 via SysEx. Shows 242 unpacked bytes.">\u2b07 Request from HW</button>
                        <button class="btn btn-sm" id="dump-request-global-btn" style="font-size:10px">\ud83c\udf10 Global Dump</button>
                        <button class="btn btn-sm" id="dump-refresh-btn" style="font-size:10px">\u27f3 Refresh</button>
                        <input type="text" id="dump-search-input" placeholder="Search byte / param\u2026" style="background:var(--bg-deepest);border:1px solid var(--border);color:var(--text-primary);padding:3px 8px;font-size:10px;border-radius:var(--radius-xs);width:160px;outline:none" />
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
        </div>`;

    // --- Advanced Tab ---
    window.SETTINGS_TAB_ADVANCED = `
        <div class="settings-panel-view" id="settings-view-advanced" style="display:none">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;text-align:center">
                <div class="flex-col bg-surface" style="border:1px solid var(--border);padding:10px;border-radius:var(--radius)">
                    <div class="text-uppercase text-bold text-dim border-bottom" style="font-size:var(--text-md);margin-bottom:8px;padding-bottom:3px">DSP Quality</div>
                    <div class="flex-col" style="gap:8px">
                        <div class="flex-row justify-between items-center" style="font-size:var(--text-md)"><span>VCF Oversample</span><select id="settings-vcf-oversample" class="modal-select" style="width:80px;font-size:var(--text-sm);padding:1px"><option value="0">1x (Off)</option><option value="1">2x</option><option value="2">4x</option></select></div>
                        <div class="flex-row justify-between items-center" style="font-size:var(--text-md)"><span>VCF Voicing</span><select id="settings-vcf-voicing" class="modal-select" style="width:100px;font-size:var(--text-sm);padding:1px"><option value="0">DeepMind</option><option value="1">Juno-106</option></select></div>
                    </div>
                    <div style="font-size:var(--text-xs);color:var(--text-dim);margin-top:6px;text-align:left">Higher oversampling reduces filter aliasing at CPU cost. 2x recommended; 4x is heavy.</div>
                </div>
                <div class="flex-col bg-surface" style="border:1px solid var(--border);padding:10px;border-radius:var(--radius)">
                    <div class="text-uppercase text-bold text-dim border-bottom" style="font-size:var(--text-md);margin-bottom:8px;padding-bottom:3px">Build Info</div>
                    <div class="flex-col" style="gap:6px;font-size:var(--text-md);text-align:left">
                        <div class="flex-row justify-between"><span class="text-dim">Target Model</span><span id="settings-build-model" style="font-family:'Share Tech Mono',monospace">\u2014</span></div>
                        <div class="flex-row justify-between"><span class="text-dim">DSP Engine</span><span id="settings-dsp-engine" style="font-family:'Share Tech Mono',monospace">TPT ZDF + PolyBLEP</span></div>
                        <div class="flex-row justify-between"><span class="text-dim">Max Voices</span><span id="settings-max-voices" style="font-family:'Share Tech Mono',monospace">12</span></div>
                    </div>
                </div>
            </div>
            <div class="flex-col bg-surface" style="border:1px solid var(--border);padding:10px;border-radius:var(--radius);margin-top:15px;text-align:left">
                <div class="text-uppercase text-bold text-dim border-bottom" style="font-size:var(--text-md);margin-bottom:8px;padding-bottom:3px">Calibration</div>
                <div class="flex-row items-center" style="gap:10px;margin-bottom:8px">
                    <button id="settings-cal-export-btn" class="btn btn-sm" style="font-size:var(--text-sm);padding:3px 12px">Export JSON</button>
                    <button id="settings-cal-import-btn" class="btn btn-sm" style="font-size:var(--text-sm);padding:3px 12px">Import JSON</button>
                    <input type="file" id="settings-cal-file-input" accept=".json" style="display:none" />
                    <span id="settings-cal-status" style="font-size:var(--text-xs);color:var(--text-dim);margin-left:8px"></span>
                </div>
                <div id="settings-cal-preview" style="font-family:'Share Tech Mono',monospace;font-size:9px;line-height:1.4;background:var(--bg-deepest);border:1px solid var(--border);border-radius:var(--radius-xs);padding:6px;max-height:120px;overflow-y:auto;color:var(--text-secondary);display:none"></div>
            </div>
            <div class="flex-col bg-surface" style="border:1px solid var(--border);padding:10px;border-radius:var(--radius);margin-top:15px;text-align:left">
                <div class="text-uppercase text-bold text-dim border-bottom" style="font-size:var(--text-md);margin-bottom:8px;padding-bottom:3px">DSP Calibration Constants</div>
                <div style="font-size:var(--text-xs);color:var(--text-dim);margin-bottom:6px">Read-only snapshot of the VCF voicing and master soft-clip calibration constants (F3-4).</div>
                <div id="settings-dsp-calibration" style="font-family:'Share Tech Mono',monospace;font-size:9px;line-height:1.5;background:var(--bg-deepest);border:1px solid var(--border);border-radius:var(--radius-xs);padding:6px;max-height:180px;overflow-y:auto;color:var(--text-secondary)"></div>
            </div>
            <div class="flex-col bg-surface" style="border:1px solid var(--border);padding:10px;border-radius:var(--radius);margin-top:15px;text-align:left">
                <div class="text-uppercase text-bold text-dim border-bottom" style="font-size:var(--text-md);margin-bottom:8px;padding-bottom:3px">FX Presets</div>
                <div class="flex-row items-center" style="gap:10px;margin-bottom:8px">
                    <span id="settings-fx-preset-count" style="font-size:var(--text-sm);color:var(--text-secondary);font-family:'Share Tech Mono',monospace">0 presets</span>
                    <span id="settings-fx-preset-size" style="font-size:var(--text-xs);color:var(--text-dim)">\u2014</span>
                </div>
                <div class="flex-row items-center" style="gap:10px">
                    <button id="settings-fx-preset-export-btn" class="btn btn-sm" style="font-size:var(--text-sm);padding:3px 12px">Export JSON</button>
                    <button id="settings-fx-preset-import-btn" class="btn btn-sm" style="font-size:var(--text-sm);padding:3px 12px">Import JSON</button>
                    <input type="file" id="settings-fx-preset-file-input" accept=".json" style="display:none" />
                    <button id="settings-fx-preset-clear-btn" class="btn btn-sm" style="font-size:var(--text-sm);padding:3px 12px;color:var(--accent-red)">Clear All</button>
                    <span id="settings-fx-preset-status" style="font-size:var(--text-xs);color:var(--text-dim);margin-left:8px"></span>
                </div>
            </div>
        </div>`;

    // --- Global Tab ---
    window.SETTINGS_TAB_GLOBAL = `
        <div class="settings-panel-view" id="settings-view-global" style="display:none">
            <div class="flex-col" style="background:linear-gradient(180deg,color-mix(in srgb,var(--accent-blue) 8%,var(--bg-elevated)),var(--bg-elevated));border:2px solid color-mix(in srgb,var(--accent-blue) 25%,var(--border));border-radius:var(--radius);padding:10px;margin-bottom:12px">
                <div class="flex-row justify-between items-center" style="border-bottom:1px solid color-mix(in srgb,var(--accent-blue) 30%,var(--border-dim));padding-bottom:6px;margin-bottom:10px">
                    <div class="flex-row items-center gap-4">
                        <span style="font-size:var(--text-sm);font-weight:bold;color:var(--accent-blue);text-transform:uppercase;font-family:'Share Tech Mono',monospace;letter-spacing:1px">Global Parameters</span>
                        <span style="font-size:8px;color:var(--text-faint);background:color-mix(in srgb,var(--accent-blue) 15%,transparent);padding:1px 6px;border-radius:var(--radius-xs);font-family:'Share Tech Mono',monospace">SYSEX 8-BIT</span>
                    </div>
                    <span id="settings-global-status" style="font-size:8px;color:var(--text-faint);font-family:'Share Tech Mono',monospace">\u23f3 Waiting for Global Dump...</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:var(--text-sm)">
                    <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius-sm);padding:6px;gap:4px">
                        <span class="text-uppercase text-dim" style="font-size:8px;font-weight:bold">Device ID</span>
                        <div class="flex-row justify-between items-center">
                            <select id="settings-device-id" class="modal-select" style="width:80px;font-size:var(--text-sm);padding:1px">${Array.from({length: 16}, (_, i) => '<option value="' + (i+1) + '">' + (i+1) + '</option>').join('')}</select>
                        </div>
                    </div>
                    <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius-sm);padding:6px;gap:4px">
                        <span class="text-uppercase text-dim" style="font-size:8px;font-weight:bold">MIDI Channel</span>
                        <div class="flex-row justify-between items-center">
                            <select id="settings-midi-channel" class="modal-select" style="width:60px;font-size:var(--text-sm);padding:1px">${Array.from({length: 16}, (_, i) => '<option ' + ((i+1) === 1 ? 'selected' : '') + '>' + (i+1) + '</option>').join('')}</select>
                            <span id="settings-midi-channel-hw" style="font-size:8px;color:var(--accent-green);font-family:'Share Tech Mono',monospace;visibility:hidden">\u2713</span>
                        </div>
                    </div>
                    <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius-sm);padding:6px;gap:4px">
                        <span class="text-uppercase text-dim" style="font-size:8px;font-weight:bold">Master Tune</span>
                        <div class="flex-row justify-between items-center">
                            <select id="settings-master-tune" class="modal-select" style="width:80px;font-size:var(--text-sm);padding:1px">${Array.from({length: 256}, (_, i) => { const cents = i - 128; return '<option ' + (cents === 0 ? 'selected' : '') + '>' + (cents > 0 ? '+' : '') + cents + '\u00a2</option>'; }).join('')}</select>
                        </div>
                    </div>
                    <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius-sm);padding:6px;gap:4px">
                        <span class="text-uppercase text-dim" style="font-size:8px;font-weight:bold">Transpose</span>
                        <div class="flex-row justify-between items-center">
                            <select id="settings-transpose" class="modal-select" style="width:60px;font-size:var(--text-sm);padding:1px">${Array.from({length: 97}, (_, i) => '<option ' + ((i-48) === -48 ? 'selected' : '') + '>' + (i-48) + '</option>').join('')}</select>
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
                    <button id="settings-global-refresh" class="btn btn-xs btn-outline" data-accent="blue" style="font-size:9px;padding:2px 8px" data-ctrl-tooltip="Request Global Dump from hardware to refresh global params">\u21bb Refresh from HW</button>
                    <span id="settings-global-dump-status-panel" class="fade-indicator" style="font-size:8px;color:var(--accent-blue);align-self:center"></span>
                </div>
            </div>
        </div>`;

    // --- About Modal ---
    window.SETTINGS_ABOUT_MODAL = `
        <div class="modal-backdrop" id="about-modal-backdrop" style="display:none;z-index:99999">
            <div class="modal" data-accent="orange" style="width:420px;height:auto">
                <div class="modal-header">
                    <h2>About ABD Eep</h2>
                    <div class="close-btn" id="about-modal-close-btn">&times;</div>
                </div>
                <div class="modal-body flex-col items-center text-center" style="padding:20px;gap:15px;background:var(--bg-elevated)">
                    <div class="text-uppercase text-bold text-accent" style="font-size:20px;letter-spacing:1.5px">ABD EEP CONTROLLER</div>
                    <div id="about-build-label" class="text-uppercase text-bold" style="font-size:var(--text-md);background:color-mix(in srgb,var(--accent-primary) 15%,transparent);border:1px solid var(--accent-primary);padding:3px 8px;border-radius:var(--radius-sm);color:var(--accent-primary)">Version v0.1 | Build 100</div>
                    <p class="text-secondary" style="margin:0;font-size:var(--text-base)">Controlador y editor avanzado unificado compatible con sintetizadores de hardware de la serie Behringer DeepMind.</p>
                    <p style="margin:0;font-size:var(--text-md);color:var(--text-dim);border-top:1px solid var(--border-dim);width:100%;padding-top:12px">Desarrollado con JUCE 8 y motor Webview2. &copy; 2026 ABDSynths.</p>
                </div>
            </div>
        </div>`;
})();

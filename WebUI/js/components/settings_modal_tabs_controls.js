/**
 * @component settings-modal-tabs-controls
 * @purpose HTML Templates for Misc, MIDI Learn, and Keyboard settings tabs
 * @classification UI Component Submodule
 */
(function () {
    // --- Misc Tab ---
    window.SETTINGS_TAB_MISC = `
        <div class="settings-panel-view" id="settings-view-misc" style="display:none">
            <div class="flex-col bg-surface" style="border:1px solid var(--border);padding:10px;border-radius:var(--radius);margin-bottom:12px">
                <div class="text-uppercase text-bold text-dim border-bottom" style="font-size:var(--text-md);margin-bottom:8px;padding-bottom:3px">Poly Chain Settings</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:var(--text-base)">
                    <div class="flex-row justify-between items-center"><span>Chain On/Off</span><input id="settings-poly-chain" type="checkbox"></div>
                    <div class="flex-row justify-between items-center"><span>Prog Link On/Off</span><input id="settings-poly-prog-link" type="checkbox" disabled></div>
                    <div class="flex-row justify-between items-center"><span>Key Range On/Off</span><input id="settings-poly-key-range" type="checkbox"></div>
                    <div class="flex-row justify-between items-center"><span>Range Lower</span><div class="flex-row" style="gap:3px"><select id="settings-poly-range-lower-note" class="modal-select" style="font-size:var(--text-sm);padding:1px">${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(n => '<option value="' + n + '">' + n + '</option>').join('')}</select><select id="settings-poly-range-lower-oct" class="modal-select" style="font-size:var(--text-sm);padding:1px">${Array.from({length: 11}, (_, i) => '<option value="' + (i-2) + '">' + (i-2) + '</option>').join('')}</select></div></div>
                    <div></div>
                    <div class="flex-row justify-between items-center"><span>Range Upper</span><div class="flex-row" style="gap:3px"><select id="settings-poly-range-upper-note" class="modal-select" style="font-size:var(--text-sm);padding:1px">${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(n => '<option value="' + n + '">' + n + '</option>').join('')}</select><select id="settings-poly-range-upper-oct" class="modal-select" style="font-size:var(--text-sm);padding:1px">${Array.from({length: 11}, (_, i) => '<option value="' + (i-2) + '">' + (i-2) + '</option>').join('')}</select></div></div>
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
                        <div class="flex-row justify-between items-center" style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border-dim)"><span>UI Theme</span><select id="settings-theme-select" class="modal-select" style="width:90px;font-size:var(--text-sm);padding:1px"><option value="default">Default</option><option value="red">Fuego</option><option value="blue">Oc\u00e9ano</option><option value="green">Ne\u00f3n</option><option value="midnight">Midnight</option><option value="dark-v2">Dark V2</option><option value="light">Snow</option><option value="juno-106">Juno-106</option></select></div>
                        <div class="flex-row justify-between items-center" style="margin-top:4px"><span title="Bar Style">Bar Style</span><select id="settings-bar-style" class="modal-select" style="width:90px;font-size:var(--text-sm);padding:1px"><option value="solid">\u2588 / \u2591</option><option value="dark">\u2593 / \u2591</option><option value="medium">\u2592 / \u2591</option></select></div>
                        <div class="flex-row justify-between items-center" style="margin-top:4px"><span title="LCD Fade Speed">LCD Fade Speed</span><select id="settings-fade-speed" class="modal-select" style="width:80px;font-size:var(--text-sm);padding:1px"><option value="off">Off</option><option value="fast">Fast</option><option value="normal" selected>Normal</option><option value="slow">Slow</option></select></div>
                        <div class="flex-row justify-between items-center" style="margin-top:4px"><span title="LCD Velocity display">LCD Velocity</span><select id="settings-lcd-velocity" class="modal-select" style="width:80px;font-size:var(--text-sm);padding:1px"><option value="show">Show</option><option value="hide">Hide</option></select></div>
                        <div class="flex-row justify-between items-center" style="margin-top:4px"><span title="LCD Timeout">LCD Timeout</span><select id="settings-lcd-timeout" class="modal-select" style="width:80px;font-size:var(--text-sm);padding:1px"><option value="off">Off</option><option value="500">0.5s</option><option value="1000">1s</option><option value="2000" selected>2s</option><option value="3000">3s</option></select></div>
                        <div class="flex-row justify-between items-center" style="margin-top:4px"><span>PB Sensitivity</span><input type="range" id="settings-pb-sensitivity" min="1" max="12" value="6" step="1" style="width:80px;height:14px;accent-color:var(--accent-primary);cursor:pointer"><span id="settings-pb-sensitivity-val" style="width:22px;text-align:center;font-size:var(--text-sm);color:var(--brand-accent)">6px</span></div>
                        <div class="flex-row justify-between items-center" style="margin-top:4px"><span>Pitch Bend Mode</span><select id="settings-pitch-bend-mode" class="modal-select" style="width:60px;font-size:var(--text-sm);padding:1px"><option value="all">All</option><option value="held">Held</option></select></div>
                        <div class="flex-row justify-between items-center"><span>MIDI Clock</span><select id="settings-midi-clock" class="modal-select" style="width:80px;font-size:var(--text-sm);padding:1px"><option value="internal">Internal</option><option value="external">External</option></select></div>
                    </div>
                </div>

                <div class="flex-col bg-surface" style="border:1px solid var(--border);padding:10px;border-radius:var(--radius)">
                    <div class="text-uppercase text-bold text-dim border-bottom" style="font-size:var(--text-md);margin-bottom:8px;padding-bottom:3px">Controller Response Curves</div>
                    <div class="flex-col" style="gap:6px;font-size:var(--text-md)">
                        <div class="flex-row justify-between items-center"><span>Aftertouch</span><select id="settings-curve-aftertouch" class="modal-select" style="width:100px;font-size:var(--text-sm);padding:1px"><option value="linear">Linear</option><option value="expo2">Quadratic (x\u00b2)</option><option value="expo3">Cubic (x\u00b3)</option><option value="log">Log (\u221ax)</option><option value="s-curve">S-Curve</option><option value="custom">Custom</option></select></div>
                        <div class="flex-row justify-between items-center"><span>Mod Wheel</span><select id="settings-curve-modwheel" class="modal-select" style="width:100px;font-size:var(--text-sm);padding:1px"><option value="linear">Linear</option><option value="expo2">Quadratic (x\u00b2)</option><option value="expo3">Cubic (x\u00b3)</option><option value="log">Log (\u221ax)</option><option value="s-curve">S-Curve</option><option value="custom">Custom</option></select></div>
                        <div class="flex-row justify-between items-center" style="margin-top:2px;padding-top:2px;border-top:1px solid var(--border-dim)"><span>Pitch Bend</span><select id="settings-curve-pitchbend" class="modal-select" style="width:100px;font-size:var(--text-sm);padding:1px"><option value="linear">Linear</option><option value="expo2">Quadratic (x\u00b7|x|)</option><option value="expo3">Cubic (x\u00b3)</option><option value="log">Log (\u221a|x|)</option><option value="s-curve">S-Curve</option><option value="custom">Custom</option></select></div>
                        <div class="flex-row items-center" style="gap:8px;margin-top:4px">
                            <span class="text-uppercase" style="font-size:var(--text-2xs);color:var(--text-faint);writing-mode:vertical-lr;text-orientation:mixed">Out</span>
                            <canvas id="curve-preview-canvas" width="180" height="70" style="flex:1;background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius-xs);max-width:180px"></canvas>
                            <span class="text-uppercase text-right" style="font-size:var(--text-2xs);color:var(--text-faint);align-self:flex-end">In \u2192</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    // --- MIDI Learn Tab ---
    window.SETTINGS_TAB_MIDILEARN = `
        <div class="settings-panel-view" id="settings-view-midilearn" style="display:none">
            <div class="flex-col bg-surface" style="border:1px solid var(--border);padding:10px;border-radius:var(--radius);margin-bottom:12px">
                <div class="text-uppercase text-bold text-dim border-bottom" style="font-size:var(--text-md);margin-bottom:8px;padding-bottom:3px">MIDI Learn Mappings</div>
                <div style="font-size:var(--text-sm);color:var(--text-dim);margin-bottom:8px">View and manage CC/NRPN \u2192 parameter mappings. Click Delete to remove a mapping.</div>
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
        </div>`;

    // --- Keyboard Tab ---
    window.SETTINGS_TAB_KEYBOARD = `
        <div class="settings-panel-view" id="settings-view-keyboard" style="display:none">
            <div class="flex-col" style="gap:8px">
                <div class="text-uppercase text-bold text-dim border-bottom" style="font-size:var(--text-md);margin-bottom:4px;padding-bottom:4px">Keyboard Shortcuts</div>
                <div style="font-size:var(--text-sm);color:var(--text-dim);margin-bottom:8px">Click a shortcut row, then press the desired key combination to rebind it.</div>
                <div id="keyboard-shortcuts-list" style="background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius-sm);min-height:120px;overflow-y:auto;padding:4px">
                    <div class="text-dim text-center" style="padding:20px;font-size:var(--text-sm)">Loading shortcuts...</div>
                </div>
                <div class="flex-row gap-6" style="margin-top:6px">
                    <button id="keyboard-shortcuts-reset-all" class="btn btn-sm" style="background:color-mix(in srgb,var(--accent-orange) 15%,transparent);border:1px solid var(--accent-orange);color:var(--accent-orange);padding:4px 12px;border-radius:var(--radius-xs);cursor:pointer">Reset All to Default</button>
                    <span id="keyboard-shortcuts-feedback" style="font-size:var(--text-sm);color:var(--accent-green);align-self:center;opacity:0;transition:opacity 0.3s ease">\u2713 Saved</span>
                </div>
            </div>
        </div>`;
})();

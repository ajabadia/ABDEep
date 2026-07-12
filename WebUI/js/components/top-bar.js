/**
 * @component TopBar
 * @purpose Web Component para la barra de navegación superior (File/Edit/View)
 * @classification UI Component
 * @complexity Low
 */
(function() {
    const template = `
        <header id="top-bar">
            <div class="menu-nav">
                <div class="menu-item">
                    File
                    <ul class="dropdown">
                        <li id="menu-bank-manager" class="text-bold text-accent">Bank Manager...</li>
                        <li class="divider"></li>
                        <li id="menu-dump-midi">MIDI Dump...</li>
                        <li id="menu-save">Save Patch</li>
                        <li id="menu-save-as">Save Patch As...</li>
                    </ul>
                </div>
                <div class="menu-item">
                    Edit
                    <ul class="dropdown">
                        <li id="menu-copy-preset">Copy Preset <span class="text-faint float-right">Ctrl+C</span></li>
                        <li id="menu-paste-preset">Paste Preset <span class="text-faint float-right">Ctrl+V</span></li>
                        <li class="divider"></li>
                        <li id="menu-undo">Undo <span class="text-faint float-right">Ctrl+Z</span></li>
                        <li id="menu-redo">Redo <span class="text-faint float-right">Ctrl+Y</span></li>
                        <li class="divider"></li>
                        <li id="menu-midi-learn">MIDI Learn <span class="text-faint float-right">Ctrl+L</span></li>
                        <li class="divider"></li>
                        <li id="menu-properties">Settings...</li>
                    </ul>
                </div>
                <div class="menu-item">
                    View
                    <ul class="dropdown">
                        <li class="text-faint" style="font-size:var(--text-sm);cursor:default;padding:4px 16px;text-transform:uppercase">Theme</li>
                        <li id="menu-theme-default" class="theme-option"><span class="theme-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff9900;margin-right:8px;vertical-align:middle"></span>Default</li>
                        <li id="menu-theme-red" class="theme-option"><span class="theme-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff2a2a;margin-right:8px;vertical-align:middle"></span>Fuego</li>
                        <li id="menu-theme-blue" class="theme-option"><span class="theme-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#0088ff;margin-right:8px;vertical-align:middle"></span>Océano</li>
                        <li id="menu-theme-green" class="theme-option"><span class="theme-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#00ff66;margin-right:8px;vertical-align:middle"></span>Neón</li>
                        <li id="menu-theme-midnight" class="theme-option"><span class="theme-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#7744ff;margin-right:8px;vertical-align:middle"></span>Midnight</li>
                        <li id="menu-theme-dark-v2" class="theme-option"><span class="theme-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#9933ff;margin-right:8px;vertical-align:middle"></span>Dark V2</li>
                        <li id="menu-theme-light" class="theme-option"><span class="theme-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#0284c7;margin-right:8px;vertical-align:middle"></span>Snow</li>
                        <li id="menu-theme-juno" class="theme-option"><span class="theme-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ea212d;margin-right:8px;vertical-align:middle"></span>Juno-106</li>
                        <li class="divider"></li>
                        <li id="menu-debug-unison">Debug: Unison Stacking...</li>
                        <li class="divider"></li>
                        <li id="menu-keyboard-shortcuts">Keyboard Shortcuts <span class="text-faint float-right">?</span></li>
                        <li class="divider"></li>
                        <li id="menu-about">About ABD Eep...</li>
                    </ul>
                </div>
            </div>
            <div id="app-title-mini">ABD EEP CONTROLLER</div>
            <!-- Controller overlay permanente -->
            <div id="ctrl-overlay">
                <div class="ctrl-overlay-item" data-ctrl="pb">
                    <span class="ctrl-overlay-label">PB</span>
                    <div class="ctrl-overlay-track">
                        <div class="ctrl-overlay-fill" id="ctrl-o-pb-fill" style="left:50%;width:0%"></div>
                        <div class="ctrl-overlay-center"></div>
                    </div>
                    <span class="ctrl-overlay-value" id="ctrl-o-pb-val">+0.00</span>
                </div>
                <div class="ctrl-overlay-item" data-ctrl="mw">
                    <span class="ctrl-overlay-label">MW</span>
                    <div class="ctrl-overlay-track ctrl-overlay-track-mono">
                        <div class="ctrl-overlay-fill" id="ctrl-o-mw-fill" style="width:0%"></div>
                    </div>
                    <span class="ctrl-overlay-value" id="ctrl-o-mw-val">0%</span>
                </div>
                <div class="ctrl-overlay-item" data-ctrl="at">
                    <span class="ctrl-overlay-label">AT</span>
                    <div class="ctrl-overlay-track ctrl-overlay-track-mono">
                        <div class="ctrl-overlay-fill" id="ctrl-o-at-fill" style="width:0%"></div>
                    </div>
                    <span class="ctrl-overlay-value" id="ctrl-o-at-val">0%</span>
                </div>
            </div>
            <div id="keyboard-shortcuts-icon" style="width:16px;height:16px;border-radius:3px;background:var(--bg-hover);border:1px solid var(--border-dim);color:var(--text-faint);font-size:10px;font-weight:bold;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all 0.15s ease;margin:0 4px;line-height:1" data-ctrl-tooltip="Keyboard Shortcuts">⌨</div>
            <div id="midi-activity-led" style="width:6px;height:6px;border-radius:50%;background:var(--accent-green);margin:0;opacity:0.15;flex-shrink:0;transition:opacity 0.05s linear, box-shadow 0.05s linear;box-shadow:none" data-ctrl-tooltip="MIDI Activity"></div>
            <button id="reconnect-hw-btn" style="display:none;font-size:8.5px;font-weight:bold;padding:1px 6px;border-radius:3px;border:1px solid var(--accent-red);background:rgba(234,33,45,0.12);color:var(--accent-red);cursor:pointer;margin:0 4px;height:16px;line-height:1;box-shadow:0 0 5px rgba(234,33,45,0.2);animation:heartbeat-pulse 1.2s infinite ease-in-out;flex-shrink:0" data-ctrl-tooltip="Hardware Synth disconnected. Click to re-connect.">RE-CONNECT HARDWARE</button>
            <div id="midi-connection-indicator" style="width:10px;height:10px;border-radius:50%;background:var(--color-danger);margin:0 6px 0 4px;transition:all 0.3s ease;box-shadow:0 0 4px var(--color-danger);flex-shrink:0" data-ctrl-tooltip="MIDI: Disconnected"></div>
        </header>
    `;

    class TopBar extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }
        }
    }
    customElements.define('top-bar', TopBar);
})();

/**
 * @component bank-manager-modal
 * @purpose Bank & Preset Manager + Save As modals
 * @classification UI Component
 */
(function() {
    const template = `
        <!-- BANK MANAGER MODAL -->
        <div class="modal-backdrop" id="browser-modal-backdrop" style="display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999999;background:rgba(10,11,13,0.96)">
            <div class="modal" style="width:1024px;height:680px">
                <div class="modal-header">
                    <h2>Bank & Preset Manager (Dual Container)</h2>
                    <div class="close-btn" id="browser-close-btn">&times;</div>
                </div>
                <div class="modal-body" style="display:grid;grid-template-columns:1fr 1fr;gap:15px;overflow:hidden">
                    
                    <div class="dual-bank-panel flex-col bg-surface" style="border:1.5px solid var(--border);border-radius:var(--radius-md);padding:10px;overflow:hidden">
                        <span class="text-uppercase text-bold text-accent" style="font-size:var(--text-base);margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border-dim)">Hardware / Synth Device</span>
                        
                        <div class="flex-row gap-6 flex-wrap" style="margin-bottom:10px">
                            <button class="manager-btn" id="hw-bank-a-btn">Bank A</button>
                            <button class="manager-btn" id="hw-bank-b-btn">Bank B</button>
                            <button class="manager-btn" id="hw-bank-c-btn">Bank C</button>
                            <button class="manager-btn" id="hw-bank-d-btn">Bank D</button>
                            <button class="manager-btn" id="hw-bank-e-btn">Bank E</button>
                            <button class="manager-btn" id="hw-bank-f-btn">Bank F</button>
                            <button class="manager-btn" id="hw-bank-g-btn">Bank G</button>
                            <button class="manager-btn" id="hw-bank-h-btn">Bank H</button>
                        </div>
                        
                        <div class="flex-row gap-6 border-bottom" style="margin-bottom:10px;padding-bottom:10px">
                            <button class="manager-btn" id="hw-dump-to-synth" data-accent="green" style="background:color-mix(in srgb,var(--accent-green) 10%,transparent);border-color:var(--accent-green);color:var(--accent-green)">Dump to Synth</button>
                            <button class="manager-btn" id="hw-fetch-from-synth" style="background:color-mix(in srgb,var(--accent-blue) 10%,transparent);border-color:var(--accent-blue);color:var(--accent-blue)">Fetch Bank</button>
                        </div>

                        <div class="patches-grid flex-1 overflow-y-auto" id="hw-patches-grid" style="display:grid;grid-template-columns:1fr;gap:4px"></div>
                    </div>

                    <div class="dual-bank-panel flex-col bg-surface" style="border:1.5px solid var(--border);border-radius:var(--radius-md);padding:10px;overflow:hidden">
                        <span class="text-uppercase text-bold text-accent" style="font-size:var(--text-base);margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border-dim)">Local Library</span>
                        
                        <div class="flex-row gap-6 items-center" style="margin-bottom:10px">
                            <select id="local-bank-select" class="modal-select" style="flex:1;font-size:var(--text-base);padding:4px"></select>
                            <button class="manager-btn btn-sm" id="mngr-create-bank">New</button>
                            <button class="manager-btn btn-sm" id="mngr-rename-bank">Rename</button>
                            <button class="manager-btn btn-sm danger" id="mngr-delete-bank">Delete</button>
                        </div>

                        <div class="flex-row gap-6 border-bottom" style="margin-bottom:10px;padding-bottom:10px">
                            <button class="manager-btn" id="mngr-import-sysex" style="background:color-mix(in srgb,var(--accent-primary) 15%,transparent);border-color:var(--accent-primary);color:var(--text-primary)">Import Bank (.syx)</button>
                            <button class="manager-btn" id="mngr-export-sysex">Export Bank (.syx)</button>
                        </div>

                        <div class="flex-row gap-4" style="margin-bottom:6px">
                            <input type="text" id="browser-search-input" placeholder="🔍 Search patches by name…" style="flex:1;background:var(--bg-deepest);border:1px solid var(--border);color:var(--text-primary);padding:4px 8px;font-size:10px;border-radius:var(--radius-xs);outline:none">
                            <button class="manager-btn btn-sm" id="browser-search-clear" style="font-size:9px;padding:3px 8px">✕ Clear</button>
                            <button class="manager-btn btn-sm" id="browser-view-toggle" title="Toggle grid/list view" style="font-size:10px;padding:3px 6px;min-width:28px">⊞</button>
                        </div>

                        <div class="flex-row gap-3 flex-wrap" id="browser-category-filters" style="margin-bottom:6px;min-height:20px">
                            <span class="cat-filter active" data-cat="">All</span>
                            <span class="cat-filter" data-cat="Bass">Bass</span>
                            <span class="cat-filter" data-cat="Lead">Lead</span>
                            <span class="cat-filter" data-cat="Pad">Pad</span>
                            <span class="cat-filter" data-cat="FX">FX</span>
                            <span class="cat-filter" data-cat="Keys">Keys</span>
                            <span class="cat-filter" data-cat="Perc">Perc</span>
                            <span class="cat-filter" data-cat="Synth">Synth</span>
                            <span class="cat-filter" data-cat="Other">Other</span>
                        </div>

                        <div class="patches-grid flex-1 overflow-y-auto" id="browser-patches-grid" style="display:grid;grid-template-columns:1fr;gap:4px"></div>
                    </div>
                </div>
            </div>
        </div>

        <style>
        .cat-filter {
            font-size:9px;padding:1px 6px;border-radius:8px;
            cursor:pointer;background:var(--bg-header,#222);
            color:var(--text-dim,#888);border:1px solid var(--border-dim,#333);
            transition:all 0.15s;user-select:none;white-space:nowrap;line-height:16px;
        }
        .cat-filter:hover {
            color:var(--text-primary,#ddd);border-color:var(--brand-accent,#ff9900);
        }
        .cat-filter.active {
            background:color-mix(in srgb,var(--brand-accent,#ff9900) 25%,transparent);
            color:var(--brand-accent,#ff9900);border-color:var(--brand-accent,#ff9900);
        }
        </style>

        <!-- SAVE AS MODAL -->
        <div class="modal-backdrop" id="saveas-modal-backdrop" style="display:none;z-index:11000">
            <div class="modal" data-accent="orange" style="width:820px;height:580px">
                <div class="modal-header">
                    <h2>Save Patch As (Select Destination)</h2>
                    <div class="close-btn" id="saveas-close-btn">&times;</div>
                </div>
                
                <div class="flex-row gap-15" style="padding:15px;overflow:hidden;flex:1">
                    <div class="flex-col bg-surface" style="width:200px;border:1px solid var(--border-dim);border-radius:var(--radius);padding:8px">
                        <span class="text-uppercase text-bold text-dim" style="font-size:var(--text-sm);margin-bottom:5px">1. Select Bank</span>
                        <div id="saveas-banks-list" class="flex-col gap-4 overflow-y-auto flex-1"></div>
                    </div>
                    <div class="flex-col bg-surface flex-1" style="border:1px solid var(--border-dim);border-radius:var(--radius);padding:8px">
                        <span class="text-uppercase text-bold text-dim" style="font-size:var(--text-sm);margin-bottom:5px">2. Select Destination Slot</span>
                        <div id="saveas-slots-grid" class="flex-1 overflow-y-auto" style="display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:28px;gap:4px"></div>
                    </div>
                </div>

                <div class="modal-footer justify-between">
                    <div class="flex-row gap-10 items-center flex-1">
                        <span class="text-uppercase text-bold" style="font-size:var(--text-base);color:var(--text-dim)">Patch Name:</span>
                        <input type="text" id="saveas-preset-name" class="modal-input" style="width:60%" placeholder="My Custom Patch">
                    </div>
                    <div class="flex-row gap-10">
                        <button class="manager-btn" id="saveas-btn-cancel" style="background:var(--bg-hover);color:var(--text-primary)">Cancel</button>
                        <button class="manager-btn btn-solid" id="saveas-btn-confirm" style="padding:6px 20px;font-size:var(--text-base)">Save Patch</button>
                    </div>
                </div>
            </div>
        </div>
        <!-- PASTE SYSEX EDITOR MODAL -->
        <div class="modal-backdrop" id="paste-sysex-modal-backdrop" style="display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:999999999;background:rgba(10,11,13,0.98)">
            <div class="modal" data-accent="teal" style="width:640px;height:460px;display:flex;flex-direction:column">
                <div class="modal-header">
                    <h2>📋 Paste / Edit SysEx Data</h2>
                    <div class="close-btn" id="paste-sysex-close-btn">&times;</div>
                </div>
                <div class="modal-body flex-col" style="padding:15px;flex:1;gap:10px;overflow:hidden">
                    <div style="font-size:11px;color:var(--text-secondary,#aaa)">
                        Pega texto SysEx en formato Hex (soporta <code>Win+V</code>, espacios, saltos de línea o prefijos <code>0x</code>). Puedes editar valores a mano antes de procesar:
                    </div>
                    <textarea id="paste-sysex-textarea" style="flex:1;width:100%;background:var(--bg-deepest,#0d0d0d);border:1px solid var(--border-dim,#333);color:var(--text-primary,#ddd);font-family:monospace;font-size:11px;padding:10px;border-radius:var(--radius-xs,#4px);resize:none;outline:none" placeholder="F0 00 20 32 20 7F 02 07 ... F7"></textarea>
                    <div id="paste-sysex-status" style="font-size:11px;font-weight:bold;min-height:16px;color:var(--accent-teal,#00e5ff)"></div>
                </div>
                <div class="modal-footer justify-between" style="padding:10px 15px;border-top:1px solid var(--border-dim,#333)">
                    <div class="flex-row gap-10">
                        <button class="manager-btn" id="paste-sysex-btn-clear" style="background:var(--bg-hover,#222);color:var(--text-secondary,#aaa)">Clear</button>
                        <button class="manager-btn" id="paste-sysex-btn-read-clip" style="background:color-mix(in srgb,var(--accent-teal,#00e5ff) 20%,transparent);border-color:var(--accent-teal,#00e5ff);color:var(--accent-teal,#00e5ff)">📋 Paste from Clipboard</button>
                    </div>
                    <div class="flex-row gap-10">
                        <button class="manager-btn" id="paste-sysex-btn-cancel" style="background:var(--bg-hover,#222);color:var(--text-primary,#ddd)">Cancel</button>
                        <button class="manager-btn btn-solid" id="paste-sysex-btn-apply" style="padding:6px 20px;font-size:var(--text-base);background:var(--accent-teal,#00e5ff);color:#000;border-color:var(--accent-teal,#00e5ff)">Process & Paste</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- RENAME PRESET MODAL -->
        <div class="modal-backdrop" id="rename-patch-modal-backdrop" style="display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:999999999;background:rgba(10,11,13,0.85)">
            <div class="modal" data-accent="orange" style="width:420px;height:auto;display:flex;flex-direction:column">
                <div class="modal-header">
                    <h2>✏️ Rename Preset</h2>
                    <div class="close-btn" id="rename-patch-close-btn">&times;</div>
                </div>
                <div class="modal-body flex-col" style="padding:15px;gap:12px">
                    <span style="font-size:12px;color:var(--text-secondary,#aaa)">Enter new patch name (max 15 characters):</span>
                    <input type="text" id="rename-patch-input" maxlength="15" class="modal-input" style="width:100%;font-size:14px;padding:8px" placeholder="Preset Name">
                </div>
                <div class="modal-footer justify-end" style="padding:10px 15px;gap:10px;border-top:1px solid var(--border-dim,#333)">
                    <button class="manager-btn" id="rename-patch-btn-cancel">Cancel</button>
                    <button class="manager-btn btn-solid" id="rename-patch-btn-save" style="padding:6px 20px">Save Name</button>
                </div>
            </div>
        </div>

        <!-- CATEGORY PICKER MODAL -->
        <div class="modal-backdrop" id="category-picker-modal-backdrop" style="display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:999999999;background:rgba(10,11,13,0.85)">
            <div class="modal" data-accent="blue" style="width:380px;height:auto;display:flex;flex-direction:column">
                <div class="modal-header">
                    <h2>🏷️ Select Category</h2>
                    <div class="close-btn" id="cat-picker-close-btn">&times;</div>
                </div>
                <div class="modal-body flex-col" style="padding:15px;gap:8px" id="cat-picker-options">
                </div>
                <div class="modal-footer justify-end" style="padding:10px 15px;border-top:1px solid var(--border-dim,#333)">
                    <button class="manager-btn" id="cat-picker-btn-cancel">Cancel</button>
                </div>
            </div>
        </div>
    `;

    class BankManagerModal extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }
        }
    }
    customElements.define('bank-manager-modal', BankManagerModal);
})();

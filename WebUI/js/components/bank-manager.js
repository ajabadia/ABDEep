/**
 * @component bank-manager-modal
 * @purpose Bank & Preset Manager + Save As modals
 * @classification UI Component
 */
(function() {
    const template = `
        <!-- BANK MANAGER MODAL -->
        <div class="modal-backdrop" id="browser-modal-backdrop" style="display:none">
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
                            <button class="manager-btn btn-solid" id="hw-load-btn">LOAD TO EDIT</button>
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
                            <button class="manager-btn btn-solid" id="local-load-btn">LOAD TO EDIT</button>
                            <button class="manager-btn" id="mngr-import-sysex" style="background:color-mix(in srgb,var(--accent-primary) 15%,transparent);border-color:var(--accent-primary);color:var(--text-primary)">Import SysEx</button>
                            <button class="manager-btn" id="mngr-export-sysex">Export SysEx</button>
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

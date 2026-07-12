/**
 * @component keyboard-shortcuts-modal
 * @purpose Modal overlay listing all available keyboard shortcuts
 * @classification UI Component
 * @complexity Low
 */
(function() {
    const template = `
        <div class="modal-backdrop" id="keyboard-shortcuts-backdrop" style="display:none;z-index:5000">
            <div class="modal" data-accent="cyan" style="width:550px;height:auto">
                <div class="modal-header">
                    <h2>Keyboard Shortcuts</h2>
                    <div class="close-btn" id="keyboard-shortcuts-close-btn">&times;</div>
                </div>
                <div class="modal-body" style="background:var(--bg-elevated);padding:16px;overflow-y:auto">
                    <div id="keyboard-shortcuts-dynamic-list" class="flex-col" style="gap:3px">
                <div class="text-dim text-center" style="padding:20px;font-size:var(--text-sm)">Loading shortcuts...</div>
            </div>

                    <div style="margin-top:16px;padding:8px;background:var(--bg-deepest);border:1px solid var(--border-dim);border-radius:var(--radius-sm);font-size:var(--text-2xs);color:var(--text-faint);text-align:center">
                        These shortcuts are active when the main controller panel is focused.
                        <span style="display:block;margin-top:4px">Customize them in <strong>Settings → Keyboard</strong>.</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    class KeyboardShortcutsModal extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }

            // Close button
            const closeBtn = this.querySelector('#keyboard-shortcuts-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.hide());
            }

            // Click on backdrop to close
            const backdrop = this.querySelector('#keyboard-shortcuts-backdrop');
            if (backdrop) {
                backdrop.addEventListener('click', (e) => {
                    if (e.target === backdrop) this.hide();
                });
            }

            // Esc key to close
            this._escHandler = (e) => { if (e.key === 'Escape') this.hide(); };
            document.addEventListener('keydown', this._escHandler);
        }

        disconnectedCallback() {
            if (this._escHandler) {
                document.removeEventListener('keydown', this._escHandler);
            }
        }

        show() {
            const backdrop = this.querySelector('#keyboard-shortcuts-backdrop');
            if (backdrop) backdrop.style.display = 'flex';
            this._renderDynamic();
        }

        _renderDynamic() {
            var container = this.querySelector('#keyboard-shortcuts-dynamic-list');
            if (!container) return;
            if (!window.ShortcutConfig) {
                container.innerHTML = '<div class="text-dim text-center" style="padding:20px;font-size:var(--text-sm)">Shortcut system not loaded.</div>';
                return;
            }
            var config = window.ShortcutConfig.load();
            var ids = window.ShortcutConfig.getAllIds();
            var meta = window.ShortcutConfig._meta;

            var groups = {};
            ids.forEach(function(id) {
                var m = meta[id] || { group: 'other', label: id, description: '', color: '--text-dim' };
                if (!groups[m.group]) groups[m.group] = [];
                groups[m.group].push({ id: id, meta: m, combo: config[id] });
            });

            var html = '';
            var groupOrder = ['global', 'sequencer', 'other'];
            var groupLabels = { 'global': 'Global', 'sequencer': 'Sequencer', 'other': 'Other' };
            var groupColors = { 'global': '--accent-cyan', 'sequencer': '--accent-pink', 'other': '--text-dim' };

            groupOrder.forEach(function(group) {
                var items = groups[group];
                if (!items || items.length === 0) return;
                html += '<div style="font-size:var(--text-xs);text-transform:uppercase;font-weight:bold;color:var(' + groupColors[group] + ');padding:6px 8px;border-bottom:1px solid var(--border-dim);margin-bottom:4px">' + groupLabels[group] + '</div>';
                items.forEach(function(item) {
                    var comboStr = window.ShortcutConfig.formatCombo(item.combo);
                    html += '<div style="display:grid;grid-template-columns:auto 1fr 160px;gap:10px;align-items:center;padding:5px 8px;border-radius:var(--radius-xs);font-size:var(--text-base)">'
                        + '<kbd style="display:inline-block;background:var(--bg-deepest);border:1px solid var(--border);border-radius:3px;padding:2px 7px;font-family:\'Share Tech Mono\',monospace;font-size:11px;color:var(--text-primary);min-width:100px;text-align:center">' + comboStr + '</kbd>'
                        + '<span style="color:var(--text-primary)">' + item.meta.label + '</span>'
                        + '<span style="color:var(--text-dim);font-size:var(--text-sm);text-align:right">' + item.meta.description + '</span>'
                        + '</div>';
                });
            });

            // Add standard edit actions
            html += '<div style="font-size:var(--text-xs);text-transform:uppercase;font-weight:bold;color:var(--accent-orange);padding:6px 8px;border-bottom:1px solid var(--border-dim);margin-bottom:4px;margin-top:10px">Edit Actions</div>';
            const editShortcuts = [
                { combo: 'Ctrl + Z', label: 'Undo', desc: 'Undo last parameter change' },
                { combo: 'Ctrl + Y', label: 'Redo', desc: 'Redo last undone change' },
                { combo: 'Ctrl + C', label: 'Copy Preset', desc: 'Copy selected preset' },
                { combo: 'Ctrl + V', label: 'Paste Preset', desc: 'Paste copied preset' }
            ];
            editShortcuts.forEach(function(item) {
                html += '<div style="display:grid;grid-template-columns:auto 1fr 160px;gap:10px;align-items:center;padding:5px 8px;border-radius:var(--radius-xs);font-size:var(--text-base)">'
                    + '<kbd style="display:inline-block;background:var(--bg-deepest);border:1px solid var(--border);border-radius:3px;padding:2px 7px;font-family:\'Share Tech Mono\',monospace;font-size:11px;color:var(--text-primary);min-width:100px;text-align:center">' + item.combo + '</kbd>'
                    + '<span style="color:var(--text-primary)">' + item.label + '</span>'
                    + '<span style="color:var(--text-dim);font-size:var(--text-sm);text-align:right">' + item.desc + '</span>'
                    + '</div>';
            });

            container.innerHTML = html || '<div class="text-dim text-center" style="padding:20px;font-size:var(--text-sm)">No shortcuts configured.</div>';
        }

        hide() {
            const backdrop = this.querySelector('#keyboard-shortcuts-backdrop');
            if (backdrop) backdrop.style.display = 'none';
        }
    }

    customElements.define('keyboard-shortcuts-modal', KeyboardShortcutsModal);
})();

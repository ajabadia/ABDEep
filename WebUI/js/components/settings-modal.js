/**
 * @component settings-modal
 * @purpose Settings & Global Preferences modal facade
 * Templates extracted to settings_modal_tabs.js
 * @classification UI Component
 */
(function () {
    function buildSettingsTemplate() {
        const tabButtons = [
            { name: 'connections', label: 'Connections' },
            { name: 'routing', label: 'Routing' },
            { name: 'misc', label: 'Misc' },
            { name: 'dump', label: 'Dump' },
            { name: 'midilearn', label: 'MIDI Learn' },
            { name: 'keyboard', label: 'Keyboard' },
            { name: 'advanced', label: 'Advanced' },
            { name: 'global', label: 'Global' }
        ];

        let tabContent = '';
        tabContent += (window.SETTINGS_TAB_CONNECTIONS || '');
        tabContent += (window.SETTINGS_TAB_ROUTING || '');
        tabContent += (window.SETTINGS_TAB_MISC || '');
        tabContent += (window.SETTINGS_TAB_DUMP || '');
        tabContent += (window.SETTINGS_TAB_MIDILEARN || '');
        tabContent += (window.SETTINGS_TAB_KEYBOARD || '');
        tabContent += (window.SETTINGS_TAB_ADVANCED || '');
        tabContent += (window.SETTINGS_TAB_GLOBAL || '');

        return `
        <div class="modal-backdrop" id="settings-modal-backdrop" style="display:none;z-index:5000">
            <div class="modal" data-accent="orange" style="width:800px">
                <div class="modal-header">
                    <h2>Settings & Global Preferences</h2>
                    <div class="close-btn" id="settings-modal-close-btn">&times;</div>
                </div>
                <div class="modal-body" style="background:var(--bg-elevated);overflow-y:auto">
                    <div class="flex-row" style="gap:2px;background:var(--bg-elevated);padding:2px;border-radius:var(--radius)">
                        ${tabButtons.map(function (tb) {
                            return '<button class="btn btn-sm btn-solid' + (tb.name === 'connections' ? ' active' : '') + '" data-tab="' + tb.name + '" style="flex:1;font-size:var(--text-base);border:none' + (tb.name !== 'connections' ? ';background:var(--bg-hover);color:var(--text-secondary)' : '') + '">' + tb.label + '</button>';
                        }).join('')}
                    </div>
                    <div id="settings-tab-content" style="min-height:250px">
                        ${tabContent}
                    </div>
                </div>
            </div>
        </div>
        ${window.SETTINGS_ABOUT_MODAL || ''}`;
    }

    class SettingsModal extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = buildSettingsTemplate();
            }
        }
    }

    if (!customElements.get('settings-modal')) {
        customElements.define('settings-modal', SettingsModal);
    }
})();

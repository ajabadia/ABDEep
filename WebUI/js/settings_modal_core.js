/**
 * @purpose Orquestador del modal de Ajustes (Settings/About): open, close,
 * pestañas y botones de resync/refresh. Las funciones de Global Dump y
 * actualización de hardware info se han extraído a archivos separados.
 * Extraído de settings.js como parte de la modularización.
 */

/**
 * Open the Settings modal, populate MIDI ports and request global dump.
 */
function openSettingsModal(tabName) {
    const modal = document.getElementById('settings-modal-backdrop');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('visible-flex');
        if (typeof window.populateMidiPortsLists === 'function') {
            window.populateMidiPortsLists();
        }
        if (typeof window.updateSettingsHardwareInfo === 'function') {
            window.updateSettingsHardwareInfo();
        }
        if (typeof window.ensureGlobalDumpButton === 'function') {
            window.ensureGlobalDumpButton();
        }
        if (typeof window.wireGlobalDumpButton === 'function') {
            window.wireGlobalDumpButton();
        }
        if (typeof window.requestGlobalDumpAndUpdate === 'function') {
            window.requestGlobalDumpAndUpdate();
        }
        if (tabName) {
            const tabBtn = modal.querySelector('.btn[data-tab="' + tabName + '"]');
            if (tabBtn) {tabBtn.click();}
        }
        if (typeof window._syncAdvancedSettingsUI === 'function') {window._syncAdvancedSettingsUI();}
    }
}

/**
 * Close the Settings modal.
 */
function closeSettingsModal() {
    const modal = document.getElementById('settings-modal-backdrop');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('visible-flex');
    }
}

/**
 * Initialize event delegation for Settings/About modal open/close and tab switching.
 */
function initSettingsModals() {
    document.addEventListener('click', (e) => {
        // Open Settings
        if (e.target.closest('#menu-properties') || e.target.closest('#programmer-global-btn')) {
            e.preventDefault();
            openSettingsModal();
        }
        
        // Open About
        if (e.target.closest('#menu-about')) {
            e.preventDefault();
            const modal = document.getElementById('about-modal-backdrop');
            if (modal) {modal.style.display = 'flex';}
        }

        // Close About
        if (e.target.closest('#about-modal-close-btn') || e.target.id === 'about-modal-backdrop') {
            const modal = document.getElementById('about-modal-backdrop');
            if (modal) {modal.style.display = 'none';}
        }

        // Close Settings
        if (e.target.closest('#settings-modal-close-btn') || e.target.id === 'settings-modal-backdrop') {
            closeSettingsModal();
        }
    });

    // Tab switching in Settings modal
    const tabBtns = document.querySelectorAll('.btn[data-tab]');
    const panels = document.querySelectorAll('.settings-panel-view');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => {
                b.classList.remove('active', 'btn-solid');
            });
            btn.classList.add('active', 'btn-solid');
            panels.forEach(p => p.style.display = 'none');
            const targetTab = btn.getAttribute('data-tab');
            const targetPanel = document.getElementById('settings-view-' + targetTab);
            if (targetPanel) {
                targetPanel.style.display = (targetTab === 'connections') ? 'flex' : 'block';
            }
            if (targetTab === 'misc' && typeof window.drawCurvePreview === 'function') {
                window.drawCurvePreview(window._lastCurveType, window._lastCurveIsBipolar);
            }
        });
    });
}

// Wire Resync button and Synth Info refresh button
function initResyncButton() {
    const resyncBtn = document.getElementById('settings-midi-resync');
    if (resyncBtn) {
        resyncBtn.addEventListener('click', async () => {
            if (!window.dualMidiBridge) {return;}
            resyncBtn.disabled = true;
            resyncBtn.textContent = 'Scanning...';
            resyncBtn.classList.add('btn-loading');
            await window.dualMidiBridge.resetMidiConnection();
            if (typeof window.populateMidiPortsLists === 'function') {
                window.populateMidiPortsLists();
            }
            if (typeof window.updateSettingsHardwareInfo === 'function') {
                window.updateSettingsHardwareInfo();
            }
            resyncBtn.disabled = false;
            resyncBtn.textContent = 'Rescan MIDI';
            resyncBtn.classList.remove('btn-loading');
        });
    }
}

function initSynthInfoRefresh() {
    const synthInfoRefreshBtn = document.getElementById('settings-synth-info-refresh');
    if (synthInfoRefreshBtn) {
        synthInfoRefreshBtn.addEventListener('click', async () => {
            if (!window.dualMidiBridge) {return;}
            synthInfoRefreshBtn.disabled = true;
            synthInfoRefreshBtn.textContent = '...';
            try {
                await window.dualMidiBridge.isConnected();
                if (typeof window.updateSettingsHardwareInfo === 'function') {
                    window.updateSettingsHardwareInfo();
                }
            } catch (e) {
                (globalThis.Logger || console).warn('[Settings] Synth info refresh failed:', e);
            }
            synthInfoRefreshBtn.disabled = false;
            synthInfoRefreshBtn.textContent = '\u21BB';
        });
    }
}

function initGlobalRefreshButton() {
    const globalRefreshBtn = document.getElementById('settings-global-refresh');
    if (globalRefreshBtn) {
        globalRefreshBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof window.requestGlobalDumpAndUpdate === 'function') {
                window.requestGlobalDumpAndUpdate('settings-global-dump-status-panel');
            }
        });
    }
}

// Expose for backward compatibility and tests
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.initSettingsModals = initSettingsModals;
window.initResyncButton = initResyncButton;
window.initSynthInfoRefresh = initSynthInfoRefresh;
window.initGlobalRefreshButton = initGlobalRefreshButton;

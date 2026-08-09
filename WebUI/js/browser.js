/**
 * @purpose Fachada del Bank Manager. Inicializa la UI del gestor de bancos dual
 * (hardware + local). Las funciones de renderizado están en browser_render.js,
 * los modales/menús en browser_modals.js, y las operaciones CRUD/SysEx en browser_events.js.
 * Carga secuencial vía script tags.
 */

document.addEventListener('DOMContentLoaded', () => {
    initBankManager();
});

function initBankManager() {
    if (typeof window.loadAllFactoryBanksNatively === 'function') {
        window.loadAllFactoryBanksNatively();
    }

    const browserModal = document.getElementById('browser-modal-backdrop');

    const showBrowser = () => {
        if (browserModal) {
            browserModal.style.display = 'flex';
            window.updateLocalBanksDropdown();
            window.renderPatchesForBank(window.currentActiveBank);
            window.renderHardwarePatches();
        }
    };

    document.addEventListener('click', (e) => {
        if (e.target.closest('#menu-bank-manager')) {
            e.preventDefault();
            showBrowser();
        }
    });

    const progMngrBtn = document.getElementById('programmer-bank-mngr-btn');
    if (progMngrBtn) {progMngrBtn.addEventListener('click', showBrowser);}

    const closeBtn = document.getElementById('browser-close-btn');
    if (closeBtn) {closeBtn.addEventListener('click', () => browserModal.style.display = 'none');}

    const patchUpBtn = document.getElementById('programmer-patch-up-btn');
    if (patchUpBtn) {patchUpBtn.addEventListener('click', () => {
        if (typeof window.playKeyLedAnimation === 'function') {window.playKeyLedAnimation('patch-up');}
        window.navigatePatch(-1);
    });}
    const patchDownBtn = document.getElementById('programmer-patch-down-btn');
    if (patchDownBtn) {patchDownBtn.addEventListener('click', () => {
        if (typeof window.playKeyLedAnimation === 'function') {window.playKeyLedAnimation('patch-down');}
        window.navigatePatch(+1);
    });}

    window._currentCategoryFilter = '';
    window._browserViewMode = 'list';

    const localSelect = document.getElementById('local-bank-select');
    if (localSelect) {
        localSelect.addEventListener('change', function(e) {
            window.currentActiveBank = e.target.value;
            window.currentActivePatchIndex = 0;
            const searchInput = document.getElementById('browser-search-input');
            if (searchInput) {searchInput.value = '';}
            window.renderPatchesForBank(window.currentActiveBank);
        });
    }

    const searchInput = document.getElementById('browser-search-input');
    const searchClear = document.getElementById('browser-search-clear');

    function applySearch() {
        const term = searchInput ? searchInput.value : '';
        window.renderPatchesForBank(window.currentActiveBank, term);
    }

    if (searchInput) {searchInput.addEventListener('input', applySearch);}
    if (searchClear) {
        searchClear.addEventListener('click', function() {
            if (searchInput) {searchInput.value = '';}
            applySearch();
            if (searchInput) {searchInput.focus();}
        });
    }

    const catFilters = document.querySelectorAll('.cat-filter');
    catFilters.forEach(function(el) {
        el.addEventListener('click', function() {
            const cat = this.getAttribute('data-cat');
            window._currentCategoryFilter = cat;
            catFilters.forEach(function(c) { c.classList.remove('active'); });
            this.classList.add('active');
            window.renderPatchesForBank(window.currentActiveBank, searchInput ? searchInput.value : '');
        });
    });

    const viewToggle = document.getElementById('browser-view-toggle');
    if (viewToggle) {
        viewToggle.addEventListener('click', function() {
            if (window._browserViewMode === 'list') {
                window._browserViewMode = 'grid';
                this.textContent = '☰';
                this.title = 'Switch to list view';
            } else {
                window._browserViewMode = 'list';
                this.textContent = '⊞';
                this.title = 'Switch to grid view';
            }
            window.renderPatchesForBank(window.currentActiveBank, searchInput ? searchInput.value : '');
        });
    }

    const hwLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    hwLetters.forEach((l, i) => {
        const btn = document.getElementById('hw-bank-' + l + '-btn');
        if (btn) {
            btn.classList.add('hw-bank-btn');
            if (i === 0) {btn.classList.add('is-active');}
            btn.addEventListener('click', () => {
                window.currentHwBankLetter = l.toUpperCase();
                document.querySelectorAll('.hw-bank-btn').forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');
                window.renderHardwarePatches();
            });
        }
    });

    // Bank CRUD buttons
    const createBankBtn = document.getElementById('mngr-create-bank');
    if (createBankBtn) {createBankBtn.addEventListener('click', window._handleBankCreate);}

    const renameBankBtn = document.getElementById('mngr-rename-bank');
    if (renameBankBtn) {renameBankBtn.addEventListener('click', window._handleBankRename);}

    const deleteBankBtn = document.getElementById('mngr-delete-bank');
    if (deleteBankBtn) {deleteBankBtn.addEventListener('click', window._handleBankDelete);}

    const pasteSysexBtn = document.getElementById('mngr-paste-sysex');
    if (pasteSysexBtn) {pasteSysexBtn.addEventListener('click', window._handlePasteSysex);}

    // Export patch button
    if (typeof window._initExportPatchButton === 'function') {
        window._initExportPatchButton();
    }

    // SysEx drop zone
    if (typeof window._initSysexDropZone === 'function') {
        window._initSysexDropZone(browserModal);
    }

    // HW/Local load buttons
    const hwLoadBtn = document.getElementById('hw-load-btn');
    if (hwLoadBtn) {
        hwLoadBtn.addEventListener('click', function() { window._handleHWLoad(browserModal); });
    }

    const localLoadBtn = document.getElementById('local-load-btn');
    if (localLoadBtn) {
        localLoadBtn.addEventListener('click', function() { window._handleLocalLoad(browserModal); });
    }
}
window.initBankManager = initBankManager;

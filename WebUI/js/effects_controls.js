/**
 * @purpose Modal controls for the FX editor: open/close, slot selection, type selectors, routing, pages, mode buttons.
 * @purpose_en FX modal interactive controls for managing all 4 FX slots and global routing/mode.
 */

// eslint-disable-next-line no-unused-vars -- called from initEffectsModal
function initEffectsControls() {
    const backdrop = document.getElementById('fx-modal-backdrop');
    const fxBtn = document.getElementById('programmer-fx-btn');
    const closeBtn = document.getElementById('fx-modal-close-btn');

    if (!fxBtn || !backdrop || !closeBtn) {return;}

    // Modal open
    fxBtn.addEventListener('click', (e) => {
        e.preventDefault();
        backdrop.style.display = 'flex';
        if (typeof window.syncFxModalUI === 'function') {window.syncFxModalUI();}
    });

    // Modal close
    closeBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
    });

    // Click outside to close
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            backdrop.style.display = 'none';
        }
    });

    // Slot column selection
    for (let i = 1; i <= 4; i++) {
        const slotCol = document.getElementById(`fx-slot-${i}`);
        if (slotCol) {
            slotCol.addEventListener('click', (e) => {
                if (e.target.tagName === 'SELECT') {return;}

                document.querySelectorAll('.fx-slot-column').forEach(c => c.style.borderColor = 'var(--bg-hover)');
                slotCol.style.borderColor = 'var(--brand-accent)';
                window._selectedFxSlot = i;

                if (typeof window.renderActiveEffectParams === 'function') {
                    window.renderActiveEffectParams();
                }
            });
        }
    }

    // FX type select change
    document.querySelectorAll('.fx-type-select').forEach(sel => {
        sel.addEventListener('change', () => {
            const slot = sel.getAttribute('data-slot');
            const val = parseInt(sel.value);
            const displayEl = document.getElementById(`fx${slot}-type-mini-display`);
            if (displayEl) {displayEl.innerText = window.FX_TYPE_NAMES[val];}

            if (getBridge()) {
                getBridge().setParameter(`fx${slot}_type`, val / 56.0);
            }
            if (parseInt(slot) === window._selectedFxSlot) {
                if (typeof window.renderActiveEffectParams === 'function') {
                    window.renderActiveEffectParams();
                }
            }
            // Notify vocoder mic module of FX type change
            if (typeof window._onFxTypeChanged === 'function') {
                window._onFxTypeChanged();
            }
        });
    });

    // Routing select
    const routingSelect = document.getElementById('fx-routing-select');
    if (routingSelect) {
        routingSelect.addEventListener('change', () => {
            if (getBridge()) {
                getBridge().setParameter('fx_routing', parseInt(routingSelect.value) / 9.0);
            }
        });
    }

    // Page buttons
    const page1Btn = document.getElementById('fx-page-1-btn');
    const page2Btn = document.getElementById('fx-page-2-btn');
    if (page1Btn && page2Btn) {
        page1Btn.addEventListener('click', () => {
            page1Btn.classList.add('active');
            page2Btn.classList.remove('active');
            window._activeFxPage = 1;
            if (typeof window.renderActiveEffectParams === 'function') {
                window.renderActiveEffectParams();
            }
        });
        page2Btn.addEventListener('click', () => {
            page2Btn.classList.add('active');
            page1Btn.classList.remove('active');
            window._activeFxPage = 2;
            if (typeof window.renderActiveEffectParams === 'function') {
                window.renderActiveEffectParams();
            }
        });
    }

    // Mode buttons (Insert / Send / Bypass)
    const modeIns = document.getElementById('fx-mode-ins-btn');
    const modeSend = document.getElementById('fx-mode-send-btn');
    const modeByp = document.getElementById('fx-mode-bypass-btn');
    const sendLevelArea = document.getElementById('fx-send-level-area');

    const setSendLevelVisibility = (modeVal) => {
        if (!sendLevelArea) {return;}
        sendLevelArea.style.display = (modeVal === 1) ? 'flex' : 'none';
    };

    if (modeIns && modeSend && modeByp) {
        modeIns.addEventListener('click', () => {
            modeIns.classList.add('active');
            [modeSend, modeByp].forEach(b => b.classList.remove('active'));
            setSendLevelVisibility(0);
            if (getBridge()) {getBridge().setParameter('fx_mode', 0.0);}
        });
        modeSend.addEventListener('click', () => {
            modeSend.classList.add('active');
            [modeIns, modeByp].forEach(b => b.classList.remove('active'));
            setSendLevelVisibility(1);
            if (getBridge()) {getBridge().setParameter('fx_mode', 0.5);}
        });
        modeByp.addEventListener('click', () => {
            modeByp.classList.add('active');
            [modeIns, modeSend].forEach(b => b.classList.remove('active'));
            setSendLevelVisibility(2);
            if (getBridge()) {getBridge().setParameter('fx_mode', 1.0);}
        });
    }
}

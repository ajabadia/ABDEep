/**
 * @purpose Scope toolbar and screen/realScope toggle setup for the detail editor panel.
 * @purpose_en Screen collapse/expand, DSP scope toggles, trigger/zoom/color toolbar buttons.
 */

// eslint-disable-next-line no-unused-vars -- called from initDetailPanel
function initPanelScope() {
    const state = window.panelEditState;
    const screenEl = document.getElementById('panel-graphic-screen');
    const screenToggleBtn = document.getElementById('panel-graphic-toggle');
    const realScopeScreenEl = document.getElementById('panel-real-scope-screen');
    const realScopeToggleBtn = document.getElementById('panel-real-scope-toggle');

    if (screenToggleBtn && screenEl) {
        screenToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isScreenCollapsed = !state.isScreenCollapsed;
            window.updateScreenHeight();
        });
    }

    if (realScopeToggleBtn && realScopeScreenEl) {
        realScopeToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isRealScopeCollapsed = !state.isRealScopeCollapsed;
            window.updateRealScopeHeight();
            window._updateAudioWaveformPolling();
            if (!state.isRealScopeCollapsed && typeof window._updateScopeToolbar === 'function') {
                window._updateScopeToolbar();
            }
        });
    }

    // Scope toolbar triggers
    document.addEventListener('click', function _onScopeTrigger(e) {
        const btn = e.target.closest('#scope-trigger-btn');
        if (!btn) {return;}
        state._scopeTriggerMode = (state._scopeTriggerMode + 1) % 3;
        state._scopeLastSamples = null;
        if (typeof window._updateScopeToolbar === 'function') {window._updateScopeToolbar();}
    });

    document.addEventListener('click', function _onScopeZoom(e) {
        const btn = e.target.closest('.scope-zoom-btn');
        if (!btn) {return;}
        const zoom = parseInt(btn.getAttribute('data-zoom'));
        if (zoom >= 1 && zoom <= 4) {
            state._scopeZoom = zoom;
            if (typeof window._updateScopeToolbar === 'function') {window._updateScopeToolbar();}
        }
    });

    document.addEventListener('click', function _onScopeColor(e) {
        const btn = e.target.closest('#scope-color-btn');
        if (!btn) {return;}
        state._scopeColorScheme = (state._scopeColorScheme + 1) % (window.SCOPE_COLORS ? window.SCOPE_COLORS.length : 4);
        if (typeof window._updateScopeToolbar === 'function') {window._updateScopeToolbar();}
    });

    // View mode toggle: WAVE/SPC/DUAL
    document.addEventListener('click', function _onScopeView(e) {
        const btn = e.target.closest('#scope-view-btn');
        if (!btn) {return;}
        const maxMode = (window.SCOPE_VIEW_LABELS ? window.SCOPE_VIEW_LABELS.length : 3) - 1;
        state._scopeViewMode = ((state._scopeViewMode || 0) + 1) % (maxMode + 1);
        if (typeof window._updateScopeToolbar === 'function') {window._updateScopeToolbar();}
    });
}

/**
 * @purpose SEQ control bindings — extracted from panel_controls_arp_seq_mod.js.
 * El editor interactivo de pasos SEQ está en panel_seq_editor.js.
 * Carga secuencial vía script tags.
 */

window.bindPanelSeqControls = function(container, state, titleEl) {
    let _panelSeqBadge = '';
    const _bridge_ = getBridge();
    if (_bridge_) {
        const _klNorm_ = _bridge_.parameterCache['seq_key_loop'] || 0;
        const _klVal_ = Math.round(_klNorm_ * 2);
        const _forced_ = _bridge_._seqEngine && _bridge_._seqEngine._forcedFreeRunning;
        let _badgeLabel_ = '', _badgeColor_ = '';
        if (_forced_) { _badgeLabel_ = 'FREE*'; _badgeColor_ = 'var(--accent-yellow)'; }
        else if (_klVal_ === 0) { _badgeLabel_ = 'FREE'; _badgeColor_ = 'var(--accent-green)'; }
        else if (_klVal_ === 1) { _badgeLabel_ = 'KEY'; _badgeColor_ = 'var(--accent-blue)'; }
        else { _badgeLabel_ = 'LOOP'; _badgeColor_ = 'var(--accent-teal)'; }
        let _badgeTooltip_ = '';
        if (_forced_) {
            _badgeTooltip_ = ' title=\"Key Sync desactivado automáticamente — no había teclas presionadas al activar SEQ\"';
        }
        const _badgeClass_ = _forced_ ? 'seq-mode-badge free-forced' : (_klVal_ === 0 ? 'seq-mode-badge free' : (_klVal_ === 1 ? 'seq-mode-badge key' : 'seq-mode-badge loop'));
        _panelSeqBadge = ' <span class=\"' + _badgeClass_ + '\"' + _badgeTooltip_ + '>' + _badgeLabel_ + '</span>';
    }
    titleEl.innerHTML = 'Control Sequencer' + (window._seqSimMode ? ' ⚡SIM' : '') + _panelSeqBadge;
    container.innerHTML = window.PANEL_TEMPLATES.SEQ();

    // ── Initialize SEQ step editor from panel_seq_editor.js ──
    const stepsContainer = document.getElementById('panel-seq-steps-container');
    if (stepsContainer && typeof window.initPanelSeqEditor === 'function') {
        window.initPanelSeqEditor(stepsContainer);
    }

    // Sync initial state from bridge
    if (typeof window._syncPanelSeqFromCache === 'function') {
        window._syncPanelSeqFromCache();
    }

    // ── SEQ enable box ──
    const seqBox = document.getElementById('panel-seq-enable-box');
    if (seqBox) {
        const enVal = getBridge() ? getBridge().parameterCache['seq_enable'] : 0;
        seqBox.classList.toggle('active', enVal > 0.5);
        seqBox.addEventListener('click', function() {
            const active = this.classList.contains('active');
            if (getBridge()) {getBridge().setParameter('seq_enable', active ? 0.0 : 1.0);}
        });
    }

    // ── Open SEQ modal button ──
    const openModalBtn = document.getElementById('panel-seq-open-modal-btn');
    if (openModalBtn) {
        openModalBtn.addEventListener('click', function() {
            const backdrop = document.getElementById('seq-modal-backdrop');
            if (backdrop) {
                backdrop.style.display = 'flex';
                backdrop.classList.add('visible-flex');
                if (typeof window.syncSeqModalUIFromState === 'function') {
                    window.syncSeqModalUIFromState();
                }
            }
        });
    }

    // ── Clock select ──
    const clockSel = document.getElementById('panel-seq-clock-select');
    if (clockSel) {
        const cv = getBridge() ? getBridge().parameterCache['seq_clock'] || 0 : 0;
        clockSel.value = Math.round(cv * 15);
        clockSel.addEventListener('change', function() {
            if (getBridge()) {getBridge().setParameter('seq_clock', parseInt(this.value) / 15.0);}
        });
    }

    // ── Length select ──
    const lenSel = document.getElementById('panel-seq-length-select');
    if (lenSel) {
        const lv = getBridge() ? getBridge().parameterCache['seq_length'] || 0 : 0;
        lenSel.value = Math.round(lv * 31);
        lenSel.addEventListener('change', function() {
            if (getBridge()) {getBridge().setParameter('seq_length', parseInt(this.value) / 31.0);}
            for (let si2 = 0; si2 < 32; si2++) {
                if (typeof window._updatePanelStepVisual === 'function') {
                    window._updatePanelStepVisual(si2);
                }
            }
        });
    }

    // ── Key Loop select (updates title badge) ──
    const klSel = document.getElementById('panel-seq-keyloop-select');
    if (klSel) {
        const kv = getBridge() ? getBridge().parameterCache['seq_key_loop'] || 0 : 0;
        klSel.value = Math.round(kv * 2);
        klSel.addEventListener('change', function() {
            if (getBridge()) {getBridge().setParameter('seq_key_loop', parseInt(this.value) / 2.0);}
            const _bridge2_ = getBridge();
            if (_bridge2_ && titleEl) {
                const _klv2_ = Math.round((_bridge2_.parameterCache['seq_key_loop'] || 0) * 2);
                const _frc2_ = _bridge2_._seqEngine && _bridge2_._seqEngine._forcedFreeRunning;
                let _lb2_ = '', _lc2_ = '';
                if (_frc2_) { _lb2_ = 'FREE*'; _lc2_ = 'var(--accent-yellow)'; }
                else if (_klv2_ === 0) { _lb2_ = 'FREE'; _lc2_ = 'var(--accent-green)'; }
                else if (_klv2_ === 1) { _lb2_ = 'KEY'; _lc2_ = 'var(--accent-blue)'; }
                else { _lb2_ = 'LOOP'; _lc2_ = 'var(--accent-teal)'; }
                let _klTooltip_ = '';
                if (_frc2_) {
                    _klTooltip_ = ' title=\"Key Sync desactivado automáticamente — no había teclas presionadas al activar SEQ\"';
                }
                const _badgeClass2_ = _frc2_ ? 'seq-mode-badge free-forced' : (_klv2_ === 0 ? 'seq-mode-badge free' : (_klv2_ === 1 ? 'seq-mode-badge key' : 'seq-mode-badge loop'));
                const _nwBadge_ = ' <span class=\"' + _badgeClass2_ + '\"' + _klTooltip_ + '>' + _lb2_ + '</span>';
                titleEl.innerHTML = 'Control Sequencer' + (window._seqSimMode ? ' ⚡SIM' : '') + _nwBadge_;
            }
        });
    }

    // ── Skip button ──
    const skipBtn = document.getElementById('panel-seq-skip-btn');
    if (skipBtn) {
        skipBtn.addEventListener('click', function() {
            const idx = typeof window._panelLastSeqStep === 'number' ? window._panelLastSeqStep : 0;
            const currentRaw = window._panelSeqRaw && window._panelSeqRaw[idx];
            if (currentRaw === 0) {
                window._panelSeqValues[idx] = 0;
                window._panelSeqRaw[idx] = 128;
                if (getBridge()) {
                    getBridge().setParameter('seq_step_' + (idx + 1), 0.5);
                }
            } else {
                window._panelSeqValues[idx] = -128;
                window._panelSeqRaw[idx] = 0;
                if (getBridge()) {
                    getBridge().setParameter('seq_step_' + (idx + 1), 0.0);
                }
            }
            if (typeof window._updatePanelStepVisual === 'function') {
                window._updatePanelStepVisual(idx);
            }
        });
    }
};

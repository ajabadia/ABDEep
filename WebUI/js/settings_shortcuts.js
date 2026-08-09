/**
 * @purpose Manages rendering, modifying, and restoring default shortcuts in the Settings > Keyboard tab.
 * @purpose_en Keyboard shortcut mapping editor.
 */

function initKeyboardShortcutsSettings() {
    const kbTabBtn = document.querySelector('.btn[data-tab="keyboard"]');
    if (!kbTabBtn) {return;}

    const container = document.getElementById('keyboard-shortcuts-list');
    const resetAllBtn = document.getElementById('keyboard-shortcuts-reset-all');
    const feedbackEl = document.getElementById('keyboard-shortcuts-feedback');

    let captureState = null;

    function renderShortcutList() {
        if (!container || !window.ShortcutConfig) {return;}
        const config = window.ShortcutConfig.load();
        const ids = window.ShortcutConfig.getAllIds();
        const meta = window.ShortcutConfig._meta;

        const groups = {};
        ids.forEach(function(id) {
            const m = meta[id] || { group: 'other', label: id, description: '', color: '--text-dim' };
            if (!groups[m.group]) {groups[m.group] = [];}
            groups[m.group].push({ id: id, meta: m, combo: config[id] });
        });

        let html = '';
        const groupOrder = ['global', 'sequencer', 'other'];
        const groupLabels = { 'global': 'Global', 'sequencer': 'Sequencer', 'other': 'Other' };

        groupOrder.forEach(function(group) {
            const items = groups[group];
            if (!items || items.length === 0) {return;}

            html += '<div class="shortcut-group-header" data-group="' + group + '">' + groupLabels[group] + '</div>';

            items.forEach(function(item) {
                const comboStr = window.ShortcutConfig.formatCombo(item.combo);
                const isCapturing = captureState && captureState.id === item.id;
                html += '<div class="shortcut-config-row' + (isCapturing ? ' is-capturing' : '') + '" data-shortcut-id="' + item.id + '">'
                    + '<div><div class="shortcut-label">' + item.meta.label + '</div><div class="shortcut-description">' + item.meta.description + '</div></div>'
                    + '<kbd class="kbd-tag">' + comboStr + '</kbd>'
                    + '<button class="shortcut-reset-btn" data-shortcut-id="' + item.id + '">' + (isCapturing ? '...' : 'Edit') + '</button>'
                    + '</div>';
            });
        });

        container.innerHTML = html || '<div class="shortcuts-empty">No shortcuts configured.</div>';

        container.querySelectorAll('.shortcut-config-row').forEach(function(row) {
            row.addEventListener('click', function(e) {
                if (e.target.closest('.shortcut-reset-btn')) {return;}
                const id = this.dataset.shortcutId;
                startCapture(id, this);
            });
        });

        container.querySelectorAll('.shortcut-reset-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.dataset.shortcutId;
                if (window.ShortcutConfig) {
                    window.ShortcutConfig.reset(id);
                    cancelCapture();
                    renderShortcutList();
                    showFeedback();
                }
            });
        });
    }

    function startCapture(id, rowEl) {
        cancelCapture();

        captureState = { id: id, el: rowEl };
        window._shortcutCaptureActive = true;

        rowEl.classList.add('is-capturing');

        const btn = rowEl.querySelector('.shortcut-reset-btn');
        if (btn) {btn.textContent = 'Press...';}

        setFeedback('info', '\u2328 Press key combination for "' + (window.ShortcutConfig._meta[id] ? window.ShortcutConfig._meta[id].label : id) + '"...');

        document.addEventListener('keydown', captureHandler);
    }

    function cancelCapture() {
        if (captureState) {
            const oldRow = captureState.el;
            if (oldRow) {
                oldRow.classList.remove('is-capturing');
                const btn = oldRow.querySelector('.shortcut-reset-btn');
                if (btn) {btn.textContent = 'Edit';}
            }
            captureState = null;
        }
        window._shortcutCaptureActive = false;
        document.removeEventListener('keydown', captureHandler);
    }

    function captureHandler(e) {
        if (!captureState) {return;}

        if (e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') {return;}

        e.preventDefault();
        e.stopPropagation();

        const combo = {
            ctrl: !!e.ctrlKey,
            shift: !!e.shiftKey,
            alt: !!e.altKey,
            meta: !!e.metaKey,
            key: e.key
        };

        if (e.key === 'Escape') {
            cancelCapture();
            setFeedback('error', '\u2715 Cancelled');
            setTimeout(function() { feedbackEl.classList.remove('is-visible'); }, 1000);
            return;
        }

        if (!combo.ctrl && !combo.shift && !combo.alt && !combo.meta) {
            setFeedback('error', '\u26A0 Use at least one modifier key (Ctrl, Shift, Alt)');
            setTimeout(function() { feedbackEl.classList.remove('is-visible'); }, 2000);
            return;
        }

        if (window.ShortcutConfig) {
            window.ShortcutConfig.set(captureState.id, combo);
        }

        const comboStr = window.ShortcutConfig.formatCombo(combo);

        cancelCapture();
        renderShortcutList();
        showFeedback();

        setFeedback('success', '\u2713 Saved: ' + comboStr);
    }

    function setFeedback(type, text) {
        if (!feedbackEl) {return;}
        feedbackEl.textContent = text;
        feedbackEl.classList.remove('is-info', 'is-success', 'is-error');
        feedbackEl.classList.add('is-visible', 'is-' + type);
    }

    function showFeedback() {
        if (!feedbackEl) {return;}
        feedbackEl.classList.add('is-visible');
        clearTimeout(feedbackEl._hideTimer);
        feedbackEl._hideTimer = setTimeout(function() {
            feedbackEl.classList.remove('is-visible');
        }, 2500);
    }

    kbTabBtn.addEventListener('click', function() {
        setTimeout(renderShortcutList, 50);
        cancelCapture();
    });

    if (resetAllBtn) {
        resetAllBtn.addEventListener('click', function() {
            if (!window.ShortcutConfig) {return;}
            window.ShortcutConfig.resetAll();
            cancelCapture();
            renderShortcutList();
            setFeedback('success', '\u2713 All shortcuts reset to defaults');
            showFeedback();
        });
    }

    renderShortcutList();
}

window.initKeyboardShortcutsSettings = initKeyboardShortcutsSettings;

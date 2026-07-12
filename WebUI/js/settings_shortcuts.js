/**
 * @purpose Manages rendering, modifying, and restoring default shortcuts in the Settings > Keyboard tab.
 * @purpose_en Keyboard shortcut mapping editor.
 */

function initKeyboardShortcutsSettings() {
    var kbTabBtn = document.querySelector('.btn[data-tab="keyboard"]');
    if (!kbTabBtn) return;
    
    var container = document.getElementById('keyboard-shortcuts-list');
    var resetAllBtn = document.getElementById('keyboard-shortcuts-reset-all');
    var feedbackEl = document.getElementById('keyboard-shortcuts-feedback');
    
    var captureState = null;
    
    function renderShortcutList() {
        if (!container || !window.ShortcutConfig) return;
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
            
            html += '<div style="font-size:var(--text-xs);text-transform:uppercase;font-weight:bold;color:var(' + groupColors[group] + ');padding:6px 8px;border-bottom:1px solid var(--border-dim);margin:4px 0 2px 0">' + groupLabels[group] + '</div>';
            
            items.forEach(function(item) {
                var comboStr = window.ShortcutConfig.formatCombo(item.combo);
                var isCapturing = captureState && captureState.id === item.id;
                html += '<div class="shortcut-config-row" data-shortcut-id="' + item.id + '" style="display:grid;grid-template-columns:1fr auto 60px;gap:10px;align-items:center;padding:6px 8px;border-radius:var(--radius-xs);font-size:var(--text-sm);cursor:pointer;transition:background 0.15s ease' + (isCapturing ? ';background:color-mix(in srgb,var(--accent-primary) 20%,transparent);outline:1px solid var(--accent-primary)' : '') + '">'
                    + '<div><div style="color:var(--text-primary);font-weight:bold">' + item.meta.label + '</div><div style="color:var(--text-dim);font-size:var(--text-2xs)">' + item.meta.description + '</div></div>'
                    + '<kbd style="display:inline-block;background:var(--bg-deepest);border:1px solid var(--border);border-radius:3px;padding:2px 7px;font-family:\'Share Tech Mono\',monospace;font-size:10px;color:var(--text-primary);min-width:90px;text-align:center">' + comboStr + '</kbd>'
                    + '<button class="shortcut-reset-btn" data-shortcut-id="' + item.id + '" style="background:none;border:1px solid var(--border-dim);color:var(--text-faint);border-radius:2px;cursor:pointer;padding:1px 6px;font-size:9px;transition:all 0.15s ease">' + (isCapturing ? '...' : 'Edit') + '</button>'
                    + '</div>';
            });
        });
        
        container.innerHTML = html || '<div class="text-dim text-center" style="padding:20px;font-size:var(--text-sm)">No shortcuts configured.</div>';
        
        container.querySelectorAll('.shortcut-config-row').forEach(function(row) {
            row.addEventListener('click', function(e) {
                if (e.target.closest('.shortcut-reset-btn')) return;
                var id = this.dataset.shortcutId;
                startCapture(id, this);
            });
            
            row.addEventListener('mouseenter', function() {
                if (!captureState || captureState.id !== this.dataset.shortcutId) {
                    this.style.background = 'var(--bg-hover)';
                }
            });
            row.addEventListener('mouseleave', function() {
                if (!captureState || captureState.id !== this.dataset.shortcutId) {
                    this.style.background = '';
                }
            });
        });
        
        container.querySelectorAll('.shortcut-reset-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var id = this.dataset.shortcutId;
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
        
        rowEl.style.background = 'color-mix(in srgb,var(--accent-primary) 20%,transparent)';
        rowEl.style.outline = '1px solid var(--accent-primary)';
        
        var btn = rowEl.querySelector('.shortcut-reset-btn');
        if (btn) btn.textContent = 'Press...';
        
        if (feedbackEl) {
            feedbackEl.textContent = '⌨ Press key combination for "' + (window.ShortcutConfig._meta[id] ? window.ShortcutConfig._meta[id].label : id) + '"...';
            feedbackEl.style.opacity = '1';
            feedbackEl.style.color = 'var(--accent-cyan)';
        }
        
        document.addEventListener('keydown', captureHandler);
    }
    
    function cancelCapture() {
        if (captureState) {
            var oldRow = captureState.el;
            if (oldRow) {
                oldRow.style.background = '';
                oldRow.style.outline = '';
                var btn = oldRow.querySelector('.shortcut-reset-btn');
                if (btn) btn.textContent = 'Edit';
            }
            captureState = null;
        }
        window._shortcutCaptureActive = false;
        document.removeEventListener('keydown', captureHandler);
    }
    
    function captureHandler(e) {
        if (!captureState) return;
        
        if (e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') return;
        
        e.preventDefault();
        e.stopPropagation();
        
        var combo = {
            ctrl: !!e.ctrlKey,
            shift: !!e.shiftKey,
            alt: !!e.altKey,
            meta: !!e.metaKey,
            key: e.key
        };
        
        if (e.key === 'Escape') {
            cancelCapture();
            if (feedbackEl) {
                feedbackEl.textContent = '✕ Cancelled';
                setTimeout(function() { feedbackEl.style.opacity = '0'; }, 1000);
            }
            return;
        }
        
        if (!combo.ctrl && !combo.shift && !combo.alt && !combo.meta) {
            if (feedbackEl) {
                feedbackEl.textContent = '⚠ Use at least one modifier key (Ctrl, Shift, Alt)';
                feedbackEl.style.color = 'var(--accent-orange)';
                setTimeout(function() { feedbackEl.style.opacity = '0'; }, 2000);
            }
            return;
        }
        
        if (window.ShortcutConfig) {
            window.ShortcutConfig.set(captureState.id, combo);
        }
        
        var comboStr = window.ShortcutConfig.formatCombo(combo);
        
        cancelCapture();
        renderShortcutList();
        showFeedback();
        
        if (feedbackEl) {
            feedbackEl.textContent = '✓ Saved: ' + comboStr;
            feedbackEl.style.color = 'var(--accent-green)';
        }
    }
    
    function showFeedback() {
        if (!feedbackEl) return;
        feedbackEl.style.opacity = '1';
        clearTimeout(feedbackEl._hideTimer);
        feedbackEl._hideTimer = setTimeout(function() {
            feedbackEl.style.opacity = '0';
        }, 2500);
    }
    
    kbTabBtn.addEventListener('click', function() {
        setTimeout(renderShortcutList, 50);
        cancelCapture();
    });
    
    if (resetAllBtn) {
        resetAllBtn.addEventListener('click', function() {
            if (!window.ShortcutConfig) return;
            window.ShortcutConfig.resetAll();
            cancelCapture();
            renderShortcutList();
            if (feedbackEl) {
                feedbackEl.textContent = '✓ All shortcuts reset to defaults';
                feedbackEl.style.color = 'var(--accent-green)';
                showFeedback();
            }
        });
    }
    
    renderShortcutList();
}

window.initKeyboardShortcutsSettings = initKeyboardShortcutsSettings;

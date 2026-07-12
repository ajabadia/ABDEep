/**
 * @component CtrlTooltip
 * @purpose Rich floating tooltip showing parameter info: name, NRPN, SysEx byte, description.
 *   Auto-activates on hover over any [data-param] element using byte-map.js metadata.
 *   Also supports [data-ctrl-tooltip] for non-param controls (e.g. programmer buttons).
 * @classification UI Component
 * @complexity Low
 */
(function () {
    'use strict';

    const TOOLTIP_CLASS = 'ctrl-tooltip-container';
    const SHOW_DELAY = 400; // ms — wait before showing to avoid flicker
    const HIDE_DELAY = 150; // ms — brief hold before hiding

    let tooltipEl = null;
    let showTimer = null;
    let hideTimer = null;
    let currentTarget = null;
    let paramMeta = null;
    /* Separate store for programmer-button / custom-text tooltips (no NRPN/SysEx) */
    var customTextStore = {};

    /* ── Build parameter lookup from byte-map.js + dualMidiBridge ── */
    function buildParamMeta () {
        const meta = {};
        const byteMap = window.BYTE_MAP || [];
        const bridge = window.dualMidiBridge;
        const paramToOffset = bridge ? (bridge.paramToByteOffset || {}) : {};

        // Index byte-map entries by param id (the name in the map)
        byteMap.forEach((info, idx) => {
            if (!info) return;
            const nrpnMsb = idx < 128 ? 0 : 1;
            const nrpnLsb = idx < 128 ? idx : idx - 128;
            meta[info.param] = {
                name: info.param,
                region: info.region,
                byteOffset: idx,
                nrpn: 'NRPN ' + nrpnMsb + ':' + String(nrpnLsb).padStart(2, '0'),
                nrpnMsb: nrpnMsb,
                nrpnLsb: nrpnLsb,
                type: info.type,
                desc: info.desc || '',
                enumLabels: info.enumLabels || null
            };
        });

        // Build paramId -> meta from bridge's paramToByteOffset
        const paramMeta = {};
        for (const [paramId, byteOffset] of Object.entries(paramToOffset)) {
            const byteInfo = byteMap[byteOffset];
            const nrpnMsb = byteOffset < 128 ? 0 : 1;
            const nrpnLsb = byteOffset < 128 ? byteOffset : byteOffset - 128;

            paramMeta[paramId] = {
                name: byteInfo ? byteInfo.param : paramId.replace(/_/g, ' '),
                region: byteInfo ? byteInfo.region : '?',
                byteOffset: byteOffset,
                nrpn: 'NRPN ' + nrpnMsb + ':' + String(nrpnLsb).padStart(2, '0'),
                nrpnMsb: nrpnMsb,
                nrpnLsb: nrpnLsb,
                type: byteInfo ? byteInfo.type : 'value',
                desc: byteInfo ? (byteInfo.desc || '') : '',
                enumLabels: byteInfo ? (byteInfo.enumLabels || null) : null
            };
        }

        // Store for fallback lookups by byte-map name
        paramMeta._byteMap = meta;
        return paramMeta;
    }

    /* ── Tooltip element ── */
    function ensureTooltipEl () {
        if (tooltipEl) return tooltipEl;
        tooltipEl = document.createElement('div');
        tooltipEl.className = TOOLTIP_CLASS;
        tooltipEl.setAttribute('role', 'tooltip');
        document.body.appendChild(tooltipEl);
        return tooltipEl;
    }

    /* ── Render HTML content ── */
    function renderTooltipContent (paramId) {
        if (!paramMeta) paramMeta = buildParamMeta();

        const info = paramMeta[paramId];
        // Check custom text store for programmer / non-param controls
        if (!info && customTextStore[paramId]) {
            var data = customTextStore[paramId];
            var html = '<div class="ctrl-tt-header" style="color:var(--accent-primary,#ff9900);font-weight:700;font-size:var(--text-sm,9px);text-transform:uppercase;margin-bottom:4px">' +
                data.name +
                '</div>';
            if (data.desc) {
                html += '<div class="ctrl-tt-divider" style="border-top:1px solid var(--border-dim,#1f2228);margin:3px 0"></div>';
                html += '<div style="color:var(--text-secondary,#c5c6c7);font-size:var(--text-2xs,8px);font-style:italic;line-height:1.4">' +
                    data.desc +
                    '</div>';
            }
            return html;
        }
        if (!info) {
            // Fallback: humanize paramId
            const label = paramId
                .replace(/_/g, ' ')
                .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
            return (
                '<div class="ctrl-tt-header" style="color:var(--accent-primary,#ff9900);font-weight:700;font-size:var(--text-sm,9px);text-transform:uppercase;margin-bottom:4px">' +
                label +
                '</div>'
            );
        }

        const nameDisplay = info.name.replace(/_/g, ' ');
        var html =
            '<div class="ctrl-tt-header" style="color:var(--accent-primary,#ff9900);font-weight:700;font-size:var(--text-sm,9px);text-transform:uppercase;margin-bottom:4px">' +
            nameDisplay +
            '</div>';

        html += '<div class="ctrl-tt-divider" style="border-top:1px solid var(--border-dim,#1f2228);margin:3px 0"></div>';

        // NRPN
        html +=
            '<div class="ctrl-tt-row" style="display:flex;justify-content:space-between;gap:10px">' +
            '<span style="color:var(--text-dim,#888)">NRPN</span>' +
            '<span style="color:var(--accent-blue,#00ccff);font-family:\'Share Tech Mono\',monospace">' +
            info.nrpn +
            '</span>' +
            '</div>';

        // SysEx byte offset
        html +=
            '<div class="ctrl-tt-row" style="display:flex;justify-content:space-between;gap:10px">' +
            '<span style="color:var(--text-dim,#888)">SysEx Byte</span>' +
            '<span style="color:var(--accent-green,#00ff66);font-family:\'Share Tech Mono\',monospace">b[' +
            info.byteOffset +
            ']</span>' +
            '</div>';

        // Region
        html +=
            '<div class="ctrl-tt-row" style="display:flex;justify-content:space-between;gap:10px">' +
            '<span style="color:var(--text-dim,#888)">Region</span>' +
            '<span style="color:var(--text-secondary,#c5c6c7)">' +
            info.region +
            '</span>' +
            '</div>';

        // Type
        var typeLabel = info.type.charAt(0).toUpperCase() + info.type.slice(1);
        html +=
            '<div class="ctrl-tt-row" style="display:flex;justify-content:space-between;gap:10px">' +
            '<span style="color:var(--text-dim,#888)">Type</span>' +
            '<span style="color:var(--text-secondary,#c5c6c7);text-transform:capitalize">' +
            typeLabel +
            '</span>' +
            '</div>';

        // Enum labels — show current resolved value + full list
        if (info.enumLabels && info.enumLabels.length > 0) {
            // Look up current value from parameter cache
            var currentIdx = 0;
            try {
                var cache = window.dualMidiBridge && window.dualMidiBridge.parameterCache;
                if (cache && typeof cache[paramId] === 'number') {
                    currentIdx = Math.round(cache[paramId] * (info.enumLabels.length - 1));
                    currentIdx = Math.max(0, Math.min(currentIdx, info.enumLabels.length - 1));
                }
            } catch (e) {}
            var currentLabel = info.enumLabels[currentIdx];
            // Current value row
            html +=
                '<div class="ctrl-tt-row" style="display:flex;justify-content:space-between;gap:10px">' +
                '<span style="color:var(--text-dim,#888)">Current</span>' +
                '<span style="color:var(--accent-primary,#ff9900);font-weight:600;font-size:var(--text-sm,9px)">' +
                currentLabel +
                '</span>' +
                '</div>';
            // All possible values (compact, dim)
            var allLabels = info.enumLabels.join(', ');
            html +=
                '<div class="ctrl-tt-row" style="display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--border-dim,#1f2228);padding-top:2px;margin-top:1px">' +
                '<span style="color:var(--text-faint,#555)">Options</span>' +
                '<span style="color:var(--text-faint,#555);font-size:var(--text-2xs,7px);text-align:right;max-width:160px;line-height:1.3">' +
                allLabels +
                '</span>' +
                '</div>';
        }

        // Description
        if (info.desc) {
            html +=
                '<div class="ctrl-tt-divider" style="border-top:1px solid var(--border-dim,#1f2228);margin:3px 0;padding-top:3px">' +
                '<span style="color:var(--text-faint,#555);font-style:italic;font-size:var(--text-2xs,7px)">' +
                info.desc +
                '</span>' +
                '</div>';
        }

        return html;
    }

    /* ── Show / hide logic ── */
    function showTooltip (e, paramId) {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        if (showTimer) { clearTimeout(showTimer); showTimer = null; }

        showTimer = setTimeout(function () {
            showTimer = null;
            var el = ensureTooltipEl();

            if (el.dataset.paramId !== paramId) {
                el.dataset.paramId = paramId;
                el.innerHTML = renderTooltipContent(paramId);
            }

            var padding = 12;
            var left = e.clientX + padding;
            var top = e.clientY + padding;

            // Let layout settle
            var rect = el.getBoundingClientRect();
            var w = rect.width || 220;
            var h = rect.height || 100;

            // Flip horizontally if too close to right edge
            if (left + w > window.innerWidth - 10) {
                left = e.clientX - w - padding;
            }
            // Flip vertically if too close to bottom edge
            if (top + h > window.innerHeight - 10) {
                top = e.clientY - h - padding;
            }
            if (left < 5) left = 5;
            if (top < 5) top = 5;

            el.style.left = left + 'px';
            el.style.top = top + 'px';
            el.classList.add('visible');
        }, SHOW_DELAY);
    }

    function hideTooltip () {
        if (showTimer) { clearTimeout(showTimer); showTimer = null; }

        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

        hideTimer = setTimeout(function () {
            hideTimer = null;
            if (tooltipEl) tooltipEl.classList.remove('visible');
        }, HIDE_DELAY);
    }

    /* ── Get custom tooltip text from data-ctrl-tooltip ── */
    function getCustomTooltipText (el) {
        var text = el.getAttribute('data-ctrl-tooltip');
        if (text) return { name: text, desc: '' };

        // Known programmer button IDs with expanded names and descriptions
        var idMap = {
            'programmer-bank-mngr-btn':    { name: 'Bank Manager',          desc: 'Load, save, and organize patches' },
            'programmer-mod-matrix-btn':   { name: 'Modulation Matrix',     desc: '8 configurable modulation slots' },
            'programmer-fx-btn':           { name: 'Effects Engine',        desc: '4 FX slots with routing' },
            'programmer-arp-btn':          { name: 'Arpeggiator',           desc: 'Pattern-based note sequencer' },
            'programmer-seq-btn':          { name: 'Sequencer',             desc: '32-step control sequencer' },
            'programmer-chord-btn':        { name: 'Chord Memory',          desc: 'One-touch chord playback' },
            'random-preset-btn':           { name: 'Random Preset Generator', desc: 'Musically-random patch generator' },
            'programmer-midi-learn-btn':   { name: 'MIDI Learn',            desc: 'Map hardware controls to parameters' },
            'programmer-polychord-btn':    { name: 'Poly Chord',            desc: 'Polyphonic chord memory' },
            'programmer-compare-btn':      { name: 'Compare Mode',          desc: 'Compare edited patch vs original' },
            'programmer-write-btn':        { name: 'Write Patch',           desc: 'Write current patch to selected bank slot' },
            'programmer-global-btn':       { name: 'Global Settings',       desc: 'Open global settings' },
            'programmer-request-hw-btn':   { name: 'Request HW',            desc: 'Request current edit buffer from hardware DeepMind 12 via SysEx dump' },
            'programmer-bank-up-btn':      { name: 'Bank Up',               desc: 'Scroll to next bank' },
            'programmer-bank-down-btn':    { name: 'Bank Down',             desc: 'Scroll to previous bank' },
            'programmer-patch-up-btn':     { name: 'Patch Up',              desc: 'Select next patch' },
            'programmer-patch-down-btn':   { name: 'Patch Down',            desc: 'Select previous patch' }
        };
        return idMap[el.id] || null;
    }

    /* ── Init ── */
    function initTooltip () {
        paramMeta = buildParamMeta();

        // Mouse over capture phase — detect [data-param] and [data-ctrl-tooltip] elements
        document.addEventListener('mouseover', function (e) {
            // Check for data-param first
            var target = e.target.closest('[data-param]');
            if (target) {
                var paramId = target.getAttribute('data-param');
                if (!paramId) return;
                currentTarget = target;
                showTooltip(e, paramId);
                return;
            }

            // Fallback: data-ctrl-tooltip for non-param controls
            var ctrlTarget = e.target.closest('[data-ctrl-tooltip]');
            if (ctrlTarget) {
                var text = ctrlTarget.getAttribute('data-ctrl-tooltip');
                if (text) {
                    currentTarget = ctrlTarget;
                    customTextStore['__custom__'] = { name: text, desc: '' };
                    showTooltip(e, '__custom__');
                    return;
                }
            }

            // Known programmer buttons by id (use separate store, avoid polluting paramMeta)
            var knownBtn = e.target.closest('button[id]');
            if (knownBtn) {
                var btnData = getCustomTooltipText(knownBtn);
                if (btnData) {
                    currentTarget = knownBtn;
                    var sid = 'btn:' + knownBtn.id;
                    customTextStore[sid] = { name: btnData.name, desc: btnData.desc || '' };
                    showTooltip(e, sid);
                    return;
                }
            }

            // Not hovering over any tooltip-capable element
            if (!e.target.closest('.' + TOOLTIP_CLASS)) {
                hideTooltip();
            }
        }, true);

        // Mouse out
        document.addEventListener('mouseout', function (e) {
            var target = e.target.closest('[data-param],[data-ctrl-tooltip],button[id]');
            if (target === currentTarget || !target) {
                hideTooltip();
                currentTarget = null;
            }
        }, true);

        // Hide on scroll / resize
        document.addEventListener('scroll', hideTooltip, true);
        window.addEventListener('resize', hideTooltip);
    }

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTooltip);
    } else {
        initTooltip();
    }
})();

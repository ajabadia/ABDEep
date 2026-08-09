/**
 * @module ctrl-tooltip_render
 * @purpose Render layer for CtrlTooltip: generates rich HTML tooltip content.
 *   Extracted from ctrl-tooltip.js for SRP.
 * @classification UI Renderer
 */
(function () {
    'use strict';

    const TOOLTIP_CLASS = 'ctrl-tooltip-container';

    /** Ensure tooltip DOM element exists */
    window.ensureTooltipEl = function () {
        let el = document.querySelector('.' + TOOLTIP_CLASS);
        if (el) {return el;}
        el = document.createElement('div');
        el.className = TOOLTIP_CLASS;
        el.setAttribute('role', 'tooltip');
        document.body.appendChild(el);
        return el;
    };

    /**
     * Render rich HTML content for a parameter or custom tooltip.
     * @param {string} paramId - Parameter ID (or custom store key)
     * @param {object} paramMeta - Cached metadata from buildTooltipParamMeta()
     * @param {object} customTextStore - Map of custom tooltip entries
     * @returns {string} HTML string
     */
    window.renderTooltipContent = function (paramId, paramMeta, customTextStore) {
        if (!paramMeta) {return '';}

        const info = paramMeta[paramId];

        // Check custom text store for programmer / non-param controls
        if (!info && customTextStore && customTextStore[paramId]) {
            const data = customTextStore[paramId];
            return _renderCustomTooltip(data);
        }

        if (!info) {
            // Fallback: humanize paramId
            const label = paramId
                .replace(/_/g, ' ')
                .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
            return _renderHeader(label);
        }

        return _renderParamTooltip(info, paramId, paramMeta);
    };

    /* ── Internal render helpers ── */

    function _renderCustomTooltip(data) {
        let html = _renderHeader(data.name);
        if (data.desc) {
            html += _renderDivider();
            html += '<div style="color:var(--text-secondary,#c5c6c7);font-size:var(--text-2xs,8px);font-style:italic;line-height:1.4">' +
                data.desc +
                '</div>';
        }
        return html;
    }

    function _renderHeader(label) {
        return '<div class="ctrl-tt-header" style="color:var(--accent-primary,#ff9900);font-weight:700;font-size:var(--text-sm,9px);text-transform:uppercase;margin-bottom:4px">' +
            label +
            '</div>';
    }

    function _renderDivider() {
        return '<div class="ctrl-tt-divider" style="border-top:1px solid var(--border-dim,#1f2228);margin:3px 0"></div>';
    }

    function _renderParamTooltip(info, paramId, paramMeta) {
        const nameDisplay = info.name.replace(/_/g, ' ');
        let html = _renderHeader(nameDisplay);

        html += _renderDivider();

        // NRPN
        html += _renderRow('NRPN', info.nrpn, 'var(--accent-blue,#00ccff)', true);

        // SysEx byte offset
        html += _renderRow('SysEx Byte', 'b[' + info.byteOffset + ']', 'var(--accent-green,#00ff66)', true);

        // Region
        html += _renderRow('Region', info.region, 'var(--text-secondary,#c5c6c7)');

        // Type
        const typeLabel = info.type.charAt(0).toUpperCase() + info.type.slice(1);
        html += _renderRow('Type', typeLabel, 'var(--text-secondary,#c5c6c7)');

        // Enum labels — show current resolved value + full list
        if (info.enumLabels && info.enumLabels.length > 0) {
            html += _renderEnumSection(info, paramId);
        }

        // Description
        if (info.desc) {
            html += '<div class="ctrl-tt-divider" style="border-top:1px solid var(--border-dim,#1f2228);margin:3px 0;padding-top:3px">' +
                '<span style="color:var(--text-faint,#555);font-style:italic;font-size:var(--text-2xs,7px)">' +
                info.desc +
                '</span>' +
                '</div>';
        }

        return html;
    }

    function _renderRow(label, value, color, isMono) {
        const fontFamily = isMono ? 'font-family:\'Share Tech Mono\',monospace' : '';
        return '<div class="ctrl-tt-row" style="display:flex;justify-content:space-between;gap:10px">' +
            '<span style="color:var(--text-dim,#888)">' + label + '</span>' +
            '<span style="color:' + color + ';' + fontFamily + '">' +
            value +
            '</span>' +
            '</div>';
    }

    function _renderEnumSection(info, paramId) {
        // Look up current value from parameter cache
        let currentIdx = 0;
        try {
            const cache = getBridge() && getBridge().parameterCache;
            if (cache && typeof cache[paramId] === 'number') {
                currentIdx = Math.round(cache[paramId] * (info.enumLabels.length - 1));
                currentIdx = Math.max(0, Math.min(currentIdx, info.enumLabels.length - 1));
            }
        } catch (e) {}

        const currentLabel = info.enumLabels[currentIdx];
        const allLabels = info.enumLabels.join(', ');

        return _renderRow('Current', currentLabel, 'var(--accent-primary,#ff9900)') +
            '<div class="ctrl-tt-row" style="display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--border-dim,#1f2228);padding-top:2px;margin-top:1px">' +
            '<span style="color:var(--text-faint,#555)">Options</span>' +
            '<span style="color:var(--text-faint,#555);font-size:var(--text-2xs,7px);text-align:right;max-width:160px;line-height:1.3">' +
            allLabels +
            '</span>' +
            '</div>';
    }
})();

/**
 * @component CtrlTooltip (facade)
 * @purpose Rich floating tooltip showing parameter info: name, NRPN, SysEx byte, description.
 *   Data layer in ctrl-tooltip_data.js, render in ctrl-tooltip_render.js.
 *   Auto-activates on hover over any [data-param] or [data-ctrl-tooltip] element.
 * @classification UI Component
 */
(function () {
    'use strict';

    const SHOW_DELAY = 400; // ms — wait before showing to avoid flicker
    const HIDE_DELAY = 150; // ms — brief hold before hiding

    let tooltipEl = null;
    let showTimer = null;
    let hideTimer = null;
    let currentTarget = null;
    let paramMeta = null;
    const customTextStore = {};

    /* ── Show / hide with positioning ── */
    function showTooltip (e, paramId) {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        if (showTimer) { clearTimeout(showTimer); showTimer = null; }

        showTimer = setTimeout(function () {
            showTimer = null;
            tooltipEl = window.ensureTooltipEl();

            if (tooltipEl.dataset.paramId !== paramId) {
                tooltipEl.dataset.paramId = paramId;
                tooltipEl.innerHTML = window.renderTooltipContent(paramId, paramMeta, customTextStore);
            }

            const padding = 12;
            let left = e.clientX + padding;
            let top = e.clientY + padding;

            // Let layout settle
            const rect = tooltipEl.getBoundingClientRect();
            const w = rect.width || 220;
            const h = rect.height || 100;

            // Flip horizontally if too close to right edge
            if (left + w > window.innerWidth - 10) {
                left = e.clientX - w - padding;
            }
            // Flip vertically if too close to bottom edge
            if (top + h > window.innerHeight - 10) {
                top = e.clientY - h - padding;
            }
            if (left < 5) {left = 5;}
            if (top < 5) {top = 5;}

            tooltipEl.style.left = left + 'px';
            tooltipEl.style.top = top + 'px';
            tooltipEl.classList.add('visible');
        }, SHOW_DELAY);
    }

    function hideTooltip () {
        if (showTimer) { clearTimeout(showTimer); showTimer = null; }

        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

        hideTimer = setTimeout(function () {
            hideTimer = null;
            tooltipEl = document.querySelector('.ctrl-tooltip-container');
            if (tooltipEl) {tooltipEl.classList.remove('visible');}
        }, HIDE_DELAY);
    }

    /* ── Init ── */
    function initTooltip () {
        paramMeta = window.buildTooltipParamMeta();

        // Mouse over capture phase — detect [data-param] and [data-ctrl-tooltip] elements
        document.addEventListener('mouseover', function (e) {
            // Check for data-param first
            const target = e.target.closest('[data-param]');
            if (target) {
                const paramId = target.getAttribute('data-param');
                if (!paramId) {return;}
                currentTarget = target;
                showTooltip(e, paramId);
                return;
            }

            // Fallback: data-ctrl-tooltip for non-param controls
            const ctrlTarget = e.target.closest('[data-ctrl-tooltip]');
            if (ctrlTarget) {
                const text = ctrlTarget.getAttribute('data-ctrl-tooltip');
                if (text) {
                    currentTarget = ctrlTarget;
                    // Generate unique key based on text to prevent cache collisions
                    const textId = '__custom__:' + text.replace(/[^a-zA-Z0-9]/g, '_');
                    customTextStore[textId] = { name: text, desc: '' };
                    showTooltip(e, textId);
                    return;
                }
            }

            // Known programmer buttons by id
            const knownBtn = e.target.closest('button[id]');
            if (knownBtn) {
                const btnData = window.getTooltipCustomText(knownBtn);
                if (btnData) {
                    currentTarget = knownBtn;
                    const sid = 'btn:' + knownBtn.id;
                    customTextStore[sid] = { name: btnData.name, desc: btnData.desc || '' };
                    showTooltip(e, sid);
                    return;
                }
            }

            // Not hovering over any tooltip-capable element
            if (!e.target.closest('.ctrl-tooltip-container')) {
                hideTooltip();
            }
        }, true);

        // Mouse out
        document.addEventListener('mouseout', function (e) {
            const target = e.target.closest('[data-param],[data-ctrl-tooltip],button[id]');
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

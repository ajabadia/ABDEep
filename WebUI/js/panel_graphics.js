/**
 * @purpose Orchestrator for theoretical graph rendering on the details panel canvas.
 * Drawing functions extracted to panel_graphics_shapes.js (waveform evaluators + per-section drawers).
 * @purpose_en Graph rendering orchestrator for panel_edit details.
 * @lastUpdated 2026-07-25
 */

window.drawPanelGraphic = function() {
    const canvas = document.getElementById('panel-graphic-canvas');
    if (!canvas) {return;}
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const state = window.panelEditState || {};
    const currentPanelMode = state.currentPanelMode || 'LFO';

    // Obtener color activo de la marca desde CSS variables de forma segura
    const brandColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim() || '#ff9900';

    // Obtener colores del osciloscopio en tiempo real para coherencia visual completa
    let colors = null;
    if (typeof window._getScopeColors === 'function') {
        colors = window._getScopeColors();
    }

    if (!colors) {
        colors = {
            waveform: brandColor,
            grid: window.pgHexToRgba(brandColor, 0.03),
            center: window.pgHexToRgba(brandColor, 0.08),
            text: window.pgHexToRgba(brandColor, 0.4),
            glow: brandColor,
            trigger: window.pgHexToRgba(brandColor, 0.15)
        };
    }

    // Dibujar cuadrícula de fondo retro (CRT) coherente con el osciloscopio
    if (typeof window._drawGraphGrid === 'function') {
        window._drawGraphGrid(ctx, w, h, colors, currentPanelMode);
    }

    if (!window.dualMidiBridge || !window.dualMidiBridge.parameterCache) {return;}
    const cache = window.dualMidiBridge.parameterCache;

    // Delegar a los drawers específicos según el modo de panel activo
    if ((currentPanelMode === 'ENV' || currentPanelMode === 'VCA') && typeof window._drawEnvGraph === 'function') {
        window._drawEnvGraph(ctx, w, h, colors, cache, state);
    } else if (currentPanelMode === 'LFO' && typeof window._drawLfoGraph === 'function') {
        window._drawLfoGraph(ctx, w, h, colors, cache, state);
    } else if ((currentPanelMode === 'VCF' || currentPanelMode === 'HPF') && typeof window._drawVcfGraph === 'function') {
        window._drawVcfGraph(ctx, w, h, colors, cache, state);
    } else if (currentPanelMode === 'OSC' && typeof window._drawOscGraph === 'function') {
        window._drawOscGraph(ctx, w, h, colors, cache, state);
    } else if (currentPanelMode === 'ARP' && typeof window._drawArpGraph === 'function') {
        window._drawArpGraph(ctx, w, h, colors, cache, state);
    }
};

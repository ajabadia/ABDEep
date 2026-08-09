/**
 * @purpose FFT spectrum rendering and VCF filter overlay for the real-time oscilloscope.
 * Extracted from panel_oscilloscope.js for SRP.
 * Contains: _drawSpectrum (frequency-domain bars), _drawFilterOverlay (LP/HP/BP curve),
 * _calcFilterResponse (filter math).
 * @classification Module/Oscilloscope/Spectrum
 */

/* global hexToRgba */

/**
 * Draws the frequency-domain spectrum bars (FFT).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[]} freqData  Frequency magnitude data (0-255 per bin)
 * @param {number} top  Top Y of spectrum region
 * @param {number} bot  Bottom Y of spectrum region
 * @param {number} w  Canvas width
 * @param {object} colors  Color scheme
 */
window._drawSpectrum = function(ctx, freqData, top, bot, w, colors) {
    const graphH = bot - top;
    if (graphH < 4) {return;}

    const state = window.panelEditState || {};
    const padding = 3;
    const graphW = w - padding * 2;

    // Downsample 256 bins to ~40 bars with log-like spacing
    const numBars = 40;
    const barSpacing = 1;
    const barW = Math.max(2, Math.floor((graphW - barSpacing * (numBars - 1)) / numBars));
    const totalBarWidth = numBars * barW + (numBars - 1) * barSpacing;
    const offsetX = padding + Math.floor((graphW - totalBarWidth) / 2);

    // Peak hold per bin (slowly decays)
    if (!state._specPeakDecay) {state._specPeakDecay = new Array(numBars).fill(0);}

    for (let i = 0; i < numBars; i++) {
        // Map bar index to frequency bin index (logarithmic-like distribution)
        const binIdx = Math.floor(Math.pow(i / numBars, 0.8) * freqData.length);
        const rawVal = freqData[Math.min(binIdx, freqData.length - 1)];

        // Normalize 0-255 to 0-1 with perceptual curve for small view visibility
        const norm = Math.min(1, rawVal / 255.0);
        const boostedNorm = Math.min(1, Math.pow(norm, 0.5) * 1.5);
        const barHeight = Math.max(1, boostedNorm * (graphH - 2));
        const x = offsetX + i * (barW + barSpacing);
        const y = bot - barHeight;

        // Color gradient: low freq = warm, high freq = cool
        const t = i / numBars;
        const r = Math.round(50 + 205 * (1 - t));
        const g = Math.round(80 + 175 * t);
        const b = Math.round(200 * t + 60 * (1 - t));
        const alpha = 0.6 + boostedNorm * 0.4;

        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
        ctx.fillRect(x, y, barW, barHeight);

        // Peak hold line: slowly decays
        state._specPeakDecay[i] = Math.max(boostedNorm, state._specPeakDecay[i] * 0.85);

        if (state._specPeakDecay[i] > 0.02) {
            const holdY = bot - state._specPeakDecay[i] * (graphH - 2);
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.fillRect(x, holdY, barW, 1);
        }
    }

    // VCF filter overlay (LP/HP/BP) on the spectrum
    window._drawFilterOverlay(ctx, padding, w, top, bot, graphH, graphW);

    // Frequency labels
    ctx.fillStyle = colors.text;
    ctx.font = '6px Share Tech Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('20Hz', padding + 1, bot - 1);
    ctx.textAlign = 'center';
    ctx.fillText('1kHz', w / 2, bot - 1);
    ctx.textAlign = 'right';
    ctx.fillText('20kHz', w - padding, bot - 1);
    ctx.textAlign = 'left';
};

/**
 * Draws the VCF filter overlay (LP/HP/BP curve, cutoff line, resonance peak)
 * on top of the spectrum display.
 * Reads vcf_cutoff, vcf_resonance, vcf_model and submode from bridge parameterCache.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} padding  Canvas padding
 * @param {number} w  Canvas width
 * @param {number} top  Top Y of spectrum region
 * @param {number} bot  Bottom Y of spectrum region
 * @param {number} graphH  Height of spectrum region
 * @param {number} graphW  Width of spectrum region (excl. padding)
 */
window._drawFilterOverlay = function(ctx, padding, w, top, bot, graphH, graphW) {
    const cache = getBridge() ? getBridge().parameterCache : null;
    if (!cache) {return;}

    const rawCutoff = cache['vcf_cutoff'];
    if (rawCutoff === undefined || rawCutoff === null) {return;}
    const vcfCutoff = Math.max(0, Math.min(1, rawCutoff));
    const vcfRes = cache['vcf_resonance'] !== undefined ? Math.max(0, Math.min(1, cache['vcf_resonance'])) : 0;
    const vcfModel = cache['vcf_model'] !== undefined ? Math.round(cache['vcf_model']) : 0;

    // Determinar tipo de filtro según modelo
    let filterType = 0; // 0=LP, 1=BP, 2=HP
    let filterName = '';
    if (vcfModel === 0) {
        filterType = 0; // DM12 OTA = Lowpass
        filterName = 'OTA LP';
    } else if (vcfModel === 1) {
        const moogSub = cache['vcf_moog_submode'] !== undefined ? Math.round(cache['vcf_moog_submode']) : 0;
        filterType = moogSub; // 0=LP, 1=BP, 2=HP
        filterName = 'Moog ' + (moogSub === 0 ? 'LP' : moogSub === 1 ? 'BP' : 'HP');
    } else if (vcfModel === 2) {
        const korgSub = cache['vcf_korg_submode'] !== undefined ? Math.round(cache['vcf_korg_submode']) : 0;
        filterType = korgSub === 0 ? 0 : 2; // 0=LP, 1=HP
        filterName = 'MS-20 ' + (korgSub === 0 ? 'LP' : 'HP');
    }

    // Pole mode: 0=24dB, 1=12dB
    const poleMode = cache['vcf_pole_mode'] !== undefined ? Math.round(cache['vcf_pole_mode']) : 0;
    if (filterName) {
        filterName += ' ' + (poleMode === 0 ? '24dB' : '12dB');
    }

    // Mapear cutoff (0-1) a Hz: escala logarítmica 20Hz - 20kHz
    const cutoffHz = 20 * Math.pow(1000, vcfCutoff);

    // Mapear Hz a posición X en el canvas (log scale: 20Hz->left, 20kHz->right)
    const normX = Math.log(cutoffHz / 20) / Math.log(20000 / 20); // 0..1
    const cutoffX = padding + Math.round(normX * graphW);

    // ---- Lines de corte vertical ----
    ctx.strokeStyle = 'rgba(0, 255, 200, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(cutoffX, top);
    ctx.lineTo(cutoffX, bot);
    ctx.stroke();
    ctx.setLineDash([]);

    // ---- Zona atenuada (sombra semitransparente) ----
    const shadowColor = 'rgba(0, 100, 180, 0.12)';
    if (filterType === 0) {
        // LP: atenuado a la derecha del cutoff
        ctx.fillStyle = shadowColor;
        ctx.fillRect(cutoffX, top, w - cutoffX, bot - top);
    } else if (filterType === 2) {
        // HP: atenuado a la izquierda del cutoff
        ctx.fillStyle = shadowColor;
        ctx.fillRect(padding, top, cutoffX - padding, bot - top);
    } else {
        // BP: atenuado a ambos lados, menos atenuado cerca del cutoff
        ctx.fillStyle = shadowColor;
        ctx.fillRect(padding, top, cutoffX - padding, bot - top);
        ctx.fillRect(cutoffX, top, w - padding - cutoffX, bot - top);
    }

    // ---- Curva de respuesta del filtro ----
    // Dibujar una curva suave que muestra la atenuación
    ctx.strokeStyle = 'rgba(0, 255, 200, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const steps = 60;
    const responsePeakX = cutoffX;
    const responsePeakY = top + 2; // Pico en la parte superior

    for (let si = 0; si <= steps; si++) {
        const t = si / steps;
        const x = padding + t * graphW;

        // Calcular frecuencia en Hz en esta posición X
        const freqHz = 20 * Math.pow(20000 / 20, t);

        // Calcular respuesta del filtro (0=totalmente atenuado, 1=sin atenuación)
        const response = _calcFilterResponseLocal(freqHz, cutoffHz, vcfRes, filterType, poleMode);

        // Y: desde la parte superior (sin atenuación) hacia abajo (atenuado)
        const regionH = graphH * 0.8;
        const y = top + (1 - response) * regionH;

        if (si === 0) {ctx.moveTo(x, y);}
        else {ctx.lineTo(x, y);}
    }
    ctx.stroke();

    // ---- Pico de resonancia ----
    if (vcfRes > 0.05) {
        const peakBoost = vcfRes * 8; // Altura del pico (proporcional a la resonancia)
        const peakH = Math.min(graphH * 0.6, 4 + peakBoost * 3);
        const peakTopY = top + 2; // El pico sube hasta arriba (más resonancia = más alto)
        const peakSpread = Math.max(2, 6 + vcfRes * 20); // Ancho del pico (px)

        ctx.fillStyle = 'rgba(255, 200, 50, ' + (0.3 + vcfRes * 0.4) + ')';
        ctx.beginPath();
        // Media elipse superior (counterclockwise=true: de π a 0 por arriba)
        ctx.ellipse(cutoffX, peakTopY + peakH - 2, peakSpread, peakH, 0, Math.PI, 0, true);
        ctx.fill();
    }

    // ---- Etiqueta del filtro (solo en vista alta o zoom) ----
    if (filterName && graphH > 60) {
        ctx.fillStyle = 'rgba(0, 255, 200, 0.6)';
        ctx.font = '6.5px Share Tech Mono, monospace';
        ctx.textAlign = 'left';
        const labelX = padding + 4;
        const labelY = top + 10;
        ctx.fillText(filterName, labelX, labelY);

        // Frecuencia de corte
        const freqLabel = cutoffHz < 1000 ? Math.round(cutoffHz) + 'Hz' : (cutoffHz / 1000).toFixed(1) + 'kHz';
        ctx.fillStyle = 'rgba(0, 255, 200, 0.45)';
        ctx.font = '6px Share Tech Mono, monospace';
        ctx.fillText(freqLabel, labelX, labelY + 10);
        ctx.textAlign = 'left';
    }
};

/**
 * Calcula la respuesta del filtro para una frecuencia dada (uso interno).
 * @param {number} freqHz  Frecuencia a evaluar
 * @param {number} cutoffHz  Frecuencia de corte
 * @param {number} res  Resonancia (0-1)
 * @param {number} type  0=LP, 1=BP, 2=HP
 * @param {number} poles 0=24dB/4pole, 1=12dB/2pole
 * @returns {number} 0 (total atenuado) a 1 (sin atenuación)
 */
function _calcFilterResponseLocal(freqHz, cutoffHz, res, type, poles) {
    if (cutoffHz <= 0) {return (type === 2) ? 1 : 0;}

    const ratio = freqHz / cutoffHz;
    const slope = (poles === 0) ? 4 : 2; // 24dB = 4th order, 12dB = 2nd order

    let response;
    if (type === 0) {
        // Low Pass: 1 / (1 + (ratio)^(2*slope))
        response = 1 / (1 + Math.pow(ratio, 2 * slope));
    } else if (type === 2) {
        // High Pass: 1 / (1 + (1/ratio)^(2*slope))
        response = 1 / (1 + Math.pow(1 / Math.max(ratio, 0.001), 2 * slope));
    } else {
        // Band Pass: 2*ratio / (1 + ratio^2) — peaks at 1.0 at center frequency
        response = Math.max(0, 2 * ratio / (1 + ratio * ratio));
    }

    // Resonance peak at cutoff
    if (res > 0.01 && type !== 1) {
        const peakWidth = 1 + res * 5;
        const peakGain = 1 + res * 2.5;
        const peak = peakGain / (1 + Math.pow((freqHz / cutoffHz - 1) * peakWidth, 2));
        response = Math.min(1, response + (peak - 1) * res * 0.6);
    }

    return Math.max(0, Math.min(1, response));
}

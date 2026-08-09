/**
 * @purpose VCF/HPF frequency response graph drawer with resonance peak and ghost reference.
 * Extracted from panel_graphics_shapes.js.
 */

/** Draw VCF/HPF frequency response curve with resonance peak and ghost reference */
window._drawVcfGraph = function(ctx, w, h, colors, cache, state) {
    const currentPanelMode = state.currentPanelMode || 'VCF';
    const _animTime = state._animTime || 0;
    let cutoff = 0.5;
    let resonance = 0.0;
    let vcfModel = 0;
    let moogSubMode = 0;
    let korgSubMode = 0;
    let vcfPoleMode = 0;

    if (currentPanelMode === 'VCF') {
        cutoff = typeof cache['vcf_cutoff'] !== 'undefined' ? cache['vcf_cutoff'] : 0.5;
        resonance = typeof cache['vcf_resonance'] !== 'undefined' ? cache['vcf_resonance'] : 0.0;
        vcfModel = typeof cache['vcf_model'] !== 'undefined' ? Math.round(cache['vcf_model'] * 2) : 0;
        moogSubMode = typeof cache['vcf_moog_submode'] !== 'undefined' ? Math.round(cache['vcf_moog_submode'] * 2) : 0;
        korgSubMode = typeof cache['vcf_korg_submode'] !== 'undefined' ? Math.round(cache['vcf_korg_submode'] * 1) : 0;
        vcfPoleMode = typeof cache['vcf_pole_mode'] !== 'undefined' ? cache['vcf_pole_mode'] : 0;
        const lfoDepth = typeof cache['vcf_lfo_depth'] !== 'undefined' ? cache['vcf_lfo_depth'] : 0.0;
        if (lfoDepth > 0.01) {
            const lfoPhase = (_animTime / 1000) * Math.PI * 2 * 1.5;
            const modRange = cutoff * 0.8;
            cutoff += Math.sin(lfoPhase) * modRange * lfoDepth;
            cutoff = Math.max(0.01, Math.min(0.99, cutoff));
        }
    } else {
        cutoff = typeof cache['hpf_cutoff'] !== 'undefined' ? cache['hpf_cutoff'] : 0.2;
        const wobble = 0.02 * Math.sin((_animTime / 1000) * Math.PI * 2 * 0.8);
        cutoff += wobble;
        cutoff = Math.max(0.01, Math.min(0.99, cutoff));
    }

    // Determine effective response type and resonance character
    let responseType = 'LP';
    let resMultiplier = 1.8;
    if (currentPanelMode === 'VCF') {
        if (vcfModel === 1) {
            if (moogSubMode === 1) { responseType = 'BP'; }
            else if (moogSubMode === 2) { responseType = 'HP'; }
            resMultiplier = 2.2;
        } else if (vcfModel === 2) {
            if (korgSubMode === 1) { responseType = 'HP'; }
            resMultiplier = 3.0;
        }
    }

    // Compute gain for a given normalized frequency (0..1)
    function vcfGain(freq) {
        if (currentPanelMode === 'HPF') {
            if (freq > cutoff) { return 1.0; }
const d = cutoff - freq;
            return 1.0 / (1.0 + (d * 15.0) * (d * 15.0));
        }
        const slope = vcfPoleMode === 1 ? 7.0 : 14.0;
        if (responseType === 'LP') {
            if (freq < cutoff) {
const d = cutoff - freq;
                if (d < 0.1) { return 1.0 + resonance * resMultiplier * (1.0 - d / 0.1); }
                return 1.0;
            } else {
const d = freq - cutoff;
                return (1.0 + resonance * resMultiplier) / (1.0 + (d * slope) * (d * slope));
            }
        } else if (responseType === 'BP') {
const d = Math.abs(freq - cutoff);
            return (1.0 + resonance * resMultiplier * 1.5) / (1.0 + (d * 18.0) * (d * 18.0));
        } else {
            // HP
            if (freq > cutoff) {
const d = freq - cutoff;
                if (d < 0.1) { return 1.0 + resonance * resMultiplier * (1.0 - d / 0.1); }
                return 1.0;
            } else {
const d = cutoff - freq;
                return (1.0 + resonance * resMultiplier) / (1.0 + (d * 12.0) * (d * 12.0));
            }
        }
    }

    ctx.strokeStyle = colors.waveform;
    ctx.shadowColor = window.pgHexToRgba(colors.waveform, 0.4);
    ctx.shadowBlur = 4;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const padding = 10;
    const graphW = w - padding * 2;
    const graphH = h - padding * 2;
    const startY = h - padding;

    for (let x = 0; x < graphW; x++) {
        const freq = x / graphW;
        const gain = vcfGain(freq);
        const canvasX = padding + x;
        const canvasY = startY - gain * (graphH * 0.7);
        if (x === 0) { ctx.moveTo(canvasX, canvasY); }
        else { ctx.lineTo(canvasX, canvasY); }
    }
    ctx.stroke();

    // Ghost wave (base cutoff without LFO modulation)
    if (currentPanelMode === 'VCF') {
        const baseCutoff = typeof cache['vcf_cutoff'] !== 'undefined' ? cache['vcf_cutoff'] : 0.5;
        const slope = vcfPoleMode === 1 ? 7.0 : 14.0;
        ctx.shadowBlur = 0;
        ctx.strokeStyle = window.pgHexToRgba(colors.waveform, 0.08);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x2 = 0; x2 < graphW; x2++) {
            const freq2 = x2 / graphW;
let d2, gain2;
            if (responseType === 'LP') {
                if (freq2 < baseCutoff) {
                    d2 = baseCutoff - freq2;
                    gain2 = (d2 < 0.1) ? 1.0 + resonance * resMultiplier * (1.0 - d2 / 0.1) : 1.0;
                } else {
                    d2 = freq2 - baseCutoff;
                    gain2 = (1.0 + resonance * resMultiplier) / (1.0 + (d2 * slope) * (d2 * slope));
                }
            } else if (responseType === 'BP') {
                d2 = Math.abs(freq2 - baseCutoff);
                gain2 = (1.0 + resonance * resMultiplier * 1.5) / (1.0 + (d2 * 18.0) * (d2 * 18.0));
            } else {
                if (freq2 > baseCutoff) {
                    d2 = freq2 - baseCutoff;
                    gain2 = (d2 < 0.1) ? 1.0 + resonance * resMultiplier * (1.0 - d2 / 0.1) : 1.0;
                } else {
                    d2 = baseCutoff - freq2;
                    gain2 = (1.0 + resonance * resMultiplier) / (1.0 + (d2 * 12.0) * (d2 * 12.0));
                }
            }
            const canvasX2 = padding + x2;
            const canvasY2 = startY - gain2 * (graphH * 0.7);
            if (x2 === 0) { ctx.moveTo(canvasX2, canvasY2); }
            else { ctx.lineTo(canvasX2, canvasY2); }
        }
        ctx.stroke();
    }
};

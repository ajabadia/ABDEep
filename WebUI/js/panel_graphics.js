/**
 * @purpose Renders the theoretical graphs (curves, shapes) on the details panel canvas.
 * @purpose_en Theoretical graph renderer for panel_edit details.
 */

window._evalLfoWaveform = function(shapeVal, pct, phase) {
    const angle = pct * Math.PI * 4 + phase;
    let yVal = 0;
    if (shapeVal === 0) {
        yVal = Math.sin(angle);
    } else if (shapeVal === 1) {
        const mod = angle % (Math.PI * 2);
        if (mod < Math.PI) {
            yVal = 1.0 - (mod / (Math.PI / 2));
        } else {
            yVal = -1.0 + ((mod - Math.PI) / (Math.PI / 2));
        }
    } else if (shapeVal === 2) {
        yVal = (angle % (Math.PI * 2)) < Math.PI ? 1.0 : -1.0;
    } else if (shapeVal === 3) {
        yVal = -1.0 + 2.0 * ((angle % (Math.PI * 2)) / (Math.PI * 2));
    } else if (shapeVal === 4) {
        yVal = 1.0 - 2.0 * ((angle % (Math.PI * 2)) / (Math.PI * 2));
    } else {
        const steps = 8;
        const stepIdx = Math.floor(pct * steps);
        const randVals = [0.2, -0.6, 0.7, -0.2, -0.8, 0.4, -0.1, 0.5];
        yVal = randVals[stepIdx % randVals.length];
        if (shapeVal === 6) {
            const nextVal = randVals[(stepIdx + 1) % randVals.length];
            const interp = (pct * steps) % 1.0;
            yVal = yVal + (nextVal - yVal) * interp;
        }
    }
    return yVal;
};

window._evalOscWaveform = function(sawEn, sqEn, osc2Lvl, osc2Pitch, pct, phase) {
    const angle = pct * Math.PI * 6 + phase;
    let yVal = 0;
    if (sawEn) {yVal += -0.5 + ((angle % (Math.PI * 2)) / (Math.PI * 2));}
    if (sqEn) {yVal += (angle % (Math.PI * 2)) < Math.PI ? 0.35 : -0.35;}
    const osc2Phase = phase + osc2Pitch * Math.PI * 2;
    const a2 = pct * Math.PI * 6 + osc2Phase;
    yVal += osc2Lvl * 0.3 * Math.sin(a2 * 1.5);
    return yVal;
};

window.drawPanelGraphic = function() {
    const canvas = document.getElementById('panel-graphic-canvas');
    if (!canvas) {return;}
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const state = window.panelEditState || {};
    const currentPanelMode = state.currentPanelMode || 'LFO';
    const panelActiveLfo = state.panelActiveLfo || 1;
    const panelActiveEnv = state.panelActiveEnv || 1;
    const panelActiveOsc = state.panelActiveOsc || 1;
    const _animTime = state._animTime || 0;

    // Obtener color activo de la marca desde CSS variables de forma segura
    const brandColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim() || '#ff9900';

    // Obtener colores del osciloscopio en tiempo real para coherencia visual completa
    let colors = null;
    if (typeof window._getScopeColors === 'function') {
        colors = window._getScopeColors();
    }
    
    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    if (!colors) {
        colors = {
            waveform: brandColor,
            grid: hexToRgba(brandColor, 0.03),
            center: hexToRgba(brandColor, 0.08),
            text: hexToRgba(brandColor, 0.4),
            glow: brandColor,
            trigger: hexToRgba(brandColor, 0.15)
        };
    }

    // Dibujar cuadrícula de fondo retro (CRT) coherente con el osciloscopio (spacing 15)
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 15) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }
    for (let y = 0; y < h; y += 15) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }

    // Dibujar línea central discontinua en LFO y OSC para emular pantalla de osciloscopio real
    if (currentPanelMode === 'LFO' || currentPanelMode === 'OSC') {
        ctx.strokeStyle = colors.center;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    if (!window.dualMidiBridge || !window.dualMidiBridge.parameterCache) {return;}
    const cache = window.dualMidiBridge.parameterCache;

    if (currentPanelMode === 'ENV' || currentPanelMode === 'VCA') {
        const envNum = currentPanelMode === 'VCA' ? 1 : panelActiveEnv;
        const prefix = `env${envNum}_`;

        const a = typeof cache[prefix + 'attack'] !== 'undefined' ? cache[prefix + 'attack'] : 0.2;
        const d = typeof cache[prefix + 'decay'] !== 'undefined' ? cache[prefix + 'decay'] : 0.35;
        const s = typeof cache[prefix + 'sustain'] !== 'undefined' ? cache[prefix + 'sustain'] : 0.55;
        const r = typeof cache[prefix + 'release'] !== 'undefined' ? cache[prefix + 'release'] : 0.4;

        const aCurve = typeof cache[prefix + 'attack_curve'] !== 'undefined' ? (cache[prefix + 'attack_curve'] * 2.0 - 1.0) : 0.0;
        const dCurve = typeof cache[prefix + 'decay_curve'] !== 'undefined' ? (cache[prefix + 'decay_curve'] * 2.0 - 1.0) : 0.0;
        const rCurve = typeof cache[prefix + 'release_curve'] !== 'undefined' ? (cache[prefix + 'release_curve'] * 2.0 - 1.0) : 0.0;

        function applyCurve(t, curve) {
            if (Math.abs(curve) < 0.01) {return t;}
            const exp = curve < 0 ? 1.0 - curve * 3.0 : 1.0 / (1.0 + curve * 3.0);
            return Math.pow(t, exp);
        }

        const padding = 10;
        const graphW = w - padding * 2;
        const graphH = h - padding * 2;
        const startX = padding;
        const startY = h - padding;

        let envAmp = 1.0;
        let baseOffset = 0.0;
        let isBallsy = false;

        if (currentPanelMode === 'VCA') {
            const vcaLvl = typeof cache['vca_level'] !== 'undefined' ? cache['vca_level'] : 0.5;
            const vcaEnvDepth = typeof cache['vca_env_depth'] !== 'undefined' ? cache['vca_env_depth'] : 0.5;
            const vcaModeVal = typeof cache['vca_mode'] !== 'undefined' ? cache['vca_mode'] : 0.0;

            envAmp = vcaEnvDepth;
            baseOffset = vcaLvl;
            isBallsy = vcaModeVal > 0.5;
        }

        const getY = (val) => {
            const norm = baseOffset + val * envAmp;
            const clamped = Math.max(0.0, Math.min(1.0, norm));
            return startY - clamped * graphH * 0.9;
        };

        const totalTime = a + d + 0.7 + r;
        const aW = Math.max(4, (a / totalTime) * graphW);
        const dW = Math.max(4, (d / totalTime) * graphW);
        const sW = Math.max(8, (0.7 / totalTime) * graphW);
        const rW = Math.max(4, (r / totalTime) * graphW);

        const p0 = [startX, getY(0.0)];
        const p1 = [startX + aW, getY(1.0)];
        const p2 = [p1[0] + dW, getY(s)];
        const p3 = [p2[0] + sW, p2[1]];
        const p4 = [p3[0] + rW, getY(0.0)];

        ctx.fillStyle = hexToRgba(colors.waveform, 0.05);
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        for (let i = 0; i <= 20; i++) {
            const t = applyCurve(i / 20, aCurve);
            ctx.lineTo(p0[0] + (p1[0] - p0[0]) * (i / 20), p0[1] + (p1[1] - p0[1]) * t);
        }
        for (let i = 0; i <= 20; i++) {
            const t = applyCurve(i / 20, dCurve);
            ctx.lineTo(p1[0] + (p2[0] - p1[0]) * (i / 20), p1[1] + (p2[1] - p1[1]) * t);
        }
        ctx.lineTo(p3[0], p3[1]);
        for (let i = 0; i <= 20; i++) {
            const t = applyCurve(i / 20, rCurve);
            ctx.lineTo(p3[0] + (p4[0] - p3[0]) * (i / 20), p3[1] + (p4[1] - p3[1]) * t);
        }
        ctx.lineTo(startX + graphW, startY);
        ctx.lineTo(startX, startY);
        ctx.fill();

        ctx.strokeStyle = colors.waveform;
        if (currentPanelMode === 'VCA' && isBallsy) {
            ctx.shadowColor = colors.glow;
            ctx.shadowBlur = 8;
            ctx.lineWidth = 3;
        } else {
            ctx.shadowColor = hexToRgba(colors.waveform, 0.4);
            ctx.shadowBlur = 4;
            ctx.lineWidth = 2;
        }

        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        for (let i = 0; i <= 20; i++) {
            const t = applyCurve(i / 20, aCurve);
            ctx.lineTo(p0[0] + (p1[0] - p0[0]) * (i / 20), p0[1] + (p1[1] - p0[1]) * t);
        }
        for (let i = 0; i <= 20; i++) {
            const t = applyCurve(i / 20, dCurve);
            ctx.lineTo(p1[0] + (p2[0] - p1[0]) * (i / 20), p1[1] + (p2[1] - p1[1]) * t);
        }
        ctx.lineTo(p3[0], p3[1]);
        for (let i = 0; i <= 20; i++) {
            const t = applyCurve(i / 20, rCurve);
            ctx.lineTo(p3[0] + (p4[0] - p3[0]) * (i / 20), p3[1] + (p4[1] - p3[1]) * t);
        }
        ctx.stroke();

        ctx.shadowBlur = 0;

        ctx.fillStyle = colors.waveform;
        [p1, p2, p3].forEach(pt => {
            ctx.beginPath();
            ctx.arc(pt[0], pt[1], 3, 0, Math.PI * 2);
            ctx.fill();
        });

        const envLabel = currentPanelMode === 'VCA' ? `ENV 1 (VCA) - ${isBallsy ? 'Ballsy' : 'Transparent'}` : ['', 'ENV 1 VCA', 'ENV 2 VCF', 'ENV 3 MOD'][envNum] || `ENV ${envNum}`;
        ctx.fillStyle = colors.text;
        ctx.font = '7px Share Tech Mono, monospace';
        ctx.fillText(envLabel, padding + 2, padding + 8);

    } else if (currentPanelMode === 'LFO') {
        const prefix = `lfo${panelActiveLfo}_`;
        const shapeVal = typeof cache[prefix + 'shape'] !== 'undefined' ? Math.round(cache[prefix + 'shape'] * 6) : 1;
        const lfoRate = typeof cache[prefix + 'rate'] !== 'undefined' ? cache[prefix + 'rate'] : 0.5;

        ctx.strokeStyle = colors.waveform;
        ctx.shadowColor = hexToRgba(colors.waveform, 0.4);
        ctx.shadowBlur = 4;
        ctx.lineWidth = 2;
        ctx.beginPath();

        const padding = 10;
        const graphW = w - padding * 2;
        const graphH = h - padding * 2;
        const centerY = h / 2;
        
        const freq = 0.5 + lfoRate * 4.0;
        const phaseOffset = (_animTime / 1000) * freq * Math.PI * 2;

        for (let x = 0; x < graphW; x++) {
            const pct = x / graphW;
            const yVal = window._evalLfoWaveform(shapeVal, pct, phaseOffset);
            const canvasX = padding + x;
            const canvasY = centerY - yVal * (graphH / 2);
            if (x === 0) {ctx.moveTo(canvasX, canvasY);}
            else {ctx.lineTo(canvasX, canvasY);}
        }
        ctx.stroke();
        
        // Ghost wave (CRT phosphor trails)
        ctx.shadowBlur = 0;
        ctx.strokeStyle = hexToRgba(colors.waveform, 0.08);
        ctx.lineWidth = 1;
        ctx.beginPath();
        const ghostPhase = phaseOffset - freq * Math.PI * 0.2;
        for (let x = 0; x < graphW; x++) {
            const pct = x / graphW;
            const yVal = window._evalLfoWaveform(shapeVal, pct, ghostPhase);
            const canvasX = padding + x;
            const canvasY = centerY - yVal * (graphH / 2);
            if (x === 0) {ctx.moveTo(canvasX, canvasY);}
            else {ctx.lineTo(canvasX, canvasY);}
        }
        ctx.stroke();

    } else if (currentPanelMode === 'VCF' || currentPanelMode === 'HPF') {
        let cutoff = 0.5;
        let resonance = 0.0;
        if (currentPanelMode === 'VCF') {
            cutoff = typeof cache['vcf_cutoff'] !== 'undefined' ? cache['vcf_cutoff'] : 0.5;
            resonance = typeof cache['vcf_resonance'] !== 'undefined' ? cache['vcf_resonance'] : 0.0;
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

        ctx.strokeStyle = colors.waveform;
        ctx.shadowColor = hexToRgba(colors.waveform, 0.4);
        ctx.shadowBlur = 4;
        ctx.lineWidth = 2;
        ctx.beginPath();

        const padding = 10;
        const graphW = w - padding * 2;
        const graphH = h - padding * 2;
        const startY = h - padding;

        for (let x = 0; x < graphW; x++) {
            const freq = x / graphW;
            let gain = 1.0;

            if (currentPanelMode === 'VCF') {
                if (freq < cutoff) {
                    const dist = cutoff - freq;
                    if (dist < 0.1) {
                        const peak = resonance * 1.8 * (1.0 - dist / 0.1);
                        gain = 1.0 + peak;
                    }
                } else {
                    const dist = freq - cutoff;
                    const peak = resonance * 1.8;
                    gain = (1.0 + peak) / (1.0 + (dist * 12.0) * (dist * 12.0));
                }
            } else {
                if (freq > cutoff) {
                    gain = 1.0;
                } else {
                    const dist = cutoff - freq;
                    gain = 1.0 / (1.0 + (dist * 15.0) * (dist * 15.0));
                }
            }

            const canvasX = padding + x;
            const canvasY = startY - gain * (graphH * 0.7);

            if (x === 0) {ctx.moveTo(canvasX, canvasY);}
            else {ctx.lineTo(canvasX, canvasY);}
        }
        ctx.stroke();
        
        if (currentPanelMode === 'VCF') {
            const baseCutoff = typeof cache['vcf_cutoff'] !== 'undefined' ? cache['vcf_cutoff'] : 0.5;
            ctx.shadowBlur = 0;
            ctx.strokeStyle = hexToRgba(colors.waveform, 0.08);
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let x = 0; x < graphW; x++) {
                const freq = x / graphW;
                let gain = 1.0;
                if (freq < baseCutoff) {
                    const dist = baseCutoff - freq;
                    if (dist < 0.1) {gain = 1.0 + resonance * 1.8 * (1.0 - dist / 0.1);}
                } else {
                    const dist = freq - baseCutoff;
                    gain = 1.0 / (1.0 + (dist * 12.0) * (dist * 12.0));
                }
                const canvasX = padding + x;
                const canvasY = startY - gain * (graphH * 0.7);
                if (x === 0) {ctx.moveTo(canvasX, canvasY);}
                else {ctx.lineTo(canvasX, canvasY);}
            }
            ctx.stroke();
        }

    } else if (currentPanelMode === 'OSC') {
        ctx.strokeStyle = colors.waveform;
        ctx.shadowColor = hexToRgba(colors.waveform, 0.4);
        ctx.shadowBlur = 4;
        ctx.lineWidth = 2;
        ctx.beginPath();

        const padding = 10;
        const graphW = w - padding * 2;
        const graphH = h - padding * 2;
        const centerY = h / 2;
        
        const oscPhase = (_animTime / 1000) * Math.PI * 2 * 2.2;

        function drawOscWave(isOsc2) {
            ctx.beginPath();
            for (let x = 0; x < graphW; x++) {
                const pct = x / graphW;
                let yVal = 0;
                if (!isOsc2) {
                    const sawEn = typeof cache['osc1_saw_enable'] !== 'undefined' ? cache['osc1_saw_enable'] > 0.5 : true;
                    const sqEn = typeof cache['osc1_square_enable'] !== 'undefined' ? cache['osc1_square_enable'] > 0.5 : false;
                    const angle = pct * Math.PI * 6 + oscPhase;
                    if (sawEn) {yVal += -0.5 + ((angle % (Math.PI * 2)) / (Math.PI * 2));}
                    if (sqEn) {yVal += (angle % (Math.PI * 2)) < Math.PI ? 0.35 : -0.35;}
                } else {
                    const toneMod = typeof cache['osc2_tone_mod'] !== 'undefined' ? cache['osc2_tone_mod'] : 0.5;
                    const angle = pct * Math.PI * 6 + oscPhase;
                    const modAngle = angle % (Math.PI * 2);
                    const duty = 0.2 + toneMod * 0.6;
                    yVal = modAngle < Math.PI * duty ? 0.7 : -0.7;
                }
                const canvasX = padding + x;
                const canvasY = centerY - yVal * (graphH / 2);
                if (x === 0) {ctx.moveTo(canvasX, canvasY);}
                else {ctx.lineTo(canvasX, canvasY);}
            }
            ctx.stroke();
        }

        drawOscWave(panelActiveOsc === 2);

        // Ghost wave
        ctx.shadowBlur = 0;
        const ghostOscPhase = oscPhase - Math.PI * 0.5;
        ctx.strokeStyle = hexToRgba(colors.waveform, 0.06);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < graphW; x++) {
            const pct = x / graphW;
            let yVal = 0;
            if (panelActiveOsc !== 2) {
                const sawEn = typeof cache['osc1_saw_enable'] !== 'undefined' ? cache['osc1_saw_enable'] > 0.5 : true;
                const sqEn = typeof cache['osc1_square_enable'] !== 'undefined' ? cache['osc1_square_enable'] > 0.5 : false;
                const angle = pct * Math.PI * 6 + ghostOscPhase;
                if (sawEn) {yVal += -0.5 + ((angle % (Math.PI * 2)) / (Math.PI * 2));}
                if (sqEn) {yVal += (angle % (Math.PI * 2)) < Math.PI ? 0.35 : -0.35;}
            } else {
                const toneMod = typeof cache['osc2_tone_mod'] !== 'undefined' ? cache['osc2_tone_mod'] : 0.5;
                const angle = pct * Math.PI * 6 + ghostOscPhase;
                const modAngle = angle % (Math.PI * 2);
                const duty = 0.2 + toneMod * 0.6;
                yVal = modAngle < Math.PI * duty ? 0.7 : -0.7;
            }
            const canvasX = padding + x;
            const canvasY = centerY - yVal * (graphH / 2);
            if (x === 0) {ctx.moveTo(canvasX, canvasY);}
            else {ctx.lineTo(canvasX, canvasY);}
        }
        ctx.stroke();

    } else if (currentPanelMode === 'ARP') {
        ctx.strokeStyle = colors.waveform;
        ctx.shadowColor = hexToRgba(colors.waveform, 0.4);
        ctx.shadowBlur = 4;
        ctx.lineWidth = 2;
        const padding = 10;
        const graphW = w - padding * 2;
        const graphH = h - padding * 2;
        const centerY = h / 2;
        
        const arpRate = typeof cache['arp_rate'] !== 'undefined' ? cache['arp_rate'] : 0.5;
        const bpm = 20 + arpRate * 220;
        const beatMs = 60000 / bpm;
        const stepDuration = beatMs / 4;
        const stepIndex = Math.floor((_animTime % (stepDuration * 8)) / stepDuration);
        
        ctx.beginPath();
        const steps = 8;
        const stepW = graphW / steps;
        for (let i = 0; i <= steps; i++) {
            const x = padding + i * stepW;
            const y = centerY + (i % 4 - 2) * (graphH / 4);
            if (i === 0) {ctx.moveTo(x, y);}
            else {ctx.lineTo(x, y);}
        }
        ctx.stroke();
        
        ctx.shadowBlur = 0;

        if (stepIndex >= 0 && stepIndex < steps) {
            const dotX = padding + (stepIndex + 0.5) * stepW;
            const dotY = centerY + (stepIndex % 4 - 2) * (graphH / 4);
            ctx.fillStyle = colors.waveform;
            ctx.shadowColor = colors.glow;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }
};

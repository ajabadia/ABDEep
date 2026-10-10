/**
 * @purpose Web Audio API fallback synthesizer engine extracted from wasm_bridge.js.
 * Contains _wasmNoteOn and _wasmNoteOff — the polyphonic subtractive synth (OSC1+OSC2+Noise→VCF→VCA).
 * Called by WasmBridge when AudioWorklet/WASM is not active.
 *
 * PARIDAD CON EL MOTOR C++/WASM (los tres puntos del diagnóstico de presets):
 *  1. Tiempos de etapa: T = norm * 10 (0 … 10 s). Si el spec de conversión está
 *     cargado se usa como única fuente; si no, la MISMA ley lineal que el motor
 *     nativo (norm * maxTimeSec). Es la medición del repo (sysex_format.md:
 *     raw/255*10 = 0-10 s), NO la ley cúbica teórica de 30 s.
 *  2. VCF cutoff: Hz = 15 * 550^norm — igual que el motor nativo
 *     (resources/calibration.json: transfer.vcfCutoff.minHz=15, curveBase=550),
 *     en vez de pow(x,2.5)*18000+40 (la fórmula vieja, sin base física).
 *  3. Curvas de envolvente (bytes 0-255): exponente = applyCurve() de
 *     Source/DSP/Envelope.cpp, muestreado con setValueCurveAtTime en lugar de
 *     linearRampToValueAtTime (que ignoraba el byte de curva por completo).
 */

(function() {
    'use strict';

    // ── Constantes de paridad con el motor C++/WASM ──────────────────────────
    let ENV_TMIN = 0.0;         // s — el spec mide 0 (raw = 0)
    let ENV_TMAX = 10.0;        // s — medición del repo: raw/255*10 = 0-10 s (sysex_format.md)
    let ENV_CURVE_POINTS = 128; // resolución del Float32Array para setValueCurveAtTime
    let VCF_MIN_HZ = 15;        // resources/calibration.json: transfer.vcfCutoff.minHz
    let VCF_CURVE_BASE = 550;   // resources/calibration.json: transfer.vcfCutoff.curveBase (15·550 ≈ 8.25 kHz)

    /**
     * Normalizado (0-1) → tiempo de etapa en segundos.
     * Si el WebUI ya cargó el spec de conversión, se usa como única fuente de
     * verdad; si no, se aplica la MISMA ley lineal que el motor nativo
     * (norm * maxTimeSec), que es la medición del repo.
     * @param {number} norm - valor normalizado del parámetro (0-1)
     * @returns {number} segundos (0 … 10)
     */
    function envTimeSec(norm) {
        let n = Math.max(0, Math.min(1, norm));
        let spec = (typeof window !== 'undefined' && window.ParameterConversion)
            ? window.ParameterConversion : null;
        if (spec && spec.byId && spec.byId.env1_attack && spec.normalizedToDomain) {
            return spec.normalizedToDomain(spec.byId.env1_attack, n);
        }
        return ENV_TMIN + (ENV_TMAX - ENV_TMIN) * n;
    }

    /**
     * Normalizado (0-1) → cantidad de curva (-1 … +1), igual que domainOf() en
     * SynthEngine_Parameters.cpp (entrada env*_curve, domain [-1, 1]).
     * @param {number} norm - byte/255 del parámetro de curva
     * @returns {number} -1 (exponencial) … +1 (logarítmico)
     */
    function curveSigned(norm) {
        let n = Math.max(0, Math.min(1, norm));
        let spec = (typeof window !== 'undefined' && window.ParameterConversion)
            ? window.ParameterConversion : null;
        let entry = spec && spec.byId ? spec.byId.env1_attack_curve : null;
        if (entry && spec.normalizedToDomain) {
            return spec.normalizedToDomain(entry, n);
        }
        return (n - 0.5) * 2.0;
    }

    /**
     * Deformación de la progresión de etapa — réplica exacta de
     * Envelope::applyCurve (Source/DSP/Envelope.cpp:119).
     * @param {number} progress - progreso lineal 0-1 de la etapa
     * @param {number} curveAmount - curva ya firmada (-1 … +1)
     * @returns {number} progreso deformado 0-1
     */
    function applyCurve(progress, curveAmount) {
        if (Math.abs(curveAmount) < 0.005) {return progress;}
        let exponent = (curveAmount < 0.0)
            ? 1.0 - curveAmount * 3.0            // hasta 4.0
            : 1.0 / (1.0 + curveAmount * 3.0);   // hasta 0.25
        return Math.pow(progress, exponent);
    }

    /**
     * Progreso curvado para una etapa (Envelope::nextSample):
     *  - attack:  applyCurve(p, -curva)          → polaridad invertida
     *  - decay/release: 1 - applyCurve(1-p, curva) → complemento
     * @param {number} p - progreso lineal 0-1
     * @param {number} amount - curva firmada de la etapa
     * @param {string} stage - 'attack' | 'decay' | 'release'
     * @returns {number} progreso curvado 0-1
     */
    function stageProgress(p, amount, stage) {
        if (stage === 'attack') {return applyCurve(p, -amount);}
        return 1.0 - applyCurve(1.0 - p, amount);
    }

    /**
     * Genera el Float32Array de valores para setValueCurveAtTime (VCA/ganancia).
     * @param {number} curveNorm - byte de curva normalizado (0-1)
     * @param {number} startVal - valor al inicio de la etapa
     * @param {number} endVal - valor al final de la etapa
     * @param {string} stage - 'attack' | 'decay' | 'release'
     * @param {number} [points] - resolución (128 por defecto)
     * @returns {Float32Array} array listo para setValueCurveAtTime
     */
    function buildEnvCurve(curveNorm, startVal, endVal, stage, points) {
        let n = points || ENV_CURVE_POINTS;
        let arr = new Float32Array(n);
        let amount = curveSigned(curveNorm);
        for (let i = 0; i < n; i++) {
            let p = i / (n - 1);
            let curved = stageProgress(p, amount, stage);
            arr[i] = startVal + (endVal - startVal) * curved;
        }
        return arr;
    }

    /**
     * Normalizado (0-1) → Hz del VCF, ley exponencial del motor (15 * 550^lvl).
     * @param {number} levelNorm - nivel de cutoff (0-1) ya modulado y clampeado
     * @returns {number} Hz (10 … 8250)
     */
    function cutoffHz(levelNorm) {
        let lvl = Math.max(0, Math.min(1, levelNorm));
        let hz = VCF_MIN_HZ * Math.pow(VCF_CURVE_BASE, lvl);
        return Math.max(10, Math.min(VCF_MIN_HZ * VCF_CURVE_BASE, hz));
    }

    /**
     * Genera el Float32Array de Hz para filter.frequency (envolvente ENV2 sobre VCF).
     * Replica SynthVoice_Filter.cpp:65:
     *   targetCutoffLvl = clamp(cutoff + env * depth + lfo, 0, 1); Hz = 15 * 550^lvl
     * @param {number} curveNorm - byte de curva normalizado (0-1)
     * @param {number} startEnv - progreso de env al inicio de la etapa (0-1)
     * @param {number} endEnv - progreso de env al final de la etapa (0-1)
     * @param {string} stage - 'attack' | 'decay' | 'release'
     * @param {number} baseNorm - cutoff base normalizado del fader (0-1)
     * @param {number} depth - profundidad de env firmada (-1 … +1)
     * @param {number} [points] - resolución (128 por defecto)
     * @returns {Float32Array} array de Hz listo para setValueCurveAtTime
     */
    function buildFreqCurve(curveNorm, startEnv, endEnv, stage, baseNorm, depth, points) {
        let n = points || ENV_CURVE_POINTS;
        let arr = new Float32Array(n);
        let amount = curveSigned(curveNorm);
        for (let i = 0; i < n; i++) {
            let p = i / (n - 1);
            let curved = stageProgress(p, amount, stage);
            let env = startEnv + (endEnv - startEnv) * curved;
            arr[i] = cutoffHz(baseNorm + env * depth);
        }
        return arr;
    }

    // Expuesto para tests de paridad (WebUI/tests)
    window._wasmEnvMath = {
        envTimeSec: envTimeSec,
        curveSigned: curveSigned,
        applyCurve: applyCurve,
        stageProgress: stageProgress,
        buildEnvCurve: buildEnvCurve,
        cutoffHz: cutoffHz,
        buildFreqCurve: buildFreqCurve,
        ENV_TMIN: ENV_TMIN,
        ENV_TMAX: ENV_TMAX,
        VCF_MIN_HZ: VCF_MIN_HZ,
        VCF_CURVE_BASE: VCF_CURVE_BASE,
        ENV_CURVE_POINTS: ENV_CURVE_POINTS
    };

    /**
     * Cancela la automatización futura de un AudioParam y arranca una curva de
     * release sin salto de valor.
     *
     * La curva se programa 1 ms después de la retención: así el evento retenido
     * (o el setValueAtTime de respaldo) queda FUERA de la ventana de la curva y
     * la llamada no puede chocar con las reglas de solape de la Web Audio API.
     * @param {AudioParam} param - parámetro a congelar
     * @param {Float32Array} curve - valores de la etapa de release
     * @param {number} now - audioCtx.currentTime
     * @param {number} duration - duración de la etapa en segundos
     */
    function startReleaseCurve(param, curve, now, duration) {
        if (typeof param.cancelAndHoldAtTime === 'function') {
            param.cancelAndHoldAtTime(now);
        } else {
            param.cancelScheduledValues(now);
            param.setValueAtTime(curve[0], now);
        }
        param.setValueCurveAtTime(curve, now + 0.001, duration);
    }

    /**
     * Build and start a polyphonic voice using Web Audio API nodes (fallback).
     * Emulates: OSC1 + OSC2 + Noise → VCF (ENV1) → VCA (ENV2) → masterGain
     * @param {object} bridge - The WasmBridge instance (provides audioCtx, masterGain, activeVoices)
     * @param {number} note - MIDI note number (0-127)
     * @param {number} velocity - Note velocity (0.0-1.0)
     */
    window._wasmNoteOn = function(bridge, note, velocity) {
        if (!bridge.audioCtx || !bridge.masterGain) {return;}

        // Kill any existing voice on this note
        window._wasmNoteOff(bridge, note);

        try {
            const cache = getBridge() ? getBridge().parameterCache : {};
            const p = function(id, def) { return cache[id] !== undefined ? cache[id] : def; };
            const now = bridge.audioCtx.currentTime;

            // ── OSC1: Waveforms ──
            const osc1RangeVal = Math.round(p('osc1_range', 1)); // 0=16', 1=8', 2=4'
            const osc1OctShift = [-12, 0, 12][osc1RangeVal] || 0;
            const freq1 = 440 * Math.pow(2, (note + osc1OctShift - 69) / 12);

            const squareEn = p('osc1_square_enable', 0) > 0.5;
            const sawEn = p('osc1_saw_enable', 1) > 0.5;

            const oscNodes = [];
            const mixGain = bridge.audioCtx.createGain();

            // OSC1 — Saw
            if (sawEn || (!sawEn && !squareEn)) {
                const osc1s = bridge.audioCtx.createOscillator();
                osc1s.type = 'sawtooth';
                osc1s.frequency.setValueAtTime(freq1, now);
                const g1s = bridge.audioCtx.createGain();
                g1s.gain.setValueAtTime(squareEn ? 0.5 : 0.7, now);
                osc1s.connect(g1s);
                g1s.connect(mixGain);
                osc1s.start(now);
                oscNodes.push({ osc: osc1s, gain: g1s });
            }

            // OSC1 — Square/Pulse
            if (squareEn) {
                const osc1p = bridge.audioCtx.createOscillator();
                osc1p.type = 'square';
                osc1p.frequency.setValueAtTime(freq1, now);
                const g1p = bridge.audioCtx.createGain();
                g1p.gain.setValueAtTime(sawEn ? 0.5 : 0.7, now);
                osc1p.connect(g1p);
                g1p.connect(mixGain);
                osc1p.start(now);
                oscNodes.push({ osc: osc1p, gain: g1p });
            }

            // ── OSC2 ──
            const osc2Level = p('osc2_level', 0.5);
            if (osc2Level > 0.01) {
                const osc2RangeVal = Math.round(p('osc2_range', 1));
                const osc2OctShift = [-12, 0, 12][osc2RangeVal] || 0;
                const osc2PitchRaw = p('osc2_pitch', 0.5);
                const osc2Detune = (osc2PitchRaw - 0.5) * 24; // ±12 semitonos
                const freq2 = 440 * Math.pow(2, (note + osc2OctShift + osc2Detune - 69) / 12);

                const osc2 = bridge.audioCtx.createOscillator();
                osc2.type = 'sawtooth';
                osc2.frequency.setValueAtTime(freq2, now);
                const g2 = bridge.audioCtx.createGain();
                g2.gain.setValueAtTime(osc2Level * 0.7, now);
                osc2.connect(g2);
                g2.connect(mixGain);
                osc2.start(now);
                oscNodes.push({ osc: osc2, gain: g2 });
            }

            // ── Noise ──
            const noiseLevel = p('noise_level', 0);
            let noiseSource = null;
            if (noiseLevel > 0.02) {
                const bufSize = bridge.audioCtx.sampleRate * 2;
                const noiseBuf = bridge.audioCtx.createBuffer(1, bufSize, bridge.audioCtx.sampleRate);
                const data = noiseBuf.getChannelData(0);
                for (let i = 0; i < bufSize; i++) {data[i] = Math.random() * 2 - 1;}
                noiseSource = bridge.audioCtx.createBufferSource();
                noiseSource.buffer = noiseBuf;
                noiseSource.loop = true;
                const ng = bridge.audioCtx.createGain();
                ng.gain.setValueAtTime(noiseLevel * 0.5, now);
                noiseSource.connect(ng);
                ng.connect(mixGain);
                noiseSource.start(now);
            }

            // ── VCF (Filtro) ──
            const filter = bridge.audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            const rawCutoff = p('vcf_cutoff', 0.7);
            const vcfResNorm = p('vcf_resonance', 0.2);
            const rawVcfEnvDepth = p('vcf_env_depth', 0.5);

            // Bipolar env depth [-1..+1]
            const vcfEnvDepthSigned = (rawVcfEnvDepth - 0.5) * 2.0;

            // Paridad con el motor: Hz = 15 * 550^norm (NO pow(x,2.5)*18000+40)
            const baseCutoffHz = cutoffHz(rawCutoff);
            const qVal = 0.7 + vcfResNorm * 18.0;
            filter.Q.setValueAtTime(qVal, now);

            // ── ENV2 (VCF Envelope — Filtro) ──
            const env2A = envTimeSec(p('env2_attack', 0.01));
            const env2D = envTimeSec(p('env2_decay', 0.3));
            const env2S = Math.max(0, Math.min(1, p('env2_sustain', 0.5)));

            if (Math.abs(vcfEnvDepthSigned) > 0.02) {
                // Attack 0 → pico (1.0), Decay pico → sustain; la primera curva
                // ya arranca en baseCutoffHz, así que no se programa setValueAtTime.
                // 1 ms de separación entre etapas: ningún evento cae dentro de la
                // ventana de otra curva (evita NotSupportedError por solape).
                const vcfAtkHz = buildFreqCurve(p('env2_attack_curve', 0.5),
                    0.0, 1.0, 'attack', rawCutoff, vcfEnvDepthSigned);
                const vcfDecHz = buildFreqCurve(p('env2_decay_curve', 0.5),
                    1.0, env2S, 'decay', rawCutoff, vcfEnvDepthSigned);
                filter.frequency.setValueCurveAtTime(vcfAtkHz, now, env2A);
                filter.frequency.setValueCurveAtTime(vcfDecHz, now + env2A + 0.001, env2D);
            } else {
                filter.frequency.setValueAtTime(baseCutoffHz, now);
            }

            // ── HPF ──
            const hpfCutoff = p('hpf_cutoff', 0);
            let hpf = null;
            if (hpfCutoff > 0.02) {
                hpf = bridge.audioCtx.createBiquadFilter();
                hpf.type = 'highpass';
                hpf.frequency.setValueAtTime(20 + Math.pow(hpfCutoff, 2) * 8000, now);
                hpf.Q.setValueAtTime(0.7, now);
            }

            // ── ENV1 (VCA Envelope — Amplificador / Volumen) ──
            const vcaGain = bridge.audioCtx.createGain();
            const rawVcaLevel = p('vca_level', 0.8);
            const vcaLevelNorm = Math.max(0.1, rawVcaLevel);
            const env1A = envTimeSec(p('env1_attack', 0.005));
            const env1D = envTimeSec(p('env1_decay', 0.3));
            const env1S = Math.max(0.0, p('env1_sustain', 0.8));
            const peakGain = Math.max(0.1, (velocity || 0.8) * 0.6 * vcaLevelNorm);
            const sustainGain = Math.max(0.001, peakGain * env1S);

            // Attack → Decay → Sustain con la curva del preset (setValueCurveAtTime).
            // 1 ms de separación entre etapas: ninguna curva contiene eventos de
            // otra (evita NotSupportedError por solape en la Web Audio API).
            const vcaAtk = buildEnvCurve(p('env1_attack_curve', 0.5), 0.001, peakGain, 'attack');
            const vcaDec = buildEnvCurve(p('env1_decay_curve', 0.5), peakGain, sustainGain, 'decay');
            vcaGain.gain.setValueCurveAtTime(vcaAtk, now, env1A);
            vcaGain.gain.setValueCurveAtTime(vcaDec, now + env1A + 0.001, env1D);

            // ── Signal chain: mixGain → filter → [hpf] → vcaGain → masterGain ──
            mixGain.connect(filter);
            if (hpf) {
                filter.connect(hpf);
                hpf.connect(vcaGain);
            } else {
                filter.connect(vcaGain);
            }
            vcaGain.connect(bridge.masterGain);

            bridge.activeVoices[note] = {
                oscNodes: oscNodes,
                noiseSource: noiseSource,
                filter: filter,
                hpf: hpf,
                vcaGain: vcaGain,
                mixGain: mixGain,
                envParams: {
                    cutoffNorm: rawCutoff,
                    envDepthSigned: vcfEnvDepthSigned,
                    env2Sustain: env2S
                }
            };
        } catch (e) {
            console.warn('[WasmBridge] Error en sintetizador Web Audio:', e);
        }
    };

    /**
     * Release a voice: curves the VCF/VCA down to their targets, stops oscillators, cleanup.
     * @param {object} bridge - The WasmBridge instance
     * @param {number} note - MIDI note number to release
     */
    window._wasmNoteOff = function(bridge, note) {
        if (!bridge || !bridge.activeVoices || !bridge.activeVoices[note] || !bridge.audioCtx) {return;}

        const voice = bridge.activeVoices[note];
        delete bridge.activeVoices[note];

        try {
            const now = bridge.audioCtx.currentTime;
            const cache = getBridge() ? getBridge().parameterCache : {};
            const p = function(id, def) { return cache[id] !== undefined ? cache[id] : def; };

            const env1R = envTimeSec(p('env1_release', 0.3));
            const env2R = envTimeSec(p('env2_release', 0.3));

            // VCA release (env1_release) con la curva de release del preset
            if (voice.vcaGain && voice.vcaGain.gain) {
                const g = voice.vcaGain.gain;
                const currentGain = Math.max(0.001, g.value || 0.001);
                startReleaseCurve(g,
                    buildEnvCurve(p('env1_release_curve', 0.5), currentGain, 0.0001, 'release'),
                    now, env1R);
            }

            // VCF release (env2_release): vuelve al cutoff base (env → 0). El punto
            // de partida se inversa de la frecuencia actual para no dar saltos si la
            // nota se suelta en mitad del ataque.
            if (voice.filter && voice.filter.frequency && voice.envParams) {
                const f = voice.filter.frequency;
                const ep = voice.envParams;
                const currentFreq = Math.max(10, f.value || cutoffHz(ep.cutoffNorm));
                const levelNow = Math.log(currentFreq / VCF_MIN_HZ) / Math.log(VCF_CURVE_BASE);
                let envStart = 0.0;
                if (Math.abs(ep.envDepthSigned) > 1.0e-6) {
                    envStart = (levelNow - ep.cutoffNorm) / ep.envDepthSigned;
                }
                envStart = Math.max(0, Math.min(1, envStart));
                startReleaseCurve(f,
                    buildFreqCurve(p('env2_release_curve', 0.5),
                        envStart, 0.0, 'release',
                        ep.cutoffNorm, ep.envDepthSigned),
                    now, env2R);
            }

            // Detener osciladores tras el tiempo de release
            const stopTime = now + Math.max(env2R, env1R) + 0.05;
            if (voice.oscNodes) {
                voice.oscNodes.forEach(function(n) {
                    try { if (n.osc) { n.osc.stop(stopTime); } } catch (e) {}
                });
            }
            if (voice.noiseSource) {
                try { voice.noiseSource.stop(stopTime); } catch (e) {}
            }

            // Limpieza de nodos tras completar el release
            const cleanupDelay = (Math.max(env2R, env1R) + 0.2) * 1000;
            setTimeout(function() {
                if (voice.oscNodes) {
                    voice.oscNodes.forEach(function(n) {
                        try { if (n.osc) { n.osc.disconnect(); } } catch (e) {}
                    });
                }
                if (voice.noiseSource) { try { voice.noiseSource.disconnect(); } catch (e) {} }
                if (voice.filter) { try { voice.filter.disconnect(); } catch (e) {} }
                if (voice.hpf) { try { voice.hpf.disconnect(); } catch (e) {} }
                if (voice.vcaGain) { try { voice.vcaGain.disconnect(); } catch (e) {} }
                if (voice.mixGain) { try { voice.mixGain.disconnect(); } catch (e) {} }
            }, cleanupDelay);
        } catch (e) {
            console.warn('[WasmBridge] Error liberando voz en _wasmNoteOff:', e);
        }
    };
})();

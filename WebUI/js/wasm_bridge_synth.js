/**
 * @purpose Web Audio API fallback synthesizer engine extracted from wasm_bridge.js.
 * Contains _wasmNoteOn and _wasmNoteOff — the polyphonic subtractive synth (OSC1+OSC2+Noise→VCF→VCA).
 * Called by WasmBridge when AudioWorklet/WASM is not active.
 */

(function() {
    'use strict';

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
            const cache = window.dualMidiBridge ? window.dualMidiBridge.parameterCache : {};
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

            const baseCutoffHz = Math.max(40, Math.pow(rawCutoff, 2.5) * 18000 + 40);
            const qVal = 0.7 + vcfResNorm * 18.0;
            filter.frequency.setValueAtTime(baseCutoffHz, now);
            filter.Q.setValueAtTime(qVal, now);

            // ── Helper para mapeo de tiempo de envolvente lineal (hardware DM12: 0-10s) ──
            const calcEnvTime = function(id, defVal) {
                const norm = Math.max(0, Math.min(1, p(id, defVal)));
                return norm * 10.0;
            };

            // ── ENV2 (VCF Envelope — Filtro) ──
            const env2A = calcEnvTime('env2_attack', 0.01);
            const env2D = calcEnvTime('env2_decay', 0.3);
            const env2S = p('env2_sustain', 0.5);
            const envPeakHz = Math.max(40, Math.min(20000, baseCutoffHz + vcfEnvDepthSigned * 14000));
            const envSustainHz = Math.max(40, Math.min(20000, baseCutoffHz + (envPeakHz - baseCutoffHz) * env2S));

            if (Math.abs(vcfEnvDepthSigned) > 0.02) {
                filter.frequency.setValueAtTime(baseCutoffHz, now);
                filter.frequency.linearRampToValueAtTime(envPeakHz, now + env2A);
                filter.frequency.linearRampToValueAtTime(envSustainHz, now + env2A + env2D);
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
            const env1A = calcEnvTime('env1_attack', 0.005);
            const env1D = calcEnvTime('env1_decay', 0.3);
            const env1S = Math.max(0.0, p('env1_sustain', 0.8));
            const peakGain = Math.max(0.1, (velocity || 0.8) * 0.6 * vcaLevelNorm);
            const sustainGain = Math.max(0.001, peakGain * env1S);

            // Attack → Decay → Sustain
            vcaGain.gain.setValueAtTime(0.001, now);
            vcaGain.gain.linearRampToValueAtTime(peakGain, now + env1A);
            vcaGain.gain.linearRampToValueAtTime(sustainGain, now + env1A + env1D);

            // ── Signal chain: mixGain → filter → [hpf] → vcaGain → masterGain ──
            mixGain.connect(filter);
            if (hpf) {
                filter.connect(hpf);
                hpf.connect(vcaGain);
            } else {
                filter.connect(vcaGain);
            }
            vcaGain.connect(bridge.masterGain);

            bridge.activeVoices[note] = { oscNodes: oscNodes, noiseSource: noiseSource, filter: filter, hpf: hpf, vcaGain: vcaGain, mixGain: mixGain };
        } catch (e) {
            console.warn('[WasmBridge] Error en sintetizador Web Audio:', e);
        }
    };

    /**
     * Release a voice: ramp VCA/VCF to zero, stop oscillators, cleanup.
     * @param {object} bridge - The WasmBridge instance
     * @param {number} note - MIDI note number to release
     */
    window._wasmNoteOff = function(bridge, note) {
        if (!bridge || !bridge.activeVoices || !bridge.activeVoices[note] || !bridge.audioCtx) {return;}

        const voice = bridge.activeVoices[note];
        delete bridge.activeVoices[note];

        try {
            const now = bridge.audioCtx.currentTime;
            const cache = window.dualMidiBridge ? window.dualMidiBridge.parameterCache : {};
            const calcEnvTime = function(id, defVal) {
                const v = cache[id] !== undefined ? cache[id] : defVal;
                const norm = Math.max(0, Math.min(1, v));
                return norm * 10.0;
            };

            const env1R = calcEnvTime('env1_release', 0.3);
            const env2R = calcEnvTime('env2_release', 0.3);

            // VCA release (usar env1_release para volumen de VCA)
            if (voice.vcaGain && voice.vcaGain.gain) {
                const currentGain = Math.max(0.001, voice.vcaGain.gain.value || 0.001);
                voice.vcaGain.gain.cancelScheduledValues(now);
                voice.vcaGain.gain.setValueAtTime(currentGain, now);
                voice.vcaGain.gain.linearRampToValueAtTime(0.0001, now + env1R);
            }

            // VCF release (usar env2_release para filtro VCF)
            if (voice.filter && voice.filter.frequency) {
                const currentFreq = Math.max(20, voice.filter.frequency.value || 200);
                voice.filter.frequency.cancelScheduledValues(now);
                voice.filter.frequency.setValueAtTime(currentFreq, now);
                voice.filter.frequency.linearRampToValueAtTime(60, now + env2R);
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

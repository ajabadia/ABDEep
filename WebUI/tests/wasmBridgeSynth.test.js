/**
 * Paridad del fallback Web Audio (wasm_bridge_synth.js) con el motor C++/WASM.
 *
 * Cubre los tres puntos del diagnóstico de presets:
 *  1. Tiempos de envolvente: T = norm * 10 (0 … 10 s) — la medición del repo
 *     (sysex_format.md: raw/255*10 = 0-10 s), no la ley cúbica teórica de 30 s
 *  2. VCF cutoff: Hz = 15 * 550^norm (igual que el motor nativo: calibration.json)
 *  3. Curvas de envolvente (0-255): applyCurve() de Envelope.cpp aplicada con
 *     setValueCurveAtTime (antes se ignoraban con linearRampToValueAtTime)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
// El spec de conversión tal cual lo carga el WebUI (UMD → module.exports en Node)
import conversionSpec from '../js/conversion.gen.js';

    const RUTA_SYNTH = path.resolve(__dirname, '../js/wasm_bridge_synth.js');

/** AudioParam de mentira que registra la automatización programada. */
function fakeParam(valorInicial) {
    const eventos = [];
    return {
        value: valorInicial,
        eventos,
        setValueAtTime(v, t) { eventos.push({ metodo: 'setValueAtTime', v, t }); this.value = v; return this; },
        linearRampToValueAtTime(v, t) { eventos.push({ metodo: 'linearRampToValueAtTime', v, t }); return this; },
        cancelScheduledValues(t) { eventos.push({ metodo: 'cancelScheduledValues', t }); return this; },
        cancelAndHoldAtTime(t) { eventos.push({ metodo: 'cancelAndHoldAtTime', t }); return this; },
        setValueCurveAtTime(curva, t, dur) {
            if (curva.length < 2) { throw new TypeError('curve demasiado corta'); }
            if (!(dur > 0)) { throw new TypeError('duration debe ser > 0'); }
            eventos.push({ metodo: 'setValueCurveAtTime', curva, t, dur });
            this.value = curva[curva.length - 1];
            return this;
        },
        metodos() { return eventos.map(function(e) { return e.metodo; }); },
        curvas() { return eventos.filter(function(e) { return e.metodo === 'setValueCurveAtTime'; }); }
    };
}

/** Nodo fake mínimo para el fallback. */
function fakeNodo(tipo) {
    return {
        type: tipo,
        frequency: tipo === 'biquad' ? fakeParam(1000) : fakeParam(440),
        Q: fakeParam(1),
        gain: fakeParam(1),
        connect() {},
        disconnect() {},
        start() {},
        stop() {}
    };
}

function fakeAudioContext() {
    return {
        currentTime: 10.0,
        sampleRate: 44100,
        createGain() { return fakeNodo('gain'); },
        createBiquadFilter() { return fakeNodo('biquad'); },
        createOscillator() { return fakeNodo('osc'); },
        createBufferSource() { return fakeNodo('bufferSource'); },
        createBuffer() {
            return { getChannelData() { return new Float32Array(8); } };
        }
    };
}

describe('wasm_bridge_synth — paridad con el motor C++/WASM', () => {
    let window;
    let cache;

    /** Carga el fallback en el window falso. */
    function cargar() {
        const codigo = fs.readFileSync(RUTA_SYNTH, 'utf-8');
        eval(codigo);
        return window._wasmEnvMath;
    }

    beforeEach(() => {
        cache = {};
        window = {};
        global.window = window;
        global.getBridge = function() { return { parameterCache: cache }; };
        delete global.window.ParameterConversion;
    });

    // ─────────────────────────────────────────────── 1. Tiempos de envolvente
    describe('1. Tiempos de etapa (Tmin/Tmax/curva)', () => {
        let math;

        beforeEach(() => { math = cargar(); });

        it('norm 0 → 0 s (Tmin), norm 1 → 10 s (Tmax)', () => {
            expect(math.envTimeSec(0)).toBeCloseTo(0.0, 6);
            expect(math.envTimeSec(1)).toBeCloseTo(10.0, 6);
        });

        it('sigue la ley lineal medida del motor: norm * maxTimeSec (0-10 s)', () => {
            for (const norm of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
                const esperado = norm * 10.0;
                expect(math.envTimeSec(norm)).toBeCloseTo(esperado, 9);
            }
            // El punto medio son 5 s (la medida del repo), no el cúbico 3.75 s
            expect(math.envTimeSec(0.5)).toBeCloseTo(5.0, 6);
            expect(math.envTimeSec(0.5)).not.toBeCloseTo(3.750875, 3);
        });

        it('clampea valores fuera de [0,1]', () => {
            expect(math.envTimeSec(-1)).toBeCloseTo(0.0, 6);
            expect(math.envTimeSec(2)).toBeCloseTo(10.0, 6);
        });

        it('si conversion.gen.js está cargado usa el spec como única fuente', () => {
            // Así queda cargado el WebUI: window.ParameterConversion
            window.ParameterConversion = conversionSpec;
            const spec = window.ParameterConversion;
            expect(spec).toBeDefined();
            for (const norm of [0, 0.5, 1]) {
                const esperado = spec.normalizedToDomain(spec.byId.env1_attack, norm);
                expect(math.envTimeSec(norm)).toBeCloseTo(esperado, 9);
            }
        });

        it('raw 0/45/128/255 (bytes SysEx) dan los tiempos del spec', () => {
            const spec = conversionSpec;
            for (const raw of [0, 45, 128, 255]) {
                const t = raw / 255;
                expect(math.envTimeSec(t)).toBeCloseTo(t * 10.0, 6);
                expect(math.envTimeSec(t)).toBeCloseTo(
                    spec.normalizedToDomain(spec.byId.env1_attack, t), 6);
            }
        });
    });

    // ─────────────────────────────────────────────────── 2. Cutoff del VCF
    describe('2. VCF cutoff: 15 * 550^norm', () => {
        let math;

        beforeEach(() => { math = cargar(); });

        it('norm 0 → 15 Hz, 0.5 → 15·√550, 1 → 8250 Hz', () => {
            expect(math.cutoffHz(0)).toBeCloseTo(15, 6);
            expect(math.cutoffHz(0.5)).toBeCloseTo(15 * Math.sqrt(550), 6);
            expect(math.cutoffHz(1)).toBeCloseTo(8250, 6);     // 15 * 550
        });

        it('es exactamente 15 * 550^x (no pow(x,2.5)*18000+40)', () => {
            for (const x of [0, 0.25, 0.5, 0.75, 1]) {
                expect(math.cutoffHz(x)).toBeCloseTo(15 * Math.pow(550, x), 6);
            }
            const viejo = 0.7;
            const antiguo = Math.pow(viejo, 2.5) * 18000 + 40;
            expect(math.cutoffHz(viejo)).not.toBeCloseTo(antiguo, 0);
        });

        it('clampea el nivel a [0,1] y el resultado a [10, 8250] Hz', () => {
            expect(math.cutoffHz(-5)).toBeCloseTo(15, 6);
            expect(math.cutoffHz(5)).toBeCloseTo(8250, 6);
        });

        it('buildFreqCurve mapea env→nivel→Hz como SynthVoice_Filter.cpp:82', () => {
            const base = 0.4;
            const depth = 1.0;
            const atk = math.buildFreqCurve(0.5, 0.0, 1.0, 'attack', base, depth, 8);
            expect(atk).toBeInstanceOf(Float32Array);
            expect(atk[0]).toBeCloseTo(15 * Math.pow(550, base), 4);
            expect(atk[atk.length - 1]).toBeCloseTo(
                15 * Math.pow(550, Math.min(1, base + depth)), 4);
            // sin clamp, el pico sería >8.25 kHz: el rango se respeta
            for (const hz of atk) {
                expect(hz).toBeGreaterThanOrEqual(10);
                expect(hz).toBeLessThanOrEqual(8250);
            }
        });
    });

    // ────────────────────────────────────────── 3. Curvas de envolvente
    describe('3. Curvas 0-255 (applyCurve de Envelope.cpp)', () => {
        let math;

        beforeEach(() => { math = cargar(); });

        it('byte 0 → -1, byte 255 → +1 (dominio del spec)', () => {
            expect(math.curveSigned(0)).toBeCloseTo(-1, 6);
            expect(math.curveSigned(1)).toBeCloseTo(1, 6);
            expect(math.curveSigned(128 / 255)).toBeCloseTo((128 / 255 - 0.5) * 2, 6);
        });

        it('exponente: c<0 → 1-c*3 (hasta 4.0); c>0 → 1/(1+c*3) (hasta 0.25)', () => {
            // |c| < 0.005 → identidad
            expect(math.applyCurve(0.4, 0.0)).toBeCloseTo(0.4, 9);
            // c = -1 → exponente 4 (decaimiento fuerte)
            expect(math.applyCurve(0.5, -1)).toBeCloseTo(Math.pow(0.5, 4), 9);
            // c = +1 → exponente 0.25 (subida rápida)
            expect(math.applyCurve(0.5, 1)).toBeCloseTo(Math.pow(0.5, 0.25), 9);
        });

        it('attack invierte la polaridad y decay/release usan el complemento', () => {
            const c = -0.5; // byte bajo: exponencial
            expect(math.stageProgress(0.5, c, 'attack'))
                .toBeCloseTo(math.applyCurve(0.5, 0.5), 9);
            expect(math.stageProgress(0.5, c, 'decay'))
                .toBeCloseTo(1 - math.applyCurve(0.5, c), 9);
            expect(math.stageProgress(0.5, c, 'release'))
                .toBeCloseTo(math.stageProgress(0.5, c, 'decay'), 9);
        });

        it('los extremos de la curva son exactamente startVal y endVal', () => {
            for (const stage of ['attack', 'decay', 'release']) {
                const arr = math.buildEnvCurve(0.8, 0.1, 0.9, stage, 32);
                expect(arr).toBeInstanceOf(Float32Array);
                expect(arr.length).toBe(32);
                expect(arr[0]).toBeCloseTo(0.1, 6);
                expect(arr[arr.length - 1]).toBeCloseTo(0.9, 6);
            }
        });

        it('con curva lineal (byte 128 ≈ 0) el muestreo es lineal', () => {
            const arr = math.buildEnvCurve(0.5, 0, 1, 'decay', 5);
            for (let i = 0; i < arr.length; i++) {
                expect(arr[i]).toBeCloseTo(i / (arr.length - 1), 6);
            }
        });

        it('una curva exponencial se deforma respecto a la lineal', () => {
            const lineal = math.buildEnvCurve(0.5, 0, 1, 'decay', 17);
            const exponencial = math.buildEnvCurve(0, 0, 1, 'decay', 17);
            expect(exponencial[4]).not.toBeCloseTo(lineal[4], 4);
        });
    });

    // ─────────────────────────────────── Programación de los nodos de audio
    describe('Programación de nodos en noteOn/noteOff', () => {
        let math;
        let audioCtx;
        let bridge;
        let vca;
        let filtro;

        function noteOn() {
            audioCtx = fakeAudioContext();
            bridge = { audioCtx, masterGain: fakeNodo('gain'), activeVoices: {} };
            window._wasmNoteOn(bridge, 60, 0.8);
            vca = bridge.activeVoices[60].vcaGain;
            filtro = bridge.activeVoices[60].filter;
        }

        beforeEach(() => {
            math = cargar();
            cache = {
                env1_attack: 0.5, env1_decay: 0.25, env1_sustain: 0.8, env1_release: 0.1,
                env1_attack_curve: 0, env1_decay_curve: 1, env1_release_curve: 0.5,
                env2_attack: 0.75, env2_decay: 0.5, env2_sustain: 0.6, env2_release: 0.2,
                env2_attack_curve: 0.25, env2_decay_curve: 0.75, env2_release_curve: 0,
                vcf_cutoff: 0.4, vcf_env_depth: 1.0, vcf_resonance: 0.2,
                vca_level: 0.8
            };
            noteOn();
        });

        it('el VCA usa setValueCurveAtTime y ya NO linearRampToValueAtTime', () => {
            const metodos = vca.gain.metodos();
            expect(metodos).toContain('setValueCurveAtTime');
            expect(metodos).not.toContain('linearRampToValueAtTime');
            expect(metodos).not.toContain('setValueAtTime');
        });

        it('programa Attack y Decay con los tiempos del spec (norm * 10)', () => {
            const curvas = vca.gain.curvas();
            expect(curvas).toHaveLength(2);
            expect(curvas[0].dur).toBeCloseTo(math.envTimeSec(0.5), 6);   // 5 s
            expect(curvas[1].dur).toBeCloseTo(math.envTimeSec(0.25), 6);  // 2.5 s
            expect(curvas[1].t).toBeGreaterThanOrEqual(curvas[0].t + curvas[0].dur);
        });

        it('el VCF también recibe curvas de Hz (no rampas lineales)', () => {
            const metodos = filtro.frequency.metodos();
            expect(metodos).toContain('setValueCurveAtTime');
            expect(metodos).not.toContain('linearRampToValueAtTime');

            const curvas = filtro.frequency.curvas();
            expect(curvas).toHaveLength(2);
            expect(curvas[0].dur).toBeCloseTo(math.envTimeSec(0.75), 6);
            expect(curvas[1].dur).toBeCloseTo(math.envTimeSec(0.5), 6);
            for (const c of curvas) {
                for (const hz of c.curva) {
                    expect(hz).toBeGreaterThanOrEqual(10);
                    expect(hz).toBeLessThanOrEqual(8250);
                }
            }
            // arranca en 15 * 550^0.4 (fader de cutoff), no en pow(x,2.5)*18000+40
            expect(curvas[0].curva[0]).toBeCloseTo(15 * Math.pow(550, 0.4), 3);
        });

        it('noteOff programa releases con curva (VCA y VCF)', () => {
            window._wasmNoteOff(bridge, 60);
            expect(vca.gain.metodos()).toContain('cancelAndHoldAtTime');
            // 2 curvas de noteOn + la de release
            expect(vca.gain.curvas()).toHaveLength(3);
            const relVca = vca.gain.curvas()[2];
            expect(relVca.dur).toBeCloseTo(math.envTimeSec(0.1), 6);

            const relVcf = filtro.frequency.curvas()[2];
            expect(relVcf.dur).toBeCloseTo(math.envTimeSec(0.2), 6);
            // el release del filtro vuelve al cutoff base del fader
            expect(relVcf.curva[relVcf.curva.length - 1])
                .toBeCloseTo(15 * Math.pow(550, 0.4), 3);
        });

        it('sin profundidad de env el filtro se queda en setValueAtTime del cutoff base', () => {
            cache.vcf_env_depth = 0.5; // bipolar → 0 → sin envolvente
            noteOn();
            expect(filtro.frequency.metodos()).toContain('setValueAtTime');
            expect(filtro.frequency.curvas()).toHaveLength(0);
            expect(filtro.frequency.value).toBeCloseTo(15 * Math.pow(550, 0.4), 3);
        });
    });
});

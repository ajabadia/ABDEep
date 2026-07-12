# DSP Signal Flow — ABDEep Synth Engine

> Referencia visual rápida de la cadena de audio completa del motor DSP C++ (JUCE).
> Basado en `Source/DSP/SynthEngine.cpp`, `SynthEngine.h`, `SynthVoice.cpp`, `SynthVoice.h`.

---

## 1. Flujo General: MIDI IN → Salida Estéreo

```
MIDI IN
  │
  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  SynthEngine::processBlock()                        │
│                                                                     │
│  1. Pre-calcular LFOs globales para todo el bloque                  │
│     (globalLfo1.nextSample(), globalLfo2.nextSample())              │
│                                                                     │
│  2. Limpiar buffer de salida                                        │
│                                                                     │
│  3. Procesar eventos MIDI en orden cronológico:                     │
│     ├── Note On  → transpose → triggerNote()                       │
│     ├── Note Off → transpose → releaseNote()                       │
│     ├── Pitch Wheel → setExternalMod(kPitchBend) en todas las voces│
│     ├── CC 1 (ModWheel)   → setExternalMod(kModWheel)              │
│     ├── CC 64 (Sustain)   → setExternalMod(kSustainPedal)          │
│     └── Channel Pressure   → setExternalMod(kKeyPressure)          │
│                                                                     │
│  4. Renderizar cada voz activa en el buffer de salida               │
│     └── voices[i].process(buffer, ...)                              │
│                                                                     │
│  5. updateVoiceSnapshot() (para DebugPanel, thread-safe)            │
└─────────────────────────────────────────────────────────────────────┘
  │
  ▼
[Salida Estéreo: 12 voces sumadas en buffer L/R]
```

---

## 2. Voice Allocator — `SynthEngine::triggerNote()`

```
triggerNote(midiNote, velocity)
  │
  ├── ¿Chord Enable? ──Sí──▶ triggerChordForRoot(note, intervals[type])
  │                              │
  │                              └── Por cada nota del acorde:
  │                                  │
  ├── ¿Poly Chord? ───Sí──▶ Acumular raíz en polyChordHeldNotes[]
  │                              Force-stop TODAS las voces previas
  │                              Re-trigger acorde completo desde TODAS las raíces
  │
  └── Modo normal:
       │
       ├── Mono (modos 6-10): Force-stop todas las voces previas
       │
       └── getVoicesPerNote(voiceMode):
            ├── 0: Poly    → 1 voz/nota
            ├── 1-5: Uni2-12  → 2, 3, 4, 6, 12 voces/nota
            ├── 6-10: Mono    → 1, 2, 3, 4, 6 voces/nota
            ├── 11: Poly6  → 1 voz/nota
            └── 12: Poly8  → 1 voz/nota

            Por cada voz apilada:
              ├── findFreeVoice() (voice stealing si es necesario)
              ├── getUnisonParams() → detune simétrico + pan spread
              ├── startNote(midiNote, velocity, voiceIndex)
              └── setExternalMod() para PitchBend/ModWheel/Aftertouch/Sustain
```

### Unison Detune & Pan Spread

```
getUnisonParams(voiceInGroup, totalInGroup, detuneST, panPos):
  maxDetuneCents = unisonDetune * 50.0f   // ±0..±50 cents

  if totalInGroup == 2:
    detuneST = voice==0 ? -maxDetuneCents/100 : +maxDetuneCents/100
    panPos   = voice==0 ? 0.0f : 1.0f
  else:
    step = 2 * maxDetuneCents / (totalInGroup-1)
    detuneST = (-maxDetuneCents + voice*step) / 100.0f
    panPos   = voice / float(totalInGroup-1)
```

---

## 3. Cadena Interna por Voz — `SynthVoice::processSample()`

### Paso 1: Drift Engine (inestabilidad analógica)

```
drift.nextSample()
  ├── driftOsc1 = drift.getOsc1PitchDrift()       // cents (ruido browniano)
  ├── driftOsc2 = drift.getOsc2PitchDrift()       // cents
  ├── driftCutoff = drift.getVcfCutoffDrift()      // normalized ±
  ├── driftResonance = drift.getVcfResonanceDrift() // normalized ±
  └── driftEnvScale = 1.0 + drift.getEnvTimeDrift() * 0.3  // ±30%

Aplicar a envolventes (antes de avanzar):
  env1VCA.setTimeScale(driftEnvScale)
  env2VCF.setTimeScale(driftEnvScale)
  env3MOD.setTimeScale(driftEnvScale)
```

### Paso 2: Actualizar Fuentes de Modulación

```
updateModulationSources()
  ├── LFO1: ¿Poly/Mono/Spread?
  │     raw=0   → lfo1.nextSample() (Poly, independiente por voz)
  │     raw=1   → globalLfo1[sampleIndex] (Mono, todas las voces idéntico)
  │     raw≥2   → lfo1.nextSample() con fase offset por voz (Spread)
  ├── LFO2: mismo esquema que LFO1
  ├── env1VCA.nextSample()  → modSources[kEnv1VCA]
  ├── env2VCF.nextSample()  → modSources[kEnv2VCF]
  ├── env3MOD.nextSample()  → modSources[kEnv3MOD]
  └── drift.nextSample()
```

### Paso 3: Resolver Modulaciones de Pitch

```
osc1PitchMod  = matrix.get(kOsc1Pitch, modSources) * 12.0   // ±1 octava
osc2PitchMod  = matrix.get(kOsc2Pitch, modSources) * 12.0

pitchBendAmt  = modSources[kPitchBend] * 2.0                  // ±2 semitonos
osc1DriftST   = driftOsc1 / 100.0                              // cents→semitonos
osc2DriftST   = driftOsc2 / 100.0
globalTuneST  = globalTuneCents / 100.0                        // cents→semitonos

lastModOsc1Detune = pitchBend + osc1PitchMod + osc1DriftST + unisonDetune + globalTuneST
lastModOsc2Detune = pitchBend + params.osc2Pitch + osc2PitchMod + osc2DriftST + unisonDetune + globalTuneST

osc1Note = currentMidiNote + lastModOsc1Detune
osc2Note = currentMidiNote + lastModOsc2Detune

// Ajuste por Range (16'/8'/4')
if (range==0) note -= 12;  // 16'
if (range==2) note += 12;  // 4'

freq = 440 * 2^((note - 69) / 12)
```

### Paso 4: Generación de Osciladores

```
OSC1:
  ├── Saw wave (si osc1SawEnable)
  ├── Pulse wave (si osc1PulseEnable) con PWM modulado
  │     pwmMod = matrix.get(kOsc1SquareWidth, modSources)
  │     osc1.setModulation(kPWM, params.osc1PwmAmount + pwmMod)
  └── Rango: 16'/8'/4' (±12 semitonos)

OSC2:
  ├── Forma de onda según selección (saw/pulse/etc.)
  ├── Tone Mod:
  │     toneMod = matrix.get(kOsc2ToneMod, modSources)
  │     osc2.setModulation(kToneMod, params.osc2ToneMod + toneMod)
  └── Rango: 16'/8'/4'

Noise:
  noiseSample = (-1..1) * clamp(noiseLevel + noiseVolMod, 0, 1)

// Mezcla:
osc1Sample = osc1.nextSample() * clamp(1.0 + osc1VolMod, 0, 1)
osc2Sample = osc2.nextSample() * clamp(osc2Level + osc2VolMod, 0, 1)
combinedOsc = osc1Sample + osc2Sample + noiseSample
```

### Paso 5: Filtro VCF (Pasa-Bajos)

```
// Parámetros modulados:
cutoffLvl = vcfCutoff + vcfCutoffMod           // mod matrix
          + (env2Value * vcfEnvDepth)           // envelope
          + (lfoValue * vcfLfoDepth)            // LFO
          + cutoffDriftMod                      // drift
cutoffLvl = clamp(0, 1)

// Mapeo logarítmico:
cutoffHz = 20 * 1000^cutoffLvl                  // 20Hz → 20kHz

// Key tracking:
keyTrackHz = (freq - 261.63) * vcfKeyTrack      // relativo a C4
cutoffHz = clamp(10, sampleRate*0.45)

// Pole mode:
vcf.setPoleMode(params.vcfPoleMode)
  mode=0 → 2-Pole (12dB/oct, 1 biquad)
  mode=1 → 4-Pole (24dB/oct, 2 biquads en cascada)

// Resonancia:
resLvl = resonance + filterResMod + resonanceDriftMod
vcf.setResonance(clamp(resLvl, 0, 1))

filtered = vcf.process(combinedOsc)              // con saturación tanh() interna
```

### Paso 6: Filtro HPF (Pasa-Altos)

```
hpfCutoffHz = clamp(hpfCutoff + hpfCutoffMod * 500, 10, 10000)
hpf.setCutoff(hpfCutoffHz)
hpf.setBassBoostActive(params.hpfBassBoost)
finalFiltered = hpf.process(filtered)
```

### Paso 7: Amplificador VCA

```
// Nivel final:
ampLevel = (vcaLevel + ampLevelMod) * vcaEnvelopeValue  // env1VCA
ampLevel = clamp(0, 1)

if vcaMode == Ballsy (1):
  drive     = (finalFiltered * ampLevel) * (1.0 + ampLevel)
  asymmetry = drive * 0.04 * ampLevel
  shaped    = tanh(drive + asymmetry)
  makeup    = 1.0 + (1.0 - |shaped|) * 0.3 * ampLevel
  signal    = shaped * makeup

if vcaMode == Transparent (0):
  signal    = finalFiltered * ampLevel
```

### Paso 8: Panorámica Estéreo

```
// Pan base (Unison):
basePan = 0.5 + (unisonPanPosition - 0.5) * voicePanSpread

// Modulación:
panMod = matrix.get(kAmpPan, modSources)
pan = clamp(basePan + panMod, 0, 1)
lastModPan = pan

// Distribución estéreo:
output[L] += signal * (1.0 - pan)
output[R] += signal * pan
```

---

## 4. Diagrama Compacto (por muestra)

```
┌─────────┐  ┌─────────┐  ┌────────┐
│ Drift   │  │ LFO1/2  │  │ ENV1/2 │
│ Engine  │  │ (Poly/  │  │ /3     │
│ (cents) │  │ Mono/   │  │ (ADSR  │
│         │  │ Spread) │  │ curvo) │
└────┬────┘  └────┬────┘  └───┬────┘
     │            │           │
     ▼            ▼           ▼
┌────────────────────────────────────┐
│        Mod Matrix (8 slots)        │
│  ┌──────────┐  ┌───────────────┐   │
│  │ 24 Fuentes│→ │ ~45 Destinos  │   │
│  └──────────┘  └───────┬───────┘   │
└────────────────────────┬───────────┘
                         │
      ┌──────────────────┼──────────────────┐
      ▼                  ▼                  ▼
┌──────────┐    ┌──────────────┐    ┌────────────┐
│ OSC1 Pitch│    │ OSC1 PWM     │    │ OSC2 Pitch │
│ OSC2 Pitch│    │ OSC2 Tone Mod│    │ + Levels   │
│ ±12 st    │    │ Levels       │    │            │
└────┬─────┘    └──────┬───────┘    └─────┬──────┘
     │                 │                  │
     └─────────────────┼──────────────────┘
                       ▼
              ┌────────────────┐
              │  OSC1 + OSC2   │
              │  + Noise = MIX │
              └───────┬────────┘
                      ▼
              ┌────────────────┐
              │  VCF (LPF)     │
              │  2/4 Pole      │
              │  Cutoff+Res    │
              └───────┬────────┘
                      ▼
              ┌────────────────┐
              │  HPF           │
              │  Bass Boost    │
              └───────┬────────┘
                      ▼
              ┌────────────────┐
              │  VCA           │
              │  Ballsy/Transp │
              │  × env1VCA     │
              └───────┬────────┘
                      ▼
              ┌────────────────┐
              │  PAN (Estéreo) │
              │  L = (1-pan)   │
              │  R = pan       │
              └───────┬────────┘
                      ▼
              [Sumar al buffer de salida]
```

---

## 5. Resumen de Señal por Voz

```
OSC1 ─┐
OSC2 ─┤
Noise ─┤
       v
  [MIX] → VCF (LPF) → HPF → VCA → [PAN] → L─────┐
                                       R─────┐    │
                                             │    │
  [12 voces sumadas en el buffer estéreo]    │    │
  ←────────────────────────────────────────────┘    │
  ←─────────────────────────────────────────────────┘
```

---

## 6. Controladores MIDI Externos

| Control | MIDI | Rango | Destino en DSP |
|---|---|---|---|
| **Pitch Bend** | Pitch Wheel msg | -1.0 .. +1.0 | `setExternalMod(kPitchBend)` → × 2 semitonos |
| **Mod Wheel** | CC 1 | 0 .. 1 | `setExternalMod(kModWheel)` → fuente mod matrix |
| **Sustain Pedal** | CC 64 | 0 .. 1 | `setExternalMod(kSustainPedal)` → fuente mod matrix |
| **Aftertouch** | Channel Pressure | 0 .. 1 | `setExternalMod(kKeyPressure)` → fuente mod matrix |

Los controladores se propagan a **todas las voces** (activas e inactivas) en cada evento MIDI.

---

## 7. Orden de Aplicación de Detune/Pitch

```
MIDI IN → Transpose (±48 st, dispatch MIDI)       ← SynthEngine::processBlock()
  →
SynthVoice::processSample():
  1. Pitch Bend        (±2 st)
  2. Mod Matrix Pitch  (±12 st via sourceValues)
  3. Unison Detune     (±0–50 cents, simétrico)
  4. Drift OSC1/OSC2   (cents, ruido browniano)
  5. Global Tune       (±128 cents / 100 → semitonos)
  6. Range             16'/8'/4' (±12 st cada uno)
```

---

## 8. Archivos Relacionados

| Archivo | Rol |
|---|---|
| `Source/DSP/SynthEngine.h` | Coordinación: polifonía, MIDI routing, LFO global, mod matrix, chord memory |
| `Source/DSP/SynthEngine.cpp` | `processBlock()`, `triggerNote()`, `releaseNote()`, `updateParameters()` |
| `Source/DSP/SynthVoice.h` | Voz individual: osciladores, filtros, envolventes, drift, mod sources |
| `Source/DSP/SynthVoice.cpp` | `processSample()` — cadena completa de 8 pasos por muestra |
| `Source/DSP/ModulationMatrix.h/.cpp` | 8 slots de ruteo, 24 fuentes, ~45 destinos |
| `Source/DSP/Envelope.h/.cpp` | ADSR con curvas configurables y time scale drift |
| `Source/DSP/LFO.h/.cpp` | LFO Polifónico/Global con soporte Mono/Spread |
| `Source/DSP/Filter.h/.cpp` | VCF (2/4 Pole) + HPF con saturación tanh |
| `Source/DSP/OSC1.h/.cpp` | Oscilador 1: Saw + Pulse con PWM |
| `Source/DSP/OSC2.h/.cpp` | Oscilador 2: forma de onda + Tone Mod |
| `Source/DSP/DriftEngine.h/.cpp` | 4 osciladores de ruido browniano para inestabilidad analógica |

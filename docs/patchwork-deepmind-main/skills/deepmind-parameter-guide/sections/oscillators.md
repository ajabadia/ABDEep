# Oscillators — Parameter Guide

> Source: DeepMind 12 Owner's Manual, pp. 62–73 (§8.3 OSC)

## What this controls

The oscillator section generates the raw audio material for the synth. OSC 1 is a dual-waveform oscillator (sawtooth + square, independently switchable). OSC 2 is a single square-wave oscillator with pitch offset and tone modulation. A pink noise generator is also mixed in here. All oscillator pitch control is digital (stable tuning); the audio signal path is fully analog.

**Params**: `osc1.range`, `osc1.sawtooth`, `osc1.square`, `osc1.pitchMod`, `osc1.pitchModSelect`, `osc1.aftertouch.pitchMod`, `osc1.modWheel.pitchMod`, `osc1.pwm`, `osc1.pwmSource`, `osc1.pitchModMode`, `osc.keyDownReset`, `osc2.sync`, `osc2.range`, `osc2.pitch`, `osc2.level`, `osc2.pitchMod`, `osc2.pitchModSelect`, `osc2.aftertouch.pitchMod`, `osc2.modWheel.pitchMod`, `osc2.toneMod`, `osc2.toneModSource`, `noise.level` — run `describe_param` on any for range and labels.

### Pitch Mod Source enum (NRPN 22, 32)

| Value | Label           | Notes                              |
|------:|-----------------|------------------------------------|
| 0     | LFO 1           | Bipolar                            |
| 1     | LFO 2           | Bipolar                            |
| 2     | VCA Env (ENV 1)  | Unipolar (positive only from pitch)|
| 3     | VCF Env (ENV 2)  | Unipolar                           |
| 4     | Mod Env (ENV 3)  | Unipolar                           |
| 5     | LFO 1 Unipolar   | Positive-only LFO 1               |
| 6     | LFO 2 Unipolar   | Positive-only LFO 2               |

### PWM Source enum (NRPN 16)

| Value | Label           | Notes                                       |
|------:|-----------------|---------------------------------------------|
| 0     | Manual          | PWM fader sets pulse width directly (50–99%) |
| 1     | LFO 1           | PWM fader sets mod depth (0 to ±49%)         |
| 2     | LFO 2           | PWM fader sets mod depth (0 to ±49%)         |
| 3     | VCA Env (ENV 1)  | PWM fader sets mod depth (0 to ±49%)         |
| 4     | VCF Env (ENV 2)  | PWM fader sets mod depth (0 to ±49%)         |
| 5     | Mod Env (ENV 3)  | PWM fader sets mod depth (0 to ±49%)         |

### Tone Mod Source enum (NRPN 17)

Same structure as PWM Source (values 0–5). When Manual, fader controls tone directly (50–100%). When modulated, fader sets depth (0 to ±49%).

## Value guidance

- **osc1.range / osc2.range**: 16' = sub bass (C = 16.35 Hz), 8' = normal (C = 32.7 Hz), 4' = one octave up (C = 65.4 Hz). Default: 8'.
- **osc1.pitchMod / osc2.pitchMod**: The fader response is non-linear — most of the resolution is at small values (fine vibrato). Values 0–10 cover roughly 0–2 semitones; values above ~200 reach up to 36 semitones. For subtle vibrato, keep below 20. For FM-style effects, go above 100.
- **osc1.pwm**: When source is Manual, 0 = 50% (true square wave), 255 = 99% (very narrow pulse, clicks at low frequencies). For classic PWM strings, use LFO 1/2 source with depth 80–150.
- **osc2.pitch**: 128 = unison with OSC 1. Values near center have fine resolution in cents. ±12 semitones range. Slight detune (125–131) creates width; larger offsets (116 = -12, 140 = +12) for harmonic intervals.
- **osc2.level**: 0 = Off. For balanced two-oscillator sounds, set to 255 (0.0 dB). Reduce for subtle layering.
- **osc2.toneMod**: Splits the square wave cycle with a pulse insert. Creates metallic, bell-like timbres. Higher values = wider pulse interrupt. Good for complex textures and string-type sounds.
- **noise.level**: Pink noise with low-frequency roll-off. 0 = Off. Use ~100–150 for breathy/atmospheric textures without drowning the oscillators. 255 = full 0.0 dB level.

## Interactions

- `osc1.pwm` / `osc1.pwmSource` only affect the **square waveform** — no effect when only sawtooth is enabled (`osc1.square` = 0).
- `osc1.pitchModMode` (NRPN 38): When set to 0 (OSC1+2), the **OSC 1 Pitch Mod fader** controls vibrato for *both* oscillators. Set to 1 to modulate OSC 1 independently (useful with sync).
- `osc2.sync` hard-syncs OSC 2 to OSC 1. Varying `osc2.pitch` with sync on creates classic sync-sweep timbres. If OSC 2 frequency is less than half of OSC 1, OSC 2 may produce no output.
- `osc.keyDownReset` resets oscillator phase on each key press — useful for consistent attack transients (plucks, percussion), but removes the natural phase variation of analog oscillators.
- `osc2.level` must be > 0 for OSC 2 to be audible in the mix.
- The LFOs can reach audio rates, making true FM possible via pitch mod. Use `lfo1.rate` / `lfo2.rate` at high values for metallic/clangorous timbres.

## Signal flow

```
OSC 1 SAW ──┐
OSC 1 SQR ──┤
OSC 2 SQR ──┼──► [MIXER] ──► VCF (filter) ──► VCA ──► FX ──► OUTPUT
NOISE ──────┘
```

## Related sections

- → [filter.md](filter.md) for VCF (what processes the oscillator output)
- → [lfos.md](lfos.md) for LFO shapes, rates, and sync (mod sources for pitch/PWM/tone)
- → [envelopes.md](envelopes.md) for envelope shapes used as mod sources
- → [mod-matrix.md](mod-matrix.md) for additional modulation routing beyond the dedicated controls
- → [voice-config.md](voice-config.md) for unison detune, polyphony mode, portamento

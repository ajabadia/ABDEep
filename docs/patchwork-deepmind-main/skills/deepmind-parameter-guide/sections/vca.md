# VCA — Parameter Guide

> Source: DeepMind 12 Owner's Manual, pp. 87 (§8.6 VCA)

## What this controls

The Voltage Controlled Amplifier (VCA) controls the volume of each voice. It has two stages: a **per-voice stereo VCA** modulated by the VCA envelope, velocity, pan spread, and Mod Matrix, and a **common VCA** (Level fader) that sets the overall program volume after all voices are summed. The per-voice VCA is what shapes the amplitude contour of each note; the Level fader compensates for volume differences between programs.

**Params**: `vca.level`, `vca.envDepth`, `vca.envVelocity`, `vca.panSpread` — run `describe_param` on any for ranges and units.

## Value guidance

- **vca.level**: Controls the common (post-sum) VCA gain. 128 = 0 dB (unity). Values below 128 attenuate; values above 128 boost (up to +6 dB). Use this to balance volume between programs. Most programs leave this at 128 unless a patch is notably louder or quieter than others.

- **vca.envDepth**: At 255 (default), the VCA envelope fully controls the per-voice amplitude — this is normal behavior where ADSR shapes the sound. Reducing this value makes the envelope less effective: at 0, notes play at constant volume regardless of the envelope shape. Intermediate values (e.g., 180–240) can be useful for drone/pad sounds where you want a subtle envelope contour but never complete silence.

- **vca.envVelocity**: Controls keyboard dynamics. 0 = every note plays at the same volume regardless of how hard you strike keys (good for organ/synth-pad sounds). 128 = moderate velocity response (default). 255 = maximum dynamic range — very soft playing is nearly silent, hard playing is full volume. For expressive leads and pianos, use 160–220. For pads and sequences, 0–80 works well.

- **vca.panSpread**: Distributes voices across the stereo field. Display value 0 (raw 128) = all voices center (mono image). Positive values spread voices left-to-right in order (voice 1 left, voice 12 right). Negative values reverse the spread direction. Higher absolute values = wider stereo image. For lush pads and strings, try raw 148–180 (display +20 to +52). For focused bass/lead sounds, keep at 128 (center). The diagram in the manual shows voices fanning out symmetrically from center as spread increases.

- **VCA Mode** (menu option, no known NRPN): Switches between "Ballsy" and "Transparent" modes. "Ballsy" adds harmonic character to the VCA stage; "Transparent" provides cleaner gain with reduced VCA level. This parameter may only be accessible from the front panel menu.

## Interactions

- `vca.envDepth` determines whether the VCA envelope (documented in [envelopes.md](envelopes.md)) has any effect on volume. If `vca.envDepth` is 0, the envelope ADSR settings are inaudible on the amplitude.
- `vca.envVelocity` is separate from `filter.envVelocity` (NRPN 43) — you can have velocity affect volume without affecting the filter, or vice versa.
- The per-voice VCA level is available as a **Mod Matrix destination**, so any mod source (LFO, envelope, aftertouch, etc.) can modulate individual voice volume. See [mod-matrix.md](mod-matrix.md).
- `vca.panSpread` interacts with any Pan destination in the Mod Matrix — the spread sets a static stereo position per voice, while Mod Matrix pan modulation adds movement on top.
- The HPF sits **after** the VCA in the signal chain. HPF parameters are documented in [filter.md](filter.md).
- The VCA envelope itself (attack, decay, sustain, release, curves, trigger mode) is documented in [envelopes.md](envelopes.md). Set the envelope shape there and control how much it applies here via `vca.envDepth`.

## Signal flow

```
                                          Per-voice VCA         Common VCA
                                          (env/vel/pan)         (Level fader)
OSC 1 ─┐                                      │                     │
OSC 2 ─┤→ MIXER → VCF (LP filter) ──► [per-voice VCA] ──► SUM ──► [Level] ──► HPF → FX → OUTPUT
NOISE ─┘                                      ▲
                                    VCA Env · Velocity · Pan Spread · Mod Matrix
```

## Related sections

- → [envelopes.md](envelopes.md) for VCA envelope ADSR, curves, and trigger modes
- → [filter.md](filter.md) for VCF (before VCA) and HPF (after VCA)
- → [mod-matrix.md](mod-matrix.md) for routing modulation to per-voice VCA level and pan
- → [voice-config.md](voice-config.md) for polyphony mode, unison, and envelope trigger behavior

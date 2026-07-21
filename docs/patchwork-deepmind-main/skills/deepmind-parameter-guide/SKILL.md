---
name: deepmind-parameter-guide
description: >
  Musical context for the DeepMind 12: what parameters interact, why they
  matter sonically, and non-obvious techniques. Use when designing sounds or
  exploring the synth beyond basic parameter setting.
compatibility: No runtime dependencies. Used as read-only context by agents.
metadata:
  repo: patchwork-deepmind
  focus: musical-context
---

> **MCP note**: `describe_param` returns ranges, units, and enum labels for any parameter. `set_param`/`set_params` accept `value` (0..1), `rawValue`, or `label`. This skill focuses on the *why* and *what it sounds like* — things the tools can't tell you.

Start with [recipes.md](sections/recipes.md) for complete sound-design examples, then read individual sections for deeper context on a specific area.

## Sections

| Section file                                        | Covers                                     |
|-----------------------------------------------------|--------------------------------------------|
| [recipes.md](sections/recipes.md)                    | Non-obvious parameter interactions — full examples with values |
| [oscillators.md](sections/oscillators.md)            | OSC 1 (saw/square/PWM), OSC 2 (pitch/tone mod/sync), noise, waveform enables |
| [filter.md](sections/filter.md)                      | VCF cutoff, resonance, 2/4-pole, env depth/polarity/velocity, LFO mod, key tracking, HPF, bass boost |
| [envelopes.md](sections/envelopes.md)                | VCA/VCF/MOD envelope ADSR, trigger modes, per-stage curve shaping |
| [lfos.md](sections/lfos.md)                          | LFO 1 & 2 rate, delay, shape, key/arp sync, phase/mono, slew rate, clock divide |
| [vca.md](sections/vca.md)                            | VCA level, envelope depth, velocity sensitivity, pan spread |
| [mod-matrix.md](sections/mod-matrix.md)              | 8 mod busses: 24 sources, 132 destinations, bipolar depth, meta-modulation, FX modulation |
| [arp-sequencer.md](sections/arp-sequencer.md)        | Arpeggiator on/off, mode, rate, clock divider, gate, hold, pattern, swing, octaves; control sequencer enable, clock, length, swing, key/loop, slew, step values; ARP settings |
| [effects.md](sections/effects.md)                    | FX architecture (4 slots, routing, NRPNs), master effects table (35 types), links to category detail files |
| [effects/reverbs.md](sections/effects/reverbs.md)    | 13 reverb effects: TC-DeepVRB, AmbVerb, RoomRev, VintageRev, HallRev, ChamberRev, PlateRev, RichPltRev, GatedRev, Reverse, ChorusVerb, DelayVerb, FlangVerb |
| [effects/delays.md](sections/effects/delays.md)      | 6 delay effects: Delay, 3TapDelay, 4TapDelay, T-RayDelay, DecimDelay, ModDlyRev |
| [effects/creative.md](sections/effects/creative.md)  | 8 creative effects: Chorus, Chorus-D, Flanger, Phaser, MoodFilter, DualPitch, VintgPitch, RotarySpkr |
| [effects/processing.md](sections/effects/processing.md) | 8 processing effects: MidasEQ, Enhancer, FairComp, MulBndDist, RackAmp, EdisonEX1, AutoPan, NoiseGate |
| [playing-controls.md](sections/playing-controls.md)      | Performance control index: pitch bend, mod wheel, aftertouch, velocity, expression pedal → parameter cross-references and setup recipes |
| [global-settings.md](sections/global-settings.md)        | Global menu reference (no NRPNs): MIDI connectivity, keyboard curves, pedal modes, sustain/gate, panel, calibration |

## Quick signal flow

```
                    ┌─ OSC 1 ─┐
PITCH/KEY ─────────►│  OSC 2  │──► MIXER ──► VCF (filter) ──► VCA ──► FX 1–4 ──► OUTPUT
                    │  NOISE  │
                    └─────────┘
                         ▲                      ▲               ▲
                    MOD MATRIX             ENV / LFO        ENV / LFO
```

## Non-obvious parameter interactions

Things that don't work the way you'd assume from generic synth knowledge.
Read [recipes.md](sections/recipes.md) for full examples with values.

| Technique | Key params | Why it matters | Read |
|-----------|-----------|----------------|------|
| Envelope loop mode | `env.*.triggerMode` = 3 | ADR cycles as complex LFO; asymmetric curves → shapes no LFO can make | [envelopes](sections/envelopes.md) |
| Sustain slope | `env.*.sustainCurve` ≠ 128 | Sustain is NOT flat — <128 falls, >128 rises while key held | [envelopes](sections/envelopes.md) |
| Keyboard → envelope curves | Note Number → SusCurve/EnvDepth via mod matrix | Envelope *shape* changes across keyboard, not just pitch/filter | [mod-matrix](sections/mod-matrix.md) |
| Envelope → OSC 2 level | VCA Env → OSC2 Lvl via mod matrix | Oscillator crossfade tied to note lifecycle | [mod-matrix](sections/mod-matrix.md) |
| Fixed-offset portamento | `portamento.mode` 6–13 | Every note slides from fixed interval — pitch transients, not glides | [voice-config](sections/voice-config.md) |
| Tone mod + envelope | Env → TMod Depth via mod matrix | FM-like attack transients without FM; tone mod is DeepMind-unique | [oscillators](sections/oscillators.md) |
| Pressure → LFO rate | Pressure → LFO Rate via mod matrix | Aftertouch changes modulation *speed*, not just depth | [mod-matrix](sections/mod-matrix.md) |
| Mod wheel → FX params | Mod Wheel → dest 115/119 via mod matrix | Real-time performance control over effect character | [mod-matrix](sections/mod-matrix.md) |
| LFO delay staging | `lfo*.delayTime` | First 40% silent, then fade-in; stagger LFO 1 vs 2 for layered onset | [lfos](sections/lfos.md) |
| Self-oscillating filter tracking | `filter.keyTracking` = 255 + high resonance | Filter becomes pitch-accurate 3rd oscillator across keyboard | [filter](sections/filter.md) |
| Electro piano tines | `osc2.sync` on + high `osc2.pitch` + high `osc2.toneMod` + filter/amp envelope "steppy" shape | OSC 2 hard sync simulates metallic tine harmonics; envelope shape mimics attack-then-settle | [recipes](sections/recipes.md) |

## See also

- Use with the `patchwork-deepmind` MCP server for full parameter control (`set_param`, `describe_param`, `snapshot_state`).

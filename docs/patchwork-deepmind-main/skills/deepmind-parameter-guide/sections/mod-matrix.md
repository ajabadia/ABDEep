# Mod Matrix — Parameter Guide

> Source: DeepMind 12 Owner's Manual, pp. 92–94 (§8.9 Mod Matrix)

## What this controls

The Modulation Matrix routes any of 24 **sources** (LFOs, envelopes, controllers, etc.) to any of 132 **destinations** (oscillator pitch, filter cutoff, envelope times, FX parameters, etc.) with a bipolar depth. The DeepMind 12 provides **8 independent busses** — each bus is one source → destination → depth triple. Multiple busses can share the same source or destination, and mod busses can target other busses' depths for meta-modulation.

**Params**: 8 slots — each with `modMatrix.N.source` (0–24), `modMatrix.N.destination` (0–132), `modMatrix.N.depth` (bipolar: raw 128 = 0/no mod, raw 0 = −128, raw 255 = +127). Slot NRPNs: source = 93 + (N−1)×3, dest = 94 + (N−1)×3, depth = 95 + (N−1)×3 → slots 1–8 use NRPNs 93–116. Replace *N* with slot number: `modMatrix.1.source`, `modMatrix.3.depth`, etc.

## Sources (0–24)

| Value | Name           | Description                                   |
|-------|----------------|-----------------------------------------------|
| 0     | None           | No source (bus disabled)                      |
| 1     | Pitch Bend     | Pitch bend wheel                              |
| 2     | Mod Wheel      | Modulation wheel (CC 1)                       |
| 3     | Foot Ctrl      | Foot controller (CC 4)                        |
| 4     | BreathCtrl     | Breath controller (CC 2)                      |
| 5     | Pressure       | Channel aftertouch                            |
| 6     | Expression     | Expression pedal (CC 11)                      |
| 7     | LFO 1          | LFO 1 (bipolar)                               |
| 8     | LFO 2          | LFO 2 (bipolar)                               |
| 9     | Env 1 (VCA)    | VCA envelope output                           |
| 10    | Env 2 (VCF)    | VCF envelope output                           |
| 11    | Env 3 (Mod)    | Mod envelope output                           |
| 12    | Note Num       | MIDI note number (higher notes = more mod)    |
| 13    | Note Vel       | Note-on velocity                              |
| 14    | Note Off Vel   | Note-off (release) velocity                   |
| 15    | Ctrl Seq       | Control sequencer output                      |
| 16    | LFO 1 (Uni)    | LFO 1 unipolar (0 to +1 only)                |
| 17    | LFO 2 (Uni)    | LFO 2 unipolar (0 to +1 only)                |
| 18    | LFO 1 (Fade)   | LFO 1 scaled by its fade envelope             |
| 19    | LFO 2 (Fade)   | LFO 2 scaled by its fade envelope             |
| 20    | Voice Num      | Voice number (1–12, for per-voice variation)  |
| 21    | Uni Voice      | Unison voice number (stacked voice index)     |
| 22    | CC X (115)     | MIDI CC 115                                   |
| 23    | CC Y (116)     | MIDI CC 116                                   |
| 24    | CC Z (117)     | MIDI CC 117                                   |

> **Note:** The NRPN spec documents source range as 0–22, but the firmware and decoded patch map support values up to 24. The manual lists 24 sources (1-indexed, so raw values 1–24 plus 0 = None).

## Destinations (0–132)

### Destination values 0–72: synthesis parameters

| Value | Name           | Description                                  | Per-voice? |
|-------|----------------|----------------------------------------------|------------|
| 0     | None           | No destination (bus disabled)                | —          |
| 1     | LFO1 Rate      | LFO 1 rate                                   | —          |
| 2     | LFO1 Delay     | LFO 1 delay time                             | —          |
| 3     | LFO1 Slew      | LFO 1 slew rate                              | —          |
| 4     | LFO1 Shape     | LFO 1 shape (waveform morph)                 | —          |
| 5     | LFO2 Rate      | LFO 2 rate                                   | —          |
| 6     | LFO2 Delay     | LFO 2 delay time                             | —          |
| 7     | LFO2 Slew      | LFO 2 slew rate                              | —          |
| 8     | LFO2 Shape     | LFO 2 shape                                  | —          |
| 9     | OSC1+2 Pit     | OSC 1 + 2 pitch (both oscillators together)  | ✓          |
| 10    | OSC1+2 Fine    | OSC 1 + 2 fine pitch                         | ✓          |
| 11    | OSC1 Pitch     | OSC 1 pitch only                             | ✓          |
| 12    | OSC1 Fine      | OSC 1 fine pitch only                        | ✓          |
| 13    | OSC2 Pitch     | OSC 2 pitch only                             | ✓          |
| 14    | OSC2 Fine      | OSC 2 fine pitch only                        | ✓          |
| 15    | OSC1 PM Dep    | OSC 1 pitch modulation depth                 | ✓          |
| 16    | PWM Depth      | OSC 1 pulse width modulation depth           | ✓          |
| 17    | TMod Depth     | OSC 2 tone modulation depth                  | ✓          |
| 18    | OSC2 PM Dep    | OSC 2 pitch modulation depth                 | ✓          |
| 19    | Porta Time     | Portamento time                              | —          |
| 20    | VCF Freq       | VCF cutoff frequency                         | ✓          |
| 21    | VCF Res        | VCF resonance                                | ✓          |
| 22    | VCF Env        | VCF envelope depth                           | ✓          |
| 23    | VCF LFO        | VCF LFO modulation depth                     | ✓          |
| 24    | Env Rates      | All envelope rates (ADSR all 3 envelopes)    | ✓          |
| 25    | All Attack     | All envelope attack times                    | ✓          |
| 26    | All Decay      | All envelope decay times                     | ✓          |
| 27    | All Sus        | All envelope sustain levels                  | ✓          |
| 28    | All Rel        | All envelope release times                   | ✓          |
| 29    | Env1 Rates     | Envelope 1 (VCA) all rates                   | ✓          |
| 30    | Env2 Rates     | Envelope 2 (VCF) all rates                   | ✓          |
| 31    | Env3 Rates     | Envelope 3 (Mod) all rates                   | ✓          |
| 32    | Env1 Curves    | Envelope 1 all curves                        | ✓          |
| 33    | Env2 Curves    | Envelope 2 all curves                        | ✓          |
| 34    | Env3 Curves    | Envelope 3 all curves                        | ✓          |
| 35    | Env1 Attack    | Envelope 1 attack time                       | ✓          |
| 36    | Env1 Decay     | Envelope 1 decay time                        | ✓          |
| 37    | Env1 Sus       | Envelope 1 sustain level                     | ✓          |
| 38    | Env1 Rel       | Envelope 1 release time                      | ✓          |
| 39    | Env1 AtCur     | Envelope 1 attack curve                      | ✓          |
| 40    | Env1 DcyCur    | Envelope 1 decay curve                       | ✓          |
| 41    | Env1 SuSCur    | Envelope 1 sustain curve                     | ✓          |
| 42    | Env1 RelCur    | Envelope 1 release curve                     | ✓          |
| 43    | Env2 Attack    | Envelope 2 attack time                       | ✓          |
| 44    | Env2 Decay     | Envelope 2 decay time                        | ✓          |
| 45    | Env2 Sus       | Envelope 2 sustain level                     | ✓          |
| 46    | Env2 Rel       | Envelope 2 release time                      | ✓          |
| 47    | Env2 AtCur     | Envelope 2 attack curve                      | ✓          |
| 48    | Env2 DcyCur    | Envelope 2 decay curve                       | ✓          |
| 49    | Env2 SuSCur    | Envelope 2 sustain curve                     | ✓          |
| 50    | Env2 RelCur    | Envelope 2 release curve                     | ✓          |
| 51    | Env3 Attack    | Envelope 3 attack time                       | ✓          |
| 52    | Env3 Decay     | Envelope 3 decay time                        | ✓          |
| 53    | Env3 Sus       | Envelope 3 sustain level                     | ✓          |
| 54    | Env3 Rel       | Envelope 3 release time                      | ✓          |
| 55    | Env3 AtCur     | Envelope 3 attack curve                      | ✓          |
| 56    | Env3 DcyCur    | Envelope 3 decay curve                       | ✓          |
| 57    | Env3 SuSCur    | Envelope 3 sustain curve                     | ✓          |
| 58    | Env3 RelCur    | Envelope 3 release curve                     | ✓          |
| 59    | VCA All        | VCA gain for all voices (active or not)      | common*    |
| 60    | VCA Active     | VCA gain for active voices only              | common*    |
| 61    | VCA EnvDep     | VCA envelope depth                           | ✓          |
| 62    | Pan Spread     | Pan spread                                   | ✓          |
| 63    | VCA Pan        | VCA pan                                      | ✓          |
| 64    | OSC2 Lvl       | OSC 2 level                                  | common*    |
| 65    | Noise Lvl      | Noise level                                  | common*    |
| 66    | HP Freq        | HPF cutoff frequency                         | common*    |
| 67    | Uni Detune     | Unison detune                                | common*    |
| 68    | OSC Drift      | Oscillator drift amount                      | common*    |
| 69    | Param Drift    | Parameter drift amount                       | common*    |
| 70    | Drift Rate     | Drift rate                                   | common*    |
| 71    | Arp Gate       | Arpeggiator gate time                        | common*    |
| 72    | Seq Slew       | Control sequencer slew rate                  | common*    |

\* Destinations marked "common" affect all voices simultaneously, not per-voice.

### Destination values 73–80: meta-modulation (mod matrix depth)

| Value | Name       | Description                        |
|-------|------------|------------------------------------|
| 73    | Mod 1 Dep  | Mod matrix routing 1 depth         |
| 74    | Mod 2 Dep  | Mod matrix routing 2 depth         |
| 75    | Mod 3 Dep  | Mod matrix routing 3 depth         |
| 76    | Mod 4 Dep  | Mod matrix routing 4 depth         |
| 77    | Mod 5 Dep  | Mod matrix routing 5 depth         |
| 78    | Mod 6 Dep  | Mod matrix routing 6 depth         |
| 79    | Mod 7 Dep  | Mod matrix routing 7 depth         |
| 80    | Mod 8 Dep  | Mod matrix routing 8 depth         |

### Destination values 81–132: FX parameters

| Value     | Name           | Description                          |
|-----------|----------------|--------------------------------------|
| 81–92     | FX 1 Params    | Effects slot 1 parameters (1–12)     |
| 93–104    | FX 2 Params    | Effects slot 2 parameters (1–12)     |
| 105–116   | FX 3 Params    | Effects slot 3 parameters (1–12)     |
| 117–128   | FX 4 Params    | Effects slot 4 parameters (1–12)     |
| 129       | FX 1 Level     | Effects slot 1 output level          |
| 130       | FX 2 Level     | Effects slot 2 output level          |
| 131       | FX 3 Level     | Effects slot 3 output level          |
| 132       | FX 4 Level     | Effects slot 4 output level          |

> FX parameter numbering is per-slot: for FX slot *S*, destination = 80 + (S-1)×12 + paramIndex. Which parameters are available depends on the loaded FX type — consult the [effects section](../effects.md) and its sub-files for per-type parameter lists.

## Value guidance

- **Source selection**: Use bipolar LFO sources (6–8) when you want the modulation to swing both ways (e.g., vibrato). Use unipolar LFO sources (16–17) when you only want the modulation to go in one direction (e.g., filter sweep that only opens). Use LFO Fade sources (18–19) to delay the onset of LFO modulation (e.g., vibrato that fades in after note attack). Use Note Num (12) for key-tracking effects. Use Note Vel (13) for velocity-sensitive modulation beyond the built-in velocity controls.

- **Depth encoding**: Raw 128 = no modulation (display 0). Raw 255 = maximum positive modulation (+127). Raw 0 = maximum negative/inverted modulation (-128). For subtle effects, keep depth within ±20 of center (raw 108–148). For dramatic effects, use ±60 or more.

- **Meta-modulation (destinations 73–80)**: You can route a source to control the depth of another mod bus. This is extremely powerful — for example, route Mod Wheel → Mod 1 Depth to give the player real-time control over how much vibrato LFO 1 applies to pitch. This effectively makes the mod matrix depth velocity-sensitive, aftertouch-sensitive, or controllable by any source.

- **FX modulation**: FX parameter destinations (81–132) allow real-time modulation of effect parameters. For example, use an LFO to modulate chorus rate, or use velocity to modulate reverb level. The specific parameter mapping depends on which FX type is loaded in each slot.

- **Common vs per-voice**: Most destinations are per-voice (each of the 12 voices is modulated independently). Destinations marked with `*` (64–72) are common to all voices — modulating them affects the entire sound uniformly. VCA All (59) affects all 12 voice amplifiers regardless of note state; VCA Active (60) only affects voices currently playing a note.

## Interactions

- Each bus is independent. Setting source to `None` (0) or destination to `None` (0) disables that bus.
- The 8 busses are additive — if multiple busses target the same destination, their contributions sum.
- Mod matrix modulation is applied **on top of** the static parameter value. For example, if VCF cutoff is set to 100 and a mod bus adds +50, the effective cutoff is 150 (clamped to range).
- Sources that reference LFO 1 / LFO 2 are affected by LFO rate, shape, sync, and delay settings. See [lfos.md](lfos.md).
- Envelope sources (9–11) output the current envelope level. The envelope shape is set in [envelopes.md](envelopes.md).
- `vca.envDepth` (NRPN 81) and `filter.envDepth` (NRPN 42) provide hardwired envelope-to-VCA and envelope-to-VCF modulation. The mod matrix can add additional envelope routing on top, or replace these if the hardwired controls are set to 0.
- Mod Wheel (source 2) is commonly pre-routed in factory patches. Check existing mod matrix state before adding new routings to avoid conflicts.
- CC X/Y/Z (sources 22–24) correspond to MIDI CCs 115, 116, 117 — useful for external controller mapping or DAW automation.

## Common recipes

| Goal                          | Source         | Destination      | Depth suggestion |
|-------------------------------|----------------|------------------|------------------|
| Vibrato (manual control)      | Mod Wheel (2)  | OSC1+2 Pit (9)   | +30 to +60       |
| Filter sweep via LFO          | LFO 1 (7)     | VCF Freq (20)    | ±40 to ±80       |
| Velocity → filter brightness  | Note Vel (13)  | VCF Freq (20)    | +40 to +80       |
| Velocity → attack time        | Note Vel (13)  | All Attack (25)  | -40 to -80 (faster attack on harder hits) |
| Aftertouch → vibrato          | Pressure (5)   | OSC1+2 Pit (9)   | +20 to +50       |
| Key tracking → filter         | Note Num (12)  | VCF Freq (20)    | +40 to +80       |
| LFO fade-in vibrato           | LFO1 Fade (18) | OSC1+2 Pit (9)   | +30 to +60       |
| Mod wheel controls mod depth  | Mod Wheel (2)  | Mod 1 Dep (73)   | +80 to +127      |
| Per-voice stereo animation    | LFO 1 (7)     | VCA Pan (63)     | ±30 to ±60       |

## Related sections

- → [lfos.md](lfos.md) for LFO rate, shape, sync, and delay (mod sources 7–8, 16–19)
- → [envelopes.md](envelopes.md) for envelope ADSR and curves (mod sources 9–11, destinations 24–58)
- → [filter.md](filter.md) for VCF cutoff, resonance, and built-in envelope/LFO modulation (destinations 20–23)
- → [vca.md](vca.md) for VCA gain, envelope depth, and pan spread (destinations 59–63)
- → [oscillators.md](oscillators.md) for oscillator pitch, PM, PWM, and tone modulation (destinations 9–18)

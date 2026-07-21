# LFOs — Parameter Guide

> Source: DeepMind 12 Owner's Manual, pp. 59–61 (§8.2 LFO1 and LFO2)

## What this controls

The DeepMind 12 has two identical Low Frequency Oscillators (**LFO 1** and **LFO 2**) that generate sub-audio control signals used to modulate other parameters — pitch (vibrato), amplitude (tremolo), filter (wah), or any of 130 Mod Matrix destinations. LFOs offer seven waveform shapes including sample & hold and sample & glide. They can free-run or synchronize to key presses (Key Sync) or to the Master BPM clock (Arp Sync). The LFO rate can reach into audio frequencies (up to 65.4 Hz free-running, 1280 Hz via Mod Matrix), enabling cross-modulation and FM-like effects.

**Params**: `lfo1.rate`, `lfo1.clockDivide`, `lfo1.delayTime`, `lfo1.shape`, `lfo1.keySync`, `lfo1.arpSeq.sync`, `lfo1.phase`, `lfo1.slewRate` — and identical pattern for `lfo2.*`. When `arpSeq.sync` is On, `rate` is reinterpreted as `clockDivide` (see Clock Divide table below). Run `describe_param` on any for ranges.

### Shape enum (NRPN 2, 9)

| Value | Label         | Description                                                        |
|------:|--------------|--------------------------------------------------------------------|
| 0     | Sine          | Smooth sinusoidal wave. Classic vibrato/tremolo shape.             |
| 1     | Triangle      | Symmetrical triangle wave. Default shape. Similar to sine but more linear. |
| 2     | Square        | On/off square wave. Hard switching between two values.             |
| 3     | Ramp Up       | Rising sawtooth — slow rise, instant drop.                         |
| 4     | Ramp Down     | Falling sawtooth — instant rise, slow drop.                        |
| 5     | S&H           | Sample & Hold — random stepped waveform, instant transitions.      |
| 6     | S&H Glide     | Sample & Glide — random stepped waveform, smooth gliding transitions. |

### Clock Divide values (when Arp Sync = On)

When `lfo1.arpSeq.sync` or `lfo2.arpSeq.sync` is On, the Rate NRPN (0 or 7) is reinterpreted as a clock division of the Master BPM. The raw values map to musical divisions:

| Raw value | Division | Description                          |
|----------:|----------|--------------------------------------|
| 8         | 4        | Four notes (whole note × 4)          |
| 21        | 3        | Three notes                          |
| 34        | 2        | Two notes (half note × 2)            |
| 47        | 1        | One note (whole note)                |
| 60        | 1/2      | Half note                            |
| 73        | 3/8      | Dotted quarter note                  |
| 86        | 1/3      | Half-note triplets                   |
| 99        | 1/4      | Quarter note                         |
| 112       | 3/16     | Dotted eighth note                   |
| 125       | 1/6      | Quarter-note triplets                |
| 138       | 1/8      | Eighth note                          |
| 151       | 3/32     | Dotted sixteenth note                |
| 164       | 1/12     | Eighth-note triplets                 |
| 177       | 1/16     | Sixteenth note                       |
| 190       | 3/64     | Dotted thirty-second note            |
| 203       | 1/24     | Sixteenth-note triplets              |
| 216       | 1/32     | Thirty-second note                   |
| 229       | 3/128    | Dotted sixty-fourth note             |
| 242       | 1/48     | Thirty-second note triplets          |
| 255       | 1/64     | Sixty-fourth note                    |

## Value guidance

### Rate

- **0** = extremely slow (24 s cycle) — for glacial filter sweeps or slow evolving textures.
- **1–30** = slow (several seconds per cycle) — pads, gentle vibrato, slow filter movement.
- **60–120** = moderate — standard vibrato (pitch), standard tremolo (amp), classic wah-wah (filter).
- **120–200** = fast — aggressive wobble, fast tremolo, rhythmic effects.
- **200–255** = audio rate territory (up to 65 Hz) — creates FM-like timbral effects, especially when modulating pitch. Ring-mod-like tones when modulating oscillator pitch at these speeds.

### Delay / Fade Time

The delay works in two phases: the first 40% of the total time is pure silence (no LFO output), and the remaining 60% is a gradual fade-in to full LFO depth.

- **0** = no delay, LFO active immediately. Use for constant modulation effects (tremolo, filter wobble).
- **30–80** = short delay with fade. Classic use: delayed vibrato on leads — the note attacks cleanly, then vibrato fades in naturally. Mimics how a vocalist or string player adds vibrato after the initial note.
- **120–200** = longer delay for slow pad sounds where modulation only appears well into a held note.
- **255** = maximum delay (6.59 s). Very long; mostly useful for ambient/experimental held-note textures.

### Key Sync

- **Off** (0): LFO free-runs — each voice may be at a different phase. Creates organic, slightly different modulation per note. Best for pads and polyphonic textures where uniformity isn't needed.
- **On** (1): LFO resets to start on each key press. Every note gets the same modulation sweep from the beginning. Essential for rhythmic effects, consistent pitch bends, and any modulation that needs to start at a predictable point. Note: the Delay Time resets too, so the delay + fade-in happens fresh on each key press.

### Arp Sync

- **Off** (0): LFO runs at the rate set by the Rate fader. Independent of tempo.
- **On** (1): LFO locks to Master BPM. The Rate fader/NRPN selects a clock division instead. Essential for tempo-synced effects — rhythmic filter sweeps, synced tremolo, tempo-locked modulation. When Arp Sync is On, `lfo1.rate`/`lfo2.rate` should not be used — use `lfo1.clockDivide`/`lfo2.clockDivide` instead.

### Phase / Mono Mode

- **Poly** (0): Each voice has its own independent LFO cycle. Default. Good for organic, evolving pad sounds where slight phase differences add movement.
- **Mono** (1): All voices share one LFO — they modulate in lockstep. Use when you want all voices to rise and fall together (e.g. synced tremolo or unified filter sweep).
- **Spread** (2–255): Voices are phase-offset from each other by increasing amounts. Low spread values give subtle stereo-like movement; high values create dramatic per-voice phase separation. Great for wide, animated pads and super-saw style sounds.

### Slew Rate

Smooths the transitions of the LFO output. Most useful with Square, S&H, and Ramp shapes to soften abrupt edges:

- **0** = no smoothing — sharp transitions (default for crisp S&H steps or hard square switching).
- **Low values (1–40)** = slight rounding of edges. Takes the click out of square wave tremolo.
- **Mid values (60–150)** = moderate smoothing. Turns S&H into a more gentle random wandering. Turns Square into a rounded quasi-sine-like shape.
- **High values (200–255)** = heavy smoothing. All shapes become slow, rounded undulations. Useful for turning any LFO shape into a smooth, organic modulation source.

## Interactions

- **LFO → Pitch Mod**: LFO 1 and LFO 2 are the default pitch mod sources for OSC 1 and OSC 2. The depth is controlled by `osc1.pitchMod` / `osc2.pitchMod` and the source selection by `osc1.pitchModSelect` / `osc2.pitchModSelect` (see [oscillators.md](oscillators.md)).
- **LFO → PWM**: LFO 1 and LFO 2 can modulate OSC 1 pulse width via `osc1.pwmSource` (see [oscillators.md](oscillators.md)).
- **LFO → Filter**: LFO 1 and LFO 2 can modulate filter cutoff via `filter.lfoSelect` and `filter.lfoDepth` (see [filter.md](filter.md)).
- **LFO → Tone Mod**: LFO 1 and LFO 2 can modulate OSC 2 tone via `osc2.toneModSource` (see [oscillators.md](oscillators.md)).
- **LFO → Envelope Trigger**: Setting an envelope's trigger mode to LFO 1 (1) or LFO 2 (2) re-triggers that envelope on each LFO cycle (see [envelopes.md](envelopes.md)).
- **LFO as Mod Matrix source**: Both LFOs are available as Mod Matrix sources (bipolar and unipolar variants), routable to any of 130+ destinations (see [mod-matrix.md](mod-matrix.md)).
- **Arp Sync overrides Rate**: When `lfo1.arpSeq.sync` = On, the `lfo1.rate` NRPN (0) is reinterpreted as `lfo1.clockDivide`. Setting `lfo1.rate` while Arp Sync is On will set a clock division, not a free rate. Check sync state before setting rate.
- **Mod Wheel / Aftertouch → LFO Depth**: The mod wheel and aftertouch can scale LFO pitch mod depth via `osc1.modWheel.pitchMod`, `osc1.aftertouch.pitchMod`, etc. (see [oscillators.md](oscillators.md)). This allows performance control over vibrato intensity.
- **Mod Matrix rate extension**: The LFO rate can be pushed well beyond the fader maximum (up to 1280 Hz) by routing a Mod Matrix source to the LFO Rate destination. Using Note Number as the source creates keyboard-tracking FM effects.

## Related sections

- → [oscillators.md](oscillators.md) for pitch mod, PWM, and tone mod parameters that use LFOs as sources
- → [filter.md](filter.md) for filter LFO modulation depth and source selection
- → [envelopes.md](envelopes.md) for LFO-triggered envelope modes
- → [mod-matrix.md](mod-matrix.md) for routing LFOs to arbitrary destinations
- → [arp-sequencer.md](arp-sequencer.md) for Master BPM, arpeggiator clock, and the full sync timing reference table (Appendix 2)

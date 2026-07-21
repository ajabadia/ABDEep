# Arpeggiator & Control Sequencer — Parameter Guide

> Source: DeepMind 12 Owner's Manual, §8.1 (pp. 40–58)

## What this controls

The ARP/SEQ section contains the **arpeggiator** (rhythmic note patterns
from held keys), the **control sequencer** (a step-based modulation source
routed via the mod matrix), and global clock / sync settings that also
govern LFO sync, envelope sync, and time-based FX. Chord and poly-chord
features are UI-only programming modes with no NRPN-addressable parameters.

## Parameters — Arpeggiator

| Parameter (manual name) | paramKey         | NRPN | Range        | What it does                                       |
|-------------------------|------------------|------|--------------|----------------------------------------------------|
| ARP On/Off              | `arp.enabled`    | 155  | 0–1          | Turns arpeggiator on (1) / off (0)                 |
| ARP Mode                | `arp.mode`       | 156  | 0–10         | Note order pattern (see Mode table below)          |
| ARP Rate (BPM)          | `arp.rate`       | 157  | 0–255        | Master BPM: 20.0 bpm (0) → 275.0 bpm (255)        |
| ARP Clock Divider       | `arp.clock`      | 158  | 0–12         | Divides master BPM (see Arp Clock table below)     |
| ARP Key Sync            | `arp.keySync`    | 159  | 0–1          | Off (0): free-run to BPM; On (1): restart on key   |
| ARP Gate Time           | `arp.gateTime`   | 160  | 0–255        | Note length: 0 = silence, 128 = half step, 255 = full step |
| ARP Hold                | `arp.hold`       | 161  | 0–1          | Off (0) / On (1). Latches held notes               |
| ARP Pattern             | `arp.pattern`    | 162  | 0–64         | None (0), Preset-1…32 (1–32), User-1…32 (33–64)   |
| ARP Swing               | `arp.swing`      | 163  | 0–25         | 50% (0) → 75% (25). Delays every other step        |
| ARP Octaves             | `arp.octaves`    | 164  | 0–5          | 1 octave (0) → 6 octaves (5)                       |

### ARP Mode values

| Value | Mode        | Description                                                 |
|-------|-------------|-------------------------------------------------------------|
| 0     | Up          | Lowest → highest, repeat                                    |
| 1     | Down        | Highest → lowest, repeat                                    |
| 2     | Up&Down     | Lowest → highest → lowest (no repeat at extremes)           |
| 3     | Up Inv      | Plays up, then inverts chord and plays up again             |
| 4     | Down Inv    | Plays down, then 2nd inversion down an octave, plays down   |
| 5     | Up&Down Inv | Up through inversions, then back down through them          |
| 6     | Up Alt      | Alternates: lowest, highest, next-lowest, next-highest …    |
| 7     | Down Alt    | Alternates: highest, lowest, next-highest, next-lowest …    |
| 8     | Random      | Random note order                                           |
| 9     | As Played   | Notes in the order you played them                          |
| 10    | Chord       | All held notes trigger together on each step                |

### ARP Clock Divider values

| Value | Ratio | Description                         |
|-------|-------|-------------------------------------|
| 0     | 1/2   | Half note                           |
| 1     | 3/8   | Dotted quarter note                 |
| 2     | 1/3   | Half note triplets                  |
| 3     | 1/4   | Quarter note                        |
| 4     | 3/16  | Dotted eighth note                  |
| 5     | 1/6   | Quarter note triplets               |
| 6     | 1/8   | Eighth note                         |
| 7     | 3/32  | Dotted sixteenth note               |
| 8     | 1/12  | Eighth note triplets                |
| 9     | 1/16  | Sixteenth note **(default)**        |
| 10    | 1/24  | Sixteenth note triplets             |
| 11    | 1/32  | Thirty-second note                  |
| 12    | 1/48  | Thirty-second note triplets         |

### ARP Pattern system

Patterns overlay **velocity** and **gate time** per step onto the
arpeggiator notes. The pattern loops independently of the arp note cycle,
so using a different pattern length from the number of held notes creates
evolving variations.

- **Preset-1 … Preset-32** (values 1–32): factory patterns, read-only.
- **User-1 … User-32** (values 33–64): editable via the on-screen
  Pattern Editor (velocity per step, gate time per step, ties, length 1–32).
- **None** (value 0): no pattern — all steps use the panel gate time fader
  and played velocity.

## Parameters — Control Sequencer

The control sequencer is a **modulation source** (not a note sequencer).
Route it to any destination via the mod matrix using source "Ctrl Seq".
Each step value is bipolar.

**Params — Control Sequencer**: `controlSeq.enabled`, `controlSeq.clockDivider`, `controlSeq.length` (0–31 → 1–32 steps), `controlSeq.swing`, `controlSeq.keySyncLoop`, `controlSeq.slewRate`, `controlSeq.step.N.value` (N=1–32; 0=skip, 1–255 → bipolar −127…+127 via value−128). Run `describe_param` for ranges.

### Ctrl Seq Clock Divider values

The control sequencer has a wider range of clock divisions than the
arpeggiator (16 options vs 13):

| Value | Ratio | Description                         |
|-------|-------|-------------------------------------|
| 0     | 4     | Four whole notes                    |
| 1     | 3     | Three whole notes                   |
| 2     | 2     | Two whole notes                     |
| 3     | 1     | Whole note                          |
| 4     | 1/2   | Half note                           |
| 5     | 3/8   | Dotted quarter note                 |
| 6     | 1/3   | Half note triplets                  |
| 7     | 1/4   | Quarter note                        |
| 8     | 3/16  | Dotted eighth note                  |
| 9     | 1/6   | Quarter note triplets               |
| 10    | 1/8   | Eighth note                         |
| 11    | 3/32  | Dotted sixteenth note               |
| 12    | 1/12  | Eighth note triplets                |
| 13    | 1/16  | Sixteenth note **(default)**        |
| 14    | 3/64  | Dotted thirty-second note           |
| 15    | 1/24  | Sixteenth note triplets             |
| 16    | 1/32  | Thirty-second note                  |
| 17    | 3/128 | Dotted sixty-fourth note            |
| 18    | 1/48  | Thirty-second note triplets         |
| 19    | 1/64  | Sixty-fourth note                   |

> Note: The NRPN range is 0–15 but the manual lists 20 entries. Values
> 0–15 are confirmed via NRPN; higher entries may require the on-screen
> menu. The table above maps the manual's ordering to NRPN value.

### Ctrl Seq Key/Loop modes

| Value | Mode            | Behaviour                                                   |
|-------|-----------------|-------------------------------------------------------------|
| 0     | Loop On         | Loops continuously, does **not** restart on key press. Best when running alongside the arp with a different step count. |
| 1     | Key Sync On     | Restarts on key press, does **not** loop (plays once).      |
| 2     | Loop & Key Sync | Loops continuously **and** restarts on each key press.      |

### Ctrl Seq Step encoding

- Value **0** = step is skipped (produces no modulation output).
- Values **1–255** map to bipolar modulation: `output = value − 128`
  (so 1 = −127, 128 = 0, 255 = +127).
- The slew rate smooths transitions between steps. At 0 the output
  jumps instantly; at 255 it ramps slowly to the next value.

## ARP Settings (global clock / sync)

Menu-only global settings (no NRPNs): Clock Source (Internal/MIDI Auto/USB Auto), Transmit Clock, ARP-to-MIDI, ARP-Params (Program vs Global storage). Auto clock falls back to internal if no external clock present.

## Value guidance

- **arp.rate**: The fader maps linearly 0–255 to 20.0–275.0 BPM. Common
  values: ~100 (≈120 BPM), ~200 (≈220 BPM). Use TAP/HOLD switch on
  the panel to set BPM by tapping.
- **arp.gateTime**: 128 = half-step (default). Lower values give staccato;
  higher values give legato. Combined multiplicatively with per-step gate
  from the pattern editor: panel fader at max = full pattern gate, at
  mid = half of pattern gate.
- **arp.swing**: 0 = straight (50%). Set to ~16 for triplet feel (≈66%).
  25 = maximum swing (75%). Same applies to `controlSeq.swing`.
- **arp.octaves**: 0 = notes only in played octave. Higher values extend
  the arp cycle through additional octaves (up to 6).
- **controlSeq.slewRate**: 0 for rhythmic stepped modulation (S&H style).
  Higher values for smooth, evolving modulation (approaching LFO-like
  shapes). 255 for very slow glides between step values.
- **controlSeq.step.N.value**: To create a simple triangle wave over
  4 steps: set steps to 1, 128, 255, 128 (= −127, 0, +127, 0).

## Interactions

- `arp.rate` sets the **master BPM** — it also affects `controlSeq` timing,
  LFO rates when `lfo1.arpSeq.sync` or `lfo2.arpSeq.sync` is On, envelope
  rates when envelope BPM sync is enabled, and time-based FX parameters.
- `arp.clock` and `controlSeq.clockDivider` independently divide the
  same master BPM, so the arp and ctrl seq can run at different rates.
- The control sequencer appears as a **mod source** in the mod matrix
  (source name "Ctrl Seq"). It must be routed to a destination there to
  have any audible effect. It can also be used as an envelope trigger
  source (value 4 in envelope trigger mode).
- `arp.hold` mirrors the physical TAP/HOLD switch (long-press). Changes
  from either location are reflected in the other.
- When `arp.pattern` = None (0), the pattern editor has no effect and all
  steps use the panel gate-time fader value and played velocity.
- Chord and poly-chord features are **UI-only** — they are programmed
  interactively on the panel and stored in persistent memory, not in the
  program edit buffer. There are no NRPNs for chord programming.

## Signal flow

```
                                    ┌──────────────────────────┐
  Held keys ──► ARPEGGIATOR ──────► │ Note triggers to voices  │
                  ▲                 └──────────────────────────┘
                  │
           Master BPM clock ◄── Rate fader / TAP / external MIDI-USB
                  │
                  ▼
           CTRL SEQUENCER ──► Mod Matrix source ──► any destination
```

## Sync timing reference

> Source: Appendix 2 — ARP/SEQ/LFO Sync Timing (p. 150)

The master BPM clock is divided by the following ratios for the ARP,
control sequencer, and LFOs (when Arp Sync is on). The pattern repeats
across all clock divider tables — straight notes, dotted notes, and
triplets interleave in groups of three.

| Ratio | Description                          | Type     |
|-------|--------------------------------------|----------|
| 1     | One bar (whole note)                 | Straight |
| 1/2   | Half note                            | Straight |
| 3/8   | Dotted quarter note                  | Dotted   |
| 1/3   | Third note (half note triplets)      | Triplet  |
| 1/4   | Quarter note                         | Straight |
| 3/16  | Dotted eighth note                   | Dotted   |
| 1/6   | Sixth note (quarter note triplets)   | Triplet  |
| 1/8   | Eighth note                          | Straight |
| 3/32  | Dotted sixteenth note                | Dotted   |
| 1/12  | Twelfth note (eighth note triplets)  | Triplet  |
| 1/16  | Sixteenth note                       | Straight |
| 3/64  | Dotted thirty-second note            | Dotted   |
| 1/24  | Twenty-fourth (sixteenth triplets)   | Triplet  |
| 1/32  | Thirty-second note                   | Straight |
| 3/128 | Dotted sixty-fourth note             | Dotted   |
| 1/48  | Forty-eighth (thirty-second triplets)| Triplet  |
| 1/64  | Sixty-fourth note                    | Straight |

> Note: Different clock divider params use different subsets and value
> encodings of this master table. The ARP clock divider (NRPN 5, 0–12)
> starts at 1/2 note. The Ctrl Seq clock divider (NRPN 118, 0–19) starts
> at 4 whole notes. The LFO clock divide uses raw values 0–255 mapped
> non-linearly (see [lfos.md](lfos.md)).

## Related sections

- → [mod-matrix.md](mod-matrix.md) — routing the control sequencer to destinations
- → [lfos.md](lfos.md) — LFO arp sync (`lfo1.arpSeq.sync`, `lfo2.arpSeq.sync`)
- → [envelopes.md](envelopes.md) — envelope trigger modes include "Control Sequencer Step"

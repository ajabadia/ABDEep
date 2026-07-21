# Playing & Performance Controls — Parameter Guide

> Source: DeepMind 12 Owner's Manual, §5 Playing Guide (pp. 16–17)

## What this controls

The performance controls — pitch bend wheel, mod wheel, aftertouch,
velocity, expression pedal, and sustain pedal — are physical inputs
that influence the sound during playing. Most do nothing by default and
must be **routed to destinations** via per-program parameters or the mod
matrix. This section is a cross-reference index: the actual parameter
details live in the linked section files.

## Performance source → parameter mapping

### Pitch bend wheel

Spring-loaded wheel that returns to centre. Range is per-program.

| What to set                        | paramKey              | Section                              |
|------------------------------------|-----------------------|--------------------------------------|
| Bend range up (semitones)          | `pitchBend.upDepth`   | [voice-config.md](voice-config.md)   |
| Bend range down (semitones)        | `pitchBend.downDepth` | [voice-config.md](voice-config.md)   |
| Pitch bend → filter cutoff         | `filter.pitchBendToCutoff` | [filter.md](filter.md)          |
| Pitch bend as mod source (bus 1–8) | Mod source 1          | [mod-matrix.md](mod-matrix.md)       |

- Default pitch bend range is ±2 semitones. Up and down ranges are
  independent — asymmetric bends are possible (e.g., +12 up, −2 down).
- `filter.pitchBendToCutoff` defaults to 128 (moderate); set to 0 to
  disable filter tracking of the pitch wheel.

### Modulation wheel

Non-spring wheel (stays where you leave it). Does nothing unless routed.

| What to set                        | paramKey                    | Section                              |
|------------------------------------|-----------------------------|--------------------------------------|
| Mod wheel → OSC 1 pitch mod depth  | `osc1.modWheel.pitchMod`   | [oscillators.md](oscillators.md)     |
| Mod wheel → OSC 2 pitch mod depth  | `osc2.modWheel.pitchMod`   | [oscillators.md](oscillators.md)     |
| Mod wheel → VCF LFO depth          | `filter.modWheelToLfoDepth` | [filter.md](filter.md)              |
| Mod wheel as mod source (bus 1–8)  | Mod source 2                | [mod-matrix.md](mod-matrix.md)       |

- **Classic vibrato setup**: Set `osc1.pitchMod` to a small value
  (5–15), `osc1.pitchModSelect` = LFO 2 (0), then set
  `osc1.modWheel.pitchMod` = 128–200. The mod wheel now controls
  vibrato intensity.
- For mod wheel → filter wobble: set `filter.lfoDepth` to a base
  amount, then increase `filter.modWheelToLfoDepth`.

### Aftertouch (channel pressure)

Keyboard pressure after initial key strike. Does nothing unless routed.

| What to set                             | paramKey                     | Section                              |
|-----------------------------------------|------------------------------|--------------------------------------|
| Aftertouch → OSC 1 pitch mod depth      | `osc1.aftertouch.pitchMod`   | [oscillators.md](oscillators.md)     |
| Aftertouch → OSC 2 pitch mod depth      | `osc2.aftertouch.pitchMod`   | [oscillators.md](oscillators.md)     |
| Aftertouch → VCF LFO depth              | `filter.aftertouchToLfoDepth`| [filter.md](filter.md)               |
| Aftertouch as mod source (bus 1–8)      | Mod source 5 ("Pressure")    | [mod-matrix.md](mod-matrix.md)       |

- Aftertouch response curves are set in the Global → Keyboard Settings
  menu (not per-program, no NRPNs).

### Velocity

Note-on and note-off velocity are performance sources.

| What to set                        | paramKey              | Section                              |
|------------------------------------|-----------------------|--------------------------------------|
| Velocity → filter envelope depth   | `filter.envVelocity`  | [filter.md](filter.md)               |
| Velocity → VCA level               | `vca.envVelocity`     | [vca.md](vca.md)                     |
| Note-on velocity as mod source     | Mod source 12         | [mod-matrix.md](mod-matrix.md)       |
| Note-off velocity as mod source    | Mod source 14         | [mod-matrix.md](mod-matrix.md)       |

- Velocity response curves are set in Global → Keyboard Settings
  (not per-program). Fixed velocity can override actual key strike.

### Portamento (front panel knob)

The physical knob directly controls `portamento.time`. All portamento
parameters are documented in [voice-config.md](voice-config.md):
`portamento.time`, `portamento.mode` (14 modes), `portamento.balance`.

### Expression pedal (rear panel)

The expression pedal input can be assigned to one of seven MIDI
functions via Global → Pedal Settings (not per-program):

| Pedal mode    | MIDI CC sent | Typical use                         |
|---------------|-------------|-------------------------------------|
| Foot Control  | CC 4        | General purpose mod source          |
| Mod Wheel     | CC 1        | Same as physical mod wheel          |
| Breath        | CC 2        | Breath-style expression             |
| Volume        | CC 7        | Volume control                      |
| Expression    | CC 11       | Expression (standard MIDI)          |
| Porta Time    | CC 5        | Portamento time                     |
| Aftertouch    | Ch. AT      | Same as keyboard aftertouch         |

- Expression (CC 11) is available as mod source 24 in the mod matrix.
- Pedal mode, polarity, and calibration are global settings — no NRPNs.

### Sustain pedal (rear panel)

Standard normally-open footswitch. Sends MIDI CC 64 (Sustain). No
per-program parameters — it works automatically.

### Octave shift (OCT UP/DOWN buttons)

Physical buttons that shift the keyboard ±3 octaves. Both buttons
together reset to octave 0. These are real-time MIDI note offsets —
no NRPNs, not stored in programs.

## Quick setup recipes

### Mod wheel vibrato (classic)
```
osc1.pitchModSelect  = 0    (LFO 2)
osc1.pitchMod        = 10   (subtle depth)
osc1.modWheel.pitchMod = 180 (wheel controls intensity)
osc1.pitchModMode    = 0    (OSC1+2 — both oscillators)
```

### Aftertouch → filter open
```
Mod bus 1: source = 5 (Pressure), dest = 17 (VCF Freq), depth = +60
```
Or use the dedicated parameter:
```
filter.aftertouchToLfoDepth = 150  (aftertouch scales LFO → filter)
filter.lfoDepth             = 80   (base LFO depth to scale)
```

### Velocity-sensitive brightness
```
filter.envVelocity = 180  (harder hits → more filter envelope)
```

## Related sections

- → [oscillators.md](oscillators.md) — pitch mod depth, mod select, aftertouch/mod wheel → pitch
- → [filter.md](filter.md) — pitch bend/aftertouch/mod wheel → filter cutoff and LFO depth
- → [vca.md](vca.md) — velocity sensitivity, pan
- → [voice-config.md](voice-config.md) — portamento, pitch bend range, transpose
- → [mod-matrix.md](mod-matrix.md) — all performance sources available as mod bus sources

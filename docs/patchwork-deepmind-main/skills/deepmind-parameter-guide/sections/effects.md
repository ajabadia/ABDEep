# Effects — Parameter Guide

> Source: DeepMind 12 Owner's Manual, pp. 95–118 (§9 Effects Reference Guide)

## What this controls

The DeepMind 12 has a built-in digital effects engine with **4 independent FX slots** (`fx1`–`fx4`). Each slot can be loaded with any of 35 effects. The FX engine sits after the analog VCA in the signal chain.

## Architecture

- **4 FX slots** — each independently selectable from the 35 available effects
- **Routing modes** — 10 routing configurations (M-1 through M-10) control how FX slots connect: serial, parallel, or hybrid
- **12 parameters per slot** — every effect exposes up to 12 parameters via `fxN.param.1` through `fxN.param.12`
- **Output gain** — each slot has an independent output gain (`fxN.outputGain`, NRPN 218–221)
- **FX mode** — global insert/send/bypass setting (`fx.mode`, NRPN 222)
- **Mod matrix destinations** — many FX parameters are available as mod matrix destinations (marked with `*` in the detail files)

## NRPNs

| What              | NRPN         | Range  | Notes                                    |
|-------------------|-------------|--------|------------------------------------------|
| FX routing mode   | 165         | 0–9    | M-1 through M-10                         |
| FX 1 type         | 166         | 0–35   | 0 = None; see type table below           |
| FX 1 params 1–12  | 167–178     | 0–255  | Meaning depends on `fx1.type`            |
| FX 2 type         | 179         | 0–35   |                                          |
| FX 2 params 1–12  | 180–191     | 0–255  |                                          |
| FX 3 type         | 192         | 0–35   |                                          |
| FX 3 params 1–12  | 193–204     | 0–255  |                                          |
| FX 4 type         | 205         | 0–35   |                                          |
| FX 4 params 1–12  | 206–217     | 0–255  |                                          |
| FX 1 output gain  | 218         | 0–150  |                                          |
| FX 2 output gain  | 219         | 0–150  |                                          |
| FX 3 output gain  | 220         | 0–150  |                                          |
| FX 4 output gain  | 221         | 0–150  |                                          |
| FX mode           | 222         | 0–255  | Insert/Send/Bypass                       |

## Important: internal type values ≠ manual order

The manual lists effects 1–35, but the synth's internal `fxN.type` values use a different numbering. **Always use the internal type value** when setting `fxN.type` via NRPN.

## Effects by category

### Reverbs (10 effects)

| Internal type | Name        | Full name            | Inspiration      | Detail file                          |
|--------------:|-------------|----------------------|------------------|--------------------------------------|
| 22            | TC-DeepVRB  | TC Deep Reverb       | TC Hall of Fame  | [effects/reverbs.md](effects/reverbs.md) |
| 4             | AmbVerb     | Ambient Reverb       | Lexicon 480L     | [effects/reverbs.md](effects/reverbs.md) |
| 27            | RoomRev     | Room Reverb          | Lexicon 480L     | [effects/reverbs.md](effects/reverbs.md) |
| 28            | VintageRev  | Vintage Room Reverb  | EMT250/Quantec   | [effects/reverbs.md](effects/reverbs.md) |
| 1             | HallRev     | Hall Reverb          | Lexicon 480L     | [effects/reverbs.md](effects/reverbs.md) |
| 26            | ChamberRev  | Chamber Reverb       | Lexicon 480L     | [effects/reverbs.md](effects/reverbs.md) |
| 2             | PlateRev    | Plate Reverb         | Lexicon PCM-70   | [effects/reverbs.md](effects/reverbs.md) |
| 3             | RichPltRev  | Rich Plate Reverb    | Lexicon 480L     | [effects/reverbs.md](effects/reverbs.md) |
| 5             | GatedRev    | Gated Reverb         | Lexicon 300/480L | [effects/reverbs.md](effects/reverbs.md) |
| 6             | Reverse     | Reverse Reverb       | Lexicon 300/480L | [effects/reverbs.md](effects/reverbs.md) |

### Reverb combos (3 effects — reverb + modulation/delay in one slot)

| Internal type | Name        | Full name            | Inspiration      | Detail file                          |
|--------------:|-------------|----------------------|------------------|--------------------------------------|
| 24            | ChorusVerb  | Chorus & Reverb      | Lexicon PCM-70   | [effects/reverbs.md](effects/reverbs.md) |
| 25            | DelayVerb   | Delay & Reverb       | Lexicon PCM-70   | [effects/reverbs.md](effects/reverbs.md) |
| 23            | FlangVerb   | Flanger & Reverb     | Lexicon PCM-70   | [effects/reverbs.md](effects/reverbs.md) |

### Delays (6 effects)

| Internal type | Name        | Full name            | Inspiration      | Detail file                          |
|--------------:|-------------|----------------------|------------------|--------------------------------------|
| 13            | Delay       | Stereo Delay         | Behringer X32    | [effects/delays.md](effects/delays.md) |
| 14            | 3TapDelay   | 3-Tap Delay          | Behringer X32    | [effects/delays.md](effects/delays.md) |
| 15            | 4TapDelay   | 4-Tap Delay          | Behringer X32    | [effects/delays.md](effects/delays.md) |
| 21            | T-RayDelay  | Tel-Ray Delay        | Tel-Ray          | [effects/delays.md](effects/delays.md) |
| 34            | DecimDelay  | Decimator Delay      | —                | [effects/delays.md](effects/delays.md) |
| 12            | ModDlyRev   | Mod, Delay & Reverb  | Lexicon PCM-70   | [effects/delays.md](effects/delays.md) |

### Creative (8 effects)

| Internal type | Name         | Full name             | Inspiration      | Detail file                            |
|--------------:|--------------|-----------------------|------------------|----------------------------------------|
| 10            | Chorus       | Stereo Chorus         | Behringer X32    | [effects/creative.md](effects/creative.md) |
| 17            | Chorus-D     | Dimensional Chorus    | Roland Dim. D    | [effects/creative.md](effects/creative.md) |
| 11            | Flanger      | Stereo Flanger        | Behringer X32    | [effects/creative.md](effects/creative.md) |
| 9             | Phaser       | Stereo Phaser         | Behringer X32    | [effects/creative.md](effects/creative.md) |
| 8             | MoodFilter   | Mood Filter           | Moog-type filter | [effects/creative.md](effects/creative.md) |
| 29            | DualPitch    | Dual Pitch Shifter    | Eventide         | [effects/creative.md](effects/creative.md) |
| 35            | VintgPitch   | Vintage Pitch Shifter | Eventide         | [effects/creative.md](effects/creative.md) |
| 16            | RotarySpkr   | Rotary Speaker        | Leslie           | [effects/creative.md](effects/creative.md) |

### Processing (8 effects)

| Internal type | Name        | Full name              | Inspiration      | Detail file                                |
|--------------:|-------------|------------------------|------------------|--------------------------------------------|
| 30            | MidasEQ     | Midas Equalizer        | Midas Pro X      | [effects/processing.md](effects/processing.md) |
| 18            | Enhancer    | Enhancing EQ           | SPL Vitalizer    | [effects/processing.md](effects/processing.md) |
| 31            | FairComp    | Fairchild Compressor   | Fairchild 670    | [effects/processing.md](effects/processing.md) |
| 32            | MulBndDist  | Multiband Distortion   | Midas Pro X      | [effects/processing.md](effects/processing.md) |
| 7             | RackAmp     | Rack Amplifier         | Tech 21 SansAmp  | [effects/processing.md](effects/processing.md) |
| 19            | EdisonEX1   | Stereo Imaging         | Edison EX-1      | [effects/processing.md](effects/processing.md) |
| 20            | Auto Pan    | Auto-Panning/Tremolo   | Behringer X32    | [effects/processing.md](effects/processing.md) |
| 33            | NoiseGate   | Noise Gate             | Midas Pro X      | [effects/processing.md](effects/processing.md) |

## How to set an effect

1. Choose the FX slot (1–4) and set its type. `fx1.type` **accepts both `rawValue:` and `label:`**:
   ```
   fx1.type  label:"T-RayDelay"    # or rawValue: 21
   ```
2. Set parameters using either the **typed names** (preferred — self-documenting) or the positional names:
   ```
   fx1.tRayDelay.mix  value: 0.15    # same as fx1.param.1 value: 0.15
   fx1.chorus.mix     value: 0.70    # same as fx2.param.6 value: 0.70
   ```
   Typed names (`fxN.<effectName>.<key>`) are full `set_param` targets — not read-only. The `condition` on them is snapshot-display-only and has no effect on writes. Read the detail file to find the key names and their param index order.
3. The positional names `fxN.param.1`–`fxN.param.12` are always valid as a fallback when you know the index from the detail file.

## Common patterns

- **Reverb on everything**: Put a HallRev (type 1) or AmbVerb (type 4) in one slot. Set Mix to taste (param mapping in [reverbs.md](effects/reverbs.md))
- **Chorus + reverb in one slot**: Use ChorusVerb (type 24) to save FX slots
- **Tempo-synced delay**: Many delay/modulation effects support time-sync options; the Factor/Time parameters list rhythmic fractions
- **Mod matrix → FX**: Parameters marked `*` in the detail files can be targeted as mod matrix destinations

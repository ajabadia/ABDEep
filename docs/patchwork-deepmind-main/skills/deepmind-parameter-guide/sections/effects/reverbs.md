# Reverb Effects — Parameter Guide

> Source: DeepMind 12 Owner's Manual, pp. 95–106 (§9.2–9.3)
> Parent: [effects.md](../effects.md)

## Overview

The DeepMind 12 offers 13 reverb effects: 10 pure reverbs and 3 reverb-combo effects (chorus+reverb, delay+reverb, flange+reverb) that pack two effects into one FX slot.

Most reverbs share a common parameter set (PreDelay, Decay, Size, Damping, Diffusion, Mix, LoCut, HiCut) with variant parameters for each type's character. Parameters marked `*` are available as mod matrix destinations.

---

## TC-DeepVRB (TC Deep Reverb) — type 22

Nine iconic reverb modes from TC Electronic. Only 5 parameters but covers a wide range of tones.

| # | Abbr | Parameter | Units | Min | Max | Mod* | Description |
|--:|------|-----------|-------|-----|-----|:----:|-------------|
| 1 | PST  | Preset    | —     | —   | —   |      | Ambience, Church, Gate, Hall, Lo Fi, Modulated, Plate, Room, Spring, Tile, Default |
| 2 | DCY  | Decay     | s     | 0.1 | 6.0 | *    | Time for reverb to dissipate (range is preset-dependent) |
| 3 | TON  | Tone      | %     | -50 | 50  | *    | Positive = brighter; negative = darker |
| 4 | PDY  | PreDelay  | ms    | 0.0 | 200 |      | Time before reverb follows source signal |
| 5 | MIX  | Mix       | %     | 0   | 100 | *    | Wet/dry balance |

---

## AmbVerb (Ambient Reverb) — type 4

Lexicon 480L-inspired. Creates a virtual acoustic space that adds warmth without coloring the direct sound. 10 parameters.

| # | Abbr | Parameter | Units | Min   | Max    | Mod* | Description |
|--:|------|-----------|-------|-------|--------|:----:|-------------|
| 1 | PD   | PreDelay  | ms    | 0.0   | 200    |      | Time before reverb follows source |
| 2 | DCY  | Decay     | s     | 0.2   | 7.3    | *    | Reverb dissipation time |
| 3 | SIZ  | Size      | —     | 2.0   | 100    |      | Perceived space size |
| 4 | DMP  | Damping   | Hz    | 1000  | 20000  | *    | High-frequency decay within reverb tail |
| 5 | DIF  | Diffusion | —     | 1.0   | 30     |      | Initial reflection density |
| 6 | MIX  | Mix       | %     | 0     | 100    | *    | Wet/dry balance |
| 7 | LC   | LoCut     | Hz    | 10    | 500    | *    | Low frequencies below value are excluded |
| 8 | HC   | HiCut     | Hz    | 200   | 20000  | *    | High frequencies above value are excluded |
| 9 | MOD  | Mod       | %     | 0     | 100    |      | Reverb tail modulation depth |
| 10| TGN  | TailGain  | %     | 0     | 100    | *    | Volume of reverb tail |

---

## RoomRev (Room Reverb) — type 27

Lexicon 480L-inspired room simulation. 12 parameters.

| # | Abbr | Parameter | Units | Min  | Max    | Mod* | Description |
|--:|------|-----------|-------|------|--------|:----:|-------------|
| 1 | PRE  | PreDelay  | ms    | 0.0  | 200    |      | Time before reverb follows source |
| 2 | DCY  | Decay     | s     | 0.3  | 28.9   | *    | Reverb dissipation time |
| 3 | SIZ  | Size      | m     | 4.0  | 76     |      | Perceived room size in meters |
| 4 | DMP  | Damping   | Hz    | 1000 | 20000  | *    | High-frequency decay in tail |
| 5 | DIF  | Diffusion | %     | 0    | 100    |      | Initial reflection density |
| 6 | MIX  | Mix       | %     | 0    | 100    | *    | Wet/dry balance |
| 7 | LC   | LoCut     | Hz    | 10   | 500    | *    | Low-frequency exclusion |
| 8 | HC   | HiCut     | Hz    | 200  | 20000  | *    | High-frequency exclusion |
| 9 | LFX  | BassMult  | —     | 0.2  | 4.0    | *    | Low-frequency build-up control |
| 10| SPR  | Spread    | —     | 0.0  | 50     |      | Stereo emphasis |
| 11| SHP  | Shape     | —     | 0.0  | 250    | *    | Reverb envelope contour |
| 12| SPI  | Spin      | %     | 0    | 100    |      | Randomization/modulation within reverb |

---

## VintageRev (Vintage Room Reverb) — type 28

EMT250/Quantec QRS-inspired small room reverb with warmth. 12 parameters including freeze.

| # | Abbr | Parameter | Units | Min  | Max    | Mod* | Description |
|--:|------|-----------|-------|------|--------|:----:|-------------|
| 1 | PRE  | PreDelay  | ms    | 0.0  | 200    |      | Time before reverb follows source |
| 2 | SIZ  | Size      | %     | 1    | 100    |      | Room size (affects Decay range) |
| 3 | DCY  | Decay     | s     | 0.1  | 20.7   | *    | Dissipation time (range depends on Size) |
| 4 | LFX  | Lo Mult   | —     | 0.1  | 10     | *    | Low-frequency build-up |
| 5 | HFX  | Hi Mult   | —     | 0.1  | 10     | *    | High-frequency build-up |
| 6 | DEN  | Density   | %     | 0    | 100    | *    | Reflection density (slightly affects decay) |
| 7 | LC   | LoCut     | Hz    | 10   | 500    | *    | Low-frequency exclusion |
| 8 | HC   | HiCut     | Hz    | 200  | 20000  | *    | High-frequency exclusion |
| 9 | ERL  | ER Level  | %     | 0    | 100    | *    | Early reflection level |
| 10| ERD  | ER Delay  | ms    | 0.0  | 200    |      | Early reflection delay time |
| 11| MIX  | Mix       | %     | 0    | 100    | *    | Wet/dry balance |
| 12| FRZ  | Freeze    | —     | OFF  | ON     | *    | Freezes reverb tail into continuous response |

---

## HallRev (Hall Reverb) — type 1

Lexicon 480L-inspired concert hall reverb. 12 parameters.

| # | Abbr | Parameter | Units | Min  | Max    | Mod* | Description |
|--:|------|-----------|-------|------|--------|:----:|-------------|
| 1 | PD   | PreDelay  | ms    | 0.0  | 200    |      | Time before reverb follows source |
| 2 | DCY  | Decay     | s     | 0.2  | 4.9    | *    | Reverb dissipation time |
| 3 | SIZ  | Size      | —     | 2.0  | 200    |      | Perceived hall size |
| 4 | DMP  | Damping   | Hz    | 1000 | 20000  | *    | High-frequency decay in tail |
| 5 | DIF  | Diffusion | —     | 1.0  | 30     |      | Initial reflection density |
| 6 | MIX  | Mix       | %     | 0    | 100    | *    | Wet/dry balance |
| 7 | LC   | LoCut     | Hz    | 10   | 500    | *    | Low-frequency exclusion |
| 8 | HC   | HiCut     | Hz    | 200  | 20000  | *    | High-frequency exclusion |
| 9 | LFX  | BassMult  | —     | 0.5  | 2.0    | *    | Low-frequency build-up |
| 10| SPR  | Spread    | —     | 0.0  | 50     |      | Stereo emphasis |
| 11| SHP  | Shape     | —     | 0.0  | 250    | *    | Reverb envelope contour |
| 12| MOD  | ModSpeed  | —     | 0.0  | 100    |      | Reverb tail modulation rate |

---

## ChamberRev (Chamber Reverb) — type 26

Lexicon 480L-inspired chamber reverb. 12 parameters.

| # | Abbr | Parameter | Units | Min  | Max    | Mod* | Description |
|--:|------|-----------|-------|------|--------|:----:|-------------|
| 1 | PRE  | PreDelay  | ms    | 0.0  | 200    |      | Time before reverb follows source |
| 2 | DCY  | Decay     | s     | 0.3  | 28.9   | *    | Reverb dissipation time |
| 3 | SIZ  | Size      | m     | 4.0  | 76     |      | Perceived space size in meters |
| 4 | DMP  | Damping   | Hz    | 1000 | 20000  | *    | High-frequency decay in tail |
| 5 | DIF  | Diffusion | %     | 0    | 100    |      | Initial reflection density |
| 6 | MIX  | Mix       | %     | 0    | 100    | *    | Wet/dry balance |
| 7 | LC   | LoCut     | Hz    | 10   | 500    | *    | Low-frequency exclusion |
| 8 | HC   | HiCut     | Hz    | 200  | 20000  | *    | High-frequency exclusion |
| 9 | LFX  | BassMult  | —     | 0.2  | 4.0    | *    | Low-frequency build-up |
| 10| SPR  | Spread    | —     | 0.0  | 50     |      | Stereo emphasis |
| 11| SHP  | Shape     | —     | 0.0  | 250    | *    | Reverb envelope contour |
| 12| SPI  | Spin      | %     | 0    | 100    |      | Randomization/modulation within reverb |

---

## PlateRev (Plate Reverb) — type 2

Lexicon PCM-70-inspired plate reverb. Bright, high initial diffusion — the sound of countless hit records since the 1950s. 12 parameters.

| # | Abbr | Parameter | Units | Min  | Max    | Mod* | Description |
|--:|------|-----------|-------|------|--------|:----:|-------------|
| 1 | PD   | PreDelay  | ms    | 0.0  | 200    |      | Time before reverb follows source |
| 2 | DCY  | Decay     | s     | 0.3  | 28.9   | *    | Reverb dissipation time |
| 3 | SIZ  | Size      | m     | 4.0  | 39     |      | Virtual room size in meters |
| 4 | DMP  | Damping   | Hz    | 1000 | 20000  | *    | High-frequency decay in tail |
| 5 | DIF  | Diffusion | %     | 0    | 100    |      | Initial reflection density |
| 6 | MIX  | Mix       | %     | 0    | 100    | *    | Wet/dry balance |
| 7 | LC   | LoCut     | Hz    | 10   | 500    | *    | Low-frequency exclusion |
| 8 | HC   | HiCut     | Hz    | 200  | 20000  | *    | High-frequency exclusion |
| 9 | LFX  | BassMult  | —     | 0.2  | 4.0    | *    | Low-frequency build-up |
| 10| XOV  | Xover     | Hz    | 10   | 500    | *    | Crossover point for bass |
| 11| MOD  | ModDepth  | —     | 1.0  | 50     |      | Reverb tail modulation depth |
| 12| MDS  | ModSpeed  | —     | 0.0  | 100    |      | Reverb tail modulation rate |

---

## RichPltRev (Rich Plate Reverb) — type 3

Lexicon 480L-inspired plate with richer modulation. 12 parameters.

| # | Abbr | Parameter | Units | Min  | Max    | Mod* | Description |
|--:|------|-----------|-------|------|--------|:----:|-------------|
| 1 | PD   | PreDelay  | ms    | 0.0  | 200    |      | Time before reverb follows source |
| 2 | DCY  | Decay     | s     | 0.3  | 28.9   | *    | Reverb dissipation time |
| 3 | SIZ  | Size      | m     | 4.0  | 39     |      | Virtual room size in meters |
| 4 | DMP  | Damping   | Hz    | 1000 | 20000  | *    | High-frequency decay in tail |
| 5 | DIF  | Diffusion | %     | 0    | 100    |      | Initial reflection density |
| 6 | MIX  | Mix       | %     | 0    | 100    | *    | Wet/dry balance |
| 7 | LC   | LoCut     | Hz    | 10   | 500    | *    | Low-frequency exclusion |
| 8 | HC   | HiCut     | Hz    | 200  | 20000  | *    | High-frequency exclusion |
| 9 | LFX  | BassMult  | —     | 0.2  | 4.0    | *    | Low-frequency build-up |
| 10| SPR  | Spread    | —     | 0.0  | 50     |      | Stereo emphasis |
| 11| ATK  | Attack    | —     | 0.0  | 100    | *    | Reverb envelope contour |
| 12| SPN  | Spin      | %     | 0    | 100    | *    | Randomization/modulation within reverb |

---

## GatedRev (Gated Reverb) — type 5

Lexicon 300/480L-inspired. Originally achieved by combining reverb + noise gate. Great for 1980s-style snare and punchy drums. 10 parameters.

| # | Abbr | Parameter | Units | Min  | Max    | Mod* | Description |
|--:|------|-----------|-------|------|--------|:----:|-------------|
| 1 | PD   | PreDelay  | ms    | 0.0  | 200    |      | Time before reverb follows source |
| 2 | DCY  | Decay     | ms    | 140  | 1000   |      | Reverb dissipation time (note: ms, not seconds) |
| 3 | ATK  | Attack    | —     | 0.0  | 30     | *    | How fast reflection density builds up |
| 4 | DEN  | Density   | —     | 1.0  | 50     | *    | Number of reflections in the simulated room |
| 5 | SPR  | Spread    | —     | 0.0  | 100    |      | How reflections distribute through envelope |
| 6 | MIX  | Mix       | %     | 0    | 100    | *    | Wet/dry balance |
| 7 | LC   | LoCut     | Hz    | 10   | 500    | *    | Low-frequency exclusion |
| 8 | HIF  | HiSvFreq  | Hz    | 200  | 20000  | *    | Hi-shelving filter frequency at reverb input |
| 9 | HIG  | HiSvGain  | dB    | -30  | 0      | *    | Hi-shelving filter gain at reverb input |
| 10| DIF  | Diffusion | %     | 0    | 100    |      | Initial reflection density |

---

## Reverse (Reverse Reverb) — type 6

Lexicon 300/480L-inspired. Turns the reverb trail around, placing it before the sound source. Ethereal, swelling crescendo effect. 9 parameters.

| # | Abbr | Parameter | Units | Min  | Max    | Mod* | Description |
|--:|------|-----------|-------|------|--------|:----:|-------------|
| 1 | PD   | PreDelay  | ms    | 0.0  | 200    |      | Time before reverb follows source |
| 2 | DCY  | Decay     | ms    | 140  | 1000   |      | Reverb dissipation time (note: ms, not seconds) |
| 3 | RIS  | Rise      | —     | 0.0  | 50     | *    | How quickly the effect builds up |
| 4 | DIF  | Diffusion | —     | 1.0  | 30     |      | Initial reflection density |
| 5 | SPR  | Spread    | —     | 0.0  | 100    |      | Reflection distribution through envelope |
| 6 | MIX  | Mix       | %     | 0    | 100    | *    | Wet/dry balance |
| 7 | LC   | LoCut     | Hz    | 10   | 500    | *    | Low-frequency exclusion |
| 8 | HIF  | HiSvFreq  | Hz    | 200  | 20000  | *    | Hi-shelving filter frequency at reverb input |
| 9 | HIG  | HiSvGain  | dB    | -30  | 0      | *    | Hi-shelving filter gain at reverb input |

---

## ChorusVerb (Chorus & Reverb) — type 24

Combines chorus shimmer with a chamber reverb in one FX slot. Inspired by Lexicon PCM-70. 12 parameters.

| # | Abbr | Parameter | Units | Min   | Max    | Mod* | Description |
|--:|------|-----------|-------|-------|--------|:----:|-------------|
| 1 | SPD  | Speed     | Hz    | 0.0   | 4.0    | *    | Chorus LFO rate (time-sync options: 4 to 1/64 bars) |
| 2 | DEP  | Depth     | %     | 0     | 100    | *    | Chorus modulation depth |
| 3 | DLY  | Delay     | ms    | 0.5   | 50     |      | Chorus delay time |
| 4 | PHS  | Phase     | —     | 0.0   | 180    | *    | LFO phase offset between L/R channels |
| 5 | WAV  | Wave      | %     | 0     | 100    |      | LFO shape: sine → triangular |
| 6 | BAL  | Balance   | —     | -100  | 100    | *    | Chorus ↔ reverb balance |
| 7 | PRE  | PreDelay  | ms    | 0.0   | 200    |      | Reverb pre-delay |
| 8 | DCY  | Decay     | s     | 0.1   | 5.0    | *    | Reverb dissipation time |
| 9 | SIZ  | Size      | —     | 2.0   | 200    |      | Reverb space size |
| 10| DMP  | Damping   | Hz    | 1000  | 20000  | *    | HF decay in reverb tail |
| 11| LC   | LoCut     | Hz    | 10    | 500    | *    | Low-frequency exclusion |
| 12| MIX  | Mix       | %     | 0     | 100    | *    | Overall wet/dry balance |

---

## DelayVerb (Delay & Reverb) — type 25

Combines delay with chamber reverb in one FX slot. Inspired by Lexicon PCM-70. 12 parameters.

| # | Abbr | Parameter | Units | Min   | Max    | Mod* | Description |
|--:|------|-----------|-------|-------|--------|:----:|-------------|
| 1 | TIM  | Time      | ms    | 1.0   | 1500   |      | Left channel delay time (time-sync options: 4 to 1/64 bars) |
| 2 | PAT  | Pattern   | —     | 1/4   | 1X     |      | Right channel delay ratio |
| 3 | FHC  | FeedHC    | Hz    | 200   | 20000  | *    | High-frequency trim in feedback path |
| 4 | FBK  | Feedback  | %     | 0     | 100    | *    | Feedback amount |
| 5 | XFD  | X-Feed    | %     | 0     | 100    | *    | Amount of delay sent to the reverb |
| 6 | BAL  | Balance   | —     | -100  | 100    | *    | Delay ↔ reverb balance |
| 7 | PRE  | PreDelay  | ms    | 0.0   | 200    |      | Reverb pre-delay |
| 8 | DCY  | Decay     | s     | 0.1   | 5.0    | *    | Reverb dissipation time |
| 9 | SIZ  | Size      | —     | 2.0   | 200    |      | Reverb space size |
| 10| DMP  | Damping   | Hz    | 1000  | 20000  | *    | HF decay in reverb tail |
| 11| LC   | LoCut     | Hz    | 10    | 500    | *    | Low-frequency exclusion |
| 12| MIX  | Mix       | %     | 0     | 100    | *    | Overall wet/dry balance |

---

## FlangVerb (Flanger & Reverb) — type 23

Combines flanger with chamber reverb in one FX slot. Inspired by Lexicon PCM-70. 12 parameters.

| # | Abbr | Parameter | Units | Min   | Max    | Mod* | Description |
|--:|------|-----------|-------|-------|--------|:----:|-------------|
| 1 | SPD  | Speed     | Hz    | 0.0   | 4.0    | *    | Flanger LFO rate (time-sync options: 4 to 1/64 bars) |
| 2 | DEP  | Depth     | %     | 0     | 100    | *    | Flanger modulation depth |
| 3 | DLY  | Delay     | ms    | 0.5   | 20     |      | Flanger delay time |
| 4 | PHS  | Phase     | —     | 0.0   | 180    | *    | LFO phase offset between L/R channels |
| 5 | FBK  | Feed      | %     | -90   | 90     | *    | Positive or negative feedback |
| 6 | BAL  | Balance   | —     | -100  | 100    | *    | Flanger ↔ reverb balance |
| 7 | PRE  | PreDelay  | ms    | 0.0   | 200    |      | Reverb pre-delay |
| 8 | DCY  | Decay     | s     | 0.1   | 5.0    | *    | Reverb dissipation time |
| 9 | SIZ  | Size      | —     | 2.0   | 200    |      | Reverb space size |
| 10| DMP  | Damping   | Hz    | 1000  | 20000  | *    | HF decay in reverb tail |
| 11| LC   | LoCut     | Hz    | 10    | 500    | *    | Low-frequency exclusion |
| 12| MIX  | Mix       | %     | 0     | 100    | *    | Overall wet/dry balance |

---

## Choosing a reverb

| Want this...                    | Use this               | Why                                          |
|---------------------------------|------------------------|----------------------------------------------|
| Simple, great-sounding reverb   | TC-DeepVRB (type 22)   | Only 5 params; 9 preset modes cover most needs |
| Warm ambience, minimal coloring | AmbVerb (type 4)       | TailGain + Mod for depth without dominance   |
| Natural small room              | RoomRev (type 27)      | Size in meters; Spin for realism             |
| Vintage warmth                  | VintageRev (type 28)   | ER controls + Freeze for textures            |
| Classic hall                    | HallRev (type 1)       | Workhorse; good Shape + Spread control       |
| Bright plate                   | PlateRev (type 2)      | Crossover + mod for shimmer                  |
| Rich, animated plate           | RichPltRev (type 3)    | Attack + Spin for evolving tails             |
| Punchy 80s drums               | GatedRev (type 5)      | Fast decay (ms); Attack + Density            |
| Ethereal swells                | Reverse (type 6)       | Rise control for crescendo builds            |
| Chorus + reverb (save a slot)  | ChorusVerb (type 24)   | Balance knob blends the two                  |
| Delay + reverb (save a slot)   | DelayVerb (type 25)    | X-Feed sends delay into reverb               |
| Flanger + reverb (save a slot) | FlangVerb (type 23)    | Negative feedback for jet-engine sweeps      |

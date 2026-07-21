# Creative Effects — Parameter Guide

> Source: DeepMind 12 Owner's Manual, pp. 99–100, 114–118 (§9.2–9.3)
> Parent: [effects.md](../effects.md)

## Overview

Eight creative effects for modulation, pitch shifting, and speaker emulation. These shape the character of the sound beyond simple reverb/delay. Parameters marked `*` are available as mod matrix destinations.

---

## Chorus (Stereo Chorus) — type 10

Samples and slightly detunes the input, mixing it with the original for a thicker, shimmering sound. Independent L/R width and delay. 11 parameters.

| # | Abbr | Parameter | Units | Min  | Max    | Mod* | Description |
|--:|------|-----------|-------|------|--------|:----:|-------------|
| 1 | SPD  | Speed     | Hz    | 0.0  | 5.0    | *    | Modulation speed (time-sync: 4 to 1/64 bars) |
| 2 | WDL  | WidthL    | %     | 0    | 100    | *    | Modulated delay amount in left channel |
| 3 | WDR  | WidthR    | %     | 0    | 100    | *    | Modulated delay amount in right channel |
| 4 | DLL  | DelayL    | ms    | 0.5  | 50     |      | Total delay for left channel |
| 5 | DLR  | DelayR    | ms    | 0.5  | 50     |      | Total delay for right channel |
| 6 | MIX  | Mix       | %     | 0    | 100    | *    | Wet/dry balance |
| 7 | LC   | LoCut     | Hz    | 10   | 500    | *    | Low-frequency exclusion |
| 8 | HC   | HiCut     | Hz    | 200  | 20000  | *    | High-frequency exclusion |
| 9 | PHS  | Phase     | —     | 0.0  | 100    |      | LFO phase offset between L/R |
| 10| WAV  | Wave      | %     | 0    | 100    |      | Blends between digital triangular and classic analog sine |
| 11| SPR  | Spread    | %     | 0    | 100    | *    | Cross-mix between L and R channels |

---

## Chorus-D (Dimensional Chorus) — type 17

Roland Dimension D emulation. Very simple: 4 intensity switches for different chorus depths. 7 parameters.

| # | Abbr | Parameter | Units | Min | Max | Mod* | Description |
|--:|------|-----------|-------|-----|-----|:----:|-------------|
| 1 | ON   | On        | —     | OFF | ON  |      | Effect on/off |
| 2 | MOD  | Mode      | —     | M   | ST  |      | Mono or stereo operation |
| 3 | MIX  | Mix       | %     | 0   | 100 | *    | Wet/dry balance |
| 4 | SW1  | Sw1       | —     | OFF | ON  |      | Intensity level 1 (minimum) |
| 5 | SW2  | Sw2       | —     | OFF | ON  |      | Intensity level 2 |
| 6 | SW3  | Sw3       | —     | OFF | ON  |      | Intensity level 3 |
| 7 | SW4  | Sw4       | —     | OFF | ON  |      | Intensity level 4 (maximum) |

---

## Flanger (Stereo Flanger) — type 11

Modulated delay creates a sweeping comb-filter effect. Independent L/R width with positive/negative feedback. 12 parameters.

| # | Abbr | Parameter | Units | Min  | Max    | Mod* | Description |
|--:|------|-----------|-------|------|--------|:----:|-------------|
| 1 | SPD  | Speed     | Hz    | 0.0  | 5.0    | *    | Modulation speed (time-sync: 4 to 1/64 bars) |
| 2 | WDL  | WidthL    | %     | 0    | 100    | *    | Modulated delay amount in left channel |
| 3 | WDR  | WidthR    | %     | 0    | 100    | *    | Modulated delay amount in right channel |
| 4 | DLL  | DelayL    | ms    | 0.5  | 20     |      | Total delay for left channel |
| 5 | DLR  | DelayR    | ms    | 0.5  | 20     |      | Total delay for right channel |
| 6 | MIX  | Mix       | %     | 0    | 100    | *    | Wet/dry balance |
| 7 | LC   | LoCut     | Hz    | 10   | 500    | *    | Low-frequency exclusion |
| 8 | HC   | HiCut     | Hz    | 200  | 20000  | *    | High-frequency exclusion |
| 9 | PHS  | Phase     | —     | 0.0  | 180    |      | LFO phase offset between L/R |
| 10| FLC  | FeedLC    | Hz    | 10   | 500    | *    | Low-cut filter in feedback path |
| 11| FHC  | FeedHC    | Hz    | 200  | 20000  | *    | High-cut filter in feedback path |
| 12| FD   | Feed      | %     | -90  | 90     | *    | Positive or negative feedback |

---

## Phaser (Stereo Phaser) — type 9

Multiple stages of modulated filters create a "notch" in the frequency response, mixed with the original for a swirling effect. Envelope follower adds vowel-like tones. 12 parameters.

| # | Abbr | Parameter | Units | Min   | Max    | Mod* | Description |
|--:|------|-----------|-------|-------|--------|:----:|-------------|
| 1 | SPD  | Speed     | Hz    | 0.0   | 5.0    | *    | Modulation speed (time-sync: 4 to 1/64 bars) |
| 2 | DEP  | Depth     | %     | 0     | 100    | *    | Modulation depth |
| 3 | RES  | Reso      | %     | 0     | 100    | *    | Resonance of filter stages |
| 4 | BAS  | Base Freq | Hz    | 20    | 15000  | *    | Frequency range of modulated filters |
| 5 | STG  | Stages    | —     | 2.0   | 12     |      | Number of filter stages |
| 6 | MIX  | Mix       | %     | 0     | 100    | *    | Wet/dry balance |
| 7 | WAV  | Wave      | —     | -50   | 50     |      | LFO waveform symmetry |
| 8 | PHS  | Phase     | deg   | 0.0   | 180    |      | LFO phase difference between L/R |
| 9 | ENV  | EnvMod    | %     | -100  | 100    | *    | Envelope modulation (positive or negative) |
| 10| ATK  | Attack    | ms    | 10    | 1000   | *    | Envelope attack time |
| 11| HLD  | Hold      | ms    | 1.0   | 2000   | *    | Envelope hold time |
| 12| REL  | Release   | ms    | 10    | 1000   | *    | Envelope release time |

---

## MoodFilter (Mood Filter) — type 8

Moog-type VCF with LFO and auto-envelope modulation. Four filter modes, drive for analog-style saturation. 12 parameters.

| # | Abbr | Parameter | Units | Min   | Max    | Mod* | Description |
|--:|------|-----------|-------|-------|--------|:----:|-------------|
| 1 | SPD  | Speed     | Hz    | 0.0   | 20     |      | LFO rate (time-sync: 4 to 1/64 bars) |
| 2 | DEP  | Depth     | %     | 0     | 100    | *    | LFO modulation depth |
| 3 | RES  | Resonance | %     | 0     | 100    | *    | Filter resonance (can reach self-oscillation) |
| 4 | FRQ  | Base Freq | Hz    | 20    | 15000  | *    | Filter base frequency |
| 5 | TYP  | Type      | —     | —     | —      |      | LP (low-pass), HP (high-pass), BP (band-pass), NOT (notch) |
| 6 | MIX  | Mix       | %     | 0     | 100    | *    | Wet/dry balance |
| 7 | WAV  | Wave      | —     | —     | —      |      | LFO waveform: triangular, sine, saw+, saw-, ramp, square, random |
| 8 | ENV  | EnvMod    | %     | -100  | 100    | *    | Envelope modulation (positive or negative) |
| 9 | ATK  | Attack    | ms    | 10    | 249.9  | *    | Filter envelope attack time |
| 10| REL  | Release   | ms    | 10    | 500    | *    | Filter envelope release time |
| 11| DRV  | Drive     | %     | 0     | 100    | *    | Level/overdrive (pushes into analog-style saturation) |
| 12| 4P   | 4-Pole    | —     | 2P    | 4P     |      | 2-pole (gentle slope) or 4-pole (steep slope) |

---

## DualPitch (Dual Pitch Shifter) — type 29

Eventide-inspired pitch shifter with two independent channels. For voice doubling (subtle cent offsets) or extreme shifting (full octave up/down). 12 parameters.

| # | Abbr | Parameter | Units | Min   | Max    | Mod* | Description |
|--:|------|-----------|-------|-------|--------|:----:|-------------|
| 1 | SM1  | Semi1     | —     | -12   | 12     | *    | Channel 1 pitch in semitones |
| 2 | CN1  | Cent1     | —     | -50   | 50     | *    | Channel 1 pitch in cents |
| 3 | DL1  | Delay1    | ms    | 1.0   | 500    |      | Channel 1 wet/dry time offset (sync: 4 to 1/64 bars) |
| 4 | GN1  | Gain1     | %     | 0     | 100    | *    | Channel 1 gain compensation |
| 5 | PN1  | Pan1      | %     | -100  | 100    | *    | Channel 1 pan position |
| 6 | MIX  | Mix       | %     | 0     | 100    | *    | Wet/dry balance |
| 7 | SM2  | Semi2     | —     | -12   | 12     | *    | Channel 2 pitch in semitones |
| 8 | CN2  | Cent2     | —     | -50   | 50     | *    | Channel 2 pitch in cents |
| 9 | DL2  | Delay2    | ms    | 1.0   | 500    |      | Channel 2 wet/dry time offset |
| 10| GN2  | Gain2     | %     | 0     | 100    | *    | Channel 2 gain compensation |
| 11| PN2  | Pan2      | %     | -100  | 100    | *    | Channel 2 pan position |
| 12| HIC  | HiCut     | Hz    | 200   | 20000  | *    | High-frequency exclusion from pitch-shifted signal |

> **Tip:** For subtle thickening, set Semi to 0, Cent to ±5–10, Delay to 10–30 ms, Mix to 30–50%.
> If you notice glitching with low-level signals, use Vintage Pitch instead.

---

## Vintage Pitch (Vintage Pitch Shifter) — type 35

Same concept as Dual Pitch but with feedback instead of gain — designed for cleaner operation with low-level signals. 12 parameters.

| # | Abbr | Parameter | Units | Min   | Max    | Mod* | Description |
|--:|------|-----------|-------|-------|--------|:----:|-------------|
| 1 | SM1  | Semi1     | —     | -12   | 12     | *    | Channel 1 pitch in semitones |
| 2 | CN1  | Cent1     | —     | -50   | 50     | *    | Channel 1 pitch in cents |
| 3 | DL1  | Delay1    | ms    | 1.0   | 500    |      | Channel 1 wet/dry time offset (sync: 4 to 1/64 bars) |
| 4 | FB1  | Feedback1 | %     | 0     | 100    | *    | Channel 1 feedback |
| 5 | PN1  | Pan1      | %     | -100  | 100    | *    | Channel 1 pan position |
| 6 | MIX  | Mix       | %     | 0     | 100    | *    | Wet/dry balance |
| 7 | SM2  | Semi2     | —     | -12   | 12     | *    | Channel 2 pitch in semitones |
| 8 | CN2  | Cent2     | —     | -50   | 50     | *    | Channel 2 pitch in cents |
| 9 | DL2  | Delay2    | ms    | 1.0   | 500    |      | Channel 2 wet/dry time offset |
| 10| FB2  | Feedback2 | %     | 0     | 100    | *    | Channel 2 feedback |
| 11| PN2  | Pan2      | %     | -100  | 100    | *    | Channel 2 pan position |
| 12| HIC  | HiCut     | Hz    | 200   | 20000  | *    | High-frequency exclusion |

---

## RotarySpkr (Rotary Speaker) — type 16

Leslie rotating speaker emulation. Speed can be toggled between slow and fast with adjustable acceleration. 8 parameters.

| # | Abbr | Parameter | Units | Min  | Max  | Mod* | Description |
|--:|------|-----------|-------|------|------|:----:|-------------|
| 1 | LOS  | LoSpeed   | Hz    | 0.1  | 4.0  | *    | Rotational speed in slow mode |
| 2 | HIS  | HiSpeed   | Hz    | 2.0  | 9.9  | *    | Rotational speed in fast mode |
| 3 | ACC  | Accel     | %     | 0    | 100  | *    | Speed-up/slow-down rate between modes |
| 4 | DIS  | Distance  | %     | 0    | 100  | *    | Distance from speakers to virtual microphone |
| 5 | BAL  | Balance   | —     | -100 | 100  | *    | Balance between virtual horn and drum (tone control) |
| 6 | MIX  | Mix       | %     | 0    | 100  | *    | Wet/dry balance |
| 7 | MOT  | Motor     | —     | RUN  | STOP | *    | Disengage rotation (STOP freezes position) |
| 8 | SPD  | Speed     | —     | SLOW | FAST | *    | Select slow or fast rotation speed |

---

## Choosing a creative effect

| Want this...                    | Use this               | Why                                          |
|---------------------------------|------------------------|----------------------------------------------|
| Classic analog-style chorus     | Chorus (type 10)       | Independent L/R width; Wave blends triangle↔sine |
| Simple, lush '80s chorus       | Chorus-D (type 17)     | 4 intensity switches, no tweaking needed     |
| Jet-engine sweep               | Flanger (type 11)      | Negative feedback; adjust speed and depth    |
| Swirling, spacey movement      | Phaser (type 9)        | 2–12 stages; envelope follower for vowels    |
| Synth filter sweeps            | MoodFilter (type 8)    | LP/HP/BP/Notch + drive + envelope + LFO      |
| Subtle voice doubling          | DualPitch (type 29)    | Small cent offset + short delay = thickness  |
| Octave up/down                 | DualPitch (type 29)    | Set Semi to ±12 for full octave shift        |
| Cleaner pitch shift            | VintgPitch (type 35)   | Better with low-level signals                |
| Organ / Leslie simulation      | RotarySpkr (type 16)   | Slow/fast toggle with acceleration ramp      |

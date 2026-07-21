# Delay Effects — Parameter Guide

> Source: DeepMind 12 Owner's Manual, pp. 98–99, 111–114 (§9.2–9.3)
> Parent: [effects.md](../effects.md)

## Overview

Six delay effects ranging from pristine stereo delay to lo-fi decimation. Most support time-sync options (rhythmic fractions of the master tempo). Parameters marked `*` are available as mod matrix destinations.

---

## Delay (Stereo Delay) — type 13

Full-featured stereo delay with independent L/R channels, feedback modes, and filter controls. 12 parameters.

| # | Abbr | Parameter | Units | Min   | Max    | Mod* | Description |
|--:|------|-----------|-------|-------|--------|:----:|-------------|
| 1 | MIX  | Mix       | %     | 0     | 100    | *    | Wet/dry balance |
| 2 | TIM  | Time      | ms    | 1.0   | 1500   |      | Master delay time (time-sync: 4 to 1/64 bars) |
| 3 | MOD  | Mode      | —     | —     | —      |      | ST (stereo), X (cross-feedback), M (mono mix), P-P (ping-pong; disables FeedR) |
| 4 | FCL  | FactorL   | —     | —     | —      |      | Left delay as fraction of master: 1/4, 3/8, 1/2, 2/3, 1, 4/3, 3/2, 2, 3 |
| 5 | FCR  | FactorR   | —     | —     | —      |      | Right delay as fraction of master |
| 6 | OFS  | Offset    | ms    | -100  | 100    |      | Delay difference between L and R |
| 7 | LC   | LoCut     | Hz    | 10    | 500    | *    | Low-frequency exclusion |
| 8 | HC   | HiCut     | Hz    | 200   | 20000  | *    | High-frequency exclusion |
| 9 | FLC  | FeedLC    | Hz    | 10    | 500    | *    | Low-cut filter in feedback path |
| 10| FBL  | FeedL     | %     | 0     | 100    | *    | Left channel feedback amount |
| 11| FBR  | FeedR     | %     | 0     | 100    | *    | Right channel feedback (disabled in P-P mode) |
| 12| FHC  | FeedHC    | Hz    | 200   | 20000  | *    | High-cut filter in feedback path |

### Feedback modes (param 3)

| Value | Mode | Behavior |
|-------|------|----------|
| ST    | Stereo | Normal feedback for both channels |
| X     | Cross  | Feedback crosses between L and R |
| M     | Mono   | Mono mix within feedback chain |
| P-P   | Ping-Pong | Bounces between channels (FeedR disabled) |

---

## 3TapDelay (3-Tap Delay) — type 14

Three delay stages with independent timing, gain, and pan per stage. 12 parameters.

| # | Abbr | Parameter | Units | Min  | Max    | Mod* | Description |
|--:|------|-----------|-------|------|--------|:----:|-------------|
| 1 | TIM  | Time      | ms    | 1.0  | 1500   |      | Master delay time (= stage 1 time). Time-sync: 4 to 1/64 bars |
| 2 | GNT  | GainT     | %     | 0    | 100    | *    | Stage 1 gain level |
| 3 | PNT  | PanT      | %     | -100 | 100    | *    | Stage 1 stereo position |
| 4 | FBK  | Feedback  | %     | 0    | 100    | *    | Feedback amount |
| 5 | FCA  | FactorA   | —     | —    | —      |      | Stage 2 delay as fraction: 1/4, 3/8, 1/2, 2/3, 1, 4/3, 3/2, 2, 3 |
| 6 | GNA  | GainA     | %     | 0    | 100    | *    | Stage 2 gain level |
| 7 | PNA  | PanA      | %     | -100 | 100    | *    | Stage 2 stereo position |
| 8 | FCB  | FactorB   | —     | —    | —      |      | Stage 3 delay as fraction |
| 9 | GNB  | GainB     | %     | 0    | 100    | *    | Stage 3 gain level |
| 10| PNB  | PanB      | %     | -100 | 100    | *    | Stage 3 stereo position |
| 11| XFD  | X-Feed    | —     | OFF  | ON     |      | Stereo cross-feedback on/off |
| 12| MIX  | Mix       | %     | 0    | 100    | *    | Wet/dry balance |

---

## 4TapDelay (4-Tap Delay) — type 15

Four delay stages with independently adjustable gain and rate for unique syncopated repeats. 12 parameters.

| # | Abbr | Parameter | Units | Min  | Max    | Mod* | Description |
|--:|------|-----------|-------|------|--------|:----:|-------------|
| 1 | TIM  | Time      | ms    | 1.0  | 1500   |      | Master delay time (= stage 1). Time-sync: 4 to 1/64 bars |
| 2 | GN   | Gain      | %     | 0    | 100    | *    | Stage 1 gain |
| 3 | FBK  | Feedback  | %     | 0    | 100    | *    | Feedback amount |
| 4 | SPR  | Spread    | —     | 0.0  | 6.0    |      | Stage 1 stereo position |
| 5 | FCA  | FactorA   | —     | —    | —      |      | Stage 2 delay fraction: 1/4, 3/8, 1/2, 2/3, 1, 4/3, 3/2, 2, 3 |
| 6 | GNA  | GainA     | %     | 0    | 100    | *    | Stage 2 gain |
| 7 | FCB  | FactorB   | —     | —    | —      |      | Stage 3 delay fraction |
| 8 | GNB  | GainB     | %     | 0    | 100    | *    | Stage 3 gain |
| 9 | FCC  | FactorC   | —     | —    | —      |      | Stage 4 delay fraction |
| 10| GNC  | GainC     | %     | 0    | 100    | *    | Stage 4 gain |
| 11| XFD  | X-Feed    | —     | 0.0  | 1.0    |      | Stereo cross-feedback on/off |
| 12| MIX  | Mix       | %     | 0    | 100    | *    | Wet/dry balance |

---

## T-RayDelay (Tel-Ray Delay) — type 21

1960s oil-can delay emulation. Incredibly versatile with only 5 parameters — can create delays, echo, chorus, vibrato, and reverb-like effects.

| # | Abbr | Parameter | Units | Min | Max | Mod* | Description |
|--:|------|-----------|-------|-----|-----|:----:|-------------|
| 1 | MIX  | Mix       | %     | 0   | 100 | *    | Wet/dry balance |
| 2 | DLY  | Delay     | %     | 0   | 100 | *    | Delay time |
| 3 | SUS  | Sustain   | %     | 0   | 100 | *    | How long delay is sustained (warning: 100% causes build-up) |
| 4 | WOB  | Wobble    | %     | 0   | 100 | *    | Wobble caused by age/material imperfections in original hardware |
| 5 | TON  | Tone      | %     | 0   | 100 | *    | Delay tone control |

---

## DecimDelay (Decimator Delay) — type 34

Delay with a decimation unit in the chain. Reduces sampling frequency and bit-depth for lo-fi, aliasing, and gritty textures. 12 parameters.

| # | Abbr | Parameter | Units | Min   | Max    | Mod* | Description |
|--:|------|-----------|-------|-------|--------|:----:|-------------|
| 1 | MIX  | Mix       | %     | 0     | 100    | *    | Wet/dry balance |
| 2 | TIM  | Time      | ms    | 1.0   | 1500   |      | Master delay time (time-sync: 4 to 1/64 bars) |
| 3 | DSM  | Downsample| %     | 0     | 100    | *    | Sampling frequency reduction |
| 4 | FCL  | FactorL   | —     | —     | —      |      | Left delay as fraction: 1/4, 3/8, 1/2, 2/3, 1, 4/3, 3/2, 2, 3 |
| 5 | FCR  | FactorR   | —     | —     | —      |      | Right delay as fraction |
| 6 | BRC  | Bit-Reduce| —     | 24    | 1      |      | Bit-depth reduction (lower = grittier) |
| 7 | FC   | Cutoff    | Hz    | 30    | 20000  | *    | Filter cutoff frequency |
| 8 | RES  | Resonance | %     | 0     | 100    | *    | Filter resonance |
| 9 | FLT  | Type      | —     | —     | —      |      | Filter type: Lowpass, Highpass, Bandpass, Notch |
| 10| FBL  | FeedL     | %     | 0     | 100    | *    | Left channel feedback |
| 11| FBR  | FeedR     | %     | 0     | 100    | *    | Right channel feedback |
| 12| DMT  | Decimate  | —     | —     | —      |      | PRE (decimates input) or POST (decimates delay line only) |

---

## ModDlyRev (Mod, Delay & Reverb) — type 12

Three-in-one: delay + modulation + reverb. True-stereo delay with chorus, topped with 3 reverb models. 12 parameters.

| # | Abbr | Parameter | Units | Min   | Max    | Mod* | Description |
|--:|------|-----------|-------|-------|--------|:----:|-------------|
| 1 | TIM  | Time      | ms    | 1.0   | 1500   |      | Master delay time (time-sync: 4 to 1/64 bars) |
| 2 | FAC  | Factor    | —     | —     | —      |      | Delay fractions: 1, 1/2, 2/3, 3/2 |
| 3 | FBK  | Feedback  | %     | 0     | 100    | *    | Positive feedback |
| 4 | FHC  | FeedHC    | Hz    | 200   | 20000  | *    | High-cut filter in feedback path |
| 5 | DEP  | Depth     | %     | 0     | 100    | *    | Modulation depth |
| 6 | SPD  | Speed     | Hz    | 0.0   | 10     | *    | Modulation rate (time-sync: 4 to 1/64 bars) |
| 7 | MOD  | Mode      | —     | PAR   | SER    |      | PAR = parallel (effects applied independently); SER = serial (cascaded) |
| 8 | RTY  | Rtype     | —     | —     | —      |      | Reverb type: AMB (ambience), CLUB, HALL |
| 9 | DCY  | Decay     | —     | 1.0   | 10     | *    | Reverb dissipation time |
| 10| DMP  | Damping   | Hz    | 1000  | 20000  | *    | HF decay in reverb tail |
| 11| BAL  | Balance   | —     | -100  | 100    | *    | Delay ↔ reverb balance |
| 12| MIX  | Mix       | %     | 0     | 100    | *    | Overall wet/dry balance |

---

## Choosing a delay

| Want this...                    | Use this               | Why                                          |
|---------------------------------|------------------------|----------------------------------------------|
| Clean stereo delay              | Delay (type 13)        | Full L/R control, 4 feedback modes           |
| Rhythmic echoes                 | 3TapDelay (type 14)    | 3 independently timed/panned stages          |
| Complex polyrhythmic repeats    | 4TapDelay (type 15)    | 4 stages with independent timing             |
| Warm vintage character          | T-RayDelay (type 21)   | Only 5 params; Wobble adds analog charm      |
| Lo-fi / bit-crushed delay       | DecimDelay (type 34)   | Downsample + bit-reduce for grit             |
| Delay + reverb (save slots)    | ModDlyRev (type 12)    | 3-in-one with 3 reverb types                 |

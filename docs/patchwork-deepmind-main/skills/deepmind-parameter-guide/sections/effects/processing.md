# Processing Effects — Parameter Guide

> Source: DeepMind 12 Owner's Manual, pp. 97–98, 107–111 (§9.2–9.3)
> Parent: [effects.md](../effects.md)

## Overview

Eight processing effects for EQ, dynamics, distortion, stereo manipulation, and gating. These shape tone and dynamics rather than adding spatial or modulation effects. Parameters marked `*` are available as mod matrix destinations.

---

## MidasEQ (Midas Equalizer) — type 30

Four-band sweep parametric EQ from the Midas Pro X console. Low and high shelving bands plus two fully parametric mid bands with Q control. 11 parameters.

| # | Abbr | Parameter    | Units | Min   | Max    | Mod* | Description |
|--:|------|--------------|-------|-------|--------|:----:|-------------|
| 1 | LSG  | LoShelfGain  | dB    | -12   | 12     | *    | Low band gain |
| 2 | LSF  | LoShelfFreq  | Hz    | 30    | 20000  | *    | Low band frequency |
| 3 | LMG  | LoMidGain    | dB    | -12   | 12     | *    | Low-mid band gain |
| 4 | LMF  | LoMidFreq    | Hz    | 30    | 20000  | *    | Low-mid band frequency |
| 5 | LMQ  | LoMidQ       | —     | 0.3   | 5.0    | *    | Low-mid Q factor (bandwidth) |
| 6 | HMG  | HiMidGain    | dB    | -12   | 12     | *    | High-mid band gain |
| 7 | HMF  | HiMidFreq    | Hz    | 30    | 20000  | *    | High-mid band frequency |
| 8 | HMQ  | HiMidQ       | —     | 0.3   | 5.0    | *    | High-mid Q factor (bandwidth) |
| 9 | HSG  | HiShelfGain  | dB    | -12   | 12     | *    | High band gain |
| 10| HSF  | HiShelfFreq  | Hz    | 30    | 20000  | *    | High band frequency |
| 11| EQ   | EQ           | —     | IN    | OUT    | *    | EQ in/out bypass |

---

## Enhancer (Enhancing EQ) — type 18

SPL Vitalizer-inspired "psycho EQ." Enhances bass, mid, and high frequencies using psychoacoustic processing rather than traditional EQ — adds punch, clarity, and detail without increasing overall volume. 9 parameters.

| # | Abbr | Parameter | Units | Min   | Max    | Mod* | Description |
|--:|------|-----------|-------|-------|--------|:----:|-------------|
| 1 | OGN  | OutGain   | dB    | -12   | 12     | *    | Output gain compensation |
| 2 | SPR  | Spread    | %     | 0     | 100    | *    | Stereo content emphasis |
| 3 | BGN  | BassGain  | %     | 0     | 100    | *    | Bass band gain |
| 4 | BFR  | BassFreq  | —     | 1.0   | 50     | *    | Bass band frequency |
| 5 | MGN  | MidGain   | %     | 0     | 100    | *    | Mid band gain |
| 6 | MIQ  | MidQ      | —     | 1.0   | 50     | *    | Mid band Q factor (bandwidth) |
| 7 | HIG  | HiGain    | %     | 0     | 100    | *    | High band gain |
| 8 | HIF  | HiFreq    | —     | 1.0   | 50     | *    | High band frequency |
| 9 | SOL  | Solo      | —     | OFF   | ON     |      | Isolate only the effect output (hear what you're adding) |

---

## FairComp (Fairchild Compressor) — type 31

Fairchild 670 model with dual-path compression (L/M and R/S). Modes for stereo-linked, dual-channel, or mid/side operation. 12 parameters.

| # | Abbr | Parameter   | Units | Min  | Max  | Mod* | Description |
|--:|------|-------------|-------|------|------|:----:|-------------|
| 1 | MOD  | Mode        | —     | —    | —    |      | Off, Stereo, Dual, M/S (mid/side) |
| 2 | INL  | InGain L/M  | —     | -20  | 0    | *    | Input gain for Left/Mid signal |
| 3 | THL  | Thresh L/M  | —     | 0    | 10   | *    | Threshold for Left/Mid |
| 4 | TML  | Time L/M    | —     | 1.0  | 6.0  |      | Attack/release time for Left/Mid |
| 5 | DCL  | DCBias L/M  | %     | 0    | 100  | *    | Ratio/knee of compression curve for Left/Mid |
| 6 | OGL  | OutGain L/M | dB    | -18  | 6    | *    | Output gain for Left/Mid |
| 7 | BAL  | Bias Bal    | %     | -100 | 100  | *    | Bias current balance (accentuates attacks) |
| 8 | INR  | InGain R/S  | —     | -20  | 0    | *    | Input gain for Right/Side signal |
| 9 | THR  | Thresh R/S  | —     | 0    | 10   | *    | Threshold for Right/Side |
| 10| TMR  | Time R/S    | —     | 1.0  | 6.0  |      | Attack/release time for Right/Side |
| 11| DCR  | DCBias R/S  | %     | 0    | 100  | *    | Ratio/knee for Right/Side |
| 12| OGR  | OutGain R/S | dB    | -18  | 6    | *    | Output gain for Right/Side |

---

## MulBndDist (Multiband Distortion) — type 32

Three-band distortion with independently adjustable drive per band, 6 distortion types, and 11 cabinet emulations. 12 parameters.

| # | Abbr | Parameter    | Units | Min  | Max    | Mod* | Description |
|--:|------|--------------|-------|------|--------|:----:|-------------|
| 1 | IPG  | InputGain    | dB    | -24  | 24     | *    | Input gain |
| 2 | DST  | DistType     | —     | —    | —      |      | VAL (valve), SAT (saturation), TUB (tube), PFV/PFS/PFT (post-filter variants) |
| 3 | LBL  | Low Level    | dB    | -12  | 12     | *    | Level of frequencies below Xover 1 |
| 4 | LDR  | Low Drive    | %     | 0    | 100    | *    | Distortion below Xover 1 |
| 5 | XV1  | Xover Freq 1 | Hz    | 30   | 9000   | *    | Lower crossover frequency |
| 6 | MBL  | Mid Level    | dB    | -12  | 12     | *    | Level between Xover 1 and 2 |
| 7 | MDR  | Mid Drive    | %     | 0    | 100    | *    | Distortion between Xover 1 and 2 |
| 8 | XV2  | Xover Freq 2 | Hz    | 30   | 9000   | *    | Upper crossover frequency |
| 9 | HBL  | High Level   | dB    | -12  | 12     | *    | Level above Xover 2 |
| 10| HDR  | High Drive   | %     | 0    | 100    | *    | Distortion above Xover 2 |
| 11| CAB  | Cabinet      | —     | —    | —      |      | OFF, VTw, VBs, A10, Mid, BFC, B60, V30, S78, Oax, A12, Rck |
| 12| OPG  | OutputGain   | dB    | -12  | 12     | *    | Output gain |

### Distortion types (param 2)

| Abbr | Type              | Character |
|------|-------------------|-----------|
| VAL  | Valve             | Warm tube saturation |
| SAT  | Saturation        | Soft saturation |
| TUB  | Tube              | Stronger tube distortion |
| PFV  | Post-Filter Valve | Valve + post filter |
| PFS  | Post-Filter Sat   | Saturation + post filter |
| PFT  | Post-Filter Tube  | Tube + post filter |

---

## RackAmp (Rack Amplifier) — type 7

Tech 21 SansAmp model. Guitar amp simulation from shimmering cleans to saturated crunch. Band-specific distortion controls. 9 parameters.

| # | Abbr | Parameter | Units | Min | Max  | Mod* | Description |
|--:|------|-----------|-------|-----|------|:----:|-------------|
| 1 | PRE  | PreAmp    | —     | 0.0 | 10   | *    | Input gain before distortion |
| 2 | BUZ  | Buzz      | —     | 0.0 | 10   | *    | Low-end breakup |
| 3 | PNC  | Punch     | —     | 0.0 | 10   | *    | Midrange distortion |
| 4 | CRN  | Crunch    | —     | 0.0 | 10   | *    | High-frequency content and distortion |
| 5 | DRV  | Drive     | —     | 0.0 | 10   | *    | Power amp distortion (tube amp emulation) |
| 6 | LVL  | Level     | —     | 0.0 | 10   | *    | Overall output level |
| 7 | LOW  | Low       | —     | 0.0 | 10   | *    | Low EQ (independent of distortion) |
| 8 | HI   | High      | —     | 0.0 | 10   | *    | High EQ (independent of distortion) |
| 9 | CAB  | Cabinet   | —     | OFF | ON   |      | Cabinet simulation on/off (OFF = works like a boost/distortion pedal) |

---

## EdisonEX1 (Stereo Imaging) — type 19

Edison EX-1 stereo field manipulator. Supports stereo and mid/side input/output modes. 8 parameters.

| # | Abbr | Parameter | Units | Min  | Max  | Mod* | Description |
|--:|------|-----------|-------|------|------|:----:|-------------|
| 1 | ON   | On        | —     | OFF  | ON   |      | Effect on/off |
| 2 | IMD  | InMode    | —     | ST   | M/S  |      | Input mode (stereo or mid/side) |
| 3 | OMD  | OutMode   | —     | ST   | M/S  |      | Output mode (stereo or mid/side) |
| 4 | STS  | StSpread  | —     | -50  | 50   | *    | Stereo field spread |
| 5 | LMF  | LMFSpread | —     | -50  | 50   | *    | Low/mid frequency spread |
| 6 | BAL  | Balance   | —     | -50  | 50   | *    | Mono to stereo content ratio |
| 7 | CNT  | CntrDist  | —     | -50  | 50   | *    | Mono content panning |
| 8 | GN   | Gain      | dB    | -12  | 12   | *    | Output gain compensation |

---

## Auto Pan (Auto-Panning / Tremolo) — type 20

LFO-based volume modulation with envelope control. Phase offset creates panning between L/R channels. 9 parameters.

| # | Abbr | Parameter | Units | Min  | Max   | Mod* | Description |
|--:|------|-----------|-------|------|-------|:----:|-------------|
| 1 | SPD  | Speed     | Hz    | 0.0  | 5.0   | *    | LFO rate (time-sync: 4 to 1/64 bars) |
| 2 | PHS  | Phase     | —     | 0.0  | 180   | *    | LFO phase difference between L/R (creates panning) |
| 3 | WAV  | Wave      | —     | -50  | 50    | *    | LFO shape: triangular ↔ square |
| 4 | DEP  | Depth     | %     | 0    | 100   | *    | Modulation amount |
| 5 | ESP  | EnvSpd    | %     | 0    | 100   | *    | Envelope → LFO speed modulation |
| 6 | EDP  | EnvDepth  | %     | 0    | 100   | *    | Envelope modulation depth |
| 7 | ATK  | Attack    | ms    | 10   | 1000  | *    | Envelope attack time |
| 8 | HLD  | Hold      | ms    | 1.0  | 2000  | *    | Envelope hold time |
| 9 | REL  | Release   | ms    | 10   | 1000  | *    | Envelope release time |

---

## NoiseGate (Noise Gate) — type 33

Gate with transient enhancement capabilities. Can add up to 12 dB of transient energy. Three modes including ducker. 8 parameters.

| # | Abbr | Parameter | Units | Min   | Max    | Mod* | Description |
|--:|------|-----------|-------|-------|--------|:----:|-------------|
| 1 | THR  | Threshold | dB    | -50   | 0      | *    | Signal level at which gate opens |
| 2 | RNG  | Range     | dB    | -100  | 0      | *    | Gain reduction applied below threshold |
| 3 | ATT  | Attack    | ms    | 0.0   | 20     | *    | Time for gate to open (exponential — extremely fast possible) |
| 4 | REL  | Release   | ms    | 2.0   | 1999.9 | *    | Time for gate to close (reverse exponential — fast yet smooth) |
| 5 | HLD  | Hold      | ms    | 2.0   | 1999.9 | *    | Wait period before gate starts to close |
| 6 | PUN  | Punch     | —     | -6.0  | 6.0    | *    | Transient shaping (+dB adds attack energy, -dB reduces) |
| 7 | MOD  | Mode      | —     | —     | —      |      | GAT (gate), TRN (transient gate), DUC (ducker) |
| 8 | PWR  | Power     | —     | ON    | OFF    |      | Gate in signal path (OFF = bypassed) |

---

## Choosing a processing effect

| Want this...                    | Use this               | Why                                          |
|---------------------------------|------------------------|----------------------------------------------|
| Surgical EQ                    | MidasEQ (type 30)      | 4-band parametric with Q control             |
| Psychoacoustic enhancement     | Enhancer (type 18)     | Adds punch/clarity without volume increase   |
| Vintage compression            | FairComp (type 31)     | Dual-path Fairchild 670; stereo/dual/M-S     |
| Gritty distortion / warmth    | MulBndDist (type 32)   | 3-band + 6 dist types + cabinet sims         |
| Amp simulation                 | RackAmp (type 7)       | SansAmp model; cleans to crunch              |
| Stereo field manipulation      | EdisonEX1 (type 19)    | Spread, balance, mid/side processing         |
| Auto-pan / tremolo             | Auto Pan (type 20)     | LFO + envelope for dynamic panning           |
| Noise control / transients     | NoiseGate (type 33)    | Gate + up to 12 dB transient enhancement     |

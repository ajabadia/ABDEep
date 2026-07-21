# DeepMind 12 — NRPN + Global Commands (cleaned extract)

This file is a cleaned/structured version of the DeepMind documentation snippets you pasted.
The goal is to make it easy to:

- scan manually
- copy/paste reliably
- parse later for driver generation

## NRPN overview

NRPN (Non-Registered Parameter Numbers) are a special type of MIDI communication that allows control of parameters not defined in the basic MIDI standard.

## NRPN message format

An NRPN update is a controller-message sequence:

- `CC 99` (`0x63`) — NRPN parameter number MSB (`aa`)
- `CC 98` (`0x62`) — NRPN parameter number LSB (`bb`)
- `CC 6` (`0x06`) — Data Entry MSB (`cc`) *(optional; can be ignored for switch params or ranges ≤ 0–127)*
- `CC 38` (`0x26`) — Data Entry LSB (`dd`)

Running-status note (verbatim intent from excerpt):

```text
B0, 63, aa, 62, bb, 06, cc, 26, dd
```

Reuse note (verbatim intent from excerpt):

> Once the NRPN parameter ID has been selected with the first two messages, if the previously selected parameter is changed again (e.g., moving a single control), then the first two messages can be omitted, leaving just the Data Entry LSB & MSB messages.

Interface note (verbatim intent from excerpt):

> The DeepMind 12 treats NRPNs from USB, Wi‑Fi, and the physical MIDI ports separately (it has a “selected NRPN parameter” for each interface).

## NRPN mapping table

Columns:

- **NRPN** = computed 14-bit parameter number = `(MSB << 7) + LSB`
- **Value range** = the “Range” column from the excerpt

| MSB | LSB | NRPN | Parameter | Value range | Notes |
|---:|---:|---:|---|---|---|
| 0 | 0 | 0 | LFO 1 Rate | 0–255 | — |
| 0 | 1 | 1 | LFO 1 Delay / Fade | 0–255 | — |
| 0 | 2 | 2 | LFO 1 Shape | 0–6 | Sine (0), Triangle (1), Square (2), Ramp Up (3), Ramp Down (4), Sample & Hold (5), Sample & Glide (6) |
| 0 | 3 | 3 | LFO 1 Key Sync | 0–1 | Off (0), On (1) |
| 0 | 4 | 4 | LFO 1 Arp Sync | 0–1 | Off (0), On (1) |
| 0 | 5 | 5 | LFO 1 Mono Mode | 0–255 | Poly (0), Mono (1), or SPREAD-1 (2) … SPREAD-254 (255) |
| 0 | 6 | 6 | LFO 1 Slew Rate | 0–255 | — |
| 0 | 7 | 7 | LFO 2 Rate | 0–255 | — |
| 0 | 8 | 8 | LFO 2 Delay / Fade | 0–255 | — |
| 0 | 9 | 9 | LFO 2 Shape | 0–6 | Sine (0), Triangle (1), Square (2), Ramp Up (3), Ramp Down (4), Sample & Hold (5), Sample & Glide (6) |
| 0 | 10 | 10 | LFO 2 Key Sync | 0–1 | Off (0), On (1) |
| 0 | 11 | 11 | LFO 2 Arp Sync | 0–1 | Off (0), On (1) |
| 0 | 12 | 12 | LFO 2 Mono Mode | 0–255 | Poly (0), Mono (1), or SPREAD-1 (2) … SPREAD-254 (255) |
| 0 | 13 | 13 | LFO 2 Slew Rate | 0–255 | — |
| 0 | 14 | 14 | OSC 1 Range | 0–2 | 16' (0), 8' (1), 4' (2) |
| 0 | 15 | 15 | OSC 2 Range | 0–2 | 16' (0), 8' (1), 4' (2) |
| 0 | 16 | 16 | OSC 1 PWM Source | 0–5 | Manual (0), LFO 1 (1), LFO 2 (2), VCA Env (3), VCF Env (4), Mod Env (5) |
| 0 | 17 | 17 | OSC 2 Tone Mod Source | 0–5 | Manual (0), LFO 1 (1), LFO 2 (2), VCA Env (3), VCF Env (4), Mod Env (5) |
| 0 | 18 | 18 | OSC 1 Pulse Enable | 0–1 | Off (0), On (1) |
| 0 | 19 | 19 | OSC 1 Saw Enable | 0–1 | Off (0), On (1) |
| 0 | 20 | 20 | OSC Sync Enable | 0–1 | Off (0), On (1) |
| 0 | 21 | 21 | OSC 1 Pitch Mod Depth | 0–255 | — |
| 0 | 22 | 22 | OSC 1 Pitch Mod Select | 0–6 | LFO 1 (0), LFO 2 (1), VCA Env (2), VCF Env (3), Mod Env (4), LFO 1 Unipolar (5), LFO 2 Unipolar (6) |
| 0 | 23 | 23 | OSC 1 Aftertouch > Pitch Mod Depth | 0–255 | — |
| 0 | 24 | 24 | OSC 1 Mod Wheel > Pitch Mod Depth | 0–255 | — |
| 0 | 25 | 25 | OSC 1 PWM Depth | 0–255 | — |
| 0 | 26 | 26 | OSC 2 Level | 0–255 | — |
| 0 | 27 | 27 | OSC 2 Pitch | 0–255 | — |
| 0 | 28 | 28 | OSC 2 Tone Mod Depth | 0–255 | — |
| 0 | 29 | 29 | OSC 2 Pitch Mod Depth | 0–255 | — |
| 0 | 30 | 30 | OSC 2 Aftertouch > Pitch Mod Depth | 0–255 | — |
| 0 | 31 | 31 | OSC 2 Mod Wheel > Pitch Mod Depth | 0–255 | — |
| 0 | 32 | 32 | OSC 2 Pitch Mod Select | 0–6 | LFO 1 (0), LFO 2 (1), VCA Env (2), VCF Env (3), Mod Env (4), LFO 1 Unipolar (5), LFO 2 Unipolar (6) |
| 0 | 33 | 33 | Noise Level | 0–255 | — |
| 0 | 34 | 34 | Portamento time | 0–255 | — |
| 0 | 35 | 35 | Portamento mode | 0–13 | Normal (0), Fingered (1), Fixed Rate (2), Fixed Rate Fingered (3), Exponential (4), Exponential Fingered (5), Fixed +2 (6), Fixed -2 (7), Fixed +5 (8), Fixed -5 (9), Fixed +12 (10), Fixed -12 (11), Fixed +24 (12), Fixed -24 (13) |
| 0 | 36 | 36 | Pitch bend Up depth | 0–24 | In steps of 1 semitone |
| 0 | 37 | 37 | Pitch bend Down depth | 0–24 | In steps of 1 semitone |
| 0 | 38 | 38 | OSC 1 Pitch Mod Mode | 0–1 | 0 (OSC1+2), 1 (OSC 1 Only) |
| 0 | 39 | 39 | VCF Frequency | 0–255 | — |
| 0 | 40 | 40 | VCF HighPass Frequency | 0–255 | — |
| 0 | 41 | 41 | VCF Resonance | 0–255 | — |
| 0 | 42 | 42 | VCF Envelope Depth | 0–255 | — |
| 0 | 43 | 43 | VCF Envelope Velocity Sensitivity | 0–255 | — |
| 0 | 44 | 44 | VCF Pitch Bend to Freq Depth | 0–255 | — |
| 0 | 45 | 45 | VCF LFO Depth | 0–255 | — |
| 0 | 46 | 46 | VCF LFO Select | 0–1 | LFO 1 (0), LFO 2 (1) |
| 0 | 47 | 47 | VCF Aftertouch > LFO Depth | 0–255 | — |
| 0 | 48 | 48 | VCF Mod Wheel > LFO Depth | 0–255 | — |
| 0 | 49 | 49 | VCF Keyboard Tracking | 0–255 | — |
| 0 | 50 | 50 | VCF Envelope Polarity | 0–1 | Negative (0), Positive (1) |
| 0 | 51 | 51 | VCF 2 Pole Mode | 0–1 | 4 Pole (0), 2 Pole (1) |
| 0 | 52 | 52 | VCF Bass Boost | 0–1 | Off (0), On (1) |
| 0 | 53 | 53 | VCA Envelope Attack Time | 0–255 | — |
| 0 | 54 | 54 | VCA Envelope Decay Time | 0–255 | — |
| 0 | 55 | 55 | VCA Envelope Sustain Level | 0–255 | — |
| 0 | 56 | 56 | VCA Envelope Release Time | 0–255 | — |
| 0 | 57 | 57 | VCA Envelope Trigger Mode | 0–4 | Key (0), LFO 1 (1), LFO 2 (2), Loop (3), Control Sequencer Step (4) |
| 0 | 58 | 58 | VCA Envelope Attack Curve | 0–255 | — |
| 0 | 59 | 59 | VCA Envelope Decay Curve | 0–255 | — |
| 0 | 60 | 60 | VCA Envelope Sustain Curve | 0–255 | — |
| 0 | 61 | 61 | VCA Envelope Attack Curve *(duplicate in excerpt)* | 0–255 | — |
| 0 | 62 | 62 | VCF Envelope Attack Time | 0–255 | — |
| 0 | 63 | 63 | VCF Envelope Decay Time | 0–255 | — |
| 0 | 64 | 64 | VCF Envelope Sustain Level | 0–255 | — |
| 0 | 65 | 65 | VCF Envelope Release Time | 0–255 | — |
| 0 | 66 | 66 | VCF Envelope Trigger Mode | 0–4 | Key (0), LFO 1 (1), LFO 2 (2), Loop (3), Control Sequencer Step (4) |
| 0 | 67 | 67 | VCF Envelope Attack Curve | 0–255 | — |
| 0 | 68 | 68 | VCF Envelope Decay Curve | 0–255 | — |
| 0 | 69 | 69 | VCF Envelope Sustain Curve | 0–255 | — |
| 0 | 70 | 70 | VCF Envelope Attack Curve *(duplicate in excerpt)* | 0–255 | — |
| 0 | 71 | 71 | Mod Envelope Attack Time | 0–255 | — |
| 0 | 72 | 72 | Mod Envelope Decay Time | 0–255 | — |
| 0 | 73 | 73 | Mod Envelope Sustain Level | 0–255 | — |
| 0 | 74 | 74 | Mod Envelope Release Time | 0–255 | — |
| 0 | 75 | 75 | Mod Envelope Trigger Mode | 0–4 | Key (0), LFO 1 (1), LFO 2 (2), Loop (3), Control Sequencer Step (4) |
| 0 | 76 | 76 | Mod Envelope Attack Curve | 0–255 | — |
| 0 | 77 | 77 | Mod Envelope Decay Curve | 0–255 | — |
| 0 | 78 | 78 | Mod Envelope Sustain Curve | 0–255 | — |
| 0 | 79 | 79 | Mod Envelope Attack Curve *(duplicate in excerpt)* | 0–255 | — |
| 0 | 80 | 80 | VCA Level | 0–255 | — |
| 0 | 81 | 81 | VCA Envelope Depth | 0–255 | — |
| 0 | 82 | 82 | VCA Envelope Velocity Sensitivity | 0–255 | — |
| 0 | 83 | 83 | VCA Pan Spread | 0–255 | -128 (0) to +127 (255) |
| 0 | 84 | 84 | Voice Priority Mode | 0–2 | Lowest (0), Highest (1), Last (2) |
| 0 | 85 | 85 | Polyphony Mode | 0–12 | Poly (0), Unison 2 (1), Unison 3 (2), Unison 4 (3), Unison 6 (4), Unison 12 (5), Mono (6), Mono 2 (7), Mono 3 (8), Mono 4 (9), Mono 6 (10), Poly 6 (11), Poly 8 (12) |
| 0 | 86 | 86 | Envelope Trigger Mode | 0–3 | Mono (0), Re-Trigger (1), Legato (2), One-Shot (3) |
| 0 | 87 | 87 | Unison Detune | 0–255 | Sets the amount phatness! |
| 0 | 88 | 88 | Voice Drift | 0–255 | — |
| 0 | 89 | 89 | Parameter Drift | 0–255 | — |
| 0 | 90 | 90 | Drift Rate | 0–255 | — |
| 0 | 91 | 91 | OSC Portamento Balance | 0–255 | -128 (0) to +127 (255) |
| 0 | 92 | 92 | OSC Key Down Reset | 0–1 | Off (0), On (1) |
| 0 | 93 | 93 | Mod 1 Source | 0–22 | See Modulation Matrix Source List |
| 0 | 94 | 94 | Mod 1 Destination | 0–129 | See Modulation Matrix Destination List |
| 0 | 95 | 95 | Mod 1 Depth | 0–255 | -128 (0) to +127 (255) |
| 0 | 96 | 96 | Mod 2 Source | 0–22 | See Modulation Matrix Source List |
| 0 | 97 | 97 | Mod 2 Destination | 0–129 | See Modulation Matrix Destination List |
| 0 | 98 | 98 | Mod 2 Depth | 0–255 | -128 (0) to +127 (255) |
| 0 | 99 | 99 | Mod 3 Source | 0–22 | See Modulation Matrix Source List |
| 0 | 100 | 100 | Mod 3 Destination | 0–129 | See Modulation Matrix Destination List |
| 0 | 101 | 101 | Mod 3 Depth | 0–255 | -128 (0) to +127 (255) |
| 0 | 102 | 102 | Mod 4 Source | 0–22 | See Modulation Matrix Source List |
| 0 | 103 | 103 | Mod 4 Destination | 0–129 | See Modulation Matrix Destination List |
| 0 | 104 | 104 | Mod 4 Depth | 0–255 | -128 (0) to +127 (255) |
| 0 | 105 | 105 | Mod 5 Source | 0–22 | See Modulation Matrix Source List |
| 0 | 106 | 106 | Mod 5 Destination | 0–129 | See Modulation Matrix Destination List |
| 0 | 107 | 107 | Mod 5 Depth | 0–255 | -128 (0) to +127 (255) |
| 0 | 108 | 108 | Mod 6 Source | 0–22 | See Modulation Matrix Source List |
| 0 | 109 | 109 | Mod 6 Destination | 0–129 | See Modulation Matrix Destination List |
| 0 | 110 | 110 | Mod 6 Depth | 0–255 | -128 (0) to +127 (255) |
| 0 | 111 | 111 | Mod 7 Source | 0–22 | See Modulation Matrix Source List |
| 0 | 112 | 112 | Mod 7 Destination | 0–129 | See Modulation Matrix Destination List |
| 0 | 113 | 113 | Mod 7 Depth | 0–255 | -128 (0) to +127 (255) |
| 0 | 114 | 114 | Mod 8 Source | 0–22 | See Modulation Matrix Source List |
| 0 | 115 | 115 | Mod 8 Destination | 0–129 | See Modulation Matrix Destination List |
| 0 | 116 | 116 | Mod 8 Depth | 0–255 | -128 (0) to +127 (255) |
| 0 | 117 | 117 | Ctrl Sequencer Enable | 0–1 | Off (0), On (1) |
| 0 | 118 | 118 | Ctrl Sequencer Clock Divider | 0–15 | See Control Sequencer divider table |
| 0 | 119 | 119 | Sequence Length | 0–31 | 1 (0) to 32 (31) steps |
| 0 | 120 | 120 | Sequencer Swing Timing | 0–25 | 50% (0) to 75% (25) |
| 0 | 121 | 121 | Key Sync & Loop | 0–2 | Loop On (0), Key Sync On (1), Loop & Key Sync On (2) |
| 0 | 122 | 122 | Slew Rate | 0–255 | — |
| 0 | 123 | 123 | Seq Step Value 1 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 0 | 124 | 124 | Seq Step Value 2 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 0 | 125 | 125 | Seq Step Value 3 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 0 | 126 | 126 | Seq Step Value 4 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 0 | 127 | 127 | Seq Step Value 5 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 0 | 128 | Seq Step Value 6 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 1 | 129 | Seq Step Value 7 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 2 | 130 | Seq Step Value 8 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 3 | 131 | Seq Step Value 9 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 4 | 132 | Seq Step Value 10 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 5 | 133 | Seq Step Value 11 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 6 | 134 | Seq Step Value 12 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 7 | 135 | Seq Step Value 13 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 8 | 136 | Seq Step Value 14 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 9 | 137 | Seq Step Value 15 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 10 | 138 | Seq Step Value 16 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 11 | 139 | Seq Step Value 17 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 12 | 140 | Seq Step Value 18 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 13 | 141 | Seq Step Value 19 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 14 | 142 | Seq Step Value 20 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 15 | 143 | Seq Step Value 21 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 16 | 144 | Seq Step Value 22 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 17 | 145 | Seq Step Value 23 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 18 | 146 | Seq Step Value 24 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 19 | 147 | Seq Step Value 25 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 20 | 148 | Seq Step Value 26 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 21 | 149 | Seq Step Value 27 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 22 | 150 | Seq Step Value 28 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 23 | 151 | Seq Step Value 29 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 24 | 152 | Seq Step Value 30 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 25 | 153 | Seq Step Value 31 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 26 | 154 | Seq Step Value 32 | 0–255 | Bipolar step value -127 (1) … +127 (255). Value 0 = “skip step”. |
| 1 | 27 | 155 | Arp On/Off | 0–1 | Off (0), On (1) |
| 1 | 28 | 156 | Arp Mode | 0–10 | Up (0), Down (1), Up&Down (2), Up Inv (3), Down Inv (4), Up&Down Inv (5), Up Alt (6), Down Alt (7), Random (8), As Played (9), Chord (10) |
| 1 | 29 | 157 | Arp Rate (tempo) | 0–255 | 20 bpm (0) to 275 bpm (255) |
| 1 | 30 | 158 | Arp Clock | 0–12 | See Arpeggiator clock divider table |
| 1 | 31 | 159 | Arp Key Sync | 0–1 | Off (0), On (1) |
| 1 | 32 | 160 | Arp Gate Time | 0–255 | — |
| 1 | 33 | 161 | Arp Hold | 0–1 | Off (0), On (1) |
| 1 | 34 | 162 | Arp Pattern | 0–64 | None (0), Preset-1 (1) … User-1 (33) … User-32 (64) |
| 1 | 35 | 163 | Arp Swing | 0–25 | 50% (0) to 75% (25) |
| 1 | 36 | 164 | Arp Octaves | 0–5 | 1 to 6 octaves |
| 1 | 37 | 165 | FX Routing | 0–9 | FX connection modes (manual labels; spot-checked live and confirmed order matches values 0..9): M-1 Serial 1-2-3-4, M-2 Parallel 1/2 Serial 3-4, M-3 Parallel 1/2 Parallel 3/4, M-4 Parallel 1/2/3/4, M-5 Parallel 1/2/3 Serial 4, M-6 Serial 1-2 Parallel 3/4, M-7 Serial 1 Parallel 2/3/4, M-8 Parallel (Serial 1-2-3)/4, M-9 Serial 3-4 Feedback(1-2), M-10 Serial 4 Feedback(1-2-3) |
| 1 | 38 | 166 | FX 1 Type | 0–35 | See FX Type list (manual). Note: values are not ordered like the printed list. |
| 1 | 39–50 | 167–178 | FX 1 Params | 0–255 | FX Slot 1 parameters (per-effect mapping) |
| 1 | 51 | 179 | FX 2 Type | 0–35 | Same enum mapping as FX 1 Type. Note: values are not ordered like the printed list. |
| 1 | 52–63 | 180–191 | FX 2 Params | 0–255 | FX Slot 2 parameters (per-effect mapping) |
| 1 | 64 | 192 | FX 3 Type | 0–35 | Same enum mapping as FX 1 Type. Note: values are not ordered like the printed list. |
| 1 | 65–76 | 193–204 | FX 3 Params | 0–255 | FX Slot 3 parameters (per-effect mapping) |
| 1 | 77 | 205 | FX 4 Type | 0–35 | Same enum mapping as FX 1 Type. Note: values are not ordered like the printed list. |
| 1 | 78–89 | 206–217 | FX 4 Params | 0–255 | FX Slot 4 parameters (per-effect mapping) |
| 1 | 90 | 218 | FX 1 Output Gain | 0–150 | — |
| 1 | 91 | 219 | FX 2 Output Gain | — | — |
| 1 | 92 | 220 | FX 3 Output Gain | — | — |
| 1 | 93 | 221 | FX 4 Output Gain | 0–150 | Output gain for FX slots 1–4 |
| 1 | 94 | 222 | FX Mode | 0–2 | Insert (0), Send (1), Bypass (2) |
| 1 | 95–111 | 223–239 | Program Name | 0–127 | Null-terminated program name, 16(+1) char ASCII string |
| 1 | 112 | 240 | Program Category | 0–16 | See program category table |

## Global commands

| Parameter | Range | Description |
|---|---:|---|
| MIDI Channel | 0–16 | Sets MIDI Rx/Tx channel. 0 = All, 1 = Ch1 … 16 = Ch16 |
| Keyboard Local | 0–1 | Sets keyboard/mod/pitch wheels “local” mode: controls synth (1) vs only sends MIDI (0) |
| Fader Local | 0–1 | Sets fader local mode: faders control synth (1) vs only send MIDI (0) |
| Global Tune | 0–255 | 0 = -128 cents, 128 = 0 cents, 255 = +127 cents |
| MIDI Clock Source | 0–2 | Sets source for Arp clock: MenuItemMidiClock_e (Internal, MIDI, USB) |
| MIDI Program Change Mode | 0–2 | Receives vs sends Program Changes or both: MenuItemProgramChangeMode_e (Rx, Tx, Both) |
| USB Control mode | 0–2 | USB sends CC (soft-synth control) vs NRPN (iOS app) — set automatically when an App Notify message is received |
| MIDI Control mode | 0–2 | MIDI sends CC (control another synth) vs NRPN (VST app) — set automatically when an App Notify message is received |
| MIDI Soft Thru | 0–1 | Forwards MIDI In to MIDI Out (Off, On) |
| USB to MIDI | 0–1 | Forwards USB to MIDI Out (Off, On) |
| MIDI to USB | 0–1 | Forwards MIDI In to USB (Off, On) |
| Fixed Velocity | 0–1 | Keyboard sends fixed (1) vs dynamic (0) velocity on Note On |
| Velocity | 0–127 | Velocity sent when in fixed mode |
| Velocity Curve | 0–127 | (-64 … +63 TBD) curve for converting key velocity to MIDI note velocity |
| Transpose | 0–96 | (-48 … 48) keyboard transpose (affects local & MIDI operation) |
| Aftertouch Curve | 0–127 | (-64 … +63 TBD) curve for converting key pressure to MIDI aftertouch |
| Pedal CC | 0–3 | Foot controller pedal MIDI CC: Foot Control (CC4), Breath (CC3), Volume (CC7), Expression (CC11) |
| Sustain CC | 0–3 | Sustain pedal polarity/function: Normal+, Normal-, Arp(+), Arp(-) |
| Fader Pick Up Mode | 0–2 | Fader pickup mode: Relative, Pass-thru, Jump |
| LCD Brightness | 0–9 | LCD brightness in 10% steps (10% to 100%) |
| LCD Contrast | 0–9 | LCD contrast in 10% steps |
| Arp Send to MIDI | 0–1 | Enables transmission of arpeggiator output to MIDI out (USB and physical MIDI) |
| Send NRPN on load | 0–2 | (May be removed) dumps NRPN values when a new program is loaded (mainly for ctrlr): MenuItemSendNrpnOnLoad_e (OMIDI, USB) |
| Keyboard Octave | 0–7 | Octave shift for keyboard. At 0, left-most key is C0 |
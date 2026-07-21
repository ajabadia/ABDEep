# Global Settings — Parameter Guide

> Source: DeepMind 12 Owner's Manual, §7.3 Global Menu (pp. 26–36)

## What this controls

The Global menu contains **system-wide settings** that persist across
programs and power cycles. These are **not per-program parameters** —
they have no NRPNs and cannot be set via `set_param`. They are
configured directly on the hardware via the GLOBAL button.

This section exists as a reference so agents know _what is configurable_
and can advise users, even though the settings cannot be automated.

## Connectivity (§7.3.1)

Three independent transport interfaces (MIDI DIN, USB, WiFi), each with
identical options:

| Setting       | Options                           | Default | Notes                              |
|---------------|-----------------------------------|---------|------------------------------------|
| CTRL mode     | Off / CC / NRPN                   | —       | Sets what the synth **transmits**. Both CC and NRPN are always **received**. |
| PROG-CHANGE   | RX / TX / RX-TX / None            | —       | Program change direction. Not available when Poly Chain is on. |
| RX-CHANNEL    | All / 1–16                        | —       | MIDI receive channel              |
| TX-CHANNEL    | 1–16 / RxCh                       | —       | MIDI transmit channel             |

Each transport also has SOFT-THRU / pass-thru settings to forward
messages between interfaces (e.g., MIDI→USB-THRU, USB→WiFi-THRU).

**Network settings** (WiFi): Off / Client / Access Point modes, SSID,
password, IP, channel. Used for the DeepMind iOS app.

**SysEx Export**: Dump programs, banks, patterns, global settings,
calibration data, chords, and favourites via MIDI/USB/WiFi.

**Device ID**: 1–16. Used for SysEx addressing when multiple units are
present.

## Keyboard Settings (§7.3.2)

| Setting       | Options                         | Default | Notes                              |
|---------------|---------------------------------|---------|------------------------------------|
| LOCAL          | On / Off                       | On      | Disconnects local keyboard/wheels from sound engine. Useful for DAW setups. |
| OCTAVE         | −2 to +2                       | 0       | Shifts keyboard pitch ±2 octaves. Same as OCT UP/DOWN buttons. |
| FIXED-ON-VEL   | Off / 0–127                    | Off     | Overrides note-on velocity to a fixed value. |
| FIXED-OFF-VEL  | Off / 0–127                    | Off     | Overrides note-off velocity to a fixed value. Off-velocity is only usable as a mod matrix source. |
| VEL CURVE      | Soft / Med / Hard              | Soft    | Response curve for strike velocity. Soft = wider dynamic range. |
| AFT-CURVE      | Soft / Med / Hard              | Soft    | Response curve for aftertouch pressure. Soft = wider dynamic range. |
| WHEEL-LEDS     | Auto / On / Off                | Auto    | LED illumination mode for pitch and mod wheels. |

## Pedal Settings (§7.3.3)

### Expression pedal (TRS jack)

| Setting | Options | Default | Notes |
|---------|---------|---------|-------|
| PEDAL   | Foot-Ctrl / Mod-Wheel / Breath / Volume / Expression / Porta Time / Aftertouch | Foot-Ctrl | Maps pedal input to a MIDI CC or function. Foot-Ctrl = CC 4, available as mod matrix source. |

The pedal input also accepts CV (0–+5 V) from modular gear.

### Sustain pedal (TS jack)

| Setting  | Options | Default | Notes |
|----------|---------|---------|-------|
| SUSTAIN  | Norm-Open / Norm-Closed / Tap-N.O / Tap-N.C / Arp+Gate / Arp−Gate / Seq+Gate / Seq−Gate / Arp&Seq+Gate / Arp&Seq−Gate | Norm-Open | Footswitch mode. Gate modes accept CV gate signals from modular synths. |
| MODE     | Sustain / Sostenuto | Sustain | Sustain = all notes held while pedal is down. Sostenuto = only notes already held when pedal is pressed. |

**Gate modes** are powerful for modular integration:
- **Arp±Gate**: External gate signal steps through arpeggiator notes
  (gate polarity selectable).
- **Seq±Gate**: External gate steps through control sequencer.
- **Arp&Seq±Gate**: External gate drives both simultaneously.

## Panel Settings (§7.3.4)

| Setting        | Options          | Default   | Notes                            |
|----------------|------------------|-----------|----------------------------------|
| PANEL-LOCAL    | On / Off         | On        | Disconnects panel faders/switches from sound engine. |
| FADER MODE     | Pass-thru / Jump | Jump      | Pass-thru: fader must cross stored value before taking effect. Jump: value jumps to fader position immediately. |
| INFO DIALOGS   | Enable / Disable | Enable   | Pop-up help messages.            |
| CYCLE TO PROG  | On / Off        | On        | Whether menu cycling returns to PROG screen. |
| REMEMBER PAGES | On / Off        | On        | Remember last visited menu page. |
| BRIGHTNESS     | 0–100           | 100       | Display brightness.              |
| CONTRAST       | 0–14            | 10        | Display contrast.                |

## System Settings (§7.3.5)

Version numbers (HOST-VER, VOICE-VER, DSP-VER, BOOT-VER, WIFI-VER)
are read-only firmware information.

| Setting    | Options  | Default | Notes                                       |
|------------|----------|---------|---------------------------------------------|
| FAN-SPEED  | 0–255   | —       | 0 = off, ~40 = internal fan only, 255 = max. Keep above 0 in warm environments. |

### Calibration routines

The CALIBRATE submenu runs hardware calibration for:
- **Voices** (ALL, Voice Check, VCF, VCF Fine, OSC, PW, VCA)
- **Mod Wheel**, **Pitch Wheel**, **Aftertouch**, **Pedal**

Calibration may be needed after firmware updates or if filter tracking
drifts. The VCF calibration is the most commonly needed — it ensures
accurate pitch tracking when the filter self-oscillates.

## Related sections

- → [playing-controls.md](playing-controls.md) — how keyboard, wheels, pedals, and velocity interact with per-program parameters
- → [voice-config.md](voice-config.md) — per-program pitch bend range, portamento, poly chain
- → [mod-matrix.md](mod-matrix.md) — mod sources that come from performance controls (velocity, aftertouch, mod wheel, expression)

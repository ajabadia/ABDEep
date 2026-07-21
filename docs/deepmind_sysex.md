
# DeepMind 12 — MIDI SysEx Commands (transcribed + cleaned extract)

This file is a cleaned/structured transcription of relevant DeepMind 12 user manual pages for SysEx.
The goal is to make it easy to:

- scan manually
- copy/paste reliably
- implement handshake + dump requests deterministically

## 19. MIDI SysEx Commands

SysEx (System Exclusive) are a special type of MIDI communication that allows
control of parameters and settings on a device/manufacturer specific basis.

For more information on SysEx and its implementation please consult the MIDI
Manufacturers Association at www.midi.org.

For specific information regarding the support of SysEx data within any third
party Audio/MIDI applications please consult the support of the manufacturer.

The SysEx implementation of the DeepMind 12 is described in the following sections.

## 19.2.1 Universal System Exclusive Message (Device Inquiry)

This message can be used to detect the presence of the synth and to get the
current global MIDI channel setting (also used as a SysEx Device ID when
addressing the synth).

### Device Enquiry SysEx request

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Status Byte |
| `7E` | Non Real Time Message Code |
| `nn` or `7F` | Device ID (0–15) or `7F` for broadcast |
| `06` | General Information Message Code |
| `01` | Identity Request Message Code |
| `F7` | End of System Exclusive |

Example (broadcast identity request):

```text
F0 7E 7F 06 01 F7
```

### Device Enquiry SysEx response

This is the Universal Identity Reply.

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Status Byte |
| `7E` | Non Real Time Message Code |
| `nn` | Device ID from 1 to 15 |
| `06` | General Information Message Code |
| `02` | Identity Reply Message Code |
| `00 20 32` | Behringer Manufacturers ID |
| `20 00` | DeepMind12 Product Family ID Code (LSByte, MSByte) |
| `00 01` | DeepMind12 Family Member ID Code (LSByte, MSByte) |
| `jn` | Main Software Version Revision Information (`i` = minor revision, `jn` = major revision) |
| `00` | Reserved |
| `ii` | Voice Software Major Version Number (0–127) |
| `nn` | Voice Software Minor Version Number (0–127) |
| `F7` | End of System Exclusive |

Notes:

- In practice (and per the MIDI spec), the Identity Reply uses `06 02`.
- The Behringer manufacturer ID is `00 20 32`.

## 19.2.2 App Notify Messages

This message is transmitted to the synth to identify that there is a control
app connected on a particular MIDI interface.

The synth, on receiving this message, will ensure that NRPN and SysEx messages
are enabled on this interface and will reply with device ID, RX/TX channels and
interface ID of the interface the app notify message was received on.

When an app is connected on an interface, the synth sends out additional SysEx
messages such as key down and voice allocation update messages.

### App Notify request

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Status Byte |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind 12 Model ID |
| `0d` | Device ID 0–15 |
| `00` | Control App Notify |
| `rr` | Reserved |
| `F7` | End of System Exclusive |

Example:

```text
F0 00 20 32 20 <deviceId> 00 <reserved> F7
```

### App Notify response

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Status Byte |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind 12 Model ID |
| `0d` | Device ID 0–15 |
| `10` | Control App Notify Response |
| `rx` | MIDI Receive CH 0–15 (All, 1–16) |
| `tx` | MIDI Transmit CH 0–15 (1–16) |
| `if` | Interface ID (0=MIDI, 1=USB, 2=Wi‑Fi) |
| `cb` | Currently selected bank (0–7) |
| `cp` | Currently selected program (0–127) |
| `00` | Reserved |
| `ii` | Voice Software Major Version Number (0–127) |
| `nn` | Voice Software Minor Version Number (0–127) |
| `F7` | End of System Exclusive |

## 19.2.3 Bulk Dump Packed Data Format

The bulk dumps listed below use “Packed MS bit” format data packing so a raw
data set of 7 bytes × 8 bits are transmitted as 8 bytes of 7-bits (MSB is 0 for
SysEx message data) with the MSBs of the original bytes packed into the first
byte of the 8 byte transmitted sequence.

Practical decode rule (as used by DeepMind dumps):

- Every group of **8** transmitted data bytes encodes **7** original bytes.
- The **first** byte in the group contains the MSBs for the following 7 bytes.
	- Bit `j` (0..6) of that first byte is the MSB for decoded byte `j`.
- Each of the following 7 bytes provides the low 7 bits.

In pseudocode:

```text
msb = packed[i+0]
for j in 0..6:
	low7 = packed[i+1+j]
	out.push(low7 | (((msb >> j) & 1) << 7))
```

## 19.2.4 Dump Messages

These messages can be used to request a data dump, and are shown with their
responses. Each parameter is stored in its own byte and the data format is
documented in the NRPN table.

### Program Dump request

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind 12 Model ID |
| `0d` | Device ID (0–15) |
| `01` | Program Dump Request |
| `0b` | Bank Number (0–7) |
| `pp` | Program Number (0–127) |
| `F7` | End of System Exclusive |

Example:

```text
F0 00 20 32 20 <deviceId> 01 <bank> <program> F7
```

### Program Dump response

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind 12 Model ID |
| `0d` | Device ID (0–15) |
| `02` | Program Dump Response |
| `06` | Comms Protocol Version |
| `0b` | Bank Number (0–7) |
| `pp` | Program Number (0–127) |
| `…` | 242 bytes of Program Data packed into 278 7-bit message bytes |
| `F7` | End of System Exclusive |

### Edit Buffer Dump request

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind 12 Model ID |
| `0d` | Device ID (0–15) |
| `03` | Edit Buffer Dump Request |
| `F7` | End of System Exclusive |

Example:

```text
F0 00 20 32 20 <deviceId> 03 F7
```

### Edit Buffer Dump response

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind 12 Model ID |
| `0d` | Device ID (0–15) |
| `04` | Edit Buffer Dump Response |
| `06` | Comms Protocol Version |
| `…` | 242 bytes of Program Data packed into 278 7-bit message bytes |
| `F7` | End of System Exclusive |

### Global Parameter Dump request

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind 12 Model ID |
| `0d` | Device ID (0–15) |
| `05` | Global Parameter Dump Request |
| `F7` | End of System Exclusive |

Example:

```text
F0 00 20 32 20 <deviceId> 05 F7
```

### Global Parameter Dump response

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind12 Model ID |
| `0d` | Device ID (0–15) |
| `06` | Global Parameter Dump Response |
| `06` | Comms Protocol Version |
| `…` | 45 bytes of Global Data packed into 56 7-bit message bytes |
| `F7` | End of System Exclusive |

### Single User Pattern Dump request

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind12 Model ID |
| `0d` | Device ID (0–15) |
| `07` | Single User Pattern Dump Request |
| `pp` | Pattern Number (0–31) |
| `F7` | End of System Exclusive |

### Single User Pattern Dump response

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind12 Model ID |
| `0d` | Device ID (0–15) |
| `08` | Single User Pattern Dump Response |
| `06` | Comms Protocol Version |
| `pp` | Pattern Number (0–31) |
| `…` | 65 byte User Pattern data packed into 80 7-bit message bytes. User pattern data is 1 byte length followed by 32 bytes for step gate and 32 bytes for step velocity |
| `F7` | End of System Exclusive |

### Edit Buffer Pattern Dump request

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind12 Model ID |
| `0d` | Device ID (0–15) |
| `0F` | Edit Buffer Pattern Dump Request |
| `F7` | End of System Exclusive |

### Edit Buffer Pattern Dump response

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind12 Model ID |
| `0d` | Device ID (0–15) |
| `08` | Edit Buffer Pattern Dump Response |
| `06` | Comms Protocol Version |
| `…` | 65 byte User Pattern data packed into 80 7-bit message bytes |
| `F7` | End of System Exclusive |

### Program Bank Dump request

Response is individual Program Dump Responses in a sequence.

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind12 Model ID |
| `0d` | Device ID (0–15) |
| `09` | Bank Dump Request |
| `bb` | Bank Number (0–7) |
| `ff` | First Program (0–127) |
| `ll` | Last program (0–127) |
| `F7` | End of System Exclusive |

### Program Bank Names Dump request

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind12 Model ID |
| `0d` | Device ID (0–15) |
| `0A` | Bank Program Names Dump Request |
| `bb` | Bank Number |
| `F7` | End of System Exclusive |

### Program Bank Names Dump response

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind12 Model ID |
| `0d` | Device ID (0–15) |
| `0B` | Bank Program Names Dump Response |
| `vv` | Comms Protocol Version |
| `bb` | Bank Number |
| `…` | Program name chars unpacked length = 128 Programs × 16 bytes = 2048 Bytes. Packed data length = 2344 |
| `F7` | End of System Exclusive |

### Single Program Name Dump request

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind12 Model ID |
| `0d` | Device ID (0–15) |
| `0C` | Single Program Name Dump Request |
| `bb` | Bank Number |
| `pp` | Program Number |
| `F7` | End of System Exclusive |

### Single Program Name Dump response

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind12 Model ID |
| `0d` | Device ID (0–15) |
| `0D` | Bank Program Names Dump Response |
| `06` | Comms Protocol Version |
| `bb` | Bank Number |
| `…` | 16 byte Program name packed into 24 bytes |
| `F7` | End of System Exclusive |

## Calibration + chord dumps

### Calibration Data Dump request

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind12 Model ID |
| `0d` | Device ID (0–15) |
| `11` | Calibration Data Dump Request |
| `F7` | End of System Exclusive |

### Calibration Data Dump response

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind12 Model ID |
| `0d` | Device ID (0–15) |
| `12` | Calibration Data Dump Response |
| `06` | Comms Protocol Version |
| `…` | Voice and Controller calibration data packed into 688 7-bit message bytes |
| `F7` | End of System Exclusive |

### Chord Memory Dump request

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind12 Model ID |
| `0d` | Device ID (0–15) |
| `1B` | Chord Memory Dump Request |
| `F7` | End of System Exclusive |

### Chord Memory Dump response

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind12 Model ID |
| `0d` | Device ID (0–15) |
| `1C` | Poly Chord Memory Dump Response |
| `06` | Comms Protocol Version |
| `…` | 26 bytes Chord memory packed into 32 7-bit message bytes. Note unused locations set to `0xFF` |
| `F7` | End of System Exclusive |

### Poly Chord Memory Dump request

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind12 Model ID |
| `0d` | Device ID (0–15) |
| `1D` | Poly Chord Memory Dump Request |
| `F7` | End of System Exclusive |

### Poly Chord Memory Dump response

| MIDI Bytes | Description |
|---|---|
| `F0` | System Exclusive Start |
| `00 20 32` | Behringer Manufacturers ID |
| `20` | DeepMind12 Model ID |
| `0d` | Device ID (0–15) |
| `1E` | Poly Chord Memory Dump Response |
| `06` | Comms Protocol Version |
| `…` | 512 bytes Poly Chord memory packed into 592 7-bit message bytes. Note unused locations set to `0xFF` |
| `F7` | End of System Exclusive |

## Manual label quirks / gotchas

### `0x0D` response label ambiguity

In the manual page transcribed above, the **Single Program Name Dump response** section lists:

- command byte `0D` with the description “Bank Program Names Dump Response”

This is noteworthy because it’s inconsistent with the surrounding context:

- A **bank program names** response is a large payload (names for 128 programs).
- A **single program name** response is a small payload (one 16-byte name packed into 24 bytes).

Working assumption (until validated with real captures): treat this as a documentation label mismatch.

Implementation guidance when we get to this feature:

- Prefer **command byte + observed payload length** as ground truth.
- Validate against real `.syx` captures/fixtures whenever possible.
- Keep the human-readable labels in code/logging conservative to avoid misleading debugging.


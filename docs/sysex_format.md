# DeepMind 12 — Formato SysEx de Programa (242 Bytes)

> Documentación completa de la estructura de los 242 bytes del preset individual del Behringer DeepMind 12.
> Basada en análisis de factory banks (A-H), código fuente del editor ABDEep, tabla NRPN oficial, y referencias cruzadas con el hardware.

---

## 1. Vista General

Cada preset del DeepMind 12 se transmite como un **mensaje SysEx de 291 bytes**. El payload empaquetado de 278 bytes se desempaqueta mediante el algoritmo **7-to-8 Packed MS-bit** para producir **242 bytes de datos de preset sin procesar**.

```
SysEx Crudo (291 bytes)
├── Cabecera (8 bytes):  F0 00 20 32 20 <DeviceID> <Cmd> <Bank>
├── Payload Empaquetado (278 bytes):  datos 7-bit empaquetados
├── Cola (5 bytes):  <ProgNum> <Checksum?> F7
│
└── Desempaquetado 7→8 → 242 bytes de preset
     ├── 000-006:  LFO 1
     ├── 007-013:  LFO 2
     ├── 014-033:  OSC 1 / OSC 2 / Noise
     ├── 034-038:  Portamento / Pitch
     ├── 039-052:  VCF / HPF
     ├── 053-079:  Envelopes (ENV1, ENV2, ENV3)
     ├── 080-083:  VCA
     ├── 084-092:  Voice / Performance
     ├── 093-116:  Modulation Matrix (8 slots)
     ├── 117-122:  Control Sequencer
     ├── 123-154:  Seq Step Values
     ├── 155-164:  Arpeggiator
     ├── 165-222:  FX Engine (routing, 4x tipos+params, gains, mode)
     ├── 223:      Firmware metadata (investigado)
     ├── 224-238:  Nombre del preset (15 caracteres ASCII)
     ├── 239-241:  Cola del campo de nombre
     └── (242 bytes total)
```

---

## 2. Mensaje SysEx Completo (291 bytes)

### Cabecera (bytes 0–7)

| Offset | Valor | Descripción |
|--------|-------|-------------|
| 0 | `0xF0` | Inicio SysEx |
| 1 | `0x00` | Manufacturer ID (Behringer) byte 1 |
| 2 | `0x20` | Manufacturer ID (Behringer) byte 2 |
| 3 | `0x32` | Manufacturer ID (Behringer) byte 3 |
| 4 | `0x20` | Family / Model (DeepMind 12) |
| 5 | `0x00` | Device ID (0–127, normalmente 0) |
| 6 | `0x01` | **Command Type**: `0x01`=Program Dump, `0x02`=Program Dump Response, `0x03`=Edit Buffer Request, `0x04`=Edit Buffer Dump, `0x05`=Global Request, `0x06`=Global Dump |
| 7 | `0x00` | Bank Number (0–7 = A–H) |

### Payload (bytes 8–285)

278 bytes de datos empaquetados en formato 7-bit (ver algoritmo de desempaquetado).

### Cola (bytes 286–290)

| Offset | Valor | Descripción |
|--------|-------|-------------|
| 286 | `0x00`–`0x7F` | Program Number (0–127) |
| 287–289 | — | Checksum (3 bytes, algoritmo propietario — no es CRC16 estándar) |
| 290 | `0xF7` | Fin SysEx |

---

## 3. Algoritmo de Desempaquetado (7-to-8 Packed MS-bit)

Los 278 bytes empaquetados se convierten a 242 bytes mediante este algoritmo:

```
Entrada:  packed[0..277] (278 bytes de 7 bits)
Salida:   unpacked[0..241] (242 bytes de 8 bits)

Para cada grupo de 8 bytes empaquetados:
    msbByte = packed[0]               // 1 byte de flags MSB
    Para j = 0..6:                    // 7 bytes de datos
        low7    = packed[1 + j] & 0x7F
        msb     = (msbByte >> j) & 0x01
        unpacked = low7 | (msb << 7)  // reconstruir byte de 8 bits
```

**Implementación de referencia (C++):**
```cpp
static juce::MemoryBlock unpackDeepMindSysEx(const uint8_t* packedData, size_t packedLength) {
    juce::MemoryBlock out;
    out.ensureSize((packedLength * 7) / 8, false);
    for (size_t i = 0; i + 7 < packedLength; i += 8) {
        uint8_t msbByte = packedData[i] & 0x7F;
        for (int j = 0; j < 7; ++j) {
            uint8_t low7 = packedData[i + 1 + j] & 0x7F;
            uint8_t msb = (msbByte >> j) & 0x01;
            uint8_t originalByte = low7 | (msb << 7);
            out.append(&originalByte, 1);
        }
    }
    return out;
}
```

**Implementación de referencia (JavaScript):**
```javascript
function unpack7to8(packed) {
    const out = new Uint8Array(242);
    let outIdx = 0;
    for (let i = 0; i + 7 < packed.length && outIdx < 242; i += 8) {
        const msbByte = packed[i];
        for (let j = 0; j < 7 && outIdx < 242; j++) {
            const low7 = packed[i + 1 + j] & 0x7F;
            const msb = (msbByte >> j) & 0x01;
            out[outIdx++] = low7 | (msb << 7);
        }
    }
    return out;
}
```

### Correspondencia Packed → Unpacked

| Grupo Packed | Bytes empaquetados | Flags | Bytes desempaquetados |
|-------------|-------------------|-------|----------------------|
| 0 | packed[0–7] | packed[0] → MSB bits | unpacked[0–6] |
| 1 | packed[8–15] | packed[8] → MSB bits | unpacked[7–13] |
| 2 | packed[16–23] | packed[16] → MSB bits | unpacked[14–20] |
| ... | ... | ... | ... |
| 34 | packed[272–277] | packed[272] → MSB bits | unpacked[238–241] (solo 4 bytes, últimos 3 del grupo truncados) |

---

## 4. Mapa Completo de Bytes (242 bytes)

### 4.1 LFO 1 — Bytes 0–6

| Byte | Parámetro | Tipo | NRPN | Valores | Notas |
|------|-----------|------|------|---------|-------|
| 0 | LFO 1 Rate | value | 0 | 0=lento…255=rápido | |
| 1 | LFO 1 Delay/Fade | value | 1 | 0=sin delay…255=máx | |
| 2 | LFO 1 Shape | enum | 2 | 0=Sine, 1=Triangle, 2=Square, 3=Ramp Up, 4=Ramp Down, 5=S&H, 6=S&G | `*6` |
| 3 | LFO 1 Key Sync | toggle | 3 | 0=Off, 1=On | |
| 4 | LFO 1 Arp Sync | toggle | 4 | 0=Off, 1=On | |
| 5 | LFO 1 Mono Mode | value | 5 | 0=Poly, 1=Mono, 2+=Spread | |
| 6 | LFO 1 Slew Rate | value | 6 | 0=sin slew…255=máx | |

### 4.2 LFO 2 — Bytes 7–13

| Byte | Parámetro | Tipo | NRPN | Valores | Notas |
|------|-----------|------|------|---------|-------|
| 7 | LFO 2 Rate | value | 7 | 0=lento…255=rápido | |
| 8 | LFO 2 Delay/Fade | value | 8 | 0=sin delay…255=máx | |
| 9 | LFO 2 Shape | enum | 9 | (mismos valores que LFO 1 Shape) | `*6` |
| 10 | LFO 2 Key Sync | toggle | 10 | 0=Off, 1=On | |
| 11 | LFO 2 Arp Sync | toggle | 11 | 0=Off, 1=On | |
| 12 | LFO 2 Mono Mode | value | 12 | 0=Poly, 1=Mono, 2+=Spread | |
| 13 | LFO 2 Slew Rate | value | 13 | 0=sin slew…255=máx | |

### 4.3 OSC 1 — Bytes 14–25

| Byte | Parámetro | Tipo | NRPN | Valores | Notas |
|------|-----------|------|------|---------|-------|
| 14 | OSC 1 Range | enum | 14 | 0=16', 1=8', 2=4' | `*2` |
| 15 | *(OSC 2 Range)* | | | Ver byte 15 en OSC 2 | |
| 16 | OSC 1 PWM Source | enum | 16 | 0=Manual, 1=LFO1, 2=LFO2, 3=Env1, 4=Env2, 5=Env3 | `*5` |
| 17 | OSC 2 Tone Mod Source | enum | 17 | (mismos valores que PWM Source) | Alias `osc2_pm_source` |
| 18 | OSC 1 Square/Pulse Enable | toggle | 18 | 0=Off, 1=On | |
| 19 | OSC 1 Saw Enable | toggle | 19 | 0=Off, 1=On | |
| 20 | OSC Hard Sync Enable | toggle | 20 | 0=Off, 1=On | |
| 21 | OSC 1 Pitch Mod Depth | value | 21 | 0=none…255=máx | |
| 22 | OSC 1 Pitch Mod Select | enum | 22 | 0=LFO1, 1=LFO2, 2=Env1, 3=Env2, 4=Env3, 5=LFO1 Unipolar, 6=LFO2 Unipolar | `*6` |
| 23 | OSC 1 Aftertouch > Pitch Mod | value | 23 | 0=none…255=máx | |
| 24 | OSC 1 Mod Wheel > Pitch Mod | value | 24 | 0=none…255=máx | |
| 25 | OSC 1 PWM Depth | value | 25 | 0=none…255=máx | |

### 4.4 OSC 2 — Bytes 15, 26–33

| Byte | Parámetro | Tipo | NRPN | Valores | Notas |
|------|-----------|------|------|---------|-------|
| 15 | OSC 2 Range | enum | 15 | 0=16', 1=8', 2=4' | `*2` |
| 26 | OSC 2 Level | value | 26 | 0=silent…255=full | |
| 27 | OSC 2 Pitch | value | 27 | Coarse pitch offset | |
| 28 | OSC 2 Tone Mod Depth | value | 28 | 0=none…255=máx | |
| 29 | OSC 2 Pitch Mod Depth | value | 29 | 0=none…255=máx | |
| 30 | OSC 2 Aftertouch > Pitch Mod | value | 30 | 0=none…255=máx | |
| 31 | OSC 2 Mod Wheel > Pitch Mod | value | 31 | 0=none…255=máx | |
| 32 | OSC 2 Pitch Mod Select | enum | 32 | (mismos valores que byte 22) | `*6` |
| 33 | Noise Level | value | 33 | 0=silent…255=loud | |

### 4.5 Portamento / Pitch Bend — Bytes 34–38

| Byte | Parámetro | Tipo | NRPN | Valores | Notas |
|------|-----------|------|------|---------|-------|
| 34 | Portamento Time | value | 34 | 0=instant…255=slow | |
| 35 | Portamento Mode | enum | 35 | 0–13 (ver enum completo) | `*13` |
| 36 | Pitch Bend Up | value | 36 | 0–24 semitones | |
| 37 | Pitch Bend Down | value | 37 | 0–24 semitones | |
| 38 | OSC 1 PM Mode | toggle | 38 | 0=OSC1+2, 1=OSC1 Only | |

### 4.6 VCF / HPF — Bytes 39–52

| Byte | Parámetro | Tipo | NRPN | Valores | Notas |
|------|-----------|------|------|---------|-------|
| 39 | VCF Cutoff | value | 39 | 0=closed…255=open | |
| 40 | HPF Cutoff | value | 40 | Mapa 20–2000 Hz | |
| 41 | VCF Resonance | value | 41 | 0=none…255=max (self-osc) | |
| 42 | VCF Env Depth | **bipolar** | 42 | 128=centro, <128=neg, >128=pos | |
| 43 | VCF Env Velocity Sens | value | 43 | Sensibilidad a velocidad | |
| 44 | VCF Pitch Bend Depth | value | 44 | Pitch bend → cutoff freq | |
| 45 | VCF LFO Depth | value | 45 | Profundidad modulación LFO | |
| 46 | VCF LFO Select | toggle | 46 | 0=LFO1, 1=LFO2 | |
| 47 | VCF Aftertouch > LFO Depth | value | 47 | Aftertouch → LFO | |
| 48 | VCF Mod Wheel > LFO Depth | value | 48 | Mod wheel → LFO | |
| 49 | VCF Key Tracking | value | 49 | 0=none…255=full | |
| 50 | VCF Env Polarity | toggle | 50 | 0=Negative, 1=Positive | |
| 51 | VCF 2/4 Pole Mode | toggle | 51 | 0=4 Pole (24dB), 1=2 Pole (12dB) | |
| 52 | HPF Boost Enable | toggle | 52 | 0=Off, 1=On | |

### 4.7 Envelope 1 (VCA) — Bytes 53–61

| Byte | Parámetro | Tipo | NRPN | Rango | Notas |
|------|-----------|------|------|-------|-------|
| 53 | Env1 Attack | time | 53 | 0–10s | |
| 54 | Env1 Decay | time | 54 | 0–10s | |
| 55 | Env1 Sustain | value | 55 | 0=min…255=max | |
| 56 | Env1 Release | time | 56 | 0–10s | |
| 57 | Env1 Trigger Mode | enum | 57 | 0=Key, 1=LFO1, 2=LFO2, 3=Loop, 4=Seq | `*4` |
| 58 | Env1 Attack Curve | value | 58 | 0=linear…255=exp | |
| 59 | Env1 Decay Curve | value | 59 | 0=linear…255=exp | |
| 60 | Env1 Sustain Curve | value | 60 | 0=linear…255=exp | |
| 61 | Env1 Release Curve | value | 61 | 0=linear…255=exp | |

### 4.8 Envelope 2 (VCF) — Bytes 62–70

| Byte | Parámetro | Tipo | NRPN | Rango | Notas |
|------|-----------|------|------|-------|-------|
| 62 | Env2 Attack | time | 62 | 0–10s | |
| 63 | Env2 Decay | time | 63 | 0–10s | |
| 64 | Env2 Sustain | value | 64 | 0=min…255=max | |
| 65 | Env2 Release | time | 65 | 0–10s | |
| 66 | Env2 Trigger Mode | enum | 66 | (mismos valores que Env1) | `*4` |
| 67 | Env2 Attack Curve | value | 67 | 0=linear…255=exp | |
| 68 | Env2 Decay Curve | value | 68 | 0=linear…255=exp | |
| 69 | Env2 Sustain Curve | value | 69 | 0=linear…255=exp | |
| 70 | Env2 Release Curve | value | 70 | 0=linear…255=exp | |

### 4.9 Envelope 3 (Mod) — Bytes 71–79

| Byte | Parámetro | Tipo | NRPN | Rango | Notas |
|------|-----------|------|------|-------|-------|
| 71 | Env3 Attack | time | 71 | 0–10s | |
| 72 | Env3 Decay | time | 72 | 0–10s | |
| 73 | Env3 Sustain | value | 73 | 0=min…255=max | |
| 74 | Env3 Release | time | 74 | 0–10s | |
| 75 | Env3 Trigger Mode | enum | 75 | (mismos valores que Env1) | `*4` |
| 76 | Env3 Attack Curve | value | 76 | 0=linear…255=exp | |
| 77 | Env3 Decay Curve | value | 77 | 0=linear…255=exp | |
| 78 | Env3 Sustain Curve | value | 78 | 0=linear…255=exp | |
| 79 | Env3 Release Curve | value | 79 | 0=linear…255=exp | |

### 4.10 VCA — Bytes 80–83

| Byte | Parámetro | Tipo | NRPN | Valores | Notas |
|------|-----------|------|------|---------|-------|
| 80 | VCA Level | value | 80 | 0=silent…255=full | |
| 81 | VCA Env Depth | value | 81 | 0=none…255=full | |
| 82 | VCA Vel Sens | value | 82 | Sensibilidad a velocidad | |
| 83 | VCA Pan Spread | **bipolar** | 83 | 128=centro, <128=left, >128=right | |

### 4.11 Voice / Performance — Bytes 84–92

| Byte | Parámetro | Tipo | NRPN | Valores | Notas |
|------|-----------|------|------|---------|-------|
| 84 | Note Priority | enum | 84 | 0=Lowest, 1=Highest, 2=Last | `*2` |
| 85 | Voice Mode | enum | 85 | 0–12 (Poly, Uni2-12, Mono, Poly6-8) | `*12` |
| 86 | Trigger Mode | enum | 86 | 0=Mono, 1=Retrig, 2=Legato, 3=One-shot | `*3` |
| 87 | Unison Detune | value | 87 | 0=none…255=phat | |
| 88 | Voice Drift | value | 88 | 0=none…255=max | Alias `osc_drift` |
| 89 | Parameter Drift | value | 89 | 0=none…255=max | |
| 90 | Drift Rate | value | 90 | Velocidad fluctuación drift | |
| 91 | OSC Porta Balance | **bipolar** | 91 | 128=centro, <128=osc1, >128=osc2 | |
| 92 | OSC Key Down Reset | toggle | 92 | 0=Off, 1=On | |

### 4.12 Modulation Matrix — Bytes 93–116

Ocho slots de modulación, cada uno con 3 bytes (source, destination, depth).

**Slots 1–4 (bytes 93–104):** Exclusivos — sin conflictos.

| Byte | Parámetro | Tipo | NRPN | Notas |
|------|-----------|------|------|-------|
| 93 | Mod Slot 1 Source | enum | 93 | 0–22 (Mod Source) |
| 94 | Mod Slot 1 Destination | enum | 94 | 0–129 (Mod Dest) |
| 95 | Mod Slot 1 Depth | **bipolar** | 95 | |
| 96 | Mod Slot 2 Source | enum | 96 | |
| 97 | Mod Slot 2 Destination | enum | 97 | |
| 98 | Mod Slot 2 Depth | **bipolar** | 98 | |
| 99 | Mod Slot 3 Source | enum | 99 | |
| 100 | Mod Slot 3 Destination | enum | 100 | |
| 101 | Mod Slot 3 Depth | **bipolar** | 101 | |
| 102 | Mod Slot 4 Source | enum | 102 | |
| 103 | Mod Slot 4 Destination | enum | 103 | |
| 104 | Mod Slot 4 Depth | **bipolar** | 104 | |

**Slots 5–8 (bytes 105–116):** Comparten dirección NRPN con Chord y Arp.

| Byte | Parámetro (Mod) | Parámetro (Alternativo) | NRPN | Tipo |
|------|-----------------|------------------------|------|------|
| 105 | Mod Slot 5 Source | Chord Enable | 105 | dual |
| 106 | Mod Slot 5 Destination | Poly Chord Enable | 106 | dual |
| 107 | Mod Slot 5 Depth | Chord Key | 107 | bipolar/dual |
| 108 | Mod Slot 6 Source | Chord Type | 108 | dual |
| 109 | Mod Slot 6 Destination | Arp Enable | 109 | dual |
| 110 | Mod Slot 6 Depth | Arp Hold | 110 | bipolar/dual |
| 111 | Mod Slot 7 Source | Arp Key Sync | 111 | dual |
| 112 | Mod Slot 7 Destination | Arp Velocity Gate | 112 | dual |
| 113 | Mod Slot 7 Depth | Arp Mode | 113 | bipolar/dual |
| 114 | Mod Slot 8 Source | — *(unused)* | 114 | enum (a menudo 0) |
| 115 | Mod Slot 8 Destination | Arp Gate Time | 115 | dual |
| 116 | Mod Slot 8 Depth | Arp Swing | 116 | bipolar/dual |

> **Nota:** Los bytes 105–116 son compartidos entre Mod Matrix y Chord/Arp. En la práctica, el hardware usa estos bytes para una función a la vez. El editor ABDEep intenta manejar ambos simultáneamente con el tipo `dual`.

### 4.13 Control Sequencer — Bytes 117–122

| Byte | Parámetro | Tipo | NRPN | Valores | Notas |
|------|-----------|------|------|---------|-------|
| 117 | Seq Enable | toggle | 117 | 0=Off, 1=On | |
| 118 | Seq Clock Divider | enum | 118 | 16 valores: 1/2…1/192 | `*15` |
| 119 | Seq Length (Steps) | enum | 119 | 0=1 step…31=32 steps | `*31` |
| 120 | Seq Swing | value | 120 | 0=50%…25=75% | |
| 121 | Seq Key Loop | enum | 121 | 0=Loop Off, 1=Loop On, 2=(unused) | `*2` |
| 122 | Seq Slew Rate | value | 122 | 0=none…255=max | |

### 4.14 Seq Step Values — Bytes 123–154

32 pasos del secuenciador, cada uno como byte bipolar (32 bytes total).

| Byte(s) | Parámetro | Tipo | Rango | Notas |
|---------|-----------|------|-------|-------|
| 123–154 | Seq Step 1–32 | **bipolar** | 0=skip, 128=centro, <128=negativo, >128=positivo | 32 pasos |

### 4.15 Arpeggiator — Bytes 155–164

| Byte | Parámetro | Tipo | NRPN | Valores | Notas |
|------|-----------|------|------|---------|-------|
| 155 | Arp Enable | toggle | 155 | 0=Off, 1=On | |
| 156 | Arp Mode | enum | 156 | 0–10 (Up, Down, Up&Dn, etc.) | `*10` |
| 157 | Arp Rate | value | 157 | 0=20bpm…255=275bpm | |
| 158 | Arp Clock Divider | enum | 158 | 13 valores: 1/32…1/2 | `*12` |
| 159 | Arp Key Sync | toggle | 159 | 0=Off, 1=On | |
| 160 | Arp Gate Time | value | 160 | 0…255 | Alias `arp_gate` |
| 161 | Arp Hold | toggle | 161 | 0=Off, 1=On | |
| 162 | Arp Pattern | value | 162 | 0=None, 1–64=Presets | |
| 163 | Arp Swing | value | 163 | 0=50%…25=75% | |
| 164 | Arp Octave Range | value | 164 | 0=1…5=6 octavas | |

### 4.16 FX Engine — Bytes 165–222

#### Routing y Modo Global

| Byte | Parámetro | Tipo | NRPN | Valores | Notas |
|------|-----------|------|------|---------|-------|
| 165 | FX Routing | enum | 165 | 10 modos (M-1…M-10) | `*9` |
| 222 | FX Mode | enum | 222 | 0=Insert, 1=Send, 2=Bypass | `*2` |

#### FX Gains (compartidos entre todos los slots)

| Byte | Parámetro | NRPN |
|------|-----------|------|
| 218 | FX1 Output Gain | 218 |
| 219 | FX2 Output Gain | 219 |
| 220 | FX3 Output Gain | 220 |
| 221 | FX4 Output Gain | 221 |

#### FX1 — Bytes 166–178 (tipo + 12 parámetros)

| Byte | Parámetro | NRPN |
|------|-----------|------|
| 166 | FX1 Type | 166 |
| 167–178 | FX1 Param 1–12 | 167–178 |

#### FX2 — Bytes 179–191 (tipo + 12 parámetros)

| Byte | Parámetro | NRPN |
|------|-----------|------|
| 179 | FX2 Type | 179 |
| 180–191 | FX2 Param 1–12 | 180–191 |

#### FX3 — Bytes 192–204 (tipo + 12 parámetros)

| Byte | Parámetro | NRPN |
|------|-----------|------|
| 192 | FX3 Type | 192 |
| 193–204 | FX3 Param 1–12 | 193–204 |

#### FX4 — Bytes 205–217 (tipo + 12 parámetros)

| Byte | Parámetro | NRPN |
|------|-----------|------|
| 205 | FX4 Type | 205 |
| 206–217 | FX4 Param 1–12 | 206–217 |

> **Nota sobre tipos FX:** El hardware DeepMind 12 soporta 34 tipos de efectos (0–33), incluyendo reverbs, delays, chorus, flanger, phaser, distorsión, ecualizador, compresor, etc.

### 4.17 Byte 223 — Firmware Metadata (región `Firmware`)

| Byte | Parámetro | Tipo | Región (byte-map.js) | Notas |
|------|-----------|------|----------------------|-------|
| 223 | Firmware metadata | value | `Firmware` | 116 valores únicos. No es CRC16. Sin impacto en sonido. Ver §6 |

**En el Dump viewer:**
- Región `Firmware` tiene color propio: `{bg:'#141e28', fg:'#88aacc'}` (azul acero oscuro)
- Antes usaba región `?` (reserved), ahora tiene su propio grupo cromático
- Sin borde punteado ni prefijo `•` — se muestra como un byte de datos normal
- El contador de bytes reservados en el sumario ya **no** incluye este byte

### 4.18 Nombre del Preset — Bytes 224–238 (15 caracteres ASCII)

| Byte(s) | Parámetro | Tipo | Notas |
|---------|-----------|------|-------|
| 224–238 | Program Name char[0–14] | ASCII | 15 caracteres. Relleno con 0x20 (espacio) si el nombre es más corto. |

> ⚠️ **IMPORTANTE: NO leer el nombre de unpacked bytes 224–238.**
> El algoritmo 7-to-8 aplica los MSB flags de los grupos 32–34 sobre estos bytes,
> corrompiendo los caracteres ASCII. **Verificado: 1024/1024 presets de fábrica tienen
> nombres corruptos en unpacked.**
>
> El nombre correcto se lee de **raw SysEx offsets 265–281** (7-bit clean, ignorando
> los flag bytes en posiciones 272 y 280). Este es el método usado por `browser.js`
> para extraer nombres de presets.

**Correspondencia con SysEx raw (forma correcta de leer el nombre):**
```
Raw SysEx offsets 265–281 → 17 bytes raw (incluye 2 flag bytes en 272, 280)
  - raw[265–271]:  bytes de datos (nombre chars 0–6, 7-bit clean)
  - raw[272]:      flag byte del grupo 33 (NO es nombre) — ignorar
  - raw[273–279]:  bytes de datos (nombre chars 7–13, 7-bit clean)
  - raw[280]:      flag byte del grupo 34 (NO es nombre) — ignorar
  - raw[281]:      byte de datos (nombre char 14, 7-bit clean)

Lectura correcta en JavaScript:
  let nameChars = [];
  for (let j = 265; j <= 281; j++) {
    const b = rawSysex[offset + j];
    if (b > 0) nameChars.push(String.fromCharCode(b));
  }
  const name = nameChars.join('').trim();
```

### 4.19 Cola del Nombre — Bytes 239–241 (región `Tail`)

| Byte | Parámetro | Tipo | Región (byte-map.js) | Notas |
|------|-----------|------|----------------------|-------|
| 239 | Name field tail | value | `Tail` | Raw SysEx offset 282 |
| 240 | Name field tail | value | `Tail` | Raw SysEx offset 283 |
| 241 | Name field tail | value | `Tail` | Raw SysEx offset 284 (último byte del payload empaquetado) |

Estos 3 bytes contienen los datos residuales del payload empaquetado tras el campo de nombre de 17 bytes raw (offsets SysEx 282–284). Forman parte de la cola del grupo 34 de empaquetado.

**En el Dump viewer:**
- Región `Tail` tiene color propio: `{bg:'#1e1a14', fg:'#998866'}` (ámbar/marrón cálido)
- Se distingue visualmente de la región `?` (reserved/padding, gris con borde punteado y prefijo `•`)
- El contador de bytes reservados en el sumario **no** incluye estos 3 bytes (región `Tail`, no `?`)

---

## 5. Esquema de Direccionamiento NRPN

Cada parámetro editable se direcciona mediante un mensaje NRPN de 14 bits:

```
NRPN Address = (MSB << 7) + LSB

  MSB = byte < 128 ? 0 : 1
  LSB = byte < 128 ? byte : (byte - 128)
```

### Secuencia NRPN (4 mensajes CC)

```
CC 99 → NRPN MSB (0 o 1)
CC 98 → NRPN LSB (0–127)
CC 6  → Data Entry MSB  (bit 7 del valor de 14 bits)
CC 38 → Data Entry LSB  (bits 6–0 del valor de 14 bits)
```

### Optimización con Caché de Dirección

- Si el mismo parámetro se envía repetidamente con un valor diferente, se omiten CC 99/98 (la dirección ya está establecida).
- Si el mismo parámetro con el mismo valor se envía de nuevo, se omite el mensaje completo (caché de valor).

### Mapa NRPN → Byte Offset

Los NRPNs 0–154 corresponden a MSB=0 (LSB 0–154), y los NRPNs 155–222 corresponden a MSB=1 (LSB 27–94).

```javascript
byteOffset < 128 → NRPN(MSB=0, LSB=byteOffset)
byteOffset ≥ 128 → NRPN(MSB=1, LSB=byteOffset-128)
```

---

## 6. Investigación de Bytes No Documentados

### Byte 225 (zero padding)

| Hallazgo | Valor |
|----------|-------|
| **Siempre 0** | ✅ 1024/1024 presets en factory banks A–H |
| **Veredicto** | Zero padding — no usado por firmware ni DSP |
| **Impacto** | Ninguno |

### Bytes 223–224 (firmware metadata)

| Hallazgo | b223 | b224 |
|----------|------|------|
| Valores únicos | **116** (en 1024 presets) | **56** |
| Rango | 0–254 | 51–218 |
| ¿CRC16 estándar? | ❌ No (13 algoritmos probados) | ❌ No |
| ¿Checksum simple? | ❌ No (ni sum, xor, fletcher, adler) | ❌ No |
| **Veredicto** | Metadatos internos del firmware | Metadatos internos |
| **Impacto** | Ninguno en sonido | Ninguno |

### Bytes 239–241 (name field tail)

Son el remanente de datos del payload empaquetado después del campo de nombre. No son parámetros de control — solo existen porque el mecanismo de empaquetado 7-to-8 produce 242 bytes a partir de 278 bytes empaquetados, y los últimos bytes después del nombre (raw 282–284) no tienen una función específica.

---

## 7. Referencia de Valores Enum

### LFO Shape (bytes 2, 9)

| Raw | Etiqueta | Descripción |
|-----|----------|-------------|
| 0 | Sine | Onda senoidal |
| 1 | Triangle | Onda triangular |
| 2 | Square | Onda cuadrada |
| 3 | Ramp Up | Diente de sierra ascendente |
| 4 | Ramp Down | Diente de sierra descendente |
| 5 | S&H | Sample & Hold |
| 6 | S&G | Sample & Glide |

### OSC Range (bytes 14, 15)

| Raw | Etiqueta |
|-----|----------|
| 0 | 16' |
| 1 | 8' |
| 2 | 4' |

### PWM / Tone Mod Source (bytes 16, 17)

| Raw | Etiqueta |
|-----|----------|
| 0 | Manual |
| 1 | LFO 1 |
| 2 | LFO 2 |
| 3 | Env 1 (VCA) |
| 4 | Env 2 (VCF) |
| 5 | Env 3 (Mod) |

### Pitch Mod Select (bytes 22, 32)

| Raw | Etiqueta |
|-----|----------|
| 0 | LFO 1 |
| 1 | LFO 2 |
| 2 | Env 1 (VCA) |
| 3 | Env 2 (VCF) |
| 4 | Env 3 (Mod) |
| 5 | LFO 1 (Unipolar) |
| 6 | LFO 2 (Unipolar) |

### Portamento Mode (byte 35)

| Raw | Etiqueta |
|-----|----------|
| 0 | Normal |
| 1 | Fingered |
| 2 | Fixed Rate |
| 3 | Fixed Rate Fingered |
| 4 | Exponential |
| 5 | Exponential Fingered |
| 6–13 | (variantes Fixed±2, ±5, ±12, ±24) |

### Voice Mode (byte 85)

| Raw | Etiqueta |
|-----|----------|
| 0 | Poly |
| 1 | Unison 2 |
| 2 | Unison 3 |
| 3 | Unison 4 |
| 4 | Unison 6 |
| 5 | Unison 12 |
| 6 | Mono |
| 7 | Mono 2 |
| 8 | Mono 3 |
| 9 | Mono 4 |
| 10 | Mono 6 |
| 11 | Poly 6 |
| 12 | Poly 8 |

### Trigger Mode (byte 86)

| Raw | Etiqueta |
|-----|----------|
| 0 | Mono |
| 1 | Re-Trig |
| 2 | Legato |
| 3 | One-Shot |

### Note Priority (byte 84)

| Raw | Etiqueta |
|-----|----------|
| 0 | Lowest |
| 1 | Highest |
| 2 | Last |

### Arp Mode (byte 156)

| Raw | Etiqueta |
|-----|----------|
| 0 | Up |
| 1 | Down |
| 2 | Up & Down |
| 3 | Up (Inverted) |
| 4 | Down (Inverted) |
| 5 | Up & Down (Inverted) |
| 6 | Up (Alternate) |
| 7 | Down (Alternate) |
| 8 | Random |
| 9 | As Played |
| 10 | Chord |

### Envelope Trigger Mode (bytes 57, 66, 75)

| Raw | Etiqueta |
|-----|----------|
| 0 | Key |
| 1 | LFO 1 |
| 2 | LFO 2 |
| 3 | Loop |
| 4 | Seq Step |

### FX Routing (byte 165)

| Raw | Etiqueta |
|-----|----------|
| 0 | M-1 Ser 1-2-3-4 |
| 1 | M-2 Par 1/2 Ser 3-4 |
| 2 | M-3 Par 1/2 Par 3/4 |
| 3 | M-4 Par 1/2/3/4 |
| 4 | M-5 Par 1/2/3 Ser 4 |
| 5 | M-6 Ser 1-2 Par 3/4 |
| 6 | M-7 Ser 1 Par 2/3/4 |
| 7 | M-8 Par (Ser 1-2-3)/4 |
| 8 | M-9 Ser 3-4 FB(1-2) |
| 9 | M-10 Ser 4 FB(1-2-3) |

### FX Mode (byte 222)

| Raw | Etiqueta |
|-----|----------|
| 0 | Insert |
| 1 | Send |
| 2 | Bypass |

### Chord Type (byte 108)

| Raw | Etiqueta |
|-----|----------|
| 0 | Memory |
| 1 | Major |
| 2 | Minor |
| 3 | Aug |
| 4 | Dim |
| 5 | Sus2 |
| 6 | Sus4 |
| 7 | 7th |

---

## 8. Tipos de Valor

| Tipo | Descripción | Almacenamiento |
|------|-------------|----------------|
| `value` | Lineal 0–255 | raw / 255 = normalized 0–1 |
| `bipolar` | Centro 128, rango –127…+127 | (raw – 128) / 127 = normalized –1…+1 |
| `toggle` | On/Off | raw ≥ 128 = On |
| `enum` | Valor discreto | raw / maxEnum = normalized 0–1 |
| `time` | Tiempo en segundos | raw / 255 * 10 = segundos (0–10s) |
| `ascii` | Carácter ASCII | raw = charCode (0x20–0x7E válido) |

---

## 9. Historial de Cambios

| Fecha | Cambio |
|------|--------|
| 2026-07 | Creación inicial del documento basada en byte-map.js, bridge-dual.js, ParametersSpec.cpp |
| 2026-07 | Corrección off-by-2 del nombre: 226–241 (16 chars) → 224–238 (15 chars) |
| 2026-07 | Investigación bytes 223–225: 223–224 = firmware metadata, 225 = zero padding |
| 2026-07 | Documentación bytes 239–241 como "name field tail" |
| 2026-07 | Nueva región `Tail` en byte-map.js y settings.js para bytes 239–241 (ámbar/marrón) |
| 2026-07 | Nueva región `Firmware` en byte-map.js y settings.js para byte 223 (acero azulado) |

---

## 10. Referencias

- `WebUI/js/byte-map.js` — Mapa descriptivo completo de los 242 bytes
- `WebUI/js/bridge-dual.js` — paramToByteOffset, envío/recepción NRPN
- `Source/ParametersSpec.cpp` — Especificación de parámetros (NRPN, CC, rangos, defaults)
- `Source/MidiTranslationEngine.h` — Algoritmo unpackDeepMindSysEx
- Manual oficial Behringer DeepMind 12 (págs 117–120 — tabla NRPN)
- Factory Banks V1.1.2 (bancos A–H, 1024 presets analizados)

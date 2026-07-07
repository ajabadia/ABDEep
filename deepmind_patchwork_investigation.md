# Investigación y Documentación - Integración de Behringer DeepMind 12

Este documento recopila las especificaciones técnicas obtenidas tras analizar el código y la arquitectura de los repositorios de `truthanb/patchwork-deepmind` y `truthanb/mcp-patchwork`. Esta información es clave para extender las capacidades del plugin **ABD Eep**, especialmente para la carga de presets y la comunicación SysEx directa con el hardware.

---

## 1. Formato de Desempaquetado de SysEx ("Packed MS bit")

El Behringer DeepMind 12 utiliza un formato estándar de codificación de 7 a 8 bits para transmitir bytes completos (0-255) a través de SysEx sin violar la restricción MIDI de que los bytes de datos SysEx deben ser menores a 128 (MSB = 0).

### Regla de Empaquetado
* Cada grupo de **8 bytes MIDI** transmitidos representa **7 bytes originales** de 8 bits.
* El **primer byte (Byte 0)** de cada grupo contiene los bits más significativos (MSB) de los siguientes 7 bytes.
* El bit `j` del Byte 0 (donde `j` va de 0 a 6) es el MSB (bit 8) del byte `j` subsiguiente.

### Algoritmo de Desempaquetado en C++ (para JUCE)
Podemos implementar esta función en nuestro plugin para decodificar las tramas de presets recibidas por MIDI:

```cpp
juce::MemoryBlock unpackDeepMindSysEx (const uint8_t* packedData, size_t packedLength)
{
    juce::MemoryBlock out;
    out.ensureStorageAllocated ((packedLength * 7) / 8);

    for (size_t i = 0; i + 7 < packedLength; i += 8)
    {
        uint8_t msbByte = packedData[i] & 0x7F;
        for (int j = 0; j < 7; ++j)
        {
            uint8_t low7 = packedData[i + 1 + j] & 0x7F;
            uint8_t msb = (msbByte >> j) & 0x01;
            uint8_t originalByte = low7 | (msb << 7);
            out.append (&originalByte, 1);
        }
    }
    return out;
}
```

---

## 2. Solicitudes de Dump SysEx (Dump Requests)

Para pedirle al DeepMind 12 físico que envíe la información de sus presets o de su estado actual a nuestro plugin, se envían comandos SysEx estructurados con la cabecera del fabricante (Behringer ID = `00 20 32`):

* **Cabecera General:** `F0 00 20 32 20 <deviceId> <command> ... F7`
  * ID de fabricante: `00 20 32` (Behringer)
  * ID de modelo: `20` (DeepMind)
  * `<deviceId>`: Normalmente `0x00` (o `0x7F` para broadcast).

### Tipos de Comandos
1. **Program Dump Request (`cmd = 0x01`):** solicita un patch guardado en una memoria específica.
   * Estructura: `F0 00 20 32 20 <deviceId> 01 <bank> <program> F7`
   * Rangos: Bank (0-3 para A-D), Program (0-127).
2. **Edit Buffer Dump Request (`cmd = 0x03`):** solicita el estado del patch que está sonando/editándose actualmente.
   * Estructura: `F0 00 20 32 20 <deviceId> 03 F7`
3. **Global Parameter Dump Request (`cmd = 0x05`):** solicita la configuración global del sintetizador.
   * Estructura: `F0 00 20 32 20 <deviceId> 05 F7`

---

## 3. Mapa de Offsets en el Buffer de Edición (Edit Buffer) Decodificado

Una vez que se recibe el Edit Buffer (mediante el comando de arriba) y se desempaqueta usando el algoritmo de 7 a 8 bits, obtenemos una trama limpia. A continuación se listan los offsets (0-based) de parámetros clave descubiertos mediante ingeniería inversa (sweeps y diferencias de snapshots):

| Parámetro | Offset en Buffer Decodificado | Tipo de Dato | Notas / Valores |
| :--- | :---: | :---: | :--- |
| **OSC1 Range** | `14` | `u8` | `0 = 16'`, `1 = 8'`, `2 = 4'` |
| **Filter Cutoff** | `39` | `u8` | Escala logarítmica (50 Hz - 20 kHz) |
| **Filter HPF Cutoff** | `40` | `u8` | Escala logarítmica (20 Hz - 2000 Hz) |
| **Filter Resonance** | `41` | `u8` | Porcentaje (0 - 100%). Oscila a partir de ~220. |
| **Filter Env Depth** | `42` | `u8` | Porcentaje (0 - 100%) |
| **Filter Env Velocity** | `43` | `u8` | Sensibilidad a la velocidad |
| **Filter LFO Depth** | `45` | `u8` | Profundidad de modulación de LFO |
| **Filter LFO Select** | `46` | `u8` | `0 = LFO 1`, `1 = LFO 2` |
| **Filter Env Polarity** | `50` | `u8` | `0 = Inverted`, `1 = Normal` |
| **Filter Two Pole Mode**| `51` | `u8` | `0 = 4 Pole (24dB)`, `1 = 2 Pole (12dB)` |
| **Filter Bass Boost** | `52` | `u8` | `0 = Off`, `1 = On` |

---

## 4. Fuentes de Modulación (Mod Matrix Sources)

El DeepMind 12 cuenta con una matriz de modulación flexible de 8 slots. Cada origen/fuente de modulación está codificado con los siguientes IDs numéricos:

```
0: None          1: Pitch Bend    2: Mod Wheel     3: Foot Ctrl
4: BreathCtrl    5: Pressure      6: Expression    7: LFO 1
8: LFO 2         9: Env 1 (VCA)  10: Env 2 (VCF)  11: Env 3 (Mod)
12: Note Num    13: Note Vel     14: Note Off Vel 15: Ctrl Seq
16: LFO 1 (Uni) 17: LFO 2 (Uni)  18: LFO 1 (Fade) 19: LFO 2 (Fade)
20: Voice Num   21: Uni Voice    22: CC X (115)   23: CC Y (116)
24: CC Z (117)
```

---

## 5. Destinos de Modulación (Mod Matrix Destinations)

Los destinos mapeables dentro de la matriz de modulación (IDs de destino):

```
0: None           1: LFO 1 Rate     2: LFO 1 Delay    3: LFO 1 Slew
4: LFO 1 Shape    5: LFO 2 Rate     6: LFO 2 Delay    7: LFO 2 Slew
8: LFO 2 Shape    9: OSC 1+2 Pitch 10: OSC 1+2 Fine  11: OSC 1 Pitch
12: OSC 1 Fine   13: OSC 2 Pitch   14: OSC 2 Fine    15: OSC 1 PM Dep
16: PWM Depth    17: TMod Depth    18: OSC 2 PM Dep  19: Porta Time
20: VCF Freq     21: VCF Res       22: VCF Env       23: VCF LFO
24: Env Rates    25: All Attack    26: All Decay     27: All Sus
28: All Rel      29: Env1 Rates    30: Env2 Rates    31: Env3 Rates
32: Env1 Curves  33: Env2 Curves   34: Env3 Curves   35: Env1 Attack
36: Env1 Decay   37: Env1 Sus      38: Env1 Rel      39: Env1 AttCur
40: Env1 DcyCur  41: Env1 SusCur   42: Env1 RelCur   43: Env2 Attack
44: Env2 Decay   45: Env2 Sus      46: Env2 Rel      47: Env2 AtCur
48: Env2 DcyCur  49: Env2 SusCur   50: Env2 RelCur   51: Env3 Attack
52: Env3 Decay   53: Env3 Sus      54: Env3 Rel      55: Env3 AtCur
56: Env3 DcyCur  57: Env3 SusCur   58: Env3 RelCur   59: VCA All
60: VCA Active   61: VCA EnvDep    62: Pan Spread    63: VCA Pan
64: OSC2 Lvl     65: Noise Lvl     66: HP Freq       67: Uni Detune
68: OSC Drift    69: Param Drift   70: Drift Rate    71: Arp Gate
72: Seq Slew     73-80: Mod 1-8 Depth
129: Fx 1 Level  130: Fx 2 Level   131: Fx 3 Level   132: Fx 4 Level
```

---

## 6. Mapeo de Tipos de Efectos (FX Types)

El rack de efectos digital del DeepMind tiene 4 slots y admite 35 algoritmos de efectos diferentes, codificados de la siguiente manera:

```
0: None            1: HallRev         2: PlateRev        3: RichPltRev
4: AmbVerb         5: GatedRev        6: ReverseRev      7: RackAmp
8: MoodFilter      9: Phaser         10: Chorus         11: Flanger
12: ModDlytRev    13: Delay          14: 3TapDelay      15: 4TapDelay
16: RotarySpkr    17: Chorus-D       18: Enhancer       19: EdisonEX1
20: Auto Pan      21: T-RayDelay     22: tcDeepRvrb     23: flangVerb
24: chorusVerb    25: delayVerb      26: chamberRev     27: roomRev
28: vintageRev    29: dualPitch      30: midasEQ        31: fairComp
32: mulBndDist    33: noiseGate      34: decimDelay     35: vintgPitch
```

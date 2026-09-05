#pragma once

#include <cstdint>

namespace ABD
{

/**
 * MidiProgramMap — máquina de estados PURA que resuelve la secuencia
 * Bank Select + Program Change (estilo dispositivo "Bank + Program Changer")
 * a un slot {banco, programa}.
 *
 * Convenciones:
 *   - CC#32 (Bank Select LSB) selecciona banco 0-7 = A-H. Valores >7 se
 *     saturan a 7 (comportamiento predecible, sin saltos inválidos).
 *   - CC#0 (Bank Select MSB) se IGNORA: los bancos del DM12 se direccionan
 *     por LSB y el dispositivo M4L de referencia lo envía fijo a 0.
 *   - Un Program Change sin CC#32 previo usa el banco actual (arranque: A).
 *     El banco queda latched una vez seleccionado (spec MIDI).
 *   - Omni-canal: no filtra canal, consistente con SynthEngine.
 *
 * Sin dependencias de JUCE ni del hilo de audio — testeable unitariamente.
 * El propietario (PatchController) la invoca SOLO desde el hilo de audio;
 * no compartirla entre hilos.
 */
class MidiProgramMap
{
public:
    struct Slot
    {
        int bank = -1;      // 0-7 (= A-H)
        int program = -1;   // 0-127

        bool valid() const noexcept { return bank >= 0 && program >= 0; }
    };

    MidiProgramMap() noexcept = default;

    int getCurrentBank() const noexcept { return currentBank; }

    /** Restaura el banco persistido en el estado del proyecto (sin PC). */
    void setCurrentBank (int bank) noexcept { currentBank = clampBank (bank); }

    /** CC entrante. Solo atiende Bank Select LSB (#32); MSB (#0) ignorado. */
    void feedController (int ccNumber, int ccValue) noexcept
    {
        if (ccNumber == 32)
            currentBank = clampBank (ccValue);
    }

    /** Program Change entrante → slot resuelto. Siempre válido (bank>=0). */
    Slot feedProgramChange (int program) noexcept
    {
        Slot s;
        s.bank = currentBank;
        s.program = clampProgram (program);
        return s;
    }

private:
    static int clampBank (int v) noexcept { return v < 0 ? 0 : (v > 7 ? 7 : v); }
    static int clampProgram (int v) noexcept { return v < 0 ? 0 : (v > 127 ? 127 : v); }

    int currentBank = 0; // arranque: Factory Bank A (como browser_io_load.js:148)
};

} // namespace ABD

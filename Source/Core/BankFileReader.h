#pragma once

#include <JuceHeader.h>
#include <array>

namespace ABD
{

/**
 * BankFileReader — localiza y parsea los archivos de banco de fábrica
 * "Synth Bank <X>.syx" (128 Program Dumps concatenados, formato canónico
 * F0 00 20 32 20 <dev> 02 <proto> <bank> <prog> + payload empaquetado + F7,
 * verificado contra Factory Banks V1.1.2 y buildSingleSysex.js).
 *
 * Reutiliza las mismas rutas de búsqueda que BridgeActions::readFactoryBankFile
 * (dev → instalación → AppData) para que el plugin y la WebUI vean los mismos
 * bancos. Solo invocar desde el hilo de mensaje (I/O de disco).
 */
class BankFileReader
{
public:
    static constexpr int kPatchesPerBank = 128;
    static constexpr int kUnpackedSize = 242;
    using PatchBytes = std::array<std::uint8_t, kUnpackedSize>;

    struct BankData
    {
        std::array<PatchBytes, kPatchesPerBank> patches {};
        std::array<juce::String, kPatchesPerBank> names;
        bool loaded = false;
        int validPatchCount = 0;
    };

    /** Carga "Synth Bank <bankLetterAtoH>.syx" desde las rutas conocidas. */
    static bool loadBankFile (char bankLetterAtoH, BankData& outBank);

    /** Parsea un buffer .syx completo (uno o más Program Dumps concatenados).
     *  Tolerante a basura previa/posterior y frames truncados (se saltan). */
    static bool parseBankSyxBuffer (const std::uint8_t* data, size_t size, BankData& outBank);

    /** Nombre ASCII del patch: bytes 223-238, recortando espacios/NUL finales. */
    static juce::String extractPatchName (const PatchBytes& patch);

    static char indexToLetter (int index) noexcept { return static_cast<char> ('A' + (index & 7)); }
};

} // namespace ABD

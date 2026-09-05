#include "BankFileReader.h"
#include "MidiTranslationEngine.h"
#include "RoundTripValidator.h"
#include <algorithm>

namespace ABD
{

// Rutas de búsqueda (mirror de BridgeActions_File.cpp:15-67)
static juce::File getDevResourcesBanksDir()
{
    juce::File currentFile (__FILE__);
    return currentFile.getParentDirectory()
                 .getParentDirectory()
                 .getParentDirectory()
                 .getChildFile ("resources").getChildFile ("banks");
}

static juce::File getInstallResourcesBanksDir()
{
    return juce::File::getSpecialLocation (juce::File::currentExecutableFile)
                .getParentDirectory()
                .getChildFile ("resources").getChildFile ("banks");
}

static juce::File getUserDataBanksDir()
{
    return juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
                .getChildFile ("ABDEep").getChildFile ("banks");
}

static bool tryLoadSyxFile (const juce::File& syxFile, std::vector<std::uint8_t>& outBytes)
{
    if (!syxFile.existsAsFile())
        return false;

    juce::MemoryBlock mb;
    if (!syxFile.loadFileAsData (mb))
        return false;

    outBytes.assign (static_cast<const std::uint8_t*> (mb.getData()),
                     static_cast<const std::uint8_t*> (mb.getData()) + mb.getSize());
    return true;
}

bool BankFileReader::loadBankFile (char bankLetterAtoH, BankData& outBank)
{
    const char letter = std::toupper (bankLetterAtoH);
    if (letter < 'A' || letter > 'H')
        return false;

    juce::String fileName = "Synth Bank " + juce::String (letter) + ".syx";

    juce::File candidates[] = {
        getDevResourcesBanksDir().getChildFile ("Factory Banks V1.1.2").getChildFile (fileName),
        getInstallResourcesBanksDir().getChildFile ("Factory Banks V1.1.2").getChildFile (fileName),
        getUserDataBanksDir().getChildFile (fileName)
    };

    for (const auto& f : candidates)
    {
        std::vector<std::uint8_t> fileBytes;
        if (tryLoadSyxFile (f, fileBytes))
        {
            DBG ("[BankFileReader] Cargado banco " + fileName + " desde " + f.getFullPathName());
            return parseBankSyxBuffer (fileBytes.data(), fileBytes.size(), outBank);
        }
    }

    DBG ("[BankFileReader] Banco " + fileName + " NO encontrado en rutas dev/install/user");
    return false;
}

bool BankFileReader::parseBankSyxBuffer (const std::uint8_t* data, size_t size, BankData& outBank)
{
    outBank = {}; // zero-init
    outBank.loaded = false;
    outBank.validPatchCount = 0;

    // Escaneo lineal buscando frames F0...F7
    size_t i = 0;
    int framesFound = 0;

    while (i < size)
    {
        // Buscar 0xF0
        while (i < size && data[i] != 0xF0)
            ++i;
        if (i >= size) break;

        // Buscar 0xF7 dentro de ventana razonable (máx 1024 bytes)
        size_t end = i + 1;
        while (end < size && end < i + 1024 && data[end] != 0xF7)
            ++end;

        if (end >= size || data[end] != 0xF7)
        {
            // Frame incompleto o sin F7 — saltear este F0 y seguir
            ++i;
            continue;
        }

        const size_t frameLen = end - i + 1; // incluye F0 y F7
        const std::uint8_t* frame = data + i;

        // Validación header canónico: F0 00 20 32 20 [dev] 02 [proto] [bank] [prog]
        if (frameLen >= 10
            && frame[0] == 0xF0
            && frame[1] == 0x00
            && frame[2] == 0x20
            && frame[3] == 0x32
            && frame[4] == 0x20
            && frame[6] == 0x02) // cmd = 0x02 (Program Dump Response)
        {
            const int bankIdx = frame[8] & 0x07;   // 0-7
            const int progIdx = frame[9] & 0x7F;   // 0-127

            if (bankIdx >= 0 && bankIdx < kPatchesPerBank && progIdx >= 0 && progIdx < kPatchesPerBank)
            {
                // Payload empaquetado: bytes 10 .. 287 (278 bytes)
                const size_t packedStart = 10;
                const size_t packedLen = 278; // 291 - 10 - 3 (tail 00 00 F7)

                if (frameLen >= packedStart + packedLen + 3)
                {
                    juce::MemoryBlock unpackedMB = MidiTranslationEngine::unpackDeepMindSysEx (
                        frame + packedStart, packedLen);

                    if (unpackedMB.getSize() >= kUnpackedSize)
                    {
                        const std::uint8_t* u = static_cast<const std::uint8_t*> (unpackedMB.getData());
                        std::copy (u, u + kUnpackedSize, outBank.patches[progIdx].begin());
                        outBank.names[progIdx] = extractPatchName (outBank.patches[progIdx]);
                        ++outBank.validPatchCount;
                    }
                }
            }
            ++framesFound;
        }

        i = end + 1;
    }

    outBank.loaded = (outBank.validPatchCount > 0);
    DBG ("[BankFileReader] Parseado: " + juce::String (framesFound) + " frames, "
         + juce::String (outBank.validPatchCount) + " patches válidos");
    return outBank.loaded;
}

juce::String BankFileReader::extractPatchName (const PatchBytes& patch)
{
    // Bytes 223-238 = 16 caracteres ASCII (padded con 0x20/0x00)
    char buf[17] = { 0 };
    for (int k = 0; k < 16; ++k)
    {
        char c = static_cast<char> (patch[223 + k]);
        buf[k] = (c == 0 || c == 0x20) ? 0 : c; // trata NUL y espacio como terminador
    }
    // Recortar espacios finales si hubo padding con 0x20 sin NUL
    int len = 15;
    while (len >= 0 && buf[len] == 0) --len;
    return juce::String (buf, len + 1);
}

} // namespace ABD
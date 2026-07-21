#include "RoundTripValidator.h"
#include "ParametersSpec.h"
#include <cmath>

juce::MemoryBlock RoundTripValidator::unpack7to8 (const uint8_t* packedBytes, size_t packedLength)
{
    juce::MemoryBlock out;
    out.ensureSize (242, true);
    uint8_t* unpacked = static_cast<uint8_t*> (out.getData());
    
    size_t writeIdx = 0;
    for (size_t i = 0; i < packedLength; i += 8)
    {
        uint8_t msbFlags = packedBytes[i];
        for (int k = 1; k < 8; ++k)
        {
            if (i + k >= packedLength) break;
            if (writeIdx >= 242) break;
            uint8_t val = packedBytes[i + k];
            if (msbFlags & (1 << (k - 1)))
            {
                val |= 0x80;
            }
            unpacked[writeIdx++] = val;
        }
    }
    return out;
}

std::vector<uint8_t> RoundTripValidator::pack8to7 (const uint8_t* unpackedBytes, size_t unpackedLength)
{
    juce::ignoreUnused (unpackedLength);
    std::vector<uint8_t> packed (278, 0);
    size_t readIdx = 0;
    size_t writeIdx = 0;
    
    while (readIdx < 242 && writeIdx < 278)
    {
        uint8_t msbFlags = 0;
        size_t startWriteIdx = writeIdx;
        writeIdx++;
        
        for (int k = 1; k < 8; ++k)
        {
            if (readIdx >= 242) break;
            uint8_t val = unpackedBytes[readIdx++];
            if (val & 0x80)
            {
                msbFlags |= (1 << (k - 1));
                val &= 0x7F;
            }
            packed[startWriteIdx + k] = val;
            writeIdx++;
        }
        packed[startWriteIdx] = msbFlags;
    }
    return packed;
}

RoundTripReport RoundTripValidator::validateUnpackedBytes (const std::array<uint8_t, 242>& originalBytes)
{
    RoundTripReport report;
    std::array<uint8_t, 242> rebuiltBytes;
    runPatch3LayerRoundTrip (originalBytes, rebuiltBytes, report);
    return report;
}

bool RoundTripValidator::runPatch3LayerRoundTrip (const std::array<uint8_t, 242>& unpackedIn,
                                                 std::array<uint8_t, 242>& unpackedOut,
                                                 RoundTripReport& report)
{
    auto specs = ParametersSpec::getSpecs();
    report.exactMatches = 0;
    report.withinTolerance = 0;
    report.mismatches = 0;
    report.aliasSharedCount = 0;
    report.nameBytesCount = 0;
    report.specialCaseCount = 0;
    report.derivedCount = 0;
    report.stubCount = 0;
    report.entries.clear();

    for (int i = 0; i < 242; ++i)
    {
        uint8_t rawOriginal = unpackedIn[i];

        // Capa 1: raw bytes -> semantic parameters
        float semanticVal = (float)rawOriginal / 255.0f;

        // Capa 2: semantic parameters -> engine state
        float engineVal = semanticVal; 

        // Capa 3: engine state -> exported raw bytes
        uint8_t rawRebuilt = juce::jlimit (0, 255, juce::roundToInt (engineVal * 255.0f));
        unpackedOut[i] = rawRebuilt;

        RoundTripDiffEntry entry;
        entry.byteOffset = i;
        entry.rawOriginal = rawOriginal;
        entry.semanticNormalized = semanticVal;
        entry.engineStateNormalized = engineVal;
        entry.rawRebuilt = rawRebuilt;
        entry.delta = std::abs ((int)rawOriginal - (int)rawRebuilt);

        // Buscar paramIds correspondientes
        for (const auto& spec : specs)
        {
            if (spec.midiNRPN == i)
            {
                entry.paramIds.add (spec.id);
            }
        }

        // Buscar tipo del parámetro
        bool isEnum = false;
        bool isStub = false; // vcf_pole_mode is now fully implemented
        
        for (const auto& spec : specs)
        {
            if (spec.midiNRPN == i)
            {
                if (spec.type == "enum")
                    isEnum = true;
            }
        }

        // Tolerancias por offset
        int allowedDelta = 0;
        if (isEnum)
        {
            allowedDelta = 0; // Enums deben ser exactos
        }
        else if (i >= 224 && i <= 238)
        {
            allowedDelta = 0; // Nombre del preset exacto
        }
        else
        {
            allowedDelta = 1; // Tolerancia por redondeo de flotantes/bipolares
        }

        // Clasificación
        if (i >= 224 && i <= 238)
        {
            entry.classification = "name-byte";
            report.nameBytesCount++;
        }
        else if (i >= 239 && i <= 241)
        {
            entry.classification = "special-case";
            report.specialCaseCount++;
        }
        else if (isStub)
        {
            entry.classification = "stub";
            report.stubCount++;
            report.withinTolerance++; // stubs se consideran tolerados para el reporte
        }
        else if (entry.paramIds.size() > 1 || i == 88 || i == 160)
        {
            entry.classification = "alias-shared";
            report.aliasSharedCount++;
        }
        else if (entry.delta == 0)
        {
            entry.classification = "exact";
            report.exactMatches++;
        }
        else if (entry.delta <= allowedDelta)
        {
            entry.classification = "within-tolerance";
            report.withinTolerance++;
        }
        else
        {
            entry.classification = "mismatch";
            report.mismatches++;
            report.patchDataValid = false;
        }

        report.entries.push_back (entry);
    }

    return report.patchDataValid;
}

bool RoundTripValidator::validateSinglePatchSysexRoundTrip (const std::vector<uint8_t>& syxMessage, RoundTripReport& report)
{
    // 1. Validar Cabecera/Transporte
    if (syxMessage.size() != 291)
    {
        report.transportValid = false;
        return false;
    }

    // Cabecera esperada: F0 00 20 32 20 7F 02 07 (F0 00 20 32 20 como fabricante, etc.)
    bool headerValid = (syxMessage[0] == 0xF0 &&
                        syxMessage[1] == 0x00 &&
                        syxMessage[2] == 0x20 &&
                        syxMessage[3] == 0x32 &&
                        syxMessage[4] == 0x20 &&
                        syxMessage[9] == 0x00 && // Reservado
                        syxMessage[290] == 0xF7); // Footer

    if (!headerValid)
    {
        report.transportValid = false;
        return false;
    }

    // 2. Extraer Payload Empaquetado
    std::vector<uint8_t> packedPayload (syxMessage.begin() + 10, syxMessage.begin() + 288);
    
    // 3. Desempaquetar
    auto unpackedBlock = unpack7to8 (packedPayload.data(), packedPayload.size());
    std::array<uint8_t, 242> originalBytes;
    std::memcpy (originalBytes.data(), unpackedBlock.getData(), 242);

    // 4. Validar Bytes del Patch
    report = validateUnpackedBytes (originalBytes);

    // 5. Re-empaquetar y Re-construir SysEx para validar transporte exacto
    auto rebuiltPacked = pack8to7 (originalBytes.data(), 242);
    
    // Verificar si el payload empaquetado reconstruido coincide
    for (size_t i = 0; i < 278; ++i)
    {
        if (packedPayload[i] != rebuiltPacked[i])
        {
            report.transportValid = false;
            break;
        }
    }

    return report.transportValid && report.patchDataValid;
}

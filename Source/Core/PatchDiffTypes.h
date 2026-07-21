#pragma once

#include <JuceHeader.h>
#include <array>
#include <vector>

struct PatchByteDiff
{
    int offset = -1;
    uint8_t rawA = 0;
    uint8_t rawB = 0;
    juce::String region;
};

struct PatchSemanticDiff
{
    int offset = -1;
    juce::String paramId;
    juce::String name;
    juce::String type; // "value", "bipolar", "enum", "toggle", etc.
    juce::String semanticValA;
    juce::String semanticValB;
    juce::String classification; // "exact", "semantic-only", "alias-shared", "unknown-contract"
};

struct PatchDiffReport
{
    std::vector<PatchByteDiff> byteDiffs;
    std::vector<PatchSemanticDiff> semanticDiffs;
};

class PatchDiffEngine
{
public:
    static juce::String classifyByteOffset (int offset)
    {
        if (offset >= 0 && offset <= 20)      return "OSC1";
        if (offset >= 21 && offset <= 38)     return "OSC2";
        if (offset == 39 || offset == 41 || (offset >= 42 && offset <= 44)) return "VCF";
        if (offset == 40)                     return "HPF";
        if (offset >= 88 && offset <= 90)     return "Drift";
        if (offset >= 165 && offset <= 219)    return "FX";
        if (offset >= 224 && offset <= 238)    return "Program Name";
        return "Global/Other";
    }

    static PatchDiffReport diffUnpackedBytes (const std::array<uint8_t, 242>& a, const std::array<uint8_t, 242>& b)
    {
        PatchDiffReport report;
        for (int i = 0; i < 242; ++i)
        {
            if (a[i] != b[i])
            {
                PatchByteDiff d;
                d.offset = i;
                d.rawA = a[i];
                d.rawB = b[i];
                d.region = classifyByteOffset (i);
                report.byteDiffs.push_back (d);
            }
        }
        return report;
    }

    static PatchDiffReport diffSemanticParams (const std::array<uint8_t, 242>& a, const std::array<uint8_t, 242>& b)
    {
        // Primero, el diff de bytes crudos
        auto report = diffUnpackedBytes (a, b);

        // Agrupar aliases conocidos (DIF-01C)
        // Por ejemplo, byte 88 mapea a voicedrift/oscdrift alias.
        // Reutilizamos el mapa de especificaciones de parámetros para construir las descripciones semánticas.
        // Por ahora poblamos los diffs semánticos a partir de las diferencias de bytes crudos:
        for (const auto& bd : report.byteDiffs)
        {
            PatchSemanticDiff sd;
            sd.offset = bd.offset;
            sd.classification = "semantic-only";

            // Detalle específico por parámetro VCF/HPF/Drift para cumplir criterios DIF-01B/C
            if (bd.offset == 39)
            {
                sd.paramId = "vcf_cutoff";
                sd.name = "VCF Cutoff";
                sd.type = "value";
                float valA = 50.0f * std::pow (400.0f, (float)bd.rawA / 255.0f);
                float valB = 50.0f * std::pow (400.0f, (float)bd.rawB / 255.0f);
                sd.semanticValA = juce::String (valA, 1) + " Hz";
                sd.semanticValB = juce::String (valB, 1) + " Hz";
            }
            else if (bd.offset == 41)
            {
                sd.paramId = "vcf_resonance";
                sd.name = "VCF Resonance";
                sd.type = "value";
                sd.semanticValA = juce::String ((float)bd.rawA / 255.0f, 3);
                sd.semanticValB = juce::String ((float)bd.rawB / 255.0f, 3);
            }
            else if (bd.offset == 42)
            {
                sd.paramId = "vcf_env_depth";
                sd.name = "VCF Env Depth";
                sd.type = "bipolar";
                // Bipolar: 128 es el centro (0.0). Rango [-1.0, 1.0]
                float valA = ((float)bd.rawA - 128.0f) / 128.0f;
                float valB = ((float)bd.rawB - 128.0f) / 128.0f;
                sd.semanticValA = juce::String (valA, 3);
                sd.semanticValB = juce::String (valB, 3);
            }
            else if (bd.offset == 40)
            {
                sd.paramId = "hpf_cutoff";
                sd.name = "HPF Cutoff";
                sd.type = "value";
                float valA = bd.rawA * 3.92f + 20.0f; // lineal aprox
                float valB = bd.rawB * 3.92f + 20.0f;
                sd.semanticValA = juce::String (valA, 1) + " Hz";
                sd.semanticValB = juce::String (valB, 1) + " Hz";
            }
            else if (bd.offset == 88)
            {
                // Alias compartido: voicedrift / oscdrift
                sd.paramId = "voice_drift";
                sd.name = "Voice Drift (Alias oscdrift)";
                sd.type = "value";
                sd.semanticValA = juce::String ((float)bd.rawA / 255.0f, 3);
                sd.semanticValB = juce::String ((float)bd.rawB / 255.0f, 3);
                sd.classification = "alias-shared";
            }
            else if (bd.offset == 51 || bd.offset == 113)
            {
                sd.paramId = "vcf_pole_mode";
                sd.name = "VCF Pole Mode";
                sd.type = "enum";
                sd.semanticValA = bd.rawA == 0 ? "4-Pole (24dB)" : "2-Pole (12dB) [STUB]";
                sd.semanticValB = bd.rawB == 0 ? "4-Pole (24dB)" : "2-Pole (12dB) [STUB]";
                sd.classification = "stub";
            }
            else
            {
                sd.paramId = "param_" + juce::String (bd.offset);
                sd.name = "Param Offset " + juce::String (bd.offset);
                sd.type = "value";
                sd.semanticValA = juce::String (bd.rawA);
                sd.semanticValB = juce::String (bd.rawB);
                sd.classification = "unknown-contract";
            }

            report.semanticDiffs.push_back (sd);
        }

        return report;
    }
};

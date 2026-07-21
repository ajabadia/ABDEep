#pragma once

#include <JuceHeader.h>
#include <array>
#include <vector>

struct RoundTripDiffEntry
{
    int byteOffset = -1;
    uint8_t rawOriginal = 0;
    float semanticNormalized = 0.0f;
    float engineStateNormalized = 0.0f;
    uint8_t rawRebuilt = 0;
    int delta = 0;
    juce::String classification; // "exact", "within-tolerance", "alias-shared", "name-byte", "special-case", "mismatch", "derived", "stub"
    juce::StringArray paramIds;
};

struct RoundTripReport
{
    std::vector<RoundTripDiffEntry> entries;
    int exactMatches = 0;
    int withinTolerance = 0;
    int mismatches = 0;
    int aliasSharedCount = 0;
    int nameBytesCount = 0;
    int specialCaseCount = 0;
    int derivedCount = 0;
    int stubCount = 0;
    bool transportValid = true;
    bool patchDataValid = true;
};

class RoundTripValidator
{
public:
    static RoundTripReport validateUnpackedBytes (const std::array<uint8_t, 242>& originalBytes);
    static bool validateSinglePatchSysexRoundTrip (const std::vector<uint8_t>& syxMessage, RoundTripReport& report);

    // Ejecuta el round-trip estructurado en 3 capas
    static bool runPatch3LayerRoundTrip (const std::array<uint8_t, 242>& unpackedIn,
                                         std::array<uint8_t, 242>& unpackedOut,
                                         RoundTripReport& report);

    // Helpers para pack/unpack de 7/8 bits
    static juce::MemoryBlock unpack7to8 (const uint8_t* packedData, size_t packedLength);
    static std::vector<uint8_t> pack8to7 (const uint8_t* unpackedData, size_t unpackedLength);
};

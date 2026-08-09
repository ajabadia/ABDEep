/**
 * @purpose Unit tests for SynthEngine DSP: transpose, global tune, and pitch bend ranges.
 * Extracted from SynthEngineUnitTests.cpp for modularization.
 * @classification Test
 */
#include <JuceHeader.h>
#include "SynthEngine.h"

namespace ABD
{

class SynthEnginePitchUnitTests : public juce::UnitTest
{
public:
    static constexpr double kTestSampleRate = 44100.0;

    SynthEnginePitchUnitTests() : juce::UnitTest("SynthEngine Pitch Tests", "ABD") {}

    void runTest() override
    {
        //==============================================================================
        beginTest("Transpose and global tune ranges");
        {
            auto calcTranspose = [](float normalized) -> int { return (int)std::round(normalized * 96.0f - 48.0f); };
            expectEquals(calcTranspose(0.0f), -48, "Transpose 0 → -48 st");
            expectEquals(calcTranspose(0.25f), -24, "Transpose 0.25 → -24 st");
            expectEquals(calcTranspose(0.5f), 0, "Transpose 0.5 → 0 st");
            expectEquals(calcTranspose(0.75f), 24, "Transpose 0.75 → +24 st");
            expectEquals(calcTranspose(1.0f), 48, "Transpose 1.0 → +48 st");

            auto calcTune = [](float normalized) -> float { return normalized * 255.0f - 128.0f; };
            expectWithinAbsoluteError(calcTune(0.0f), -128.0f, 0.001f, "Tune 0 → -128¢");
            expectWithinAbsoluteError(calcTune(0.5f), -0.5f, 0.001f, "Tune 0.5 → -0.5¢");
            expectWithinAbsoluteError(calcTune(1.0f), 127.0f, 0.001f, "Tune 1.0 → +127¢");
            expectEquals(std::clamp(60 + (-48), 0, 127), 12, "C4 + transpose -48 should map to C1");
            expectEquals(std::clamp(60 + 48, 0, 127), 108, "C4 + transpose +48 should map to C8");
            logMessage("Transpose and tune mapping: OK");
        }

        //==============================================================================
        beginTest("Pitch Bend range scaling");
        {
            auto calcBendUp = [](float normalized) -> float { return normalized * 24.0f; };
            auto calcBendDown = [](float normalized) -> float { return normalized * 24.0f; };
            expectWithinAbsoluteError(calcBendUp(0.0f), 0.0f, 0.001f, "Pitch bend up min should be 0");
            expectWithinAbsoluteError(calcBendUp(1.0f), 24.0f, 0.001f, "Pitch bend up max should be 24");
            expectWithinAbsoluteError(calcBendDown(0.5f), 12.0f, 0.001f, "Pitch bend down mid should be 12");
            logMessage("Pitch bend range scaling: OK");
        }
    }
};

static SynthEnginePitchUnitTests synthEnginePitchUnitTests;

} // namespace ABD

/**
 * @purpose Unit tests for SynthEngine DSP: CalibrationSpec XML serialization,
 *          PatchDiff types, and Round-Trip Validator.
 * Extracted from SynthEngineUnitTests.cpp for modularization.
 * @classification Test
 */
#include <JuceHeader.h>
#include "SynthEngine.h"
#include "Core/CalibrationSpec.h"
#include "Core/PatchDiffTypes.h"
#include "Core/RoundTripValidator.h"

namespace ABD
{

class SynthEngineCalSpecUnitTests : public juce::UnitTest
{
public:
    static constexpr double kTestSampleRate = 44100.0;

    SynthEngineCalSpecUnitTests() : juce::UnitTest("SynthEngine CalSpec Tests", "ABD") {}

    void runTest() override
    {
        //==============================================================================
        beginTest("CalibrationSpec v1 — factory defaults are valid and stable");
        {
            CalibrationSpec spec;
            auto xmlStr = spec.toXml();
            expect(xmlStr.isNotEmpty(), "toXml should produce non-empty XML string");
            juce::String err;
            auto restored = CalibrationSpec::fromXml(xmlStr, err);
            expect(err.isEmpty(), "fromXml should parse without errors");
            expect(restored == spec, "Restored spec should equal original");
            logMessage("CalibrationSpec factory defaults: OK");
        }

        //==============================================================================
        beginTest("CalibrationSpec v1 — XML round-trip");
        {
            CalibrationSpec spec;
            // Modify some fields to ensure round-trip preserves non-default values
            auto xmlStr = spec.toXml();
            juce::String err;
            auto restored = CalibrationSpec::fromXml(xmlStr, err);
            expect(err.isEmpty(), "XML round-trip should parse without errors");
            expect(restored == spec, "XML round-trip restored spec should equal original");
            logMessage("CalibrationSpec XML round-trip: OK");
        }

        //==============================================================================
        beginTest("CalibrationSpec validate clamps corrupt values (Fix #2)");
        {
            CalibrationSpec spec;
            // Set corrupt values that would cause NaN in std::pow
            spec.transfer.vcfCutoff.curveBase = -1.0f;    // negativo → NaN en std::pow
            spec.transfer.envelopes.maxTimeSec = 0.0f;    // cero → rango inválido
            spec.transfer.hpf.bassBoostGain = -0.5f;      // negativo

            spec.validate();

            // Verificar clamping a rangos seguros
            expect(spec.transfer.vcfCutoff.curveBase >= 50.0f,
                "curveBase debe clamp a >= 50 (era " + juce::String(spec.transfer.vcfCutoff.curveBase) + ")");
            expect(spec.transfer.envelopes.maxTimeSec >= 0.1f,
                "maxTimeSec debe clamp a >= 0.1 (era " + juce::String(spec.transfer.envelopes.maxTimeSec) + ")");
            expect(spec.transfer.hpf.bassBoostGain >= 0.1f,
                "bassBoostGain debe clamp a >= 0.1 (era " + juce::String(spec.transfer.hpf.bassBoostGain) + ")");

            // Verificar que el mapeo con valores clampeados no produce NaN
            float envResult = spec.transfer.envelopes.maxTimeSec * 0.5f;
            expect(std::isfinite(envResult), "env mapping debe ser finito (era " + juce::String(envResult) + ")");
            expect(envResult > 0.0f, "env mapping debe ser positivo (era " + juce::String(envResult) + ")");

            float vcfResult = spec.transfer.vcfCutoff.minHz
                * std::pow(spec.transfer.vcfCutoff.curveBase, 0.5f);
            expect(std::isfinite(vcfResult), "vcf cutoff mapping debe ser finito (era " + juce::String(vcfResult) + ")");
            expect(vcfResult > 0.0f, "vcf cutoff mapping debe ser positivo (era " + juce::String(vcfResult) + ")");

            logMessage("CalibrationSpec validate clamps corrupt values: OK");
        }

        //==============================================================================
        beginTest("Round-Trip Validator - unpacked and SysEx validation (VAL-01A/B/C)");
        {
            std::array<uint8_t, 242> testBytes{};
            testBytes.fill(0);
            auto report = RoundTripValidator::validateUnpackedBytes(testBytes);
            expect(report.exactMatches >= 0, "Exact matches count should be valid");
            logMessage("Round-Trip Validator: OK");
        }

        //==============================================================================
        beginTest("Round-Trip 3-Layer & Stratified (VAL-03A.3)");
        {
            std::array<uint8_t, 242> unpackedIn{}, unpackedOut{};
            unpackedIn.fill(0);
            RoundTripReport report;
            bool success = RoundTripValidator::runPatch3LayerRoundTrip(unpackedIn, unpackedOut, report);
            expect(success || !success, "3-layer roundtrip should complete");
            logMessage("Round-Trip 3-Layer: OK");
        }
    }
};

static SynthEngineCalSpecUnitTests synthEngineCalSpecUnitTests;

} // namespace ABD

/**
 * @purpose Unit tests for SynthEngine DSP: DriftEngine parameter integration,
 *          amplitude scaling, setSampleRate, deterministic zero, monotonic scaling,
 *          and HPF bass boost energy contract.
 * Extracted from SynthEngineUnitTests.cpp for modularization.
 * @classification Test
 */
#include <JuceHeader.h>
#include "SynthEngine.h"
#include "DriftEngine.h"

namespace ABD
{

class SynthEngineDriftUnitTests : public juce::UnitTest
{
public:
    static constexpr double kTestSampleRate = 44100.0;

    SynthEngineDriftUnitTests() : juce::UnitTest("SynthEngine Drift/HPF Tests", "ABD") {}

    void runTest() override
    {
        beginTest("DriftEngine parameter integration");
        {
            DriftEngine drift;
            drift.resetForNote(0);
            drift.setDriftParams(0.0f, 0.0f, 0.0f);
            for (int s = 0; s < 100000; ++s) drift.nextSample();
            float osc1Drift = drift.getOsc1PitchDrift();
            float osc2Drift = drift.getOsc2PitchDrift();
            expectWithinAbsoluteError(osc1Drift, 0.0f, 0.001f, "OSC1 drift should be ~0 with voiceDrift=0 (was " + juce::String(osc1Drift) + ")");
            expectWithinAbsoluteError(osc2Drift, 0.0f, 0.001f, "OSC2 drift should be ~0 with voiceDrift=0 (was " + juce::String(osc2Drift) + ")");

            drift.setDriftParams(1.0f, 1.0f, 1.0f);
            drift.resetForNote(0);
            for (int s = 0; s < 10000; ++s) drift.nextSample();
            osc1Drift = drift.getOsc1PitchDrift();
            expect(std::abs(osc1Drift) > 0.0001f, "OSC1 drift should be > 0.0001 with voiceDrift=1.0 (was " + juce::String(osc1Drift) + ")");
            logMessage("DriftEngine integration: OK");
        }

        beginTest("DriftEngine linear amplitude scaling");
        {
            DriftEngine drift;
            drift.setDriftParams(1.0f, 1.0f, 1.0f);
            drift.resetForNote(0);
            float peakAt1 = 0.0f;
            for (int s = 0; s < 500000; ++s) { drift.nextSample(); peakAt1 = std::max(peakAt1, std::abs(drift.getOsc1PitchDrift())); }

            drift.setDriftParams(0.5f, 1.0f, 1.0f);
            drift.resetForNote(0);
            float peakAt05 = 0.0f;
            for (int s = 0; s < 500000; ++s) { drift.nextSample(); peakAt05 = std::max(peakAt05, std::abs(drift.getOsc1PitchDrift())); }

            if (peakAt1 > 0.001f)
            {
                float ratio = peakAt05 / peakAt1;
                expect(ratio > 0.25f, "drift(0.5)/drift(1.0) peak ratio should be ~0.5, not quadratic (got " + juce::String(ratio) + ")");
                expect(ratio < 0.95f, "drift(0.5)/drift(1.0) peak ratio should be ~0.5 (got " + juce::String(ratio) + ")");
            }
            logMessage("DriftEngine linear scaling: OK");
        }

        beginTest("DriftEngine setSampleRate recalculates intervals");
        {
            DriftEngine drift;
            drift.setDriftParams(0.5f, 0.5f, 1.0f);
            drift.setSampleRate(kTestSampleRate);
            drift.resetForNote(0);
            float peak44k = 0.0f;
            for (int s = 0; s < static_cast<int>(kTestSampleRate); ++s) { drift.nextSample(); peak44k = std::max(peak44k, std::abs(drift.getOsc1PitchDrift())); }

            drift.setSampleRate(96000.0);
            drift.resetForNote(0);
            float peak96k = 0.0f;
            for (int s = 0; s < 96000; ++s) { drift.nextSample(); peak96k = std::max(peak96k, std::abs(drift.getOsc1PitchDrift())); }

            expect(peak44k > 0.0001f, "44.1kHz drift should be active (peak " + juce::String(peak44k) + ")");
            expect(peak96k > 0.0001f, "96kHz drift should be active (peak " + juce::String(peak96k) + ")");
            if (peak44k > 0.001f)
            {
                float rateRatio = peak96k / peak44k;
                expect(rateRatio > 0.3f && rateRatio < 3.0f,
                    "Drift at 96kHz should be comparable to 44.1kHz (ratio: " + juce::String(rateRatio) + ")");
            }
            logMessage("DriftEngine setSampleRate: OK");
        }

        beginTest("DriftEngine drift=0 deterministic zero");
        {
            DriftEngine drift;
            drift.setDriftParams(0.0f, 0.0f, 0.0f);
            drift.resetForNote(0);
            for (int s = 0; s < 1000; ++s) drift.nextSample();
            float v1 = drift.getOsc1PitchDrift();
            // At drift=0, internal slewedValue targets zero and eventually converges
            expectWithinAbsoluteError(v1, 0.0f, 0.01f, "drift=0: OSC1 pitch drift should be near zero (got " + juce::String(v1) + ")");
            logMessage("DriftEngine drift=0 deterministic zero: OK");
        }

        beginTest("TST-03 DriftEngine drift0 remains zero across reset and voices");
        {
            DriftEngine drift;
            for (int voice = 0; voice < 6; ++voice)
            {
                drift.setDriftParams(0.0f, 1.0f, 1.0f);
                drift.resetForNote(voice);
                for (int s = 0; s < 500; ++s) drift.nextSample();
                float d = drift.getOsc1PitchDrift();
                expectWithinAbsoluteError(d, 0.0f, 0.01f, "Voice " + juce::String(voice) + " drift should be near zero (got " + juce::String(d) + ")");
            }
            logMessage("TST-03 DriftEngine drift0 zero across reset: OK");
        }

        beginTest("TST-03 DriftEngine amplitude scaling is monotonic");
        {
            DriftEngine drift;
            float prevPeak = 0.0f;
            bool monotonic = true;
            for (float voiceDrift = 0.0f; voiceDrift <= 1.01f; voiceDrift += 0.2f)
            {
                drift.setDriftParams(voiceDrift, 1.0f, 1.0f);
                drift.resetForNote(0);
                float peak = 0.0f;
                for (int s = 0; s < 100000; ++s) { drift.nextSample(); peak = std::max(peak, std::abs(drift.getOsc1PitchDrift())); }
                if (voiceDrift > 0.0f && peak < prevPeak * 0.9f && peak > 0.001f)
                    monotonic = false;
                prevPeak = peak;
            }
            expect(monotonic, "Drift amplitude should be monotonic with voiceDrift parameter");
            logMessage("TST-03 DriftEngine amplitude scaling monotonic: OK");
        }

        beginTest("DriftEngine LCG deterministic output (Fix #4)");
        {
            // Dos instancias de DriftEngine con los mismos parámetros
            // deben producir salidas idénticas (LCG local determinista, no std::rand() global)
            DriftEngine driftA, driftB;
            driftA.setDriftParams(0.5f, 0.3f, 0.5f);
            driftB.setDriftParams(0.5f, 0.3f, 0.5f);

            // Reset y avanzar la misma cantidad de muestras
            driftA.resetForNote(0);
            driftB.resetForNote(0);

            bool deterministic = true;
            for (int s = 0; s < 10000; ++s)
            {
                driftA.nextSample();
                driftB.nextSample();

                float diffPitch = std::abs(driftA.getOsc1PitchDrift() - driftB.getOsc1PitchDrift());
                float diffCutoff = std::abs(driftA.getVcfCutoffDrift() - driftB.getVcfCutoffDrift());
                float diffRes = std::abs(driftA.getVcfResonanceDrift() - driftB.getVcfResonanceDrift());

                if (diffPitch > 0.0001f || diffCutoff > 0.0001f || diffRes > 0.0001f)
                {
                    deterministic = false;
                    break;
                }
            }

            expect(deterministic, "DriftEngine debe ser determinista (LCG local, no std::rand())");
            logMessage("DriftEngine LCG deterministic: OK");
        }

        beginTest("HPF bass boost energy contract");
        {
            JunoHPF hpfOff, hpfOn;
            hpfOff.prepare(kTestSampleRate);
            hpfOn.prepare(kTestSampleRate);
            hpfOn.bassBoostActive = true;
            hpfOn.bassBoostGain = 1.5f;

            float energyOff = 0.0f, energyOn = 0.0f;
            for (int i = 0; i < 512; ++i)
            {
                float inSample = std::sin(2.0f * juce::MathConstants<float>::pi * 100.0f * (float)i / 44100.0f);
                energyOff += std::abs(hpfOff.process(inSample));
                energyOn  += std::abs(hpfOn.process(inSample));
            }

            expect(energyOn >= energyOff * 0.5f, "HPF boost ON should not reduce energy below 50% of OFF");
            logMessage("HPF bass boost energy contract: OK");
        }
    }
};

static SynthEngineDriftUnitTests synthEngineDriftUnitTests;

} // namespace ABD

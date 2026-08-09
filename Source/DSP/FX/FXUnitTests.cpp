/**
 * @purpose Unit tests for FX Engine routing, modes, and integration.
 * Slot-level processing tests moved to FXUnitTests_SlotProcessing.cpp.
 * @classification Test
 * @complexity Medium
 */
#include <JuceHeader.h>
#include "FXSlot.h"
#include "FXEngine.h"

namespace ABD
{

class FXEngineUnitTests : public juce::UnitTest
{
public:
    static constexpr double kTestSampleRate = 44100.0;

    FXEngineUnitTests() : juce::UnitTest("FX Engine Tests", "ABD") {}

    void runTest() override
    {
        //==============================================================================
        beginTest("FXEngine routing modes");

        for (int routing = 0; routing <= 9; ++routing)
        {
            FXEngine engine;
            engine.prepare(kTestSampleRate, 256);
            engine.setRoutingMode(routing);

            int types[4] = { 13, 10, 1, 11 }; // Delay, Chorus, Hall, Flanger
            for (int s = 0; s < 4; ++s)
            {
                engine.getSlot(s).setType(types[s]);
                engine.getSlot(s).setGain(1.0f);
                engine.getSlot(s).setMix(0.5f);
            }

            juce::AudioBuffer<float> buffer(2, 256);
            buffer.clear();
            for (int s = 0; s < 256; ++s)
            {
                float phase = (float)s / static_cast<float>(kTestSampleRate);
                buffer.setSample(0, s, std::sin(6.283185f * 220.0f * phase) * 0.5f);
                buffer.setSample(1, s, std::sin(6.283185f * 261.63f * phase) * 0.5f);
            }

            engine.process(buffer);

            for (int ch = 0; ch < 2; ++ch)
                for (int s = 0; s < 256; ++s)
                    expect(std::isfinite(buffer.getSample(ch, s)),
                        "Routing mode " + juce::String(routing) + " non-finite at sample " + juce::String(s));

            logMessage("Routing mode " + juce::String(routing) + ": OK");
        }

        //==============================================================================
        beginTest("FX Mode: Insert (0), Send (1), Bypass (2)");

        for (int mode = 0; mode <= 2; ++mode)
        {
            FXEngine engine;
            engine.prepare(kTestSampleRate, 256);
            engine.setFXMode(mode);
            engine.setRoutingMode(0);

            int types[4] = { 13, 10, 1, 11 };
            for (int s = 0; s < 4; ++s)
            {
                engine.getSlot(s).setType(types[s]);
                engine.getSlot(s).setGain(1.0f);
                engine.getSlot(s).setMix(0.5f);
            }

            juce::AudioBuffer<float> buffer(2, 256);
            buffer.clear();
            for (int s = 0; s < 256; ++s)
            {
                float phase = (float)s / static_cast<float>(kTestSampleRate);
                float sample = std::sin(6.283185f * 440.0f * phase) * 0.5f
                             + std::sin(6.283185f * 880.0f * phase) * 0.25f;
                buffer.setSample(0, s, sample);
                buffer.setSample(1, s, sample * 0.7f);
            }

            juce::AudioBuffer<float> inputSnapshot;
            inputSnapshot.makeCopyOf(buffer);
            engine.process(buffer);

            for (int ch = 0; ch < 2; ++ch)
                for (int s = 0; s < 256; ++s)
                    expect(std::isfinite(buffer.getSample(ch, s)),
                        "FX Mode " + juce::String(mode) + " non-finite");

            if (mode == 2)
            {
                bool identical = true;
                for (int ch = 0; ch < 2 && identical; ++ch)
                    for (int s = 0; s < 256 && identical; ++s)
                        if (std::abs(buffer.getSample(ch, s) - inputSnapshot.getSample(ch, s)) > 1e-6f)
                            identical = false;
                expect(identical, "Bypass mode should pass audio unchanged");
            }

            if (mode == 0 || mode == 1)
            {
                bool changed = false;
                for (int ch = 0; ch < 2 && !changed; ++ch)
                    for (int s = 0; s < 256 && !changed; ++s)
                        if (std::abs(buffer.getSample(ch, s) - inputSnapshot.getSample(ch, s)) > 1e-4f)
                            changed = true;
                expect(changed, "Mode " + juce::String(mode) + " should change output");
            }

            logMessage("FX Mode " + juce::String(mode) + ": OK");
        }

        //==============================================================================
        beginTest("Bypass with all routing modes");

        for (int routing = 0; routing <= 9; ++routing)
        {
            FXEngine engine;
            engine.prepare(kTestSampleRate, 256);
            engine.setFXMode(2);
            engine.setRoutingMode(routing);

            int types[4] = { 5, 10, 15, 20 };
            for (int s = 0; s < 4; ++s)
            {
                engine.getSlot(s).setType(types[s]);
                engine.getSlot(s).setGain(1.0f);
                engine.getSlot(s).setMix(0.5f);
            }

            juce::AudioBuffer<float> buffer(2, 128);
            buffer.clear();
            for (int s = 0; s < 128; ++s)
                buffer.setSample(0, s, std::sin(6.283185f * 220.0f * s / static_cast<float>(kTestSampleRate)) * 0.4f);

            juce::AudioBuffer<float> snapshot;
            snapshot.makeCopyOf(buffer);
            engine.process(buffer);

            for (int ch = 0; ch < 2; ++ch)
                for (int s = 0; s < 128; ++s)
                    expect(std::abs(buffer.getSample(ch, s) - snapshot.getSample(ch, s)) < 1e-6f,
                        "Bypass routing " + juce::String(routing) + " should pass through unchanged");

            logMessage("Bypass + routing " + juce::String(routing) + ": OK");
        }

        //==============================================================================
        beginTest("FXEngine integration: routing + gain + mode");

        auto fillTestSignal = [](juce::AudioBuffer<float>& buf, int numSamples, float freq)
        {
            for (int s = 0; s < numSamples; ++s)
            {
                float phase = (float)s / static_cast<float>(kTestSampleRate);
                float sample = std::sin(6.283185f * freq * phase) * 0.5f;
                buf.setSample(0, s, sample);
                buf.setSample(1, s, sample * 0.7f);
            }
        };

        auto checkFinite = [&](const juce::AudioBuffer<float>& buf, const juce::String& label)
        {
            for (int ch = 0; ch < buf.getNumChannels(); ++ch)
                for (int s = 0; s < buf.getNumSamples(); ++s)
                    expect(std::isfinite(buf.getSample(ch, s)),
                        label + " non-finite at ch " + juce::String(ch));
        };

        auto isAllZero = [](const juce::AudioBuffer<float>& buf, float tol = 1e-6f) -> bool
        {
            for (int ch = 0; ch < buf.getNumChannels(); ++ch)
                for (int s = 0; s < buf.getNumSamples(); ++s)
                    if (std::abs(buf.getSample(ch, s)) > tol) return false;
            return true;
        };

        // Zero gain + full mix → silence for all routing modes
        {
            bool allSilent = true;
            for (int routing = 0; routing <= 9; ++routing)
            {
                FXEngine engine;
                engine.prepare(kTestSampleRate, 256);
                engine.setRoutingMode(routing);

                int types[4] = { 13, 10, 1, 11 };
                for (int s = 0; s < 4; ++s)
                {
                    engine.getSlot(s).setType(types[s]);
                    engine.getSlot(s).setGain(0.0f);
                    engine.getSlot(s).setMix(1.0f);
                }

                juce::AudioBuffer<float> buffer(2, 256);
                fillTestSignal(buffer, 256, 440.0f);
                engine.process(buffer);
                checkFinite(buffer, "Zero-gain routing " + juce::String(routing));

                if (!isAllZero(buffer))
                {
                    allSilent = false;
                    expect(false, "Routing " + juce::String(routing) + " zero-gain should be silent");
                }
            }
            if (allSilent) logMessage("Zero-gain silence across all routings: OK");
        }

        // Full gain + full mix → non-zero for all routing modes
        {
            bool allHaveOutput = true;
            for (int routing = 0; routing <= 9; ++routing)
            {
                FXEngine engine;
                engine.prepare(kTestSampleRate, 256);
                engine.setRoutingMode(routing);

                int types[4] = { 13, 10, 1, 11 };
                for (int s = 0; s < 4; ++s)
                {
                    engine.getSlot(s).setType(types[s]);
                    engine.getSlot(s).setGain(1.0f);
                    engine.getSlot(s).setMix(0.5f);
                }

                juce::AudioBuffer<float> buffer(2, 256);
                fillTestSignal(buffer, 256, 220.0f);
                engine.process(buffer);
                checkFinite(buffer, "Full-gain routing " + juce::String(routing));

                if (isAllZero(buffer, 1e-5f))
                {
                    allHaveOutput = false;
                    expect(false, "Routing " + juce::String(routing) + " full-gain should produce output");
                }
            }
            if (allHaveOutput) logMessage("Full-gain output across all routings: OK");
        }

        // Different routing modes produce different output
        {
            juce::AudioBuffer<float> outputs[10];
            bool anyDifferent = false;

            for (int routing = 0; routing <= 9; ++routing)
            {
                FXEngine engine;
                engine.prepare(kTestSampleRate, 256);
                engine.setRoutingMode(routing);

                int types[4] = { 13, 10, 1, 11 };
                float gains[4] = { 1.0f, 0.5f, 0.25f, 0.75f };
                for (int s = 0; s < 4; ++s)
                {
                    engine.getSlot(s).setType(types[s]);
                    engine.getSlot(s).setGain(gains[s]);
                    engine.getSlot(s).setMix(0.5f);
                }

                outputs[routing] = juce::AudioBuffer<float>(2, 256);
                fillTestSignal(outputs[routing], 256, 440.0f);
                engine.process(outputs[routing]);
                checkFinite(outputs[routing], "Routing diff " + juce::String(routing));
            }

            for (int r1 = 0; r1 <= 9 && !anyDifferent; ++r1)
                for (int r2 = r1 + 1; r2 <= 10 && !anyDifferent; ++r2)
                {
                    if (r2 >= 10) break;
                    float diff = 0.0f;
                    for (int s = 0; s < 256; ++s)
                        diff += std::abs(outputs[r1].getSample(0, s) - outputs[r2].getSample(0, s));
                    if (diff > 0.01f) anyDifferent = true;
                }

            expect(anyDifferent, "At least one pair of routing modes should produce different output");
            logMessage("Routing mode differentiation: OK");
        }

        //==============================================================================
        beginTest("Combined extreme params across all routing modes");
        {
            struct ComboTest { int type; int numParams; juce::String name; };
            const ComboTest comboTypes[] = {
                { 1, 5, "Hall" }, { 10, 3, "Chorus" }, { 11, 4, "Flanger" },
                { 13, 5, "Delay" }, { 7, 9, "Rack Amp" }, { 8, 9, "Mood Filter" },
                { 19, 8, "Edison" }, { 12, 12, "Mod Delay Rev" }, { 29, 12, "Dual Pitch" },
                { 31, 12, "Fair Comp" }, { 32, 12, "Multi-Band Dist" }, { 33, 8, "Noise Gate" },
                { 21, 5, "T-Ray Delay" }, { 35, 12, "Vintage Pitch" }
            };
            const int numCT = sizeof(comboTypes) / sizeof(comboTypes[0]);

            const float combos[3][2] = {
                { 0.0f, 0.0f }, { 1.0f, 1.0f }, { 0.0f, 1.0f }
            };

            for (int routing = 0; routing <= 9; ++routing)
            {
                for (int combo = 0; combo < 3; ++combo)
                {
                    float valEven = combos[combo][0];
                    float valOdd  = combos[combo][1];

                    FXEngine engine;
                    engine.prepare(kTestSampleRate, 256);
                    engine.setRoutingMode(routing);

                    for (int s = 0; s < 4; ++s)
                    {
                        int ci = s % numCT;
                        engine.getSlot(s).setType(comboTypes[ci].type);
                        engine.getSlot(s).setGain(1.0f);
                        engine.getSlot(s).setMix(0.5f);

                        int numP = comboTypes[ci].numParams;
                        for (int p = 0; p < numP; ++p)
                            engine.getSlot(s).setParameter(p, (p % 2 == 0) ? valEven : valOdd);
                    }

                    juce::AudioBuffer<float> buffer(2, 128);
                    for (int s = 0; s < 128; ++s)
                    {
                        float phase = (float)s / static_cast<float>(kTestSampleRate);
                        buffer.setSample(0, s, std::sin(6.283185f * 220.0f * phase) * 0.5f);
                        buffer.setSample(1, s, std::sin(6.283185f * 261.63f * phase) * 0.5f);
                    }
                    engine.process(buffer);

                    for (int ch = 0; ch < 2; ++ch)
                        for (int s = 0; s < 128; ++s)
                            expect(std::isfinite(buffer.getSample(ch, s)),
                                "Routing " + juce::String(routing) + " combo " + juce::String(combo)
                                + " non-finite at ch" + juce::String(ch) + " s" + juce::String(s));
                }
                logMessage("Routing " + juce::String(routing) + " combos: OK");
            }
        }
    }
};

static FXEngineUnitTests fxEngineUnitTests;

} // namespace ABD

/**
 * @purpose Unit tests for standard FX slot/effect processing (IDs 0-35).
 * Extraído de FXUnitTests_SlotProcessing.cpp para modularización.
 * @classification Test
 */

#include <JuceHeader.h>
#include "FXSlot.h"
#include "FXEngine.h"
#include "FXBase.h"

#include "FXDelay.h"
#include "FXChorus.h"
#include "FXSimpleReverb.h"
#include "FXFlanger.h"
#include "FXPhaser.h"
#include "FXRotarySpeaker.h"
#include "FXAutoPan.h"
#include "FXRackAmp.h"
#include "FXMultiBandDist.h"
#include "FXEdison.h"
#include "FXMoodFilter.h"
#include "FXEnhancer.h"
#include "FXSimpleComp.h"
#include "FXNoiseGate.h"
#include "FXPitchShifter.h"
#include "FXDecimDelay.h"
#include "FXTapeDelay.h"
#include "FXModDelayRev.h"

namespace ABD
{

class FXStandardUnitTests : public juce::UnitTest
{
public:
    static constexpr double kTestSampleRate = 44100.0;

    FXStandardUnitTests() : juce::UnitTest("FX Standard Tests (0-35)", "ABD") {}

    void runTest() override
    {
        //==============================================================================
        beginTest("Standard FX types through FXSlot factory (IDs 1-35)");

        for (int type = 1; type <= 35; ++type)
        {
            FXSlot slot;
            slot.setType(type);
            slot.prepare(kTestSampleRate, 256);

            if (type != 0)
                expect(slot.isActive(), "Type " + juce::String(type) + " should be active");

            for (int p = 0; p < 12; ++p)
                slot.setParameter(p, juce::Random::getSystemRandom().nextFloat());

            for (int block = 0; block < 5; ++block)
            {
                juce::AudioBuffer<float> buffer(2, 256);
                buffer.clear();
                for (int s = 0; s < 256; ++s)
                {
                    float phase = (float)(block * 256 + s) / static_cast<float>(kTestSampleRate);
                    float sample = std::sin(6.283185f * 220.0f * phase) * 0.5f;
                    buffer.setSample(0, s, sample);
                    buffer.setSample(1, s, sample * 0.8f);
                }
                slot.process(buffer, 256);

                for (int ch = 0; ch < 2; ++ch)
                    for (int s = 0; s < 256; ++s)
                        expect(std::isfinite(buffer.getSample(ch, s)),
                            "Type " + juce::String(type) + " non-finite at block " + juce::String(block));
            }
            logMessage("Type " + juce::String(type) + " (" + juce::String(slot.getType()) + "): OK");
        }

        //==============================================================================
        beginTest("Direct effect instantiation (standard)");

        auto testEffect = [&](std::unique_ptr<FXBase> fx, const juce::String& effectName)
        {
            fx->prepare(kTestSampleRate, 256);
            for (int p = 0; p < fx->getNumParameters(); ++p)
                fx->setParameter(p, 0.5f + 0.4f * std::sin((float)p));
            fx->reset();

            for (int block = 0; block < 8; ++block)
            {
                juce::AudioBuffer<float> inBuf(2, 256), outBuf(2, 256);
                inBuf.clear(); outBuf.clear();
                for (int s = 0; s < 256; ++s)
                {
                    float phase = (float)(block * 256 + s) / static_cast<float>(kTestSampleRate);
                    float sample = std::sin(6.283185f * 440.0f * phase) * 0.3f
                                 + std::sin(6.283185f * 880.0f * phase) * 0.2f;
                    inBuf.setSample(0, s, sample);
                    inBuf.setSample(1, s, sample * 0.7f);
                }
                const float* inL = inBuf.getReadPointer(0);
                const float* inR = inBuf.getReadPointer(1);
                float* outL = outBuf.getWritePointer(0);
                float* outR = outBuf.getWritePointer(1);
                fx->process(inL, inR, outL, outR, 256);

                for (int s = 0; s < 256; ++s)
                {
                    expect(std::isfinite(outL[s]), effectName + " NaN left");
                    expect(std::isfinite(outR[s]), effectName + " NaN right");
                }
            }
            logMessage(effectName + " (direct): OK");
        };

        testEffect(std::make_unique<FXDelay>(), "Delay");
        testEffect(std::make_unique<FXChorus>(), "Chorus");
        testEffect(std::make_unique<FXSimpleReverb>(1), "Hall Reverb");
        testEffect(std::make_unique<FXSimpleReverb>(2), "Plate Reverb");
        testEffect(std::make_unique<FXFlanger>(), "Flanger");
        testEffect(std::make_unique<FXPhaser>(), "Phaser");
        testEffect(std::make_unique<FXRotarySpeaker>(), "Rotary Speaker");
        testEffect(std::make_unique<FXAutoPan>(), "Auto Pan");
        testEffect(std::make_unique<FXRackAmp>(), "Rack Amp");
        testEffect(std::make_unique<FXMultiBandDist>(), "Multi-Band Dist");
        testEffect(std::make_unique<FXEdison>(), "Edison");
        testEffect(std::make_unique<FXMoodFilter>(), "Mood Filter");
        testEffect(std::make_unique<FXEnhancer>(), "Enhancer");
        testEffect(std::make_unique<FXSimpleComp>(), "Fair Comp");
        testEffect(std::make_unique<FXNoiseGate>(), "Noise Gate");
        testEffect(std::make_unique<FXPitchShifter>(false), "Dual Pitch");
        testEffect(std::make_unique<FXPitchShifter>(true), "Vintage Pitch");
        testEffect(std::make_unique<FXDecimDelay>(), "Decimator Delay");
        testEffect(std::make_unique<FXTapeDelay>(), "T-Ray Delay");
        testEffect(std::make_unique<FXModDelayRev>(), "Mod Delay Rev");

        //==============================================================================
        beginTest("FXSlot edge cases");

        {
            FXSlot slot;
            slot.prepare(kTestSampleRate, 256);
            slot.setType(0);
            expect(!slot.isActive(), "Type 0 should be inactive");
            juce::AudioBuffer<float> buffer(2, 256);
            buffer.clear();
            buffer.setSample(0, 0, 0.5f);
            slot.process(buffer, 256);
            logMessage("Bypass slot: OK");
        }

        {
            FXSlot slot;
            slot.prepare(kTestSampleRate, 256);
            juce::AudioBuffer<float> buffer(2, 128);
            buffer.clear();
            for (int s = 0; s < 128; ++s)
                buffer.setSample(0, s, std::sin(6.283185f * 440.0f * s / static_cast<float>(kTestSampleRate)) * 0.5f);
            for (int cycle = 0; cycle < 10; ++cycle)
            {
                slot.setType((cycle % 35) + 1);
                slot.process(buffer, 128);
            }
            for (int s = 0; s < 128; ++s)
                expect(std::isfinite(buffer.getSample(0, s)), "Type toggle NaN");
            logMessage("Type toggling (standard): OK");
        }

        //==============================================================================
        beginTest("Parameter range safety");

        {
            FXSlot slot;
            slot.prepare(kTestSampleRate, 256);
            slot.setType(10);
            slot.setParameter(-1, -0.5f);
            slot.setParameter(0, -0.1f);
            slot.setParameter(5, 1.5f);
            slot.setParameter(99, 2.0f);
            juce::AudioBuffer<float> buffer(2, 64);
            buffer.clear();
            slot.process(buffer, 64);
            logMessage("Parameter range safety: OK");
        }

        //==============================================================================
        beginTest("FX Gain range clamping");

        {
            FXSlot slot;
            slot.prepare(kTestSampleRate, 128);
            slot.setType(13);
            slot.setMix(1.0f);

            slot.setGain(-0.5f);
            expectWithinAbsoluteError(slot.getGain(), 0.0f, 0.001f, "Gain -0.5 clamp to 0.0");
            slot.setGain(1.5f);
            expectWithinAbsoluteError(slot.getGain(), 1.0f, 0.001f, "Gain 1.5 clamp to 1.0");
            slot.setGain(0.0f);
            expectWithinAbsoluteError(slot.getGain(), 0.0f, 0.001f, "Gain 0.0 stay 0.0");
            slot.setGain(1.0f);
            expectWithinAbsoluteError(slot.getGain(), 1.0f, 0.001f, "Gain 1.0 stay 1.0");
            slot.setGain(0.7f);
            expectWithinAbsoluteError(slot.getGain(), 0.7f, 0.001f, "Gain 0.7 stay 0.7");
            logMessage("Gain clamping [0,1]: OK");
        }

        {
            FXSlot slot;
            slot.prepare(kTestSampleRate, 256);
            slot.setType(13);
            slot.setMix(1.0f);
            slot.setGain(0.0f);

            juce::AudioBuffer<float> buffer(2, 256);
            buffer.clear();
            for (int s = 0; s < 256; ++s)
            {
                float sample = std::sin(6.283185f * 220.0f * s / static_cast<float>(kTestSampleRate)) * 0.5f;
                buffer.setSample(0, s, sample);
                buffer.setSample(1, s, sample * 0.8f);
            }
            slot.process(buffer, 256);

            bool allZero = true;
            for (int ch = 0; ch < 2 && allZero; ++ch)
                for (int s = 0; s < 256 && allZero; ++s)
                    if (std::abs(buffer.getSample(ch, s)) > 1e-6f) allZero = false;
            expect(allZero, "Zero gain with 100% wet should produce silence");
            logMessage("Zero gain silence: OK");
        }

        {
            FXSlot slot;
            slot.prepare(kTestSampleRate, 256);
            slot.setType(10);
            slot.setMix(1.0f);
            slot.setGain(1.0f);

            // El chorus tiene un base delay de hasta ~25 ms por defecto; renderizamos
            // lo suficiente para que el delay wet aparezca y verifique el camino gain/mix.
            constexpr int kChorusLen = 8192;
            juce::AudioBuffer<float> buffer(2, kChorusLen);
            buffer.clear();
            for (int s = 0; s < kChorusLen; ++s)
            {
                float sample = std::sin(6.283185f * 440.0f * s / static_cast<float>(kTestSampleRate)) * 0.5f;
                buffer.setSample(0, s, sample);
                buffer.setSample(1, s, sample * 0.7f);
            }
            slot.process(buffer, kChorusLen);

            bool hasOutput = false;
            for (int ch = 0; ch < 2 && !hasOutput; ++ch)
                for (int s = 0; s < kChorusLen && !hasOutput; ++s)
                    if (std::abs(buffer.getSample(ch, s)) > 1e-4f) hasOutput = true;
            expect(hasOutput, "Full gain with 100% wet should produce non-zero output");
            logMessage("Full gain output: OK");
        }

        {
            // Gain scaling: 0.5 should produce ~half amplitude
            FXSlot slot;
            slot.prepare(kTestSampleRate, 256);
            slot.setType(10);
            slot.setMix(1.0f);
            slot.setGain(0.5f);

            juce::AudioBuffer<float> buffer(2, 256);
            buffer.clear();
            for (int s = 0; s < 256; ++s)
                buffer.setSample(0, s, std::sin(6.283185f * 220.0f * s / static_cast<float>(kTestSampleRate)) * 0.5f);
            slot.process(buffer, 256);

            FXSlot refSlot;
            refSlot.prepare(kTestSampleRate, 256);
            refSlot.setType(10);
            refSlot.setMix(1.0f);
            refSlot.setGain(1.0f);

            juce::AudioBuffer<float> refBuf(2, 256);
            refBuf.clear();
            for (int s = 0; s < 256; ++s)
            {
                float sample = std::sin(6.283185f * 220.0f * s / static_cast<float>(kTestSampleRate)) * 0.5f;
                refBuf.setSample(0, s, sample);
                refBuf.setSample(1, s, sample);
            }
            refSlot.process(refBuf, 256);

            float maxRatio = 0.0f;
            for (int s = 0; s < 256; ++s)
            {
                float val = buffer.getSample(0, s);
                float refVal = refBuf.getSample(0, s);
                float ratio = (std::abs(refVal) > 1e-6f) ? std::abs(val / refVal) : 0.0f;
                if (ratio > maxRatio) maxRatio = ratio;
            }
            expect(maxRatio <= 0.56f,
                "Gain 0.5 output <= 0.56x of gain 1.0 (maxRatio=" + juce::String(maxRatio) + ")");
            logMessage("Gain scaling: OK (maxRatio=" + juce::String(maxRatio, 4) + ")");
        }

        //==============================================================================
        beginTest("Stereo vs mono handling");

        {
            FXSlot slot;
            slot.prepare(kTestSampleRate, 128);
            slot.setType(13);
            juce::AudioBuffer<float> monoBuf(1, 128);
            monoBuf.clear();
            monoBuf.setSample(0, 0, 0.5f);
            slot.process(monoBuf, 128);
            expect(std::isfinite(monoBuf.getSample(0, 0)), "Mono processing NaN");
            logMessage("Mono buffer: OK");
        }

        //==============================================================================
        beginTest("Standard FX parameter boundary values per type (IDs 1-35)");

        struct FxBoundaryTest { int type; int numParams; juce::String name; };

        FxBoundaryTest fxTypes[] = {
            { 1, 5, "Hall" }, { 2, 5, "Plate" }, { 3, 5, "Rich Plate" }, { 4, 5, "Ambience" },
            { 5, 5, "Gated" }, { 6, 5, "Reverse" }, { 7, 9, "Rack Amp" }, { 8, 9, "Mood Filter" },
            { 9, 7, "Phaser" }, { 10, 3, "Chorus" }, { 17, 3, "Chorus-D" },
            { 11, 4, "Flanger" }, { 12, 12, "Mod Delay Rev" },
            { 13, 5, "Delay" }, { 14, 5, "3Tap Delay" }, { 15, 5, "4Tap Delay" },
            { 16, 7, "Rotary Speaker" }, { 18, 9, "Enhancer" }, { 30, 9, "Midas EQ" },
            { 19, 8, "Edison" }, { 20, 6, "Auto Pan" }, { 21, 5, "T-Ray Delay" },
            { 22, 5, "Deep Verb" }, { 26, 5, "Chamber" }, { 27, 5, "Room" }, { 28, 5, "Vintage" },
            { 23, 5, "FlangVerb" }, { 24, 5, "ChorusVerb" }, { 25, 5, "DelayVerb" },
            { 29, 12, "Dual Pitch" }, { 31, 12, "Fair Comp" }, { 32, 12, "Multi-Band Dist" },
            { 33, 8, "Noise Gate" }, { 34, 12, "DecimDelay" }, { 35, 12, "Vintage Pitch" }
        };

        const float boundaryValues[] = { 0.0f, 1.0f, 0.5f, 0.0f, 1.0f };

        for (auto& ft : fxTypes)
        {
            FXSlot slot;
            slot.prepare(kTestSampleRate, 256);
            slot.setType(ft.type);
            expect(slot.isActive(), ft.name + " should be active");

            for (int paramIdx = 0; paramIdx < ft.numParams; ++paramIdx)
            {
                for (float bv : boundaryValues)
                {
                    slot.setParameter(paramIdx, bv);
                    juce::AudioBuffer<float> buffer(2, 64);
                    buffer.clear();
                    for (int s = 0; s < 64; ++s)
                    {
                        float phase = (float)s / static_cast<float>(kTestSampleRate);
                        buffer.setSample(0, s, std::sin(6.283185f * 440.0f * phase) * 0.5f);
                        buffer.setSample(1, s, buffer.getSample(0, s) * 0.7f);
                    }
                    slot.process(buffer, 64);
                    for (int ch = 0; ch < 2; ++ch)
                        for (int s = 0; s < 64; ++s)
                            expect(std::isfinite(buffer.getSample(ch, s)),
                                ft.name + " param[" + juce::String(paramIdx) + "]=" + juce::String(bv) + " non-finite");
                }
            }

            for (int extraIdx = ft.numParams; extraIdx < 12; ++extraIdx)
            {
                slot.setParameter(extraIdx, 0.0f);
                slot.setParameter(extraIdx, 1.0f);
                juce::AudioBuffer<float> buffer(2, 32);
                buffer.clear();
                buffer.setSample(0, 0, 0.5f);
                slot.process(buffer, 32);
                for (int ch = 0; ch < 2; ++ch)
                    expect(std::isfinite(buffer.getSample(ch, 0)),
                        ft.name + " extra idx " + juce::String(extraIdx) + " non-finite");
            }
            logMessage(ft.name + " boundaries: OK");
        }

        //==============================================================================
        beginTest("Standard FX parameter rapid sweep (IDs 1-35)");

        for (int type = 1; type <= 35; ++type)
        {
            FXSlot slot;
            slot.prepare(kTestSampleRate, 256);
            slot.setType(type);
            if (!slot.isActive()) continue;

            juce::AudioBuffer<float> buffer(2, 128);
            buffer.clear();

            for (int step = 0; step < 20; ++step)
            {
                float normalizedStep = (step < 10) ? step / 9.0f : 1.0f - (step - 10) / 9.0f;
                for (int p = 0; p < 12; ++p)
                    slot.setParameter(p, normalizedStep);

                for (int s = 0; s < 128; ++s)
                {
                    float phase = (float)(step * 128 + s) / static_cast<float>(kTestSampleRate);
                    buffer.setSample(0, s, std::sin(6.283185f * 220.0f * phase) * 0.5f);
                    buffer.setSample(1, s, buffer.getSample(0, s) * 0.8f);
                }
                slot.process(buffer, 128);

                for (int ch = 0; ch < 2; ++ch)
                    for (int s = 0; s < 128; ++s)
                        expect(std::isfinite(buffer.getSample(ch, s)),
                            "Sweep type " + juce::String(type) + " step " + juce::String(step) + " non-finite");
            }
            logMessage("Type " + juce::String(type) + " sweep: OK");
        }

        //==============================================================================
        beginTest("Corner-case parameter pairs per type (IDs 1-35)");

        // Tests that each FX type survives simultaneous extreme param values:
        // all-0, all-1, alternating 0/1, and rapid toggle between extremes.

        struct PairTest { int type; int numParams; juce::String name; };
        PairTest pairTypes[] = {
            { 1, 5, "Hall" }, { 2, 5, "Plate" }, { 3, 5, "Rich Plate" }, { 4, 5, "Ambience" },
            { 5, 5, "Gated" }, { 6, 5, "Reverse" }, { 7, 9, "Rack Amp" }, { 8, 9, "Mood Filter" },
            { 9, 7, "Phaser" }, { 10, 3, "Chorus" }, { 17, 3, "Chorus-D" },
            { 11, 4, "Flanger" }, { 12, 12, "Mod Delay Rev" },
            { 13, 5, "Delay" }, { 14, 5, "3Tap Delay" }, { 15, 5, "4Tap Delay" },
            { 16, 7, "Rotary Speaker" }, { 18, 9, "Enhancer" }, { 30, 9, "Midas EQ" },
            { 19, 8, "Edison" }, { 20, 6, "Auto Pan" }, { 21, 5, "T-Ray Delay" },
            { 22, 5, "Deep Verb" }, { 26, 5, "Chamber" }, { 27, 5, "Room" }, { 28, 5, "Vintage" },
            { 23, 5, "FlangVerb" }, { 24, 5, "ChorusVerb" }, { 25, 5, "DelayVerb" },
            { 29, 12, "Dual Pitch" }, { 31, 12, "Fair Comp" }, { 32, 12, "Multi-Band Dist" },
            { 33, 8, "Noise Gate" }, { 34, 12, "DecimDelay" }, { 35, 12, "Vintage Pitch" }
        };

        float pat[3][2] = { {0.0f, 0.0f}, {1.0f, 1.0f}, {0.0f, 1.0f} };

        for (int pi = 0; pi < 3; ++pi)
        {
            float vEven = pat[pi][0];
            float vOdd  = pat[pi][1];

            for (auto& pt : pairTypes)
            {
                FXSlot slot;
                slot.prepare(kTestSampleRate, 256);
                slot.setType(pt.type);
                if (!slot.isActive()) continue;

                for (int p = 0; p < pt.numParams; ++p)
                    slot.setParameter(p, (p % 2 == 0) ? vEven : vOdd);

                for (int block = 0; block < 3; ++block)
                {
                    juce::AudioBuffer<float> buf(2, 64);
                    for (int s = 0; s < 64; ++s)
                    {
                        float ph = (float)(block * 64 + s) / (float)kTestSampleRate;
                        buf.setSample(0, s, std::sin(6.283185f * 440.0f * ph) * 0.5f);
                        buf.setSample(1, s, buf.getSample(0, s) * 0.7f);
                    }
                    slot.process(buf, 64);
                    for (int ch = 0; ch < 2; ++ch)
                        for (int s = 0; s < 64; ++s)
                            expect(std::isfinite(buf.getSample(ch, s)),
                                pt.name + " pat " + juce::String(pi) + " non-finite");
                }
            }
            logMessage("Combo pattern " + juce::String(pi) + ": OK");
        }

        // Rapid toggle between all-0 and all-1
        for (auto& pt : pairTypes)
        {
            FXSlot slot;
            slot.prepare(kTestSampleRate, 256);
            slot.setType(pt.type);
            if (!slot.isActive()) continue;

            for (int t = 0; t < 5; ++t)
            {
                float val = (t % 2 == 0) ? 0.0f : 1.0f;
                for (int p = 0; p < pt.numParams; ++p)
                    slot.setParameter(p, val);

                juce::AudioBuffer<float> buf(2, 64);
                for (int s = 0; s < 64; ++s)
                {
                    float ph = (float)(t * 64 + s) / (float)kTestSampleRate;
                    buf.setSample(0, s, std::sin(6.283185f * 220.0f * ph) * 0.5f);
                    buf.setSample(1, s, buf.getSample(0, s));
                }
                slot.process(buf, 64);
                for (int ch = 0; ch < 2; ++ch)
                    for (int s = 0; s < 64; ++s)
                        expect(std::isfinite(buf.getSample(ch, s)),
                            pt.name + " toggle " + juce::String(t) + " non-finite");
            }
        }
        logMessage("Rapid extreme toggle: OK");
    }
};

static FXStandardUnitTests fxStandardUnitTests;

} // namespace ABD

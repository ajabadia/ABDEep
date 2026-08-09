/**
 * @purpose Unit tests for advanced FX slot/effect processing (IDs 36-56).
 * Extraído de FXUnitTests_SlotProcessing.cpp para modularización.
 * @classification Test
 */

#include <JuceHeader.h>
#include "FXSlot.h"
#include "FXEngine.h"
#include "FXBase.h"

#include "FXRolandBBDChorus.h"
#include "FXSolinaEnsemble.h"
#include "FXRingModulator.h"
#include "FXSpaceEchoRE201.h"
#include "FXAnalogTapeDelay.h"
#include "FXShimmerDelay.h"
#include "FXGranularDelay.h"
#include "FXPatternFreeze.h"
#include "FXDuckingDelay.h"
#include "FXSpectralDelay.h"
#include "FXFrequencyShifter.h"
#include "FXResonator.h"
#include "FXCombulator.h"
#include "FXVocoder.h"
#include "FXOversamplingDistortion.h"
#include "FXWaveShaper.h"
#include "FXFDNReverb.h"
#include "FXZitaReverb.h"
#include "FXNimbus.h"
#include "FXBonsai.h"
#include "FXTreemonster.h"

namespace ABD
{

class FXAdvancedUnitTests : public juce::UnitTest
{
public:
    static constexpr double kTestSampleRate = 44100.0;

    FXAdvancedUnitTests() : juce::UnitTest("FX Advanced Tests (36-56)", "ABD") {}

    void runTest() override
    {
        //==============================================================================
        beginTest("Advanced FX types through FXSlot factory (IDs 36-56)");

        for (int type = 36; type <= 56; ++type)
        {
            FXSlot slot;
            slot.setType(type);
            slot.prepare(kTestSampleRate, 256);

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
        beginTest("Direct effect instantiation (advanced)");

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

        testEffect(std::make_unique<FXOversamplingDistortion>(), "Oversampling Distortion");
        testEffect(std::make_unique<FXWaveShaper>(), "Wave Shaper");
        testEffect(std::make_unique<FXFDNReverb>(), "FDN Reverb");
        testEffect(std::make_unique<FXZitaReverb>(), "Zita Reverb");
        testEffect(std::make_unique<FXNimbus>(), "Nimbus");
        testEffect(std::make_unique<FXBonsai>(), "Bonsai");
        testEffect(std::make_unique<FXTreemonster>(), "Tree Monster");

        //==============================================================================
        beginTest("Advanced FX parameter boundary values per type (IDs 36-56)");

        struct FxBoundaryTest { int type; int numParams; juce::String name; };

        FxBoundaryTest fxTypes[] = {
            { 36, 4, "Roland BBD Chorus" }, { 37, 5, "Solina Ensemble" }, { 38, 5, "Ring Modulator" },
            { 39, 6, "Space Echo RE-201" }, { 40, 6, "Analog Tape Delay" },
            { 41, 5, "Shimmer Delay" }, { 42, 5, "Granular Delay" }, { 43, 4, "Pattern Freeze" },
            { 44, 5, "Ducking Delay" }, { 45, 5, "Spectral Delay" }, { 46, 5, "Frequency Shifter" },
            { 47, 5, "Harmonic Resonator" }, { 48, 5, "Combulator" }, { 49, 6, "Multi-Band Vocoder" },
            { 50, 5, "Oversampling Distortion" }, { 51, 5, "Wave Shaper" },
            { 52, 5, "FDN Reverb" }, { 53, 5, "Zita Reverb" },
            { 54, 5, "Nimbus" }, { 55, 5, "Bonsai" }, { 56, 5, "Tree Monster" }
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
        beginTest("Advanced FX parameter rapid sweep (IDs 36-56)");

        for (int type = 36; type <= 56; ++type)
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
    }
};

static FXAdvancedUnitTests fxAdvancedUnitTests;

} // namespace ABD

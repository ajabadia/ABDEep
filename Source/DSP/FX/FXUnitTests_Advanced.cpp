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

        //==============================================================================
        beginTest("Space Echo RE-201 delay line advances (id 39)");

        // The tape line used `kMaxDelay = 70560` as a BIT MASK. A mask only
        // wraps when it is 2^n - 1, and 70560 is not one: its low five bits are
        // zero, so `(writePos + 1) & delayMask` was 0 on the first sample and
        // 0 forever after. Every sample went into the same cell, the reads
        // landed on masked-off indices that had never been written, and the
        // echo did not exist. Fire an impulse and check that it comes back at
        // the head distance, at both ends of the time knob.
        {
            constexpr int numSamples = 48000;
            constexpr int impulseAt  = 100;
            constexpr int blockSize  = 256;

            // Mode A is head 1 alone, at 33% of the delay. The time knob runs
            // 0.12s to 1.5s of base, scaled to the 1.5s ceiling, so the head tap
            // is 0.12 * 1.5 * 0.33 = 2620 samples at one end of the knob and
            // 1.50 * 1.5 * 0.33 = 32744 at the other.
            struct Case { float time; int echoAt; };
            const Case cases[] = { { 0.0f, impulseAt + 2620 },
                                   { 1.0f, impulseAt + 32744 } };

            for (const auto& c : cases)
            {
                FXSpaceEchoRE201 echo;
                echo.prepare(kTestSampleRate, blockSize);

                echo.setParameter(0, 0.0f);  // Mode A: head 1 only
                echo.setParameter(1, c.time);
                echo.setParameter(2, 0.0f);  // Feedback 0: one echo, no runaway
                echo.setParameter(3, 0.5f);
                echo.setParameter(4, 0.5f);
                echo.setParameter(5, 0.0f);  // Spring tank off

                juce::AudioBuffer<float> in(2, numSamples);
                juce::AudioBuffer<float> out(2, numSamples);
                in.clear();
                in.setSample(0, impulseAt, 1.0f);
                in.setSample(1, impulseAt, 1.0f);

                for (int pos = 0; pos < numSamples; pos += blockSize)
                {
                    const int n = juce::jmin(blockSize, numSamples - pos);
                    echo.process(in.getReadPointer(0) + pos, in.getReadPointer(1) + pos,
                                 out.getWritePointer(0) + pos, out.getWritePointer(1) + pos, n);
                }

                const juce::String where = "RE-201 time " + juce::String(c.time) + ": ";

                // The dry path has to be alive, or "no echo" would prove nothing.
                float dryPeak = 0.0f;
                for (int s = impulseAt - 5; s <= impulseAt + 5; ++s)
                    dryPeak = juce::jmax(dryPeak, std::abs(out.getSample(0, s)));
                expect(dryPeak > 0.5f, where + "the dry path is dead (peak "
                                    + juce::String(dryPeak) + ")");

                // Tape wow and flutter drag the read position around by up to
                // ~1.7%, so the window has to scale with the distance.
                const int window = juce::jmax(150, (int)((c.echoAt - impulseAt) * 0.02f));

                float echoPeak = 0.0f;
                for (int s = c.echoAt - window; s <= c.echoAt + window; ++s)
                    echoPeak = juce::jmax(echoPeak, std::abs(out.getSample(0, s)));
                expect(echoPeak > 0.05f, where + "no echo at sample " + juce::String(c.echoAt)
                                    + " (peak " + juce::String(echoPeak)
                                    + "): the delay line is not advancing");

                // And it only sounds where the head says it should. Everywhere
                // else the line holds nothing but tape noise (~0.008), so this
                // is what catches a mask that wraps without being the length of
                // the buffer: the echo would land somewhere else entirely.
                float strayPeak = 0.0f;
                for (int s = impulseAt + 10; s < numSamples; ++s)
                {
                    if (s >= c.echoAt - window && s <= c.echoAt + window)
                        continue;
                    strayPeak = juce::jmax(strayPeak, std::abs(out.getSample(0, s)));
                }
                expect(strayPeak < 0.02f, where + "output of " + juce::String(strayPeak)
                                    + " far from the head distance");
            }
        }
    }
};

static FXAdvancedUnitTests fxAdvancedUnitTests;

} // namespace ABD

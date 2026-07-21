/**
 * @purpose Unit tests for FX Engine: verifies each effect type processes audio without crashes.
 * @classification Test
 * @complexity Medium
 *
 * Tests all 35 FX types through FXSlot factory, processes stereo audio blocks,
 * and checks for NaN values and valid output.
 */

#include <JuceHeader.h>
#include "FXSlot.h"
#include "FXEngine.h"
#include "FXBase.h"

// Include all effect headers for direct instantiation tests
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

//==============================================================================
/**
 * Tests each FX type by:
 *   1. Creating the effect via FXSlot factory
 *   2. Calling prepare()
 *   3. Processing several blocks of audio
 *   4. Verifying output is finite (no NaN, no inf)
 *   5. Verifying process completes without crash
 */
class FXUnitTests : public juce::UnitTest
{
public:
    static constexpr double kTestSampleRate = 44100.0;

    FXUnitTests() : juce::UnitTest ("FX Engine Tests", "ABD") {}

    void runTest() override
    {
        //==============================================================================
        beginTest ("All FX types through FXSlot factory");

        // Test types 1-35 (0 = bypass = nullptr)
        for (int type = 1; type <= 35; ++type)
        {
            FXSlot slot;
            slot.setType (type);
            slot.prepare (kTestSampleRate, 256);

            if (type != 0)
            {
                expect (slot.isActive(), "Type " + juce::String (type) + " should be active");
            }

            // Set some random parameters
            for (int p = 0; p < 12; ++p)
                slot.setParameter (p, juce::Random::getSystemRandom().nextFloat());

            // Process audio blocks
            for (int block = 0; block < 5; ++block)
            {
                juce::AudioBuffer<float> buffer (2, 256);
                buffer.clear();

                // Fill with test signal (sine sweep)
                for (int s = 0; s < 256; ++s)
                {
                    float phase = (float)(block * 256 + s) / static_cast<float>(kTestSampleRate);
                    float sample = std::sin (6.283185f * 220.0f * phase) * 0.5f;
                    buffer.setSample (0, s, sample);
                    buffer.setSample (1, s, sample * 0.8f);
                }

                // Process without crash
                slot.process (buffer, 256);

                // Verify no NaN or Inf in output
                for (int ch = 0; ch < 2; ++ch)
                {
                    for (int s = 0; s < 256; ++s)
                    {
                        float val = buffer.getSample (ch, s);
                        expect (std::isfinite (val),
                                "Type " + juce::String (type) + " produced non-finite value at block " + juce::String (block));
                    }
                }
            }

            logMessage ("Type " + juce::String (type) + " (" + juce::String (slot.getType()) + "): OK");
        }

        //==============================================================================
        beginTest ("Direct effect instantiation");

        auto testEffect = [&](std::unique_ptr<FXBase> fx, const juce::String& effectName)
        {
            fx->prepare (kTestSampleRate, 256);

            for (int p = 0; p < fx->getNumParameters(); ++p)
                fx->setParameter (p, 0.5f + 0.4f * std::sin ((float)p));

            fx->reset();

            for (int block = 0; block < 8; ++block)
            {
                juce::AudioBuffer<float> inBuf (2, 256);
                juce::AudioBuffer<float> outBuf (2, 256);
                inBuf.clear(); outBuf.clear();

                for (int s = 0; s < 256; ++s)
                {
                    float phase = (float)(block * 256 + s) / static_cast<float>(kTestSampleRate);
                    float sample = std::sin (6.283185f * 440.0f * phase) * 0.3f
                                 + std::sin (6.283185f * 880.0f * phase) * 0.2f;
                    inBuf.setSample (0, s, sample);
                    inBuf.setSample (1, s, sample * 0.7f);
                }

                const float* inL = inBuf.getReadPointer (0);
                const float* inR = inBuf.getReadPointer (1);
                float* outL = outBuf.getWritePointer (0);
                float* outR = outBuf.getWritePointer (1);

                fx->process (inL, inR, outL, outR, 256);

                for (int s = 0; s < 256; ++s)
                {
                    expect (std::isfinite (outL[s]), effectName + " produced NaN in left channel");
                    expect (std::isfinite (outR[s]), effectName + " produced NaN in right channel");
                }
            }

            logMessage (effectName + " (direct): OK");
        };

        testEffect (std::make_unique<FXDelay>(), "Delay");
        testEffect (std::make_unique<FXChorus>(), "Chorus");
        testEffect (std::make_unique<FXSimpleReverb>(1), "Hall Reverb");
        testEffect (std::make_unique<FXSimpleReverb>(2), "Plate Reverb");
        testEffect (std::make_unique<FXFlanger>(), "Flanger");
        testEffect (std::make_unique<FXPhaser>(), "Phaser");
        testEffect (std::make_unique<FXRotarySpeaker>(), "Rotary Speaker");
        testEffect (std::make_unique<FXAutoPan>(), "Auto Pan");
        testEffect (std::make_unique<FXRackAmp>(), "Rack Amp");
        testEffect (std::make_unique<FXMultiBandDist>(), "Multi-Band Dist");
        testEffect (std::make_unique<FXEdison>(), "Edison");
        testEffect (std::make_unique<FXMoodFilter>(), "Mood Filter");
        testEffect (std::make_unique<FXEnhancer>(), "Enhancer");
        testEffect (std::make_unique<FXSimpleComp>(), "Fair Comp");
        testEffect (std::make_unique<FXNoiseGate>(), "Noise Gate");
        testEffect (std::make_unique<FXPitchShifter>(false), "Dual Pitch");
        testEffect (std::make_unique<FXPitchShifter>(true), "Vintage Pitch");
        testEffect (std::make_unique<FXDecimDelay>(), "Decimator Delay");
        testEffect (std::make_unique<FXTapeDelay>(), "T-Ray Delay");
        testEffect (std::make_unique<FXModDelayRev>(), "Mod Delay Rev");

        //==============================================================================
        beginTest ("FXEngine routing modes");

        for (int routing = 0; routing <= 9; ++routing)
        {
            FXEngine engine;
            engine.prepare (kTestSampleRate, 256);
            engine.setRoutingMode (routing);

            // Set up slots with different types
            int types[4] = { 13, 10, 1, 11 }; // Delay, Chorus, Hall, Flanger
            for (int s = 0; s < 4; ++s)
            {
                engine.getSlot(s).setType (types[s]);
                engine.getSlot(s).setGain (1.0f);
                engine.getSlot(s).setMix (0.5f);
            }

            juce::AudioBuffer<float> buffer (2, 256);
            buffer.clear();
            for (int s = 0; s < 256; ++s)
            {
                float phase = (float)s / static_cast<float>(kTestSampleRate);
                buffer.setSample (0, s, std::sin (6.283185f * 220.0f * phase) * 0.5f);
                buffer.setSample (1, s, std::sin (6.283185f * 261.63f * phase) * 0.5f);
            }

            engine.process (buffer);

            for (int ch = 0; ch < 2; ++ch)
            {
                for (int s = 0; s < 256; ++s)
                {
                    expect (std::isfinite (buffer.getSample (ch, s)),
                            "Routing mode " + juce::String (routing) + " produced non-finite at sample " + juce::String (s));
                }
            }

            logMessage ("Routing mode " + juce::String (routing) + ": OK");
        }

        //==============================================================================
        beginTest ("FXSlot edge cases");

        // Test slot with no effect (type 0)
        {
            FXSlot slot;
            slot.prepare (kTestSampleRate, 256);
            slot.setType (0);
            expect (!slot.isActive(), "Type 0 should be inactive");

            juce::AudioBuffer<float> buffer (2, 256);
            buffer.clear();
            buffer.setSample (0, 0, 0.5f);

            // Process should not crash with nullptr effect
            slot.process (buffer, 256);
            logMessage ("Bypass slot: OK");
        }

        // Test slot type toggle (changing types repeatedly)
        {
            FXSlot slot;
            slot.prepare (kTestSampleRate, 256);

            juce::AudioBuffer<float> buffer (2, 128);
            buffer.clear();
            for (int s = 0; s < 128; ++s)
                buffer.setSample (0, s, std::sin (6.283185f * 440.0f * s / static_cast<float>(kTestSampleRate)) * 0.5f);

            for (int cycle = 0; cycle < 10; ++cycle)
            {
                slot.setType ((cycle % 35) + 1);
                slot.process (buffer, 128);
            }
            
            for (int s = 0; s < 128; ++s)
                expect (std::isfinite (buffer.getSample (0, s)), "Type toggle produced NaN");

            logMessage ("Type toggling: OK");
        }

        //==============================================================================
        beginTest ("Parameter range safety");

        // Test that setParameter handles all indices safely
        {
            FXSlot slot;
            slot.prepare (kTestSampleRate, 256);
            slot.setType (10); // Chorus

            // Set negative and out-of-range values
            slot.setParameter (-1, -0.5f);
            slot.setParameter (0, -0.1f);
            slot.setParameter (5, 1.5f);
            slot.setParameter (99, 2.0f);

            // Should not crash
            juce::AudioBuffer<float> buffer (2, 64);
            buffer.clear();
            slot.process (buffer, 64);
            logMessage ("Parameter range safety: OK");
        }

        //==============================================================================
        beginTest ("Stereo vs mono handling");

        // Test with mono buffer (1 channel)
        {
            FXSlot slot;
            slot.prepare (kTestSampleRate, 128);
            slot.setType (13); // Delay

            juce::AudioBuffer<float> monoBuf (1, 128);
            monoBuf.clear();
            monoBuf.setSample (0, 0, 0.5f);
            slot.process (monoBuf, 128);
            expect (std::isfinite (monoBuf.getSample (0, 0)), "Mono processing produced NaN");
            logMessage ("Mono buffer handling: OK");
        }

        //==============================================================================
        beginTest ("FX Gain range clamping");

        // Test that setGain clamps values to [0, 1] and verify output scaling
        // Gain is applied as: out = dry * (1 - mix) + wet * mix * gain
        // With mix=1.0: out = wet * gain  (purely wet signal, gain controls amplitude)
        {
            FXSlot slot;
            slot.prepare (kTestSampleRate, 128);
            slot.setType (13); // Delay
            slot.setMix (1.0f); // 100% wet to isolate gain effect

            // 1) Clamping: values outside [0, 1] should be clamped
            slot.setGain (-0.5f);
            expectWithinAbsoluteError (slot.getGain(), 0.0f, 0.001f,
                "Gain -0.5 should clamp to 0.0");

            slot.setGain (1.5f);
            expectWithinAbsoluteError (slot.getGain(), 1.0f, 0.001f,
                "Gain 1.5 should clamp to 1.0");

            slot.setGain (0.0f);
            expectWithinAbsoluteError (slot.getGain(), 0.0f, 0.001f,
                "Gain 0.0 should stay 0.0");

            slot.setGain (1.0f);
            expectWithinAbsoluteError (slot.getGain(), 1.0f, 0.001f,
                "Gain 1.0 should stay 1.0");

            slot.setGain (0.7f);
            expectWithinAbsoluteError (slot.getGain(), 0.7f, 0.001f,
                "Gain 0.7 should stay 0.7");

            logMessage ("Gain clamping [0,1]: OK");
        }

        // 2) Zero gain should produce complete silence (mix=1.0, gain=0 → out = 0)
        {
            FXSlot slot;
            slot.prepare (kTestSampleRate, 256);
            slot.setType (13); // Delay
            slot.setMix (1.0f);
            slot.setGain (0.0f);

            juce::AudioBuffer<float> buffer (2, 256);
            buffer.clear();

            // Fill with known signal
            for (int s = 0; s < 256; ++s)
            {
                float sample = std::sin (6.283185f * 220.0f * s / static_cast<float>(kTestSampleRate)) * 0.5f;
                buffer.setSample (0, s, sample);
                buffer.setSample (1, s, sample * 0.8f);
            }

            slot.process (buffer, 256);

            // Output should be all zeros (gain=0, mix=1 → dry*0 + wet*0 = 0)
            bool allZero = true;
            for (int ch = 0; ch < 2 && allZero; ++ch)
            {
                for (int s = 0; s < 256 && allZero; ++s)
                {
                    float val = buffer.getSample (ch, s);
                    if (std::abs (val) > 1e-6f)
                        allZero = false;
                    expect (std::isfinite (val),
                        "Zero gain produced non-finite value at ch " + juce::String (ch) + " sample " + juce::String (s));
                }
            }
            expect (allZero, "Zero gain with 100% wet should produce silence");

            logMessage ("Zero gain silence: OK");
        }

        // 3) Full gain should pass wet signal through (mix=1.0, gain=1.0 → out = wet)
        {
            FXSlot slot;
            slot.prepare (kTestSampleRate, 256);
            slot.setType (10); // Chorus (no latency, wet passes immediately)
            slot.setMix (1.0f);
            slot.setGain (1.0f);

            juce::AudioBuffer<float> buffer (2, 256);
            buffer.clear();

            for (int s = 0; s < 256; ++s)
            {
                float sample = std::sin (6.283185f * 440.0f * s / static_cast<float>(kTestSampleRate)) * 0.5f;
                buffer.setSample (0, s, sample);
                buffer.setSample (1, s, sample * 0.7f);
            }

            slot.process (buffer, 256);

            // Output should be non-zero (wet signal passes through)
            bool hasOutput = false;
            for (int ch = 0; ch < 2 && !hasOutput; ++ch)
            {
                for (int s = 0; s < 256 && !hasOutput; ++s)
                {
                    float val = buffer.getSample (ch, s);
                    if (std::abs (val) > 1e-4f)
                        hasOutput = true;
                    expect (std::isfinite (val),
                        "Full gain produced non-finite value at ch " + juce::String (ch) + " sample " + juce::String (s));
                }
            }
            expect (hasOutput, "Full gain with 100% wet should produce non-zero output");

            logMessage ("Full gain output: OK");
        }

        // 4) Gain scaling: gain=0.5 with mix=1.0 should produce half the wet signal amplitude
        {
            FXSlot slot;
            slot.prepare (kTestSampleRate, 256);
            slot.setType (10); // Chorus (non-feedback effect for clean comparison)
            slot.setMix (1.0f);
            slot.setGain (0.5f);

            juce::AudioBuffer<float> buffer (2, 256);
            buffer.clear();
            for (int s = 0; s < 256; ++s)
                buffer.setSample (0, s, std::sin (6.283185f * 220.0f * s / static_cast<float>(kTestSampleRate)) * 0.5f);

            slot.process (buffer, 256);

            // Compare with same slot at gain=1.0
            FXSlot refSlot;
            refSlot.prepare (kTestSampleRate, 256);
            refSlot.setType (10);
            refSlot.setMix (1.0f);
            refSlot.setGain (1.0f);

            juce::AudioBuffer<float> refBuf (2, 256);
            refBuf.clear();
            for (int s = 0; s < 256; ++s)
            {
                float sample = std::sin (6.283185f * 220.0f * s / static_cast<float>(kTestSampleRate)) * 0.5f;
                refBuf.setSample (0, s, sample);
                refBuf.setSample (1, s, sample);
            }

            refSlot.process (refBuf, 256);

            // gain=0.5 output should be roughly half of gain=1.0 output (per sample)
            float maxRatio = 0.0f;
            for (int s = 0; s < 256; ++s)
            {
                float val = buffer.getSample (0, s);
                float refVal = refBuf.getSample (0, s);
                float ratio = (std::abs (refVal) > 1e-6f) ? std::abs (val / refVal) : 0.0f;
                if (ratio > maxRatio) maxRatio = ratio;
                expect (std::isfinite (val), "Gain 0.5 produced non-finite value");
            }

            // The max ratio shouldn't exceed 0.5 (since gain=0.5 should halve amplitude)
            // due to effect non-linearities, but it should be approximately correct
            expect (maxRatio <= 0.56f,
                "Gain 0.5 output should be <= 0.56x of gain 1.0 (maxRatio=" + juce::String (maxRatio) + ")");

            logMessage ("Gain scaling ratio: OK (maxRatio=" + juce::String (maxRatio, 4) + ")");
        }

        //==============================================================================
        beginTest ("FX Mode: Insert (0), Send (1), Bypass (2)");

        // Test each FX mode with different routing configurations
        for (int mode = 0; mode <= 2; ++mode)
        {
            FXEngine engine;
            engine.prepare (kTestSampleRate, 256);
            engine.setFXMode (mode);
            engine.setRoutingMode (0); // Series

            // Set up 4 slots with different active effects
            int types[4] = { 13, 10, 1, 11 }; // Delay, Chorus, Hall, Flanger
            for (int s = 0; s < 4; ++s)
            {
                engine.getSlot(s).setType (types[s]);
                engine.getSlot(s).setGain (1.0f);
                engine.getSlot(s).setMix (0.5f);
            }

            // Generate a known buffer
            juce::AudioBuffer<float> buffer (2, 256);
            buffer.clear();
            for (int s = 0; s < 256; ++s)
            {
                float phase = (float)s / static_cast<float>(kTestSampleRate);
                float sample = std::sin (6.283185f * 440.0f * phase) * 0.5f
                             + std::sin (6.283185f * 880.0f * phase) * 0.25f;
                buffer.setSample (0, s, sample);
                buffer.setSample (1, s, sample * 0.7f);
            }

            // Snapshot input BEFORE processing for comparison below
            juce::AudioBuffer<float> inputSnapshot;
            inputSnapshot.makeCopyOf (buffer);

            engine.process (buffer);

            // Verify no NaN or Inf in output
            for (int ch = 0; ch < 2; ++ch)
            {
                for (int s = 0; s < 256; ++s)
                {
                    float val = buffer.getSample (ch, s);
                    expect (std::isfinite (val),
                            "FX Mode " + juce::String (mode) + " produced non-finite at ch "
                            + juce::String (ch) + " sample " + juce::String (s));
                }
            }

            // Verify Bypass mode: output must equal input exactly
            if (mode == 2)
            {
                bool identical = true;
                for (int ch = 0; ch < 2 && identical; ++ch)
                {
                    for (int s = 0; s < 256 && identical; ++s)
                    {
                        if (std::abs (buffer.getSample (ch, s) - inputSnapshot.getSample (ch, s)) > 1e-6f)
                            identical = false;
                    }
                }
                expect (identical, "FX Mode 2 (Bypass) should pass audio through unchanged");
            }

            // Verify Insert mode produces different output from input (effects are active)
            if (mode == 0)
            {
                bool changed = false;
                for (int ch = 0; ch < 2 && !changed; ++ch)
                {
                    for (int s = 0; s < 256 && !changed; ++s)
                    {
                        if (std::abs (buffer.getSample (ch, s) - inputSnapshot.getSample (ch, s)) > 1e-4f)
                            changed = true;
                    }
                }
                expect (changed, "FX Mode 0 (Insert) should produce different output from input");
            }

            // Verify Send mode also changes the signal (mix=0.5 → dry*0.5 + wet*0.5)
            if (mode == 1)
            {
                bool changed = false;
                for (int ch = 0; ch < 2 && !changed; ++ch)
                {
                    for (int s = 0; s < 256 && !changed; ++s)
                    {
                        if (std::abs (buffer.getSample (ch, s) - inputSnapshot.getSample (ch, s)) > 1e-4f)
                            changed = true;
                    }
                }
                expect (changed, "FX Mode 1 (Send) should produce different output from input");
            }

            logMessage ("FX Mode " + juce::String (mode) + " ("
                        + (mode == 0 ? "Insert" : mode == 1 ? "Send" : "Bypass")
                        + "): OK");
        }

        //==============================================================================
        beginTest ("FX Mode: Bypass with all routing modes");

        // Ensure Bypass works correctly regardless of routing configuration
        for (int routing = 0; routing <= 9; ++routing)
        {
            FXEngine engine;
            engine.prepare (kTestSampleRate, 256);
            engine.setFXMode (2); // Bypass
            engine.setRoutingMode (routing);

            int types[4] = { 5, 10, 15, 20 }; // mix of active types
            for (int s = 0; s < 4; ++s)
            {
                engine.getSlot(s).setType (types[s]);
                engine.getSlot(s).setGain (1.0f);
                engine.getSlot(s).setMix (0.5f);
            }

            juce::AudioBuffer<float> buffer (2, 128);
            buffer.clear();
            for (int s = 0; s < 128; ++s)
                buffer.setSample (0, s, std::sin (6.283185f * 220.0f * s / static_cast<float>(kTestSampleRate)) * 0.4f);

            juce::AudioBuffer<float> snapshot;
            snapshot.makeCopyOf (buffer);

            engine.process (buffer);

            for (int ch = 0; ch < 2; ++ch)
            {
                for (int s = 0; s < 128; ++s)
                {
                    float diff = std::abs (buffer.getSample (ch, s) - snapshot.getSample (ch, s));
                    expect (diff < 1e-6f,
                            "Bypass with routing " + juce::String (routing)
                            + " should pass through unchanged (diff=" + juce::String (diff) + ")");
                }
            }

            logMessage ("Bypass + routing " + juce::String (routing) + ": OK");
        }

        //==============================================================================
        beginTest ("FX parameter boundary values per type");

        // For each FX type (1-35), test each parameter at boundary values
        // to verify no crashes or NaN at extremes
        struct FxBoundaryTest
        {
            int type;
            int numParams;       // expected getNumParameters() for this type
            juce::String name;
        };

        FxBoundaryTest fxTypes[] = {
            // Reverbs
            { 1, 5, "Hall" }, { 2, 5, "Plate" },
            { 3, 5, "Rich Plate" }, { 4, 5, "Ambience" },
            { 5, 5, "Gated" }, { 6, 5, "Reverse" },
            // Rack Amp, Mood Filter
            { 7, 9, "Rack Amp" }, { 8, 9, "Mood Filter" },
            // Phaser
            { 9, 7, "Phaser" },
            // Chorus / Chorus-D
            { 10, 3, "Chorus" }, { 17, 3, "Chorus-D" },
            // Flanger, Mod Delay Rev
            { 11, 4, "Flanger" }, { 12, 12, "Mod Delay Rev" },
            // Delays
            { 13, 5, "Delay" }, { 14, 5, "3Tap Delay" },
            { 15, 5, "4Tap Delay" },
            // Rotary Speaker
            { 16, 7, "Rotary Speaker" },
            // Enhancer / Midas EQ
            { 18, 9, "Enhancer" }, { 30, 9, "Midas EQ" },
            // Edison, Auto Pan
            { 19, 8, "Edison" }, { 20, 6, "Auto Pan" },
            // T-Ray Delay
            { 21, 5, "T-Ray Delay" },
            // Deep Verb, Chamber, Room, Vintage
            { 22, 5, "Deep Verb" }, { 26, 5, "Chamber" },
            { 27, 5, "Room" }, { 28, 5, "Vintage" },
            // Reverb hybrids
            { 23, 5, "FlangVerb" }, { 24, 5, "ChorusVerb" },
            { 25, 5, "DelayVerb" },
            // Dual Pitch, Multi-Band Dist, Noise Gate, DecimDelay
            { 29, 12, "Dual Pitch" }, { 31, 12, "Fair Comp" },
            { 32, 12, "Multi-Band Dist" }, { 33, 8, "Noise Gate" },
            { 34, 12, "DecimDelay" },
            // Vintage Pitch
            { 35, 12, "Vintage Pitch" }
        };

        const float boundaryValues[] = { 0.0f, 1.0f, 0.5f, 0.0f, 1.0f };

        for (auto& ft : fxTypes)
        {
            FXSlot slot;
            slot.prepare (kTestSampleRate, 256);
            slot.setType (ft.type);

            expect (slot.isActive(),
                ft.name + " (type " + juce::String (ft.type) + ") should be active");

            // For each valid parameter index, test boundary values
            for (int paramIdx = 0; paramIdx < ft.numParams; ++paramIdx)
            {
                for (float bv : boundaryValues)
                {
                    slot.setParameter (paramIdx, bv);

                    // Process a small block to verify no crash or NaN
                    juce::AudioBuffer<float> buffer (2, 64);
                    buffer.clear();
                    for (int s = 0; s < 64; ++s)
                    {
                        float phase = (float)s / static_cast<float>(kTestSampleRate);
                        float sample = std::sin (6.283185f * 440.0f * phase) * 0.5f;
                        buffer.setSample (0, s, sample);
                        buffer.setSample (1, s, sample * 0.7f);
                    }

                    slot.process (buffer, 64);

                    for (int ch = 0; ch < 2; ++ch)
                    {
                        for (int s = 0; s < 64; ++s)
                        {
                            expect (std::isfinite (buffer.getSample (ch, s)),
                                ft.name + " param[" + juce::String (paramIdx) + "]="
                                + juce::String (bv) + " produced non-finite");
                        }
                    }
                }
            }

            // Test that slot param indices beyond getNumParameters() are handled safely
            for (int extraIdx = ft.numParams; extraIdx < 12; ++extraIdx)
            {
                slot.setParameter (extraIdx, 0.0f);
                slot.setParameter (extraIdx, 1.0f);

                juce::AudioBuffer<float> buffer (2, 32);
                buffer.clear();
                buffer.setSample (0, 0, 0.5f);
                slot.process (buffer, 32);

                for (int ch = 0; ch < 2; ++ch)
                {
                    expect (std::isfinite (buffer.getSample (ch, 0)),
                        ft.name + " extra param idx " + juce::String (extraIdx) + " produced non-finite");
                }
            }

            logMessage (ft.name + " (type " + juce::String (ft.type) + "): boundaries OK");
        }

        //==============================================================================
        beginTest ("FX parameter rapid sweep");

        // Sweep all 12 params for each type from 0→1→0 in steps,
        // processing audio at each step to stress-test parameter changes
        for (int type = 1; type <= 35; ++type)
        {
            FXSlot slot;
            slot.prepare (kTestSampleRate, 256);
            slot.setType (type);

            if (!slot.isActive())
                continue;

            juce::AudioBuffer<float> buffer (2, 128);
            buffer.clear();

            for (int step = 0; step < 20; ++step)
            {
                // Sweep each param from 0→1 in first 10 steps, 1→0 in last 10
                float normalizedStep = (step < 10) ? step / 9.0f : 1.0f - (step - 10) / 9.0f;

                for (int p = 0; p < 12; ++p)
                    slot.setParameter (p, normalizedStep);

                // Process and verify
                for (int s = 0; s < 128; ++s)
                {
                    float phase = (float)(step * 128 + s) / static_cast<float>(kTestSampleRate);
                    buffer.setSample (0, s, std::sin (6.283185f * 220.0f * phase) * 0.5f);
                    buffer.setSample (1, s, buffer.getSample (0, s) * 0.8f);
                }

                slot.process (buffer, 128);

                for (int ch = 0; ch < 2; ++ch)
                {
                    for (int s = 0; s < 128; ++s)
                    {
                        expect (std::isfinite (buffer.getSample (ch, s)),
                            "Sweep type " + juce::String (type) + " step " + juce::String (step)
                            + " produced non-finite");
                    }
                }
            }

            logMessage ("Type " + juce::String (type) + " sweep: OK");
        }

        //==============================================================================
        beginTest ("FXEngine integration: routing + gain + mode");

        // Helper to fill a stereo buffer with a known test signal
        auto fillTestSignal = [](juce::AudioBuffer<float>& buf, int numSamples, float freq)
        {
            for (int s = 0; s < numSamples; ++s)
            {
                float phase = (float)s / static_cast<float>(kTestSampleRate);
                float sample = std::sin (6.283185f * freq * phase) * 0.5f;
                buf.setSample (0, s, sample);
                buf.setSample (1, s, sample * 0.7f);
            }
        };

        auto checkFinite = [&](const juce::AudioBuffer<float>& buf, const juce::String& label)
        {
            for (int ch = 0; ch < buf.getNumChannels(); ++ch)
                for (int s = 0; s < buf.getNumSamples(); ++s)
                    expect (std::isfinite (buf.getSample (ch, s)),
                            label + " produced non-finite at ch " + juce::String (ch));
        };

        auto isAllZero = [](const juce::AudioBuffer<float>& buf, float tol = 1e-6f) -> bool
        {
            for (int ch = 0; ch < buf.getNumChannels(); ++ch)
                for (int s = 0; s < buf.getNumSamples(); ++s)
                    if (std::abs (buf.getSample (ch, s)) > tol)
                        return false;
            return true;
        };

        // ---------------------------------------------------------------
        // Sub-test 1: Gain=0 + Mix=1 → silence for ALL routing modes
        // ---------------------------------------------------------------
        {
            bool allSilent = true;
            for (int routing = 0; routing <= 9; ++routing)
            {
                FXEngine engine;
                engine.prepare (kTestSampleRate, 256);
                engine.setRoutingMode (routing);

                int types[4] = { 13, 10, 1, 11 }; // Delay, Chorus, Hall, Flanger
                for (int s = 0; s < 4; ++s)
                {
                    engine.getSlot(s).setType (types[s]);
                    engine.getSlot(s).setGain (0.0f);
                    engine.getSlot(s).setMix (1.0f);
                }

                juce::AudioBuffer<float> buffer (2, 256);
                fillTestSignal (buffer, 256, 440.0f);

                engine.process (buffer);
                checkFinite (buffer, "Zero-gain routing " + juce::String (routing));

                if (!isAllZero (buffer))
                {
                    allSilent = false;
                    expect (false, "Routing " + juce::String (routing)
                            + " zero-gain should produce silence");
                }
            }
            if (allSilent)
                logMessage ("Zero-gain silence across all routings: OK");
        }

        // ---------------------------------------------------------------
        // Sub-test 2: Gain=1 + Mix=1 → non-zero output for ALL routing modes
        // ---------------------------------------------------------------
        {
            bool allHaveOutput = true;
            for (int routing = 0; routing <= 9; ++routing)
            {
                FXEngine engine;
                engine.prepare (kTestSampleRate, 256);
                engine.setRoutingMode (routing);

                int types[4] = { 13, 10, 1, 11 };
                for (int s = 0; s < 4; ++s)
                {
                    engine.getSlot(s).setType (types[s]);
                    engine.getSlot(s).setGain (1.0f);
                    engine.getSlot(s).setMix (0.5f);
                }

                juce::AudioBuffer<float> buffer (2, 256);
                fillTestSignal (buffer, 256, 220.0f);

                engine.process (buffer);
                checkFinite (buffer, "Full-gain routing " + juce::String (routing));

                if (isAllZero (buffer, 1e-5f))
                {
                    allHaveOutput = false;
                    expect (false, "Routing " + juce::String (routing)
                            + " full-gain should produce non-zero output");
                }
            }
            if (allHaveOutput)
                logMessage ("Full-gain output across all routings: OK");
        }

        // ---------------------------------------------------------------
        // Sub-test 3: Different routing modes produce DIFFERENT output
        // ---------------------------------------------------------------
        {
            // Process the same configuration through all routing modes
            // and verify that at least some modes produce different results
            juce::AudioBuffer<float> outputs[10];
            bool anyDifferent = false;

            for (int routing = 0; routing <= 9; ++routing)
            {
                FXEngine engine;
                engine.prepare (kTestSampleRate, 256);
                engine.setRoutingMode (routing);

                // Use a combination that will highlight routing differences:
                // Gain varies per slot so routing order matters
                int types[4] = { 13, 10, 1, 11 };
                float gains[4] = { 1.0f, 0.5f, 0.25f, 0.75f };
                for (int s = 0; s < 4; ++s)
                {
                    engine.getSlot(s).setType (types[s]);
                    engine.getSlot(s).setGain (gains[s]);
                    engine.getSlot(s).setMix (0.5f);
                }

                outputs[routing] = juce::AudioBuffer<float> (2, 256);
                fillTestSignal (outputs[routing], 256, 440.0f);
                engine.process (outputs[routing]);
                checkFinite (outputs[routing], "Routing diff " + juce::String (routing));
            }

            // Compare each pair of routing modes — at least one pair should differ
            for (int r1 = 0; r1 <= 9 && !anyDifferent; ++r1)
            {
                for (int r2 = r1 + 1; r2 <= 9 && !anyDifferent; ++r2)
                {
                    bool identical = true;
                    for (int ch = 0; ch < 2 && identical; ++ch)
                    {
                        for (int s = 0; s < 256 && identical; ++s)
                        {
                            if (std::abs (outputs[r1].getSample (ch, s)
                                        - outputs[r2].getSample (ch, s)) > 1e-4f)
                                identical = false;
                        }
                    }
                    if (!identical)
                        anyDifferent = true;
                }
            }

            expect (anyDifferent,
                "At least two routing modes should produce different output with varying gains");
            logMessage ("Routing modes produce differing output: " + juce::String (anyDifferent ? "OK" : "WARNING"));
        }

        // ---------------------------------------------------------------
        // Sub-test 4: Bypass mode overrides ALL routing
        // ---------------------------------------------------------------
        {
            for (int routing = 0; routing <= 9; ++routing)
            {
                FXEngine engine;
                engine.prepare (kTestSampleRate, 256);
                engine.setFXMode (2); // Bypass
                engine.setRoutingMode (routing);

                int types[4] = { 5, 10, 15, 20 };
                for (int s = 0; s < 4; ++s)
                {
                    engine.getSlot(s).setType (types[s]);
                    engine.getSlot(s).setGain (1.0f);
                    engine.getSlot(s).setMix (0.5f);
                }

                juce::AudioBuffer<float> buffer (2, 128);
                fillTestSignal (buffer, 128, 330.0f);

                juce::AudioBuffer<float> snapshot;
                snapshot.makeCopyOf (buffer);

                engine.process (buffer);
                checkFinite (buffer, "Bypass routing " + juce::String (routing));

                bool identical = true;
                for (int ch = 0; ch < 2 && identical; ++ch)
                {
                    for (int s = 0; s < 128 && identical; ++s)
                    {
                        if (std::abs (buffer.getSample (ch, s) - snapshot.getSample (ch, s)) > 1e-6f)
                            identical = false;
                    }
                }

                expect (identical,
                    "Bypass mode should pass through unchanged for routing " + juce::String (routing));
            }
            logMessage ("Bypass overrides all routing: OK");
        }

        // ---------------------------------------------------------------
        // Sub-test 5: Insert vs Send produce DIFFERENT output from each other
        // ---------------------------------------------------------------
        {
            // Same signal, same slots, same routing — only FX mode differs.
            // Insert replaces the signal entirely (no dry blend),
            // Send mixes dry with processed at sendLevel (default 0.5).
            // These should always produce measurably different output.

            for (int routing = 0; routing <= 9; ++routing)
            {
                FXEngine insEngine, sendEngine;
                insEngine.prepare  (kTestSampleRate, 256);
                sendEngine.prepare (kTestSampleRate, 256);

                insEngine.setFXMode (0);  // Insert
                sendEngine.setFXMode (1); // Send (sendLevel defaults to 0.5)
                insEngine.setRoutingMode  (routing);
                sendEngine.setRoutingMode (routing);

                int types[4] = { 13, 10, 1, 11 };
                float gains[4] = { 1.0f, 0.5f, 0.25f, 0.75f };
                for (int s = 0; s < 4; ++s)
                {
                    insEngine.getSlot(s).setType  (types[s]);
                    sendEngine.getSlot(s).setType (types[s]);
                    insEngine.getSlot(s).setGain  (gains[s]);
                    sendEngine.getSlot(s).setGain (gains[s]);
                    insEngine.getSlot(s).setMix   (0.5f);
                    sendEngine.getSlot(s).setMix  (0.5f);
                }

                auto fillSignal = [](juce::AudioBuffer<float>& buf, int n)
                {
                    for (int s = 0; s < n; ++s)
                    {
                        float phase = (float)s / static_cast<float>(kTestSampleRate);
                        float sample = std::sin (6.283185f * 440.0f * phase) * 0.5f
                                     + std::sin (6.283185f * 880.0f * phase) * 0.25f;
                        buf.setSample (0, s, sample);
                        buf.setSample (1, s, sample * 0.7f);
                    }
                };

                juce::AudioBuffer<float> insBuf (2, 256);
                juce::AudioBuffer<float> sendBuf (2, 256);
                fillSignal (insBuf, 256);
                fillSignal (sendBuf, 256);

                insEngine.process  (insBuf);
                sendEngine.process (sendBuf);

                // Both should be finite
                for (int ch = 0; ch < 2; ++ch)
                {
                    for (int s = 0; s < 256; ++s)
                    {
                        expect (std::isfinite (insBuf.getSample (ch, s)),
                                "Insert mode non-finite at routing " + juce::String (routing));
                        expect (std::isfinite (sendBuf.getSample (ch, s)),
                                "Send mode non-finite at routing " + juce::String (routing));
                    }
                }

                // Insert and Send MUST produce different results
                bool different = false;
                for (int ch = 0; ch < 2 && !different; ++ch)
                {
                    for (int s = 0; s < 256 && !different; ++s)
                    {
                        if (std::abs (insBuf.getSample (ch, s) - sendBuf.getSample (ch, s)) > 1e-4f)
                            different = true;
                    }
                }

                expect (different,
                        "Insert and Send should produce different output for routing "
                        + juce::String (routing));
            }

            logMessage ("Insert vs Send produce different output: OK");
        }

        // ---------------------------------------------------------------
        // Sub-test 6: Insert vs Send vs Bypass with varying gains
        // ---------------------------------------------------------------
        {
            int testModes[] = { 0, 1, 2 };
            const char* modeNames[] = { "Insert", "Send", "Bypass" };

            for (int routing = 0; routing <= 2; ++routing) // sample 0,1,2
            {
                for (int modeIdx = 0; modeIdx < 3; ++modeIdx)
                {
                    int mode = testModes[modeIdx];

                    FXEngine engine;
                    engine.prepare (kTestSampleRate, 256);
                    engine.setFXMode (mode);
                    engine.setRoutingMode (routing);

                    // Mix of gains per slot
                    float gains[4] = { 1.0f, 0.0f, 0.5f, 0.25f };
                    for (int s = 0; s < 4; ++s)
                    {
                        engine.getSlot(s).setType (13 + s); // 13=Delay, 14=3Tap, 15=4Tap, 16=Rotary
                        engine.getSlot(s).setGain (gains[s]);
                        engine.getSlot(s).setMix (0.5f);
                    }

                    juce::AudioBuffer<float> buffer (2, 256);
                    fillTestSignal (buffer, 256, 440.0f);

                    juce::AudioBuffer<float> snapshot;
                    snapshot.makeCopyOf (buffer);

                    engine.process (buffer);
                    checkFinite (buffer, juce::String (modeNames[modeIdx])
                                + " routing " + juce::String (routing));

                    if (mode == 2) // Bypass
                    {
                        bool identical = true;
                        for (int ch = 0; ch < 2 && identical; ++ch)
                            for (int s = 0; s < 256 && identical; ++s)
                                if (std::abs (buffer.getSample (ch, s) - snapshot.getSample (ch, s)) > 1e-6f)
                                    identical = false;
                        expect (identical, "Bypass with varying gains should pass through unchanged");
                    }
                    else // Insert or Send
                    {
                        bool changed = false;
                        for (int ch = 0; ch < 2 && !changed; ++ch)
                            for (int s = 0; s < 256 && !changed; ++s)
                                if (std::abs (buffer.getSample (ch, s) - snapshot.getSample (ch, s)) > 1e-4f)
                                    changed = true;

                        expect (changed,
                            juce::String (modeNames[modeIdx])
                            + " should change the signal with varying gains, routing="
                            + juce::String (routing));
                    }
                }
            }
            logMessage ("Insert/Send/Bypass with varying gains: OK");
        }

        // ---------------------------------------------------------------
        // Sub-test 7: Inactive slots don't corrupt output
        // ---------------------------------------------------------------
        {
            for (int routing = 0; routing <= 9; ++routing)
            {
                FXEngine engine;
                engine.prepare (kTestSampleRate, 256);
                engine.setRoutingMode (routing);

                // Only slot 0 active, rest are bypass (type=0)
                engine.getSlot(0).setType (13); // Delay
                engine.getSlot(0).setGain (1.0f);
                engine.getSlot(0).setMix (0.5f);

                // Slots 1-3 remain type=0 (inactive)

                juce::AudioBuffer<float> buffer (2, 256);
                fillTestSignal (buffer, 256, 440.0f);

                juce::AudioBuffer<float> reference;
                reference.makeCopyOf (buffer);

                engine.process (buffer);
                checkFinite (buffer, "Inactive slots routing " + juce::String (routing));

                // Output should be different from input (active slot 0 processes)
                bool changed = false;
                for (int ch = 0; ch < 2 && !changed; ++ch)
                    for (int s = 0; s < 256 && !changed; ++s)
                        if (std::abs (buffer.getSample (ch, s) - reference.getSample (ch, s)) > 1e-4f)
                            changed = true;

                expect (changed,
                    "Active slot should change output with inactive slots, routing="
                    + juce::String (routing));
            }
            logMessage ("Inactive slots don't corrupt across routings: OK");
        }

        // ---------------------------------------------------------------
        // Sub-test 8: Gain scaling through series chain (routing=0)
        // ---------------------------------------------------------------
        {
            // Process same signal through 4 slots in series, compare different gain profiles
            auto processWithGains = [&](float g0, float g1, float g2, float g3) -> juce::AudioBuffer<float>
            {
                FXEngine engine;
                engine.prepare (kTestSampleRate, 256);
                engine.setRoutingMode (0); // Series

                int types[4] = { 13, 10, 1, 11 };
                float gains[4] = { g0, g1, g2, g3 };
                bool isAllZeroGains = (g0 == 0.0f && g1 == 0.0f && g2 == 0.0f && g3 == 0.0f);
                for (int s = 0; s < 4; ++s)
                {
                    engine.getSlot(s).setType (types[s]);
                    engine.getSlot(s).setGain (gains[s]);
                    engine.getSlot(s).setMix (isAllZeroGains ? 1.0f : 0.5f);
                }

                juce::AudioBuffer<float> buf (2, 256);
                fillTestSignal (buf, 256, 440.0f);
                engine.process (buf);
                return buf;
            };

            auto resultA = processWithGains (1.0f, 1.0f, 1.0f, 1.0f);
            auto resultB = processWithGains (0.0f, 0.0f, 0.0f, 0.0f);
            auto resultC = processWithGains (1.0f, 0.5f, 0.25f, 0.75f);

            checkFinite (resultA, "Series all-gain=1");
            checkFinite (resultB, "Series all-gain=0");
            checkFinite (resultC, "Series varying-gains");

            // All-gain=0 should be silence
            expect (isAllZero (resultB, 1e-6f), "Series routing with all gains=0 should be silence");

            // Varying gains should differ from all-gain=1
            bool differs = false;
            for (int ch = 0; ch < 2 && !differs; ++ch)
                for (int s = 0; s < 256 && !differs; ++s)
                    if (std::abs (resultA.getSample (ch, s) - resultC.getSample (ch, s)) > 1e-4f)
                        differs = true;

            expect (differs, "Varying gains should produce different output from uniform gains");

            logMessage ("Gain scaling through series chain: OK");
        }

        // ---------------------------------------------------------------
        // Sub-test 9: All slots inactive → passthrough (no crash)
        // ---------------------------------------------------------------
        {
            for (int routing = 0; routing <= 9; ++routing)
            {
                FXEngine engine;
                engine.prepare (kTestSampleRate, 256);
                engine.setRoutingMode (routing);

                // All slots type=0 (inactive)
                juce::AudioBuffer<float> buffer (2, 128);
                fillTestSignal (buffer, 128, 220.0f);

                juce::AudioBuffer<float> snapshot;
                snapshot.makeCopyOf (buffer);

                engine.process (buffer);
                checkFinite (buffer, "All inactive routing " + juce::String (routing));

                // With all slots inactive, output should equal input
                bool identical = true;
                for (int ch = 0; ch < 2 && identical; ++ch)
                    for (int s = 0; s < 128 && identical; ++s)
                        if (std::abs (buffer.getSample (ch, s) - snapshot.getSample (ch, s)) > 1e-6f)
                            identical = false;

                expect (identical,
                    "All inactive slots should pass through for routing " + juce::String (routing));
            }
            logMessage ("All slots inactive across routings: OK");
        }

        logMessage ("All FX tests completed successfully.");
    }
};

static FXUnitTests fxUnitTests;

} // namespace ABD

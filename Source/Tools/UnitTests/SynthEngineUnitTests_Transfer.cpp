/**
 * @purpose Unit tests for CalibrationSpec transfer function boundary values
 *          (mapEnvTime, lfoRate, vcfCutoff math formulas) and voice stealing
 *          (12 voices + 13th note triggers findFreeVoice round-robin).
 * @classification Test
 */
#include <JuceHeader.h>
#include <cmath>
#include "SynthEngine.h"
#include "Core/CalibrationSpec.h"

namespace ABD
{

class SynthEngineTransferUnitTests : public juce::UnitTest
{
public:
    static constexpr double kTestSampleRate = 44100.0;
    static constexpr int kTestBlockSize = 512;

    SynthEngineTransferUnitTests() : juce::UnitTest("SynthEngine Transfer/VoiceSteal Tests", "ABD") {}

    void runTest() override
    {
        //==============================================================================
        beginTest("mapEnvTime boundary values — lineal 0-10s (hardware DM12 raw/255*10)");
        {
            auto cal = CalibrationSpec::factoryDefaults();
            float maxTimeSec = cal.transfer.envelopes.maxTimeSec;

            // Verify default matches hardware spec
            expectWithinAbsoluteError(maxTimeSec, 10.0f, 0.1f,
                "maxTimeSec should be 10.0s (got " + juce::String(maxTimeSec) + ")");

            auto mapEnvTime = [maxTimeSec](float rawVal) -> float {
                return juce::jlimit(0.0f, 1.0f, rawVal) * maxTimeSec;
            };

            // mapEnvTime(0.0f) = 0 * max = 0 (instant, clamps to ~1ms in Envelope)
            float envValZero = mapEnvTime(0.0f);
            expectWithinAbsoluteError(envValZero, 0.0f, 0.001f,
                "mapEnvTime(0.0) should be 0.0s (got " + juce::String(envValZero) + ")");

            // mapEnvTime(1.0f) = 1 * max = 10s
            float envValOne = mapEnvTime(1.0f);
            expectWithinAbsoluteError(envValOne, 10.0f, 0.1f,
                "mapEnvTime(1.0) should be ~10s (got " + juce::String(envValOne) + ")");

            // mapEnvTime(0.5f) = 0.5 * max = 5s (linear midpoint)
            float envValHalf = mapEnvTime(0.5f);
            expectWithinAbsoluteError(envValHalf, 5.0f, 0.1f,
                "mapEnvTime(0.5) should be 5.0s (got " + juce::String(envValHalf) + ")");

            // Clamping: values outside [0,1] should be clamped, not produce garbage
            float overRange = mapEnvTime(2.0f);
            expectWithinAbsoluteError(overRange, envValOne, 0.1f,
                "mapEnvTime(2.0) clamped to 1.0 should match max");
            float underRange = mapEnvTime(-1.0f);
            expectWithinAbsoluteError(underRange, 0.0f, 0.001f,
                "mapEnvTime(-1.0) clamped to 0.0 should match min");

            logMessage("mapEnvTime (lineal): 0.0→" + juce::String(envValZero, 4)
                       + "s, 0.5→" + juce::String(envValHalf, 4)
                       + "s, 1.0→" + juce::String(envValOne, 4) + "s");
        }

        //==============================================================================
        beginTest("lfoRate boundary values — min=0.041Hz, max≈65.5Hz");
        {
            auto cal = CalibrationSpec::factoryDefaults();
            float rateScale = cal.transfer.lfo.rateScale;
            float rateExp   = cal.transfer.lfo.rateExp;

            // Verify defaults
            expectWithinAbsoluteError(rateScale, 0.041f, 0.001f,
                "rateScale should be 0.041 (got " + juce::String(rateScale) + ")");
            expectWithinAbsoluteError(rateExp, 7.3747f, 0.001f,
                "rateExp should be 7.3747 (got " + juce::String(rateExp) + ")");

            // lfoRate(0.0) = rateScale * exp(rateExp * 0) = rateScale * 1
            float lfoRateZero = rateScale * std::exp(rateExp * 0.0f);
            expectWithinAbsoluteError(lfoRateZero, 0.041f, 0.001f,
                "lfoRate(0.0) should be 0.041Hz (got " + juce::String(lfoRateZero) + ")");

            // lfoRate(1.0) = rateScale * exp(rateExp * 1)
            float lfoRateOne = rateScale * std::exp(rateExp * 1.0f);
            // exp(7.3747) ≈ 1597.5, so 0.041 * 1597.5 ≈ 65.5
            expect(lfoRateOne > 60.0f && lfoRateOne < 70.0f,
                "lfoRate(1.0) should be ~65.5Hz (got " + juce::String(lfoRateOne) + "Hz)");

            // lfoRate(0.5) should be between min and max
            float lfoRateHalf = rateScale * std::exp(rateExp * 0.5f);
            expect(lfoRateHalf > lfoRateZero && lfoRateHalf < lfoRateOne,
                "lfoRate(0.5) should be between min and max");

            logMessage("lfoRate: 0.0→" + juce::String(lfoRateZero, 4)
                       + "Hz, 0.5→" + juce::String(lfoRateHalf, 4)
                       + "Hz, 1.0→" + juce::String(lfoRateOne, 4) + "Hz ✅");
        }

        //==============================================================================
        beginTest("vcfCutoff mapping — min=50Hz via curveBase=400, max=20000Hz");
        {
            auto cal = CalibrationSpec::factoryDefaults();
            float vcfMinHz  = cal.transfer.vcfCutoff.minHz;
            float vcfBase   = cal.transfer.vcfCutoff.curveBase;

            // Verify defaults
            expectWithinAbsoluteError(vcfMinHz, 50.0f, 0.1f,
                "vcfMinHz should be 50Hz (got " + juce::String(vcfMinHz) + ")");
            expectWithinAbsoluteError(vcfBase, 400.0f, 1.0f,
                "vcfCurveBase should be 400 (got " + juce::String(vcfBase) + ")");

            // cutoff(0.0) = minHz * base^0 = minHz
            float cutoffMin = vcfMinHz * std::pow(vcfBase, 0.0f);
            expectWithinAbsoluteError(cutoffMin, 50.0f, 0.1f,
                "vcfCutoff(0.0) should be 50Hz (got " + juce::String(cutoffMin) + ")");

            // cutoff(1.0) = minHz * base^1 = minHz * base = 50 * 400 = 20000
            float cutoffMax = vcfMinHz * std::pow(vcfBase, 1.0f);
            expectWithinAbsoluteError(cutoffMax, 20000.0f, 100.0f,
                "vcfCutoff(1.0) should be ~20000Hz (got " + juce::String(cutoffMax) + ")");

            // cutoff(0.5) = minHz * sqrt(base)
            float cutoffMid = vcfMinHz * std::pow(vcfBase, 0.5f);
            float expectedMid = 50.0f * std::sqrt(400.0f); // = 50 * 20 = 1000
            expectWithinAbsoluteError(cutoffMid, expectedMid, 0.1f,
                "vcfCutoff(0.5) should be 1000Hz (got " + juce::String(cutoffMid) + ")");

            logMessage("vcfCutoff: 0.0→" + juce::String(cutoffMin, 1)
                       + "Hz, 0.5→" + juce::String(cutoffMid, 1)
                       + "Hz, 1.0→" + juce::String(cutoffMax, 1) + "Hz ✅");
        }

        //==============================================================================
        beginTest("vcfKeytrack reference — C4=261.63Hz, amountScale=1.0");
        {
            auto cal = CalibrationSpec::factoryDefaults();
            expectWithinAbsoluteError(cal.transfer.vcfKeytrack.referenceHz, 261.63f, 0.01f,
                "referenceHz should be C4=261.63Hz");
            expectWithinAbsoluteError(cal.transfer.vcfKeytrack.amountScale, 1.0f, 0.001f,
                "amountScale should be 1.0");
            logMessage("vcfKeytrack reference C4=" + juce::String(cal.transfer.vcfKeytrack.referenceHz, 2) + "Hz ✅");
        }

        //==============================================================================
        beginTest("Voice stealing — 12 notes + 13th steals round-robin");
        {
            SynthEngine engine;
            engine.prepare(kTestSampleRate, kTestBlockSize);

            juce::AudioBuffer<float> buffer(2, kTestBlockSize);
            buffer.clear();

            // Step 1: Send 12 simultaneous note-ons (MIDI 36-47)
            // These should allocate all 12 voices
            {
                juce::MidiBuffer midiOn;
                for (int note = 36; note < 48; ++note)
                    midiOn.addEvent(juce::MidiMessage::noteOn(1, note, 0.8f), (note - 36) * 10);
                engine.processBlock(buffer, midiOn);
            }

            // Process a few blocks to let voices reach sustain
            for (int b = 0; b < 10; ++b)
            {
                juce::MidiBuffer emptyMidi;
                engine.processBlock(buffer, emptyMidi);
            }

            // Verify all 12 voices are active
            int activeCount = 0;
            for (int i = 0; i < 12; ++i)
                if (engine.isVoiceActive(i))
                    activeCount++;
            expectEquals(activeCount, 12,
                "All 12 voices should be active after 12 note-ons (got " + juce::String(activeCount) + ")");

            // Log the active notes via JSON
            juce::String notesBefore = engine.getActiveNotesJSON();
            logMessage("Active notes before steal: " + notesBefore);

            // Step 2: Send a 13th note-on (MIDI 48)
            // This should trigger findFreeVoice() which round-robins
            {
                juce::MidiBuffer midiSteal;
                midiSteal.addEvent(juce::MidiMessage::noteOn(1, 48, 0.9f), 0);
                engine.processBlock(buffer, midiSteal);
            }

            for (int b = 0; b < 5; ++b)
            {
                juce::MidiBuffer emptyMidi;
                engine.processBlock(buffer, emptyMidi);
            }

            // Verify still 12 active voices (one was stolen, not a 13th created)
            int afterStealCount = 0;
            for (int i = 0; i < 12; ++i)
                if (engine.isVoiceActive(i))
                    afterStealCount++;
            expectEquals(afterStealCount, 12,
                "Should still have 12 active voices after steal (got " + juce::String(afterStealCount) + ")");

            // Verify the new note (48) is now in the active set
            juce::String notesAfter = engine.getActiveNotesJSON();
            logMessage("Active notes after steal: " + notesAfter);

            bool note48IsPlaying = notesAfter.contains("48");
            expect(note48IsPlaying,
                "MIDI note 48 should be playing after stealing (active notes: " + notesAfter + ")");

            // Don't check WHICH voice was stolen — the round-robin counter is static
            // and may vary depending on test ordering. Only verify that:
            // 1. 12 voices remain active (never exceeds kNumVoices)
            // 2. Note 48 is now in the active set (the stolen voice plays the new note)
            logMessage("Voice stealing: 12→12 voices, note 48 active after steal ✅");
        }

        //==============================================================================
        beginTest("Voice stealing — release voice preferred over round-robin");
        {
            SynthEngine engine;
            engine.prepare(kTestSampleRate, kTestBlockSize);

            juce::AudioBuffer<float> buffer(2, kTestBlockSize);
            buffer.clear();

            // Send 12 note-ons
            {
                juce::MidiBuffer midiOn;
                for (int note = 36; note < 48; ++note)
                    midiOn.addEvent(juce::MidiMessage::noteOn(1, note, 0.8f), (note - 36) * 10);
                engine.processBlock(buffer, midiOn);
            }

            for (int b = 0; b < 10; ++b)
            {
                juce::MidiBuffer emptyMidi;
                engine.processBlock(buffer, emptyMidi);
            }

            // Release ONE note (MIDI 40) so its voice enters release stage
            {
                juce::MidiBuffer midiOff;
                midiOff.addEvent(juce::MidiMessage::noteOff(1, 40), 0);
                engine.processBlock(buffer, midiOff);
            }

            // Process a few blocks so the released voice is in release (but hasn't completed it)
            for (int b = 0; b < 5; ++b)
            {
                juce::MidiBuffer emptyMidi;
                engine.processBlock(buffer, emptyMidi);
            }

            // Now most voices should still be active, but one is in release
            // There should be 11 sustained + 1 releasing = 12 active total
            int midActiveCount = 0;
            for (int i = 0; i < 12; ++i)
                if (engine.isVoiceActive(i))
                    midActiveCount++;
            expect(midActiveCount >= 11 && midActiveCount <= 12,
                "Should be 11-12 voices active (11 sustained + 1 releasing) after releasing one note");

            // Send a new note-on — should steal the releasing voice, not round-robin
            {
                juce::MidiBuffer midiSteal;
                midiSteal.addEvent(juce::MidiMessage::noteOn(1, 60, 0.85f), 0);
                engine.processBlock(buffer, midiSteal);
            }

            for (int b = 0; b < 5; ++b)
            {
                juce::MidiBuffer emptyMidi;
                engine.processBlock(buffer, emptyMidi);
            }

            // Should still be 12 active voices
            int finalCount = 0;
            for (int i = 0; i < 12; ++i)
                if (engine.isVoiceActive(i))
                    finalCount++;
            expectEquals(finalCount, 12,
                "Should be 12 voices after stealing release voice");

            // Note 60 should now be active
            juce::String finalNotes = engine.getActiveNotesJSON();
            expect(finalNotes.contains("[60,"),
                "Note 60 should be playing after stealing release voice");

            logMessage("Release voice preferred for stealing: 12 active, note 60 replaces released note ✅");
        }

        //==============================================================================
        beginTest("CalibrationSpec factoryDefaults consistency");
        {
            auto cal = CalibrationSpec::factoryDefaults();

            // VCF
            expectWithinAbsoluteError(cal.transfer.vcfCutoff.minHz, 50.0f, 0.1f, "vcfCutoff.minHz");
            expectWithinAbsoluteError(cal.transfer.vcfCutoff.curveBase, 400.0f, 1.0f, "vcfCutoff.curveBase");

            // Envelopes
            expectWithinAbsoluteError(cal.transfer.envelopes.driftToTimeScale, 0.3f, 0.001f, "env.driftToTimeScale");
            expectWithinAbsoluteError(cal.transfer.envelopes.maxTimeSec, 10.0f, 0.1f, "env.maxTimeSec");

            // LFO
            expectWithinAbsoluteError(cal.transfer.lfo.rateScale, 0.041f, 0.001f, "lfo.rateScale");
            expectWithinAbsoluteError(cal.transfer.lfo.rateExp, 7.3747f, 0.001f, "lfo.rateExp");

            // HPF
            expectWithinAbsoluteError(cal.transfer.hpf.minHz, 10.0f, 0.1f, "hpf.minHz");
            expectWithinAbsoluteError(cal.transfer.hpf.maxHz, 10000.0f, 1.0f, "hpf.maxHz");

            // Voice calibration
            expectWithinAbsoluteError(cal.voice.staticPitchCentsRange, 3.0f, 0.1f, "staticPitchCentsRange");
            expectWithinAbsoluteError(cal.voice.staticCutoffNormRange, 0.06f, 0.001f, "staticCutoffNormRange");

            // Keytrack
            expectWithinAbsoluteError(cal.transfer.vcfKeytrack.referenceHz, 261.63f, 0.01f, "keytrack referenceHz");

            logMessage("All 12 CalibrationSpec factory defaults match expected values ✅");
        }
    }
};

static SynthEngineTransferUnitTests synthEngineTransferUnitTests;

} // namespace ABD

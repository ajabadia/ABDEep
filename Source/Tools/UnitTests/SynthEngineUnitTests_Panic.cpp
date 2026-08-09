/**
 * @purpose Unit tests for SynthEngine::panic() and SynthEngine::resetMidiControllers().
 *          Verifies that panic() silences all active voices and resetMidiControllers()
 *          returns pitch bend, mod wheel, aftertouch, and sustain to their default values.
 *          These are the critical operations called from processBlockBypassed()
 *          to prevent stuck notes and controller jumps when the DAW bypasses the plugin.
 * @classification Test
 */
#include <JuceHeader.h>
#include "SynthEngine.h"

namespace ABD
{

class SynthEnginePanicUnitTests : public juce::UnitTest
{
public:
    static constexpr double kTestSampleRate = 44100.0;
    static constexpr int kTestBlockSize = 512;

    SynthEnginePanicUnitTests() : juce::UnitTest("SynthEngine Panic/Bypass Tests", "ABD") {}

    void runTest() override
    {
        //==============================================================================
        beginTest("panic() silences all active voices");
        {
            SynthEngine engine;
            engine.prepare(kTestSampleRate, kTestBlockSize);

            // Create audio buffer and MIDI buffer
            juce::AudioBuffer<float> buffer(2, kTestBlockSize);
            buffer.clear();
            juce::MidiBuffer midiMessages;
            
            // Send note-on for C4 (MIDI 60), velocity 0.8
            midiMessages.addEvent(juce::MidiMessage::noteOn(1, 60, 0.8f), 0);
            
            // Process block — should activate a voice
            engine.processBlock(buffer, midiMessages);
            
            // Process a few more blocks to allow envelope to reach sustain
            for (int b = 0; b < 5; ++b)
            {
                juce::MidiBuffer emptyMidi;
                engine.processBlock(buffer, emptyMidi);
            }
            
            // Verify at least one voice is active
            bool anyVoiceActive = false;
            for (int i = 0; i < 12; ++i)
            {
                if (engine.isVoiceActive(i))
                {
                    anyVoiceActive = true;
                    break;
                }
            }
            expect(anyVoiceActive, "At least one voice should be active after note-on");
            
            // Capture voice states before panic
            int prePanicActiveCount = 0;
            for (int i = 0; i < 12; ++i)
                if (engine.isVoiceActive(i))
                    prePanicActiveCount++;
            logMessage("Active voices before panic: " + juce::String(prePanicActiveCount));
            
            // Call panic — this should stop all voices immediately
            engine.panic();
            
            // Process a few blocks to let stopped voices finish their release tail
            for (int b = 0; b < 20; ++b)
            {
                juce::MidiBuffer emptyMidi;
                engine.processBlock(buffer, emptyMidi);
            }
            
            // Verify all voices are inactive
            int postPanicActiveCount = 0;
            for (int i = 0; i < 12; ++i)
            {
                if (engine.isVoiceActive(i))
                    postPanicActiveCount++;
            }
            expectEquals(postPanicActiveCount, 0,
                "All voices should be inactive after panic (active="
                + juce::String(postPanicActiveCount) + ")");
            logMessage("Active voices after panic: " + juce::String(postPanicActiveCount) + " ✅");
        }

        //==============================================================================
        beginTest("panic() clears held note accumulators (poly chord + mono)");
        {
            SynthEngine engine;
            engine.prepare(kTestSampleRate, kTestBlockSize);

            juce::AudioBuffer<float> buffer(2, kTestBlockSize);
            buffer.clear();

            // Play a chord: 3 simultaneous notes
            {
                juce::MidiBuffer midiOn;
                midiOn.addEvent(juce::MidiMessage::noteOn(1, 60, 0.8f), 0);
                midiOn.addEvent(juce::MidiMessage::noteOn(1, 64, 0.7f), 10);
                midiOn.addEvent(juce::MidiMessage::noteOn(1, 67, 0.75f), 20);
                engine.processBlock(buffer, midiOn);
            }
            for (int b = 0; b < 20; ++b)
            {
                juce::MidiBuffer emptyMidi;
                engine.processBlock(buffer, emptyMidi);
            }

            // Verify multiple voices are active (at least 2 for a chord)
            int activeCount = 0;
            for (int i = 0; i < 12; ++i)
                if (engine.isVoiceActive(i)) activeCount++;
            expect(activeCount >= 2,
                "At least 2 voices should be active for a 3-note chord (got " + juce::String(activeCount) + ")");

            // Call panic and process release
            engine.panic();
            for (int b = 0; b < 20; ++b)
            {
                juce::MidiBuffer emptyMidi;
                engine.processBlock(buffer, emptyMidi);
            }

            // All voices must be silent
            for (int i = 0; i < 12; ++i)
            {
                expect(!engine.isVoiceActive(i),
                    "Voice " + juce::String(i) + " should be inactive after panic on 3-note chord");
            }
            logMessage("panic() clears polyphonic chord voices: ✅");
        }

        //==============================================================================
        beginTest("resetMidiControllers() resets all global controllers to default");
        {
            SynthEngine engine;
            engine.prepare(kTestSampleRate, kTestBlockSize);

            juce::AudioBuffer<float> buffer(2, kTestBlockSize);
            buffer.clear();

            // First get the diagnostic snapshot baseline (default values)
            auto baselineSnapshot = engine.getDiagnosticSnapshot();
            
            // Defaults should be 0.0
            expectWithinAbsoluteError(baselineSnapshot.pitchBend, 0.0f, 0.001f,
                "pitchBend should be 0.0 by default");
            expectWithinAbsoluteError(baselineSnapshot.modWheel, 0.0f, 0.001f,
                "modWheel should be 0.0 by default");
            expectWithinAbsoluteError(baselineSnapshot.aftertouch, 0.0f, 0.001f,
                "aftertouch should be 0.0 by default");
            expectWithinAbsoluteError(baselineSnapshot.sustainPedal, 0.0f, 0.001f,
                "sustainPedal should be 0.0 by default");

            // Send MIDI CC messages to set controllers to non-default values
            {
                juce::MidiBuffer midiCC;
                // Mod wheel = CC 1, value 127 (max)
                midiCC.addEvent(juce::MidiMessage::controllerEvent(1, 1, 127), 0);
                // Sustain pedal = CC 64, value 127 (on)
                midiCC.addEvent(juce::MidiMessage::controllerEvent(1, 64, 127), 10);
                engine.processBlock(buffer, midiCC);
            }

            // Send pitch bend (max upward = 16383)
            {
                juce::MidiBuffer midiPB;
                midiPB.addEvent(juce::MidiMessage::pitchWheel(1, 16383), 0);
                engine.processBlock(buffer, midiPB);
            }

            // Send aftertouch (channel pressure)
            {
                juce::MidiBuffer midiAT;
                midiAT.addEvent(juce::MidiMessage::channelPressureChange(1, 127), 0);
                engine.processBlock(buffer, midiAT);
            }

            // Process a few blocks to update the diagnostic snapshot
            for (int b = 0; b < 3; ++b)
            {
                juce::MidiBuffer emptyMidi;
                engine.processBlock(buffer, emptyMidi);
            }

            // Verify controllers are now at non-default values
            auto midModSnapshot = engine.getDiagnosticSnapshot();
            // pitchBend normalized: (16383 / 8192) - 1.0 = 1.0
            expectWithinAbsoluteError(midModSnapshot.pitchBend, 1.0f, 0.01f,
                "pitchBend should be ~1.0 after max pitch wheel");
            // modWheel: 127 / 127 = 1.0
            expectWithinAbsoluteError(midModSnapshot.modWheel, 1.0f, 0.01f,
                "modWheel should be ~1.0 after max CC1");
            // aftertouch: 127 / 127 = 1.0
            expectWithinAbsoluteError(midModSnapshot.aftertouch, 1.0f, 0.01f,
                "aftertouch should be ~1.0 after max channel pressure");
            // sustainPedal: 127 / 127 = 1.0
            expectWithinAbsoluteError(midModSnapshot.sustainPedal, 1.0f, 0.01f,
                "sustainPedal should be ~1.0 after max CC64");

            // Now call resetMidiControllers
            engine.resetMidiControllers();

            // Process a block to update the diagnostic snapshot
            for (int b = 0; b < 3; ++b)
            {
                juce::MidiBuffer emptyMidi;
                engine.processBlock(buffer, emptyMidi);
            }

            // Verify controllers are back to defaults
            auto afterResetSnapshot = engine.getDiagnosticSnapshot();
            expectWithinAbsoluteError(afterResetSnapshot.pitchBend, 0.0f, 0.001f,
                "pitchBend should be 0.0 after resetMidiControllers (was "
                + juce::String(afterResetSnapshot.pitchBend) + ")");
            expectWithinAbsoluteError(afterResetSnapshot.modWheel, 0.0f, 0.001f,
                "modWheel should be 0.0 after resetMidiControllers (was "
                + juce::String(afterResetSnapshot.modWheel) + ")");
            expectWithinAbsoluteError(afterResetSnapshot.aftertouch, 0.0f, 0.001f,
                "aftertouch should be 0.0 after resetMidiControllers (was "
                + juce::String(afterResetSnapshot.aftertouch) + ")");
            expectWithinAbsoluteError(afterResetSnapshot.sustainPedal, 0.0f, 0.001f,
                "sustainPedal should be 0.0 after resetMidiControllers (was "
                + juce::String(afterResetSnapshot.sustainPedal) + ")");

            logMessage("resetMidiControllers(): pitchBend=0, modWheel=0, aftertouch=0, sustain=0 ✅");
        }

        //==============================================================================
        beginTest("panic() + resetMidiControllers() — integration sequence (simulates processBlockBypassed)");
        {
            SynthEngine engine;
            engine.prepare(kTestSampleRate, kTestBlockSize);

            juce::AudioBuffer<float> buffer(2, kTestBlockSize);
            buffer.clear();

            // Step 1: Start a note + set controllers to non-default
            {
                juce::MidiBuffer midiEvents;
                midiEvents.addEvent(juce::MidiMessage::noteOn(1, 72, 0.9f), 0);
                midiEvents.addEvent(juce::MidiMessage::controllerEvent(1, 1, 80), 20);
                midiEvents.addEvent(juce::MidiMessage::pitchWheel(1, 8192 + 4096), 40);
                engine.processBlock(buffer, midiEvents);
            }
            for (int b = 0; b < 10; ++b)
            {
                juce::MidiBuffer emptyMidi;
                engine.processBlock(buffer, emptyMidi);
            }

            // Verify note is playing and controllers are set
            bool noteActive = false;
            for (int i = 0; i < 12; ++i)
                if (engine.isVoiceActive(i)) { noteActive = true; break; }
            expect(noteActive, "Note should be active before bypass sequence");

            auto preBypass = engine.getDiagnosticSnapshot();
            bool controllersSet = (std::abs(preBypass.pitchBend) > 0.1f || std::abs(preBypass.modWheel) > 0.1f);
            // At least mod wheel should be set
            expect(preBypass.modWheel > 0.1f,
                "Mod wheel should be elevated before bypass (was " + juce::String(preBypass.modWheel) + ")");

            // Step 2: Simulate processBlockBypassed — call panic() then resetMidiControllers()
            engine.panic();
            engine.resetMidiControllers();

            // Step 3: Process a few blocks to release voices and update snapshot
            for (int b = 0; b < 20; ++b)
            {
                juce::MidiBuffer emptyMidi;
                engine.processBlock(buffer, emptyMidi);
            }

            // Step 4: Verify all voices silenced
            bool anyVoiceStillActive = false;
            for (int i = 0; i < 12; ++i)
                if (engine.isVoiceActive(i)) { anyVoiceStillActive = true; break; }
            expect(!anyVoiceStillActive, "No voices should be active after bypass sequence");

            // Step 5: Verify controllers reset to defaults
            auto postBypass = engine.getDiagnosticSnapshot();
            expectWithinAbsoluteError(postBypass.pitchBend, 0.0f, 0.001f,
                "pitchBend=0 after bypass (was " + juce::String(postBypass.pitchBend) + ")");
            expectWithinAbsoluteError(postBypass.modWheel, 0.0f, 0.001f,
                "modWheel=0 after bypass (was " + juce::String(postBypass.modWheel) + ")");
            expectWithinAbsoluteError(postBypass.aftertouch, 0.0f, 0.001f,
                "aftertouch=0 after bypass (was " + juce::String(postBypass.aftertouch) + ")");
            expectWithinAbsoluteError(postBypass.sustainPedal, 0.0f, 0.001f,
                "sustainPedal=0 after bypass (was " + juce::String(postBypass.sustainPedal) + ")");

            logMessage("Bypass integration sequence: panic() + resetMidiControllers() → voices off, controllers reset ✅");
        }
    }
};

static SynthEnginePanicUnitTests synthEnginePanicUnitTests;

} // namespace ABD

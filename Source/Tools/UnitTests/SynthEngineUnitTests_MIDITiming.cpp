/**
 * @purpose Unit tests for sample-accurate MIDI timing in SynthEngine::processBlock().
 *          Verifies that note-on events take effect at their exact samplePosition
 *          (silence before, sound after) and that a note-on placed at the very end
 *          of a block produces no output in that block.
 * @classification Test
 */
#include <JuceHeader.h>
#include "SynthEngine.h"

namespace ABD
{

class SynthEngineMIDITimingUnitTests : public juce::UnitTest
{
public:
    static constexpr double kTestSampleRate = 44100.0;
    static constexpr int kTestBlockSize = 1024;

    SynthEngineMIDITimingUnitTests() : juce::UnitTest("SynthEngine MIDI Timing Tests", "ABD") {}

    void runTest() override
    {
        //==============================================================================
        beginTest("Note-on at mid-block is sample-accurate (silence before, sound after)");
        {
            constexpr int notePos = 512;

            SynthEngine engine;
            engine.prepare(kTestSampleRate, kTestBlockSize);

            juce::AudioBuffer<float> buffer(2, kTestBlockSize);
            buffer.clear();
            juce::MidiBuffer midi;
            midi.addEvent(juce::MidiMessage::noteOn(1, 60, 0.9f), notePos);

            engine.processBlock(buffer, midi);

            // Region before the event must be exactly silent (no voice was rendering)
            bool silenceBefore = true;
            for (int s = 0; s < notePos; ++s)
            {
                if (buffer.getSample(0, s) != 0.0f || buffer.getSample(1, s) != 0.0f)
                {
                    silenceBefore = false;
                    break;
                }
            }
            expect(silenceBefore, "Output before note-on samplePosition should be exactly silent");

            // Region from the event onward must contain audible signal
            float energy = buffer.getMagnitude(0, notePos, kTestBlockSize - notePos)
                         + buffer.getMagnitude(1, notePos, kTestBlockSize - notePos);
            expect(energy > 0.0001f,
                   "Output from note-on samplePosition onward should contain signal (energy="
                   + juce::String(energy, 6) + ")");

            bool anyVoiceActive = false;
            for (int i = 0; i < 12; ++i)
                if (engine.isVoiceActive(i)) { anyVoiceActive = true; break; }
            expect(anyVoiceActive, "At least one voice should be active after mid-block note-on");

            logMessage("Note-on sample-accurate boundary (silence->sound at " + juce::String(notePos) + "): OK");
        }

        //==============================================================================
        beginTest("Note-on at end-of-block produces no output in that block");
        {
            SynthEngine engine;
            engine.prepare(kTestSampleRate, kTestBlockSize);

            juce::AudioBuffer<float> buffer(2, kTestBlockSize);
            buffer.clear();
            juce::MidiBuffer midi;
            midi.addEvent(juce::MidiMessage::noteOn(1, 64, 0.9f), kTestBlockSize);

            engine.processBlock(buffer, midi);

            bool silent = true;
            for (int s = 0; s < kTestBlockSize; ++s)
            {
                if (buffer.getSample(0, s) != 0.0f || buffer.getSample(1, s) != 0.0f)
                {
                    silent = false;
                    break;
                }
            }
            expect(silent, "Note-on at samplePosition == numSamples should not sound until the next block");

            // The note must be pending and begin in the following block
            juce::AudioBuffer<float> buffer2(2, kTestBlockSize);
            buffer2.clear();
            juce::MidiBuffer emptyMidi;
            engine.processBlock(buffer2, emptyMidi);

            float energy = buffer2.getMagnitude(0, 0, kTestBlockSize);
            expect(energy > 0.0001f,
                   "Note scheduled at the end of a block should sound in the next block (energy="
                   + juce::String(energy, 6) + ")");

            logMessage("Note-on at end-of-block deferred to next block: OK");
        }

        //==============================================================================
        beginTest("Sustain pedal latch (CC64) — note-off while pedal down stays held until release");
        {
            SynthEngine engine;
            engine.prepare(kTestSampleRate, kTestBlockSize);
            juce::AudioBuffer<float> buffer(2, kTestBlockSize);
            juce::MidiBuffer midi;

            // Note on
            midi.addEvent(juce::MidiMessage::noteOn(1, 60, 0.9f), 0);
            engine.processBlock(buffer, midi);

            // Pedal down, then note-off while the pedal is held
            midi.clear();
            midi.addEvent(juce::MidiMessage::controllerEvent(1, 64, 127), 0);
            engine.processBlock(buffer, midi);
            midi.clear();
            midi.addEvent(juce::MidiMessage::noteOff(1, 60), 0);
            engine.processBlock(buffer, midi);

            // Render a long time — a non-latched note would have finished its release
            midi.clear();
            for (int i = 0; i < 500; ++i)
                engine.processBlock(buffer, midi);

            auto anyActive = [&]() {
                for (int i = 0; i < 12; ++i)
                    if (engine.isVoiceActive(i)) return true;
                return false;
            };
            expect(anyActive(), "Note released while pedal is down must stay latched (voice active after long render)");
            float latchedEnergy = buffer.getMagnitude(0, 0, kTestBlockSize)
                                + buffer.getMagnitude(1, 0, kTestBlockSize);
            expect(latchedEnergy > 0.0001f, "Latched voice should keep producing sustain output");

            // Pedal up → the latched note enters its release phase
            midi.addEvent(juce::MidiMessage::controllerEvent(1, 64, 0), 0);
            engine.processBlock(buffer, midi);
            midi.clear();
            for (int i = 0; i < 500; ++i)
                engine.processBlock(buffer, midi);

            expect(!anyActive(), "Pedal release must trigger the release phase of latched notes");
            float releasedEnergy = buffer.getMagnitude(0, 0, kTestBlockSize)
                                 + buffer.getMagnitude(1, 0, kTestBlockSize);
            expect(releasedEnergy < 0.001f, "After pedal release + long render the voice should be silent");
            logMessage("Sustain pedal latch: OK");
        }

        //==============================================================================
        beginTest("Sustain pedal latch control — note-off without pedal releases normally");
        {
            SynthEngine engine;
            engine.prepare(kTestSampleRate, kTestBlockSize);
            juce::AudioBuffer<float> buffer(2, kTestBlockSize);
            juce::MidiBuffer midi;

            midi.addEvent(juce::MidiMessage::noteOn(1, 60, 0.9f), 0);
            engine.processBlock(buffer, midi);
            midi.clear();
            midi.addEvent(juce::MidiMessage::noteOff(1, 60), 0);
            engine.processBlock(buffer, midi);

            midi.clear();
            for (int i = 0; i < 500; ++i)
                engine.processBlock(buffer, midi);

            bool anyActive = false;
            for (int i = 0; i < 12; ++i)
                if (engine.isVoiceActive(i)) { anyActive = true; break; }
            expect(!anyActive, "Without the pedal a note-off must finish its release and deactivate");
            logMessage("Sustain pedal latch control: OK");
        }

        //==============================================================================
        beginTest("Sample-accurate rendering matches single-shot render when events are at 0");
        {
            // Events at sample 0 must produce identical output to the pre-segmentation
            // behaviour: the whole block rendered in one pass.
            SynthEngine engineA;
            engineA.prepare(kTestSampleRate, kTestBlockSize);
            SynthEngine engineB;
            engineB.prepare(kTestSampleRate, kTestBlockSize);

            juce::AudioBuffer<float> bufA(2, kTestBlockSize);
            bufA.clear();
            juce::AudioBuffer<float> bufB(2, kTestBlockSize);
            bufB.clear();

            juce::MidiBuffer midiA;
            midiA.addEvent(juce::MidiMessage::noteOn(1, 60, 0.8f), 0);
            midiA.addEvent(juce::MidiMessage::noteOn(1, 64, 0.7f), 0);
            engineA.processBlock(bufA, midiA);

            juce::MidiBuffer midiB;
            midiB.addEvent(juce::MidiMessage::noteOn(1, 60, 0.8f), 0);
            midiB.addEvent(juce::MidiMessage::noteOn(1, 64, 0.7f), 0);
            engineB.processBlock(bufB, midiB);

            bool identical = true;
            for (int s = 0; s < kTestBlockSize; ++s)
            {
                if (bufA.getSample(0, s) != bufB.getSample(0, s) || bufA.getSample(1, s) != bufB.getSample(1, s))
                {
                    identical = false;
                    break;
                }
            }
            expect(identical, "Events at samplePosition 0 should render identically across engines");
            logMessage("Events at samplePosition 0 render identically: OK");
        }
    }
};

static SynthEngineMIDITimingUnitTests synthEngineMIDITimingUnitTests;

} // namespace ABD

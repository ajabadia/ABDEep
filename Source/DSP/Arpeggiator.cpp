#include "Arpeggiator.h"
#include <JuceHeader.h>

namespace ABD
{
    void Arpeggiator::generate(juce::MidiBuffer& out, int numSamples)
    {
        abd::synth::Arpeggiator::generate(numSamples, [&out](const NoteEvent& ev) {
            if (ev.isNoteOn)
                out.addEvent(juce::MidiMessage::noteOn(1, ev.note, ev.velocity), ev.sampleOffset);
            else
                out.addEvent(juce::MidiMessage::noteOff(1, ev.note, 0.0f), ev.sampleOffset);
        });
    }
}
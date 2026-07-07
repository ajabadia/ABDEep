#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "ParametersSpec.h"

ABDEepAudioProcessor::ABDEepAudioProcessor()
    : AudioProcessor (BusesProperties()
                      .withInput  ("Input",  juce::AudioChannelSet::stereo(), true)
                      .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "Parameters", ParametersSpec::createLayout())
{
}

ABDEepAudioProcessor::~ABDEepAudioProcessor()
{
}

const juce::String ABDEepAudioProcessor::getName() const
{
    return JucePlugin_Name;
}

bool ABDEepAudioProcessor::acceptsMidi() const
{
    return true;
}

bool ABDEepAudioProcessor::producesMidi() const
{
    return true;
}

bool ABDEepAudioProcessor::isMidiEffect() const
{
    return false;
}

double ABDEepAudioProcessor::getTailLengthSeconds() const
{
    return 0.0;
}

int ABDEepAudioProcessor::getNumPrograms()
{
    return 1;
}

int ABDEepAudioProcessor::getCurrentProgram()
{
    return 0;
}

void ABDEepAudioProcessor::setCurrentProgram (int index)
{
}

const juce::String ABDEepAudioProcessor::getProgramName (int index)
{
    return {};
}

void ABDEepAudioProcessor::changeProgramName (int index, const juce::String& newName)
{
}

void ABDEepAudioProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
}

void ABDEepAudioProcessor::releaseResources()
{
}

bool ABDEepAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    if (layouts.getMainOutput() != juce::AudioChannelSet::mono()
     && layouts.getMainOutput() != juce::AudioChannelSet::stereo())
        return false;

    return true;
}

void ABDEepAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;
    auto totalNumInputChannels  = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    for (auto i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear (i, 0, buffer.getNumSamples());

    // Agregar eventos encolados desde el hilo de UI
    {
        const juce::ScopedLock sl (midiQueueLock);
        if (! midiQueue.isEmpty())
        {
            midiMessages.addEvents (midiQueue, 0, -1, 0);
            midiQueue.clear();
        }
    }
}

bool ABDEepAudioProcessor::hasEditor() const
{
    return true;
}

juce::AudioProcessorEditor* ABDEepAudioProcessor::createEditor()
{
    return new ABDEepAudioProcessorEditor (*this);
}

void ABDEepAudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    std::unique_ptr<juce::XmlElement> xml (state.createXml());
    copyXmlToBinary (*xml, destData);
}

void ABDEepAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    std::unique_ptr<juce::XmlElement> xmlState (getXmlFromBinary (data, sizeInBytes));
    if (xmlState != nullptr)
        if (xmlState->hasTagName (apvts.state.getType()))
            apvts.replaceState (juce::ValueTree::fromXml (*xmlState));
}

// Inicialización para standalone/plugin por JUCE
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new ABDEepAudioProcessor();
}

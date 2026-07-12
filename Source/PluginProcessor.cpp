#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "ParametersSpec.h"
#include <iostream>

ABDEepAudioProcessor::ABDEepAudioProcessor()
    : AudioProcessor (BusesProperties()
                      .withInput  ("Input",  juce::AudioChannelSet::stereo(), true)
                      .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "Parameters", ParametersSpec::createLayout())
{
#if JucePlugin_Build_Standalone
    // Check for --run-unit-tests flag
    auto args = juce::JUCEApplication::getCommandLineParameterArray();
    for (const auto& arg : args)
    {
        if (arg == "--run-unit-tests" || arg == "-t")
        {
            juce::UnitTestRunner runner;
            runner.setAssertOnFailure (false);
            std::cout << "\n=== ABD Eep Unit Tests ===\n\n";
            runner.runAllTests();
            
            auto totalTests = runner.getNumResults();
            int passed = 0, failed = 0;
            for (int i = 0; i < totalTests; ++i)
                if (auto* result = runner.getResult (i))
                {
                    passed += result->passes;
                    failed += result->failures;
                }
            
            std::cout << "\n=== Summary: " << passed << " passed, " << failed << " failed (" << totalTests << " suites) ===\n";
            
            if (failed > 0)
                std::_Exit (1);  // Immediate exit with failure code
            
            if (auto* app = juce::JUCEApplication::getInstance())
                app->systemRequestedQuit();
            
            return;
        }
    }
#endif
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
    synthEngine.prepare (sampleRate, samplesPerBlock);
}

void ABDEepAudioProcessor::releaseResources()
{
}

bool ABDEepAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
     && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
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

    // Actualizar parámetros de control y síntesis
    synthEngine.updateParameters (apvts);

    // Renderizar audio a través del motor polifónico
    synthEngine.processBlock (buffer, midiMessages);
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

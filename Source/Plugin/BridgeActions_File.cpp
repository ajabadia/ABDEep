#include "BridgeActions.h"
#include "PluginProcessor.h"

namespace BridgeActions {

void readFactoryBankFile (ABDEepAudioProcessor& audioProcessor,
                         const juce::Array<juce::var>& args,
                         juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::ignoreUnused (audioProcessor);
    if (args.size() >= 1)
    {
        juce::String bankLetter = args[0].toString().toUpperCase();
        
        // 1. Try development path (relative to source tree via __FILE__)
        // Navigate from Source/Plugin/BridgeActions_File.cpp up to project root
        juce::File currentFile (__FILE__);
        // currentFile = .../Source/Plugin/BridgeActions_File.cpp
        // getParentDirectory() = .../Source/Plugin/
        // getParentDirectory() = .../Source/
        // getParentDirectory() = .../ABDEep/ (project root)
        juce::File resourcesDir = currentFile.getParentDirectory()
                                      .getParentDirectory()
                                      .getParentDirectory()
                                      .getChildFile ("resources").getChildFile ("banks");
        juce::File factoryDir = resourcesDir.getChildFile ("Factory Banks V1.1.2");
        juce::File syxFile = factoryDir.getChildFile ("Synth Bank " + bankLetter + ".syx");
        
        if (syxFile.existsAsFile())
        {
            juce::MemoryBlock mb;
            syxFile.loadFileAsData (mb);
            juce::String hexStr = juce::String::toHexString (mb.getData(), (int) mb.getSize());
            completion (juce::var (hexStr));
            return;
        }
        
        // 2. Try installation path (relative to executable)
        {
            juce::File installDir = juce::File::getSpecialLocation (juce::File::currentExecutableFile)
                                        .getParentDirectory()
                                        .getChildFile ("resources").getChildFile ("banks");
            juce::File installSyx = installDir.getChildFile ("Synth Bank " + bankLetter + ".syx");
            if (installSyx.existsAsFile())
            {
                juce::MemoryBlock mb;
                installSyx.loadFileAsData (mb);
                juce::String hexStr = juce::String::toHexString (mb.getData(), (int) mb.getSize());
                completion (juce::var (hexStr));
                return;
            }
        }
        
        // 3. Try user data path
        {
            juce::File userDataDir = juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
                                        .getChildFile ("ABDEep").getChildFile ("banks");
            juce::File userSyx = userDataDir.getChildFile ("Synth Bank " + bankLetter + ".syx");
            if (userSyx.existsAsFile())
            {
                juce::MemoryBlock mb;
                userSyx.loadFileAsData (mb);
                juce::String hexStr = juce::String::toHexString (mb.getData(), (int) mb.getSize());
                completion (juce::var (hexStr));
                return;
            }
        }
        
        DBG ("[readFactoryBankFile] Bank " + bankLetter + " not found in source, executable, or user data paths.");
    }
    completion ({});
}

} // namespace BridgeActions

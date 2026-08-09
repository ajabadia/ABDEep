#include "BridgeActions.h"
#include "PluginProcessor.h"
namespace BridgeActions {

#if DEEP_TARGET_MODEL >= 2
void getCalibration (ABDEepAudioProcessor& audioProcessor,
                     const juce::Array<juce::var>& args,
                     juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::ignoreUnused (args);
    auto& engine = audioProcessor.getSynthEngine();
    completion (engine.getCalibrationJson());
}

void setCalibration (ABDEepAudioProcessor& audioProcessor,
                     const juce::Array<juce::var>& args,
                     juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (args.isEmpty() || ! args[0].isString())
    {
        completion (juce::var (false));
        return;
    }
    auto& engine = audioProcessor.getSynthEngine();
    bool ok = engine.loadCalibrationFromJson (args[0].toString());
    completion (juce::var (ok));
}
#endif

void startAudioABRun (ABDEepAudioProcessor& audioProcessor,
                      const juce::Array<juce::var>& args,
                      juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (args.size() >= 2)
    {
        // Parsear JSON de config
        juce::String configJson = args[0].toString();
        juce::String snapshotJson = args[1].toString();

        auto varParsed = juce::JSON::parse (configJson);
        if (varParsed.isObject())
        {
            auto* obj = varParsed.getDynamicObject();
            AudioABRunConfig config;
            config.runId = obj->getProperty ("runId").toString();
            config.patchName = obj->getProperty ("patchName").toString();
            config.midiNote = (int)obj->getProperty ("midiNote");
            config.velocity = (int)obj->getProperty ("velocity");
            config.noteDurationSec = (double)obj->getProperty ("noteDurationSec");
            config.tailDurationSec = (double)obj->getProperty ("tailDurationSec");
            config.sampleRate = (double)obj->getProperty ("sampleRate");
            config.bitDepth = (int)obj->getProperty ("bitDepth");
            config.numChannels = (int)obj->getProperty ("numChannels");
            config.deviceInputChannels = (int)obj->getProperty ("numChannels");

            // Configurar ruta raíz de exportación en AppData del usuario
            juce::File rootDir = juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
                                    .getChildFile ("ABDEep").getChildFile ("audio-ab");
            rootDir.createDirectory();
            audioProcessor.getAudioABRecorder().setOutputRoot (rootDir);

            bool ok = audioProcessor.getAudioABRecorder().beginRun (config, snapshotJson);
            
            juce::DynamicObject::Ptr res = new juce::DynamicObject();
            res->setProperty ("ok", ok);
            completion (juce::var (res.get()));
            return;
        }
    }
    
    juce::DynamicObject::Ptr res = new juce::DynamicObject();
    res->setProperty ("ok", false);
    res->setProperty ("error", "Configuración inválida.");
    completion (juce::var (res.get()));
}

void renderAudioABSoftwareReference (ABDEepAudioProcessor& audioProcessor,
                                     const juce::Array<juce::var>& /*args*/,
                                     juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    bool ok = audioProcessor.getAudioABRecorder().renderSoftwareReference (audioProcessor.getSynthEngine());
    juce::DynamicObject::Ptr res = new juce::DynamicObject();
    res->setProperty ("ok", ok);
    completion (juce::var (res.get()));
}

void finishAudioABRun (ABDEepAudioProcessor& audioProcessor,
                       const juce::Array<juce::var>& /*args*/,
                       juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    AudioABRunResult runResult;
    bool ok = audioProcessor.getAudioABRecorder().finishRun (runResult);

    juce::DynamicObject::Ptr res = new juce::DynamicObject();
    res->setProperty ("ok", ok);
    if (ok)
    {
        res->setProperty ("runId", runResult.runId);
        res->setProperty ("manifestPath", runResult.manifestFile.getFullPathName());
        res->setProperty ("hwWavPath", runResult.hardwareTake.wavFile.getFullPathName());
        res->setProperty ("swWavPath", runResult.softwareTake.wavFile.getFullPathName());
        res->setProperty ("hwPeak", runResult.hardwareTake.peakDbfs);
        res->setProperty ("hwRms", runResult.hardwareTake.rmsDbfs);
        res->setProperty ("swPeak", runResult.softwareTake.peakDbfs);
        res->setProperty ("swRms", runResult.softwareTake.rmsDbfs);
    }
    else
    {
        res->setProperty ("error", runResult.error);
    }
    completion (juce::var (res.get()));
}

void abortAudioABRun (ABDEepAudioProcessor& audioProcessor,
                      const juce::Array<juce::var>& /*args*/,
                      juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    audioProcessor.getAudioABRecorder().abortRun();
    juce::DynamicObject::Ptr res = new juce::DynamicObject();
    res->setProperty ("ok", true);
    completion (juce::var (res.get()));
}} // namespace BridgeActions

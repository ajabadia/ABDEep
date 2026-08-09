#include "BridgeActions.h"
#include "PluginProcessor.h"
#include "Calibration/AudioABComparator.h"
#include "Calibration/AudioABVerdictEngine.h"

namespace BridgeActions {

void compareAudioABRun (ABDEepAudioProcessor& /*audioProcessor*/,
                        const juce::Array<juce::var>& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::DynamicObject::Ptr res = new juce::DynamicObject();

    if (args.size() < 4)
    {
        res->setProperty ("status", "error");
        res->setProperty ("reason_code", "WAV_MISSING");
        juce::Array<juce::var> errs;
        errs.add ("Argumentos insuficientes para compareAudioABRun.");
        res->setProperty ("errors", errs);
        completion (juce::var (res.get()));
        return;
    }

    juce::String refWavPath = args[0].toString();
    juce::String capWavPath = args[1].toString();
    juce::String configJson  = args[2].toString();
    juce::String contextJson = args[3].toString();

    juce::File refFile (refWavPath);
    juce::File capFile (capWavPath);

    if (!refFile.existsAsFile() || !capFile.existsAsFile())
    {
        res->setProperty ("status", "error");
        res->setProperty ("reason_code", "WAV_MISSING");
        juce::Array<juce::var> errs;
        errs.add ("Uno o ambos archivos WAV de entrada no existen en disco.");
        res->setProperty ("errors", errs);
        completion (juce::var (res.get()));
        return;
    }

    // Cargar y leer los archivos de audio WAV
    juce::AudioFormatManager formatManager;
    formatManager.registerBasicFormats();

    auto refReader = formatManager.createReaderFor (refFile);
    auto capReader = formatManager.createReaderFor (capFile);

    if (refReader == nullptr || capReader == nullptr)
    {
        res->setProperty ("status", "error");
        res->setProperty ("reason_code", "WAV_MISSING");
        juce::Array<juce::var> errs;
        errs.add ("No se pudo instanciar el decodificador para uno o ambos archivos WAV.");
        res->setProperty ("errors", errs);
        completion (juce::var (res.get()));
        return;
    }

    // Configurar señales
    AudioABSignal refSignal;
    refSignal.sourceId = "reference";
    refSignal.sampleRate = refReader->sampleRate;
    refSignal.numChannels = (int)refReader->numChannels;
    refSignal.originalNumSamples = refReader->lengthInSamples;
    refSignal.filePath = refWavPath;
    refSignal.buffer.setSize (refSignal.numChannels, (int)refSignal.originalNumSamples);
    refReader->read (&refSignal.buffer, 0, (int)refSignal.originalNumSamples, 0, true, true);

    AudioABSignal capSignal;
    capSignal.sourceId = "capture";
    capSignal.sampleRate = capReader->sampleRate;
    capSignal.numChannels = (int)capReader->numChannels;
    capSignal.originalNumSamples = capReader->lengthInSamples;
    capSignal.filePath = capWavPath;
    capSignal.buffer.setSize (capSignal.numChannels, (int)capSignal.originalNumSamples);
    capReader->read (&capSignal.buffer, 0, (int)capSignal.originalNumSamples, 0, true, true);

    // Configurar contextos y opciones
    AudioABRunContext context;
    auto parsedCtx = juce::JSON::parse (contextJson);
    if (parsedCtx.isObject())
    {
        auto* o = parsedCtx.getDynamicObject();
        context.runId = o->getProperty ("runId").toString();
        context.presetId = o->getProperty ("presetId").toString();
        context.presetName = o->getProperty ("presetName").toString();
    }

    AudioABComparatorConfig config;
    auto parsedCfg = juce::JSON::parse (configJson);
    if (parsedCfg.isObject())
    {
        auto* o = parsedCfg.getDynamicObject();
        config.trimLeadingSilence = (bool)o->getProperty ("trimLeadingSilence");
        config.trimTrailingSilence = (bool)o->getProperty ("trimTrailingSilence");
        config.silenceThresholdDb = (float)(double)o->getProperty ("silenceThresholdDb");
        config.normalizeGain = (bool)o->getProperty ("normalizeGain");
        config.forceMonoForAnalysis = (bool)o->getProperty ("forceMonoForAnalysis");
        config.enableCrossCorrelation = (bool)o->getProperty ("enableCrossCorrelation");
    }

    // Correr Comparador
    AudioABComparator comparator;
    auto comparison = comparator.compare (refSignal, capSignal, context, config);

    // Correr Verdict Engine
    AudioABVerdictEngine verdictEngine;
    AudioABVerdictTolerances tolerances; // Umbrales por defecto en v1.0.0
    auto verdict = verdictEngine.evaluate (comparison, tolerances);

    // Escribir comparison.json en el directorio de salida del run (artifacts/audio-ab/<run_id>/)
    juce::File parentDir = refFile.getParentDirectory();
    juce::File comparisonJsonFile = parentDir.getChildFile ("comparison.json");

    // Unificar estructura JSON final de forma segura en memoria
    juce::var finalVar = comparison.toVar();
    if (auto* finalObj = finalVar.getDynamicObject())
    {
        finalObj->setProperty ("verdict", verdict.toVar());
    }

    juce::String finalJsonStr = juce::JSON::toString (finalVar, false);
    comparisonJsonFile.replaceWithText (finalJsonStr);

    completion (finalVar);
}

} // namespace BridgeActions

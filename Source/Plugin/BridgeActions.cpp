#include "BridgeActions.h"
#include "PluginProcessor.h"
#include "MidiTranslationEngine.h"
#include "Core/DiagnosticSnapshots.h"
#include "Calibration/AudioABComparator.h"
#include "Calibration/AudioABVerdictEngine.h"

namespace BridgeActions {

void setParameter (ABDEepAudioProcessor& audioProcessor,
                  const juce::Array<juce::var>& args,
                  juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (args.size() >= 2)
    {
        juce::String paramID = args[0].toString();
        float val = static_cast<float> (args[1]);
        
        {
            juce::File logFile ("D:\\desarrollos\\ABDSynths\\ABDEep\\webview_log.txt");
            logFile.appendText ("[C++ Bridge] setParameter: " + paramID + " = " + juce::String(val) + "\n");
        }
        
        if (auto* param = audioProcessor.getAPVTS().getParameter (paramID))
        {
            param->setValueNotifyingHost (val);
            completion (juce::var::undefined());
        }
        else
        {
            {
                juce::File logFile ("D:\\desarrollos\\ABDSynths\\ABDEep\\webview_log.txt");
                logFile.appendText ("[C++ Bridge] ERROR: Parameter not found in APVTS: " + paramID + "\n");
            }
            completion ({});
        }
    }
    else
    {
        completion ({});
    }
}

void beginGesture (ABDEepAudioProcessor& audioProcessor,
                  const juce::Array<juce::var>& args,
                  juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (args.size() >= 1)
    {
        juce::String paramID = args[0].toString();
        if (auto* param = audioProcessor.getAPVTS().getParameter (paramID))
            param->beginChangeGesture();
    }
    completion (juce::var::undefined());
}

void endGesture (ABDEepAudioProcessor& audioProcessor,
                const juce::Array<juce::var>& args,
                juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (args.size() >= 1)
    {
        juce::String paramID = args[0].toString();
        if (auto* param = audioProcessor.getAPVTS().getParameter (paramID))
            param->endChangeGesture();
    }
    completion (juce::var::undefined());
}

void getSynthState (ABDEepAudioProcessor& audioProcessor,
                   const juce::Array<juce::var>& args,
                   juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::ignoreUnused (args);
    juce::DynamicObject::Ptr stateObj = new juce::DynamicObject();
    
    auto& apvts = audioProcessor.getAPVTS();
    auto state = apvts.copyState();
    
    for (int i = 0; i < state.getNumChildren(); ++i)
    {
        auto child = state.getChild(i);
        juce::String paramID = child.getProperty("id").toString();
        if (auto* param = apvts.getParameter(paramID))
        {
            stateObj->setProperty(paramID, (double)param->getValue());
        }
    }
    
    completion (juce::var (stateObj.get()));
}

void requestMidiDump (ABDEepAudioProcessor& audioProcessor,
                     const juce::Array<juce::var>& args,
                     juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (args.size() >= 1)
    {
        juce::String type = args[0].toString();
        juce::MidiMessage msg;
        
        if (type == "edit")
            msg = MidiTranslationEngine::createEditBufferDumpRequest();
        else if (type == "global")
            msg = MidiTranslationEngine::createGlobalParameterDumpRequest();
        
        if (msg.getRawDataSize() > 0)
        {
            audioProcessor.queueMidiMessage (msg);
            completion (juce::var::undefined());
            return;
        }
    }
    completion ({});
}

void readFactoryBankFile (ABDEepAudioProcessor& audioProcessor,
                         const juce::Array<juce::var>& args,
                         juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::ignoreUnused (audioProcessor);
    if (args.size() >= 1)
    {
        juce::String bankLetter = args[0].toString().toUpperCase();
        juce::File currentFile (__FILE__);
        juce::File resourcesDir = currentFile.getParentDirectory().getParentDirectory().getChildFile ("resources").getChildFile ("banks");
        juce::File factoryDir = resourcesDir.getChildFile ("Factory Banks V1.1.2");
        juce::File syxFile = factoryDir.getChildFile ("Synth Bank " + bankLetter + ".syx");
        
        DBG("[readFactoryBankFile] Bank=" + bankLetter + " Path=" + syxFile.getFullPathName() + " Exists=" + juce::String((int)syxFile.existsAsFile()));
        
        if (syxFile.existsAsFile())
        {
            juce::MemoryBlock mb;
            syxFile.loadFileAsData (mb);
            
            // Convert to hex string to return securely to Javascript
            juce::String hexStr = juce::String::toHexString (mb.getData(), (int) mb.getSize());
            completion (juce::var (hexStr));
            return;
        }
    }
    completion ({});
}

void pianoNoteOn (ABDEepAudioProcessor& audioProcessor,
                 const juce::Array<juce::var>& args,
                 juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::File logFile ("D:\\desarrollos\\ABDSynths\\ABDEep\\webview_log.txt");
    logFile.appendText ("[C++ Bridge] pianoNoteOn called with " + juce::String(args.size()) + " args\n");
    if (args.size() >= 2)
    {
        int note = (int) args[0];
        float velocity = (float) args[1];
        logFile.appendText ("[C++ Bridge] pianoNoteOn: note=" + juce::String(note) + " vel=" + juce::String(velocity) + "\n");
        auto msg = juce::MidiMessage::noteOn (1, note, (juce::uint8) juce::jlimit (0, 127, juce::roundToInt (velocity * 127.0f)));
        audioProcessor.queueMidiMessage (msg);
    }
    completion (juce::var::undefined());
}

void pianoNoteOff (ABDEepAudioProcessor& audioProcessor,
                  const juce::Array<juce::var>& args,
                  juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::File logFile ("D:\\desarrollos\\ABDSynths\\ABDEep\\webview_log.txt");
    logFile.appendText ("[C++ Bridge] pianoNoteOff called\n");
    if (args.size() >= 1)
    {
        int note = (int) args[0];
        auto msg = juce::MidiMessage::noteOff (1, note);
        audioProcessor.queueMidiMessage (msg);
    }
    completion (juce::var::undefined());
}

void getVoiceState (ABDEepAudioProcessor& audioProcessor,
                    const juce::Array<juce::var>& args,
                    juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::ignoreUnused (args);
    auto& engine = audioProcessor.getSynthEngine();
    completion (engine.getVoiceState());
}

void getAudioWaveform (ABDEepAudioProcessor& audioProcessor,
                       const juce::Array<juce::var>& args,
                       juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::ignoreUnused (args);
    auto& engine = audioProcessor.getSynthEngine();
    completion (engine.getAudioWaveform());
}

void panic (ABDEepAudioProcessor& audioProcessor,
            const juce::Array<juce::var>& args,
            juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::ignoreUnused (args);
    
    // 1. Limpiar cola de MIDI pendiente del procesador de audio
    audioProcessor.clearMidiQueue();
    
    // 2. Ejecutar panic físico en el motor
    auto& engine = audioProcessor.getSynthEngine();
    engine.panic();
    
    completion (juce::var::undefined());
}

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

void getDiagnosticSnapshot (ABDEepAudioProcessor& audioProcessor,
                            const juce::Array<juce::var>& args,
                            juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::ignoreUnused (args);
    auto& engine = audioProcessor.getSynthEngine();
    auto snap = engine.getDiagnosticSnapshot();
    
    juce::DynamicObject::Ptr root = new juce::DynamicObject();
    root->setProperty ("diagnosticSchemaVersion", 1);
    root->setProperty ("vcfOversample", snap.vcfOversample);
    root->setProperty ("vcfVoicingMode", snap.vcfVoicingMode);
    root->setProperty ("driftAmount", (double)snap.driftAmount);
    
    root->setProperty ("pitchBend", (double)snap.pitchBend);
    root->setProperty ("modWheel", (double)snap.modWheel);
    root->setProperty ("aftertouch", (double)snap.aftertouch);
    root->setProperty ("sustainPedal", (double)snap.sustainPedal);
    root->setProperty ("peakLevel", (double)snap.peakLevel);
    root->setProperty ("voiceMode", snap.voiceMode);
    root->setProperty ("polyChordNoteCount", snap.polyChordNoteCount);
    
    root->setProperty ("timestamp", (double)snap.timestamp);
    root->setProperty ("blockCounter", (double)snap.blockCounter);
    
    juce::Array<juce::var> voiceArr;
    for (int i = 0; i < 12; ++i)
    {
        const auto& v = snap.voiceSnapshots[i];
        juce::DynamicObject::Ptr vo = new juce::DynamicObject();
        vo->setProperty ("voiceIndex", v.voiceIndex);
        vo->setProperty ("isActive", v.isActive);
        vo->setProperty ("noteNumber", (double)v.noteNumber);
        vo->setProperty ("velocity", (double)v.velocity);
        
        vo->setProperty ("detuneSemitonesBase", (double)v.detuneSemitonesBase);
        vo->setProperty ("detuneSemitonesEffective", (double)v.detuneSemitonesEffective);
        vo->setProperty ("panBase", (double)v.panBase);
        vo->setProperty ("panEffective", (double)v.panEffective);
        
        vo->setProperty ("baseCutoffHz", (double)v.baseCutoffHz);
        vo->setProperty ("effectiveCutoffHz", (double)v.effectiveCutoffHz);
        vo->setProperty ("resonance", (double)v.resonance);
        vo->setProperty ("envDepthSign", (double)v.envDepthSign);
        vo->setProperty ("keytrackHz", (double)v.keytrackHz);
        vo->setProperty ("hpfCutoffHz", (double)v.hpfCutoffHz);
        
        vo->setProperty ("vcfCutoffBase", (double)v.vcfCutoffBase);
        vo->setProperty ("vcfCutoffEffectiveHz", (double)v.vcfCutoffEffectiveHz);
        vo->setProperty ("vcfResonanceBase", (double)v.vcfResonanceBase);
        vo->setProperty ("vcfResonanceEffective", (double)v.vcfResonanceEffective);
        vo->setProperty ("hpfCutoffBase", (double)v.hpfCutoffBase);
        
        vo->setProperty ("lfo1Value", (double)v.lfo1Value);
        vo->setProperty ("lfo2Value", (double)v.lfo2Value);
        vo->setProperty ("env1Value", (double)v.env1Value);
        vo->setProperty ("env2Value", (double)v.env2Value);
        vo->setProperty ("driftHz", (double)v.driftHz);
        
        vo->setProperty ("cutoffFromEnv", (double)v.cutoffFromEnv);
        vo->setProperty ("cutoffFromLfo", (double)v.cutoffFromLfo);
        vo->setProperty ("cutoffFromDrift", (double)v.cutoffFromDrift);
        vo->setProperty ("cutoffFromKeytrack", (double)v.cutoffFromKeytrack);
        
        vo->setProperty ("envStage", v.envStage);
        vo->setProperty ("sourceTag", v.sourceTag);
        vo->setProperty ("flags", (int)v.flags);
        
        voiceArr.add (juce::var (vo.get()));
    }
    
    root->setProperty ("voiceSnapshots", voiceArr);
    completion (juce::var (root.get()));
}

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

            // Configurar ruta raíz de exportación
            juce::File rootDir ("D:\\desarrollos\\ABDSynths\\ABDEep\\artifacts\\audio-ab");
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
}

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
    juce::String configJson = args[2].toString();
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

    std::unique_ptr<juce::AudioFormatReader> refReader (formatManager.createReaderFor (refFile));
    std::unique_ptr<juce::AudioFormatReader> capReader (formatManager.createReaderFor (capFile));

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

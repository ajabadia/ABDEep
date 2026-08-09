#include "PluginProcessor.h"
#include "BridgeActions.h"
#include "Core/BuildVersion.h"
#include "DSP/VcfVoicing.h"
#include "DSP/DSPHelpers.h"

// ============================================================
// Native function registrations for WebBrowserComponent
// Each function delegates to a BridgeActions::* static method.
// ============================================================

namespace
{
    // Build a read-only snapshot of the DSP voicing/calibration constants
    // (F3-4) for the WebUI Advanced tab. Exposed through getBuildInfo.
    juce::var buildDspCalibrationObject()
    {
        juce::DynamicObject::Ptr obj = new juce::DynamicObject();

        auto add = [&obj] (const juce::String& name, float value, const juce::String& unit)
        {
            juce::DynamicObject::Ptr entry = new juce::DynamicObject();
            entry->setProperty ("value", value);
            entry->setProperty ("unit", unit);
            obj->setProperty (name, juce::var (entry.get()));
        };

        using namespace ABD;

        add ("maxNormalizedFreq",   VcfCalibration::kMaxNormalizedFreq,   "frq");
        add ("outputScale",         VcfCalibration::kOutputScale,          "x");
        add ("selfOscThreshold",    VcfCalibration::kSelfOscThreshold,     "frq");
        add ("selfOscIntensity",    VcfCalibration::kSelfOscIntensity,     "x");
        add ("outTameFreqFloor",    VcfCalibration::kOutTameFreqFloor,     "frq");
        add ("outTameFreqSlope",    VcfCalibration::kOutTameFreqSlope,     "frq");
        add ("outTameResStart",     VcfCalibration::kOutTameResStart,      "k");
        add ("outTameResSlope",     VcfCalibration::kOutTameResSlope,      "k");
        add ("outTameMaxReduction", VcfCalibration::kOutTameMaxReduction,  "x");
        add ("noiseLevelBase",      VcfCalibration::kNoiseLevelBase,       "x");
        add ("noiseEnergyGain",     VcfCalibration::kNoiseEnergyGain,      "x");
        add ("inputEnvTauSec",      VcfCalibration::kInputEnvTauSec,       "s");
        add ("deepMindResCurveScale",    VcfCalibration::kDeepMindResCurveScale,    "x");
        add ("deepMindGainCompStrength", VcfCalibration::kDeepMindGainCompStrength, "x");
        add ("deepMindStageSaturation",  VcfCalibration::kDeepMindStageSaturation,  "x");
        add ("masterSoftclipMaxHeadroomDb", DSP::kMasterSoftclipMaxHeadroomDb, "dB");
        add ("dbPerVoltageRatio",        DSP::kDbPerVoltageRatio,           "dB/V");

        return juce::var (obj.get());
    }
}

juce::WebBrowserComponent::Options addPluginNativeFunctions (
    juce::WebBrowserComponent::Options opts,
    ABDEepAudioProcessor& audioProcessor)
{
    return opts
        .withNativeFunction ("logFromJS", [] (const juce::Array<juce::var>& args,
                                               juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            if (args.size() >= 1)
                DBG ("[JS Log] " + args[0].toString());
            completion ({});
        })
        .withNativeFunction ("setParameter", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                                juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::setParameter (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("beginGesture", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                                juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::beginGesture (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("endGesture", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                              juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::endGesture (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("getSynthState", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                                  juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::getSynthState (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("setPresetName", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                                  juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::setPresetName (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("requestMidiDump", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                                    juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::requestMidiDump (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("readFactoryBankFile", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::readFactoryBankFile (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("pianoNoteOn", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                                juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::pianoNoteOn (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("pianoNoteOff", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                                 juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::pianoNoteOff (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("panic", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                          juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::panic (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("getVoiceState", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                                  juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::getVoiceState (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("getAudioWaveform", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                                     juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::getAudioWaveform (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("getBuildInfo", [] (const juce::Array<juce::var>& args,
                                                  juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            juce::ignoreUnused (args);
            juce::DynamicObject::Ptr obj = new juce::DynamicObject();
#if DEEP_TARGET_MODEL == 1
            obj->setProperty ("model", "Classic");
#elif DEEP_TARGET_MODEL == 2
            obj->setProperty ("model", "Enhanced");
#else
            obj->setProperty ("model", "MIDI Controller");
#endif
            obj->setProperty ("buildNumber", EEP_BUILD_VERSION);
            obj->setProperty ("buildTimestamp", EEP_BUILD_TIMESTAMP);
            obj->setProperty ("dspCalibration", buildDspCalibrationObject());
            completion (juce::var (obj.get()));
        })
#if DEEP_TARGET_MODEL >= 2
        .withNativeFunction ("getCalibration", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                                   juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::getCalibration (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("setCalibration", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                                   juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::setCalibration (audioProcessor, args, std::move (completion));
        })
#endif
        .withNativeFunction ("getDiagnosticSnapshot", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                                          juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::getDiagnosticSnapshot (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("startAudioABRun", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                                    juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::startAudioABRun (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("renderAudioABSoftwareReference", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                                                   juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::renderAudioABSoftwareReference (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("finishAudioABRun", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                                     juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::finishAudioABRun (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("abortAudioABRun", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                                    juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::abortAudioABRun (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("compareAudioABRun", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                                      juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            BridgeActions::compareAudioABRun (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("sendModulatorAudioBuffer", [&audioProcessor] (const juce::Array<juce::var>& args,
                                                                             juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            if (args.size() >= 1 && args[0].isArray())
            {
                auto* arr = args[0].getArray();
                int n = juce::jmin ((int) arr->size(), 512);
                if (n > 0)
                {
                    std::vector<float> bufferL, bufferR;
                    bufferL.reserve ((size_t) n);
                    bufferR.reserve ((size_t) n);
                    for (int i = 0; i < n; ++i)
                    {
                        float val = (float) (*arr)[i];
                        bufferL.push_back (val);
                        bufferR.push_back (val); // same mono signal duplicated
                    }
                    audioProcessor.getSynthEngine().getFXEngine().setModulatorBuffer (
                        bufferL.data(), bufferR.data(), n);
                }
            }
            completion ({});
        });
}

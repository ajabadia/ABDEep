#include "CalibrationEditorViewComponent.h"
#include "Core/CalibrationSpec.h"

// ============================================================================
// Diccionario de Metadatos de Calibraci�n
// ============================================================================
struct ParamMeta
{
    juce::String path;
    juce::String group;
    juce::String label;
    juce::String tooltip;
    double minVal;
    double maxVal;
};

static const std::vector<ParamMeta> s_metadata = {
    { "transfer.vcfCutoff.minHz",            "VCF Cutoff Mapping",           "Minimum Cutoff (minHz)",           "Frecuencia de corte m�nima para el filtro paso bajo VCF en Hz.",                                                 10.0, 500.0 },
    { "transfer.vcfCutoff.maxHz",            "VCF Cutoff Mapping",           "Maximum Cutoff (maxHz)",           "Frecuencia de corte m�xima para el filtro paso bajo VCF en Hz.",                                                 1000.0, 40000.0 },
    { "transfer.vcfCutoff.curveBase",        "VCF Cutoff Mapping",           "Curve Base (curveBase)",           "Base exponencial para la curva de barrido logar�tmico del VCF.",                                                 50.0, 2000.0 },

    { "transfer.vcfKeytrack.referenceHz",    "VCF Keytrack",                 "Reference Freq (referenceHz)",     "Frecuencia de referencia de nota MIDI (C4) para seguimiento de teclado.",                                        100.0, 500.0 },
    { "transfer.vcfKeytrack.amountScale",    "VCF Keytrack",                 "Keytrack Gain (amountScale)",      "Multiplicador de ganancia para el seguimiento de teclado.",                                                      0.0, 5.0 },

    { "transfer.vcfPitchBend.cutoffScale",   "VCF Pitch Bend",               "Pitch Bend Scale (cutoffScale)",   "Multiplicador de modulaci�n de Pitch Bend sobre el Cutoff.",                                                     0.0, 1.0 },

    { "transfer.hpf.minHz",                  "Juno High-Pass Filter (HPF)",  "HPF Min Freq (minHz)",             "L�mite inferior para la frecuencia de corte del filtro paso alto.",                                              1.0, 200.0 },
    { "transfer.hpf.maxHz",                  "Juno High-Pass Filter (HPF)",  "HPF Max Freq (maxHz)",             "L�mite superior para la frecuencia de corte del filtro paso alto.",                                              100.0, 20000.0 },
    { "transfer.hpf.modScaleHz",             "Juno High-Pass Filter (HPF)",  "HPF Mod Scale (modScaleHz)",       "Escalador de modulaci�n del HPF de matriz a Hz.",                                                                50.0, 5000.0 },
    { "transfer.hpf.bassBoostGain",          "Juno High-Pass Filter (HPF)",  "HPF Bass Boost (bassBoostGain)",   "Ganancia de realce de graves (bass boost shelf).",                                                               0.1, 3.0 },

    { "transfer.envelopes.driftToTimeScale", "ADSR Envelopes",               "Env Drift Scale (driftToTimeScale)",  "Escalador de la influencia del drift t�rmico en las constantes de tiempo.",                                     0.0, 1.0 },
    { "transfer.envelopes.maxTimeSec",       "ADSR Envelopes",               "Env Max Stage Time (maxTimeSec)",  "M�ximo tiempo de etapa del envolvente en segundos (hardware DM12: 0-10s lineal).",                                     0.1, 30.0 },

    { "transfer.lfo.rateScale",              "LFO Speed Mapping",            "LFO Rate Scale (rateScale)",       "Constante multiplicadora (magic number) de velocidad base del LFO en Hz.",                                       0.001, 1.0 },
    { "transfer.lfo.rateExp",                "LFO Speed Mapping",            "LFO Rate Exponent (rateExp)",      "Coeficiente exponente del comportamiento de curva de velocidad del LFO.",                                        1.0, 20.0 },

    { "voice.staticPitchCentsRange",         "Per-Voice Component Offsets & Drift", "Voice Pitch Drift Cents",    "Rango de desviaci�n aleatoria de afinaci�n est�tica por voz en cents.",                                           0.0, 20.0 },
    { "voice.staticCutoffNormRange",         "Per-Voice Component Offsets & Drift", "Voice Cutoff Deviation",     "Rango de desviaci�n aleatoria est�tica de corte de filtro por voz (normalizado).",                               0.0, 0.5 },
    { "voice.staticResNormRange",            "Per-Voice Component Offsets & Drift", "Voice Res Deviation",       "Rango de desviaci�n aleatoria est�tica de resonancia por voz.",                                                   0.0, 0.3 },
    { "voice.staticEnvTimeNormRange",        "Per-Voice Component Offsets & Drift", "Voice Env Time Deviation",  "Rango de desviaci�n aleatoria est�tica de tiempos de envolvente por voz.",                                        0.0, 0.5 },
    { "voice.cutoffDriftScale",              "Per-Voice Component Offsets & Drift", "Cutoff Drift Multiplier",   "Multiplicador del drift t�rmico simulado sobre el filtro cutoff.",                                                0.0, 5.0 },
    { "voice.resonanceDriftScale",           "Per-Voice Component Offsets & Drift", "Resonance Drift Multiplier", "Multiplicador del drift t�rmico simulado sobre la resonancia del filtro.",                                        0.0, 5.0 }
};

// ============================================================================
// Lookup de metadatos por path
// ============================================================================
static const ParamMeta* findMeta (const juce::String& path)
{
    for (const auto& m : s_metadata)
        if (m.path == path)
            return &m;
    return nullptr;
}

// ============================================================================
// Lookup de valor por defecto de f�brica por path (cache static)
// ============================================================================
static double getDefaultForPath (const juce::String& nextPath)
{
    static const auto defaults = ABD::SynthEngine::getFactoryDefaults(); // cached, llamada solo una vez
    if (nextPath == "transfer.vcfCutoff.minHz")            return defaults.transfer.vcfCutoff.minHz;
    if (nextPath == "transfer.vcfCutoff.maxHz")            return defaults.transfer.vcfCutoff.maxHz;
    if (nextPath == "transfer.vcfCutoff.curveBase")        return defaults.transfer.vcfCutoff.curveBase;
    if (nextPath == "transfer.vcfKeytrack.referenceHz")    return defaults.transfer.vcfKeytrack.referenceHz;
    if (nextPath == "transfer.vcfKeytrack.amountScale")    return defaults.transfer.vcfKeytrack.amountScale;
    if (nextPath == "transfer.vcfPitchBend.cutoffScale")   return defaults.transfer.vcfPitchBend.cutoffScale;
    if (nextPath == "transfer.hpf.minHz")                  return defaults.transfer.hpf.minHz;
    if (nextPath == "transfer.hpf.maxHz")                  return defaults.transfer.hpf.maxHz;
    if (nextPath == "transfer.hpf.modScaleHz")             return defaults.transfer.hpf.modScaleHz;
    if (nextPath == "transfer.hpf.bassBoostGain")          return defaults.transfer.hpf.bassBoostGain;
    if (nextPath == "transfer.envelopes.driftToTimeScale") return defaults.transfer.envelopes.driftToTimeScale;
    if (nextPath == "transfer.envelopes.maxTimeSec")       return defaults.transfer.envelopes.maxTimeSec;
    if (nextPath == "transfer.lfo.rateScale")              return defaults.transfer.lfo.rateScale;
    if (nextPath == "transfer.lfo.rateExp")                return defaults.transfer.lfo.rateExp;
    if (nextPath == "voice.staticPitchCentsRange")         return defaults.voice.staticPitchCentsRange;
    if (nextPath == "voice.staticCutoffNormRange")         return defaults.voice.staticCutoffNormRange;
    if (nextPath == "voice.staticResNormRange")            return defaults.voice.staticResNormRange;
    if (nextPath == "voice.staticEnvTimeNormRange")        return defaults.voice.staticEnvTimeNormRange;
    if (nextPath == "voice.cutoffDriftScale")              return defaults.voice.cutoffDriftScale;
    if (nextPath == "voice.resonanceDriftScale")           return defaults.voice.resonanceDriftScale;
    return 0.0;
}

// ============================================================================
// parseJsonObjectRecursively — Recorre el �rbol JSON y crea controles
// ============================================================================
void CalibrationEditorViewComponent::parseJsonObjectRecursively (const juce::var& obj, const juce::String& currentPath)
{
    if (auto* dynObj = obj.getDynamicObject())
    {
        for (const auto& prop : dynObj->getProperties())
        {
            juce::String nextPath = currentPath.isEmpty() ? prop.name.toString() : currentPath + "." + prop.name.toString();
            const auto& val = prop.value;

            if (val.isObject())
            {
                parseJsonObjectRecursively (val, nextPath);
            }
            else if (val.isDouble() || val.isInt())
            {
                const ParamMeta* meta = findMeta (nextPath);
                if (meta == nullptr)
                    continue; // Filtrar si no est� en el esquema

                auto ctrl = std::make_unique<ParamControl>();
                ctrl->jsonPath = nextPath;
                ctrl->groupName = meta->group;
                ctrl->defaultVal = getDefaultForPath (nextPath);

                juce::String detailedTooltip = meta->tooltip + "\n\n[Default: " + juce::String (ctrl->defaultVal, 4) + "]";

                // Comprobar si necesitamos pintar una cabecera de grupo
                bool isFirstInGroup = true;
                for (const auto& existing : paramControls)
                {
                    if (existing->groupName == meta->group)
                    {
                        isFirstInGroup = false;
                        break;
                    }
                }

                if (isFirstInGroup)
                {
                    ctrl->groupHeaderLabel = std::make_unique<juce::Label> (meta->group + "_header", "  " + meta->group.toUpperCase());
                    ctrl->groupHeaderLabel->setFont (juce::Font (13.0f, juce::Font::bold));
                    ctrl->groupHeaderLabel->setColour (juce::Label::textColourId, juce::Colours::cyan);
                    ctrl->groupHeaderLabel->setColour (juce::Label::backgroundColourId, juce::Colours::darkgrey.withAlpha(0.2f));
                }

                // Etiqueta del par�metro limpia
                ctrl->label = std::make_unique<juce::Label> (nextPath, "  " + meta->label);
                ctrl->label->setFont (juce::Font (12.0f, juce::Font::plain));
                ctrl->label->setColour (juce::Label::textColourId, juce::Colours::lightgrey);
                ctrl->label->setTooltip (detailedTooltip);

                // Slider din�mico con rangos l�gicos
                ctrl->slider = std::make_unique<juce::Slider>();
                ctrl->slider->setSliderStyle (juce::Slider::LinearHorizontal);
                ctrl->slider->setTextBoxStyle (juce::Slider::NoTextBox, false, 0, 0);
                ctrl->slider->setRange (meta->minVal, meta->maxVal, 0.0001);
                ctrl->slider->setValue ((double)val, juce::dontSendNotification);
                ctrl->slider->setTooltip (detailedTooltip);

                // Etiqueta de valor actual
                ctrl->valueLabel = std::make_unique<juce::Label> (nextPath + "_val", juce::String ((double)val, 4));
                ctrl->valueLabel->setFont (juce::Font (12.0f, juce::Font::bold));
                ctrl->valueLabel->setColour (juce::Label::textColourId, juce::Colours::cyan);

                paramControls.push_back (std::move (ctrl));
            }
        }
    }
}

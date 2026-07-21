#include "CalibrationEditorViewComponent.h"
#include "Core/CalibrationSpec.h"

CalibrationEditorViewComponent::CalibrationEditorViewComponent (ABD::SynthEngine* sharedEngine)
    : synthEngine (sharedEngine)
{
    addAndMakeVisible (viewport);
    viewport.setViewedComponent (&viewportContent, false);
    viewportContent.setVisible (true);

    addAndMakeVisible (loadJsonButton);
    loadJsonButton.onClick = [this] { loadSettingsFromFile(); };

    addAndMakeVisible (saveJsonButton);
    saveJsonButton.onClick = [this] { saveSettingsToFile(); };

    addAndMakeVisible (saveToDefaultButton);
    saveToDefaultButton.onClick = [this] { saveToDefault(); };
    saveToDefaultButton.setColour (juce::TextButton::buttonColourId, juce::Colours::darkblue);

    addAndMakeVisible (restoreDefaultsButton);
    restoreDefaultsButton.onClick = [this] { restoreDefaults(); };

    buildControlsFromSpec();
}

void CalibrationEditorViewComponent::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colours::black);
}

void CalibrationEditorViewComponent::resized()
{
    auto area = getLocalBounds().reduced (10);

    // Botones superiores
    auto topArea = area.removeFromTop (40);
    loadJsonButton.setBounds (topArea.removeFromLeft (160).reduced (2));
    saveJsonButton.setBounds (topArea.removeFromLeft (160).reduced (2));
    saveToDefaultButton.setBounds (topArea.removeFromLeft (180).reduced (2));
    restoreDefaultsButton.setBounds (topArea.removeFromRight (180).reduced (2));

    area.removeFromTop (10);
    viewport.setBounds (area);

    // Reposicionar controles dinámicos dentro de viewportContent
    int yPos = 5;
    int controlWidth = viewport.getWidth() - 25;

    for (const auto& ctrl : paramControls)
    {
        // Si hay una cabecera de grupo, posicionarla y avanzar yPos
        if (ctrl->groupHeaderLabel != nullptr)
        {
            ctrl->groupHeaderLabel->setBounds (10, yPos, controlWidth - 20, 24);
            yPos += 28;
        }

        ctrl->label->setBounds (25, yPos, (int)(controlWidth * 0.33f) - 10, 24);
        ctrl->slider->setBounds ((int)(controlWidth * 0.33f) + 10, yPos, (int)(controlWidth * 0.43f), 24);
        
        if (ctrl->resetButton != nullptr)
            ctrl->resetButton->setBounds ((int)(controlWidth * 0.76f) + 15, yPos + 1, 22, 22);

        ctrl->valueLabel->setBounds ((int)(controlWidth * 0.81f) + 15, yPos, (int)(controlWidth * 0.16f), 24);
        yPos += 30;
    }

    viewportContent.setSize (viewport.getWidth() - 20, yPos + 20);
}

void CalibrationEditorViewComponent::buildControlsFromSpec()
{
    paramControls.clear();
    viewportContent.removeAllChildren();

    if (synthEngine == nullptr)
        return;

    // Obtener la calibración activa actual directamente como struct
    CalibrationSpec spec = synthEngine->getCalibration();

    // Crear un JSON nativo real de forma explícita
    juce::DynamicObject::Ptr root = new juce::DynamicObject();
    
    // Transfer.vcfCutoff
    juce::DynamicObject::Ptr transfer = new juce::DynamicObject();
    juce::DynamicObject::Ptr vcfCutoff = new juce::DynamicObject();
    vcfCutoff->setProperty ("minHz", spec.transfer.vcfCutoff.minHz);
    vcfCutoff->setProperty ("maxHz", spec.transfer.vcfCutoff.maxHz);
    vcfCutoff->setProperty ("curveBase", spec.transfer.vcfCutoff.curveBase);
    transfer->setProperty ("vcfCutoff", vcfCutoff.get());

    // Transfer.vcfKeytrack
    juce::DynamicObject::Ptr vcfKeytrack = new juce::DynamicObject();
    vcfKeytrack->setProperty ("referenceHz", spec.transfer.vcfKeytrack.referenceHz);
    vcfKeytrack->setProperty ("amountScale", spec.transfer.vcfKeytrack.amountScale);
    transfer->setProperty ("vcfKeytrack", vcfKeytrack.get());

    // Transfer.vcfPitchBend
    juce::DynamicObject::Ptr vcfPitchBend = new juce::DynamicObject();
    vcfPitchBend->setProperty ("cutoffScale", spec.transfer.vcfPitchBend.cutoffScale);
    transfer->setProperty ("vcfPitchBend", vcfPitchBend.get());

    // Transfer.hpf
    juce::DynamicObject::Ptr hpf = new juce::DynamicObject();
    hpf->setProperty ("minHz", spec.transfer.hpf.minHz);
    hpf->setProperty ("maxHz", spec.transfer.hpf.maxHz);
    hpf->setProperty ("modScaleHz", spec.transfer.hpf.modScaleHz);
    hpf->setProperty ("bassBoostGain", spec.transfer.hpf.bassBoostGain);
    transfer->setProperty ("hpf", hpf.get());

    // Transfer.envelopes
    juce::DynamicObject::Ptr envelopes = new juce::DynamicObject();
    envelopes->setProperty ("driftToTimeScale", spec.transfer.envelopes.driftToTimeScale);
    envelopes->setProperty ("minTimeSec", spec.transfer.envelopes.minTimeSec);
    envelopes->setProperty ("exponentialBase", spec.transfer.envelopes.exponentialBase);
    transfer->setProperty ("envelopes", envelopes.get());

    // Transfer.lfo
    juce::DynamicObject::Ptr lfo = new juce::DynamicObject();
    lfo->setProperty ("rateScale", spec.transfer.lfo.rateScale);
    lfo->setProperty ("rateExp", spec.transfer.lfo.rateExp);
    transfer->setProperty ("lfo", lfo.get());

    root->setProperty ("transfer", transfer.get());

    // Voice
    juce::DynamicObject::Ptr voice = new juce::DynamicObject();
    voice->setProperty ("staticPitchCentsRange", spec.voice.staticPitchCentsRange);
    voice->setProperty ("staticCutoffNormRange", spec.voice.staticCutoffNormRange);
    voice->setProperty ("staticResNormRange", spec.voice.staticResNormRange);
    voice->setProperty ("staticEnvTimeNormRange", spec.voice.staticEnvTimeNormRange);
    voice->setProperty ("cutoffDriftScale", spec.voice.cutoffDriftScale);
    voice->setProperty ("resonanceDriftScale", spec.voice.resonanceDriftScale);
    root->setProperty ("voice", voice.get());

    juce::var parsed (root.get());
    parseJsonObjectRecursively (parsed, "");

    // Configurar listeners y visuales
    for (const auto& ctrl : paramControls)
    {
        if (ctrl->groupHeaderLabel != nullptr)
            viewportContent.addAndMakeVisible (ctrl->groupHeaderLabel.get());

        // Botón Reset por parámetro
        ctrl->resetButton = std::make_unique<juce::TextButton> ("R");
        ctrl->resetButton->setTooltip ("Restaura este parámetro a su valor por defecto de fábrica.");
        ctrl->resetButton->setColour (juce::TextButton::buttonColourId, juce::Colours::darkgrey.withAlpha(0.3f));
        ctrl->resetButton->onClick = [this, rawCtrl = ctrl.get()]()
        {
            rawCtrl->slider->setValue (rawCtrl->defaultVal, juce::sendNotificationSync);
        };

        viewportContent.addAndMakeVisible (ctrl->label.get());
        viewportContent.addAndMakeVisible (ctrl->slider.get());
        viewportContent.addAndMakeVisible (ctrl->resetButton.get());
        viewportContent.addAndMakeVisible (ctrl->valueLabel.get());

        // Inicializar coloreado dinámico del slider
        applySliderColouring (ctrl.get());

        // Escuchar cambios
        ctrl->slider->onValueChange = [this, rawCtrl = ctrl.get()]()
        {
            rawCtrl->valueLabel->setText (juce::String (rawCtrl->slider->getValue(), 4), juce::dontSendNotification);
            applySliderColouring (rawCtrl);
            updateEngineCalibration();
        };
    }

    // Forzar el repintado y el cálculo de límites de JUCE
    resized();
    viewportContent.repaint();
    repaint();
}

void CalibrationEditorViewComponent::parseJsonObjectRecursively (const juce::var& obj, const juce::String& currentPath)
{
    // Diccionario de Metadatos de Calibración
    struct ParamMeta
    {
        juce::String path;
        juce::String group;
        juce::String label;
        juce::String tooltip;
        double minVal;
        double maxVal;
    };

    static const std::vector<ParamMeta> metadata = {
        { "transfer.vcfCutoff.minHz", "VCF Cutoff Mapping", "Minimum Cutoff (minHz)", "Frecuencia de corte mínima para el filtro paso bajo VCF en Hz.", 10.0, 500.0 },
        { "transfer.vcfCutoff.maxHz", "VCF Cutoff Mapping", "Maximum Cutoff (maxHz)", "Frecuencia de corte máxima para el filtro paso bajo VCF en Hz.", 1000.0, 40000.0 },
        { "transfer.vcfCutoff.curveBase", "VCF Cutoff Mapping", "Curve Base (curveBase)", "Base exponencial para la curva de barrido logarítmico del VCF.", 50.0, 2000.0 },
        
        { "transfer.vcfKeytrack.referenceHz", "VCF Keytrack", "Reference Freq (referenceHz)", "Frecuencia de referencia de nota MIDI (C4) para seguimiento de teclado.", 100.0, 500.0 },
        { "transfer.vcfKeytrack.amountScale", "VCF Keytrack", "Keytrack Gain (amountScale)", "Multiplicador de ganancia para el seguimiento de teclado.", 0.0, 5.0 },
        
        { "transfer.vcfPitchBend.cutoffScale", "VCF Pitch Bend", "Pitch Bend Scale (cutoffScale)", "Multiplicador de modulación de Pitch Bend sobre el Cutoff.", 0.0, 1.0 },
        
        { "transfer.hpf.minHz", "Juno High-Pass Filter (HPF)", "HPF Min Freq (minHz)", "Límite inferior para la frecuencia de corte del filtro paso alto.", 1.0, 200.0 },
        { "transfer.hpf.maxHz", "Juno High-Pass Filter (HPF)", "HPF Max Freq (maxHz)", "Límite superior para la frecuencia de corte del filtro paso alto.", 100.0, 20000.0 },
        { "transfer.hpf.modScaleHz", "Juno High-Pass Filter (HPF)", "HPF Mod Scale (modScaleHz)", "Escalador de modulación del HPF de matriz a Hz.", 50.0, 5000.0 },
        { "transfer.hpf.bassBoostGain", "Juno High-Pass Filter (HPF)", "HPF Bass Boost (bassBoostGain)", "Ganancia de realce de graves (bass boost shelf).", 0.1, 3.0 },
        
        { "transfer.envelopes.driftToTimeScale", "ADSR Envelopes", "Env Drift Scale (driftToTimeScale)", "Escalador de la influencia del drift térmico en las constantes de tiempo.", 0.0, 1.0 },
        { "transfer.envelopes.minTimeSec", "ADSR Envelopes", "Env Min Stage Time (minTimeSec)", "Tiempo mínimo de etapa del envolvente (suelo físico en segundos).", 0.0001, 0.1 },
        { "transfer.envelopes.exponentialBase", "ADSR Envelopes", "Exponential Base (exponentialBase)", "Base de curvatura exponencial para los decaimientos de envolventes.", 100.0, 65536.0 },
        
        { "transfer.lfo.rateScale", "LFO Speed Mapping", "LFO Rate Scale (rateScale)", "Constante multiplicadora (magic number) de velocidad base del LFO en Hz.", 0.001, 1.0 },
        { "transfer.lfo.rateExp", "LFO Speed Mapping", "LFO Rate Exponent (rateExp)", "Coeficiente exponente del comportamiento de curva de velocidad del LFO.", 1.0, 20.0 },
        
        { "voice.staticPitchCentsRange", "Per-Voice Component Offsets & Drift", "Voice Pitch Drift Cents", "Rango de desviación aleatoria de afinación estática por voz en cents.", 0.0, 20.0 },
        { "voice.staticCutoffNormRange", "Per-Voice Component Offsets & Drift", "Voice Cutoff Deviation", "Rango de desviación aleatoria estática de corte de filtro por voz (normalizado).", 0.0, 0.5 },
        { "voice.staticResNormRange", "Per-Voice Component Offsets & Drift", "Voice Res Deviation", "Rango de desviación aleatoria estática de resonancia por voz.", 0.0, 0.3 },
        { "voice.staticEnvTimeNormRange", "Per-Voice Component Offsets & Drift", "Voice Env Time Deviation", "Rango de desviación aleatoria estática de tiempos de envolvente por voz.", 0.0, 0.5 },
        { "voice.cutoffDriftScale", "Per-Voice Component Offsets & Drift", "Cutoff Drift Multiplier", "Multiplicador del drift térmico simulado sobre el filtro cutoff.", 0.0, 5.0 },
        { "voice.resonanceDriftScale", "Per-Voice Component Offsets & Drift", "Resonance Drift Multiplier", "Multiplicador del drift térmico simulado sobre la resonancia del filtro.", 0.0, 5.0 }
    };

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
                // Buscar metadatos
                const ParamMeta* meta = nullptr;
                for (const auto& m : metadata)
                {
                    if (m.path == nextPath)
                    {
                        meta = &m;
                        break;
                    }
                }

                if (meta == nullptr)
                    continue; // Filtrar u omitir campos si no están en nuestro esquema descriptivo

                auto ctrl = std::make_unique<ParamControl>();
                ctrl->jsonPath = nextPath;
                ctrl->groupName = meta->group;

                // Extraer el valor por defecto de fábrica correspondiente
                auto defaults = ABD::SynthEngine::getFactoryDefaults();
                double defVal = 0.0;
                if (nextPath == "transfer.vcfCutoff.minHz")            defVal = defaults.transfer.vcfCutoff.minHz;
                else if (nextPath == "transfer.vcfCutoff.maxHz")       defVal = defaults.transfer.vcfCutoff.maxHz;
                else if (nextPath == "transfer.vcfCutoff.curveBase")   defVal = defaults.transfer.vcfCutoff.curveBase;
                else if (nextPath == "transfer.vcfKeytrack.referenceHz") defVal = defaults.transfer.vcfKeytrack.referenceHz;
                else if (nextPath == "transfer.vcfKeytrack.amountScale") defVal = defaults.transfer.vcfKeytrack.amountScale;
                else if (nextPath == "transfer.vcfPitchBend.cutoffScale") defVal = defaults.transfer.vcfPitchBend.cutoffScale;
                else if (nextPath == "transfer.hpf.minHz")             defVal = defaults.transfer.hpf.minHz;
                else if (nextPath == "transfer.hpf.maxHz")             defVal = defaults.transfer.hpf.maxHz;
                else if (nextPath == "transfer.hpf.modScaleHz")        defVal = defaults.transfer.hpf.modScaleHz;
                else if (nextPath == "transfer.hpf.bassBoostGain")     defVal = defaults.transfer.hpf.bassBoostGain;
                else if (nextPath == "transfer.envelopes.driftToTimeScale") defVal = defaults.transfer.envelopes.driftToTimeScale;
                else if (nextPath == "transfer.envelopes.minTimeSec")       defVal = defaults.transfer.envelopes.minTimeSec;
                else if (nextPath == "transfer.envelopes.exponentialBase")  defVal = defaults.transfer.envelopes.exponentialBase;
                else if (nextPath == "transfer.lfo.rateScale")          defVal = defaults.transfer.lfo.rateScale;
                else if (nextPath == "transfer.lfo.rateExp")            defVal = defaults.transfer.lfo.rateExp;
                else if (nextPath == "voice.staticPitchCentsRange")     defVal = defaults.voice.staticPitchCentsRange;
                else if (nextPath == "voice.staticCutoffNormRange")     defVal = defaults.voice.staticCutoffNormRange;
                else if (nextPath == "voice.staticResNormRange")        defVal = defaults.voice.staticResNormRange;
                else if (nextPath == "voice.staticEnvTimeNormRange")    defVal = defaults.voice.staticEnvTimeNormRange;
                else if (nextPath == "voice.cutoffDriftScale")          defVal = defaults.voice.cutoffDriftScale;
                else if (nextPath == "voice.resonanceDriftScale")       defVal = defaults.voice.resonanceDriftScale;

                ctrl->defaultVal = defVal;
                juce::String detailedTooltip = meta->tooltip + "\n\n[Default: " + juce::String (defVal, 4) + "]";

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

                // Etiqueta del parámetro limpia
                ctrl->label = std::make_unique<juce::Label> (nextPath, "  " + meta->label);
                ctrl->label->setFont (juce::Font (12.0f, juce::Font::plain));
                ctrl->label->setColour (juce::Label::textColourId, juce::Colours::lightgrey);
                ctrl->label->setTooltip (detailedTooltip);

                // Slider dinámico con rangos lógicos
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

void CalibrationEditorViewComponent::updateEngineCalibration()
{
    if (synthEngine == nullptr)
        return;

    // 1. Obtener una copia limpia del struct
    CalibrationSpec spec = synthEngine->getCalibration();

    // 2. Mapear explícitamente los valores desde los sliders
    for (const auto& ctrl : paramControls)
    {
        float val = (float)ctrl->slider->getValue();
        juce::String path = ctrl->jsonPath;

        if (path == "transfer.vcfCutoff.minHz")            spec.transfer.vcfCutoff.minHz = val;
        else if (path == "transfer.vcfCutoff.maxHz")       spec.transfer.vcfCutoff.maxHz = val;
        else if (path == "transfer.vcfCutoff.curveBase")   spec.transfer.vcfCutoff.curveBase = val;
        
        else if (path == "transfer.vcfKeytrack.referenceHz") spec.transfer.vcfKeytrack.referenceHz = val;
        else if (path == "transfer.vcfKeytrack.amountScale") spec.transfer.vcfKeytrack.amountScale = val;
        
        else if (path == "transfer.vcfPitchBend.cutoffScale") spec.transfer.vcfPitchBend.cutoffScale = val;
        
        else if (path == "transfer.hpf.minHz")             spec.transfer.hpf.minHz = val;
        else if (path == "transfer.hpf.maxHz")             spec.transfer.hpf.maxHz = val;
        else if (path == "transfer.hpf.modScaleHz")        spec.transfer.hpf.modScaleHz = val;
        else if (path == "transfer.hpf.bassBoostGain")     spec.transfer.hpf.bassBoostGain = val;
        
        else if (path == "transfer.envelopes.driftToTimeScale") spec.transfer.envelopes.driftToTimeScale = val;
        else if (path == "transfer.envelopes.minTimeSec")       spec.transfer.envelopes.minTimeSec = val;
        else if (path == "transfer.envelopes.exponentialBase")  spec.transfer.envelopes.exponentialBase = val;
        
        else if (path == "transfer.lfo.rateScale")          spec.transfer.lfo.rateScale = val;
        else if (path == "transfer.lfo.rateExp")            spec.transfer.lfo.rateExp = val;

        else if (path == "voice.staticPitchCentsRange")     spec.voice.staticPitchCentsRange = val;
        else if (path == "voice.staticCutoffNormRange")     spec.voice.staticCutoffNormRange = val;
        else if (path == "voice.staticResNormRange")        spec.voice.staticResNormRange = val;
        else if (path == "voice.staticEnvTimeNormRange")    spec.voice.staticEnvTimeNormRange = val;
        else if (path == "voice.cutoffDriftScale")          spec.voice.cutoffDriftScale = val;
        else if (path == "voice.resonanceDriftScale")       spec.voice.resonanceDriftScale = val;
    }

    // 3. Cargar en el motor (usa XML por debajo)
    synthEngine->loadCalibrationFromJson (spec.toXml());
}

void CalibrationEditorViewComponent::loadSettingsFromFile()
{
    fileChooser = std::make_unique<juce::FileChooser> (
        "Select Calibration JSON settings",
        juce::File::getSpecialLocation (juce::File::userHomeDirectory),
        "*.json"
    );

    fileChooser->launchAsync (juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles,
        [this] (const juce::FileChooser& chooser)
        {
            auto file = chooser.getResult();
            if (file.existsAsFile())
            {
                juce::String jsonText = file.loadFileAsString();
                if (synthEngine != nullptr)
                {
                    synthEngine->loadCalibrationFromJson (jsonText);
                    buildControlsFromSpec();
                }
            }
        }
    );
}

void CalibrationEditorViewComponent::saveSettingsToFile()
{
    fileChooser = std::make_unique<juce::FileChooser> (
        "Save Calibration JSON settings",
        juce::File::getSpecialLocation (juce::File::userHomeDirectory),
        "*.json"
    );

    fileChooser->launchAsync (juce::FileBrowserComponent::saveMode | juce::FileBrowserComponent::canSelectFiles,
        [this] (const juce::FileChooser& chooser)
        {
            auto file = chooser.getResult();
            if (file != juce::File())
            {
                // Forzar extensión .json
                if (file.getFileExtension() != ".json")
                    file = file.withFileExtension (".json");

                juce::String activeJson = synthEngine->getDiagnosticSnapshot().activeCalibrationJson;
                if (activeJson.isEmpty())
                {
                    auto defaults = ABD::SynthEngine::getFactoryDefaults();
                    activeJson = defaults.toXml();
                }
                
                file.replaceWithText (activeJson);
            }
        }
    );
}

void CalibrationEditorViewComponent::restoreDefaults()
{
    if (synthEngine != nullptr)
    {
        auto defaults = ABD::SynthEngine::getFactoryDefaults();
        synthEngine->loadCalibrationFromJson (defaults.toXml());
        buildControlsFromSpec();
    }
}

void CalibrationEditorViewComponent::saveToDefault()
{
    if (synthEngine == nullptr)
        return;

    auto file = CalibrationSpec::getDefaultCalibrationFile();
    
    // Crear directorios si no existen
    if (! file.getParentDirectory().exists())
        file.getParentDirectory().createDirectory();

    auto spec = synthEngine->getCalibration();
    
    if (file.replaceWithText (spec.toXml()))
    {
        juce::AlertWindow::showMessageBoxAsync (
            juce::AlertWindow::InfoIcon,
            "Calibration Saved",
            "La calibración activa se ha consolidado en la ruta por defecto del sintetizador:\n" + file.getFullPathName() + "\n\nLos cambios tendrán efecto inmediato en todos los motores del plugin y standalone al iniciarse.",
            "OK"
        );
    }
    else
    {
        juce::AlertWindow::showMessageBoxAsync (
            juce::AlertWindow::WarningIcon,
            "Error",
            "No se pudo escribir en el archivo de calibración por defecto.",
            "OK"
        );
    }
}

void CalibrationEditorViewComponent::applySliderColouring (ParamControl* ctrl)
{
    if (ctrl == nullptr || ctrl->slider == nullptr)
        return;

    double current = ctrl->slider->getValue();
    double def = ctrl->defaultVal;
    
    double diff = current - def;

    // Umbral de coincidencia exacta
    if (std::abs (diff) < 1e-5)
    {
        ctrl->slider->setColour (juce::Slider::thumbColourId, juce::Colours::lightgrey);
        ctrl->slider->setColour (juce::Slider::trackColourId, juce::Colours::darkgrey.withAlpha(0.5f));
        ctrl->valueLabel->setColour (juce::Label::textColourId, juce::Colours::lightgrey);
        return;
    }

    double rangeMin = ctrl->slider->getMinimum();
    double rangeMax = ctrl->slider->getMaximum();

    if (diff > 0.0)
    {
        // Mayor que el default: gradiente hacia Azul/Cian
        double ratio = diff / (rangeMax - def);
        ratio = std::clamp (ratio, 0.0, 1.0);
        
        juce::Colour blueColor = juce::Colours::white.interpolatedWith (juce::Colours::cyan, (float)ratio);
        ctrl->slider->setColour (juce::Slider::thumbColourId, blueColor);
        ctrl->slider->setColour (juce::Slider::trackColourId, juce::Colours::cyan.withAlpha (0.4f));
        ctrl->valueLabel->setColour (juce::Label::textColourId, juce::Colours::cyan);
    }
    else
    {
        // Menor que el default: gradiente hacia Rojo/Coral
        double ratio = std::abs(diff) / (def - rangeMin);
        ratio = std::clamp (ratio, 0.0, 1.0);
        
        juce::Colour redColor = juce::Colours::white.interpolatedWith (juce::Colours::coral, (float)ratio);
        ctrl->slider->setColour (juce::Slider::thumbColourId, redColor);
        ctrl->slider->setColour (juce::Slider::trackColourId, juce::Colours::coral.withAlpha (0.4f));
        ctrl->valueLabel->setColour (juce::Label::textColourId, juce::Colours::coral);
    }
}

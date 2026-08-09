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

    // Reposicionar controles din�micos dentro de viewportContent
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

    // Obtener la calibraci�n activa actual directamente como struct
    CalibrationSpec spec = synthEngine->getCalibration();

    // Crear un JSON nativo real de forma expl�cita
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
    envelopes->setProperty ("maxTimeSec", spec.transfer.envelopes.maxTimeSec);
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

        // Bot�n Reset por par�metro
        ctrl->resetButton = std::make_unique<juce::TextButton> ("R");
        ctrl->resetButton->setTooltip ("Restaura este par�metro a su valor por defecto de f�brica.");
        ctrl->resetButton->setColour (juce::TextButton::buttonColourId, juce::Colours::darkgrey.withAlpha(0.3f));
        ctrl->resetButton->onClick = [this, rawCtrl = ctrl.get()]()
        {
            rawCtrl->slider->setValue (rawCtrl->defaultVal, juce::sendNotificationSync);
        };

        viewportContent.addAndMakeVisible (ctrl->label.get());
        viewportContent.addAndMakeVisible (ctrl->slider.get());
        viewportContent.addAndMakeVisible (ctrl->resetButton.get());
        viewportContent.addAndMakeVisible (ctrl->valueLabel.get());

        // Inicializar coloreado din�mico del slider
        applySliderColouring (ctrl.get());

        // Escuchar cambios
        ctrl->slider->onValueChange = [this, rawCtrl = ctrl.get()]()
        {
            rawCtrl->valueLabel->setText (juce::String (rawCtrl->slider->getValue(), 4), juce::dontSendNotification);
            applySliderColouring (rawCtrl);
            updateEngineCalibration();
        };
    }

    // Forzar el repintado y el c�lculo de l�mites de JUCE
    resized();
    viewportContent.repaint();
    repaint();
}

void CalibrationEditorViewComponent::updateEngineCalibration()
{
    if (synthEngine == nullptr)
        return;

    // 1. Obtener una copia limpia del struct
    CalibrationSpec spec = synthEngine->getCalibration();

    // 2. Mapear expl�citamente los valores desde los sliders
    for (const auto& ctrl : paramControls)
    {
        float val = (float)ctrl->slider->getValue();
        juce::String path = ctrl->jsonPath;

        if (path == "transfer.vcfCutoff.minHz")                spec.transfer.vcfCutoff.minHz = val;
        else if (path == "transfer.vcfCutoff.maxHz")           spec.transfer.vcfCutoff.maxHz = val;
        else if (path == "transfer.vcfCutoff.curveBase")       spec.transfer.vcfCutoff.curveBase = val;
        else if (path == "transfer.vcfKeytrack.referenceHz")   spec.transfer.vcfKeytrack.referenceHz = val;
        else if (path == "transfer.vcfKeytrack.amountScale")   spec.transfer.vcfKeytrack.amountScale = val;
        else if (path == "transfer.vcfPitchBend.cutoffScale")  spec.transfer.vcfPitchBend.cutoffScale = val;
        else if (path == "transfer.hpf.minHz")                 spec.transfer.hpf.minHz = val;
        else if (path == "transfer.hpf.maxHz")                 spec.transfer.hpf.maxHz = val;
        else if (path == "transfer.hpf.modScaleHz")            spec.transfer.hpf.modScaleHz = val;
        else if (path == "transfer.hpf.bassBoostGain")         spec.transfer.hpf.bassBoostGain = val;
        else if (path == "transfer.envelopes.driftToTimeScale") spec.transfer.envelopes.driftToTimeScale = val;
        else if (path == "transfer.envelopes.maxTimeSec")      spec.transfer.envelopes.maxTimeSec = val;
        else if (path == "transfer.lfo.rateScale")             spec.transfer.lfo.rateScale = val;
        else if (path == "transfer.lfo.rateExp")               spec.transfer.lfo.rateExp = val;
        else if (path == "voice.staticPitchCentsRange")        spec.voice.staticPitchCentsRange = val;
        else if (path == "voice.staticCutoffNormRange")        spec.voice.staticCutoffNormRange = val;
        else if (path == "voice.staticResNormRange")           spec.voice.staticResNormRange = val;
        else if (path == "voice.staticEnvTimeNormRange")       spec.voice.staticEnvTimeNormRange = val;
        else if (path == "voice.cutoffDriftScale")             spec.voice.cutoffDriftScale = val;
        else if (path == "voice.resonanceDriftScale")          spec.voice.resonanceDriftScale = val;
    }

    // 3. Cargar en el motor (usa XML por debajo)
    synthEngine->loadCalibrationFromJson (spec.toXml());
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

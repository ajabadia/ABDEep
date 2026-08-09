#include "CalibrationEditorViewComponent.h"
#include "Core/CalibrationSpec.h"

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
                // Forzar extensi�n .json
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
            "La calibraci�n activa se ha consolidado en la ruta por defecto del sintetizador:\n" + file.getFullPathName() + "\n\nLos cambios tendr�n efecto inmediato en todos los motores del plugin y standalone al iniciarse.",
            "OK"
        );
    }
    else
    {
        juce::AlertWindow::showMessageBoxAsync (
            juce::AlertWindow::WarningIcon,
            "Error",
            "No se pudo escribir en el archivo de calibraci�n por defecto.",
            "OK"
        );
    }
}

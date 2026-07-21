#pragma once

#include <JuceHeader.h>

class PresetManager
{
public:
    struct Preset
    {
        juce::String name;
        juce::String category;
        juce::String author;
        juce::ValueTree state;
    };

    PresetManager()
    {
        // Crear carpeta de presets de usuario en documentos por defecto
        presetsDirectory = juce::File::getSpecialLocation (juce::File::userDocumentsDirectory)
                            .getChildFile ("ABDEep")
                            .getChildFile ("Presets");
        presetsDirectory.createDirectory();
    }

    ~PresetManager() = default;

    // Guarda el patch actual de la ValueTreeState en un archivo JSON en disco
    bool savePreset (const juce::String& name, const juce::String& category, const juce::String& author, const juce::ValueTree& state)
    {
        juce::File presetFile = presetsDirectory.getChildFile (name + ".json");
        
        juce::DynamicObject::Ptr jsonObject = new juce::DynamicObject();
        jsonObject->setProperty ("name", name);
        jsonObject->setProperty ("category", category);
        jsonObject->setProperty ("author", author);

        // Guardar parámetros de la ValueTree
        juce::DynamicObject::Ptr paramsObj = new juce::DynamicObject();
        for (int i = 0; i < state.getNumChildren(); ++i)
        {
            auto child = state.getChild(i);
            juce::String paramID = child.getProperty("id").toString();
            float value = static_cast<float>(child.getProperty("value"));
            paramsObj->setProperty (paramID, (double)value);
        }
        jsonObject->setProperty ("parameters", juce::var(paramsObj.get()));

        juce::var jsonVar (jsonObject.get());
        juce::String jsonText = juce::JSON::toString (jsonVar);
        
        return presetFile.replaceWithText (jsonText);
    }

    // Retorna una lista con la información de todos los presets guardados
    juce::Array<juce::var> getPresetsList() const
    {
        juce::Array<juce::var> list;
        juce::Array<juce::File> files;
        presetsDirectory.findChildFiles (files, juce::File::findFiles, false, "*.json");

        for (const auto& file : files)
        {
            juce::var parsedJson = juce::JSON::parse (file);
            if (parsedJson.isObject())
            {
                juce::DynamicObject::Ptr info = new juce::DynamicObject();
                info->setProperty ("name", parsedJson.getProperty ("name", ""));
                info->setProperty ("category", parsedJson.getProperty ("category", ""));
                info->setProperty ("author", parsedJson.getProperty ("author", ""));
                list.add (juce::var(info.get()));
            }
        }
        return list;
    }

private:
    juce::File presetsDirectory;
};

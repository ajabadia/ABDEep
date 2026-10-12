#include <JuceHeader.h>
#include <WebView2Bridge/WebView2ResourceProvider.h>

std::optional<juce::WebBrowserComponent::Resource> pluginResourceProvider (const juce::String& url)
{
    // Development mode: derive paths from source tree (__FILE__ ensures portability)
    juce::File thisFile (__FILE__);
    juce::File projectDir = thisFile.getParentDirectory()          // Source/Plugin/
                                      .getParentDirectory()       // Source/
                                      .getParentDirectory();       // ABDEep/
    juce::File webUiDir = projectDir.getChildFile ("WebUI");

    juce::String decodedPath = abd::webview2::normalizeResourcePath (url);

    // 0. Bundle de Vite (WebUI/dist): es el sitio que sirve el host cuando existe.
    //    Trae los bare imports @abdsynths/* YA resueltos (keybed compartido,
    //    fitStage); el arbol crudo no los puede resolver porque el WebView2 no
    //    tiene node_modules. Se regenera con `node scripts/build_webui.js`.
    //    dist y el arbol crudo comparten estructura de rutas, asi que lo que no
    //    este en el bundle (assets sueltos, wasm) cae en los pasos siguientes.
    juce::File distDir = webUiDir.getChildFile ("dist");
    if (distDir.isDirectory())
    {
        juce::File distFile = distDir.getChildFile (decodedPath.replace ("/", "\\"));
        if (distFile.existsAsFile())
        {
            juce::MemoryBlock mb;
            distFile.loadFileAsData (mb);
            std::vector<std::byte> data (mb.getSize());
            std::memcpy (data.data(), mb.getData(), mb.getSize());
            return juce::WebBrowserComponent::Resource { std::move (data), abd::webview2::getMimeTypeForFilename (distFile.getFileName()).toStdString() };
        }
    }

    // 1. Try loading from disk (Development Mode: arbol crudo, sin bundle)
    juce::File file = webUiDir.getChildFile (decodedPath.replace ("/", "\\"));
    bool fileExists = file.existsAsFile();

    if (!fileExists)
    {
        juce::File fallbackFile = projectDir.getChildFile (decodedPath.replace ("/", "\\"));
        if (fallbackFile.existsAsFile())
        {
            file = fallbackFile;
            fileExists = true;
        }
    }

    if (fileExists)
    {
        juce::MemoryBlock mb;
        file.loadFileAsData (mb);
        std::vector<std::byte> data (mb.getSize());
        std::memcpy (data.data(), mb.getData(), mb.getSize());
        return juce::WebBrowserComponent::Resource { std::move (data), abd::webview2::getMimeTypeForFilename (file.getFileName()).toStdString() };
    }

    // 1. Fallback to BinaryData (Release / Distribution Mode)
    // Convert path into a BinaryData-compatible resource name
    // (e.g. js/settings.js -> js_settings_js)
    juce::String resourceName = decodedPath.replace ("/", "_")
                                           .replace (".", "_")
                                           .replace ("-", "_")
                                           .replace (" ", "_");

    int binSize = 0;
    const char* binData = BinaryData::getNamedResource (resourceName.toRawUTF8(), binSize);

    // Numeric name mangling fallback (e.g. 0.png -> _0_png)
    if (binData == nullptr && decodedPath.length() > 0)
    {
        juce::String filename = decodedPath.fromLastOccurrenceOf ("/", false, false);
        if (filename.isEmpty()) filename = decodedPath;
        juce::String flattenedName = filename.replace (".", "_").replace ("-", "_").replace (" ", "_");
        if (juce::CharacterFunctions::isDigit (flattenedName[0]))
            flattenedName = "_" + flattenedName;
        binData = BinaryData::getNamedResource (flattenedName.toRawUTF8(), binSize);
    }

    if (binData != nullptr)
    {
        std::vector<std::byte> bytes (binSize);
        std::memcpy (bytes.data(), binData, (size_t)binSize);
        return juce::WebBrowserComponent::Resource { std::move (bytes), abd::webview2::getMimeTypeForFilename (decodedPath).toStdString() };
    }

    // Log missing file for debug
    DBG ("[ResourceProvider] ERROR: File not found on disk or BinaryData for path: " + decodedPath);

    return std::nullopt;
}

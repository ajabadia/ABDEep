#include <JuceHeader.h>

// Helper to determine mime type based on file extension
static juce::String getMimeTypeForFilename (const juce::String& filename)
{
    if (filename.endsWithIgnoreCase (".html")) return "text/html";
    if (filename.endsWithIgnoreCase (".css"))  return "text/css";
    if (filename.endsWithIgnoreCase (".js"))   return "application/javascript";
    if (filename.endsWithIgnoreCase (".png"))  return "image/png";
    if (filename.endsWithIgnoreCase (".jpg") || filename.endsWithIgnoreCase (".jpeg")) return "image/jpeg";
    if (filename.endsWithIgnoreCase (".ttf"))  return "font/ttf";
    if (filename.endsWithIgnoreCase (".woff")) return "font/woff";
    if (filename.endsWithIgnoreCase (".woff2")) return "font/woff2";
    if (filename.endsWithIgnoreCase (".json")) return "application/json";
    return "application/octet-stream";
}

std::optional<juce::WebBrowserComponent::Resource> pluginResourceProvider (const juce::String& url)
{
    // Development mode: derive paths from source tree (__FILE__ ensures portability)
    juce::File thisFile (__FILE__);
    juce::File projectDir = thisFile.getParentDirectory()          // Source/Plugin/
                                      .getParentDirectory()       // Source/
                                      .getParentDirectory();       // ABDEep/
    juce::File webUiDir = projectDir.getChildFile ("WebUI");

    juce::String path = url;

    if (path.startsWith ("juce://"))
    {
        int hostEndIndex = path.indexOf (7, "/");
        if (hostEndIndex != -1)
            path = path.substring (hostEndIndex);
    }
    else if (path.startsWith ("https://juce.backend"))
    {
        path = path.substring (20);
    }
    else if (path.startsWith ("http://localhost"))
        path = path.substring (16);
    else if (path.startsWith ("https://localhost"))
        path = path.substring (17);

    if (path == "/" || path.isEmpty()) path = "/index.html";
    if (path.startsWith ("/")) path = path.substring (1);

    // URL-decode the path (handles spaces encoded as %20, etc.)
    juce::String decodedPath = juce::URL::removeEscapeChars (path);

    // 1. Try loading from disk (Development Mode)
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
        return juce::WebBrowserComponent::Resource { std::move (data), getMimeTypeForFilename (file.getFileName()).toStdString() };
    }

    // 2. Fallback to BinaryData (Release / Distribution Mode)
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
        return juce::WebBrowserComponent::Resource { std::move (bytes), getMimeTypeForFilename (decodedPath).toStdString() };
    }

    // Log missing file for debug
    DBG ("[ResourceProvider] ERROR: File not found on disk or BinaryData for path: " + decodedPath);

    return std::nullopt;
}

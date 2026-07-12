#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "BridgeActions.h"
#include <fstream>

ABDEepAudioProcessorEditor::ABDEepAudioProcessorEditor (ABDEepAudioProcessor& p)
    : AudioProcessorEditor (&p), audioProcessor (p)
{
    // Write startup log using standard C++ ofstream in workspace
    {
        std::ofstream logFileStream ("D:\\desarrollos\\ABDSynths\\ABDEep\\webview_log.txt", std::ios::out | std::ios::trunc);
        if (logFileStream.is_open())
        {
            logFileStream << "[Editor] Constructor started. Setting up WebBrowserComponent..." << std::endl;
        }
    }

    // Configuración para usar WebView2 en Windows
    auto options = juce::WebBrowserComponent::Options{}
        .withBackend (juce::WebBrowserComponent::Options::Backend::webview2)
        .withNativeIntegrationEnabled (true)
        .withWinWebView2Options (juce::WebBrowserComponent::Options::WinWebView2()
            .withUserDataFolder (juce::File::getSpecialLocation (juce::File::tempDirectory).getChildFile ("ABD_Eep_WebView2")))
        .withResourceProvider ([this] (const juce::String& url) -> std::optional<juce::WebBrowserComponent::Resource> {
            juce::File logFile ("D:\\desarrollos\\ABDSynths\\ABDEep\\webview_log.txt");
            juce::File webUiDir ("d:\\desarrollos\\ABDSynths\\ABDEep\\WebUI");

            juce::String path = url;
            if (path.startsWith ("juce://resource"))
                path = path.substring (15); // Length of "juce://resource"
            else if (path.startsWith ("http://localhost"))
                path = path.substring (16); // Length of "http://localhost"
            else if (path.startsWith ("https://localhost"))
                path = path.substring (17); // Length of "https://localhost"

            if (path == "/" || path.isEmpty()) path = "/index.html";
            if (path.startsWith("/")) path = path.substring(1);

            juce::File file = webUiDir.getChildFile (path.replace("/", "\\"));
            bool fileExists = file.existsAsFile();
            
            logFile.appendText ("[ResourceProvider] Request: " + url + " -> Resolved: " + file.getFullPathName() + " (Exists: " + juce::String((int)fileExists) + ")\n");
            
            if (fileExists)
            {
                juce::MemoryBlock mb;
                file.loadFileAsData (mb);
                std::vector<std::byte> data (mb.getSize());
                std::memcpy (data.data(), mb.getData(), mb.getSize());
                
                juce::String mimeType = "application/octet-stream";
                if (file.getFileName().endsWithIgnoreCase (".html")) mimeType = "text/html; charset=utf-8";
                else if (file.getFileName().endsWithIgnoreCase (".css")) mimeType = "text/css; charset=utf-8";
                else if (file.getFileName().endsWithIgnoreCase (".js")) mimeType = "application/javascript; charset=utf-8";
                
                return juce::WebBrowserComponent::Resource { std::move(data), mimeType.toStdString() };
            }
            else
            {
                logFile.appendText ("[ResourceProvider] ERROR: File not found for: " + url + "\n");
            }
            return std::nullopt;
        })
        .withNativeFunction ("setParameter", [this] (const juce::Array<juce::var>& args, juce::WebBrowserComponent::NativeFunctionCompletion completion) {
            BridgeActions::setParameter (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("beginGesture", [this] (const juce::Array<juce::var>& args, juce::WebBrowserComponent::NativeFunctionCompletion completion) {
            BridgeActions::beginGesture (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("endGesture", [this] (const juce::Array<juce::var>& args, juce::WebBrowserComponent::NativeFunctionCompletion completion) {
            BridgeActions::endGesture (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("getSynthState", [this] (const juce::Array<juce::var>& args, juce::WebBrowserComponent::NativeFunctionCompletion completion) {
            BridgeActions::getSynthState (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("requestMidiDump", [this] (const juce::Array<juce::var>& args, juce::WebBrowserComponent::NativeFunctionCompletion completion) {
            BridgeActions::requestMidiDump (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("readFactoryBankFile", [this] (const juce::Array<juce::var>& args, juce::WebBrowserComponent::NativeFunctionCompletion completion) {
            BridgeActions::readFactoryBankFile (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("pianoNoteOn", [this] (const juce::Array<juce::var>& args, juce::WebBrowserComponent::NativeFunctionCompletion completion) {
            BridgeActions::pianoNoteOn (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("pianoNoteOff", [this] (const juce::Array<juce::var>& args, juce::WebBrowserComponent::NativeFunctionCompletion completion) {
            BridgeActions::pianoNoteOff (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("getVoiceState", [this] (const juce::Array<juce::var>& args, juce::WebBrowserComponent::NativeFunctionCompletion completion) {
            BridgeActions::getVoiceState (audioProcessor, args, std::move (completion));
        })
        .withNativeFunction ("getAudioWaveform", [this] (const juce::Array<juce::var>& args, juce::WebBrowserComponent::NativeFunctionCompletion completion) {
            BridgeActions::getAudioWaveform (audioProcessor, args, std::move (completion));
        });

    webComponent = std::make_unique<juce::WebBrowserComponent> (options);
    addAndMakeVisible (*webComponent);
    
    // Cargar la página principal usando el proveedor de recursos raíz de JUCE 8
    webComponent->goToURL (juce::WebBrowserComponent::getResourceProviderRoot());

    // Iniciar timer para sincronizar eventos de nota del engine → WebUI
    startTimerHz (30); // 30 Hz polling

    setSize (1200, 768);
}

ABDEepAudioProcessorEditor::~ABDEepAudioProcessorEditor()
{
    stopTimer();
}

void ABDEepAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colours::black);
}

void ABDEepAudioProcessorEditor::resized()
{
    if (webComponent != nullptr)
        webComponent->setBounds (getLocalBounds());
}

void ABDEepAudioProcessorEditor::timerCallback()
{
    auto& engine = audioProcessor.getSynthEngine();

    // Leer todas las notas activas desde el voice snapshot (thread-safe)
    juce::String currentNotes = engine.getActiveNotesJSON();

    // Solo enviar a JS si cambió para evitar spam de evaluateJavascript
    if (currentNotes != lastActiveNotesJSON)
    {
        lastActiveNotesJSON = currentNotes;
        auto js = juce::String("window._handleEngineActiveNotes(") + currentNotes + ")" + ";";
        webComponent->evaluateJavascript (js);
    }
}

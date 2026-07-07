#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "BridgeActions.h"

ABDEepAudioProcessorEditor::ABDEepAudioProcessorEditor (ABDEepAudioProcessor& p)
    : AudioProcessorEditor (&p), audioProcessor (p)
{
    // Configuración para usar WebView2 en Windows
    auto options = juce::WebBrowserComponent::Options{}
        .withBackend (juce::WebBrowserComponent::Options::Backend::webview2)
        .withNativeIntegrationEnabled (true)
        .withWinWebView2Options (juce::WebBrowserComponent::Options::WinWebView2()
            .withUserDataFolder (juce::File::getSpecialLocation (juce::File::tempDirectory).getChildFile ("ABD_Eep_WebView2")))
        .withResourceProvider ([this] (const juce::String& url) -> std::optional<juce::WebBrowserComponent::Resource> {
            juce::File currentFile (__FILE__);
            juce::File webUiDir = currentFile.getParentDirectory().getParentDirectory().getChildFile ("WebUI");
            
            juce::String path = url;
            if (path == "/" || path.isEmpty()) path = "/index.html";
            if (path.startsWith("/")) path = path.substring(1);

            juce::File file = webUiDir.getChildFile (path.replace("/", "\\"));
            if (file.existsAsFile())
            {
                juce::MemoryBlock mb;
                file.loadFileAsData (mb);
                std::vector<std::byte> data (mb.getSize());
                std::memcpy (data.data(), mb.getData(), mb.getSize());
                
                juce::String mimeType = "application/octet-stream";
                if (file.getFileName().endsWithIgnoreCase (".html")) mimeType = "text/html";
                else if (file.getFileName().endsWithIgnoreCase (".css")) mimeType = "text/css";
                else if (file.getFileName().endsWithIgnoreCase (".js")) mimeType = "application/javascript";
                
                return juce::WebBrowserComponent::Resource { std::move(data), mimeType.toStdString() };
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
        });

    webComponent = std::make_unique<juce::WebBrowserComponent> (options);
    addAndMakeVisible (*webComponent);
    
    // Cargar la página principal
    webComponent->goToURL ("http://localhost/index.html");

    setSize (1024, 768);
}

ABDEepAudioProcessorEditor::~ABDEepAudioProcessorEditor()
{
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

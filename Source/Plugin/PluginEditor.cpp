#include "PluginProcessor.h"
#include "PluginEditor.h"
#include <fstream>

// Forward declarations from extracted modules
std::optional<juce::WebBrowserComponent::Resource> pluginResourceProvider (const juce::String& url);
juce::WebBrowserComponent::Options addPluginNativeFunctions (juce::WebBrowserComponent::Options opts,
                                                              ABDEepAudioProcessor& audioProcessor);

ABDEepAudioProcessorEditor::ABDEepAudioProcessorEditor (ABDEepAudioProcessor& p)
    : AudioProcessorEditor (&p), audioProcessor (p)
{

    // Build WebBrowserComponent options chain
    auto options = juce::WebBrowserComponent::Options{}
        .withBackend (juce::WebBrowserComponent::Options::Backend::webview2)
        .withNativeIntegrationEnabled (true)
        .withWinWebView2Options (juce::WebBrowserComponent::Options::WinWebView2()
            .withUserDataFolder (juce::File::getSpecialLocation (juce::File::tempDirectory)
                .getChildFile ("ABD_Eep_WebView2")))
        .withResourceProvider (pluginResourceProvider);

    // Register all native bridge functions
    options = addPluginNativeFunctions (std::move (options), audioProcessor);

    webComponent = std::make_unique<juce::WebBrowserComponent> (options);
    addAndMakeVisible (*webComponent);

    // Load main page from resource provider root (JUCE 8)
    webComponent->goToURL (juce::WebBrowserComponent::getResourceProviderRoot());

    // Start timer to sync engine note events → WebUI at 30 Hz
    startTimerHz (30);

    // Liberar foco de teclado para que el DAW pueda recibir atajos (Espacio = Play/Stop)
    setWantsKeyboardFocus (false);

    // Callback para notificar a la WebUI cuando el DAW restaura un proyecto
    audioProcessor.onStateRestored = [this]()
    {
        if (webComponent != nullptr)
        {
            webComponent->evaluateJavascript (
                "if (typeof window._onStateRestored === 'function')"
                "  window._onStateRestored();"
                "else"
                "  console.log('[WebUI] State restored — _onStateRestored not registered');"
            );
        }
    };

    setSize (1200, 768);
}

ABDEepAudioProcessorEditor::~ABDEepAudioProcessorEditor()
{
    stopTimer();
    // Prevenir dangling callback si setStateInformation se invoca tras destruir el editor
    audioProcessor.onStateRestored = nullptr;
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

    // One-shot diagnostic: verify JUCE 8 native integration is working
    static int testCounter = 0;
    if (++testCounter == 90) // ~3 seconds after startup
    {
        webComponent->evaluateJavascript (
            "var info = 'juce=' + typeof window.juce"
            " + ' __JUCE__=' + typeof window.__JUCE__"
            " + ' backend=' + (window.__JUCE__ && window.__JUCE__.backend ? 'yes' : 'no')"
            " + ' logFn=' + (window.juce && typeof window.juce.logFromJS);"
            "console.log('[Diag] ' + info);"
        );
    }

    // Read all active notes from voice snapshot (thread-safe)
    juce::String currentNotes = engine.getActiveNotesJSON();

    // Only send to JS when changed to avoid evaluateJavascript spam
    if (currentNotes != lastActiveNotesJSON)
    {
        lastActiveNotesJSON = currentNotes;
        auto js = juce::String ("window._handleEngineActiveNotes(") + currentNotes + ")" + ";";
        webComponent->evaluateJavascript (js);
    }

    // Stream real-time voice states for all 12 voices at 30 Hz (only on change)
    juce::String voiceStates = "[";
    for (int i = 0; i < 12; ++i)
    {
        if (i > 0) voiceStates += ",";
        voiceStates += (engine.isVoiceActive (i) ? "true" : "false");
    }
    voiceStates += "]";

    if (voiceStates != lastVoiceStatesJSON)
    {
        lastVoiceStatesJSON = voiceStates;
        webComponent->evaluateJavascript (
            "if (typeof window._handleVoiceStates === 'function') window._handleVoiceStates("
            + voiceStates + ");");
    }
}

cmake_minimum_required(VERSION 3.22)

project(ABDEep VERSION 0.1.0)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# --- Configuración de Ruta JUCE ---
if(NOT DEFINED JUCE_PATH)
    if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/JUCE")
        set(JUCE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/JUCE")
    elseif(EXISTS "d:/desarrollos/ABDSynths/ABDJUNiO601/JUCE")
        set(JUCE_PATH "d:/desarrollos/ABDSynths/ABDJUNiO601/JUCE")
    elseif(DEFINED ENV{JUCE_PATH})
        set(JUCE_PATH "$ENV{JUCE_PATH}")
    else()
        set(JUCE_PATH "C:/JUCE" CACHE PATH "Path to JUCE")
    endif()
endif()

message(STATUS "Usando JUCE desde: ${JUCE_PATH}")
if(NOT EXISTS "${JUCE_PATH}/CMakeLists.txt")
    message(FATAL_ERROR "JUCE no encontrado en ${JUCE_PATH}. Por favor configura JUCE_PATH.")
endif()

add_subdirectory(${JUCE_PATH} _juce)

# --- Definición de Plugin con JUCE ---
juce_add_plugin(ABDEep
    IS_SYNTH TRUE
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT TRUE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS TRUE
    NEEDS_DIRECT2D TRUE
    PLUGIN_MANUFACTURER_CODE Abda
    PLUGIN_CODE Deep
    FORMATS Standalone VST3
    PRODUCT_NAME "ABD Eep"
    NEEDS_WEBVIEW2 TRUE
)

target_sources(ABDEep PRIVATE
    Source/PluginProcessor.h
    Source/PluginProcessor.cpp
    Source/PluginEditor.h
    Source/PluginEditor.cpp
    Source/ParametersSpec.h
    Source/ParametersSpec.cpp
    Source/BridgeActions.h
    Source/BridgeActions.cpp
    Source/PresetManager.h
    Source/MidiTranslationEngine.h
    Source/DSP/Oscillator.h
    Source/DSP/OSC1.h
    Source/DSP/OSC1.cpp
    Source/DSP/OSC2.h
    Source/DSP/OSC2.cpp
    Source/DSP/ModulationMatrix.h
    Source/DSP/ModulationMatrix.cpp
    Source/DSP/Envelope.h
    Source/DSP/Envelope.cpp
    Source/DSP/LFO.h
    Source/DSP/LFO.cpp
    Source/DSP/Filter.h
    Source/DSP/Filter.cpp
    Source/DSP/SynthVoice.h
    Source/DSP/SynthVoice.cpp
    Source/DSP/SynthEngine.h
    Source/DSP/SynthEngine.cpp
    Source/DSP/DriftEngine.h
    Source/DSP/DriftEngine.cpp
    Source/DSP/FX/FXBase.h
    Source/DSP/FX/FXSlot.h
    Source/DSP/FX/FXSlot.cpp
    Source/DSP/FX/FXDelay.h
    Source/DSP/FX/FXDelay.cpp
    Source/DSP/FX/FXChorus.h
    Source/DSP/FX/FXChorus.cpp
    Source/DSP/FX/FXSimpleReverb.h
    Source/DSP/FX/FXSimpleReverb.cpp
    Source/DSP/FX/FXFlanger.h
    Source/DSP/FX/FXFlanger.cpp
    Source/DSP/FX/FXPhaser.h
    Source/DSP/FX/FXPhaser.cpp
    Source/DSP/FX/FXRotarySpeaker.h
    Source/DSP/FX/FXRotarySpeaker.cpp
    Source/DSP/FX/FXAutoPan.h
    Source/DSP/FX/FXAutoPan.cpp
    Source/DSP/FX/FXRackAmp.h
    Source/DSP/FX/FXRackAmp.cpp
    Source/DSP/FX/FXMultiBandDist.h
    Source/DSP/FX/FXMultiBandDist.cpp
    Source/DSP/FX/FXEdison.h
    Source/DSP/FX/FXEdison.cpp
    Source/DSP/FX/FXMoodFilter.h
    Source/DSP/FX/FXMoodFilter.cpp
    Source/DSP/FX/FXEnhancer.h
    Source/DSP/FX/FXEnhancer.cpp
    Source/DSP/FX/FXSimpleComp.h
    Source/DSP/FX/FXSimpleComp.cpp
    Source/DSP/FX/FXNoiseGate.h
    Source/DSP/FX/FXNoiseGate.cpp
    Source/DSP/FX/FXPitchShifter.h
    Source/DSP/FX/FXPitchShifter.cpp
    Source/DSP/FX/FXDecimDelay.h
    Source/DSP/FX/FXDecimDelay.cpp
    Source/DSP/FX/FXTapeDelay.h
    Source/DSP/FX/FXTapeDelay.cpp
    Source/DSP/FX/FXModDelayRev.h
    Source/DSP/FX/FXModDelayRev.cpp
    Source/DSP/FX/FXEngine.h
    Source/DSP/FX/FXEngine.cpp
    Source/DSP/FX/FXUnitTests.cpp
)

# Enlazar las librerías necesarias de JUCE
target_link_libraries(ABDEep PRIVATE
    juce::juce_audio_utils
    juce::juce_audio_processors
    juce::juce_gui_extra
    juce::juce_recommended_config_flags
    juce::juce_recommended_lto_flags
    juce::juce_recommended_warning_flags
)

# Configurar directorios de inclusión
target_include_directories(ABDEep PRIVATE
    Source
    "${CMAKE_CURRENT_BINARY_DIR}/ABDEep_artefacts/JuceLibraryCode"
)

# Generar cabeceras de JUCE automáticamente
juce_generate_juce_header(ABDEep)

# Definición de símbolos del preprocesador
target_compile_definitions(ABDEep PRIVATE
    JUCE_USE_WIN_WEBVIEW2=1
    JUCE_USE_WIN_WEBVIEW2_WITH_STATIC_LINKING=1
    JUCE_VST3_CAN_REPLACE_VST2=0
)

# =============================================================================
# Headless Unit Test Runner
# =============================================================================
# Compila y enlaza los mismos archivos FX que el plugin, pero como una
# aplicación de consola que ejecuta juce::UnitTestRunner::runAllTests()
# sin inicializar audio ni UI.

juce_add_console_app(ABDEep_UnitTests
    PRODUCT_NAME "ABD Eep Unit Tests"
)

# Agregar las mismas fuentes FX + el runner + ParametersSpec
# (necesario para que los UnitTest estáticos se registren y linkeen)
target_sources(ABDEep_UnitTests PRIVATE
    Source/FXUnitTestsRunner.cpp
    # FX Engine sources (needed by static UnitTest instances)
    Source/DSP/FX/FXBase.h
    Source/DSP/FX/FXSlot.h
    Source/DSP/FX/FXSlot.cpp
    Source/DSP/FX/FXDelay.h
    Source/DSP/FX/FXDelay.cpp
    Source/DSP/FX/FXChorus.h
    Source/DSP/FX/FXChorus.cpp
    Source/DSP/FX/FXSimpleReverb.h
    Source/DSP/FX/FXSimpleReverb.cpp
    Source/DSP/FX/FXFlanger.h
    Source/DSP/FX/FXFlanger.cpp
    Source/DSP/FX/FXPhaser.h
    Source/DSP/FX/FXPhaser.cpp
    Source/DSP/FX/FXRotarySpeaker.h
    Source/DSP/FX/FXRotarySpeaker.cpp
    Source/DSP/FX/FXAutoPan.h
    Source/DSP/FX/FXAutoPan.cpp
    Source/DSP/FX/FXRackAmp.h
    Source/DSP/FX/FXRackAmp.cpp
    Source/DSP/FX/FXMultiBandDist.h
    Source/DSP/FX/FXMultiBandDist.cpp
    Source/DSP/FX/FXEdison.h
    Source/DSP/FX/FXEdison.cpp
    Source/DSP/FX/FXMoodFilter.h
    Source/DSP/FX/FXMoodFilter.cpp
    Source/DSP/FX/FXEnhancer.h
    Source/DSP/FX/FXEnhancer.cpp
    Source/DSP/FX/FXSimpleComp.h
    Source/DSP/FX/FXSimpleComp.cpp
    Source/DSP/FX/FXNoiseGate.h
    Source/DSP/FX/FXNoiseGate.cpp
    Source/DSP/FX/FXPitchShifter.h
    Source/DSP/FX/FXPitchShifter.cpp
    Source/DSP/FX/FXDecimDelay.h
    Source/DSP/FX/FXDecimDelay.cpp
    Source/DSP/FX/FXTapeDelay.h
    Source/DSP/FX/FXTapeDelay.cpp
    Source/DSP/FX/FXModDelayRev.h
    Source/DSP/FX/FXModDelayRev.cpp
    Source/DSP/FX/FXEngine.h
    Source/DSP/FX/FXEngine.cpp
    Source/DSP/FX/FXUnitTests.cpp
    Source/ParametersSpec.h
    Source/ParametersSpec.cpp
    # SynthEngine Unit Tests
    Source/DSP/SynthEngineUnitTests.cpp
    # SynthEngine DSP sources (needed for SynthEngineUnitTests static instance)
    Source/DSP/SynthEngine.h
    Source/DSP/SynthEngine.cpp
    Source/DSP/SynthVoice.h
    Source/DSP/SynthVoice.cpp
    Source/DSP/Oscillator.h
    Source/DSP/OSC1.h
    Source/DSP/OSC1.cpp
    Source/DSP/OSC2.h
    Source/DSP/OSC2.cpp
    Source/DSP/Envelope.h
    Source/DSP/Envelope.cpp
    Source/DSP/LFO.h
    Source/DSP/LFO.cpp
    Source/DSP/Filter.h
    Source/DSP/Filter.cpp
    Source/DSP/DriftEngine.h
    Source/DSP/DriftEngine.cpp
    Source/DSP/ModulationMatrix.h
    Source/DSP/ModulationMatrix.cpp
)

target_link_libraries(ABDEep_UnitTests PRIVATE
    juce::juce_audio_utils
    juce::juce_audio_processors
    juce::juce_gui_extra
    juce::juce_recommended_config_flags
    juce::juce_recommended_warning_flags
)

target_include_directories(ABDEep_UnitTests PRIVATE
    Source
    "${CMAKE_CURRENT_BINARY_DIR}/ABDEep_artefacts/JuceLibraryCode"
)

juce_generate_juce_header(ABDEep_UnitTests)

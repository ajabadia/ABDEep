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

# Definición de símbolos del preprocesador
target_compile_definitions(ABDEep PRIVATE
    JUCE_USE_WIN_WEBVIEW2=1
    JUCE_USE_WIN_WEBVIEW2_WITH_STATIC_LINKING=1
)

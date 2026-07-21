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

target_link_libraries(ABDEep PRIVATE
    abdeep_core
    juce::juce_dsp
)

target_sources(ABDEep PRIVATE
    Source/Plugin/BridgeActions.h
    Source/Plugin/BridgeActions.cpp
    Source/Plugin/PluginProcessor.h
    Source/Plugin/PluginProcessor.cpp
    Source/Plugin/PluginEditor.h
    Source/Plugin/PluginEditor.cpp
    Source/Calibration/AudioABRecorder.h
    Source/Calibration/AudioABRecorder.cpp
    Source/Core/PresetManager.h
    Source/Core/MidiTranslationEngine.h
)

# ============================================================
# abdeep_core (Librería estática con el motor DSP y especificación de parámetros)
# ============================================================
add_library(abdeep_core STATIC
    Source/Core/ParametersSpec.h
    Source/Core/ParametersSpec.cpp
    Source/Core/DiagnosticSnapshots.h
    Source/Core/PatchDiffTypes.h
    Source/Core/RoundTripValidator.h
    Source/Core/RoundTripValidator.cpp
    Source/Calibration/AudioABComparator.h
    Source/Calibration/AudioABComparator.cpp
    Source/Calibration/AudioABVerdictEngine.h
    Source/Calibration/AudioABVerdictEngine.cpp
    Source/DSP/Oscillator.h
    Source/DSP/DSPHelpers.h
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
    Source/DSP/JunoVCF_ZDF.h
    Source/DSP/JunoVCF_ZDF.cpp
    Source/DSP/VcfVoicing.h
    Source/DSP/JunoHPF.h
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
    Source/DSP/FX/FXMidasEQ.h
    Source/DSP/FX/FXMidasEQ.cpp
    Source/DSP/FX/FXHybridReverb.h
    Source/DSP/FX/FXHybridReverb.cpp
    Source/DSP/FX/FXMultiTapDelay.h
    Source/DSP/FX/FXMultiTapDelay.cpp
    Source/DSP/FX/FXChorusD.h
    Source/DSP/FX/FXChorusD.cpp
    Source/DSP/FX/FXFairComp.h
    Source/DSP/FX/FXFairComp.cpp
    Source/DSP/FX/FXEngine.h
    Source/DSP/FX/FXEngine.cpp
)

target_sources(abdeep_core PRIVATE
    Source/Core/CalibrationSpec.h
    Source/Core/CalibrationSpec.cpp
)

set(abdeep_core_gen_dir "${CMAKE_CURRENT_BINARY_DIR}/abdeep_core_artefacts/JuceLibraryCode")
set(abdeep_core_juce_header "${abdeep_core_gen_dir}/JuceHeader.h")

add_custom_command(OUTPUT "${abdeep_core_juce_header}"
    COMMAND "${CMAKE_COMMAND}" -E make_directory "${abdeep_core_gen_dir}"
    COMMAND juce::juceaide header "${CMAKE_CURRENT_BINARY_DIR}/ABDEep_artefacts/JuceLibraryCode/\$<CONFIG>/Defs.txt" "${abdeep_core_juce_header}"
    COMMENT "Generating JuceHeader.h for abdeep_core"
    VERBATIM)

target_sources(abdeep_core PRIVATE "${abdeep_core_juce_header}")

target_include_directories(abdeep_core PUBLIC
    Source
    Source/Core
    Source/DSP
    "${abdeep_core_gen_dir}"
)
target_link_libraries(abdeep_core PUBLIC
    juce::juce_audio_processors
    juce::juce_audio_utils
    juce::juce_gui_extra
    juce::juce_dsp
)

# Enlazar las librerías necesarias de JUCE
target_link_libraries(ABDEep PRIVATE
    abdeep_core
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
    Source/Plugin
    Source/Core
    "${CMAKE_CURRENT_BINARY_DIR}/ABDEep_artefacts/JuceLibraryCode"
)

# Generar cabeceras de JUCE automáticamente
juce_generate_juce_header(ABDEep)

# --- Build mode selection (DEEP_TARGET_MODEL) ---
# 0 = MIDI Controller, 1 = Classic (DeepMind Clone), 2 = Enhanced (Expanded Synthesis)
# CACHE STRING allows -DEEP_TARGET_MODEL=N on command line to override the default (0)
set(DEEP_TARGET_MODEL 0 CACHE STRING "Build target model: 0=MIDI Controller, 1=Classic, 2=Enhanced")

if(DEEP_TARGET_MODEL EQUAL 0)
    set(EEP_MODE_FLAG "EEP_MODE_MIDI_CONTROLLER")
    set(EEP_MODE_NAME "MIDI Controller")
elseif(DEEP_TARGET_MODEL EQUAL 1)
    set(EEP_MODE_FLAG "EEP_MODE_CLASSIC")
    set(EEP_MODE_NAME "Classic (DeepMind Clone)")
elseif(DEEP_TARGET_MODEL EQUAL 2)
    set(EEP_MODE_FLAG "EEP_MODE_ENHANCED")
    set(EEP_MODE_NAME "Enhanced (Expanded Synthesis)")
else()
    message(FATAL_ERROR "Invalid DEEP_TARGET_MODEL=${DEEP_TARGET_MODEL}. Must be 0, 1, or 2.")
endif()

message(STATUS "Build mode: ${EEP_MODE_NAME} (DEEP_TARGET_MODEL=${DEEP_TARGET_MODEL})")
message(STATUS "Preprocessor define: ${EEP_MODE_FLAG}")

# Definición de símbolos del preprocesador — plugin
target_compile_definitions(ABDEep PRIVATE
    JUCE_USE_WIN_WEBVIEW2=1
    JUCE_USE_WIN_WEBVIEW2_WITH_STATIC_LINKING=1
    JUCE_VST3_CAN_REPLACE_VST2=0
    ${EEP_MODE_FLAG}=1
    DEEP_TARGET_MODEL=${DEEP_TARGET_MODEL}
)

target_compile_definitions(abdeep_core PRIVATE
    ${EEP_MODE_FLAG}=1
    DEEP_TARGET_MODEL=${DEEP_TARGET_MODEL}
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
    Source/Tools/UnitTests/FXUnitTestsRunner.cpp
    Source/Tools/UnitTests/SynthEngineUnitTests.cpp
    Source/Tools/UnitTests/AudioABComparatorUnitTests.cpp
    Source/DSP/FX/FXUnitTests.cpp
)

target_link_libraries(ABDEep_UnitTests PRIVATE
    abdeep_core
    juce::juce_audio_utils
    juce::juce_audio_processors
    juce::juce_gui_extra
    juce::juce_dsp
    juce::juce_recommended_config_flags
    juce::juce_recommended_warning_flags
)

target_include_directories(ABDEep_UnitTests PRIVATE
    Source
    "${CMAKE_CURRENT_BINARY_DIR}/ABDEep_artefacts/JuceLibraryCode"
)

# Unit tests always compile with DEEP_TARGET_MODEL=2 (Enhanced) for full coverage
target_compile_definitions(ABDEep_UnitTests PRIVATE
    EEP_MODE_ENHANCED=1
    DEEP_TARGET_MODEL=2
)

juce_generate_juce_header(ABDEep_UnitTests)

# =============================================================================
# Standalone Calibration Lab App (Enhanced mode only)
# =============================================================================
if(DEEP_TARGET_MODEL EQUAL 2)
    juce_add_gui_app(ABDEepCalibrationLab
        PRODUCT_NAME "ABD Eep Calibration Lab"
        BUNDLE_ID com.abd.abdeep.calibrationlab
    )

    target_sources(ABDEepCalibrationLab PRIVATE
        Source/Tools/CalibrationLab/CalibrationLabMain.cpp
        Source/Tools/CalibrationLab/CalibrationLabWindow.h
        Source/Tools/CalibrationLab/CalibrationLabWindow.cpp
        Source/Tools/CalibrationLab/CalibrationLabContentComponent.h
        Source/Tools/CalibrationLab/CalibrationLabContentComponent.cpp
        Source/Tools/CalibrationLab/ParamTraceTableModel.h
        Source/Tools/CalibrationLab/ParamTraceTableModel.cpp
        Source/Tools/CalibrationLab/ParamTraceViewComponent.h
        Source/Tools/CalibrationLab/ParamTraceViewComponent.cpp
        Source/Tools/CalibrationLab/PatchDiffViewComponent.h
        Source/Tools/CalibrationLab/PatchDiffViewComponent.cpp
        Source/Tools/CalibrationLab/RoundTripViewComponent.h
        Source/Tools/CalibrationLab/RoundTripViewComponent.cpp
        Source/Tools/CalibrationLab/LiveValidationViewComponent.h
        Source/Tools/CalibrationLab/LiveValidationViewComponent.cpp
        Source/Tools/CalibrationLab/AudioABValidationViewComponent.h
        Source/Tools/CalibrationLab/AudioABValidationViewComponent.cpp
        Source/Tools/CalibrationLab/CalibrationEditorViewComponent.h
        Source/Tools/CalibrationLab/CalibrationEditorViewComponent.cpp
    )

    target_include_directories(ABDEepCalibrationLab PRIVATE
        Source
        "${CMAKE_CURRENT_BINARY_DIR}/ABDEepCalibrationLab_artefacts/JuceLibraryCode"
    )

    target_link_libraries(ABDEepCalibrationLab PRIVATE
        abdeep_core
        juce::juce_audio_utils
        juce::juce_audio_processors
        juce::juce_gui_extra
        juce::juce_dsp
        juce::juce_recommended_config_flags
        juce::juce_recommended_warning_flags
    )

    target_compile_definitions(ABDEepCalibrationLab PRIVATE
        EEP_MODE_ENHANCED=1
        DEEP_TARGET_MODEL=2
    )

    juce_generate_juce_header(ABDEepCalibrationLab)
endif()

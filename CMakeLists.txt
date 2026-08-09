cmake_minimum_required(VERSION 3.22)
project(ABDEep VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(JUCE_USE_WIN_WEBVIEW2 ON CACHE BOOL "Use WebView2 on Windows" FORCE)

# ============================================================
# JUCE Location
# ============================================================
if(NOT DEFINED JUCE_PATH)
    if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/JUCE")
        set(JUCE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/JUCE")
    elseif(DEFINED ENV{JUCE_PATH})
        set(JUCE_PATH "$ENV{JUCE_PATH}")
    else()
        # Default fallback
        set(JUCE_PATH "C:/JUCE")
    endif()
endif()

# Formally import JUCE 8 framework
if(EXISTS "${JUCE_PATH}/CMakeLists.txt")
    add_subdirectory(${JUCE_PATH} juce)
else()
    message(FATAL_ERROR "JUCE not found at ${JUCE_PATH}. Please specify JUCE_PATH.")
endif()

# ============================================================
# Source directories
# ============================================================
set(SRC_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/Source")

# ============================================================
# DeepMind target model: 0=Classic/MIDI, 2=Enhanced/Pro
# ============================================================
set(DEEP_TARGET_MODEL 2 CACHE STRING "Build target model: 0=Classic, 2=Enhanced")
set(EEP_MODE_ENHANCED 1)

# ============================================================
# Parameter Registry — schema v1 (artefactos generados, Fase 1)
# ============================================================
# Regeneración automática cuando cambian las fuentes (esquema declarativo).
# El generador valida (ids duplicados, rangos incompatibles, NRPNs colisionados)
# antes de emitir .gen.js / .gen.h / .gen.cpp / data.json.
set(REGISTRY_SCHEMA  "${CMAKE_CURRENT_SOURCE_DIR}/schemas/parameter-registry.json")
set(REGISTRY_SPEC    "${CMAKE_CURRENT_SOURCE_DIR}/resources/parameters_spec.json")
set(REGISTRY_BRIDGE  "${CMAKE_CURRENT_SOURCE_DIR}/WebUI/js/bridge-param-maps.js")
set(REGISTRY_BYTEMAP "${CMAKE_CURRENT_SOURCE_DIR}/WebUI/js/byte_map_data.js")
set(REGISTRY_GEN     "${CMAKE_CURRENT_SOURCE_DIR}/scripts/registry_generator.js")

set(REGISTRY_OUT_DATA "${CMAKE_CURRENT_SOURCE_DIR}/schemas/parameter-registry.data.json")
set(REGISTRY_OUT_JS   "${CMAKE_CURRENT_SOURCE_DIR}/WebUI/js/registry.gen.js")
set(REGISTRY_OUT_H    "${CMAKE_CURRENT_SOURCE_DIR}/Source/Core/ParameterRegistry.gen.h")
set(REGISTRY_OUT_CPP  "${CMAKE_CURRENT_SOURCE_DIR}/Source/Core/ParameterRegistry.gen.cpp")

find_program(ABDEEP_NODE_EXECUTABLE node)
if(ABDEEP_NODE_EXECUTABLE)
    add_custom_command(
        OUTPUT ${REGISTRY_OUT_DATA} ${REGISTRY_OUT_JS} ${REGISTRY_OUT_H} ${REGISTRY_OUT_CPP}
        COMMAND ${ABDEEP_NODE_EXECUTABLE} ${REGISTRY_GEN}
        DEPENDS
            ${REGISTRY_SCHEMA}
            ${REGISTRY_SPEC}
            ${REGISTRY_BRIDGE}
            ${REGISTRY_BYTEMAP}
            ${REGISTRY_GEN}
        WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
        COMMENT "Generando ParameterRegistry (schema v1)..."
        VERBATIM
    )
else()
    message(WARNING "node no encontrado — se usarán los artefactos .gen commiteados (schema v1)")
endif()

# ============================================================
# ABDEEP_CORE_SOURCES — DSP + Core + Calibration Source Files
# ============================================================
set(ABDEEP_CORE_SOURCES

    # ── Core ──
    ${SRC_ROOT}/Core/ParameterRegistry.gen.h
    ${SRC_ROOT}/Core/ParameterRegistry.gen.cpp
    ${SRC_ROOT}/Core/ParametersSpec.cpp
    ${SRC_ROOT}/Core/ParametersSpec_Synth.cpp
    ${SRC_ROOT}/Core/ParametersSpec_Voice.cpp
    ${SRC_ROOT}/Core/ParametersSpec_ModMatrix.cpp
    ${SRC_ROOT}/Core/ParametersSpec_SeqArp.cpp
    ${SRC_ROOT}/Core/ParametersSpec_FX.cpp
    ${SRC_ROOT}/Core/CalibrationSpec.cpp
    ${SRC_ROOT}/Core/CalibrationSpec_Serialization.cpp
    ${SRC_ROOT}/Core/RoundTripValidator.cpp

    # ── Oscillators ──
    ${SRC_ROOT}/DSP/OSC1.cpp
    ${SRC_ROOT}/DSP/OSC2.cpp

    # ── Filters ──
    ${SRC_ROOT}/DSP/Filter.cpp
    ${SRC_ROOT}/DSP/MoogLadderVCF.cpp
    ${SRC_ROOT}/DSP/KorgMS20VCF.cpp
    ${SRC_ROOT}/DSP/JunoVCF_ZDF.cpp
    ${SRC_ROOT}/DSP/JunoVCF_ZDF_Process.cpp

    # ── Modulators ──
    ${SRC_ROOT}/DSP/Envelope.cpp
    ${SRC_ROOT}/DSP/LFO.cpp
    ${SRC_ROOT}/DSP/ModulationMatrix.cpp
    ${SRC_ROOT}/DSP/DriftEngine.cpp

    # ── Voice & Engine ──
    ${SRC_ROOT}/DSP/SynthVoice.cpp
    ${SRC_ROOT}/DSP/SynthVoice_Lifecycle.cpp
    ${SRC_ROOT}/DSP/SynthVoice_Diagnostics.cpp
    ${SRC_ROOT}/DSP/SynthVoice_Pitch.cpp
    ${SRC_ROOT}/DSP/SynthVoice_Process.cpp
    ${SRC_ROOT}/DSP/SynthVoice_Filter.cpp
    ${SRC_ROOT}/DSP/SynthVoice_VCA.cpp
    ${SRC_ROOT}/DSP/SynthEngine.cpp
    ${SRC_ROOT}/DSP/SynthEngine_VoiceManager.cpp
    ${SRC_ROOT}/DSP/SynthEngine_Parameters.cpp
    ${SRC_ROOT}/DSP/SynthEngine_MIDI.cpp
    ${SRC_ROOT}/DSP/SynthEngine_Snapshot.cpp

    # ── FX Slots ──
    ${SRC_ROOT}/DSP/FX/FXSlot.cpp
    ${SRC_ROOT}/DSP/FX/FXSlot_Factory.cpp
    ${SRC_ROOT}/DSP/FX/FXEngine.cpp
    ${SRC_ROOT}/DSP/FX/FXEngine_Routing.cpp

    # ── FX Effects (Standard) ──
    ${SRC_ROOT}/DSP/FX/FXDelay.cpp
    ${SRC_ROOT}/DSP/FX/FXChorus.cpp
    ${SRC_ROOT}/DSP/FX/FXSimpleReverb.cpp
    ${SRC_ROOT}/DSP/FX/FXSimpleReverb_Process.cpp
    ${SRC_ROOT}/DSP/FX/FXFlanger.cpp
    ${SRC_ROOT}/DSP/FX/FXPhaser.cpp
    ${SRC_ROOT}/DSP/FX/FXRotarySpeaker.cpp
    ${SRC_ROOT}/DSP/FX/FXAutoPan.cpp
    ${SRC_ROOT}/DSP/FX/FXRackAmp.cpp
    ${SRC_ROOT}/DSP/FX/FXMultiBandDist.cpp
    ${SRC_ROOT}/DSP/FX/FXEdison.cpp
    ${SRC_ROOT}/DSP/FX/FXMoodFilter.cpp
    ${SRC_ROOT}/DSP/FX/FXEnhancer.cpp
    ${SRC_ROOT}/DSP/FX/FXSimpleComp.cpp
    ${SRC_ROOT}/DSP/FX/FXNoiseGate.cpp
    ${SRC_ROOT}/DSP/FX/FXPitchShifter.cpp
    ${SRC_ROOT}/DSP/FX/FXDecimDelay.cpp
    ${SRC_ROOT}/DSP/FX/FXTapeDelay.cpp
    ${SRC_ROOT}/DSP/FX/FXModDelayRev.cpp
    ${SRC_ROOT}/DSP/FX/FXMidasEQ.cpp
    ${SRC_ROOT}/DSP/FX/FXHybridReverb.cpp
    ${SRC_ROOT}/DSP/FX/FXMultiTapDelay.cpp
    ${SRC_ROOT}/DSP/FX/FXChorusD.cpp
    ${SRC_ROOT}/DSP/FX/FXFairComp.cpp

    # ── FX Effects (Advanced — IDs 36..56) ──
    ${SRC_ROOT}/DSP/FX/FXRolandBBDChorus.cpp
    ${SRC_ROOT}/DSP/FX/FXSolinaEnsemble.cpp
    ${SRC_ROOT}/DSP/FX/FXRingModulator.cpp
    ${SRC_ROOT}/DSP/FX/FXSpaceEchoRE201.cpp
    ${SRC_ROOT}/DSP/FX/FXAnalogTapeDelay.cpp
    ${SRC_ROOT}/DSP/FX/FXShimmerDelay.cpp
    ${SRC_ROOT}/DSP/FX/FXGranularDelay.cpp
    ${SRC_ROOT}/DSP/FX/FXPatternFreeze.cpp
    ${SRC_ROOT}/DSP/FX/FXDuckingDelay.cpp
    ${SRC_ROOT}/DSP/FX/FXSpectralDelay.cpp
    ${SRC_ROOT}/DSP/FX/FXFrequencyShifter.cpp
    ${SRC_ROOT}/DSP/FX/FXResonator.cpp
    ${SRC_ROOT}/DSP/FX/FXCombulator.cpp
    ${SRC_ROOT}/DSP/FX/FXVocoder.cpp
    ${SRC_ROOT}/DSP/FX/FXVocoder_Filter.cpp
    ${SRC_ROOT}/DSP/FX/FXVocoder_Process.cpp
    ${SRC_ROOT}/DSP/FX/FXOversamplingDistortion.cpp
    ${SRC_ROOT}/DSP/FX/FXWaveShaper.cpp
    ${SRC_ROOT}/DSP/FX/FXFDNReverb.cpp
    ${SRC_ROOT}/DSP/FX/FXZitaReverb.cpp
    ${SRC_ROOT}/DSP/FX/FXNimbus.cpp
    ${SRC_ROOT}/DSP/FX/FXBonsai.cpp
    ${SRC_ROOT}/DSP/FX/FXTreemonster.cpp

    # ── Calibration ──
    ${SRC_ROOT}/Calibration/AudioABComparator.cpp
    ${SRC_ROOT}/Calibration/AudioABComparator_Alignment.cpp
    ${SRC_ROOT}/Calibration/AudioABComparator_Spectral.cpp
    ${SRC_ROOT}/Calibration/AudioABRecorder.cpp
    ${SRC_ROOT}/Calibration/AudioABRecorder_Process.cpp
    ${SRC_ROOT}/Calibration/AudioABVerdictEngine.cpp
)

# Configuration for abdeep_core has been removed since it is now merged into ABDEep_rc_lib

# ============================================================
# ABDEEP_RC_LIB_SOURCES — Shared Code Source Files
# ============================================================
set(ABDEEP_RC_LIB_SOURCES
    # ── Core & DSP (Merged) ──
    ${ABDEEP_CORE_SOURCES}

    # ── Plugin Sources ──
    ${SRC_ROOT}/Plugin/PluginProcessor.cpp
    ${SRC_ROOT}/Plugin/PluginEditor.cpp
    ${SRC_ROOT}/Plugin/PluginEditor_NativeFunctions.cpp
    ${SRC_ROOT}/Plugin/PluginEditor_ResourceProvider.cpp

    # ── Bridge Actions ──
    ${SRC_ROOT}/Plugin/BridgeActions.cpp
    ${SRC_ROOT}/Plugin/BridgeActions_Params.cpp
    ${SRC_ROOT}/Plugin/BridgeActions_MIDI.cpp
    ${SRC_ROOT}/Plugin/BridgeActions_State.cpp
    ${SRC_ROOT}/Plugin/BridgeActions_File.cpp
    ${SRC_ROOT}/Plugin/BridgeActions_Calibration.cpp
    ${SRC_ROOT}/Plugin/BridgeActions_Calibration_Compare.cpp
)

# ============================================================
# WebUI Binary Data Target (Recursively gathered)
# ============================================================
file(GLOB_RECURSE WEBUI_FILES 
    "WebUI/*.html"
    "WebUI/*.css"
    "WebUI/*.js"
    "WebUI/*.png"
    "WebUI/*.jpg"
    "WebUI/*.ttf"
    "WebUI/*.json"
)

juce_add_binary_data(ABDEep_WebUI SOURCES
    ${WEBUI_FILES}
)

# ============================================================
# Plugin Targets (Standalone + VST3)
# ============================================================
if(EXISTS "${JUCE_PATH}/extras/Build/CMake/JUCEUtils.cmake")

    juce_add_plugin(ABDEep_Standalone
        PRODUCT_NAME "ABD Eep"
        PLUGIN_MANUFACTURER_CODE "Abda"
        PLUGIN_CODE "Deep"
        PLUGIN_MANUFACTURER "ABDSynths"
        PLUGIN_MANUFACTURER_WEBSITE ""
        PLUGIN_MANUFACTURER_EMAIL ""
        PLUGIN_IS_SYNTH TRUE
        PLUGIN_PRODUCES_MIDI_OUTPUT TRUE
        PLUGIN_WANTS_MIDI_INPUT TRUE
        PLUGIN_EDITOR_REQUIRES_KEYBOARD_FOCUS TRUE
        VERSION "0.1.0"
        VERSION_STRING "0.1.0"
        FORMATS Standalone VST3
        PLUGIN_CATEGORY "Instrument|Synth"
        NEEDS_WEBVIEW2 TRUE
    )

    # Generate JuceHeader.h BEFORE target_sources (required by AGENTS.md §1.2)
    juce_generate_juce_header(ABDEep_Standalone)

    # Inject all common sources directly into the target
    target_sources(ABDEep_Standalone PRIVATE ${ABDEEP_RC_LIB_SOURCES})

    # Include all needed folders for Standalone
    target_include_directories(ABDEep_Standalone PRIVATE
        ${SRC_ROOT}
        ${SRC_ROOT}/Plugin
        ${SRC_ROOT}/Core
        ${SRC_ROOT}/DSP
        ${SRC_ROOT}/Calibration
    )

    # Link DSP, Devices, Utils, and WebUI binary data modules
    target_link_libraries(ABDEep_Standalone PRIVATE
        juce::juce_dsp
        juce::juce_audio_devices
        juce::juce_audio_utils
        ABDEep_WebUI
    )

    # Also configure VST3 target (created by juce_add_plugin FORMATS)
    if(TARGET ABDEep_VST3)
        juce_generate_juce_header(ABDEep_VST3)
        target_sources(ABDEep_VST3 PRIVATE ${ABDEEP_RC_LIB_SOURCES})
        target_include_directories(ABDEep_VST3 PRIVATE
            ${SRC_ROOT}
            ${SRC_ROOT}/Plugin
            ${SRC_ROOT}/Core
            ${SRC_ROOT}/DSP
            ${SRC_ROOT}/Calibration
        )
        target_link_libraries(ABDEep_VST3 PRIVATE
            juce::juce_dsp
            juce::juce_audio_devices
            juce::juce_audio_utils
            ABDEep_WebUI
        )
    endif()

endif()

# ============================================================
# Calibration Lab — Standalone GUI App
# ============================================================
if(EXISTS "${JUCE_PATH}/extras/Build/CMake/JUCEUtils.cmake")

    juce_add_gui_app(ABDEepCalibrationLab
        PRODUCT_NAME "ABD Eep Calibration Lab"
        VERSION "0.1.0"
        NEEDS_WEBVIEW2 TRUE
    )

    juce_generate_juce_header(ABDEepCalibrationLab)

    target_sources(ABDEepCalibrationLab PRIVATE
        ${ABDEEP_CORE_SOURCES}
        ${SRC_ROOT}/Tools/CalibrationLab/CalibrationLabMain.cpp
        ${SRC_ROOT}/Tools/CalibrationLab/CalibrationLabContentComponent.cpp
        ${SRC_ROOT}/Tools/CalibrationLab/CalibrationLabWindow.cpp
        ${SRC_ROOT}/Tools/CalibrationLab/CalibrationEditorViewComponent.cpp
        ${SRC_ROOT}/Tools/CalibrationLab/CalibrationEditorViewComponent_IO.cpp
        ${SRC_ROOT}/Tools/CalibrationLab/CalibrationEditorViewComponent_Meta.cpp
        ${SRC_ROOT}/Tools/CalibrationLab/AudioABValidationViewComponent.cpp
        ${SRC_ROOT}/Tools/CalibrationLab/AudioABValidationViewComponent_Audio.cpp
        ${SRC_ROOT}/Tools/CalibrationLab/AudioABValidationViewComponent_Comparison.cpp
        ${SRC_ROOT}/Tools/CalibrationLab/AudioABValidationViewComponent_SysEx.cpp
        ${SRC_ROOT}/Tools/CalibrationLab/LiveValidationViewComponent.cpp
        ${SRC_ROOT}/Tools/CalibrationLab/LiveValidationViewComponent_Table.cpp
        ${SRC_ROOT}/Tools/CalibrationLab/LiveValidationViewComponent_Validation.cpp
        ${SRC_ROOT}/Tools/CalibrationLab/PatchDiffViewComponent.cpp
        ${SRC_ROOT}/Tools/CalibrationLab/PatchDiffViewComponent_File.cpp
        ${SRC_ROOT}/Tools/CalibrationLab/PatchDiffViewComponent_Table.cpp
        ${SRC_ROOT}/Tools/CalibrationLab/RoundTripViewComponent.cpp
        ${SRC_ROOT}/Tools/CalibrationLab/ParamTraceViewComponent.cpp
        ${SRC_ROOT}/Tools/CalibrationLab/ParamTraceTableModel.cpp
    )

    target_link_libraries(ABDEepCalibrationLab PRIVATE
        juce::juce_dsp
        juce::juce_gui_basics
        juce::juce_gui_extra
        juce::juce_events
        juce::juce_graphics
        juce::juce_data_structures
        juce::juce_audio_basics
        juce::juce_audio_formats
        juce::juce_audio_devices
        juce::juce_audio_utils
        juce::juce_audio_processors
    )

    target_include_directories(ABDEepCalibrationLab PRIVATE
        ${SRC_ROOT}
        ${SRC_ROOT}/Tools/CalibrationLab
        ${SRC_ROOT}/Core
        ${SRC_ROOT}/DSP
        ${SRC_ROOT}/Calibration
        ${CMAKE_CURRENT_BINARY_DIR}/ABDEepCalibrationLab_artefacts/JuceLibraryCode
    )

endif()

# ============================================================
# Unit Tests — Catch2 Console App
# ============================================================
if(EXISTS "${JUCE_PATH}/extras/Build/CMake/JUCEUtils.cmake")

    juce_add_console_app(ABDEep_UnitTests
         PRODUCT_NAME "ABD Eep Unit Tests"
         VERSION "0.1.0"
    )

    juce_generate_juce_header(ABDEep_UnitTests)

    target_sources(ABDEep_UnitTests PRIVATE
        ${ABDEEP_CORE_SOURCES}
        # ── Test Runners ──
        ${SRC_ROOT}/Tools/UnitTests/FXUnitTestsRunner.cpp

        # ── Engine Tests ──
        ${SRC_ROOT}/Tools/UnitTests/SynthEngineUnitTests.cpp
        ${SRC_ROOT}/Tools/UnitTests/SynthEngineUnitTests_Voice.cpp
        ${SRC_ROOT}/Tools/UnitTests/SynthEngineUnitTests_Drift.cpp
        ${SRC_ROOT}/Tools/UnitTests/SynthEngineUnitTests_Pitch.cpp
        ${SRC_ROOT}/Tools/UnitTests/SynthEngineUnitTests_VCF.cpp
        ${SRC_ROOT}/Tools/UnitTests/SynthEngineUnitTests_CalSpec.cpp
        ${SRC_ROOT}/Tools/UnitTests/SynthEngineUnitTests_Panic.cpp
        ${SRC_ROOT}/Tools/UnitTests/SynthEngineUnitTests_Transfer.cpp
        ${SRC_ROOT}/Tools/UnitTests/SynthEngineUnitTests_RapidSweep.cpp
        ${SRC_ROOT}/Tools/UnitTests/SynthEngineUnitTests_MIDITiming.cpp

        # ── Fast-math tolerance tests (Tier 3 candidates) ──
        ${SRC_ROOT}/Tools/UnitTests/FastMathUnitTests.cpp

        # ── FX Tests ──
        ${SRC_ROOT}/DSP/FX/FXUnitTests.cpp
        ${SRC_ROOT}/DSP/FX/FXUnitTests_Standard.cpp
        ${SRC_ROOT}/DSP/FX/FXUnitTests_Advanced.cpp
        ${SRC_ROOT}/DSP/FX/FXUnitTests_Fidelity.cpp

        # ── AudioAB Tests ──
        ${SRC_ROOT}/Tools/UnitTests/AudioABComparatorUnitTests.cpp
    )

    target_link_libraries(ABDEep_UnitTests PRIVATE
        juce::juce_dsp
        juce::juce_gui_basics
        juce::juce_gui_extra
        juce::juce_events
        juce::juce_graphics
        juce::juce_data_structures
        juce::juce_audio_basics
        juce::juce_audio_formats
        juce::juce_audio_devices
        juce::juce_audio_utils
        juce::juce_audio_processors
    )

    target_include_directories(ABDEep_UnitTests PRIVATE
        ${SRC_ROOT}
        ${SRC_ROOT}/DSP
        ${SRC_ROOT}/DSP/FX
        ${SRC_ROOT}/Tools/UnitTests
        ${SRC_ROOT}/Core
        ${SRC_ROOT}/Calibration
        ${CMAKE_CURRENT_BINARY_DIR}/ABDEep_UnitTests_artefacts/JuceLibraryCode
    )

endif()

# ============================================================
# Benchmarks — Headless console app (processBlock timing + allocation audit)
# ============================================================
if(EXISTS "${JUCE_PATH}/extras/Build/CMake/JUCEUtils.cmake")

    juce_add_console_app(ABDEep_Benchmarks
        PRODUCT_NAME "ABD Eep Benchmarks"
        VERSION "0.1.0"
    )

    juce_generate_juce_header(ABDEep_Benchmarks)

    target_sources(ABDEep_Benchmarks PRIVATE
        ${ABDEEP_CORE_SOURCES}
        ${SRC_ROOT}/Tools/Benchmarks/ProcessBlockBenchmark.cpp
    )

    target_link_libraries(ABDEep_Benchmarks PRIVATE
        juce::juce_dsp
        juce::juce_gui_basics
        juce::juce_gui_extra
        juce::juce_events
        juce::juce_graphics
        juce::juce_data_structures
        juce::juce_audio_basics
        juce::juce_audio_formats
        juce::juce_audio_devices
        juce::juce_audio_utils
        juce::juce_audio_processors
    )

    target_include_directories(ABDEep_Benchmarks PRIVATE
        ${SRC_ROOT}
        ${SRC_ROOT}/DSP
        ${SRC_ROOT}/DSP/FX
        ${SRC_ROOT}/Core
        ${SRC_ROOT}/Calibration
        ${CMAKE_CURRENT_BINARY_DIR}/ABDEep_Benchmarks_artefacts/JuceLibraryCode
    )

endif()

# ============================================================
# Global compile definitions
# ============================================================
add_compile_definitions(
    JUCE_GLOBAL_MODULE_SETTINGS_INCLUDED=1
    DEEP_TARGET_MODEL=${DEEP_TARGET_MODEL}
    EEP_MODE_ENHANCED=${EEP_MODE_ENHANCED}
    JUCE_VST3_CAN_REPLACE_VST2=0
)

# WebView2 SOLO en los targets que usan el editor web. Un define global
# (JUCE_USE_WIN_WEBVIEW2) haría que juce_gui_extra.cpp incluyera WebView2.h
# en TODOS los targets — los de consola (UnitTests/Benchmarks) no lo usan
# y CI no tiene instalado el SDK.
foreach(WEBVIEW2_TARGET IN ITEMS ABDEep_Standalone ABDEep_VST3 ABDEepCalibrationLab)
    if(TARGET ${WEBVIEW2_TARGET})
        target_compile_definitions(${WEBVIEW2_TARGET} PRIVATE
            JUCE_USE_WIN_WEBVIEW2=1
            JUCE_USE_WIN_WEBVIEW2_WITH_STATIC_LINKING=1
            JUCE_WEB_BROWSER=1
        )
    endif()
endforeach()

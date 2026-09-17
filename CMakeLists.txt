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
# ABDSharedCode — shared SynthCore module (abd::synth)
# DRY transversal: VoiceAllocator (MS2000-grade steal ladder) shared across
# synths. Local sibling repo when present; FetchContent fallback otherwise.
# Must come after JUCE (module links juce_core/juce_events).
# ============================================================
set(ABDSHARED_CODE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../ABDSharedCode")
# No construir el exe de tests standalone del módulo dentro del build del plugin.
set(ABDSHAREDCODE_BUILD_SYNTHCORE_TESTS OFF)
if(EXISTS "${ABDSHARED_CODE_DIR}/CMakeLists.txt")
    message(STATUS "ABDSharedCode: Using local at ${ABDSHARED_CODE_DIR}")
    add_subdirectory("${ABDSHARED_CODE_DIR}" "${CMAKE_BINARY_DIR}/ABDSharedCode")
else()
    include(FetchContent)
    FetchContent_Declare(
      ABDSharedCode
      GIT_REPOSITORY https://github.com/ajabadia/ABDSharedCode.git
      GIT_TAG        master
    )
    FetchContent_MakeAvailable(ABDSharedCode)
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
# Copy factory calibration.json to build resources folder
# ============================================================
set(CALIBRATION_SOURCE "${CMAKE_CURRENT_SOURCE_DIR}/resources/calibration.json")
set(CALIBRATION_DEST_DIR "${CMAKE_CURRENT_BINARY_DIR}/resources")
set(CALIBRATION_DEST "${CALIBRATION_DEST_DIR}/calibration.json")

add_custom_command(
    OUTPUT ${CALIBRATION_DEST}
    COMMAND ${CMAKE_COMMAND} -E make_directory ${CALIBRATION_DEST_DIR}
    COMMAND ${CMAKE_COMMAND} -E copy_if_different ${CALIBRATION_SOURCE} ${CALIBRATION_DEST}
    DEPENDS ${CALIBRATION_SOURCE}
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    COMMENT "Copiando factory calibration.json a build/resources..."
    VERBATIM
)

add_custom_target(copy_calibration DEPENDS ${CALIBRATION_DEST})

# ============================================================
# ABDEEP_CORE_SOURCES — DSP + Core + Calibration Source Files
# ============================================================
include("${CMAKE_CURRENT_SOURCE_DIR}/DspSources.cmake")

set(ABDEEP_CORE_SOURCES
    # Lista compartida single-source (anti-drift) con el build WASM:
    # DspSources.cmake define ABDEEP_DSP_SOURCES / ABDEEP_DSP_SOURCES_WASM.
    ${ABDEEP_DSP_SOURCES}
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
    ${SRC_ROOT}/Plugin/PatchController.cpp

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
        ABDShared::SynthCore
        juce::juce_audio_devices
        juce::juce_audio_utils
        ABDEep_WebUI
    )

    # Ensure factory calibration.json is copied to build/resources
    add_dependencies(ABDEep_Standalone copy_calibration)

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
            ABDShared::SynthCore
            juce::juce_audio_devices
            juce::juce_audio_utils
            ABDEep_WebUI
        )
        add_dependencies(ABDEep_VST3 copy_calibration)
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
        ABDShared::SynthCore
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
        ${SRC_ROOT}/Tools/UnitTests/MidiProgramUnitTests.cpp

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
        ABDShared::SynthCore
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
        ABDShared::SynthCore
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

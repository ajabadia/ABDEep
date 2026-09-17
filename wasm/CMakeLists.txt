cmake_minimum_required(VERSION 3.22)
project(ABDEep_WASM VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ============================================================
# ABDEep WASM Build — Motor DSP C++ compilado a WebAssembly
# ============================================================
# Este CMakeLists.txt es INDEPENDIENTE del build principal.
# No modifica ni afecta al plugin VST3/Standalone.
# Uso:
#   emcmake cmake -S wasm -B wasm/build
#   cmake --build wasm/build
# ============================================================

# --- Rutas ---
set(JUCE_PATH "C:/JUCE" CACHE PATH "Path to JUCE")
set(SRC_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../Source")

# --- Lista compartida single-source (anti-drift) con el build nativo ---
# DspSources.cmake define ABDEEP_DSP_SOURCES y ABDEEP_DSP_SOURCES_WASM; la
# diferencia (Plugin/Tools/Calibration, tests) esta documentada alli.
include("${CMAKE_CURRENT_LIST_DIR}/../DspSources.cmake")
set(JUCE_MODULES "${JUCE_PATH}/modules")

# --- Verificar JUCE ---
if(NOT EXISTS "${JUCE_MODULES}/juce_core/juce_core.h")
    message(FATAL_ERROR "JUCE modules not found at ${JUCE_MODULES}")
endif()

# ============================================================
# Módulos JUCE compilados como fuentes directas (sin CMake de JUCE)
# Solo compilamos los módulos que el DSP necesita:
#   juce_core, juce_audio_basics, juce_events, juce_data_structures,
#   juce_audio_processors (headers only for APVTS fwd decl), juce_dsp
# ============================================================

add_executable(abdeep_dsp

    # --- JUCE Module compilation units ---
    # Headless DSP modules. juce_audio_processors.cpp is NOT compiled
    # (has platform #error in PluginHostType) but its HEADERS are included
    # via MODULE_AVAILABLE=1 so APVTS types are defined for ParametersSpec.h.
    # We use our local copy of juce_core to fix the Emscripten thread bugs.
    ${CMAKE_CURRENT_SOURCE_DIR}/juce_shim/juce_core/juce_core.cpp
    ${JUCE_MODULES}/juce_audio_basics/juce_audio_basics.cpp
    ${JUCE_MODULES}/juce_events/juce_events.cpp
    ${JUCE_MODULES}/juce_data_structures/juce_data_structures.cpp
    ${JUCE_MODULES}/juce_audio_formats/juce_audio_formats.cpp
    ${JUCE_MODULES}/juce_dsp/juce_dsp.cpp

    # --- ABDEep (lista compartida single-source, anti-drift) ---
    ${ABDEEP_DSP_SOURCES_WASM}
    ${CMAKE_CURRENT_SOURCE_DIR}/juce_shim/wasm_link_stubs.cpp
)

# --- Include directories ---
target_include_directories(abdeep_dsp PRIVATE
    ${SRC_ROOT}
    ${SRC_ROOT}/Core
    ${SRC_ROOT}/DSP
    ${SRC_ROOT}/Wasm
    ${JUCE_MODULES}
    # Generated JuceHeader shim
    ${CMAKE_CURRENT_SOURCE_DIR}/juce_shim
    # SynthEngine.h incluye <SynthCore/VoiceAllocator.h> (ABDSharedCode,
    # header-only y sin JUCE — elegible en WASM)
    ${CMAKE_CURRENT_LIST_DIR}/../../ABDSharedCode
)

# --- JUCE module configuration defines ---
# These tell JUCE which modules are available and configure them for
# a headless (no GUI, no audio device) build suitable for Emscripten.
target_compile_definitions(abdeep_dsp PRIVATE
    # Module availability flags
    JUCE_MODULE_AVAILABLE_juce_core=1
    JUCE_MODULE_AVAILABLE_juce_audio_basics=1
    JUCE_MODULE_AVAILABLE_juce_events=1
    JUCE_MODULE_AVAILABLE_juce_data_structures=1
    JUCE_MODULE_AVAILABLE_juce_audio_formats=1
    JUCE_MODULE_AVAILABLE_juce_audio_processors=0
    # La variante headless TAMBIEN redefine ParameterID/ utilities de
    # juce_audio_basics (JUCE 8) -> no activable junto a audio_basics.
    JUCE_MODULE_AVAILABLE_juce_dsp=1
    JUCE_MODULE_AVAILABLE_juce_graphics=0
    JUCE_MODULE_AVAILABLE_juce_gui_basics=0
    JUCE_MODULE_AVAILABLE_juce_gui_extra=0
    JUCE_MODULE_AVAILABLE_juce_audio_devices=0
    JUCE_MODULE_AVAILABLE_juce_audio_utils=0
    JUCE_MODULE_AVAILABLE_juce_audio_plugin_client=0
    JUCE_MODULE_AVAILABLE_juce_opengl=0
    JUCE_MODULE_AVAILABLE_juce_video=0
    JUCE_MODULE_AVAILABLE_juce_cryptography=0

    # JUCE configuration
    JUCE_GLOBAL_MODULE_SETTINGS_INCLUDED=1
    JUCE_STANDALONE_APPLICATION=0
    JUCE_USE_CURL=0
    JUCE_WEB_BROWSER=0
    JUCE_USE_CAMERA=0
    JUCE_PLUGINHOST_VST=0
    JUCE_PLUGINHOST_VST3=0
    JUCE_PLUGINHOST_AU=0
    JUCE_PLUGINHOST_LADSPA=0
    JUCE_PLUGINHOST_LV2=0
    JUCE_DISPLAY_SPLASH_SCREEN=0
    JUCE_REPORT_APP_USAGE=0
    JUCE_USE_FLAC=0
    JUCE_USE_OGGVORBIS=0
    JUCE_USE_MP3AUDIOFORMAT=0
    JUCE_USE_LAME_AUDIO_FORMAT=0
    JUCE_USE_WINDOWS_MEDIA_FORMAT=0
    JUCE_WASAPI=0
    JUCE_DIRECTSOUND=0
    JUCE_ALSA=0
    JUCE_JACK=0
    JUCE_ASIO=0
    JUCE_USE_ANDROID_OBOE=0
    JUCE_USE_WINRT_MIDI=0
    JUCE_DISABLE_NATIVE_FILECHOOSERS=1
    JUCE_MODAL_LOOPS_PERMITTED=0
    JUCE_CONTENT_SHARING=0
    JUCE_VST3_CAN_REPLACE_VST2=0
    JUCE_CATCH_UNHANDLED_EXCEPTIONS=0
    JUCE_LOG_ASSERTIONS=0

    # JUCE version info (matches C:/JUCE)
    JUCE_APPLICATION_NAME_STRING="ABDEep_WASM"
    JUCE_APPLICATION_VERSION_STRING="0.1.0"

    # Build mode
    EEP_MODE_ENHANCED=1
    DEEP_TARGET_MODEL=2
    # Note: __EMSCRIPTEN__ is auto-defined by emcc, no need to set manually

    # Disable assertions in release
    NDEBUG
)

# --- Compiler flags for JUCE/Emscripten compatibility ---
target_compile_options(abdeep_dsp PRIVATE
    -Wno-zero-length-array
    # Force-include global wasm compatibility header
    "SHELL:-include ${CMAKE_CURRENT_SOURCE_DIR}/juce_shim/wasm_compat.h"
)

# --- Emscripten linker flags ---
set_target_properties(abdeep_dsp PROPERTIES
    SUFFIX ".js"
    LINK_FLAGS "\
        -s WASM=1 \
        -s MODULARIZE=1 \
        -s EXPORT_ES6=1 \
        -s EXPORT_NAME=ABDEepDSP \
        -s EXPORTED_FUNCTIONS=[\"_wasm_init_engine\",\"_wasm_process_audio\",\"_wasm_set_parameter\",\"_wasm_set_parameter_index\",\"_wasm_get_parameter_index\",\"_wasm_set_model\",\"_wasm_get_model\",\"_wasm_note_on\",\"_wasm_note_off\",\"_wasm_pitch_bend\",\"_wasm_panic\",\"_malloc\",\"_free\"] \
        -s EXPORTED_RUNTIME_METHODS=[\"ccall\",\"cwrap\",\"setValue\",\"getValue\",\"HEAPF32\"] \
        -s ALLOW_MEMORY_GROWTH=1 \
        -s INITIAL_MEMORY=33554432 \
        -s STACK_SIZE=1048576 \
        -s NO_EXIT_RUNTIME=1 \
        -s ENVIRONMENT=web,worker \
        -s SINGLE_FILE=1 \
        -s MALLOC=emmalloc \
        -s ASSERTIONS=0 \
        --strip-all \
        -O3 \
        --no-entry \
    "
)

# --- Output directory: directly into WebUI/wasm/ ---
set_target_properties(abdeep_dsp PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/../WebUI/wasm"
)

# Specifically define JUCE_LINUX=1 for juce_data_structures.cpp so it resolves 
# the local variable 'dir' inside juce_PropertiesFile.cpp (which has an #elif for Linux/BSD).
# This is safe because juce_data_structures does not include the native Linux OS headers.
set_source_files_properties(
    "${JUCE_MODULES}/juce_data_structures/juce_data_structures.cpp"
    PROPERTIES COMPILE_DEFINITIONS "JUCE_LINUX=1"
)

message(STATUS "ABDEep WASM build configured.")
message(STATUS "  JUCE: ${JUCE_MODULES}")
message(STATUS "  DSP Sources: ${SRC_ROOT}/DSP")
message(STATUS "  Output: WebUI/wasm/abdeep_dsp.{js,wasm}")

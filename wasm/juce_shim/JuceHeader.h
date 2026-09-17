/**
 * JuceHeader.h — Minimal shim for WASM/Emscripten build
 * 
 * This header replaces the auto-generated JuceHeader.h from juceaide.
 * It includes only the JUCE modules needed for DSP processing,
 * without any GUI, audio device, or plugin hosting dependencies.
 *
 * This file is ONLY used by the WASM build (wasm/CMakeLists.txt).
 * The native VST3/Standalone build continues to use its own generated JuceHeader.h.
 */

#pragma once

// Ensure emscripten header is available for JUCE's wasm platform code
#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#endif

// Core JUCE modules needed for DSP
#include <juce_core/juce_core.h>
#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_events/juce_events.h>
#include <juce_data_structures/juce_data_structures.h>
#include <juce_audio_formats/juce_audio_formats.h>
#include <juce_dsp/juce_dsp.h>

// NOTA: no incluir juce_audio_processors (ni su variante headless): el modulo
// completo necesita juce_gui_extra, y la variante headless de JUCE 8 redefine
// ParameterID/AudioParameter* que ya existen en juce_audio_basics. Los TUs que
// necesitan APVTS (ParametersSpec*, CalibrationSpec*) son exclusivos del
// plugin nativo y no forman parte del motor WASM (ver DspSources.cmake).


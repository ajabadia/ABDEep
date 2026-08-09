#pragma once

#include <JuceHeader.h>
#include "../DSP/SynthEngine.h"

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define WASM_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define WASM_EXPORT
#endif

extern "C" {
    /** Initialize the C++ SynthEngine for WASM audio processing. */
    WASM_EXPORT void wasm_init_engine(double sampleRate, int blockSize);

    /** Process a block of audio (interleaved or dual buffer outL, outR). */
    WASM_EXPORT void wasm_process_audio(float* outL, float* outR, int numSamples);

    /** Set a parameter by ID (0.0 to 1.0 normalized value). */
    WASM_EXPORT void wasm_set_parameter(const char* paramId, float value);

    /** Set a parameter by registry index — O(1) hot path (Fase 5 §3.2). */
    WASM_EXPORT void wasm_set_parameter_index(int paramIndex, float value);

    /** Read back a normalized parameter by registry index (tests/round-trip). */
    WASM_EXPORT float wasm_get_parameter_index(int paramIndex);

    /** Set the ModelCapabilities index (0 = dm12_hardware, 1 = abyssmind_pro). */
    WASM_EXPORT void wasm_set_model(int model);

    /** Get the current ModelCapabilities index. */
    WASM_EXPORT int wasm_get_model();

    /** MIDI Note On event. */
    WASM_EXPORT void wasm_note_on(int midiNote, float velocity);

    /** MIDI Note Off event. */
    WASM_EXPORT void wasm_note_off(int midiNote);

    /** MIDI Pitch Bend event (-1.0 to 1.0). */
    WASM_EXPORT void wasm_pitch_bend(float value);

    /** Reset/Panic engine. */
    WASM_EXPORT void wasm_panic();
}

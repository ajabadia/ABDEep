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

    /** MIDI Note On event. */
    WASM_EXPORT void wasm_note_on(int midiNote, float velocity);

    /** MIDI Note Off event. */
    WASM_EXPORT void wasm_note_off(int midiNote);

    /** MIDI Pitch Bend event (-1.0 to 1.0). */
    WASM_EXPORT void wasm_pitch_bend(float value);

    /** Reset/Panic engine. */
    WASM_EXPORT void wasm_panic();
}

#pragma once

#include <JuceHeader.h>
#include <atomic>
#include <array>
#include "SynthVoice.h"
#include "ModulationMatrix.h"
#include "FX/FXEngine.h"
#include "Core/DiagnosticSnapshots.h"
#include "Core/CalibrationSpec.h"
// DRY transversal: la asignación/robo de voces vive en el módulo compartido
// ABDSharedCode::SynthCore (abd::synth::VoiceAllocator), con la escalera de
// robo estilo MS2000 generalizada (nota repetida → libre → latch → release
// por nivel → FIFO). Libre de JUCE: se alimenta vía StealHint.
#include <SynthCore/VoiceAllocator.h>

namespace ABD
{
    /**
     * SynthEngine coordina la polifonía (12 voces por defecto), el ruteo de MIDI,
     * la sincronización de parámetros de APVTS y el cálculo de la matriz de modulación.
     */
    class SynthEngine
    {
    public:
        SynthEngine();
        ~SynthEngine() = default;

        void prepare(double sampleRate, int samplesPerBlock);
        
        // Sincroniza los parámetros desde la APVTS
        void updateParameters(juce::AudioProcessorValueTreeState& apvts);

        // Procesamiento del bloque de audio y lectura de MIDI
        void processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages);

        ModulationMatrix& getModulationMatrix() { return modMatrix; }
        const ModulationMatrix& getModulationMatrix() const { return modMatrix; }

        FXEngine& getFXEngine() { return fxEngine; }
        const FXEngine& getFXEngine() const { return fxEngine; }

        // Global HPF (post-VCA, pre-FX) — test/diagnostics hook. En producción estos
        // valores se sincronizan desde la APVTS en updateParameters().
        void setGlobalHpfCutoff(float hz) { globalHpfCutoffHz = hz; }
        void setGlobalHpfBassBoost(bool on) { globalHpfBassBoost = on; }
        float getGlobalHpfCutoff() const { return globalHpfCutoffHz; }

        //==============================================================================
        // Test/diagnostic hooks (benchmarks) — espejan los targets de updateParameters()
        // para poder estresar el motor sin construir una APVTS completa.
        //==============================================================================
        void setVoiceMode(int mode);
        void setUnisonDetune(float detune);
        void setVcaPanSpread(float spread);
        void setVcfModel(int model);
        void setVcfOversample(int oversample);

        /** Retorna el estado actual de las 12 voces para el DebugPanel (C++ → WebUI bridge) */
        /** Thread-safe: lee de un snapshot protegido por voiceStateLock */
        juce::var getVoiceState() const;

        /** Retorna el buffer de captura de audio para el osciloscopio en tiempo real */
        /** Retorna un Array<var> con las últimas kAudioCaptureSize muestras del canal izquierdo */
        juce::var getAudioWaveform() const;

        void panic();
        /** Reset global MIDI controllers (pitch bend, mod wheel, aftertouch, sustain)
         *  to their default values, and propagate to all active voices.
         *  Useful when entering bypass to prevent controller jumps on un-bypass. */
        void resetMidiControllers();
        bool isVoiceActive(int voiceIndex) const { return voiceIndex >= 0 && voiceIndex < kNumVoices ? voices[voiceIndex].isActive() : false; }

        /**
         * Retorna un JSON string con las notas activas y sus velocidades.
         * Ej: "[[60,0.8],[64,0.75],[67,0.82]]"
         * Thread-safe: lee del snapshot bajo voiceStateLock.
         */
        juce::String getActiveNotesJSON() const;

        EngineDiagnosticSnapshot getDiagnosticSnapshot() const;

        //==============================================================================
        // Calibration — thread-safe get/set, per-block immutable snapshot
        //==============================================================================
        /** Load calibration from JSON. Returns true on success. */
        bool loadCalibrationFromJson(const juce::String& json);
        /** Get current calibration as JSON string. */
        juce::String getCalibrationJson() const;
        /** Get the effective calibration for the current block (immutable snapshot). */
        const CalibrationSpec& getCalibration() const { return activeCalibration; }
        /** Get factory defaults. */
        static CalibrationSpec getFactoryDefaults() { return CalibrationSpec::factoryDefaults(); }

    private:
        static constexpr int kNumVoices = 12;
        SynthVoice voices[kNumVoices];
        // Agregador compartido (DRY): misma escalera de robo que ABDMS2000.
        abd::synth::VoiceAllocator<static_cast<size_t>(kNumVoices)> voiceAlloc;
        // Tabla de observación voice-agnóstica (audio thread only).
        std::array<abd::synth::StealHint, static_cast<size_t>(kNumVoices)> stealHints {};
        ModulationMatrix modMatrix;
        FXEngine fxEngine;

        // --- Snapshot thread-safe para DebugPanel ---
        // El audio thread copia el estado de las voces al final de processBlock()
        // bajo voiceStateLock. getVoiceState() lee el snapshot bajo el mismo lock.
        struct VoiceSnapshot
        {
            bool active = false;
            int midiNote = -1;
            float velocity = 0.0f;
            float detuneSemitones = 0.0f;
            float panPosition = 0.5f;
            float voicePanSpread = 0.0f;
            float modOsc1DetuneSemitones = 0.0f;
            float modOsc2DetuneSemitones = 0.0f;
            float modPan = 0.5f;
            float modVcfCutoffHz = 1000.0f;
        };

        // Controladores MIDI globales (snapshot para DebugPanel)
        float snapPitchBend = 0.0f;
        float snapModWheel = 0.0f;
        float snapAftertouch = 0.0f;
        float snapSustainPedal = 0.0f;

        // Peak level de salida de audio (VU Meter para DebugPanel)
        float snapPeakLevel = 0.0f;
        mutable VoiceSnapshot voiceSnapshots[kNumVoices];
        mutable juce::CriticalSection voiceStateLock;
        mutable EngineDiagnosticSnapshot currentDiagnosticSnapshot;

        // --- Calibration: master state + per-block immutable snapshot ---
        CalibrationSpec pendingCalibration;    // written from UI/bridge thread
        CalibrationSpec activeCalibration;     // resolved once per block, read by voices
        mutable juce::CriticalSection calibrationLock;

        void updateVoiceSnapshot();

        double sampleRate = 44100.0;
        int samplesPerBlock = 512;

        // --- Voice Mode & Unison ---
        int voiceMode = 0;             // 0=Poly, 1=Uni2, 2=Uni3, 3=Uni4, 4=Uni6, 5=Uni12,
                                       // 6=Mono, 7=Mono2, 8=Mono3, 9=Mono4, 10=Mono6, 11=Poly6, 12=Poly8
        float unisonDetune = 0.0f;     // normalized 0-1, symmetrical detune ±0..±50 cents
        float vcaPanSpread = 0.0f;     // normalized 0-1, stereo spread for stacked voices

        /** Retorna cuántas voces apilar por nota en el modo actual */
        static int getVoicesPerNote(int mode);
        /** Calcula detune (semitonos) y pan (0-1) para una voz dentro de un grupo Unison */
        void getUnisonParams(int voiceInGroup, int totalInGroup,
                             float& detuneSemitones, float& panPosition) const;

        // --- Chord Memory & Poly Chord ---
        bool chordEnable = false;
        bool polyChordEnable = false;
        int chordKey = 0;      // 0=C, 1=C#, ... 11=B
        int chordType = 0;     // 0=Memory, 1=Major, 2=Minor, 3=Major7, 4=Minor7, 5=Dom7, 6=Sus4, 7=Power

        static const int* getChordIntervals(int type, int& numNotes);

        // Poly Chord: held root notes accumulator (max 12 simultaneous)
        static constexpr int kMaxChordNotes = 12;
        int polyChordHeldNotes[kMaxChordNotes] = {};
        int polyChordNoteCount = 0;

        // Transpose & Global Tune
        int transposeSemitones = 0;       // -48 .. +48 semitones
        float globalTuneCents = 0.0f;     // -128 .. +127 cents

        // Portamento / Glide
        float globalPortamentoTime = 0.0f;  // normalized 0-1
        int portaMode = 0;                  // 0-9
        float portaOscBal = 0.0f;           // -128..127

        // Note Priority (for Mono mode)
        int notePriority = 0;               // 0=Lowest, 1=Highest, 2=Last
        // Held notes tracker for Mono mode (max 12 simultaneous)
        int monoHeldNotes[12] = {};
        int monoHeldNoteCount = 0;

        // Alojamiento de voces — delegado en el módulo compartido SynthCore.
        // voiceAlloc mantiene el estado sombra (notas, timestamps, cursor RR)
        // sincronizado con voices[] tras cada decisión.
        int findFreeVoice(int incomingNote);
        /** Refresca la tabla StealHint desde el estado real de las voces. */
        void syncVoiceAllocatorHints();
        /** Commits an allocation to the VoiceAllocator (called after startNote). */
        void commitAllocation(int slotIndex, int midiNote);
        /** Marks a slot as released in the VoiceAllocator (called after stopNote). */
        void markSlotReleased(int slotIndex);
        void triggerNote(int midiNoteNumber, float velocity);
        void triggerChordForRoot(int rootNote, int numChordNotes, const int* intervals, float velocity);
        void releaseNote(int midiNoteNumber);

        // Sustain pedal latch (CC64 hardware behavior): notes key-released while
        // the pedal is down stay sounding (envelope held at sustain). They are
        // released when the pedal goes up, but only if the finger already let go.
        int sustainLatchedNotes[128] = {};
        int sustainLatchCount = 0;
        bool isSustainLatched(int midiNoteNumber) const;
        void releaseSustainLatchedNotes();

        // LFO global para modos Mono/Spread
        LFO globalLfo1, globalLfo2;
        float lfo1MonoMode = 0.0f;
        float lfo2MonoMode = 0.0f;
        juce::Array<float> globalLfo1Buffer, globalLfo2Buffer;
        
        // Arpeggiator clock frequency (Hz) para LFO Arp Sync y MIDI clock
        float arpClockHz = 1.0f;
        bool arpSyncActive = false;  // true si alguna voz tiene lfoArpSync activo (para global LFOs)

        // LFO Arp Sync rates desde la tabla de Clock Divide del hardware (lfo_rate → división)
        float globalLfo1ArpSyncHz = 1.0f;
        float globalLfo2ArpSyncHz = 1.0f;

    public:
        /**
         * Mapea el rate normalizado de un LFO (0-1 → byte 0-255) a la frecuencia de Arp Sync,
         * reinterpretando el rate como división de la tabla de Clock Divide del hardware DM12
         * (20 divisiones, raw 8..255, docs lfos.md:23-48). El sync se deriva del Master BPM:
         * f = (bpm/60) / (división×4). Devuelve Hz.
         */
        static float lfoArpSyncHzFromRate(float rateNorm, float bpm);

    private:
        // Master Gain
        float globalVolume = 0.8f;

        // Global HPF (post-VCA, post-SUM, pre-FX) — hardware: VCF → VCA → SUM → HPF → FX.
        // Actúa sobre la suma de todas las voces; cutoff modulado desde fuentes "common".
        // Un filtro por canal para no acoplar el estado de los canales estéreo.
        HPF globalHpf[2];
        float globalHpfMinHz = 40.0f;
        float globalHpfMaxHz = 2000.0f;
        float globalHpfModScaleHz = 18000.0f;
        float globalHpfCutoffHz = 20.0f;       // base física del param hpf_cutoff (20-2000 Hz)
        bool  globalHpfBassBoost = false;
        float globalHpfBassBoostGain = 1.0f;

        // Master Soft-Clip (bypass + headroom)
        bool masterSoftclipBypass = false;      // true = sin soft-clip en la salida final
        float masterSoftclipHeadroom = 0.0f;    // normalized 0..1 → 0..6 dB (1.0x..~2.0x)

        // Controladores MIDI globales
        float currentPitchBend = 0.0f;
        float currentModWheel = 0.0f;
        float currentAftertouch = 0.0f;
        float currentSustainPedal = 0.0f;

        // Peak level de salida (para VU Meter en DebugPanel)
        float currentPeakLevel = 0.0f;

        // --- Audio waveform capture buffer for real-time oscilloscope ---
        static constexpr int kAudioCaptureSize = 512; // muestras por canal
        float audioCaptureBuffer[kAudioCaptureSize * 2] = {0.0f}; // stereo interleaved
        int audioCaptureWritePos = 0;

        // --- Note event tracking for WebUI LCD display ---
        // Atomic exchange pattern: audio thread writes, UI timer reads + clears.
        // -1 = no pending event.
        std::atomic<int> pendingNoteOnNote   = {-1};
        std::atomic<float> pendingNoteOnVel  = {0.0f};
        std::atomic<int> pendingNoteOffNote  = {-1};
    };
}

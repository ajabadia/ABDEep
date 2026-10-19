#pragma once

#include <JuceHeader.h>
#include <atomic>
#include <array>
#include <cstdint>
#include "SynthVoice.h"
#include "ModulationMatrix.h"
#include "Arpeggiator.h"
#include "ControlSequencer.h"
#include "FX/FXEngine.h"
#include "Core/DiagnosticSnapshots.h"
#include "Core/CalibrationSpec.h"
// DRY transversal: la asignación/robo de voces vive en el módulo compartido
// ABDSharedCode::SynthCore (abd::synth::VoiceAllocator), con la escalera de
// robo estilo MS2000 generalizada (nota repetida → libre → latch → release
// por nivel → FIFO). Libre de JUCE: se alimenta vía StealHint.
#include <SynthCore/VoiceAllocator.h>
#include <SynthCore/AudioThreadSnapshot.h>
#include <Scope/Source/Core/ScopeTap.h>

namespace ABD
{
    /**
     * @brief Puntos de inyección de tono diagnóstico de 440 Hz en el pipeline DSP.
     *
     * Permite inyectar una señal sinusoidal pura en distintas etapas (Pre-Filter,
     * Pre-Amp, Pre-FX, Pre-Master, Post-Master) para diagnosticar la cadena de audio.
     */
    enum class DiagnosticTonePoint
    {
        Disabled = 0,
        PostMasterVolume = 1,  // Salida final post-FX y post-Master Volume
        PreMasterVolume = 2,   // Post-FX, antes del Master Volume
        PreEffects = 3,        // Post-VCA/HPF (suma de voces), antes del FXEngine
        PreFilter = 4,         // Dentro de SynthVoice: reemplaza salida de osciladores antes del VCF
        PreAmp = 5             // Dentro de SynthVoice: reemplaza salida del VCF antes del VCA
    };

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

        Arpeggiator& getArpeggiator() { return arpeggiator; }
        const Arpeggiator& getArpeggiator() const { return arpeggiator; }

        ControlSequencer& getControlSequencer() { return controlSequencer; }
        const ControlSequencer& getControlSequencer() const { return controlSequencer; }

        void setArpGateBase(float gate) { arpGateBase = std::clamp(gate, 0.0f, 1.0f); }
        const juce::Array<float>& getControlSeqBuffer() const { return controlSeqBuffer; }

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
        void setVcfCutoff(float cutoff);
        void setEnv1Times(float attack, float decay, float sustain, float release);

        /**
         * Carga un patch DM12 de 242 bytes: lo escribe en la APVTS vía
         * PatchByteCodec::applyToApvts y re-sincroniza el motor con
         * updateParameters(). Devuelve el número de parámetros escritos.
         */
        int loadPatchBytes (const std::uint8_t* patch242,
                            juce::AudioProcessorValueTreeState& apvts);

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
        /** Get the effective calibration (lock-free read of active buffer). */
        const CalibrationSpec& getCalibration() const { return calibrationBuffers[activeCalibrationIndex.load(std::memory_order_acquire)]; }
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

        // --- Snapshot 100% Lock-Free (Doble Buffer SPSC) para DebugPanel y CalibrationLab ---
        // El audio thread escribe en el buffer inactivo al final de processBlock()
        // y publica el índice mediante std::memory_order_release. El hilo de UI lee
        // el índice activo con std::memory_order_acquire sin ningún mutex.
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

        struct TelemetryBuffer
        {
            VoiceSnapshot voiceSnapshots[kNumVoices];
            float snapPitchBend = 0.0f;
            float snapModWheel = 0.0f;
            float snapAftertouch = 0.0f;
            float snapSustainPedal = 0.0f;
            float snapPeakLevel = 0.0f;
            int polyChordNoteCount = 0;
            EngineDiagnosticSnapshot diagnosticSnapshot;
            abd::synth::AudioThreadSnapshot sharedSnapshot {};
        };

        mutable TelemetryBuffer telemetryBuffers[2];
        mutable std::atomic<int> activeTelemetryIndex { 0 };

        // --- Calibration: doble buffer SPSC (UI -> Audio) + snapshot inmutable por bloque ---
        CalibrationSpec calibrationBuffers[2] { CalibrationSpec::factoryDefaults(), CalibrationSpec::factoryDefaults() };
        std::atomic<int> activeCalibrationIndex { 0 };
        CalibrationSpec activeCalibration { CalibrationSpec::factoryDefaults() }; // resolved once per block, read by voices
        mutable juce::CriticalSection calibrationLock; // serializa únicamente escrituras/lecturas en el hilo de UI

        void updateVoiceSnapshot();

        double sampleRate = 44100.0;
        int samplesPerBlock = 512;

        // --- Voice Mode & Unison ---
        int voiceMode = 0;             // 0=Poly, 1=Uni2, 2=Uni3, 3=Uni4, 4=Uni6, 5=Uni12,
                                       // 6=Mono, 7=Mono2, 8=Mono3, 9=Mono4, 10=Mono6, 11=Poly6, 12=Poly8
        float unisonDetuneBase = 0.0f; // valor crudo del parámetro unison_detune (0-1)
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

        /**
         * La modulacion de nivel del bus de fx, una por hueco y muestra a
         * muestra. La rellena `processBlock` en el bucle donde ya viven las
         * fuentes de la matriz, y la consume el bus al procesar.
         */
        juce::Array<juce::Array<float>> fxLevelMod;

        /**
         * La modulacion de los parametros del bus de fx, una por hueco y POR
         * BLOQUE, no por muestra: el efecto lee sus parametros una vez al
         * procesar el bloque (ver `FXSlot::process`).
         */
        float fxParamMod[4] = {};
        
        // Arpeggiator clock frequency (Hz) para LFO Arp Sync y MIDI clock
        float arpClockHz = 1.0f;
        bool arpSyncActive = false;  // true si alguna voz tiene lfoArpSync activo (para global LFOs)

        // ── ARP/SEQ: BPM maestro, gate base y módulos ────────────────────
        // masterBpm viene de arp_rate (20-275, ya en BPM) o del host DAW (hostBpm > 0);
        // lo consumen el reloj del arp, el secuenciador de control y el sync de los LFO.
        float masterBpm = 120.0f;
        float hostBpm = 0.0f;
        bool hostIsPlaying = false;
        double hostPpqPosition = 0.0;
        // Gate del panel (0-1). La matriz le suma encima muestra a bloque en
        // processBlock (destino 71), por eso el panel se guarda aparte.
        float arpGateBase = 0.5f;
        Arpeggiator arpeggiator;
        ControlSequencer controlSequencer;
        juce::Array<float> controlSeqBuffer;

        // LFO Arp Sync rates desde la tabla de Clock Divide del hardware (lfo_rate → división)
        float globalLfo1ArpSyncHz = 1.0f;
        float globalLfo2ArpSyncHz = 1.0f;

    public:
        /**
         * Establece el tempo y estado de transporte reportado por el DAW (juce::AudioPlayHead).
         * Si bpm está en rango válido [20, 400], sincroniza el BPM maestro del motor
         * (Arpeggiator, Control Sequencer y LFO Arp Sync) con el host.
         * Al iniciar la reproducción en el DAW (flanco ascendente de isPlaying), alinea el
         * paso 1 del Control Sequencer con el arranque del transporte.
         */
        void setHostBpm(float bpm) noexcept { hostBpm = bpm; }
        float getHostBpm() const noexcept { return hostBpm; }
        void setHostTransport(float bpm, bool isPlaying, double ppqPos = 0.0) noexcept
        {
            hostBpm = bpm;
            if (!hostIsPlaying && isPlaying && controlSequencer.isEnabled())
                controlSequencer.reset();
            hostIsPlaying = isPlaying;
            hostPpqPosition = ppqPos;
        }
        bool isHostPlaying() const noexcept { return hostIsPlaying; }
        double getHostPpqPosition() const noexcept { return hostPpqPosition; }

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
        float lastGlobalVolume = 0.8f;
        bool globalVolumeInitialized = false;

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
        float currentFootController = 0.0f;
        float currentBreathController = 0.0f;
        float currentExpressionPedal = 0.0f;

        // Peak level de salida (para VU Meter en DebugPanel)
        float currentPeakLevel = 0.0f;

        // --- Audio waveform capture buffer for real-time oscilloscope + ABDShared::ScopeCore SPSC taps ---
        static constexpr int kAudioCaptureSize = 512; // muestras por canal
        float audioCaptureBuffer[kAudioCaptureSize * 2] = {0.0f}; // stereo interleaved
        std::atomic<int> audioCaptureWritePos { 0 };
        abd::scope::ScopeTap masterScopeTap { "Master Out", abd::scope::ScopeTapType::StereoAudio, 4096, "master-out" };
        abd::scope::ScopeTap preFxScopeTap { "Pre FX", abd::scope::ScopeTapType::StereoAudio, 4096, "pre-fx" };

        // --- Inyector de Tono Diagnóstico de 440 Hz Multi-Punto ---
        std::atomic<DiagnosticTonePoint> diagTonePoint_ { DiagnosticTonePoint::Disabled };
        std::atomic<float> testToneFrequency_ { 440.0f };
        std::atomic<float> testToneLevel_ { 0.25f };
        double testTonePhase_ { 0.0 };

    public:
        abd::scope::ScopeTap& getMasterScopeTap() noexcept { return masterScopeTap; }
        const abd::scope::ScopeTap& getMasterScopeTap() const noexcept { return masterScopeTap; }
        abd::scope::ScopeTap& getPreFxScopeTap() noexcept { return preFxScopeTap; }
        const abd::scope::ScopeTap& getPreFxScopeTap() const noexcept { return preFxScopeTap; }

        /** Retorna el snapshot estándar compartido abd::synth::AudioThreadSnapshot (lock-free). */
        const abd::synth::AudioThreadSnapshot& getSharedSnapshot() const noexcept
        {
            return telemetryBuffers[activeTelemetryIndex.load(std::memory_order_acquire)].sharedSnapshot;
        }
        const abd::synth::AudioThreadSnapshot& getSnapshot() const noexcept { return getSharedSnapshot(); }

        /** Configura el inyector de tono diagnóstico de 440 Hz en la etapa indicada (0=Off, 1=PostMaster, 2=PreMaster, 3=PreFX, 4=PreFilter, 5=PreAmp). */
        void setDiagnosticTone(int point, float freqHz = 440.0f, float level = 0.25f) noexcept
        {
            const int clamped = std::clamp(point, 0, 5);
            diagTonePoint_.store(static_cast<DiagnosticTonePoint>(clamped), std::memory_order_relaxed);
            testToneFrequency_.store(std::clamp(freqHz, 20.0f, 20000.0f), std::memory_order_relaxed);
            testToneLevel_.store(std::clamp(level, 0.0f, 1.0f), std::memory_order_relaxed);
        }
        int getDiagnosticTonePoint() const noexcept
        {
            return static_cast<int>(diagTonePoint_.load(std::memory_order_relaxed));
        }
        void setTestToneEnabled(bool enabled) noexcept
        {
            setDiagnosticTone(enabled ? static_cast<int>(DiagnosticTonePoint::PostMasterVolume) : 0, 440.0f, 0.25f);
        }

    private:

        // SpinLock para proteger el estado de voces durante processBlock frente a panic() concurrente
        mutable juce::SpinLock engineProcessSpinLock;
        std::atomic<bool> pendingPanic { false };

        // --- Note event tracking for WebUI LCD display ---
        // Atomic exchange pattern: audio thread writes, UI timer reads + clears.
        // -1 = no pending event.
        std::atomic<int> pendingNoteOnNote   = {-1};
        std::atomic<float> pendingNoteOnVel  = {0.0f};
        std::atomic<int> pendingNoteOffNote  = {-1};
    };
}

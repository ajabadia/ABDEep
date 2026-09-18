#include "SynthEngine.h"
#include "DSPHelpers.h"
#include <algorithm>
#include <cstring>
#include <cmath>

namespace ABD
{
    SynthEngine::SynthEngine()
    {
        std::memset(polyChordHeldNotes, 0, sizeof(polyChordHeldNotes));
        activeCalibration = CalibrationSpec::factoryDefaults();
        pendingCalibration = CalibrationSpec::factoryDefaults();
    }

    void SynthEngine::prepare(double newSampleRate, int newSamplesPerBlock)
    {
        sampleRate = newSampleRate;
        samplesPerBlock = newSamplesPerBlock;

        for (int i = 0; i < kNumVoices; ++i)
        {
            voices[i].initializeVoicePersonality(i);
            voices[i].prepare(sampleRate);
        }

        // Preparar LFOs globales
        globalLfo1.setSampleRate(sampleRate);
        globalLfo2.setSampleRate(sampleRate);
        globalLfo1Buffer.resize(samplesPerBlock);
        globalLfo2Buffer.resize(samplesPerBlock);

        // Preparar FX Engine
        fxEngine.prepare(sampleRate, samplesPerBlock);

        // Preparar HPF global (post-VCA, un filtro por canal)
        globalHpf[0].prepare(sampleRate);
        globalHpf[1].prepare(sampleRate);

        // Sincronizar el VoiceAllocator con las voces recién inicializadas.
        // (El constructor de SynthEngine no reseta voiceAlloc explícitamente,
        // y prepare puede ser llamado varias veces durante la vida del engine.)
        voiceAlloc.reset();
    }

    void SynthEngine::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
    {
        // 0. Pre-calcular buffers de LFO global para todo el bloque
        const int numSamples = buffer.getNumSamples();
        if (numSamples != globalLfo1Buffer.size())
        {
            globalLfo1Buffer.resize(numSamples);
            globalLfo2Buffer.resize(numSamples);
        }

        // Aplicar arp sync a LFOs globales solo si alguna voz lo tiene activo
        // (usa la tabla de Clock Divide del hardware, rate por-LFO distinto)
        if (arpSyncActive)
        {
            globalLfo1.setRate(globalLfo1ArpSyncHz);
            globalLfo2.setRate(globalLfo2ArpSyncHz);
        }

        // Avanzar LFOs globales muestra a muestra para todo el bloque
        for (int s = 0; s < numSamples; ++s)
        {
            globalLfo1Buffer.set(s, globalLfo1.nextSample());
            globalLfo2Buffer.set(s, globalLfo2.nextSample());
        }

        buffer.clear();

        // 1.5. Resolve calibration snapshot for this block (immutable during processing)
#if DEEP_TARGET_MODEL >= 2
        {
            const juce::ScopedLock sl (calibrationLock);
            pendingCalibration.validate();
            activeCalibration = pendingCalibration;
        }

        // Propagate calibration to all voices (immutable pointer for the block)
        for (int i = 0; i < kNumVoices; ++i)
            voices[i].setCalibration(&activeCalibration);
#endif

        // 2. Procesar eventos MIDI en orden cronológico con timing a nivel de muestra.
        // El buffer se renderiza por segmentos: cada evento se aplica en su samplePosition
        // exacto (note on/off, pitch bend, CC, aftertouch) en lugar de aplicarse todos en
        // la muestra 0 del bloque, logrando timing sample-accurate.
        int renderPos = 0;
        auto renderTo = [&](int endPos)
        {
            endPos = std::clamp(endPos, renderPos, numSamples);
            if (endPos <= renderPos)
                return;
            for (int i = 0; i < kNumVoices; ++i)
                voices[i].process(buffer, renderPos, endPos - renderPos, modMatrix,
                                  globalLfo1Buffer.getRawDataPointer(),
                                  globalLfo2Buffer.getRawDataPointer(),
                                  lfo1MonoMode, lfo2MonoMode);
            renderPos = endPos;
        };

        for (const auto metadata : midiMessages)
        {
            auto msg = metadata.getMessage();
            int samplePosition = std::clamp(metadata.samplePosition, 0, numSamples);

            // Renderizar hasta el instante del evento para que tome efecto en su muestra exacta
            renderTo(samplePosition);

            if (msg.isNoteOn())
            {
                int transposedNote = std::clamp(msg.getNoteNumber() + transposeSemitones, 0, 127);
                triggerNote(transposedNote, msg.getFloatVelocity());
            }
            else if (msg.isNoteOff())
            {
                int transposedNote = std::clamp(msg.getNoteNumber() + transposeSemitones, 0, 127);
                releaseNote(transposedNote);
            }
            else if (msg.isPitchWheel())
            {
                // Mapear Pitch Wheel a bipolar [-1.0f, 1.0f]
                currentPitchBend = (float)msg.getPitchWheelValue() / 8192.0f - 1.0f;
                for (int i = 0; i < kNumVoices; ++i)
                    voices[i].setExternalModulation(ModSource::kPitchBend, currentPitchBend);
            }
            else if (msg.isController())
            {
                int ccNum = msg.getControllerNumber();
                float ccVal = (float)msg.getControllerValue() / 127.0f;

                if (ccNum == 1) // Mod Wheel
                {
                    currentModWheel = ccVal;
                    for (int i = 0; i < kNumVoices; ++i)
                        voices[i].setExternalModulation(ModSource::kModWheel, currentModWheel);
                }
                else if (ccNum == 64) // Sustain Pedal (latch)
                {
                    bool pedalWasDown = currentSustainPedal >= 0.5f;
                    bool pedalIsDown = ccVal >= 0.5f;   // CC64 ≥ 64 = pressed
                    currentSustainPedal = ccVal;
                    for (int i = 0; i < kNumVoices; ++i)
                        voices[i].setExternalModulation(ModSource::kSustainPedal, currentSustainPedal);
                    // Latch release: only notes whose key was let go while the
                    // pedal was held enter their release phase now.
                    if (pedalWasDown && !pedalIsDown)
                        releaseSustainLatchedNotes();
                }
            }
            else if (msg.isChannelPressure()) // Aftertouch
            {
                currentAftertouch = (float)msg.getChannelPressureValue() / 127.0f;
                for (int i = 0; i < kNumVoices; ++i)
                    voices[i].setExternalModulation(ModSource::kKeyPressure, currentAftertouch);
            }
        }

        // Renderizar el tramo final tras el último evento MIDI
        renderTo(numSamples);

        // 2.5. HPF global post-VCA (hardware: VCF → VCA → SUM → HPF → FX, docs vca.md:38).
        // El HPF del DeepMind es un destino de modulación "common": actúa sobre la suma
        // de todas las voces y se modula desde las fuentes globales (pitch bend, mod
        // wheel, aftertouch, sustain y LFOs globales), no desde las envolventes por voz.
        {
#if DEEP_TARGET_MODEL >= 2
            globalHpfMinHz = activeCalibration.transfer.hpf.minHz;
            globalHpfMaxHz = activeCalibration.transfer.hpf.maxHz;
            globalHpfModScaleHz = activeCalibration.transfer.hpf.modScaleHz;
#else
            globalHpfMinHz = 40.0f;
            globalHpfMaxHz = 2000.0f;
            globalHpfModScaleHz = 18000.0f;
#endif

            globalHpf[0].setBassBoostActive(globalHpfBassBoost);
            globalHpf[0].setBassBoostGain(globalHpfBassBoostGain);
            globalHpf[1].setBassBoostActive(globalHpfBassBoost);
            globalHpf[1].setBassBoostGain(globalHpfBassBoostGain);

            float commonSources[(int)ModSource::kMaxSources] = {};
            commonSources[(int)ModSource::kPitchBend] = currentPitchBend;
            commonSources[(int)ModSource::kModWheel] = currentModWheel;
            commonSources[(int)ModSource::kKeyPressure] = currentAftertouch;
            commonSources[(int)ModSource::kSustainPedal] = currentSustainPedal;

            const int numCh = juce::jmin(2, buffer.getNumChannels());
            for (int s = 0; s < numSamples; ++s)
            {
                commonSources[(int)ModSource::kLFO1] = globalLfo1Buffer[s];
                commonSources[(int)ModSource::kLFO2] = globalLfo2Buffer[s];

                const float hpfCutoffMod = modMatrix.getModulationValue(ModDestination::kFilterHPFCutoff,
                                                                        commonSources);
                const float hpfCutoffHz = std::clamp(globalHpfCutoffHz + hpfCutoffMod * globalHpfModScaleHz,
                                                     globalHpfMinHz, globalHpfMaxHz);
                for (int ch = 0; ch < numCh; ++ch)
                {
                    globalHpf[ch].setCutoff(hpfCutoffHz);
                    buffer.getWritePointer(ch)[s] = globalHpf[ch].process(buffer.getSample(ch, s));
                }
            }
        }

        // 3. Contar voces activas al cierre del bloque (para el VU Meter de DebugPanel)
        int activeCount = 0;
        for (int i = 0; i < kNumVoices; ++i)
        {
            if (voices[i].isActive()) activeCount++;
        }
        
        // Medir nivel de salida (VU Meter para DebugPanel) — solo en debug, sin I/O de disco
        currentPeakLevel = 0.0f;
        if (activeCount > 0)
        {
            currentPeakLevel = buffer.getMagnitude(0, numSamples);
#if JUCE_DEBUG
            static int dbgCounter = 0;
            if (++dbgCounter % 100 == 0)
            {
                DBG("[SynthEngine] Active voices: " + juce::String(activeCount) + " peakLevel: " + juce::String(currentPeakLevel, 6));
            }
#endif
        }

        // Procesar FX Engine (post-voices, pre-master gain)
        fxEngine.process(buffer);

        // Aplicar Master Gain (global_volume) a todo el buffer de salida
        // Nota: globalVolume viene clampeado a [0, 2] desde updateParameters
        if (std::abs(globalVolume - 1.0f) > 0.001f)
        {
            buffer.applyGain(globalVolume);
        }

        // 3.5 Soft-clip: proteger salida final contra clipping usando tanh
        // Con bypass activo (master_softclip_bypass) se deja la señal limpia.
        // El headroom (0..1 → 0..6 dB) sube la rodilla del tanh por encima de |1.0|
        // para no alterar el body de la señal; headroom = 0dB reproduce el comportamiento legacy.
        if (!masterSoftclipBypass)
        {
            const float headroom = std::pow(10.0f, (masterSoftclipHeadroom * DSP::kMasterSoftclipMaxHeadroomDb) / DSP::kDbPerVoltageRatio);
            for (int ch = 0; ch < buffer.getNumChannels(); ++ch)
            {
                auto* channelData = buffer.getWritePointer(ch);
                for (int s = 0; s < numSamples; ++s)
                    channelData[s] = DSP::masterSoftClip(channelData[s], headroom);
            }
        }

        // 4. Capturar muestras de audio reales para el osciloscopio en tiempo real
        {
            const int numCh = juce::jmin(2, buffer.getNumChannels());
            for (int s = 0; s < numSamples; ++s)
            {
                for (int ch = 0; ch < numCh; ++ch)
                    audioCaptureBuffer[audioCaptureWritePos * 2 + ch] = buffer.getSample(ch, s);
                audioCaptureWritePos = (audioCaptureWritePos + 1) % kAudioCaptureSize;
            }
        }

        // 5. Copiar snapshot de estado de voces para el DebugPanel (bajo lock rápido)
        updateVoiceSnapshot();
    }
}

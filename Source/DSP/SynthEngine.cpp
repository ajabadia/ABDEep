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
        calibrationBuffers[0] = activeCalibration;
        calibrationBuffers[1] = activeCalibration;
        masterScopeTap.setActive(true);
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
        controlSeqBuffer.resize(samplesPerBlock);
        controlSeqBuffer.fill(0.0f);

        // Preparar Arpegiador y Secuenciador de Control
        arpeggiator.prepare(sampleRate);
        controlSequencer.prepare(sampleRate);

        // Un buffer de modulacion de nivel por hueco del bus de fx. Cuatro, no
        // uno comido: el bus procesa hueco a hueco y `setSlotModulation` toma el
        // puntero del que le toca.
        fxLevelMod.resize(4);

        for (int s = 0; s < 4; ++s)
            fxLevelMod[s].resize(samplesPerBlock);

        // Preparar FX Engine
        fxEngine.prepare(sampleRate, samplesPerBlock);

        // Preparar HPF global (post-VCA, un filtro por canal)
        globalHpf[0].prepare(sampleRate);
        globalHpf[1].prepare(sampleRate);

        // Sincronizar el VoiceAllocator con las voces recién inicializadas.
        // (El constructor de SynthEngine no reseta voiceAlloc explícitamente,
        // y prepare puede ser llamado varias veces durante la vida del engine.)
        voiceAlloc.reset();
        lastGlobalVolume = globalVolume;
        globalVolumeInitialized = false;
    }

    // Los ocho destinos del bus de fx, en el orden del enum (74-81). Se leen
    // del enum en vez de escribir el numero, para que el 74 viva en un sitio.
    static ModDestination destinoFxParametros(int hueco)
    {
        switch (hueco)
        {
            case 0:  return ModDestination::kFx1Parameters;
            case 1:  return ModDestination::kFx2Parameters;
            case 2:  return ModDestination::kFx3Parameters;
            case 3:  return ModDestination::kFx4Parameters;
            default: return ModDestination::kNone;
        }
    }

    static ModDestination destinoFxNivel(int hueco)
    {
        switch (hueco)
        {
            case 0:  return ModDestination::kFx1Level;
            case 1:  return ModDestination::kFx2Level;
            case 2:  return ModDestination::kFx3Level;
            case 3:  return ModDestination::kFx4Level;
            default: return ModDestination::kNone;
        }
    }

    void SynthEngine::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
    {
        juce::ScopedNoDenormals noDenormals;
        const juce::SpinLock::ScopedLockType processLock(engineProcessSpinLock);

        if (pendingPanic.exchange(false, std::memory_order_acq_rel))
        {
            for (int i = 0; i < kNumVoices; ++i)
                voices[i].stopNote(true);
            voiceAlloc.reset();
            arpeggiator.allNotesOff();
            std::memset(polyChordHeldNotes, 0, sizeof(polyChordHeldNotes));
            polyChordNoteCount = 0;
            std::memset(monoHeldNotes, 0, sizeof(monoHeldNotes));
            monoHeldNoteCount = 0;
            sustainLatchCount = 0;
            currentPeakLevel = 0.0f;
        }

        // 0. Pre-calcular buffers de LFO global y ControlSequencer para todo el bloque
        const int numSamples = buffer.getNumSamples();
        if (numSamples > globalLfo1Buffer.size())
        {
            globalLfo1Buffer.resize(numSamples);
            globalLfo2Buffer.resize(numSamples);
            controlSeqBuffer.resize(numSamples);

            for (int s = 0; s < fxLevelMod.size(); ++s)
                fxLevelMod[s].resize(numSamples);
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

        // Resolver modulación de Arp Gate (71) y Seq Slew (72) desde fuentes comunes
        // ANTES de procesar el MIDI del bloque (ver SynthEngineUnitTests_ArpSeq.cpp:106-108 y 647-649).
        const bool arpOn = arpeggiator.isEnabled();
        const bool seqOn = controlSequencer.isEnabled();
        {
            float arpCommonSources[(int)ModSource::kMaxSources] = {};
            arpCommonSources[(int)ModSource::kPitchBend]        = currentPitchBend;
            arpCommonSources[(int)ModSource::kModWheel]         = currentModWheel;
            arpCommonSources[(int)ModSource::kKeyPressure]      = currentAftertouch;
            arpCommonSources[(int)ModSource::kSustainPedal]     = currentSustainPedal;
            arpCommonSources[(int)ModSource::kFootController]   = currentFootController;
            arpCommonSources[(int)ModSource::kBreathController] = currentBreathController;
            arpCommonSources[(int)ModSource::kExpressionPedal]  = currentExpressionPedal;
            if (numSamples > 0)
            {
                arpCommonSources[(int)ModSource::kLFO1]    = globalLfo1Buffer[0];
                arpCommonSources[(int)ModSource::kLFO2]    = globalLfo2Buffer[0];
                arpCommonSources[(int)ModSource::kLFO1Uni] = globalLfo1Buffer[0] * 0.5f + 0.5f;
                arpCommonSources[(int)ModSource::kLFO2Uni] = globalLfo2Buffer[0] * 0.5f + 0.5f;
            }

            const float gateMod = modMatrix.getModulationValue(ModDestination::kArpGate, arpCommonSources);
            arpeggiator.setGate(juce::jlimit(0.0f, 1.0f, arpGateBase + gateMod));

            const float slewMod = modMatrix.getModulationValue(ModDestination::kSeqSlew, arpCommonSources);
            controlSequencer.setSlewModulation(slewMod);
        }

        // Pre-calcular buffer del ControlSequencer muestra a muestra para el bloque
        for (int s = 0; s < numSamples; ++s)
            controlSeqBuffer.set(s, seqOn ? controlSequencer.nextSample() : 0.0f);

        buffer.clear();

        // 1.5. Resolve calibration snapshot for this block (immutable during processing, 100% lock-free)
#if DEEP_TARGET_MODEL >= 2
        {
            const int calIdx = activeCalibrationIndex.load (std::memory_order_acquire);
            activeCalibration = calibrationBuffers[calIdx];
        }

        // Propagate calibration to all voices (immutable pointer for the block)
        for (int i = 0; i < kNumVoices; ++i)
            voices[i].setCalibration(&activeCalibration);
#endif
        const DiagnosticTonePoint diagPoint = diagTonePoint_.load(std::memory_order_relaxed);
        const float diagFreq = testToneFrequency_.load(std::memory_order_relaxed);
        const float diagLevel = testToneLevel_.load(std::memory_order_relaxed);
        for (int i = 0; i < kNumVoices; ++i)
            voices[i].setDiagnosticToneConfig(static_cast<int>(diagPoint), diagFreq, diagLevel);

        // 2. Procesar eventos MIDI en orden cronológico con timing a nivel de muestra.
        // El buffer se renderiza por segmentos: cada evento se aplica en su samplePosition
        // exacto (note on/off, pitch bend, CC, aftertouch) en lugar de aplicarse todos en
        // la muestra 0 del bloque, logrando timing sample-accurate.
        int renderPos = 0;
        const float* seqPtr = controlSeqBuffer.getRawDataPointer();

        auto renderSegment = [&](int endPos)
        {
            endPos = std::clamp(endPos, renderPos, numSamples);
            if (endPos <= renderPos)
                return;

            for (int i = 0; i < kNumVoices; ++i)
                voices[i].process(buffer, renderPos, endPos - renderPos, modMatrix,
                                  globalLfo1Buffer.getRawDataPointer(),
                                  globalLfo2Buffer.getRawDataPointer(),
                                  lfo1MonoMode, lfo2MonoMode, seqPtr);
            renderPos = endPos;
        };

        auto renderTo = [&](int endPos)
        {
            endPos = std::clamp(endPos, renderPos, numSamples);
            if (endPos <= renderPos)
                return;

            if (arpOn)
            {
                const int segOrigin = renderPos;
                const int segLen = endPos - renderPos;
                arpeggiator.generate(segLen, [&](const Arpeggiator::NoteEvent& ev)
                {
                    const int absSample = std::clamp(segOrigin + ev.sampleOffset, segOrigin, endPos);
                    renderSegment(absSample);
                    if (ev.isNoteOn)
                        triggerNote(ev.note, ev.velocity);
                    else
                        releaseNote(ev.note);
                });
            }

            renderSegment(endPos);
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
                if (arpOn)
                    arpeggiator.noteOn(transposedNote, msg.getFloatVelocity());
                else
                    triggerNote(transposedNote, msg.getFloatVelocity());
            }
            else if (msg.isNoteOff())
            {
                int transposedNote = std::clamp(msg.getNoteNumber() + transposeSemitones, 0, 127);
                float relVel = msg.getFloatVelocity();
                for (int i = 0; i < kNumVoices; ++i)
                {
                    if (voices[i].isActive() && voices[i].getRootNote() == transposedNote)
                        voices[i].setExternalModulation(ModSource::kReleaseVelocity, relVel);
                }
                if (arpOn)
                    arpeggiator.noteOff(transposedNote);
                else
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
                else if (ccNum == 2) // Breath Controller
                {
                    currentBreathController = ccVal;
                    for (int i = 0; i < kNumVoices; ++i)
                        voices[i].setExternalModulation(ModSource::kBreathController, currentBreathController);
                }
                else if (ccNum == 4) // Foot Controller
                {
                    currentFootController = ccVal;
                    for (int i = 0; i < kNumVoices; ++i)
                        voices[i].setExternalModulation(ModSource::kFootController, currentFootController);
                }
                else if (ccNum == 11) // Expression Pedal
                {
                    currentExpressionPedal = ccVal;
                    for (int i = 0; i < kNumVoices; ++i)
                        voices[i].setExternalModulation(ModSource::kExpressionPedal, currentExpressionPedal);
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
            else if (msg.isChannelPressure()) // Channel Aftertouch (monophonic)
            {
                currentAftertouch = (float)msg.getChannelPressureValue() / 127.0f;
                for (int i = 0; i < kNumVoices; ++i)
                    voices[i].setExternalModulation(ModSource::kKeyPressure, currentAftertouch);
            }
            else if (msg.isAftertouch()) // Polyphonic Key Pressure (per-note aftertouch)
            {
                int targetNote = std::clamp(msg.getNoteNumber() + transposeSemitones, 0, 127);
                float polyAt = (float)msg.getAfterTouchValue() / 127.0f;
                currentAftertouch = polyAt;
                for (int i = 0; i < kNumVoices; ++i)
                {
                    if (voices[i].isActive() && (voices[i].getMidiNote() == targetNote || voices[i].getRootNote() == targetNote))
                        voices[i].setExternalModulation(ModSource::kKeyPressure, polyAt);
                }
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
            commonSources[(int)ModSource::kPitchBend]        = currentPitchBend;
            commonSources[(int)ModSource::kModWheel]         = currentModWheel;
            commonSources[(int)ModSource::kKeyPressure]      = currentAftertouch;
            commonSources[(int)ModSource::kSustainPedal]     = currentSustainPedal;
            commonSources[(int)ModSource::kFootController]   = currentFootController;
            commonSources[(int)ModSource::kBreathController] = currentBreathController;
            commonSources[(int)ModSource::kExpressionPedal]  = currentExpressionPedal;

            const int numCh = juce::jmin(2, buffer.getNumChannels());
            // `Fx N Parameters` se decide UNA vez por bloque, con las fuentes en
            // su valor de la primera muestra: el efecto los lee una vez por
            // bloque (ver `FXSlot::process` para el por que).
            if (numSamples > 0)
            {
                commonSources[(int)ModSource::kLFO1]             = globalLfo1Buffer[0];
                commonSources[(int)ModSource::kLFO2]             = globalLfo2Buffer[0];
                commonSources[(int)ModSource::kLFO1Uni]          = globalLfo1Buffer[0] * 0.5f + 0.5f;
                commonSources[(int)ModSource::kLFO2Uni]          = globalLfo2Buffer[0] * 0.5f + 0.5f;
                commonSources[(int)ModSource::kControlSequencer] = controlSeqBuffer[0];
            }

            for (int h = 0; h < 4; ++h)
                fxParamMod[h] = modMatrix.getModulationValue(destinoFxParametros(h), commonSources);

            for (int s = 0; s < numSamples; ++s)
            {
                commonSources[(int)ModSource::kLFO1]             = globalLfo1Buffer[s];
                commonSources[(int)ModSource::kLFO2]             = globalLfo2Buffer[s];
                commonSources[(int)ModSource::kLFO1Uni]          = globalLfo1Buffer[s] * 0.5f + 0.5f;
                commonSources[(int)ModSource::kLFO2Uni]          = globalLfo2Buffer[s] * 0.5f + 0.5f;
                commonSources[(int)ModSource::kControlSequencer] = controlSeqBuffer[s];

                // `Fx N Level` si es muestra a muestra, y en el MISMO bucle que
                // el resto de la matriz y con las MISMAS fuentes, para que un
                // LFO que mueve el cutoff mueva tambien la ganancia del bus con
                // la misma fase y no con otra copia del LFO que un dia se
                // desfasara.
                for (int h = 0; h < 4; ++h)
                    fxLevelMod[h].set(s, modMatrix.getModulationValue(destinoFxNivel(h), commonSources));

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

        auto injectBusTone = [&](DiagnosticTonePoint targetPoint)
        {
            if (diagPoint != targetPoint || sampleRate <= 0.0)
                return;
            const int numCh = buffer.getNumChannels();
            const double phaseInc = static_cast<double>(diagFreq) / sampleRate;
            for (int s = 0; s < numSamples; ++s)
            {
                const float tone = std::sin(static_cast<float>(2.0 * 3.14159265358979323846 * testTonePhase_)) * diagLevel;
                testTonePhase_ += phaseInc;
                if (testTonePhase_ >= 1.0)
                    testTonePhase_ -= 1.0;
                for (int ch = 0; ch < numCh; ++ch)
                    buffer.addSample(ch, s, tone);
            }
        };

        // ── Point 3: Pre-Effects (Injects after voices/HPF, before FXEngine) ──
        injectBusTone(DiagnosticTonePoint::PreEffects);

        {
            const int numCh = juce::jmin(2, buffer.getNumChannels());
            if (numCh >= 2)
                preFxScopeTap.writeStereo(buffer.getReadPointer(0), buffer.getReadPointer(1), static_cast<size_t>(numSamples));
            else if (numCh == 1)
                preFxScopeTap.writeStereo(buffer.getReadPointer(0), buffer.getReadPointer(0), static_cast<size_t>(numSamples));
        }

        // El bus de fx recibe su modulacion ANTES de procesar, y la consume en
        // el mismo `process`: los punteros de nivel valen lo que dura este
        // bloque, y por eso no se copian.
        for (int h = 0; h < 4; ++h)
            fxEngine.setSlotModulation(h, fxLevelMod[h].getRawDataPointer(), fxParamMod[h], numSamples);

        // Procesar FX Engine (post-voices, pre-master gain)
        fxEngine.process(buffer);

        // ── Point 2: Pre-Master Volume (Injects after FXEngine, before master gain) ──
        injectBusTone(DiagnosticTonePoint::PreMasterVolume);

        // Aplicar Master Gain (global_volume) a todo el buffer de salida con rampa suave
        // Nota: globalVolume viene clampeado a [0, 2] desde updateParameters
        if (!globalVolumeInitialized)
        {
            lastGlobalVolume = globalVolume;
            globalVolumeInitialized = true;
        }
        if (std::abs(globalVolume - lastGlobalVolume) > 1.0e-5f)
        {
            buffer.applyGainRamp(0, numSamples, lastGlobalVolume, globalVolume);
            lastGlobalVolume = globalVolume;
        }
        else if (std::abs(globalVolume - 1.0f) > 0.001f)
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

        // ── Point 1: Post-Master Volume (Injects directly to final output bus) ──
        injectBusTone(DiagnosticTonePoint::PostMasterVolume);

        if (diagPoint != DiagnosticTonePoint::Disabled)
            currentPeakLevel = std::max(currentPeakLevel, buffer.getMagnitude(0, numSamples));

        // 4. Capturar muestras de audio reales para el osciloscopio en tiempo real y ABDShared::ScopeCore
        {
            const int numCh = juce::jmin(2, buffer.getNumChannels());
            int writePos = audioCaptureWritePos.load(std::memory_order_relaxed);
            for (int s = 0; s < numSamples; ++s)
            {
                for (int ch = 0; ch < numCh; ++ch)
                    audioCaptureBuffer[writePos * 2 + ch] = buffer.getSample(ch, s);
                writePos = (writePos + 1) % kAudioCaptureSize;
            }
            audioCaptureWritePos.store(writePos, std::memory_order_release);

            if (numCh >= 2)
                masterScopeTap.writeStereo(buffer.getReadPointer(0), buffer.getReadPointer(1), static_cast<size_t>(numSamples));
            else if (numCh == 1)
                masterScopeTap.writeStereo(buffer.getReadPointer(0), buffer.getReadPointer(0), static_cast<size_t>(numSamples));
        }

        // 5. Publicar snapshot lock-free de estado de voces para DebugPanel y CalibrationLab
        updateVoiceSnapshot();
    }
}

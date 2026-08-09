#include "SynthVoice.h"
#include <cmath>
#if DEEP_TARGET_MODEL >= 2
#include "../Core/CalibrationSpec.h"
#endif

namespace ABD
{
    void SynthVoice::startNote(int midiNoteNumber, float velocity, float voiceIndexNormalized)
    {
        // Usar currentMidiNote si es válido (legato normal), o lastMidiNote (preservado por force-stop)
        float previousPitch = ((float)currentMidiNote >= 0.0f)
            ? (float)currentMidiNote
            : (float)lastMidiNote;
        bool wasActive = isActive();

        // Preservar para futuros force-stops antes de sobrescribir
        lastMidiNote = currentMidiNote;
        currentMidiNote = midiNoteNumber;
        noteVelocity = velocity;
        voiceIndex = voiceIndexNormalized;

        // Reset anti-click stealing fade gain & smoothed amp gain
        stealingFadeGain = 1.0f;
        smoothedAmpLevel = 0.0f;

        // --- Portamento / Glide initialization ---
        targetPortaPitch = (float)midiNoteNumber;

        bool hadPreviousNote = (previousPitch >= 0.0f);   // hubo nota anterior (incluso si force-stopped)
        bool isLegato = hadPreviousNote && wasActive;       // legato si la voz sigue activa
        bool isFingeredMode = (params.portaMode == 1 || params.portaMode == 3 || params.portaMode == 5);

        if (params.portaTime <= 0.0f || !hadPreviousNote)
        {
            // Sin nota anterior: salto directo (no puede glidear hacia ningún lado)
            currentPortaPitch = targetPortaPitch;
            portaActive = false;
        }
        else if (isFingeredMode && !isLegato)
        {
            // Fingered + staccato: salto directo (glide solo en legato)
            currentPortaPitch = targetPortaPitch;
            portaActive = false;
        }
        else
        {
            // Normal / Fix-Rate / Exp / Fingered+Legato: glide desde la nota anterior
            currentPortaPitch = previousPitch;
            // Fixed+N pre-glide offset
            if (params.portaMode == 6)      currentPortaPitch += 2.0f;
            else if (params.portaMode == 7) currentPortaPitch -= 2.0f;
            else if (params.portaMode == 8) currentPortaPitch += 5.0f;
            else if (params.portaMode == 9) currentPortaPitch -= 5.0f;
            else if (params.portaMode == 10) currentPortaPitch += 12.0f;
            else if (params.portaMode == 11) currentPortaPitch -= 12.0f;
            else if (params.portaMode == 12) currentPortaPitch += 24.0f;
            else if (params.portaMode == 13) currentPortaPitch -= 24.0f;
            portaActive = true;
        }

        // Trigger Mode: Legato mode doesn't retrigger envelopes on overlapping notes
        // Retrig mode always retriggers (even on legato), same as Mono mode
        // Mono mode: standard retrigger (current behavior)
        bool doTriggerEnvs = true;
        if (params.triggerMode == 2 && isLegato)      // Legato mode + legato note: don't retrigger
            doTriggerEnvs = false;

        if (doTriggerEnvs)
        {
            env1VCA.trigger();
            env2VCF.trigger();
            env3MOD.trigger();
        }

        // Resetear estado de zero-crossing de LFOs para esta nota
        prevLfo1Sample = 0.0f;
        prevLfo2Sample = 0.0f;

        // En modo Poly (mono_mode=0), resetear LFOs normalmente.
        // En Mono (raw=1), el LFO local no avanza — usa valor global.
        // En Spread (raw>=2), fijar offset de fase inicial por voz.
        int rawLfo1MM = std::min(255, std::max(0, (int)std::round(lfo1MonoMode * 255.0f)));
        int rawLfo2MM = std::min(255, std::max(0, (int)std::round(lfo2MonoMode * 255.0f)));
        
        if (rawLfo1MM == 0)
            lfo1.trigger();
        else if (rawLfo1MM >= 2)
        {
            // Spread: offset de fase por voz, setPhase ya normaliza a [0,1)
            float spreadRaw = (float)(rawLfo1MM - 1) / 254.0f;
            double spreadCycles = spreadRaw * 4.0;
            lfo1.setPhase(voiceIndex * spreadCycles);
        }
        
        if (rawLfo2MM == 0)
            lfo2.trigger();
        else if (rawLfo2MM >= 2)
        {
            float spreadRaw = (float)(rawLfo2MM - 1) / 254.0f;
            double spreadCycles = spreadRaw * 4.0;
            lfo2.setPhase(voiceIndex * spreadCycles);
        }

        // OSC Key Down Reset: reiniciar fase de osciladores al presionar tecla
        if (params.oscKeyReset)
        {
            osc1.resetPhase();
            osc2.resetPhase();
            subPhase = 0.0;
        }

        prevOsc1Phase = osc1.getPhase();

        // Inicializar drift analógico para esta nota
        drift.resetForNote(voiceIndex);

        modSources[(int)ModSource::kNoteNumber] = (float)midiNoteNumber / 127.0f;
        modSources[(int)ModSource::kVelocity] = velocity;
        modSources[(int)ModSource::kVoiceNumber] = voiceIndex;
    }

    void SynthVoice::stopNote(bool force)
    {
        if (force)
        {
            // Preservar la nota antes de limpiar (necesario para Portamento en modo Mono)
            lastMidiNote = currentMidiNote;
            env1VCA.reset();
            env2VCF.reset();
            env3MOD.reset();
            currentMidiNote = -1;
        }
        else
        {
            // One-shot mode: ignore note-off, let envelope complete full cycle
            if (params.triggerMode != 3)
            {
                env1VCA.release();
                env2VCF.release();
                env3MOD.release();
            }
        }
    }
}

#pragma once

#include <functional>
#include <atomic>

#include <JuceHeader.h>
#include "Core/MidiProgramMap.h"
#include "Core/BankFileReader.h"
#include "Core/PatchByteCodec.h"
#include "ParameterRegistry.gen.h"

class ABDEepAudioProcessor;

namespace ABD
{

/**
 * PatchController — orquesta la recepción de Program Change / Bank Select
 * desde el hilo de audio y la aplicación del patch del banco correspondiente
 * al APVTS en el hilo de mensaje.
 *
 * Hilo de audio:  offerMidi() captura PC/BS y publica petición atómica.
 * Hilo de mensaje: timerCallback() (30 Hz) detecta petición nueva y aplica
 * el patch del banco (carga perezosa + APVTS setValueNotifyingHost).
 * También expone callbacks para el editor (UI) y persistencia del estado.
 */
class PatchController : private juce::Timer
{
public:
    using OnProgramChanged = std::function<void (int bankIdx, int progIdx, const juce::String& patchName)>;
    using OnBankLoadFailed = std::function<void (int bankIdx, const juce::String& reason)>;

    PatchController (juce::AudioProcessorValueTreeState& apvts,
                     const std::function<void (const juce::String&)>& setPresetNameFn);

    ~PatchController() override;

    // Hilo de audio: procesar buffer MIDI entrante (CC#32, PC)
    void offerMidi (const juce::MidiBuffer& midiMessages) noexcept;

    // Hilo de mensaje: forzar aplicación inmediata de un slot (usado en restore)
    void scheduleApply (int bankIdx, int progIdx);

    // Getters (acceso hilo mensaje)
    int getCurrentBank() const noexcept { return currentBank; }
    int getCurrentProgram() const noexcept { return currentProgram; }
    bool isBankLoaded (int bankIdx) const noexcept { return banks[bankIdx & 7].loaded; }
    MidiProgramMap& getMidiMap() noexcept { return midiMap; }
    const BankFileReader::BankData& getBankData (int bankIdx) const noexcept { return banks[bankIdx & 7]; }

    // Callback UI (seteado por editor)
    OnProgramChanged onProgramChanged;
    OnBankLoadFailed onBankLoadFailed;

private:
    void timerCallback() override;

    // Aplicación real (hilo mensaje): carga banco si hace falta, escribe APVTS
    void applyPatch (int bankIdx, int progIdx);

    // Codifica petición atómica: seq<<24 | bank<<16 | prog<<8 | 1
    void publishRequest (int bank, int prog) noexcept;

    juce::AudioProcessorValueTreeState& apvts;
    std::function<void (const juce::String&)> setPresetNameFn;

    MidiProgramMap midiMap;
    BankFileReader::BankData banks[8];

    // Estado actual confirmado (solo hilo mensaje)
    int currentBank = 0;
    int currentProgram = 0;
    juce::String currentPatchName;

    // Petición atómica del hilo audio
    std::atomic<std::uint64_t> requestWord { 0 };
    std::uint64_t lastSeenSeq = 0;
};

} // namespace ABD
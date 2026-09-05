#include "PatchController.h"
#include "PluginProcessor.h"
#include <algorithm>

namespace ABD
{

PatchController::PatchController (juce::AudioProcessorValueTreeState& apvtsRef,
                                  const std::function<void (const juce::String&)>& setPresetNameFnRef)
    : apvts (apvtsRef), setPresetNameFn (setPresetNameFnRef)
{
    startTimerHz (30);
}

PatchController::~PatchController()
{
    stopTimer();
}

void PatchController::offerMidi (const juce::MidiBuffer& midiMessages) noexcept
{
    // Leer filtro de canal MIDI (0 = Omni, 1-16 = canal específico)
    int midiChannelFilter = 0;
    if (auto* p = apvts.getParameter ("midi_channel"))
        midiChannelFilter = static_cast<int> (p->getValue());

    for (const auto meta : midiMessages)
    {
        const auto& msg = meta.getMessage();

        // Filtrar por canal MIDI si no es Omni
        if (midiChannelFilter > 0 && msg.getChannel() != midiChannelFilter)
            continue;

        if (msg.isController())
        {
            midiMap.feedController (msg.getControllerNumber(), msg.getControllerValue());
        }
        else if (msg.isProgramChange())
        {
            const auto slot = midiMap.feedProgramChange (msg.getProgramChangeNumber());
            if (slot.valid())
                publishRequest (slot.bank, slot.program);
        }
    }
}

void PatchController::timerCallback()
{
    // Leer petición atómica del hilo de audio
    const std::uint64_t word = requestWord.load (std::memory_order_relaxed);
    const std::uint64_t seq = word >> 24;
    const int bank = (word >> 16) & 0xFF;
    const int prog = (word >> 8) & 0xFF;
    const bool valid = (word & 0xFF) != 0;

    if (valid && seq != lastSeenSeq)
    {
        lastSeenSeq = seq;
        if (bank >= 0 && bank < 8 && prog >= 0 && prog < 128)
        {
            // Protección de ediciones sin guardar
            bool protect = false;
            bool dirty = false;
            if (auto* p = apvts.getParameter ("protect_unsaved_edits"))
                protect = p->getValue() > 0.5f;
            if (auto* p = apvts.getParameter ("patch_dirty"))
                dirty = p->getValue() > 0.5f;

            if (protect && dirty)
            {
                DBG ("[PatchController] PC ignorado: protect_unsaved_edits=on y patch_dirty=true");
                // Notificar UI de bloqueo
                if (onBankLoadFailed)
                    onBankLoadFailed (bank, "Protegido: hay ediciones sin guardar (active protect_unsaved_edits para desactivar)");
                return;
            }

            applyPatch (bank, prog);
        }
    }
}

void PatchController::scheduleApply (int bankIdx, int progIdx)
{
    if (bankIdx >= 0 && bankIdx < 8 && progIdx >= 0 && progIdx < 128)
        applyPatch (bankIdx, progIdx);
}

void PatchController::publishRequest (int bank, int prog) noexcept
{
    const std::uint64_t nextSeq = lastSeenSeq + 1;
    const std::uint64_t word = (nextSeq << 24) | (static_cast<std::uint64_t>(bank) << 16)
                             | (static_cast<std::uint64_t>(prog) << 8) | 1ULL;
    requestWord.store (word, std::memory_order_relaxed);
}

void PatchController::applyPatch (int bankIdx, int progIdx)
{
    // Cargar banco perezoso si no está en memoria
    auto& bankData = banks[bankIdx];
    if (!bankData.loaded)
    {
        char letter = BankFileReader::indexToLetter (bankIdx);
        if (!BankFileReader::loadBankFile (letter, bankData))
        {
            DBG ("[PatchController] No se pudo cargar banco " + juce::String (letter));
            // Notificar UI de error de carga
            if (onBankLoadFailed)
                onBankLoadFailed (bankIdx, "Archivo de banco no encontrado: " + juce::String (letter) + ".syx");
            return;
        }
    }

    if (progIdx >= BankFileReader::kPatchesPerBank)
        return;

    const auto& patchBytes = bankData.patches[progIdx];
    const juce::String patchName = bankData.names[progIdx];

    // Escribir APVTS: solo parámetros físicos (byteOffset < 242)
    for (const auto& p : Registry::kParameters)
    {
        if (p.byteOffset >= 242)
            continue; // extended/virtual no vienen del dump DM12

        if (auto* param = apvts.getParameter (p.id))
        {
            const float norm = PatchByteCodec::rawToNormalized (p.byteOffset, patchBytes[p.byteOffset]);
            param->setValueNotifyingHost (norm);
        }
    }

    // Actualizar estado confirmado
    currentBank = bankIdx;
    currentProgram = progIdx;
    currentPatchName = patchName.isEmpty() ? (juce::String ("Bank ") + BankFileReader::indexToLetter(bankIdx) + " Patch " + juce::String (progIdx + 1))
                                           : patchName;

    // Host preset name
    if (setPresetNameFn)
        setPresetNameFn (currentPatchName);

    // Notificar UI
    if (onProgramChanged)
        onProgramChanged (currentBank, currentProgram, currentPatchName);

    DBG ("[PatchController] Aplicado: Bank " + juce::String (BankFileReader::indexToLetter (currentBank))
         + " Prog " + juce::String (currentProgram + 1) + " (" + currentPatchName + ")");
}

} // namespace ABD
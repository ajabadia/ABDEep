#include "PatchDiffViewComponent.h"
#include "Core/MidiTranslationEngine.h"

// ============================================================
// Patch file loading (SysEx unpacking)
// ============================================================
void PatchDiffViewComponent::loadPatchA()
{
    loadPatchFromFile (true);
}

void PatchDiffViewComponent::loadPatchB()
{
    loadPatchFromFile (false);
}

void PatchDiffViewComponent::loadPatchFromFile (bool isA)
{
    juce::File currentFile (__FILE__);
    juce::File defaultDir = currentFile.getParentDirectory()
                                .getParentDirectory()
                                .getParentDirectory()
                                .getChildFile ("resources")
                                .getChildFile ("banks");

    fileChooser = std::make_unique<juce::FileChooser> (
        isA ? "Select Patch A SysEx" : "Select Patch B SysEx",
        defaultDir.exists() ? defaultDir : juce::File::getSpecialLocation (juce::File::userHomeDirectory),
        "*.syx"
    );

    fileChooser->launchAsync (juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles,
        [this, isA] (const juce::FileChooser& chooser)
        {
            auto file = chooser.getResult();
            if (file.existsAsFile())
            {
                juce::MemoryBlock mb;
                if (file.loadFileAsData (mb))
                {
                    const uint8_t* rawData = static_cast<const uint8_t*> (mb.getData());
                    size_t size = mb.getSize();

                    if (size > 7 && rawData[0] == 0xF0)
                    {
                        // rawData incluye F0 (MemoryBlock). Cabecera física: 10 bytes
                        // (cmd 0x02, program dump) u 8 (cmd 0x04, edit buffer).
                        const int headerLen = (size > 7 && rawData[6] == 0x02) ? 10 : 8;
                        auto unpacked = MidiTranslationEngine::unpackDeepMindSysEx (rawData + headerLen, size - headerLen);
                        if (unpacked.getSize() >= 242)
                        {
                            char nameBuf[17];
                            std::memcpy (nameBuf, (const char*)unpacked.getData() + 223, 16);
                            nameBuf[16] = '\0';
                            juce::String patchName (nameBuf);
                            patchName = patchName.trim();

                            if (isA)
                            {
                                unpacked.copyTo (patchA.data(), 0, 242);
                                loadAButton.setButtonText ("A: " + patchName);
                            }
                            else
                            {
                                unpacked.copyTo (patchB.data(), 0, 242);
                                loadBButton.setButtonText ("B: " + patchName);
                            }

                            runComparison();
                        }
                    }
                }
            }
        }
    );
}

#include "PatchDiffViewComponent.h"
#include "Core/MidiTranslationEngine.h"

PatchDiffViewComponent::PatchDiffViewComponent()
{
    // Cargar iniciales stubs vacíos
    patchA.fill (0);
    patchB.fill (0);

    addAndMakeVisible (loadAButton);
    loadAButton.onClick = [this] { loadPatchA(); };

    addAndMakeVisible (loadBButton);
    loadBButton.onClick = [this] { loadPatchB(); };

    addAndMakeVisible (swapButton);
    swapButton.onClick = [this] {
        std::swap (patchA, patchB);
        runComparison();
    };

    addAndMakeVisible (compareButton);
    compareButton.onClick = [this] {
        runComparison();
    };

    addAndMakeVisible (onlyDiffsToggle);
    onlyDiffsToggle.onClick = [this] { applyFilters(); };

    addAndMakeVisible (onlyAliasesToggle);
    onlyAliasesToggle.onClick = [this] { applyFilters(); };

    table.setModel (this);
    table.getHeader().addColumn ("Offset", colOffset, 60);
    table.getHeader().addColumn ("Region", colRegion, 90);
    table.getHeader().addColumn ("Param IDs", colParamIds, 130);
    table.getHeader().addColumn ("Raw A", colRawA, 60);
    table.getHeader().addColumn ("Raw B", colRawB, 60);
    table.getHeader().addColumn ("Delta", colDelta, 60);
    table.getHeader().addColumn ("Semantic A", colSemanticA, 100);
    table.getHeader().addColumn ("Semantic B", colSemanticB, 100);
    table.getHeader().addColumn ("Classification", colClassification, 110);
    addAndMakeVisible (table);

    runComparison();
}

void PatchDiffViewComponent::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colours::black);
}

void PatchDiffViewComponent::resized()
{
    auto area = getLocalBounds().reduced (10);
    
    // Top Bar controls
    auto topArea = area.removeFromTop (40);
    loadAButton.setBounds (topArea.removeFromLeft (120).reduced (2));
    loadBButton.setBounds (topArea.removeFromLeft (120).reduced (2));
    swapButton.setBounds (topArea.removeFromLeft (90).reduced (2));
    compareButton.setBounds (topArea.removeFromLeft (90).reduced (2));
    
    onlyDiffsToggle.setBounds (topArea.removeFromLeft (120).reduced (2));
    onlyAliasesToggle.setBounds (topArea.removeFromLeft (120).reduced (2));

    table.setBounds (area);
}

int PatchDiffViewComponent::getNumRows()
{
    return (int)filteredSemanticDiffs.size();
}

void PatchDiffViewComponent::paintRowBackground (juce::Graphics& g, int rowNumber, int width, int height, bool rowIsSelected)
{
    juce::ignoreUnused (rowNumber);
    if (rowIsSelected)
    {
        g.fillAll (juce::Colours::darkblue.withAlpha (0.4f));
    }
    else
    {
        g.fillAll (rowNumber % 2 == 0 ? juce::Colours::darkgrey.withAlpha (0.1f) : juce::Colours::transparentBlack);
    }
    g.setColour (juce::Colours::grey.withAlpha (0.2f));
    g.drawHorizontalLine (height - 1, 0.0f, (float)width);
}

void PatchDiffViewComponent::paintCell (juce::Graphics& g, int rowNumber, int columnId, int width, int height, bool rowIsSelected)
{
    if (rowNumber >= (int)filteredSemanticDiffs.size()) return;
    const auto& diff = filteredSemanticDiffs[(size_t)rowNumber];

    g.setFont (13.0f);
    
    // Color por clasificación (DIF-01D)
    juce::Colour textColour = rowIsSelected ? juce::Colours::white : juce::Colours::lightgrey;
    if (diff.classification == "alias-shared")
        textColour = juce::Colours::cyan;
    else if (diff.classification == "semantic-only")
        textColour = juce::Colours::yellow;
    else if (diff.classification == "stub")
        textColour = juce::Colours::orange;
    else if (diff.classification == "unknown-contract")
        textColour = juce::Colours::coral;

    g.setColour (textColour);

    // Raw A/B resolving
    uint8_t rawValA = patchA[(size_t)diff.offset];
    uint8_t rawValB = patchB[(size_t)diff.offset];
    int delta = std::abs ((int)rawValA - (int)rawValB);

    juce::String text;
    switch (columnId)
    {
        case colOffset:        text = juce::String (diff.offset); break;
        case colRegion:        text = PatchDiffEngine::classifyByteOffset (diff.offset); break;
        case colParamIds:      text = diff.paramId; break;
        case colRawA:          text = juce::String (rawValA); break;
        case colRawB:          text = juce::String (rawValB); break;
        case colDelta:         text = juce::String (delta); break;
        case colSemanticA:     text = diff.semanticValA; break;
        case colSemanticB:     text = diff.semanticValB; break;
        case colClassification: text = diff.classification; break;
    }

    g.drawText (text, 4, 0, width - 8, height, juce::Justification::centredLeft, true);
}

void PatchDiffViewComponent::runComparison()
{
    activeReport = PatchDiffEngine::diffSemanticParams (patchA, patchB);
    applyFilters();
}

void PatchDiffViewComponent::applyFilters()
{
    filteredSemanticDiffs.clear();
    
    bool diffsOnly = onlyDiffsToggle.getToggleState();
    bool aliasesOnly = onlyAliasesToggle.getToggleState();

    for (const auto& sd : activeReport.semanticDiffs)
    {
        uint8_t rawValA = patchA[(size_t)sd.offset];
        uint8_t rawValB = patchB[(size_t)sd.offset];

        if (diffsOnly && (rawValA == rawValB))
            continue;
            
        if (aliasesOnly && (sd.classification != "alias-shared"))
            continue;

        filteredSemanticDiffs.push_back (sd);
    }
    
    table.updateContent();
    table.repaint();
}

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
    juce::File defaultDir = currentFile.getParentDirectory().getParentDirectory().getParentDirectory().getChildFile ("resources").getChildFile ("banks");

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

                    if (size > 8 && rawData[0] == 0xF0)
                    {
                        auto unpacked = MidiTranslationEngine::unpackDeepMindSysEx (rawData + 8, size - 8);
                        if (unpacked.getSize() >= 242)
                        {
                            char nameBuf[17];
                            std::memcpy (nameBuf, (const char*)unpacked.getData() + 224, 16);
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

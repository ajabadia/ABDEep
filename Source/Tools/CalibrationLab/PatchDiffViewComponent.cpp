#include "PatchDiffViewComponent.h"

// ============================================================
// Patch Diff Viewer — UI lifecycle
// Comparison logic and table rendering are in _File.cpp and _Table.cpp
// ============================================================
PatchDiffViewComponent::PatchDiffViewComponent()
{
    // Initialize empty stubs
    patchA.fill (0);
    patchB.fill (0);

    // Buttons
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
    compareButton.onClick = [this] { runComparison(); };

    addAndMakeVisible (onlyDiffsToggle);
    onlyDiffsToggle.onClick = [this] { applyFilters(); };

    addAndMakeVisible (onlyAliasesToggle);
    onlyAliasesToggle.onClick = [this] { applyFilters(); };

    // Table columns
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

    // Initial diff
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

// ============================================================
// Diff engine
// ============================================================
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

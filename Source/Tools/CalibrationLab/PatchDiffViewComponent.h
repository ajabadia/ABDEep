#pragma once

#include <JuceHeader.h>
#include "Core/PatchDiffTypes.h"

class PatchDiffViewComponent : public juce::Component,
                               public juce::TableListBoxModel
{
public:
    PatchDiffViewComponent();
    ~PatchDiffViewComponent() override = default;

    void paint (juce::Graphics& g) override;
    void resized() override;

    // Métodos de TableListBoxModel
    int getNumRows() override;
    void paintRowBackground (juce::Graphics& g, int rowNumber, int width, int height, bool rowIsSelected) override;
    void paintCell (juce::Graphics& g, int rowNumber, int columnId, int width, int height, bool rowIsSelected) override;

    enum ColumnIds
    {
        colOffset = 1,
        colRegion,
        colParamIds,
        colRawA,
        colRawB,
        colDelta,
        colSemanticA,
        colSemanticB,
        colClassification
    };

private:
    std::array<uint8_t, 242> patchA;
    std::array<uint8_t, 242> patchB;

    juce::TextButton loadAButton { "Load A (Neutral)" };
    juce::TextButton loadBButton { "Load B (Modified)" };
    juce::TextButton swapButton { "Swap A/B" };
    juce::TextButton compareButton { "Run Diff" };

    juce::ToggleButton onlyDiffsToggle { "Only Differences" };
    juce::ToggleButton onlyAliasesToggle { "Only Aliases" };

    juce::TableListBox table;
    PatchDiffReport activeReport;
    std::vector<PatchSemanticDiff> filteredSemanticDiffs;

    std::unique_ptr<juce::FileChooser> fileChooser;
    void loadPatchA();
    void loadPatchB();
    void loadPatchFromFile (bool isA);

    void runComparison();
    void applyFilters();

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (PatchDiffViewComponent)
};

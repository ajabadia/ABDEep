#pragma once

#include <JuceHeader.h>
#include "Core/RoundTripValidator.h"

class RoundTripViewComponent : public juce::Component,
                               public juce::TableListBoxModel
{
public:
    RoundTripViewComponent();
    ~RoundTripViewComponent() override = default;

    void paint (juce::Graphics& g) override;
    void resized() override;

    // Métodos de TableListBoxModel
    int getNumRows() override;
    void paintRowBackground (juce::Graphics& g, int rowNumber, int width, int height, bool rowIsSelected) override;
    void paintCell (juce::Graphics& g, int rowNumber, int columnId, int width, int height, bool rowIsSelected) override;

    enum ColumnIds
    {
        colOffset = 1,
        colParamIds,
        colRawOriginal,
        colNormalized,
        colRawRebuilt,
        colDelta,
        colClassification
    };

private:
    std::array<uint8_t, 242> originalBytes;

    juce::TextButton loadRandomButton { "Load Random Data" };
    juce::TextButton runValidationButton { "Run Validation" };
    juce::ToggleButton hideExactToggle { "Hide Exact Matches" };

    // Summary labels
    juce::Label statusLabel;
    juce::Label countsLabel;

    juce::TableListBox table;
    RoundTripReport activeReport;
    std::vector<RoundTripDiffEntry> filteredEntries;

    void runValidation();
    void applyFilters();

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (RoundTripViewComponent)
};

#include "PatchDiffViewComponent.h"

// ============================================================
// TableListBoxModel implementation
// ============================================================
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

    // Colour by classification
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

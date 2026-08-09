#include "LiveValidationViewComponent.h"

// ============================================================================
// TableListBoxModel: numero de filas
// ============================================================================
int LiveValidationViewComponent::getNumRows()
{
    return (int)rows.size();
}

// ============================================================================
// TableListBoxModel: fondo de fila
// ============================================================================
void LiveValidationViewComponent::paintRowBackground (juce::Graphics& g, int rowNumber,
                                                       int width, int height, bool rowIsSelected)
{
    juce::ignoreUnused (rowNumber);
    if (rowIsSelected)
        g.fillAll (juce::Colours::darkblue.withAlpha (0.4f));
    else
        g.fillAll (rowNumber % 2 == 0 ? juce::Colours::darkgrey.withAlpha (0.1f) : juce::Colours::transparentBlack);

    g.setColour (juce::Colours::grey.withAlpha (0.2f));
    g.drawHorizontalLine (height - 1, 0.0f, (float)width);
}

// ============================================================================
// TableListBoxModel: pintado de celda con clasificacion por color
// ============================================================================
void LiveValidationViewComponent::paintCell (juce::Graphics& g, int rowNumber, int columnId,
                                              int width, int height, bool rowIsSelected)
{
    if (rowNumber >= (int)rows.size()) return;
    const auto& r = rows[(size_t)rowNumber];

    g.setFont (13.0f);

    juce::Colour textColour = rowIsSelected ? juce::Colours::white : juce::Colours::lightgrey;
    if (r.classification == "mismatch")
        textColour = juce::Colours::coral;
    else if (r.classification == "match")
        textColour = juce::Colours::lightgreen;
    else if (r.classification == "within-tolerance")
        textColour = juce::Colours::yellow;
    else if (r.classification == "not-observable")
        textColour = juce::Colours::grey;

    g.setColour (textColour);

    juce::String text;
    switch (columnId)
    {
        case colParamId:        text = r.paramId; break;
        case colVoice:          text = r.voiceIndex >= 0 ? juce::String (r.voiceIndex) : "Global"; break;
        case colBase:           text = r.baseValStr; break;
        case colEffective:      text = r.effectiveValStr; break;
        case colExpected:       text = r.expectedValStr; break;
        case colDelta:          text = r.deltaStr; break;
        case colTolerance:      text = r.toleranceStr; break;
        case colClassification: text = r.classification; break;
        case colNotes:          text = r.notes; break;
    }

    g.drawText (text, 4, 0, width - 8, height, juce::Justification::centredLeft, true);
}

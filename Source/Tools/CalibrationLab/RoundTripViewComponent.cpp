#include "RoundTripViewComponent.h"
#include <random>

RoundTripViewComponent::RoundTripViewComponent()
{
    // Cargar stubs iniciales con valores secuenciales por defecto
    for (size_t i = 0; i < 242; ++i)
        originalBytes[i] = static_cast<uint8_t>(i % 256);

    addAndMakeVisible (loadRandomButton);
    loadRandomButton.onClick = [this] {
        std::random_device rd;
        std::mt19937 gen (rd());
        std::uniform_int_distribution<> dis (0, 255);
        for (size_t i = 0; i < 242; ++i)
            originalBytes[i] = static_cast<uint8_t> (dis(gen));
        runValidation();
    };

    addAndMakeVisible (runValidationButton);
    runValidationButton.onClick = [this] {
        runValidation();
    };

    addAndMakeVisible (hideExactToggle);
    hideExactToggle.onClick = [this] { applyFilters(); };

    // Etiquetas de estado
    statusLabel.setFont (juce::Font (16.0f, juce::Font::bold));
    addAndMakeVisible (statusLabel);

    countsLabel.setFont (juce::Font (13.0f));
    addAndMakeVisible (countsLabel);

    table.setModel (this);
    table.getHeader().addColumn ("Offset", colOffset, 60);
    table.getHeader().addColumn ("Param IDs", colParamIds, 150);
    table.getHeader().addColumn ("Original Raw", colRawOriginal, 90);
    table.getHeader().addColumn ("Normalized", colNormalized, 90);
    table.getHeader().addColumn ("Rebuilt Raw", colRawRebuilt, 90);
    table.getHeader().addColumn ("Delta", colDelta, 60);
    table.getHeader().addColumn ("Classification", colClassification, 130);
    addAndMakeVisible (table);

    runValidation();
}

void RoundTripViewComponent::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colours::black);
}

void RoundTripViewComponent::resized()
{
    auto area = getLocalBounds().reduced (10);
    
    // Top Bar controls
    auto topArea = area.removeFromTop (45);
    loadRandomButton.setBounds (topArea.removeFromLeft (140).reduced (2));
    runValidationButton.setBounds (topArea.removeFromLeft (120).reduced (2));
    hideExactToggle.setBounds (topArea.removeFromLeft (140).reduced (2));

    // Summary bar
    auto summaryArea = area.removeFromTop (30);
    statusLabel.setBounds (summaryArea.removeFromLeft (150));
    countsLabel.setBounds (summaryArea);

    table.setBounds (area);
}

int RoundTripViewComponent::getNumRows()
{
    return (int)filteredEntries.size();
}

void RoundTripViewComponent::paintRowBackground (juce::Graphics& g, int rowNumber, int width, int height, bool rowIsSelected)
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

void RoundTripViewComponent::paintCell (juce::Graphics& g, int rowNumber, int columnId, int width, int height, bool rowIsSelected)
{
    if (rowNumber >= (int)filteredEntries.size()) return;
    const auto& entry = filteredEntries[(size_t)rowNumber];

    g.setFont (13.0f);
    
    // Color por clasificación (VAL-01D)
    juce::Colour textColour = rowIsSelected ? juce::Colours::white : juce::Colours::lightgrey;
    if (entry.classification == "mismatch")
        textColour = juce::Colours::red;
    else if (entry.classification == "within-tolerance")
        textColour = juce::Colours::yellow;
    else if (entry.classification == "name-byte")
        textColour = juce::Colours::cyan;
    else if (entry.classification == "special-case")
        textColour = juce::Colours::lightgrey.withAlpha (0.6f);

    g.setColour (textColour);

    juce::String text;
    switch (columnId)
    {
        case colOffset:        text = juce::String (entry.byteOffset); break;
        case colParamIds:      text = entry.paramIds.joinIntoString (", "); break;
        case colRawOriginal:   text = juce::String (entry.rawOriginal); break;
        case colNormalized:    text = juce::String (entry.semanticNormalized, 4); break;
        case colRawRebuilt:    text = juce::String (entry.rawRebuilt); break;
        case colDelta:         text = juce::String (entry.delta); break;
        case colClassification: text = entry.classification; break;
    }

    g.drawText (text, 4, 0, width - 8, height, juce::Justification::centredLeft, true);
}

void RoundTripViewComponent::runValidation()
{
    activeReport = RoundTripValidator::validateUnpackedBytes (originalBytes);
    
    // Configurar estado global visual
    if (activeReport.mismatches == 0)
    {
        statusLabel.setText ("STATUS: PASS", juce::dontSendNotification);
        statusLabel.setColour (juce::Label::textColourId, juce::Colours::lightgreen);
    }
    else
    {
        statusLabel.setText ("STATUS: FAIL", juce::dontSendNotification);
        statusLabel.setColour (juce::Label::textColourId, juce::Colours::coral);
    }

    countsLabel.setText (juce::String::formatted ("Exact: %d | Tolerated: %d | Mismatches: %d | Name Bytes: %d",
                                                 activeReport.exactMatches,
                                                 activeReport.withinTolerance,
                                                 activeReport.mismatches,
                                                 activeReport.nameBytesCount),
                         juce::dontSendNotification);

    applyFilters();
}

void RoundTripViewComponent::applyFilters()
{
    filteredEntries.clear();
    bool hideExact = hideExactToggle.getToggleState();

    for (const auto& entry : activeReport.entries)
    {
        if (hideExact && entry.classification == "exact")
            continue;

        filteredEntries.push_back (entry);
    }
    
    table.updateContent();
    table.repaint();
}

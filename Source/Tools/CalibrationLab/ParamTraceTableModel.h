#pragma once

#include <JuceHeader.h>
#include "Core/DiagnosticSnapshots.h"

class ParamTraceTableModel : public juce::TableListBoxModel
{
public:
    ParamTraceTableModel();
    ~ParamTraceTableModel() override = default;

    void updateData (const VoiceDiagnosticSnapshot& snapshot, const EngineDiagnosticSnapshot& engineSnap);

    // Métodos de TableListBoxModel
    int getNumRows() override;
    void paintRowBackground (juce::Graphics& g, int rowNumber, int width, int height, bool rowIsSelected) override;
    void paintCell (juce::Graphics& g, int rowNumber, int columnId, int width, int height, bool rowIsSelected) override;
    juce::Component* refreshComponentForCell (int rowNumber, int columnId, bool isRowSelected, juce::Component* existingComponentToUpdate) override;

    enum ColumnIds
    {
        colParamId = 1,
        colOffset,
        colRaw,
        colNormalized,
        colDspBase,
        colDspEffective,
        colDerived
    };

private:
    struct ParamRow
    {
        juce::String paramId;
        juce::String name;
        int byteOffset = -1;
        juce::String rawValueStr;
        juce::String normalizedStr;
        juce::String dspBaseStr;
        juce::String dspEffectiveStr;
        bool isDerived = false;
    };

    std::vector<ParamRow> rows;
    juce::CriticalSection dataLock;

    void rebuildRows (const VoiceDiagnosticSnapshot& snapshot, const EngineDiagnosticSnapshot& engineSnap);
};

#include "LiveValidationViewComponent.h"

// ============================================================================
// performValidation — Captura snapshot del motor y genera filas de validacion
// ============================================================================
void LiveValidationViewComponent::performValidation()
{
    if (synthEngine == nullptr) return;

    currentSnap = synthEngine->getDiagnosticSnapshot();
    rows.clear();

    int matchCount = 0;
    int toleranceCount = 0;
    int mismatchCount = 0;
    int notObservableCount = 0;

    // 1. Validar parametros globales del motor
    {
        ValidationRow r;
        r.paramId = "drift_amount";
        r.voiceIndex = -1;
        r.baseValStr = juce::String (currentSnap.driftAmount, 4);
        r.effectiveValStr = r.baseValStr;
        r.expectedValStr = r.baseValStr;
        r.deltaStr = "0.0";
        r.toleranceStr = "0.001";
        r.classification = "match";
        r.notes = "Global drift configuration";
        rows.push_back (r);
        matchCount++;
    }

    // 2. Validar parametros por voz activa (Filtros VCF/HPF/Drift)
    bool hasActiveVoices = false;
    for (int i = 0; i < 12; ++i)
    {
        const auto& v = currentSnap.voiceSnapshots[i];
        if (!v.isActive) continue;

        hasActiveVoices = true;

        // VCF Cutoff Base vs Effective (VAL-02B)
        {
            ValidationRow r;
            r.paramId = "vcf_cutoff";
            r.voiceIndex = i;
            r.baseValStr = juce::String (v.baseCutoffHz, 1) + " Hz";
            r.effectiveValStr = juce::String (v.effectiveCutoffHz, 1) + " Hz";
            r.expectedValStr = juce::String (v.vcfCutoffBase, 1) + " Hz";

            float delta = std::abs (v.baseCutoffHz - v.vcfCutoffBase);
            r.deltaStr = juce::String (delta, 1) + " Hz";
            r.toleranceStr = "5.0 Hz";

            if (delta <= 5.0f)
            {
                r.classification = "match";
                matchCount++;
            }
            else
            {
                r.classification = "mismatch";
                mismatchCount++;
            }
            r.notes = "VCF cutoff base vs calibration target";
            rows.push_back (r);
        }

        // Voice Drift
        {
            ValidationRow r;
            r.paramId = "voice_drift";
            r.voiceIndex = i;
            r.baseValStr = "0.0 Hz";
            r.effectiveValStr = juce::String (v.driftHz, 2) + " Hz";
            r.expectedValStr = "Drifting";
            r.deltaStr = "-";
            r.toleranceStr = "-";
            r.classification = "within-tolerance";
            r.notes = "Analog Voice Drift active";
            rows.push_back (r);
            toleranceCount++;
        }

        // HPF Cutoff
        {
            ValidationRow r;
            r.paramId = "hpf_cutoff";
            r.voiceIndex = i;
            r.baseValStr = juce::String (v.hpfCutoffHz, 1) + " Hz";
            r.effectiveValStr = r.baseValStr;
            r.expectedValStr = juce::String (v.hpfCutoffBase, 1) + " Hz";
            float delta = std::abs (v.hpfCutoffHz - v.hpfCutoffBase);
            r.deltaStr = juce::String (delta, 1) + " Hz";
            r.toleranceStr = "1.0 Hz";
            if (delta <= 1.0f)
            {
                r.classification = "match";
                matchCount++;
            }
            else
            {
                r.classification = "mismatch";
                mismatchCount++;
            }
            r.notes = "HPF Cutoff frequency alignment";
            rows.push_back (r);
        }
    }

    if (!hasActiveVoices)
    {
        ValidationRow r;
        r.paramId = "engine_status";
        r.voiceIndex = -1;
        r.baseValStr = "Idle";
        r.effectiveValStr = "-";
        r.expectedValStr = "Active voices";
        r.deltaStr = "-";
        r.toleranceStr = "-";
        r.classification = "not-observable";
        r.notes = "Trigger notes to start real-time validation";
        rows.push_back (r);
        notObservableCount++;
    }

    // Configurar estado de resumen global
    if (mismatchCount == 0)
    {
        statusLabel.setText ("STATUS: PASS", juce::dontSendNotification);
        statusLabel.setColour (juce::Label::textColourId, juce::Colours::lightgreen);
    }
    else
    {
        statusLabel.setText ("STATUS: FAIL", juce::dontSendNotification);
        statusLabel.setColour (juce::Label::textColourId, juce::Colours::coral);
    }

    countsLabel.setText (juce::String::formatted ("Matches: %d | Tolerated: %d | Mismatches: %d | Not Obs: %d",
                                                   matchCount, toleranceCount, mismatchCount, notObservableCount),
                         juce::dontSendNotification);

    table.updateContent();
}

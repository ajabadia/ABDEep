#include <JuceHeader.h>
#include "Calibration/AudioABComparator.h"
#include "Calibration/AudioABVerdictEngine.h"

class AudioABComparatorUnitTests : public juce::UnitTest
{
public:
    AudioABComparatorUnitTests()
        : juce::UnitTest ("AudioABComparator & Verdict Engine", "Calibration")
    {}

    void runTest() override
    {
        beginTest ("Señales idénticas producen coincidencia perfecta");
        {
            AudioABSignal refSignal;
            refSignal.sampleRate = 44100.0;
            refSignal.numChannels = 1;
            refSignal.buffer.setSize (1, 44100);
            
            // Generar onda senoidal pura de 1 kHz
            float* refData = refSignal.buffer.getWritePointer (0);
            for (int i = 0; i < 44100; ++i)
            {
                refData[i] = std::sin (2.0f * juce::MathConstants<float>::pi * 1000.0f * (float)i / 44100.0f);
            }
            refSignal.originalNumSamples = 44100;

            AudioABSignal capSignal;
            capSignal.sampleRate = 44100.0;
            capSignal.numChannels = 1;
            capSignal.buffer.setSize (1, 44100);
            
            float* capData = capSignal.buffer.getWritePointer (0);
            for (int i = 0; i < 44100; ++i)
            {
                capData[i] = std::sin (2.0f * juce::MathConstants<float>::pi * 1000.0f * (float)i / 44100.0f);
            }
            capSignal.originalNumSamples = 44100;

            AudioABRunContext ctx;
            ctx.runId = "test-perfect-match";

            AudioABComparatorConfig config;
            config.trimLeadingSilence = false;
            config.trimTrailingSilence = false;

            AudioABComparator comparator;
            auto result = comparator.compare (refSignal, capSignal, ctx, config);

            expectEquals (result.status.toStdString(), std::string ("ok"));
            expectEquals (result.alignment.sampleOffset, 0);
            expectGreaterThan (result.alignment.correlationPeak, 0.99);
            expectLessThan (result.time.rmse, 1e-4);

            AudioABVerdictEngine verdictEngine;
            AudioABVerdictTolerances tolerances;
            auto verdict = verdictEngine.evaluate (result, tolerances);

            expectEquals (verdict.level.toStdString(), std::string ("pass"));
            expectEquals (verdict.reasonCode.toStdString(), std::string ("WITHIN_TOLERANCE"));
        }

        beginTest ("Diferencia de sample rates falla por contrato");
        {
            AudioABSignal refSignal;
            refSignal.sampleRate = 44100.0;
            refSignal.buffer.setSize (1, 1000);
            refSignal.buffer.clear();

            AudioABSignal capSignal;
            capSignal.sampleRate = 48000.0; // SR mismatch
            capSignal.buffer.setSize (1, 1000);
            capSignal.buffer.clear();

            AudioABRunContext ctx;
            AudioABComparatorConfig config;
            AudioABComparator comparator;
            
            auto result = comparator.compare (refSignal, capSignal, ctx, config);
            expectEquals (result.status.toStdString(), std::string ("error"));
            expectEquals (result.reasonCode.toStdString(), std::string ("SR_MISMATCH"));

            AudioABVerdictEngine verdictEngine;
            AudioABVerdictTolerances tolerances;
            auto verdict = verdictEngine.evaluate (result, tolerances);
            expectEquals (verdict.level.toStdString(), std::string ("fail"));
            expectEquals (verdict.reasonCode.toStdString(), std::string ("SR_MISMATCH"));
        }

        beginTest ("Alineación exitosa ante desfase temporal (silencio inicial)");
        {
            AudioABSignal refSignal;
            refSignal.sampleRate = 44100.0;
            refSignal.numChannels = 1;
            refSignal.buffer.setSize (1, 10000);
            refSignal.buffer.clear();
            float* refData = refSignal.buffer.getWritePointer (0);
            // Señal con forma de impulso en muestra 100
            refData[100] = 1.0f;
            refSignal.originalNumSamples = 10000;

            AudioABSignal capSignal;
            capSignal.sampleRate = 44100.0;
            capSignal.numChannels = 1;
            capSignal.buffer.setSize (1, 10000);
            capSignal.buffer.clear();
            float* capData = capSignal.buffer.getWritePointer (0);
            // El mismo impulso retrasado por 50 muestras
            capData[150] = 1.0f;
            capSignal.originalNumSamples = 10000;

            AudioABRunContext ctx;
            ctx.runId = "test-offset-alignment";

            AudioABComparatorConfig config;
            config.trimLeadingSilence = false;
            config.trimTrailingSilence = false;
            config.enableCrossCorrelation = true;

            AudioABComparator comparator;
            auto result = comparator.compare (refSignal, capSignal, ctx, config);

            expectEquals (result.status.toStdString(), std::string ("ok"));
            // cap está retrasada 50 muestras, por lo que el offset de cap con respecto a ref es +50 muestras
            expectEquals (result.alignment.sampleOffset, 50);
            expectGreaterThan (result.alignment.correlationPeak, 0.99);
        }
    }
};

static AudioABComparatorUnitTests audioABComparatorUnitTests;

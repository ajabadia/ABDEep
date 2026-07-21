#include "FXMidasEQ.h"
#include <cmath>
#include <algorithm>

namespace ABD
{
    FXMidasEQ::FXMidasEQ()
    {
        reset();
    }

    void FXMidasEQ::prepare(double newSampleRate, int samplesPerBlock)
    {
        sampleRate = std::max(1.0, newSampleRate);
        
        juce::dsp::ProcessSpec spec;
        spec.sampleRate = sampleRate;
        spec.maximumBlockSize = uint32(samplesPerBlock);
        spec.numChannels = 1;

        lowShelfL.prepare(spec);  lowShelfR.prepare(spec);
        lowMidL.prepare(spec);    lowMidR.prepare(spec);
        highMidL.prepare(spec);   highMidR.prepare(spec);
        highShelfL.prepare(spec); highShelfR.prepare(spec);

        updateCoefficients();
    }

    void FXMidasEQ::setParameter(int index, float value)
    {
        value = std::clamp(value, 0.0f, 1.0f);
        switch (index)
        {
            case 0:  loShelfGain = value; updateCoefficients(); break;
            case 1:  loShelfFreq = value; updateCoefficients(); break;
            case 2:  loMidGain   = value; updateCoefficients(); break;
            case 3:  loMidFreq   = value; updateCoefficients(); break;
            case 4:  loMidQ      = value; updateCoefficients(); break;
            case 5:  hiMidGain   = value; updateCoefficients(); break;
            case 6:  hiMidFreq   = value; updateCoefficients(); break;
            case 7:  hiMidQ      = value; updateCoefficients(); break;
            case 8:  hiShelfGain = value; updateCoefficients(); break;
            case 9:  hiShelfFreq = value; updateCoefficients(); break;
            case 10: eqIn        = (value <= 0.5f); break; // 0 = IN, 1 = OUT
        }
    }

    void FXMidasEQ::reset()
    {
        lowShelfL.reset();  lowShelfR.reset();
        lowMidL.reset();    lowMidR.reset();
        highMidL.reset();   highMidR.reset();
        highShelfL.reset(); highShelfR.reset();
    }

    void FXMidasEQ::updateCoefficients()
    {
        auto mapFreq = [this](float norm) -> float {
            return std::clamp(30.0f * std::pow(666.6f, norm), 20.0f, (float)(sampleRate * 0.48));
        };

        auto dbToGain = [](float norm) -> float {
            float db = (norm - 0.5f) * 24.0f; // -12 to +12 dB
            return std::pow(10.0f, db / 20.0f);
        };

        auto mapQ = [](float norm) -> float {
            return 0.3f + norm * 4.7f; // 0.3 to 5.0
        };

        // 1. Low Shelf
        float lfFreq = mapFreq(loShelfFreq);
        float lfGain = dbToGain(loShelfGain);
        auto lfCoeffs = juce::dsp::IIR::Coefficients<float>::makeLowShelf(sampleRate, lfFreq, 0.707f, lfGain);
        lowShelfL.coefficients = lfCoeffs;
        lowShelfR.coefficients = lfCoeffs;

        // 2. Low Mid Peak
        float lmFreq = mapFreq(loMidFreq);
        float lmGain = dbToGain(loMidGain);
        float lmQVal = mapQ(loMidQ);
        auto lmCoeffs = juce::dsp::IIR::Coefficients<float>::makePeakFilter(sampleRate, lmFreq, lmQVal, lmGain);
        lowMidL.coefficients = lmCoeffs;
        lowMidR.coefficients = lmCoeffs;

        // 3. High Mid Peak
        float hmFreq = mapFreq(hiMidFreq);
        float hmGain = dbToGain(hiMidGain);
        float hmQVal = mapQ(hiMidQ);
        auto hmCoeffs = juce::dsp::IIR::Coefficients<float>::makePeakFilter(sampleRate, hmFreq, hmQVal, hmGain);
        highMidL.coefficients = hmCoeffs;
        highMidR.coefficients = hmCoeffs;

        // 4. High Shelf
        float hfFreq = mapFreq(hiShelfFreq);
        float hfGain = dbToGain(hiShelfGain);
        auto hfCoeffs = juce::dsp::IIR::Coefficients<float>::makeHighShelf(sampleRate, hfFreq, 0.707f, hfGain);
        highShelfL.coefficients = hfCoeffs;
        highShelfR.coefficients = hfCoeffs;
    }

    void FXMidasEQ::process(const float* inL, const float* inR,
                             float* outL, float* outR, int numSamples)
    {
        if (!eqIn)
        {
            for (int s = 0; s < numSamples; ++s)
            {
                outL[s] = inL[s];
                outR[s] = inR[s];
            }
            return;
        }

        for (int s = 0; s < numSamples; ++s)
        {
            float l = inL[s];
            float r = inR[s];

            // Proceso en cascada por canal
            l = lowShelfL.processSample(l);
            l = lowMidL.processSample(l);
            l = highMidL.processSample(l);
            l = highShelfL.processSample(l);

            r = lowShelfR.processSample(r);
            r = lowMidR.processSample(r);
            r = highMidR.processSample(r);
            r = highShelfR.processSample(r);

            outL[s] = l;
            outR[s] = r;
        }
    }
}

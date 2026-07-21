#include "FXFairComp.h"
#include <cmath>
#include <algorithm>

namespace ABD
{
    FXFairComp::FXFairComp()
    {
        reset();
    }

    void FXFairComp::prepare(double newSampleRate, int samplesPerBlock)
    {
        sampleRate = std::max(1.0, newSampleRate);
        reset();
    }

    void FXFairComp::setParameter(int index, float value)
    {
        value = std::clamp(value, 0.0f, 1.0f);

        switch (index)
        {
            case 0: // mode: 0=OFF, 1=Stereo, 2=Dual, 3=M/S
                mode = (int)(value * 3.9f);
                break;
            case 1: // inputGain L/M
                chanLM.inputGainNorm = value;
                break;
            case 2: // threshold L/M
                chanLM.thresholdNorm = value;
                break;
            case 3: // time constant L/M
                chanLM.timeConstantNorm = value;
                chanLM.update(sampleRate);
                break;
            case 4: // dcBias L/M
                chanLM.dcBiasNorm = value;
                chanLM.update(sampleRate);
                break;
            case 5: // outputGain L/M
                chanLM.outputGainNorm = value;
                break;
            case 6: // bias balance
                biasBal = value;
                break;
            case 7: // inputGain R/S
                chanRS.inputGainNorm = value;
                break;
            case 8: // threshold R/S
                chanRS.thresholdNorm = value;
                break;
            case 9: // time constant R/S
                chanRS.timeConstantNorm = value;
                chanRS.update(sampleRate);
                break;
            case 10: // dcBias R/S
                chanRS.dcBiasNorm = value;
                chanRS.update(sampleRate);
                break;
            case 11: // outputGain R/S
                chanRS.outputGainNorm = value;
                break;
        }
    }

    void FXFairComp::reset()
    {
        chanLM.envelope = 0.0f;
        chanRS.envelope = 0.0f;
        chanLM.update(sampleRate);
        chanRS.update(sampleRate);
    }

    void FXFairComp::process(const float* inL, const float* inR,
                            float* outL, float* outR, int numSamples)
    {
        if (mode == 0) // OFF
        {
            for (int s = 0; s < numSamples; ++s)
            {
                outL[s] = inL[s];
                outR[s] = inR[s];
            }
            return;
        }

        // Si estamos en modo Stereo, el canal RS copia los parámetros del canal LM
        if (mode == 1)
        {
            chanRS.inputGainNorm = chanLM.inputGainNorm;
            chanRS.thresholdNorm = chanLM.thresholdNorm;
            chanRS.timeConstantNorm = chanLM.timeConstantNorm;
            chanRS.dcBiasNorm = chanLM.dcBiasNorm;
            chanRS.outputGainNorm = chanLM.outputGainNorm;
            chanRS.update(sampleRate);
        }

        for (int s = 0; s < numSamples; ++s)
        {
            float l = inL[s];
            float r = inR[s];

            // 1. Decodificar si estamos en modo Mid/Side (mode = 3)
            if (mode == 3)
            {
                float mid = (l + r) * 0.5f;
                float side = (l - r) * 0.5f;

                // Procesar Mid en canal LM y Side en canal RS
                float midProc = chanLM.processSample(mid, sampleRate);
                float sideProc = chanRS.processSample(side, sampleRate);

                // Codificar de vuelta a Estéreo
                outL[s] = midProc + sideProc;
                outR[s] = midProc - sideProc;
            }
            else // Estéreo (1) o Dual Mono (2)
            {
                outL[s] = chanLM.processSample(l, sampleRate);
                outR[s] = chanRS.processSample(r, sampleRate);
            }
        }
    }

    void FXFairComp::CompChannel::update(double sr)
    {
        // Mapear constante de tiempo (1 a 6)
        int tc = 1 + (int)(timeConstantNorm * 5.0f);
        switch (tc)
        {
            case 1: attackTimeSec = 0.0002f; releaseTimeSec = 0.3f; break;
            case 2: attackTimeSec = 0.0002f; releaseTimeSec = 0.8f; break;
            case 3: attackTimeSec = 0.0004f; releaseTimeSec = 2.0f; break;
            case 4: attackTimeSec = 0.0008f; releaseTimeSec = 5.0f; break;
            case 5: attackTimeSec = 0.0002f; releaseTimeSec = 8.0f; break;
            case 6: attackTimeSec = 0.0004f; releaseTimeSec = 15.00f; break;
        }

        ratio = 2.0f + dcBiasNorm * 28.0f;
        kneeDb = 20.0f - dcBiasNorm * 18.0f;
    }

    float FXFairComp::CompChannel::processSample(float inputSample, double sr)
    {
        float inGainDb = -20.0f + inputGainNorm * 20.0f; // -20 to 0 dB
        float inputGainLin = std::pow(10.0f, inGainDb / 20.0f);
        float x = inputSample * inputGainLin;

        // Detector de envolvente (sidechain)
        float absX = std::abs(x);
        
        // Coeficientes de ataque/liberación
        float attCoeff = (float)(1.0 - std::exp(-1.0 / (attackTimeSec * sr)));
        float relCoeff = (float)(1.0 - std::exp(-1.0 / (releaseTimeSec * sr)));
        
        if (absX > envelope)
            envelope += attCoeff * (absX - envelope);
        else
            envelope += relCoeff * (absX - envelope);

        // Conversión de envolvente a dB
        float envDb = 20.0f * std::log10(std::max(1e-5f, envelope));

        // Threshold en dB: mapeado a -40 a 0 dB
        float thresholdDb = -40.0f + thresholdNorm * 40.0f;

        // Ganancia a reducir
        float gainReductionDb = 0.0f;

        // Soft knee
        if (envDb > thresholdDb - kneeDb * 0.5f)
        {
            if (envDb < thresholdDb + kneeDb * 0.5f)
            {
                // Región del codo
                float kneeDiff = envDb - (thresholdDb - kneeDb * 0.5f);
                gainReductionDb = (1.0f - 1.0f / ratio) * (kneeDiff * kneeDiff) / (2.0f * kneeDb);
            }
            else
            {
                // Región lineal superior
                gainReductionDb = (1.0f - 1.0f / ratio) * (envDb - thresholdDb);
            }
        }

        // Ganancia final
        float gainDb = -gainReductionDb;
        
        // Ganancia de salida: -18 a 6 dB
        float outGainDb = -18.0f + outputGainNorm * 24.0f;
        gainDb += outGainDb;

        float outputGainLin = std::pow(10.0f, gainDb / 20.0f);
        return x * outputGainLin;
    }
}

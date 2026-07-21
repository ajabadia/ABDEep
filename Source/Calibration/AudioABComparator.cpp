#include "AudioABComparator.h"
#include <juce_dsp/juce_dsp.h>
#include <cmath>

static bool isBufferFinite (const juce::AudioBuffer<float>& buffer)
{
    for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
    {
        const float* readPtr = buffer.getReadPointer (channel);
        for (int i = 0; i < buffer.getNumSamples(); ++i)
        {
            if (std::isnan (readPtr[i]) || std::isinf (readPtr[i]))
                return false;
        }
    }
    return true;
}

static void mixToMono (const juce::AudioBuffer<float>& input, juce::AudioBuffer<float>& output)
{
    output.setSize (1, input.getNumSamples());
    output.clear();

    if (input.getNumChannels() == 1)
    {
        output.copyFrom (0, 0, input, 0, 0, input.getNumSamples());
    }
    else if (input.getNumChannels() > 1)
    {
        float invChannels = 1.0f / (float)input.getNumChannels();
        for (int channel = 0; channel < input.getNumChannels(); ++channel)
        {
            output.addFrom (0, 0, input, channel, 0, input.getNumSamples(), invChannels);
        }
    }
}

static int64_t findSilenceBoundary (const juce::AudioBuffer<float>& monoBuffer, float thresholdDb, bool leading)
{
    const float* readPtr = monoBuffer.getReadPointer (0);
    const int numSamples = monoBuffer.getNumSamples();
    const float thresholdLinear = std::pow (10.0f, thresholdDb / 20.0f);

    if (leading)
    {
        for (int i = 0; i < numSamples; ++i)
        {
            if (std::abs (readPtr[i]) >= thresholdLinear)
                return i;
        }
        return numSamples;
    }
    else
    {
        for (int i = numSamples - 1; i >= 0; --i)
        {
            if (std::abs (readPtr[i]) >= thresholdLinear)
                return i + 1;
        }
        return 0;
    }
}

juce::var AudioABComparatorResult::toVar() const
{
    juce::DynamicObject::Ptr obj = new juce::DynamicObject();
    obj->setProperty ("run_id", runId);
    obj->setProperty ("comparator_version", comparatorVersion);
    obj->setProperty ("status", status);
    obj->setProperty ("reason_code", reasonCode);

    juce::DynamicObject::Ptr inp = new juce::DynamicObject();
    inp->setProperty ("sample_rate", input.sampleRate);
    inp->setProperty ("num_channels_reference", input.numChannelsReference);
    inp->setProperty ("num_channels_capture", input.numChannelsCapture);
    inp->setProperty ("original_samples_reference", (int)input.originalSamplesReference);
    inp->setProperty ("original_samples_capture", (int)input.originalSamplesCapture);
    inp->setProperty ("analyzed_samples", (int)input.analyzedSamples);
    inp->setProperty ("channels_mode", input.channelsMode);
    inp->setProperty ("trimmed_samples_reference", (int)input.trimmedSamplesReference);
    inp->setProperty ("trimmed_samples_capture", (int)input.trimmedSamplesCapture);
    obj->setProperty ("input", juce::var (inp.get()));

    juce::DynamicObject::Ptr align = new juce::DynamicObject();
    align->setProperty ("applied", alignment.applied);
    align->setProperty ("sample_offset", alignment.sampleOffset);
    align->setProperty ("time_offset_ms", alignment.timeOffsetMs);
    align->setProperty ("correlation_peak", alignment.correlationPeak);
    align->setProperty ("overlap_ratio", alignment.overlapRatio);
    obj->setProperty ("alignment", juce::var (align.get()));

    juce::DynamicObject::Ptr t = new juce::DynamicObject();
    t->setProperty ("peak_ref_dbfs", time.peakRefDbfs);
    t->setProperty ("peak_cap_dbfs", time.peakCapDbfs);
    t->setProperty ("peak_delta_db", time.peakDeltaDb);
    t->setProperty ("rms_ref_dbfs", time.rmsRefDbfs);
    t->setProperty ("rms_cap_dbfs", time.rmsCapDbfs);
    t->setProperty ("rms_delta_db", time.rmsDeltaDb);
    t->setProperty ("residual_rms_dbfs", time.residualRmsDbfs);
    t->setProperty ("residual_peak_dbfs", time.residualPeakDbfs);
    t->setProperty ("mae", time.mae);
    t->setProperty ("rmse", time.rmse);
    obj->setProperty ("time_metrics", juce::var (t.get()));

    juce::DynamicObject::Ptr s = new juce::DynamicObject();
    s->setProperty ("log_mag_mean_abs_diff_db", spectral.logMagMeanAbsDiffDb);
    s->setProperty ("spectral_centroid_delta_hz", spectral.spectralCentroidDeltaHz);
    s->setProperty ("spectral_flatness_delta", spectral.spectralFlatnessDelta);
    s->setProperty ("low_band_delta_db", spectral.lowBandDeltaDb);
    s->setProperty ("mid_band_delta_db", spectral.midBandDeltaDb);
    s->setProperty ("high_band_delta_db", spectral.highBandDeltaDb);
    obj->setProperty ("spectral_metrics", juce::var (s.get()));

    juce::Array<juce::var> warnArr;
    for (const auto& w : warnings) warnArr.add (w);
    obj->setProperty ("warnings", warnArr);

    juce::Array<juce::var> errArr;
    for (const auto& e : errors) errArr.add (e);
    obj->setProperty ("errors", errArr);

    return juce::var (obj.get());
}

AudioABComparatorResult AudioABComparator::compare (const AudioABSignal& reference,
                                                   const AudioABSignal& capture,
                                                   const AudioABRunContext& context,
                                                   const AudioABComparatorConfig& config)
{
    AudioABComparatorResult result;
    result.runId = context.runId;

    // 1. Validaciones iniciales contractuales
    if (reference.buffer.getNumSamples() == 0 || capture.buffer.getNumSamples() == 0)
    {
        result.status = "error";
        result.reasonCode = "EMPTY_BUFFER";
        result.errors.add ("Uno o ambos buffers de audio están vacíos.");
        return result;
    }

    if (reference.sampleRate != capture.sampleRate)
    {
        result.status = "error";
        result.reasonCode = "SR_MISMATCH";
        result.errors.add ("Frecuencias de muestreo incompatibles: " + juce::String (reference.sampleRate) + " vs " + juce::String (capture.sampleRate));
        return result;
    }

    if (!isBufferFinite (reference.buffer) || !isBufferFinite (capture.buffer))
    {
        result.status = "error";
        result.reasonCode = "NAN_INF_DETECTED";
        result.errors.add ("Se detectaron valores NaN o infinitos en las muestras de audio.");
        return result;
    }

    result.input.sampleRate = reference.sampleRate;
    result.input.numChannelsReference = reference.numChannels;
    result.input.numChannelsCapture = capture.numChannels;
    result.input.originalSamplesReference = reference.buffer.getNumSamples();
    result.input.originalSamplesCapture = capture.buffer.getNumSamples();
    result.input.channelsMode = config.forceMonoForAnalysis ? "mono-analysis" : "stereo-analysis";

    // 2. Preprocesado (trimming y matching mono)
    auto refPrepared = prepareSignal (reference, config, result);
    auto capPrepared = prepareSignal (capture, config, result);

    result.input.trimmedSamplesReference = refPrepared.buffer.getNumSamples();
    result.input.trimmedSamplesCapture = capPrepared.buffer.getNumSamples();

    if (refPrepared.buffer.getNumSamples() == 0 || capPrepared.buffer.getNumSamples() == 0)
    {
        result.status = "error";
        result.reasonCode = "EMPTY_BUFFER";
        result.errors.add ("Las señales quedaron vacías tras aplicar el trim de silencio.");
        return result;
    }

    // 3. Alineación efectiva
    juce::AudioBuffer<float> alignedRef, alignedCap;
    alignSignals (refPrepared, capPrepared, config, result, alignedRef, alignedCap);

    result.input.analyzedSamples = alignedRef.getNumSamples();

    if (alignedRef.getNumSamples() == 0)
    {
        result.status = "error";
        result.reasonCode = "EMPTY_BUFFER";
        result.errors.add ("El tramo común de análisis tras la alineación es cero.");
        return result;
    }

    // 4. Métricas en el dominio del tiempo
    computeTimeMetrics (alignedRef, alignedCap, result);

    // 5. Métricas espectrales
    computeSpectralMetrics (alignedRef, alignedCap, config, result);

    return result;
}

AudioABComparator::PreparedSignal AudioABComparator::prepareSignal (const AudioABSignal& signal, const AudioABComparatorConfig& config, AudioABComparatorResult& /*result*/)
{
    juce::AudioBuffer<float> monoBuffer;
    mixToMono (signal.buffer, monoBuffer);

    int64_t leadingSilence = 0;
    int64_t trailingSilence = monoBuffer.getNumSamples();

    if (config.trimLeadingSilence)
    {
        leadingSilence = findSilenceBoundary (monoBuffer, config.silenceThresholdDb, true);
    }
    if (config.trimTrailingSilence)
    {
        trailingSilence = findSilenceBoundary (monoBuffer, config.silenceThresholdDb, false);
    }

    int64_t trimmedSamples = trailingSilence - leadingSilence;
    PreparedSignal prepared;
    if (trimmedSamples > 0)
    {
        prepared.buffer.setSize (1, (int)trimmedSamples);
        prepared.buffer.copyFrom (0, 0, monoBuffer, 0, (int)leadingSilence, (int)trimmedSamples);
        prepared.trimmedOffset = leadingSilence;
    }
    else
    {
        prepared.buffer.setSize (1, 0);
        prepared.trimmedOffset = 0;
    }
    return prepared;
}

void AudioABComparator::alignSignals (const PreparedSignal& ref, const PreparedSignal& cap, const AudioABComparatorConfig& config, AudioABComparatorResult& result, juce::AudioBuffer<float>& alignedRef, juce::AudioBuffer<float>& alignedCap)
{
    int offset = 0;
    double maxCorr = 0.0;

    const int N_ref = ref.buffer.getNumSamples();
    const int N_cap = cap.buffer.getNumSamples();

    if (config.enableCrossCorrelation)
    {
        // Buscar el offset con correlación cruzada en el rango [-maxAlignmentOffsetSamples, maxAlignmentOffsetSamples]
        int limit = std::min (config.maxAlignmentOffsetSamples, std::min (N_ref, N_cap) / 2);
        if (limit < 128) limit = std::min (N_ref, N_cap) - 1; // Fallback para muestras muy cortas

        // Autocorrelación de referencia para normalizar
        double refEnergy = 0.0;
        const float* refPtr = ref.buffer.getReadPointer (0);
        for (int i = 0; i < N_ref; ++i) refEnergy += (double)(refPtr[i] * refPtr[i]);

        double capEnergy = 0.0;
        const float* capPtr = cap.buffer.getReadPointer (0);
        for (int i = 0; i < N_cap; ++i) capEnergy += (double)(capPtr[i] * capPtr[i]);

        double normFactor = std::sqrt (refEnergy * capEnergy);
        if (normFactor < 1e-9) normFactor = 1.0;

        for (int shift = -limit; shift <= limit; ++shift)
        {
            double sum = 0.0;
            int start_ref = std::max (0, -shift);
            int start_cap = std::max (0, shift);
            int len = std::min (N_ref - start_ref, N_cap - start_cap);

            if (len <= 0) continue;

            for (int k = 0; k < len; ++k)
            {
                sum += (double)(refPtr[start_ref + k] * capPtr[start_cap + k]);
            }

            double corr = sum / normFactor;
            if (corr > maxCorr)
            {
                maxCorr = corr;
                offset = shift;
            }
        }

        result.alignment.applied = true;
        result.alignment.sampleOffset = offset;
        result.alignment.timeOffsetMs = ((double)offset / result.input.sampleRate) * 1000.0;
        result.alignment.correlationPeak = maxCorr;
    }
    else
    {
        result.alignment.applied = false;
        result.alignment.sampleOffset = 0;
        result.alignment.timeOffsetMs = 0.0;
        result.alignment.correlationPeak = 1.0;
    }

    // Recortar las señales al tramo común final alineado
    int start_ref = std::max (0, -offset);
    int start_cap = std::max (0, offset);
    int commonLength = std::min (N_ref - start_ref, N_cap - start_cap);

    if (commonLength > 0)
    {
        alignedRef.setSize (1, commonLength);
        alignedRef.copyFrom (0, 0, ref.buffer, 0, start_ref, commonLength);

        alignedCap.setSize (1, commonLength);
        alignedCap.copyFrom (0, 0, cap.buffer, 0, start_cap, commonLength);

        double totalOriginal = (double)std::max (N_ref, N_cap);
        result.alignment.overlapRatio = (double)commonLength / (totalOriginal > 0.0 ? totalOriginal : 1.0);
    }
    else
    {
        alignedRef.setSize (1, 0);
        alignedCap.setSize (1, 0);
        result.alignment.overlapRatio = 0.0;
    }
}

void AudioABComparator::computeTimeMetrics (const juce::AudioBuffer<float>& ref, const juce::AudioBuffer<float>& cap, AudioABComparatorResult& result)
{
    const float* refPtr = ref.getReadPointer (0);
    const float* capPtr = cap.getReadPointer (0);
    const int N = ref.getNumSamples();

    double maxRef = 0.0;
    double maxCap = 0.0;
    double energyRef = 0.0;
    double energyCap = 0.0;
    double absoluteErrorSum = 0.0;
    double squaredErrorSum = 0.0;
    double residualMax = 0.0;
    double residualEnergy = 0.0;

    for (int i = 0; i < N; ++i)
    {
        double r = (double)refPtr[i];
        double c = (double)capPtr[i];

        maxRef = std::max (maxRef, std::abs (r));
        maxCap = std::max (maxCap, std::abs (c));

        energyRef += r * r;
        energyCap += c * c;

        double diff = r - c;
        absoluteErrorSum += std::abs (diff);
        squaredErrorSum += diff * diff;

        residualMax = std::max (residualMax, std::abs (diff));
        residualEnergy += diff * diff;
    }

    result.time.peakRefDbfs = maxRef > 0.0 ? 20.0 * std::log10 (maxRef) : -100.0;
    result.time.peakCapDbfs = maxCap > 0.0 ? 20.0 * std::log10 (maxCap) : -100.0;
    result.time.peakDeltaDb = std::abs (result.time.peakRefDbfs - result.time.peakCapDbfs);

    double rmsRef = std::sqrt (energyRef / (double)N);
    double rmsCap = std::sqrt (energyCap / (double)N);
    result.time.rmsRefDbfs = rmsRef > 0.0 ? 20.0 * std::log10 (rmsRef) : -100.0;
    result.time.rmsCapDbfs = rmsCap > 0.0 ? 20.0 * std::log10 (rmsCap) : -100.0;
    result.time.rmsDeltaDb = std::abs (result.time.rmsRefDbfs - result.time.rmsCapDbfs);

    double residualRms = std::sqrt (residualEnergy / (double)N);
    result.time.residualRmsDbfs = residualRms > 0.0 ? 20.0 * std::log10 (residualRms) : -100.0;
    result.time.residualPeakDbfs = residualMax > 0.0 ? 20.0 * std::log10 (residualMax) : -100.0;

    result.time.mae = absoluteErrorSum / (double)N;
    result.time.rmse = std::sqrt (squaredErrorSum / (double)N);
}

void AudioABComparator::computeSpectralMetrics (const juce::AudioBuffer<float>& ref, const juce::AudioBuffer<float>& cap, const AudioABComparatorConfig& config, AudioABComparatorResult& result)
{
    const float* refPtr = ref.getReadPointer (0);
    const float* capPtr = cap.getReadPointer (0);
    const int N = ref.getNumSamples();

    // Ventana y cálculo de STFT simplificado sobre bins de frecuencia (FFT FFT-size)
    const int fftSize = config.fftSize;
    if (N < fftSize)
    {
        result.warnings.add ("La señal es demasiado corta para calcular métricas espectrales.");
        return;
    }

    // Usar ventana Hanning para mitigar filtración espectral
    juce::AudioBuffer<float> window (1, fftSize);
    float* winPtr = window.getWritePointer (0);
    for (int i = 0; i < fftSize; ++i)
    {
        winPtr[i] = 0.5f * (1.0f - std::cos (2.0f * juce::MathConstants<float>::pi * (float)i / (float)(fftSize - 1)));
    }

    juce::dsp::FFT fft (std::log2 (fftSize));
    const int numBins = fftSize / 2 + 1;

    std::vector<double> avgMagRef (numBins, 0.0);
    std::vector<double> avgMagCap (numBins, 0.0);

    int count = 0;
    for (int start = 0; start <= N - fftSize; start += fftSize / 2) // Overlap 50%
    {
        std::vector<float> frameRef (fftSize * 2, 0.0f);
        std::vector<float> frameCap (fftSize * 2, 0.0f);

        for (int i = 0; i < fftSize; ++i)
        {
            frameRef[i] = refPtr[start + i] * winPtr[i];
            frameCap[i] = capPtr[start + i] * winPtr[i];
        }

        fft.performFrequencyOnlyForwardTransform (frameRef.data());
        fft.performFrequencyOnlyForwardTransform (frameCap.data());

        for (int bin = 0; bin < numBins; ++bin)
        {
            avgMagRef[bin] += (double)frameRef[bin];
            avgMagCap[bin] += (double)frameCap[bin];
        }
        count++;
    }

    if (count > 0)
    {
        for (int bin = 0; bin < numBins; ++bin)
        {
            avgMagRef[bin] /= (double)count;
            avgMagCap[bin] /= (double)count;
        }
    }

    // Calcular diferencias acumuladas por bandas
    double logMagDiffSum = 0.0;
    double centroidRef = 0.0;
    double centroidCap = 0.0;
    double sumRef = 0.0;
    double sumCap = 0.0;

    double logSumRef = 0.0;   // sum(log(magRef + epsilon))
    double logSumCap = 0.0;   // sum(log(magCap + epsilon))
    int validBins = 0;

    double binWidthHz = result.input.sampleRate / (double)fftSize;

    double lowSum = 0.0, midSum = 0.0, highSum = 0.0;
    int lowCount = 0, midCount = 0, highCount = 0;

    for (int bin = 0; bin < numBins; ++bin)
    {
        double freqHz = (double)bin * binWidthHz;
        double refDb = 20.0 * std::log10 (std::max (avgMagRef[bin], 1e-5));
        double capDb = 20.0 * std::log10 (std::max (avgMagCap[bin], 1e-5));

        double diffDb = std::abs (refDb - capDb);
        logMagDiffSum += diffDb;

        centroidRef += freqHz * avgMagRef[bin];
        sumRef += avgMagRef[bin];

        centroidCap += freqHz * avgMagCap[bin];
        sumCap += avgMagCap[bin];

        logSumRef += std::log (std::max (avgMagRef[bin], 1e-12));
        logSumCap += std::log (std::max (avgMagCap[bin], 1e-12));
        validBins++;

        // Agrupar por bandas espectrales
        if (freqHz < 200.0)
        {
            lowSum += diffDb;
            lowCount++;
        }
        else if (freqHz >= 200.0 && freqHz < 2000.0)
        {
            midSum += diffDb;
            midCount++;
        }
        else
        {
            highSum += diffDb;
            highCount++;
        }
    }

    result.spectral.logMagMeanAbsDiffDb = logMagDiffSum / (double)numBins;
    result.spectral.spectralCentroidDeltaHz = std::abs ((sumRef > 0.0 ? centroidRef / sumRef : 0.0) - (sumCap > 0.0 ? centroidCap / sumCap : 0.0));
    
    // Flatness espectral = |geoMeanRef/arithMeanRef - geoMeanCap/arithMeanCap|
    double arithMeanRef = sumRef / (double)validBins;
    double arithMeanCap = sumCap / (double)validBins;
    double geoMeanRef = std::exp (logSumRef / (double)validBins);
    double geoMeanCap = std::exp (logSumCap / (double)validBins);
    double flatnessRef = (arithMeanRef > 1e-12) ? geoMeanRef / arithMeanRef : 0.0;
    double flatnessCap = (arithMeanCap > 1e-12) ? geoMeanCap / arithMeanCap : 0.0;
    result.spectral.spectralFlatnessDelta = std::abs (flatnessRef - flatnessCap);

    result.spectral.lowBandDeltaDb = lowCount > 0 ? lowSum / (double)lowCount : 0.0;
    result.spectral.midBandDeltaDb = midCount > 0 ? midSum / (double)midCount : 0.0;
    result.spectral.highBandDeltaDb = highCount > 0 ? highSum / (double)highCount : 0.0;
}

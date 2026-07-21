#pragma once

#include <JuceHeader.h>

class AudioABVisualizerComponent : public juce::Component
{
public:
    AudioABVisualizerComponent() = default;
    ~AudioABVisualizerComponent() override = default;

    void setBuffers (const juce::AudioBuffer<float>& refBuffer, const juce::AudioBuffer<float>& capBuffer)
    {
        refData = refBuffer;
        capData = capBuffer;
        repaint();
    }

    void paint (juce::Graphics& g) override
    {
        g.fillAll (juce::Colours::black);

        auto bounds = getLocalBounds();
        auto waveformArea = bounds.removeFromTop (bounds.getHeight() / 2).reduced (10);
        auto spectrumArea = bounds.reduced (10);

        // 1. Dibujar Formas de Onda Superpuestas
        g.setColour (juce::Colours::darkgrey.withAlpha(0.2f));
        g.fillRect (waveformArea);
        g.setColour (juce::Colours::white);
        g.setFont (12.0f);
        g.drawText ("WAVEFORM COMPARISON (Blue: Software Ref | Red: Hardware Cap)", waveformArea.getX() + 5, waveformArea.getY() + 5, 400, 20, juce::Justification::topLeft);

        int refSamples = refData.getNumSamples();
        int capSamples = capData.getNumSamples();

        if (refSamples > 0 && capSamples > 0)
        {
            auto pathRef = drawWaveformPath (refData, waveformArea);
            auto pathCap = drawWaveformPath (capData, waveformArea);

            g.setColour (juce::Colours::cyan.withAlpha (0.7f));
            g.strokePath (pathRef, juce::PathStrokeType (1.5f));

            g.setColour (juce::Colours::coral.withAlpha (0.7f));
            g.strokePath (pathCap, juce::PathStrokeType (1.5f));
        }

        // 2. Dibujar Comparación Espectral FFT Simple
        g.setColour (juce::Colours::darkgrey.withAlpha(0.2f));
        g.fillRect (spectrumArea);
        g.setColour (juce::Colours::white);
        g.drawText ("SPECTRUM COMPARISON (FFT Magnitude)", spectrumArea.getX() + 5, spectrumArea.getY() + 5, 300, 20, juce::Justification::topLeft);

        if (refSamples > 0 && capSamples > 0)
        {
            drawSpectrum (g, refData, juce::Colours::cyan, spectrumArea);
            drawSpectrum (g, capData, juce::Colours::coral, spectrumArea);
        }
    }

private:
    juce::AudioBuffer<float> refData;
    juce::AudioBuffer<float> capData;

    juce::Path drawWaveformPath (const juce::AudioBuffer<float>& buffer, juce::Rectangle<int> area)
    {
        juce::Path p;
        int numSamples = buffer.getNumSamples();
        if (numSamples == 0) return p;

        const float* channel = buffer.getReadPointer (0);
        float width = (float)area.getWidth();
        float height = (float)area.getHeight();
        float midY = (float)area.getY() + height / 2.0f;

        p.startNewSubPath (area.getX(), midY);

        int step = numSamples / 500; // Dibujar 500 puntos de resolución
        if (step < 1) step = 1;

        for (int i = 0; i < numSamples; i += step)
        {
            float x = area.getX() + ((float)i / (float)numSamples) * width;
            float sampleVal = channel[i];
            float y = midY - (sampleVal * (height / 2.2f));
            p.lineTo (x, y);
        }

        return p;
    }

    void drawSpectrum (juce::Graphics& g, const juce::AudioBuffer<float>& buffer, juce::Colour colour, juce::Rectangle<int> area)
    {
        int numSamples = buffer.getNumSamples();
        if (numSamples < 512) return;

        // FFT de 512 puntos para visualización espectral simple
        const int fftOrder = 9;
        const int fftSize = 512;
        juce::dsp::FFT fft (fftOrder);

        std::array<float, fftSize * 2> fftData;
        std::fill (fftData.begin(), fftData.end(), 0.0f);

        const float* readPtr = buffer.getReadPointer (0);
        int samplesToCopy = std::min (numSamples, fftSize);
        std::copy (readPtr, readPtr + samplesToCopy, fftData.begin());

        // Aplicar ventana Hanning
        juce::dsp::WindowingFunction<float> window (fftSize, juce::dsp::WindowingFunction<float>::hann);
        window.multiplyWithWindowingTable (fftData.data(), fftSize);

        // Correr FFT
        fft.performRealOnlyForwardTransform (fftData.data());

        // Dibujar espectro
        juce::Path p;
        float width = (float)area.getWidth();
        float height = (float)area.getHeight();
        float bottomY = (float)area.getBottom();

        p.startNewSubPath (area.getX(), bottomY);

        for (int i = 0; i < fftSize / 2; ++i)
        {
            float mag = std::sqrt (fftData[i * 2] * fftData[i * 2] + fftData[i * 2 + 1] * fftData[i * 2 + 1]);
            float logMag = 20.0f * std::log10 (mag + 1e-5f);
            
            // Mapear de dB (-60 a 0) a coordenadas de pantalla (Y)
            float normMag = (logMag + 60.0f) / 60.0f;
            normMag = std::clamp (normMag, 0.0f, 1.0f);

            float x = area.getX() + ((float)i / (float)(fftSize / 2)) * width;
            float y = bottomY - (normMag * height * 0.8f);

            if (i == 0) p.startNewSubPath (x, y);
            else p.lineTo (x, y);
        }

        g.setColour (colour.withAlpha (0.5f));
        g.strokePath (p, juce::PathStrokeType (1.5f));
    }
};

class AudioABVisualizerWindow : public juce::DocumentWindow
{
public:
    AudioABVisualizerWindow (const juce::AudioBuffer<float>& refBuf, const juce::AudioBuffer<float>& capBuf)
        : DocumentWindow ("Audio A/B Comparison Visualizer",
                          juce::Colours::black,
                          DocumentWindow::allButtons)
    {
        setUsingNativeTitleBar (true);
        visualizer.setBuffers (refBuf, capBuf);
        setContentNonOwned (&visualizer, true);
        
        setResizable (true, true);
        centreWithSize (800, 500);
        setVisible (true);
    }

    void closeButtonPressed() override
    {
        delete this;
    }

private:
    AudioABVisualizerComponent visualizer;
};

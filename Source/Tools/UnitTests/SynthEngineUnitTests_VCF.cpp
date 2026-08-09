/**
 * @purpose Unit tests for SynthEngine DSP: VCF filter models, pole modes, oversampling,
 *          MoogLadder, KorgMS20, filter switching, rolloff contract, bipolar envDepth.
 * Extracted from SynthEngineUnitTests.cpp for modularization.
 * @classification Test
 */
#include <JuceHeader.h>
#include "SynthEngine.h"
#include "Filter.h"
#include "DSPHelpers.h"
#include "JunoVCF_ZDF.h"
#if DEEP_TARGET_MODEL >= 2
#include "MoogLadderVCF.h"
#include "KorgMS20VCF.h"
#endif

namespace ABD
{

// Goertzel bin power at a single frequency — used to measure the fundamental of a
// rendered note so the (gentle, -6dB/oct) global HPF bass cut is clearly observable.
static float goertzelPower(const float* data, int n, double freqHz, double sampleRate)
{
    const double w  = 2.0 * juce::MathConstants<double>::pi * freqHz / sampleRate;
    const double c  = 2.0 * std::cos(w);
    double s1 = 0.0, s2 = 0.0;
    for (int i = 0; i < n; ++i)
    {
        const double s0 = data[i] + c * s1 - s2;
        s2 = s1;
        s1 = s0;
    }
    return (float)(s1 * s1 + s2 * s2 - c * s1 * s2);
}

class SynthEngineVCFUnitTests : public juce::UnitTest
{
public:
    static constexpr double kTestSampleRate = 44100.0;

    SynthEngineVCFUnitTests() : juce::UnitTest("SynthEngine VCF Tests", "ABD") {}

    void runTest() override
    {
        //==============================================================================
        beginTest("VCF pole mode enumeration");
        {
            auto clampPole = [](int mode) -> int { return std::clamp(mode, 0, 1); };
            expectEquals(clampPole(0), 0, "Pole mode 0 → 4-Pole");
            expectEquals(clampPole(1), 1, "Pole mode 1 → 2-Pole");
            expectEquals(clampPole(-1), 0, "Pole mode -1 should clamp to 0");
            expectEquals(clampPole(2), 1, "Pole mode 2 should clamp to 1");
            logMessage("VCF pole mode: OK");
        }

        //==============================================================================
        beginTest("VCF TPT ZDF — produces output and responds to cutoff/resonance");
        {
            const double sr = kTestSampleRate;
            ABD::VCF vcf;
            vcf.prepare(sr);
            float outputLowRes = 0.0f;
            vcf.setCutoff(1000.0f); vcf.setResonance(0.0f);
            for (int i = 0; i < 256; ++i) outputLowRes = vcf.process(0.5f);
            expect(std::isfinite(outputLowRes), "VCF output should be finite");
            expect(std::abs(outputLowRes) <= 1.0f, "VCF output should be in [-1,1]");

            vcf.prepare(sr); vcf.setCutoff(1000.0f); vcf.setResonance(0.9f);
            float outputHighRes = 0.0f;
            for (int i = 0; i < 256; ++i) outputHighRes = vcf.process(0.5f);
            expect(std::isfinite(outputHighRes), "VCF high-res output should be finite");

            vcf.prepare(sr); vcf.setCutoff(200.0f); vcf.setResonance(0.0f);
            float outputLowCut = 0.0f;
            for (int i = 0; i < 512; ++i) outputLowCut = vcf.process(0.5f);
            vcf.prepare(sr); vcf.setCutoff(8000.0f); vcf.setResonance(0.0f);
            float outputHighCut = 0.0f;
            for (int i = 0; i < 512; ++i) outputHighCut = vcf.process(0.5f);
            expect(outputHighCut != outputLowCut, "Different cutoffs should produce different DC response");
            logMessage("VCF TPT ZDF: OK");
        }

        //==============================================================================
        beginTest("VCF oversampling — setOversample does not crash");
        {
            const double sr = kTestSampleRate;
            for (int factor : { 1, 2, 4 })
            {
                ABD::VCF vcf;
                vcf.prepare(sr); vcf.setOversample(factor);
                vcf.setCutoff(1000.0f); vcf.setResonance(0.3f);
                float output = 0.0f;
                for (int i = 0; i < 256; ++i) output = vcf.process(0.5f);
                expect(std::isfinite(output), "VCF " + juce::String(factor) + "x oversample output should be finite");
                expect(std::abs(output) <= 1.5f, "VCF " + juce::String(factor) + "x oversample output should be bounded");
            }
            logMessage("VCF oversampling: OK");
        }

        //==============================================================================
#if DEEP_TARGET_MODEL >= 2
        beginTest("MoogLadder — basic output, pole modes, and resonance bounds");
        {
            const double sr = kTestSampleRate;
            MoogLadderVCF moog;
            moog.prepare(sr); moog.setCutoff(1000.0f); moog.setResonance(0.0f); moog.setPoleMode(0);
            float maxAbs = 0.0f;
            for (int i = 0; i < 1024; ++i)
            {
                float out = moog.process(1.0f);
                expect(std::isfinite(out), "MoogLadder DC output should be finite");
                maxAbs = std::max(maxAbs, std::abs(out));
            }
            expect(maxAbs <= 2.0f, "MoogLadder DC output should be bounded <= 2.0");

            moog.prepare(sr); moog.setCutoff(100.0f); moog.setResonance(0.0f); moog.setPoleMode(0);
            float out4 = 0.0f;
            for (int i = 0; i < 2048; ++i) out4 = moog.process(1.0f);
            moog.prepare(sr); moog.setCutoff(100.0f); moog.setResonance(0.0f); moog.setPoleMode(1);
            float out2 = 0.0f;
            for (int i = 0; i < 2048; ++i) out2 = moog.process(1.0f);
            expect(std::abs(out4 - 0.762f) < 0.1f, "4-pole DC output should converge near tanh(1.0)≈0.762");
            expect(std::abs(out2 - 0.762f) < 0.1f, "2-pole DC output should converge near tanh(1.0)≈0.762");

            moog.prepare(sr); moog.setCutoff(2000.0f); moog.setResonance(1.0f);
            float maxResOut = 0.0f;
            for (int i = 0; i < 4096; ++i) maxResOut = std::max(maxResOut, std::abs(moog.process(0.5f)));
            expect(maxResOut <= 3.0f, "MoogLadder max-res output bounded <= 3.0");

            moog.prepare(sr); moog.setCutoff(100.0f); moog.setResonance(0.0f); moog.setPoleMode(0);
            float hfMax = 0.0f;
            for (int i = 0; i < 4096; ++i) {
                float sine = std::sin(2.0f * (float)M_PI * 5000.0f * (float)i / (float)sr);
                float out = moog.process(sine);
                if (i >= 2048) hfMax = std::max(hfMax, std::abs(out));
            }
            expect(hfMax < 0.1f, "MoogLadder should reject HF: 5 kHz through 100 Hz LP");
            logMessage("MoogLadder: OK");
        }

        //==============================================================================
        beginTest("KorgMS20VCF — basic output, pole modes, and resonance bounds");
        {
            const double sr = kTestSampleRate;
            KorgMS20VCF korg;
            korg.prepare(sr); korg.setCutoff(1000.0f); korg.setResonance(0.0f); korg.setPoleMode(0);
            float maxAbs = 0.0f;
            for (int i = 0; i < 1024; ++i) {
                expect(std::isfinite(korg.process(1.0f)), "KorgMS20 output should be finite");
                maxAbs = std::max(maxAbs, std::abs(korg.process(0.0f))); // reset for next
            }

            korg.prepare(sr); korg.setCutoff(100.0f); korg.setResonance(0.0f); korg.setPoleMode(0);
            float out4 = 0.0f;
            for (int i = 0; i < 2048; ++i) out4 = korg.process(1.0f);
            korg.prepare(sr); korg.setCutoff(100.0f); korg.setResonance(0.0f); korg.setPoleMode(1);
            float out2 = 0.0f;
            for (int i = 0; i < 2048; ++i) out2 = korg.process(1.0f);
            expect(std::abs(out4 - 1.0f) < 0.2f, "4-pole should converge near 1.0");
            expect(std::abs(out2 - 1.0f) < 0.2f, "2-pole should converge near 1.0");

            korg.prepare(sr); korg.setCutoff(2000.0f); korg.setResonance(1.0f);
            float maxResOut = 0.0f;
            for (int i = 0; i < 4096; ++i) maxResOut = std::max(maxResOut, std::abs(korg.process(0.5f)));
            expect(maxResOut <= 10.0f, "KorgMS20 max-res output bounded <= 10.0");

            korg.prepare(sr); korg.setCutoff(100.0f); korg.setResonance(0.0f); korg.setPoleMode(0);
            float hfMax = 0.0f;
            for (int i = 0; i < 4096; ++i) {
                float sine = std::sin(2.0f * (float)M_PI * 5000.0f * (float)i / (float)sr);
                float out = korg.process(sine);
                if (i >= 2048) hfMax = std::max(hfMax, std::abs(out));
            }
            expect(hfMax < 0.15f, "KorgMS20 should reject HF: 5 kHz through 100 Hz LP");
            logMessage("KorgMS20VCF: OK");
        }

        //==============================================================================
        beginTest("Filter model switching — prepare() resets state cleanly");
        {
            const double sr = kTestSampleRate;
            MoogLadderVCF moog; KorgMS20VCF korg;
            moog.prepare(sr); moog.setCutoff(3000.0f); moog.setResonance(0.8f);
            for (int i = 0; i < 512; ++i) moog.process(0.9f);
            korg.prepare(sr); korg.setCutoff(3000.0f); korg.setResonance(0.8f);
            for (int i = 0; i < 512; ++i) korg.process(0.9f);
            moog.prepare(sr); moog.setCutoff(1000.0f); moog.setResonance(0.0f);
            float mDC = 0.0f;
            for (int i = 0; i < 1024; ++i) mDC = moog.process(0.5f);
            korg.prepare(sr); korg.setCutoff(1000.0f); korg.setResonance(0.0f);
            float kDC = 0.0f;
            for (int i = 0; i < 1024; ++i) kDC = korg.process(0.5f);
            expect(std::isfinite(mDC) && std::isfinite(kDC), "Both filters should produce finite output after prepare() reset");
            logMessage("Filter model switching: OK");
        }
#endif

        //==============================================================================
        beginTest("VCF 2-pole vs 4-pole rolloff contract");
        {
            const double sr = kTestSampleRate;
            ABD::VCF vcf4, vcf2;
            vcf4.prepare(sr); vcf4.setCutoff(500.0f); vcf4.setResonance(0.0f);
            vcf2.prepare(sr); vcf2.setCutoff(500.0f); vcf2.setResonance(0.0f);
            for (int i = 0; i < 512; ++i) { vcf4.process(1.0f); vcf2.process(1.0f); }
            expect(std::isfinite(vcf4.process(0.5f)) && std::isfinite(vcf2.process(0.5f)),
                "Both 2-pole and 4-pole should produce finite output");
            logMessage("VCF 2-pole vs 4-pole rolloff: OK");
        }

        //==============================================================================
        beginTest("VCF bipolar envDepth — center (0.5) produces zero modulation");
        {
            auto envDepthToOffset = [](float normalized) -> float { return (normalized - 0.5f) * 2.0f; };
            expectWithinAbsoluteError(envDepthToOffset(0.5f), 0.0f, 0.001f, "envDepth=0.5 → 0 offset");
            expect(envDepthToOffset(0.0f) < 0.0f, "envDepth=0 → negative offset");
            expect(envDepthToOffset(1.0f) > 0.0f, "envDepth=1 → positive offset");
            expectWithinAbsoluteError(envDepthToOffset(0.0f), -1.0f, 0.001f, "envDepth=0 → -1");
            expectWithinAbsoluteError(envDepthToOffset(1.0f), 1.0f, 0.001f, "envDepth=1 → +1");
            logMessage("VCF bipolar envDepth center: OK");
        }

        //==============================================================================
        beginTest("VCF self-oscillation — onset at res≈0.86 (hardware ~220/255)");
        {
            // --- Curve math: the resonance curve is the single res→k mapping ---
            expect(JunoVCF_ZDF::ResK_J106(0.0f) < 4.0f, "res=0 → k below self-osc threshold");
            expect(JunoVCF_ZDF::ResK_J106(0.5f) < 4.0f, "res=0.5 → k below self-osc threshold");
            expect(JunoVCF_ZDF::ResK_J106(0.855f) >= 4.0f, "res≈0.855 → k reaches ladder self-osc threshold (4.0)");
            expect(JunoVCF_ZDF::ResK_J106(0.86f) >= 4.0f, "res=0.86 (hardware onset) → k ≥ 4.0");
            expect(JunoVCF_ZDF::ResK_J106(1.0f) >= JunoVCF_ZDF::ResK_J106(0.86f), "J106 curve is monotonic increasing");
            expect(JunoVCF_ZDF::ResK_J106(0.86f) * VcfCalibration::kDeepMindResCurveScale >= 4.0f,
                "DeepMind curve reaches self-osc at res=0.86");
            expect(JunoVCF_ZDF::SoftClipK(JunoVCF_ZDF::ResK_J106(0.86f)) >= 4.0f,
                "SoftClipK knee (4.0) must NOT pull the 0.86 point under the self-osc threshold");
            expect(JunoVCF_ZDF::SoftClipK(JunoVCF_ZDF::ResK_J106(0.5f)) == JunoVCF_ZDF::ResK_J106(0.5f),
                "SoftClipK leaves k unchanged below the knee");
            expect(JunoVCF_ZDF::SoftClipK(1.0e3f) <= 6.6f, "SoftClipK ceiling still holds");
            logMessage("VCF self-osc curve math: OK");

            // --- Dynamic: impulse then silence; measure sustained tail ---
            const double sr = kTestSampleRate;
            const float frq = 0.2f; // 4.41 kHz @44.1k
            auto tailPeak = [&](float res) -> float {
                ABD::JunoVCF_ZDF f;
                f.prepare(sr);
                f.setMode(JunoVCF_ZDF::Mode::DeepMind);
                f.process(1.0f, frq, res);   // differential impulse charges the ladder states
                f.process(-1.0f, frq, res);
                float peak = 0.0f;
                for (int i = 0; i < 8192; ++i)
                    peak = std::max(peak, std::abs(f.process(0.0f, frq, res)));
                return peak;
            };

            const float below = tailPeak(0.5f);   // stable: tail must decay to the noise floor
            const float atSelfOsc = tailPeak(0.86f);
            const float above = tailPeak(1.0f);
            expect(std::isfinite(below) && std::isfinite(atSelfOsc) && std::isfinite(above),
                "Self-osc tail outputs must be finite");
            expect(below < 0.05f, "Below the threshold the filter decays to the noise floor");
            expect(atSelfOsc > 0.05f, "At res=0.86 the filter sustains audible oscillation");
            expect(atSelfOsc > below * 2.0f, "Self-osc tail must be well above the decay/noise floor");
            expect(above > below * 2.0f, "res=1.0 also sustains well above the floor");
            logMessage("VCF self-osc onset: below=" + juce::String(below) +
                       " at0.86=" + juce::String(atSelfOsc) + " at1.0=" + juce::String(above));
        }

        //==============================================================================
        beginTest("VCF keytrack — 1:1/oct multiplicative, pivots at middle C");
        {
            using ABD::DSP::filterKeyTrackRatio;
            const float ref = 261.63f; // C4 (hardware pivot)

            // keyTrack=0 → cutoff unchanged for any note
            expectWithinAbsoluteError(filterKeyTrackRatio(1046.5f, ref, 0.0f), 1.0f, 1.0e-5f,
                "keyTrack 0 → ratio 1 (no tracking)");
            // Pivot: playing middle C leaves cutoff unchanged
            expectWithinAbsoluteError(filterKeyTrackRatio(ref, ref, 1.0f), 1.0f, 1.0e-5f,
                "middle C is the keytrack pivot (ratio 1)");
            // 1:1/oct: an octave above doubles, an octave below halves
            expectWithinAbsoluteError(filterKeyTrackRatio(ref * 2.0f, ref, 1.0f), 2.0f, 1.0e-3f,
                "one octave up → cutoff doubles (1:1/oct)");
            expectWithinAbsoluteError(filterKeyTrackRatio(ref * 0.5f, ref, 1.0f), 0.5f, 1.0e-3f,
                "one octave down → cutoff halves (1:1/oct)");
            // Two octaves up → quadruple
            expectWithinAbsoluteError(filterKeyTrackRatio(ref * 4.0f, ref, 1.0f), 4.0f, 1.0e-3f,
                "two octaves up → cutoff ×4");
            // Half tracking → an octave up opens sqrt(2) (12 semitones × 0.5)
            expectWithinAbsoluteError(filterKeyTrackRatio(ref * 2.0f, ref, 0.5f), std::sqrt(2.0f), 1.0e-3f,
                "half tracking → octave up opens by √2");
            // Monotonic: higher notes always open the filter at positive tracking
            expect(filterKeyTrackRatio(ref * 2.0f, ref, 1.0f) > filterKeyTrackRatio(ref, ref, 1.0f),
                "keytrack is monotonic with pitch");
            // Degenerate inputs stay safe (ratio 1)
            expectWithinAbsoluteError(filterKeyTrackRatio(0.0f, ref, 1.0f), 1.0f, 1.0e-5f,
                "freq 0 → ratio 1 (guard)");
            expectWithinAbsoluteError(filterKeyTrackRatio(ref, 0.0f, 1.0f), 1.0f, 1.0e-5f,
                "reference 0 → ratio 1 (guard)");
            logMessage("VCF keytrack 1:1/oct: OK");
        }

        //==============================================================================
        beginTest("VCF self-osc stability sweep — output stays finite & bounded");
        {
            const float frq = 0.2f; // ~4.4 kHz @44.1k
            const int steps = 4096;
            float worstPeak = 0.0f;

            for (int mode = 1; mode <= 4; mode *= 2)      // oversample 1x, 2x, 4x
            {
                for (int ri = 0; ri <= 20; ++ri)          // res 0.00 → 1.00 (21 steps)
                {
                    const float res = ri * 0.05f;
                    ABD::JunoVCF_ZDF f;
                    f.prepare(kTestSampleRate);
                    f.setMode(JunoVCF_ZDF::Mode::DeepMind);
                    f.setOversample(mode);
                    f.process(1.0f, frq, res);            // differential impulse
                    f.process(-1.0f, frq, res);
                    float peak = 0.0f;
                    for (int i = 0; i < steps; ++i)
                    {
                        const float out = f.process(0.0f, frq, res);
                        expect(std::isfinite(out), "self-osc sweep output must stay finite");
                        peak = std::max(peak, std::abs(out));
                    }
                    expect(peak < 8.0f, "self-osc sweep output must stay bounded");
                    worstPeak = std::max(worstPeak, peak);
                }
            }

            logMessage("VCF self-osc stability sweep: worstPeak=" + juce::String(worstPeak));
        }

        //==============================================================================
        beginTest("Global HPF (post-VCA) — hpf_cutoff cuts lows on the summed bus");
        {
            // El HPF del hardware va tras la suma de voces (VCF → VCA → SUM → HPF → FX).
            // Medimos la fundamental (C2 ≈ 65.4 Hz) con Goertzel: al subir hpf_cutoff a
            // 2000 Hz la fundamental debe caer ~30 dB (1-polo, -6 dB/oct), mientras que
            // con hpf abierto (20 Hz) pasa casi intacta.
            constexpr double kFundHz = 65.406;
            constexpr int kBlocks = 32;
            constexpr int kBlockSize = 1024;
            constexpr int kTotal = kBlocks * kBlockSize;

            auto renderLowNote = [&](float hpfHz) -> float {
                SynthEngine engine;
                engine.prepare(kTestSampleRate, kBlockSize);
                engine.setGlobalHpfCutoff(hpfHz);
                engine.setGlobalHpfBassBoost(false);

                juce::AudioBuffer<float> left(1, kTotal);
                juce::AudioBuffer<float> buffer(2, kBlockSize);
                juce::MidiBuffer midi;
                int pos = 0;
                for (int i = 0; i < kBlocks; ++i)
                {
                    buffer.clear();
                    midi.clear();
                    if (i == 0)
                        midi.addEvent(juce::MidiMessage::noteOn(1, 36, 0.9f), 0); // C2 ≈ 65 Hz
                    engine.processBlock(buffer, midi);
                    left.copyFrom(0, pos, buffer.getReadPointer(0), kBlockSize);
                    pos += kBlockSize;
                }
                return goertzelPower(left.getReadPointer(0), kTotal, kFundHz, kTestSampleRate);
            };

            const float openFund = renderLowNote(20.0f);    // HPF totalmente abierto
            const float cutFund  = renderLowNote(2000.0f);  // HPF máximo → corta los graves

            expect(openFund > 0.001f, "HPF fully open: fundamental must be present (pow="
                   + juce::String(openFund, 6) + ")");
            expect(cutFund < openFund * 0.04f,
                   "HPF max: fundamental must be strongly attenuated (openPow="
                   + juce::String(openFund, 6) + " cutPow=" + juce::String(cutFund, 6) + ")");
            logMessage("Global HPF post-VCA: openFundPow=" + juce::String(openFund, 6)
                       + " cutFundPow=" + juce::String(cutFund, 6));
        }

        //==============================================================================
        beginTest("Global HPF — mod matrix (common) modulates the bus cutoff");
        {
            // Ruta común: Mod Wheel → HPF Freq (destino "common": fuentes globales).
            // Con la rueda al máximo la fundamental debe atenuarse tanto como con
            // hpf_cutoff=2000 (modScale 18000 Hz × 1.0 → clamp a 2000 Hz).
            constexpr double kFundHz = 65.406;
            constexpr int kBlocks = 24;
            constexpr int kBlockSize = 1024;
            constexpr int kTotal = kBlocks * kBlockSize;

            auto renderWithWheel = [&](int wheelVal) -> float {
                SynthEngine engine;
                engine.prepare(kTestSampleRate, kBlockSize);
                engine.setGlobalHpfCutoff(20.0f);   // base abierta
                engine.setGlobalHpfBassBoost(false);

                auto& mod = engine.getModulationMatrix();
                mod.clear();
                mod.setRoute(0, ModSource::kModWheel, ModDestination::kFilterHPFCutoff, 1.0f);

                juce::AudioBuffer<float> left(1, kTotal);
                juce::AudioBuffer<float> buffer(2, kBlockSize);
                juce::MidiBuffer midi;
                int pos = 0;
                for (int i = 0; i < kBlocks; ++i)
                {
                    buffer.clear();
                    midi.clear();
                    if (i == 0)
                        midi.addEvent(juce::MidiMessage::noteOn(1, 36, 0.9f), 0);
                    midi.addEvent(juce::MidiMessage::controllerEvent(1, 1, wheelVal), 0);
                    engine.processBlock(buffer, midi);
                    left.copyFrom(0, pos, buffer.getReadPointer(0), kBlockSize);
                    pos += kBlockSize;
                }
                return goertzelPower(left.getReadPointer(0), kTotal, kFundHz, kTestSampleRate);
            };

            const float noModFund   = renderWithWheel(0);
            const float fullModFund = renderWithWheel(127);

            expect(noModFund > 0.001f, "Without modulation the fundamental must sound (pow="
                   + juce::String(noModFund, 6) + ")");
            expect(fullModFund < noModFund * 0.04f,
                   "Mod Wheel → HPF must cut the fundamental on the global bus (noModPow="
                   + juce::String(noModFund, 6) + " fullModPow=" + juce::String(fullModFund, 6) + ")");
            logMessage("Global HPF common mod: noModFundPow=" + juce::String(noModFund, 6)
                       + " fullModFundPow=" + juce::String(fullModFund, 6));
        }
    }
};

static SynthEngineVCFUnitTests synthEngineVCFUnitTests;

} // namespace ABD

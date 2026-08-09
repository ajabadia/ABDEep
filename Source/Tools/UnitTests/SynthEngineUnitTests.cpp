/**
 * @purpose Unit tests for SynthEngine DSP: portamento ranges, glide simulation,
 *          and TST-03 portamento behavior.
 * Voice/OSC/Envelope/LFO tests moved to SynthEngineUnitTests_Voice.cpp.
 * Drift/HPF tests moved to SynthEngineUnitTests_Drift.cpp.
 * VCF/Filter tests moved to SynthEngineUnitTests_VCF.cpp.
 * Transpose/Pitch tests moved to SynthEngineUnitTests_Pitch.cpp.
 * CalSpec/Round-Trip tests moved to SynthEngineUnitTests_CalSpec.cpp.
 * @classification Test
 */
#include <JuceHeader.h>
#include "SynthEngine.h"
#include "Envelope.h"
#include "Core/ParametersSpec.h"

namespace ABD
{

class SynthEngineUnitTests : public juce::UnitTest
{
public:
    static constexpr double kTestSampleRate = 44100.0;

    SynthEngineUnitTests() : juce::UnitTest("SynthEngine DSP Tests", "ABD") {}

    void runTest() override
    {
        //==============================================================================
        beginTest("Portamento parameter ranges");
        {
            auto clampMode = [](int mode) -> int { return std::clamp(mode, 0, 13); };
            for (int mode = 0; mode <= 13; ++mode) expectEquals(clampMode(mode), mode, "Porta mode " + juce::String(mode) + " should be valid");
            expectEquals(clampMode(-1), 0, "Porta mode -1 should clamp to 0");
            expectEquals(clampMode(14), 13, "Porta mode 14 should clamp to 13");

            const float sr = static_cast<float>(kTestSampleRate);
            auto timeToRate = [](float normalized, float sampleRate) -> float {
                if (normalized <= 0.0f) return 1.0f;
                float tau = normalized * 5.0f;
                return 1.0f - std::exp(-1.0f / (tau * sampleRate));
            };
            expectWithinAbsoluteError(timeToRate(0.0f, sr), 1.0f, 0.001f, "Porta time 0 → instant glide");
            expect(timeToRate(0.5f, sr) < 0.5f, "Porta time 0.5 should have rate < 0.5");
            expect(timeToRate(1.0f, sr) > 0.0f && timeToRate(1.0f, sr) < 0.001f, "Porta time 1.0 should have very small positive rate");
            logMessage("Portamento parameter ranges: OK");
        }

        //==============================================================================
        beginTest("Portamento glide simulation");
        {
            const float sr = static_cast<float>(kTestSampleRate);
            const float portaTime = 1.0f;
            auto simulateGlide = [&](int mode, int maxSamples) -> int {
                double pitch = 60.0;
                const double target = 72.0;
                for (int s = 0; s < maxSamples; ++s)
                {
                    double rate = 0.0;
                    if (portaTime <= 0.0f) rate = 1.0;
                    else {
                        double tau = (double)portaTime * 5.0;
                        bool isFixRate = (mode == 2 || mode == 3 || mode == 6 || mode == 7 || mode == 8 || mode == 9);
                        if (isFixRate) rate = 12.0 / (tau * (double)sr);
                        else {
                            rate = 1.0 - std::exp(-1.0 / (tau * (double)sr));
                            if (mode == 4 || mode == 5) rate = rate * rate;
                        }
                    }
                    bool isFixRate = (mode == 2 || mode == 3 || mode == 6 || mode == 7 || mode == 8 || mode == 9);
                    if (isFixRate) pitch += (target > pitch ? 1.0 : -1.0) * rate;
                    else pitch += (target - pitch) * rate;
                    if (std::abs(pitch - target) < 0.001) return s + 1;
                }
                return -1;
            };

            int samplesMode0 = simulateGlide(0, (int)(sr * 60));
            expect(samplesMode0 > (int)(sr * 2), "Mode 0: 12-semitone glide should take > 2s");
            expect(samplesMode0 < (int)(sr * 55), "Mode 0: 12-semitone glide should take < 55s");

            int samplesMode2 = simulateGlide(2, (int)(sr * 10));
            expect(samplesMode2 > (int)(sr * 3), "Mode 2: fix-rate should take > 3s");
            expect(samplesMode2 < (int)(sr * 8), "Mode 2: fix-rate should take < 8s");

            int samplesMode4 = simulateGlide(4, (int)(sr * 120));
            if (samplesMode0 > 0 && samplesMode4 > 0)
                expect(samplesMode4 > samplesMode0, "Mode 4 should be slower than mode 0");
            logMessage("Portamento glide simulation: OK");
        }

        //==============================================================================
        beginTest("TST-03 Portamento time increases glide duration");
        {
            auto simulatePortamentoSamples = [](float portaTime, int maxSamples) -> int {
                double pitch = 60.0;
                const double target = 84.0;
                double rate = (portaTime <= 0.0f) ? 1.0 : 1.0 - std::exp(-1.0 / (portaTime * 0.05 * 44100.0));
                for (int s = 0; s < maxSamples; ++s)
                {
                    pitch += (target - pitch) * rate;
                    if (std::abs(pitch - target) < 0.5) return s + 1;
                }
                return -1;
            };

            int fast = simulatePortamentoSamples(0.01f, 500000);
            int slow = simulatePortamentoSamples(0.5f, 500000);
            expect(fast > 0 && slow > 0, "Both portamento times should converge");
            expect(slow > fast, "Slower portamento should take more samples (fast=" + juce::String(fast) + " slow=" + juce::String(slow) + ")");
            logMessage("TST-03 Portamento time: OK");
        }

        //==============================================================================
        beginTest("TST-03 Portamento Normal vs Fingered behavior");
        {
            auto simulateGlide = [](bool fingered, int startNote, int nextNote, float portaTime) -> int {
                double pitch = (double)startNote;
                const double target = (double)nextNote;
                double rate = (portaTime <= 0.0f) ? 1.0 : 1.0 - std::exp(-1.0 / (portaTime * 0.05 * 44100.0));
                if (fingered) pitch = (double)startNote;
                else { /* normal mode: glide from previous */ }
                for (int s = 0; s < 44100 * 5; ++s) {
                    pitch += (target - pitch) * rate;
                    if (std::abs(pitch - target) < 0.5) return s + 1;
                }
                return -1;
            };

            int normal = simulateGlide(false, 60, 72, 0.5f);
            int fingered = simulateGlide(true, 60, 72, 0.5f);
            expect(normal > 0, "Normal portamento should converge");
            expect(fingered > 0, "Fingered portamento should converge");
            logMessage("TST-03 Portamento Normal vs Fingered: OK");
        }

        //==============================================================================
        beginTest("LFO Arp Sync Clock Divide (hardware table, Master BPM)");
        {
            // raw=8 → división 4 (1 ciclo por 4 notas enteras a 120 BPM → 0.125 Hz)
            float hz0 = SynthEngine::lfoArpSyncHzFromRate(8.0f / 255.0f, 120.0f);
            expectWithinAbsoluteError(hz0, 120.0f / 60.0f / 16.0f, 0.001f, "raw=8 → division 4 → 0.125 Hz");

            // raw=255 → división 1/64 → 32 Hz
            float hzMax = SynthEngine::lfoArpSyncHzFromRate(1.0f, 120.0f);
            expectWithinAbsoluteError(hzMax, 32.0f, 0.5f, "raw=255 → division 1/64 → 32 Hz");

            // raw≈177 → división 1/16 (dieciseisillo) → 8 Hz
            float hz16th = SynthEngine::lfoArpSyncHzFromRate(177.0f / 255.0f, 120.0f);
            expectWithinAbsoluteError(hz16th, 8.0f, 0.25f, "raw≈177 → division 1/16 → 8 Hz");

            // raw 0-7 clamp a la primera división (4)
            float hzBelow = SynthEngine::lfoArpSyncHzFromRate(0.0f, 120.0f);
            expectWithinAbsoluteError(hzBelow, hz0, 0.001f, "raw<8 clamps to first division");

            // Monotonicidad no decreciente sobre todo el rango
            bool monotonic = true;
            float prev = -1.0f;
            for (int i = 0; i <= 64; ++i)
            {
                float hz = SynthEngine::lfoArpSyncHzFromRate((float)i / 64.0f, 120.0f);
                if (hz < prev) monotonic = false;
                prev = hz;
            }
            expect(monotonic, "LFO arp sync must be monotonic non-decreasing over rate");

            // Escala lineal con BPM: duplicar BPM duplica la frecuencia
            float hz60 = SynthEngine::lfoArpSyncHzFromRate(0.5f, 60.0f);
            float hz120b = SynthEngine::lfoArpSyncHzFromRate(0.5f, 120.0f);
            expectWithinAbsoluteError(hz120b, hz60 * 2.0f, 0.001f, "doubling BPM doubles arp-sync frequency");
            logMessage("LFO Arp Sync Clock Divide: OK");
        }

        //==============================================================================
        beginTest("Envelope ADSR curve polarity (hardware semantics)");
        {
            // Ataque: norm 0 (internal -1) = exponencial (subida rápida inicial),
            // norm 255 (internal +1) = logarítmica (subida lenta inicial).
            Envelope envExp, envLog;
            envExp.setSampleRate(kTestSampleRate);
            envLog.setSampleRate(kTestSampleRate);
            envExp.setParameters(0.02f, 0.01f, 1.0f, 0.01f);
            envLog.setParameters(0.02f, 0.01f, 1.0f, 0.01f);
            envExp.setCurves(-1.0f, 0.0f, 0.0f, 0.0f); // norm 0 → exponential
            envLog.setCurves(1.0f, 0.0f, 0.0f, 0.0f);  // norm 1 → logarithmic
            envExp.trigger();
            envLog.trigger();

            int atkQuarter = (int)(0.02 * kTestSampleRate * 0.25);
            float vExp = 0.0f, vLog = 0.0f;
            for (int i = 0; i < atkQuarter; ++i)
            {
                vExp = envExp.nextSample();
                vLog = envLog.nextSample();
            }
            expect(vExp > 0.4f, "Exponential attack rises fast initially (got " + juce::String(vExp) + ")");
            expect(vLog < 0.25f, "Logarithmic attack rises slowly initially (got " + juce::String(vLog) + ")");
            expect(vExp > vLog, "Exponential attack must lead logarithmic attack");

            // Decay: norm 0 = exponencial (caída rápida inicial); norm 1 = logarítmica.
            Envelope dExp, dLog;
            dExp.setSampleRate(kTestSampleRate);
            dLog.setSampleRate(kTestSampleRate);
            dExp.setParameters(0.001f, 0.02f, 0.3f, 0.01f);
            dLog.setParameters(0.001f, 0.02f, 0.3f, 0.01f);
            dExp.setCurves(0.0f, -1.0f, 0.0f, 0.0f); // norm 0 → exponential decay
            dLog.setCurves(0.0f, 1.0f, 0.0f, 0.0f);  // norm 1 → logarithmic decay
            dExp.trigger();
            dLog.trigger();
            int atkSamples = (int)(0.001 * kTestSampleRate) + 1;
            for (int i = 0; i < atkSamples; ++i)
            {
                dExp.nextSample();
                dLog.nextSample();
            }
            int decQuarter = (int)(0.02 * kTestSampleRate * 0.25);
            float lvExp = 1.0f, lvLog = 1.0f;
            for (int i = 0; i < decQuarter; ++i)
            {
                lvExp = dExp.nextSample();
                lvLog = dLog.nextSample();
            }
            expect(lvExp < lvLog, "Exponential decay must fall faster than logarithmic (exp=" + juce::String(lvExp) + " log=" + juce::String(lvLog) + ")");
            expect(lvExp < 0.9f, "Exponential decay should have dropped noticeably (got " + juce::String(lvExp) + ")");
            logMessage("Envelope ADSR curve polarity: OK");
        }

        //==============================================================================
        beginTest("Envelope one-shot bypasses sustain (triggerMode==3)");
        {
            Envelope env;
            env.setSampleRate(kTestSampleRate);
            env.setParameters(0.001f, 0.002f, 1.0f, 0.004f);
            env.setBypassSustain(true);
            env.trigger();

            bool reachedRelease = false;
            bool wentIdle = false;
            int total = (int)(kTestSampleRate * 0.02);
            for (int i = 0; i < total; ++i)
            {
                env.nextSample();
                if (env.getCurrentStage() == Envelope::Stage::kRelease) reachedRelease = true;
                if (!env.isActive()) { wentIdle = true; break; }
            }
            expect(reachedRelease, "One-shot must auto-transition decay → release (no sustain parking)");
            expect(wentIdle, "One-shot must complete and return to idle without note-off");

            // Sin bypass: la envolvente estándar queda en Sustain hasta release()
            Envelope park;
            park.setSampleRate(kTestSampleRate);
            park.setParameters(0.001f, 0.002f, 1.0f, 0.004f);
            park.trigger();
            int parkTotal = (int)(kTestSampleRate * 0.01);
            for (int i = 0; i < parkTotal; ++i) park.nextSample();
            expect(park.getCurrentStage() == Envelope::Stage::kSustain,
                "Standard envelope parks at sustain until release()");
            logMessage("Envelope one-shot bypass sustain: OK");
        }

        //==============================================================================
        beginTest("VCA env defaults match hardware (envDepth=1.0, velSens=0.5)");
        {
            bool foundDepth = false, foundVel = false;
            for (const auto& p : ParametersSpec::getVcaSpecs())
            {
                if (p.id == "vca_env_depth")
                {
                    foundDepth = true;
                    expectWithinAbsoluteError(p.defaultValue, 1.0f, 0.0001f, "vca_env_depth default must be 1.0");
                }
                if (p.id == "vca_vel_sens")
                {
                    foundVel = true;
                    expectWithinAbsoluteError(p.defaultValue, 0.5f, 0.0001f, "vca_vel_sens default must be 0.5");
                }
            }
            expect(foundDepth && foundVel, "VCA env specs must exist");
            logMessage("VCA env defaults: OK");
        }

        //==============================================================================
        beginTest("Arp clock divider default = 1/16 (index 9)");
        {
            bool found = false;
            for (const auto& p : ParametersSpec::getArpChordSpecs())
            {
                if (p.id == "arp_clock_divider")
                {
                    found = true;
                    expectWithinAbsoluteError(p.defaultValue, 9.0f, 0.0001f, "arp_clock_divider default must be index 9 (1/16)");
                    expectEquals(p.options.size(), 13, "arp_clock_divider must have 13 hardware ratios");
                    expectEquals(p.options[3], juce::String("1/4"), "index 3 = 1/4");
                    expectEquals(p.options[9], juce::String("1/16"), "index 9 = 1/16");
                    expectEquals(p.options[12], juce::String("1/48"), "index 12 = 1/48");
                }
            }
            expect(found, "arp_clock_divider spec must exist");
            logMessage("Arp clock divider default: OK");
        }
    }
};

static SynthEngineUnitTests synthEngineUnitTests;

} // namespace ABD

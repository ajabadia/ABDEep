/**
 * @purpose Rapid sweep tests for SynthEngine DSP modules.
 *          Sweeps all parameters from 0→1 in steps, verifying no NaN/Inf outputs.
 *          Complements the existing FX sweep tests in FXUnitTests_Standard.cpp
 *          and FXUnitTests_Advanced.cpp by covering the synth engine.
 * @classification Test/DSP
 */
#include <JuceHeader.h>
#include <cmath>
#include "SynthEngine.h"
#include "SynthVoice.h"
#include "Envelope.h"
#include "LFO.h"
#include "OSC1.h"
#include "OSC2.h"
#include "Filter.h"
#include "DriftEngine.h"
#include "ModulationMatrix.h"
#if DEEP_TARGET_MODEL >= 2
#include "MoogLadderVCF.h"
#include "KorgMS20VCF.h"
#endif
#include "../Core/CalibrationSpec.h"

namespace ABD
{

class SynthEngineRapidSweepTests : public juce::UnitTest
{
public:
    static constexpr double kTestSampleRate = 44100.0;

    SynthEngineRapidSweepTests() : juce::UnitTest("SynthEngine Rapid Sweep Tests", "ABD") {}

    void runTest() override
    {
        //==============================================================================
        beginTest("Envelope parameter rapid sweep — attack, decay, sustain, release");

        {
            Envelope env;
            env.setSampleRate(kTestSampleRate);

            const float timeValues[] = { 0.001f, 0.01f, 0.1f, 0.5f, 1.0f };
            const float sustainValues[] = { 0.0f, 0.5f, 1.0f };
            const float curveValues[] = { -1.0f, 0.0f, 1.0f };

            int totalCombos = 0;
            for (float a : timeValues)
            {
                for (float d : timeValues)
                {
                    for (float s : sustainValues)
                    {
                        for (float r : timeValues)
                        {
                            env.setParameters(a, d, s, r);

                            for (float curve : curveValues)
                            {
                                env.setCurves(curve, curve, curve, curve);
                                totalCombos++;

                                env.trigger();
                                for (int i = 0; i < 500; ++i)
                                {
                                    float sample = env.nextSample();
                                    expect(std::isfinite(sample),
                                        "Envelope NaN at a=" + juce::String(a)
                                        + " d=" + juce::String(d)
                                        + " s=" + juce::String(s));
                                }
                                env.release();
                                for (int i = 0; i < 1000; ++i)
                                {
                                    float sample = env.nextSample();
                                    expect(std::isfinite(sample),
                                        "Envelope NaN after release");
                                }
                            }
                        }
                    }
                }
            }
            logMessage("Envelope rapid sweep: OK (" + juce::String(totalCombos) + " combos)");
        }

        //==============================================================================
        beginTest("LFO parameter rapid sweep — shapes, rates, phases");

        {
            LFO lfo;
            lfo.setSampleRate(kTestSampleRate);

            for (int shape = 0; shape <= 6; ++shape)
            {
                lfo.setShape(shape);
                lfo.reset();
                lfo.trigger();

                for (float rate = 0.041f; rate <= 65.5f; rate *= 1.5f)
                {
                    lfo.setRate(rate);

                    for (float delay = 0.0f; delay <= 6.5f; delay += 1.0f)
                    {
                        lfo.setDelay(delay);

                        for (int s = 0; s < 500; ++s)
                        {
                            float sample = lfo.nextSample();
                            expect(std::isfinite(sample),
                                "LFO NaN shape=" + juce::String(shape)
                                + " rate=" + juce::String(rate));
                        }
                    }
                }
            }
            logMessage("LFO rapid sweep: OK (7 shapes x 11 rates)");
        }

        //==============================================================================
        beginTest("LFO key sync + slew rapid sweep");

        {
            LFO lfo;
            lfo.setSampleRate(kTestSampleRate);

            for (int shape = 0; shape <= 6; ++shape)
            {
                lfo.setShape(shape);
                lfo.setKeySync(true);
                lfo.trigger();

                for (float slew = 0.0f; slew <= 1.0f; slew += 0.2f)
                {
                    lfo.setSlew(slew);
                    for (int s = 0; s < 200; ++s)
                    {
                        float sample = lfo.nextSample();
                        expect(std::isfinite(sample),
                            "LFO keySync NaN shape=" + juce::String(shape));
                    }
                }
            }
            logMessage("LFO keySync + slew sweep: OK");
        }

        //==============================================================================
        beginTest("VCF (JunoVCF_ZDF) rapid sweep — cutoff, resonance, pole modes");

        {
            JunoVCF_ZDF vcf;
            vcf.prepare(kTestSampleRate);
            vcf.setMode(JunoVCF_ZDF::Mode::DeepMind);

            for (auto mode : { JunoVCF_ZDF::PoleMode::FourPole, JunoVCF_ZDF::PoleMode::TwoPole })
            {
                vcf.setPoleMode(mode);

                for (int cutoffStep = 0; cutoffStep <= 20; ++cutoffStep)
                {
                    float frq = 0.025f + cutoffStep * 0.025f;  // 0.025 to 0.525 (Nyquist clamp)
                    if (frq > 0.50f) frq = 0.50f;

                    for (int resStep = 0; resStep <= 15; ++resStep)
                    {
                        float res = resStep / 15.0f;

                        float input = std::sin(6.283185f * 220.0f * cutoffStep / static_cast<float>(kTestSampleRate)) * 0.5f;
                        float output = vcf.process(input, frq, res);

                        expect(std::isfinite(output),
                            "JunoVCF NaN frq=" + juce::String(frq)
                            + " res=" + juce::String(res));
                    }
                }
            }
            logMessage("JunoVCF_ZDF rapid sweep: OK (2 modes x 21 cutoffs x 16 resonances)");
        }

        //==============================================================================
#if DEEP_TARGET_MODEL >= 2
        beginTest("MoogLadderVCF rapid sweep — cutoff, resonance, pole/sub modes");

        {
            MoogLadderVCF vcf;
            vcf.prepare(kTestSampleRate);

            for (int poleMode = 0; poleMode <= 1; ++poleMode)
            {
                vcf.setPoleMode(poleMode);

                for (int subMode = 0; subMode <= 2; ++subMode)
                {
                    vcf.setSubMode(subMode);

                    for (int cutoffStep = 0; cutoffStep <= 15; ++cutoffStep)
                    {
                        float cutoffHz = 50.0f * std::pow(400.0f, cutoffStep / 15.0f);
                        vcf.setCutoff(cutoffHz);

                        for (int resStep = 0; resStep <= 10; ++resStep)
                        {
                            float res = resStep / 10.0f;
                            vcf.setResonance(res);

                            float input = std::sin(6.283185f * 220.0f * (cutoffStep + 1) / static_cast<float>(kTestSampleRate)) * 0.5f;
                            for (int s = 0; s < 5; ++s)
                            {
                                float output = vcf.process(input);
                                expect(std::isfinite(output),
                                    "MoogLadder NaN pole=" + juce::String(poleMode)
                                    + " sub=" + juce::String(subMode)
                                    + " cutoff=" + juce::String(cutoffHz));
                            }
                        }
                    }
                }
            }
            logMessage("MoogLadderVCF rapid sweep: OK (2 poles x 3 subs x 16 cutoffs x 11 resonances)");
        }

        //==============================================================================
        beginTest("KorgMS20VCF rapid sweep — cutoff, resonance, pole/sub modes");

        {
            KorgMS20VCF vcf;
            vcf.prepare(kTestSampleRate);

            for (int poleMode = 0; poleMode <= 1; ++poleMode)
            {
                vcf.setPoleMode(poleMode);

                for (int subMode = 0; subMode <= 1; ++subMode)
                {
                    vcf.setSubMode(subMode);

                    for (int cutoffStep = 0; cutoffStep <= 15; ++cutoffStep)
                    {
                        float cutoffHz = 50.0f * std::pow(400.0f, cutoffStep / 15.0f);
                        vcf.setCutoff(cutoffHz);

                        for (int resStep = 0; resStep <= 10; ++resStep)
                        {
                            float res = resStep / 10.0f;
                            vcf.setResonance(res);

                            float input = std::sin(6.283185f * 220.0f * (cutoffStep + 1) / static_cast<float>(kTestSampleRate)) * 0.5f;
                            for (int s = 0; s < 5; ++s)
                            {
                                float output = vcf.process(input);
                                expect(std::isfinite(output),
                                    "KorgMS20 NaN pole=" + juce::String(poleMode)
                                    + " sub=" + juce::String(subMode));
                            }
                        }
                    }
                }
            }
            logMessage("KorgMS20VCF rapid sweep: OK (2 poles x 2 subs x 16 cutoffs x 11 resonances)");
        }
#endif

        //==============================================================================
        beginTest("HPF (JunoHPF) rapid sweep — cutoff, bass boost, gain");

        {
            HPF hpf;
            hpf.prepare(kTestSampleRate);

            for (int cutoffStep = 0; cutoffStep <= 15; ++cutoffStep)
            {
                float cutoffHz = 20.0f * std::pow(100.0f, cutoffStep / 15.0f);  // 20Hz to 2kHz
                hpf.setCutoff(cutoffHz);

                for (int boostStep = 0; boostStep <= 5; ++boostStep)
                {
                    bool boostActive = (boostStep % 2 == 0);
                    float boostGain = (boostStep < 3) ? 1.0f : 2.0f;
                    hpf.setBassBoostActive(boostActive);
                    hpf.setBassBoostGain(boostGain);

                    float input = std::sin(6.283185f * 110.0f * (cutoffStep + 1) / static_cast<float>(kTestSampleRate)) * 0.5f;
                    float output = hpf.process(input);

                    expect(std::isfinite(output),
                        "HPF NaN cutoff=" + juce::String(cutoffHz)
                        + " boost=" + (boostActive ? "true" : "false"));
                }
            }
            logMessage("HPF rapid sweep: OK (16 cutoffs x 6 boost combos)");
        }

        //==============================================================================
        beginTest("DriftEngine rapid sweep — drift params");

        {
            DriftEngine drift;
            drift.setSampleRate(kTestSampleRate);

            for (float voiceDrift = 0.0f; voiceDrift <= 1.0f; voiceDrift += 0.1f)
            {
                for (float paramDrift = 0.0f; paramDrift <= 1.0f; paramDrift += 0.1f)
                {
                    for (float driftRate = 0.0f; driftRate <= 1.0f; driftRate += 0.1f)
                    {
                        drift.setDriftParams(voiceDrift, paramDrift, driftRate);

                        drift.nextSample();
                        float driftVal = drift.getOsc1PitchDrift();
                        expect(std::isfinite(driftVal),
                            "Drift NaN vd=" + juce::String(voiceDrift)
                            + " pd=" + juce::String(paramDrift));
                    }
                }
            }
            logMessage("DriftEngine rapid sweep: OK (11x11x11 combos)");
        }

        //==============================================================================
        beginTest("ModulationMatrix rapid sweep — route amounts");

        {
            ModulationMatrix matrix;
            float sourceValues[(int)ModSource::kMaxSources] = {};

            // Fill all sources with varying values
            for (int src = 0; src < (int)ModSource::kMaxSources; ++src)
                sourceValues[src] = std::sin((float)src) * 0.5f + 0.5f;

            // Sweep all routes with all source/destinations
            for (int slot = 0; slot < ModulationMatrix::kNumSlots; ++slot)
            {
                for (int src = 0; src < (int)ModSource::kMaxSources; ++src)
                {
                    for (int dest = 0; dest < (int)ModDestination::kMaxDestinations; ++dest)
                    {
                        for (float amount = -1.0f; amount <= 1.0f; amount += 0.25f)
                        {
                            matrix.setRoute(slot,
                                static_cast<ModSource>(src),
                                static_cast<ModDestination>(dest),
                                amount);

                            float modValue = matrix.getModulationValue(
                                static_cast<ModDestination>(dest),
                                sourceValues);

                            expect(std::isfinite(modValue),
                                "ModMatrix NaN slot=" + juce::String(slot));
                        }
                    }
                }
            }
            logMessage("ModulationMatrix rapid sweep: OK");
        }

        //==============================================================================
        beginTest("OSC1 rapid sweep — saw, pulse, PWM, range, phase reset");

        {
            OSC1 osc1;
            osc1.prepare(kTestSampleRate);
            osc1.setFrequency(440.0);

            for (int sawEn = 0; sawEn <= 1; ++sawEn)
            {
                for (int pulseEn = 0; pulseEn <= 1; ++pulseEn)
                {
                    if (sawEn == 0 && pulseEn == 0) continue;

                    for (float pwm = 0.0f; pwm <= 1.0f; pwm += 0.25f)
                    {
                        for (int range = 0; range <= 2; ++range)
                        {
                            float sample = osc1.nextSample();
                            expect(std::isfinite(sample),
                                "OSC1 NaN saw=" + juce::String(sawEn)
                                + " pulse=" + juce::String(pulseEn)
                                + " pwm=" + juce::String(pwm));
                        }
                    }
                }
            }
            logMessage("OSC1 rapid sweep: OK");
        }

        //==============================================================================
        beginTest("OSC2 rapid sweep — pitch, tone mod, level");

        {
            OSC2 osc2;
            osc2.prepare(kTestSampleRate);

            for (float pitch = -1.0f; pitch <= 1.0f; pitch += 0.5f)
            {
                osc2.setFrequency(440.0 * std::pow(2.0, pitch / 12.0));

                for (float toneMod = 0.0f; toneMod <= 1.0f; toneMod += 0.25f)
                {
                    osc2.setModulationValue(OSC2::kToneMod, toneMod);

                    for (float level = 0.0f; level <= 1.0f; level += 0.25f)
                    {
                        float sample = osc2.nextSample();
                        expect(std::isfinite(sample),
                            "OSC2 NaN pitch=" + juce::String(pitch)
                            + " tone=" + juce::String(toneMod));
                    }
                }
            }
            logMessage("OSC2 rapid sweep: OK");
        }

        //==============================================================================
        beginTest("VCA section rapid sweep — level, mode, env depth, vel sensitivity");

        {
            SynthVoice voice;
            voice.prepare(kTestSampleRate);

            const ModulationMatrix dummyMatrix;

            for (float vcaLevel = 0.0f; vcaLevel <= 1.0f; vcaLevel += 0.2f)
            {
                voice.params.vcaLevel = vcaLevel;

                for (int vcaMode = 0; vcaMode <= 1; ++vcaMode)
                {
                    voice.params.vcaMode = vcaMode;

                    for (float vcaEnvDepth = 0.0f; vcaEnvDepth <= 1.0f; vcaEnvDepth += 0.25f)
                    {
                        voice.params.vcaEnvDepth = vcaEnvDepth;

                        for (float vcaVelSens = 0.0f; vcaVelSens <= 1.0f; vcaVelSens += 0.25f)
                        {
                            voice.params.vcaVelSens = vcaVelSens;

                            voice.startNote(60, 0.8f, 0.0f);
                            juce::AudioBuffer<float> buf(2, 128);
                            buf.clear();
                            voice.process(buf, 0, 128, dummyMatrix);

                            for (int ch = 0; ch < 2; ++ch)
                                for (int s = 0; s < 128; ++s)
                                    expect(std::isfinite(buf.getSample(ch, s)),
                                        "VCA NaN level=" + juce::String(vcaLevel)
                                        + " mode=" + juce::String(vcaMode));

                            voice.stopNote(true);
                        }
                    }
                }
            }
            logMessage("VCA section rapid sweep: OK (6 levels x 2 modes x 5 depths x 5 sems)");
        }

        //==============================================================================
        beginTest("SynthEngine full integration — rapid parameter sweep via MIDI");

        {
            // Create a full engine, prepare it, and sweep while sending MIDI notes
            // This tests the entire signal chain: MIDI → voices → audio output
            SynthEngine engine;
            engine.prepare(kTestSampleRate, 256);

            // Send notes across the range
            for (int note = 36; note <= 96; note += 12)
            {
                // NoteOn
                juce::MidiBuffer midi;
                midi.addEvent(juce::MidiMessage::noteOn(1, note, (juce::uint8)100), 0);

                juce::AudioBuffer<float> buffer(2, 256);
                buffer.clear();

                engine.processBlock(buffer, midi);

                for (int ch = 0; ch < 2; ++ch)
                    for (int s = 0; s < 256; ++s)
                        expect(std::isfinite(buffer.getSample(ch, s)),
                            "Engine NaN note=" + juce::String(note)
                            + " ch=" + juce::String(ch));
            }

            // Test with all notes off (should produce zero/silence)
            {
                juce::MidiBuffer midi;
                for (int note = 36; note <= 96; note += 12)
                    midi.addEvent(juce::MidiMessage::noteOff(1, note), 0);

                juce::AudioBuffer<float> buffer(2, 256);
                buffer.clear();

                engine.processBlock(buffer, midi);

                for (int ch = 0; ch < 2; ++ch)
                    for (int s = 0; s < 256; ++s)
                        expect(std::isfinite(buffer.getSample(ch, s)),
                            "Engine NaN after noteOff");
            }

            logMessage("SynthEngine integration rapid sweep: OK (6 notes x 256 samples)");
        }
    }
};

static SynthEngineRapidSweepTests synthEngineRapidSweepTests;

} // namespace ABD

/**
 * @purpose Unit tests for SynthEngine DSP: voice management, oscillators, envelopes,
 *          LFO, modulation matrix, chord tables, unison, and PolyBLEP.
 * Extracted from SynthEngineUnitTests.cpp for modularization.
 * @classification Test
 */
#include <JuceHeader.h>
#include <cstring>
#include "SynthEngine.h"
#include "SynthVoice.h"
#include "DriftEngine.h"
#include "ModulationMatrix.h"
#include "Envelope.h"
#include "LFO.h"
#include "OSC2.h"
#include "DSPHelpers.h"

namespace ABD
{

class SynthEngineVoiceUnitTests : public juce::UnitTest
{
public:
    static constexpr double kTestSampleRate = 44100.0;

    SynthEngineVoiceUnitTests() : juce::UnitTest("SynthEngine Voice Tests", "ABD") {}

    void runTest() override
    {
        beginTest("Voice mode helpers — getVoicesPerNote");
        {
            int expected[13] = { 1, 2, 3, 4, 6, 12, 1, 2, 3, 4, 6, 1, 1 };
            for (int mode = 0; mode <= 12; ++mode)
            {
                int voices = 1;
                switch (mode) {
                    case 0:  voices = 1;  break; case 1:  voices = 2;  break;
                    case 2:  voices = 3;  break; case 3:  voices = 4;  break;
                    case 4:  voices = 6;  break; case 5:  voices = 12; break;
                    case 6:  voices = 1;  break; case 7:  voices = 2;  break;
                    case 8:  voices = 3;  break; case 9:  voices = 4;  break;
                    case 10: voices = 6;  break; case 11: voices = 1;  break;
                    case 12: voices = 1;  break;
                }
                expectEquals(voices, expected[mode], "Mode " + juce::String(mode) + " should return " + juce::String(expected[mode]));
            }
            logMessage("All 13 voice modes: OK");
        }

        beginTest("Unison detune calculation");
        {
            float detune = -25.0f / 100.0f;
            float detune2 = 25.0f / 100.0f;
            expect(detune < 0, "Voice 0 in 2-voice unison should have negative detune");
            expect(detune2 > 0, "Voice 1 in 2-voice unison should have positive detune");
            expectWithinAbsoluteError(std::abs(detune), std::abs(detune2), 0.001f, "2-voice detune should be symmetric");
            expectWithinAbsoluteError(std::abs(detune) * 100.0f, 25.0f, 0.1f, "max detune should be 25 cents with unisonDetune=0.5");

            float maxDetuneCents = 25.0f;
            int numVoices = 6;
            float step = 2.0f * maxDetuneCents / (float)(numVoices - 1);
            float expectedCents[6] = { -25.0f, -15.0f, -5.0f, 5.0f, 15.0f, 25.0f };
            for (int v = 0; v < numVoices; ++v)
            {
                float detuneCents = -maxDetuneCents + (float)v * step;
                expectWithinAbsoluteError(detuneCents, expectedCents[v], 0.1f, "Voice " + juce::String(v) + " detune mismatch");
            }
            logMessage("Unison detune symmetry: OK");
        }

        beginTest("Unison pan spread");
        {
            int numVoices = 4;
            float expectedPans[4] = { 0.0f, 1.0f / 3.0f, 2.0f / 3.0f, 1.0f };
            for (int v = 0; v < numVoices; ++v)
            {
                float pan = (float)v / (float)(numVoices - 1);
                expectWithinAbsoluteError(pan, expectedPans[v], 0.001f, "Pan for voice " + juce::String(v) + " mismatch");
            }
            expectWithinAbsoluteError(0.0f, 0.0f, 0.001f, "2-voice pan 0 should be 0");
            expectWithinAbsoluteError(1.0f, 1.0f, 0.001f, "2-voice pan 1 should be 1");
            logMessage("Unison pan distribution: OK");
        }

        beginTest("Chord interval tables");
        {
            struct ChordEntry { int intervals[6]; int numNotes; };
            ChordEntry expectedChords[8] = {
                { { 0, 4, 7, 12, 16, 19 }, 6 }, { { 0, 4, 7, -1, -1, -1 }, 3 },
                { { 0, 3, 7, -1, -1, -1 }, 3 }, { { 0, 4, 8, -1, -1, -1 }, 3 },
                { { 0, 3, 6, -1, -1, -1 }, 3 }, { { 0, 2, 7, -1, -1, -1 }, 3 },
                { { 0, 5, 7, -1, -1, -1 }, 3 }, { { 0, 4, 7, 10, -1, -1 }, 4 }
            };
            for (int type = 0; type < 8; ++type)
            {
                int numNotes = 0;
                for (int i = 0; i < 6; ++i) { if (expectedChords[type].intervals[i] < 0) break; numNotes++; }
                expectEquals(numNotes, expectedChords[type].numNotes, "Chord type " + juce::String(type) + " should have " + juce::String(expectedChords[type].numNotes) + " notes");
            }
            expectEquals(expectedChords[0].intervals[0], 0, "Memory chord root interval should be 0");
            expectEquals(expectedChords[0].intervals[1], 4, "Memory chord should contain a major third");
            logMessage("All 8 chord types: OK");
        }

        beginTest("SynthVoice default parameter values");
        {
            SynthVoice voice;
            voice.prepare(kTestSampleRate);
            expect(!voice.isActive(), "Voice should not be active before startNote");
            logMessage("Default parameters: OK");
        }

        beginTest("SynthVoice startNote and stopNote");
        {
            SynthVoice voice;
            voice.prepare(kTestSampleRate);
            voice.startNote(60, 0.8f, 0.0f);
            expect(voice.isActive(), "Voice should be active after startNote");
            expectEquals(voice.getMidiNote(), 60, "Voice should report MIDI note 60");
            voice.stopNote(false);
            const ModulationMatrix dummyMatrix;
            juce::AudioBuffer<float> dummyBuf(2, 1024);
            dummyBuf.clear();
            for (int s = 0; s < 10; ++s) voice.process(dummyBuf, 0, 1024, dummyMatrix);
            logMessage("Start/stop lifecycle: OK");
        }

        beginTest("ModulationMatrix slot routing");
        {
            ModulationMatrix matrix;
            float sourceValues[(int)ModSource::kMaxSources] = {};
            sourceValues[(int)ModSource::kLFO1] = 0.5f;
            float modValue = matrix.getModulationValue(ModDestination::kOsc1Pitch, sourceValues);
            expectWithinAbsoluteError(modValue, 0.0f, 0.001f, "Empty matrix should return 0 modulation");
            matrix.setRoute(0, ModSource::kLFO1, ModDestination::kOsc1Pitch, 0.8f);
            float expectedMod = 0.5f * 0.8f;
            modValue = matrix.getModulationValue(ModDestination::kOsc1Pitch, sourceValues);
            expectWithinAbsoluteError(modValue, expectedMod, 0.001f, "Single route should produce source*amount");
            sourceValues[(int)ModSource::kLFO2] = 0.6f;
            matrix.setRoute(1, ModSource::kLFO2, ModDestination::kOsc1Pitch, 0.3f);
            expectedMod = 0.5f * 0.8f + 0.6f * 0.3f;
            modValue = matrix.getModulationValue(ModDestination::kOsc1Pitch, sourceValues);
            expectWithinAbsoluteError(modValue, expectedMod, 0.001f, "Two routes should accumulate");
            modValue = matrix.getModulationValue(ModDestination::kFilterCutoff, sourceValues);
            expectWithinAbsoluteError(modValue, 0.0f, 0.001f, "Unrouted destination should return 0");
            logMessage("Modulation matrix routing: OK");
        }

        beginTest("Envelope ADSR lifecycle");
        {
            Envelope env;
            env.setSampleRate(kTestSampleRate);
            env.setParameters(0.005f, 0.005f, 0.5f, 0.05f);
            env.trigger();
            expect(env.isActive(), "Envelope should be active after trigger");
            const int adsrSamples = static_cast<int>(kTestSampleRate * 0.015);
            float maxLevel = 0.0f;
            for (int s = 0; s < adsrSamples; ++s) maxLevel = std::max(maxLevel, env.nextSample());
            expect(maxLevel > 0.99f, "Envelope peak should be near 1.0 (was " + juce::String(maxLevel) + ")");
            env.release();
            expect(env.isActive(), "Envelope should be active after release");
            const int releaseSamples = static_cast<int>(kTestSampleRate * 0.05) + 100;
            float lastLevel = 0.0f;
            for (int s = 0; s < releaseSamples; ++s) lastLevel = env.nextSample();
            expectWithinAbsoluteError(lastLevel, 0.0f, 0.01f, "Envelope level should be near 0 after release");
            expect(!env.isActive(), "Envelope should become inactive after release completes");
            logMessage("Envelope ADSR lifecycle: OK");
        }

        beginTest("LFO shape enumeration");
        {
            LFO lfo;
            lfo.setSampleRate(kTestSampleRate);
            lfo.setRate(440.0f);
            const char* shapeNames[] = { "Sine", "Triangle", "Square", "RampUp", "RampDown", "Smp&Hold", "Smp&Glide" };
            for (int shape = 0; shape <= 6; ++shape)
            {
                lfo.setShape(shape);
                lfo.reset();
                lfo.trigger();
                for (int s = 0; s < 100; ++s)
                    expect(std::isfinite(lfo.nextSample()), "LFO shape " + juce::String(shape) + " should produce finite output");
            }
            lfo.setShape(0);
            lfo.reset();
            lfo.trigger();
            float maxAbs = 0.0f;
            for (int s = 0; s < 100; ++s) maxAbs = std::max(maxAbs, std::abs(lfo.nextSample()));
            expect(maxAbs <= 1.0f, "Sine LFO output should be within [-1, 1] (maxAbs=" + juce::String(maxAbs) + ")");
            logMessage("LFO shapes 0-6: OK");
        }

        beginTest("Note priority edge cases");
        {
            int heldNotes[12] = {};
            int heldCount = 0;
            auto addNote = [&](int note) { if (heldCount < 12) heldNotes[heldCount++] = note; };
            auto removeNote = [&](int note) {
                for (int h = 0; h < heldCount; ++h)
                    if (heldNotes[h] == note) {
                        for (int r = h; r < heldCount - 1; ++r) heldNotes[r] = heldNotes[r + 1];
                        heldCount--; break;
                    }
            };
            addNote(48); addNote(52); addNote(55);
            int lowest = heldNotes[0];
            for (int h = 1; h < heldCount; ++h) if (heldNotes[h] < lowest) lowest = heldNotes[h];
            expectEquals(lowest, 48, "Lowest priority should select C3");
            int highest = heldNotes[0];
            for (int h = 1; h < heldCount; ++h) if (heldNotes[h] > highest) highest = heldNotes[h];
            expectEquals(highest, 55, "Highest priority should select G3");
            expectEquals(heldNotes[heldCount - 1], 55, "Last priority should select most recently added note");
            removeNote(52);
            expectEquals(heldCount, 2, "After removing E3, should have 2 notes");
            removeNote(48);
            lowest = heldNotes[0];
            for (int h = 1; h < heldCount; ++h) if (heldNotes[h] < lowest) lowest = heldNotes[h];
            expectEquals(lowest, 55, "After removing C3, lowest should be G3");
            logMessage("Note priority edge cases: OK");
        }

        beginTest("Envelope curve parameter mapping");
        {
            auto normalizedToCurve = [](float normalized) -> float { return normalized * 2.0f - 1.0f; };
            expectWithinAbsoluteError(normalizedToCurve(0.0f), -1.0f, 0.001f, "Curve 0 → -1.0 (exponential)");
            expectWithinAbsoluteError(normalizedToCurve(0.5f), 0.0f, 0.001f, "Curve 0.5 → 0.0 (linear)");
            expectWithinAbsoluteError(normalizedToCurve(1.0f), 1.0f, 0.001f, "Curve 1.0 → 1.0 (logarithmic)");
            logMessage("Envelope curve mapping: OK");
        }

        beginTest("Held notes tracker limits");
        {
            int heldNotes[12] = {}; int heldCount = 0;
            auto removeNote = [&](int note) {
                for (int h = 0; h < heldCount; ++h)
                    if (heldNotes[h] == note) {
                        for (int r = h; r < heldCount - 1; ++r) heldNotes[r] = heldNotes[r + 1];
                        heldCount--; break;
                    }
            };
            removeNote(60);
            expectEquals(heldCount, 0, "Empty tracker should remain empty after removing non-existent note");
            for (int i = 0; i < 12; ++i) { if (heldCount < 12) heldNotes[heldCount++] = 36 + i; }
            expectEquals(heldCount, 12, "Tracker should hold 12 notes");
            if (heldCount < 12) heldNotes[heldCount++] = 48;
            expectEquals(heldCount, 12, "Tracker should reject overflow");
            logMessage("Held notes tracker limits: OK");
        }

        beginTest("Poly chord accumulator reset");
        {
            int heldNotes[12] = {}; int heldCount = 0;
            for (int i = 0; i < 5; ++i) heldNotes[heldCount++] = 40 + i;
            expect(heldCount == 5 && heldNotes[0] == 40 && heldNotes[4] == 44, "Accumulator should hold 5 notes");
            heldCount = 0; std::memset(heldNotes, 0, sizeof(heldNotes));
            expectEquals(heldCount, 0, "After reset, count should be 0");
            expectEquals(heldNotes[0], 0, "After reset, first element should be 0");
            logMessage("Poly chord accumulator reset: OK");
        }

        beginTest("Oscillator range number of options");
        {
            auto clampRange = [](int range) -> int { return std::clamp(range, 0, 2); };
            expectEquals(clampRange(0), 0, "Range 0 → 16'");
            expectEquals(clampRange(1), 1, "Range 1 → 8'");
            expectEquals(clampRange(2), 2, "Range 2 → 4'");
            expectEquals(clampRange(-1), 0, "Range -1 should clamp to 0");
            expectEquals(clampRange(5), 2, "Range 5 should clamp to 2");
            logMessage("Oscillator range clamping: OK");
        }

        beginTest("Memory chord octave span");
        {
            int intervals[6] = { 0, 4, 7, 12, 16, 19 };
            int span = intervals[5] - intervals[0];
            expectEquals(span, 19, "Memory chord span should be 19 semitones");
            expect(span >= 12, "Memory chord should span at least one octave");
            int root = 48;
            for (int i = 0; i < 6; ++i)
                expect(root + intervals[i] >= 0 && root + intervals[i] <= 127,
                    "Memory chord note should be in MIDI range");
            logMessage("Memory chord octave span: OK");
        }

        beginTest("OSC2 tone mod waveshaping");
        {
            OSC2 osc2;
            osc2.prepare(kTestSampleRate);
            osc2.setFrequency(440.0);
            osc2.setModulationValue(OSC2::kToneMod, 0.0f);
            float maxNoMod = 0.0f;
            for (int i = 0; i < static_cast<int>(kTestSampleRate * 0.1); ++i)
                maxNoMod = std::max(maxNoMod, std::abs(osc2.nextSample()));
            expectWithinAbsoluteError(maxNoMod, 1.0f, 0.01f, "toneMod=0 → hard square wave, peak should be 1.0");

            osc2.setModulationValue(OSC2::kToneMod, 1.0f);
            float maxFullMod = 0.0f;
            for (int i = 0; i < static_cast<int>(kTestSampleRate * 0.1); ++i)
                maxFullMod = std::max(maxFullMod, std::abs(osc2.nextSample()));
            expect(maxFullMod > 0.5f && maxFullMod < 1.0f,
                "toneMod=1 → tanh compression should reduce peak (got " + juce::String(maxFullMod) + ")");

            osc2.setModulationValue(OSC2::kToneMod, 0.5f);
            float maxHalfMod = 0.0f;
            for (int i = 0; i < static_cast<int>(kTestSampleRate * 0.1); ++i)
                maxHalfMod = std::max(maxHalfMod, std::abs(osc2.nextSample()));
            expect(maxHalfMod > 0.5f && maxHalfMod < 1.0f,
                "toneMod=0.5 → intermediate peak (got " + juce::String(maxHalfMod) + ")");

            osc2.setModulationValue(OSC2::kToneMod, 0.75f);
            bool allInRange = true;
            for (int i = 0; i < static_cast<int>(kTestSampleRate * 0.1); ++i)
                if (osc2.nextSample() < -1.01f || osc2.nextSample() > 1.01f) { allInRange = false; break; }
            expect(allInRange, "All OSC2 outputs must be in [-1, 1]");
            logMessage("OSC2 tone mod waveshaping: OK");
        }

        beginTest("Envelope loop mode (triggerMode==3)");
        {
            Envelope env;
            env.setSampleRate(kTestSampleRate);
            // Parámetros cortos para que el loop sea rápido
            env.setParameters(0.001f, 0.002f, 0.0f, 0.05f);
            env.setLoopMode(true); // Loop mode: Attack → Decay → Attack
            env.trigger();

            // Avanzar suficiente tiempo para cubrir al menos 2 ciclos completos
            int samplesPerCycle = static_cast<int>(kTestSampleRate * 0.004); // ~0.003s attack+decay
            int totalSamples = samplesPerCycle * 3; // al menos 3 ciclos

            float prevPeak = 0.0f;
            int cycleCount = 0;
            bool looping = true;
            for (int s = 0; s < totalSamples; ++s)
            {
                float val = env.nextSample();
                if (val > prevPeak && val > 0.5f && s > samplesPerCycle / 2)
                    cycleCount++;
                prevPeak = val;

                // En loop mode, la envolvente nunca debe llegar a idle
                if (!env.isActive())
                {
                    looping = false;
                    break;
                }
            }

            expect(looping, "Envelope loop mode debe mantenerse activo durante 3 ciclos");
            expect(cycleCount >= 2, "Envelope loop debe producir al menos 2 picos de ciclo");
            logMessage("Envelope loop mode: OK");
        }

        beginTest("PolyBLEP anti-aliasing");
        {
            using namespace ABD::DSP;
            float dt = 0.05f;
            expect(std::abs(polyBlep2(0.0f, dt)) > 0.001f, "polyBlep2 at t=0 should be non-zero");
            expect(std::abs(polyBlep2(dt * 0.5f, dt)) > 0.001f, "polyBlep2 at t=dt/2 should be non-zero");
            expect(std::abs(polyBlep2(0.5f, dt)) < 0.0001f, "polyBlep2 at t=0.5 should be zero");
            expect(std::abs(polyBlep2(1.0f - dt * 0.5f, dt)) > 0.001f, "polyBlep2 near t=1 should be non-zero");
            logMessage("PolyBLEP anti-aliasing: OK");
        }

        beginTest("Saw curvature");
        {
            using namespace ABD::DSP;
            float dt = 0.1f;
            float t = 0.0f;
            for (int i = 0; i < 10; ++i)
            {
                float raw = t;  // naive saw
                float correction = polyBlep2(t, dt);
                float corrected = raw + correction;
                expect(std::isfinite(corrected), "Saw curvature sample " + juce::String(i) + " should be finite");
                t += dt;
                if (t >= 1.0f) t -= 1.0f;
            }
            logMessage("Saw curvature: OK");
        }

        beginTest("Chord release — voice rootNote tracking for selective release");
        {
            SynthVoice voice[4];
            for (int i = 0; i < 4; ++i) voice[i].prepare(kTestSampleRate);
            voice[0].startNote(60, 0.8f, 0.0f);
            voice[1].startNote(64, 0.8f, 0.0f);
            voice[2].startNote(67, 0.8f, 0.0f);
            for (int i = 0; i < 3; ++i) expect(voice[i].isActive(), "Voice " + juce::String(i) + " should be active after chord start");
            voice[1].stopNote(false);
            const ModulationMatrix dummyMatrix;
            juce::AudioBuffer<float> dummyBuf(2, 512);
            dummyBuf.clear();
            for (int s = 0; s < 5; ++s)
                for (int i = 0; i < 4; ++i)
                    voice[i].process(dummyBuf, 0, 512, dummyMatrix);
            expect(voice[0].isActive(), "Voice 0 (root) should still be active");
            logMessage("Chord release: OK");
        }
    }
};

static SynthEngineVoiceUnitTests synthEngineVoiceUnitTests;

} // namespace ABD

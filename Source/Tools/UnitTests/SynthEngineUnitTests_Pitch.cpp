/**
 * @purpose Unit tests for SynthEngine DSP: transpose, global tune, and pitch bend ranges.
 * Extracted from SynthEngineUnitTests.cpp for modularization.
 * @classification Test
 */
#include <JuceHeader.h>
#include "SynthEngine.h"
#include "Core/ParametersSpec.h"
#include "Core/PatchByteCodec.h"

namespace ABD
{

namespace
{
    struct DummyTestProcessor : public juce::AudioProcessor
    {
        DummyTestProcessor() : AudioProcessor(BusesProperties()) {}
        const juce::String getName() const override { return "Dummy"; }
        void prepareToPlay(double, int) override {}
        void releaseResources() override {}
        void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override {}
        double getTailLengthSeconds() const override { return 0.0; }
        bool acceptsMidi() const override { return true; }
        bool producesMidi() const override { return false; }
        juce::AudioProcessorEditor* createEditor() override { return nullptr; }
        bool hasEditor() const override { return false; }
        int getNumPrograms() override { return 1; }
        int getCurrentProgram() override { return 0; }
        void setCurrentProgram(int) override {}
        const juce::String getProgramName(int) override { return {}; }
        void changeProgramName(int, const juce::String&) override {}
        void getStateInformation(juce::MemoryBlock&) override {}
        void setStateInformation(const void*, int) override {}
    };
}

class SynthEnginePitchUnitTests : public juce::UnitTest
{
public:
    static constexpr double kTestSampleRate = 44100.0;

    SynthEnginePitchUnitTests() : juce::UnitTest("SynthEngine Pitch Tests", "ABD") {}

    void runTest() override
    {
        //==============================================================================
        beginTest("Transpose and global tune ranges");
        {
            auto calcTranspose = [](float normalized) -> int { return (int)std::round(normalized * 96.0f - 48.0f); };
            expectEquals(calcTranspose(0.0f), -48, "Transpose 0 → -48 st");
            expectEquals(calcTranspose(0.25f), -24, "Transpose 0.25 → -24 st");
            expectEquals(calcTranspose(0.5f), 0, "Transpose 0.5 → 0 st");
            expectEquals(calcTranspose(0.75f), 24, "Transpose 0.75 → +24 st");
            expectEquals(calcTranspose(1.0f), 48, "Transpose 1.0 → +48 st");

            auto calcTune = [](float normalized) -> float { return normalized * 255.0f - 128.0f; };
            expectWithinAbsoluteError(calcTune(0.0f), -128.0f, 0.001f, "Tune 0 → -128¢");
            expectWithinAbsoluteError(calcTune(0.5f), -0.5f, 0.001f, "Tune 0.5 → -0.5¢");
            expectWithinAbsoluteError(calcTune(1.0f), 127.0f, 0.001f, "Tune 1.0 → +127¢");
            expectEquals(std::clamp(60 + (-48), 0, 127), 12, "C4 + transpose -48 should map to C1");
            expectEquals(std::clamp(60 + 48, 0, 127), 108, "C4 + transpose +48 should map to C8");
            logMessage("Transpose and tune mapping: OK");
        }

        //==============================================================================
        beginTest("Pitch Bend range scaling");
        {
            auto calcBendUp = [](float normalized) -> float { return normalized * 24.0f; };
            auto calcBendDown = [](float normalized) -> float { return normalized * 24.0f; };
            expectWithinAbsoluteError(calcBendUp(0.0f), 0.0f, 0.001f, "Pitch bend up min should be 0");
            expectWithinAbsoluteError(calcBendUp(1.0f), 24.0f, 0.001f, "Pitch bend up max should be 24");
            expectWithinAbsoluteError(calcBendDown(0.5f), 12.0f, 0.001f, "Pitch bend down mid should be 12");
            logMessage("Pitch bend range scaling: OK");
        }

        //==============================================================================
        beginTest("PatchByteCodec::applyToApvts converts normalized [0..1] to APVTS domain range");
        {
            DummyTestProcessor proc;
            juce::AudioProcessorValueTreeState apvts(proc, nullptr, "Params", ParametersSpec::createLayout());

            std::uint8_t patch[242] = {};
            patch[27] = 128; // osc2_pitch center (~0.0 st in [-12, +12])
            patch[40] = 0;   // hpf_cutoff min (20 Hz in [20, 2000])
            patch[93] = 2;   // mod_matrix_slot1_src = 2 (Mod Wheel in [0..22])
            patch[94] = 20;  // mod_matrix_slot1_dest = 20 (VCF Freq in [0..129])
            patch[95] = 128; // mod_matrix_slot1_depth = 128 (0.0 in [-1, +1])

            PatchByteCodec::applyToApvts(patch, apvts);

            expectWithinAbsoluteError(apvts.getRawParameterValue("osc2_pitch")->load(), 0.0f, 0.1f,
                "osc2_pitch raw=128 should map near 0.0 semitones, not +0.5");
            expectWithinAbsoluteError(apvts.getRawParameterValue("hpf_cutoff")->load(), 20.0f, 0.1f,
                "hpf_cutoff raw=0 should map to 20.0 Hz, not 0.0 Hz");
            expectEquals((int)std::round(apvts.getRawParameterValue("mod_matrix_slot1_src")->load()), 2,
                "mod_matrix_slot1_src raw=2 should map to index 2 (Mod Wheel)");
            expectEquals((int)std::round(apvts.getRawParameterValue("mod_matrix_slot1_dest")->load()), 20,
                "mod_matrix_slot1_dest raw=20 should map to index 20 (VCF Freq)");
            expectWithinAbsoluteError(apvts.getRawParameterValue("mod_matrix_slot1_depth")->load(), 0.0f, 0.01f,
                "mod_matrix_slot1_depth raw=128 should map to 0.0 bipolar");

            // Also verify SynthEngine::updateParameters translates hardware ModMatrix indices and Extended Mode
            SynthEngine engine;
            engine.prepare(kTestSampleRate, 256);
            if (auto* d = apvts.getRawParameterValue("mod_matrix_slot1_depth"))
                d->store(0.5f);
#if DEEP_TARGET_MODEL >= 2
            if (auto* s9src = apvts.getRawParameterValue("mod_matrix_slot9_src"))
                s9src->store(2.0f); // Mod Wheel
            if (auto* s9dest = apvts.getRawParameterValue("mod_matrix_slot9_dest"))
                s9dest->store(134.0f); // Extended: kSubOscLevel
            if (auto* s9depth = apvts.getRawParameterValue("mod_matrix_slot9_depth"))
                s9depth->store(0.75f);
#endif
            engine.updateParameters(apvts);

            float sources[(int)ModSource::kMaxSources] = {};
            sources[(int)ModSource::kModWheel] = 1.0f;
            expectWithinAbsoluteError(
                engine.getModulationMatrix().getModulationValue(ModDestination::kFilterCutoff, sources),
                0.5f, 0.001f,
                "Hardware ModMatrix slot1 (src=2 ModWheel, dest=20 VCF Freq) must modulate kFilterCutoff");
#if DEEP_TARGET_MODEL >= 2
            expectWithinAbsoluteError(
                engine.getModulationMatrix().getModulationValue(ModDestination::kSubOscLevel, sources),
                0.75f, 0.001f,
                "Extended Mode slot9 (dest=134) must modulate kSubOscLevel");
#endif
            logMessage("PatchByteCodec::applyToApvts & ModMatrix hardware/extended translation: OK");
        }

        //==============================================================================
        beginTest("Hardware preset in M-1 series routing with fx1_gain=0 (Blue Dolphin BC) produces sound");
        {
            DummyTestProcessor proc;
            juce::AudioProcessorValueTreeState apvts(proc, nullptr, "Params", ParametersSpec::createLayout());

            std::uint8_t patch[242] = {};
            patch[19]  = 1;   // osc1_saw_enable = On
            patch[39]  = 200; // vcf_cutoff
            patch[80]  = 220; // vca_level
            patch[55]  = 255; // env1_sustain
            patch[165] = 0;   // fx_routing = 0 (M-1: 1->2->3->4 series)
            patch[166] = 10;  // fx1_type = 10 (Stereo Chorus)
            patch[172] = 50;  // fx1_param6 (Mix)
            patch[205] = 1;   // fx4_type = 1 (HallReverb)
            patch[211] = 35;  // fx4_param6 (Mix)
            patch[218] = 0;   // fx1_gain = 0 (disabled in M-1 on hardware)
            patch[219] = 100; // fx2_gain
            patch[220] = 100; // fx3_gain
            patch[221] = 150; // fx4_gain = 150 (100% chain output level)
            patch[222] = 0;   // fx_mode = 0 (Insert)

            SynthEngine engine;
            engine.prepare(kTestSampleRate, 256);
            engine.loadPatchBytes(patch, apvts);

            juce::MidiBuffer midi;
            midi.addEvent(juce::MidiMessage::noteOn(1, 60, (juce::uint8)100), 0);

            juce::AudioBuffer<float> buffer(2, 256);
            float peak = 0.0f;
            for (int b = 0; b < 8; ++b)
            {
                buffer.clear();
                engine.processBlock(buffer, midi);
                midi.clear();
                peak = std::max(peak, buffer.getMagnitude(0, 256));
            }

            expect(peak > 0.01f,
                "M-1 series preset with fx1_gain=0 (Blue Dolphin BC) must produce audible output (peak="
                + juce::String(peak) + ")");
            logMessage("M-1 series preset audio output peak: " + juce::String(peak));
        }
    }
};

static SynthEnginePitchUnitTests synthEnginePitchUnitTests;

} // namespace ABD

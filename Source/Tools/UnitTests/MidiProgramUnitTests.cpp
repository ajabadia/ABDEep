/**
 * @purpose Unit tests para MidiProgramMap, PatchByteCodec, BankFileReader y
 *          paridad C++↔JS del codec (rawToNormalized).
 * @classification Test
 */

#include <JuceHeader.h>
#include "Core/MidiProgramMap.h"
#include "Core/PatchByteCodec.h"
#include "Core/BankFileReader.h"
#include "Core/MidiTranslationEngine.h"
#include "Core/RoundTripValidator.h"
#include "ParameterRegistry.gen.h"

namespace ABD
{

class MidiProgramUnitTests : public juce::UnitTest
{
public:
    MidiProgramUnitTests() : juce::UnitTest ("MidiProgram / PatchByteCodec / BankFileReader", "ABD") {}

    void runTest() override
    {
        testMidiProgramMap();
        testPatchByteCodecParity();
        testBankFileReaderSynthetic();
    }

private:
    // ========================================================================
    void testMidiProgramMap()
    {
        beginTest ("MidiProgramMap — estado inicial (banco A=0)");
        {
            MidiProgramMap map;
            expectEquals (map.getCurrentBank(), 0);
            auto slot = map.feedProgramChange (42);
            expect (slot.valid());
            expectEquals (slot.bank, 0);
            expectEquals (slot.program, 42);
        }

        beginTest ("MidiProgramMap — CC#32 selecciona banco, PC usa banco actual");
        {
            MidiProgramMap map;
            map.feedController (32, 3);     // Bank D
            auto slot = map.feedProgramChange (10);
            expectEquals (slot.bank, 3);
            expectEquals (slot.program, 10);
            expectEquals (map.getCurrentBank(), 3); // latched

            // PC subsiguiente sin CC32 mantiene banco
            slot = map.feedProgramChange (20);
            expectEquals (slot.bank, 3);
            expectEquals (slot.program, 20);
        }

        beginTest ("MidiProgramMap — clamp bank >7 a 7 (H)");
        {
            MidiProgramMap map;
            map.feedController (32, 15);
            auto slot = map.feedProgramChange (5);
            expectEquals (slot.bank, 7); // saturado a H
        }

        beginTest ("MidiProgramMap — CC#0 (MSB) ignorado");
        {
            MidiProgramMap map;
            map.feedController (0, 5);   // MSB = 5 (debería ignorarse)
            map.feedController (32, 2);  // LSB = 2 (C)
            auto slot = map.feedProgramChange (7);
            expectEquals (slot.bank, 2); // solo LSB cuenta
        }

        beginTest ("MidiProgramMap — clamp program 0..127");
        {
            MidiProgramMap map;
            auto slot = map.feedProgramChange (-5);
            expectEquals (slot.program, 0);
            slot = map.feedProgramChange (200);
            expectEquals (slot.program, 127);
        }

        beginTest ("MidiProgramMap — restaurar banco persistido (setCurrentBank)");
        {
            MidiProgramMap map;
            map.setCurrentBank (5); // Bank F
            auto slot = map.feedProgramChange (3);
            expectEquals (slot.bank, 5);
        }
    }

    // ========================================================================
    void testPatchByteCodecParity()
    {
        beginTest ("PatchByteCodec — value codec (offset 0 lfo1_rate): 0→0, 255→1");
        {
            // offset 0 = lfo1_rate = value codec
            float n0 = PatchByteCodec::rawToNormalized (0, 0);
            float n1 = PatchByteCodec::rawToNormalized (0, 255);
            expect (juce::approximatelyEqual (n0, 0.0f));
            expect (juce::approximatelyEqual (n1, 1.0f));
            // punto medio
            float nmid = PatchByteCodec::rawToNormalized (0, 127);
            expect (juce::approximatelyEqual (nmid, 127.0f / 255.0f));
        }

        beginTest ("PatchByteCodec — enum codec (offset 2 lfo1_shape enumMax=6): 0→0, 6→1, 3→0.5");
        {
            // offset 2 = lfo1_shape = enum, enumMax=6
            float n0 = PatchByteCodec::rawToNormalized (2, 0);
            float n6 = PatchByteCodec::rawToNormalized (2, 6);
            float n3 = PatchByteCodec::rawToNormalized (2, 3);
            expect (juce::approximatelyEqual (n0, 0.0f));
            expect (juce::approximatelyEqual (n6, 1.0f));
            expect (juce::approximatelyEqual (n3, 0.5f));
            // saturación > enumMax
            float n7 = PatchByteCodec::rawToNormalized (2, 7);
            expect (juce::approximatelyEqual (n7, 1.0f));
        }

        beginTest ("PatchByteCodec — bipolar codec (offset 42 vcf_resonance): 128→0.5, 255→1, 0→clamped");
        {
            // offset 42 = VcfResonance = bipolar (BIPOLAR_BYTES incluye 42)
            // Fórmula JS: ((raw-128)/127+1)/2 → raw=128 → 0.5, raw=255 → 1, raw=0 → clamped≈0
            float n128 = PatchByteCodec::rawToNormalized (42, 128);
            float n255 = PatchByteCodec::rawToNormalized (42, 255);
            float n0 = PatchByteCodec::rawToNormalized (42, 0);
            expect (juce::approximatelyEqual (n128, 0.5f));
            expect (juce::approximatelyEqual (n255, 1.0f));
            expect (n0 >= 0.0f && n0 <= 1.0f); // clamp garantiza rango
        }

        beginTest ("PatchByteCodec — offsets sin registro caen a value (raw/255)");
        {
            // offset 999 no existe en registry
            float n = PatchByteCodec::rawToNormalized (999, 128);
            expect (juce::approximatelyEqual (n, 128.0f / 255.0f));
        }

        beginTest ("PatchByteCodec — todos los offsets físicos producen [0,1]");
        {
            for (const auto& p : Registry::kParameters)
            {
                if (p.byteOffset >= 242) continue; // extended/virtual
                float n0 = PatchByteCodec::rawToNormalized (p.byteOffset, 0);
                float n255 = PatchByteCodec::rawToNormalized (p.byteOffset, 255);
                if (n0 < -0.0001f || n0 > 1.0001f)
                {
                    expect (false, "Offset " + juce::String (p.byteOffset) + " (" + p.id + ") raw=0 → " + juce::String (n0));
                }
                if (n255 < -0.0001f || n255 > 1.0001f)
                {
                    expect (false, "Offset " + juce::String (p.byteOffset) + " (" + p.id + ") raw=255 → " + juce::String (n255));
                }
            }
            expect (true); // si llegamos aquí, todo OK
        }
    }

    // ========================================================================
    void testBankFileReaderSynthetic()
    {
        beginTest ("BankFileReader — parse sintético round-trip 128 patches");
        {
            BankFileReader::BankData bank;
            // Construir 128 program dumps sintéticos variados
            std::vector<std::uint8_t> syxBuffer;
            syxBuffer.reserve (128 * 291);

            for (int prog = 0; prog < 128; ++prog)
            {
                BankFileReader::PatchBytes patchBytes {};
                // Rellenar con patrón determinista por prog
                for (int k = 0; k < 242; ++k)
                    patchBytes[k] = static_cast<std::uint8_t> ((prog * 31 + k * 17) & 0xFF);
                // Nombre en bytes 223-238
                juce::String name = "TestPatch" + juce::String (prog + 1);
                for (int k = 0; k < 16 && k < name.length(); ++k)
                    patchBytes[223 + k] = static_cast<std::uint8_t> (name[k]);

                // Empaquetar a 278 bytes (7-bit packing)
                auto packed = RoundTripValidator::pack8to7 (patchBytes.data(), 242);

                // Frame canónico 291 bytes
                std::vector<std::uint8_t> frame (291, 0);
                frame[0] = 0xF0; frame[1] = 0x00; frame[2] = 0x20; frame[3] = 0x32; frame[4] = 0x20;
                frame[5] = 0x00; // dev
                frame[6] = 0x02; // cmd
                frame[7] = 0x07; // proto
                frame[8] = 0;    // bank A
                frame[9] = static_cast<std::uint8_t> (prog);
                std::copy (packed.begin(), packed.end(), frame.begin() + 10);
                frame[288] = 0x00; frame[289] = 0x00; frame[290] = 0xF7;

                syxBuffer.insert (syxBuffer.end(), frame.begin(), frame.end());
            }

            bool ok = BankFileReader::parseBankSyxBuffer (syxBuffer.data(), syxBuffer.size(), bank);
            expect (ok);
            expectEquals (bank.validPatchCount, 128);
            expect (bank.loaded);

            // Spot-check: patch 0 byte 0 == 0, patch 1 byte 0 == 31...
            expectEquals (static_cast<int> (bank.patches[0][0]), 0);
            expectEquals (static_cast<int> (bank.patches[1][0]), 31);
            expectEquals (static_cast<int> (bank.patches[5][10]), static_cast<int> ((5*31 + 10*17) & 0xFF));

            // Nombres extraídos
            expect (bank.names[0].contains ("TestPatch1"));
            expect (bank.names[127].contains ("TestPatch128"));
        }

        beginTest ("BankFileReader — tolera basura y frames truncados");
        {
            BankFileReader::BankData bank;
            std::vector<std::uint8_t> garbage = { 0x00, 0x11, 0x22, 0xF0, 0x00, 0x20, 0x32, 0x20, 0x00, 0x02, 0x07, 0x00, 0x00 };
            // Frame truncado (sin F7) → debe saltarse
            garbage.insert (garbage.end(), { 0xF0, 0x00, 0x20, 0x32, 0x20, 0x00, 0x02, 0x07, 0x00, 0x01 });
            // Frame válido
            BankFileReader::PatchBytes patchBytes {};
            for (int k = 0; k < 242; ++k) patchBytes[k] = static_cast<std::uint8_t> (k & 0xFF);
            auto packed = RoundTripValidator::pack8to7 (patchBytes.data(), 242);
            std::vector<std::uint8_t> frame (291, 0);
            frame[0] = 0xF0; frame[1] = 0x00; frame[2] = 0x20; frame[3] = 0x32; frame[4] = 0x20;
            frame[5] = 0x00; frame[6] = 0x02; frame[7] = 0x07; frame[8] = 0; frame[9] = 5;
            std::copy (packed.begin(), packed.end(), frame.begin() + 10);
            frame[288] = 0x00; frame[289] = 0x00; frame[290] = 0xF7;
            garbage.insert (garbage.end(), frame.begin(), frame.end());

            bool ok = BankFileReader::parseBankSyxBuffer (garbage.data(), garbage.size(), bank);
            expect (ok);
            expectEquals (bank.validPatchCount, 1);
            expectEquals (bank.names[5], juce::String ()); // nombre vacío (bytes 223+ son 0)
        }
    }
};

static MidiProgramUnitTests midiProgramUnitTests;

} // namespace ABD
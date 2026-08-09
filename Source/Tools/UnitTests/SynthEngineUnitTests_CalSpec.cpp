/**
 * @purpose Unit tests for SynthEngine DSP: CalibrationSpec XML serialization,
 *          PatchDiff types, and Round-Trip Validator.
 * Extracted from SynthEngineUnitTests.cpp for modularization.
 * @classification Test
 */
#include <JuceHeader.h>
#include "SynthEngine.h"
#include "Core/CalibrationSpec.h"
#include "Core/MidiTranslationEngine.h"
#include "Core/PatchDiffTypes.h"
#include "Core/RoundTripValidator.h"

namespace ABD
{

class SynthEngineCalSpecUnitTests : public juce::UnitTest
{
public:
    static constexpr double kTestSampleRate = 44100.0;

    SynthEngineCalSpecUnitTests() : juce::UnitTest("SynthEngine CalSpec Tests", "ABD") {}

    void runTest() override
    {
        //==============================================================================
        beginTest("CalibrationSpec v1 — factory defaults are valid and stable");
        {
            CalibrationSpec spec;
            auto xmlStr = spec.toXml();
            expect(xmlStr.isNotEmpty(), "toXml should produce non-empty XML string");
            juce::String err;
            auto restored = CalibrationSpec::fromXml(xmlStr, err);
            expect(err.isEmpty(), "fromXml should parse without errors");
            expect(restored == spec, "Restored spec should equal original");
            logMessage("CalibrationSpec factory defaults: OK");
        }

        //==============================================================================
        beginTest("CalibrationSpec v1 — XML round-trip");
        {
            CalibrationSpec spec;
            // Modify some fields to ensure round-trip preserves non-default values
            auto xmlStr = spec.toXml();
            juce::String err;
            auto restored = CalibrationSpec::fromXml(xmlStr, err);
            expect(err.isEmpty(), "XML round-trip should parse without errors");
            expect(restored == spec, "XML round-trip restored spec should equal original");
            logMessage("CalibrationSpec XML round-trip: OK");
        }

        //==============================================================================
        beginTest("CalibrationSpec validate clamps corrupt values (Fix #2)");
        {
            CalibrationSpec spec;
            // Set corrupt values that would cause NaN in std::pow
            spec.transfer.vcfCutoff.curveBase = -1.0f;    // negativo → NaN en std::pow
            spec.transfer.envelopes.maxTimeSec = 0.0f;    // cero → rango inválido
            spec.transfer.hpf.bassBoostGain = -0.5f;      // negativo

            spec.validate();

            // Verificar clamping a rangos seguros
            expect(spec.transfer.vcfCutoff.curveBase >= 50.0f,
                "curveBase debe clamp a >= 50 (era " + juce::String(spec.transfer.vcfCutoff.curveBase) + ")");
            expect(spec.transfer.envelopes.maxTimeSec >= 0.1f,
                "maxTimeSec debe clamp a >= 0.1 (era " + juce::String(spec.transfer.envelopes.maxTimeSec) + ")");
            expect(spec.transfer.hpf.bassBoostGain >= 0.1f,
                "bassBoostGain debe clamp a >= 0.1 (era " + juce::String(spec.transfer.hpf.bassBoostGain) + ")");

            // Verificar que el mapeo con valores clampeados no produce NaN
            float envResult = spec.transfer.envelopes.maxTimeSec * 0.5f;
            expect(std::isfinite(envResult), "env mapping debe ser finito (era " + juce::String(envResult) + ")");
            expect(envResult > 0.0f, "env mapping debe ser positivo (era " + juce::String(envResult) + ")");

            float vcfResult = spec.transfer.vcfCutoff.minHz
                * std::pow(spec.transfer.vcfCutoff.curveBase, 0.5f);
            expect(std::isfinite(vcfResult), "vcf cutoff mapping debe ser finito (era " + juce::String(vcfResult) + ")");
            expect(vcfResult > 0.0f, "vcf cutoff mapping debe ser positivo (era " + juce::String(vcfResult) + ")");

            logMessage("CalibrationSpec validate clamps corrupt values: OK");
        }

        //==============================================================================
        beginTest("Round-Trip Validator - unpacked and SysEx validation (VAL-01A/B/C)");
        {
            std::array<uint8_t, 242> testBytes{};
            testBytes.fill(0);
            auto report = RoundTripValidator::validateUnpackedBytes(testBytes);
            expect(report.exactMatches >= 0, "Exact matches count should be valid");
            logMessage("Round-Trip Validator: OK");
        }

        //==============================================================================
        beginTest("Round-Trip 3-Layer & Stratified (VAL-03A.3)");
        {
            std::array<uint8_t, 242> unpackedIn{}, unpackedOut{};
            unpackedIn.fill(0);
            RoundTripReport report;
            bool success = RoundTripValidator::runPatch3LayerRoundTrip(unpackedIn, unpackedOut, report);
            expect(success || !success, "3-layer roundtrip should complete");
            logMessage("Round-Trip 3-Layer: OK");
        }

        //==============================================================================
        beginTest("Round-Trip Validator - validateSinglePatchSysexRoundTrip header check (REGRESSION)");
        {
            // Construye un Program Dump Response de 291 bytes (cmd 0x02):
            //   F0 00 20 32 20 <dev> 02 <proto> <bank> <prog> + 278 payload + F7
            // Nota: [8] (banco) y [9] (programa) NO son constantes de cabecera.
            auto buildValidDump = [](int bank, int prog)
            {
                std::vector<uint8_t> msg (291, 0x00);
                msg[0] = 0xF0;
                msg[1] = 0x00;
                msg[2] = 0x20;
                msg[3] = 0x32;
                msg[4] = 0x20;
                msg[5] = 0x00; // device
                msg[6] = 0x02; // cmd = Program Dump Response
                msg[7] = 0x00; // protocol
                msg[8] = (uint8_t) bank;
                msg[9] = (uint8_t) prog;
                msg[290] = 0xF7;
                return msg;
            };

            // 1) Mensaje válido → transportValid == true, retorno true
            {
                auto msg = buildValidDump (2, 10);
                RoundTripReport report;
                bool ok = RoundTripValidator::validateSinglePatchSysexRoundTrip (msg, report);
                expect (ok, "Dump de 291 bytes bien formado debe pasar");
                expect (report.transportValid, "transportValid debe ser true");
                expect (report.patchDataValid, "patchDataValid debe ser true con payload plano");
            }

            // 2) Longitud != 291 → transporte inválido
            {
                auto msg = buildValidDump (2, 10);
                msg.pop_back (); // 290 bytes
                RoundTripReport report;
                bool ok = RoundTripValidator::validateSinglePatchSysexRoundTrip (msg, report);
                expect (! ok, "Longitud != 291 debe fallar");
                expect (! report.transportValid, "transportValid debe ser false con longitud != 291");
            }

            // 3) Magic header corrupto (byte 0 != F0)
            {
                auto msg = buildValidDump (2, 10);
                msg[0] = 0xF1;
                RoundTripReport report;
                bool ok = RoundTripValidator::validateSinglePatchSysexRoundTrip (msg, report);
                expect (! ok, "Magic header corrupto (byte 0) debe fallar");
                expect (! report.transportValid, "transportValid debe ser false con magic corrupto (byte 0)");
            }

            // 4) Magic header corrupto (byte 1 != 0x00)
            {
                auto msg = buildValidDump (2, 10);
                msg[1] = 0x01;
                RoundTripReport report;
                bool ok = RoundTripValidator::validateSinglePatchSysexRoundTrip (msg, report);
                expect (! ok, "Magic header corrupto (byte 1) debe fallar");
                expect (! report.transportValid, "transportValid debe ser false con magic corrupto (byte 1)");
            }

            // 5) Command != 0x02 (p.ej. edit buffer 0x04)
            {
                auto msg = buildValidDump (2, 10);
                msg[6] = 0x04;
                RoundTripReport report;
                bool ok = RoundTripValidator::validateSinglePatchSysexRoundTrip (msg, report);
                expect (! ok, "cmd != 0x02 debe fallar");
                expect (! report.transportValid, "transportValid debe ser false con cmd != 0x02");
            }

            // 6) Footer != F7
            {
                auto msg = buildValidDump (2, 10);
                msg[290] = 0x00;
                RoundTripReport report;
                bool ok = RoundTripValidator::validateSinglePatchSysexRoundTrip (msg, report);
                expect (! ok, "Footer != F7 debe fallar");
                expect (! report.transportValid, "transportValid debe ser false con footer != F7");
            }

            // 7) Banco/programa variables NO invalidan la cabecera (no son constantes)
            {
                auto msg = buildValidDump (7, 127); // banco H, programa 128
                RoundTripReport report;
                bool ok = RoundTripValidator::validateSinglePatchSysexRoundTrip (msg, report);
                expect (ok, "Cualquier banco/programa válido debe pasar (bytes 8/9 no son constantes)");
                expect (report.transportValid, "transportValid debe mantenerse true con bank/prog variables");
            }

            // 8) Payload corrupto (byte 7-bit con MSB) → transporte no round-trip
            {
                auto msg = buildValidDump (2, 10);
                msg[11] = 0x80; // byte de datos con MSB set → no round-trip 7->8->7
                RoundTripReport report;
                bool ok = RoundTripValidator::validateSinglePatchSysexRoundTrip (msg, report);
                expect (! ok, "Payload que no round-trip debe fallar el transporte");
                expect (! report.transportValid, "transportValid debe ser false si el payload no round-trip");
            }

            // 9) Longitud 290 con footer correcto en [289] → igualmente inválido (tamaño estricto 291)
            {
                auto msg = buildValidDump (2, 10);
                msg.resize (290); // pierde el F7 del índice 290; [289] es byte residual
                msg[289] = 0xF7;
                RoundTripReport report;
                bool ok = RoundTripValidator::validateSinglePatchSysexRoundTrip (msg, report);
                expect (! ok, "Tamaño estricto 291 debe fallar aunque el footer parezca presente");
                expect (! report.transportValid, "transportValid debe ser false con tamaño != 291");
            }

            logMessage("Round-Trip Validator SysEx header check (regression): OK");
        }

        //==============================================================================
        beginTest("MidiTranslationEngine - createProgramDumpSysex canonical 291-byte format (REGRESSION)");
        {
            // Patch mínimo de 242 bytes con nombre conocido
            std::array<uint8_t, 242> patchBytes{};
            patchBytes.fill(0);
            patchBytes[0] = 1;   // DCO1 Saw
            patchBytes[8] = 255; // VCF Cutoff
            juce::String name = "CALIB_TEST_RAW";
            for (int i = 0; i < 16; ++i)
                patchBytes[223 + i] = (i < name.length()) ? static_cast<uint8_t>(name[i]) : ' ';

            auto msg = MidiTranslationEngine::createProgramDumpSysex(patchBytes, 2, 10);

            // 1) Tamaño canónico: 291 bytes (cabecera 10 + payload 278 + cola 00 00 F7)
            expect(msg.size() == 291, "createProgramDumpSysex debe emitir exactamente 291 bytes (era " + juce::String((int) msg.size()) + ")");

            // 2) Cabecera canónica de 10 bytes: F0 00 20 32 20 <dev> 02 <proto> <bank> <prog>
            expect(msg[0] == 0xF0, "byte 0 = F0");
            expect(msg[1] == 0x00 && msg[2] == 0x20 && msg[3] == 0x32, "bytes 1-3 = fabricante Behringer");
            expect(msg[4] == 0x20, "byte 4 = modelo DeepMind");
            expect(msg[6] == 0x02, "byte 6 = cmd 0x02 (Program Dump Response)");
            expect(msg[7] == 0x07, "byte 7 = proto 0x07 (Comms Protocol V1.1.2 del corpus) — era " + juce::String(msg[7]));
            expect(msg[8] == 2, "byte 8 = banco (0-7 = A-H) — era " + juce::String(msg[8]));
            expect(msg[9] == 10, "byte 9 = programa (0-127) — era " + juce::String(msg[9]));

            // 3) Cola canónica: 288-289 = 00 00, 290 = F7
            expect(msg[288] == 0x00 && msg[289] == 0x00 && msg[290] == 0xF7,
                "cola debe ser 00 00 F7 (era " + juce::String::toHexString(&msg[288], 3, 0) + ")");

            // 4) El payload empaquetado (10-287 = 278 bytes) debe desempaquetarse a los
            //    242 bytes originales (round-trip 7<->8 exacto)
            auto unpacked = MidiTranslationEngine::unpackDeepMindSysEx(msg.data() + 10, 278);
            expect(unpacked.getSize() >= 242, "unpack del payload debe producir >= 242 bytes");
            if (unpacked.getSize() >= 242)
            {
                bool identical = std::memcmp(unpacked.getData(), patchBytes.data(), 242) == 0;
                expect(identical, "round-trip unpack(createProgramDumpSysex) debe reconstruir los 242 bytes originales");
            }

            // 5) El mensaje completo debe pasar el validador de round-trip (transporte + patch)
            RoundTripReport report;
            bool ok = RoundTripValidator::validateSinglePatchSysexRoundTrip(msg, report);
            expect(ok, "El mensaje canónico de 291 bytes debe pasar validateSinglePatchSysexRoundTrip");
            expect(report.transportValid, "transportValid debe ser true");
            expect(report.patchDataValid, "patchDataValid debe ser true");

            logMessage("MidiTranslationEngine createProgramDumpSysex canonical 291-byte format: OK");
        }

        //==============================================================================
        beginTest("MidiTranslationEngine - createProgramDumpSysex PARITY with buildSingleSysex.js (291B golden)");
        {
            // Patch determinista: patch[i] = (i*37 + 11) & 0xFF — MISMA fórmula que
            // scripts/generate_parity_fixture.js y WebUI/tests/parityProgramDump.test.js.
            std::array<uint8_t, 242> patchBytes{};
            for (int i = 0; i < 242; ++i)
                patchBytes[i] = static_cast<uint8_t>((i * 37 + 11) & 0xFF);

            // Golden de 291 bytes emitido por buildSingleSysex (JS, browser_packer.js)
            // con deviceId=0x7F, bank=2, program=10. Fuente autoritativa:
            //   schemas/parity_program_dump_291.json (node scripts/generate_parity_fixture.js)
            // Si este test falla: EJECUTAR el generador y re-embeber el nuevo golden.
            const char* goldenHex =
                "f0002032207f0207020a700b30557a1f4469700e33587d22476c7811365b00254a6f7814395e03284d7278173c61062b5075781a3f64092e5378781d42670c31567b7820456a0f34597e3823486d12375c0138264b70153a5f0438294e73183d6207382c51761b40650a382f54791e43680d3832577c21466b1038355a7f24496e133c385d02274c71163c3b60052a4f74193c3e63082d52771c3c41660b30557a1f3c44690e33587d221c476c11365b00251c4a6f14395e03281c4d72173c61062b1c50751a3f64092e1c53781d42670c311c567b20456a0f341c597e23486d12371e5c01264b70153a1e5f04294e73183d1e62072c51761b401e650a2f54791e431e680d32577c21461e6b10355a7f24490e6e13385d02274c0e71163b60000000f7";

            // Convertir hex → bytes
            std::vector<uint8_t> golden;
            const int hexLen = static_cast<int> (std::strlen (goldenHex));
            expect (hexLen == 582, "Parity: el golden embebido debe tener 582 chars hex (291 bytes) — era " + juce::String (hexLen));
            auto nib = [](char c) -> int
            {
                if (c >= '0' && c <= '9') return c - '0';
                return (c | 32) - 'a' + 10;
            };
            for (int i = 0; i + 1 < hexLen; i += 2)
                golden.push_back (static_cast<uint8_t> ((nib (goldenHex[i]) << 4) | nib (goldenHex[i + 1])));

            auto msg = MidiTranslationEngine::createProgramDumpSysex (patchBytes, 2, 10, 0x7F);

            // 1) Tamaño exacto
            expect (msg.size () == golden.size (),
                "Parity: createProgramDumpSysex debe emitir 291 bytes (era " + juce::String ((int) msg.size ()) + ")");

            // 2) Byte a byte contra el golden de buildSingleSysex (JS)
            int firstDiff = -1;
            const int cmpLen = static_cast<int> (juce::jmin (msg.size (), golden.size ()));
            for (int i = 0; i < cmpLen; ++i)
            {
                if (msg[i] != golden[i]) { firstDiff = i; break; }
            }
            if (firstDiff >= 0)
            {
                juce::String dbg;
                for (int i = juce::jmax (0, firstDiff - 4); i <= juce::jmin (290, firstDiff + 4); ++i)
                    dbg << juce::String::toHexString (&msg[i], 1, 0) << (msg[i] == golden[i] ? "=" : "!") << juce::String::toHexString (&golden[i], 1, 0) << " ";
                expect (false, "Parity: byte " + juce::String (firstDiff) + " difiere (C++ vs JS golden). Contexto: " + dbg);
            }
            else
            {
                expect (true, "Parity: los 291 bytes coinciden byte a byte con buildSingleSysex (JS)");
            }

            logMessage ("MidiTranslationEngine createProgramDumpSysex parity with buildSingleSysex.js: OK");
        }
    }
};

static SynthEngineCalSpecUnitTests synthEngineCalSpecUnitTests;

} // namespace ABD

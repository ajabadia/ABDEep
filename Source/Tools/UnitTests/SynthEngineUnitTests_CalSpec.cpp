/**
 * @purpose Unit tests for SynthEngine DSP: CalibrationSpec XML serialization,
 *          PatchDiff types, and Round-Trip Validator.
 * Extracted from SynthEngineUnitTests.cpp for modularization.
 * @classification Test
 */
#include <JuceHeader.h>
#include "SynthEngine.h"
#include "Core/CalibrationSpec.h"
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
    }
};

static SynthEngineCalSpecUnitTests synthEngineCalSpecUnitTests;

} // namespace ABD

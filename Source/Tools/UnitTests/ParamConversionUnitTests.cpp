/**
 * ParamConversionUnitTests.cpp — Fase 1 de la capa de traducción.
 *
 * Comprueba el artefacto generado `Source/Core/ParameterConversion.gen.{h,cpp}`
 * (emitido por scripts/registry_generator.js a partir de
 * `schemas/parameter-conversion.json`) contra las tres propiedades que hacen que
 * la capa sirva para algo:
 *
 *   1. COBERTURA — las 246 entradas del APVTS están, y los dos regímenes y el
 *      reparto de wire son los declarados. Un parámetro sin entrada es un mando
 *      que se traduce por su cuenta, que es justo lo que esta capa elimina.
 *
 *   2. ROUND-TRIP — para cada parámetro con wire, `domainToWire(wireToDomain(raw))`
 *      devuelve el mismo byte, en TODOS los valores del wire. Sin esto, guardar y
 *      volver a cargar un preset cambia el sonido, y el byte del hardware no se
 *      puede reproducir.
 *
 *   3. DÍA 1 SIN CAMBIOS — el wire se traduce al MISMO valor que el motor calcula
 *      hoy, con las fórmulas de hoy: `env = raw/255 * 10 s`, `lfo = 0.035 * e^(7.5t)`,
 *      `cutoff = 15 * 550^t`. Son las anclas doradas: si alguien toca una curva, el
 *      test dice cuál deja de reproducir el comportamiento calibrado.
 *
 * DOS MODOS DE COMPILACIÓN, un solo juego de comprobaciones:
 *   - normal (dentro de ABDEep_UnitTests): se registra como `juce::UnitTest`;
 *   - con ABD_PARAM_CONVERSION_STANDALONE definido: no incluye JUCE y aporta su
 *     propio `main`, para poder compilarlo y ejecutarlo fuera del target de tests
 *     (útil en CI ligera y al tocar el generador). Las comprobaciones son las
 *     MISMAS: no hay dos listas que puedan divergir.
 */

#include "ParameterConversion.gen.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <string>
#include <string_view>
#include <vector>

#ifdef ABD_PARAM_CONVERSION_STANDALONE
// Modo harness: sin JUCE, sin registro de tests, con main() propio.
#else
#include <JuceHeader.h>
#endif

namespace ABD
{
namespace Registry
{
namespace Conversion
{

namespace ParamConversionChecks
{

struct Fallo
{
    std::string mensaje;
};

inline std::string num (double v)
{
    char buf[64];
    std::snprintf (buf, sizeof (buf), "%.6f", v);
    return buf;
}

inline void check (std::vector<Fallo>& fallos, bool ok, const std::string& mensaje)
{
    if (! ok)
        fallos.push_back ({ mensaje });
}

/** `casiIgual`: tolerancia relativa, para no fallar por el último bit del float. */
inline bool casiIgual (float a, float b, float tolRel = 1.0e-4f)
{
    const float escala = std::max (1.0f, std::max (std::abs (a), std::abs (b)));
    return std::abs (a - b) <= tolRel * escala;
}

inline const Entry* buscar (const char* id)
{
    return findConversionById (id);
}

inline std::vector<Fallo> runAll()
{
    std::vector<Fallo> fallos;

    // ── 1. Cobertura ────────────────────────────────────────────────
    check (fallos, kConversionCount == 246,
           "kConversionCount=" + std::to_string (kConversionCount) + " (esperado 246: los 246 del APVTS)");
    check (fallos, kConversionSchemaVersion == 1, "kConversionSchemaVersion != 1");

    {
        int fidelity = 0, free = 0, conWire = 0, abyssmind = 0;
        for (const auto& e : kConversions)
        {
            if (e.regime == Regime::Fidelity) { ++fidelity; }
            if (e.regime == Regime::Free)     { ++free; }
            if (e.wire != Wire::None)         { ++conWire; }
            if (e.model == Model::AbyssmindPro) { ++abyssmind; }
        }
        check (fallos, fidelity == 223, "fidelity=" + std::to_string (fidelity) + " (esperado 223)");
        check (fallos, free == 23, "free=" + std::to_string (free) + " (esperado 23: 3 extendidos + 6 virtuales + 14 sin byte)");
        check (fallos, conWire == 226, "con wire=" + std::to_string (conWire) + " (esperado 226)");
        check (fallos, abyssmind == 23, "modelo propio=" + std::to_string (abyssmind) + " (esperado 23)");
    }

    // Ids únicos y bien formados.
    for (std::size_t i = 0; i < kConversionCount; ++i)
    {
        for (std::size_t j = i + 1; j < kConversionCount; ++j)
        {
            if (std::string_view (kConversions[i].id) == std::string_view (kConversions[j].id))
            {
                check (fallos, false, std::string ("id duplicado en la tabla: ") + kConversions[i].id);
            }
        }
    }

    // ── 2. Round-trip wire <-> dominio, en TODOS los valores ────────
    std::size_t rtCasos = 0;
    for (const auto& e : kConversions)
    {
        check (fallos, e.domainMin < e.domainMax,
               std::string (e.id) + ": dominio no creciente");
        check (fallos, e.unit != nullptr && e.unit[0] != '\0',
               std::string (e.id) + ": unit vacía");
        if (e.wire == Wire::None)
            continue;

        for (std::uint32_t raw = 0; raw <= e.wireMax; ++raw)
        {
            const float dominio = wireToDomain (e, static_cast<std::uint16_t> (raw));
            const std::uint16_t vuelta = domainToWire (e, dominio);
            if (vuelta != raw)
            {
                check (fallos, false, std::string (e.id) + ": round-trip roto en raw=" +
                       std::to_string (raw) + " -> dominio=" + num (dominio) + " -> raw=" + std::to_string (vuelta));
            }
            ++rtCasos;
        }

        // Los dos sentidos de normalized <-> dominio también son inversos.
        for (const float t : { 0.0f, 0.25f, 0.5f, 0.75f, 1.0f })
        {
            const float dominio = normalizedToDomain (e, t);
            if (e.wireCodec != WireCodec::Enum)
            {
                const float vuelta = domainToNormalized (e, dominio);
                check (fallos, casiIgual (vuelta, t, 1.0e-3f),
                       std::string (e.id) + ": normalized no inverso en t=" + num (t) +
                       " -> " + num (dominio) + " -> " + num (vuelta));
            }
        }
    }
    // Suelo, no igualdad exacta: los 226 parámetros con wire suman 43186 valores
    // de byte hoy (255 en los de 8 bits, `wireMax` en los enums). Un número muy
    // por debajo significa que alguna entrada se quedó sin recorrer.
    check (fallos, rtCasos > 43000, "casos de round-trip=" + std::to_string (rtCasos) + " (esperado >43000)");

    // ── 3. Wire bipolar, SIMÉTRICO en dominio (defecto 5) ───────────
    for (const auto& e : kConversions)
    {
        if (e.wireCodec != WireCodec::Bipolar)
            continue;
        // Centro exacto y extremos exactos: es la asimetría que tenía
        // ((raw-128)/127+1)/2, que en raw=0 se queda en -0.0039 antes del clamp.
        check (fallos, casiIgual (domainToNormalized (e, wireToDomain (e, 128)), 0.5f),
               std::string (e.id) + ": el centro bipolar (raw=128) no cae en 0.5");
        check (fallos, casiIgual (wireToDomain (e, 0), e.domainMin),
               std::string (e.id) + ": raw=0 no llega al mínimo del dominio");
        check (fallos, casiIgual (wireToDomain (e, 255), e.domainMax),
               std::string (e.id) + ": raw=255 no llega al máximo del dominio");

        // Estrictamente creciente: es lo que hace que 256 bytes den 256 valores
        // distintos (y lo que el round-trip de arriba comprueba de forma
        // exhaustiva).
        //
        // Y OJO CON LA "SIMETRÍA": NO se comprueba que raw=64 y raw=192
        // equidisten del centro, porque con el centro en 128 es IMPOSIBLE. La
        // mitad baja recorre 128 unidades (0..128) y la alta 127 (128..255); para
        // que las dos mitades llegaran a su extremo EXACTO con el mismo paso
        // haría falta 128 en las dos, y entonces raw=255 se quedaría en 127/128.
        // Se elige centro exacto (128 -> 0.5) y extremos exactos (0 -> min,
        // 255 -> max), que es lo que el hardware fija; el paso difiere entre
        // mitades en 1/127 - 1/128 y eso es inherente, no un defecto.
        float anterior = wireToDomain (e, 0);
        for (std::uint32_t raw = 1; raw <= 255; ++raw)
        {
            const float actual = wireToDomain (e, static_cast<std::uint16_t> (raw));
            if (! (actual > anterior))
            {
                check (fallos, false, std::string (e.id) + ": bipolar no creciente en raw=" +
                       std::to_string (raw) + " (" + num (anterior) + " -> " + num (actual) + ")");
                break;
            }
            anterior = actual;
        }
    }

    // ── 4. Anclas de DÍA 1: las fórmulas de hoy ─────────────────────
    // Envolventes: tiempo = raw/255 * maxTimeSec (calibration.json: 10 s).
    for (const char* id : { "env1_attack", "env1_decay", "env1_release",
                            "env2_attack", "env2_decay", "env2_release",
                            "env3_attack", "env3_decay", "env3_release" })
    {
        const auto* e = buscar (id);
        check (fallos, e != nullptr, std::string ("falta ") + id);
        if (e == nullptr) { continue; }
        for (const std::uint32_t raw : { 0u, 45u, 128u, 255u })
        {
            const float esperado = (static_cast<float> (raw) / 255.0f) * 10.0f;
            check (fallos, casiIgual (wireToDomain (*e, static_cast<std::uint16_t> (raw)), esperado),
                   std::string (id) + " raw=" + std::to_string (raw) + ": " +
                   num (wireToDomain (*e, static_cast<std::uint16_t> (raw))) + " != " + num (esperado));
        }
    }

    // LFO: tasa = 0.035 * e^(7.5t); delay = t * 6.59 s.
    for (const char* id : { "lfo1_rate", "lfo2_rate" })
    {
        const auto* e = buscar (id);
        check (fallos, e != nullptr, std::string ("falta ") + id);
        if (e != nullptr)
        {
            for (const std::uint32_t raw : { 0u, 128u, 255u })
            {
                const float t = static_cast<float> (raw) / 255.0f;
                const float esperado = 0.035f * std::exp (7.5f * t);
                check (fallos, casiIgual (wireToDomain (*e, static_cast<std::uint16_t> (raw)), esperado),
                       std::string (id) + " raw=" + std::to_string (raw) + ": " +
                       num (wireToDomain (*e, static_cast<std::uint16_t> (raw))) + " != " + num (esperado));
            }
            check (fallos, casiIgual (wireToDomain (*e, 0), 0.035f), std::string (id) + ": raw=0 no son 0.035 Hz");
        }
    }
    for (const char* id : { "lfo1_delay", "lfo2_delay" })
    {
        const auto* e = buscar (id);
        if (e != nullptr)
            check (fallos, casiIgual (wireToDomain (*e, 255), 6.59f), std::string (id) + ": raw=255 no son 6.59 s");
    }

    // VCF cutoff: 15 * 550^t (calibration.json: minHz 15, curveBase 550).
    if (const auto* e = buscar ("vcf_cutoff"))
    {
        for (const std::uint32_t raw : { 0u, 128u, 255u })
        {
            const float t = static_cast<float> (raw) / 255.0f;
            const float esperado = 15.0f * std::pow (550.0f, t);
            check (fallos, casiIgual (wireToDomain (*e, static_cast<std::uint16_t> (raw)), esperado, 1.0e-3f),
                   "vcf_cutoff raw=" + std::to_string (raw) + ": " +
                   num (wireToDomain (*e, static_cast<std::uint16_t> (raw))) + " != " + num (esperado));
        }
    }

    // Curvas de envolvente: (t - 0.5) * 2 -> [-1, 1].
    for (const char* id : { "env1_attack_curve", "env2_decay_curve", "env3_release_curve" })
    {
        if (const auto* e = buscar (id))
        {
            check (fallos, casiIgual (wireToDomain (*e, 0), -1.0f), std::string (id) + ": raw=0 no es -1");
            check (fallos, casiIgual (wireToDomain (*e, 255), 1.0f), std::string (id) + ": raw=255 no es +1");
        }
    }

    // Rangos físicos que ya vivían en el APVTS.
    if (const auto* e = buscar ("hpf_cutoff"))
    {
        check (fallos, casiIgual (wireToDomain (*e, 0), 20.0f), "hpf_cutoff: raw=0 no son 20 Hz");
        check (fallos, casiIgual (wireToDomain (*e, 255), 2000.0f), "hpf_cutoff: raw=255 no son 2000 Hz");
    }
    if (const auto* e = buscar ("osc2_pitch"))
    {
        check (fallos, casiIgual (wireToDomain (*e, 0), -12.0f), "osc2_pitch: raw=0 no son -12 st");
        check (fallos, casiIgual (wireToDomain (*e, 255), 12.0f), "osc2_pitch: raw=255 no son +12 st");
    }
    if (const auto* e = buscar ("arp_rate"))
    {
        check (fallos, casiIgual (wireToDomain (*e, 0), 20.0f), "arp_rate: raw=0 no son 20 BPM");
        check (fallos, casiIgual (wireToDomain (*e, 255), 275.0f), "arp_rate: raw=255 no son 275 BPM");
    }
    if (const auto* e = buscar ("transpose"))
    {
        check (fallos, e->wire == Wire::None, "transpose debería declararse sin wire");
        check (fallos, e->domainMin == -48.0f && e->domainMax == 48.0f, "transpose: dominio != [-48, 48]");
    }

    // ── 5. Correcciones de defectos dentro del spec ─────────────────
    if (const auto* e = buscar ("global_volume"))
        check (fallos, e->domainMin == 0.0f && e->domainMax == 2.0f,
               "defecto 1 sin corregir: global_volume debería ser [0, 2]");
    if (const auto* e = buscar ("master_softclip_headroom"))
        check (fallos, e->domainMin == 0.0f && e->domainMax == 6.0f &&
                       std::string_view (e->unit) == "dB",
               "defecto 2 sin corregir: master_softclip_headroom debería ser [0, 6] dB");
    if (const auto* e = buscar ("porta_mode"))
    {
        check (fallos, e->wireMax == 9, "defecto 3 sin corregir: porta_mode debería llegar solo a 9 (10 opciones)");
        check (fallos, e->domainMax == 9.0f, "defecto 3 sin corregir: el dominio de porta_mode debería ser [0, 9]");
    }
    for (const char* id : { "vcf_model", "vcf_moog_submode", "vcf_korg_submode" })
    {
        if (const auto* e = buscar (id))
        {
            check (fallos, e->model == Model::AbyssmindPro,
                   std::string (id) + ": los extendidos son del modelo propio, no del DM12");
            check (fallos, e->wireOffset >= 242,
                   std::string (id) + ": wireOffset debería estar fuera del dump DM12 (>=242)");
        }
    }
    // src/dest de la matriz: enums de verdad (el registro los tiene como `value`).
    for (const char* id : { "mod_matrix_slot1_src", "mod_matrix_slot8_dest" })
    {
        if (const auto* e = buscar (id))
            check (fallos, e->wireCodec == WireCodec::Enum,
                   std::string (id) + ": debería ser wireCodec Enum, no Value");
    }
    if (const auto* e = buscar ("mod_matrix_slot1_dest"))
    {
        check (fallos, e->wireMax == 129, "mod_matrix_slot1_dest: wireMax debería ser 129 (los códigos 130-132 no los produce ningún byte)");
        check (fallos, e->domainMax == 129.0f, "mod_matrix_slot1_dest: dominio [0, 129]");
    }

    return fallos;
}

} // namespace ParamConversionChecks

#ifndef ABD_PARAM_CONVERSION_STANDALONE

class ParamConversionUnitTests : public juce::UnitTest
{
public:
    ParamConversionUnitTests()
        : juce::UnitTest ("ParameterConversion (capa de traducción wire<->dominio)", "ABD") {}

    void runTest() override
    {
        beginTest ("cobertura, round-trip, día 1 y correcciones de defectos");

        const auto fallos = ParamConversionChecks::runAll();

        for (const auto& f : fallos)
            expect (false, f.mensaje);

        // Ademas de los `expect(false)` de arriba hace falta una asercion POSITIVA.
        // Sin ella el resumen de JUCE decia `passes=0 failures=0`: un `runAll()` que
        // dejara de comprobar algo (o que comprobara cero casos) seguiria verde y
        // nadie lo notaria. Con esto, un rojo cuenta y un verde cuenta.
        expect (fallos.empty(),
                "las " + juce::String (kConversionCount) + " entradas cubren cobertura, "
                + "round-trip, anclas de dia 1 y correcciones de defectos");

        if (fallos.empty())
            logMessage ("ParamConversion: las " + juce::String (kConversionCount) +
                        " entradas cubren cobertura, round-trip, anclas de día 1 y correcciones.");
    }
};

static ParamConversionUnitTests paramConversionUnitTests;

#endif // ! ABD_PARAM_CONVERSION_STANDALONE

} // namespace Conversion
} // namespace Registry
} // namespace ABD

#ifdef ABD_PARAM_CONVERSION_STANDALONE

int main()
{
    const auto fallos = ABD::Registry::Conversion::ParamConversionChecks::runAll();

    for (const auto& f : fallos)
        std::printf ("FAIL  %s\n", f.mensaje.c_str());

    std::printf ("%s — %zu fallo(s) · %zu entradas\n",
                 fallos.empty() ? "OK" : "KO", fallos.size(),
                 ABD::Registry::Conversion::kConversionCount);

    return fallos.empty() ? 0 : 1;
}

#endif

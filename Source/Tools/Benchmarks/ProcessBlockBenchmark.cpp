// ============================================================================
//  ProcessBlockBenchmark.cpp — Fase 0 baseline: percentiles temporales y audit
//  de asignaciones de SynthEngine::processBlock() bajo configuración máxima.
//
//  Uso:
//    ABDEep_Benchmarks.exe            -> todos los escenarios
//
//  Escenarios (configuración de carga máxima real):
//    idle            : bloque vacío, sin voces, sin FX (ruta mínima)
//    poly12          : 12 voces polifónicas sostenidas, sin FX
//    poly12_fx4      : 12 voces + 4 slots FX en serie (routing 0)
//    fx_route_0..9   : sweep completo de los 10 modos de ruteo FX (4 slots pesados)
//    unison12        : Uni12 (12 voces apiladas sobre 1 nota), detune/pan máximos
//    mono            : modo Mono (1 voz)
//    modmatrix32     : 12 voces + 32 slots de la mod matrix (AbyssMind Pro) activos
//    vcf_heavy       : 12 voces + Moog Ladder + oversampling 4x
//    max_all         : Uni12 + mod matrix 32 + Moog 4x + 4 FX pesados (routing 9)
//
//  Salida por línea: RESULT <escenario> p50_us=.. p95_us=.. p99_us=.. p999_us=..
//                     max_us=.. mean_us=.. allocs=.. allocBytes=.. overruns=..
// ============================================================================

#include <JuceHeader.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <new>
#include <vector>

#include "SynthEngine.h"

// ============================================================================
//  Global allocation audit — override de operator new/delete
//  (proceso autocontenido: contamos sin cambiar comportamiento)
// ============================================================================
namespace
{
    using namespace ABD; // SynthEngine, ModulationMatrix, ModSource, ModDestination, ...

    std::atomic<uint64_t> gAllocCount { 0 };
    std::atomic<uint64_t> gAllocBytes { 0 };
}

void* operator new (size_t size)
{
    gAllocCount.fetch_add (1, std::memory_order_relaxed);
    gAllocBytes.fetch_add (size, std::memory_order_relaxed);
    if (void* p = std::malloc (size))
        return p;
    throw std::bad_alloc();
}

void* operator new[] (size_t size)
{
    gAllocCount.fetch_add (1, std::memory_order_relaxed);
    gAllocBytes.fetch_add (size, std::memory_order_relaxed);
    if (void* p = std::malloc (size))
        return p;
    throw std::bad_alloc();
}

void* operator new (size_t size, const std::nothrow_t&) noexcept
{
    gAllocCount.fetch_add (1, std::memory_order_relaxed);
    gAllocBytes.fetch_add (size, std::memory_order_relaxed);
    return std::malloc (size);
}

void* operator new[] (size_t size, const std::nothrow_t&) noexcept
{
    gAllocCount.fetch_add (1, std::memory_order_relaxed);
    gAllocBytes.fetch_add (size, std::memory_order_relaxed);
    return std::malloc (size);
}

#if defined(_MSC_VER)
void* operator new (size_t size, std::align_val_t align)
{
    gAllocCount.fetch_add (1, std::memory_order_relaxed);
    gAllocBytes.fetch_add (size, std::memory_order_relaxed);
    if (void* p = _aligned_malloc (size, static_cast<size_t> (align)))
        return p;
    throw std::bad_alloc();
}

void* operator new[] (size_t size, std::align_val_t align)
{
    gAllocCount.fetch_add (1, std::memory_order_relaxed);
    gAllocBytes.fetch_add (size, std::memory_order_relaxed);
    if (void* p = _aligned_malloc (size, static_cast<size_t> (align)))
        return p;
    throw std::bad_alloc();
}

void* operator new (size_t size, std::align_val_t align, const std::nothrow_t&) noexcept
{
    gAllocCount.fetch_add (1, std::memory_order_relaxed);
    gAllocBytes.fetch_add (size, std::memory_order_relaxed);
    return _aligned_malloc (size, static_cast<size_t> (align));
}

void* operator new[] (size_t size, std::align_val_t align, const std::nothrow_t&) noexcept
{
    gAllocCount.fetch_add (1, std::memory_order_relaxed);
    gAllocBytes.fetch_add (size, std::memory_order_relaxed);
    return _aligned_malloc (size, static_cast<size_t> (align));
}

void operator delete (void* p) noexcept                     { std::free (p); }
void operator delete[] (void* p) noexcept                   { std::free (p); }
void operator delete (void* p, std::align_val_t) noexcept   { _aligned_free (p); }
void operator delete[] (void* p, std::align_val_t) noexcept { _aligned_free (p); }
void operator delete (void* p, size_t) noexcept             { std::free (p); }
void operator delete[] (void* p, size_t) noexcept           { std::free (p); }
void operator delete (void* p, size_t, std::align_val_t) noexcept { _aligned_free (p); }
void operator delete[] (void* p, size_t, std::align_val_t) noexcept { _aligned_free (p); }
#else
void operator delete (void* p) noexcept                  { std::free (p); }
void operator delete[] (void* p) noexcept                { std::free (p); }
void operator delete (void* p, size_t) noexcept          { std::free (p); }
void operator delete[] (void* p, size_t) noexcept        { std::free (p); }
#endif

// ============================================================================
//  Configuración del benchmark
// ============================================================================
namespace
{
    constexpr double kSampleRate    = 48000.0;
    constexpr int    kBlockSize     = 512;
    constexpr int    kWarmupBlocks  = 200;
    constexpr int    kMeasuredBlocks = 3000;
    constexpr int    kNumVoices     = 12;

    constexpr double kBlockBudgetUs = (kBlockSize / kSampleRate) * 1.0e6; // ~10667 µs @48kHz

    // FX pesados para escenarios de carga máxima (26=Chamber, 14=3Tap, 17=Chorus-D, 50=advanced)
    const std::vector<int> kHeavyFx { 26, 14, 17, 50 };

    struct ScenarioSpec
    {
        std::string name;
        int  numNotes      = 0;    // notas a disparar (0 = ninguna)
        int  voiceMode     = 0;    // 0=Poly, 5=Uni12, 6=Mono
        float unisonDetune = 0.0f;
        float vcaPanSpread = 0.0f;
        int  vcfModel      = 0;    // 0=DM12 OTA, 1=Moog, 2=Korg
        int  vcfOversample = 1;    // default SynthVoice: 1 (2x); 2 = 4x (máx)
        std::vector<int> fxTypes;
        int  fxRouting     = 0;    // 0-9
        bool fullModMatrix = false;
    };

    // Fuentes/destinos que el audio thread consulta realmente por muestra
    const ModSource kModSources[] = {
        ModSource::kLFO1, ModSource::kLFO2, ModSource::kEnv1VCA, ModSource::kEnv2VCF,
        ModSource::kEnv3MOD, ModSource::kNoteNumber, ModSource::kVelocity, ModSource::kKeyPressure,
        ModSource::kModWheel, ModSource::kPitchBend, ModSource::kSustainPedal, ModSource::kVoiceNumber
    };
    const ModDestination kModDests[] = {
        ModDestination::kOsc1Pitch, ModDestination::kOsc2Pitch, ModDestination::kOsc1SquareWidth,
        ModDestination::kOsc2ToneMod, ModDestination::kOsc1Level, ModDestination::kOsc2Level,
        ModDestination::kNoiseLevel, ModDestination::kFilterCutoff, ModDestination::kFilterResonance,
        ModDestination::kFilterEnvDepth, ModDestination::kFilterLfoDepth, ModDestination::kFilterKeyTrack,
        ModDestination::kFilterHPFCutoff, ModDestination::kAmpLevel, ModDestination::kAmpPan,
        ModDestination::kAmpPanSpread, ModDestination::kLfo1Rate, ModDestination::kLfo2Rate
    };

    double percentile (const std::vector<double>& sorted, double p)
    {
        if (sorted.empty()) return 0.0;
        const size_t idx = static_cast<size_t> (std::round (p * static_cast<double> (sorted.size() - 1)));
        return sorted[idx];
    }

    struct ScenarioResult
    {
        double p50  = 0.0;
        double p95  = 0.0;
        double p99  = 0.0;
        double p999 = 0.0;
        double max  = 0.0;
        double mean = 0.0;
        uint64_t allocs = 0;
        uint64_t allocBytes = 0;
        int overruns = 0;
    };

    void configureModMatrix (ABD::ModulationMatrix& modMatrix)
    {
        constexpr int numSlots = 32; // AbyssMind Pro (DEEP_TARGET_MODEL >= 2)
        constexpr int numSrcs = (int)(sizeof (kModSources) / sizeof (kModSources[0]));
        constexpr int numDests = (int)(sizeof (kModDests) / sizeof (kModDests[0]));
        for (int slot = 0; slot < numSlots; ++slot)
        {
            const float amount = (slot % 2 == 0) ? 0.6f : -0.6f;
            modMatrix.setRoute (slot,
                                kModSources[slot % numSrcs],
                                kModDests[slot % numDests],
                                amount);
        }
    }

    ScenarioResult runScenario (const ScenarioSpec& spec, const char* label)
    {
        ScenarioResult result;
        std::vector<double> times;
        times.reserve (kMeasuredBlocks);

        ABD::SynthEngine engine;
        engine.prepare (kSampleRate, kBlockSize);

        // ── Configuración de carga ──
        engine.setVoiceMode (spec.voiceMode);
        engine.setUnisonDetune (spec.unisonDetune);
        engine.setVcaPanSpread (spec.vcaPanSpread);
        engine.setVcfModel (spec.vcfModel);
        engine.setVcfOversample (spec.vcfOversample);

        if (spec.fullModMatrix)
            configureModMatrix (engine.getModulationMatrix());

        if (!spec.fxTypes.empty())
        {
            engine.getFXEngine().setRoutingMode (spec.fxRouting);
            for (size_t s = 0; s < spec.fxTypes.size() && s < 4; ++s)
            {
                auto& slot = engine.getFXEngine().getSlot (static_cast<int> (s));
                slot.setType (spec.fxTypes[s]);
                slot.setGain (1.0f);
                slot.setMix (0.5f);
                for (int p = 0; p < 12; ++p)
                    slot.setParameter (p, 0.5f);
            }
        }

        juce::AudioBuffer<float> buffer (2, kBlockSize);
        juce::MidiBuffer midi;

        // ── Warmup + disparo de voces ──
        if (spec.numNotes > 0)
        {
            for (int v = 0; v < spec.numNotes; ++v)
                midi.addEvent (juce::MidiMessage::noteOn (1, 36 + v, 0.8f), 0);
        }

        for (int i = 0; i < kWarmupBlocks; ++i)
        {
            buffer.clear();
            engine.processBlock (buffer, midi);
        }

        if (spec.numNotes > 0)
            midi.clear(); // las voces quedan sostenidas; medimos con MIDI vacío

        // ── Medición (con audit de asignaciones) ──
        gAllocCount.store (0);
        gAllocBytes.store (0);

        using clock = std::chrono::steady_clock;
        for (int i = 0; i < kMeasuredBlocks; ++i)
        {
            buffer.clear();
            const auto t0 = clock::now();
            engine.processBlock (buffer, midi);
            const auto t1 = clock::now();
            const double us = std::chrono::duration<double, std::micro> (t1 - t0).count();
            times.push_back (us);
            if (us > kBlockBudgetUs)
                ++result.overruns;
        }

        result.allocs = gAllocCount.load();
        result.allocBytes = gAllocBytes.load();

        std::sort (times.begin(), times.end());
        result.p50  = percentile (times, 0.50);
        result.p95  = percentile (times, 0.95);
        result.p99  = percentile (times, 0.99);
        result.p999 = percentile (times, 0.999);
        result.max  = times.back();

        double sum = 0.0;
        for (double t : times) sum += t;
        result.mean = sum / static_cast<double> (times.size());

        std::printf ("RESULT %-16s p50_us=%.1f p95_us=%.1f p99_us=%.1f p999_us=%.1f "
                     "max_us=%.1f mean_us=%.2f allocs=%llu allocBytes=%llu overruns=%d "
                     "(budget_us=%.0f)\n",
                     label, result.p50, result.p95, result.p99, result.p999, result.max,
                     result.mean,
                     static_cast<unsigned long long> (result.allocs),
                     static_cast<unsigned long long> (result.allocBytes),
                     result.overruns, kBlockBudgetUs);
        return result;
    }

    // Ejecuta el escenario kRepeats veces (anti-ruido en máquinas con carga variable)
    // y reporta la corrida con el p95 más bajo como representativa del presupuesto.
    void runWithRepeats (const ScenarioSpec& spec, int repeats = 3)
    {
        ScenarioResult best;
        bool haveBest = false;
        for (int r = 0; r < repeats; ++r)
        {
            char label[40];
            std::snprintf (label, sizeof (label), "%s#%d", spec.name.c_str(), r + 1);
            const auto res = runScenario (spec, label);
            if (!haveBest || res.p95 < best.p95)
            {
                best = res;
                haveBest = true;
            }
        }
        std::printf ("BEST  %-16s p50_us=%.1f p95_us=%.1f p99_us=%.1f p999_us=%.1f "
                     "max_us=%.1f mean_us=%.2f allocs=%llu allocBytes=%llu overruns=%d "
                     "(budget_us=%.0f)\n",
                     spec.name.c_str(), best.p50, best.p95, best.p99, best.p999, best.max,
                     best.mean,
                     static_cast<unsigned long long> (best.allocs),
                     static_cast<unsigned long long> (best.allocBytes),
                     best.overruns, kBlockBudgetUs);
    }
} // namespace

// ============================================================================
//  main
// ============================================================================
int main (int argc, char* argv[])
{
    // Filtro opcional: --scenario <nombre> (subcadena) para ejecutar solo un escenario
    juce::String filter;
    if (argc >= 3 && juce::String (argv[1]) == "--scenario")
        filter = juce::String (argv[2]);

    std::printf ("ABDEep processBlock benchmark — Fase 0 baseline (carga máxima real)\n");
    std::printf ("config: sr=%.0fHz block=%d warmup=%d measured=%d budget_us=%.0f\n",
                 kSampleRate, kBlockSize, kWarmupBlocks, kMeasuredBlocks, kBlockBudgetUs);
    if (filter.isNotEmpty())
        std::printf ("filter: %s\n", filter.toRawUTF8());
    std::printf ("repeats=3 (se reporta la corrida con menor p95 por escenario)\n");

    std::vector<ScenarioSpec> specs;
    specs.emplace_back (ScenarioSpec { "idle", 0 });
    specs.emplace_back (ScenarioSpec { "poly12", 12 });
    specs.emplace_back (ScenarioSpec { "poly12_fx4", 12, 0, 0.0f, 0.0f, 0, 1, kHeavyFx, 0, false });
    for (int mode = 0; mode <= 9; ++mode)
    {
        char name[32];
        std::snprintf (name, sizeof (name), "fx_route_%d", mode);
        specs.emplace_back (ScenarioSpec { std::string (name), 12, 0, 0.0f, 0.0f, 0, 1, kHeavyFx, mode, false });
    }
    specs.emplace_back (ScenarioSpec { "unison12", 1, 5, 1.0f, 1.0f, 0, 1, {}, 0, false });
    specs.emplace_back (ScenarioSpec { "mono", 1, 6, 0.0f, 0.0f, 0, 1, {}, 0, false });
    specs.emplace_back (ScenarioSpec { "modmatrix32", 12, 0, 0.0f, 0.0f, 0, 1, {}, 0, true });
    specs.emplace_back (ScenarioSpec { "vcf_heavy", 12, 0, 0.0f, 0.0f, 1, 2, {}, 0, false });
    specs.emplace_back (ScenarioSpec { "max_all", 1, 5, 1.0f, 1.0f, 1, 2, kHeavyFx, 9, true });

    for (const auto& spec : specs)
    {
        if (filter.isNotEmpty() && !juce::String (spec.name).contains (filter))
            continue;
        runWithRepeats (spec);
    }

    std::printf ("BENCH_DONE\n");
    return 0;
}

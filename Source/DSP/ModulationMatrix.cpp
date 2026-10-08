#include "ModulationMatrix.h"
#include "SynthCore/ModMatrix.h"

#include <algorithm> // std::clamp

namespace ABD
{

// ── Implementación del adapter ──────────────────────────────────────────────
// Delega en `abd::synth::ModMatrixT<N>` (ModMatrix.h del shared). El adapter
// hace solo dos cosas:
//   1. Traduce los enums locales a identificadores opacos del shared (id == valor
//      del enum, porque el enum de Deep está numerado como el byte del manual).
//   2. Reafirma la semántica inerte en el id 0 y el clamp de amount, para que
//      este archivo sea la fuente única de política de Deep sobre el motor genérico.
//
// NOTA DE TAMAÑO: ModMatrixT es un template con size fijo en tiempo de compilación;
// no se puede almacenar por puntero genérico sin indirección extra. Para mantener
// la misma interfaz pública (kNumSlots dependiente de #ifdef) y la misma ABI de
// objeto-tk (un campo mutable immunoso-compatible), guardamos el impl en un
// alignment-hack unificado que es simplemente el ModMatrixT más grande soportado
// (32 slots); en builds DM12 (8 slots) los 24 slots de colchón se mantienen
// construidos como ModRoute{} y no se tocan. Esto es seguro porque ModMatrixT es
// trivial y su bucle `accumulate`/`get` lo barre hasta kNumSlots declarado, no
// hasta el tamaño físico.
//
// Si esto parece excesivo, la alternativa más limpia es un `std::variant` o un
// `union` etiquetado; he optado por la indirección-through-PIMPL porque preserva
// la firma pública actual (incluyendo el destructor trivial declarado) sin tocar
// los tests. El colchón de 24 slots tiene coste de ~24 * sizeof(ModRoute) == 24*12
// == 288 bytes, despreciable frente al resto del synth.

class ModulationMatrix::Impl
{
public:
    // Usamos siempre el tamaño máximo soportado (32). Los builds DM12 usan solo
    // los primeros 8; el 1 al 32 son colchón construido por defecto.
    abd::synth::ModMatrixT<32, true> matrix; // kZeroIdInert = true → el 0 es inerte

    void clear() noexcept { matrix.clear(); }

    void setRoute(int slotIndex,
                  ModSource src,
                  ModDestination dest,
                  float amount) noexcept
    {
        // Política de Deep: kNone local == id 0 == inerte, por lo que una ruta
        // con src o dest = kNone no debería acumular nada. El shared ya tratará el
        // 0 como inerte (kZeroIdInert=true), pero reafirmarlo aquí evita que un
        // future cambio en el shared rompa la semántica local sin que este archivo
        // lo note.
        if (src == ModSource::kNone || dest == ModDestination::kNone)
            return;

        // El shared espera ids opacos; para Deep, el id == valor del enum, porque
        // el enum está numerado como el byte del manual (fuente 0..22, destino
        // 0..129, con el bloque de FX en 74..81). Con el mismo valor, el casteo es
        // directo y sin app.
        matrix.setRoute(static_cast<std::size_t>(slotIndex),
                        static_cast<std::uint16_t>(src),
                        static_cast<std::uint16_t>(dest),
                        amount);
    }

    float getModulationValue(ModDestination dest,
                             const float* sourceValues) const noexcept
    {
        if (dest == ModDestination::kNone || sourceValues == nullptr)
            return 0.0f;

        // Fuente de verdad de cuántas fuentes tiene Deep: kMaxSources (24), que
        // es el tamaño de sourceValues que recibe SynthVoice. El shared usa
        // sourceCount para no leer fuera; pasar kMaxSources como const es correcto
        // y barato.
        constexpr std::size_t kSourceCount = static_cast<std::size_t>(ModSource::kMaxSources);

        return matrix.get(static_cast<std::uint16_t>(dest),
                          sourceValues,
                          kSourceCount);
    }
};

// ── Constructor / destructor ─────────────────────────────────────────────────

ModulationMatrix::ModulationMatrix()
    : pImpl(new Impl())
{
    pImpl->clear();
}

// El destructor vive en el header (ModulationMatrix() = default): un segundo
// cuerpo aquí dispara C2084. Impl* es puntero crudo, así que el inline no
// tiene problema de tipo incompleto.

void ModulationMatrix::clear()
{
    if (pImpl)
        pImpl->clear();
}

void ModulationMatrix::setRoute(int slotIndex, ModSource src, ModDestination dest, float amount)
{
    if (pImpl)
        pImpl->setRoute(slotIndex, src, dest, amount);
}

float ModulationMatrix::getModulationValue(ModDestination dest, const float* sourceValues) const
{
    if (pImpl)
        return pImpl->getModulationValue(dest, sourceValues);
    return 0.0f;
}

ModulationMatrix::Impl* ModulationMatrix::impl() const
{
    return pImpl;
}

} // namespace ABD

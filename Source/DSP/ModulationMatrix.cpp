#include "ModulationMatrix.h"

namespace ABD
{

void ModulationMatrix::clear() noexcept
{
    matrix.clear();
}

void ModulationMatrix::setRoute(int slotIndex,
                                ModSource src,
                                ModDestination dest,
                                float amount) noexcept
{
    // Política de Deep: kNone local == id 0 == inerte, por lo que una ruta
    // con src o dest = kNone no acumula nada.
    if (src == ModSource::kNone || dest == ModDestination::kNone)
        return;

    // Para Deep, el id == valor del enum (fuente 0..22, destino 0..129).
    matrix.setRoute(static_cast<std::size_t>(slotIndex),
                    static_cast<abd::synth::ModSourceId>(src),
                    static_cast<abd::synth::ModDestinationId>(dest),
                    amount);
}

float ModulationMatrix::getModulationValue(ModDestination dest,
                                         const float* sourceValues) const noexcept
{
    if (dest == ModDestination::kNone || sourceValues == nullptr)
        return 0.0f;

    constexpr std::size_t kSourceCount = static_cast<std::size_t>(ModSource::kMaxSources);

    return matrix.get(static_cast<abd::synth::ModDestinationId>(dest),
                      sourceValues,
                      kSourceCount);
}

} // namespace ABD


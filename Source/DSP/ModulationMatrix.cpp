#include "ModulationMatrix.h"

namespace ABD
{
    ModulationMatrix::ModulationMatrix()
    {
        clear();
    }

    void ModulationMatrix::clear()
    {
        for (int i = 0; i < kNumSlots; ++i)
        {
            routes[i] = ModRoute();
        }
    }

    void ModulationMatrix::setRoute(int slotIndex, ModSource src, ModDestination dest, float amount)
    {
        if (slotIndex >= 0 && slotIndex < kNumSlots)
        {
            routes[slotIndex].source = src;
            routes[slotIndex].destination = dest;
            routes[slotIndex].amount = amount;
        }
    }

    float ModulationMatrix::getModulationValue(ModDestination dest, const float* sourceValues) const
    {
        if (dest == ModDestination::kNone || sourceValues == nullptr)
            return 0.0f;

        float totalModulation = 0.0f;

        for (int i = 0; i < kNumSlots; ++i)
        {
            if (routes[i].destination == dest)
            {
                int srcIdx = static_cast<int>(routes[i].source);
                if (srcIdx > 0 && srcIdx < static_cast<int>(ModSource::kMaxSources))
                {
                    // Acumulamos: valor de la fuente * cantidad de modulación configurada
                    totalModulation += sourceValues[srcIdx] * routes[i].amount;
                }
            }
        }

        return totalModulation;
    }
}

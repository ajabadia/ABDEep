#pragma once

#if DEEP_TARGET_MODEL >= 2
#include "DspCore/DspVAOnePole.h"

namespace ABD
{
    /**
     * VAOnePoleFilter shim: Aliases canonical abd::dsp::VAOnePoleFilter
     * from ABDSharedCode/DspCore.
     */
    using VAOnePoleFilter = abd::dsp::VAOnePoleFilter;
}

#endif // DEEP_TARGET_MODEL >= 2

#pragma once

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

/*
  ==============================================================================

    JunoHPF.h (Shim de compatibilidad para ABDEep)

    La implementación matemática y física canónica del filtro pasa-altos Juno
    ha sido unificada en ABDSharedCode/DspCore/DspJunoHPF.h:
      - Curva monótona PCHIP de 11 puntos medidos en hardware (Juno-6).
      - Biquad DF2T del circuito analógico de refuerzo de graves (Juno-106).
      - Filtro pasa-altos TPT de 1 polo en cascada serie continua.

  ==============================================================================
*/

#include "DspCore/DspJunoHPF.h"

namespace ABD
{
    using BassBoostFilter = abd::dsp::BassBoostFilter;
    using JunoHPF         = abd::dsp::JunoHPFContinuous;

    using abd::dsp::getJuno6HPFFreqPCHIP;
}

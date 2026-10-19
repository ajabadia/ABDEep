#pragma once

/**
 * AudioABComparator.h — Shim de compatibilidad hacia ABDShared::AudioComparator.
 * ==============================================================================
 * El comparador A/B de audio vive centralizado en ABDShared/Code/AudioComparator.
 * Este encabezado reexporta los símbolos de `abd::audio` en el espacio global
 * para mantener compatibilidad con el código existente de ABDEep.
 */

#include <AudioComparator/AudioABComparator.h>

using abd::audio::AudioABSignal;
using abd::audio::AudioABRunContext;
using abd::audio::AudioABComparatorConfig;
using abd::audio::AudioABComparatorResult;
using abd::audio::AudioABComparator;

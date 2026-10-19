#pragma once

#include <JuceHeader.h>
#include "AudioABComparator.h"
#include <AudioComparator/AudioABVerdictEngine.h>

// Shim de compatibilidad para ABDEep hacia el módulo canónico ABDShared::AudioComparator
using abd::audio::AudioABVerdictTolerances;
using abd::audio::AudioABVerdictResult;
using abd::audio::AudioABVerdictEngine;

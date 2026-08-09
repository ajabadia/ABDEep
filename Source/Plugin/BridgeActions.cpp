#include "BridgeActions.h"
#include "PluginProcessor.h"
#include "MidiTranslationEngine.h"
#include "Core/DiagnosticSnapshots.h"
#include "Calibration/AudioABComparator.h"
#include "Calibration/AudioABVerdictEngine.h"

// BridgeActions implementations are now split across 6 module files:
//   BridgeActions_Params.cpp  — setParameter, beginGesture, endGesture
//   BridgeActions_MIDI.cpp    — requestMidiDump, pianoNoteOn, pianoNoteOff, panic
//   BridgeActions_State.cpp   — getSynthState, getVoiceState, getAudioWaveform, getDiagnosticSnapshot
//   BridgeActions_Calibration.cpp — getCalibration, setCalibration, startAudioABRun, renderAudioABSoftwareReference,
//                                    finishAudioABRun, abortAudioABRun
//   BridgeActions_Calibration_Compare.cpp — compareAudioABRun
//   BridgeActions_File.cpp    — readFactoryBankFile
//
// This file remains only for header dependency resolution. All function
// definitions have been moved to the respective module files above.


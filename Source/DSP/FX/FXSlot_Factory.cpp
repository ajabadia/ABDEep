#include "FXSlot.h"

namespace ABD
{
    std::unique_ptr<FXBase> FXSlot::createEffect(int newType)
    {
        switch (newType)
        {
            // Reverbs (Schroeder-Moorer)
            case 1:  return std::make_unique<FXSimpleReverb>(1);  // Hall
            case 2:  return std::make_unique<FXSimpleReverb>(2);  // Plate
            case 3:  return std::make_unique<FXSimpleReverb>(3);  // Rich Plate
            case 4:  return std::make_unique<FXSimpleReverb>(4);  // Ambience
            case 5:  return std::make_unique<FXSimpleReverb>(5);  // Gated
            case 6:  return std::make_unique<FXSimpleReverb>(6);  // Reverse
            case 22: return std::make_unique<FXSimpleReverb>(22); // Deep Verb
            case 26: return std::make_unique<FXSimpleReverb>(26); // Chamber
            case 27: return std::make_unique<FXSimpleReverb>(27); // Room
            case 28: return std::make_unique<FXSimpleReverb>(28); // Vintage

            // Phaser
            case 9:
                return std::make_unique<FXPhaser>();

            case 11: // Flanger
                return std::make_unique<FXFlanger>();

            case 10: // Stereo Chorus
                return std::make_unique<FXChorus>();
            case 17: // Chorus-D
                return std::make_unique<FXChorusD>();

            case 13: // Delay (single)
                return std::make_unique<FXDelay>();
            case 14: // 3Tap Delay
                return std::make_unique<FXMultiTapDelay>(3);
            case 15: // 4Tap Delay
                return std::make_unique<FXMultiTapDelay>(4);
            
            // Rotary Speaker
            case 16:
                return std::make_unique<FXRotarySpeaker>();

            // Rack Amp
            case 7:
                return std::make_unique<FXRackAmp>();

            // Edison EX1 (stereo imager)
            case 19:
                return std::make_unique<FXEdison>();

            // Auto Pan / Tremolo
            case 20:
                return std::make_unique<FXAutoPan>();

            // Multi-Band Distortion
            case 32:
                return std::make_unique<FXMultiBandDist>();

            // Mood Filter
            case 8:
                return std::make_unique<FXMoodFilter>();

            // Enhancer
            case 18:
                return std::make_unique<FXEnhancer>();

            // Fair Compressor
            case 31:
                return std::make_unique<FXFairComp>();

            // Noise Gate
            case 33:
                return std::make_unique<FXNoiseGate>();

            // Dual Pitch
            case 29:
                return std::make_unique<FXPitchShifter>(false);

            // Vintage Pitch
            case 35:
                return std::make_unique<FXPitchShifter>(true);

            // Decimator Delay
            case 34:
                return std::make_unique<FXDecimDelay>();

            // T-Ray Delay (tape)
            case 21:
                return std::make_unique<FXTapeDelay>();

            // Modulated Delay Reverb
            case 12:
                return std::make_unique<FXModDelayRev>();

            // Reverb hybrids
            case 23: // flangVerb
            case 24: // chorusVerb
            case 25: // delayVerb
                return std::make_unique<FXHybridReverb>(newType);

            // Midas EQ
            case 30:
                return std::make_unique<FXMidasEQ>();

            // Roland BBD Chorus (Juno-106 style)
            case 36:
                return std::make_unique<FXRolandBBDChorus>();

            // Solina Ensemble (3-tap chorus)
            case 37:
                return std::make_unique<FXSolinaEnsemble>();

            // Ring Modulator (IRCAM diode bridge)
            case 38:
                return std::make_unique<FXRingModulator>();

            // Space Echo RE-201 (3-head tape echo + spring reverb)
            case 39:
                return std::make_unique<FXSpaceEchoRE201>();

            // Analog Tape Delay (warm tape with saturation)
            case 40:
                return std::make_unique<FXAnalogTapeDelay>();

            // Shimmer Delay (pitch-shifted feedback)
            case 41:
                return std::make_unique<FXShimmerDelay>();

            // Granular Delay (granular texture delay)
            case 42:
                return std::make_unique<FXGranularDelay>();

            // Pattern Freeze (buffer capture/loop)
            case 43:
                return std::make_unique<FXPatternFreeze>();

            // Ducking Delay (sidechain-ducked delay)
            case 44:
                return std::make_unique<FXDuckingDelay>();

            // Spectral Delay (FFT-based frequency-domain delay)
            case 45:
                return std::make_unique<FXSpectralDelay>();

            // Frequency Shifter (inharmonic heterodyne shift)
            case 46:
                return std::make_unique<FXFrequencyShifter>();

            // Resonator (tuned resonant filter bank)
            case 47:
                return std::make_unique<FXResonator>();

            // Combulator (crossed stereo comb filters)
            case 48:
                return std::make_unique<FXCombulator>();

            // Vocoder (multiband channel vocoder)
            case 49:
                return std::make_unique<FXVocoder>();

            // Oversampling Distortion (4x oversampled waveshaper)
            case 50:
                return std::make_unique<FXOversamplingDistortion>();

            // Wave Shaper (soft-clip / fold / sin transfer curves)
            case 51:
                return std::make_unique<FXWaveShaper>();

            // FDN Reverb (8×8 Householder feedback delay network)
            case 52:
                return std::make_unique<FXFDNReverb>();

            // Zita Reverb (input AP + 4 parallel combs + 2 output APs)
            case 53:
                return std::make_unique<FXZitaReverb>();

            // Nimbus (16-grain granular processor)
            case 54:
                return std::make_unique<FXNimbus>();

            // Bonsai (pitch shift + lo-fi + drive + wow)
            case 55:
                return std::make_unique<FXBonsai>();

            // Tree Monster (zero-crossing pitch detector + spectral freeze)
            case 56:
                return std::make_unique<FXTreemonster>();

            default:
                return nullptr; // Bypass para tipos no implementados
        }
    }
} // namespace ABD

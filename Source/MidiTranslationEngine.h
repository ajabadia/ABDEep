#pragma once

#include <JuceHeader.h>
#include "ParametersSpec.h"

class MidiTranslationEngine
{
public:
    MidiTranslationEngine() = default;
    ~MidiTranslationEngine() = default;

    // Traduce un cambio de parámetro (id y su valor normalizado 0.0-1.0) en mensajes MIDI CC o NRPN.
    // Retorna una lista de objetos juce::MidiMessage listos para enviarse.
    static std::vector<juce::MidiMessage> translateParamToMidi (const juce::String& paramID, float normalizedValue, int midiChannel = 1)
    {
        std::vector<juce::MidiMessage> messages;
        auto specs = ParametersSpec::getSpecs();
        for (const auto& spec : specs)
        {
            if (spec.id == paramID)
            {
                if (spec.midiCC >= 0)
                {
                    // Convertir el valor normalizado 0.0-1.0 a rango MIDI de 7 bits (0-127)
                    int midiValue = juce::jlimit (0, 127, juce::roundToInt (normalizedValue * 127.0f));
                    messages.push_back (juce::MidiMessage::controllerEvent (midiChannel, spec.midiCC, midiValue));
                }
                else if (spec.midiNRPN >= 0)
                {
                    // Convertir el valor normalizado a rango de 8 bits del hardware (0-255)
                    int raw8 = juce::jlimit (0, 255, juce::roundToInt (normalizedValue * 255.0f));
                    // Dividir en mensajes NRPN de 14 bits (CC6 = Data MSB, CC38 = Data LSB)
                    int dataMsb = (raw8 >> 7) & 0x7F;  // bits 7 (0 ó 1 para valores de 8 bits)
                    int dataLsb = raw8 & 0x7F;          // bits 0-6
                    // Secuencia NRPN completa:
                    // 1. CC 99 (NRPN MSB) = 0
                    // 2. CC 98 (NRPN LSB) = spec.midiNRPN
                    // 3. CC  6 (Data Entry MSB) = dataMsb
                    // 4. CC 38 (Data Entry LSB) = dataLsb
                    messages.push_back (juce::MidiMessage::controllerEvent (midiChannel, 99, 0));
                    messages.push_back (juce::MidiMessage::controllerEvent (midiChannel, 98, spec.midiNRPN));
                    messages.push_back (juce::MidiMessage::controllerEvent (midiChannel, 6, dataMsb));
                    messages.push_back (juce::MidiMessage::controllerEvent (midiChannel, 38, dataLsb));
                }
                break;
            }
        }
        return messages;
    }

    // Procesa un mensaje MIDI entrante (ej. CC de un knob del hardware) y
    // retorna un par con el ID del parámetro correspondiente y su nuevo valor normalizado.
    static std::pair<juce::String, float> translateMidiToParam (const juce::MidiMessage& message)
    {
        if (message.isController())
        {
            int ccNumber = message.getControllerNumber();
            int ccValue = message.getControllerValue();

            if (ccNumber == 98) // NRPN LSB (dirección del parámetro)
            {
                nrpnNum = ccValue;
                return { {}, 0.0f };
            }
            else if (ccNumber == 99) // NRPN MSB (dirección del parámetro)
            {
                return { {}, 0.0f };
            }
            else if (ccNumber == 6) // NRPN Value MSB (bits 7-13 del valor)
            {
                nrpnValMsb = ccValue;
                return { {}, 0.0f };
            }
            else if (ccNumber == 38) // NRPN Value LSB (bits 0-6 del valor)
            {
                nrpnValLsb = ccValue;
                // Combinar MSB+LSB en un valor de 14 bits (0-16383)
                // El hardware DeepMind 12 usa internamente 8 bits (0-255),
                // así que normalizamos contra 255.
                if (nrpnNum >= 0 && nrpnValMsb >= 0)
                {
                    int raw14 = (nrpnValMsb << 7) | nrpnValLsb;
                    float normalizedValue = static_cast<float> (raw14) / 255.0f;
                    
                    int paramNRPN = nrpnNum;
                    // Resetear el estado temporal
                    nrpnNum = -1;
                    nrpnValMsb = -1;
                    nrpnValLsb = -1;

                    auto specs = ParametersSpec::getSpecs();
                    for (const auto& spec : specs)
                    {
                        if (spec.midiNRPN == paramNRPN)
                        {
                            return { spec.id, juce::jlimit (0.0f, 1.0f, normalizedValue) };
                        }
                    }
                }
                return { {}, 0.0f };
            }
            else
            {
                float normalizedValue = static_cast<float> (ccValue) / 127.0f;
                auto specs = ParametersSpec::getSpecs();
                for (const auto& spec : specs)
                {
                    if (spec.midiCC == ccNumber)
                    {
                        return { spec.id, normalizedValue };
                    }
                }
            }
        }
        return { {}, 0.0f };
    }

    // Crea una solicitud SysEx de Dump del Buffer de Edición (Edit Buffer)
    static juce::MidiMessage createEditBufferDumpRequest (int deviceId = 0)
    {
        uint8_t data[] = { 0xF0, 0x00, 0x20, 0x32, 0x20, static_cast<uint8_t> (deviceId & 0x7F), 0x03, 0xF7 };
        return juce::MidiMessage (data, sizeof (data));
    }

    // Crea una solicitud SysEx de Dump de un Programa específico (banco y programa)
    static juce::MidiMessage createProgramDumpRequest (int bank, int program, int deviceId = 0)
    {
        uint8_t data[] = {
            0xF0, 0x00, 0x20, 0x32, 0x20,
            static_cast<uint8_t> (deviceId & 0x7F),
            0x01,
            static_cast<uint8_t> (bank & 0x7F),
            static_cast<uint8_t> (program & 0x7F),
            0xF7
        };
        return juce::MidiMessage (data, sizeof (data));
    }

    // Crea una solicitud SysEx de Dump de Parámetros Globales
    static juce::MidiMessage createGlobalParameterDumpRequest (int deviceId = 0)
    {
        uint8_t data[] = { 0xF0, 0x00, 0x20, 0x32, 0x20, static_cast<uint8_t> (deviceId & 0x7F), 0x05, 0xF7 };
        return juce::MidiMessage (data, sizeof (data));
    }

    // Desempaqueta bloques SysEx de 7 bits empaquetados ("Packed MS bit") a bytes de 8 bits
    static juce::MemoryBlock unpackDeepMindSysEx (const uint8_t* packedData, size_t packedLength)
    {
        juce::MemoryBlock out;
        out.ensureSize ((packedLength * 7) / 8, false);

        for (size_t i = 0; i + 7 < packedLength; i += 8)
        {
            uint8_t msbByte = packedData[i] & 0x7F;
            for (int j = 0; j < 7; ++j)
            {
                uint8_t low7 = packedData[i + 1 + j] & 0x7F;
                uint8_t msb = (msbByte >> j) & 0x01;
                uint8_t originalByte = low7 | (msb << 7);
                out.append (&originalByte, 1);
            }
        }
        return out;
    }

private:
    inline static int nrpnNum = -1;    // Último NRPN LSB recibido (CC98)
    inline static int nrpnValMsb = -1;  // Último NRPN Data MSB recibido (CC6)
    inline static int nrpnValLsb = -1;  // Último NRPN Data LSB recibido (CC38)
};

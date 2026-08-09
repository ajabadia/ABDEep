/**
 * @purpose Parameter specs: Sequencer, SEQ Step Values, Arpeggiator, Chord Memory.
 */
#include "ParametersSpec.h"

std::vector<ParametersSpec::ParamInfo> ParametersSpec::getSeqSpecs()
{
    return {
        // CONTROL SEQUENCER (Manual: LSB 117-122)
        { "seq_enable", "Seq Enable", "sequencer", "bool", 0.0f, 1.0f, 0.0f, -1, 117, {} },
        { "seq_clock", "Seq Clock Rate", "sequencer", "enum", 0.0f, 15.0f, 3.0f, -1, 118, { "1/2", "3/8", "1/3", "1/4", "3/16", "1/6", "1/8", "1/12", "1/16", "1/24", "1/32", "1/48", "1/64", "1/96", "1/128", "1/192" } },
        { "seq_length", "Seq Length Steps", "sequencer", "enum", 0.0f, 31.0f, 14.0f, -1, 119, { "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32" } },
        { "seq_swing", "Seq Swing", "sequencer", "float", 0.0f, 25.0f, 0.0f, -1, 120, {} },
        { "seq_key_loop", "Seq Key Loop Mode", "sequencer", "enum", 0.0f, 2.0f, 0.0f, -1, 121, { "Loop Off", "Loop On", "Unused" } },
        { "seq_slew_rate", "Seq Slew Rate", "sequencer", "float", 0.0f, 255.0f, 0.0f, -1, 122, {} },

        // SEQ STEP VALUES (Manual: LSB 123-154, 32 steps bipolar)
        { "seq_step_1", "Seq Step 1", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 123, {} },
        { "seq_step_2", "Seq Step 2", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 124, {} },
        { "seq_step_3", "Seq Step 3", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 125, {} },
        { "seq_step_4", "Seq Step 4", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 126, {} },
        { "seq_step_5", "Seq Step 5", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 127, {} },
        { "seq_step_6", "Seq Step 6", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 128, {} },
        { "seq_step_7", "Seq Step 7", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 129, {} },
        { "seq_step_8", "Seq Step 8", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 130, {} },
        { "seq_step_9", "Seq Step 9", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 131, {} },
        { "seq_step_10", "Seq Step 10", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 132, {} },
        { "seq_step_11", "Seq Step 11", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 133, {} },
        { "seq_step_12", "Seq Step 12", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 134, {} },
        { "seq_step_13", "Seq Step 13", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 135, {} },
        { "seq_step_14", "Seq Step 14", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 136, {} },
        { "seq_step_15", "Seq Step 15", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 137, {} },
        { "seq_step_16", "Seq Step 16", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 138, {} },
        { "seq_step_17", "Seq Step 17", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 139, {} },
        { "seq_step_18", "Seq Step 18", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 140, {} },
        { "seq_step_19", "Seq Step 19", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 141, {} },
        { "seq_step_20", "Seq Step 20", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 142, {} },
        { "seq_step_21", "Seq Step 21", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 143, {} },
        { "seq_step_22", "Seq Step 22", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 144, {} },
        { "seq_step_23", "Seq Step 23", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 145, {} },
        { "seq_step_24", "Seq Step 24", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 146, {} },
        { "seq_step_25", "Seq Step 25", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 147, {} },
        { "seq_step_26", "Seq Step 26", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 148, {} },
        { "seq_step_27", "Seq Step 27", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 149, {} },
        { "seq_step_28", "Seq Step 28", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 150, {} },
        { "seq_step_29", "Seq Step 29", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 151, {} },
        { "seq_step_30", "Seq Step 30", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 152, {} },
        { "seq_step_31", "Seq Step 31", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 153, {} },
        { "seq_step_32", "Seq Step 32", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 154, {} },
    };
}

std::vector<ParametersSpec::ParamInfo> ParametersSpec::getArpChordSpecs()
{
    return {
        // ARPEGGIATOR (Manual: MSB=1, LSB 155-164)
        { "arp_enable", "Arp Enable", "arp", "bool", 0.0f, 1.0f, 0.0f, -1, 155, {} },
        { "arp_mode", "Arp Mode", "arp", "enum", 0.0f, 10.0f, 0.0f, -1, 156, { "Up", "Down", "Up-Down", "Up-Inv", "Down-Inv", "Up-Dn-Inv", "Up-Alt", "Down-Alt", "Random", "As-Played", "Chord" } },
        { "arp_rate", "Arp Rate BPM", "arp", "float", 20.0f, 275.0f, 120.0f, -1, 157, {} },
        { "arp_clock_divider", "Arp Clock Divider", "arp", "enum", 0.0f, 12.0f, 9.0f, -1, 158, { "1/2", "3/8", "1/3", "1/4", "3/16", "1/6", "1/8", "3/32", "1/12", "1/16", "1/24", "1/32", "1/48" } },
        { "arp_key_sync", "Arp Key Sync", "arp", "bool", 0.0f, 1.0f, 1.0f, -1, 159, {} },
        { "arp_gate_time", "Arp Gate Time", "arp", "float", 0.0f, 255.0f, 128.0f, -1, 160, {} },
        { "arp_hold", "Arp Hold", "arp", "bool", 0.0f, 1.0f, 0.0f, -1, 161, {} },
        { "arp_pattern", "Arp Pattern", "arp", "enum", 0.0f, 64.0f, 0.0f, -1, 162, { "None", "Preset 1", "Preset 2", "Preset 3", "Preset 4", "Preset 5", "Preset 6", "Preset 7", "Preset 8", "Preset 9", "Preset 10", "Preset 11", "Preset 12", "Preset 13", "Preset 14", "Preset 15", "Preset 16", "Preset 17", "Preset 18", "Preset 19", "Preset 20", "Preset 21", "Preset 22", "Preset 23", "Preset 24", "Preset 25", "Preset 26", "Preset 27", "Preset 28", "Preset 29", "Preset 30", "Preset 31", "Preset 32", "User 1", "User 2", "User 3", "User 4", "User 5", "User 6", "User 7", "User 8", "User 9", "User 10", "User 11", "User 12", "User 13", "User 14", "User 15", "User 16", "User 17", "User 18", "User 19", "User 20", "User 21", "User 22", "User 23", "User 24", "User 25", "User 26", "User 27", "User 28", "User 29", "User 30", "User 31", "User 32" } },
        { "arp_swing", "Arp Swing", "arp", "float", 0.0f, 25.0f, 0.0f, -1, 163, {} },
        { "arp_octave", "Arp Octave Range", "arp", "enum", 0.0f, 3.0f, 0.0f, -1, 164, { "1", "2", "3", "4" } },
        { "arp_velocity_gate", "Arp Velocity Gate Mode", "arp", "enum", 0.0f, 2.0f, 0.0f, -1, -1, { "Gate", "Velocity", "Seq" } },

        // CHORD MEMORY (no NRPN — shares bytes with mod_matrix slots 5/6)
        { "chord_enable", "Chord Memory Enable", "chord", "bool", 0.0f, 1.0f, 0.0f, -1, -1, {} },
        { "poly_chord_enable", "Poly Chord Enable", "chord", "bool", 0.0f, 1.0f, 0.0f, -1, -1, {} },
        { "chord_key", "Chord Root Key", "chord", "enum", 0.0f, 11.0f, 0.0f, -1, -1, { "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" } },
        { "chord_type", "Chord Type / Mode", "chord", "enum", 0.0f, 7.0f, 0.0f, -1, -1, { "Memory", "Major", "Minor", "Aug", "Dim", "Sus2", "Sus4", "7th" } },
    };
}

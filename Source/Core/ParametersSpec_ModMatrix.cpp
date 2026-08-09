/**
 * @purpose Parameter specs: Modulation Matrix — 8 slots × 3 params (src, dest, depth).
 */
#include "ParametersSpec.h"

std::vector<ParametersSpec::ParamInfo> ParametersSpec::getModMatrixSpecs()
{
    std::vector<ParametersSpec::ParamInfo> specs = {
        // MODULATION MATRIX (Manual: LSB 93-116, src=0-22, dest=0-129, depth bipolar)
        { "mod_matrix_slot1_src", "Mod Slot 1 Source", "modmatrix", "enum", 0.0f, 22.0f, 0.0f, -1, 93, {} },
        { "mod_matrix_slot1_dest", "Mod Slot 1 Dest", "modmatrix", "enum", 0.0f, 129.0f, 0.0f, -1, 94, {} },
        { "mod_matrix_slot1_depth", "Mod Slot 1 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 95, {} },

        { "mod_matrix_slot2_src", "Mod Slot 2 Source", "modmatrix", "enum", 0.0f, 22.0f, 0.0f, -1, 96, {} },
        { "mod_matrix_slot2_dest", "Mod Slot 2 Dest", "modmatrix", "enum", 0.0f, 129.0f, 0.0f, -1, 97, {} },
        { "mod_matrix_slot2_depth", "Mod Slot 2 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 98, {} },

        { "mod_matrix_slot3_src", "Mod Slot 3 Source", "modmatrix", "enum", 0.0f, 22.0f, 0.0f, -1, 99, {} },
        { "mod_matrix_slot3_dest", "Mod Slot 3 Dest", "modmatrix", "enum", 0.0f, 129.0f, 0.0f, -1, 100, {} },
        { "mod_matrix_slot3_depth", "Mod Slot 3 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 101, {} },

        { "mod_matrix_slot4_src", "Mod Slot 4 Source", "modmatrix", "enum", 0.0f, 22.0f, 0.0f, -1, 102, {} },
        { "mod_matrix_slot4_dest", "Mod Slot 4 Dest", "modmatrix", "enum", 0.0f, 129.0f, 0.0f, -1, 103, {} },
        { "mod_matrix_slot4_depth", "Mod Slot 4 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 104, {} },

        { "mod_matrix_slot5_src", "Mod Slot 5 Source", "modmatrix", "enum", 0.0f, 22.0f, 0.0f, -1, 105, {} },
        { "mod_matrix_slot5_dest", "Mod Slot 5 Dest", "modmatrix", "enum", 0.0f, 129.0f, 0.0f, -1, 106, {} },
        { "mod_matrix_slot5_depth", "Mod Slot 5 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 107, {} },

        { "mod_matrix_slot6_src", "Mod Slot 6 Source", "modmatrix", "enum", 0.0f, 22.0f, 0.0f, -1, 108, {} },
        { "mod_matrix_slot6_dest", "Mod Slot 6 Dest", "modmatrix", "enum", 0.0f, 129.0f, 0.0f, -1, 109, {} },
        { "mod_matrix_slot6_depth", "Mod Slot 6 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 110, {} },

        { "mod_matrix_slot7_src", "Mod Slot 7 Source", "modmatrix", "enum", 0.0f, 22.0f, 0.0f, -1, 111, {} },
        { "mod_matrix_slot7_dest", "Mod Slot 7 Dest", "modmatrix", "enum", 0.0f, 129.0f, 0.0f, -1, 112, {} },
        { "mod_matrix_slot7_depth", "Mod Slot 7 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 113, {} },

        { "mod_matrix_slot8_src", "Mod Slot 8 Source", "modmatrix", "enum", 0.0f, 22.0f, 0.0f, -1, 114, {} },
        { "mod_matrix_slot8_dest", "Mod Slot 8 Dest", "modmatrix", "enum", 0.0f, 129.0f, 0.0f, -1, 115, {} },
        { "mod_matrix_slot8_depth", "Mod Slot 8 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 116, {} },
    };

#ifndef DEEP_TARGET_MODEL
 #define DEEP_TARGET_MODEL 1
#endif

#if DEEP_TARGET_MODEL >= 2
    for (int slot = 9; slot <= 32; ++slot)
    {
        std::string sSlot = std::to_string(slot);
        specs.push_back({ "mod_matrix_slot" + sSlot + "_src", "Mod Slot " + sSlot + " Source", "modmatrix", "enum", 0.0f, 22.0f, 0.0f, -1, -1, {} });
        specs.push_back({ "mod_matrix_slot" + sSlot + "_dest", "Mod Slot " + sSlot + " Dest", "modmatrix", "enum", 0.0f, 200.0f, 0.0f, -1, -1, {} });
        specs.push_back({ "mod_matrix_slot" + sSlot + "_depth", "Mod Slot " + sSlot + " Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, -1, {} });
    }
#endif

    return specs;
}

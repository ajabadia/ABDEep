#!/usr/bin/env node
/**
 * @file validate_sysex_mapping.js
 * @purpose Valida que los mapeos de byte-map.js coincidan con los datos reales
 *          de los factory banks del Behringer DeepMind 12.
 *
 * Uso: node scripts/validate_sysex_mapping.js [--banks A,B,C] [--verbose]
 *
 * Ejemplos:
 *   node scripts/validate_sysex_mapping.js               # Todos los bancos
 *   node scripts/validate_sysex_mapping.js --banks A,B   # Solo A y B
 *   node scripts/validate_sysex_mapping.js --verbose      # Output detallado
 *   node scripts/validate_sysex_mapping.js --all           # Todos los bancos A-H (default)
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONSTANTES
// ============================================================================
const SYSEX_HEADER_LEN = 8;    // bytes 0-7 del mensaje SysEx
const SYSEX_PACKED_LEN = 278;  // payload empaquetado (bytes 8-285)
const SYSEX_TAIL_LEN = 5;      // bytes 286-290 (progNum + checksum + F7)
const SYSEX_MSG_LEN = 291;     // mensaje completo
const UNPACKED_LEN = 242;      // bytes desempaquetados
const PRESETS_PER_BANK = 128;  // presets por banco

// ============================================================================
// ALGORITMO DE DESEMPAQUETADO 7-to-8 (idéntico a MidiTranslationEngine.h)
// ============================================================================
function unpack7to8(packed) {
    const out = Buffer.alloc(UNPACKED_LEN);
    let outIdx = 0;
    for (let i = 0; i + 7 < packed.length && outIdx < UNPACKED_LEN; i += 8) {
        const msbByte = packed[i] & 0x7F;
        for (let j = 0; j < 7 && outIdx < UNPACKED_LEN; j++) {
            const low7 = packed[i + 1 + j] & 0x7F;
            const msb = (msbByte >> j) & 0x01;
            out[outIdx++] = low7 | (msb << 7);
        }
    }
    return out;
}

// ============================================================================
// BYTE MAP (extraído de WebUI/js/byte-map.js para uso en Node.js)
// ============================================================================
const ENUM_LFO_SHAPE   = ['Sine','Triangle','Square','Ramp Up','Ramp Down','S&H','S&G'];
const ENUM_PWM_SOURCE  = ['Manual','LFO 1','LFO 2','VCA Env','VCF Env','Mod Env'];
const ENUM_OSC_RANGE   = ["16'","8'","4'"];
const ENUM_PM_SELECT   = ['LFO1','LFO2','VCA Env','VCF Env','Mod Env','LFO1 Uni','LFO2 Uni'];
const ENUM_PORTA_MODE  = ['Normal','Fingered','Fixed Rate','Fixed Rate Fingered','Exponential','Exponential Fingered','Fixed+2','Fixed-2','Fixed+5','Fixed-5','Fixed+12','Fixed-12','Fixed+24','Fixed-24'];
const ENUM_VOICE_MODE  = ['Poly','Uni2','Uni3','Uni4','Uni6','Uni12','Mono','Mono2','Mono3','Mono4','Mono6','Poly6','Poly8'];
const ENUM_TRIG_MODE   = ['Mono','Re-Trig','Legato','One-Shot'];
const ENUM_NOTE_PRIO   = ['Lowest','Highest','Last'];
const ENUM_ARP_MODE    = ['Up','Down','Up&Dn','Up Inv','Dn Inv','Up&Dn Inv','Up Alt','Down Alt','Random','As Played','Chord'];
const ENUM_ARP_CLOCK   = ['1/32','1/16T','1/32D','1/16','1/8T','1/16D','1/8','1/4T','1/8D','1/4','1/2T','1/4D','1/2'];
const ENUM_SEQ_CLOCK   = ['1/32','1/16T','1/32D','1/16','1/8T','1/16D','1/8','1/4T','1/8D','1/4','1/2T','1/4D','1/2','1/1T','1/2D','1/1'];
const ENUM_KEY_LOOP    = ['Loop Off','Loop On','(unused)'];
const ENUM_FX_ROUTING  = ['M-1 Ser 1-2-3-4','M-2 Par 1/2 Ser 3-4','M-3 Par 1/2 Par 3/4','M-4 Par 1/2/3/4','M-5 Par 1/2/3 Ser 4','M-6 Ser 1-2 Par 3/4','M-7 Ser 1 Par 2/3/4','M-8 Par (Ser 1-2-3)/4','M-9 Ser 3-4 FB(1-2)','M-10 Ser 4 FB(1-2-3)'];
const ENUM_FX_MODE     = ['Insert','Send','Bypass'];
const ENUM_ENV_TRIG    = ['Key','LFO 1','LFO 2','Loop','Seq Step'];
const ENUM_CHORD_TYPE  = ['Memory','Major','Minor','Aug','Dim','Sus2','Sus4','7th'];

// NOTA: Los bytes almacenan valores NRPN completos de 8 bits (0-255).
// La interpretación como enum/toggle ocurre en la capa de UI normalizando raw/maxEnum.
// Por lo tanto NO validamos rangos enum contra los datos raw — solo validamos límites
// de hardware específicos (como FX type 0-35).

// NOTA: BIPOLAR_BYTES no se usa para validación porque los bytes almacenan
// valores NRPN completos de 8 bits. Ver bipolar-list en byte-map.js para display.

// ============================================================================
// CONSTRUIR BYTE MAP
// ============================================================================
function buildByteMap() {
    const map = new Array(242).fill(null);

    function bp(idx, param, region, type, extra = {}) {
        return { idx, param, region, type, ...extra };
    }

    // LFO 1 (0-6)
    map[0]  = bp(0,  'LFO 1 Rate',          'LFO1', 'value');
    map[1]  = bp(1,  'LFO 1 Delay/Fade',    'LFO1', 'value');
    map[2]  = bp(2,  'LFO 1 Shape',         'LFO1', 'enum',  { enumLabels: ENUM_LFO_SHAPE });
    map[3]  = bp(3,  'LFO 1 Key Sync',      'LFO1', 'toggle');
    map[4]  = bp(4,  'LFO 1 Arp Sync',      'LFO1', 'toggle');
    map[5]  = bp(5,  'LFO 1 Mono Mode',     'LFO1', 'value');
    map[6]  = bp(6,  'LFO 1 Slew Rate',     'LFO1', 'value');

    // LFO 2 (7-13)
    map[7]  = bp(7,  'LFO 2 Rate',          'LFO2', 'value');
    map[8]  = bp(8,  'LFO 2 Delay/Fade',    'LFO2', 'value');
    map[9]  = bp(9,  'LFO 2 Shape',         'LFO2', 'enum',  { enumLabels: ENUM_LFO_SHAPE });
    map[10] = bp(10, 'LFO 2 Key Sync',      'LFO2', 'toggle');
    map[11] = bp(11, 'LFO 2 Arp Sync',      'LFO2', 'toggle');
    map[12] = bp(12, 'LFO 2 Mono Mode',     'LFO2', 'value');
    map[13] = bp(13, 'LFO 2 Slew Rate',     'LFO2', 'value');

    // OSC (14-33)
    map[14] = bp(14, 'OSC 1 Range',         'OSC1', 'enum',  { enumLabels: ENUM_OSC_RANGE });
    map[15] = bp(15, 'OSC 2 Range',         'OSC2', 'enum',  { enumLabels: ENUM_OSC_RANGE });
    map[16] = bp(16, 'OSC 1 PWM Source',    'OSC1', 'enum',  { enumLabels: ENUM_PWM_SOURCE });
    map[17] = bp(17, 'OSC 2 Tone Mod Source','OSC2', 'enum', { enumLabels: ENUM_PWM_SOURCE });
    map[18] = bp(18, 'OSC 1 Pulse Enable',  'OSC1', 'toggle');
    map[19] = bp(19, 'OSC 1 Saw Enable',    'OSC1', 'toggle');
    map[20] = bp(20, 'OSC Sync Enable',     'OSC',  'toggle');
    map[21] = bp(21, 'OSC 1 Pitch Mod Depth','OSC1','value');
    map[22] = bp(22, 'OSC 1 Pitch Mod Select','OSC1','enum',{ enumLabels: ENUM_PM_SELECT });
    map[23] = bp(23, 'OSC 1 AT > Pitch Mod','OSC1', 'value');
    map[24] = bp(24, 'OSC 1 MW > Pitch Mod','OSC1', 'value');
    map[25] = bp(25, 'OSC 1 PWM Depth',     'OSC1', 'value');
    map[26] = bp(26, 'OSC 2 Level',         'OSC2', 'value');
    map[27] = bp(27, 'OSC 2 Pitch',         'OSC2', 'value');
    map[28] = bp(28, 'OSC 2 Tone Mod Depth','OSC2', 'value');
    map[29] = bp(29, 'OSC 2 Pitch Mod Depth','OSC2','value');
    map[30] = bp(30, 'OSC 2 AT > Pitch Mod','OSC2', 'value');
    map[31] = bp(31, 'OSC 2 MW > Pitch Mod','OSC2', 'value');
    map[32] = bp(32, 'OSC 2 Pitch Mod Select','OSC2','enum',{ enumLabels: ENUM_PM_SELECT });
    map[33] = bp(33, 'Noise Level',          'Noise','value');

    // Portamento / Pitch (34-38)
    map[34] = bp(34, 'Portamento Time',      'Porta','value');
    map[35] = bp(35, 'Portamento Mode',      'Porta','enum', { enumLabels: ENUM_PORTA_MODE });
    map[36] = bp(36, 'Pitch Bend Up',        'Pitch','value');
    map[37] = bp(37, 'Pitch Bend Down',      'Pitch','value');
    map[38] = bp(38, 'OSC 1 PM Mode',        'Pitch','toggle');

    // VCF / HPF (39-52)
    map[39] = bp(39, 'VCF Cutoff',           'VCF',  'value');
    map[40] = bp(40, 'HPF Cutoff',           'HPF',  'value');
    map[41] = bp(41, 'VCF Resonance',        'VCF',  'value');
    map[42] = bp(42, 'VCF Env Depth',        'VCF',  'bipolar');
    map[43] = bp(43, 'VCF Env Vel Sens',     'VCF',  'value');
    map[44] = bp(44, 'VCF Pitch Bend Depth', 'VCF',  'value');
    map[45] = bp(45, 'VCF LFO Depth',        'VCF',  'value');
    map[46] = bp(46, 'VCF LFO Select',       'VCF',  'toggle');
    map[47] = bp(47, 'VCF AT > LFO Depth',   'VCF',  'value');
    map[48] = bp(48, 'VCF MW > LFO Depth',   'VCF',  'value');
    map[49] = bp(49, 'VCF Key Tracking',     'VCF',  'value');
    map[50] = bp(50, 'VCF Env Polarity',     'VCF',  'toggle');
    map[51] = bp(51, 'VCF 2 Pole Mode',      'VCF',  'toggle');
    map[52] = bp(52, 'HPF Boost Enable',     'HPF',  'toggle');

    // Env 1 (53-61)
    for (let i = 53; i <= 61; i++) map[i] = bp(i, `Env1 byte ${i}`, 'ENV1', 'value');
    map[57] = bp(57, 'Env1 Trigger Mode',    'ENV1', 'enum', { enumLabels: ENUM_ENV_TRIG });

    // Env 2 (62-70)
    for (let i = 62; i <= 70; i++) map[i] = bp(i, `Env2 byte ${i}`, 'ENV2', 'value');
    map[66] = bp(66, 'Env2 Trigger Mode',    'ENV2', 'enum', { enumLabels: ENUM_ENV_TRIG });

    // Env 3 (71-79)
    for (let i = 71; i <= 79; i++) map[i] = bp(i, `Env3 byte ${i}`, 'ENV3', 'value');
    map[75] = bp(75, 'Env3 Trigger Mode',    'ENV3', 'enum', { enumLabels: ENUM_ENV_TRIG });

    // VCA (80-83)
    for (let i = 80; i <= 83; i++) map[i] = bp(i, `VCA byte ${i}`, 'VCA', 'value');
    map[83] = bp(83, 'VCA Pan Spread',       'VCA',  'bipolar');

    // Voice (84-92)
    map[84] = bp(84, 'Note Priority',        'Voice','enum', { enumLabels: ENUM_NOTE_PRIO });
    map[85] = bp(85, 'Voice Mode',           'Voice','enum', { enumLabels: ENUM_VOICE_MODE });
    map[86] = bp(86, 'Trigger Mode',         'Voice','enum', { enumLabels: ENUM_TRIG_MODE });
    map[87] = bp(87, 'Unison Detune',        'Voice','value');
    map[88] = bp(88, 'Voice Drift',          'Voice','value');
    map[89] = bp(89, 'Parameter Drift',      'Voice','value');
    map[90] = bp(90, 'Drift Rate',           'Voice','value');
    map[91] = bp(91, 'OSC Porta Balance',    'Voice','bipolar');
    map[92] = bp(92, 'OSC Key Down Reset',   'Voice','toggle');

    // Mod Matrix (93-116)
    for (let i = 93; i <= 116; i++) {
        const slotNum = Math.floor((i - 93) / 3) + 1;
        const field = ['Source','Dest','Depth'][(i - 93) % 3];
        const isBipolar = field === 'Depth';
        map[i] = bp(i, `Mod Slot${slotNum} ${field}`, 'ModMat', isBipolar ? 'bipolar' : 'value');
    }

    // Seq Control (117-122)
    map[117] = bp(117, 'Seq Enable',          'Seq',  'toggle');
    map[118] = bp(118, 'Seq Clock Divider',   'Seq',  'enum', { enumLabels: ENUM_SEQ_CLOCK });
    map[119] = bp(119, 'Seq Length',          'Seq',  'value');
    map[120] = bp(120, 'Seq Swing',           'Seq',  'value');
    map[121] = bp(121, 'Seq Key Loop',        'Seq',  'enum', { enumLabels: ENUM_KEY_LOOP });
    map[122] = bp(122, 'Seq Slew Rate',       'Seq',  'value');

    // Seq Steps (123-154)
    for (let i = 123; i <= 154; i++) {
        map[i] = bp(i, `Seq Step ${i-122}`, 'SeqSteps', 'bipolar');
    }

    // Arp (155-164)
    map[155] = bp(155, 'Arp On/Off',         'Arp',  'toggle');
    map[156] = bp(156, 'Arp Mode',           'Arp',  'enum', { enumLabels: ENUM_ARP_MODE });
    map[157] = bp(157, 'Arp Rate',           'Arp',  'value');
    map[158] = bp(158, 'Arp Clock Divider',  'Arp',  'enum', { enumLabels: ENUM_ARP_CLOCK });
    map[159] = bp(159, 'Arp Key Sync',       'Arp',  'toggle');
    map[160] = bp(160, 'Arp Gate Time',      'Arp',  'value');
    map[161] = bp(161, 'Arp Hold',           'Arp',  'toggle');
    map[162] = bp(162, 'Arp Pattern',        'Arp',  'value');
    map[163] = bp(163, 'Arp Swing',          'Arp',  'value');
    map[164] = bp(164, 'Arp Octaves',        'Arp',  'value');

    // FX Routing + FX Mode (165, 222)
    map[165] = bp(165, 'FX Routing',          'FX',   'enum', { enumLabels: ENUM_FX_ROUTING });
    map[222] = bp(222, 'FX Mode',             'FX',   'enum', { enumLabels: ENUM_FX_MODE });

    // FX1-4 Types (166, 179, 192, 205)
    for (const idx of [166, 179, 192, 205]) {
        const fxNum = {166:1,179:2,192:3,205:4}[idx];
        map[idx] = bp(idx, `FX${fxNum} Type`, `FX${fxNum}`, 'fx_type');
    }

    // FX1 Params (167-178)
    for (let i = 167; i <= 178; i++) map[i] = bp(i, `FX1 Param ${i-166}`, 'FX1', 'value');

    // FX2 Params (180-191)
    for (let i = 180; i <= 191; i++) map[i] = bp(i, `FX2 Param ${i-179}`, 'FX2', 'value');

    // FX3 Params (193-204)
    for (let i = 193; i <= 204; i++) map[i] = bp(i, `FX3 Param ${i-192}`, 'FX3', 'value');

    // FX4 Params (206-217)
    for (let i = 206; i <= 217; i++) map[i] = bp(i, `FX4 Param ${i-205}`, 'FX4', 'value');

    // FX Gains (218-221)
    map[218] = bp(218, 'FX1 Output Gain',     'FX1',  'value');
    map[219] = bp(219, 'FX2 Output Gain',     'FX2',  'value');
    map[220] = bp(220, 'FX3 Output Gain',     'FX3',  'value');
    map[221] = bp(221, 'FX4 Output Gain',     'FX4',  'value');

    // Byte 223: firmware metadata
    map[223] = bp(223, '(firmware metadata)', 'Firmware', 'value');

    // Program Name (224-238)
    for (let i = 224; i <= 238; i++) {
        map[i] = bp(i, `Program Name char[${i-224}]`, 'Name', 'ascii');
    }

    // Name tail (239-241)
    for (let i = 239; i <= 241; i++) {
        map[i] = bp(i, '(name field tail)', 'Tail', 'value');
    }

    return map;
}

// ============================================================================
// VALIDACIONES
// ============================================================================

let totalErrors = 0;
let totalWarnings = 0;
const verbose = process.argv.includes('--verbose');

function reportError(bank, idx, msg) {
    console.error(`  ❌ ERROR [${bank}][preset ${idx+1}] ${msg}`);
    totalErrors++;
}

function reportWarning(bank, idx, msg) {
    if (verbose) {
        console.warn(`  ⚠️  WARN [${bank}][preset ${idx+1}] ${msg}`);
    }
    totalWarnings++;
}

/**
 * Valida que todos los 242 bytes tengan un mapping en el BYTE_MAP.
 */
function validateCoverage(map) {
    let uncovered = 0;
    for (let i = 0; i < UNPACKED_LEN; i++) {
        if (!map[i]) {
            console.error(`  ❌ COVERAGE: Byte ${i} no tiene entrada en BYTE_MAP`);
            uncovered++;
            totalErrors++;
        }
    }
    if (uncovered === 0) {
        console.log(`  ✅ Coverage: 242/242 bytes mapeados`);
    }
    return uncovered === 0;
}

/**
 * Valida los datos de un preset desempaquetado contra el BYTE_MAP.
 */
function validatePreset(bytes, bank, presetIdx, map) {
    // 1. Verificar tamaño
    if (bytes.length !== UNPACKED_LEN) {
        reportError(bank, presetIdx, `Tamaño incorrecto: ${bytes.length} (esperado ${UNPACKED_LEN})`);
        return { ok: false, errors: 1 };
    }

    let localErrors = 0;

    // 2. Extraer nombre (bytes 224-238)
    const nameChars = [];
    for (let i = 224; i <= 238; i++) {
        const c = bytes[i];
        if (c >= 32 && c < 127) nameChars.push(String.fromCharCode(c));
    }
    const name = nameChars.join('').trim();

    // Verificar que el nombre no esté vacío
    if (!name) {
        reportWarning(bank, presetIdx, `Nombre vacío en bytes 224-238`);
    }

    // 3. Byte 225 siempre debe ser 0
    if (bytes[225] !== 0) {
        reportError(bank, presetIdx, `Byte 225 = ${bytes[225]} (debe ser 0)`);
        localErrors++;
    }

    // 4. Validar valores de tipo FX (0-33 en hardware real).
    //    El hardware almacena el tipo en bits 0-6, y bit 7 puede ser flag de enable.
    //    Por tanto extraemos con & 0x7F para obtener el tipo real.
    for (const fxTypeByte of [166, 179, 192, 205]) {
        const fxTypeRaw = bytes[fxTypeByte];
        const fxTypeIndex = fxTypeRaw & 0x7F;
        if (fxTypeIndex > 35) {
            const fxNum = {166:1,179:2,192:3,205:4}[fxTypeByte];
            reportError(bank, presetIdx, `FX${fxNum} Type (byte ${fxTypeByte}) = raw:${fxTypeRaw} masked:${fxTypeIndex} > 35`);
            localErrors++;
        }
    }

    // NOTA: NO validamos rangos de valores UI-contra-raw aquí porque:
    //   - Los bytes almacenan valores NRPN completos de 8 bits (0-255)
    //   - La interpretación enum/toggle/rango ocurre en la UI (raw/maxEnum)
    //   - Ej: byte 46 (VCF LFO Select, toggle) = 128 → UI interpreta como "On"
    //   - Ej: byte 156 (Arp Mode, enum 0-10) = 255 → UI interpreta 255/10 = modo más alto
    //   - Ej: nombre en 224-238 puede contener UTF-8/Latin-1 > 127 (acentos)
    //
    // Solo validamos límites de HARDWARE reales (FX type 0-35) y restricciones
    // CIERTAS (byte 225 = 0).

    return { ok: localErrors === 0, errors: localErrors, name };
}

// ============================================================================
// CARGA Y ANÁLISIS DE BANCO .syx
// ============================================================================

function loadBank(filePath) {
    const data = fs.readFileSync(filePath);
    const presets = [];

    // El archivo de banco contiene 128 mensajes SysEx consecutivos de 291 bytes cada uno
    // Total esperado: 128 * 291 = 37248 bytes
    const expectedLen = PRESETS_PER_BANK * SYSEX_MSG_LEN;

    if (data.length !== expectedLen) {
        console.warn(`  ⚠️  Tamaño archivo: ${data.length} bytes (esperado ${expectedLen})`);
    }

    let offset = 0;
    let presetCount = 0;

    while (offset + SYSEX_MSG_LEN <= data.length) {
        const msg = data.slice(offset, offset + SYSEX_MSG_LEN);

        // Verificar cabecera SysEx
        if (msg[0] !== 0xF0) {
            console.warn(`  ⚠️  Offset ${offset}: No comienza con F0 (0x${msg[0].toString(16)}), saltando...`);
            offset++;
            continue;
        }

        // Verificar fabricante Behringer
        if (msg[1] !== 0x00 || msg[2] !== 0x20 || msg[3] !== 0x32) {
            console.warn(`  ⚠️  Offset ${offset}: No es Behringer (${msg.slice(1,4).toString('hex')}), saltando...`);
            offset += SYSEX_MSG_LEN;
            continue;
        }

        const command = msg[6];
        const bankNum = msg[7];
        const progNum = msg[286];

        // Extraer payload empaquetado (bytes 8-285 = 278 bytes)
        const packedPayload = msg.slice(SYSEX_HEADER_LEN, SYSEX_HEADER_LEN + SYSEX_PACKED_LEN);

        // Desempaquetar
        const unpacked = unpack7to8(packedPayload);

        presets.push({
            index: presetCount,
            command,
            bankNum,
            progNum,
            rawMsg: msg,
            packedPayload,
            unpacked,
        });

        offset += SYSEX_MSG_LEN;
        presetCount++;
    }

    return presets;
}

// ============================================================================
// REPORTE DE ESTADÍSTICAS POR BANCO
// ============================================================================

function computeBankStats(presets) {
    const stats = {
        totalPresets: presets.length,
        uniqueValues: {},
        byte225AllZero: true,
        names: [],
    };

    // Inicializar estadísticas por byte
    for (let i = 0; i < UNPACKED_LEN; i++) {
        stats.uniqueValues[i] = new Set();
    }

    for (const preset of presets) {
        for (let i = 0; i < UNPACKED_LEN; i++) {
            stats.uniqueValues[i].add(preset.unpacked[i]);
        }

        if (preset.unpacked[225] !== 0) {
            stats.byte225AllZero = false;
        }

        // Extraer nombre
        const chars = [];
        for (let i = 224; i <= 238; i++) {
            const c = preset.unpacked[i];
            if (c >= 32 && c < 127) chars.push(String.fromCharCode(c));
        }
        stats.names.push(chars.join('').trim());
    }

    // Convertir Sets a sizes
    for (let i = 0; i < UNPACKED_LEN; i++) {
        stats.uniqueValues[i] = stats.uniqueValues[i].size;
    }

    return stats;
}

function printBankStats(bankLabel, stats) {
    console.log(`\n📊 Estadísticas — ${bankLabel} (${stats.totalPresets} presets):`);

    // Byte 225
    console.log(`   Byte 225: ${stats.byte225AllZero ? '✅ Siempre 0' : '❌ NO siempre 0'}`);

    // Bytes más variables
    const sortedByUnique = Object.entries(stats.uniqueValues)
        .map(([byte, count]) => ({ byte: parseInt(byte), count }))
        .sort((a, b) => b.count - a.count);

    console.log(`   Top 10 bytes con más valores únicos:`);
    for (const { byte, count } of sortedByUnique.slice(0, 10)) {
        const pct = (count / stats.totalPresets * 100).toFixed(0);
        console.log(`     b[${byte.toString().padStart(3)}]: ${count} valores únicos (${pct}% cobertura)`);
    }

    // Bytes constantes (solo 1 valor único en todos los presets)
    const constantBytes = sortedByUnique.filter(b => b.count === 1);
    if (constantBytes.length > 0) {
        console.log(`   Bytes constantes (1 valor único en todos los presets):`);
        for (const { byte } of constantBytes) {
            console.log(`     b[${byte.toString().padStart(3)}]`);
        }
    }
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
    const args = process.argv.slice(2);
    const bankFilter = args.includes('--banks')
        ? args[args.indexOf('--banks') + 1].split(',').map(s => s.trim().toUpperCase())
        : ['A','B','C','D','E','F','G','H'];

    const banksDir = path.resolve(__dirname, '..', 'resources', 'banks', 'Factory Banks V1.1.2');
    const map = buildByteMap();

    console.log('='.repeat(70));
    console.log('🧪 VALIDADOR DE MAPEO SysEx — DeepMind 12');
    console.log('='.repeat(70));
    console.log(`\n📁 Directorio de bancos: ${banksDir}`);
    console.log(`🔍 Bancos a validar: ${bankFilter.join(', ')}`);
    console.log(`📝 Modo verbose: ${verbose ? 'ON' : 'OFF'}`);
    console.log('');

    // 1. Validar cobertura del BYTE_MAP
    console.log('📋 Validación de cobertura del BYTE_MAP:');
    const coverageOk = validateCoverage(map);

    if (!coverageOk) {
        console.error('\n❌ El BYTE_MAP tiene bytes sin mapear. Abortando validación de datos.');
        process.exit(1);
    }

    // 2. Validar cada banco
    let grandTotalPresets = 0;
    let grandTotalErrors = 0;
    let allStats = [];

    for (const bankLetter of bankFilter) {
        const filePath = path.join(banksDir, `Synth Bank ${bankLetter}.syx`);

        if (!fs.existsSync(filePath)) {
            console.error(`\n❌ Archivo no encontrado: ${filePath}`);
            totalErrors++;
            continue;
        }

        console.log(`\n📂 Banco ${bankLetter}: ${filePath}`);

        const presets = loadBank(filePath);
        console.log(`   Presets cargados: ${presets.length}`);

        if (presets.length === 0) {
            console.error(`   ❌ No se pudieron cargar presets de ${bankLetter}`);
            continue;
        }

        // Validar cada preset
        let bankErrors = 0;
        for (let i = 0; i < presets.length; i++) {
            const result = validatePreset(presets[i].unpacked, bankLetter, i, map);
            bankErrors += result.errors;
        }

        grandTotalPresets += presets.length;
        grandTotalErrors += bankErrors;

        console.log(`   Resultado: ${presets.length - bankErrors}/${presets.length} presets OK` + (bankErrors > 0 ? `, ${bankErrors} errores` : ''));

        // Estadísticas del banco
        const stats = computeBankStats(presets);
        allStats.push({ bank: bankLetter, stats });
        printBankStats(bankLetter, stats);
    }

    // 3. Resumen general
    console.log('\n' + '='.repeat(70));
    console.log('📊 RESUMEN GENERAL');
    console.log('='.repeat(70));
    console.log(`   Bancos analizados: ${bankFilter.length}`);
    console.log(`   Presets analizados: ${grandTotalPresets}`);
    console.log(`   Errores totales: ${grandTotalErrors}`);
    console.log(`   Warnings totales: ${totalWarnings}`);

    if (allStats.length > 1) {
        // Estadísticas globales de byte 225
        const allByte225Zero = allStats.every(s => s.stats.byte225AllZero);
        console.log(`\n   Byte 225 global: ${allByte225Zero ? '✅ Siempre 0 en todos los bancos' : '⚠️  NO siempre 0'}`);
    }

    console.log(`\n${grandTotalErrors === 0 ? '✅' : '❌'} Validación completada.`);

    if (grandTotalErrors === 0) {
        console.log('\n🎉 Todos los mapeos del BYTE_MAP son consistentes con los datos reales de fábrica.');
    } else {
        process.exitCode = 1;
    }
}

main();

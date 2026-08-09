/**
 * @purpose Bank loading logic extracted from browser_io.js.
 * Contains loadAllFactoryBanksNatively() — loads 8 factory banks (A-H),
 * user banks from localStorage, and injects the Developer Calibration bank.
 *
 * @depends browser_persistence.js (createEmptyBank, _loadUserBanksFromStorage)
 * @depends browser_io_parse.js (parseSysexText, parseSysexBytes)
 */

/**
 * Load all 8 factory banks (A-H) from JUCE native file system or HTTP fetch fallback.
 * Then load user banks from localStorage and inject the Factory Dev Calib bank.
 */
async function loadAllFactoryBanksNatively() {
    if (getBridge() && typeof getBridge().waitForReady === 'function') {
        await getBridge().waitForReady(2000);
    }
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    const loadSingleBank = async (letter) => {
        const bankName = 'Factory Bank ' + letter;
        window.loadedBanks[bankName] = window.createEmptyBank();

        let bytes = null;
        if (getBridge() && getBridge().isJuce) {
            try {
                const hexStr = await getBridge().readFactoryBankFile(letter);
                if (hexStr && typeof hexStr === 'string' && hexStr.length > 0) {
                    const cleanHex = hexStr.replace(/\s/g, '');
                    bytes = new Uint8Array(cleanHex.match(/.{1,2}/g).map(function(byte) { return parseInt(byte, 16); }));
                }
            } catch (err) {
                Logger.warn('[BankManager] Error cargando banco nativo ' + letter + ', intentando fetch...', err);
            }
        }

        if (!bytes) {
            try {
                const response = await fetch('./resources/Banks/Factory%20Banks%20V1.1.2/Synth%20Bank%20' + letter + '.syx');
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    bytes = new Uint8Array(arrayBuffer);
                }
            } catch (err) {
                Logger.error('[BankManager] Error en fetch de banco de fabrica ' + letter, err);
            }
        }

        if (bytes && bytes.length >= 291) {
            const patchSize = 291;
            const numPatches = Math.floor(bytes.length / patchSize);
            for (let i = 0; i < Math.min(128, numPatches); i++) {
                const offset = i * patchSize;
                const packedPayload = bytes.slice(offset + 10, offset + 288);
                const unpackedBytes = window.unpack7to8(packedPayload);

                const patchName = window.extractNameFromRawSysex(bytes, offset) || ('Factory Patch ' + (i + 1));
                window.loadedBanks[bankName][i] = {
                    index: i,
                    name: patchName,
                    unpackedBytes: unpackedBytes,
                    meta: window.createDefaultMeta()
                };
            }
        } else {
            Logger.error('[BankManager] Error: No hay bytes de datos válidos para el banco ' + bankName + '. Total bytes:', bytes ? bytes.length : 0);
        }
    };

    // 1. Cargar Banco A inmediatamente para mostrar la interfaz sin retardo
    await loadSingleBank('A');
    if (typeof window.updateLocalBanksDropdown === 'function') {
        window.updateLocalBanksDropdown();
    }

    // 2. Cargar Bancos B-H en paralelo en segundo plano
    Promise.all(letters.slice(1).map(loadSingleBank)).then(() => {
        if (typeof window.updateLocalBanksDropdown === 'function') {
            window.updateLocalBanksDropdown();
        }
    });

    const userBanksLoaded = window._loadUserBanksFromStorage();
    if (!userBanksLoaded) {
        window.loadedBanks['User Bank 1'] = window.createEmptyBank();
    }

    // ── Inject Developer Calibration Bank ──
    const calibBankName = 'Factory Dev Calib';
    window.loadedBanks[calibBankName] = window.createEmptyBank();

    const createCalibTemplate = function(name) {
        const b = new Uint8Array(242);
        const paddedName = name.padEnd(16, ' ');
        for (let ci = 0; ci < 16; ci++) {
            b[ci] = paddedName.charCodeAt(ci);
        }
        b[14] = 1;   // osc1_range = 8'
        b[19] = 1;   // osc1_saw_enable = true
        b[39] = 255; // vcf_cutoff = 100% open
        b[53] = 1;   // env1_attack = flat/immediate
        b[54] = 255; // env1_decay = max
        b[55] = 255; // env1_sustain = 100%
        b[56] = 20;  // env1_release = short natural
        b[62] = 1;   // env2_attack = flat
        b[63] = 255; // env2_decay = max
        b[64] = 255; // env2_sustain = 100%
        b[65] = 20;  // env2_release = short natural
        b[80] = 204; // vca_level = 80%
        return b;
    };

    const calibPresets = [
        { name: 'CALIB_OSC1_SAW',   setup: function(b) {} },
        { name: 'CALIB_OSC1_SQR',   setup: function(b) { b[19] = 0; b[18] = 1; } },
        { name: 'CALIB_OSC2_SQR',   setup: function(b) { b[19] = 0; b[26] = 255; b[28] = 128; } },
        { name: 'CALIB_OSC_DUAL',   setup: function(b) { b[19] = 1; b[26] = 192; } },
        { name: 'CALIB_OSC_SYNC',   setup: function(b) { b[19] = 1; b[26] = 192; b[20] = 1; } },
        { name: 'CALIB_LPF_25',     setup: function(b) { b[39] = 64; } },
        { name: 'CALIB_LPF_RES',    setup: function(b) { b[39] = 128; b[41] = 179; } },
        { name: 'CALIB_HPF_50',     setup: function(b) { b[40] = 128; } },
        { name: 'CALIB_HPF_BOOST',  setup: function(b) { b[40] = 0; b[52] = 1; } },
        { name: 'CALIB_ENV_AMP',    setup: function(b) { b[53] = 10; b[54] = 128; b[55] = 76; b[56] = 128; } },
        { name: 'CALIB_ENV_FLT',    setup: function(b) { b[39] = 64; b[42] = 128; b[62] = 10; b[63] = 180; b[64] = 0; b[65] = 128; } },
        { name: 'CALIB_VCA_BALLS',  setup: function(b) { b[80] = 255; } }
    ];

    for (let pi = 0; pi < 128; pi++) {
let presetBytes;
let presetName;
        if (pi < calibPresets.length) {
            presetName = calibPresets[pi].name;
            presetBytes = createCalibTemplate(presetName);
            calibPresets[pi].setup(presetBytes);
        } else {
            presetName = 'Init Patch ' + (pi + 1);
            presetBytes = createCalibTemplate(presetName);
            presetBytes[19] = 0;
        }
        window.loadedBanks[calibBankName][pi] = {
            index: pi,
            name: presetName,
            unpackedBytes: presetBytes,
            meta: window.createDefaultMeta()
        };
    }

    window.currentActiveBank = 'Factory Bank A';
    window.currentActivePatchIndex = 0;

    if (typeof window.updateLocalBanksDropdown === 'function') { window.updateLocalBanksDropdown(); }
    if (typeof window.renderPatchesForBank === 'function') { window.renderPatchesForBank(window.currentActiveBank); }
    if (typeof window.renderHardwarePatches === 'function') { window.renderHardwarePatches(); }

    const initialPatch = window.loadedBanks['Factory Bank A'] && window.loadedBanks['Factory Bank A'][0];
    if (initialPatch) {
        const lcdText = document.getElementById('lcd-text');
        if (lcdText) { lcdText.innerText = initialPatch.name.toUpperCase(); }
        if (getBridge() && typeof getBridge().waitForReady === 'function') {
            await getBridge().waitForReady(10000);
        }
        if (initialPatch.unpackedBytes) {
            setTimeout(function() {
                window.triggerMidiDump(initialPatch);
            }, 500);
        }
    }
}

window.loadAllFactoryBanksNatively = loadAllFactoryBanksNatively;

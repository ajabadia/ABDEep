// --- ABDEEP PRESET & BANK MANAGER DUAL-CONTAINER LOGIC ---
// Este archivo gestiona la persistencia, creación, renombrado y borrado de bancos dinámicos de presets de 128 slots.
// Ofrece dos paneles: Izquierdo (Hardware Device, Bank A-H) y Derecho (Librería Local).
// Permite copiar y arrastrar/intercambiar presets entre ambos entornos.

// Estructura de almacenamiento dinámico de bancos
let loadedBanks = {};
window.loadedBanks = loadedBanks;
let currentActiveBank = 'Factory Bank A';
window.currentActiveBank = currentActiveBank;
let currentActivePatchIndex = 0;
window.currentActivePatchIndex = currentActivePatchIndex;

let hardwareBanks = {
    'A': createEmptyBank(),
    'B': createEmptyBank(),
    'C': createEmptyBank(),
    'D': createEmptyBank(),
    'E': createEmptyBank(),
    'F': createEmptyBank(),
    'G': createEmptyBank(),
    'H': createEmptyBank()
};
window.hardwareBanks = hardwareBanks;

let currentHwBankLetter = 'A';
window.currentHwBankLetter = currentHwBankLetter;
let currentHwPatchIndex = -1;
window.currentHwPatchIndex = currentHwPatchIndex;

const FACTORY_BANKS_LIST = [
    'Factory Bank A', 'Factory Bank B', 'Factory Bank C', 'Factory Bank D',
    'Factory Bank E', 'Factory Bank F', 'Factory Bank G', 'Factory Bank H'
];

document.addEventListener('DOMContentLoaded', () => {
    initBankManager();
});

// --- UTILIDADES DE EMPAQUETADO 7-BIT A 8-BIT DE DEEPMIND ---
function unpack7to8(packedBytes) {
    const unpacked = new Uint8Array(242);
    let writeIdx = 0;
    for (let i = 0; i < packedBytes.length; i += 8) {
        const msbFlags = packedBytes[i];
        for (let k = 1; k < 8; k++) {
            if (i + k >= packedBytes.length) break;
            if (writeIdx >= 242) break;
            let val = packedBytes[i + k];
            if (msbFlags & (1 << (k - 1))) {
                val |= 0x80;
            }
            unpacked[writeIdx++] = val;
        }
    }
    return unpacked;
}
window.unpack7to8 = unpack7to8;

function pack8to7(unpackedBytes) {
    const packed = new Uint8Array(278);
    let readIdx = 0;
    let writeIdx = 0;
    while (readIdx < 242 && writeIdx < 278) {
        let msbFlags = 0;
        const startWriteIdx = writeIdx;
        writeIdx++;
        for (let k = 1; k < 8; k++) {
            if (readIdx >= 242) break;
            let val = unpackedBytes[readIdx++];
            if (val & 0x80) {
                msbFlags |= (1 << (k - 1));
                val &= 0x7F;
            }
            packed[startWriteIdx + k] = val;
            writeIdx++;
        }
        packed[startWriteIdx] = msbFlags;
    }
    return packed;
}

function createEmptyBank() {
    let list = [];
    for (let i = 0; i < 128; i++) {
        const defaultUnpacked = new Uint8Array(242);
        const nameStr = `INIT PATCH ${i+1}`;
        for (let k = 0; k < 16; k++) {
            defaultUnpacked[226 + k] = k < nameStr.length ? nameStr.charCodeAt(k) : 0x20;
        }
        defaultUnpacked[39] = 255;
        defaultUnpacked[80] = 0;
        defaultUnpacked[81] = 128;
        defaultUnpacked[82] = 255;
        defaultUnpacked[83] = 64;
        list.push({
            index: i,
            name: nameStr,
            unpackedBytes: defaultUnpacked
        });
    }
    return list;
}

async function loadAllFactoryBanksNatively() {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    for (const letter of letters) {
        const bankName = `Factory Bank ${letter}`;
        loadedBanks[bankName] = createEmptyBank();
        
        let bytes = null;
        if (window.juce && typeof window.juce.readFactoryBankFile === 'function') {
            try {
                const hexStr = await new Promise((resolve) => {
                    window.juce.readFactoryBankFile([letter], (res) => resolve(res));
                });
                if (hexStr && hexStr.length > 0) {
                    bytes = new Uint8Array(hexStr.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
                }
            } catch (err) {
                console.error("Error cargando banco nativo " + letter, err);
            }
        } else {
            try {
                const response = await fetch(`./resources/Banks/Factory%20Banks%20V1.1.2/Synth%20Bank%20${letter}.syx`);
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    bytes = new Uint8Array(arrayBuffer);
                }
            } catch (err) {
                console.error("Error en fetch de banco de fabrica " + letter, err);
            }
        }

        if (bytes && bytes.length > 0) {
            const patchSize = 291;
            const numPatches = Math.floor(bytes.length / patchSize);
            for (let i = 0; i < Math.min(128, numPatches); i++) {
                const offset = i * patchSize;
                const packedPayload = bytes.slice(offset + 8, offset + 286);
                const unpackedBytes = unpack7to8(packedPayload);
                let nameChars = [];
                for (let j = 265; j <= 281; j++) {
                    const b = bytes[offset + j];
                    if (b > 0) nameChars.push(String.fromCharCode(b));
                }
                const patchName = nameChars.join('').trim() || `Factory Patch ${i+1}`;
                loadedBanks[bankName][i] = {
                    index: i,
                    name: patchName,
                    unpackedBytes: unpackedBytes
                };
            }
        }
    }
    
    loadedBanks['User Bank 1'] = createEmptyBank();
    
    // Asignar primer banco y slot de fábrica como activos por defecto al arrancar
    currentActiveBank = 'Factory Bank A';
    window.currentActiveBank = 'Factory Bank A';
    currentActivePatchIndex = 0;
    window.currentActivePatchIndex = 0;

    // Rellenar select de bancos locales
    updateLocalBanksDropdown();
    renderPatchesForBank(currentActiveBank);
    renderHardwarePatches();

    // Lanzar primer patch de fábrica al cargador por defecto
    const initialPatch = loadedBanks['Factory Bank A'][0];
    if (initialPatch && initialPatch.unpackedBytes) {
        triggerMidiDump(initialPatch);
    }
}

function updateLocalBanksDropdown() {
    const select = document.getElementById('local-bank-select');
    if (!select) return;
    select.innerHTML = '';
    Object.keys(loadedBanks).forEach(bankName => {
        const opt = document.createElement('option');
        opt.value = bankName;
        opt.innerText = bankName;
        if (bankName === currentActiveBank) opt.selected = true;
        select.appendChild(opt);
    });
}

function renderHardwarePatches() {
    const grid = document.getElementById('hw-patches-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const patches = hardwareBanks[currentHwBankLetter] || [];
    for (let i = 0; i < 128; i++) {
        const patch = patches[i] || { name: `[Empty Slot ${i+1}]`, unpackedBytes: null };
        const el = document.createElement('div');
        el.className = 'patch-item';
        el.draggable = true;
        if (i === currentHwPatchIndex) el.classList.add('active');
        el.innerText = `${currentHwBankLetter}-${(i+1).toString().padStart(3, '0')}: ${patch.name}`;

        // Eventos Drag and Drop
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'hw', bank: currentHwBankLetter, index: i }));
        });

        el.addEventListener('dragover', (e) => e.preventDefault());
        el.addEventListener('drop', (e) => {
            e.preventDefault();
            const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
            swapPresets(dragData, { source: 'hw', bank: currentHwBankLetter, index: i });
        });

        el.addEventListener('click', () => {
            currentHwPatchIndex = i;
            window.currentHwPatchIndex = i;
            document.querySelectorAll('#hw-patches-grid .patch-item').forEach(p => p.classList.remove('active'));
            el.classList.add('active');
        });

        grid.appendChild(el);
    }
}
window.renderHardwarePatches = renderHardwarePatches;

function renderPatchesForBank(bankName) {
    const grid = document.getElementById('browser-patches-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const patches = loadedBanks[bankName] || [];
    for (let i = 0; i < 128; i++) {
        const patch = patches[i] || { name: `[Empty Slot ${i+1}]`, unpackedBytes: null };
        const el = document.createElement('div');
        el.className = 'patch-item';
        el.draggable = true;
        if (i === currentActivePatchIndex && bankName === currentActiveBank) el.classList.add('active');
        el.innerText = `${(i+1).toString().padStart(3, '0')}: ${patch.name}`;

        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'local', bank: bankName, index: i }));
        });

        el.addEventListener('dragover', (e) => e.preventDefault());
        el.addEventListener('drop', (e) => {
            e.preventDefault();
            if (FACTORY_BANKS_LIST.includes(bankName)) {
                alert("No está permitido modificar bancos de fábrica.");
                return;
            }
            const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
            swapPresets(dragData, { source: 'local', bank: bankName, index: i });
        });

        el.addEventListener('click', () => {
            currentActivePatchIndex = i;
            window.currentActivePatchIndex = i;
            document.querySelectorAll('#browser-patches-grid .patch-item').forEach(p => p.classList.remove('active'));
            el.classList.add('active');
        });

        el.addEventListener('dblclick', () => {
            if (FACTORY_BANKS_LIST.includes(bankName)) {
                alert("No está permitido modificar presets de fábrica.");
                return;
            }
            const newName = prompt("Escribe el nuevo nombre del preset:", patch.name);
            if (newName && newName.trim() !== "") {
                patch.name = newName.trim();
                for (let k = 0; k < 16; k++) {
                    patch.unpackedBytes[226 + k] = k < patch.name.length ? patch.name.charCodeAt(k) : 0x20;
                }
                el.innerText = `${(i+1).toString().padStart(3, '0')}: ${patch.name}`;
            }
        });

        grid.appendChild(el);
    }
}

function swapPresets(src, dest) {
    let srcPatch, destPatch;
    
    if (src.source === 'hw') {
        srcPatch = hardwareBanks[src.bank][src.index];
    } else {
        srcPatch = loadedBanks[src.bank][src.index];
    }

    if (dest.source === 'hw') {
        destPatch = hardwareBanks[dest.bank][dest.index];
    } else {
        destPatch = loadedBanks[dest.bank][dest.index];
    }

    // Copiar contenidos
    const tempBytes = new Uint8Array(destPatch.unpackedBytes);
    const tempName = destPatch.name;

    destPatch.unpackedBytes = new Uint8Array(srcPatch.unpackedBytes);
    destPatch.name = srcPatch.name;

    srcPatch.unpackedBytes = tempBytes;
    srcPatch.name = tempName;

    renderHardwarePatches();
    renderPatchesForBank(currentActiveBank);
}

function triggerMidiDump(patch) {
    const lcdText = document.getElementById('lcd-text');
    if (lcdText) lcdText.innerText = patch.name.toUpperCase();

    const packedPayload = pack8to7(patch.unpackedBytes);
    const sysexMessage = new Uint8Array(291);
    sysexMessage[0] = 0xF0;
    sysexMessage[1] = 0x00;
    sysexMessage[2] = 0x20;
    sysexMessage[3] = 0x32;
    sysexMessage[4] = 0x20;
    sysexMessage[5] = 0x7F;
    sysexMessage[6] = 0x02;
    sysexMessage[7] = 0x07;
    sysexMessage.set(packedPayload, 8);
    sysexMessage[290] = 0xF7;

    if (window.dualMidiBridge && window.dualMidiBridge.midiOutput) {
        window.dualMidiBridge.midiOutput.send(sysexMessage);
    }

    // Map parameters to UI
    const mappings = {
        "osc1_pwm_amount": patch.unpackedBytes[25] / 255.0,
        "osc2_pitch": (patch.unpackedBytes[27] - 128) / 128.0,
        "osc2_tone_mod": patch.unpackedBytes[28] / 255.0,
        "osc2_level": patch.unpackedBytes[26] / 255.0,
        "noise_level": patch.unpackedBytes[33] / 255.0,
        "vcf_cutoff": patch.unpackedBytes[39] / 255.0,
        "vcf_resonance": patch.unpackedBytes[41] / 255.0,
        "vcf_env_depth": (patch.unpackedBytes[42] - 128) / 128.0,
        "hpf_cutoff": patch.unpackedBytes[40] / 255.0,
        
        "env1_attack": patch.unpackedBytes[53] / 255.0,
        "env1_decay": patch.unpackedBytes[54] / 255.0,
        "env1_sustain": patch.unpackedBytes[55] / 255.0,
        "env1_release": patch.unpackedBytes[56] / 255.0,
        
        "env2_attack": patch.unpackedBytes[65] / 255.0,
        "env2_decay": patch.unpackedBytes[66] / 255.0,
        "env2_sustain": patch.unpackedBytes[67] / 255.0,
        "env2_release": patch.unpackedBytes[68] / 255.0,

        "env3_attack": patch.unpackedBytes[73] / 255.0,
        "env3_decay": patch.unpackedBytes[74] / 255.0,
        "env3_sustain": patch.unpackedBytes[75] / 255.0,
        "env3_release": patch.unpackedBytes[76] / 255.0,

        "lfo1_rate": patch.unpackedBytes[0] / 255.0,
        "lfo1_delay": patch.unpackedBytes[1] / 255.0,
        "lfo2_rate": patch.unpackedBytes[7] / 255.0,
        "lfo2_delay": patch.unpackedBytes[8] / 255.0,

        "unison_detune": patch.unpackedBytes[87] / 255.0,
        "arp_rate": patch.unpackedBytes[157] / 255.0,
        "arp_gate": patch.unpackedBytes[160] / 255.0
    };

    Object.keys(mappings).forEach(paramId => {
        let val = mappings[paramId];
        val = Math.max(0, Math.min(1, val));
        if (window.dualMidiBridge) {
            window.dualMidiBridge.handleParameterChangeFromBackend(paramId, val);
        }
    });

    if (typeof window.updateLfoSlidersFromCurrentPreset === 'function') window.updateLfoSlidersFromCurrentPreset();
    if (typeof window.updateEnvSlidersFromCurrentPreset === 'function') window.updateEnvSlidersFromCurrentPreset();
    if (typeof window.updateOscSlidersFromCurrentPreset === 'function') window.updateOscSlidersFromCurrentPreset();
    if (typeof updateSysExMonitor === 'function') {
        updateSysExMonitor(patch.unpackedBytes);
    }
}
window.triggerMidiDump = triggerMidiDump;

function initBankManager() {
    loadAllFactoryBanksNatively();

    const menuBankBtn = document.getElementById('menu-bank-manager');
    const browserModal = document.getElementById('browser-modal-backdrop');
    
    const showBrowser = () => {
        if (browserModal) {
            browserModal.style.display = 'flex';
            updateLocalBanksDropdown();
            renderPatchesForBank(currentActiveBank);
            renderHardwarePatches();
        }
    };
    
    if (menuBankBtn) menuBankBtn.addEventListener('click', showBrowser);
    const progMngrBtn = document.getElementById('programmer-bank-mngr-btn');
    if (progMngrBtn) progMngrBtn.addEventListener('click', showBrowser);

    const closeBtn = document.getElementById('browser-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => browserModal.style.display = 'none');

    // Cambiar banco local
    const localSelect = document.getElementById('local-bank-select');
    if (localSelect) {
        localSelect.addEventListener('change', (e) => {
            currentActiveBank = e.target.value;
            window.currentActiveBank = currentActiveBank;
            renderPatchesForBank(currentActiveBank);
        });
    }

    // Seleccionar banco Hardware
    const hwLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    hwLetters.forEach(l => {
        const btn = document.getElementById(`hw-bank-${l}-btn`);
        if (btn) {
            btn.addEventListener('click', () => {
                currentHwBankLetter = l.toUpperCase();
                document.querySelectorAll('.manager-btn').forEach(b => {
                    if (b.id.startsWith('hw-bank-')) b.style.background = '#23252a';
                });
                btn.style.background = 'var(--brand-accent)';
                renderHardwarePatches();
            });
        }
    });

    // Acciones de Bancos Locales
    const createBankBtn = document.getElementById('mngr-create-bank');
    if (createBankBtn) {
        createBankBtn.addEventListener('click', () => {
            const name = prompt("Escribe el nombre del nuevo banco local:", `User Bank ${Object.keys(loadedBanks).length - 7}`);
            if (!name || name.trim() === "" || loadedBanks[name]) return;
            loadedBanks[name] = createEmptyBank();
            currentActiveBank = name;
            updateLocalBanksDropdown();
            renderPatchesForBank(currentActiveBank);
        });
    }

    const renameBankBtn = document.getElementById('mngr-rename-bank');
    if (renameBankBtn) {
        renameBankBtn.addEventListener('click', () => {
            if (FACTORY_BANKS_LIST.includes(currentActiveBank)) return alert("No se pueden renombrar bancos de fábrica.");
            const newName = prompt(`Escribe el nuevo nombre para "${currentActiveBank}":`, currentActiveBank);
            if (!newName || newName.trim() === "" || loadedBanks[newName]) return;
            loadedBanks[newName] = loadedBanks[currentActiveBank];
            delete loadedBanks[currentActiveBank];
            currentActiveBank = newName;
            updateLocalBanksDropdown();
            renderPatchesForBank(currentActiveBank);
        });
    }

    const deleteBankBtn = document.getElementById('mngr-delete-bank');
    if (deleteBankBtn) {
        deleteBankBtn.addEventListener('click', () => {
            if (FACTORY_BANKS_LIST.includes(currentActiveBank)) return alert("No se pueden borrar bancos de fábrica.");
            if (confirm(`¿Borrar banco local "${currentActiveBank}"?`)) {
                delete loadedBanks[currentActiveBank];
                currentActiveBank = Object.keys(loadedBanks)[0];
                updateLocalBanksDropdown();
                renderPatchesForBank(currentActiveBank);
            }
        });
    }

    // Importación SysEx
    const loadInput = document.createElement('input');
    loadInput.type = 'file';
    loadInput.accept = '.syx';
    loadInput.style.display = 'none';
    document.body.appendChild(loadInput);

    const importBtn = document.getElementById('mngr-import-sysex');
    if (importBtn) importBtn.addEventListener('click', () => loadInput.click());

    loadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const bytes = new Uint8Array(ev.target.result);
            const patchSize = 291;
            const num = Math.floor(bytes.length / patchSize);
            if (num === 0) return alert("SysEx inválido.");
            let name = file.name.replace(/\.[^/.]+$/, "");
            loadedBanks[name] = createEmptyBank();
            for (let i = 0; i < Math.min(128, num); i++) {
                const offset = i * patchSize;
                const packedPayload = bytes.slice(offset + 8, offset + 286);
                const unpackedBytes = unpack7to8(packedPayload);
                let nameChars = [];
                for (let j = 265; j <= 281; j++) {
                    const b = bytes[offset + j];
                    if (b > 0) nameChars.push(String.fromCharCode(b));
                }
                loadedBanks[name][i] = {
                    index: i,
                    name: nameChars.join('').trim() || `Patch ${i+1}`,
                    unpackedBytes: unpackedBytes
                };
            }
            currentActiveBank = name;
            updateLocalBanksDropdown();
            renderPatchesForBank(currentActiveBank);
        };
        reader.readAsArrayBuffer(file);
    });

    // Exportación SysEx
    const exportBtn = document.getElementById('mngr-export-sysex');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const patches = loadedBanks[currentActiveBank];
            const outputBytes = new Uint8Array(128 * 291);
            for (let i = 0; i < 128; i++) {
                const patch = patches[i];
                const offset = i * 291;
                outputBytes[offset] = 0xF0;
                outputBytes[offset+1] = 0x00;
                outputBytes[offset+2] = 0x20;
                outputBytes[offset+3] = 0x32;
                outputBytes[offset+4] = 0x20;
                outputBytes[offset+5] = 0x7F;
                outputBytes[offset+6] = 0x02;
                outputBytes[offset+7] = 0x07;
                
                const packed = pack8to7(patch.unpackedBytes);
                outputBytes.set(packed, offset + 8);
                outputBytes[offset+290] = 0xF7;
            }
            const blob = new Blob([outputBytes], { type: 'application/octet-stream' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${currentActiveBank}.syx`;
            link.click();
        });
    }

    // Hardware Fetch: Solicitar los 128 programas del banco seleccionado vía SysEx
    const fetchHwBtn = document.getElementById('hw-fetch-from-synth');
    if (fetchHwBtn) {
        fetchHwBtn.addEventListener('click', () => {
            if (!window.dualMidiBridge || !window.dualMidiBridge.midiOutput) {
                alert("Conexión MIDI no disponible. Asegúrate de configurar los puertos en Settings.");
                return;
            }
            
            const bankIndex = currentHwBankLetter.charCodeAt(0) - 65; // A=0, B=1, ...
            alert(`Iniciando la recuperación del banco Hardware ${currentHwBankLetter}... Esto solicitará 128 presets al sintetizador.`);
            
            // Enviar peticiones SysEx secuenciales con un delay de 30ms para no saturar el buffer midi
            for (let i = 0; i < 128; i++) {
                setTimeout(() => {
                    const req = new Uint8Array([
                        0xF0, 0x00, 0x20, 0x32, 0x20,
                        0x7F, // device ID / broadcast
                        0x01, // program request command
                        bankIndex,
                        i, // program index (0-127)
                        0xF7
                    ]);
                    window.dualMidiBridge.midiOutput.send(req);
                    
                    if (i === 127) {
                        const lcdText = document.getElementById('lcd-text');
                        if (lcdText) lcdText.innerText = "FETCH COMPLETED";
                    }
                }, i * 35);
            }
        });
    }

    // Hardware Dump: Enviar los 128 presets cargados en memoria al sintetizador
    const dumpHwBtn = document.getElementById('hw-dump-to-synth');
    if (dumpHwBtn) {
        dumpHwBtn.addEventListener('click', () => {
            if (!window.dualMidiBridge || !window.dualMidiBridge.midiOutput) {
                alert("Conexión MIDI no disponible. Asegúrate de configurar los puertos en Settings.");
                return;
            }

            const bankIndex = currentHwBankLetter.charCodeAt(0) - 65; // A=0, B=1, ...
            if (!confirm(`¿Estás seguro de que deseas sobrescribir el banco ${currentHwBankLetter} completo en el sintetizador físico?`)) {
                return;
            }

            const patches = hardwareBanks[currentHwBankLetter];
            for (let i = 0; i < 128; i++) {
                setTimeout(() => {
                    const patch = patches[i];
                    if (patch && patch.unpackedBytes) {
                        const packedPayload = pack8to7(patch.unpackedBytes);
                        const sysexMessage = new Uint8Array(291);
                        sysexMessage[0] = 0xF0;
                        sysexMessage[1] = 0x00;
                        sysexMessage[2] = 0x20;
                        sysexMessage[3] = 0x32;
                        sysexMessage[4] = 0x20;
                        sysexMessage[5] = 0x7F; // broadcast ID
                        sysexMessage[6] = 0x02; // Program dump type LSB
                        sysexMessage[7] = 0x07; // MSB
                        sysexMessage.set(packedPayload, 8);
                        
                        // Opcionalmente inyectamos la posición física del banco/programa de destino 
                        // si el firmware lo requiere en los bytes internos de cabecera:
                        // Behringer guarda el banco físico de destino en el byte 0 y programa en el byte 1 del payload desempaquetado
                        sysexMessage[290] = 0xF7;
                        
                        window.dualMidiBridge.midiOutput.send(sysexMessage);
                    }
                    if (i === 127) {
                        const lcdText = document.getElementById('lcd-text');
                        if (lcdText) lcdText.innerText = "DUMP COMPLETED";
                    }
                }, i * 40);
            }
        });
    }

    // Botones de carga a edición ("LOAD TO EDIT")
    const hwLoadBtn = document.getElementById('hw-load-btn');
    if (hwLoadBtn) {
        hwLoadBtn.addEventListener('click', () => {
            if (currentHwPatchIndex === -1) {
                alert("Selecciona primero un slot de la rejilla de Hardware.");
                return;
            }
            const patch = hardwareBanks[currentHwBankLetter][currentHwPatchIndex];
            if (patch && patch.unpackedBytes) {
                triggerMidiDump(patch);
                
                // Mostrar feedback
                const lcdText = document.getElementById('lcd-text');
                if (lcdText) lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">LOADED FROM SYNTH</span><br><strong>${patch.name.toUpperCase()}</strong>`;
                
                // Cerrar modal
                const browserModal = document.getElementById('browser-modal-backdrop');
                if (browserModal) browserModal.style.display = 'none';
            }
        });
    }

    const localLoadBtn = document.getElementById('local-load-btn');
    if (localLoadBtn) {
        localLoadBtn.addEventListener('click', () => {
            if (currentActivePatchIndex === -1) {
                alert("Selecciona primero un slot de la rejilla Local.");
                return;
            }
            const patch = loadedBanks[currentActiveBank][currentActivePatchIndex];
            if (patch && patch.unpackedBytes) {
                triggerMidiDump(patch);

                // Mostrar feedback
                const lcdText = document.getElementById('lcd-text');
                if (lcdText) lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">LOADED FROM LIBRARY</span><br><strong>${patch.name.toUpperCase()}</strong>`;

                // Cerrar modal
                const browserModal = document.getElementById('browser-modal-backdrop');
                if (browserModal) browserModal.style.display = 'none';
            }
        });
    }
}

/**
 * @purpose Enumeración y selección de puertos MIDI In/Out y Dispositivos de Salida de Audio Hardware para el modal de Ajustes.
 * Extraído de settings.js como parte de la modularización.
 */

/**
 * Populate the MIDI input/output lists in the Settings modal.
 * Reads ports from dualMidiBridge.midiAccess and renders clickable items.
 */
function populateMidiPortsLists() {
    const inputsContainer = document.getElementById('settings-midi-inputs-list');
    const outputsContainer = document.getElementById('settings-midi-outputs-list');
    if (!inputsContainer || !outputsContainer) {return;}

    inputsContainer.innerHTML = '';
    outputsContainer.innerHTML = '';

    if (getBridge() && getBridge().midiAccess) {
        const inputs = Array.from(getBridge().midiAccess.inputs.values());
        const outputs = Array.from(getBridge().midiAccess.outputs.values());

        if (inputs.length === 0) {
            inputsContainer.innerHTML = '<div class="info-msg-empty">None</div>';
        } else {
            inputs.forEach(input => {
                const isActive = getBridge().midiInput && getBridge().midiInput.id === input.id;
                const el = document.createElement('div');
                el.className = 'midi-dev-item' + (isActive ? ' active' : '');
                el.innerText = input.name;
                el.addEventListener('click', () => {
                    getBridge().midiInput = input;
                    input.onmidimessage = (msg) => getBridge().handleIncomingMidi(msg);
                    populateMidiPortsLists();
                });
                inputsContainer.appendChild(el);
            });
        }

        if (outputs.length === 0) {
            outputsContainer.innerHTML = '<div class="info-msg-empty">None</div>';
        } else {
            outputs.forEach(output => {
                const isActive = getBridge().midiOutput && getBridge().midiOutput.id === output.id;
                const el = document.createElement('div');
                el.className = 'midi-dev-item' + (isActive ? ' active' : '');
                el.innerText = output.name;
                el.addEventListener('click', () => {
                    getBridge().midiOutput = output;
                    populateMidiPortsLists();
                });
                outputsContainer.appendChild(el);
            });
        }
    } else {
        inputsContainer.innerHTML = '<div class="info-msg-empty">Web MIDI Access not available</div>';
        outputsContainer.innerHTML = '<div class="info-msg-empty">Web MIDI Access not available</div>';
    }

    populateAudioOutputDevicesList();
}

/**
 * Enumerar e integrar los dispositivos de salida de audio hardware (Soundcards / Speakers / Headphones)
 */
async function populateAudioOutputDevicesList() {
    const audioContainer = document.getElementById('settings-audio-outputs-list');
    if (!audioContainer || !window.wasmBridge) {return;}

    audioContainer.innerHTML = '<div class="info-msg-empty">Searching audio devices...</div>';
    const devices = await window.wasmBridge.getAudioOutputDevices();
    audioContainer.innerHTML = '';

    if (devices.length === 0) {
        audioContainer.innerHTML = '<div class="info-msg-empty">Default System Audio Output (Default)</div>';
        return;
    }

    const savedSinkId = localStorage.getItem('abd-eep-audio-sink-id') || 'default';

    devices.forEach(dev => {
        const isActive = dev.deviceId === savedSinkId;
        const el = document.createElement('div');
        el.className = 'midi-dev-item' + (isActive ? ' active' : '');
        el.innerText = dev.label || `Audio Output (${dev.deviceId.slice(0, 8)}...)`;
        el.addEventListener('click', async () => {
            await window.wasmBridge.setAudioOutputDevice(dev.deviceId);
            populateAudioOutputDevicesList();
        });
        audioContainer.appendChild(el);
    });
}

// Expose for backward compatibility and tests
window.populateMidiPortsLists = populateMidiPortsLists;
window.populateAudioOutputDevicesList = populateAudioOutputDevicesList;

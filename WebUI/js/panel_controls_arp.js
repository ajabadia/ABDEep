/**
 * @purpose ARP control bindings — extracted from panel_controls_arp_seq_mod.js.
 * El editor interactivo de pasos SEQ está en panel_controls_seq.js.
 * Carga secuencial vía script tags.
 */

window.bindPanelArpControls = function(container, state, titleEl) {
    titleEl.innerText = 'Arpeggiator Settings';
    container.innerHTML = window.PANEL_TEMPLATES.ARP();

    const arpBox = document.getElementById('panel-arp-enable-box');
    if (arpBox) {
        arpBox.addEventListener('click', () => {
            const active = arpBox.classList.contains('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_enable', active ? 0.0 : 1.0);}
        });
    }

    const holdBox = document.getElementById('panel-arp-hold-box');
    if (holdBox) {
        holdBox.addEventListener('click', () => {
            const active = holdBox.classList.contains('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_hold', active ? 0.0 : 1.0);}
        });
    }

    const keySyncBox = document.getElementById('panel-arp-keysync-box');
    if (keySyncBox) {
        keySyncBox.addEventListener('click', () => {
            const active = keySyncBox.classList.contains('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_key_sync', active ? 0.0 : 1.0);}
        });
    }

    const selectClock = document.getElementById('panel-arp-clock-select');
    if (selectClock) {
        selectClock.addEventListener('change', () => {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_clock_divider', parseInt(selectClock.value) / 12.0);}
        });
    }

    const selectVelGate = document.getElementById('panel-arp-velgate-select');
    if (selectVelGate) {
        selectVelGate.addEventListener('change', () => {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_velocity_gate', parseInt(selectVelGate.value) / 2.0);}
        });
    }

    const selectMode = document.getElementById('panel-arp-mode-select');
    if (selectMode) {
        selectMode.addEventListener('change', () => {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_mode', parseInt(selectMode.value) / 10.0);}
        });
    }

    const selectOctave = document.getElementById('panel-arp-octave-select');
    if (selectOctave) {
        selectOctave.addEventListener('change', () => {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_octave', parseInt(selectOctave.value) / 3.0);}
        });
    }
};

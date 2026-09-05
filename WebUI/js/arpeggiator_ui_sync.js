/**
 * @purpose Arpeggiator modal UI sync — extracted from arpeggiator.js.
 * Synchronises modal controls (boxes, selects, sliders) with patch bytes.
 * Uses document.getElementById instead of closure variables for independence.
 */

window.syncArpModalUI = function() {
    if (typeof currentActivePatchIndex === 'undefined' || currentActivePatchIndex === -1) {return;}
    const activeBank = loadedBanks[currentActiveBank];
    if (!activeBank) {return;}
    const patch = activeBank[currentActivePatchIndex];
    if (!patch || !patch.unpackedBytes) {return;}

    // Offsets corregidos del manual oficial: ARP (MSB=1, LSB 155-164)
    const arpEn = patch.unpackedBytes[155] > 0.5;
    const modeVal = patch.unpackedBytes[156] || 0;
    const clockVal = patch.unpackedBytes[158] || 0;
    const keySyncEn = patch.unpackedBytes[159] > 0.5;
    const holdEn = patch.unpackedBytes[161] > 0.5;
    const patternVal = patch.unpackedBytes[162] || 0;
    const octaveVal = patch.unpackedBytes[164] || 0;
    const velGateVal = patch.unpackedBytes[112] || 0;

    const arpBox = document.getElementById('modal-arp-enable-box');
    const holdBox = document.getElementById('modal-arp-hold-box');
    const keySyncBox = document.getElementById('modal-arp-keysync-box');
    const selectClock = document.getElementById('modal-arp-clock-select');
    const selectVelGate = document.getElementById('modal-arp-velgate-select');
    const selectMode = document.getElementById('modal-arp-mode-select');
    const selectPattern = document.getElementById('modal-arp-pattern-select');
    const selectOctave = document.getElementById('modal-arp-octave-select');

    if (arpBox) {arpBox.classList.toggle('active', arpEn);}
    if (holdBox) {holdBox.classList.toggle('active', holdEn);}
    if (keySyncBox) {keySyncBox.classList.toggle('active', keySyncEn);}

    if (selectClock) {selectClock.value = Math.round(clockVal);}
    if (selectVelGate) {selectVelGate.value = Math.round(velGateVal);}
    if (selectMode) {selectMode.value = Math.round(modeVal);}
    if (selectPattern) {selectPattern.value = Math.round(patternVal);}
    if (selectOctave) {selectOctave.value = Math.round(octaveVal);}

    // Offsets corregidos del manual: arp_swing=163, arp_rate=157, arp_gate_time=160
    const sliders = [
        { id: 'arp_swing', val: patch.unpackedBytes[163] / 25.0 },
        { id: 'arp_rate', val: patch.unpackedBytes[157] / 255.0 },
        { id: 'arp_gate_time', val: patch.unpackedBytes[160] / 255.0 }
    ];

    const backdrop = document.getElementById('arp-modal-backdrop');
    sliders.forEach(sliderInfo => {
        if (!backdrop) {return;}
        const sliderEl = backdrop.querySelector(`[data-param="${sliderInfo.id}"] .v-slider`);
        if (sliderEl) {
            const handle = sliderEl.querySelector('.handle');
            const updatePos = () => {
                const rect = sliderEl.getBoundingClientRect();
                if (rect.height > 0) {
                    const handleHeight = 16;
                    const pos = (1.0 - sliderInfo.val) * (rect.height - handleHeight);
                    handle.style.top = pos + 'px';
                } else {
                    setTimeout(updatePos, 100);
                }
            };
            updatePos();
        }
    });
};

window.syncArpModalUIFromState = function() {
    const backdrop = document.getElementById('arp-modal-backdrop');
    if (backdrop && backdrop.style.display !== 'none') {
        window.syncArpModalUI();
    }
};

// WebUI/js/settings_routing.js — MIDI/USB/WiFi routing + poly chain settings
// Extracted from settings.js (initRoutingSettings, initPolyChainSettings)

function initRoutingSettings() {
    function wireSelect(id, storageKey, defaultValue) {
        const el = document.getElementById(id);
        if (!el) {return;}
        const saved = localStorage.getItem(storageKey) || defaultValue;
        el.value = saved;
        el.addEventListener('change', function() { localStorage.setItem(storageKey, this.value); });
    }
    function wireCheckbox(id, storageKey, defaultChecked) {
        const el = document.getElementById(id);
        if (!el) {return;}
        el.checked = localStorage.getItem(storageKey) === 'on' || (!localStorage.getItem(storageKey) && defaultChecked);
        el.addEventListener('change', function() { localStorage.setItem(storageKey, this.checked ? 'on' : 'off'); });
    }

    wireSelect('settings-midi-ctrl', 'abd-eep-midi-ctrl', 'Off');
    wireSelect('settings-midi-prog-change', 'abd-eep-midi-prog-change', 'RX');
    wireSelect('settings-midi-tx-ch', 'abd-eep-midi-tx-ch', 'RxCh');
    wireSelect('settings-midi-rx-ch', 'abd-eep-midi-rx-ch', 'All');
    wireCheckbox('settings-midi-soft-thru', 'abd-eep-midi-soft-thru', true);
    wireCheckbox('settings-midi-usb-thru', 'abd-eep-usb-thru', false);
    wireCheckbox('settings-midi-wifi-thru', 'abd-eep-wifi-thru', false);

    wireSelect('settings-usb-ctrl', 'abd-eep-usb-ctrl', 'Off');
    wireSelect('settings-usb-prog-change', 'abd-eep-usb-prog-change', 'RX');
    wireSelect('settings-usb-tx-ch', 'abd-eep-usb-tx-ch', 'RxCh');
    wireSelect('settings-usb-rx-ch', 'abd-eep-usb-rx-ch', 'All');
    wireCheckbox('settings-usb-midi-thru', 'abd-eep-usb-midi-thru', true);
    wireCheckbox('settings-usb-wifi-thru', 'abd-eep-usb-wifi-thru', false);

    wireSelect('settings-wifi-ctrl', 'abd-eep-wifi-ctrl', 'Off');
    wireSelect('settings-wifi-prog-change', 'abd-eep-wifi-prog-change', 'RX');
    wireSelect('settings-wifi-tx-ch', 'abd-eep-wifi-tx-ch', 'All');
    wireSelect('settings-wifi-rx-ch', 'abd-eep-wifi-rx-ch', 'RxCh');
    wireCheckbox('settings-wifi-midi-thru', 'abd-eep-wifi-midi-thru', false);
    wireCheckbox('settings-wifi-usb-thru', 'abd-eep-wifi-usb-thru', false);
}

function initPolyChainSettings() {
    const chain = document.getElementById('settings-poly-chain');
    const keyRange = document.getElementById('settings-poly-key-range');
    const lowerNote = document.getElementById('settings-poly-range-lower-note');
    const lowerOct = document.getElementById('settings-poly-range-lower-oct');
    const upperNote = document.getElementById('settings-poly-range-upper-note');
    const upperOct = document.getElementById('settings-poly-range-upper-oct');
    if (chain) {
        chain.checked = localStorage.getItem('abd-eep-poly-chain') === 'on';
        chain.addEventListener('change', function() { localStorage.setItem('abd-eep-poly-chain', this.checked ? 'on' : 'off'); });
    }
    if (keyRange) {
        keyRange.checked = localStorage.getItem('abd-eep-poly-key-range') === 'on';
        keyRange.addEventListener('change', function() { localStorage.setItem('abd-eep-poly-key-range', this.checked ? 'on' : 'off'); });
    }
    if (lowerNote) {
        lowerNote.value = localStorage.getItem('abd-eep-poly-range-lower-note') || 'C';
        lowerNote.addEventListener('change', function() { localStorage.setItem('abd-eep-poly-range-lower-note', this.value); });
    }
    if (lowerOct) {
        lowerOct.value = localStorage.getItem('abd-eep-poly-range-lower-oct') || '-2';
        lowerOct.addEventListener('change', function() { localStorage.setItem('abd-eep-poly-range-lower-oct', this.value); });
    }
    if (upperNote) {
        upperNote.value = localStorage.getItem('abd-eep-poly-range-upper-note') || 'G';
        upperNote.addEventListener('change', function() { localStorage.setItem('abd-eep-poly-range-upper-note', this.value); });
    }
    if (upperOct) {
        upperOct.value = localStorage.getItem('abd-eep-poly-range-upper-oct') || '8';
        upperOct.addEventListener('change', function() { localStorage.setItem('abd-eep-poly-range-upper-oct', this.value); });
    }
}

// Expose for facade and tests
window.initRoutingSettings = initRoutingSettings;
window.initPolyChainSettings = initPolyChainSettings;

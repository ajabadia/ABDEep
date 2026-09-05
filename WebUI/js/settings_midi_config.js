// WebUI/js/settings_midi_config.js — MIDI channel, clock source, device ID settings
// Extracted from settings.js (initMidiChannelSetting, initMidiClockSetting, initDeviceIdSetting)

function initMidiChannelSetting() {
    const sel = document.getElementById('settings-midi-channel');
    if (!sel || !getBridge()) {return;}
    sel.value = String(getBridge().midiChannel);
    sel.addEventListener('change', function() {
        const ch = parseInt(this.value);
        if (getBridge()) {
            getBridge().midiChannel = ch;
            localStorage.setItem('abd-eep-midi-channel', String(ch));
            if (getBridge()._hardwareInfo && getBridge()._hardwareInfo.globalDumpBytes) {
                const cached = getBridge()._hardwareInfo.globalDumpBytes;
                const devId = parseInt(getBridge()._hardwareInfo.deviceId) || 0;
                const payload = new Uint8Array(cached);
                payload[0] = ((devId & 0x0F) << 4) | ((ch - 1) & 0x0F);
                getBridge().sendGlobalDump(Array.from(payload));
            }
            // Sync to C++ parameter (0 = Omni, 1-16 = specific)
            if (getBridge().isJuce && window.juce && typeof window.juce.setParameter === 'function') {
                window.juce.setParameter('midi_channel', ch - 1); // 0=Omni, 1=Ch1, etc.
            }
        }
    });
    const saved = localStorage.getItem('abd-eep-midi-channel');
    if (saved) {
        sel.value = saved;
        if (getBridge()) {getBridge().midiChannel = parseInt(saved);}
    }
}

function initMidiClockSetting() {
    const sel = document.getElementById('settings-midi-clock');
    if (!sel) {return;}
    const saved = localStorage.getItem('abd-eep-midi-clock') || 'internal';
    sel.value = saved;
    sel.addEventListener('change', function() {
        localStorage.setItem('abd-eep-midi-clock', this.value);
        if (getBridge() && getBridge()._updateArpTempo) {
            getBridge()._updateArpTempo();
        }
    });
}

function initDeviceIdSetting() {
    const sel = document.getElementById('settings-device-id');
    if (!sel) {return;}
    const saved = localStorage.getItem('abd-eep-device-id') || '1';
    sel.value = saved;
    if (getBridge() && getBridge()._hardwareInfo && getBridge()._hardwareInfo.deviceId !== '-') {
        sel.value = String(parseInt(getBridge()._hardwareInfo.deviceId) + 1);
    }
    sel.addEventListener('change', function() {
        const val = parseInt(this.value);
        localStorage.setItem('abd-eep-device-id', this.value);
        if (getBridge()) {
            getBridge().setGlobalParameter('device_id', (val - 1) / 15.0);
        }
    });
}

// Expose for facade and tests
window.initMidiChannelSetting = initMidiChannelSetting;
window.initMidiClockSetting = initMidiClockSetting;
window.initDeviceIdSetting = initDeviceIdSetting;

function initProtectUnsavedEditsSetting() {
    const sel = document.getElementById('settings-protect-unsaved');
    if (!sel) {return;}
    const saved = localStorage.getItem('abd-eep-protect-unsaved') || '0';
    sel.value = saved;
    sel.addEventListener('change', function() {
        const val = parseInt(this.value);
        localStorage.setItem('abd-eep-protect-unsaved', this.value);
        if (getBridge() && getBridge().isJuce && window.juce && typeof window.juce.setParameter === 'function') {
            window.juce.setParameter('protect_unsaved_edits', val);
        }
    });
}

window.initProtectUnsavedEditsSetting = initProtectUnsavedEditsSetting;

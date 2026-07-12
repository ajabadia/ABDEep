/**
 * @purpose Sistema MIDI Learn para DualMidiBridge — añade métodos al prototipo después de la definición de la clase.
 * @purpose_en MIDI Learn system for DualMidiBridge — adds methods to prototype after class definition.
 * @classification Module/MIDI Learn
 * @complexity Medium
 */

// --- Sistema MIDI Learn — se añade al prototipo tras la definición de la clase ---
(function() {
    if (typeof DualMidiBridge === 'undefined') {
        console.warn('[MIDI Learn] DualMidiBridge not found — deferring...');
        return;
    }

    /** Toggle MIDI Learn mode on/off */
    DualMidiBridge.prototype.toggleMidiLearn = function() {
        if (this.midiLearnActive) {
            this.stopMidiLearn();
        } else {
            this.startMidiLearn();
        }
    };

    /** Enter MIDI Learn mode */
    DualMidiBridge.prototype.startMidiLearn = function() {
        if (this.midiLearnActive) return;
        this.midiLearnActive = true;
        this.midiLearnTargetParam = null;
        this.midiLearnPendingCC = null;
        console.log('[MIDI Learn] 🔵 Entered learn mode — move a hardware control or click a UI parameter');
        this._notifyMidiLearnChange();
        this._showLcdLearnPrompt('MOVE a control or\\nCLICK a parameter');
    };

    /** Exit MIDI Learn mode */
    DualMidiBridge.prototype.stopMidiLearn = function() {
        if (!this.midiLearnActive) return;
        this.midiLearnActive = false;
        this.midiLearnTargetParam = null;
        this.midiLearnPendingCC = null;
        console.log('[MIDI Learn] ⏹ Exited learn mode');
        this._notifyMidiLearnChange();
        setTimeout(function() {
            var lcd = document.getElementById('lcd-text');
            if (lcd && lcd._midiLearnLcd) {
                lcd._midiLearnLcd = null;
                window.lcdSafeUpdate(lcd, '<span style="font-size:10px; opacity:0.6;">MIDI LEARN</span><br><strong>INITIAL PATCH</strong>');
            }
        }, 800);
    };

    /** Set the target parameter for current MIDI Learn session */
    DualMidiBridge.prototype.setMidiLearnTarget = function(paramId) {
        if (!this.midiLearnActive) return;
        this.midiLearnTargetParam = paramId;

        if (this.midiLearnPendingCC) {
            this._completeMidiLearnMapping(paramId, this.midiLearnPendingCC);
            this.midiLearnPendingCC = null;
        } else {
            var meta = this._getParamName(paramId);
            this._showLcdLearnPrompt('TARGET: ' + meta.toUpperCase() + '\\nMOVE hardware control...');
            this._notifyMidiLearnChange();
        }
    };

    /** Capture incoming CC/NRPN while in learn mode */
    DualMidiBridge.prototype._captureMidiLearnMessage = function(ccNum, val, nrpnInfo) {
        if (!this.midiLearnActive) return;

        var key, desc;
        if (nrpnInfo) {
            key = 'nrpn:' + nrpnInfo.msb + ':' + nrpnInfo.lsb;
            desc = 'NRPN ' + nrpnInfo.msb + ':' + String(nrpnInfo.lsb).padStart(2, '0');
        } else {
            key = 'cc:' + ccNum;
            desc = 'CC ' + ccNum;
        }

        if (this.midiLearnTargetParam) {
            this._completeMidiLearnMapping(this.midiLearnTargetParam, { key: key, desc: desc, cc: ccNum, val: val, nrpn: nrpnInfo });
            return;
        }

        this.midiLearnPendingCC = { key: key, desc: desc, cc: ccNum, val: val, nrpn: nrpnInfo };
        console.log('[MIDI Learn] Captured ' + desc + ' — now click a UI parameter to map');
        this._showLcdLearnPrompt('CAPTURED: ' + desc + '\\nNOW click a parameter');
        this._notifyMidiLearnChange();
    };

    /** Complete a MIDI Learn mapping and save it */
    DualMidiBridge.prototype._completeMidiLearnMapping = function(paramId, captured) {
        var key = captured.key;
        var oldParam = this.midiLearnMappings[key];

        if (oldParam && oldParam !== paramId) {
            console.log('[MIDI Learn] Re-mapping ' + key + ' from ' + oldParam + ' → ' + paramId);
        }

        this.midiLearnMappings[key] = paramId;
        this._saveMidiLearnMappings();

        var meta = this._getParamName(paramId);
        console.log('[MIDI Learn] ✅ Mapped ' + captured.desc + ' → ' + paramId + ' (' + meta + ')');
        this._showLcdLearnPrompt('✅ MAPPED!\\n' + captured.desc + ' → ' + meta.toUpperCase());

        this._notifyMidiLearnChange();

        if (this._midiLearnAutoExitTimer) clearTimeout(this._midiLearnAutoExitTimer);
        this._midiLearnAutoExitTimer = setTimeout(function(self) {
            return function() { self._midiLearnAutoExitTimer = null; };
        }(this), 3000);
    };

    /** Get human-readable name for a paramId */
    DualMidiBridge.prototype._getParamName = function(paramId) {
        var byteOffset = window.BRIDGE_PARAM_MAPS.PARAM_TO_BYTE_OFFSET[paramId];
        var info = window.BYTE_MAP ? window.BYTE_MAP[byteOffset] : null;
        if (info) return info.param;
        return paramId.replace(/_/g, ' ');
    };

    /** Show a message on the programmer LCD */
    DualMidiBridge.prototype._showLcdLearnPrompt = function(msg) {
        var lcd = document.getElementById('lcd-text');
        if (!lcd) return;
        lcd._midiLearnLcd = true;
        var parts = msg.split('\\n');
        var html = '<span style="color:var(--accent-blue,#00ccff);font-weight:bold;font-size:9px">🎯 MIDI LEARN</span><br>' +
            parts.map(function(p, i) {
                if (i === 0) return '<span style="font-size:10px">' + p + '</span>';
                return '<span style="font-size:7px;color:var(--text-dim)">' + p + '</span>';
            }).join('<br>');
        window.lcdSafeUpdate(lcd, html)
    };

    /** Notify listeners that learn state changed */
    DualMidiBridge.prototype._notifyMidiLearnChange = function() {
        var self = this;
        this.midiLearnChangeCallbacks.forEach(function(cb) { cb(self.midiLearnActive, self.midiLearnTargetParam); });
    };

    /** Register a callback for learn state changes */
    DualMidiBridge.prototype.onMidiLearnChange = function(callback) {
        this.midiLearnChangeCallbacks.push(callback);
    };

    /** Remove a specific mapping */
    DualMidiBridge.prototype.removeMidiLearnMapping = function(key) {
        delete this.midiLearnMappings[key];
        this._saveMidiLearnMappings();
        this._notifyMidiLearnChange();
    };

    /** Clear all MIDI Learn mappings */
    DualMidiBridge.prototype.clearMidiLearnMappings = function() {
        this.midiLearnMappings = {};
        this._saveMidiLearnMappings();
        this._notifyMidiLearnChange();
    };

    /** Persist mappings to localStorage */
    DualMidiBridge.prototype._saveMidiLearnMappings = function() {
        try {
            localStorage.setItem('abd-eep-midi-learn', JSON.stringify(this.midiLearnMappings));
        } catch (e) {
            console.warn('[MIDI Learn] Failed to save mappings:', e);
        }
    };

    /** Load mappings from localStorage */
    DualMidiBridge.prototype._loadMidiLearnMappings = function() {
        try {
            var raw = localStorage.getItem('abd-eep-midi-learn');
            if (raw) {
                this.midiLearnMappings = JSON.parse(raw);
                console.log('[MIDI Learn] 📥 Loaded ' + Object.keys(this.midiLearnMappings).length + ' mappings from storage');
            }
        } catch (e) {
            console.warn('[MIDI Learn] Failed to load mappings:', e);
        }
    };

    /**
     * Apply a MIDI Learn mapping: when an incoming CC/NRPN matches a stored mapping,
     * route it to the mapped parameter instead of default processing.
     */
    DualMidiBridge.prototype._applyMidiLearnMapping = function(key, val, nrpnInfo) {
        var paramId = this.midiLearnMappings[key];
        if (!paramId) return false;

        var byteOffset = window.BRIDGE_PARAM_MAPS.PARAM_TO_BYTE_OFFSET[paramId];
        var normalized;
        if (byteOffset !== undefined) {
            var rawVal = nrpnInfo ? (val & 0xFF) : Math.round(val * 255.0 / 127.0);
            normalized = window.BRIDGE_PARAM_MAPS.rawToNormalized(byteOffset, rawVal);
        } else {
            normalized = val / 127.0;
        }

        this.setParameter(paramId, normalized);
        this.handleParameterChangeFromBackend(paramId, normalized);
        return true;
    };

    console.log('[Bridge] MIDI Learn module loaded');
})();

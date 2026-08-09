// eslint-disable-next-line no-var
var Logger = globalThis.Logger || console;

/**
 * @purpose Sistema MIDI Learn para DualMidiBridge — añade métodos al prototipo.
 * @purpose_en MIDI Learn system for DualMidiBridge — adds methods to prototype.
 * @classification Module/MIDI Learn
 * @complexity Medium
 *
 * Sub-módulos:
 *   - bridge-midi-learn.js:       Core: toggle, start, stop, setTarget, capture, complete,
 *                                  getParamName, showLcdPrompt, notify, refreshIndicators
 *   - bridge-midi-learn_storage.js: Persistencia: _saveMappings, _loadMappings, _applyMapping,
 *                                   removeMapping, clearMappings, onMidiLearnChange
 */

(function() {
    if (typeof DualMidiBridge === 'undefined') {
        Logger.warn('[MIDI Learn] DualMidiBridge not found — deferring...');
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
        if (this.midiLearnActive) {return;}
        this.midiLearnActive = true;
        this.midiLearnTargetParam = null;
        this.midiLearnPendingCC = null;
        Logger.log('[MIDI Learn] 🔵 Entered learn mode — move a hardware control or click a UI parameter');
        this._notifyMidiLearnChange();
        this.refreshMidiLearnIndicators();
        this._showLcdLearnPrompt('MOVE a control or\\nCLICK a parameter');
    };

    /** Exit MIDI Learn mode */
    DualMidiBridge.prototype.stopMidiLearn = function() {
        if (!this.midiLearnActive) {return;}
        this.midiLearnActive = false;
        this.midiLearnTargetParam = null;
        this.midiLearnPendingCC = null;
        Logger.log('[MIDI Learn] ⏹ Exited learn mode');
        this._notifyMidiLearnChange();
        this.refreshMidiLearnIndicators();
        setTimeout(function() {
            const lcd = document.getElementById('lcd-text');
            if (lcd && lcd._midiLearnLcd) {
                lcd._midiLearnLcd = null;
                window.lcdSafeUpdate(lcd, '<span class=\"lcd-label\">MIDI LEARN</span><br><strong>INITIAL PATCH</strong>');
            }
        }, 800);
    };

    /** Set the target parameter for current MIDI Learn session */
    DualMidiBridge.prototype.setMidiLearnTarget = function(paramId) {
        if (!this.midiLearnActive) {return;}
        this.midiLearnTargetParam = paramId;

        if (this.midiLearnPendingCC) {
            this._completeMidiLearnMapping(paramId, this.midiLearnPendingCC);
            this.midiLearnPendingCC = null;
        } else {
            const meta = this._getParamName(paramId);
            this._showLcdLearnPrompt('TARGET: ' + meta.toUpperCase() + '\\nMOVE hardware control...');
            this._notifyMidiLearnChange();
        }
    };

    /** Capture incoming CC/NRPN while in learn mode */
    DualMidiBridge.prototype._captureMidiLearnMessage = function(ccNum, val, nrpnInfo) {
        if (!this.midiLearnActive) {return;}

        let key, desc;
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
        Logger.log('[MIDI Learn] Captured ' + desc + ' — now click a UI parameter to map');
        this._showLcdLearnPrompt('CAPTURED: ' + desc + '\\nNOW click a parameter');
        this._notifyMidiLearnChange();
    };

    /** Complete a MIDI Learn mapping and save it */
    DualMidiBridge.prototype._completeMidiLearnMapping = function(paramId, captured) {
        const key = captured.key;
        const oldParam = this.midiLearnMappings[key];

        if (oldParam && oldParam !== paramId) {
            Logger.log('[MIDI Learn] Re-mapping ' + key + ' from ' + oldParam + ' → ' + paramId);
        }

        this.midiLearnMappings[key] = paramId;
        this._saveMidiLearnMappings();

        const meta = this._getParamName(paramId);
        Logger.log('[MIDI Learn] ✅ Mapped ' + captured.desc + ' → ' + paramId + ' (' + meta + ')');
        this._showLcdLearnPrompt('✅ MAPPED!\\n' + captured.desc + ' → ' + meta.toUpperCase());

        this._notifyMidiLearnChange();
        this.refreshMidiLearnIndicators();

        if (this._midiLearnAutoExitTimer) {clearTimeout(this._midiLearnAutoExitTimer);}
        this._midiLearnAutoExitTimer = setTimeout(function(self) {
            return function() { self._midiLearnAutoExitTimer = null; };
        }(this), 3000);
    };

    /** Get human-readable name for a paramId */
    DualMidiBridge.prototype._getParamName = function(paramId) {
        const byteOffset = window.BRIDGE_PARAM_MAPS.PARAM_TO_BYTE_OFFSET[paramId];
        const info = window.BYTE_MAP ? window.BYTE_MAP[byteOffset] : null;
        if (info) {return info.param;}
        return paramId.replace(/_/g, ' ');
    };

    /** Show a message on the programmer LCD */
    DualMidiBridge.prototype._showLcdLearnPrompt = function(msg) {
        const lcd = document.getElementById('lcd-text');
        if (!lcd) {return;}
        lcd._midiLearnLcd = true;
        const parts = msg.split('\\n');
        const html = '<span class=\"midi-learn-label\">🎯 MIDI LEARN</span><br>' +
            parts.map(function(p, i) {
                if (i === 0) {return '<span class=\"midi-learn-title\">' + p + '</span>';}
                return '<span class=\"midi-learn-line\">' + p + '</span>';
            }).join('<br>');
        window.lcdSafeUpdate(lcd, html);
    };

    /** Notify listeners that learn state changed */
    DualMidiBridge.prototype._notifyMidiLearnChange = function() {
        const self = this;
        this.midiLearnChangeCallbacks.forEach(function(cb) { cb(self.midiLearnActive, self.midiLearnTargetParam); });
    };

    /** Refresh visual indicators on all UI controls that have MIDI Learn mappings */
    DualMidiBridge.prototype.refreshMidiLearnIndicators = function() {
        const self = this;
        const controls = document.querySelectorAll('[data-param]');
        for (let i = 0; i < controls.length; i++) {
            const el = controls[i];
            const paramId = el.getAttribute('data-param');
            if (!paramId) {continue;}
            let hasMapping = false;
            for (const key in self.midiLearnMappings) {
                if (self.midiLearnMappings[key] === paramId) { hasMapping = true; break; }
            }
            el.classList.toggle('has-midi-learn', hasMapping);
            if (self.midiLearnActive && hasMapping) {
                el.classList.add('midi-learn-highlight');
            } else {
                el.classList.remove('midi-learn-highlight');
            }
        }
    };

    Logger.log('[Bridge] MIDI Learn module loaded');
})();

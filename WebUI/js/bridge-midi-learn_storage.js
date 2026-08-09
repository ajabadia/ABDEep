// eslint-disable-next-line no-var
var Logger = globalThis.Logger || console;

/**
 * @purpose MIDI Learn persistence and mapping application for DualMidiBridge.
 * Extraído de bridge-midi-learn.js para modularización.
 * @classification Module/MIDI Learn/Storage
 * @complexity Low
 */

(function() {
    if (typeof DualMidiBridge === 'undefined') {
        Logger.warn('[MIDI Learn] DualMidiBridge not found — deferring...');
        return;
    }

    /** Register a callback for learn state changes */
    DualMidiBridge.prototype.onMidiLearnChange = function(callback) {
        this.midiLearnChangeCallbacks.push(callback);
    };

    /** Remove a specific mapping */
    DualMidiBridge.prototype.removeMidiLearnMapping = function(key) {
        delete this.midiLearnMappings[key];
        this._saveMidiLearnMappings();
        this._notifyMidiLearnChange();
        this.refreshMidiLearnIndicators();
    };

    /** Clear all MIDI Learn mappings */
    DualMidiBridge.prototype.clearMidiLearnMappings = function() {
        this.midiLearnMappings = {};
        this._saveMidiLearnMappings();
        this._notifyMidiLearnChange();
        this.refreshMidiLearnIndicators();
    };

    /** Persist mappings to localStorage */
    DualMidiBridge.prototype._saveMidiLearnMappings = function() {
        try {
            localStorage.setItem('abd-eep-midi-learn', JSON.stringify(this.midiLearnMappings));
        } catch (e) {
            Logger.warn('[MIDI Learn] Failed to save mappings:', e);
        }
    };

    /** Load mappings from localStorage */
    DualMidiBridge.prototype._loadMidiLearnMappings = function() {
        try {
            const raw = localStorage.getItem('abd-eep-midi-learn');
            if (raw) {
                this.midiLearnMappings = JSON.parse(raw);
                Logger.log('[MIDI Learn] 📥 Loaded ' + Object.keys(this.midiLearnMappings).length + ' mappings from storage');
            }
            this.refreshMidiLearnIndicators();
        } catch (e) {
            Logger.warn('[MIDI Learn] Failed to load mappings:', e);
        }
    };

    /**
     * Apply a MIDI Learn mapping: when an incoming CC/NRPN matches a stored mapping,
     * route it to the mapped parameter instead of default processing.
     */
    DualMidiBridge.prototype._applyMidiLearnMapping = function(key, val, nrpnInfo) {
        const paramId = this.midiLearnMappings[key];
        if (!paramId) {return false;}

        const byteOffset = window.BRIDGE_PARAM_MAPS.PARAM_TO_BYTE_OFFSET[paramId];
        let normalized;
        if (byteOffset !== undefined) {
            const rawVal = nrpnInfo ? (val & 0xFF) : Math.round(val * 255.0 / 127.0);
            normalized = window.BRIDGE_PARAM_MAPS.rawToNormalized(byteOffset, rawVal);
        } else {
            normalized = val / 127.0;
        }

        this.setParameter(paramId, normalized);
        this.handleParameterChangeFromBackend(paramId, normalized);
        return true;
    };

    Logger.log('[Bridge] MIDI Learn storage module loaded');
})();

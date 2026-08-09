// eslint-disable-next-line no-var
var Logger = globalThis.Logger || console;

/**
 * @purpose Utility and UI methods for DualMidiBridge connection module (extracted from bridge-connection.js)
 * @classification Module/Connection/Utils
 * @complexity Medium
 */

(function() {
    if (typeof DualMidiBridge === 'undefined') {
        Logger.warn('[Bridge-Connection-Utils] DualMidiBridge not found — deferring...');
        return;
    }

    DualMidiBridge.prototype._isLikelyVirtualPort = function(name) {
        const lower = name.toLowerCase();
        return lower.includes('virtual') || lower.includes('iac driver');
    };

    DualMidiBridge.prototype._detectConnectionType = function(portName) {
        if (!portName) {return 'Unknown';}
        const lower = portName.toLowerCase();
        if (lower.includes('deepmind') || lower.includes('u2midi')) {
            return 'USB MIDI';
        }
        if (lower.includes('wifi') || lower.includes('wireless') || lower.includes('network') || lower.includes('rtpmidi')) {
            return 'WiFi MIDI';
        }
        if (lower.includes('usb') || lower.includes('usb midi')) {
            return 'USB MIDI';
        }
        if (lower.includes('midi') && (lower.includes('in') || lower.includes('out') || lower.includes('port'))) {
            return 'MIDI DIN';
        }
        return 'MIDI DIN';
    };

    DualMidiBridge.prototype._selectMidiPort = function(ports, kind = 'output') {
        if (!ports || ports.size === 0) {return null;}
        const list = Array.from(ports.values());
        const preferredNeedles = ['deepmind', 'u2midi'];

        for (const needle of preferredNeedles) {
            const match = list.find(p => p.name.toLowerCase().includes(needle));
            if (match) {
                Logger.log(`[WebMIDI] ${kind} seleccionado por coincidencia "${needle}": ${match.name}`);
                return match;
            }
        }

        const nonVirtual = list.find(p => !this._isLikelyVirtualPort(p.name));
        if (nonVirtual) {
            Logger.log(`[WebMIDI] ${kind} seleccionado (no-virtual): ${nonVirtual.name}`);
            return nonVirtual;
        }

        return list[0] || null;
    };

    DualMidiBridge.prototype._signalMidiActivity = function() {
        const led = document.getElementById('midi-activity-led');
        if (!led) {return;}
        if (led._midiTimer) {
            clearTimeout(led._midiTimer);
        }
        led.style.opacity = '1';
        led.style.boxShadow = '0 0 6px var(--accent-green)';
        led._midiTimer = setTimeout(() => {
            led.style.opacity = '0.15';
            led.style.boxShadow = 'none';
            led._midiTimer = null;
        }, 80);
    };

    DualMidiBridge.prototype._showNoteOnLcd = function(midiNote, velocity) {
        const lcdText = document.getElementById('lcd-text');
        if (!lcdText) {return;}

        const velNorm = (velocity === undefined) ? 1.0 : (velocity > 1.0 ? velocity / 127.0 : velocity);
        const velInt = Math.round(velNorm * 100);
        const html = '<span class="lcd-label">KEY PLAY</span><br>'
            + '<strong class="lcd-text-18">'
            + this._midiNoteToName(midiNote) + ' <span class="lcd-text-11">(MIDI #' + midiNote + ')</span></strong><br>'
            + '<span class="lcd-text-10">Vel ' + velInt + '%</span>';

        if (typeof window.LcdQueue !== 'undefined' && window.LcdQueue && typeof window.LcdQueue.push === 'function') {
            window.LcdQueue.push('key_play', html, 1, { duration: 8000 });
        } else {
            lcdText.innerHTML = html;
        }

        Logger.log('[LCD] _showNoteOnLcd: ' + this._midiNoteToName(midiNote) + ' (#' + midiNote + ') vel=' + velInt + '%');
    };

    DualMidiBridge.prototype._midiNoteToName = function(midiNote) {
        const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
        if (midiNote === undefined || midiNote === null) {return '\u2014';}
        if (midiNote < 0 || midiNote > 127) {return '\u2014';}
        return NOTE_NAMES[midiNote % 12] + (Math.floor(midiNote / 12) - 1);
    };

    DualMidiBridge.prototype.getHardwareInfo = function() {
        return this._hardwareInfo;
    };

    DualMidiBridge.prototype._updateConnectionUI = function() {
        const indicator = document.getElementById('midi-connection-indicator');
        const statusBtn = document.getElementById('settings-connection-status');
        const reconnectBtn = document.getElementById('reconnect-hw-btn');
        const connected = this._connected && (this.isJuce || (this.midiOutput && this.midiInput));
        const hasHardware = this._hardwareInfo && this._hardwareInfo.globalDumpBytes;

        let color = 'var(--color-danger)';
        let shadow = '0 0 4px var(--color-danger)';
        let statusText = 'Disconnected';
        let tooltipText = 'MIDI: Disconnected';
        let statusColor = 'var(--text-primary)';
        let statusBorder = '1px solid var(--color-danger)';

        if (connected) {
            if (this.isJuce && !hasHardware) {
                color = '#00d2ff';
                shadow = '0 0 6px #00d2ff';
                statusText = 'Local DSP Active';
                tooltipText = 'Engine: Connected (Emulator Mode)';
                statusColor = '#00d2ff';
                statusBorder = '1px solid #00d2ff';
            } else {
                color = 'var(--accent-green)';
                shadow = '0 0 6px var(--accent-green)';
                statusText = 'Connected';
                tooltipText = 'MIDI: Connected to Hardware';
                statusColor = 'var(--accent-green)';
                statusBorder = '1px solid var(--accent-green)';
            }
        }

        if (indicator) {
            indicator.style.backgroundColor = color;
            indicator.style.boxShadow = shadow;
            indicator.setAttribute('data-ctrl-tooltip', tooltipText);
        }
        if (statusBtn) {
            statusBtn.textContent = statusText;
            statusBtn.style.color = statusColor;
            statusBtn.style.border = statusBorder;
        }
        if (reconnectBtn) {
            reconnectBtn.style.display = connected ? 'none' : 'inline-block';
            if (!reconnectBtn._wired) {
                reconnectBtn._wired = true;
                reconnectBtn.addEventListener('click', async () => {
                    reconnectBtn.textContent = 'CONNECTING...';
                    reconnectBtn.disabled = true;
                    try {
                        const ok = await this.resetMidiConnection();
                        if (!ok) {
                            throw new Error('Reconnection failed');
                        }
                    } catch (e) {
                        Logger.warn('[Bridge] Reconnection failed, opening settings:', e.message);
                        const modal = document.getElementById('settings-modal-backdrop');
                        if (modal) {
                            modal.style.display = 'flex';
                            if (typeof window.populateMidiPortsLists === 'function') {
                                window.populateMidiPortsLists();
                            }
                            if (typeof window._updateSettingsHardwareInfo === 'function') {
                                window._updateSettingsHardwareInfo();
                            }
                            const connTabBtn = document.querySelector('.btn[data-tab="connections"]');
                            if (connTabBtn) {
                                connTabBtn.click();
                            }
                        }
                    } finally {
                        reconnectBtn.textContent = 'RE-CONNECT HARDWARE';
                        reconnectBtn.disabled = false;
                        this._updateConnectionUI();
                    }
                });
            }
        }
    };

    Logger.log('[Bridge] Connection utils module loaded');
})();

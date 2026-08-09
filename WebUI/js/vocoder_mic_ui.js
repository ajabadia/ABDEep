/**
 * @purpose Vocoder microphone UI: VU meter rendering, toggle button, status display,
 *          DOM injection into Vocoder FX panel. Receives state via window._vocoderMicState.
 * @classification Module/Vocoder/UI
 * @dependencies vocoder_mic_audio.js (calls window._vocoderMicAudio internally)
 */

(function () {
    'use strict';

    const audio = (typeof window !== 'undefined' && window._vocoderMicAudio) || {};
    const state = (typeof window !== 'undefined' && window._vocoderMicState) || {};

    // --- DOM helpers (lazy) ---
    function getVUMeter() { return document.getElementById('vocoder-vu-meter'); }
    function getVUBar()   { return document.getElementById('vocoder-vu-bar'); }
    function getMicBtn()  { return document.getElementById('vocoder-mic-toggle'); }
    function getMicStatus() { return document.getElementById('vocoder-mic-status'); }

    // --- Template ---
    function createVUHTML() {
        return [
            '<div class="vocoder-mic-section" style="display:flex;flex-direction:column;gap:6px;padding:8px;border-top:1px solid var(--border-dim);margin-top:8px">',
            '  <div class="flex-row items-center gap-8" style="justify-content:space-between">',
            '    <span class="label text-xs" style="color:var(--text-secondary)">🎙️ Mic Input</span>',
            '    <button id="vocoder-mic-toggle" class="toggle-box" data-active="false"',
            '      style="padding:4px 12px;border-radius:var(--radius);cursor:pointer"',
            '      data-ctrl-tooltip="Enable microphone for Vocoder modulation">',
            '      <span class="toggle-label">Enable</span>',
            '      <div class="toggle-led"></div>',
            '    </button>',
            '  </div>',
            '  <div id="vocoder-vu-meter" style="height:6px;background:var(--bg-deepest);border-radius:3px;overflow:hidden;opacity:0.3;transition:opacity 0.3s">',
            '    <div id="vocoder-vu-bar" style="height:100%;width:0%;background:var(--accent-green);border-radius:3px;transition:width 0.08s ease"></div>',
            '  </div>',
            '  <span id="vocoder-mic-status" class="text-2xs" style="color:var(--text-dim);font-family:&#39;Share Tech Mono&#39;,monospace">MICROPHONE DISABLED</span>',
            '</div>'
        ].join('\n');
    }

    // --- VU Meter ---
    function startVUMeter() {
        stopVUMeter();
        if (!state.analyserNode) {return;}

        const dataArray = new Uint8Array(state.analyserNode.frequencyBinCount);
        state.vuIntervalId = setInterval(function () {
            const bar = getVUBar();
            const meter = getVUMeter();
            if (!bar || !meter) {return;}

            state.analyserNode.getByteTimeDomainData(dataArray);
            let max = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const val = Math.abs(dataArray[i] - 128) / 128;
                if (val > max) {max = val;}
            }

            const pct = Math.min(max * 100, 100);
            bar.style.width = pct + '%';

            if (pct > 80) {
                bar.style.background = 'var(--accent-red)';
            } else if (pct > 50) {
                bar.style.background = 'var(--accent-pink)';
            } else {
                bar.style.background = 'var(--accent-green)';
            }
        }, 80);
    }

    function stopVUMeter() {
        if (state.vuIntervalId) {
            clearInterval(state.vuIntervalId);
            state.vuIntervalId = null;
        }
        const bar = getVUBar();
        if (bar) {
            bar.style.width = '0%';
            bar.style.background = 'var(--accent-green)';
        }
    }

    // --- UI state update ---
    function updateUI(enabled) {
        const btn = getMicBtn();
        const meter = getVUMeter();
        const status = getMicStatus();

        if (btn) {
            btn.dataset.active = enabled ? 'true' : 'false';
            const label = btn.querySelector('.toggle-label');
            if (label) {label.textContent = enabled ? 'Enabled' : 'Enable';}
        }
        if (meter) {
            meter.style.opacity = enabled ? '1' : '0.3';
        }
        if (status) {
            status.textContent = enabled
                ? 'MICROPHONE ACTIVE — ' + (state.bridgeActive ? 'BRIDGE CONNECTED' : 'LOCAL ONLY')
                : 'MICROPHONE DISABLED';
            status.style.color = enabled ? 'var(--accent-green)' : 'var(--text-dim)';
        }
    }

    // --- Check if any FX slot has Vocoder (type 49) ---
    function isVocoderActive() {
        const selectors = document.querySelectorAll('.fx-type-select');
        for (let i = 0; i < selectors.length; i++) {
            if (parseInt(selectors[i].value, 10) === 49) {return true;}
        }
        return false;
    }

    // --- Toggle mic on/off (orchestrates audio + UI) ---
    async function toggleMic() {
        if (state.micEnabled) {
            // Disable
            state.micEnabled = false;
            stopVUMeter();
            audio.stopAudioPipeline();
            audio.stopMicStream();
            updateUI(false);
            return;
        }

        // Enable
        const granted = await audio.requestMic();
        if (!granted) {
            const status = getMicStatus();
            if (status) {
                status.textContent = '\u26A0\uFE0F MICROPHONE ACCESS DENIED \u2014 using internal noise';
                status.style.color = 'var(--accent-red)';
            }
            return;
        }

        state.micEnabled = true;
        audio.startAudioPipeline();
        startVUMeter();
        updateUI(true);
    }

    // --- Inject VU meter DOM into Vocoder FX panel ---
    function injectVocoderUI() {
        if (!isVocoderActive()) {return;}

        const container = document.querySelector('.fx-param-panel[data-fx-type="49"]');
        if (!container) {return;}
        if (document.getElementById('vocoder-mic-section')) {return;}

        const section = document.createElement('div');
        section.id = 'vocoder-mic-section';
        section.innerHTML = createVUHTML();
        container.appendChild(section);

        const btn = getMicBtn();
        if (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                toggleMic();
            });
        }
    }

    // --- Public API ---
    window._vocoderMicUI = {
        createVUHTML: createVUHTML,
        startVUMeter: startVUMeter,
        stopVUMeter: stopVUMeter,
        updateUI: updateUI,
        isVocoderActive: isVocoderActive,
        toggleMic: toggleMic,
        injectVocoderUI: injectVocoderUI,
        getVUMeter: getVUMeter,
        getVUBar: getVUBar,
        getMicBtn: getMicBtn,
        getMicStatus: getMicStatus
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = window._vocoderMicUI;
    }
})();

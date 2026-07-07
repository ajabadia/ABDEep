/**
 * @purpose Inicializa y gestiona los componentes interactivos fundamentales de la interfaz (sliders, pulsadores de botones/LEDs y feedback en la pantalla LCD).
 * @purpose_en Initializes and manages fundamental interactive UI elements including faders, button/LED states, and programmer LCD feedback.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar controles interactivos principales de faders y toggles
    initUIControls();

    // Inicializar el resto de módulos extraídos
    if (typeof window.initKeyboardAndWheels === 'function') window.initKeyboardAndWheels();
    if (typeof window.initKnobs === 'function') window.initKnobs();
    if (typeof window.initSettingsAndModals === 'function') window.initSettingsAndModals();
    if (typeof window.initEditActions === 'function') window.initEditActions();

    // Configurar botón de MIDI Dump
    const dumpMidiBtn = document.getElementById('menu-dump-midi');
    if (dumpMidiBtn) {
        dumpMidiBtn.addEventListener('click', () => {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.requestMidiDump("edit");
                
                // Mostrar feedback en la pantalla LCD del sintetizador
                const lcdText = document.getElementById('lcd-text');
                if (lcdText) {
                    lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">REQUESTING...</span><br><strong>MIDI DUMP</strong><br><span style="font-size:11px; color:#ffb700;">EDIT BUFFER REQ</span>`;
                }
            }
        });
    }
});

// 1. INICIALIZACIÓN DE SLIDERS, KNOBS Y LEDS
function initUIControls() {
    // Sliders interactivos de faders verticales
    document.querySelectorAll('.v-slider').forEach(slider => {
        const handle = slider.querySelector('.handle');
        let isDragging = false;
        
        const updateVal = (clientY) => {
            const rect = slider.getBoundingClientRect();
            let pct = 1.0 - (clientY - rect.top) / rect.height;
            pct = Math.max(0, Math.min(1, pct));
            
            // Mapear el capuchón en pixeles
            const handleHeight = 16;
            const pos = (1.0 - pct) * (rect.height - handleHeight);
            handle.style.top = pos + 'px';
            
            // Leer paramId actualizado dinámicamente desde el elemento contenedor superior
            const paramId = slider.closest('[data-param]').getAttribute('data-param');

            // Notificar al bridge dual
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter(paramId, pct);
                
                // Mapeo detallado de telemetría MIDI para faders y parámetros del DeepMind 12
                const midiMappings = {
                    "lfo1_rate": "NRPN 0:00 (CC 16)",
                    "lfo1_delay": "NRPN 0:01 (CC 17)",
                    "lfo2_rate": "NRPN 0:07 (CC 18)",
                    "lfo2_delay": "NRPN 0:08 (CC 19)",
                    "osc1_pwm_amount": "NRPN 0:25 (CC 21)",
                    "osc2_pitch": "NRPN 0:27 (CC 25)",
                    "osc2_tone_mod": "NRPN 0:28 (CC 24)",
                    "osc2_level": "NRPN 0:26 (CC 26)",
                    "noise_level": "NRPN 0:33 (CC 27)",
                    "vcf_cutoff": "NRPN 0:39 (CC 29)",
                    "vcf_resonance": "NRPN 0:41 (CC 30)",
                    "vcf_env_depth": "NRPN 0:42 (CC 31)",
                    "hpf_cutoff": "NRPN 0:40 (CC 35)",
                    "hpf_boost_enable": "NRPN 0:52",
                    "vca_level": "NRPN 0:57 (CC 36)",
                    "vca_mode": "NRPN 0:58",
                    "vca_env_depth": "NRPN 0:59",
                    "vca_vel_sens": "NRPN 0:60",
                    "vca_pan_spread": "NRPN 0:61",
                    "env1_attack": "NRPN 0:53 (CC 37)",
                    "env1_decay": "NRPN 0:54 (CC 39)",
                    "env1_sustain": "NRPN 0:55 (CC 40)",
                    "env1_release": "NRPN 0:56 (CC 41)",
                    "env2_attack": "NRPN 0:65 (CC 42)",
                    "env2_decay": "NRPN 0:66 (CC 43)",
                    "env2_sustain": "NRPN 0:67 (CC 44)",
                    "env2_release": "NRPN 0:68 (CC 45)",
                    "env3_attack": "NRPN 0:73 (CC 46)",
                    "env3_decay": "NRPN 0:74 (CC 47)",
                    "env3_sustain": "NRPN 0:75 (CC 48)",
                    "env3_release": "NRPN 0:76 (CC 49)",
                    "unison_detune": "NRPN 0:87 (CC 28)",
                    "arp_rate": "NRPN 1:29 (CC 12)",
                    "arp_gate": "NRPN 1:32 (CC 13)"
                };
                
                const midiInfo = midiMappings[paramId] || "MIDI CONTROLLER";
                
                // Actualizar pantalla LCD temporal con control MIDI
                const lcdText = document.getElementById('lcd-text');
                if (lcdText) {
                    lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">${midiInfo}</span><br><strong>${paramId.toUpperCase()}</strong><br><span style="font-size:15px; color:#ffb700;">${pct.toFixed(2)}</span>`;
                }
            }
        };
        
        slider.addEventListener('mousedown', (e) => {
            isDragging = true;
            updateVal(e.clientY);
        });
        
        window.addEventListener('mousemove', (e) => {
            if (isDragging) {
                updateVal(e.clientY);
            }
        });
        
        window.addEventListener('mouseup', () => {
            isDragging = false;
        });
    });

    // GESTIÓN DEL SELECTOR ACTIVO LFO 1 / LFO 2
    let activeLfoNumber = 1; // 1 o 2
    const lfoSelectBtn = document.getElementById('lfo-select-btn');
    if (lfoSelectBtn) {
        lfoSelectBtn.addEventListener('click', () => {
            activeLfoNumber = activeLfoNumber === 1 ? 2 : 1;
            lfoSelectBtn.innerText = `LFO ${activeLfoNumber} ACTIVE`;
            
            const rateUnit = document.getElementById('lfo-ctrl-rate');
            const delayUnit = document.getElementById('lfo-ctrl-delay');
            const rateLabel = document.getElementById('lfo-label-rate');
            
            if (activeLfoNumber === 1) {
                rateUnit.setAttribute('data-param', 'lfo1_rate');
                delayUnit.setAttribute('data-param', 'lfo1_delay');
                rateLabel.innerText = 'LFO1 Rate';
                lfoSelectBtn.style.color = 'var(--brand-accent)';
            } else {
                rateUnit.setAttribute('data-param', 'lfo2_rate');
                delayUnit.setAttribute('data-param', 'lfo2_delay');
                rateLabel.innerText = 'LFO2 Rate';
                lfoSelectBtn.style.color = '#00ffcc'; // LFO 2
            }
            if (window.updateLfoSlidersFromCurrentPreset) {
                window.updateLfoSlidersFromCurrentPreset();
            }
        });
    }

    // GESTIÓN DEL SELECTOR ACTIVO OSCILLATOR 1 / OSCILLATOR 2
    let activeOscNumber = 1; // 1 o 2
    const oscSelectBtn = document.getElementById('osc-select-btn');
    if (oscSelectBtn) {
        oscSelectBtn.addEventListener('click', () => {
            activeOscNumber = activeOscNumber === 1 ? 2 : 1;
            oscSelectBtn.innerText = `OSC ${activeOscNumber} ACTIVE`;

            const pitchModUnit = document.getElementById('osc-ctrl-pitchmod');
            const pwmToneUnit = document.getElementById('osc-ctrl-pwm-tone');
            const pitchUnit = document.getElementById('osc-ctrl-pitch');
            const levelUnit = document.getElementById('osc-ctrl-level');

            const pitchModLabel = document.getElementById('osc-label-pitchmod');
            const pwmToneLabel = document.getElementById('osc-label-pwm-tone');

            if (activeOscNumber === 1) {
                oscSelectBtn.style.color = 'var(--brand-accent)';
                pitchModUnit.setAttribute('data-param', 'osc1_pitch_mod');
                pwmToneUnit.setAttribute('data-param', 'osc1_pwm_amount');
                pitchModLabel.innerText = 'Pitch Mod';
                pwmToneLabel.innerText = 'PWM';

                pitchUnit.style.display = 'none';
                levelUnit.style.display = 'none';
            } else {
                oscSelectBtn.style.color = '#00ffcc';
                pitchModUnit.setAttribute('data-param', 'osc2_pitch_mod');
                pwmToneUnit.setAttribute('data-param', 'osc2_tone_mod');
                pitchModLabel.innerText = 'Pitch Mod';
                pwmToneLabel.innerText = 'Tone Mod';

                pitchUnit.style.display = 'flex';
                levelUnit.style.display = 'flex';
            }

            if (window.updateOscSlidersFromCurrentPreset) {
                window.updateOscSlidersFromCurrentPreset();
            }
            if (typeof window.syncDetailPanelControls === 'function') {
                window.syncDetailPanelControls();
            }
        });
    }

    // GESTIÓN DEL SELECTOR ACTIVO ENVELOPE VCA / VCF / MOD
    let activeEnvNumber = 1; // 1 = VCA, 2 = VCF, 3 = MOD
    const envBtns = document.querySelectorAll('.env-type-btn');
    envBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            envBtns.forEach(b => {
                b.classList.remove('active');
                b.style.background = "#23252a";
                b.style.borderColor = "#444";
                b.style.color = "var(--text-labels)";
            });

            btn.classList.add('active');
            activeEnvNumber = parseInt(btn.getAttribute('data-env'));

            const atkUnit = document.getElementById('env-ctrl-attack');
            const dcyUnit = document.getElementById('env-ctrl-decay');
            const susUnit = document.getElementById('env-ctrl-sustain');
            const relUnit = document.getElementById('env-ctrl-release');

            if (activeEnvNumber === 1) {
                btn.style.background = "rgba(255, 153, 0, 0.15)";
                btn.style.borderColor = "var(--brand-accent)";
                btn.style.color = "var(--brand-accent)";

                atkUnit.setAttribute('data-param', 'env1_attack');
                dcyUnit.setAttribute('data-param', 'env1_decay');
                susUnit.setAttribute('data-param', 'env1_sustain');
                relUnit.setAttribute('data-param', 'env1_release');
            } else if (activeEnvNumber === 2) {
                btn.style.background = "rgba(0, 255, 204, 0.15)";
                btn.style.borderColor = "#00ffcc";
                btn.style.color = "#00ffcc";

                atkUnit.setAttribute('data-param', 'env2_attack');
                dcyUnit.setAttribute('data-param', 'env2_decay');
                susUnit.setAttribute('data-param', 'env2_sustain');
                relUnit.setAttribute('data-param', 'env2_release');
            } else {
                btn.style.background = "rgba(255, 51, 204, 0.15)";
                btn.style.borderColor = "#ff33cc";
                btn.style.color = "#ff33cc";

                atkUnit.setAttribute('data-param', 'env3_attack');
                dcyUnit.setAttribute('data-param', 'env3_decay');
                susUnit.setAttribute('data-param', 'env3_sustain');
                relUnit.setAttribute('data-param', 'env3_release');
            }

            if (window.updateEnvSlidersFromCurrentPreset) {
                window.updateEnvSlidersFromCurrentPreset();
            }
            if (typeof window.syncDetailPanelControls === 'function') {
                window.syncDetailPanelControls();
            }
        });
    });

    // Pulsadores de botones/LEDs
    document.querySelectorAll('.led').forEach(led => {
        const paramId = led.closest('[data-param]').getAttribute('data-param');
        led.addEventListener('click', () => {
            const active = led.classList.toggle('active');
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter(paramId, active ? 1.0 : 0.0);
            }
        });
    });

    // ESCUCHAR ACTUALIZACIONES DE PARÁMETROS EXTERNOS (MIDI IN / JUCE)
    if (window.dualMidiBridge) {
        window.dualMidiBridge.onParameterChanged((paramId, val) => {
            // 1. Sincronizar Faders
            let sliderUnit = document.querySelector(`[data-param="${paramId}"] .v-slider`);
            
            if (!sliderUnit) {
                const activeAtkParam = document.getElementById('env-ctrl-attack')?.getAttribute('data-param');
                const activeDcyParam = document.getElementById('env-ctrl-decay')?.getAttribute('data-param');
                const activeSusParam = document.getElementById('env-ctrl-sustain')?.getAttribute('data-param');
                const activeRelParam = document.getElementById('env-ctrl-release')?.getAttribute('data-param');
                
                if (paramId === activeAtkParam) sliderUnit = document.querySelector('#env-ctrl-attack .v-slider');
                else if (paramId === activeDcyParam) sliderUnit = document.querySelector('#env-ctrl-decay .v-slider');
                else if (paramId === activeSusParam) sliderUnit = document.querySelector('#env-ctrl-sustain .v-slider');
                else if (paramId === activeRelParam) sliderUnit = document.querySelector('#env-ctrl-release .v-slider');
            }

            if (!sliderUnit) {
                const activePitchModParam = document.getElementById('osc-ctrl-pitchmod')?.getAttribute('data-param');
                const activePwmToneParam = document.getElementById('osc-ctrl-pwm-tone')?.getAttribute('data-param');
                
                if (paramId === activePitchModParam) sliderUnit = document.querySelector('#osc-ctrl-pitchmod .v-slider');
                else if (paramId === activePwmToneParam) sliderUnit = document.querySelector('#osc-ctrl-pwm-tone .v-slider');
            }

            if (sliderUnit) {
                const handle = sliderUnit.querySelector('.handle');
                const rect = sliderUnit.getBoundingClientRect();
                const height = rect.height > 0 ? rect.height : (sliderUnit.clientHeight > 0 ? sliderUnit.clientHeight : 100);
                const handleHeight = 16;
                const pos = (1.0 - val) * (height - handleHeight);
                handle.style.top = pos + 'px';
            }

            // 2. Sincronizar LEDs/Botones y Toggles Especiales
            const ledUnit = document.querySelector(`[data-param="${paramId}"] .led`);
            if (ledUnit) {
                ledUnit.classList.toggle('active', val > 0.5);
            }

            if (paramId === "hpf_boost_enable") {
                const boostBtn = document.getElementById('hpf-boost-btn');
                if (boostBtn) {
                    const active = val > 0.5;
                    boostBtn.innerText = active ? "BOOST ON" : "BOOST OFF";
                    boostBtn.style.color = active ? "var(--brand-accent)" : "var(--text-labels)";
                    boostBtn.style.borderColor = active ? "var(--brand-accent)" : "#444";
                    boostBtn.style.background = active ? "rgba(255, 153, 0, 0.15)" : "#23252a";
                }
            }

            if (paramId === "vca_mode") {
                const modeBtn = document.getElementById('vca-mode-btn');
                if (modeBtn) {
                    const active = val > 0.5;
                    modeBtn.innerText = active ? "BALLSY" : "TRANSPARENT";
                    modeBtn.style.color = active ? "#00ffcc" : "var(--text-labels)";
                    modeBtn.style.borderColor = active ? "#00ffcc" : "#444";
                    modeBtn.style.background = active ? "rgba(0, 255, 204, 0.15)" : "#23252a";
                }
            }
            
            // 3. Mostrar en la pantalla del programador LCD
            const midiMappings = {
                "lfo1_rate": "NRPN 0:00 (CC 16)",
                "lfo1_delay": "NRPN 0:01 (CC 17)",
                "lfo1_slew": "NRPN 0:02",
                "lfo1_shape": "NRPN 0:03",
                "lfo1_key_sync": "NRPN 0:04",
                "lfo1_arp_sync": "NRPN 0:05",
                "lfo1_phase": "NRPN 0:06",
                "lfo2_rate": "NRPN 0:07 (CC 18)",
                "lfo2_delay": "NRPN 0:08 (CC 19)",
                "lfo2_slew": "NRPN 0:09",
                "lfo2_shape": "NRPN 0:10",
                "lfo2_key_sync": "NRPN 0:11",
                "lfo2_arp_sync": "NRPN 0:12",
                "lfo2_phase": "NRPN 0:13",
                "osc1_saw_enable": "NRPN 0:19",
                "osc1_square_enable": "NRPN 0:18",
                "osc1_pwm_amount": "NRPN 0:25 (CC 21)",
                "osc1_range": "NRPN 0:14",
                "osc1_pitch_mod": "NRPN 0:24 (CC 20)",
                "osc2_pitch": "NRPN 0:27 (CC 25)",
                "osc2_tone_mod": "NRPN 0:28 (CC 24)",
                "osc2_level": "NRPN 0:26 (CC 26)",
                "osc2_pitch_mod": "NRPN 0:30 (CC 23)",
                "osc2_range": "NRPN 0:31",
                "noise_level": "NRPN 0:33 (CC 27)",
                "vcf_cutoff": "NRPN 0:39 (CC 29)",
                "vcf_resonance": "NRPN 0:41 (CC 30)",
                "vcf_env_depth": "NRPN 0:42 (CC 31)",
                "vcf_env_vel": "NRPN 0:43",
                "vcf_lfo_depth": "NRPN 0:45 (CC 33)",
                "vcf_lfo_select": "NRPN 0:46",
                "vcf_env_polarity": "NRPN 0:50",
                "vcf_key_tracking": "NRPN 0:44 (CC 34)",
                "vcf_pitch_bend": "NRPN 0:48",
                "hpf_cutoff": "NRPN 0:40 (CC 35)",
                "hpf_boost_enable": "NRPN 0:52",
                "vca_level": "NRPN 0:57 (CC 36)",
                "vca_mode": "NRPN 0:58",
                "vca_env_depth": "NRPN 0:59",
                "vca_vel_sens": "NRPN 0:60",
                "vca_pan_spread": "NRPN 0:61",
                "env1_attack": "NRPN 0:53 (CC 37)",
                "env1_decay": "NRPN 0:54 (CC 39)",
                "env1_sustain": "NRPN 0:55 (CC 40)",
                "env1_release": "NRPN 0:56 (CC 41)",
                "env1_attack_curve": "NRPN 0:46",
                "env1_decay_curve": "NRPN 0:47",
                "env1_sustain_curve": "NRPN 0:48",
                "env1_release_curve": "NRPN 0:49",
                "env1_trigger_mode": "NRPN 1:06",
                "env2_attack": "NRPN 0:65 (CC 42)",
                "env2_decay": "NRPN 0:66 (CC 43)",
                "env2_sustain": "NRPN 0:67 (CC 44)",
                "env2_release": "NRPN 0:68 (CC 45)",
                "env2_attack_curve": "NRPN 0:50",
                "env2_decay_curve": "NRPN 0:51",
                "env2_sustain_curve": "NRPN 0:56",
                "env2_release_curve": "NRPN 0:53",
                "env2_trigger_mode": "NRPN 1:07",
                "env3_attack": "NRPN 0:73 (CC 46)",
                "env3_decay": "NRPN 0:74 (CC 47)",
                "env3_sustain": "NRPN 0:75 (CC 48)",
                "env3_release": "NRPN 0:76 (CC 49)",
                "env3_attack_curve": "NRPN 0:58",
                "env3_decay_curve": "NRPN 0:59",
                "env3_sustain_curve": "NRPN 0:60",
                "env3_release_curve": "NRPN 0:61",
                "env3_trigger_mode": "NRPN 1:08",
                "unison_detune": "NRPN 0:87 (CC 28)",
                "arp_rate": "NRPN 1:29 (CC 12)",
                "arp_gate": "NRPN 1:32 (CC 13)"
            };
            const midiInfo = midiMappings[paramId] || "MIDI CONTROLLER";

            const lcdText = document.getElementById('lcd-text');
            if (lcdText) {
                let displayVal = val.toFixed(2);
                if (paramId === "vca_mode") displayVal = val > 0.5 ? "BALLSY" : "TRANSPARENT";
                if (paramId === "hpf_boost_enable") displayVal = val > 0.5 ? "ON" : "OFF";
                if (paramId.endsWith('_trigger_mode')) {
                    const modes = ["KEY", "LFO 1", "LFO 2", "LOOP", "SEQ"];
                    displayVal = modes[Math.round(val * 4.0)] || "KEY";
                }
                lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">${midiInfo}</span><br><strong>${paramId.toUpperCase()}</strong><br><span style="font-size:15px; color:#ffb700;">${displayVal}</span>`;
            }
        });
    }

    // Inicializar los botones toggle
    const hpfBoostBtn = document.getElementById('hpf-boost-btn');
    if (hpfBoostBtn) {
        hpfBoostBtn.addEventListener('click', () => {
            let active = false;
            if (typeof currentActivePatchIndex !== 'undefined' && currentActivePatchIndex !== -1) {
                const activeBank = loadedBanks[currentActiveBank];
                if (activeBank && activeBank[currentActivePatchIndex]) {
                    const patch = activeBank[currentActivePatchIndex];
                    active = patch.unpackedBytes[52] > 0.5;
                }
            } else {
                active = hpfBoostBtn.innerText.includes("ON");
            }
            const nextVal = active ? 0.0 : 1.0;
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter("hpf_boost_enable", nextVal);
                window.dualMidiBridge.handleParameterChangeFromBackend("hpf_boost_enable", nextVal);
            }
        });
    }

    const vcaModeBtn = document.getElementById('vca-mode-btn');
    if (vcaModeBtn) {
        vcaModeBtn.addEventListener('click', () => {
            let active = false;
            if (typeof currentActivePatchIndex !== 'undefined' && currentActivePatchIndex !== -1) {
                const activeBank = loadedBanks[currentActiveBank];
                if (activeBank && activeBank[currentActivePatchIndex]) {
                    const patch = activeBank[currentActivePatchIndex];
                    active = patch.unpackedBytes[58] > 0.5;
                }
            } else {
                active = vcaModeBtn.innerText.includes("BALLSY");
            }
            const nextVal = active ? 0.0 : 1.0;
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter("vca_mode", nextVal);
                window.dualMidiBridge.handleParameterChangeFromBackend("vca_mode", nextVal);
            }
        });
    }
}

function updateSliderPosition(sliderUnit, val) {
    if (!sliderUnit) return;
    const handle = sliderUnit.querySelector('.handle');
    if (!handle) return;
    const rect = sliderUnit.getBoundingClientRect();
    const height = rect.height > 0 ? rect.height : (sliderUnit.clientHeight > 0 ? sliderUnit.clientHeight : 100);
    const handleHeight = 16;
    const pos = (1.0 - val) * (height - handleHeight);
    handle.style.top = pos + 'px';
}

window.updateEnvSlidersFromCurrentPreset = function() {
    if (!window.dualMidiBridge) return;
    const cache = window.dualMidiBridge.parameterCache;
    const ids = ['env-ctrl-attack', 'env-ctrl-decay', 'env-ctrl-sustain', 'env-ctrl-release'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const paramId = el.getAttribute('data-param');
        if (!paramId) return;
        const val = cache[paramId] !== undefined ? cache[paramId] : 0.0;
        updateSliderPosition(el.querySelector('.v-slider'), val);
    });
};

window.updateLfoSlidersFromCurrentPreset = function() {
    if (!window.dualMidiBridge) return;
    const cache = window.dualMidiBridge.parameterCache;
    const ids = ['lfo-ctrl-rate', 'lfo-ctrl-delay'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const paramId = el.getAttribute('data-param');
        if (!paramId) return;
        const val = cache[paramId] !== undefined ? cache[paramId] : 0.0;
        updateSliderPosition(el.querySelector('.v-slider'), val);
    });
};

window.updateOscSlidersFromCurrentPreset = function() {
    if (!window.dualMidiBridge) return;
    const cache = window.dualMidiBridge.parameterCache;
    const ids = ['osc-ctrl-pitchmod', 'osc-ctrl-pwm-tone', 'osc-ctrl-pitch', 'osc-ctrl-level'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const paramId = el.getAttribute('data-param');
        if (!paramId) return;
        const val = cache[paramId] !== undefined ? cache[paramId] : 0.0;
        updateSliderPosition(el.querySelector('.v-slider'), val);
    });
};

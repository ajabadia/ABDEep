/**
 * @purpose Controlador del panel de edición detallada lateral (deslizable), renderizando faders y selectores según el módulo seleccionado.
 * @purpose_en Slide-out detail editor panel controller, rendering dynamic sub-controls and dropdowns based on selected module mode.
 * @refactorable true (contains massive HTML template rendering and direct DOM bindings)
 * @classification UI Controller Service
 * @complexity High
 * @fingerprint exports:4,imports:3,sig:1e8m02k
 * @lastUpdated 2026-07-04T15:56:41.000Z
 */
/* --- ABDEEP DETAIL EDIT PANEL LOGIC ---
   Este archivo gestiona el panel deslizable izquierdo reutilizable
   y los componentes de control detallados para LFO 1 & 2, VCA, Envelopes, HPF, VCF y Oscillators.
*/

document.addEventListener('DOMContentLoaded', () => {
    initDetailEditPanel();
});

function initDetailEditPanel() {
    const lfoEditBtn = document.getElementById('lfo-edit-btn');
    const vcaEditBtn = document.getElementById('vca-edit-btn');
    const envEditBtn = document.getElementById('env-edit-btn');
    const hpfEditBtn = document.getElementById('hpf-edit-btn');
    const vcfEditBtn = document.getElementById('vcf-edit-btn');
    const oscEditBtn = document.getElementById('osc-edit-btn');
    const panel = document.getElementById('detail-edit-panel');
    const closeBtn = document.getElementById('panel-close-btn');
    const container = document.getElementById('panel-dynamic-controls');
    const titleEl = document.getElementById('panel-title');

    if (!panel || !closeBtn || !container) return;

    // Estado activo: 'LFO', 'VCA', 'ENV', 'HPF', 'VCF' o 'OSC'
    let currentPanelMode = 'LFO';
    let panelActiveLfo = 1; 
    let panelActiveEnv = 1; // 1 = VCA, 2 = VCF, 3 = MOD
    let panelActiveOsc = 1; // 1 o 2

    // Función para actualizar los leds y controles en el panel en base al modo activo
    window.syncDetailPanelControls = () => {
        if (currentPanelMode === 'LFO') {
            // --- MODO LFO ---
            const lfoSelectBtn = document.getElementById('lfo-select-btn');
            if (lfoSelectBtn) {
                panelActiveLfo = lfoSelectBtn.innerText.includes('LFO 2') ? 2 : 1;
            }

            titleEl.innerText = `LFO ${panelActiveLfo} Editor`;
            const prefix = `lfo${panelActiveLfo}_`;
            
            container.innerHTML = `
                <div class="panel-section-title">LFO Waveform Shape</div>
                <div class="shape-selector-container">
                    <div class="shape-led-row" data-shape="0" data-param="${prefix}shape">
                        <div class="led-dot"></div>
                        <span class="shape-name">Sine</span>
                    </div>
                    <div class="shape-led-row" data-shape="1" data-param="${prefix}shape">
                        <div class="led-dot"></div>
                        <span class="shape-name">Triangle</span>
                    </div>
                    <div class="shape-led-row" data-shape="2" data-param="${prefix}shape">
                        <div class="led-dot"></div>
                        <span class="shape-name">Square</span>
                    </div>
                    <div class="shape-led-row" data-shape="3" data-param="${prefix}shape">
                        <div class="led-dot"></div>
                        <span class="shape-name">Ramp Up</span>
                    </div>
                    <div class="shape-led-row" data-shape="4" data-param="${prefix}shape">
                        <div class="led-dot"></div>
                        <span class="shape-name">Ramp Down</span>
                    </div>
                    <div class="shape-led-row" data-shape="5" data-param="${prefix}shape">
                        <div class="led-dot"></div>
                        <span class="shape-name">Sample & Hold</span>
                    </div>
                    <div class="shape-led-row" data-shape="6" data-param="${prefix}shape">
                        <div class="led-dot"></div>
                        <span class="shape-name">Sample & Glide</span>
                    </div>
                </div>

                <div class="panel-section-title">Modulation & Rates</div>
                <div class="panel-row" style="margin-top: 5px; margin-bottom: 5px;">
                    <div class="ctrl-unit" data-param="${prefix}rate" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px; margin-bottom: 4px;">Rate</span>
                        <div class="v-slider" style="height: 80px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    
                    <div class="ctrl-unit" data-param="${prefix}delay" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px; margin-bottom: 4px;">Delay</span>
                        <div class="v-slider" style="height: 80px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>

                    <div class="ctrl-unit" data-param="${prefix}slew" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px; margin-bottom: 4px;">Slew</span>
                        <div class="v-slider" style="height: 80px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>

                    <div class="ctrl-unit" data-param="${prefix}phase" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px; margin-bottom: 4px;">Phase</span>
                        <div class="v-slider" style="height: 80px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                </div>

                <div class="panel-section-title">Sync Options</div>
                <div style="display: flex; flex-direction: row; gap: 8px; width: 100%;">
                    <div class="toggle-box" id="lfo-key-sync-box" data-param="${prefix}key_sync">
                        <span class="toggle-label">Key Sync</span>
                        <div class="toggle-led"></div>
                    </div>
                    <div class="toggle-box" id="lfo-arp-sync-box" data-param="${prefix}arp_sync">
                        <span class="toggle-label">Arp Sync</span>
                        <div class="toggle-led"></div>
                    </div>
                </div>
            `;

            container.querySelectorAll('.shape-led-row').forEach(row => {
                row.addEventListener('click', () => {
                    const shapeVal = parseInt(row.getAttribute('data-shape'));
                    const paramId = row.getAttribute('data-param');
                    container.querySelectorAll('.shape-led-row').forEach(r => r.classList.remove('active'));
                    row.classList.add('active');
                    if (window.dualMidiBridge) window.dualMidiBridge.setParameter(paramId, shapeVal / 6.0);
                });
            });

            container.querySelectorAll('.toggle-box').forEach(box => {
                box.addEventListener('click', () => {
                    const paramId = box.getAttribute('data-param');
                    const isCurrentlyActive = box.classList.toggle('active');
                    if (window.dualMidiBridge) window.dualMidiBridge.setParameter(paramId, isCurrentlyActive ? 1.0 : 0.0);
                });
            });

        } else if (currentPanelMode === 'VCA') {
            // --- MODO VCA ---
            titleEl.innerText = "VCA Editor";
            
            container.innerHTML = `
                <div class="panel-section-title">VCA Sound Mode</div>
                <div style="display: flex; flex-direction: row; gap: 10px; width: 100%; margin-bottom: 5px;">
                    <div class="toggle-box" id="panel-vca-mode-transparent" data-param="vca_mode" style="flex: 1;">
                        <span class="toggle-label">Transparent</span>
                        <div class="toggle-led"></div>
                    </div>
                    <div class="toggle-box" id="panel-vca-mode-ballsy" data-param="vca_mode" style="flex: 1;">
                        <span class="toggle-label">Ballsy</span>
                        <div class="toggle-led"></div>
                    </div>
                </div>

                <div class="panel-section-title">VCA Level & Modulation</div>
                <div class="panel-row" style="margin-top: 5px; margin-bottom: 5px; justify-content: space-around;">
                    <div class="ctrl-unit" data-param="vca_level" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px; margin-bottom: 4px;">Level</span>
                        <div class="v-slider" style="height: 100px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    
                    <div class="ctrl-unit" data-param="vca_env_depth" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px; margin-bottom: 4px;">Env Depth</span>
                        <div class="v-slider" style="height: 100px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>

                    <div class="ctrl-unit" data-param="vca_vel_sens" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px; margin-bottom: 4px;">Vel Sens</span>
                        <div class="v-slider" style="height: 100px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>

                    <div class="ctrl-unit" data-param="vca_pan_spread" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px; margin-bottom: 4px;">Pan Spread</span>
                        <div class="v-slider" style="height: 100px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                </div>
            `;

            const btnTransparent = document.getElementById('panel-vca-mode-transparent');
            const btnBallsy = document.getElementById('panel-vca-mode-ballsy');
            
            if (btnTransparent && btnBallsy) {
                btnTransparent.addEventListener('click', () => {
                    if (window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter("vca_mode", 0.0);
                        window.dualMidiBridge.handleParameterChangeFromBackend("vca_mode", 0.0);
                    }
                });
                btnBallsy.addEventListener('click', () => {
                    if (window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter("vca_mode", 1.0);
                        window.dualMidiBridge.handleParameterChangeFromBackend("vca_mode", 1.0);
                    }
                });
            }

        } else if (currentPanelMode === 'ENV') {
            // --- MODO ENVELOPE (VCA / VCF / MOD) ---
            const prefix = `env${panelActiveEnv}_`;
            const envName = panelActiveEnv === 1 ? "VCA" : (panelActiveEnv === 2 ? "VCF" : "MOD");
            titleEl.innerText = `${envName} Env Editor`;

            container.innerHTML = `
                <div class="panel-section-title">Envelope Curves (ADSR)</div>
                <div class="panel-row" style="margin-top: 5px; margin-bottom: 5px;">
                    <div class="ctrl-unit" data-param="${prefix}attack_curve" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px; margin-bottom: 4px;">Atk Curv</span>
                        <div class="v-slider" style="height: 70px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    <div class="ctrl-unit" data-param="${prefix}decay_curve" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px; margin-bottom: 4px;">Dec Curv</span>
                        <div class="v-slider" style="height: 70px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    <div class="ctrl-unit" data-param="${prefix}sustain_curve" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px; margin-bottom: 4px;">Sus Curv</span>
                        <div class="v-slider" style="height: 70px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    <div class="ctrl-unit" data-param="${prefix}release_curve" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px; margin-bottom: 4px;">Rel Curv</span>
                        <div class="v-slider" style="height: 70px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                </div>

                <div class="panel-section-title">Envelope Times / ADSR faders</div>
                <div class="panel-row" style="margin-top: 5px; margin-bottom: 5px;">
                    <div class="ctrl-unit" data-param="${prefix}attack" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px; margin-bottom: 4px;">Attack</span>
                        <div class="v-slider" style="height: 70px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    <div class="ctrl-unit" data-param="${prefix}decay" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px; margin-bottom: 4px;">Decay</span>
                        <div class="v-slider" style="height: 70px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    <div class="ctrl-unit" data-param="${prefix}sustain" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px; margin-bottom: 4px;">Sustain</span>
                        <div class="v-slider" style="height: 70px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    <div class="ctrl-unit" data-param="${prefix}release" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px; margin-bottom: 4px;">Release</span>
                        <div class="v-slider" style="height: 70px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                </div>

                <div class="panel-section-title">Envelope Trigger Source</div>
                <div class="shape-selector-container">
                    <div class="shape-led-row" data-trig="0" data-param="${prefix}trigger_mode">
                        <div class="led-dot"></div>
                        <span class="shape-name">Key</span>
                    </div>
                    <div class="shape-led-row" data-trig="1" data-param="${prefix}trigger_mode">
                        <div class="led-dot"></div>
                        <span class="shape-name">LFO 1</span>
                    </div>
                    <div class="shape-led-row" data-trig="2" data-param="${prefix}trigger_mode">
                        <div class="led-dot"></div>
                        <span class="shape-name">LFO 2</span>
                    </div>
                    <div class="shape-led-row" data-trig="3" data-param="${prefix}trigger_mode">
                        <div class="led-dot"></div>
                        <span class="shape-name">Loop</span>
                    </div>
                    <div class="shape-led-row" data-trig="4" data-param="${prefix}trigger_mode">
                        <div class="led-dot"></div>
                        <span class="shape-name">Sequence</span>
                    </div>
                </div>
            `;

            container.querySelectorAll('.shape-led-row').forEach(row => {
                row.addEventListener('click', () => {
                    const trigVal = parseInt(row.getAttribute('data-trig'));
                    const paramId = row.getAttribute('data-param');
                    container.querySelectorAll('.shape-led-row').forEach(r => r.classList.remove('active'));
                    row.classList.add('active');
                    if (window.dualMidiBridge) window.dualMidiBridge.setParameter(paramId, trigVal / 4.0);
                });
            });

        } else if (currentPanelMode === 'HPF') {
            // --- MODO HPF ---
            titleEl.innerText = "HPF Editor";
            
            container.innerHTML = `
                <div class="panel-section-title">HPF Bass Boost</div>
                <div style="display: flex; flex-direction: row; gap: 10px; width: 100%; margin-bottom: 5px;">
                    <div class="toggle-box" id="panel-hpf-boost-off" style="flex: 1;">
                        <span class="toggle-label">Boost Off</span>
                        <div class="toggle-led"></div>
                    </div>
                    <div class="toggle-box" id="panel-hpf-boost-on" style="flex: 1;">
                        <span class="toggle-label">Boost On</span>
                        <div class="toggle-led"></div>
                    </div>
                </div>

                <div class="panel-section-title">HPF Cutoff Frequency</div>
                <div class="panel-row" style="margin-top: 5px; margin-bottom: 5px; justify-content: center;">
                    <div class="ctrl-unit" data-param="hpf_cutoff" style="width: 50%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 8px; margin-bottom: 4px;">Frequency</span>
                        <div class="v-slider" style="height: 110px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                </div>
            `;

            const btnBoostOff = document.getElementById('panel-hpf-boost-off');
            const btnBoostOn = document.getElementById('panel-hpf-boost-on');
            
            if (btnBoostOff && btnBoostOn) {
                btnBoostOff.addEventListener('click', () => {
                    if (window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter("hpf_boost_enable", 0.0);
                        window.dualMidiBridge.handleParameterChangeFromBackend("hpf_boost_enable", 0.0);
                    }
                });
                btnBoostOn.addEventListener('click', () => {
                    if (window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter("hpf_boost_enable", 1.0);
                        window.dualMidiBridge.handleParameterChangeFromBackend("hpf_boost_enable", 1.0);
                    }
                });
            }

        } else if (currentPanelMode === 'VCF') {
            // --- MODO VCF (FILTRO RESIDUAL DE POLOS E INVERSIÓN) ---
            titleEl.innerText = "VCF Filter Editor";

            container.innerHTML = `
                <div class="panel-section-title">Filter Slopes / Mode</div>
                <div style="display: flex; flex-direction: row; gap: 8px; width: 100%; margin-bottom: 10px;">
                    <div class="toggle-box" id="panel-vcf-pole-2" style="flex: 1;">
                        <span class="toggle-label">2-Pole (12dB)</span>
                        <div class="toggle-led"></div>
                    </div>
                    <div class="toggle-box" id="panel-vcf-pole-4" style="flex: 1;">
                        <span class="toggle-label">4-Pole (24dB)</span>
                        <div class="toggle-led"></div>
                    </div>
                </div>

                <div class="panel-section-title">Envelope Polarity / Phase</div>
                <div style="display: flex; flex-direction: row; gap: 8px; width: 100%; margin-bottom: 10px;">
                    <div class="toggle-box" id="panel-vcf-pol-normal" style="flex: 1;">
                        <span class="toggle-label">Normal</span>
                        <div class="toggle-led"></div>
                    </div>
                    <div class="toggle-box" id="panel-vcf-pol-inverted" style="flex: 1;">
                        <span class="toggle-label">Inverted</span>
                        <div class="toggle-led"></div>
                    </div>
                </div>

                <div class="panel-section-title">Filter LFO Modulation Source</div>
                <div style="display: flex; flex-direction: row; gap: 8px; width: 100%; margin-bottom: 10px;">
                    <div class="toggle-box" id="panel-vcf-lfosrc-1" style="flex: 1;">
                        <span class="toggle-label">LFO 1</span>
                        <div class="toggle-led"></div>
                    </div>
                    <div class="toggle-box" id="panel-vcf-lfosrc-2" style="flex: 1;">
                        <span class="toggle-label">LFO 2</span>
                        <div class="toggle-led"></div>
                    </div>
                </div>

                <div class="panel-section-title">VCF Faders & Modulators</div>
                <div class="panel-row" style="margin-top: 5px; margin-bottom: 5px;">
                    <div class="ctrl-unit" data-param="vcf_cutoff" style="width: 18%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px;">Cutoff</span>
                        <div class="v-slider" style="height: 80px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    <div class="ctrl-unit" data-param="vcf_resonance" style="width: 18%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px;">Res</span>
                        <div class="v-slider" style="height: 80px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    <div class="ctrl-unit" data-param="vcf_env_depth" style="width: 18%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px;">Env Dep</span>
                        <div class="v-slider" style="height: 80px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    <div class="ctrl-unit" data-param="vcf_env_vel" style="width: 18%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px;">Env Vel</span>
                        <div class="v-slider" style="height: 80px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    <div class="ctrl-unit" data-param="vcf_lfo_depth" style="width: 18%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px;">LFO Dep</span>
                        <div class="v-slider" style="height: 80px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                </div>
            `;

            // Configurar click listeners para poles
            const btnPole2 = document.getElementById('panel-vcf-pole-2');
            const btnPole4 = document.getElementById('panel-vcf-pole-4');
            if (btnPole2 && btnPole4) {
                btnPole2.addEventListener('click', () => {
                    if (window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter("vcf_pole_mode", 0.0);
                        window.dualMidiBridge.handleParameterChangeFromBackend("vcf_pole_mode", 0.0);
                    }
                });
                btnPole4.addEventListener('click', () => {
                    if (window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter("vcf_pole_mode", 1.0);
                        window.dualMidiBridge.handleParameterChangeFromBackend("vcf_pole_mode", 1.0);
                    }
                });
            }

            // Configurar click listeners para polaridad
            const btnPolNorm = document.getElementById('panel-vcf-pol-normal');
            const btnPolInv = document.getElementById('panel-vcf-pol-inverted');
            if (btnPolNorm && btnPolInv) {
                btnPolNorm.addEventListener('click', () => {
                    if (window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter("vcf_env_polarity", 1.0);
                        window.dualMidiBridge.handleParameterChangeFromBackend("vcf_env_polarity", 1.0);
                    }
                });
                btnPolInv.addEventListener('click', () => {
                    if (window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter("vcf_env_polarity", 0.0);
                        window.dualMidiBridge.handleParameterChangeFromBackend("vcf_env_polarity", 0.0);
                    }
                });
            }

            // Configurar click listeners para LFO select
            const btnLfoSrc1 = document.getElementById('panel-vcf-lfosrc-1');
            const btnLfoSrc2 = document.getElementById('panel-vcf-lfosrc-2');
            if (btnLfoSrc1 && btnLfoSrc2) {
                btnLfoSrc1.addEventListener('click', () => {
                    if (window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter("vcf_lfo_select", 0.0);
                        window.dualMidiBridge.handleParameterChangeFromBackend("vcf_lfo_select", 0.0);
                    }
                });
                btnLfoSrc2.addEventListener('click', () => {
                    if (window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter("vcf_lfo_select", 1.0);
                        window.dualMidiBridge.handleParameterChangeFromBackend("vcf_lfo_select", 1.0);
                    }
                });
            }

        } else if (currentPanelMode === 'OSC') {
            // --- MODO OSCILLATORS ---
            const oscSelectBtn = document.getElementById('osc-select-btn');
            if (oscSelectBtn) {
                panelActiveOsc = oscSelectBtn.innerText.includes('OSC 2') ? 2 : 1;
            }

            titleEl.innerText = `OSC ${panelActiveOsc} Editor`;

            if (panelActiveOsc === 1) {
                container.innerHTML = `
                    <div class="panel-section-title">OSC 1 Waveforms</div>
                    <div style="display: flex; flex-direction: row; gap: 8px; width: 100%; margin-bottom: 10px;">
                        <div class="toggle-box" id="panel-osc1-saw-box" data-param="osc1_saw_enable" style="flex: 1;">
                            <span class="toggle-label">Sawtooth</span>
                            <div class="toggle-led"></div>
                        </div>
                        <div class="toggle-box" id="panel-osc1-square-box" data-param="osc1_square_enable" style="flex: 1;">
                            <span class="toggle-label">Square</span>
                            <div class="toggle-led"></div>
                        </div>
                    </div>

                    <div class="panel-section-title">OSC 1 Pitch Range</div>
                    <div style="display: flex; flex-direction: row; gap: 4px; width: 100%; margin-bottom: 10px;">
                        <button class="env-type-btn" id="panel-osc1-rng-16" style="flex: 1; font-size: 8px; padding: 3px 0;">16'</button>
                        <button class="env-type-btn" id="panel-osc1-rng-8" style="flex: 1; font-size: 8px; padding: 3px 0;">8'</button>
                        <button class="env-type-btn" id="panel-osc1-rng-4" style="flex: 1; font-size: 8px; padding: 3px 0;">4'</button>
                    </div>

                    <div class="panel-section-title">Pitch Mod Destination Mode</div>
                    <div style="display: flex; flex-direction: row; gap: 4px; width: 100%; margin-bottom: 10px;">
                        <button class="env-type-btn" id="panel-osc1-pmode-12" style="flex: 1; font-size: 8px; padding: 3px 0;">OSC 1+2</button>
                        <button class="env-type-btn" id="panel-osc1-pmode-1" style="flex: 1; font-size: 8px; padding: 3px 0;">OSC 1</button>
                    </div>

                    <div class="panel-section-title">Modulation Sources Selection</div>
                    <div style="margin-bottom: 10px; width: 100%;">
                        <span class="label" style="font-size: 7px; color: var(--text-labels); display: block; margin-bottom: 3px;">P.MOD SOURCE</span>
                        <select id="panel-osc1-pmod-src-select" style="background: #1b1c20; color: #fff; border: 1px solid #444; border-radius: 3px; font-size: 9px; padding: 3px; width: 100%;">
                            <option value="0">LFO 1</option>
                            <option value="1">LFO 2</option>
                            <option value="2">ENV 1</option>
                            <option value="3">ENV 2</option>
                            <option value="4">ENV 3</option>
                            <option value="5">LFO 1 (Uni)</option>
                            <option value="6">LFO 2 (Uni)</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 10px; width: 100%;">
                        <span class="label" style="font-size: 7px; color: var(--text-labels); display: block; margin-bottom: 3px;">PWM SOURCE</span>
                        <select id="panel-osc1-pwm-src-select" style="background: #1b1c20; color: #fff; border: 1px solid #444; border-radius: 3px; font-size: 9px; padding: 3px; width: 100%;">
                            <option value="0">Manual</option>
                            <option value="1">LFO 1</option>
                            <option value="2">LFO 2</option>
                            <option value="3">ENV 1</option>
                            <option value="4">ENV 2</option>
                            <option value="5">ENV 3</option>
                        </select>
                    </div>

                    <div class="panel-section-title">OSC 1 Faders</div>
                    <div class="panel-row" style="margin-top: 5px; margin-bottom: 5px; justify-content: space-around;">
                        <div class="ctrl-unit" data-param="osc1_pitch_mod" style="width: 45%; align-items: center; display: flex; flex-direction: column;">
                            <span class="label" style="font-size: 8px;">Pitch Mod</span>
                            <div class="v-slider" style="height: 100px;">
                                <div class="track"></div>
                                <div class="handle"></div>
                            </div>
                        </div>
                        <div class="ctrl-unit" data-param="osc1_pwm_amount" style="width: 45%; align-items: center; display: flex; flex-direction: column;">
                            <span class="label" style="font-size: 8px;">PWM</span>
                            <div class="v-slider" style="height: 100px;">
                                <div class="track"></div>
                                <div class="handle"></div>
                            </div>
                        </div>
                    </div>
                `;

                // Listeners
                container.querySelectorAll('.toggle-box').forEach(box => {
                    box.addEventListener('click', () => {
                        const paramId = box.getAttribute('data-param');
                        const isCurrentlyActive = box.classList.toggle('active');
                        if (window.dualMidiBridge) window.dualMidiBridge.setParameter(paramId, isCurrentlyActive ? 1.0 : 0.0);
                    });
                });

                const selectPmod = document.getElementById('panel-osc1-pmod-src-select');
                if (selectPmod) {
                    selectPmod.addEventListener('change', () => {
                        if (window.dualMidiBridge) window.dualMidiBridge.setParameter("osc1_pm_source", parseInt(selectPmod.value) / 23.0);
                    });
                }

                const selectPwm = document.getElementById('panel-osc1-pwm-src-select');
                if (selectPwm) {
                    selectPwm.addEventListener('change', () => {
                        if (window.dualMidiBridge) window.dualMidiBridge.setParameter("osc1_pwm_source", parseInt(selectPwm.value) / 23.0);
                    });
                }

                const btn16 = document.getElementById('panel-osc1-rng-16');
                const btn8 = document.getElementById('panel-osc1-rng-8');
                const btn4 = document.getElementById('panel-osc1-rng-4');
                if (btn16 && btn8 && btn4) {
                    btn16.addEventListener('click', () => {
                        if (window.dualMidiBridge) window.dualMidiBridge.setParameter("osc1_range", 0.0);
                    });
                    btn8.addEventListener('click', () => {
                        if (window.dualMidiBridge) window.dualMidiBridge.setParameter("osc1_range", 0.5);
                    });
                    btn4.addEventListener('click', () => {
                        if (window.dualMidiBridge) window.dualMidiBridge.setParameter("osc1_range", 1.0);
                    });
                }

                const btnPmode12 = document.getElementById('panel-osc1-pmode-12');
                const btnPmode1 = document.getElementById('panel-osc1-pmode-1');
                if (btnPmode12 && btnPmode1) {
                    btnPmode12.addEventListener('click', () => {
                        if (window.dualMidiBridge) window.dualMidiBridge.setParameter("osc1_pm_mode", 0.0);
                    });
                    btnPmode1.addEventListener('click', () => {
                        if (window.dualMidiBridge) window.dualMidiBridge.setParameter("osc1_pm_mode", 1.0);
                    });
                }

            } else {
                container.innerHTML = `
                    <div class="panel-section-title">OSC 2 Pitch Range</div>
                    <div style="display: flex; flex-direction: row; gap: 4px; width: 100%; margin-bottom: 10px;">
                        <button class="env-type-btn" id="panel-osc2-rng-16" style="flex: 1; font-size: 8px; padding: 3px 0;">16'</button>
                        <button class="env-type-btn" id="panel-osc2-rng-8" style="flex: 1; font-size: 8px; padding: 3px 0;">8'</button>
                        <button class="env-type-btn" id="panel-osc2-rng-4" style="flex: 1; font-size: 8px; padding: 3px 0;">4'</button>
                    </div>

                    <div class="panel-section-title">OSC Hard Sync</div>
                    <div style="display: flex; justify-content: center; width: 100%; margin-bottom: 10px;">
                        <div class="toggle-box" id="panel-osc-sync-box" data-param="osc_sync_enable" style="width: 80%;">
                            <span class="toggle-label">Hard Sync Enable</span>
                            <div class="toggle-led"></div>
                        </div>
                    </div>

                    <div class="panel-section-title">Modulation Sources Selection</div>
                    <div style="margin-bottom: 10px; width: 100%;">
                        <span class="label" style="font-size: 7px; color: var(--text-labels); display: block; margin-bottom: 3px;">P.MOD SOURCE</span>
                        <select id="panel-osc2-pmod-src-select" style="background: #1b1c20; color: #fff; border: 1px solid #444; border-radius: 3px; font-size: 9px; padding: 3px; width: 100%;">
                            <option value="0">LFO 1</option>
                            <option value="1">LFO 2</option>
                            <option value="2">ENV 1</option>
                            <option value="3">ENV 2</option>
                            <option value="4">ENV 3</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 10px; width: 100%;">
                        <span class="label" style="font-size: 7px; color: var(--text-labels); display: block; margin-bottom: 3px;">TONE MOD SOURCE</span>
                        <select id="panel-osc2-tpm-src-select" style="background: #1b1c20; color: #fff; border: 1px solid #444; border-radius: 3px; font-size: 9px; padding: 3px; width: 100%;">
                            <option value="0">Manual</option>
                            <option value="1">LFO 1</option>
                            <option value="2">LFO 2</option>
                            <option value="3">ENV 1</option>
                            <option value="4">ENV 2</option>
                            <option value="5">ENV 3</option>
                        </select>
                    </div>

                    <div class="panel-section-title">OSC 2 Faders</div>
                    <div class="panel-row" style="margin-top: 5px; margin-bottom: 5px; justify-content: space-around;">
                        <div class="ctrl-unit" data-param="osc2_pitch_mod" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                            <span class="label" style="font-size: 7px;">Pitch Mod</span>
                            <div class="v-slider" style="height: 80px;">
                                <div class="track"></div>
                                <div class="handle"></div>
                            </div>
                        </div>
                        <div class="ctrl-unit" data-param="osc2_tone_mod" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                            <span class="label" style="font-size: 7px;">Tone Mod</span>
                            <div class="v-slider" style="height: 80px;">
                                <div class="track"></div>
                                <div class="handle"></div>
                            </div>
                        </div>
                        <div class="ctrl-unit" data-param="osc2_pitch" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                            <span class="label" style="font-size: 7px;">Pitch</span>
                            <div class="v-slider" style="height: 80px;">
                                <div class="track"></div>
                                <div class="handle"></div>
                            </div>
                        </div>
                        <div class="ctrl-unit" data-param="osc2_level" style="width: 23%; align-items: center; display: flex; flex-direction: column;">
                            <span class="label" style="font-size: 7px;">Level</span>
                            <div class="v-slider" style="height: 80px;">
                                <div class="track"></div>
                                <div class="handle"></div>
                            </div>
                        </div>
                    </div>
                `;

                const btnSync = document.getElementById('panel-osc-sync-box');
                if (btnSync) {
                    btnSync.addEventListener('click', () => {
                        const active = btnSync.classList.toggle('active');
                        if (window.dualMidiBridge) window.dualMidiBridge.setParameter("osc_sync_enable", active ? 1.0 : 0.0);
                    });
                }

                const selectOsc2Pmod = document.getElementById('panel-osc2-pmod-src-select');
                if (selectOsc2Pmod) {
                    selectOsc2Pmod.addEventListener('change', () => {
                        if (window.dualMidiBridge) window.dualMidiBridge.setParameter("osc2_pm_source", parseInt(selectOsc2Pmod.value) / 23.0);
                    });
                }

                const selectOsc2Tmod = document.getElementById('panel-osc2-tpm-src-select');
                if (selectOsc2Tmod) {
                    selectOsc2Tmod.addEventListener('change', () => {
                        if (window.dualMidiBridge) window.dualMidiBridge.setParameter("osc2_tpm_source", parseInt(selectOsc2Tmod.value) / 23.0);
                    });
                }

                const btn16 = document.getElementById('panel-osc2-rng-16');
                const btn8 = document.getElementById('panel-osc2-rng-8');
                const btn4 = document.getElementById('panel-osc2-rng-4');
                if (btn16 && btn8 && btn4) {
                    btn16.addEventListener('click', () => {
                        if (window.dualMidiBridge) window.dualMidiBridge.setParameter("osc2_range", 0.0);
                    });
                    btn8.addEventListener('click', () => {
                        if (window.dualMidiBridge) window.dualMidiBridge.setParameter("osc2_range", 0.5);
                    });
                    btn4.addEventListener('click', () => {
                        if (window.dualMidiBridge) window.dualMidiBridge.setParameter("osc2_range", 1.0);
                    });
                }
            }
        } else if (currentPanelMode === 'POLY') {
            // --- MODO POLY / UNISON ---
            titleEl.innerText = "Polyphony & Unison";

            container.innerHTML = `
                <div class="panel-section-title">Voice Mode Selection</div>
                <div style="margin-bottom: 10px; width: 100%;">
                    <select id="panel-poly-mode-select" style="background: #1b1c20; color: #fff; border: 1px solid #444; border-radius: 3px; font-size: 9px; padding: 4px; width: 100%;">
                        <option value="0">Polyphonic Mode</option>
                        <option value="1">Monophonic Mode</option>
                        <option value="2">Mono-2 Mode</option>
                    </select>
                </div>

                <div class="panel-section-title">Unison Voice Count</div>
                <div style="margin-bottom: 10px; width: 100%;">
                    <select id="panel-unison-voices-select" style="background: #1b1c20; color: #fff; border: 1px solid #444; border-radius: 3px; font-size: 9px; padding: 4px; width: 100%;">
                        <option value="0">Poly (Off)</option>
                        <option value="1">Unison-2 voices</option>
                        <option value="2">Unison-3 voices</option>
                        <option value="3">Unison-4 voices</option>
                        <option value="4">Unison-6 voices</option>
                        <option value="5">Unison-12 voices</option>
                    </select>
                </div>

                <div class="panel-section-title">Unison Fine Parameters</div>
                <div class="panel-row" style="margin-top: 5px; margin-bottom: 5px; justify-content: space-around;">
                    <div class="ctrl-unit" data-param="unison_detune" style="width: 45%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 8px;">Detune</span>
                        <div class="v-slider" style="height: 100px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    
                    <div class="ctrl-unit" data-param="voice_drift" style="width: 45%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 8px;">Drift Amount</span>
                        <div class="v-slider" style="height: 100px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                </div>
            `;

            const selectPolyMode = document.getElementById('panel-poly-mode-select');
            if (selectPolyMode) {
                selectPolyMode.addEventListener('change', () => {
                    if (window.dualMidiBridge) window.dualMidiBridge.setParameter("voice_mode", parseInt(selectPolyMode.value) / 2.0);
                });
            }

            const selectUnisonVoices = document.getElementById('panel-unison-voices-select');
            if (selectUnisonVoices) {
                selectUnisonVoices.addEventListener('change', () => {
                    if (window.dualMidiBridge) window.dualMidiBridge.setParameter("unison_voices", parseInt(selectUnisonVoices.value) / 5.0);
                });
            }
        } else if (currentPanelMode === 'PORTA') {
            // --- MODO PORTAMENTO ---
            titleEl.innerText = "Glide & Voice Settings";

            container.innerHTML = `
                <div class="panel-section-title">Portamento & Voice Modes</div>
                <div style="margin-bottom: 8px; width: 100%;">
                    <span class="label" style="font-size: 7px; color: var(--text-labels); display: block; margin-bottom: 2px;">PORTA MODE</span>
                    <select id="panel-porta-mode-select" style="background: #1b1c20; color: #fff; border: 1px solid #444; border-radius: 3px; font-size: 9px; padding: 3px; width: 100%;">
                        <option value="0">Normal</option>
                        <option value="1">Fingered</option>
                        <option value="2">Fix-Rate</option>
                        <option value="3">Fix-Fing</option>
                        <option value="4">Exp</option>
                        <option value="5">Exp-Fing</option>
                        <option value="6">Fixed+2</option>
                        <option value="7">Fixed-2</option>
                        <option value="8">Fixed+5</option>
                        <option value="9">Fixed-5</option>
                    </select>
                </div>

                <div style="margin-bottom: 8px; width: 100%;">
                    <span class="label" style="font-size: 7px; color: var(--text-labels); display: block; margin-bottom: 2px;">NOTE PRIORITY</span>
                    <select id="panel-note-priority-select" style="background: #1b1c20; color: #fff; border: 1px solid #444; border-radius: 3px; font-size: 9px; padding: 3px; width: 100%;">
                        <option value="0">Lowest</option>
                        <option value="1">Highest</option>
                        <option value="2">Last</option>
                    </select>
                </div>

                <div style="margin-bottom: 12px; width: 100%;">
                    <span class="label" style="font-size: 7px; color: var(--text-labels); display: block; margin-bottom: 2px;">TRIGGER MODE</span>
                    <select id="panel-trigger-mode-select" style="background: #1b1c20; color: #fff; border: 1px solid #444; border-radius: 3px; font-size: 9px; padding: 3px; width: 100%;">
                        <option value="0">Mono</option>
                        <option value="1">Retrig</option>
                        <option value="2">Legato</option>
                        <option value="3">One-shot</option>
                    </select>
                </div>

                <div class="panel-section-title">Portamento / Tune Sliders</div>
                <div class="panel-row" style="margin-top: 5px; margin-bottom: 5px; justify-content: space-around;">
                    <div class="ctrl-unit" data-param="global_tune" style="width: 30%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px;">Tune</span>
                        <div class="v-slider" style="height: 70px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    <div class="ctrl-unit" data-param="transpose" style="width: 30%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px;">Transpose</span>
                        <div class="v-slider" style="height: 70px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    <div class="ctrl-unit" data-param="porta_osc_bal" style="width: 30%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px;">Osc Bal</span>
                        <div class="v-slider" style="height: 70px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                </div>

                <div class="panel-section-title">Pitch Bend Range</div>
                <div class="panel-row" style="margin-top: 5px; margin-bottom: 5px; justify-content: space-around;">
                    <div class="ctrl-unit" data-param="pitch_bend_up" style="width: 45%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px;">Bend Up</span>
                        <div class="v-slider" style="height: 70px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    <div class="ctrl-unit" data-param="pitch_bend_down" style="width: 45%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px;">Bend Down</span>
                        <div class="v-slider" style="height: 70px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                </div>

                <div class="panel-section-title">Drift Fine Parameters</div>
                <div class="panel-row" style="margin-top: 5px; margin-bottom: 5px; justify-content: space-around;">
                    <div class="ctrl-unit" data-param="osc_drift" style="width: 30%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px;">OSC Drift</span>
                        <div class="v-slider" style="height: 70px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    <div class="ctrl-unit" data-param="param_drift" style="width: 30%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px;">Par Drift</span>
                        <div class="v-slider" style="height: 70px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    <div class="ctrl-unit" data-param="drift_rate" style="width: 30%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px;">Drift Rate</span>
                        <div class="v-slider" style="height: 70px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                </div>
            `;

            const selectPortaMode = document.getElementById('panel-porta-mode-select');
            if (selectPortaMode) {
                selectPortaMode.addEventListener('change', () => {
                    if (window.dualMidiBridge) window.dualMidiBridge.setParameter("porta_mode", parseInt(selectPortaMode.value) / 9.0);
                });
            }

            const selectNotePriority = document.getElementById('panel-note-priority-select');
            if (selectNotePriority) {
                selectNotePriority.addEventListener('change', () => {
                    if (window.dualMidiBridge) window.dualMidiBridge.setParameter("note_priority", parseInt(selectNotePriority.value) / 2.0);
                });
            }

            const selectTriggerMode = document.getElementById('panel-trigger-mode-select');
            if (selectTriggerMode) {
                selectTriggerMode.addEventListener('change', () => {
                    if (window.dualMidiBridge) window.dualMidiBridge.setParameter("trigger_mode", parseInt(selectTriggerMode.value) / 3.0);
                });
            }
        } else if (currentPanelMode === 'CHORD') {
            // --- MODO CHORD MEMORY / POLY CHORD ---
            titleEl.innerText = "Chord Memory Options";

            container.innerHTML = `
                <div class="panel-section-title">Chord Status</div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px; gap: 8px;">
                    <div id="panel-chord-enable-box" class="led-button-rect" style="flex: 1; text-align: center; font-size: 8px; padding: 6px; cursor: pointer; background: #202227; border: 1px solid #444; border-radius: 3px; color: #fff; text-transform: uppercase;">
                        Chord Memory
                    </div>
                    <div id="panel-poly-chord-enable-box" class="led-button-rect" style="flex: 1; text-align: center; font-size: 8px; padding: 6px; cursor: pointer; background: #202227; border: 1px solid #444; border-radius: 3px; color: #fff; text-transform: uppercase;">
                        Poly Chord
                    </div>
                </div>

                <div class="panel-section-title">Chord Parameters</div>
                <div style="margin-bottom: 8px; width: 100%;">
                    <span class="label" style="font-size: 7px; color: var(--text-labels); display: block; margin-bottom: 2px;">ROOT KEY</span>
                    <select id="panel-chord-key-select" style="background: #1b1c20; color: #fff; border: 1px solid #444; border-radius: 3px; font-size: 9px; padding: 3px; width: 100%;">
                        <option value="0">C</option>
                        <option value="1">C#</option>
                        <option value="2">D</option>
                        <option value="3">D#</option>
                        <option value="4">E</option>
                        <option value="5">F</option>
                        <option value="6">F#</option>
                        <option value="7">G</option>
                        <option value="8">G#</option>
                        <option value="9">A</option>
                        <option value="10">A#</option>
                        <option value="11">B</option>
                    </select>
                </div>

                <div style="margin-bottom: 8px; width: 100%;">
                    <span class="label" style="font-size: 7px; color: var(--text-labels); display: block; margin-bottom: 2px;">CHORD TYPE</span>
                    <select id="panel-chord-type-select" style="background: #1b1c20; color: #fff; border: 1px solid #444; border-radius: 3px; font-size: 9px; padding: 3px; width: 100%;">
                        <option value="0">Memory</option>
                        <option value="1">Major</option>
                        <option value="2">Minor</option>
                        <option value="3">Major 7th</option>
                        <option value="4">Minor 7th</option>
                        <option value="5">Dominant 7th</option>
                        <option value="6">Suspended 4th</option>
                        <option value="7">Power Chord</option>
                    </select>
                </div>
            `;

            // Configurar Listeners
            const chordBox = document.getElementById('panel-chord-enable-box');
            if (chordBox) {
                chordBox.addEventListener('click', () => {
                    const active = chordBox.classList.contains('active');
                    if (window.dualMidiBridge) window.dualMidiBridge.setParameter("chord_enable", active ? 0.0 : 1.0);
                });
            }

            const polyChordBox = document.getElementById('panel-poly-chord-enable-box');
            if (polyChordBox) {
                polyChordBox.addEventListener('click', () => {
                    const active = polyChordBox.classList.contains('active');
                    if (window.dualMidiBridge) window.dualMidiBridge.setParameter("poly_chord_enable", active ? 0.0 : 1.0);
                });
            }

            const selectKey = document.getElementById('panel-chord-key-select');
            if (selectKey) {
                selectKey.addEventListener('change', () => {
                    if (window.dualMidiBridge) window.dualMidiBridge.setParameter("chord_key", parseInt(selectKey.value) / 11.0);
                });
            }

            const selectType = document.getElementById('panel-chord-type-select');
            if (selectType) {
                selectType.addEventListener('change', () => {
                    if (window.dualMidiBridge) window.dualMidiBridge.setParameter("chord_type", parseInt(selectType.value) / 7.0);
                });
            }
        } else if (currentPanelMode === 'ARP') {
            // --- MODO ARPEGGIADOR ---
            titleEl.innerText = "Arpeggiator Settings";

            container.innerHTML = `
                <div class="panel-section-title">Arpeggiator Status</div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px; gap: 6px; flex-wrap: wrap;">
                    <div id="panel-arp-enable-box" class="led-button-rect" style="flex: 1; min-width: 50px; text-align: center; font-size: 8px; padding: 6px; cursor: pointer; background: #202227; border: 1px solid #444; border-radius: 3px; color: #fff; text-transform: uppercase;">
                        Arp On
                    </div>
                    <div id="panel-arp-hold-box" class="led-button-rect" style="flex: 1; min-width: 50px; text-align: center; font-size: 8px; padding: 6px; cursor: pointer; background: #202227; border: 1px solid #444; border-radius: 3px; color: #fff; text-transform: uppercase;">
                        Hold
                    </div>
                    <div id="panel-arp-keysync-box" class="led-button-rect" style="flex: 1; min-width: 50px; text-align: center; font-size: 8px; padding: 6px; cursor: pointer; background: #202227; border: 1px solid #444; border-radius: 3px; color: #fff; text-transform: uppercase;">
                        Key Sync
                    </div>
                </div>

                <div class="panel-section-title">Arp Routing & Clock</div>
                <div style="margin-bottom: 8px; width: 100%;">
                    <span class="label" style="font-size: 7px; color: var(--text-labels); display: block; margin-bottom: 2px;">CLOCK SOURCE</span>
                    <select id="panel-arp-clock-select" style="background: #1b1c20; color: #fff; border: 1px solid #444; border-radius: 3px; font-size: 9px; padding: 3px; width: 100%;">
                        <option value="0">Internal</option>
                        <option value="1">MIDI (Auto)</option>
                        <option value="2">USB (Auto)</option>
                    </select>
                </div>

                <div style="margin-bottom: 8px; width: 100%;">
                    <span class="label" style="font-size: 7px; color: var(--text-labels); display: block; margin-bottom: 2px;">VELOCITY GATE</span>
                    <select id="panel-arp-velgate-select" style="background: #1b1c20; color: #fff; border: 1px solid #444; border-radius: 3px; font-size: 9px; padding: 3px; width: 100%;">
                        <option value="0">Gate</option>
                        <option value="1">Velocity</option>
                        <option value="2">Seq</option>
                    </select>
                </div>

                <div class="panel-section-title">Mode & Range</div>
                <div style="margin-bottom: 8px; width: 100%;">
                    <span class="label" style="font-size: 7px; color: var(--text-labels); display: block; margin-bottom: 2px;">ARPEGGIATOR MODE</span>
                    <select id="panel-arp-mode-select" style="background: #1b1c20; color: #fff; border: 1px solid #444; border-radius: 3px; font-size: 9px; padding: 3px; width: 100%;">
                        <option value="0">UP</option>
                        <option value="1">DOWN</option>
                        <option value="2">UP-DOWN</option>
                        <option value="3">UP-INV</option>
                        <option value="4">DOWN-INV</option>
                        <option value="5">UP-DN-INV</option>
                        <option value="6">UP-ALT</option>
                        <option value="7">DOWN-ALT</option>
                        <option value="8">RANDOM</option>
                        <option value="9">AS-PLAYED</option>
                    </select>
                </div>

                <div style="margin-bottom: 12px; width: 100%;">
                    <span class="label" style="font-size: 7px; color: var(--text-labels); display: block; margin-bottom: 2px;">OCTAVE RANGE</span>
                    <select id="panel-arp-octave-select" style="background: #1b1c20; color: #fff; border: 1px solid #444; border-radius: 3px; font-size: 9px; padding: 3px; width: 100%;">
                        <option value="0">1</option>
                        <option value="1">2</option>
                        <option value="2">3</option>
                        <option value="3">4</option>
                    </select>
                </div>

                <div class="panel-section-title">Arpeggiator Faders</div>
                <div class="panel-row" style="margin-top: 5px; margin-bottom: 5px; justify-content: space-around;">
                    <div class="ctrl-unit" data-param="arp_swing" style="width: 30%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px;">Swing</span>
                        <div class="v-slider" style="height: 80px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    <div class="ctrl-unit" data-param="arp_rate" style="width: 30%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px;">Rate</span>
                        <div class="v-slider" style="height: 80px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                    <div class="ctrl-unit" data-param="arp_gate_time" style="width: 30%; align-items: center; display: flex; flex-direction: column;">
                        <span class="label" style="font-size: 7px;">Gate Time</span>
                        <div class="v-slider" style="height: 80px;">
                            <div class="track"></div>
                            <div class="handle"></div>
                        </div>
                    </div>
                </div>
            `;

            // Configurar Listeners
            const arpBox = document.getElementById('panel-arp-enable-box');
            if (arpBox) {
                arpBox.addEventListener('click', () => {
                    const active = arpBox.classList.contains('active');
                    if (window.dualMidiBridge) window.dualMidiBridge.setParameter("arp_enable", active ? 0.0 : 1.0);
                });
            }

            const holdBox = document.getElementById('panel-arp-hold-box');
            if (holdBox) {
                holdBox.addEventListener('click', () => {
                    const active = holdBox.classList.contains('active');
                    if (window.dualMidiBridge) window.dualMidiBridge.setParameter("arp_hold", active ? 0.0 : 1.0);
                });
            }

            const keySyncBox = document.getElementById('panel-arp-keysync-box');
            if (keySyncBox) {
                keySyncBox.addEventListener('click', () => {
                    const active = keySyncBox.classList.contains('active');
                    if (window.dualMidiBridge) window.dualMidiBridge.setParameter("arp_key_sync", active ? 0.0 : 1.0);
                });
            }

            const selectClock = document.getElementById('panel-arp-clock-select');
            if (selectClock) {
                selectClock.addEventListener('change', () => {
                    if (window.dualMidiBridge) window.dualMidiBridge.setParameter("arp_clock_divider", parseInt(selectClock.value) / 2.0);
                });
            }

            const selectVelGate = document.getElementById('panel-arp-velgate-select');
            if (selectVelGate) {
                selectVelGate.addEventListener('change', () => {
                    if (window.dualMidiBridge) window.dualMidiBridge.setParameter("arp_velocity_gate", parseInt(selectVelGate.value) / 2.0);
                });
            }

            const selectMode = document.getElementById('panel-arp-mode-select');
            if (selectMode) {
                selectMode.addEventListener('change', () => {
                    if (window.dualMidiBridge) window.dualMidiBridge.setParameter("arp_mode", parseInt(selectMode.value) / 9.0);
                });
            }

            const selectOctave = document.getElementById('panel-arp-octave-select');
            if (selectOctave) {
                selectOctave.addEventListener('change', () => {
                    if (window.dualMidiBridge) window.dualMidiBridge.setParameter("arp_octave", parseInt(selectOctave.value) / 3.0);
                });
            }
        }

        // Re-inicializar controles táctiles de faders dinámicos
        initDynamicSliders();

        // Leer valores activos
        updatePanelFromState();
    };

    // Abre el panel en modo LFO
    if (lfoEditBtn) {
        lfoEditBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentPanelMode = 'LFO';
            window.syncDetailPanelControls();
            panel.classList.add('active');
        });
    }

    // Abre el panel en modo VCA
    if (vcaEditBtn) {
        vcaEditBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentPanelMode = 'VCA';
            window.syncDetailPanelControls();
            panel.classList.add('active');
        });
    }

    // Abre el panel en modo ENVELOPE
    if (envEditBtn) {
        envEditBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentPanelMode = 'ENV';
            
            // Sincronizar el envelope activo actual de la UI
            const activeBtn = document.querySelector('.env-type-btn.active');
            if (activeBtn) {
                panelActiveEnv = parseInt(activeBtn.getAttribute('data-env')) || 1;
            }
            
            window.syncDetailPanelControls();
            panel.classList.add('active');
        });
    }

    // Abre el panel en modo HPF
    if (hpfEditBtn) {
        hpfEditBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentPanelMode = 'HPF';
            window.syncDetailPanelControls();
            panel.classList.add('active');
        });
    }

    // Abre el panel en modo VCF
    if (vcfEditBtn) {
        vcfEditBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentPanelMode = 'VCF';
            window.syncDetailPanelControls();
            panel.classList.add('active');
        });
    }

    // Abre el panel en modo POLY/UNISON
    const polyEditBtn = document.getElementById('poly-edit-btn');
    if (polyEditBtn) {
        polyEditBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentPanelMode = 'POLY';
            window.syncDetailPanelControls();
            panel.classList.add('active');
        });
    }

    // Abre el panel en modo PORTAMENTO
    const portaEditBtn = document.getElementById('porta-edit-btn');
    if (portaEditBtn) {
        portaEditBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentPanelMode = 'PORTA';
            window.syncDetailPanelControls();
            panel.classList.add('active');
        });
    }

    // Abre el panel en modo OSCILLATORS
    if (oscEditBtn) {
        oscEditBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentPanelMode = 'OSC';
            window.syncDetailPanelControls();
            panel.classList.add('active');
        });
    }

    // Abre el panel en modo CHORD
    const programmerChordBtn = document.getElementById('programmer-chord-btn');
    if (programmerChordBtn) {
        programmerChordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentPanelMode = 'CHORD';
            window.syncDetailPanelControls();
            panel.classList.add('active');
        });
    }

    // Cierra el panel
    closeBtn.addEventListener('click', () => {
        panel.classList.remove('active');
    });

    // Si cambian los LFOs activos en la pantalla principal
    const lfoSelectBtn = document.getElementById('lfo-select-btn');
    if (lfoSelectBtn) {
        lfoSelectBtn.addEventListener('click', () => {
            if (panel.classList.contains('active') && currentPanelMode === 'LFO') {
                window.syncDetailPanelControls();
            }
        });
    }

    // Si cambian los OSC activos en la pantalla principal
    const oscSelectBtn = document.getElementById('osc-select-btn');
    if (oscSelectBtn) {
        oscSelectBtn.addEventListener('click', () => {
            if (panel.classList.contains('active') && currentPanelMode === 'OSC') {
                window.syncDetailPanelControls();
            }
        });
    }

    // Si cambian las envolventes activas en la pantalla principal
    const envBtns = document.querySelectorAll('.env-type-btn');
    envBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            panelActiveEnv = parseInt(btn.getAttribute('data-env')) || 1;
            if (panel.classList.contains('active') && currentPanelMode === 'ENV') {
                window.syncDetailPanelControls();
            }
        });
    });

    // Inicializador local de sliders para el panel deslizable dinámico
    function initDynamicSliders() {
        container.querySelectorAll('.v-slider').forEach(slider => {
            const ctrlUnit = slider.closest('[data-param]');
            const paramId = ctrlUnit.getAttribute('data-param');
            const handle = slider.querySelector('.handle');

            let isDragging = false;

            const updateSliderPos = (clientY) => {
                const rect = slider.getBoundingClientRect();
                const handleHeight = 16;
                const limit = rect.height - handleHeight;
                let y = clientY - rect.top - (handleHeight / 2);
                y = Math.max(0, Math.min(limit, y));
                handle.style.top = y + 'px';

                const val = 1.0 - (y / limit);
                if (window.dualMidiBridge) {
                    window.dualMidiBridge.setParameter(paramId, val);
                }
            };

            slider.addEventListener('mousedown', (e) => {
                isDragging = true;
                updateSliderPos(e.clientY);
                e.preventDefault();
            });

            window.addEventListener('mousemove', (e) => {
                if (isDragging) updateSliderPos(e.clientY);
            });

            window.addEventListener('mouseup', () => {
                isDragging = false;
            });
        });
    }

    // Recupera valores actuales del Preset activo y los refleja en el panel del deslizador
    function updatePanelFromState() {
        if (typeof currentActivePatchIndex === 'undefined' || currentActivePatchIndex === -1) return;
        const activeBank = loadedBanks[currentActiveBank];
        if (!activeBank) return;
        const patch = activeBank[currentActivePatchIndex];
        if (!patch || !patch.unpackedBytes) return;

        if (currentPanelMode === 'LFO') {
            const prefix = `lfo${panelActiveLfo}_`;
            const shapeVal = panelActiveLfo === 1 ? patch.unpackedBytes[3] : patch.unpackedBytes[10];
            const rateVal = (panelActiveLfo === 1 ? patch.unpackedBytes[0] : patch.unpackedBytes[7]) / 255.0;
            const delayVal = (panelActiveLfo === 1 ? patch.unpackedBytes[1] : patch.unpackedBytes[8]) / 255.0;
            const slewVal = (panelActiveLfo === 1 ? patch.unpackedBytes[2] : patch.unpackedBytes[9]) / 255.0;
            const phaseVal = (panelActiveLfo === 1 ? patch.unpackedBytes[6] : patch.unpackedBytes[13]) / 255.0;
            
            const keySyncVal = panelActiveLfo === 1 ? patch.unpackedBytes[4] : patch.unpackedBytes[11];
            const arpSyncVal = panelActiveLfo === 1 ? patch.unpackedBytes[5] : patch.unpackedBytes[12];

            const shapeRow = container.querySelector(`.shape-led-row[data-shape="${shapeVal}"]`);
            if (shapeRow) {
                container.querySelectorAll('.shape-led-row').forEach(r => r.classList.remove('active'));
                shapeRow.classList.add('active');
            }

            const keySyncBox = document.getElementById('lfo-key-sync-box');
            if (keySyncBox) keySyncBox.classList.toggle('active', keySyncVal > 0.5);
            const arpSyncBox = document.getElementById('lfo-arp-sync-box');
            if (arpSyncBox) arpSyncBox.classList.toggle('active', arpSyncVal > 0.5);

            const sliders = [
                { id: `${prefix}rate`, val: rateVal },
                { id: `${prefix}delay`, val: delayVal },
                { id: `${prefix}slew`, val: slewVal },
                { id: `${prefix}phase`, val: phaseVal }
            ];

            sliders.forEach(sliderInfo => {
                const sliderEl = container.querySelector(`[data-param="${sliderInfo.id}"] .v-slider`);
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
        } else if (currentPanelMode === 'VCA') {
            const vcaLevelVal = patch.unpackedBytes[36] / 255.0;
            const vcaModeVal = patch.unpackedBytes[58];
            const vcaEnvDepthVal = patch.unpackedBytes[59] / 255.0;
            const vcaVelSensVal = patch.unpackedBytes[60] / 255.0;
            const vcaPanSpreadVal = patch.unpackedBytes[61] / 255.0;

            const isBallsy = vcaModeVal > 0.5;
            const btnTransparent = document.getElementById('panel-vca-mode-transparent');
            const btnBallsy = document.getElementById('panel-vca-mode-ballsy');
            if (btnTransparent && btnBallsy) {
                btnTransparent.classList.toggle('active', !isBallsy);
                btnBallsy.classList.toggle('active', isBallsy);
            }

            const sliders = [
                { id: "vca_level", val: vcaLevelVal },
                { id: "vca_env_depth", val: vcaEnvDepthVal },
                { id: "vca_vel_sens", val: vcaVelSensVal },
                { id: "vca_pan_spread", val: vcaPanSpreadVal }
            ];

            sliders.forEach(sliderInfo => {
                const sliderEl = container.querySelector(`[data-param="${sliderInfo.id}"] .v-slider`);
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
        } else if (currentPanelMode === 'ENV') {
            const prefix = `env${panelActiveEnv}_`;
            let idxOffset = panelActiveEnv === 1 ? 53 : (panelActiveEnv === 2 ? 65 : 73);
            let idxCurve = panelActiveEnv === 1 ? 46 : (panelActiveEnv === 2 ? 50 : 58);
            let idxTrig = panelActiveEnv === 1 ? 134 : (panelActiveEnv === 2 ? 135 : 136);

            const atkVal = patch.unpackedBytes[idxOffset] / 255.0;
            const dcyVal = patch.unpackedBytes[idxOffset + 1] / 255.0;
            const susVal = patch.unpackedBytes[idxOffset + 2] / 255.0;
            const relVal = patch.unpackedBytes[idxOffset + 3] / 255.0;

            let atkCurvVal = patch.unpackedBytes[idxCurve] / 255.0;
            let dcyCurvVal = patch.unpackedBytes[idxCurve + 1] / 255.0;
            let susCurvVal = 0.5;
            let relCurvVal = 0.5;

            if (panelActiveEnv === 1) {
                susCurvVal = patch.unpackedBytes[48] / 255.0;
                relCurvVal = patch.unpackedBytes[49] / 255.0;
            } else if (panelActiveEnv === 2) {
                susCurvVal = patch.unpackedBytes[56] / 255.0;
                relCurvVal = patch.unpackedBytes[53] / 255.0;
            } else {
                susCurvVal = patch.unpackedBytes[60] / 255.0;
                relCurvVal = patch.unpackedBytes[61] / 255.0;
            }

            const trigVal = patch.unpackedBytes[idxTrig];

            const trigRow = container.querySelector(`.shape-led-row[data-trig="${trigVal}"]`);
            if (trigRow) {
                container.querySelectorAll('.shape-led-row').forEach(r => r.classList.remove('active'));
                trigRow.classList.add('active');
            }

            const sliders = [
                { id: `${prefix}attack`, val: atkVal },
                { id: `${prefix}decay`, val: dcyVal },
                { id: `${prefix}sustain`, val: susVal },
                { id: `${prefix}release`, val: relVal },
                { id: `${prefix}attack_curve`, val: atkCurvVal },
                { id: `${prefix}decay_curve`, val: dcyCurvVal },
                { id: `${prefix}sustain_curve`, val: susCurvVal },
                { id: `${prefix}release_curve`, val: relCurvVal }
            ];

            sliders.forEach(sliderInfo => {
                const sliderEl = container.querySelector(`[data-param="${sliderInfo.id}"] .v-slider`);
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
        } else if (currentPanelMode === 'HPF') {
            const hpfCutoffVal = patch.unpackedBytes[40] / 255.0;
            const hpfBoostVal = patch.unpackedBytes[52];

            const isBoostOn = hpfBoostVal > 0.5;
            const btnBoostOff = document.getElementById('panel-hpf-boost-off');
            const btnBoostOn = document.getElementById('panel-hpf-boost-on');
            if (btnBoostOff && btnBoostOn) {
                btnBoostOff.classList.toggle('active', !isBoostOn);
                btnBoostOn.classList.toggle('active', isBoostOn);
            }

            const sliders = [
                { id: "hpf_cutoff", val: hpfCutoffVal }
            ];

            sliders.forEach(sliderInfo => {
                const sliderEl = container.querySelector(`[data-param="${sliderInfo.id}"] .v-slider`);
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
        } else if (currentPanelMode === 'VCF') {
            const cutoffVal = patch.unpackedBytes[39] / 255.0;
            const resonanceVal = patch.unpackedBytes[41] / 255.0;
            const envDepthVal = (patch.unpackedBytes[42] - 128) / 128.0; // bipolar
            const envVelVal = patch.unpackedBytes[43] / 255.0;
            const lfoDepthVal = patch.unpackedBytes[45] / 255.0;

            const poleVal = patch.unpackedBytes[51]; // 0 = 4-Pole, 1 = 2-Pole
            const polarityVal = patch.unpackedBytes[50]; // 0 = Inverted, 1 = Normal
            const lfoSelectVal = patch.unpackedBytes[46]; // 0 = LFO 1, 1 = LFO 2

            const btnPole2 = document.getElementById('panel-vcf-pole-2');
            const btnPole4 = document.getElementById('panel-vcf-pole-4');
            if (btnPole2 && btnPole4) {
                btnPole2.classList.toggle('active', poleVal > 0.5);
                btnPole4.classList.toggle('active', poleVal <= 0.5);
            }

            const btnPolNorm = document.getElementById('panel-vcf-pol-normal');
            const btnPolInv = document.getElementById('panel-vcf-pol-inverted');
            if (btnPolNorm && btnPolInv) {
                btnPolNorm.classList.toggle('active', polarityVal > 0.5);
                btnPolInv.classList.toggle('active', polarityVal <= 0.5);
            }

            const btnLfoSrc1 = document.getElementById('panel-vcf-lfosrc-1');
            const btnLfoSrc2 = document.getElementById('panel-vcf-lfosrc-2');
            if (btnLfoSrc1 && btnLfoSrc2) {
                btnLfoSrc1.classList.toggle('active', lfoSelectVal <= 0.5);
                btnLfoSrc2.classList.toggle('active', lfoSelectVal > 0.5);
            }

            const sliders = [
                { id: "vcf_cutoff", val: cutoffVal },
                { id: "vcf_resonance", val: resonanceVal },
                { id: "vcf_env_depth", val: Math.abs(envDepthVal) }, // scale appropriately
                { id: "vcf_env_vel", val: envVelVal },
                { id: "vcf_lfo_depth", val: lfoDepthVal }
            ];

            sliders.forEach(sliderInfo => {
                const sliderEl = container.querySelector(`[data-param="${sliderInfo.id}"] .v-slider`);
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
        } else if (currentPanelMode === 'OSC') {
            if (panelActiveOsc === 1) {
                const sawVal = patch.unpackedBytes[19];
                const sqVal = patch.unpackedBytes[18];
                const rangeVal = patch.unpackedBytes[14]; // 0=16, 1=8, 2=4
                const pmModeVal = patch.unpackedBytes[20]; // hard sync vs mod

                const sawBox = document.getElementById('panel-osc1-saw-box');
                const sqBox = document.getElementById('panel-osc1-square-box');
                if (sawBox) sawBox.classList.toggle('active', sawVal > 0.5);
                if (sqBox) sqBox.classList.toggle('active', sqVal > 0.5);

                const btnPmode12 = document.getElementById('panel-osc1-pmode-12');
                const btnPmode1 = document.getElementById('panel-osc1-pmode-1');
                if (btnPmode12 && btnPmode1) {
                    btnPmode12.classList.toggle('active', pmModeVal <= 0.5);
                    btnPmode1.classList.toggle('active', pmModeVal > 0.5);
                }

                const selectPmod = document.getElementById('panel-osc1-pmod-src-select');
                if (selectPmod) {
                    selectPmod.value = Math.round(patch.unpackedBytes[15]) || 0;
                }

                const selectPwm = document.getElementById('panel-osc1-pwm-src-select');
                if (selectPwm) {
                    selectPwm.value = Math.round(patch.unpackedBytes[16]) || 0;
                }

                const btn16 = document.getElementById('panel-osc1-rng-16');
                const btn8 = document.getElementById('panel-osc1-rng-8');
                const btn4 = document.getElementById('panel-osc1-rng-4');
                if (btn16 && btn8 && btn4) {
                    btn16.classList.toggle('active', rangeVal === 0);
                    btn8.classList.toggle('active', rangeVal === 1);
                    btn4.classList.toggle('active', rangeVal === 2);
                }

                const sliders = [
                    { id: "osc1_pitch_mod", val: patch.unpackedBytes[24] / 255.0 },
                    { id: "osc1_pwm_amount", val: patch.unpackedBytes[25] / 255.0 }
                ];

                sliders.forEach(sliderInfo => {
                    const sliderEl = container.querySelector(`[data-param="${sliderInfo.id}"] .v-slider`);
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

            } else {
                const syncVal = patch.unpackedBytes[20];
                const rangeVal = patch.unpackedBytes[31]; // 0=16, 1=8, 2=4

                const syncBox = document.getElementById('panel-osc-sync-box');
                if (syncBox) syncBox.classList.toggle('active', syncVal > 0.5);

                const selectOsc2Pmod = document.getElementById('panel-osc2-pmod-src-select');
                if (selectOsc2Pmod) {
                    selectOsc2Pmod.value = Math.round(patch.unpackedBytes[17]) || 0;
                }

                const selectOsc2Tmod = document.getElementById('panel-osc2-tpm-src-select');
                if (selectOsc2Tmod) {
                    selectOsc2Tmod.value = Math.round(patch.unpackedBytes[18]) || 0;
                }

                const btn16 = document.getElementById('panel-osc2-rng-16');
                const btn8 = document.getElementById('panel-osc2-rng-8');
                const btn4 = document.getElementById('panel-osc2-rng-4');
                if (btn16 && btn8 && btn4) {
                    btn16.classList.toggle('active', rangeVal === 0);
                    btn8.classList.toggle('active', rangeVal === 1);
                    btn4.classList.toggle('active', rangeVal === 2);
                }

                const sliders = [
                    { id: "osc2_pitch_mod", val: patch.unpackedBytes[30] / 255.0 },
                    { id: "osc2_tone_mod", val: patch.unpackedBytes[28] / 255.0 },
                    { id: "osc2_pitch", val: (patch.unpackedBytes[27] - 128) / 128.0 },
                    { id: "osc2_level", val: patch.unpackedBytes[26] / 255.0 }
                ];

                sliders.forEach(sliderInfo => {
                    const sliderEl = container.querySelector(`[data-param="${sliderInfo.id}"] .v-slider`);
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
            }
        } else if (currentPanelMode === 'POLY') {
            const voiceModeVal = patch.unpackedBytes[85] || 0;
            const unisonVoicesVal = patch.unpackedBytes[86] || 0;
            const unisonDetuneVal = patch.unpackedBytes[28] / 255.0;
            const voiceDriftVal = patch.unpackedBytes[88] / 255.0;

            const selectPolyMode = document.getElementById('panel-poly-mode-select');
            if (selectPolyMode) {
                selectPolyMode.value = Math.round(voiceModeVal);
            }

            const selectUnisonVoices = document.getElementById('panel-unison-voices-select');
            if (selectUnisonVoices) {
                selectUnisonVoices.value = Math.round(unisonVoicesVal);
            }

            const sliders = [
                { id: "unison_detune", val: unisonDetuneVal },
                { id: "voice_drift", val: voiceDriftVal }
            ];

            sliders.forEach(sliderInfo => {
                const sliderEl = container.querySelector(`[data-param="${sliderInfo.id}"] .v-slider`);
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
        } else if (currentPanelMode === 'PORTA') {
            const portaModeVal = patch.unpackedBytes[92] || 0;
            const notePriVal = patch.unpackedBytes[93] || 0;
            const trigModeVal = patch.unpackedBytes[94] || 0;

            const selectPortaMode = document.getElementById('panel-porta-mode-select');
            if (selectPortaMode) selectPortaMode.value = Math.round(portaModeVal);

            const selectNotePriority = document.getElementById('panel-note-priority-select');
            if (selectNotePriority) selectNotePriority.value = Math.round(notePriVal);

            const selectTriggerMode = document.getElementById('panel-trigger-mode-select');
            if (selectTriggerMode) selectTriggerMode.value = Math.round(trigModeVal);

            const sliders = [
                { id: "global_tune", val: (patch.unpackedBytes[81] + 128) / 255.0 },
                { id: "transpose", val: (patch.unpackedBytes[82] + 48) / 96.0 },
                { id: "porta_osc_bal", val: (patch.unpackedBytes[91] + 128) / 255.0 },
                { id: "pitch_bend_up", val: patch.unpackedBytes[83] / 24.0 },
                { id: "pitch_bend_down", val: patch.unpackedBytes[84] / 24.0 },
                { id: "osc_drift", val: patch.unpackedBytes[88] / 255.0 },
                { id: "param_drift", val: patch.unpackedBytes[89] / 255.0 },
                { id: "drift_rate", val: patch.unpackedBytes[90] / 255.0 }
            ];

            sliders.forEach(sliderInfo => {
                const sliderEl = container.querySelector(`[data-param="${sliderInfo.id}"] .v-slider`);
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
        } else if (currentPanelMode === 'CHORD') {
            const chordEn = patch.unpackedBytes[105] > 0.5;
            const polyChordEn = patch.unpackedBytes[106] > 0.5;
            const keyVal = patch.unpackedBytes[107] || 0;
            const typeVal = patch.unpackedBytes[108] || 0;

            const chordBox = document.getElementById('panel-chord-enable-box');
            if (chordBox) chordBox.classList.toggle('active', chordEn);

            const polyChordBox = document.getElementById('panel-poly-chord-enable-box');
            if (polyChordBox) polyChordBox.classList.toggle('active', polyChordEn);

            const selectKey = document.getElementById('panel-chord-key-select');
            if (selectKey) selectKey.value = Math.round(keyVal);

            const selectType = document.getElementById('panel-chord-type-select');
            if (selectType) selectType.value = Math.round(typeVal);
        } else if (currentPanelMode === 'ARP') {
            const arpEn = patch.unpackedBytes[109] > 0.5;
            const holdEn = patch.unpackedBytes[110] > 0.5;
            const keySyncEn = patch.unpackedBytes[111] > 0.5;
            const velGateVal = patch.unpackedBytes[112] || 0;
            const modeVal = patch.unpackedBytes[113] || 0;
            const clockVal = patch.unpackedBytes[117] || 0;
            const octaveVal = patch.unpackedBytes[118] || 0;

            const arpBox = document.getElementById('panel-arp-enable-box');
            if (arpBox) arpBox.classList.toggle('active', arpEn);

            const holdBox = document.getElementById('panel-arp-hold-box');
            if (holdBox) holdBox.classList.toggle('active', holdEn);

            const keySyncBox = document.getElementById('panel-arp-keysync-box');
            if (keySyncBox) keySyncBox.classList.toggle('active', keySyncEn);

            const selectClock = document.getElementById('panel-arp-clock-select');
            if (selectClock) selectClock.value = Math.round(clockVal);

            const selectVelGate = document.getElementById('panel-arp-velgate-select');
            if (selectVelGate) selectVelGate.value = Math.round(velGateVal);

            const selectMode = document.getElementById('panel-arp-mode-select');
            if (selectMode) selectMode.value = Math.round(modeVal);

            const selectOctave = document.getElementById('panel-arp-octave-select');
            if (selectOctave) selectOctave.value = Math.round(octaveVal);

            const sliders = [
                { id: "arp_swing", val: patch.unpackedBytes[116] / 100.0 },
                { id: "arp_rate", val: (patch.unpackedBytes[114] - 20) / 220.0 },
                { id: "arp_gate_time", val: patch.unpackedBytes[115] / 255.0 }
            ];

            sliders.forEach(sliderInfo => {
                const sliderEl = container.querySelector(`[data-param="${sliderInfo.id}"] .v-slider`);
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
        }

        // Post-pass: Sobrescribir UI con los valores reales del cache de parámetros si existen
        if (window.dualMidiBridge) {
            container.querySelectorAll('.v-slider').forEach(slider => {
                const ctrlUnit = slider.closest('[data-param]');
                if (!ctrlUnit) return;
                const paramId = ctrlUnit.getAttribute('data-param');
                if (!paramId) return;
                const val = window.dualMidiBridge.parameterCache[paramId];
                if (val !== undefined) {
                    const handle = slider.querySelector('.handle');
                    if (handle) {
                        const updatePos = () => {
                            const rect = slider.getBoundingClientRect();
                            if (rect.height > 0) {
                                const handleHeight = 16;
                                const pos = (1.0 - val) * (rect.height - handleHeight);
                                handle.style.top = pos + 'px';
                            } else {
                                setTimeout(updatePos, 50);
                            }
                        };
                        updatePos();
                    }
                }
            });

            // Sincronizar select dropdowns
            container.querySelectorAll('select[data-param]').forEach(sel => {
                const paramId = sel.getAttribute('data-param');
                const val = window.dualMidiBridge.parameterCache[paramId];
                if (val !== undefined) {
                    const optionsCount = sel.options.length;
                    sel.value = Math.round(val * (optionsCount - 1));
                }
            });

            // Sincronizar toggle boxes
            container.querySelectorAll('.toggle-box[data-param]').forEach(box => {
                const paramId = box.getAttribute('data-param');
                const val = window.dualMidiBridge.parameterCache[paramId];
                if (val !== undefined) {
                    box.classList.toggle('active', val > 0.5);
                }
            });

            // Sincronizar shape / trigger leds
            container.querySelectorAll('.shape-led-row[data-param]').forEach(row => {
                const paramId = row.getAttribute('data-param');
                const val = window.dualMidiBridge.parameterCache[paramId];
                if (val !== undefined) {
                    const maxVal = row.hasAttribute('data-shape') ? 6.0 : 4.0;
                    const activeIndex = Math.round(val * maxVal);
                    const currentIdx = parseInt(row.getAttribute('data-shape') || row.getAttribute('data-trig') || '0');
                    row.classList.toggle('active', currentIdx === activeIndex);
                }
            });
        }
        // Redibujar pantalla gráfica del panel en base al estado actual
        drawPanelGraphic();
    }

    // Escuchar cambios de parámetros en tiempo real para refrescar faders del panel si se mueven
    if (window.dualMidiBridge) {
        window.dualMidiBridge.onParameterChanged((paramId, val) => {
            if (currentPanelMode === 'LFO') {
                const prefix = `lfo${panelActiveLfo}_`;
                if (paramId.startsWith(prefix)) {
                    if (paramId === `${prefix}slew` || paramId === `${prefix}rate` || paramId === `${prefix}delay` || paramId === `${prefix}phase`) {
                        const sliderEl = container.querySelector(`[data-param="${paramId}"] .v-slider`);
                        if (sliderEl) {
                            const handle = sliderEl.querySelector('.handle');
                            const rect = sliderEl.getBoundingClientRect();
                            if (rect.height > 0) {
                                const handleHeight = 16;
                                const pos = (1.0 - val) * (rect.height - handleHeight);
                                handle.style.top = pos + 'px';
                            }
                        }
                    }
                    if (paramId === `${prefix}shape`) {
                        const shapeVal = Math.round(val * 6.0);
                        const shapeRow = container.querySelector(`.shape-led-row[data-shape="${shapeVal}"]`);
                        if (shapeRow) {
                            container.querySelectorAll('.shape-led-row').forEach(r => r.classList.remove('active'));
                            shapeRow.classList.add('active');
                        }
                    }
                    if (paramId === `${prefix}key_sync`) {
                        const box = document.getElementById('lfo-key-sync-box');
                        if (box) box.classList.toggle('active', val > 0.5);
                    }
                    if (paramId === `${prefix}arp_sync`) {
                        const box = document.getElementById('lfo-arp-sync-box');
                        if (box) box.classList.toggle('active', val > 0.5);
                    }
                }
            } else if (currentPanelMode === 'VCA') {
                if (paramId === "vca_level" || paramId === "vca_env_depth" || paramId === "vca_vel_sens" || paramId === "vca_pan_spread") {
                    const sliderEl = container.querySelector(`[data-param="${paramId}"] .v-slider`);
                    if (sliderEl) {
                        const handle = sliderEl.querySelector('.handle');
                        const rect = sliderEl.getBoundingClientRect();
                        if (rect.height > 0) {
                            const handleHeight = 16;
                            const pos = (1.0 - val) * (rect.height - handleHeight);
                            handle.style.top = pos + 'px';
                        }
                    }
                }
                if (paramId === "vca_mode") {
                    const isBallsy = val > 0.5;
                    const btnTransparent = document.getElementById('panel-vca-mode-transparent');
                    const btnBallsy = document.getElementById('panel-vca-mode-ballsy');
                    if (btnTransparent && btnBallsy) {
                        btnTransparent.classList.toggle('active', !isBallsy);
                        btnBallsy.classList.toggle('active', isBallsy);
                    }
                }
            } else if (currentPanelMode === 'ENV') {
                const prefix = `env${panelActiveEnv}_`;
                if (paramId.startsWith(prefix)) {
                    if (paramId.endsWith('_curve') || paramId.endsWith('attack') || paramId.endsWith('decay') || paramId.endsWith('sustain') || paramId.endsWith('release')) {
                        const sliderEl = container.querySelector(`[data-param="${paramId}"] .v-slider`);
                        if (sliderEl) {
                            const handle = sliderEl.querySelector('.handle');
                            const rect = sliderEl.getBoundingClientRect();
                            if (rect.height > 0) {
                                const handleHeight = 16;
                                const pos = (1.0 - val) * (rect.height - handleHeight);
                                handle.style.top = pos + 'px';
                            }
                        }
                    }
                    if (paramId.endsWith('_trigger_mode')) {
                        const trigVal = Math.round(val * 4.0);
                        const trigRow = container.querySelector(`.shape-led-row[data-trig="${trigVal}"]`);
                        if (trigRow) {
                            container.querySelectorAll('.shape-led-row').forEach(r => r.classList.remove('active'));
                            trigRow.classList.add('active');
                        }
                    }
                }
            } else if (currentPanelMode === 'HPF') {
                if (paramId === "hpf_cutoff") {
                    const sliderEl = container.querySelector(`[data-param="${paramId}"] .v-slider`);
                    if (sliderEl) {
                        const handle = sliderEl.querySelector('.handle');
                        const rect = sliderEl.getBoundingClientRect();
                        if (rect.height > 0) {
                            const handleHeight = 16;
                            const pos = (1.0 - val) * (rect.height - handleHeight);
                            handle.style.top = pos + 'px';
                        }
                    }
                }
                if (paramId === "hpf_boost_enable") {
                    const isBoostOn = val > 0.5;
                    const btnBoostOff = document.getElementById('panel-hpf-boost-off');
                    const btnBoostOn = document.getElementById('panel-hpf-boost-on');
                    if (btnBoostOff && btnBoostOn) {
                        btnBoostOff.classList.toggle('active', !isBoostOn);
                        btnBoostOn.classList.toggle('active', isBoostOn);
                    }
                }
            } else if (currentPanelMode === 'VCF') {
                if (paramId === "vcf_cutoff" || paramId === "vcf_resonance" || paramId === "vcf_env_depth" || paramId === "vcf_env_vel" || paramId === "vcf_lfo_depth") {
                    const sliderEl = container.querySelector(`[data-param="${paramId}"] .v-slider`);
                    if (sliderEl) {
                        const handle = sliderEl.querySelector('.handle');
                        const rect = sliderEl.getBoundingClientRect();
                        if (rect.height > 0) {
                            const handleHeight = 16;
                            const pos = (1.0 - val) * (rect.height - handleHeight);
                            handle.style.top = pos + 'px';
                        }
                    }
                }
                if (paramId === "vcf_pole_mode") {
                    const poleVal = val > 0.5;
                    const btnPole2 = document.getElementById('panel-vcf-pole-2');
                    const btnPole4 = document.getElementById('panel-vcf-pole-4');
                    if (btnPole2 && btnPole4) {
                        btnPole2.classList.toggle('active', poleVal);
                        btnPole4.classList.toggle('active', !poleVal);
                    }
                }
                if (paramId === "vcf_env_polarity") {
                    const polarityVal = val > 0.5;
                    const btnPolNorm = document.getElementById('panel-vcf-pol-normal');
                    const btnPolInv = document.getElementById('panel-vcf-pol-inverted');
                    if (btnPolNorm && btnPolInv) {
                        btnPolNorm.classList.toggle('active', polarityVal);
                        btnPolInv.classList.toggle('active', !polarityVal);
                    }
                }
                if (paramId === "vcf_lfo_select") {
                    const lfoSelectVal = val > 0.5;
                    const btnLfoSrc1 = document.getElementById('panel-vcf-lfosrc-1');
                    const btnLfoSrc2 = document.getElementById('panel-vcf-lfosrc-2');
                    if (btnLfoSrc1 && btnLfoSrc2) {
                        btnLfoSrc1.classList.toggle('active', !lfoSelectVal);
                        btnLfoSrc2.classList.toggle('active', lfoSelectVal);
                    }
                }
            } else if (currentPanelMode === 'OSC') {
                if (paramId === "osc1_saw_enable") {
                    const sawBox = document.getElementById('panel-osc1-saw-box');
                    if (sawBox) sawBox.classList.toggle('active', val > 0.5);
                }
                if (paramId === "osc1_square_enable") {
                    const sqBox = document.getElementById('panel-osc1-square-box');
                    if (sqBox) sqBox.classList.toggle('active', val > 0.5);
                }
                if (paramId === "osc_sync_enable") {
                    const syncBox = document.getElementById('panel-osc-sync-box');
                    if (syncBox) syncBox.classList.toggle('active', val > 0.5);
                }
                if (paramId === "osc1_range") {
                    const rangeVal = Math.round(val * 2.0);
                    const btn16 = document.getElementById('panel-osc1-rng-16');
                    const btn8 = document.getElementById('panel-osc1-rng-8');
                    const btn4 = document.getElementById('panel-osc1-rng-4');
                    if (btn16 && btn8 && btn4) {
                        btn16.classList.toggle('active', rangeVal === 0);
                        btn8.classList.toggle('active', rangeVal === 1);
                        btn4.classList.toggle('active', rangeVal === 2);
                    }
                }
                if (paramId === "osc2_range") {
                    const rangeVal = Math.round(val * 2.0);
                    const btn16 = document.getElementById('panel-osc2-rng-16');
                    const btn8 = document.getElementById('panel-osc2-rng-8');
                    const btn4 = document.getElementById('panel-osc2-rng-4');
                    if (btn16 && btn8 && btn4) {
                        btn16.classList.toggle('active', rangeVal === 0);
                        btn8.classList.toggle('active', rangeVal === 1);
                        btn4.classList.toggle('active', rangeVal === 2);
                    }
                }
                if (paramId === "osc1_pitch_mod" || paramId === "osc1_pwm_amount" || paramId === "osc2_pitch_mod" || paramId === "osc2_tone_mod" || paramId === "osc2_pitch" || paramId === "osc2_level") {
                    const sliderEl = container.querySelector(`[data-param="${paramId}"] .v-slider`);
                    if (sliderEl) {
                        const handle = sliderEl.querySelector('.handle');
                        const rect = sliderEl.getBoundingClientRect();
                        if (rect.height > 0) {
                            const handleHeight = 16;
                            const pos = (1.0 - val) * (rect.height - handleHeight);
                            handle.style.top = pos + 'px';
                        }
                    }
                }
                if (paramId === "osc1_pm_mode") {
                    const pmModeVal = val > 0.5;
                    const btnPmode12 = document.getElementById('panel-osc1-pmode-12');
                    const btnPmode1 = document.getElementById('panel-osc1-pmode-1');
                    if (btnPmode12 && btnPmode1) {
                        btnPmode12.classList.toggle('active', !pmModeVal);
                        btnPmode1.classList.toggle('active', pmModeVal);
                    }
                }
                if (paramId === "osc1_pm_source") {
                    const sel = document.getElementById('panel-osc1-pmod-src-select');
                    if (sel) sel.value = Math.round(val * 23.0);
                }
                if (paramId === "osc1_pwm_source") {
                    const sel = document.getElementById('panel-osc1-pwm-src-select');
                    if (sel) sel.value = Math.round(val * 23.0);
                }
                if (paramId === "osc2_pm_source") {
                    const sel = document.getElementById('panel-osc2-pmod-src-select');
                    if (sel) sel.value = Math.round(val * 23.0);
                }
                if (paramId === "osc2_tpm_source") {
                    const sel = document.getElementById('panel-osc2-tpm-src-select');
                    if (sel) sel.value = Math.round(val * 23.0);
                }
            } else if (currentPanelMode === 'POLY') {
                if (paramId === "unison_detune" || paramId === "voice_drift") {
                    const sliderEl = container.querySelector(`[data-param="${paramId}"] .v-slider`);
                    if (sliderEl) {
                        const handle = sliderEl.querySelector('.handle');
                        const rect = sliderEl.getBoundingClientRect();
                        if (rect.height > 0) {
                            const handleHeight = 16;
                            const pos = (1.0 - val) * (rect.height - handleHeight);
                            handle.style.top = pos + 'px';
                        }
                    }
                }
                if (paramId === "voice_mode") {
                    const sel = document.getElementById('panel-poly-mode-select');
                    if (sel) sel.value = Math.round(val * 2.0);
                }
                if (paramId === "unison_voices") {
                    const sel = document.getElementById('panel-unison-voices-select');
                    if (sel) sel.value = Math.round(val * 5.0);
                }
            } else if (currentPanelMode === 'PORTA') {
                if (paramId === "global_tune" || paramId === "transpose" || paramId === "porta_osc_bal" || paramId === "pitch_bend_up" || paramId === "pitch_bend_down" || paramId === "osc_drift" || paramId === "param_drift" || paramId === "drift_rate") {
                    const sliderEl = container.querySelector(`[data-param="${paramId}"] .v-slider`);
                    if (sliderEl) {
                        const handle = sliderEl.querySelector('.handle');
                        const rect = sliderEl.getBoundingClientRect();
                        if (rect.height > 0) {
                            const handleHeight = 16;
                            const pos = (1.0 - val) * (rect.height - handleHeight);
                            handle.style.top = pos + 'px';
                        }
                    }
                }
                if (paramId === "porta_mode") {
                    const sel = document.getElementById('panel-porta-mode-select');
                    if (sel) sel.value = Math.round(val * 9.0);
                }
                if (paramId === "note_priority") {
                    const sel = document.getElementById('panel-note-priority-select');
                    if (sel) sel.value = Math.round(val * 2.0);
                }
                if (paramId === "trigger_mode") {
                    const sel = document.getElementById('panel-trigger-mode-select');
                    if (sel) sel.value = Math.round(val * 3.0);
                }
            } else if (currentPanelMode === 'CHORD') {
                if (paramId === "chord_enable") {
                    const box = document.getElementById('panel-chord-enable-box');
                    if (box) box.classList.toggle('active', val > 0.5);
                }
                if (paramId === "poly_chord_enable") {
                    const box = document.getElementById('panel-poly-chord-enable-box');
                    if (box) box.classList.toggle('active', val > 0.5);
                }
                if (paramId === "chord_key") {
                    const sel = document.getElementById('panel-chord-key-select');
                    if (sel) sel.value = Math.round(val * 11.0);
                }
                if (paramId === "chord_type") {
                    const sel = document.getElementById('panel-chord-type-select');
                    if (sel) sel.value = Math.round(val * 7.0);
                }
            } else if (currentPanelMode === 'ARP') {
                if (paramId === "arp_enable") {
                    const box = document.getElementById('panel-arp-enable-box');
                    if (box) box.classList.toggle('active', val > 0.5);
                }
                if (paramId === "arp_hold") {
                    const box = document.getElementById('panel-arp-hold-box');
                    if (box) box.classList.toggle('active', val > 0.5);
                }
                if (paramId === "arp_key_sync") {
                    const box = document.getElementById('panel-arp-keysync-box');
                    if (box) box.classList.toggle('active', val > 0.5);
                }
                if (paramId === "arp_clock_divider") {
                    const sel = document.getElementById('panel-arp-clock-select');
                    if (sel) sel.value = Math.round(val * 2.0);
                }
                if (paramId === "arp_velocity_gate") {
                    const sel = document.getElementById('panel-arp-velgate-select');
                    if (sel) sel.value = Math.round(val * 2.0);
                }
                if (paramId === "arp_mode") {
                    const sel = document.getElementById('panel-arp-mode-select');
                    if (sel) sel.value = Math.round(val * 9.0);
                }
                if (paramId === "arp_octave") {
                    const sel = document.getElementById('panel-arp-octave-select');
                    if (sel) sel.value = Math.round(val * 3.0);
                }
                if (paramId === "arp_swing" || paramId === "arp_rate" || paramId === "arp_gate_time") {
                    const sliderEl = container.querySelector(`[data-param="${paramId}"] .v-slider`);
                    if (sliderEl) {
                        const handle = sliderEl.querySelector('.handle');
                        const rect = sliderEl.getBoundingClientRect();
                        if (rect.height > 0) {
                            const handleHeight = 16;
                            const pos = (1.0 - val) * (rect.height - handleHeight);
                            handle.style.top = pos + 'px';
                        }
                    }
                }
            }
            // Redibujar pantalla gráfica ante cambios en tiempo real
            drawPanelGraphic();
        });
    }

    // Función local para redibujar la pantalla gráfica en tiempo real (CRT retro style)
    function drawPanelGraphic() {
        const canvas = document.getElementById('panel-graphic-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Obtener color activo de la marca desde CSS variables de forma segura para Canvas
        const brandColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim() || '#ff9900';

        // Dibujar cuadrícula de fondo retro (CRT)
        ctx.strokeStyle = 'rgba(255, 153, 0, 0.04)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 20) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += 20) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        if (!window.dualMidiBridge || !window.dualMidiBridge.parameterCache) return;
        const cache = window.dualMidiBridge.parameterCache;

        if (currentPanelMode === 'ENV' || currentPanelMode === 'VCA') {
            // --- DIBUJAR ENVOLVENTE ADSR ---
            const envNum = currentPanelMode === 'VCA' ? 1 : panelActiveEnv;
            const prefix = `env${envNum}_`;

            const a = typeof cache[prefix + 'attack'] !== 'undefined' ? cache[prefix + 'attack'] : 0.2;
            const d = typeof cache[prefix + 'decay'] !== 'undefined' ? cache[prefix + 'decay'] : 0.3;
            const s = typeof cache[prefix + 'sustain'] !== 'undefined' ? cache[prefix + 'sustain'] : 0.5;
            const r = typeof cache[prefix + 'release'] !== 'undefined' ? cache[prefix + 'release'] : 0.4;

            const padding = 10;
            const graphW = w - padding * 2;
            const graphH = h - padding * 2;
            const startX = padding;
            const startY = h - padding;

            const totalTime = a + d + 1.0 + r;
            const aW = (a / totalTime) * graphW;
            const dW = (d / totalTime) * graphW;
            const sW = (1.0 / totalTime) * graphW;
            const rW = (r / totalTime) * graphW;

            const p1x = startX + aW;
            const p1y = padding;

            const p2x = p1x + dW;
            const p2y = startY - s * graphH;

            const p3x = p2x + sW;
            const p3y = p2y;

            const p4x = p3x + rW;
            const p4y = startY;

            ctx.fillStyle = 'rgba(255, 153, 0, 0.08)';
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(p1x, p1y);
            ctx.lineTo(p2x, p2y);
            ctx.lineTo(p3x, p3y);
            ctx.lineTo(p4x, p4y);
            ctx.lineTo(startX, startY);
            ctx.fill();

            ctx.strokeStyle = brandColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(p1x, p1y);
            ctx.lineTo(p2x, p2y);
            ctx.lineTo(p3x, p3y);
            ctx.lineTo(p4x, p4y);
            ctx.stroke();

            ctx.fillStyle = brandColor;
            [[p1x, p1y], [p2x, p2y], [p3x, p3y]].forEach(pt => {
                ctx.beginPath();
                ctx.arc(pt[0], pt[1], 3, 0, Math.PI * 2);
                ctx.fill();
            });

        } else if (currentPanelMode === 'LFO') {
            // --- DIBUJAR ONDA LFO ---
            const prefix = `lfo${panelActiveLfo}_`;
            const shapeVal = typeof cache[prefix + 'shape'] !== 'undefined' ? Math.round(cache[prefix + 'shape'] * 6) : 1;

            ctx.strokeStyle = brandColor;
            ctx.lineWidth = 2;
            ctx.beginPath();

            const padding = 10;
            const graphW = w - padding * 2;
            const graphH = h - padding * 2;
            const centerY = h / 2;

            for (let x = 0; x < graphW; x++) {
                const pct = x / graphW;
                const angle = pct * Math.PI * 4;
                let yVal = 0;

                if (shapeVal === 0) {
                    yVal = Math.sin(angle);
                } else if (shapeVal === 1) {
                    const mod = angle % (Math.PI * 2);
                    yVal = mod < Math.PI ? (1.0 - (mod / (Math.PI / 2))) : (-1.0 + ((mod - Math.PI) / (Math.PI / 2)));
                } else if (shapeVal === 2) {
                    yVal = (angle % (Math.PI * 2)) < Math.PI ? 1.0 : -1.0;
                } else if (shapeVal === 3) {
                    yVal = -1.0 + 2.0 * ((angle % (Math.PI * 2)) / (Math.PI * 2));
                } else if (shapeVal === 4) {
                    yVal = 1.0 - 2.0 * ((angle % (Math.PI * 2)) / (Math.PI * 2));
                } else {
                    const steps = 8;
                    const stepIdx = Math.floor(pct * steps);
                    const randVals = [0.2, -0.6, 0.7, -0.2, -0.8, 0.4, -0.1, 0.5];
                    yVal = randVals[stepIdx % randVals.length];
                    if (shapeVal === 6) {
                        const nextVal = randVals[(stepIdx + 1) % randVals.length];
                        const interp = (pct * steps) % 1.0;
                        yVal = yVal + (nextVal - yVal) * interp;
                    }
                }

                const canvasX = padding + x;
                const canvasY = centerY - yVal * (graphH / 2);

                if (x === 0) ctx.moveTo(canvasX, canvasY);
                else ctx.lineTo(canvasX, canvasY);
            }
            ctx.stroke();

        } else if (currentPanelMode === 'VCF' || currentPanelMode === 'HPF') {
            // --- DIBUJAR CURVA DE FILTRO ---
            let cutoff = 0.5;
            let resonance = 0.0;
            if (currentPanelMode === 'VCF') {
                cutoff = typeof cache['vcf_cutoff'] !== 'undefined' ? cache['vcf_cutoff'] : 0.5;
                resonance = typeof cache['vcf_resonance'] !== 'undefined' ? cache['vcf_resonance'] : 0.0;
            } else {
                cutoff = typeof cache['hpf_cutoff'] !== 'undefined' ? cache['hpf_cutoff'] : 0.2;
            }

            ctx.strokeStyle = brandColor;
            ctx.lineWidth = 2;
            ctx.beginPath();

            const padding = 10;
            const graphW = w - padding * 2;
            const graphH = h - padding * 2;
            const startY = h - padding;

            for (let x = 0; x < graphW; x++) {
                const freq = x / graphW;
                let gain = 1.0;

                if (currentPanelMode === 'VCF') {
                    if (freq < cutoff) {
                        const dist = cutoff - freq;
                        if (dist < 0.1) {
                            const peak = resonance * 1.8 * (1.0 - dist / 0.1);
                            gain = 1.0 + peak;
                        }
                    } else {
                        const dist = freq - cutoff;
                        const peak = resonance * 1.8;
                        gain = (1.0 + peak) / (1.0 + (dist * 12.0) * (dist * 12.0));
                    }
                } else {
                    if (freq > cutoff) {
                        gain = 1.0;
                    } else {
                        const dist = cutoff - freq;
                        gain = 1.0 / (1.0 + (dist * 15.0) * (dist * 15.0));
                    }
                }

                const canvasX = padding + x;
                const canvasY = startY - gain * (graphH * 0.7);

                if (x === 0) ctx.moveTo(canvasX, canvasY);
                else ctx.lineTo(canvasX, canvasY);
            }
            ctx.stroke();

        } else if (currentPanelMode === 'OSC') {
            // --- DIBUJAR COMBINACIÓN OSCILADORES ---
            const sawEn = typeof cache['osc1_saw_enable'] !== 'undefined' ? cache['osc1_saw_enable'] > 0.5 : true;
            const sqEn = typeof cache['osc1_square_enable'] !== 'undefined' ? cache['osc1_square_enable'] > 0.5 : false;
            const osc2Lvl = typeof cache['osc2_level'] !== 'undefined' ? cache['osc2_level'] : 0.5;

            ctx.strokeStyle = brandColor;
            ctx.lineWidth = 2;
            ctx.beginPath();

            const padding = 10;
            const graphW = w - padding * 2;
            const graphH = h - padding * 2;
            const centerY = h / 2;

            for (let x = 0; x < graphW; x++) {
                const pct = x / graphW;
                const angle = pct * Math.PI * 4;
                let yVal = 0;

                if (sawEn) {
                    yVal += -0.5 + ((angle % (Math.PI * 2)) / (Math.PI * 2));
                }
                if (sqEn) {
                    yVal += (angle % (Math.PI * 2)) < Math.PI ? 0.35 : -0.35;
                }
                yVal += osc2Lvl * 0.3 * Math.sin(angle * 2.0);

                const canvasX = padding + x;
                const canvasY = centerY - yVal * (graphH / 2);

                if (x === 0) ctx.moveTo(canvasX, canvasY);
                else ctx.lineTo(canvasX, canvasY);
            }
            ctx.stroke();

        } else if (currentPanelMode === 'ARP') {
            // --- DIBUJAR ARPEGIO RETRO ---
            ctx.strokeStyle = brandColor;
            ctx.lineWidth = 2;
            const padding = 10;
            const graphW = w - padding * 2;
            const graphH = h - padding * 2;
            const centerY = h / 2;
            
            ctx.beginPath();
            const steps = 8;
            const stepW = graphW / steps;
            for (let i = 0; i <= steps; i++) {
                const x = padding + i * stepW;
                const y = centerY + (i % 4 - 2) * (graphH / 4);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    }
}

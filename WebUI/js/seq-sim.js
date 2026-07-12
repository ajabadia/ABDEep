/**
 * @purpose Simulador local del secuenciador para probar la UI sin hardware MIDI/JUCE.
 * @purpose_en Local sequencer simulator for testing the UI without MIDI/JUCE hardware.
 * @lastUpdated 2026-07-10
 *
 * Comportamiento:
 *   - Detecta automáticamente modo navegador (sin JUCE y sin MIDI conectado)
 *   - Pobla parameterCache con un patrón sawtooth para los 32 pasos
 *   - Configura valores por defecto (length=16, clock=1/8)
 *   - Activa window._seqSimMode = true para que otras partes de la UI lo detecten
 *   - Compatible con el engine real de bridge-dual.js (initSeqEngine / _updateSeqEngine)
 */

(function() {
    // Esperar a que el bridge esté listo
    var checkInterval = setInterval(function() {
        var bridge = window.dualMidiBridge;
        if (!bridge || !bridge._ready) return;
        clearInterval(checkInterval);
        
        // Solo activar en modo navegador puro (sin JUCE)
        if (bridge.isJuce) {
            console.log('[SeqSim] JUCE mode detected — simulation disabled');
            return;
        }
        
        // Esperar un poco para que la conexión MIDI se estabilice
        setTimeout(function() {
            // Si ya hay MIDI hardware conectado, no activar simulación
            if (bridge._connected && bridge.midiOutput) {
                console.log('[SeqSim] MIDI hardware detected — simulation disabled');
                return;
            }
            
            console.log('[SeqSim] 🔵 Browser-only mode — activating local sequencer simulation');
            window._seqSimMode = true;
            
            // Generar un patrón sawtooth para los 32 steps: -96..+96 progresivo
            // raw 0-255, center=128, skip=0
            var sawPattern = [];
            for (var i = 0; i < 32; i++) {
                // Progresión lineal de -96 a +96 con algunos steps a 0 para variar
                var bipolar, raw;
                if (i === 0) {
                    bipolar = 96;    // +96 (alto positivo)
                } else if (i === 16) {
                    bipolar = 0;     // centro
                } else if (i === 31) {
                    bipolar = -96;   // -96 (alto negativo)
                } else {
                    // Interpolación suave entre los puntos
                    var phase = i / 31;
                    bipolar = Math.round(96 * Math.cos(phase * Math.PI * 2));
                }
                raw = Math.max(1, Math.min(255, bipolar + 128)); // raw, nunca 0 para evitar SKIP
                sawPattern.push(raw);
            }
            // Step 8 como SKIP (raw = 0) para probar esa funcionalidad
            sawPattern[7] = 0;
            
            // Poblar el cache de parámetros
            for (var si = 0; si < 32; si++) {
                var normalized = sawPattern[si] / 255.0;
                bridge.parameterCache['seq_step_' + (si + 1)] = normalized;
            }
            
            // Configurar parámetros del secuenciador con valores por defecto
            bridge.parameterCache['seq_length'] = 15 / 31.0;      // 16 steps (2-32, 15→17)
            bridge.parameterCache['seq_clock'] = 6 / 15.0;        // 1/8 (= index 6 sobre 0-15)
            bridge.parameterCache['seq_key_loop'] = 0;
            bridge.parameterCache['seq_swing'] = 0;
            bridge.parameterCache['seq_slew_rate'] = 0;
            
            // Poblar el panel si ya está abierto (o lo estará pronto)
            if (window._panelSeqValues && window._panelSeqRaw) {
                for (var pi = 0; pi < 32; pi++) {
                    window._panelSeqRaw[pi] = sawPattern[pi];
                    window._panelSeqValues[pi] = sawPattern[pi] === 0 ? -128 : sawPattern[pi] - 128;
                    if (typeof window._updatePanelStepVisual === 'function') {
                        window._updatePanelStepVisual(pi);
                    }
                }
            }
            
            // Sincronizar controles del panel si está visible
            if (typeof window.syncDetailPanelControls === 'function') {
                window.syncDetailPanelControls();
            }
            
            console.log('[SeqSim] ✅ Populated 32 steps with test pattern (sawtooth + 1 skip)');
            console.log('[SeqSim] 💡 Toggle seq_enable to start the engine and see highlighting');
        }, 1500); // Esperar 1.5s para que la conexión MIDI se estabilice
    }, 100);
})();

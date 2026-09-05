/**
 * @purpose Handler para cambios de programa/banco recibidos vía MIDI Program Change
 *          desde el plugin C++ (PatchController → editor → evaluateJavascript).
 * @purpose_en MIDI Program Change / Bank Select UI synchronizer.
 *
 * El C++ llama a window._onProgramChanged(bankLetter, progIndex) cuando se
 * resuelve un PC+BS entrante. Este handler sincroniza la selección UI
 * (currentActiveBank/currentActivePatchIndex), refresca la grilla de patches,
 * actualiza el LCD y NO re-envía SysEx al hardware (el C++ ya aplicó el patch).
 */

(function () {
    'use strict';

    window._onProgramChanged = function (bankLetter, progIndex) {
        // Normalizar entrada
        const bank = String(bankLetter).toUpperCase().trim();
        const idx = Number(progIndex);
        if (!bank || bank.length !== 1 || bank < 'A' || bank > 'H' || !Number.isInteger(idx) || idx < 0 || idx >= 128) {
            console.warn('[ProgramChange] _onProgramChanged ignorado: args inválidos', bankLetter, progIndex);
            return;
        }

        const bankName = 'Factory Bank ' + bank;
        if (!window.loadedBanks || !window.loadedBanks[bankName]) {
            console.warn('[ProgramChange] Banco no cargado en WebUI:', bankName);
            // Aun así actualizar globals para que LCD muestre algo coherente
            window.currentActiveBank = bankName;
            window.currentActivePatchIndex = idx;
            updateLcdFallback(bank, idx);
            return;
        }

        // Sincronizar estado global (igual que click en browser)
        window.currentActiveBank = bankName;
        window.currentActivePatchIndex = idx;

        // Refrescar grilla de patches (renderPatchesForBank actualiza botones + selección visual)
        if (typeof window.renderPatchesForBank === 'function') {
            window.renderPatchesForBank(bankName);
        }

        // Actualizar LCD con nombre del patch (igual que sysex_monitor_render.js:50-66)
        const patch = window.loadedBanks[bankName] && window.loadedBanks[bankName][idx];
        const patchName = patch && patch.name ? patch.name : ('Bank ' + bank + ' Patch ' + (idx + 1));
        updateLcdDisplay(bankName, idx, patchName);

        // Refrescar sliders/bindings desde el estado ya aplicado en C++ (APVTS)
        // bindAllPanelControls lee del bridge cache / synth state si existe
        if (typeof window.bindAllPanelControls === 'function') {
            window.bindAllPanelControls();
        }
        if (typeof window.updateSysExMonitor === 'function' && patch && patch.unpackedBytes) {
            window.updateSysExMonitor(patch.unpackedBytes);
        }

        console.log('[ProgramChange] UI sincronizado: ' + bankName + ' slot ' + (idx + 1) + ' → ' + patchName);
    };

    function updateLcdDisplay(bankName, idx, patchName) {
        // LCD principal (lcd-text)
        const lcdText = document.getElementById('lcd-text');
        if (lcdText) {
            lcdText.innerHTML = '<span class="lcd-label">PATCH</span><br>' +
                '<strong style="color:var(--accent-green);">' + escapeHtml(patchName).toUpperCase() + '</strong><br>' +
                '<span style="font-size:9px; color:var(--text-dim);">' + escapeHtml(bankName) + ' \u203A Slot ' + (idx + 1) + '</span>';
        }
        // LCD monitor SyEx (sysex-active-patch-label)
        const sysexLabel = document.getElementById('sysex-active-patch-label');
        if (sysexLabel) {
            sysexLabel.innerText = 'LOADED PATCH: ' + patchName.toUpperCase() + ' [' + bankName + ' - SLOT ' + String(idx + 1).padStart(3, '0') + ']';
            sysexLabel.style.display = 'block';
        }
    }

    function updateLcdFallback(bank, idx) {
        const label = 'Bank ' + bank + ' Patch ' + (idx + 1);
        const lcdText = document.getElementById('lcd-text');
        if (lcdText) {
            lcdText.innerHTML = '<span class="lcd-label">PATCH</span><br>' +
                '<strong style="color:var(--accent-green);">' + label + '</strong><br>' +
                '<span style="font-size:9px; color:var(--text-dim);">Factory Bank ' + bank + ' \u203A Slot ' + (idx + 1) + '</span>';
        }
        const sysexLabel = document.getElementById('sysex-active-patch-label');
        if (sysexLabel) {
            sysexLabel.innerText = 'LOADED PATCH: ' + label.toUpperCase() + ' [Factory Bank ' + bank + ' - SLOT ' + String(idx + 1).padStart(3, '0') + ']';
            sysexLabel.style.display = 'block';
        }
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, function (c) {
            return {'&': '&', '<': '<', '>': '>', '"': '"', "'": '''}[c];
        });
    }

    // Notificación de error de carga de banco
    window._onBankLoadFailed = function (bankLetter, reason) {
        const bank = String(bankLetter).toUpperCase().trim();
        const msg = 'No se pudo cargar Factory Bank ' + bank + ': ' + reason;
        console.error('[ProgramChange] ' + msg);
        // Usar alert simple (consistente con el resto del WebUI)
        alert('[Bank Load Error] ' + msg);
    };

    // Restauración de estado al cargar proyecto (DAW project restore)
    window._onStateRestored = function (bankLetter, progIndex) {
        if (bankLetter === undefined || progIndex === undefined) {
            console.log('[ProgramChange] _onStateRestored sin args — sin banco/programa guardado');
            return;
        }
        // Reutiliza la misma lógica de sincronización que _onProgramChanged
        window._onProgramChanged(bankLetter, progIndex);
    };

})();
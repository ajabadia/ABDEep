/**
 * @component fx-modal-templates
 * @purpose HTML Templates and Options for Effects Engine Rack modal
 * @classification UI Component Submodule
 */
(function() {
    function getCurrentMode() {
        if (typeof window !== 'undefined' && window.wasmBridge && typeof window.wasmBridge.getMode === 'function') {
            return window.wasmBridge.getMode();
        }
        return 'abyssmind_pro';
    }

    function getFxGroupsForCurrentMode() {
        const mode = getCurrentMode();
        let standardFxCount = 35;
        let advancedFxCount = 21;
        if (typeof window !== 'undefined' && window.ModelCapabilities && typeof window.ModelCapabilities.getCapabilitiesForMode === 'function') {
            const caps = window.ModelCapabilities.getCapabilitiesForMode(mode);
            if (caps) {
                standardFxCount = caps.standardFxCount;
                advancedFxCount = caps.advancedFxCount;
            }
        }
        const groups = [
            { label: '--- STANDARD DM12 FX ---', upTo: standardFxCount }
        ];
        if (advancedFxCount > 0) {
            groups.push({ label: '--- ADVANCED PRO FX ---', upTo: Number.MAX_SAFE_INTEGER });
        }
        return groups;
    }

    /**
     * Los efectos del contrato ORDENADOS POR ID.
     *
     * El array `effects` del contrato va AGRUPADO POR FAMILIA y NO ordenado por
     * id (acaba en 55, 39, 16, 19, 43, 49, 54, 56). Usarlo tal cual daria un
     * desplegable de aspecto ordenado con el `value` equivocado en cada opcion,
     * que es un fallo PEOR que el que se arregla, porque no se ve. Se ordena.
     */
    function fxEffectsById() {
        const contract = (typeof window !== 'undefined' && window.FxEffectsContract) || null;

        if (!contract || !Array.isArray(contract.effects))
            {return [];}

        return contract.effects.slice().sort((a, b) => a.id - b.id);
    }

    let _lastCachedMode = null;
    let _optionsCache = null;

    /** El HTML de las `<option>` del desplegable, en los dos bloques de antes. */
    function fxTypeOptionsHtml() {
        const mode = getCurrentMode();
        if (_optionsCache !== null && _lastCachedMode === mode) {
            return _optionsCache;
        }

        const effects = fxEffectsById();

        if (effects.length === 0) {
            // Sin contrato se avisa y se deja solo Bypass, que es un fallo ruidoso.
            // Poner aqui una lista escrita a mano seria volver a tener dos
            // verdades, que es el problema que se acaba de arreglar.
            console.warn('[fx-modal] falta window.FxEffectsContract: el desplegable de efectos sale incompleto');
            _optionsCache = '<option value="0">Bypass</option>';
            _lastCachedMode = mode;
            return _optionsCache;
        }

        let html = '';
        let from = -1;
        const groups = getFxGroupsForCurrentMode();

        for (const group of groups) {
            const inGroup = effects.filter((effect) => effect.id > from && effect.id <= group.upTo);

            from = group.upTo;

            if (inGroup.length === 0)
                {continue;}

            html += `<optgroup label="${group.label}">`;

            for (const effect of inGroup)
                {html += `<option value="${effect.id}">${effect.name}</option>`;}

            html += '</optgroup>';
        }

        _optionsCache = html;
        _lastCachedMode = mode;
        return _optionsCache;
    }

    function refreshFxTypeOptions() {
        _optionsCache = null;
        _lastCachedMode = null;
        const html = fxTypeOptionsHtml();
        if (typeof document !== 'undefined' && document.querySelectorAll) {
            const selects = document.querySelectorAll('.fx-type-select');
            for (const sel of selects) {
                const currentVal = sel.value;
                sel.innerHTML = html;
                sel.value = currentVal;
            }
        }
        const count = (html.match(/<option\b/g) || []).length;
        return {
            efectos: count,
            modelo: getCurrentMode()
        };
    }

    if (typeof window !== 'undefined') {
        window.refreshFxTypeOptions = refreshFxTypeOptions;
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.refreshFxTypeOptions = refreshFxTypeOptions;
    }

    let _labelsCache = null;

    /** `id -> nombre`, para las etiquetas cortas del rack. */
    function fxTypeLabels() {
        if (_labelsCache !== null)
            {return _labelsCache;}

        const labels = {};

        for (const effect of fxEffectsById())
            {labels[effect.id] = effect.name;}

        _labelsCache = labels;

        return _labelsCache;
    }

    function fxSlotHTML(id) {
        return `
            <div class="fx-slot-column flex-col${id === 1 ? ' selected' : ''}" id="fx-slot-${id}" style="background:var(--bg-surface);border:1px solid ${id === 1 ? 'var(--accent-primary)' : 'var(--border-dim)'};border-radius:var(--radius);padding:8px;gap:6px;cursor:pointer">
                <div class="flex-row justify-between items-center">
                    <span class="text-bold" style="font-size:var(--text-xs);color:var(--text-dim)">FX${id}</span>
                    <select class="fx-type-select modal-select" data-slot="${id}" style="font-size:var(--text-xs);padding:2px;width:75%">${fxTypeOptionsHtml()}</select>
                </div>
                <div class="flex-row items-center justify-center" id="fx${id}-type-mini-display" style="background:var(--bg-deepest);height:32px;border-radius:var(--radius-sm);font-size:var(--text-xs);color:var(--accent-blue);font-family:'Share Tech Mono',monospace">Bypass</div>
                <div class="flex-col items-center" style="gap:3px">
                    <select class="fx-preset-select modal-select" data-slot="${id}" style="font-size:var(--text-2xs);padding:1px;width:100%">
                        <option value="" disabled selected>-- Select Preset --</option>
                    </select>
                    <div class="flex-row" style="gap:3px;width:100%">
                        <button class="btn btn-xs fx-preset-load-btn" data-slot="${id}" style="flex:1;font-size:var(--text-2xs);padding:2px 0" data-ctrl-tooltip="Load selected preset">Load</button>
                        <button class="btn btn-xs fx-preset-save-btn" data-slot="${id}" style="flex:1;font-size:var(--text-2xs);padding:2px 0" data-ctrl-tooltip="Save current slot as preset">Save</button>
                        <button class="btn btn-xs fx-preset-delete-btn" data-slot="${id}" style="flex:1;font-size:var(--text-2xs);padding:2px 0" data-ctrl-tooltip="Delete selected preset">Del</button>
                    </div>
                </div>
                <div class="flex-row flex-1 items-center" style="justify-content:center">
                    <div class="ctrl-unit flex-col items-center" data-param="fx${id}_gain" style="width:80%"><span class="label text-xs">Gain</span><div class="v-slider" style="height:65px"><div class="track"></div><div class="handle"></div></div></div>
                </div>
                <div id="fx${id}-knobs" class="fx-slot-knobs"></div>
            </div>
        `;
    }

    /**
        Monta el HTML del rack. LAZY A PROPOSITO: ver la cabecera.

        `fxSlotHTML` se llama desde el literal de abajo (`[1,2,3,4].map`), asi que
        si esto fuera una `const` se evaluaria al cargar el fichero, con el
        contrato sin cargar. Devolviendo el string en una funcion, el contrato ya
        esta. Ojo con `map`: pasa (valor, indice, array), asi que `fxSlotHTML` no
        puede ganar un segundo parametro sin que le llegue el indice por error.
    */
    function buildTemplate() {
        return `
        <div class="modal-backdrop" id="fx-modal-backdrop" style="display:none;z-index:5000">
            <div class="modal" data-accent="blue" style="width:860px">
                <div class="modal-header">
                    <h2>Effects Engine Rack</h2>
                    <div class="close-btn" id="fx-modal-close-btn" data-ctrl-tooltip="Close Effects Engine modal">&times;</div>
                </div>
                
                <div class="modal-body" style="overflow-y:auto">
                    <div style="display:grid;grid-template-columns:repeat(4,1.25fr) 1.5fr;gap:12px">
                        ${[1,2,3,4].map(fxSlotHTML).join('')}

                        <div class="flex-col bg-surface" style="border:1px solid var(--border-dim);border-radius:var(--radius);padding:10px;gap:8px">
                            <div>
                                <span class="label text-uppercase text-bold text-dim" style="font-size:var(--text-xs);display:block;margin-bottom:4px">Routing</span>
                                <select id="fx-routing-select" class="modal-select" style="font-size:var(--text-xs);padding:3px;width:100%"><option value="0">Series</option><option value="1">Parallel Pairs</option><option value="2">Series Chain</option><option value="3">Full Parallel</option><option value="4">Dual Series Parallel</option><option value="5">Series Split Mid</option><option value="6">Parallel Pairs Series</option><option value="7">Series Chain + Parallel</option><option value="8">Parallel Front Series</option><option value="9">Series with Feedback</option></select>
                            </div>
                            <div>
                                <span class="label text-uppercase text-bold text-dim" style="font-size:var(--text-xs);display:block;margin-bottom:4px">Mode</span>
                                <div class="flex-row" style="gap:3px">
                                    <button class="btn btn-xs active" id="fx-mode-ins-btn" style="flex:1" data-ctrl-tooltip="Insert Mode — fully processed wet signal">INS</button>
                                    <button class="btn btn-xs" id="fx-mode-send-btn" style="flex:1" data-ctrl-tooltip="Send Mode — mix of dry and processed signal">SEND</button>
                                    <button class="btn btn-xs" id="fx-mode-bypass-btn" style="flex:1" data-ctrl-tooltip="Bypass Mode — signal passes unprocessed">BYP</button>
                                </div>
                                <div id="fx-send-level-area" class="flex-col items-center" style="margin-top:6px;gap:2px;display:none">
                                    <span class="label text-uppercase text-bold text-dim" style="font-size:6px;display:block">Send Lvl</span>
                                    <div class="ctrl-unit flex-col items-center" data-param="fx_send_level" style="width:100%">
                                        <div class="v-slider" id="fx-send-level-slider" style="height:36px">
                                            <div class="track"></div>
                                            <div class="handle" style="top:50%"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <span class="label text-uppercase text-bold text-dim" style="font-size:var(--text-xs);display:block;margin-bottom:4px">Los doce mandos</span>
                                <div style="font-size:var(--text-2xs);color:var(--text-faint);line-height:1.4">
                                    Cada hueco lleva sus doce. Los apagados son los que
                                    el efecto no usa: su numero sale del contrato,
                                    no de una lista escrita a mano.
                                </div>
                            </div>
                        </div>
                    </div>

                    </div>
                </div>
            </div>
        </div>
    `;
    }

    let _templateCache = null;

    function fxModalTemplate() {
        if (_templateCache === null)
            {_templateCache = buildTemplate();}

        return _templateCache;
    }

    // Los tres se exponen como `get` y no como valor para que los consumidores
    // (`fx-modal.js`, `fx_modal_presets.js`) no cambien ni una linea: leen
    // `window.FX_TYPE_LABELS` y pintan `window.FX_MODAL_TEMPLATE` en el momento
    // de renderizar, que es cuando el contrato ya esta disponible.
    Object.defineProperty(window, 'FX_TYPE_OPTIONS', {
        get: fxTypeOptionsHtml,
        configurable: true
    });

    Object.defineProperty(window, 'FX_TYPE_LABELS', {
        get: fxTypeLabels,
        configurable: true
    });

    Object.defineProperty(window, 'FX_MODAL_TEMPLATE', {
        get: fxModalTemplate,
        configurable: true
    });
})();

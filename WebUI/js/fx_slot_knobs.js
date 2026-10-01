/**
 * @component fx-slot-knobs
 * @purpose Los mandos de cada hueco de efectos: uno por parametro que el
 *          efecto CONECTA, y el resto declarado no conectable.
 * @classification UI Component Submodule
 *
 * QUE ES. Una TABLA POR TIPO DE EFECTO, y los mandos que salen de ella. La
 * tabla la da el CONTRATO (`params` de `fx-effects.json`, generado desde
 * `FXSlot_Factory.cpp`), asi que el conteo es VARIABLE: 12 para una Hall, 10
 * para una Ambience, 9 para una Reverse, 5 para una Deep Verb, 0 para Bypass.
 * Cada fila dice quantos parametros conecta el tipo, cuales son, y cuantos del
 * registro deja sin conectar. Cada mando esta enlazado a su parametro por
 * `data-param` y no por su sitio en el DOM.
 *
 * POR QUE UNA TABLA Y NO DOCE MANDOS FIJOS. El registro tiene siempre doce
 * bytes por hueco (`fx{n}_param1`..`fx{n}_param12`) porque el byte es del
 * bloque, no del efecto. Antes se pintaban los doce igual, con los sobrantes a
 * media luz, y eso hacia dos cosas malas a la vez: una Deep Verb se veia como
 * una Hall con siete mandos rotos, y la rejilla ocupaba el mismo alto con cinco
 * mandos utiles que con doce. Doce es el TECHO del registro, no el valor de un
 * efecto, y pintar el techo como si fuera el valor obliga al usuario a
 * descifrar el brillo de cada mando para saber cuantos hay.
 *
 * Y EL RESTO SIGUE VISIBLE, PERO COMO NO CONECTABLE. Un parametro que el
 * efecto no lee se sigue viendo --oculto seria un fallo--, pero ya NO es un
 * mando: no lleva `data-param`, no tiene anillo, no se arrastra y no hay a
 * quien escribir. Un mando apagado no dice si es que el efecto no lo usa o si
 * el panel esta roto; una linea que dice "no conectables P6..P12" si.
 *
 * Y POR QUE `data-param` Y NO EL INDICE. Antes los mandos se enlazaban por su
 * orden en el DOM (`idx` del `querySelectorAll`), o sea que un renderer que
 * emitiera los controles en otro orden mandaba el valor al parametro
 * equivocado sin avisar. Aqui cada mando lleva escrito su parametro, asi que
 * reordenar la rejilla no puede desconectar nada.
 *
 * OJO CON EL PUNTERO. Los renderers antiguos hacian
 * `transform: translateX(-50%) rotate(...)`, pero el CSS ya lo centra con
 * `left: calc(50% - 1px)`: el `translateX` lo movia medio ancho a la izquierda
 * de mas. Aqui solo el `rotate`.
 */

(function () {
    'use strict';

    /**
        Mandos por hueco. Es el techo del REGISTRO, no el valor de un efecto.

        Los doce bytes existen siempre porque el byte es del bloque; los que el
        motor lee los dice el contrato, y pueden ser cero.
    */
    const MANDOS_POR_HUECO = 12;

    /**
        Tope de filas de la rejilla, y de columnas.

        El hueco es estrecho, asi que las dos cosas van por arriba: con doce
        mandos salen cuatro columnas y tres filas, que es mas bajo que antes
        (eran tres columnas y cuatro filas) y ademas se lee mejor.
    */
    const FILAS_MAX = 4;
    const COLUMNAS_MAX = 6;

    const HUECOS = [1, 2, 3, 4];

    /**
        De quantas columnas va la rejilla de un tipo. NO es un numero fijo.

        Se piden como mucho `FILAS_MAX` filas, y de ahi el numero de columnas
        que hace falta para llenarlas. La idea es que el ancho lo diga el
        conteo: con cinco mandos sale una rejilla de tres columnas y dos
        filas, con doce de cuatro y tres, y con cero NO hay rejilla, porque
        `repeat(0, 1fr)` no es una rejilla vacia: es una rejilla invalida.
    */
    function columnasDe(total) {
        if (total <= 0) {return 0;}

        const filas = Math.max(1, Math.ceil(total / FILAS_MAX));

        return Math.max(1, Math.min(COLUMNAS_MAX, Math.ceil(total / filas)));
    }

    /** El byte de `param1` de cada hueco, y el de `type` y `gain`. */
    const BYTE_PARAM1 = { 1: 167, 2: 180, 3: 193, 4: 206 };
    const BYTE_TYPE   = { 1: 166, 2: 179, 3: 192, 4: 205 };
    const BYTE_GAIN   = { 1: 218, 2: 219, 3: 220, 4: 221 };

    /** Cuanto hay que arrastrar para recorrer la carrera entera. */
    const Px_PARA_CARRERA_COMPLETA = 150;

    //--- La tabla por tipo de efecto ----------------------------------------

    let _tabla = null;

    /**
        `id -> fila` del contrato. LA TABLA: una fila por tipo de efecto, con el
        conteo VARIABLE de parametros que conecta y el resto sin conectar.

        Se cachea porque se lee en cada repintado y son 61 filas. La
        ordenacion es la misma que hace `fx_modal_templates.js`: el array del
        contrato va agrupado por familia y NO ordenado, y usarlo tal cual daria
        un desplegable con el `value` equivocado en cada opcion.

        OJO CON LA CACHE Y CON EL CONTRATO QUE NO HA LLEGADO. Si se cacheara
        cuando falta, un script que llame antes de que se cargue
        `fx_contract.gen.js` se quedaria con la tabla vacia PARA SIEMPRE, y el
        rack se quedaria sin un solo mando sin avisar. Por eso sin contrato no
        se cachea nada: se reintenta en la siguiente llamada.

        Y POR QUE LOS NO CONECTABLES SON UN SUFIJO. Los conectables son
        `1..total`, siempre, porque `param1` es el primero que el motor lee; lo
        que no se conecta va detras. Por eso la cola se puede describir con un
        rango (P6..P12) en vez de con doce casillas sueltas.
    */
    function tablaPorTipo() {
        if (_tabla !== null) {return _tabla;}

        const contract = (typeof window !== 'undefined' && window.FxEffectsContract) || null;

        if (!contract || !Array.isArray(contract.effects))
            {return new Map();}

        _tabla = new Map();

        for (const e of contract.effects.slice().sort((a, b) => a.id - b.id)) {
            const total = Math.max(0, Math.min(MANDOS_POR_HUECO, e.params | 0));

            _tabla.set(e.id, {
                id: e.id,
                nombre: e.name,
                familia: e.family || '',
                total,
                efecto: e,
                conectables: Array.from({ length: total }, (_, i) => i + 1),
                noConectables: total >= MANDOS_POR_HUECO
                    ? []
                    : Array.from({ length: MANDOS_POR_HUECO - total }, (_, i) => total + 1 + i)
            });
        }

        return _tabla;
    }

    /** La fila de un tipo, o `null` si el contrato no lo conoce. */
    function filaDeTipo(id) {return tablaPorTipo().get(id) || null;}

    /** El efecto de un id, o `null` si el contrato no lo conoce. */
    function efecto(id) {
        const fila = filaDeTipo(id);
        return fila ? fila.efecto : null;
    }

    /** El id de efecto que tiene este hueco ahora mismo, o `NaN`. */
    function idEfectoDelHueco(hueco) {
        const select = document.querySelector('.fx-type-select[data-slot="' + hueco + '"]');

        return select ? parseInt(select.value, 10) : NaN;
    }

    /**
        La fila del tipo de este hueco, o `null`.

        `null` NO es un bypass: es "no se sabe que hay puesto", que es lo que
        pasa sin contrato o sin desplegable. Se distingue de un Bypass de verdad
        porque ese SI tiene fila, con `total` 0.
    */
    function filaDelHueco(hueco) {
        const id = idEfectoDelHueco(hueco);
        return Number.isFinite(id) ? filaDeTipo(id) : null;
    }

    /**
        Cuantos mandos CONECTA el efecto de este hueco.

        Del contrato, no de una lista. Sin contrato sale 0, que es lo unico
        honesto: no se puede afirmar cuantos mandos tiene algo que no se sabe.
    */
    function mandosDelHueco(hueco) {
        const fila = filaDelHueco(hueco);
        return fila ? fila.total : 0;
    }

    /** El nombre del efecto del hueco, para la cabecera de la rejilla. */
    function nombreDelHueco(hueco) {
        const fila = filaDelHueco(hueco);
        return fila ? fila.nombre : 'Bypass';
    }

    //--- Pintar --------------------------------------------------------------

    /** El `id` del parametro, que es lo que se escribe y lo que se enlaza. */
    function idParametro(hueco, mando) {return 'fx' + hueco + '_param' + mando;}    function knobHTML(hueco, mando, valor) {
        const angulo = (valor * 270) - 135;

        return (
            '<div class="ctrl-unit fx-slot-knob"'
            + ' data-param="' + idParametro(hueco, mando) + '"'
            + ' data-hueco="' + hueco + '"'
            + ' data-mando="' + mando + '"'
            + ' style="display:flex;flex-direction:column;align-items:center;gap:2px;width:100%">'
            +   '<div class="knob-ring" style="--knob-size:26px;flex:none">'
            +     '<div class="knob-pointer" style="transform:rotate(' + angulo + 'deg)"></div>'
            +   '</div>'
            +   '<span class="fx-slot-knob-label" style="font-size:6px;line-height:1;color:var(--text-faint);'
            +     'font-family:\'Share Tech Mono\',monospace">P' + mando + '</span>'
            + '</div>'
        );
    }

    /**
        La cola NO conectable de un hueco: los bytes del registro que este tipo
        de efecto no lee.

        NO es una rejilla de mandos apagados, y esa es toda la diferencia que
        importa. Aqui no hay `data-param`, no hay `.knob-ring`, no hay arrastre
        y no hay puntero: no hay nada a lo que agarrarse. Por construccion
        tampoco se puede escribir en el, porque lo unico que escribe un byte es
        el arrastre de un anillo.

        El texto sale de un RANGO y no de una lista porque los no conectables
        son siempre un sufijo: si el tipo conecta cinco, los que quedan son
        P6..P12, y se ven de un vistazo.
    */
    function noConectableHTML(hueco, conectables, noConectables) {
        if (noConectables === 0) {return '';}

        // Los no conectables son SIEMPRE el sufijo que queda, asi que el rango
        // sale de los dos numeros y no de la fila: sirve igual sin contrato,
        // donde no se sabe que tipo hay y no se conecta ninguno.
        const primero = conectables + 1;
        const ultimo = MANDOS_POR_HUECO;
        const rango = primero === ultimo ? 'P' + primero : 'P' + primero + '..P' + ultimo;

        return (
            '<div class="fx-slot-knob-nc" data-hueco="' + hueco + '"'
            + ' data-no-conectables="' + primero + '..' + ultimo + '"'
            + ' aria-disabled="true"'
            + ' style="display:flex;align-items:center;justify-content:center;gap:3px;'
            + 'width:100%;padding:2px 0;opacity:0.55;cursor:not-allowed;'
            + 'border-top:1px dashed var(--border-dim);'
            + 'font-size:6px;line-height:1;color:var(--text-faint);'
            + 'font-family:\'Share Tech Mono\',monospace">'
            +   '<span>no conectables</span>'
            +   '<span style="opacity:0.75">' + rango + '</span>'
            + '</div>'
        );
    }

    /**
        La rejilla de un hueco: los mandos que CONECTA el tipo, y detras la cola
        de los que no.

        El ancho sale del conteo, y no al reves: una Deep Verb (5) sale en tres
        columnas y dos filas, una Hall (12) en cuatro y tres, y un Bypass (0) no
        tiene rejilla. Antes eran siempre tres columnas con doce casillas, y por
        eso el hueco no se movia al cambiar de efecto.
    */
    function rejillaHTML(hueco) {
        const fila = filaDelHueco(hueco);
        const conectables = fila ? fila.conectables : [];
        const columnas = columnasDe(conectables.length);
        const lectura = typeof window._readFxParamValue === 'function';

        let knobs = '';

        for (const mando of conectables) {
            const valor = lectura
                ? window._readFxParamValue(idParametro(hueco, mando), BYTE_PARAM1[hueco] + mando - 1, 0.5)
                : 0.5;

            knobs += knobHTML(hueco, mando, valor);
        }

        const grid = columnas === 0
            ? ''
            : ('<div class="fx-slot-knob-grid" data-hueco="' + hueco + '"'
                + ' data-columnas="' + columnas + '"'
                + ' data-tipo="' + nombreDelHueco(hueco) + '"'
                + ' style="display:grid;grid-template-columns:repeat(' + columnas + ',1fr);gap:4px 2px;'
                + 'width:100%;justify-items:center">'
                + knobs
                + '</div>');

        const nc = fila ? fila.noConectables.length : MANDOS_POR_HUECO;
        const n = conectables.length;

        const rotulo = (n === 0 ? 'sin mandos' : n + (n === 1 ? ' mando' : ' mandos'))
            + (nc === 0 ? '' : ' · ' + nc + (nc === 1 ? ' no conectable' : ' no conectables'));

        return (
            grid
            + noConectableHTML(hueco, n, nc)
            + '<div class="fx-slot-knob-foot" style="font-size:6px;text-align:center;'
            + 'color:var(--text-faint);margin-top:2px;font-family:\'Share Tech Mono\',monospace">'
            + rotulo
            + '</div>'
        );
    }

    /** Repinta los cuatro huecos. */
    function renderFxSlotKnobs() {
        for (const hueco of HUECOS) {
            const area = document.getElementById('fx' + hueco + '-knobs');

            if (area) {area.innerHTML = rejillaHTML(hueco);}
        }

        enlazaMandos();
    }
    window.renderFxSlotKnobs = renderFxSlotKnobs;

    //--- Arrastrar -----------------------------------------------------------

    /** Mueve solo el puntero. Sin repintar, para no cortar el arrastre. */
    function posicionDe(hueco, mando, valor) {
        const unidad = document.querySelector(
            '[data-param="' + idParametro(hueco, mando) + '"]');

        if (!unidad) {return;}

        const puntero = unidad.querySelector('.knob-pointer');

        if (puntero) {puntero.style.transform = 'rotate(' + ((valor * 270) - 135) + 'deg)';}
    }

    function enlazaMandos() {
        for (const hueco of HUECOS) {
            const area = document.getElementById('fx' + hueco + '-knobs');

            if (!area) {continue;}

            const fila = filaDelHueco(hueco);

            area.querySelectorAll('.knob-ring').forEach((anillo) => {
                const unidad = anillo.closest('.fx-slot-knob');

                if (!unidad) {return;}

                const mando = parseInt(unidad.getAttribute('data-mando'), 10);

                // Cinturon y tirantes. En el DOM solo hay anillos de mandos
                // conectables --la cola no conectable no es un mando-- pero esta
                // es la UNICA linea de todo el modulo que puede escribir un
                // byte, y un byte no conectable no tiene a quien llegar.
                if (!fila || fila.conectables.indexOf(mando) < 0) {return;}

                let arrastrando = false;
                let yInicial = 0;
                let valorInicial = 0.5;

                const valorActual = () => (typeof window._readFxParamValue === 'function'
                    ? window._readFxParamValue(idParametro(hueco, mando), BYTE_PARAM1[hueco] + mando - 1, 0.5)
                    : 0.5);

                const escribe = (valor) => {
                    posicionDe(hueco, mando, valor);

                    if (typeof getBridge === 'function') {
                        const bridge = getBridge();

                        if (bridge) {bridge.setParameter(idParametro(hueco, mando), valor);}
                    }
                };

                const alMover = (e) => {
                    if (!arrastrando) {return;}

                    const valor = Math.max(0.0, Math.min(1.0,
                        valorInicial + ((yInicial - e.clientY) / Px_PARA_CARRERA_COMPLETA)));

                    escribe(valor);
                };

                const alSoltar = () => {
                    arrastrando = false;
                    window.removeEventListener('mousemove', alMover);
                    window.removeEventListener('mouseup', alSoltar);
                };

                anillo.addEventListener('mousedown', (e) => {
                    arrastrando = true;
                    yInicial = e.clientY;
                    valorInicial = valorActual();

                    e.preventDefault();
                    e.stopPropagation();

                    window.addEventListener('mousemove', alMover);
                    window.addEventListener('mouseup', alSoltar);
                });
            });
        }
    }

    /**
        Recupera las posiciones desde el puente SIN repintar.

        Para cuando el cambio viene del otro lado (el host, un preset, el
        autocomprobacion de igualdad de ida y vuelta): si se repintase aqui, un
        arrastre en curso se cortaria a mitad.
    */
    function syncFxSlotKnobPositions() {
        if (typeof window._readFxParamValue !== 'function') {return;}

        for (const hueco of HUECOS) {
            const fila = filaDelHueco(hueco);

            // Solo los que la tabla declara conectables. Los demas no tienen
            // puntero que mover, y moverlos seria escribir en un byte que no
            // lleva a nada.
            for (const mando of (fila ? fila.conectables : [])) {
                posicionDe(hueco, mando,
                    window._readFxParamValue(idParametro(hueco, mando), BYTE_PARAM1[hueco] + mando - 1, 0.5));
            }
        }
    }
    window.syncFxSlotKnobPositions = syncFxSlotKnobPositions;

    //--- Para lo que puedan necesitar otros modulos --------------------------

    Object.defineProperty(window, 'FX_SLOT_BYTES', {
        get: () => ({ param1: { ...BYTE_PARAM1 }, type: { ...BYTE_TYPE }, gain: { ...BYTE_GAIN } }),
        configurable: true
    });

    window.FX_SLOT_KNOB_COUNT = MANDOS_POR_HUECO;
    window.fxSlotParamCount = mandosDelHueco;
    window.fxEffectById = efecto;

    // La tabla, y las dos mitades de la fila, para lo que tenga que saber
    // quantos mandos conectan y cuantos no SIN volver a contarlos.
    window.fxEffectTable = filaDeTipo;
    window.fxSlotRow = filaDelHueco;
    window.fxNoConnectableCount = (hueco) => {
        const fila = filaDelHueco(hueco);
        return fila ? fila.noConectables.length : MANDOS_POR_HUECO;
    };
})();

/**
 * Genera los artefactos de presets de fábrica: `WebUI/js/fx_presets_data/*.js`
 * (4 categorias) + `WebUI/js/factory_fx_presets.js` (el loader).
 * Fuente de verdad: `WebUI/data/factory_fx_presets.json`.
 *
 * Uso:
 *   node scripts/build-fx-presets.js            # escribe los 5 artefactos
 *   node scripts/build-fx-presets.js --check    # NO escribe; sale 1 si estan viejos
 *   node scripts/build-fx-presets.js --help     # imprime el manifiesto
 *
 * ESM, y POR QUE. Este script estaba escrito en CommonJS (`require`, `__dirname`)
 * en un repo cuyo package.json dice `"type": "module"`, asi que Node lo trataba
 * como ESM y reventaba con `ReferenceError: require is not defined`. No era un
 * fallo de este script sino que llevaba tiempo sin poder ejecutarse: los cinco
 * artefactos que produce estaban puestos en el repo y el WebUI los carga, pero
 * NADIE podia regenerarlos. Un artefacto generado por un script que no corre es
 * un artefacto que se queda viejo sin que nada lo diga.
 *
 * `__dirname` no existe en ESM, y se sustituye por `import.meta.dirname`, que
 * es lo mismo pero dicho de la forma de este sistema de modulos. Available en
 * Node 20.11 y superior; el CI usa Node 22, asi que no hace falta alternativa.
 * Si hubiera que soportar mas antiguo, el equivalente es
 * `dirname(fileURLToPath(import.meta.url))`, que es mas pesado de escribir y
 * aqui no aportaria nada.
 */

import fs from 'node:fs';
import path from 'node:path';

const HERE = import.meta.dirname;

const JSON_PATH = path.join(HERE, '..', 'WebUI', 'data', 'factory_fx_presets.json');
const OUTPUT_DIR = path.join(HERE, '..', 'WebUI', 'js', 'fx_presets_data');

// ─────────────────────────────────────────────────────────────────────────────
// EL MANIFIESTO: los cinco ficheros que produce este script, y quien los carga.
//
// Es la unica fuente de verdad, y de ella sale `OUT`. Antes las rutas vivian
// sueltas en tres sitios distintos del cuerpo —una constante de directorio, un
// `cat.file` por categoria, y `LOADER_PATH`— y ninguna decia quien consumia el
// resultado. Un `.gen` que se mueve de sitio se queda viejo sin error: el
// generador escribe el nuevo, el `index.html` sigue pidiendo el viejo, y el
// WebUI arranca con `window.FACTORY_FX_PRESETS` a `undefined` sin decir nada.
//
// Por eso cada entrada declara su consumidor: si alguien mueve un artefacto,
// esta tabla dice a quien hay que mover con el. Y `--check` recorre las CINCO, de
// modo que un artefacto no declarado no puede existir sin que el check lo note.
// ─────────────────────────────────────────────────────────────────────────────
const ARTEFACTOS = [
    {
        clave: 'reverbs',
        rel: 'WebUI/js/fx_presets_data/fx_presets_reverbs.js',
        consumidores: 'WebUI/index.html lo carga por <script>; factory_fx_presets.js lo lee de window.FX_PRESETS_REVERBS',
    },
    {
        clave: 'delays',
        rel: 'WebUI/js/fx_presets_data/fx_presets_delays.js',
        consumidores: 'WebUI/index.html lo carga por <script>; factory_fx_presets.js lo lee de window.FX_PRESETS_DELAYS',
    },
    {
        clave: 'modulation',
        rel: 'WebUI/js/fx_presets_data/fx_presets_modulation.js',
        consumidores: 'WebUI/index.html lo carga por <script>; factory_fx_presets.js lo lee de window.FX_PRESETS_MODULATION',
    },
    {
        clave: 'advanced',
        rel: 'WebUI/js/fx_presets_data/fx_presets_advanced.js',
        consumidores: 'WebUI/index.html lo carga por <script>; factory_fx_presets.js lo lee de window.FX_PRESETS_ADVANCED',
    },
    {
        clave: 'loader',
        rel: 'WebUI/js/factory_fx_presets.js',
        consumidores: 'WebUI/index.html, y de ahi todo el WebUI: effects_presets_filter.js, effects_presets_render.js y effects_presets_storage.js leen window.FACTORY_FX_PRESETS',
    },
];

const OUT = {};
for (const a of ARTEFACTOS) {
    OUT[a.clave] = path.join(HERE, '..', ...a.rel.split('/'));
}

// --check: NO escribe. Compara lo commiteado con lo que sale de leer el JSON y
// sale con 1 si algo no esta al dia. Sin este flag el script escribe siempre, y
// un `node build-fx-presets.js --check` en un pipeline se encargaba de REESCRIBIR
// los artefactos y devolver exito: verde falso, sobre un checkout sucio.
const CHECK_ONLY = process.argv.includes('--check');
const args = process.argv.slice(2).filter((a) => a !== '--check');

if (args.includes('--help') || args.includes('-h')) {
    console.log([
        'Genera los presets de fabrica que consume el WebUI (5 artefactos).',
        '',
        'Uso: node scripts/build-fx-presets.js [--check]',
        '',
        '  (sin flag)  Escribe los 5 artefactos. Solo toca los que cambian.',
        '  --check     NO escribe. Sale 1 si lo commiteado no esta al dia.',
        '',
        'Fuente: WebUI/data/factory_fx_presets.json',
        '',
        'Artefactos producidos:',
    ].concat(ARTEFACTOS.map((a) => '  ' + a.rel + '\n      -> ' + a.consumidores)).join('\n'));
    process.exit(0);
}
const argsDesconocidos = args.filter((a) => !a.startsWith('-'));
if (argsDesconocidos.length > 0) {
    console.error('[fx-presets] Argumento desconocido: ' + argsDesconocidos.join(', ') + ' (usa --help)');
    process.exit(2);
}

// Type classification: each array of fxType values (0..56)
// fxType in JSON is stored as normalized 0..1 float, e.g. 0.02857 ≈ type 1
const CATEGORIES = {
    reverbs:    { types: [1,2,3,4,5,6,22,26,27,28,52,53], var: 'FX_PRESETS_REVERBS' },
    delays:     { types: [12,13,14,15,21,23,24,25,39,40,41,42,43,44,45], var: 'FX_PRESETS_DELAYS' },
    modulation: { types: [9,10,11,16,17,20,36,37,38,46,47,48], var: 'FX_PRESETS_MODULATION' },
};

/**
 * Lee un artefacto como lo ve Git, no como esta en el disco.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL CRLF, Y POR QUE ESTO NO ES UN DETALLE
 *
 * Con `core.autocrlf=true`, el checkout pone CRLF en el fichero de trabajo y el
 * repositorio guarda LF. Un `--check` que comparase los BYTES de disco contra lo
 * que el generador produce (LF) veria los cinco artefactos desfasados siempre, en
 * cualquier maquina con esa configuracion, sin que hubiera cambiado un solo dato.
 *
 * Y ese rojo no se puede usar: es un rojo permanente, y un rojo permanente es
 * justo lo que acaba ignorado. Peor: el arreglo que el mensaje sugiere
 * (regenerar) produce ficheros LF que al volver a hacer checkout vuelven a CRLF,
 * asi que el rojo vuelve. Es el bucle que ya sufrio `generate_fx_contract.mjs` en
 * este repo, y la unica forma de salir es NO comparar bytes de disco.
 *
 * Asi que se normalizan los dos lados antes de comparar: se leen los bytes, se
 * quitan los `\r`, y se compara eso. Lo que se compara es «el contenido», que es
 * lo que el generador controla; el final de linea lo decide Git, no el script.
 *
 * Con eso el `--check` es verde sobre el repo tal como esta, y sigue poniendose
 * rojo en el caso que importa: que alguien cambie el JSON fuente y no regenere.
 */
function leerNormalizado(file) {
    try {
        return fs.readFileSync(file, 'utf8').split('\r\n').join('\n');
    } catch (err) {
        return null;
    }
}

/** Compara el artefacto commiteado con lo que se generaria, sin final de linea. */
function estaAlDia(file, contenido) {
    return leerNormalizado(file) === contenido.split('\r\n').join('\n');
}

/**
 * Serializa con comillas SIMPLES, y por que.
 *
 * `JSON.stringify` emite comillas dobles, y con eso el `--check` daba rojo
 * perpetuo: los cinco artefactos commiteados llevan comillas simples, porque
 * NO los produjo este script —llevaba tiempo sin poder correr (era CommonJS en un
 * repo `type: module`) y se posthicieron a mano—. Los DATOS son identicos byte a
 * byte una vez parseados; lo unico que se diferenciaba eran las comillas.
 *
 * Y la eleccion no es «quedarse con las comillas dobles por Moderno»: es que un
 * `--check` tiene que ser verde sobre el repo tal como esta. Un check que sale
 * rojo por las comillas obliga a regenerar cinco ficheros de 11600 lineas para
 * un cambio de formato que no cambia ni un dato, y al mes siguiente nadie se
 * creera el check cuando de verdad se quede viejo.
 *
 * El cambio es de verdad cosmetico: `JSON.parse` y el runtime del navegador
 * leen las dos formas igual, asi que el `window.FX_PRESETS_REVERBS` que acaba
 * en memoria es el mismo objeto con comillas o sin ellas.
 *
 * Lo que NO se hace es normalizar el JSON entero, porque los numeros de `params`
 * van uno por linea y `JSON.stringify` con indentacion 2 ya los emite asi: lo
 * que cambia es solo la comilla, y se cambia solo la comilla.
 */
function serializar(objeto) {
    return JSON.stringify(objeto, null, 2)
        // Las CLAVES: `"name":` -> `'name':`
        .replace(/"([^"\\]*)":/g, "'$1':")
        // Y los VALORES de texto: `"Stereo Flanger (M)"` -> `'Stereo Flanger (M)'`.
        // Hace falta esta segunda pasada porque el patron anterior solo engancha
        // lo que va seguido de dos puntos, y un valor de texto no lo lleva.
        .replace(/"([^"\\\n]*)"/g, "'$1'");
}
function payloads(data) {
    const classified = clasificar(data);
    const HEADER = '/**\n * @purpose Factory FX presets — ';

    // Las tres categorias nombradas. El `file` sale del manifiesto, no de aqui:
    // una ruta escrita en dos sitios es una ruta que se puede separar.
    const pares = Object.entries(CATEGORIES).map(([catName, cat]) => {
        const contenido = HEADER + catName + ' category.\n'
            + ' * @purpose_en Factory FX presets for ' + catName + '.\n'
            + ' * ⚠️ GENERATED FILE — Do not edit manually.\n'
            + ' * Source: WebUI/data/factory_fx_presets.json\n */\n\n'
            + 'window.' + cat.var + ' = ' + serializar(classified[catName]) + ';\n';

        return { clave: catName, contenido, n: classified[catName].length };
    });

    // La cuarta: advanced, que no esta en CATEGORIES porque es «todo lo demas».
    pares.push({
        clave: 'advanced',
        contenido: HEADER + 'advanced/experimental category.\n'
            + ' * @purpose_en Factory FX presets for advanced effects.\n'
            + ' * ⚠️ GENERATED FILE — Do not edit manually.\n'
            + ' */\n\n'
            + 'window.FX_PRESETS_ADVANCED = ' + serializar(classified.advanced) + ';\n',
        n: classified.advanced.length,
    });

    // El loader. Su contenido nombra las cuatro variables de arriba, asi que si
    // alguien renombra una categoria hay que tocarlo aqui: por eso se compone a
    // partir de CATEGORIES y no como una constante pegada.
    pares.push({
        clave: 'loader',
        contenido: '/**\n * @purpose Loader for categorized factory FX presets.\n'
            + ' * ⚠️ GENERATED FILE — Do not edit manually.\n'
            + ' * Generated by scripts/build-fx-presets.js\n */\n\n'
            + 'window.FACTORY_FX_PRESETS = Object.assign(\n    [],\n'
            + Object.values(CATEGORIES).map((c) => '    window.' + c.var + ' || []').join(',\n') + ',\n'
            + '    window.FX_PRESETS_ADVANCED || []\n);\n',
        n: null,
    });

    return { pares, classified };
}

function clasificar(data) {
    // Convert normalized fxType (0..1 float) to integer type ID (0..56)
    const getTypeId = (preset) => Math.round(preset.type * 56);

    const classified = { reverbs: [], delays: [], modulation: [], advanced: [] };
    const classifiedIds = new Set();

    for (const catName of ['reverbs', 'delays', 'modulation']) {
        const cat = CATEGORIES[catName];
        classified[catName] = data.filter((p) => {
            const typeId = getTypeId(p);
            if (cat.types.includes(typeId)) {
                classifiedIds.add(p.name + '|' + p.type);
                return true;
            }
            return false;
        });
    }

    classified.advanced = data.filter((p) => !classifiedIds.has(p.name + '|' + p.type));

    return classified;
}

/**
 * Verifica rutas ANTES de leer nada, para que un fallo de rutas se lea como un
 * fallo de rutas y no como un error de parseo del JSON o un ENOENT en plena
 * lectura. Sin esto, mover `factory_fx_presets.json` se manifiesta como
 * «Invalid JSON in .../factory_fx_presets.json: ENOENT», que blames al JSON
 * cuando lo que falta es el fichero entero.
 */
function verificarRutas() {
    const problemas = [];

    if (!fs.existsSync(JSON_PATH)) {
        problemas.push('FUENTE_AUSENTE WebUI/data/factory_fx_presets.json  (la fuente de verdad)');
    }

    // El manifiesto y `OUT` tienen que contar lo mismo: si divergen, hay un
    // artefacto que el generador escribe sin declarar, o uno declarado que
    // nadie escribe. Se comprueba en los dos sentidos.
    for (const a of ARTEFACTOS) {
        if (!OUT[a.clave]) {
            problemas.push('MANIFIESTO_HUERFANO ' + a.clave + ' esta en ARTEFACTOS pero no en OUT');
        }
        // Normalizado a `/`: en Windows `path.relative` devuelve `WebUI\js\...`,
        // que nunca puede coincidir con una ruta escrita a mano en el manifiesto.
        const relativo = path.relative(path.join(HERE, '..'), OUT[a.clave]).split(path.sep).join('/');
        if (relativo !== a.rel) {
            problemas.push('MANIFIESTO_DESINCRONIZADO ' + a.clave + ': OUT dice ' + relativo + ', ARTEFACTOS dice ' + a.rel);
        }
    }
    for (const clave of Object.keys(OUT)) {
        if (!ARTEFACTOS.some((a) => a.clave === clave)) {
            problemas.push('OUT_SIN_DECLARAR ' + clave + ' esta en OUT pero no en ARTEFACTOS');
        }
    }

    // Cada categoria de CATEGORIES tiene que tener su artefacto, y al reves. Sin
    // esta comprobacion, anadir una quinta categoria a CATEGORIES produce un
    // artefacto que no esta en el manifiesto y no lo vigila nadie.
    for (const catName of Object.keys(CATEGORIES)) {
        if (!ARTEFACTOS.some((a) => a.clave === catName)) {
            problemas.push('CATEGORIA_SIN_ARTEFACTO ' + catName + ' esta en CATEGORIES pero no en ARTEFACTOS');
        }
    }
    for (const a of ARTEFACTOS) {
        if (a.clave !== 'advanced' && a.clave !== 'loader' && !(a.clave in CATEGORIES)) {
            problemas.push('ARTEFACTO_SIN_CATEGORIA ' + a.clave + ' esta en ARTEFACTOS pero no en CATEGORIES');
        }
    }

    // Directorios de salida. En --check se avisa pero no se pone rojo —puede que el
    // repo este a medio clonar y lo que interesa es el informe—, y al escribir se
    // crean, porque un mkdir aqui evita que el primer write falle con ENOENT.
    if (!fs.existsSync(OUTPUT_DIR)) {
        if (!CHECK_ONLY) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }
    }

    if (problemas.length === 0) return;

    console.error('[fx-presets] FALLO DE RUTAS — ' + problemas.length + ' problema(s):');
    for (const p of problemas) console.error('  ✗ ' + p);
    console.error('');
    console.error('  Fuente leida:');
    console.error('    json = WebUI/data/factory_fx_presets.json');
    console.error('  Artefactos producidos:');
    for (const a of ARTEFACTOS) console.error('    ' + a.rel + '\n        -> ' + a.consumidores);
    process.exit(1);
}

function leerJson() {
    if (!fs.existsSync(JSON_PATH)) {
        throw new Error('Source JSON not found: ' + JSON_PATH);
    }

    let data;
    try {
        data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
    } catch (e) {
        throw new Error('Invalid JSON in ' + JSON_PATH + ': ' + e.message);
    }

    if (!Array.isArray(data)) {
        throw new Error('Expected an array of presets in ' + JSON_PATH);
    }

    return data;
}

function main() {
    verificarRutas();

    const data = leerJson();
    const { pares, classified } = payloads(data);

    const total = data.length;
    const suma = Object.values(classified).reduce((a, b) => a + b.length, 0);
    if (suma !== total) {
        console.warn('[fx-presets] AVISO: clasificados ' + suma + '/' + total + ' presets (no cuadra)');
    }

    if (CHECK_ONLY) {
        // No se escribe: se compara byte a byte con lo commiteado y, si no esta
        // al dia, se registra como desfasado saliendo con codigo 1. Comparar (en
        // vez de escribir y confiar en que el arbol quede limpio) es lo que hace
        // el flag utilizable desde CI sin ensuciar el checkout.
        const desfasados = [];
        let alDia = 0;

        for (const { clave, contenido } of pares) {
            const file = OUT[clave];

            if (estaAlDia(file, contenido)) {
                alDia++;
            } else {
                desfasados.push(file);
            }
        }

        console.log('[fx-presets] CHECK — ' + total + ' presets · declarados: ' + ARTEFACTOS.length
            + ' · al día: ' + alDia + ' · desfasados: ' + desfasados.length);
        for (const a of ARTEFACTOS) {
            console.log('  ' + a.clave.padEnd(11) + a.rel);
        }
        for (const cat of ['reverbs', 'delays', 'modulation', 'advanced']) {
            console.log('  ' + cat.padEnd(11) + classified[cat].length + ' presets');
        }

        if (desfasados.length > 0) {
            console.error('[fx-presets] DESFASADO — ejecuta `node scripts/build-fx-presets.js` y commitea:');
            for (const f of desfasados) {
                console.error('  ✗ ' + path.relative(path.join(HERE, '..'), f).split(path.sep).join('/'));
            }
            process.exit(1);
        }

        console.log('[fx-presets] OK — los 5 artefactos commiteados están al día.');
        process.exit(0);
    }

    // Modo escritura: se compara antes de escribir, para no tocar la fecha de un
    // artefacto que no ha cambiado. Un no-op deja el mtime intacto, que es lo
    // que un watcher o un `make` mira para no rehacer trabajo.
    const escritos = [];
    const intactos = [];
    for (const { clave, contenido, n } of pares) {
        const file = OUT[clave];

        if (estaAlDia(file, contenido)) {
            intactos.push({ file, n });
            continue;
        }
        fs.writeFileSync(file, contenido, 'utf8');
        escritos.push({ file, n });
    }

    console.log('[fx-presets] ' + total + ' presets → ' + ARTEFACTOS.length + ' artefactos');
    for (const { file, n } of escritos) {
        console.log('  ~ ' + path.relative(path.join(HERE, '..'), file).split(path.sep).join('/')
            + (n !== null ? ' (' + n + ' presets)' : ' (loader)'));
    }
    for (const { file, n } of intactos) {
        console.log('  = ' + path.relative(path.join(HERE, '..'), file).split(path.sep).join('/')
            + (n !== null ? ' (' + n + ' presets)' : ' (loader)') + ' (sin cambios)');
    }

    for (const a of ARTEFACTOS) {
        console.log('  ' + a.clave.padEnd(11) + a.rel);
    }

    console.log('\n✅ Build complete: ' + total + ' presets → ' + ARTEFACTOS.length + ' artefactos');
}

try {
    main();
} catch (e) {
    console.error('❌ Build failed: ' + e.message);
    process.exit(1);
}


/**
 * bundleEnElBinario.test.js — que la verificación del binario no se pueda perder.
 *
 * QUÉ HAY YA, Y QUÉ FALTA
 *
 * El job `bundle-in-binary` de `.github/workflows/webui-bundle-ci.yml` tiene un
 * paso que ejecuta `scripts/verify_embedded_bundle.js`. Ese paso es lo ÚNICO que
 * hace que el job no sea decorativo, y el propio comentario que lo precede lo
 * dice: enlazar no es producir, y los cuatro pasos anteriores pasan igual con el
 * árbol crudo dentro.
 *
 * Lo que faltaba era el guard. MEDIDO: `scripts/verify_docs_ci_jobs.js` comprueba
 * los IDs de los 13 jobs del plan, no los pasos, y ningún test del repo
 * mencionaba ese paso. Es decir, que el único paso que hace útil el job se podía
 * borrar —o neutralizar— sin que nada se pusiera rojo. Ese es justo el fallo que
 * este repo lleva dos sesiones pagando: un guard que vigila algo que nadie
 * ejecuta, o una protección que se puede quitar sin consequences.
 *
 * LAS TRES DEGRADACIONES QUE ESTE FICHERO CIERRA
 *
 *   1. Borrar el paso. El job sigue verde: el aviso de CMake ("embebiendo el
 *      bundle Vite"), el chequeo del CSS y la compilación siguen pasando, porque
 *      los tres son ciertos con el árbol crudo dentro.
 *   2. Neutralizarlo: `continue-on-error: true`, o `|| true`, o `|| echo`. El
 *      paso se ejecuta, el log enseña las comprobaciones, y el job pasa igual.
 *      Esto es PEOR que borrarlo, porque el log dice que se comprobo.
 *   3. Degradar el comprobador: que deje de mirar el binario y se quede con el
 *      dist. Los marcadores del dist son los mismos que los del binario, así que
 *      el texto del paso no cambia: solo hay que probarlo con un binario falso.
 *
 * LA TERCERA ES LA QUE NO SE VE LEYENDO EL WORKFLOW
 *
 * Por eso los tests de aquí no solo leen el YAML: EJECUTAN el comprobador contra
 * un binario de mentira que se parece al árbol crudo, y exigen que salga con
 * código distinto de cero. Sin eso, un paso «presente y bien escrito» puede no
 * comprobar nada, y el guard del texto pasaría igual.
 *
 * POR QUÉ ES PORTABLE Y NO UN TEST DE WINDOWS
 *
 * Todo esto corre en ubuntu: leer YAML y lanzar `node` con un fichero de
 * texto. No hay `cmd.exe` en ninguna parte, así que este fichero lo corre
 * `webui-ci.yml` con el resto de la suite y no necesita un runner de Windows
 * para vigilar un runner de Windows.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'webui-bundle-ci.yml');
const COMPROBADOR = path.join(ROOT, 'scripts', 'verify_embedded_bundle.js');
const YAML = fs.readFileSync(WORKFLOW, 'utf8');

/** Lo que el comprobador exige encontrar DENTRO del binario. */
const PRESENTES = ['assets/keyboard.js', 'assets/fit-stage.js', 'assets/keyboard.css'];
/** La firma del árbol crudo: el HTML sin empaquetar. */
const FIRMA_CRUDA = 'src="js/keyboard.js"';

// ────────────────────────────────────────────────────── el paso, en el YAML ──

describe('bundle-in-binary — los pasos que hacen que el job no sea decorativo', () => {
  it('hay un paso que ejecuta el comprobador del binario', () => {
    // Sin esto, el job comprueba que CMake ha dicho una frase y ya.
    const pasos = pasosQueEjecutanElComprobador();
    expect(pasos.length, 'el job no tiene ningun paso con verify_embedded_bundle.js').toBeGreaterThan(0);
    for (const paso of pasos) {
      expect(paso.run).toContain('scripts/verify_embedded_bundle.js');
    }
  });

  it('los DOS binarios que se distribuyen se verifican por su RUTA', () => {
    // Se compila el Standalone y el VST3, y son dos artefactos con dos rutas de
    // incrustacion distintas. Comprobar uno solo deja al otro sin mirar.
    //
    // Y el `--binario` tiene que ser EXPLICITO, y no por claridad. Sin ruta, el
    // comprobador busca por orden de patrones y el Standalone va el primero: con
    // dos binarios en el arbol, el paso del VST3 acabaria comprobando DOS VECES
    // el Standalone. Verde, y el VST3 sin mirar una sola vez. Es la degradacion
    // invisible: el paso existe, dice lo que dice, y no comprueba lo que dice.
    const pasos = pasosQueEjecutanElComprobador();
    // MEDIDO: `[^\s]+` se paraba en el espacio de "ABD Eep.exe" y devolvia
    // una ruta que no existe, que hacia fallar el test por un motivo del
    // REGEX y no del workflow. Las dos formas de escribirla se contemplan:
    // entrecomillada, o con barras hacia atras para que el espacio no corte.
    const rutas = pasos
      .map((p) => {
        const m = p.run.match(/--binario\s+(?:"([^"]+)"|(\S+))/);
        return m ? (m[1] || m[2]) : undefined;
      })
      .filter(Boolean);

    expect(pasos.length, 'el job no verifica ningun binario').toBeGreaterThan(1);
    expect(
      rutas.length,
      'ningun paso de verificacion dice QUE binario mira: se comproba el primero que encuentre',
    ).toBe(pasos.length);
    expect(
      rutas.some((r) => /Standalone[/\\]ABD Eep\.exe$/i.test(r)),
      `el Standalone no se verifica por su ruta explicita: ${rutas.join(', ')}`,
    ).toBe(true);
    expect(
      rutas.some((r) => /\.vst3[/\\]Contents[/\\]x86_64-win[/\\]ABD Eep\.vst3$/i.test(r)),
      `el VST3 no se verifica por su ruta explicita: ${rutas.join(', ')}`,
    ).toBe(true);
  });

  it('el job compila los dos binarios que luego verifica', () => {
    // Verificar un binario que nadie compila no dice nada: o falla porque no lo
    // encuentra, o —peor— se lo salta.
    for (const [nombre, marca] of [
      ['Standalone', '--target ABDEep_Standalone_Standalone'],
      ['VST3', '--target ABDEep_Standalone_VST3'],
    ]) {
      expect(
        pasos().some((p) => p.texto.includes(marca)),
        `el job verifica el ${nombre} pero no lo compila`,
      ).toBe(true);
    }
  });

  it('los pasos van en el orden en que pueden fallar', () => {
    // Empaquetar -> comprobar el CSS -> configurar (que embeba) -> compilar ->
    // verificar. Cada uno depende del anterior, y en el orden contrario el fallo
    // sale en el sitio equivocado: verificar antes de compilar no tiene binario
    // que mirar, y configurar antes de empaquetar incrusta el arbol crudo sin
    // que nadie se entere hasta que el keybed no monta en el host.
    const orden = [
      ['empaquetar el WebUI', 'node scripts/build_webui.js'],
      ['comprobar el CSS del keybed', 'keyboard.css'],
      ['configurar CMake', 'Configure CMake'],
      ['compilar', 'cmake --build build'],
      ['verificar el binario', 'verify_embedded_bundle.js'],
    ];
    const posiciones = [];
    for (const [que, marca] of orden) {
      const hallados = pasosQueContienen(marca);
      expect(hallados.length, `el job no tiene ningun paso de: ${que}`).toBeGreaterThan(0);
      posiciones.push([que, hallados[0].inicio]);
    }
    for (let i = 1; i < posiciones.length; i++) {
      expect(
        posiciones[i - 1][1],
        `${posiciones[i - 1][0]} esta DESPUES de ${posiciones[i][0]}`,
      ).toBeLessThan(posiciones[i][1]);
    }
  });

  it('NINGUNO de los pasos criticos se neutraliza', () => {
    // La degradacion mas cara y la mas probable: alguien ve el job en rojo,
    // decide "esto se rompe siempre" y le pone continue-on-error, o `|| true`,
    // o `|| echo`. El paso se ejecuta, el log ensena las comprobaciones, y el
    // job pasa. Peor que borrarlo, porque el log MIENTE.
    //
    // Se comprueban los cinco, no solo el del comprobador: el mismo `|| echo`
    // puesto en el del CSS deja el job verde con el desplegable de efectos vacio
    // en el keybed, que es el fallo todavia no dado.
    for (const [que, marca] of PASOS_CRITICOS) {
      for (const paso of pasosQueContienen(marca)) {
        expect(paso.run, `${que}: el paso se neutraliza con || true o || echo`)
          .not.toMatch(/\|\|\s*(true|echo)\b/);
        expect(paso.run, `${que}: el paso se neutraliza con || exit 0`)
          .not.toMatch(/\|\|\s*exit\s+0/);
        expect(paso.texto, `${que}: el paso tiene continue-on-error`)
          .not.toMatch(/continue-on-error:\s*true/);
      }
    }
  });

  it('el workflow se dispara con los cambios que pueden romper el bundle', () => {
    // El filtro `paths` es lo que decide si el workflow corre. Si el fichero
    // vigilado se queda fuera, el guard se pone rojo solo cuando alguien cambia
    // otra cosa, que es la forma de que un rojo llegue cuando ya no toca.
    for (const fichero of [
      'scripts/verify_embedded_bundle.js',
      'scripts/build_webui.js',
      'build.bat',
      'CMakeLists.txt',
      '.github/workflows/webui-bundle-ci.yml',
    ]) {
      expect(
        disparadores().some((p) => p.includes(fichero)),
        `${fichero} esta fuera de los filtros paths: cambiarlo no dispara este workflow`,
      ).toBe(true);
    }
  });
});

// ───────────────────────────────────────── el comprobador, contra un binario ──

describe('verify_embedded_bundle.js — falla cuando toca', () => {

// MEDIDO con vitest 4.1.11: este bloque lanza procesos hijo por test, y el
// timeout va aqui, en el `describe`, y NO en cada `it`.
//
// No es que estos tests sean lentos: aislado el mas lento de este fichero tarda 200 ms.
// Lo que falla es la contencion. vitest 4 cambio el pool por defecto de `threads`
// a `forks`, asi que 127 ficheros levantan procesos hijo a la vez y compiten por la
// CPU. Medido en la suite completa: un test que tarda 485 ms aislado tardaba 5355
// ms, o sea ~11x.
//
// Por que en el `describe` y no en cada `it`: puesto test a test solo se arregla el
// que fallo. La corrida siguiente saca el hermano, que es el mismo bloque con la
// misma causa. Aqui se cubre el bloque entero de una vez.
//
// 30 s es unas tres veces el peor caso medido con contencion, y sigue siendo un
// fallo rapido si algo se cuelga de verdad. Es la misma convencion que ya usan
// `baselineGuard` (240 s), `ciSubprocessTests` y `recuentoPorRecoleccion` (120 s).
  let temporal = null;

  beforeAll(() => {
    temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'abdeep-bundle-'));
  });

  afterAll(() => {
    if (temporal !== null) {fs.rmSync(temporal, {recursive: true, force: true});}
  });

  /** Escribe un "binario" de mentira y lo pasa por el comprobador. */
  function pasar(contenido, nombre = 'falso.exe') {
    const ruta = path.join(temporal, nombre);
    fs.writeFileSync(ruta, contenido, 'latin1');
    const r = spawnSync(process.execPath, [COMPROBADOR, '--binario', ruta], {
      encoding: 'latin1', cwd: ROOT, timeout: 60000,
    });
    return {salida: `${r.stdout || ''}${r.stderr || ''}`, codigo: r.status};
  }

  it('un binario con el ARBOL CRUDO sale en rojo', () => {
    // El caso que el job existe para cazar: el HTML sin empaquetar, con sus
    // imports desnudos y sin el CSS del keybed. Es lo que se metería en el
    // binario si el empaquetado fallara y nadie se enterara.
    const crudo = [
      '<html><head>',
      '<link rel="stylesheet" href="css/keyboard.css">',
      '<script type="module" ' + FIRMA_CRUDA + '></script>',
      '<script type="module" src="js/fit-stage.js"></script>',
      '</head><body></body></html>',
    ].join('\n');
    const {salida, codigo} = pasar(crudo, 'arbol-crudo.exe');

    expect(codigo, 'el comprobador tiene que salir distinto de cero con el arbol crudo').not.toBe(0);
    // Y no vale con un codigo generico: tiene que decir QUE falta.
    for (const marca of PRESENTES) {
      expect(salida, `no dice que falta ${marca}`).toContain(`falta ${marca} en el binario`);
    }
    // Y que aparezca la firma del arbol crudo es el aviso mas claro de todos.
    expect(salida).toContain(`aparece ${FIRMA_CRUDA} en el binario`);
    expect(salida).toContain('se ha embebido el arbol CRUDO');
  });

  it('un binario con el BUNDLE pasa las marcas del binario', () => {
    // El control positivo. Sin el, el test de arriba pasaria con un comprobador
    // que falla siempre, que es un comprobador que no comprueba.
    const bundleado = [
      '<html><head>',
      '<link rel="stylesheet" href="/assets/keyboard.css">',
      '<script type="module" src="/assets/keyboard.js"></script>',
      '<script type="module" src="/assets/fit-stage.js"></script>',
      '</head><body></body></html>',
    ].join('\n');
    const {salida} = pasar(bundleado, 'bundleado.exe');

    for (const marca of PRESENTES) {
      expect(salida, `no confirma ${marca} en el binario`).toContain(`OK  presente  ${marca}`);
    }
    expect(salida).toContain('OK  ausente    ' + FIRMA_CRUDA);
  });

  it('si el binario no existe, FALLA y no dice que todo bien', () => {
    // La degradacion mas silenciosa de todas: que el comprobador no encuentre el
    // binario y lo tome por un "nada que comprobar". Con esta asercion, un
    // `--binario` mal escrito o un cambio en la carpeta de salida sale en rojo en
    // vez de dejar el job en verde sin haber mirado nada.
    const r = spawnSync(process.execPath, [COMPROBADOR, '--binario', path.join(temporal, 'no-existe.exe')], {
      encoding: 'latin1', cwd: ROOT, timeout: 60000,
    });
    const salida = `${r.stdout || ''}${r.stderr || ''}`;
    expect(r.status, 'un binario inexistente tiene que salir distinto de cero').not.toBe(0);
    expect(salida).not.toContain('OK — el binario lleva el bundle');
    expect(salida).toMatch(/no existe/i);
  });
}, 30000);

// ──────────────────────────────────────────────────────────────── ayudantes ──

/**
 * El bloque del paso que ejecuta el comprobador: su `run` y su texto entero.
 *
 * Se recorta por los `- name:` de la columna 6, que es como esta escrito el job.
 * Devolver `null` si no hay tal paso es mejor que devolver `''`: el mensaje de
 * fallo puede decir entonces que no existe, en vez de fallar con un
 * "expected '' to contain" que no explica nada.
 */
/**
 * Los cinco pasos CRITICOS del job: sin cualquiera de ellos el job pasa sin
 * comprobar nada. Se listan aqui para que la comprobacion de "no se neutraliza"
 * sea una lista y no cinco copias: la copia es lo que deja de vigilar cuando el
 * job gana un paso nuevo.
 */
const PASOS_CRITICOS = [
  ['empaquetar el WebUI', 'node scripts/build_webui.js'],
  ['comprobar el CSS del keybed', 'keyboard.css'],
  ['configurar CMake', 'Configure CMake'],
  ['compilar', 'cmake --build build'],
  ['verificar el binario', 'verify_embedded_bundle.js'],
];

/** Todos los pasos del workflow, con su posicion y su bloque `run`. */
function pasos() {
  const lineas = YAML.split('\n');
  const salida = [];
  let desde = 0;
  for (let i = 0; i < lineas.length; i++) {
    if (!/^ {6}- (name|uses):/.test(lineas[i])) {continue;}
    let fin = i + 1;
    while (fin < lineas.length && !/^ {6}- (name|uses):/.test(lineas[fin])) {fin++;}
    const texto = lineas.slice(i, fin).join('\n');
    const m = texto.match(/\n\s*run:\s*([\s\S]*?)(?=\n\s{4,8}\S|$)/);
    salida.push({texto, run: m ? m[1].trim() : '', inicio: desde});
    desde += lineas.slice(i, fin).reduce((a, l) => a + l.length + 1, 0);
  }
  return salida;
}

/** Todos los pasos cuyo texto contenga `aguja`. */
function pasosQueContienen(aguja) {
  return pasos().filter((p) => p.texto.includes(aguja));
}

/** Los pasos que ejecutan el comprobador del bundle. */
function pasosQueEjecutanElComprobador() {
  return pasosQueContienen('scripts/verify_embedded_bundle.js');
}

/** Los items de `paths` del workflow: seis espacios, guion y comillas. */
function disparadores() {
  return [...YAML.matchAll(/^ {6}- "(.+)"$/gm)].map((m) => m[1]);
}
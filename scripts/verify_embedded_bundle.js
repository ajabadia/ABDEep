/**
 * verify_embedded_bundle.js — ¿el binario que se reparte lleva el BUNDLE?
 *
 * CMake embebe `WebUI/dist` si existe, y el árbol CRUDO si no. Los dos compilan,
 * los dos enlazan, los dos producen un `.exe`/`.vst3` y los dos pasan en verde.
 * La diferencia entre ellos no aparece en el build: aparece en el WebView2, donde
 * el keybed compartido no monta porque sus bare imports `@abdsynths/*` no
 * resuelven sin `node_modules` en runtime. El sintoma es un 404 en la consola del
 * WebView2 y un plugin sin teclado, sin un solo error en el host.
 *
 * Por eso hace falta un comprobador y no basta con "el build paso": `ninja`/`msbuild`
 * dan el mismo codigo de salida con las dos cosas dentro. Y por eso esto mira el
 * CONTENIDO del binario, no el nombre de los recursos embebidos: los nombres los
 * genera `juce_add_binary_data` a partir del basename y cambian con cualquier
 * fichero que colisione, asi que un rojo por ahi seria un falso positivo.
 *
 * LOS MARCADORES, Y POR QUE ESTOS Y NO OTROS
 *
 * Presencia de `assets/index.js` y `assets/index.css`: son los dos ficheros que
 * solo puede haber escrito Vite. MEDIDO sobre un dist real: el nombre NO sale de
 * las entradas, sale del `index.html` de ENTRADA. Los dos
 * `<script type="module" src="js/...">` del HTML se embeben en el chunk del
 * propio HTML, y el CSS de todo el grafo acaba en un unico fichero. Por eso los
 * nombres `assets/keyboard.js`, `assets/fit-stage.js` y `assets/keyboard.css` que
 * aqui se comprobaban antes NUNCA llegan a existir: daban un rojo fijo, no un
 * aviso. Ademas `WebUI/assets/` en el arbol crudo solo lleva imagenes, asi que
 * estos dos marcadores ya descartan el arbol crudo por si solos.
 *
 * Ausencia de `src="js/keyboard.js"`: la inversa del anterior, y se mira a
 * proposito. Es la firma del HTML sin empaquetar: en el arbol crudo el `<script>`
 * apunta a ese fichero, y en el empaquetado ya no, porque Vite lo ha tragado.
 *
 * NO se comprueba que falte `@abdsynths/midi-keyb` en el BINARIO: aparece igual con
 * bundle, porque el `index.html` y `js/keyboard_render.js` lo mencionan. Esa
 * comprobacion solo tiene sentido sobre `dist/assets/index.js`, y se hace
 * aparte, en el propio dist, donde si es fiable.
 *
 *   node scripts/verify_embedded_bundle.js [--binario <ruta>]
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Lo que TIENE que haber dentro del binario si lleva el bundle. */
const PRESENTES = ['assets/index.js', 'assets/index.css'];

/** Lo que NO puede aparecer: es la firma del árbol CRUDO. */
const AUSENTES = ['src="js/keyboard.js"'];

/**
 * Busca el binario. Se puede pasar a mano; si no, se busca lo tipico de un build
 * de JUCE en Release. Se mira el Standalone primero porque es lo que se produce
 * siempre, y luego el VST3.
 */
function buscarBinario(arg) {
  if (arg) {
    if (!fs.existsSync(arg)) {throw new Error(`no existe el binario ${arg}`);}
    return arg;
  }
  const raices = ['build'];
  const patrones = [
    /ABDEep_Standalone_artefacts[\\/]Release[\\/]Standalone[\\/]ABD Eep\.exe$/,
    /ABDEep_Standalone_artefacts[\\/]Release[\\/]VST3[\\/].*\.vst3[\\/]ABD Eep\.vst3$/,
  ];
  for (const raiz of raices) {
    for (const patron of patrones) {
      const encontrado = buscarPorPatron(path.join(RAIZ, raiz), patron);
      if (encontrado) {return encontrado;}
    }
  }
  throw new Error(
    'no se encuentra ningun binario construido bajo build/. '
    + 'Construye el Standalone antes, o pasa la ruta con --binario.');
}

function buscarPorPatron(dir, patron) {
  let lista;
  try {lista = fs.readdirSync(dir, {withFileTypes: true});} catch {return null;}
  for (const entrada of lista) {
    const completa = path.join(dir, entrada.name);
    const relativa = completa.slice(RAIZ.length + 1).split(path.sep).join('/');
    if (patron.test(relativa)) {return completa;}
    if (entrada.isDirectory()) {
      const dentro = buscarPorPatron(completa, patron);
      if (dentro) {return dentro;}
    }
  }
  return null;
}

/** Busca una cadena en un binario. Buffer y no string: hay bytes que no son UTF-8. */
function contiene(ruta, aguja) {
  return fs.readFileSync(ruta).includes(Buffer.from(aguja, 'utf8'));
}

function comprobarDist() {
  // El bundle tiene que tener los imports resueltos. Esto se mira en el DIST, no
  // en el binario, porque en el binario la cadena aparece igualmente (ver cabecera).
  const bundle = path.join(RAIZ, 'WebUI', 'dist', 'assets', 'index.js');
  if (!fs.existsSync(bundle)) {
    console.error(`::error::no existe ${path.relative(RAIZ, bundle)}: el WebUI no esta empaquetado`);
    return false;
  }
  const texto = fs.readFileSync(bundle, 'utf8');
  if (/@abdsynths\//.test(texto)) {
    console.error('::error::WebUI/dist/assets/index.js todavia tiene imports @abdsynths/* sin resolver');
    return false;
  }
  console.log('  OK  el bundle de index.js no tiene imports desnudos');
  return true;
}

function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--binario');
  const explicito = i >= 0 ? args[i + 1] : undefined;
  if (i >= 0 && !explicito) {
    console.error('--binario necesita una ruta');
    process.exit(2);
  }

  const binario = buscarBinario(explicito);
  console.log(`binario: ${path.relative(RAIZ, binario)} (${(fs.statSync(binario).size / 1048576).toFixed(1)} MB)`);

  let fallos = 0;
  for (const marca of PRESENTES) {
    if (contiene(binario, marca)) {
      console.log(`  OK  presente  ${marca}`);
    } else {
      console.error(`::error::falta ${marca} en el binario: no lleva el bundle de Vite`);
      fallos++;
    }
  }
  for (const marca of AUSENTES) {
    if (contiene(binario, marca)) {
      console.error(`::error::aparece ${marca} en el binario: se ha embebido el arbol CRUDO, no el bundle`);
      fallos++;
    } else {
      console.log(`  OK  ausente    ${marca} (no es el arbol crudo)`);
    }
  }

  if (!comprobarDist()) {fallos++;}

  if (fallos > 0) {
    console.error(`\n${fallos} comprobacion(es) fallida(s). Ejecuta 'node scripts/build_webui.js' ANTES de configurar CMake.`);
    process.exit(1);
  }
  console.log('\nOK — el binario lleva el bundle de Vite, no el arbol crudo.');
}

main();
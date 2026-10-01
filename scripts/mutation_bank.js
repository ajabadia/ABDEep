#!/usr/bin/env node
/**
 * @file mutation_bank.js
 * @purpose Ejecuta el banco de mutaciones del WebUI: rompe el codigo a proposito,
 *          una invariante por entrada, y exige que la suite lo note. Si alguna
 *          mutacion pasa con la suite en verde, el banco falla.
 *
 * POR QUE FALLA Y NO AVISA. Un test que dejo de mirar algo no se queja: sigue
 * verde mientras comprueba menos. Eso se descubre cuando hay un fallo en el
 * motor y el test que deberia haberlo visto lleva meses en verde. Aqui se
 * invierte el orden: primero se rompe, y la pregunta es si alguien se entera.
 *
 * COMO SE APLICA. In-place, con copia del original a disco ANTES de escribir y
 * restauracion en un `finally`. Se elige in-place y no sobre una copia del
 * arbol porque los tests calculan la raiz con `path.resolve(__dirname, '..',
 * '..')` y leen ficheros de `Source/`, `schemas/` y `resources/`: una copia
 * parcial daria falsos negativos. La copia del original va a
 * `node_modules/.cache/mutation-bank/`, que esta en el ignore, y si el proceso
 * muere a mitad el siguiente arranque la restaura antes de tocar nada.
 *
 * USO
 *   node scripts/mutation_bank.js                 # el banco entero
 *   node scripts/mutation_bank.js --list          # solo la lista
 *   node scripts/mutation_bank.js --only escape-html-sin-etiquetas
 *   node scripts/mutation_bank.js --json informe.json
 *
 * SALIDA: 0 si toda mutacion fue cazada; 1 si alguna paso inadvertida, si
 * alguna quedo rota por un cambio en el codigo, o si al terminar queda algun
 * fichero sin restaurar.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MUTACIONES } from './mutation_bank.data.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(RAIZ, 'node_modules', '.cache', 'mutation-bank');
const MS_POR_MUTACION = Number(process.env.MUTATION_BANK_TIMEOUT_MS ?? 300000);

const args = process.argv.slice(2);
const solo = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const listar = args.includes('--list');
const ensayo = args.includes('--dry-run');
const destinoJson = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

const vitestBin = path.join(
  RAIZ, 'node_modules', '.bin',
  process.platform === 'win32' ? 'vitest.CMD' : 'vitest',
);

/* ── Copias de seguridad ────────────────────────────────────────────────── */

/** Nombre del fichero de copia: el id de la mutacion, no el del fuente. */
const copiaDe = (m) => path.join(CACHE, m.id + '.orig');

function guardarOriginal(m, contenido) {
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(copiaDe(m), contenido, 'utf8');
}

function restaurar(m) {
  const copia = copiaDe(m);
  if (!fs.existsSync(copia)) return false;
  fs.writeFileSync(path.join(RAIZ, m.fichero), fs.readFileSync(copia, 'utf8'), 'utf8');
  fs.rmSync(copia, { force: true });
  return true;
}

/**
 * Si el proceso anterior murio con una mutacion puesta, el repositorio se
 * queda con el codigo roto, y por eso hay que restaurar ANTES de mirar nada:
 * si no, el `de` de la mutacion ya no aparece y el banco la daria por rota,
 * blaming a un fichero que en realidad esta intacto desde hace una corrida.
 */
function restaurarHuerfanos() {
  if (!fs.existsSync(CACHE)) return 0;
  const ficheros = fs.readdirSync(CACHE).filter((f) => f.endsWith('.orig'));
  let n = 0;
  for (const f of ficheros) {
    const id = f.slice(0, -'.orig'.length);
    const m = MUTACIONES.find((x) => x.id === id);
    if (!m) { fs.rmSync(path.join(CACHE, f), { force: true }); continue; }
    console.log(`  restaurado del intento anterior: ${m.fichero} (${m.id})`);
    if (restaurar(m)) n++;
  }
  return n;
}

/* ── Aplicar ────────────────────────────────────────────────────────────── */

const apariciones = (texto, aguja) => texto.split(aguja).length - 1;

function aplicar(m) {
  const absoluto = path.join(RAIZ, m.fichero);
  const original = fs.readFileSync(absoluto, 'utf8');
  const n = apariciones(original, m.de);

  if (n !== 1) {
    return { estado: 'ROTA', motivo: `el patron aparece ${n} veces (se esperaba 1)` };
  }
  guardarOriginal(m, original);
  fs.writeFileSync(absoluto, original.replace(m.de, m.a), 'utf8');
  return { estado: 'puesta' };
}

/* ── Ejecutar la suite ──────────────────────────────────────────────────── */

/**
 * Una mutacion esta CAZADA cuando la suite se pone roja por su culpa.
 *
 * Se cuentan los tests FALLIDOS del informe de vitest, no solo el codigo de
 * salida, porque hay dos formas legitimas de que una suite se ponga roja y las
 * dos son deteccion: o un test falla, o el modulo ya no carga y todo el fichero
 * se marca como fallido. Lo que NO cuenta como deteccion es una ejecucion que
 * termina en verde, que es exactamente el agujero que este banco busca.
 */
function correrTests(tests) {
  const informe = path.join(CACHE, `informe-${process.pid}.json`);
  fs.mkdirSync(CACHE, { recursive: true });
  fs.rmSync(informe, { force: true });

  const r = spawnSync(vitestBin, ['run', ...tests, '--reporter=json', '--outputFile=' + informe], {
    cwd: RAIZ,
    encoding: 'utf8',
    timeout: MS_POR_MUTACION,
    shell: process.platform === 'win32',
  });

  if (!fs.existsSync(informe)) {
    return {
      cazada: r.status !== 0,
      fallos: null,
      nota: 'sin informe de vitest: la suite no llego a terminar',
      stderr: (r.stderr ?? '').slice(-600),
    };
  }

  let datos;
  try {
    datos = JSON.parse(fs.readFileSync(informe, 'utf8'));
  } catch {
    return { cazada: r.status !== 0, fallos: null, nota: 'informe ilegible', stderr: (r.stderr ?? '').slice(-600) };
  } finally {
    fs.rmSync(informe, { force: true });
  }

  return {
    cazada: r.status !== 0,
    fallos: datos.numFailedTests ?? null,
    nota: null,
    stderr: null,
  };
}

/* ── Carrera ────────────────────────────────────────────────────────────── */

function correr() {
  const huerfanos = restaurarHuerfanos();
  if (huerfanos) console.log(`\nSe restauraron ${huerfanos} ficheros de un intento anterior.\n`);

  const seleccion = solo ? MUTACIONES.filter((m) => m.id === solo) : MUTACIONES;
  if (seleccion.length === 0) {
    console.error(`Ninguna mutacion con id "${solo}".`);
    return 1;
  }

  if (!fs.existsSync(vitestBin)) {
    console.error(`No encuentro vitest en ${vitestBin}. Instala las dependencias antes.`);
    return 1;
  }

  const informe = [];
  const sucios = [];

  for (const m of seleccion) {
    const aplicado = aplicar(m);
    let resultado;

    try {
      if (aplicado.estado === 'ROTA') {
        resultado = { cazada: false, nota: aplicado.motivo, fallos: null };
      } else {
        resultado = correrTests(m.tests);
      }
    } finally {
      if (aplicado.estado === 'puesta' && !restaurar(m)) sucios.push(m.fichero);
    }

    const marca = resultado.cazada ? 'CAZADA' : 'ESCAPO';
    const detalle = resultado.nota ?? `${resultado.fallos} test(s) en rojo`;
    console.log(`  [${marca}] ${m.id.padEnd(32)} ${detalle}`);

    informe.push({
      id: m.id, fichero: m.fichero, porque: m.porque, tests: m.tests,
      cazada: resultado.cazada, testsEnRojo: resultado.fallos,
      nota: resultado.nota, stderr: resultado.stderr,
    });
  }

  const escapadas = informe.filter((i) => !i.cazada);

  console.log('\n' + '='.repeat(66));
  console.log(`  Mutaciones: ${informe.length}   cazadas: ${informe.length - escapadas.length}   `
            + `escapadas: ${escapadas.length}`);
  console.log('='.repeat(66));

  if (escapadas.length > 0) {
    console.log('\nLO QUE ESCAPO:\n');
    for (const e of escapadas) {
      console.log(`  ${e.id}  (${e.fichero})`);
      console.log(`    ${e.porque}`);
      if (e.nota) console.log(`    motivo: ${e.nota}`);
      console.log(`    tests declarados: ${e.tests.join(', ')}`);
      if (e.stderr) console.log(`    ultimo error:\n${e.stderr.split('\n').map((l) => '      ' + l).join('\n')}`);
      console.log();
    }
  }

  if (sucios.length > 0) {
    console.error(`\nATENCION: estos ficheros no se pudieron restaurar: ${sucios.join(', ')}`);
  }

  if (destinoJson) {
    const destino = path.resolve(RAIZ, destinoJson);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, JSON.stringify(informe, null, 2), 'utf8');
    console.log(`informe escrito en ${destinoJson}`);
  }

  return escapadas.length > 0 || sucios.length > 0 ? 1 : 0;
}

if (listar) {
  for (const m of MUTACIONES) {
    console.log(`${m.id.padEnd(34)} ${m.fichero}`);
    console.log(`${' '.repeat(34)} caza: ${m.tests.join(', ')}`);
  }
  process.exit(0);
}

/**
 * `--dry-run` comprueba lo que se puede comprobar SIN lanzar la suite: que el
 * patron de cada mutacion siga estando una vez y sola. Es el modo que sirve
 * para editar el banco sin pagar la suite entera, y tambien el que detecta un
 * banco obsoleto antes de que lo descubra la CI.
 */
if (ensayo) {
  let rotas = 0;
  for (const m of MUTACIONES) {
    const texto = fs.readFileSync(path.join(RAIZ, m.fichero), 'utf8');
    const n = apariciones(texto, m.de);
    const existen = m.tests.every((t) => fs.existsSync(path.join(RAIZ, t)));
    if (n !== 1 || !existen) rotas++;
    console.log(`  ${n === 1 ? 'ok   ' : 'ROTA '} ${m.id.padEnd(32)} `
              + `patron x${n}${existen ? '' : '  (falta un fichero de test)'}`);
  }
  console.log(`\n${MUTACIONES.length - rotas} de ${MUTACIONES.length} utilizables (sin ejecutar la suite).`);
  process.exit(rotas > 0 ? 1 : 0);
}

process.exit(correr());

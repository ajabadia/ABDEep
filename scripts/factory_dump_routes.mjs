// ============================================================================
//  factory_dump_routes.mjs — las rutas de la matriz de los 1024 patches de
//  fabrica, extraidas de los dumps del DeepMind 12.
//
//  POR QUE ESTA SEPARADO DE LA SONDA. `build/fase2-verificar.mjs` leia los
//  dumps para responder "el motor les da una ruta real a las 4697 rutas
//  activas?". Eso es una pregunta de cobertura: mira el codigo. Este
//  fichero responde a la otra pregunta, la de sonido: no mira si el destino
//  esta declarado, sino si mueve el audio. Es el parser, sin la cuenta.
//
//  LO QUE DICE EL FORMATO. El patch son 242 bytes utiles dentro de un SysEx
//  de 291, en 7 bits por byte con el bit alto aparte complicando cada grupo de 7
//  (`docs/sysex_format.md` 4.12). La matriz son los bytes 93-116: ocho slots
//  de tres, y cada uno es (fuente, destino, profundidad), con la profundidad
//  bipolar: 128 es el centro.
//
//  LO QUE HACE ESTE PROGRAMA
//    1. lee los ocho bancos de `resources/hardware_dumps/2026-08-10`
//    2. cuenta las rutas activas, con GUARDA: tienen que ser 4697, ni una mas
//       ni una menos, o sale con codigo de error y no escribe nada
//    3. escribe la lista de rutas en un TSV para el banco de C++ que las
//       renderiza
//
//  USO
//    node scripts/factory_dump_routes.mjs <salida.tsv>
//    node scripts/factory_dump_routes.mjs --check    # NO escribe; sale 1 si la guarda falla
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DUMPS = path.join(ROOT, 'resources', 'hardware_dumps', '2026-08-10');

/* Las ocho entradas del byte, en orden. El contador de la sonda. */
export const RUTAS_ESPERADAS = 4697;
const PATCHES_POR_BANCO = 128;
const BYTES_PATCH = 291;
const MATRIZ_1ER_SLOT = 93;
const SLOTS = 8;

/**
 * El 7-a-8 de JUCE, el mismo que hace el plugin al recibir el SysEx.
 *
 * Cada byte trae su MSB aparte: el primer byte de cada grupo de 8 dice en que
 * de los siete siguientes va el bit 7. 278 bytes empaquetados son 242 sueltos,
 * que es justo el patch.
 */
function unpack7to8 (packed) {
  const out = new Uint8Array(242);
  let write = 0;
  for (let i = 0; i < packed.length && write < 242; i += 8) {
    const msb = packed[i] & 0x7f;
    for (let j = 0; j < 7 && write < 242; j++) {
      if (i + 1 + j >= packed.length) break;
      out[write++] = (packed[i + 1 + j] & 0x7f) | (((msb >> j) & 1) << 7);
    }
  }
  return out;
}

/** La profundidad bipolar del byte: 0 -> -1, 128 -> 0, 255 -> +1. */
export function bipolar (bruto) {
  return Math.max(-1, Math.min(1, (bruto - 128) / 127));
}

/**
 * Las rutas activas de los 1024 patches.
 *
 * Activa es fuente distinta de cero Y destino distinto de cero: un slot con la
 * fuente en 0 es un slot apagado, que es lo que significan los 4697 frente a
 * los 8192 posibles (1024 patches por 8 slots).
 */
export function rutasDeLosDumps (dir = DUMPS) {
  const bancos = fs.readdirSync(dir).filter((n) => /^Synth Bank .\.syx$/.test(n)).sort();
  if (bancos.length === 0) throw new Error(`no hay bancos en ${dir}`);

  const rutas = [];
  const porDestino = new Map();
  let patches = 0;

  for (const nombre of bancos) {
    const buf = fs.readFileSync(path.join(dir, nombre));
    let enEsteBanco = 0;

    for (let off = 0; off + BYTES_PATCH <= buf.length; off += BYTES_PATCH) {
      if (buf[off] !== 0xf0) continue;
      const patch = unpack7to8 (buf.subarray (off + 10, off + 10 + 278));
      if (patch.length < 96) continue;
      ++patches;
      const indice = bancos.indexOf (nombre) * PATCHES_POR_BANCO + enEsteBanco;
      ++enEsteBanco;

      for (let s = 0; s < SLOTS; ++s) {
        const b = MATRIZ_1ER_SLOT + s * 3;
        if (b + 2 >= patch.length) break;
        const fuente = patch[b];
        const destino = patch[b + 1];
        const profundidad = patch[b + 2];
        if (fuente === 0 || destino === 0) continue;

        rutas.push ({ patch: indice, slot: s, fuente, destino, profundidad });
        porDestino.set (destino, (porDestino.get (destino) ?? 0) + 1);
      }
    }
  }

  return { rutas, porDestino, patches, bancos: bancos.length };
}

/** El TSV que lee el banco de C++. Una linea por ruta, cabecera con los nombres. */
export function aTsv (rutas) {
  const lineas = ['patch\tslot\tfuente\tdestino\tprofundidad\tcantidad'];
  for (const r of rutas) {
    lineas.push ([r.patch, r.slot, r.fuente, r.destino, r.profundidad,
      bipolar (r.profundidad).toFixed (4)].join ('\t'));
  }
  return lineas.join ('\n') + '\n';
}

/* ── Como programa ────────────────────────────────────────────────────────── */

const esPrograma = process.argv[1]
  && path.resolve (process.argv[1]) === fileURLToPath (import.meta.url);

if (esPrograma) {
const salida = process.argv[2] ?? path.join (ROOT, 'build', 'rutas_fabrica.tsv');
const CHECK_ONLY = process.argv.includes('--check');
const { rutas, porDestino, patches, bancos } = rutasDeLosDumps ();

  console.log (`bancos: ${bancos} | patches: ${patches} | rutas activas: ${rutas.length}`
    + ` | destinos distintos: ${porDestino.size}`);

  // LA GUARDA. Las 4697 no son una expectativa: son el numero que se
  // midio sobre estos ocho ficheros, y si el recuento se mueve es que el
  // parser ha cambiado de significado o los dumps no son los de siempre. En
  // ese caso NO se escribe nada: un banco que renderiza 4697 rutas que ya
  // no son las del hardware valdria mas que no medir.
  if (rutas.length !== RUTAS_ESPERADAS) {
    console.error (`GUARDA: se esperaban ${RUTAS_ESPERADAS} rutas activas y han salido ${rutas.length}.`
      + ' No se escribe nada.');
    process.exit (1);
  }
  if (patches !== bancos * PATCHES_POR_BANCO) {
    console.error (`GUARDA: ${bancos} bancos deberian dar ${bancos * PATCHES_POR_BANCO} patches`
      + ` y han salido ${patches}.`);
    process.exit (1);
  }

  if (CHECK_ONLY) process.exit (0);

  fs.mkdirSync (path.dirname (salida), { recursive: true });
  fs.writeFileSync (salida, aTsv (rutas));
  console.log (`OK: ${RUTAS_ESPERADAS} rutas, la guarda cuadra. Escritas en ${salida}`);
}
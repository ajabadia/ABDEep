/**
 * baselineGuard.test.js — guard de baseline (plan v3.2 Fase 0 / baseline_fase0_v32.md §2).
 *
 * Verifica que los counts documentados en `docs/baseline_fase0_v32.md` §2 (nº de test
 * files y de tests) no se desvían de la suite REAL. La enumeración de la suite vive en
 * un único sitio compartido (`./support/vitestSuite.js`), que además declara qué puede
 * hacer el vitest INSTALADO:
 *
 *   - FICHEROS: siempre exactos y sin ejecutar nada (glob propio de vitest) → el nº de
 *     test files se reconcilia en cualquier versión.
 *   - TESTS: solo enumerables sin ejecutar la suite desde vitest 3 (`vitest list`). Con
 *     vitest < 3 el recuento real exigiría ejecutar la suite entera — el flake de
 *     contención que este guard eliminó — así que se avisa de que ese count no es
 *     verificable con ese toolchain.
 *
 * El recuento excluye este archivo (no se enumera a sí mismo) y luego se le suma
 * `SELF_TEST_COUNT`; los números de §2 son los de la suite COMPLETA (guard incluido),
 * que es lo que corre `npm test`.
 *
 * NOTA: este guard verifica COUNTS (nº de test files y tests), no que los tests pasen —
 * si un test se marca `.skip` el total se mantiene (los skipped cuentan) y el guard no lo
 * detecta; eso lo hace la propia suite al fallar.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { enumerateSuite } from './support/vitestSuite.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const DOC = path.join(ROOT, 'docs', 'baseline_fase0_v32.md');
const SELF_FILE = path.basename(fileURLToPath(import.meta.url));

/**
 * Nº de tests que declara ESTE archivo. Es una CONSTANTE verificada (no un parseo del
 * propio fuente, que sería frágil): hoy 1 `it()` (el de reconcile). Si se añade un test
 * nuevo aquí, este número debe subir en la misma proporción.
 */
const SELF_TEST_COUNT = 1;
expect(SELF_TEST_COUNT).toBeGreaterThan(0);

/** Lee {files, tests} documentados en §2 de la baseline (formato `| Test files | **N** |`). */
function readDocBaseline() {
  const text = fs.readFileSync(DOC, 'utf8');
  const section = text.match(/## 2\. Baseline WebUI[\s\S]*?(?=\n## 3\.)/);
  if (!section) {
    throw new Error('sección "## 2. Baseline WebUI" no encontrada en baseline_fase0_v32.md');
  }
  const files = section[0].match(/\| Test files \| \*\*(\d+)\*\*/);
  const tests = section[0].match(/\| Tests \| \*\*(\d+)\*\*/);
  if (!files || !tests) {
    throw new Error('formato de counts de §2 no parseable — esperaba | Test files | **N** | y | Tests | **N** |');
  }
  return { files: Number(files[1]), tests: Number(tests[1]) };
}

describe('Baseline guard (baseline_fase0_v32.md §2 vs suite real)', () => {
  it('los counts documentados coinciden con la suite real (colección + guard)', () => {
    const doc = readDocBaseline();
    const suite = enumerateSuite({ exclude: SELF_FILE, withSkipped: true });

    // Nº de ficheros: exacto SIEMPRE (glob propio de vitest). +1 por este guard.
    const projectedFiles = suite.files.length + 1;

    if (suite.tests === null) {
      // vitest < 3: sin `list` no se pueden contar los tests sin ejecutar la suite (el
      // flake de contención ya eliminado). Se reconcilia lo exacto y barato —el nº de
      // ficheros— y se avisa de la parte no verificable.
      console.warn('[baselineGuard] ' + suite.reason + ' — se reconcilia solo el nº de ' +
        'ficheros; manten el total de tests de §2 a mano hasta que el toolchain exponga ' +
        '`vitest list`.');
      expect({ files: doc.files },
        'Baseline §2 documenta ' + doc.files + ' files, pero la suite real proyecta ' +
        projectedFiles + ' (' + suite.files.length + ' sin este guard, +1). ' +
        'Actualiza docs/baseline_fase0_v32.md §2 (y §7 si referencia counts).')
        .toEqual({ files: projectedFiles });
      return;
    }

    // `suite.tests` ya suma los `describe.skipIf` en pending (el total de §2 los incluye).
    const projectedTests = suite.tests + SELF_TEST_COUNT;
    expect({ files: doc.files, tests: doc.tests },
      'Baseline §2 documenta ' + doc.files + ' files / ' + doc.tests + ' tests, pero la suite ' +
      'real proyecta ' + projectedFiles + ' files / ' + projectedTests + ' tests (' +
      suite.files.length + ' files / ' + suite.tests + ' tests sin este guard, +' +
      SELF_TEST_COUNT + ' de aquí). Actualiza docs/baseline_fase0_v32.md §2 (y §7 si ' +
      'referencia counts).')
      .toEqual({ files: projectedFiles, tests: projectedTests });
  }, 240000);
});

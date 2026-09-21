#!/usr/bin/env node
/**
 * Sync de piezas compartidas del paquete @abdsynths/shared a los ficheros
 * locales de ABDEep.
 *
 * ABDEep no tiene bundler (index.html con scripts clasicos), pero el WebView2
 * de JUCE 8 sirve modulos ESM (patron ya probado en CZ101): el glue
 * js/fit-stage.js es <script type="module"> e importa la copia gestionada.
 * El consumo es COPIA GESTIONADA:
 *
 *   - origen:  ABDSharedAssets/components/fitStage.js  (fuente de verdad)
 *   - destino: WebUI/src/shared/fitStage.js            (copia VERBATIM)
 *
 * El test WebUI/tests/fitStage.test.js compara byte a byte copia y origen y
 * falla si alguien edita la copia a mano. Para regenerar:
 *
 *   node scripts/sync_shared.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const suiteRoot = resolve(here, '..', '..');   // ABDSynths/
const source = join(suiteRoot, 'ABDSharedAssets', 'components', 'fitStage.js');
const target = resolve(here, '..', 'WebUI', 'src', 'shared', 'fitStage.js');

const contents = readFileSync(source, 'utf8');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, contents, 'utf8');

console.log(`fitStage sincronizado -> ${target} (${contents.length} bytes)`);

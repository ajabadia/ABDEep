#!/usr/bin/env node
/**
 * build_webui.js — empaqueta el WebUI de ABDEep para el runtime nativo.
 *
 *   node scripts/build_webui.js
 *
 * Salida: WebUI/dist/ (index.html con las dos entradas ESM ya empaquetadas +
 * el arbol estatico replicado). El bundle es lo que sirve/embebe el host:
 * los fuentes crudos no pueden resolver los bare imports @abdsynths/*, y los
 * .gen.js NO se regeneran aqui (eso es cosa de scripts/registry_generator.js).
 *
 * El resource provider nativo prefiere WebUI/dist cuando existe, y el CMake
 * embebe SOLO dist en ese caso (los basenames de JUCE colisionarian con los
 * fuentes crudos).
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const webUiDir = path.join(rootDir, 'WebUI');
const distDir = path.join(webUiDir, 'dist');

console.log('[ABDEep] Empaquetando WebUI con Vite (WebUI/dist)...');

// Vite se invoca por su entrada JS, no por el shim de `npx`: en Windows los
// .cmd/.ps1 de node_modules/.bin no son ejecutables sin shell, y pasar un array
// de args con `shell: true` dispara DEP0190. Asi el comando es identico en las
// tres plataformas y no depende de PATH.
const viteArgs = ['build', '--config', 'vite.build.config.js'];
const viteEntry = [
  path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js'),
  path.join(rootDir, '..', 'node_modules', 'vite', 'bin', 'vite.js'),
].find((candidate) => fs.existsSync(candidate));

const viteResult = viteEntry
  ? spawnSync(process.execPath, [viteEntry, ...viteArgs], { cwd: webUiDir, stdio: 'inherit' })
  : spawnSync(`npx vite ${viteArgs.join(' ')}`, { cwd: webUiDir, stdio: 'inherit', shell: true });

if (viteResult.status !== 0) {
  console.error('[ERROR] vite build fallo — el binario embebido/servido quedaria sin bundle.');
  process.exit(1);
}

// ── Post-chequeos: baratos y detectan el fallo tipico (bundle sin resolver) ──

const problems = [];

const distIndex = path.join(distDir, 'index.html');
if (!fs.existsSync(distIndex)) {
  problems.push(`falta ${path.relative(rootDir, distIndex)}`);
}

/** Recorre dist/ (sin node_modules) devolviendo los .js. */
function distJsFiles(dir = distDir, out = []) {
  if (!fs.existsSync(dir)) {return out;}
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') {continue;}
      distJsFiles(abs, out);
    } else if (entry.name.endsWith('.js')) {
      out.push(abs);
    }
  }
  return out;
}

// 1. Ningun bare import sin resolver en el bundle (el sintoma exacto que esto arregla).
const jsFiles = distJsFiles();
const bareImport = /(?:from|import)\s*['"]@abdsynths\//;
const unresolved = jsFiles.filter((abs) => bareImport.test(fs.readFileSync(abs, 'utf8')));
if (unresolved.length > 0) {
  problems.push(`bare imports @abdsynths/* sin resolver en: ${unresolved.map((f) => path.relative(distDir, f)).join(', ')}`);
}

// 2. El keybed compartido esta en el bundle (no solo referenciado).
const bundleText = jsFiles.map((abs) => fs.readFileSync(abs, 'utf8')).join('\n');
if (!bundleText.includes('kbd-keys-wrapper')) {
  problems.push('el bundle no contiene el keybed compartido (kbd-keys-wrapper) — ¿se dejo de importar @abdsynths/midi-keyb?');
}

// 3. Lo que el runtime pide por ruta y Vite no puede rastrear.
for (const rel of ['js/dsp-processor.js', 'wasm/abdeep_dsp.js']) {
  if (!fs.existsSync(path.join(distDir, rel))) {problems.push(`falta dist/${rel} (lo carga el runtime por ruta)`);}
}

// El .wasm suelto NO es obligatorio: con -s SINGLE_FILE=1 (wasm/CMakeLists.txt)
// va dentro del propio .js, y el .js es lo unico que importa el AudioWorklet
// (js/dsp-processor.js hace `import '../wasm/abdeep_dsp.js'`, nunca pide el .wasm).
// Mismo criterio que scripts/check_wasm_build.js: se aceptan las dos formas y solo
// se falla si el motor no arrancaria en runtime.
//
// COMPROBADO en los dos entornos: la firma de lo embebido depende de la version
// de emscripten y no es la misma — 3.1.64 (la de wasm-build.yml) escribe
// `data:application/octet-stream;base64,`, mientras que 6.0.4 inlinea los bytes
// crudos del modulo y deja el .js binario. Las dos formas contienen el magico
// \0asm de WebAssembly, y esa es la firma que se comprueba ademas de la base64.
const wasmGlue = path.join(distDir, 'wasm', 'abdeep_dsp.js');
const wasmSuelto = path.join(distDir, 'wasm', 'abdeep_dsp.wasm');
const glue = fs.existsSync(wasmGlue) ? fs.readFileSync(wasmGlue) : Buffer.alloc(0);
const wasmEmbebido =
  glue.includes('data:application/octet-stream;base64,') ||
  glue.includes(Buffer.from([0x00, 0x61, 0x73, 0x6d]));
if (!fs.existsSync(wasmSuelto) && !wasmEmbebido) {
  problems.push(
    'falta dist/wasm/abdeep_dsp.wasm (lo carga el runtime por ruta) y no esta embebido en dist/wasm/abdeep_dsp.js (SINGLE_FILE=1): ¿se olvido de compilar el WASM antes de empaquetar?',
  );
}

if (problems.length > 0) {
  console.error('[ERROR] bundle incompleto:');
  for (const p of problems) {console.error(`  - ${p}`);}
  process.exit(1);
}

const distIndexHtml = fs.readFileSync(distIndex, 'utf8');
const moduleTags = [...distIndexHtml.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
console.log(`[ABDEep] WebUI/dist listo: ${jsFiles.length} .js, entradas empaquetadas = ${moduleTags.filter((s) => s.includes('assets/')).join(', ')}`);

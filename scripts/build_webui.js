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
for (const rel of ['js/dsp-processor.js', 'wasm/abdeep_dsp.js', 'wasm/abdeep_dsp.wasm']) {
  if (!fs.existsSync(path.join(distDir, rel))) {problems.push(`falta dist/${rel} (lo carga el runtime por ruta)`);}
}

if (problems.length > 0) {
  console.error('[ERROR] bundle incompleto:');
  for (const p of problems) {console.error(`  - ${p}`);}
  process.exit(1);
}

const distIndexHtml = fs.readFileSync(distIndex, 'utf8');
const moduleTags = [...distIndexHtml.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
console.log(`[ABDEep] WebUI/dist listo: ${jsFiles.length} .js, entradas empaquetadas = ${moduleTags.filter((s) => s.includes('assets/')).join(', ')}`);

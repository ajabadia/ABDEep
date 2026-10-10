/**
 * Build de produccion del WebUI nativo de ABDEep (paridad con ABDMS2000).
 *
 * ABDEep es una pagina de SCRIPTS CLASICOS (150+ <script src>) con DOS entradas
 * ESM:
 *   - js/keyboard.js   → keybed compartido @abdsynths/midi-keyb (+ su CSS)
 *   - js/fit-stage.js  → mountFitStage de @abdsynths/shared
 * Esas dos son las que traen bare imports: sin bundler el WebView2 no las puede
 * resolver (no hay node_modules en el runtime) y el keybed no aparece. Vite las
 * empaqueta — junto con el CSS que importan — y deja los <script> clasicos
 * intactos; por eso el plugin de copia replica el arbol estatico en dist/ con
 * las mismas rutas relativas que el arbol de desarrollo.
 *
 * Salida: WebUI/dist/ (nombres ESTABLES, sin hash: el resource provider nativo
 * resuelve por ruta, no hay mapping de hashes embebido).
 *
 *   node scripts/build_webui.js        # bundle de produccion
 *   npx vite --config WebUI/vite.config.js   # servidor de desarrollo
 */

import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Raiz del WebUI (el index.html del host vive aqui). */
export const webUiRoot = __dirname;

/**
 * Entradas ESM: las empaqueta Vite, asi que NO se copian crudas (su bare import
 * seguiria sin resolver en el bundle).
 */
const MODULE_ENTRIES = ['js/keyboard.js', 'js/fit-stage.js'];

/** Arbol estatico que el runtime pide por ruta (addModule, url(), <script src>). */
const STATIC_DIRS = ['js', 'css', 'assets', 'wasm', 'data', 'resources', 'schemas'];
const STATIC_FILES = ['style.css'];

/** Carpetas de desarrollo que no viajan al bundle. */
const STATIC_EXCLUDE = ['node_modules', 'tests', 'tmp', 'scripts', 'src', 'WebUI', 'dist'];

/**
 * Quita el prefijo de longitud extendida de Windows (`\\?\D:\...`).
 *
 * MEDIDO con Node 20.19.5 y Node 24.21.0 sobre el mismo arbol: el `filter` de
 * fs.cpSync recibe las rutas ya prefijadas en Node 20 y sin prefijar en Node 24.
 * Si solo uno de los dos lados lo lleva, path.relative no encuentra camino comun
 * y devuelve la ruta ENTERA en vez de una relativa, con lo que MODULE_ENTRIES y
 * STATIC_EXCLUDE dejan de coincidir y js/keyboard.js y js/fit-stage.js acaban
 * copiados CRUDOS en dist/ con sus bare imports @abdsynths/* sin resolver.
 *
 * Ese es exactamente el fallo que daba este build en CI (runner con Node 20) y no
 * en local (Node 24): por eso solo se veia al empaquetar en la CI.
 */
export const sinPrefijoExtendido = (ruta) => String(ruta).replace(/^[\\/]{2}[.?][\\/]/, '');

/**
 * Copia el arbol estatico (scripts clasicos, CSS, assets, wasm, datos) a dist/.
 * Vite solo empaqueta lo que esta en el grafo del HTML; el resto del WebUI
 * (js/dsp-processor.js se carga con audioWorklet.addModule, wasm/abdeep_dsp.js
 * con import dinamico del worklet, imagenes de CSS/JS...) se sirve tal cual.
 */
export function abdeepStaticCopy() {
  return {
    name: 'abdeep-static-copy',
    apply: 'build',
    closeBundle() {
      const distDir = path.join(webUiRoot, 'dist');
      let files = 0;

      const copyInto = (rel) => {
        const src = path.join(webUiRoot, rel);
        if (!fs.existsSync(src)) {return;}
        const dest = path.join(distDir, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.cpSync(src, dest, {
          recursive: true,
          filter: (candidate) => {
            const relCand = path.relative(sinPrefijoExtendido(src), sinPrefijoExtendido(candidate))
              .split(path.sep).join('/');
            if (!relCand) {return true;}
            const top = relCand.split('/')[0];
            if (STATIC_EXCLUDE.includes(top)) {return false;}
            if (MODULE_ENTRIES.includes(`${rel}/${relCand}`)) {return false;}
            return true;
          },
        });
        files += 1;
        console.log(`  [abdeep-static-copy] ${rel} -> dist/${rel}`);
      };

      for (const dir of STATIC_DIRS) {copyInto(dir);}
      for (const file of STATIC_FILES) {copyInto(file);}
      console.log(`[abdeep-static-copy] arbol estatico replicado en dist/ (${files} entradas)`);
    },
  };
}

export default defineConfig({
  root: webUiRoot,
  base: './',
  plugins: [abdeepStaticCopy()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Sin inlining base64: el provider nativo sirve cada fichero por ruta.
    assetsInlineLimit: 0,
    // El WebView2 de JUCE 8 es Chromium moderno, pero el bundle corre tambien en
    // el navegador de desarrollo: target por defecto (modules) es suficiente.
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});

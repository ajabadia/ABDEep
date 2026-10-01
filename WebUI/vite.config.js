/**
 * Servidor de desarrollo del WebUI (vite dev server).
 *
 * Es el flujo de desarrollo en NAVEGADOR: Vite sirve el arbol crudo y resuelve
 * los bare imports (@abdsynths/midi-keyb, @abdsynths/shared) al vuelo, con HMR.
 * Del build solo reutilizamos la raiz del WebUI; el plugin de copia es
 * exclusivo del build (apply: 'build'), asi que aqui no se registra.
 *
 *   npm run dev      → http://localhost:5311
 *
 * En NATIVO hay dos modos:
 *
 *   - Debug + `npm run dev` en marcha: el editor del plugin carga ESTA URL en el
 *     WebView2 (ver Source/Plugin/PluginEditor_DevServer.cpp) y trabaja con HMR
 *     sobre el arbol crudo, sin empaquetar nada.
 *   - Sin dev server (o Release, que no compila ese camino): el resource provider
 *     sirve WebUI/dist si esta empaquetado y, si no, el arbol crudo. Tras tocar
 *     el arbol hay que regenerar el bundle con `npm run bundle`.
 */

import { defineConfig } from 'vite';

import { webUiRoot } from './vite.build.config.js';

export default defineConfig({
  root: webUiRoot,
  base: './',
  // Sin plugins: la copia estatica del arbol es solo para el bundle (apply: 'build').
  server: {
    port: 5311,
    // Puerto FIJO: en Debug el editor nativo carga exactamente esta URL
    // (ABDEEP_WEBUI_DEV_SERVER_URL). Si el 5311 esta ocupado es mejor fallar de
    // golpe que arrancar en el 5312 y que el editor sirva el bundle sin que se
    // entienda por que no hay recarga.
    strictPort: true,
    open: false,
  },
});

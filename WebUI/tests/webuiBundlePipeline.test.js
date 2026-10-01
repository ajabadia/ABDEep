/**
 * Pipeline de build del WebUI (Vite) de ABDEep.
 *
 * El WebUI nativo es una pagina de scripts CLASICOS con dos entradas ESM que
 * traen bare imports (@abdsynths/midi-keyb para el keybed, @abdsynths/shared
 * para fitStage). El WebView2 no tiene node_modules, asi que sin bundle esas
 * dos no resuelven y el keybed no monta: este test fija el contrato de las
 * CUATRO piezas que lo hacen funcionar, para que no se rompa en silencio.
 *
 *   1. El runner (scripts/build_webui.js) y la config de Vite existen y estan
 *      colgados de package.json (npm run bundle / npm run dev).
 *   2. La config de build empaqueta las dos entradas ESM y replica el arbol
 *      estatico (js/dsp-processor.js, wasm... los carga el runtime por ruta).
 *   3. El runner verifica el bundle: 0 bare imports @abdsynths/* sin resolver,
 *      el keybed dentro y los ficheros que Vite no puede rastrear.
 *   4. El host prefiere dist: provider -> dist antes que disco crudo, CMake
 *      embebe dist si existe, dist ignorado por git y build.bat lo genera antes
 *      de configurar CMake.
 *   5. Los paquetes compartidos se declaran `workspace:*`: empaquetar no arregla
 *      un enlace roto (una copia vendored en node_modules serviria fuentes
 *      congeladas y el bundle dejaria de seguir al monorepo).
 *   6. En Debug el editor puede cargar el dev server de Vite (recarga en vivo sin
 *      empaquetar), pero un Release NO compila ese camino: el binario que se
 *      reparte jamas depende de un localhost.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const webui = (rel) => path.join(ROOT, 'WebUI', rel);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const pkg = JSON.parse(read('package.json'));
const runner = read('scripts/build_webui.js');
const buildConfig = read('WebUI/vite.build.config.js');
const devConfig = read('WebUI/vite.config.js');
const provider = read('Source/Plugin/PluginEditor_ResourceProvider.cpp');
const cmake = read('CMakeLists.txt');
const bat = read('build.bat');

describe('pipeline de build del WebUI', () => {
    it('esta declarado en package.json y los ficheros existen', () => {
        expect(pkg.scripts.bundle).toContain('scripts/build_webui.js');
        expect(pkg.scripts.dev).toContain('WebUI/vite.config.js');
        expect(fs.existsSync(path.join(ROOT, 'scripts', 'build_webui.js'))).toBe(true);
        expect(fs.existsSync(webui('vite.build.config.js'))).toBe(true);
        expect(fs.existsSync(webui('vite.config.js'))).toBe(true);
    });

    it('la config de build empaqueta las entradas ESM y replica el arbol estatico', () => {
        // Las dos entradas con bare imports: empaquetadas, NUNCA copiadas crudas.
        expect(buildConfig).toContain("const MODULE_ENTRIES = ['js/keyboard.js', 'js/fit-stage.js'];");
        expect(buildConfig).toContain("const STATIC_EXCLUDE = ['node_modules', 'tests', 'tmp', 'scripts', 'src', 'WebUI', 'dist'];");
        expect(buildConfig).toContain('if (MODULE_ENTRIES.includes(');
        // Salida estable: el provider nativo resuelve por ruta, no por hash.
        expect(buildConfig).toContain("outDir: 'dist',");
        expect(buildConfig).toContain('emptyOutDir: true');
        expect(buildConfig).toContain('assetsInlineLimit: 0');
        expect(buildConfig).toContain("entryFileNames: 'assets/[name].js'");
        // Lo que el runtime pide por ruta (audioWorklet.addModule, wasm).
        expect(buildConfig).toContain("'js', 'css', 'assets', 'wasm', 'data', 'resources', 'schemas'");
        // El dev server reutiliza la raiz y no arrastra el plugin de copia.
        expect(devConfig).toContain('port: 5311');
    });

    it('el runner invoca vite y verifica el bundle resultante', () => {
        // Vite por su entrada JS (no por el shim de npx): sin shell ni PATH de por medio.
        expect(runner).toContain("const viteArgs = ['build', '--config', 'vite.build.config.js'];");
        expect(runner).toContain("'bin', 'vite.js'");
        // Chequeo 1: ningun bare import @abdsynths/* sobrevive al bundle.
        expect(runner).toContain('@abdsynths');
        // Chequeo 2: el keybed compartido esta DENTRO (no solo referenciado).
        expect(runner).toContain('kbd-keys-wrapper');
        // Chequeo 3: lo que Vite no puede rastrear y el runtime pide por ruta.
        expect(runner).toContain('js/dsp-processor.js');
        expect(runner).toContain('wasm/abdeep_dsp.wasm');
        expect(runner).toContain('process.exit(1)');
    });

    it('los paquetes compartidos se consumen del workspace, no vendored', () => {
        // Un `file:` a un node_modules ajeno deja el enlace apuntando a algo que no
        // existe (el import no resuelve) o a una COPIA congelada del paquete.
        expect(pkg.dependencies['@abdsynths/midi-keyb']).toBe('workspace:*');
        expect(pkg.dependencies['@abdsynths/shared']).toBe('workspace:*');

        // Si ya esta instalado, el enlace tiene que ser un symlink (no una copia).
        const link = path.join(ROOT, 'node_modules', '@abdsynths', 'midi-keyb');
        if (fs.existsSync(link)) {
            expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
        }
    });

    it('el provider nativo sirve WebUI/dist antes que el arbol crudo', () => {
        expect(provider).toContain('getChildFile ("dist")');
        expect(provider).toContain('distDir.isDirectory()');
        const distBranch = provider.indexOf('distDir.isDirectory()');
        const rawBranch = provider.indexOf('// 1. Try loading from disk');
        expect(distBranch).toBeGreaterThan(-1);
        expect(rawBranch).toBeGreaterThan(distBranch);
    });

    it('CMake embebe dist cuando existe y avisa (no falla) cuando no', () => {
        expect(cmake).toContain('WebUI/dist/index.html');
        expect(cmake).toContain('file(GLOB_RECURSE WEBUI_FILES "WebUI/dist/*")');
        // Sin bundle se cae al arbol crudo con WARNING: el configure de CI no rompe.
        expect(cmake).toContain('message(WARNING');
        expect(cmake).not.toContain('WebUI/dist/index.html no existe: se embebe el arbol crudo. Los bare imports " FATAL_ERROR');
    });

    it('dist es un artefacto: ignorado por git y generado por build.bat antes de CMake', () => {
        expect(read('.gitignore')).toContain('WebUI/dist/');
        const bundleCall = bat.indexOf('call node scripts');
        const configure = bat.indexOf('Configuring CMake');
        expect(bundleCall).toBeGreaterThan(-1);
        expect(configure).toBeGreaterThan(bundleCall);
        // Sin node el build sigue (aviso), pero el bundle se intenta siempre.
        expect(bat).toContain('where node');
    });
});

describe('dev server en Debug (recarga en vivo sin rebundlear)', () => {
    const devServer = read('Source/Plugin/PluginEditor_DevServer.cpp');
    const editor = read('Source/Plugin/PluginEditor.cpp');

    it('la URL la fija CMake y la define SOLO existe en Debug', () => {
        expect(cmake).toContain('set(ABDEEP_WEBUI_DEV_SERVER_URL "http://localhost:5311/" CACHE STRING');
        // Generator expression: la define se compila solo en Debug; en Release el
        // editor ni siquiera tiene el camino del dev server.
        expect(cmake).toContain('$<$<CONFIG:Debug>:ABDEEP_WEBUI_DEV_URL=');
        // Y solo en los targets con editor web (el Calibration Lab no monta el WebUI).
        expect(cmake).toContain('foreach(WEBUI_DEV_TARGET IN ITEMS ABDEep_Standalone ABDEep_VST3)');
        // Y sin comillas: el valor de un /D pierde las comillas al pasar por
        // MSBuild -> cl, asi que la macro llegaria como pedazos de URL. Se
        // stringifica en C++ (JUCE_STRINGIFY vale para cualquier token).
        // El valor no puede llevar comillas: el /D las pierde al pasar por MSBuild ->
        // cl y la macro llegaria como pedazos de URL. Se stringifica en C++
        // (JUCE_STRINGIFY vale para cualquier secuencia de tokens).
        const defValue = cmake.match(/ABDEEP_WEBUI_DEV_URL=([^\s]*)/)[1];
        expect(defValue).not.toContain('"');
        expect(devServer).toContain('JUCE_STRINGIFY (ABDEEP_WEBUI_DEV_URL)');
        expect(cmake).toContain('PluginEditor_DevServer.cpp');
    });

    it('Release no compila el camino del dev server', () => {
        const guard = devServer.indexOf('#if ! defined (ABDEEP_WEBUI_DEV_URL)');
        expect(guard).toBeGreaterThan(-1);
        // La rama sin define (Release) devuelve cadena vacia de inmediato.
        const releaseBranch = devServer.slice(guard, devServer.indexOf('#else'));
        expect(releaseBranch).toContain('return {};');
        expect(releaseBranch).toContain('Release');
    });

    it('el puerto del dev server es uno solo (CMake y vite.config.js coinciden)', () => {
        const cmakeLine = cmake.split('\n').find((l) => l.includes('set(ABDEEP_WEBUI_DEV_SERVER_URL'));
        const port = devConfig.match(/port: [0-9]+/)[0].replace('port: ', '');
        expect(cmakeLine).toContain(':' + port + '/');
        // Puerto fijo: con strictPort false Vite se muda al 5312 y el editor
        // serviria el bundle sin que nada avise de por que no hay recarga.
        expect(devConfig).toContain('strictPort: true');
    });

    it('el sondeo es barato y exige un 200 antes de navegar', () => {
        expect(devServer).toContain('withHttpRequestCmd ("HEAD")');
        expect(devServer).toContain('withConnectionTimeoutMs (kProbeTimeoutMs)');
        expect(devServer).toContain('kProbeTimeoutMs = 200');
        expect(devServer).toContain('getStatusCode() == 200');
        // Sobrescribible/apagable en runtime sin recompilar.
        expect(devServer).toContain('"ABDEEP_WEBUI_DEV_URL"');
        expect(devServer).toContain('isDevServerDisabled');
    });

    it('el editor usa el dev server cuando esta y cae al resource provider si no', () => {
        expect(editor).toContain('getWebUiDevServerUrl()');
        expect(editor).toContain('juce::WebBrowserComponent::getResourceProviderRoot()');
        // Nunca se navega a localhost a pelo: la URL solo entra por el helper.
        expect(editor).not.toContain('goToURL ("http');
    });
});

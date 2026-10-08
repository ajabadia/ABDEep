/**
 * scopeGlobalClasico.test.js — los <script> clásicos comparten un ámbito global.
 *
 * Por qué este guard existe: dos ficheros cargados con `<script src="...">`
 * (sin type="module") comparten el MISMO ámbito global. Si los dos declaran un
 * `const` o un `let` de primer nivel con el mismo nombre, el segundo no es un
 * shadowing sino un SyntaxError, y el navegador tumba los dos ficheros: la
 * página se queda sin ese código entero, sin error en consola útil y sin que
 * ninguna suite se entere.
 *
 * Ya ocurrió de verdad: `DM12_MODULATION_BUSES` estaba declarado en
 * model_capabilities.js y en browser_io_parse_import.js. Los 131 ficheros de
 * test pasaban, porque vitest ejecuta cada fichero como módulo aislado, donde
 * ese `const` es de módulo y no choca con nada. El bug no se podía ver desde la
 * suite; se veía cargando la página.
 *
 * Lo que este guard hace: lee los scripts reales de index.html, en su orden,
 * los evalúa CONCATENADOS en un mismo ámbito (como el navegador), y falla si
 * el resultado es un SyntaxError. Además avisa de los nombres declarados dos
 * veces, para que el error diga cuál es el choque y no solo que hay uno.
 *
 * Lo que NO cubre, y hay que decirlo: solo comprueba sintaxis y colisión de
 * declaraciones de primer nivel. No ejecuta la página ni comprueba que un
 * global esté definido cuando toca.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raizWebUI = path.resolve(aqui, '..');
const indexHtml = path.join(raizWebUI, 'index.html');

/** Los <script src="..."> sin type="module", en el orden del documento. */
function scriptsClasicos() {
  const html = fs.readFileSync(indexHtml, 'utf8');
  const out = [];
  const re = /<script\b([^>]*)>\s*<\/script>|<script\b([^>]*)\/>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || m[2] || '';
    const src = attrs.match(/\bsrc\s*=\s*"([^"]+)"/);
    if (!src) continue;
    if (/\btype\s*=\s*["']?module/.test(attrs)) continue;   // los módulos tienen su propio ámbito
    if (/\btype\s*=\s*["'](?!text\/javascript|text\/ecmascript|application\/javascript)/.test(attrs)) continue;
    const rel = src[1].replace(/^\.?\//, '');
    const abs = path.join(raizWebUI, rel);
    if (fs.existsSync(abs)) out.push({ rel, abs });
  }
  return out;
}

/**
 * Declaraciones de primer nivel (indentación 0) que COLISIONAN al compartir
 * ámbito global.
 *
 * Solo `let`, `const` y `class`: son redeclarables que no, y repetirlas es un
 * SyntaxError. `var` y `function` se pueden redeclarar cuantas veces quieras —
 * `Logger` está declarado en 29 ficheros y eso es legal y pretendido—, así que
 * contarlos como choque daría un guard inútil que habría que silenciar.
 */
function declaracionesPrimerNivel(abs) {
  const texto = fs.readFileSync(abs, 'utf8');
  const nombres = [];
  const re = /^(?:const|let|class)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(texto)) !== null) nombres.push(m[1]);
  return nombres;
}

describe('ámbito global de los scripts clásicos', () => {
  const scripts = scriptsClasicos();

  it('index.html tiene scripts clásicos que analizar (si no, el guard no vigila nada)', () => {
    expect(scripts.length).toBeGreaterThan(50);
  });

  it('ningún nombre se declara en DOS scripts clásicos a la vez', () => {
    // Esto es lo que produce el SyntaxError. Se comprueba nombre a nombre para
    // que el fallo diga qué choque es, no solo que hay uno.
    const porNombre = new Map();
    for (const s of scripts) {
      for (const nombre of declaracionesPrimerNivel(s.abs)) {
        if (!porNombre.has(nombre)) porNombre.set(nombre, []);
        porNombre.get(nombre).push(s.rel);
      }
    }

    const choques = [];
    for (const [nombre, ficheros] of porNombre) {
      const unicos = [...new Set(ficheros)];
      if (unicos.length > 1) choques.push(`${nombre} en ${unicos.join(' + ')}`);
    }

    expect(choques, `Un <script> clasico declara el mismo nombre que otro; el navegador `
      + `tira SyntaxError y se pierde el codigo de los dos ficheros:\n  ${choques.join('\n  ')}`)
      .toEqual([]);
  });

  it('todos los scripts clásicos juntos NO dan SyntaxError (el ámbito compartido de verdad)', () => {
    // Esto es la prueba que de verdad importa: concatena el código como lo hace
    // el navegador y lo compila en un contexto nuevo. Un choque de nombres sale
    // aquí como SyntaxError, no como un fallo de aserción.
    const fuentes = scripts.map((s) => `// ---- ${s.rel} ----\n${fs.readFileSync(s.abs, 'utf8')}`);

    let error = null;
    try {
      // new vm.Script compila sin ejecutar: exactamente la fase que falla cuando
      // dos scripts declaran el mismo const.
      new vm.Script(fuentes.join('\n;\n'), { filename: 'index.html:scripts-concatenados' });
    } catch (e) {
      error = e;
    }

    expect(error === null ? null : `${error.name}: ${error.message}`, '')
      .toBeNull();
  });
});
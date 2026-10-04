/**
 * escrituraSegura.test.js — el guardia que decide si un `--out` puede pisar algo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE TEST ES CASI TODO LO QUE HACE EL HELPER
 *
 * `escribirInformeSeguro` se llama en el FINAL de cuatro scripts, justo cuando ya
 * se ha hecho todo el trabajo: la batería ha corrido, el fuzz ha corrido, el banco
 * ha restored los ficheros. Si el guardia se rompe, ninguno de esos scripts falla
 * ruidosamente —siguen saliendo con su codigo de siempre— y lo unico que cambia es
 * que un fichero que no era suyo ha pasado a ser suyo. Un fallo asi es invisible
 * en el log y caro en el repositorio, asi que las cuatro ramas se comprueban aqui
 * contra ficheros de verdad, en un directorio temporal.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE NO SE PRUEBA CON UN `--out` DE VERDAD
 *
 * Lanzar `fuzz_roundtrip.js` o `mutation_bank.js` para probar el guardia costaria
 * la suite entera. Lo que se prueba es la DECISION, que es lo unico que este
 * fichero decide, y la decision es pura entrada/salida: mismo destino, mismo
 * contenido previo, mismo `forzar`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { escribirInformeSeguro } from './escrituraSegura.mjs';

let dir = '';
const dest = () => path.join(dir, 'informe.json');

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'escrituraSegura-'));
});

afterEach(() => {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* el tmp del OS */ }
});

describe('escribirInformeSeguro — escribir es la parte facil; negarse es el contrato', () => {
  it('escribe cuando el destino no existe, y crea los directorios que falten', () => {
    const anidado = path.join(dir, 'a', 'b', 'informe.json');
    const r = escribirInformeSeguro(anidado, '{"tool":"x"}', { tool: 'x' });

    expect(r.escrito).toBe(true);
    expect(r.motivo).toBeNull();
    expect(fs.existsSync(anidado)).toBe(true);
    expect(fs.readFileSync(anidado, 'utf8')).toBe('{"tool":"x"}');
  });

  it('sobrescribe su propio informe anterior sin preguntar', () => {
    fs.writeFileSync(dest(), '{"tool":"check_wasm_build","generatedAt":"viejo"}');
    const r = escribirInformeSeguro(dest(), '{"tool":"check_wasm_build","generatedAt":"nuevo"}', {
      tool: 'check_wasm_build',
    });

    expect(r.escrito).toBe(true);
    expect(r.motivo).toBeNull();
    expect(fs.readFileSync(dest(), 'utf8')).toContain('nuevo');
  });

  it('NEGATIVO: se niega a pisar un fichero que no es suyo, y no lo toca', () => {
    const mio = '{"nota":"trabajo a mano, con tildes y todo"}';
    fs.writeFileSync(dest(), mio);

    const r = escribirInformeSeguro(dest(), '{"tool":"otro"}', { tool: 'otro' });

    expect(r.escrito).toBe(false);
    expect(r.motivo).toContain('--force');
    expect(r.motivo).toContain('otro');
    // Lo importante: el fichero sigue siendo lo que era, byte a byte.
    expect(fs.readFileSync(dest(), 'utf8')).toBe(mio);
  });

  it('NEGATIVO: un JSON ilegible tampoco es un informe suyo', () => {
    fs.writeFileSync(dest(), '{esto no es json');
    const r = escribirInformeSeguro(dest(), '{"tool":"fuzz_roundtrip"}', { tool: 'fuzz_roundtrip' });

    expect(r.escrito).toBe(false);
    expect(fs.readFileSync(dest(), 'utf8')).toBe('{esto no es json');
  });

  it('NEGATIVO: el campo `tool` de otro script NO vale como reconocimiento', () => {
    // Dos generadores distintos escribiendo en la misma carpeta: cada uno es
    // dueño de SUS informes y de ninguno mas.
    fs.writeFileSync(dest(), '{"tool":"roundtrip_corpus"}');
    const r = escribirInformeSeguro(dest(), '{"tool":"fuzz_roundtrip"}', { tool: 'fuzz_roundtrip' });

    expect(r.escrito).toBe(false);
    expect(fs.readFileSync(dest(), 'utf8')).toBe('{"tool":"roundtrip_corpus"}');
  });

  it('--force escribe, pero DICE que ha pisado algo que no era suyo', () => {
    fs.writeFileSync(dest(), 'contenido ajeno');
    const r = escribirInformeSeguro(dest(), '{"tool":"x"}', { tool: 'x', forzar: true });

    expect(r.escrito).toBe(true);
    expect(r.motivo).toContain('--force');
    expect(fs.readFileSync(dest(), 'utf8')).toBe('{"tool":"x"}');
  });

  it('el predicado propio gana sobre el campo `tool` (informe del banco de mutaciones)', () => {
    const esArray = (texto) => { try { return Array.isArray(JSON.parse(texto)); } catch { return false; } };

    // El informe del banco es un array pelado, sin `tool`: se reconoce por la forma.
    fs.writeFileSync(dest(), '[{"id":"x"}]');
    const propio = escribirInformeSeguro(dest(), '[{"id":"y"}]', { tool: 'mutation_bank', reconoce: esArray });
    expect(propio.escrito).toBe(true);
    expect(propio.motivo).toBeNull();

    // Un objeto cualquiera no vale por parecerse a un informe.
    fs.writeFileSync(dest(), '{"id":"z"}');
    const ajeno = escribirInformeSeguro(dest(), '[{"id":"w"}]', { tool: 'mutation_bank', reconoce: esArray });
    expect(ajeno.escrito).toBe(false);
    expect(fs.readFileSync(dest(), 'utf8')).toBe('{"id":"z"}');
  });

  it('el motivo de la negacion NOMBRA el fichero, para que se pueda ir a mirar', () => {
    fs.writeFileSync(dest(), 'ajeno');
    const r = escribirInformeSeguro(dest(), 'nuevo', { tool: 'fuzz_roundtrip' });
    expect(r.motivo).toContain(path.resolve(dest()));
  });
});

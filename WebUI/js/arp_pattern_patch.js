/**
 * El patrón de arpegio, guardado EN EL PATCH.
 *
 * EL AGUERO QUE ESTE FICHERO CIERRA
 *
 * El byte 162 del SysEx dice QUAL patrón suena (0 = None, 1..32 = preset de
 * fábrica, 33..64 = «User N»). Y los 32 pasos de un «User N» viven en una lista
 * GLOBAL de presets de arpegio, no dentro del patch. Consecuencia: muevo tres
 * pasos en la rejilla, guardo el patch en el banco, lo cargo en otro sitio, y el
 * arpegiador suena a lo que hubiera en esa lista global — o a nada. El patch
 * recuerda el número del slot y se pierde el contenido del slot.
 *
 * DOS MOTIVOS POR LOS QUE NO SE PUEDE meter en el SysEx
 *
 * Uno es de bytes: el patch son 242 bytes y estan TODOS ocupados (0-222
 * parámetros, 223-238 el nombre, 239-241 la cola), asi que un patron de 32
 * pasos no cabe ni empezando por un bit.
 *
 * Y el otro, el que de verdad manda: el SysEx tiene que seguir siendo IDENTICO
 * byte a byte a lo que produce `createProgramDumpSysex` en C++, y ese codigo
 * esta en ABDSharedCode, fuera de este workspace. Anyadir un byte aqui no es
 * anadir un byte: es romper la paridad de todos los volcados de fabrica y de
 * todas las pruebas de ida y vuelta.
 *
 * LO QUE SE GUARDA Y COMO
 *
 * En `meta.arpPattern`, como una cadena de 32 caracteres de `0` y `1`. Se eligio
 * la cadena y no un array de 32 booleanos, ni 4 bytes empaquetados, por dos
 * razones concretas: `meta` viaja por `JSON.stringify` hasta localStorage y por
 * el export `.abyssbank.json`, y una cadena se ve a ojo en el JSON exportado
 * (`1011001011100011...`) sin Herramienta; y no tiene los errores silenciosos
 * del bit a bit, donde guardar bien 31 de 32 escalones parece un patron
 * cualquiera y no un patron roto.
 *
 * OJO CON LO QUE ESTO NO ES: NO es un pattern manager. La lista global de
 * «User N» sigue igual, con sus presets con nombre y su boton de borrar. Esto
 * solo le da al patch una COPIA de la rejilla tal como estaba al guardarlo, que
 * es lo que hace falta para que al cargar suene lo mismo.
 */

/** Los 32 pasos del patrón, como cadena de 0 y 1. O null si no hay nada guardado. */
function _arpPatternPasosDeMeta (meta) {
  if (!meta || typeof meta.arpPattern !== 'string') { return null; }

  const s = meta.arpPattern;

  // Solo se admiten 0 y 1, y solo los 32 primeros: un patron de otra longitud
  // o con otro alfabeto es de otro formato, y adivinar cual seria inventarse el
  // patron en vez de leerlo. Un `meta` escrito a mano o de otra version se
  // ignora, que es lo mismo que hacer que no haya patron.
  if (s.length !== 32 || !/^[01]{32}$/.test(s)) { return null; }

  const pasos = [];
  for (let i = 0; i < 32; i++) { pasos.push(s[i] === '1'); }
  return pasos;
}

/** Los pasos del patrón como cadena de 32 caracteres de 0 y 1, o null. */
function _arpPatternPasosAMeta (pasos) {
  if (!Array.isArray(pasos) || pasos.length !== 32) { return null; }

  let s = '';
  for (let i = 0; i < 32; i++) { s += pasos[i] ? '1' : '0'; }
  return s;
}

/**
 * Escribe el patrón actual en el patch activo.
 *
 * Escribe en `meta`, no en los bytes: por lo que dice la cabecera. Y NO guarda
 * en disco ni en la biblioteca global de presets de arpegio — esto no es un
 * «Save» de preset, es la memoria del patch. El guardado real lo sigue haciendo
 * el guardado de bancos.
 *
 * Devuelve la cadena escrita, o null si no había patch activo al que escribirle.
 */
function _arpPatternGuardarEnPatch (pasos) {
  const s = _arpPatternPasosAMeta(pasos);
  if (s === null) { return null; }

  const Logger = globalThis.Logger || console;

  try {
    const banco = globalThis.loadedBanks
      && globalThis.loadedBanks[globalThis.currentActiveBank];
    const patch = banco && banco[globalThis.currentActivePatchIndex];

    if (!patch) {
      Logger.log('[ArpPatternPatch] no hay patch activo: el patron no se guarda');
      return null;
    }

    if (!patch.meta || typeof patch.meta !== 'object') {
      patch.meta = (typeof globalThis.createDefaultMeta === 'function')
        ? globalThis.createDefaultMeta()
        : {};
    }

    patch.meta.arpPattern = s;
    return s;
  } catch (e) {
    Logger.warn('[ArpPatternPatch] no se pudo guardar el patron en el patch:', e);
    return null;
  }
}

/**
 * Lee el patrón del patch activo y lo pone en el motor.
 *
 * Devuelve los pasos, o null si el patch no trae patron (que es lo normal: los
 * patches viejos, los de fabrica y los que nunca se ha tocado la rejilla).
 */
function _arpPatternRestaurarDelPatch () {
  const Logger = globalThis.Logger || console;

  let pasos = null;
  try {
    const banco = globalThis.loadedBanks
      && globalThis.loadedBanks[globalThis.currentActiveBank];
    const patch = banco && banco[globalThis.currentActivePatchIndex];
    pasos = _arpPatternPasosDeMeta(patch && patch.meta);
  } catch (e) {
    Logger.warn('[ArpPatternPatch] no se pudo leer el patron del patch:', e);
    return null;
  }

  if (!pasos) { return null; }

  const bridge = globalThis.dualMidiBridge;
  if (bridge && typeof bridge.setArpPattern === 'function') {
    bridge.setArpPattern(pasos);
  }

  // Y la rejilla del editor. Si solo se pusiera el motor, el usuario veria 32
  // barras que no son las que suenan, que es peor que no restaurar nada: el
  // mismo fallo que el del parametro muerto, en la direccion contraria. La
  // rejilla cuelga de un cierre dentro de `initArpModal`, asi que se expone en
  // `window._arpStepEditor` para poder llegar a ella desde aqui.
  //
  // `setSteps` NO dispara el callback del editor (solo pinta), asi que
  // restaurar no vuelve a guardar: la operacion es idempotente.
  const editor = globalThis._arpStepEditor;
  if (editor && typeof editor.setSteps === 'function') {
    editor.setSteps(pasos);
  }

  return pasos;
}

if (typeof window !== 'undefined') {
  window._arpPatternPasosDeMeta = _arpPatternPasosDeMeta;
  window._arpPatternPasosAMeta = _arpPatternPasosAMeta;
  window._arpPatternGuardarEnPatch = _arpPatternGuardarEnPatch;
  window._arpPatternRestaurarDelPatch = _arpPatternRestaurarDelPatch;
}

if (typeof global !== 'undefined') {
  global._arpPatternPasosDeMeta = _arpPatternPasosDeMeta;
  global._arpPatternPasosAMeta = _arpPatternPasosAMeta;
  global._arpPatternGuardarEnPatch = _arpPatternGuardarEnPatch;
  global._arpPatternRestaurarDelPatch = _arpPatternRestaurarDelPatch;
}

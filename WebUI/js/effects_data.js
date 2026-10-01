/**
 * @purpose Nombres de los tipos de efecto, derivados del CONTRATO compartido.
 * @purpose_en Effect type display names, derived from the shared contract.
 *
 * QUE CAMBIO Y POR QUE. Antes este fichero tenia una lista de 57 nombres escrita
 * a mano y DESALINEADA con la fabrica: enumeraba los ids 0..56 seguidos, de modo
 * que a partir del 7 la etiqueta no correspondia al efecto. Concreto: la web
 * llamaba "Ambience" a lo que es Hall, y la 22 (Deep Verb) no figuraba. No era un
 * detalle de texto: el desplegable del rack y el DSP tenian ids distintos para el
 * mismo efecto.
 *
 * La lista no podia quedarse bien a mano, porque hay TRES sitios que tienen que
 * saber el mismo numero (la fabrica C++, el contrato compartido y esta web), y
 * con tres copias a mano siempre gana la que se olvida de actualizar. Ahora hay
 * uno: `ABDSharedAssets/contracts/fx-effects.json`, cuyo `generatedFrom` es
 * justo `Source/DSP/FX/FXSlot_Factory.cpp`.
 *
 * DE DONDE SALE `window.FxEffectsContract`. De `fx_contract.gen.js`, que genera
 * `scripts/generate_fx_contract.mjs` a partir del contrato. No se importa aqui a
 * proposito: los `effects_*.js` son scripts CLASICOS, no ESM, asi que no pueden
 * hacer `import`, y el resource provider sirve el arbol crudo cuando no hay
 * bundle. El .gen es un fichero normal del arbol y por eso funciona igual en
 * los tres modos de servicio.
 *
 * PARA QUE NO VUELVA A PASAR: `WebUI/tests/fxContract.test.js` regenera el
 * contrato y lo compara con el .gen commiteado, asi que cambiar el contrato sin
 * regenerar rompe el build en vez de desincronizar la etiqueta en silencio.
 *
 * TRES COSAS QUE ESTA CAPA EXPONE, y por que las tres:
 *
 *   - `window.FxEffectsContract`  el contrato entero (lo que leen los tests y
 *                                 cualquier vista nueva que quiera familia,
 *                                 engine o numero de parametros).
 *   - `window.FX_TYPE_NAMES`      la lista por id. Se CONSERVA porque seis
 *                                 modulos la leen por indice y no por id, y
 *                                 cambiar eso aqui seria ruido en un cambio que
 *                                 ya toca bastante. Ahora se construye desde el
 *                                 contrato, asi que no puede quedar desfasada.
 *   - `window.fxTypeName(id)`     un lookup por id, para el codigo nuevo: el
 *                                 contrato no tiene huecos, asi que indexar por
 *                                 posicion es lo mismo, pero leer por id deja
 *                                 claro que la clave es el id.
 */

(function () {
  'use strict';

  const contract = typeof window !== 'undefined' ? window.FxEffectsContract : undefined;

  if (! contract) {
    // No se avisa todavia: `fx_contract.gen.js` se carga justo antes que este
    // fichero en `index.html`, y tambien hay tests que evaluan los modulos sueltos
    // sin el bootstrap. Lo que no se hace es dejar `FX_TYPE_NAMES` como un array
    // vacio silencioso, que es justo el fallo que hacia la lista antigua.
    return;
  }

  // Copia propia: la lista es el contrato indexado por id, y no queremos que
  // alguien la empuje sin querer. `Object.freeze` ademas convierte "que alguien
  // lo toque" de un bug silencioso en excepcion en produccion.
  const names = Object.freeze(contract.names.slice());

  window.FX_TYPE_NAMES = names;
  window.fxTypeName = function fxTypeName (id) {
    return Object.prototype.hasOwnProperty.call(contract.byId, id) ? contract.byId[id].name : undefined;
  };
}());

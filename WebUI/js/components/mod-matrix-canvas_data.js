/**
 * Mod Matrix Canvas Data — NOMBRES y COLORES de la vista de grafos.
 * ===============================================================================
 * ANTES este fichero declaraba sus PROPIAS tablas (`MOD_SOURCES_SHORT` con 25
 * entradas y `MOD_DESTS_SHORT` con 237) y se divergieron en silencio de
 * `modmatrix_data.js` (25 y 133): la misma matriz con dos nombres distintos,
 * y la del grafo situaba `Fx1` en el índice 233, donde no existe ningún byte.
 * Ese desacuerdo no lo detectaba nadie.
 *
 * AHORA los NOMBRES se deriven de la tabla del dato (`modmatrix_data.js`, que es
 * la que se corresponde con el byte). Aquí no hay ni un literal de nombre: solo
 * acceso perezoso, para que el orden de carga de `index.html` (este fichero se
 * carga ANTES que `modmatrix_data.js`) no importe — la tabla se lee en el
 * primer pintado, no al cargar.
 *
 * Lo que SÍ se queda aquí, a propósito, son los COLORES: el canvas no puede
 * recibir `var(--accent-blue)` (fillStyle no resuelve variables CSS). Así que
 * esta vista lleva el color en hex y la otra en variable CSS, y son dos
 * representations de la MISMA clasificación. `modMatrixTables.test.js` compara
 * las dos por CATEGORÍA en todos los índices, que es lo que las ata.
 * Depender de la tabla del dato para el color rompería el canvas.
 *
 * Depende de: modmatrix_data.js (leído perezosamente, no al cargar).
 */

(function () {
  /**
   * Nombre corto de una fuente de modulación (índice del byte de la matriz).
   * Delega en MOD_SOURCES, la tabla que corresponde al hardware.
   * @param {number} i
   * @returns {string}
   */
  window.modSrcShort = function (i) {
    const table = window.MOD_SOURCES || [];
    return table[i] !== undefined ? table[i] : '?';
  };

  /**
   * Nombre corto de un destino de modulación (índice del byte de la matriz).
   * Delega en FULL_MOD_DESTINATIONS, la tabla rellenada que cubre el rango
   * completo del byte.
   * @param {number} i
   * @returns {string}
   */
  window.modDestShort = function (i) {
    const table = window.FULL_MOD_DESTINATIONS || [];
    return table[i] !== undefined ? table[i] : '?';
  };

  /**
   * Retorna el color asociado a un índice de fuente de modulación.
   *
   * La clasificación (qué índices van en qué familia) es la de
   * `getSrcCategoryColor` en modmatrix_data.js, replicada aquí en hex porque
   * el canvas no resuelve variables CSS. El guard de tablas comprueba que las
   * dos clasificaciones coincidan, índice a índice.
   *
   * @param {number} i - Índice de fuente (0 = None)
   * @returns {string|null} Color CSS o null si es None
   */
  window.modSrcColor = function (i) {
    if (i === 0) { return null; }
    if (i <= 6) { return '#5b9bd5'; }            // pedales, ruedas,.aftertouch
    if (i === 7 || i === 8 || (i >= 16 && i <= 19)) { return '#4ecdc4'; } // LFO
    if (i <= 11) { return '#6abf69'; }            // envolventes
    if (i <= 14) { return '#d4a843'; }            // nota, velocidad, seq
    return '#e68a8a';                             // voz, ejes CC
  };

  /**
   * Retorna el color asociado a un índice de destino de modulación.
   * Misma clasificación que `getDestCategoryColor`, en hex (ver arriba).
   * @param {number} i - Índice de destino (0 = None)
   * @returns {string|null} Color CSS o null si es None
   */
  window.modDstColor = function (i) {
    if (i === 0) { return null; }
    if (i <= 8) { return '#4ecdc4'; }             // LFO
    if (i <= 19) { return '#5b9bd5'; }            // osciladores y portamento
    if (i <= 23) { return '#e68a8a'; }            // VCF
    if (i <= 62) { return '#6abf69'; }            // envolventes
    if (i >= 63 && i <= 72) { return '#d4a843'; } // VCA y comunes (Noise, HPF, Uni, Drift, Arp, Seq)
    // 73-132: meta-modulacion y bus de fx
    if (i >= 73 && i <= 132) { return '#ff5f5f'; }
    return '#888';
  };
})();

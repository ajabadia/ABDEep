/**
 * @file mutation_bank.data.js
 * @purpose Catalogo de mutaciones deliberadas del WebUI, una por invariante que
 *          este proyecto considera sagrada. Cada mutacion ROMPE algo a proposito
 *          y la CI exige que algun test lo note.
 *
 * QUE ES ESTO. Una suite verde no dice que sirva para nada: dice que los tests
 * que existen dicen que lo que hay pasa. Lo que no dice es si alguno de esos
 * tests NOTARIA un fallo real, y eso es justo lo que se pierde sin avisar --
 * un test que se queda comparando contra si mismo, un `expect` que se borra,
 * un nombre que se renombra y deja de encontrar lo que buscaba. Aqui se rompe
 * el codigo a proposito y se exige que la suite se ponga roja.
 *
 * POR QUE NO SE MUTA EL DSP EN C++. Mutarlo obliga a recompilar por mutacion
 * (el build nativo de este repo son ~40 min), asi que un banco de 10 mutaciones
 * serian horas por PR y un runner que se cae a mitad es un banco que no existe.
 * El WebUI es JavaScript: mutar, ejecutar y restaurar son segundos.
 *
 * EL CONTRATO DE CADA MUTACION:
 *   `de`   el texto que se busca, y tiene que aparecer EXACTAMENTE una vez. Si no,
 *          el banco esta obsoleto y eso tambien es un fallo: una mutacion que ya
 *          no se puede aplicar no esta probando nada.
 *   `a`    el texto roto. Tiene que seguir siendo JavaScript valido: si la
 *          mutacion es un error de sintaxis, todo lo caza por el motivo equivocado.
 *   `tests` los ficheros que TIENEN que cazarla. Escribir a mano es preferible a
 *          lanzar la suite entera: es la declaracion de que ese test cubre esa
 *          invariante, y cuando deje de cubrirla hay que decidir si se arregla el
 *          test o si se cambia el banco.
 *
 * @classification Build Tooling / Test Data
 */

export const MUTACIONES = [
  {
    id: 'escape-html-sin-etiquetas',
    fichero: 'WebUI/js/dom_sanitize.js',
    de: `        .replace(/</g, '&lt;')`,
    a: `        .replace(/</g, '<')`,
    tests: ['WebUI/tests/domSanitize.test.js'],
    porque: 'Un "<" que sale crudo en el LCD es un nodo del DOM, no una letra. '
          + 'Hay como min tres XSS cerrados que dependen de esta linea.',
  },
  {
    id: 'unpack-sin-msb',
    fichero: 'WebUI/js/browser_packer.js',
    de: `                val |= 0x80;`,
    a: `                val &= 0x7F;`,
    tests: ['WebUI/tests/browserPacker.test.js'],
    porque: 'El unpack 7-a-8 depende del byte de banderas MSB. Sin el, todo byte '
          + 'alto baja a 7 bits y el SysEx que sale del plugin no es el que entro.',
  },
  {
    id: 'pack-sin-msb',
    fichero: 'WebUI/js/browser_packer.js',
    de: `            if (val & 0x80) {`,
    a: `            if (false) {`,
    tests: ['WebUI/tests/browserPacker.test.js'],
    porque: 'El pack 8-a-7 tiene que stolen el bit alto a la bandera MSB y '
          + ' enmascarar el valor. Sin la bandera, cada byte con bit alto se '
          + 'convierte en un byte mas pequeno: corrupcion silenciosa.',
  },
  {
    id: 'patch-name-sin-recorte',
    fichero: 'WebUI/js/patch_name.js',
    de: `        return out.trim().slice(0, PATCH_NAME_LENGTH);`,
    a: `        return out.trim();`,
    tests: ['WebUI/tests/patchNameValidator.test.js'],
    porque: 'El nombre ocupa los bytes 223-238: dieciseis, ni uno mas. Sin el '
          + 'recorte el nombre se desborda y pisa el resto del preset.',
  },
  {
    id: 'patch-name-sin-filtro-ascii',
    fichero: 'WebUI/js/patch_name.js',
    de: `            if (code > 0x7E || !isPrintableAsciiCharCode(code)) {continue;}`,
    a: `            if (false) {continue;}`,
    tests: ['WebUI/tests/patchNameValidator.test.js'],
    porque: 'El hardware solo admite ASCII imprimible. Sin el filtro, un emoji '
          + 'entra en el nombre y ocupa varios bytes de los dieciseis.',
  },
  {
    id: 'roundtrip-comparacion-invertida',
    fichero: 'WebUI/js/roundtrip_equality.js',
    de: `    for (let i = 0; i < n; i++) { if (a[i] !== b[i]) { diffs.push(i); } }`,
    a: `    for (let i = 0; i < n; i++) { if (a[i] === b[i]) { diffs.push(i); } }`,
    tests: ['WebUI/tests/roundtripEquality.test.js'],
    porque: 'Comparar los bytes para DECLARAR los offsets distintos, al reves, '
          + 'devuelve la lista de los que son iguales: el informe de diferencias '
          + 'señala justo lo que no se cambio.',
  },
  {
    id: 'tabla-destinos-corta',
    fichero: 'WebUI/js/modmatrix_data.js',
    de: `    for (let i = 0; i <= 132; i++) {`,
    a: `    for (let i = 0; i <= 128; i++) {`,
    tests: ['WebUI/tests/modMatrixTables.test.js'],
    porque: 'La tabla tiene que llegar hasta el ultimo destino que el byte puede '
          + 'pedir. Recortarla deja el 129 y siguientes sin nombre, y el 129 es '
          + 'precisamente el que el hardware USA.',
  },
  {
    id: 'nombre-fx-renombrado',
    fichero: 'WebUI/js/modmatrix_data.js',
    de: `    78: 'Fx 1 Level',`,
    a: `    78: 'Fx 1 Ganancia',`,
    tests: ['WebUI/tests/modMatrixTables.test.js'],
    porque: 'El nombre de un destino de fx es el que ve el usuario y el que el '
          + 'guard compara con el motor. Renombrar solo la tabla separa los dos.',
  },
  {
    id: 'color-fx-cambia-de-familia',
    fichero: 'WebUI/js/modmatrix_data.js',
    de: `    if (idx >= 74 && idx <= 81) {return 'var(--accent-red)';}`,
    a: `    if (idx >= 74 && idx <= 81) {return 'var(--accent-pink)';}`,
    tests: ['WebUI/tests/modMatrixTables.test.js'],
    porque: 'Las dos vistas del color tienen que caer en la MISMA familia. El '
          + 'rojo del bus de fx no lo usa ningun otro bloque; ponerlo en rosa lo '
          + 'confunde con los VCF.',
  },
  {
    id: 'arp-nota-fuera-de-rango',
    fichero: 'WebUI/js/bridge-engines-arp.js',
    de: `            if (outNote >= 0 && outNote <= 127) {`,
    a: `            if (outNote >= -1000 && outNote <= 1000) {`,
    tests: ['WebUI/tests/operatingMode.test.js'],
    porque: 'El arpegiador octava notas held: una nota baja con octava negativa o '
          + 'alta con octava positiva puede salirse de 0-127, y una nota MIDI de '
          + '-12 no es una nota que se pueda mandar. El test va contra '
          + '`operatingMode.test.js` porque es el que carga el modulo de verdad; '
          + '`bridgeEngines.test.js` tiene su propia copia y por eso no lo nota.',
  },
];

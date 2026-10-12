/**
 * safeDirectory.js — La excepcion de git, calculada una vez
 * ============================================================================
 *
 * En Windows, git se niega a trabajar en un repositorio cuyo propietario no es
 * el usuario que lo invoca:
 *
 *   fatal: detected dubious ownership in repository at 'D:/.../ABDEep'
 *
 * Lo normal es arreglarlo escribiendo la ruta en la configuracion global. Eso es
 * estado de la maquina, no del proyecto: el siguiente que clone el repo tiene el
 * mismo problema, y nadie ve el arreglo al leer el codigo.
 *
 * Aqui la excepcion se inyecta en el ENTORNO de la corrida:
 *
 *   GIT_CONFIG_COUNT=1
 *   GIT_CONFIG_KEY_0=safe.directory
 *   GIT_CONFIG_VALUE_0=D:/desarrollos/ABDSynths/ABDEep
 *
 * Git las lee como configuracion de maxima prioridad —por encima de
 * `~/.gitconfig` y por encima de la local del repo—, las aplica a CUALQUIER
 * subproceso que nazca de un test, y se van solas al terminar. No se escribe
 * ningun fichero, asi que no queda rastro ni en el repo ni en la maquina.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE FICHERO EXISTE, Y POR QUE HAY DOS QUE LO LLAMAN
 * ─────────────────────────────────────────────────────────────────────────
 *
 * La excepcion se puede poner en dos sitios, y estan los dos:
 *
 *   1. `vitest.config.js`, en `test.env`, que la aplica al entrar en cada worker.
 *   2. `WebUI/tests/setup.js`, que la escribe en `process.env` desde dentro del
 *      worker.
 *
 * El segundo esta porque el primero se apoya en que vitest propague `test.env`
 * al `process.env` del worker, y esa propagacion es un detalle de vitest que
 * cambia entre versiones. Si un dia deja de hacerlo —o si alguien reorganiza el
 * `setupFiles` y este modulo deja de cargarse antes de tiempo— la suite se
 * pondria en rojo con un `dubious ownership` que no dice de donde viene, que es
 * el peor sitio posible para descubrirlo.
 *
 * Que este UN calculation en vez de dos es lo importante. La ruta se normaliza a
 * mano (barras hacia adelante, sin barra final) porque git no casa los valores
 * con `\` en Windows, y si las dos copias se normalizasen distinto el sintoma
 * seria un `dubious ownership` que solo aparece en la maquina donde se
 * separaron, sin pista de cual de las dos va mal. Con un solo modulo, separarse
 * no es posible.
 *
 * NO es una copia gestionada como `gitSeguro.js`: este solo vive aqui. La
 * excepcion de git es cosa del repo, y este repo es el que tiene el problema.
 */

/** Prefijo de la clave. Se escribe una vez y se usa en los dos lados. */
const CLAVE = 'safe.directory';

/**
 * Git acepta la ruta de varias formas, pero en Windows lo que entiende sin
 * sorpresas son las barras HACIA ADELANTE y sin barra final. Con `\` el valor no
 * casa, git vuelve a quejarse de dubious ownership, y lo que se ve es que la
 * opcion «no se esta aplicando» cuando en realidad si: lo que esta mal es la
 * ruta. Esta es la misma normalizacion que aplica `gitSeguro.js`, y por eso
 * ambos tienen que coincidir — cosa que `inyeccionSafeDirectory.test.js` vigila.
 *
 * @param {string} ruta una ruta cualquiera, con las barras que traiga.
 * @returns {string} la ruta como git la entiende en Windows.
 */
export function rutaParaGit(ruta) {
  return ruta.replace(/\\/g, '/').replace(/\/+$/, '');
}

/**
 * La excepcion, en forma de variables de entorno.
 *
 * Si el entorno ya trae `GIT_CONFIG_COUNT` —alguien que inyecte algo por su
 * cuenta, o un envoltorio de CI— esta se APPENDA en vez de pisarlo. Pisar el
 * indice 0 dejaria a la entrada ajena apuntando a la clave de esta, que es una
 * forma silenciosa de romper lo que otro habia puesto ahi.
 *
 * @param {string} raiz la raiz del repo, ya calculada por quien llama.
 * @param {NodeJS.ProcessEnv} [entorno] de donde se lee el `GIT_CONFIG_COUNT` previo.
 * @returns {Record<string, string>} variables de entorno, tal cual las espera git.
 */
export function safeDirectoryEnv(raiz, entorno = process.env) {
  const yaPresentes = Number.parseInt(entorno.GIT_CONFIG_COUNT ?? '0', 10);
  const base = Number.isNaN(yaPresentes) ? 0 : yaPresentes;

  return {
    GIT_CONFIG_COUNT: String(base + 1),
    [`GIT_CONFIG_KEY_${base}`]: CLAVE,
    [`GIT_CONFIG_VALUE_${base}`]: rutaParaGit(raiz),
  };
}

/**
 * Escribe la excepcion en un entorno, sin pisar lo que ya habia ahi.
 *
 * Idempotente de verdad: si la clave ya esta presente CON ESTE VALOR, no hace
 * nada y devuelve un objeto vacio. No es purismo —la llaman dos caminos, `test.env`
 * y el setup del worker—, y sin esta comprobacion cada pasada anadiria una
 * entrada mas. Dos entradas iguales no rompen git, pero esconden lo que paso:
 * con dos, un diagnostico que las cuenta ve un numero que no explica nada, y la
 * siguiente persona que investigue esta mirando una entrada de mas que no
 * deberia existir.
 *
 * Si la clave esta presente con OTRO valor —otra inyeccion, de otro repo o de
 * otra sesion— no se la pisa: se anade la de aqui. Pisar la ajena seria cambiar
 * lo que otro puso a proposito.
 *
 * @param {string} raiz la raiz del repo.
 * @param {NodeJS.ProcessEnv} [entorno] el entorno a modificar; por defecto, el de verdad.
 * @returns {Record<string, string>} lo que se ha escrito; vacio si ya estaba.
 */
export function aplicaSafeDirectory(raiz, entorno = process.env) {
  const valor = rutaParaGit(raiz);
  const declarados = Number.parseInt(entorno.GIT_CONFIG_COUNT ?? '0', 10);
  const total = Number.isNaN(declarados) ? 0 : declarados;

  for (let i = 0; i < total; i += 1) {
    const yaEsta = entorno[`GIT_CONFIG_KEY_${i}`] === CLAVE && entorno[`GIT_CONFIG_VALUE_${i}`] === valor;
    if (yaEsta) {
      return {};
    }
  }

  const nuevo = safeDirectoryEnv(raiz, entorno);
  for (const [clave, contenido] of Object.entries(nuevo)) {
    entorno[clave] = contenido;
  }
  return nuevo;
}

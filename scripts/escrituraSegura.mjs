// scripts/escrituraSegura.mjs
// UNA FUNCION, PARA CUATRO SCRIPTS QUE ESCRIBEN INFORMES.
//
// EL PROBLEMA. Estos scripts solo escriben si alguien pasa `--out <ruta>`, asi que
// la escritura es opt-in y podria parecer que no hay nada que vigilar. El problema
// no es que escriba: es que la escritura es a ENCIMA, y `--out` es un argumento
// que se copia de la invocacion anterior, se pega de un doc o se queda pegado en
// un workflow desde hace tres meses apuntando a un fichero que ya no es un
// informe. Sin guardia, el primer `--out` mal escrito se lleva por delante un
// artefacto a mano y el unico rastro es que el fichero ahora es JSON.
//
// EL GUARDIA. No se sobrescribe un fichero existente salvo que este MISMO script
// lo hubiera producido: se reconoce por su campo `tool` (o, para el banco de
// mutaciones, por ser el array del informe). Todo lo demas se niega y dice por
// que, con el remedy (`--force`) al lado. Es la diferencia entre «escribir un
// informe» y «machacar algo»: el segundo caso necesita que alguien lo pida dos
// veces.
//
// LO QUE NO HACE. No comprueba si el fichero es de git ni si tiene cambios
// sin commitear: eso lo decide quien invoca, no quien escribe. Y no inventa copia
// de seguridad, porque un `.bak` junto al informe es ruido que nadie borra y que
// el siguiente `--out` pisa igual.

import fs from 'node:fs';
import path from 'node:path';

/** Destino legible para los mensajes. Absoluta siempre: una ruta relativa al cwd
 *  aqui seria `..\..\..\algo`, que no dice nada del sitio al que apunta. */
const comoSePidio = (destino) => destino;

/** El fichero existe y lo escribio este mismo script (por defecto: campo `tool`). */
function reconocer(texto, { tool, reconoce }) {
  if (reconoce) return !!reconoce(texto);
  if (!texto) return false;
  try {
    const datos = JSON.parse(texto);
    return !!datos && datos.tool === tool;
  } catch {
    // Un JSON que no se puede leer no es un informe nuestro: no se toca.
    return false;
  }
}

/**
 * Escribe `texto` en `destino` (absoluta) solo si es seguro.
 *
 * @param {string} destino   ruta ABSOLUTA del fichero a escribir
 * @param {string} texto     contenido completo a escribir
 * @param {object} opciones
 * @param {string} opciones.tool      nombre del tool que va dentro del informe
 * @param {boolean} [opciones.forzar]  sobrescribir aunque no lo produjeramos
 * @param {(texto: string) => boolean} [opciones.reconoce]
 *        predicado propio para recognise; tiene prioridad sobre `tool`
 * @returns {{escrito: boolean, motivo: string|null, destino: string}}
 */
export function escribirInformeSeguro(destino, texto, { tool, forzar = false, reconoce } = {}) {
  const absoluta = path.resolve(destino);

  if (!fs.existsSync(absoluta)) {
    fs.mkdirSync(path.dirname(absoluta), { recursive: true });
    fs.writeFileSync(absoluta, texto);
    return { escrito: true, motivo: null, destino: absoluta };
  }

  let previos = '';
  try {
    previos = fs.readFileSync(absoluta, 'utf8');
  } catch (e) {
    return {
      escrito: false,
      motivo: `no se puede leer ${comoSePidio(absoluta)} (${e.message})`,
      destino: absoluta,
    };
  }

  if (reconocer(previos, { tool, reconoce })) {
    fs.writeFileSync(absoluta, texto);
    return { escrito: true, motivo: null, destino: absoluta };
  }

  if (forzar) {
    // Lo ha pedido dos veces: una el `--out` y otra el `--force`. Se escribe, pero
    // se dice en voz alta que se ha pisado algo que no era nuestro, porque ahi si
    // puede haber trabajo detrás y el que decide tiene que enterarse igual.
    fs.writeFileSync(absoluta, texto);
    return { escrito: true, motivo: 'sobrescrito con --force', destino: absoluta };
  }

  return {
    escrito: false,
    motivo: `${comoSePidio(absoluta)} ya existe y NO lo produjo ${tool}. `
      + 'No se sobrescribe a ciegas un fichero que puede ser trabajo a mano. '
      + 'Si de verdad quieres reescribirlo: --force.',
    destino: absoluta,
  };
}

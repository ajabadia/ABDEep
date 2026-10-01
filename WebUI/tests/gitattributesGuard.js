/**
 * Lectura y evaluacion de `.gitattributes`, en funciones PURAS: reciben el
 * texto y la lista de ficheros, y devuelven estructuras. Nada lee el disco, y
 * por eso un guard puede darle reglas inventadas y comprobar que las detecta.
 *
 * POR QUE HAY QUE LEERLO EN VEZ DE CONFIAR EN `git check-attr`. `git
 * check-attr` es la autoridad y se usa como contrapeso en los tests, pero no
 * sirve para el caso principal: una regla que no cubre NINGUN fichero. Contra
 * esa hay que poder preguntar "que ficheros cubre esta regla", y `check-attr`
 * solo responde fichero a fichero.
 *
 * EL DETALLE QUE HACE FALLO ESTE GUARD. Un patron de `.gitattributes` es un
 * patron tipo `.gitignore`, donde `*` NO cruza el `/`:
 *
 *     resources/banks/*.syx   NO cubre resources/banks/FABRICANTE/A.syx
 *
 * En este repo los bancos estan en `resources/banks/Factory Banks V1.1.2/`, un
 * subdirectorio. La regla `resources/banks/*.syx binary` no cubria NI UNO, y
 * durante un tiempo nadie lo noto porque los bancos sebine porque los bancos
 * sobreviven igual: tienen un 47% de bytes NUL y git los detecta como binarios
 * por contenido, no por la regla. La proteccion era de Reposo, no de aqui.
 */

/** Una regla: el patron tal cual, sus atributos, y el texto original. */
function reglaDe (linea) {
  const texto = linea.trim();

  if (texto === '' || texto.startsWith('#')) {return null;}

  // La forma con comillas: "*.txt" text eol=lf
  const entrecomillado = /^"([^"]+)"\s+(.*)$/.exec(texto);

  if (entrecomillado) {
    return { patron: entrecomillado[1], atributos: entrecomillado[2].split(/\s+/), cruda: texto };
  }

  const partes = texto.split(/\s+/);

  if (partes.length < 2) {return null;}

  return { patron: partes[0], atributos: partes.slice(1), cruda: texto };
}

/** Todas las reglas de un `.gitattributes`, sin comentarios ni Attribute macros. */
function reglasDe (texto) {
  return texto
    .split('\n')
    .map(reglaDe)
    .filter((r) => r !== null)
    // Un patron entre corchetes es una macro de atributo, no una regla de
    // ficheros, y no se aplica a ningun path.
    .filter((r) => !r.patron.startsWith('['));
}

/**
 * Compila un patron de `.gitattributes` a una expresion regular.
 *
 * TRES cosas que un `new RegExp(patron.replace('*', '.*'))` ingenuo haria mal:
 *
 *   - `*` no cruza `/`. Sin esto, `resources/banks/*.syx` casaria con los
 *     ficheros de un subdirectorio, que es justo el fallo que hizo huerfana la
 *     regla de los bancos en este repo.
 *   - `.` hay que escaparlo, para que un nombre con punto no case con cualquier
 *     cosa.
 *   - Un patron SIN `/` NO va anclado a la raiz: `*.gen.js` matchea en CUALQUIER
 *     directorio, no solo en el nivel superior. Este es el caso contrario al de
 *     los bancos, y es facil de pasarse por alto en la direccion contraria.
 */
function patronARegex (patron) {
  // Sin barra, el patron se aplica al NOMBRE del fichero en cualquier
  // directorio. Con barra, es relativo a la raiz de la repo.
  const anclaAlFinal = !patron.includes('/');
  let salida = anclaAlFinal ? '(?:.*/)?' : '';
  let i = 0;

  while (i < patron.length) {
    const c = patron[i];

    if (c === '*') {
      if (patron[i + 1] === '*') {
        // `**` cruza directorios. Se come el `/` que lo separa si lo hay.
        if (patron[i + 2] === '/') {
          salida += '(?:.*/)?';
          i += 3;
          continue;
        }
        salida += '.*';
        i += 2;
        continue;
      }
      salida += '[^/]*';
      i += 1;
      continue;
    }

    if (c === '?') {
      salida += '[^/]';
      i += 1;
      continue;
    }

    if (c === '[') {
      const cierre = patron.indexOf(']', i + 1);
      if (cierre !== -1) {
        let clase = patron.slice(i + 1, cierre);
        if (clase.startsWith('!')) {clase = '^' + clase.slice(1);}
        salida += '[' + clase + ']';
        i = cierre + 1;
        continue;
      }
    }

    salida += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    i += 1;
  }

  return new RegExp('^' + salida + '$');
}

/** Que ficheros de `ficheros` cubre una regla. */
function cubreLa (regla, ficheros) {
  const rx = patronARegex(regla.patron);
  return ficheros.filter((f) => rx.test(f));
}

/**
 * Si la regla obliga a LF en checkout.
 *
 * Hace falta distinguir tres cosas que un `toContain` no distingue: que no hay
 * ninguna regla, que hay una que dice otra cosa, y que hay una regla con glob
 * que si cubre el fichero. Solo la tercera cuenta.
 */
function obligaLf (regla) {
  if (regla === null) {return false;}
  return regla.atributos.some((a) => a === 'text' || a.startsWith('text=')) &&
    regla.atributos.includes('eol=lf');
}

/** El conjunto de reglas que de verdad fijan `ruta`. */
function reglasQueFijan (ruta, texto) {
  return reglasDe(texto).filter((r) => obligaLf(r) && patronARegex(r.patron).test(ruta));
}

/** Los CRLF de un texto. Cero es lo unico aceptable en algo que se compara. */
function cuentaCrlf (texto) {
  return (texto.match(/\r\n/g) || []).length;
}

/** Los ficheros de texto que se COMPARAN como datos, no se ejecutan. */
function pareceComparadoComoDato (fichero) {
  return /\.(gen\.js|gen\.h|gen\.cpp|data\.json)$/.test(fichero) ||
    /\.gen\.[a-z]+$/.test(fichero);
}

export {
  reglaDe, reglasDe, patronARegex, cubreLa, obligaLf,
  reglasQueFijan, cuentaCrlf, pareceComparadoComoDato
};

/**
 * css-sin-procesar.js — el sitio donde aterriza el CSS del keybed cuando se
 * empaqueta.
 *
 * `js/keyboard.js` hace `import '@abdsynths/midi-keyb/keyboard.css'`, y en el
 * bundle eso metia a Vite en su tuberia de CSS, que carga `postcss`. Es un
 * modulo VACIO a proposito: el CSS no se procesa aqui, se sirve como fichero.
 *
 * Que este vacio es el objetivo, no un descuido. El CSS del keybed es una hoja
 * con dos `@import` de specifier desnudo y nada mas (ver `CSS_ESTATICO` en
 * vite.build.config.js): resolverlos es inlinear dos ficheros, y se hace a mano
 * para no arrastrar un procesador entero —y el cierre de dependencias que
 * viene con el— a un build que solo necesita pegar dos ficheros.
 *
 * El dev server NO pasa por aqui: usa `vite.config.js`, donde el CSS entra por
 * la via normal. Este stub es solo del build de produccion.
 */
export default {};
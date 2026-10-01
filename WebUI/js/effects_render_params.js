/**
 * @purpose Punto de entrada de los mandos del rack de efectos: repinta o sincroniza.
 * @classification UI Component Submodule
 *
 * QUE ES. El nombre viejo de esta funcion era `renderActiveEffectParams` y
 * pintaba la pantalla de un solo hueco. Se queda con el mismo nombre porque hay
 * ocho sitios que la llaman y todos esperan lo mismo: "el rack de efectos esta al
 * dia". Lo que hace ahora esta en `fx_slot_knobs.js`.
 *
 * POR QUE REPINTA SOLO CUANDO HAY QUE REPINTA. Los ocho que la llaman lo hacen
 * en cada cambio de parametro, y un repintado borra el DOM mientras el usuario
 * tiene el raton encima de un mando: el arrastre se cortaria a mitad. Asi que
 * aqui se distingue entre "ha cambiado el efecto de algún hueco" (hay que
 * repintar, porque cambia quantos mandos se apagan) y "solo han cambiado los
 * valores" (basta con mover los punteros).
 */

(function () {
    'use strict';

    const HUECOS = [1, 2, 3, 4];

    /** Los cuatro ids de efecto, en un solo texto, para ver si han cambiado. */
    function firmaDeTipos() {
        return HUECOS.map((hueco) => {
            const select = document.querySelector('.fx-type-select[data-slot="' + hueco + '"]');

            return select ? select.value : '?';
        }).join('|');
    }

    function hayRejillas() {
        for (const hueco of HUECOS) {
            if (!document.getElementById('fx' + hueco + '-knobs')) {return false;}
        }

        return true;
    }

    function renderActiveEffectParams() {
        if (typeof window.renderFxSlotKnobs !== 'function') {return;}

        const firma = firmaDeTipos();

        // Sin rejillas todavia (el modal acaba de abrirse) o con un efecto nuevo
        // en algun hueco: hay que pintarlas enteras.
        if (!hayRejillas() || firma !== window._fxSlotKnobSignature) {
            window._fxSlotKnobSignature = firma;
            window.renderFxSlotKnobs();
            return;
        }

        // Mismos efectos, otros valores: solo los punteros. Repintar aqui seria
        // cortar el arrastre que el usuario tiene en curso.
        if (typeof window.syncFxSlotKnobPositions === 'function')
            {window.syncFxSlotKnobPositions();}
    }

    window.renderActiveEffectParams = renderActiveEffectParams;
})();

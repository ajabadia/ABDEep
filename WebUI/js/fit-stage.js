/**
 * fit-stage — el ajuste al viewport de ABDEep (glue del paquete compartido).
 * ================================================================
 *
 * ABDEep es de chasis FIJO (#synth-app, 1200x768 — el tamano del diseno) y la
 * ventana del editor es redimensionable: sin ajuste, una ventana mas baja que
 * el diseno RECORTA el chasis por abajo. El fitStage compartido
 * (@abdsynths/shared) escala el chasis con `transform` para que caiga entero
 * y centra el eje sobrante.
 *
 * Este fichero es un modulo ESM que monta el fit en el chasis.
 * Sin mas: el componente es infraestructura de pagina, no control.
 */
import { mountFitStage } from '@abdsynths/shared/components';

// El chasis es el diseno (base.css: width 1200px / height 768px).
const DESIGN = { width: 1200, height: 768 };

function mount() {
  mountFitStage(document.getElementById('synth-app'), {
    width: DESIGN.width,
    height: DESIGN.height,
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  // Los modulos ESM son deferred: el DOM ya esta cuando esto corre.
  mount();
}

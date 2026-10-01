/**
 * fitStage en ABDEep: dos contratos.
 *
 * 1. GLUE FINO — WebUI/js/fit-stage.js YA NO es una copia del componente: importa
 *    `mountFitStage` del paquete del workspace (`@abdsynths/shared/components`,
 *    el mismo que usa ABDMS2000) y solo declara el chasis (1200x768) y su montaje.
 *    El guard es de origen, no de bytes: si alguien reimplementa el calculo en el
 *    glue en vez de consumir el paquete, la suite lo detecta. El componente en si
 *    se prueba en ABDSharedAssets (tests/fitStage*.test.js).
 *
 * 2. INTEGRACION — el mount escala y centra el chasis de diseno (1200x768) y
 *    el detach deja de recibir resizes. Sin DOM: la suite corre en entorno
 *    `node` y mountFitStage solo escribe en `stage.style`, asi que un stage
 *    falso { style: {} } es observador suficiente. El viewport falso tiene un
 *    fire() que despacha SOLO a los listeners aun registrados (simular un
 *    resize llamando a la fn capturada repintaria: el detach es que el
 *    registro quede vacio, y eso es lo que se verifica).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// El MISMO specifier que usa el glue: lo que se prueba aqui es lo que carga la app.
import { computeFit, mountFitStage } from '@abdsynths/shared/components';

const here = dirname(fileURLToPath(import.meta.url));
const GLUE = join(here, '..', 'js', 'fit-stage.js');

describe('fitStage / glue compartido', () =>
{
    it('consume el paquete del workspace en vez de reimplementar el componente', () =>
    {
        const glue = readFileSync(GLUE, 'utf8');

        expect(glue).toMatch(/import\s*\{\s*mountFitStage\s*\}\s*from\s*'@abdsynths\/shared\/components'/);
        // El calculo del fit vive SOLO en el paquete: ni copia local ni matematicas.
        expect(glue).not.toMatch(/\bcomputeFit\b/);
        expect(glue).not.toMatch(/Math\.(?:min|max)\s*\(/);
        expect(glue).not.toMatch(/scale\s*\(/);
    });

    it('monta el chasis de diseno (#synth-app, 1200x768)', () =>
    {
        const glue = readFileSync(GLUE, 'utf8');

        expect(glue).toMatch(/getElementById\(\s*'synth-app'\s*\)/);
        expect(glue).toMatch(/width:\s*1200\b/);
        expect(glue).toMatch(/height:\s*768\b/);
    });
});

describe('fitStage / integracion ABDEep', () =>
{
    const DESIGN = { width: 1200, height: 768 };

    function fakeViewport ()
    {
        const listeners = new Map();

        return {
            innerWidth: DESIGN.width,
            innerHeight: DESIGN.height,
            listeners,
            addEventListener (type, fn) { listeners.set(type, fn); },
            removeEventListener (type, fn) { if (listeners.get(type) === fn) { listeners.delete(type); } },
            fire (type)
            {
                const fn = listeners.get(type);

                if (fn) { fn(); }
            },
        };
    }

    function fakeStage ()
    {
        return { style: {} };
    }

    it('identidad a tamano de diseno: sin transform, sin margenes', () =>
    {
        const stage = fakeStage();
        const detach = mountFitStage(stage, { ...DESIGN, viewport: fakeViewport() });

        expect(stage.style.transform).toBe('');
        expect(stage.style.marginLeft).toBe('0px');
        expect(stage.style.marginTop).toBe('0px');
        detach();
    });

    it('encoge y centra cuando la ventana es mas pequena que el chasis', () =>
    {
        const stage = fakeStage();
        const vp = fakeViewport();

        vp.innerWidth = 600;
        vp.innerHeight = 768;

        mountFitStage(stage, { ...DESIGN, viewport: vp });

        expect(stage.style.transform).toBe('scale(0.5)');
        // El ancho manda (0.5): el chasis escalado mide 600x384 -> el alto
        // sobrante se centra ((768 - 384) / 2 = 192).
        expect(stage.style.marginLeft).toBe('0px');
        expect(parseFloat(stage.style.marginTop)).toBeCloseTo(192, 6);
    });

    it('recentra en resize con eje sobrante y detiene al hacer detach', () =>
    {
        const stage = fakeStage();
        const vp = fakeViewport();

        vp.innerWidth = 860;
        vp.innerHeight = 768;

        const detach = mountFitStage(stage, { ...DESIGN, viewport: vp });

        expect(stage.style.transform).not.toBe('');
        // 860x768: escala 0.7166 (el ancho manda), chasis escalado 860x550.4
        // -> sobra alto: centrado vertical ((768 - 550.4) / 2 = 108.8).
        expect(stage.style.marginLeft).toBe('0px');
        expect(parseFloat(stage.style.marginTop)).toBeCloseTo(108.8, 6);

        // Ventana crece en vertical: 860x860 -> eje X sigue apurado, sobra Y.
        vp.innerWidth = 860;
        vp.innerHeight = 860;
        vp.fire('resize');

        expect(parseFloat(stage.style.marginTop)).toBeCloseTo(154.8, 6); // (860 - 550.4)/2
        detach();

        vp.innerWidth = 400;
        vp.innerHeight = 400;
        vp.fire('resize');

        // Tras el detach el repintado se detiene: ultimo estado congelado.
        expect(stage.style.transform).not.toBe('scale(0.25)');
    });

    it('nunca supera maxScale por defecto (0.25x..3x, rango del zoom nativo)', () =>
    {
        const fit = computeFit({ viewportWidth: 6000, viewportHeight: 4000, designWidth: 1200, designHeight: 768 });

        expect(fit.scale).toBe(3);
        expect(fit.offsetX).toBe((6000 - 1200 * 3) / 2);
        expect(fit.offsetY).toBe((4000 - 768 * 3) / 2);
    });
});

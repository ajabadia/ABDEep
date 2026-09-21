/**
 * fitStage en ABDEep: dos contratos.
 *
 * 1. COPIA GESTIONADA — WebUI/src/shared/fitStage.js es una copia VERBATIM de
 *    ABDSharedAssets/components/fitStage.js (ABDEep no tiene bundler: scripts
 *    clasicos + ESM nativo). Byte a byte contra el paquete del workspace;
 *    editar la copia a mano ROMPE la suite a proposito
 *    (node scripts/sync_shared.mjs).
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
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { computeFit, mountFitStage } from '../src/shared/fitStage.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('fitStage / copia gestionada', () =>
{
    it('es byte a byte la del paquete compartido', () =>
    {
        const suiteRoot = resolve(here, '..', '..', '..');
        const origin = join(suiteRoot, 'ABDSharedAssets', 'components', 'fitStage.js');
        const copy = join(here, '..', 'src', 'shared', 'fitStage.js');

        expect(readFileSync(copy, 'utf8')).toBe(readFileSync(origin, 'utf8'));
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
            removeEventListener (type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
            fire (type)
            {
                const fn = listeners.get(type);

                if (fn) fn();
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

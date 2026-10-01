/**
 * Test de integración de los mandos del rack de efectos.
 *
 * Sustituye al que probaba `effects_templates_renderers.js` y los cuatro
 * `effects_renderers_*.js`, que se quitaron porque sus ids estaban numerados
 * contra una tabla de efectos que ya no es la de `FXSlot_Factory.cpp`: allí un
 * amplificador de guitarra (id 7) se pintaba como una plate reverb.
 *
 * Lo que se comprueba aquí es lo que ahora es verdad:
 *   - los doce mandos de cada hueco, enlazados por `data-param`
 *   - quantos están apagados lo dice el CONTRATO, no una lista del test
 *   - un cambio de efecto repinta, un cambio de valor no (para no cortar el
 *     arrastre que el usuario tiene en curso)
 *
 * Run with: npx vitest run WebUI/tests/effectsTemplates.integration.test.js
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// ══════════════════════════════════════════════════════════════════
// Carga de los módulos, sin DOM real
// ══════════════════════════════════════════════════════════════════

function cargarModulos () {
  const jsDir = path.resolve(__dirname, '../js');

  for (const file of ['fx_contract.gen.js', 'effects_templates.js', 'fx_slot_knobs.js', 'effects_render_params.js']) {
    const code = fs.readFileSync(path.join(jsDir, file), 'utf-8');
    // eslint-disable-next-line no-eval
    eval(code);
  }
}

// ══════════════════════════════════════════════════════════════════
// DOM de mentira, pero que devuelve el HTML REAL que se ha pintado
// ══════════════════════════════════════════════════════════════════

function crearArea () {
  return {
    id: '',
    innerHTML: '',
    /**
     * Los knobs que hay ahora mismo dentro, leidos del HTML pintado.
     *
     * Se parte por el `class="ctrl-unit fx-slot-knob` de cada uno en vez de con
     * una regex sobre el HTML entero: la clase de "apagado" va ANTES del
     * `data-param`.
     *
     * Y el numero de mando es `\d+` y NO `\d`. Con un solo digito, `param10`,
     * `param11` y `param12` NO casaban, y el test contaba 9 de 12 sin decir
     * nada: exactamente los tres mandos que la interfaz vieja no alcanzaba.
     * Un test que se come justo lo que deberia mirar es peor que no test.
     */
    knobs () {
      const salida = [];
      const trozos = this.innerHTML.split('<div class="ctrl-unit fx-slot-knob');

      for (let i = 1; i < trozos.length; i++) {
        const trozo = trozos[i];
        const quien = /data-param="fx(\d+)_param(\d+)"/.exec(trozo);
        const puntero = /class="knob-pointer" style="transform:rotate\((-?[\d.]+)deg\)"/.exec(trozo);

        if (!quien || !puntero) {continue;}

        const mando = Number(quien[2]);

        salida.push({
          hueco: Number(quien[1]),
          mando,
          angulo: Number(puntero[1]),
          // El modulo enlaza por el atributo del padre, no por el indice, asi que
          // el padre falso tiene que contestar `getAttribute`.
          closest (sel) {
            if (sel !== '.fx-slot-knob') {return null;}
            return { getAttribute: (n) => (n === 'data-mando' ? String(mando) : null) };
          },
          addEventListener () {}
        });
      }

      return salida;
    },

    /**
     * La cola NO conectable pintada, leida del HTML.
     *
     * Se parte por la clase de la cola y se leen sus atributos, y no por una
     * cuenta de mandos a media luz: lo que se quiere comprobar es que la cola
     * NO es un mando, y para eso hay que mirar si lleva `data-param` y si tiene
     * anillo, no quantas casillas hay.
     */
    noConectables () {
      const salida = [];
      const trozos = this.innerHTML.split('<div class="fx-slot-knob-nc"');

      for (let i = 1; i < trozos.length; i++) {
        const trozo = trozos[i];
        const rango = /data-no-conectables="(\d+)\.\.(\d+)"/.exec(trozo);
        const hueco = /data-hueco="(\d+)"/.exec(trozo);

        if (!rango || !hueco) {continue;}

        salida.push({
          hueco: Number(hueco[1]),
          desde: Number(rango[1]),
          hasta: Number(rango[2]),
          ariaDisabled: /aria-disabled="true"/.test(trozo),
          conDataParam: /data-param=/.test(trozo),
          conAnillo: /knob-ring/.test(trozo)
        });
      }

      return salida;
    },

    /** De quantas columnas es la rejilla de este hueco, o `null` si no hay. */
    columnas () {
      const m = /class="fx-slot-knob-grid" data-hueco="\d+" data-columnas="(\d+)"/.exec(this.innerHTML);
      return m ? Number(m[1]) : null;
    },
    querySelectorAll (sel) {
      if (sel !== '.knob-ring') {return [];}
      return this.knobs();
    }
  };
}

describe('los mandos de cada hueco, uno por parametro que el tipo conecta', () => {
  let areas = {};
  let selects = {};
  let contrato = {};

  beforeEach(() => {
    global.window = global;
    areas = { 1: crearArea(), 2: crearArea(), 3: crearArea(), 4: crearArea() };

    for (const hueco of [1, 2, 3, 4]) {
      areas[hueco].id = 'fx' + hueco + '-knobs';
    }

    // El desplegable de cada hueco. Se cambian en cada test.
    selects = {
      1: { value: '1' },   // Hall, 12 mandos
      2: { value: '2' },   // Plate, 12
      3: { value: '22' },  // Deep Verb, 5
      4: { value: '0' }    // Bypass, 0
    };

    global.getBridge = () => null;
    global._readFxParamValue = () => 0.5;

    global.document = {
      getElementById (id) {
        const m = /^fx([1-4])-knobs$/.exec(id);
        return m ? areas[Number(m[1])] : null;
      },
      querySelector (sel) {
        const m = /^\.fx-type-select\[data-slot="([1-4])"\]$/.exec(sel);
        return m ? selects[Number(m[1])] : null;
      }
    };

    cargarModulos();

    contrato = global.FxEffectsContract;
  });

  afterEach(() => {
    delete global.document;
    delete global.getBridge;
    delete global._readFxParamValue;
    delete global.FxEffectsContract;
    delete global.renderFxSlotKnobs;
    delete global.renderActiveEffectParams;
    delete global.syncFxSlotKnobPositions;
    delete global.FX_SLOT_KNOB_COUNT;
    delete global.fxSlotParamCount;
    delete global.fxEffectById;
    delete global.fxEffectTable;
    delete global.fxSlotRow;
    delete global.fxNoConnectableCount;
    delete global._fxSlotKnobSignature;
  });

  it('el contrato se publica en `window`, no solo en `module.exports`', () => {
    // El UMD del contrato era un if/else: con `module` presente (cualquier
    // bundler, y tambien vitest) escribia solo `module.exports` y
    // `window.FxEffectsContract` no llegaba a ponerse. Todo el rack de efectos
    // lee `window`, asi que empaquetado se quedaba sin un solo efecto.
    expect(global.FxEffectsContract).toBeDefined();
  });

  it('el contrato dice quantos mandos tiene cada efecto, y es la unica fuente', () => {
    // El numero de efectos NO se escribe aqui a proposito: se le al contrato.
    // Cuando pasaban de 57 a 61, un `toBe(57)` habria sido una verdad
    // duplicated mas que este test tendria que mantener a mano.
    expect(contrato.effects.length).toBe(contrato.count);

    const porId = new Map(contrato.effects.map(e => [e.id, e]));

    // Y estos si se comprueban uno a uno, porque son los que la rejilla usa:
    // son los cuatro casos con los que el modulo demuestra que apaga lo que
    // sobra y enciende lo que toca.
    expect(porId.get(1).params).toBe(12);   // Hall
    expect(porId.get(4).params).toBe(10);   // Ambience
    expect(porId.get(6).params).toBe(9);    // Reverse
    expect(porId.get(22).params).toBe(5);   // Deep Verb
    expect(porId.get(0).params).toBe(0);    // Bypass

    // Ningun efecto pasa de doce: doce es el tope del registro, no un accidente.
    expect(Math.max(...contrato.effects.map(e => e.params))).toBe(12);
  });

  it('la tabla por tipo tiene un conteo VARIABLE y el resto no conectable', () => {
    // La tabla es `id -> fila`, y la fila es la del tipo: quantos conecta,
    // cuales, y cuantos del registro deja sin conectar. Los conteos no se
    // escriben en este test: se leen de la tabla, que es la unica verdad.
    const filas = [...contrato.effects].map(e => global.fxEffectTable(e.id));

    expect(filas.length).toBe(contrato.count);

    for (const fila of filas) {
      expect(fila.total).toBeGreaterThanOrEqual(0);
      expect(fila.total).toBeLessThanOrEqual(12);
      expect(fila.conectables.length).toBe(fila.total);
      expect(fila.noConectables.length).toBe(12 - fila.total);

      // Los conectables son 1..total, sin huecos: es lo que hace que la cola
      // no conectable sea siempre un sufijo y se pueda decir con un rango.
      expect(fila.conectables).toEqual(
        Array.from({ length: fila.total }, (_, i) => i + 1));
    }

    // Y los cuatro casos con los que se demuestra que el conteo cambia de verdad.
    expect(filas.find(f => f.id === 1).total).toBe(12);   // Hall
    expect(filas.find(f => f.id === 4).total).toBe(10);   // Ambience
    expect(filas.find(f => f.id === 6).total).toBe(9);    // Reverse
    expect(filas.find(f => f.id === 22).total).toBe(5);   // Deep Verb
    expect(filas.find(f => f.id === 0).total).toBe(0);    // Bypass

    // El catalogo entero tiene mas de un conteo. Si todos fueran doce, este
    // test pasaria tambien con la rejilla de doce mandos fijos de antes, que
    // es justo lo que se ha quitado.
    const distintos = new Set(filas.map(f => f.total));

    expect(distintos.size).toBeGreaterThan(3);
  });

  it('pinta un mando por parametro que conecta el tipo, y solo esos', () => {
    global.renderFxSlotKnobs();

    // El total NO se escribe aqui a proposito: sale de la tabla. Un `toBe(48)`
    // seria volver a tener la verdad a mano, que es lo que se quito al pasar a
    // la tabla por tipo.
    for (const hueco of [1, 2, 3, 4]) {
      expect(areas[hueco].knobs().length).toBe(global.fxSlotRow(hueco).total);
    }

    // Y los cuatro, uno a uno, porque son los que separan "variable" de "fijo".
    expect(areas[1].knobs().length).toBe(12);   // Hall
    expect(areas[2].knobs().length).toBe(12);   // Plate
    expect(areas[3].knobs().length).toBe(5);    // Deep Verb
    expect(areas[4].knobs().length).toBe(0);    // Bypass
  });

  it('la rejilla NO tiene ancho fijo: las columnas salen del conteo', () => {
    global.renderFxSlotKnobs();

    // 12 mandos salen en cuatro columnas (tres filas) y 5 en tres (dos filas).
    expect(areas[1].columnas()).toBe(4);
    expect(areas[3].columnas()).toBe(3);

    // Y con cero NO hay rejilla: `repeat(0, 1fr)` no es una rejilla vacia, es
    // una rejilla invalida.
    expect(areas[4].columnas()).toBe(null);
    expect(areas[4].innerHTML).not.toContain('fx-slot-knob-grid');
  });

  it('el resto NO es un mando: sin `data-param`, sin anillo, y declarado no conectable', () => {
    global.renderFxSlotKnobs();

    // Hueco 3 = Deep Verb: conecta cinco, quedan siete.
    const cola = areas[3].noConectables();

    expect(cola.length).toBe(1);
    expect(cola[0].desde).toBe(6);
    expect(cola[0].hasta).toBe(12);
    expect(cola[0].ariaDisabled).toBe(true);

    // Y esto es lo que hace que "no conectable" sea un hecho y no una palabra:
    // no hay `data-param` a quien enlazar, no hay anillo que arrastrar, y el
    // texto no disimula un mando mas.
    expect(cola[0].conDataParam).toBe(false);
    expect(cola[0].conAnillo).toBe(false);
    expect(areas[3].innerHTML).not.toContain('data-param="fx3_param6"');
    expect(areas[3].innerHTML).not.toContain('fx-slot-knob-off');

    // Un Bypass no conecta ninguno, asi que la cola es la cola entera.
    const colaBypass = areas[4].noConectables();

    expect(colaBypass[0].desde).toBe(1);
    expect(colaBypass[0].hasta).toBe(12);
  });

  it('lo unico que puede arrastrarse es un mando conectable', () => {
    global.renderFxSlotKnobs();

    // El modulo engancha el arrastre a `.knob-ring`, y la cola no tiene ninguno:
    // por construccion no hay forma de arrastrar un byte que no lleva a nada.
    for (const hueco of [1, 2, 3, 4]) {
      const anillos = areas[hueco].querySelectorAll('.knob-ring');
      const fila = global.fxSlotRow(hueco);

      expect(anillos.length).toBe(fila.total);

      for (const anillo of anillos) {
        expect(fila.conectables.indexOf(anillo.mando) >= 0).toBe(true);
      }
    }
  });

  it('dentro del conteo del contrato no falta ni uno, aunque el efecto tenga menos de doce', () => {
    global.renderFxSlotKnobs();

    // P1..P5 y nada mas. Ni uno de mas, ni uno de menos: el fallo tipico seria
    // cortar a partir de un numero escrito a mano en vez de leer la tabla.
    expect(areas[3].knobs().map(k => k.mando)).toEqual([1, 2, 3, 4, 5]);
  });

  it('el pie dice los dos numeros: los que conectan y los que no', () => {
    global.renderFxSlotKnobs();

    // El conteo util ya no esta en el brillo de los mandos, asi que se dice.
    expect(areas[3].innerHTML).toContain('5 mandos · 7 no conectables');
    expect(areas[1].innerHTML).toContain('12 mandos<');
    expect(areas[1].innerHTML).not.toContain('no conectables<');
    expect(areas[4].innerHTML).toContain('sin mandos · 12 no conectables');
  });

  it('cada mando lleva su parametro escrito, no se deduce de su sitio', () => {
    global.renderFxSlotKnobs();

    const vistos = new Set();

    for (const hueco of [1, 2, 3, 4]) {
      for (const knob of areas[hueco].knobs()) {
        vistos.add('fx' + knob.hueco + '_param' + knob.mando);
      }
    }

    // 12 + 12 + 5 + 0. Los ids de la cola (fx3_param6..12) NO estan, y eso es
    // lo nuevo: no son mandos y no llevan `data-param`.
    expect(vistos.size).toBe(29);

    for (const hueco of [1, 2, 3]) {
      expect(vistos.has('fx' + hueco + '_param1')).toBe(true);
    }

    expect(vistos.has('fx3_param5')).toBe(true);
    expect(vistos.has('fx3_param6')).toBe(false);
    expect(vistos.has('fx4_param1')).toBe(false);
  });

  it('el puntero sale a la posicion del valor, sin el desplazamiento extra de antes', () => {
    global._readFxParamValue = () => 0.5;
    global.renderFxSlotKnobs();

    // 0.5 es el centro: 0.5 * 270 - 135 = 0 grados. Los renderers antigos
    //hacian `translateX(-50%) rotate(...)` encima de un `left` que ya lo
    // centraba, y el puntero salia medio ancho a la izquierda de mas.
    for (const knob of areas[1].knobs()) {
      expect(knob.angulo).toBe(0);
      expect(areas[1].innerHTML).not.toContain('translateX(-50%)');
    }
  });

  it('cambiar de efecto cambia el conteo de la tabla, y con el la rejilla', () => {
    global.renderFxSlotKnobs();

    expect(areas[3].knobs().length).toBe(5);
    expect(areas[3].columnas()).toBe(3);
    expect(global.fxNoConnectableCount(3)).toBe(7);

    selects[3] = { value: '1' };   // ahora una Hall en el hueco 3
    global.renderFxSlotKnobs();

    expect(areas[3].knobs().length).toBe(12);
    expect(areas[3].columnas()).toBe(4);
    expect(areas[3].noConectables().length).toBe(0);
    expect(global.fxNoConnectableCount(3)).toBe(0);
  });

  it('sin contrato no inventa el numero de mandos: no conecta ninguno', () => {
    delete global.FxEffectsContract;
    global.FxEffectsContract = undefined;

    global.renderFxSlotKnobs();

    for (const hueco of [1, 2, 3, 4]) {
      expect(areas[hueco].knobs().length).toBe(0);
      expect(global.fxNoConnectableCount(hueco)).toBe(12);
      expect(areas[hueco].noConectables()[0].hasta).toBe(12);
    }
  });

  it('renderActiveEffectParams repinta cuando cambia el efecto', () => {
    global.renderActiveEffectParams();
    expect(areas[1].knobs().length).toBe(12);

    selects[1] = { value: '22' };   // Deep Verb
    global.renderActiveEffectParams();

    // Con el conteo variable, cambiar de efecto cambia el numero de mandos de
    // verdad, no solo cuantos hay apagados: por eso esto sigue siendo un
    // repintado entero y no un simple movimiento de punteros.
    expect(areas[1].knobs().length).toBe(5);
    expect(areas[1].columnas()).toBe(3);
  });

  it('renderActiveEffectParams SOLO mueve los punteros si el efecto no ha cambiado', () => {
    // Esto es lo que impide que un arrastre se corte a mitad: los ocho sitios
    // que llaman a esta funcion la llaman en cada cambio de parametro.
    global.renderActiveEffectParams();

    let pintadas = 0;
    const original = areas[1].innerHTML;
    global.renderFxSlotKnobs = () => { pintadas++; };

    global.renderActiveEffectParams();

    expect(pintadas).toBe(0);
    expect(areas[1].innerHTML).toBe(original);
  });
});

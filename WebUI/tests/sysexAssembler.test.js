/**
 * sysexAssembler.test.js — Fase 2 §2.2 · SysExAssembler independiente
 *
 * Cobertura:
 *   - waiting → collecting → complete (F0 ... F7)
 *   - Alimentación por fragmentos y por bytes sueltos
 *   - tolerancia a basura previa al F0
 *   - malformed: F7 suelto, desbordamiento de buffer, doble F0 (reinicia)
 *   - timeout sin F7 (timers inyectables)
 *   - reset y reinicio automático tras complete
 *   - onComplete / onMalformed / onTimeout + inspect()
 */

import { describe, it, expect, beforeEach } from 'vitest';
import asmModule from '../js/sysex_assembler.js';

const { SysExAssembler, ASSEMBLER_STATES, SYSEX_START, SYSEX_END } = asmModule;

function makeAssembler(extra = {}) {
  const timers = [];
  const clock = { t: 0, advance: (ms) => { clock.t += ms; } };
  const opts = {
    timeoutMs: 1000,
    now: () => clock.t,
    setTimer: (fn, ms) => { const h = { fn, ms, at: clock.t + ms }; timers.push(h); return h; },
    clearTimer: (h) => { h.cancelled = true; },
    ...extra,
  };
  const asm = new SysExAssembler(opts);
  return { asm, timers, clock };
}

function fireTimers(timers, clock) {
  // Ejecuta timers vencidos (en orden) contra el reloj actual
  const due = timers.filter((h) => !h.cancelled && h.at <= clock.t);
  for (const h of due) { if (!h.cancelled) { h.fn(); } }
}

describe('SysExAssembler — API básica', () => {
  it('expone los estados del contrato', () => {
    expect(ASSEMBLER_STATES).toEqual(['waiting', 'collecting', 'complete', 'malformed', 'timeout']);
    expect(SYSEX_START).toBe(0xF0);
    expect(SYSEX_END).toBe(0xF7);
  });

  it('arranca en waiting', () => {
    const { asm } = makeAssembler();
    expect(asm.getState()).toBe('waiting');
  });
});

describe('SysExAssembler — mensaje completo', () => {
  it('ensambla F0..F7 y dispara onComplete con los bytes', () => {
    let msg = null;
    const { asm } = makeAssembler({ onComplete: (bytes) => { msg = bytes; } });
    asm.feed([0xF0, 0x00, 0x20, 0x32, 0x20, 0x01, 0x02, 0xF7]);
    expect(asm.getState()).toBe('complete');
    expect(msg).toEqual([0xF0, 0x00, 0x20, 0x32, 0x20, 0x01, 0x02, 0xF7]);
    expect(asm.getMessage()).toEqual([0xF0, 0x00, 0x20, 0x32, 0x20, 0x01, 0x02, 0xF7]);
  });

  it('acepta Uint8Array', () => {
    const { asm } = makeAssembler();
    asm.feed(new Uint8Array([0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7]));
    expect(asm.getState()).toBe('complete');
  });

  it('acepta bytes sueltos uno a uno', () => {
    const { asm } = makeAssembler();
    for (const b of [0xF0, 0x00, 0x20, 0xF7]) { asm.feed(b); }
    expect(asm.getState()).toBe('complete');
  });

  it('tolera basura previa al F0', () => {
    const { asm } = makeAssembler();
    asm.feed([0x01, 0x02, 0xF0, 0x40, 0xF7]);
    expect(asm.getState()).toBe('complete');
    expect(asm.getMessage()).toEqual([0xF0, 0x40, 0xF7]);
  });

  it('un nuevo F0 tras complete reinicia automáticamente', () => {
    const { asm } = makeAssembler();
    asm.feed([0xF0, 0x01, 0xF7]);
    expect(asm.getState()).toBe('complete');
    asm.feed(0xF0);
    expect(asm.getState()).toBe('collecting');
  });
});

describe('SysExAssembler — malformed', () => {
  it('F7 suelto sin F0 → malformed', () => {
    let reason = null;
    const { asm } = makeAssembler({ onMalformed: (r) => { reason = r; } });
    asm.feed(0xF7);
    expect(asm.getState()).toBe('malformed');
    expect(reason).toBe('stray_eox');
  });

  it('desbordamiento de buffer → malformed overflow', () => {
    const { asm } = makeAssembler({ maxMessageLength: 8 });
    asm.feed([0xF0, 1, 2, 3, 4, 5, 6, 7, 8, 9]); // F0 + 9 > 8
    expect(asm.getState()).toBe('malformed');
  });

  it('doble F0 reinicia el buffer (no malformed)', () => {
    const { asm } = makeAssembler();
    asm.feed([0xF0, 0x01, 0xF0, 0x02, 0xF7]);
    expect(asm.getState()).toBe('complete');
    expect(asm.getMessage()).toEqual([0xF0, 0x02, 0xF7]);
  });

  it('un solo mensaje por feed: detiene tras complete', () => {
    const { asm } = makeAssembler();
    asm.feed([0xF0, 0x01, 0xF7, 0xF0, 0x02, 0xF7]);
    expect(asm.getState()).toBe('complete');
    expect(asm.getMessage()).toEqual([0xF0, 0x01, 0xF7]);
  });
});

describe('SysExAssembler — timeout', () => {
  it('sin F7 dentro del timeout → timeout', () => {
    let timedOut = false;
    const { asm, timers, clock } = makeAssembler({ onTimeout: () => { timedOut = true; } });
    asm.feed([0xF0, 0x00, 0x20]);
    expect(asm.getState()).toBe('collecting');
    clock.advance(1500);
    fireTimers(timers, clock);
    expect(asm.getState()).toBe('timeout');
    expect(timedOut).toBe(true);
  });

  it('F7 antes del timeout cancela el timer', () => {
    const { asm, timers, clock } = makeAssembler();
    asm.feed([0xF0, 0x00, 0x20, 0xF7]);
    expect(asm.getState()).toBe('complete');
    clock.advance(5000);
    fireTimers(timers, clock);
    expect(asm.getState()).toBe('complete'); // sin timeout
  });

  it('timeoutMs = 0 desactiva el timeout', () => {
    const { asm, clock } = makeAssembler({ timeoutMs: 0 });
    asm.feed([0xF0, 0x01]);
    clock.advance(999999);
    expect(asm.getState()).toBe('collecting');
  });
});

describe('SysExAssembler — reset e inspect', () => {
  it('reset devuelve el parcial y vuelve a waiting', () => {
    const { asm } = makeAssembler();
    asm.feed([0xF0, 0x01, 0x02]);
    const partial = asm.reset();
    expect(partial).toEqual([0xF0, 0x01, 0x02]);
    expect(asm.getState()).toBe('waiting');
  });

  it('inspect expone estado, longitud y mensaje', () => {
    const { asm } = makeAssembler();
    asm.feed([0xF0, 0x40, 0xF7]);
    const snap = asm.inspect();
    expect(snap.state).toBe('complete');
    expect(snap.bufferLength).toBe(3);
    expect(snap.message).toEqual([0xF0, 0x40, 0xF7]);
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
  });

  it('onStateChange emite waiting→collecting→complete', () => {
    const seen = [];
    const { asm } = makeAssembler();
    asm.onStateChange((e) => seen.push(e.to));
    asm.feed([0xF0, 0x40, 0xF7]);
    expect(seen).toEqual(['collecting', 'complete']);
  });
});

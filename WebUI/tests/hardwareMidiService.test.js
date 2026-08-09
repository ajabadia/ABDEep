/**
 * hardwareMidiService.test.js — Fase 2 §2.2 · FSM del puerto MIDI
 *
 * Cobertura:
 *   - Estados iniciales y API semántica (connect/beginSync/syncComplete/...)
 *   - Transiciones válidas: connected→syncing→ready→transmitting→ready
 *   - Transiciones inválidas rechazadas (guardas)
 *   - Fallos → resync_required y recuperación
 *   - Eventos onStateChange + unsubscribe
 *   - Métricas y inspect()
 */

import { describe, it, expect, beforeEach } from 'vitest';
import svcModule from '../js/hardware_midi_service.js';

const { HardwareMidiService, PORT_STATES, TRANSITIONS } = svcModule;

describe('HardwareMidiService — API básica', () => {
  let svc;
  beforeEach(() => { svc = new HardwareMidiService(); });

  it('arranca en disconnected', () => {
    expect(svc.getState()).toBe('disconnected');
    expect(svc.isConnected()).toBe(false);
    expect(svc.isReady()).toBe(false);
  });

  it('recorre el ciclo feliz connected → syncing → ready → transmitting → ready', () => {
    expect(svc.connect()).toBe(true);
    expect(svc.getState()).toBe('connected');
    expect(svc.beginSync()).toBe(true);
    expect(svc.getState()).toBe('syncing');
    expect(svc.syncComplete()).toBe(true);
    expect(svc.getState()).toBe('ready');
    expect(svc.isReady()).toBe(true);
    expect(svc.beginTransmission()).toBe(true);
    expect(svc.isTransmitting()).toBe(true);
    expect(svc.transmissionComplete()).toBe(true);
    expect(svc.getState()).toBe('ready');
  });

  it('los estados del contrato están expuestos', () => {
    expect(PORT_STATES).toEqual(['disconnected', 'connected', 'syncing', 'ready', 'transmitting', 'resync_required']);
    expect(Object.keys(TRANSITIONS).sort()).toEqual([...PORT_STATES].sort());
  });
});

describe('HardwareMidiService — guardas de transición', () => {
  let svc;
  beforeEach(() => { svc = new HardwareMidiService(); });

  it('rechaza transition a un estado no contemplado', () => {
    expect(svc.transition('nope')).toBe(false);
    expect(svc.getState()).toBe('disconnected');
  });

  it('rechaza transiciones inválidas: syncing desde disconnected', () => {
    expect(svc.beginSync()).toBe(false);
    expect(svc.getState()).toBe('disconnected');
  });

  it('rechaza transmitting sin estar ready', () => {
    svc.connect();
    expect(svc.beginTransmission()).toBe(false);
  });

  it('no permite disconnected → ready directo', () => {
    expect(svc.transition('ready')).toBe(false);
  });
});

describe('HardwareMidiService — fallos y resync', () => {
  let svc;
  beforeEach(() => { svc = new HardwareMidiService(); });

  it('syncFailed → resync_required y recuperación por beginSync', () => {
    svc.connect();
    svc.beginSync();
    expect(svc.syncFailed()).toBe(true);
    expect(svc.getState()).toBe('resync_required');
    expect(svc.beginSync()).toBe(true);
    expect(svc.getState()).toBe('syncing');
  });

  it('transmissionFailed → resync_required', () => {
    svc.connect(); svc.beginSync(); svc.syncComplete();
    svc.beginTransmission();
    expect(svc.transmissionFailed()).toBe(true);
    expect(svc.getState()).toBe('resync_required');
  });

  it('requestResync desde ready', () => {
    svc.connect(); svc.beginSync(); svc.syncComplete();
    expect(svc.requestResync()).toBe(true);
    expect(svc.getState()).toBe('resync_required');
  });

  it('disconnect desde cualquier estado', () => {
    svc.connect(); svc.beginSync(); svc.syncComplete(); svc.beginTransmission();
    expect(svc.disconnect()).toBe(true);
    expect(svc.getState()).toBe('disconnected');
  });

  it('forceState establece un estado válido directamente', () => {
    expect(svc.forceState('ready')).toBe(true);
    expect(svc.getState()).toBe('ready');
  });

  it('forceState al mismo estado es no-op true', () => {
    expect(svc.forceState('disconnected')).toBe(true);
    expect(svc.getState()).toBe('disconnected');
  });
});

describe('HardwareMidiService — eventos y métricas', () => {
  let svc;
  beforeEach(() => { svc = new HardwareMidiService(); });

  it('emite onStateChange con {from,to,reason}', () => {
    const seen = [];
    svc.onStateChange((evt) => seen.push(evt));
    svc.connect('port_opened');
    svc.beginSync('sync_start');
    svc.syncComplete('sync_done');
    expect(seen.map((e) => e.to)).toEqual(['connected', 'syncing', 'ready']);
    expect(seen[0].from).toBe('disconnected');
    expect(seen[0].reason).toBe('port_opened');
  });

  it('unsubscribe detiene los eventos', () => {
    const seen = [];
    const unsub = svc.onStateChange((evt) => seen.push(evt));
    unsub();
    svc.connect();
    expect(seen).toEqual([]);
  });

  it('inspect expone estado, última transición y métricas', () => {
    svc.connect(); svc.beginSync(); svc.syncFailed();
    const snap = svc.inspect();
    expect(snap.state).toBe('resync_required');
    expect(snap.lastTransition.to).toBe('resync_required');
    expect(snap.metrics.resyncCount).toBe(1);
    expect(snap.metrics.syncCount).toBe(1);
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
  });

  it('cuenta transmisiones', () => {
    svc.connect(); svc.beginSync(); svc.syncComplete();
    svc.beginTransmission(); svc.transmissionComplete();
    svc.beginTransmission(); svc.transmissionComplete();
    expect(svc.inspect().metrics.transmissionCount).toBe(2);
  });
});

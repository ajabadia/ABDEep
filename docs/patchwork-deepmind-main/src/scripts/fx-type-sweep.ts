#!/usr/bin/env node

import { getDeepMindTransport } from '../deepmind/transport.js';

function getEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid ${name}=${raw} (expected a number)`);
  }
  return n;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type FxSlot = 1 | 2 | 3 | 4;

function getFxTypeNrpn(slot: FxSlot): { msb: number; lsb: number; nrpn: number } {
  // Per DeepMind NRPN table:
  // FX 1 Type: NRPN 166 (MSB 1, LSB 38)
  // FX 2 Type: NRPN 179 (MSB 1, LSB 51)
  // FX 3 Type: NRPN 192 (MSB 1, LSB 64)
  // FX 4 Type: NRPN 205 (MSB 1, LSB 77)
  const nrpn = 166 + (slot - 1) * 13;
  return { msb: 1, lsb: 38 + (slot - 1) * 13, nrpn };
}

async function main(): Promise<void> {
  const slot = getEnvInt('FX_SLOT', 1) as FxSlot;
  if (![1, 2, 3, 4].includes(slot)) {
    throw new Error(`Invalid FX_SLOT=${slot} (expected 1..4)`);
  }

  const start = getEnvInt('START', 0);
  const end = getEnvInt('END', 35);
  const delayMs = getEnvInt('DELAY_MS', 1200);
  const restoreValueRaw = process.env.RESTORE_VALUE;
  const restoreValue = restoreValueRaw == null ? null : Number(restoreValueRaw);

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0) {
    throw new Error(`Invalid START/END (${start}..${end})`);
  }
  if (end < start) {
    throw new Error(`Invalid START/END (${start}..${end}): END must be >= START`);
  }
  if (!Number.isInteger(delayMs) || delayMs < 0) {
    throw new Error(`Invalid DELAY_MS=${delayMs} (expected >= 0)`);
  }
  if (restoreValue != null && (!Number.isFinite(restoreValue) || restoreValue < 0 || restoreValue > 16383)) {
    throw new Error(`Invalid RESTORE_VALUE=${restoreValueRaw} (expected 0..16383)`);
  }

  const t = await getDeepMindTransport();
  const addr = getFxTypeNrpn(slot);

  console.error(
    `[fx-type-sweep] FX slot ${slot} type: NRPN ${addr.nrpn} (msb=${addr.msb} lsb=${addr.lsb}) on channel=${t.port.channel} deviceId=${t.deviceId}`,
  );
  console.error(`[fx-type-sweep] Sweeping values ${start}..${end} (DELAY_MS=${delayMs})`);
  if (restoreValue != null) {
    console.error(`[fx-type-sweep] Will restore RESTORE_VALUE=${restoreValue} at end`);
  } else {
    console.error('[fx-type-sweep] No RESTORE_VALUE set; leaving last value applied');
  }

  for (let v = start; v <= end; v++) {
    console.log(`${v}`);
    t.nrpn.send({ msb: addr.msb, lsb: addr.lsb }, v, { enableAddressCaching: true });
    await sleep(delayMs);
  }

  if (restoreValue != null) {
    t.nrpn.send({ msb: addr.msb, lsb: addr.lsb }, restoreValue, { enableAddressCaching: true });
    console.error('[fx-type-sweep] Restored.');
  }
}

main().catch((err) => {
  console.error('[fx-type-sweep] Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});

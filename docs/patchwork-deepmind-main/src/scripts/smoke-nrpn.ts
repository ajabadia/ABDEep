#!/usr/bin/env node

import { getDeepMindTransport } from '../deepmind/transport.js';

function getEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

async function main(): Promise<void> {
  const msb = getEnvInt('NRPN_MSB', 0);
  const lsb = getEnvInt('NRPN_LSB', 39); // VCF Frequency
  const value = getEnvInt('NRPN_VALUE', 0); // 0..16383, but we use 0..255 for u8 params

  if (msb < 0 || msb > 127 || lsb < 0 || lsb > 127) {
    throw new Error(`Invalid NRPN address msb=${msb} lsb=${lsb}`);
  }
  if (value < 0 || value > 16383) {
    throw new Error(`Invalid NRPN_VALUE=${value} (expected 0..16383)`);
  }

  const t = await getDeepMindTransport();

  console.error(`[smoke] Sending NRPN ${msb}/${lsb} value=${value} on channel=${t.port.channel} deviceId=${t.deviceId}`);
  t.nrpn.send({ msb, lsb }, value, { enableAddressCaching: true });
  console.error('[smoke] Sent.');
}

main().catch((err) => {
  console.error('[smoke] Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});

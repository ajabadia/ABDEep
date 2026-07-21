#!/usr/bin/env node

import { HardwareMidiPort } from '../midi/hardware-port.js';
import { listMidiPorts, resolvePortIndexByEnvOrAutoDetect } from '../midi/ports.js';
import { appNotifyHandshake, probeDeviceId } from '../deepmind/handshake.js';

function getEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function hex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

async function main(): Promise<void> {
  const ports = listMidiPorts();

  console.error('[smoke] Available MIDI inputs:');
  for (const p of ports.inputs) console.error(`  ${p.index}: ${p.name}`);

  console.error('[smoke] Available MIDI outputs:');
  for (const p of ports.outputs) console.error(`  ${p.index}: ${p.name}`);

  const inputPortIndex = resolvePortIndexByEnvOrAutoDetect({
    kind: 'input',
    ports: ports.inputs,
    envVar: 'MIDI_IN',
    sharedHintEnvVar: 'MIDI_PORT',
  });

  const outputPortIndex = resolvePortIndexByEnvOrAutoDetect({
    kind: 'output',
    ports: ports.outputs,
    envVar: 'MIDI_OUT',
    sharedHintEnvVar: 'MIDI_PORT',
  });

  const channel = getEnvInt('MIDI_CH', 0);
  const probeTimeoutMs = getEnvInt('PROBE_TIMEOUT_MS', 5000);
  const notifyTimeoutMs = getEnvInt('APP_NOTIFY_TIMEOUT_MS', 5000);

  console.error(`[smoke] Using MIDI_IN=${inputPortIndex} MIDI_OUT=${outputPortIndex} MIDI_CH=${channel}`);

  const port = new HardwareMidiPort({
    inputPortIndex,
    outputPortIndex,
    channel,
    enableSysexReception: true,
  });

  port.open();

  try {
    console.error(`[smoke] Probing via Universal Device Inquiry (timeout ${probeTimeoutMs}ms)...`);
    const { deviceId, identity } = await probeDeviceId(port, probeTimeoutMs);

    if (identity) {
      console.error(
        `[smoke] Identity reply: deviceId=${identity.deviceId} mfr=${hex(identity.manufacturerId)}`
      );
      console.error(`[smoke] Family=${hex(identity.family)} Model=${hex(identity.model)} Version=${hex(identity.version)}`);
    } else {
      console.error('[smoke] Identity reply received but could not parse');
    }

    console.error(`[smoke] Using deviceId=${deviceId}. Sending App Notify (timeout ${notifyTimeoutMs}ms)...`);
    const notifyResp = await appNotifyHandshake(port, deviceId, notifyTimeoutMs);

    if (notifyResp) {
      console.error(`[smoke] App Notify response (${notifyResp.length} bytes) received.`);
      console.error('[smoke] Handshake OK.');
    } else {
      console.error('[smoke] No App Notify response (may still work depending on interface/settings).');
    }
  } finally {
    port.close();
  }
}

main().catch((err) => {
  console.error('[smoke] Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});

import { HardwareMidiPort } from '../midi/hardware-port.js';
import { listMidiPorts, resolvePortIndexByEnvOrAutoDetect } from '../midi/ports.js';
import { NrpnSender } from '../midi/nrpn.js';
import { appNotifyHandshake, probeDeviceId } from './handshake.js';

export type DeepMindTransport = {
  port: HardwareMidiPort;
  nrpn: NrpnSender;
  deviceId: number;
};

let cached: DeepMindTransport | null = null;

function getEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export async function getDeepMindTransport(): Promise<DeepMindTransport> {
  if (cached) return cached;

  const ports = listMidiPorts();

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

  const port = new HardwareMidiPort({
    inputPortIndex,
    outputPortIndex,
    channel,
    enableSysexReception: true,
  });

  port.open();

  let deviceId = getEnvInt('DEEPMIND_DEVICE_ID', -1);
  if (deviceId < 0 || deviceId > 15) {
    try {
      const probed = await probeDeviceId(port, probeTimeoutMs);
      deviceId = probed.deviceId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[deepmind] Device inquiry failed; defaulting deviceId=0 (${msg})`);
      deviceId = 0;
    }
  }

  // App Notify enables NRPN/SysEx reliably per interface.
  await appNotifyHandshake(port, deviceId, notifyTimeoutMs);

  cached = {
    port,
    nrpn: new NrpnSender(port),
    deviceId,
  };

  return cached;
}

export function resetDeepMindTransportForTests(): void {
  if (!cached) return;
  try {
    cached.port.close();
  } catch {
    // ignore
  }
  cached = null;
}

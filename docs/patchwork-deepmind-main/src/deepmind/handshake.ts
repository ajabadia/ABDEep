import { HardwareMidiPort } from '../midi/hardware-port.js';

export type DeepMindIdentityInfo = {
  deviceId: number;
  manufacturerId: number[];
  family: number[];
  model: number[];
  version: number[];
  raw: Uint8Array;
};

function isBehringer(manufacturerId: number[]): boolean {
  return manufacturerId.length === 3 && manufacturerId[0] === 0x00 && manufacturerId[1] === 0x20 && manufacturerId[2] === 0x32;
}

export function parseUniversalIdentityReply(message: Uint8Array): DeepMindIdentityInfo | null {
  // Identity Reply:
  // F0 7E <device> 06 02 <mfr> <family> <model> <version> F7
  if (message.length < 15) return null;
  if (message[0] !== 0xf0 || message[1] !== 0x7e) return null;
  if (message[3] !== 0x06 || message[4] !== 0x02) return null;

  const deviceId = message[2] & 0x7f;

  let idx = 5;
  let manufacturerId: number[];
  if (message[idx] === 0x00) {
    if (idx + 2 >= message.length) return null;
    manufacturerId = [message[idx], message[idx + 1], message[idx + 2]];
    idx += 3;
  } else {
    manufacturerId = [message[idx]];
    idx += 1;
  }

  if (idx + 8 >= message.length) return null;
  const family = [message[idx], message[idx + 1]];
  const model = [message[idx + 2], message[idx + 3]];
  const version = [message[idx + 4], message[idx + 5], message[idx + 6], message[idx + 7]];

  return { deviceId, manufacturerId, family, model, version, raw: message };
}

export function makeUniversalDeviceInquiryRequest(): Uint8Array {
  // Universal Device Inquiry Request:
  // F0 7E 7F 06 01 F7
  return Uint8Array.from([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7]);
}

export async function probeDeviceId(port: HardwareMidiPort, timeoutMs: number): Promise<{
  deviceId: number;
  identity: DeepMindIdentityInfo | null;
}> {
  const request = makeUniversalDeviceInquiryRequest();

  const response = await port.requestSysEx(request, timeoutMs, (msg) => {
    // Filter to Universal Identity Reply.
    return msg.length >= 6 && msg[0] === 0xf0 && msg[1] === 0x7e && msg[3] === 0x06 && msg[4] === 0x02;
  });

  const identity = parseUniversalIdentityReply(response);

  if (identity && isBehringer(identity.manufacturerId)) {
    return { deviceId: identity.deviceId & 0x0f, identity };
  }

  // If we got an identity response but it isn't Behringer, keep the parsed struct for debugging.
  return { deviceId: identity ? (identity.deviceId & 0x0f) : 0, identity };
}

export function makeAppNotifyRequest(deviceId: number, reserved: number = 0): Uint8Array {
  // DeepMind App Notify Request:
  // F0 00 20 32 20 <deviceId> 00 rr F7
  return Uint8Array.from([0xf0, 0x00, 0x20, 0x32, 0x20, deviceId & 0x0f, 0x00, reserved & 0x7f, 0xf7]);
}

export async function appNotifyHandshake(port: HardwareMidiPort, deviceId: number, timeoutMs: number): Promise<Uint8Array | null> {
  const request = makeAppNotifyRequest(deviceId, 0);

  try {
    const response = await port.requestSysEx(request, timeoutMs, (msg) => {
      // Same manufacturer frame; any response is fine, but keep it deterministic.
      return (
        msg.length >= 8 &&
        msg[0] === 0xf0 &&
        msg[1] === 0x00 &&
        msg[2] === 0x20 &&
        msg[3] === 0x32 &&
        msg[4] === 0x20
      );
    });
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[deepmind] App Notify handshake timed out/failed: ${message}`);
    return null;
  }
}

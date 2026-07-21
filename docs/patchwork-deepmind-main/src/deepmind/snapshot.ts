import { HardwareMidiPort } from '../midi/hardware-port.js';
import { decodeDerivedFieldsFromEditBuffer, type DerivedValue } from './decoded-patch-map.js';
import {
  decodeDeepMindDumpResponse,
  makeDeepMindDumpRequest,
  makeEditBufferDump,
  toBase64,
  trimTrailingZeros,
} from './sysex.js';

export type DeepMindSnapshot = {
  rawSysexBase64: string;
  decodedPayloadBase64: string;
  decodedTrimmedBase64: string;
  derived?: Record<string, DerivedValue>;
  meta: {
    kind: string;
    cmd: string;
    protocol?: number;
    packedBytes: number;
    decodedLength: number;
    decodedTrimmedLength: number;
    trimmedCount: number;
  };
};

export async function snapshotEditBuffer(opts: {
  port: HardwareMidiPort;
  deviceId: number;
  timeoutMs: number;
}): Promise<DeepMindSnapshot> {
  const request = makeDeepMindDumpRequest({ type: 'edit', deviceId: opts.deviceId });

  const response = await opts.port.requestSysEx(request, opts.timeoutMs, (msg) => {
    // F0 00 20 32 20 <dev> 04 ... F7
    if (msg.length < 10) return false;
    if (msg[1] !== 0x00 || msg[2] !== 0x20 || msg[3] !== 0x32 || msg[4] !== 0x20) return false;
    if ((msg[5] & 0x0f) !== (opts.deviceId & 0x0f)) return false;
    return msg[6] === 0x04;
  });

  const { meta, decodedPayload } = decodeDeepMindDumpResponse(response);
  const trimmed = trimTrailingZeros(decodedPayload, 3);

  return {
    rawSysexBase64: toBase64(response),
    decodedPayloadBase64: toBase64(decodedPayload),
    decodedTrimmedBase64: toBase64(trimmed.trimmed),
    derived: meta.kind === 'edit' ? decodeDerivedFieldsFromEditBuffer(trimmed.trimmed) : undefined,
    meta: {
      kind: meta.kind,
      cmd: meta.cmd,
      protocol: meta.protocol,
      packedBytes: meta.packedBytes,
      decodedLength: meta.decodedLength,
      decodedTrimmedLength: trimmed.trimmed.length,
      trimmedCount: trimmed.trimmedCount,
    },
  };
}

/**
 * Read the current edit buffer, apply byte-level modifications, and write
 * the entire buffer back via sysex. This bypasses NRPN and is useful when
 * certain NRPN addresses don't respond to writes.
 */
export async function patchEditBuffer(opts: {
  port: HardwareMidiPort;
  deviceId: number;
  timeoutMs: number;
  /** Map of decoded-byte offset → new value to apply before writing back. */
  patches: Map<number, number>;
}): Promise<{ modifiedCount: number; decodedLength: number }> {
  // 1. Read current edit buffer
  const request = makeDeepMindDumpRequest({ type: 'edit', deviceId: opts.deviceId });
  const response = await opts.port.requestSysEx(request, opts.timeoutMs, (msg) => {
    if (msg.length < 10) return false;
    if (msg[1] !== 0x00 || msg[2] !== 0x20 || msg[3] !== 0x32 || msg[4] !== 0x20) return false;
    if ((msg[5] & 0x0f) !== (opts.deviceId & 0x0f)) return false;
    return msg[6] === 0x04;
  });
  const { meta, decodedPayload } = decodeDeepMindDumpResponse(response);
  if (meta.kind !== 'edit') throw new Error(`Expected edit buffer, got ${meta.kind}`);

  // 2. Apply patches to the decoded bytes
  const patched = new Uint8Array(decodedPayload);
  let modifiedCount = 0;
  for (const [offset, value] of opts.patches) {
    if (offset < 0 || offset >= patched.length) {
      throw new Error(`Offset ${offset} out of range (0..${patched.length - 1})`);
    }
    patched[offset] = value & 0xff;
    modifiedCount++;
  }

  // 3. Write back via sysex
  const dump = makeEditBufferDump({
    deviceId: opts.deviceId,
    protocol: meta.protocol ?? 7,
    decodedPayload: patched,
  });
  opts.port.sendBytes(dump);

  return { modifiedCount, decodedLength: patched.length };
}

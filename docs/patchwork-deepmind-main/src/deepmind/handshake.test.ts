import { describe, expect, it } from 'vitest';

import {
  makeAppNotifyRequest,
  makeUniversalDeviceInquiryRequest,
  parseUniversalIdentityReply,
} from './handshake.js';

describe('DeepMind handshake (pure)', () => {
  it('builds Universal Device Inquiry request', () => {
    expect(Array.from(makeUniversalDeviceInquiryRequest())).toEqual([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7]);
  });

  it('builds App Notify request', () => {
    expect(Array.from(makeAppNotifyRequest(0x0d, 0x00))).toEqual([
      0xf0,
      0x00,
      0x20,
      0x32,
      0x20,
      0x0d,
      0x00,
      0x00,
      0xf7,
    ]);
  });

  it('parses a Universal Identity Reply (Behringer)', () => {
    // Identity Reply format:
    // F0 7E <device> 06 02 <mfr> <family> <model> <version> F7
    const reply = Uint8Array.from([
      0xf0,
      0x7e,
      0x0d, // device id
      0x06,
      0x02,
      0x00,
      0x20,
      0x32, // Behringer
      0x20,
      0x00, // family
      0x00,
      0x01, // model
      0x01,
      0x02,
      0x03,
      0x04, // version (4 bytes)
      0xf7,
    ]);

    const parsed = parseUniversalIdentityReply(reply);
    expect(parsed).not.toBeNull();
    expect(parsed?.deviceId).toBe(0x0d);
    expect(parsed?.manufacturerId).toEqual([0x00, 0x20, 0x32]);
    expect(parsed?.family).toEqual([0x20, 0x00]);
    expect(parsed?.model).toEqual([0x00, 0x01]);
    expect(parsed?.version).toEqual([0x01, 0x02, 0x03, 0x04]);
  });

  it('returns null for non-identity SysEx', () => {
    expect(parseUniversalIdentityReply(Uint8Array.from([0xf0, 0x00, 0x20, 0x32, 0xf7]))).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { decodeDeepMindDumpResponse, packMsb, trimTrailingZeros, unpackPackedMsb } from './sysex.js';

type FixtureGroup = {
  syx: string;
  decoded: string;
};

function readBytes(filePath: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(filePath));
}

function findFixturePairs(): FixtureGroup[] {
  const fixturesDir = path.resolve(process.cwd(), 'fixtures/sysex/deepmind-dumps');
  const entries = fs.readdirSync(fixturesDir);

  const groupsByStem = new Map<string, { syx?: string; decodedBin?: string; decodedBin242?: string }>();

  for (const name of entries) {
    if (!name.startsWith('deepmind-') || !name.includes('-')) continue;
    const abs = path.join(fixturesDir, name);

    if (name.endsWith('-edit.syx') || name.endsWith('-program.syx')) {
      const stem = name.replace(/\.(syx)$/, '');
      const group = groupsByStem.get(stem) ?? {};
      group.syx = abs;
      groupsByStem.set(stem, group);
      continue;
    }

    if (name.endsWith('-edit.bin242') || name.endsWith('-edit.bin') || name.endsWith('-program.bin')) {
      const stem = name.replace(/\.(bin242|bin)$/, '');
      const group = groupsByStem.get(stem) ?? {};
      if (name.endsWith('.bin242')) group.decodedBin242 = abs;
      else group.decodedBin = abs;
      groupsByStem.set(stem, group);
      continue;
    }
  }

  const pairs: FixtureGroup[] = [];
  for (const [stem, group] of groupsByStem.entries()) {
    const decoded = group.decodedBin242 ?? group.decodedBin;
    if (group.syx && decoded) pairs.push({ syx: group.syx, decoded });
    else {
      // ignore incomplete fixture groups
      void stem;
    }
  }

  // Ensure deterministic order
  pairs.sort((a, b) => a.syx.localeCompare(b.syx));
  return pairs;
}

describe('deepmind sysex dump decoding (fixtures)', () => {
  const pairs = findFixturePairs();

  it('has at least one dump fixture pair', () => {
    expect(pairs.length).toBeGreaterThan(0);
  });

  for (const fixture of pairs) {
    it(path.basename(fixture.syx), () => {
      const raw = readBytes(fixture.syx);
      const expectedDecoded = readBytes(fixture.decoded);

      const { meta, decodedPayload } = decodeDeepMindDumpResponse(raw);

      const isBin242 = fixture.decoded.endsWith('.bin242');
      const candidate = isBin242 ? trimTrailingZeros(decodedPayload, 3).trimmed : decodedPayload;

      expect(candidate).toEqual(expectedDecoded);
      expect(isBin242 ? candidate.length : meta.decodedLength).toBe(expectedDecoded.length);
      expect(meta.packedBytes).toBeGreaterThan(0);
    });
  }
});

describe('packMsb / unpackPackedMsb round-trip', () => {
  it('round-trips 242-byte edit buffer payload', () => {
    // Use a real decoded fixture as test input
    const pairs = findFixturePairs();
    expect(pairs.length).toBeGreaterThan(0);

    const raw = readBytes(pairs[0].syx);
    const { decodedPayload } = decodeDeepMindDumpResponse(raw);
    const trimmed = trimTrailingZeros(decodedPayload, 3).trimmed;

    // Pack then unpack should recover the original (padded to multiple of 7)
    const packed = packMsb(trimmed);
    const recovered = unpackPackedMsb(packed);

    // recovered may have trailing zeros due to 7-byte alignment padding
    expect(recovered.slice(0, trimmed.length)).toEqual(trimmed);
  });

  it('round-trips arbitrary data with high bits', () => {
    const data = Uint8Array.from([0, 127, 128, 200, 255, 1, 42]);
    const packed = packMsb(data);
    const recovered = unpackPackedMsb(packed);
    expect(recovered.slice(0, data.length)).toEqual(data);
  });
});

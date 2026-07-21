import { decodeDeepMindDumpResponse, trimTrailingZeros } from '../deepmind/sysex.js';
import { decodeDerivedFieldsFromEditBuffer } from '../deepmind/decoded-patch-map.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'fixtures/sysex/deepmind-dumps';
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

for (const file of files) {
  const data = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
  const sysex = Uint8Array.from(data.response);
  const { meta, decodedPayload } = decodeDeepMindDumpResponse(sysex);
  const { trimmed } = trimTrailingZeros(decodedPayload, 3);
  const params = decodeDerivedFieldsFromEditBuffer(trimmed);

  console.log(`\n═══ ${file} (${meta.kind}, bank=${meta.bank ?? '-'}, prog=${meta.program ?? '-'}) ═══`);
  
  // Extract patch name (offsets 222-241)
  const nameBytes = trimmed.slice(222, 242);
  const patchName = String.fromCharCode(...nameBytes).replace(/\0+$/, '').trim();
  console.log(`Patch name: "${patchName}"`);

  // Show all params with values
  const entries = Object.entries(params).filter(([, v]) => v.raw !== 0 || v.label);
  for (const [k, v] of entries) {
    const extra = v.label ? ` (${v.label})` : '';
    console.log(`  ${k} = ${v.raw}${extra}`);
  }
}

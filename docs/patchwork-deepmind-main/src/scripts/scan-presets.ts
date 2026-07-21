#!/usr/bin/env node
/**
 * scan-presets — Dump and decode factory presets, flagging unusual parameter combos.
 *
 * Usage:
 *   npx tsx src/scripts/scan-presets.ts
 *
 * Env vars:
 *   BANK_START=0   BANK_END=0     (0–7, default: bank 0 only)
 *   PROG_START=0   PROG_END=127   (0–127, default: full bank)
 *   DUMP_DELAY=200                 (ms between requests, default 200)
 *   OUT_FILE=preset-scan.json      (write decoded data, default: stdout summary only)
 */

import { getDeepMindTransport } from '../deepmind/transport.js';
import { decodeDeepMindDumpResponse, makeDeepMindDumpRequest, trimTrailingZeros } from '../deepmind/sysex.js';
import { decodeDerivedFieldsFromEditBuffer, type DerivedValue } from '../deepmind/decoded-patch-map.js';
import { writeFileSync } from 'node:fs';

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type DecodedPreset = {
  bank: number;
  program: number;
  name: string;
  params: Record<string, DerivedValue>;
};

/** Extract the 20-char patch name from decoded bytes (offsets 222–241). */
function extractPatchName(decoded: Uint8Array): string {
  const nameBytes = decoded.slice(222, 242);
  return String.fromCharCode(...nameBytes).replace(/\0+$/, '').trim();
}

// ── Anomaly detectors ──────────────────────────────────────────────────

type Anomaly = { tag: string; detail: string };

function detectAnomalies(p: Record<string, DerivedValue>): Anomaly[] {
  const out: Anomaly[] = [];
  const raw = (k: string) => p[k]?.raw ?? 0;
  const label = (k: string) => p[k]?.label ?? '';

  // Envelope loop / LFO trigger modes (turns envelope into an LFO)
  for (const env of ['env.amp', 'env.filter', 'env.mod'] as const) {
    const mode = raw(`${env}.triggerMode`);
    if (mode === 3) out.push({ tag: 'env-loop', detail: `${env} in Loop mode — envelope cycles as a complex LFO` });
    if (mode === 1) out.push({ tag: 'env-lfo1-trig', detail: `${env} triggered by LFO 1` });
    if (mode === 2) out.push({ tag: 'env-lfo2-trig', detail: `${env} triggered by LFO 2` });
    if (mode === 4) out.push({ tag: 'env-seq-trig', detail: `${env} triggered by control sequencer step` });
  }

  // Sustain slope (non-flat sustain)
  for (const env of ['env.amp', 'env.filter', 'env.mod'] as const) {
    const curve = raw(`${env}.sustainCurve`);
    if (curve < 100) out.push({ tag: 'sustain-falling', detail: `${env}.sustainCurve=${curve} — level drops during sustain` });
    if (curve > 156) out.push({ tag: 'sustain-rising', detail: `${env}.sustainCurve=${curve} — level rises during sustain` });
  }

  // Self-oscillating filter (resonance > ~200)
  if (raw('filter.resonance') > 200) {
    out.push({ tag: 'self-osc-filter', detail: `filter.resonance=${raw('filter.resonance')} — filter self-oscillates as pitched sine` });
  }

  // Filter as oscillator: high resonance + key tracking
  if (raw('filter.resonance') > 180 && raw('filter.keyTracking') > 100) {
    out.push({ tag: 'filter-osc-tracked', detail: `High resonance (${raw('filter.resonance')}) + key tracking (${raw('filter.keyTracking')}) — playable filter oscillator` });
  }

  // Inverted filter envelope
  if (raw('filter.envPolarity') === 0 && raw('filter.envDepth') > 60) {
    out.push({ tag: 'inv-filter-env', detail: `Inverted filter envelope with depth=${raw('filter.envDepth')}` });
  }

  // OSC sync
  if (raw('osc2.sync') === 1) {
    out.push({ tag: 'osc-sync', detail: `OSC 2 hard-synced to OSC 1` });
    if (raw('osc2.pitchMod') > 40) {
      out.push({ tag: 'sync-sweep', detail: `Sync + OSC 2 pitchMod=${raw('osc2.pitchMod')} via ${label('osc2.pitchModSelect') || `source ${raw('osc2.pitchModSelect')}`}` });
    }
  }

  // Audio-rate LFO (pitch mod FM)
  if (raw('lfo1.rate') > 200) out.push({ tag: 'audio-lfo1', detail: `LFO 1 at audio rate (${raw('lfo1.rate')})` });
  if (raw('lfo2.rate') > 200) out.push({ tag: 'audio-lfo2', detail: `LFO 2 at audio rate (${raw('lfo2.rate')})` });

  // OSC 2 tone mod (unique DeepMind feature)
  if (raw('osc2.toneMod') > 60) {
    out.push({ tag: 'tone-mod', detail: `OSC 2 tone mod depth=${raw('osc2.toneMod')} via ${label('osc2.toneModSource') || `source ${raw('osc2.toneModSource')}`} — metallic/bell timbres` });
  }

  // LFO phase spread (per-voice phase offset)
  if (raw('lfo1.phase') > 1) out.push({ tag: 'lfo1-spread', detail: `LFO 1 phase spread=${raw('lfo1.phase') - 1} across voices` });
  if (raw('lfo2.phase') > 1) out.push({ tag: 'lfo2-spread', detail: `LFO 2 phase spread=${raw('lfo2.phase') - 1} across voices` });

  // Portamento balance (split glide rate between OSC 1 and 2)
  const portaBal = raw('portamento.balance');
  if (portaBal !== 128 && raw('portamento.time') > 0) {
    out.push({ tag: 'porta-balance', detail: `Portamento balance=${portaBal - 128} — OSC 1 and 2 glide at different rates` });
  }

  // Fixed-offset portamento modes
  const portaMode = raw('portamento.mode');
  if (portaMode >= 6 && raw('portamento.time') > 0) {
    out.push({ tag: 'fixed-porta', detail: `Fixed portamento mode ${label('portamento.mode') || portaMode} — every note slides from fixed offset` });
  }

  // Key-down reset
  if (raw('osc.keyDownReset') === 1) {
    out.push({ tag: 'key-reset', detail: 'OSC phase resets on key-down (consistent transients)' });
  }

  // Control sequencer active
  if (raw('ctrlSeq.enabled') === 1) {
    out.push({ tag: 'ctrl-seq', detail: `Control sequencer ON, length=${raw('ctrlSeq.length')}, swing=${raw('ctrlSeq.swing')}` });
  }

  // Significant drift
  if (raw('voice.drift') > 30 || raw('voice.parameterDrift') > 30) {
    out.push({ tag: 'drift', detail: `Drift: osc=${raw('voice.drift')}, param=${raw('voice.parameterDrift')}, rate=${raw('voice.driftRate')}` });
  }

  // Mod matrix: look for unusual destinations
  for (let i = 1; i <= 8; i++) {
    const src = raw(`modMatrix.${i}.source`);
    const dst = raw(`modMatrix.${i}.destination`);
    const depth = raw(`modMatrix.${i}.depth`);
    if (depth !== 128 && dst !== 0) {
      // FX parameter destinations (destinations > ~100 are often FX)
      const srcLabel = label(`modMatrix.${i}.source`) || String(src);
      const dstLabel = label(`modMatrix.${i}.destination`) || String(dst);
      out.push({ tag: 'mod-route', detail: `Mod ${i}: ${srcLabel} → ${dstLabel}, depth=${depth - 128}` });
    }
  }

  // FX: interesting types
  for (let slot = 1; slot <= 4; slot++) {
    const fxType = raw(`fx${slot}.type`);
    if (fxType > 0) {
      const fxLabel = label(`fx${slot}.type`) || String(fxType);
      out.push({ tag: 'fx', detail: `FX${slot}: ${fxLabel}` });
    }
  }

  // 2-pole filter
  if (raw('filter.twoPoleMode') === 1) {
    out.push({ tag: '2pole', detail: '2-pole (12 dB/oct) filter' });
  }

  // Bass boost on
  if (raw('filter.bassBoost') === 1) {
    out.push({ tag: 'bass-boost', detail: 'Bass boost ON (+6 dB @ 100 Hz)' });
  }

  // One-shot envelope trigger
  if (raw('voice.envelopeTriggerMode') === 3) {
    out.push({ tag: 'one-shot', detail: 'Envelope trigger mode: One-Shot (no sustain, percussive)' });
  }

  // Legato envelope trigger
  if (raw('voice.envelopeTriggerMode') === 2) {
    out.push({ tag: 'legato', detail: 'Envelope trigger mode: Legato (no re-trigger on overlapping notes)' });
  }

  return out;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const bankStart = envInt('BANK_START', 0);
  const bankEnd = envInt('BANK_END', 0);
  const progStart = envInt('PROG_START', 0);
  const progEnd = envInt('PROG_END', 127);
  const dumpDelay = envInt('DUMP_DELAY', 200);
  const outFile = process.env.OUT_FILE;

  const transport = await getDeepMindTransport();
  const results: DecodedPreset[] = [];
  const anomalySummary: Map<string, number> = new Map();

  for (let bank = bankStart; bank <= bankEnd; bank++) {
    for (let prog = progStart; prog <= progEnd; prog++) {
      const request = makeDeepMindDumpRequest({
        type: 'program',
        deviceId: transport.deviceId,
        bank,
        program: prog,
      });

      try {
        const response = await transport.port.requestSysEx(request, 5000, (msg) => {
          if (msg.length < 12) return false;
          if (msg[1] !== 0x00 || msg[2] !== 0x20 || msg[3] !== 0x32 || msg[4] !== 0x20) return false;
          if ((msg[5] & 0x0f) !== (transport.deviceId & 0x0f)) return false;
          return msg[6] === 0x02; // Program dump response
        });

        const { decodedPayload } = decodeDeepMindDumpResponse(response);
        const { trimmed } = trimTrailingZeros(decodedPayload, 3);
        const params = decodeDerivedFieldsFromEditBuffer(trimmed);
        const name = extractPatchName(trimmed);

        const anomalies = detectAnomalies(params);
        for (const a of anomalies) {
          anomalySummary.set(a.tag, (anomalySummary.get(a.tag) ?? 0) + 1);
        }

        const interestingCount = anomalies.filter((a) =>
          !['fx', 'mod-route', '2pole', 'bass-boost'].includes(a.tag),
        ).length;

        if (interestingCount > 0) {
          console.error(
            `[${bank}:${String(prog).padStart(3, '0')}] ${name.padEnd(22)} ★${interestingCount} ${anomalies
              .filter((a) => !['fx', 'mod-route'].includes(a.tag))
              .map((a) => a.tag)
              .join(', ')}`,
          );
          for (const a of anomalies) {
            console.error(`    ${a.detail}`);
          }
        } else {
          console.error(`[${bank}:${String(prog).padStart(3, '0')}] ${name.padEnd(22)}`);
        }

        results.push({ bank, program: prog, name, params });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[${bank}:${String(prog).padStart(3, '0')}] ERROR: ${msg}`);
      }

      await sleep(dumpDelay);
    }
  }

  // Summary
  console.error('\n─── Anomaly Summary ───');
  const sorted = [...anomalySummary.entries()].sort((a, b) => b[1] - a[1]);
  for (const [tag, count] of sorted) {
    console.error(`  ${tag}: ${count} presets`);
  }

  if (outFile) {
    const jsonData = results.map((r) => ({
      bank: r.bank,
      program: r.program,
      name: r.name,
      anomalies: detectAnomalies(r.params).map((a) => ({ tag: a.tag, detail: a.detail })),
      params: Object.fromEntries(
        Object.entries(r.params)
          .filter(([, v]) => v.raw !== 0 && v.raw !== 128) // skip defaults
          .map(([k, v]) => [k, { raw: v.raw, label: v.label }]),
      ),
    }));
    writeFileSync(outFile, JSON.stringify(jsonData, null, 2));
    console.error(`\nWrote ${results.length} presets to ${outFile}`);
  }
}

main().catch((err) => {
  console.error('[scan] Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});

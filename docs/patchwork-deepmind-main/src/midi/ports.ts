import midi from 'midi';

export type MidiPortList = {
  inputs: Array<{ index: number; name: string }>;
  outputs: Array<{ index: number; name: string }>;
};

export function listMidiPorts(): MidiPortList {
  const input = new midi.Input();
  const output = new midi.Output();

  const inputs: Array<{ index: number; name: string }> = [];
  const outputs: Array<{ index: number; name: string }> = [];

  for (let i = 0; i < input.getPortCount(); i++) {
    inputs.push({ index: i, name: input.getPortName(i) });
  }
  for (let i = 0; i < output.getPortCount(); i++) {
    outputs.push({ index: i, name: output.getPortName(i) });
  }

  // Avoid leaking native handles.
  input.closePort();
  output.closePort();

  return { inputs, outputs };
}

function includesInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function isLikelyVirtualPort(name: string): boolean {
  // Keep this conservative; we only want to avoid obvious virtual ports.
  return includesInsensitive(name, 'virtual') || includesInsensitive(name, 'iac');
}

function parseIndexEnv(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function resolvePortIndexByEnvOrName(opts: {
  kind: 'input' | 'output';
  ports: Array<{ index: number; name: string }>;
  envVar: string;
}): number {
  const raw = process.env[opts.envVar];
  const byIndex = parseIndexEnv(raw);
  if (byIndex !== null) {
    const match = opts.ports.find((p) => p.index === byIndex);
    if (!match) {
      throw new Error(`No MIDI ${opts.kind} port at index ${byIndex} (from ${opts.envVar})`);
    }
    return match.index;
  }

  const name = raw?.trim();
  if (name) {
    const match = opts.ports.find((p) => p.name === name);
    if (!match) {
      throw new Error(`No MIDI ${opts.kind} port named "${name}" (from ${opts.envVar})`);
    }
    return match.index;
  }

  throw new Error(
    `Missing ${opts.envVar}. Set it to a port index (e.g. "0") or exact port name.`
  );
}

export function resolvePortIndexByEnvOrAutoDetect(opts: {
  kind: 'input' | 'output';
  ports: Array<{ index: number; name: string }>;
  /** Exact override via env var (index or exact name). */
  envVar: string;
  /** Optional shared hint; can be partial name; used only when envVar is unset. */
  sharedHintEnvVar?: string;
}): number {
  const direct = process.env[opts.envVar];
  if (direct && direct.trim().length > 0) {
    return resolvePortIndexByEnvOrName({ kind: opts.kind, ports: opts.ports, envVar: opts.envVar });
  }

  const hintVar = opts.sharedHintEnvVar ?? 'MIDI_PORT';
  const hint = process.env[hintVar]?.trim();
  if (hint) {
    const matches = opts.ports
      .filter((p) => includesInsensitive(p.name, hint))
      .sort((a, b) => a.index - b.index);
    if (matches.length > 0) {
      if (matches.length > 1) {
        console.error(
          `[midi] Multiple ${opts.kind} ports match ${hintVar}="${hint}"; choosing index ${matches[0].index} (${matches[0].name}). Set ${opts.envVar} to disambiguate.`
        );
      } else {
        console.error(`[midi] Auto-selected ${opts.kind} port from ${hintVar}="${hint}": ${matches[0].index} (${matches[0].name})`);
      }
      return matches[0].index;
    }
    console.error(`[midi] No ${opts.kind} ports match ${hintVar}="${hint}"; falling back to built-in heuristics.`);
  }

  // Built-in heuristics: prefer DeepMind ports, then U2MIDI, then first non-virtual, then first.
  const sorted = [...opts.ports].sort((a, b) => a.index - b.index);

  const preferredNeedles = ['deepmind', 'u2midi'];
  for (const needle of preferredNeedles) {
    const match = sorted.find((p) => includesInsensitive(p.name, needle));
    if (match) {
      console.error(`[midi] Auto-selected ${opts.kind} port by name match "${needle}": ${match.index} (${match.name})`);
      return match.index;
    }
  }

  const nonVirtual = sorted.find((p) => !isLikelyVirtualPort(p.name));
  if (nonVirtual) {
    console.error(`[midi] Auto-selected ${opts.kind} first non-virtual port: ${nonVirtual.index} (${nonVirtual.name})`);
    return nonVirtual.index;
  }

  if (sorted.length === 0) {
    throw new Error(`No MIDI ${opts.kind} ports available`);
  }
  console.error(`[midi] Auto-selected ${opts.kind} first port: ${sorted[0].index} (${sorted[0].name})`);
  return sorted[0].index;
}

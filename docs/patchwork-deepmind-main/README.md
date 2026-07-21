# patchwork-deepmind

MCP server for the Behringer DeepMind 12 synthesizer. Gives AI agents real-time control over synth parameters via MIDI NRPN, plus edit-buffer snapshots via SysEx.

## Requirements

- Node.js >= 22
- DeepMind 12 connected via USB-MIDI
- macOS (uses native MIDI)

## Install

```bash
npm install patchwork-deepmind
```

## MCP client setup

Add to your MCP client config (Claude Desktop, VS Code, etc.):

```json
{
  "mcpServers": {
    "deepmind12": {
      "command": "npx",
      "args": ["patchwork-deepmind"]
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `set_param` | Set a parameter by name (normalized 0–1, raw integer, or enum label) |
| `set_params` | Batch-set multiple parameters in one call |
| `describe_param` | Look up a parameter's NRPN, range, units, enum labels, and notes |
| `describe_nrpn` | Search/list raw NRPN parameters |
| `describe_fx_type` | List all 35 FX effect types, or get the full param schema for one (settable names, units, min/max, enums) — without needing a snapshot or loading the effect first |
| `snapshot_state` | Read current patch state via SysEx edit-buffer dump |
| `send_nrpn` | Send a raw NRPN message by number and value |
| `patch_edit_buffer` | Read, patch, and write-back raw edit-buffer bytes (use for FX params when set_param can't reach them) |

## Parameter guide skill (recommended)

The MCP tools give an agent the ability to control the synth, but not the knowledge of *what sounds good* — which parameters interact, what value ranges are musical, or how to approach building a specific type of sound.

The `skills/deepmind-parameter-guide/` folder is a portable agent skill that provides this. It's organized as a compact index with drill-down sections by synth area (oscillators, filter, envelopes, LFOs, effects, etc.), so an agent loads only the context it needs.

**To install the skill**, copy it into your project's `.claude/skills/` directory:

```bash
# From the cloned repo:
cp -r skills/deepmind-parameter-guide .claude/skills/

# Or from the installed npm package:
cp -r $(npm explore patchwork-deepmind -- pwd)/skills/deepmind-parameter-guide .claude/skills/
```

The skill is self-contained — no dependencies on this repo.

## How it works

The server runs as a stdio-based MCP process — no network involved. Your MCP client (Claude Desktop, VS Code, etc.) spawns it as a subprocess and communicates over stdin/stdout. The server auto-detects the DeepMind's USB-MIDI port on startup and performs a SysEx handshake to confirm the connection.

## Example

Once connected, you can talk to your agent naturally:

> "Give me a warm pad with slow filter movement and a long reverb tail"

> "Make the attack slower and add some chorus"

> "Snapshot the current patch so I can see what all the values are"

The agent uses the MCP tools to translate these into NRPN messages and SysEx commands in real time. You hear changes immediately on the synth.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MIDI_IN` | auto-detect | MIDI input port index or exact name |
| `MIDI_OUT` | auto-detect | MIDI output port index or exact name |
| `MIDI_PORT` | — | Shared hint (partial name) used when `MIDI_IN`/`MIDI_OUT` are unset |
| `MIDI_CH` | `0` | MIDI channel (0–15, where 0 = channel 1) |

## Troubleshooting

- **Server fails to find MIDI port** — Make sure the DeepMind is connected via USB and powered on *before* starting the server. Verify it appears in macOS Audio MIDI Setup.
- **Parameters aren't changing on the synth** — Check that the DeepMind is set to receive on the correct MIDI channel (Global Settings → MIDI Channel). The default is channel 1.
- **Multiple DeepMinds or other MIDI devices** — Use `MIDI_IN` / `MIDI_OUT` env vars to select the correct port by index or name.

## Development

```bash
npm install
npm run build
npm test
```

## Contributing

Issues and PRs welcome.

## License

MIT

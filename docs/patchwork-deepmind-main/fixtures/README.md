# Fixtures

This folder contains real-world captured data used to validate protocol logic.

## `sysex/`

- `sysex/deepmind-dumps/`: raw DeepMind SysEx dumps captured from hardware
  - `.syx` raw SysEx bytes (always preserve)
  - `.bin` decoded payload bytes
  - `.bin242` optionally trimmed decoded payload (when trailing padding is present)
  - `.json` metadata summaries from capture tooling

Policy:

- Never overwrite fixtures unless intentionally re-capturing.
- Prefer adding new captures with timestamps.

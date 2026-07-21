# Envelopes — Parameter Guide

> Source: DeepMind 12 Owner's Manual, pp. 89–91 (§8.8 Envelopes)

## What this controls

The DeepMind 12 has three independent ADSR envelope generators: **VCA Envelope** (controls amplitude over time), **VCF Envelope** (controls filter cutoff over time), and **MOD Envelope** (a free-routable envelope available as a Mod Matrix source). Each envelope has four stages — Attack (time), Decay (time), Sustain (level), and Release (time) — plus per-stage curve shaping and a selectable trigger mode. Envelopes are normally triggered by key press, but can also be triggered by an LFO, looped continuously, or stepped from the Control Sequencer.

**Params**: Three independent envelopes — VCA (`env.amp.*`), VCF (`env.filter.*`), MOD (`env.mod.*`). Each has `.attack`, `.decay`, `.sustain`, `.release`, `.triggerMode`, `.attackCurve`, `.decayCurve`, `.sustainCurve`, `.releaseCurve`. Run `describe_param` on any for NRPNs and ranges.

## Value guidance

### ADSR times and levels

- **Attack** (0–255): 0 = instant (percussive snap), low values (1–20) = fast click/pluck, mid values (60–120) = gradual swell for pads, high values (180–255) = very slow fade-in.
- **Decay** (0–255): 0 = instant drop to sustain, low values = punchy/plucky, mid values = natural piano-like decay, high values = slow transition to sustain.
- **Sustain** (0–255): This is a **level**, not a time. 0 = no sustain (sound dies after decay), 128 = half level, 255 = full level (no audible decay phase). For organ-like sounds use 255; for plucks/percussion use 0–30.
- **Release** (0–255): 0 = instant cutoff on key release, low values (5–30) = tight/staccato, mid values (60–120) = natural fade, high values (180–255) = long ambient tail.

### Trigger modes

- **Key** (0): Normal — envelope fires on every key press. The standard mode for melodic playing.
- **LFO 1** (1): Envelope re-triggers on each LFO 1 cycle. Creates rhythmic amplitude/filter tremolo effects. LFO rate controls repetition speed.
- **LFO 2** (2): Same as LFO 1 but using LFO 2. Useful when LFO 1 is assigned elsewhere (e.g. vibrato).
- **Loop** (3): Envelope continuously loops — as soon as release ends, attack restarts. Sustain stage is **skipped** in loop mode. Effectively turns the envelope into a complex LFO shape. Short ADSR times = fast rhythmic cycling; long times = slow evolving textures.
- **Control Sequencer Step** (4): Envelope re-triggers on every step of the Control Sequencer. Great for sequenced rhythmic patterns — each step kicks a new envelope cycle.

**Important**: In all looping/non-Key trigger modes (LFO 1, LFO 2, Loop, Seq), the sustain stage is bypassed — the envelope goes directly from decay into release.

### Curve shaping

Each ADSR stage has a curve parameter (0–255) that reshapes its response:

- **Attack Curve** (0–255): 0 = exponential (fast initial rise, slow finish — punchy), 128 = linear, 255 = logarithmic (slow initial rise, fast finish — gradual swell).
- **Decay Curve** (0–255): 0 = exponential (fast initial drop, slow approach to sustain — natural), 128 = linear, 255 = logarithmic (slow initial drop, then sudden transition to sustain).
- **Sustain Curve / Slope** (0–255): Unlike attack/decay/release, this controls a **slope** during the sustain phase. 0 = falling slope (level drops during sustain), 128 = flat (classic sustain behavior), 255 = rising slope (level increases while key is held). Non-128 values create slow drifts during held notes.
- **Release Curve** (0–255): 0 = exponential (fast initial drop, slow tail — natural fade), 128 = linear, 255 = logarithmic (slow initial drop then abrupt end).

Default curve value of 128 (linear) matches the classic ADSR shape. Most analog synth sounds use lower curve values (0–80) for attack and decay/release to get the natural exponential response.

## Interactions

- The VCA envelope controls volume — if `env.amp.sustain` is 0 and `env.amp.decay` is 0, you will hear only a brief click (if any) regardless of other settings.
- The VCF envelope's effect depends on `filter.envDepth` and `filter.envPolarity` (see [filter.md](filter.md)). If `filter.envDepth` is 0, the VCF envelope has no audible effect.
- The VCF envelope velocity sensitivity is controlled by `filter.envVelocity` (NRPN 43) — documented in [filter.md](filter.md).
- The MOD envelope is a **Mod Matrix source only** — it has no hardwired destination. Assign it to a destination in the Mod Matrix to hear its effect (see [mod-matrix.md](mod-matrix.md)).
- `voice.envelopeTriggerMode` (NRPN 86) is a separate, global parameter that controls how envelopes behave with overlapping notes: Mono (0), Re-Trigger (1), Legato (2), One-Shot (3). This is independent of the per-envelope trigger mode and is documented in [voice-config.md](voice-config.md).
- All three envelopes share the same physical A/D/S/R faders — press the VCA, VCF, or MOD switch to select which envelope the faders control. The CURVES switch toggles the faders between ADSR time/level and curve shape editing.
- When designing sounds, set the VCA envelope first (it gates the sound), then shape the VCF envelope to add tonal movement, and finally use the MOD envelope for additional animation via the Mod Matrix.
- VCA envelope depth and velocity sensitivity are controlled by `vca.envDepth` (NRPN 81) and `vca.envVelocity` (NRPN 82) — documented in [vca.md](vca.md).

## Envelope stages diagram

```
Level
  ▲
  │    /\
  │   /  \___________
  │  /   ↑    ↑      \
  │ / Attack Sustain   \
  │/  ↑  Decay  Level   \  Release
  └──────────────────────────► Time
      │              │   │
   Key Press      Key Held  Key Released
```

In **Loop** mode (trigger mode 3), sustain is skipped:

```
Level
  ▲
  │    /\      /\      /\
  │   /  \    /  \    /  \
  │  /    \  /    \  /    \
  │ /      \/      \/      \...
  └──────────────────────────► Time
    ATK DCY REL ATK DCY REL
```

## Related sections

- → [filter.md](filter.md) for VCF Envelope Depth, Polarity, and Velocity Sensitivity (the controls that scale how much the VCF envelope affects cutoff)
- → [vca.md](vca.md) for VCA Level, Envelope Depth, and Velocity Sensitivity
- → [lfos.md](lfos.md) for LFO shapes and rates (when using LFO trigger modes)
- → [mod-matrix.md](mod-matrix.md) for routing the MOD envelope to destinations
- → [voice-config.md](voice-config.md) for global envelope trigger mode (Mono/Re-Trigger/Legato/One-Shot)

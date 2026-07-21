# Sound recipes — non-obvious DeepMind parameter interactions

Techniques that exploit DeepMind-specific behaviors. Use labels for
enum params (`set_param` with `label:`), normalized 0–1 for continuous.
Run `describe_param` to see valid labels for any param.

---

## Electro piano foundation patch

A subtractive analog approximation of electric piano character. OSC 2 hard sync with a high pitch offset simulates the metallic harmonic content of tines. The filter envelope provides the key attack-then-settle shape. This is a starting point for a family of sounds — bright/FM-flavored with filter open, mellower Rhodes-adjacent with it closed.

**Oscillators**

```
osc1.sawtooth     1 (on)
osc1.square       1 (on)
osc1.pwm          0.0          # 50% duty cycle — true square
osc1.pwmSource    label:"Manual"
osc1.range        label:"8'"
osc2.sync         1 (on)       # hard sync to OSC 1 — locks OSC 2 phase
osc2.pitch        0.68         # pitched well above OSC 1 to simulate tine harmonics
osc2.toneMod      0.70         # metallic pulse-insert character; key brightness control
osc2.level        0.85
osc2.range        label:"8'"
noise.level       0            # no noise for piano character
```

**Filter** — start closed and let the envelope do the work

```
filter.cutoff       0.22       # nearly closed; envelope sweeps from here
filter.hpfCutoff    0.0        # HPF off
filter.resonance    0.25       # slight resonance to add shimmer; raise for bell edge
filter.keyTracking  0.45       # higher notes open filter — mirrors real EP behavior
filter.envDepth     0.55       # filter envelope drives the brightness transient
filter.envPolarity  label:"Normal"
```

**VCA envelope** — instant attack, high decay, sustain lower than decay peak (the "steppy" shape)

```
env.amp.attack    0.0          # instant — keys sound immediately
env.amp.decay     0.68         # long fall to sustain
env.amp.sustain   0.50         # lower than implicit decay peak — sound settles after strike
env.amp.release   0.08         # very short — keys cut off cleanly
```

**VCF envelope** — mirrors VCA shape but with a small release tail

```
env.filter.attack   0.02       # nearly instant filter opening on strike
env.filter.decay    0.60       # filter closes through note hold
env.filter.sustain  0.30       # filter stays slightly open while held
env.filter.release  0.20       # brief brightness tail when key released
```

**Effects — serial chain (all four slots)**

```
FX1  T-RayDelay   mix ~0.15   # oil-can analog delay; ambience without wash
FX2  Chorus        mix ~0.70   # width and shimmer; swap for Phaser or Flanger for different flavor
FX3  AutoPan                   # gentle movement; keep rate slow
FX4  FairComp                  # tightens dynamics; makes quiet playing feel physical
```

**Velocity expression via mod matrix (all three add playing feel)**

```
Velocity → osc2.toneMod    depth ~+0.30   # harder strike = more metallic upper partials
Velocity → osc2.pitch      depth ~+0.15   # harder strike = slightly higher tine harmonic
Velocity → filter.cutoff   depth ~+0.25   # harder strike = brighter initial transient
```

**Tonal variations** — the key levers once the foundation is set

| Want more of…             | Adjust                                                                 |
|---------------------------|------------------------------------------------------------------------|
| Brightness / FM flavor    | Raise `filter.cutoff` and/or `filter.envDepth`                         |
| Mellow / Rhodes direction | Lower `osc2.pitch` and `filter.cutoff`; reduce `filter.envDepth`       |
| Tine character             | Raise `osc2.toneMod` or `osc2.pitch`; experiment with `osc2.sync` off |
| Attack punch               | Lower `env.amp.decay`; raise `filter.envDepth`                         |
| Longer resonant tail       | Raise `env.amp.release` and `env.filter.release`                       |
| Tremolo / vibrato          | Enable an LFO → filter cutoff or pitch at slow rate; use LFO delay     |
| Stereo width               | Swap FX2 Chorus for RotarySpkr or raise AutoPan depth                  |

Read: [oscillators.md](oscillators.md), [filter.md](filter.md), [envelopes.md](envelopes.md), [mod-matrix.md](mod-matrix.md), [effects/delays.md](effects/delays.md), [effects/creative.md](effects/creative.md), [effects/processing.md](effects/processing.md)

---

## Envelope as complex LFO (loop mode)

`env.amp.triggerMode` label `"Loop"` — envelope cycles ADR continuously, skipping sustain. Use asymmetric curve values (`attackCurve`, `decayCurve`, `releaseCurve`) to shape the cycling waveform into patterns no LFO can produce. All three envelopes support Loop independently.

Read: [envelopes.md](envelopes.md)

## Sustain slope — notes that evolve while held

`env.*.sustainCurve` — midpoint (0.5) is flat. Below 0.5 the level falls during sustain; above 0.5 it rises. Set amp sustain curve high + filter sustain curve low → note gets louder but darker while held. Per-envelope, so amp and filter can slope in opposite directions.

Read: [envelopes.md](envelopes.md)

## Keyboard-scaled envelope shape via mod matrix

Route Note Number → envelope curve params (SusCurve, EnvDepth). The envelope *shape* changes across the keyboard — low notes get falling sustain, high notes get rising sustain. Different from pitch/filter key tracking.

Read: [mod-matrix.md](mod-matrix.md)

## Envelope-driven oscillator crossfade

Route VCA Envelope → OSC 2 Level in mod matrix. OSC 2 presence follows the note lifecycle — fades in during attack, out during release. Use negative depth to invert (OSC 2 present at rest, fades out on note).

Read: [mod-matrix.md](mod-matrix.md), [oscillators.md](oscillators.md)

## Fixed-offset portamento

`portamento.mode` values 6–13 are fixed-interval slides — every note swoops from a set interval regardless of previous note. Not legato glides; they're built-in pitch transients. Pair with slow attack for organic pitch-rise effects.

Read: [voice-config.md](voice-config.md)

## Expression → OSC 2 pitch

Route Expression → OSC 2 Pitch in mod matrix with OSC 2 detuned low. Foot pedal sweeps OSC 2 through harmonic intervals in real time — from detuned sub rumble to unison lock.

Read: [mod-matrix.md](mod-matrix.md)

## Aftertouch → LFO rate

Route Pressure → LFO Rate in mod matrix. Harder press = faster LFO, not just deeper. The *character* of vibrato/filter wobble changes with finger pressure — more expressive than simple aftertouch→depth.

Read: [mod-matrix.md](mod-matrix.md), [lfos.md](lfos.md)

## Envelope → Tone Mod

Route VCA Envelope → TMod Depth in mod matrix. Tone Mod (DeepMind-unique) splits OSC 2's square wave with a pulse insert for metallic harmonics. Envelope routing makes that metallic character follow the note shape — FM-like attack transients without FM.

Read: [oscillators.md](oscillators.md), [mod-matrix.md](mod-matrix.md)

## Mod wheel → FX parameters

Mod matrix destinations include FX slot params (destinations 115+). Route Mod Wheel to FX parameters for real-time performance control over effect character.

Read: [mod-matrix.md](mod-matrix.md), [effects.md](effects.md)

## Delayed LFO onset

`lfo*.delayTime` — first 40% of range is silence, remaining 60% is fade-in. Stagger LFO 1 (short delay) and LFO 2 (long delay) to layer modulation that arrives at different points in the note.

Read: [lfos.md](lfos.md)

## Self-oscillating filter as 3rd oscillator

`filter.keyTracking` at max (1.0) + high resonance (>0.78). Filter tracks pitch 1:1 and self-oscillates into a pitch-accurate sine — a playable 3rd oscillator across the keyboard.

Read: [filter.md](filter.md)

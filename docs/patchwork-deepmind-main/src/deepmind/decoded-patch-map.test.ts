import { describe, expect, it } from 'vitest';
import { decodeDerivedFieldsFromEditBuffer, getDecodedFieldSpec } from './decoded-patch-map.js';

describe('decoded edit-buffer map', () => {
  it('includes TC Deep Reverb preset enum + UI metadata', () => {
    const preset = getDecodedFieldSpec('fx1.tcDeepRvrb.preset');
    expect(preset).toBeDefined();
    expect(preset?.ui?.abbr).toBe('PST');
    expect(preset?.ui?.name).toBe('Preset');
    expect(preset?.valueMap?.[1]).toBe('Church');

    const mix = getDecodedFieldSpec('fx1.tcDeepRvrb.mix');
    expect(mix).toBeDefined();
    expect(mix?.ui?.abbr).toBe('MIX');
    expect(mix?.ui?.name).toBe('Mix');
  });

  it('includes AmbVerb UI metadata', () => {
    const preDelay = getDecodedFieldSpec('fx1.ambVerb.preDelay');
    expect(preDelay).toBeDefined();
    expect(preDelay?.ui?.abbr).toBe('PD');
    expect(preDelay?.ui?.name).toBe('PreDelay');

    const damping = getDecodedFieldSpec('fx1.ambVerb.damping');
    expect(damping).toBeDefined();
    expect(damping?.ui?.abbr).toBe('DMP');
    expect(damping?.ui?.name).toBe('Damping');

    const tailGain = getDecodedFieldSpec('fx1.ambVerb.tailGain');
    expect(tailGain).toBeDefined();
    expect(tailGain?.ui?.abbr).toBe('TGN');
    expect(tailGain?.ui?.name).toBe('TailGain');
  });

  it('decodes NRPN 80 (VCA Level) at offset 80', () => {
    // Captured via MCP workflow:
    // - send_nrpn nrpn=80 value=0
    // - snapshot_state
    // - send_nrpn nrpn=80 value=255
    // - snapshot_state
    // Only decoded payload byte[80] changed: 0 -> 255.
    const vca0 = Buffer.from(
      'vgABAAAA/8aeAQAAAAABAgUCAAAA/waAgP/EWf//gIAGgIANAAABf39Df39//wF/f38BAQH/AAAAAQEBAQEBAQEBAAECAgICAgICBAJ/f38A/wDAAgACAAAKAAAACUCDBjyGDBYADCm4AhG5AACAAACAAACAAAkOAAIAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAJQAAIgBAAAABAYPKA4ZIjIPDyQZDQoODSYUAAcjJwggAgAyCiwRER4hJQovFAEGGBEBAWQBAAAAKAAZAGQ3lpaWAFZpYnJvIFBhZCBLQSAgICAAAoA=',
      'base64',
    );

    const vca255 = Buffer.from(
      'vgABAAAA/8aeAQAAAAABAgUCAAAA/waAgP/EWf//gIAGgIANAAABf39Df39//wF/f38BAQH/AAAAAQEBAQEBAQEBAAECAgICAgICBAJ/f3///wDAAgACAAAKAAAACUCDBjyGDBYADCm4AhG5AACAAACAAACAAAkOAAIAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAJQAAIgBAAAABAYPKA4ZIjIPDyQZDQoODSYUAAcjJwggAgAyCiwRER4hJQovFAEGGBEBAWQBAAAAKAAZAGQ3lpaWAFZpYnJvIFBhZCBLQSAgICAAAoA=',
      'base64',
    );

    expect(vca0.length).toBe(242);
    expect(vca255.length).toBe(242);

    const derived0 = decodeDerivedFieldsFromEditBuffer(vca0);
    const derived255 = decodeDerivedFieldsFromEditBuffer(vca255);

    expect(derived0['vca.level']?.raw).toBe(0);
    expect(derived255['vca.level']?.raw).toBe(255);
  });

  it('decodes NRPN 81 (VCA Envelope Depth) at offset 81', () => {
    const envDepth0 = Buffer.from(
      'vgABAAAA/8aeAQAAAAABAgUCAAAA/waAgP/EWf//gIAGgIANAAABf39Df39//wF/f38BAQH/AAAAAQEBAQEBAQEBAAECAgICAgICBAJ/f38AAADAAgACAAAKAAAACUCDBjyGDBYADCm4AhG5AACAAACAAACAAAkOAAIAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAJQAAIgBAAAABAYPKA4ZIjIPDyQZDQoODSYUAAcjJwggAgAyCiwRER4hJQovFAEGGBEBAWQBAAAAKAAZAGQ3lpaWAFZpYnJvIFBhZCBLQSAgICAAAoA=',
      'base64',
    );

    const envDepth255 = Buffer.from(
      'vgABAAAA/8aeAQAAAAABAgUCAAAA/waAgP/EWf//gIAGgIANAAABf39Df39//wF/f38BAQH/AAAAAQEBAQEBAQEBAAECAgICAgICBAJ/f38A/wDAAgACAAAKAAAACUCDBjyGDBYADCm4AhG5AACAAACAAACAAAkOAAIAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAJQAAIgBAAAABAYPKA4ZIjIPDyQZDQoODSYUAAcjJwggAgAyCiwRER4hJQovFAEGGBEBAWQBAAAAKAAZAGQ3lpaWAFZpYnJvIFBhZCBLQSAgICAAAoA=',
      'base64',
    );

    const derived0 = decodeDerivedFieldsFromEditBuffer(envDepth0);
    const derived255 = decodeDerivedFieldsFromEditBuffer(envDepth255);

    expect(derived0['vca.envDepth']?.raw).toBe(0);
    expect(derived255['vca.envDepth']?.raw).toBe(255);
  });

  it('decodes NRPN 82 (VCA Envelope Velocity Sensitivity) at offset 82', () => {
    const vel0 = Buffer.from(
      'vgABAAAA/8aeAQAAAAABAgUCAAAA/waAgP/EWf//gIAGgIANAAABf39Df39//wF/f38BAQH/AAAAAQEBAQEBAQEBAAECAgICAgICBAJ/f38AAADAAgACAAAKAAAACUCDBjyGDBYADCm4AhG5AACAAACAAACAAAkOAAIAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAJQAAIgBAAAABAYPKA4ZIjIPDyQZDQoODSYUAAcjJwggAgAyCiwRER4hJQovFAEGGBEBAWQBAAAAKAAZAGQ3lpaWAFZpYnJvIFBhZCBLQSAgICAAAoA=',
      'base64',
    );

    const vel255 = Buffer.from(
      'vgABAAAA/8aeAQAAAAABAgUCAAAA/waAgP/EWf//gIAGgIANAAABf39Df39//wF/f38BAQH/AAAAAQEBAQEBAQEBAAECAgICAgICBAJ/f38AAP/AAgACAAAKAAAACUCDBjyGDBYADCm4AhG5AACAAACAAACAAAkOAAIAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAJQAAIgBAAAABAYPKA4ZIjIPDyQZDQoODSYUAAcjJwggAgAyCiwRER4hJQovFAEGGBEBAWQBAAAAKAAZAGQ3lpaWAFZpYnJvIFBhZCBLQSAgICAAAoA=',
      'base64',
    );

    const derived0 = decodeDerivedFieldsFromEditBuffer(vel0);
    const derived255 = decodeDerivedFieldsFromEditBuffer(vel255);

    expect(derived0['vca.envVelocity']?.raw).toBe(0);
    expect(derived255['vca.envVelocity']?.raw).toBe(255);
  });

  it('decodes NRPN 83 (VCA Pan Spread) at offset 83 (bipolar display)', () => {
    const pan0 = Buffer.from(
      'vgABAAAA/8aeAQAAAAABAgUCAAAA/waAgP/EWf//gIAGgIANAAABf39Df39//wF/f38BAQH/AAAAAQEBAQEBAQEBAAECAgICAgICBAJ/f38AAP8AAgACAAAKAAAACUCDBjyGDBYADCm4AhG5AACAAACAAACAAAkOAAIAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAJQAAIgBAAAABAYPKA4ZIjIPDyQZDQoODSYUAAcjJwggAgAyCiwRER4hJQovFAEGGBEBAWQBAAAAKAAZAGQ3lpaWAFZpYnJvIFBhZCBLQSAgICAAAoA=',
      'base64',
    );

    const pan255 = Buffer.from(
      'vgABAAAA/8aeAQAAAAABAgUCAAAA/waAgP/EWf//gIAGgIANAAABf39Df39//wF/f38BAQH/AAAAAQEBAQEBAQEBAAECAgICAgICBAJ/f38AAP//AgACAAAKAAAACUCDBjyGDBYADCm4AhG5AACAAACAAACAAAkOAAIAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAJQAAIgBAAAABAYPKA4ZIjIPDyQZDQoODSYUAAcjJwggAgAyCiwRER4hJQovFAEGGBEBAWQBAAAAKAAZAGQ3lpaWAFZpYnJvIFBhZCBLQSAgICAAAoA=',
      'base64',
    );

    const derived0 = decodeDerivedFieldsFromEditBuffer(pan0);
    const derived255 = decodeDerivedFieldsFromEditBuffer(pan255);

    expect(derived0['vca.panSpread']?.raw).toBe(0);
    expect(derived255['vca.panSpread']?.raw).toBe(255);

    // UI/display conversion: -128..+127
    expect((derived0['vca.panSpread']?.raw ?? 0) - 128).toBe(-128);
    expect((derived255['vca.panSpread']?.raw ?? 0) - 128).toBe(127);
  });
});

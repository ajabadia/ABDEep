import { describe, expect, it } from 'vitest';

import { handleDescribeParam } from './handlers.js';

describe('describe_param', () => {
  it('returns enum values for mod matrix source', async () => {
    const result = await handleDescribeParam({ param: 'modMatrix.1.source' });

    expect(result.success).toBe(true);
    expect(result.resolvedParam).toBe('modMatrix.1.source');
    expect(result.enum?.values.find((v) => v.value === 7)?.label).toBe('LFO 1');
  });

  it('now includes paramSpec for all decoded params', async () => {
    const result = await handleDescribeParam({ param: 'modMatrix.1.source' });

    expect(result.success).toBe(true);
    expect(result.paramSpec).toBeDefined();
    expect(result.paramSpec?.nrpn).toEqual({ msb: 0, lsb: 93 });
    expect(result.decodedField).toBeDefined();
  });

  it('resolves aliases and returns NRPN address when known', async () => {
    const result = await handleDescribeParam({ param: 'vcf.cutoff' });

    expect(result.success).toBe(true);
    expect(result.resolvedParam).toBe('filter.cutoff');
    expect(result.paramSpec?.nrpn).toEqual({ msb: 0, lsb: 39 });
  });

  it('returns decoded UI + units/ranges for AmbVerb params', async () => {
    const result = await handleDescribeParam({ param: 'fx1.ambVerb.preDelay' });

    expect(result.success).toBe(true);
    expect(result.paramSpec).toBeDefined();
    expect(result.paramSpec?.nrpn).toEqual({ msb: 1, lsb: 39 });
    expect(result.decodedField?.kind).toBe('u8');
    expect(result.decodedField?.rawMin).toBe(0);
    expect(result.decodedField?.rawMax).toBe(255);
    expect(result.decodedField?.ui?.abbr).toBe('PD');
    expect(result.decodedField?.value).toMatchObject({ units: 'ms', min: 0, max: 200 });
  });

  it('returns decoded UI, ranges, and notes for GatedRev params', async () => {
    const result = await handleDescribeParam({ param: 'fx1.gatedRev.hiSvGain' });

    expect(result.success).toBe(true);
    expect(result.paramSpec).toBeDefined();
    expect(result.decodedField?.ui?.abbr).toBe('HIG');
    expect(result.decodedField?.ui?.name).toBe('HiSvGain');
    expect(result.decodedField?.value).toMatchObject({ units: 'dB', min: -30, max: 0, modDestination: true });
    expect(result.decodedField?.notes).toContain('Hi-Shelving filter');
  });

  it('returns decoded UI, ranges, and notes for ReverseRev params', async () => {
    const result = await handleDescribeParam({ param: 'fx1.reverseRev.rise' });

    expect(result.success).toBe(true);
    expect(result.paramSpec).toBeDefined();
    expect(result.decodedField?.ui?.abbr).toBe('RIS');
    expect(result.decodedField?.ui?.name).toBe('Rise');
    expect(result.decodedField?.value).toMatchObject({ min: 0, max: 50, modDestination: true });
    expect(result.decodedField?.notes).toContain('builds up');
  });

  it('returns RotarySpkr numeric metadata and enum states from the manual', async () => {
    const [loSpeedResult, motorResult, speedResult] = await Promise.all([
      handleDescribeParam({ param: 'fx1.rotarySpkr.loSpeed' }),
      handleDescribeParam({ param: 'fx1.rotarySpkr.motor' }),
      handleDescribeParam({ param: 'fx1.rotarySpkr.speed' }),
    ]);

    expect(loSpeedResult.success).toBe(true);
    expect(loSpeedResult.decodedField?.ui?.abbr).toBe('LOS');
    expect(loSpeedResult.decodedField?.value).toMatchObject({ units: 'Hz', min: 0.1, max: 4, modDestination: true });
    expect(loSpeedResult.decodedField?.notes).toContain('Low Speed operation');

    expect(motorResult.success).toBe(true);
    expect(motorResult.decodedField?.ui?.abbr).toBe('MOT');
    expect(motorResult.decodedField?.value?.modDestination).toBe(true);
    expect(motorResult.enum?.values).toEqual([
      { value: 0, label: 'RUN' },
      { value: 1, label: 'STOP' },
    ]);

    expect(speedResult.success).toBe(true);
    expect(speedResult.decodedField?.ui?.abbr).toBe('SPD');
    expect(speedResult.decodedField?.value?.modDestination).toBe(true);
    expect(speedResult.enum?.values).toEqual([
      { value: 0, label: 'SLOW' },
      { value: 1, label: 'FAST' },
    ]);
  });

  it('returns Delay metadata including mode and factor enums from the manual', async () => {
    const [timeResult, modeResult, factorResult] = await Promise.all([
      handleDescribeParam({ param: 'fx1.delay.time' }),
      handleDescribeParam({ param: 'fx1.delay.mode' }),
      handleDescribeParam({ param: 'fx1.delay.factorL' }),
    ]);

    expect(timeResult.success).toBe(true);
    expect(timeResult.decodedField?.ui?.abbr).toBe('TIM');
    expect(timeResult.decodedField?.value).toMatchObject({ units: 'ms', min: 1, max: 1500 });
    expect(timeResult.enum?.count).toBe(20);
    expect(timeResult.enum?.values.find((v) => v.value === 0)?.label).toBe('4');
    expect(timeResult.enum?.values.find((v) => v.value === 7)?.label).toBe('1/4');
    expect(timeResult.enum?.values.find((v) => v.value === 17)?.label).toBe('3/128');
    expect(timeResult.enum?.values.find((v) => v.value === 19)?.label).toBe('1/64');
    expect(timeResult.decodedField?.notes).toContain('raw values 0..19');
    expect(timeResult.decodedField?.notes).toContain('millisecond region');

    expect(modeResult.success).toBe(true);
    expect(modeResult.decodedField?.ui?.abbr).toBe('MOD');
    expect(modeResult.enum?.values).toEqual([
      { value: 0, label: 'ST' },
      { value: 1, label: 'X' },
      { value: 2, label: 'M' },
      { value: 3, label: 'P-P' },
    ]);
    expect(modeResult.decodedField?.notes).toContain('ping pong');

    expect(factorResult.success).toBe(true);
    expect(factorResult.decodedField?.ui?.abbr).toBe('FCL');
    expect(factorResult.enum?.values).toEqual([
      { value: 0, label: '1/4' },
      { value: 1, label: '3/8' },
      { value: 2, label: '1/2' },
      { value: 3, label: '2/3' },
      { value: 4, label: '1' },
      { value: 5, label: '4/3' },
      { value: 6, label: '3/2' },
      { value: 7, label: '2' },
      { value: 8, label: '3' },
    ]);
    expect(factorResult.decodedField?.notes).toContain('rhythmic fractions');
  });

  it('returns 3-Tap Delay metadata including factor and x-feed enums from the manual', async () => {
    const [timeResult, factorResult, xFeedResult] = await Promise.all([
      handleDescribeParam({ param: 'fx1.threeTapDelay.time' }),
      handleDescribeParam({ param: 'fx1.threeTapDelay.factorA' }),
      handleDescribeParam({ param: 'fx1.threeTapDelay.x-feed' }),
    ]);

    expect(timeResult.success).toBe(true);
    expect(timeResult.decodedField?.ui?.abbr).toBe('TIM');
    expect(timeResult.decodedField?.value).toMatchObject({ units: 'ms', min: 1, max: 1500 });
  expect(timeResult.enum?.count).toBe(20);
  expect(timeResult.enum?.values.find((v) => v.value === 0)?.label).toBe('4');
  expect(timeResult.enum?.values.find((v) => v.value === 7)?.label).toBe('1/4');
  expect(timeResult.enum?.values.find((v) => v.value === 17)?.label).toBe('3/128');
  expect(timeResult.enum?.values.find((v) => v.value === 19)?.label).toBe('1/64');
  expect(timeResult.decodedField?.notes).toContain('raw values 0..19');
  expect(timeResult.decodedField?.notes).toContain('millisecond region');

    expect(factorResult.success).toBe(true);
    expect(factorResult.decodedField?.ui?.abbr).toBe('FCA');
    expect(factorResult.enum?.values).toEqual([
      { value: 0, label: '1/4' },
      { value: 1, label: '3/8' },
      { value: 2, label: '1/2' },
      { value: 3, label: '2/3' },
      { value: 4, label: '1' },
      { value: 5, label: '4/3' },
      { value: 6, label: '3/2' },
      { value: 7, label: '2' },
      { value: 8, label: '3' },
    ]);
    expect(factorResult.decodedField?.notes).toContain('second stage');

    expect(xFeedResult.success).toBe(true);
    expect(xFeedResult.decodedField?.ui?.abbr).toBe('XFD');
    expect(xFeedResult.enum?.values).toEqual([
      { value: 0, label: 'OFF' },
      { value: 1, label: 'ON' },
    ]);
    expect(xFeedResult.decodedField?.notes).toContain('cross-feedback');
  });

  it('returns 4-Tap Delay metadata including factor and x-feed enums from the manual', async () => {
    const [timeResult, factorResult, xFeedResult] = await Promise.all([
      handleDescribeParam({ param: 'fx1.fourTapDelay.time' }),
      handleDescribeParam({ param: 'fx1.fourTapDelay.factorC' }),
      handleDescribeParam({ param: 'fx1.fourTapDelay.x-feed' }),
    ]);

    expect(timeResult.success).toBe(true);
    expect(timeResult.decodedField?.ui?.abbr).toBe('TIM');
    expect(timeResult.decodedField?.value).toMatchObject({ units: 'ms', min: 1, max: 1500 });
    expect(timeResult.decodedField?.notes).toContain('Time synchronised options from 4 to 1/64 bars.');

    expect(factorResult.success).toBe(true);
    expect(factorResult.decodedField?.ui?.abbr).toBe('FCC');
    expect(factorResult.enum?.values).toEqual([
      { value: 0, label: '1/4' },
      { value: 1, label: '3/8' },
      { value: 2, label: '1/2' },
      { value: 3, label: '2/3' },
      { value: 4, label: '1' },
      { value: 5, label: '4/3' },
      { value: 6, label: '3/2' },
      { value: 7, label: '2' },
      { value: 8, label: '3' },
    ]);
    expect(factorResult.decodedField?.notes).toContain('fourth stage');

    expect(xFeedResult.success).toBe(true);
    expect(xFeedResult.decodedField?.ui?.abbr).toBe('XFD');
    expect(xFeedResult.enum?.values).toEqual([
      { value: 0, label: 'OFF' },
      { value: 1, label: 'ON' },
    ]);
    expect(xFeedResult.decodedField?.notes).toContain('cross-feedback');
  });

  it('returns T-Ray Delay metadata from the manual', async () => {
    const result = await handleDescribeParam({ param: 'fx1.tRayDelay.sustain' });

    expect(result.success).toBe(true);
    expect(result.decodedField?.ui?.abbr).toBe('SUS');
    expect(result.decodedField?.ui?.name).toBe('Sustain');
    expect(result.decodedField?.value).toMatchObject({ units: '%', min: 0, max: 100, modDestination: true });
    expect(result.decodedField?.notes).toContain('100% build up will occur');
  });

  it('returns Decim Delay metadata including factor, type, and decimate enums from the manual', async () => {
    const [factorResult, typeResult, decimateResult] = await Promise.all([
      handleDescribeParam({ param: 'fx1.decimDelay.factorL' }),
      handleDescribeParam({ param: 'fx1.decimDelay.type' }),
      handleDescribeParam({ param: 'fx1.decimDelay.decimate' }),
    ]);

    expect(factorResult.success).toBe(true);
    expect(factorResult.decodedField?.ui?.abbr).toBe('FCL');
    expect(factorResult.enum?.values).toEqual([
      { value: 0, label: '1/4' },
      { value: 1, label: '3/8' },
      { value: 2, label: '1/2' },
      { value: 3, label: '2/3' },
      { value: 4, label: '1' },
      { value: 5, label: '4/3' },
      { value: 6, label: '3/2' },
      { value: 7, label: '2' },
      { value: 8, label: '3' },
    ]);

    expect(typeResult.success).toBe(true);
    expect(typeResult.decodedField?.ui?.abbr).toBe('FLT');
    expect(typeResult.enum?.values).toEqual([
      { value: 0, label: 'Lowpass' },
      { value: 1, label: 'Highpass' },
      { value: 2, label: 'Bandpass' },
      { value: 3, label: 'Notch' },
    ]);
    expect(typeResult.decodedField?.notes).toContain('filter type');

    expect(decimateResult.success).toBe(true);
    expect(decimateResult.decodedField?.ui?.abbr).toBe('DMT');
    expect(decimateResult.enum?.values).toEqual([
      { value: 0, label: 'PRE' },
      { value: 1, label: 'POST' },
    ]);
    expect(decimateResult.decodedField?.notes).toContain('input signal');
  });

  it('returns decoded units/ranges for TC Deep Reverb params', async () => {
    const result = await handleDescribeParam({ param: 'fx1.tcDeepRvrb.tone' });

    expect(result.success).toBe(true);
    expect(result.decodedField?.ui?.abbr).toBe('TON');
    expect(result.decodedField?.value).toMatchObject({ units: '%', min: -50, max: 50, modDestination: true });
  });

  it('returns enum options for TC Deep Reverb preset', async () => {
    const result = await handleDescribeParam({ param: 'fx1.tcDeepRvrb.preset' });

    expect(result.success).toBe(true);
    expect(result.decodedField?.ui?.abbr).toBe('PST');
    expect(result.enum?.count).toBeGreaterThanOrEqual(11);
    expect(result.enum?.values.find((v) => v.value === 1)?.label).toBe('Church');
    expect(result.enum?.values.find((v) => v.value === 3)?.label).toBe('Hall');
    expect(result.enum?.values.find((v) => v.value === 10)?.label).toBe('Default');
  });

  it('returns NoiseGate numeric metadata and enums from the manual', async () => {
    const thresholdResult = await handleDescribeParam({ param: 'fx1.noiseGate.threshold' });
    const modeResult = await handleDescribeParam({ param: 'fx1.noiseGate.mode' });
    const powerResult = await handleDescribeParam({ param: 'fx1.noiseGate.power' });

    expect(thresholdResult.success).toBe(true);
    expect(thresholdResult.decodedField?.ui?.abbr).toBe('THR');
    expect(thresholdResult.decodedField?.ui?.name).toBe('Threshold');
    expect(thresholdResult.decodedField?.value).toMatchObject({
      units: 'dB',
      min: -50,
      max: 0,
      modDestination: true,
    });
    expect(thresholdResult.decodedField?.notes).toContain('gate opens');

    expect(modeResult.success).toBe(true);
    expect(modeResult.decodedField?.ui?.abbr).toBe('MOD');
    expect(modeResult.enum?.values).toEqual([
      { value: 0, label: 'GAT' },
      { value: 1, label: 'TRN' },
      { value: 2, label: 'DUC' },
    ]);
    expect(modeResult.decodedField?.notes).toContain('Transient Gate');

    expect(powerResult.success).toBe(true);
    expect(powerResult.decodedField?.ui?.abbr).toBe('PWR');
    expect(powerResult.enum?.values).toEqual([
      { value: 0, label: 'ON' },
      { value: 1, label: 'OFF' },
    ]);
    expect(powerResult.decodedField?.notes).toContain('bypassed');
  });

  it('returns MidasEQ numeric metadata and EQ enum from the manual', async () => {
    const qResult = await handleDescribeParam({ param: 'fx1.midasEQ.loMidQ' });
    const eqResult = await handleDescribeParam({ param: 'fx1.midasEQ.eq' });

    expect(qResult.success).toBe(true);
    expect(qResult.decodedField?.ui?.abbr).toBe('LMQ');
    expect(qResult.decodedField?.ui?.name).toBe('LoMidQ');
    expect(qResult.decodedField?.value).toMatchObject({
      min: 0.3,
      max: 5.0,
      modDestination: true,
    });
    expect(qResult.decodedField?.notes).toContain('Q-factor');

    expect(eqResult.success).toBe(true);
    expect(eqResult.decodedField?.ui?.abbr).toBe('EQ');
    expect(eqResult.enum?.values).toEqual([
      { value: 0, label: 'IN' },
      { value: 1, label: 'OUT' },
    ]);
    expect(eqResult.decodedField?.value?.modDestination).toBe(true);
    expect(eqResult.decodedField?.notes).toContain('copy/paste error');
  });

  it('returns FairComp numeric metadata and mode enum from the manual', async () => {
    const modeResult = await handleDescribeParam({ param: 'fx1.fairComp.mode' });
    const biasResult = await handleDescribeParam({ param: 'fx1.fairComp.dcBiasLM' });
    const timeResult = await handleDescribeParam({ param: 'fx1.fairComp.timeRS' });

    expect(modeResult.success).toBe(true);
    expect(modeResult.decodedField?.ui?.abbr).toBe('MOD');
    expect(modeResult.enum?.values).toEqual([
      { value: 0, label: 'OFF' },
      { value: 1, label: 'ST' },
      { value: 2, label: 'DUA' },
      { value: 3, label: 'M/S' },
    ]);
    expect(modeResult.decodedField?.notes).toContain('Mid/Side');

    expect(biasResult.success).toBe(true);
    expect(biasResult.decodedField?.ui?.abbr).toBe('DCL');
    expect(biasResult.decodedField?.value).toMatchObject({
      units: '%',
      min: 0,
      max: 100,
      modDestination: true,
    });
    expect(biasResult.decodedField?.notes).toContain('compression curve');

    expect(timeResult.success).toBe(true);
    expect(timeResult.decodedField?.ui?.abbr).toBe('TMR');
    expect(timeResult.decodedField?.value).toMatchObject({
      min: 1,
      max: 6,
    });
    expect(timeResult.decodedField?.value?.modDestination).toBeUndefined();
    expect(timeResult.decodedField?.notes).toContain('attack and release time');
  });

  it('returns MulBndDist numeric metadata and enums from the manual', async () => {
    const typeResult = await handleDescribeParam({ param: 'fx1.mulBndDist.distType' });
    const cabinetResult = await handleDescribeParam({ param: 'fx1.mulBndDist.cabinet' });
    const highBandResult = await handleDescribeParam({ param: 'fx1.mulBndDist.hiBandLev' });

    expect(typeResult.success).toBe(true);
    expect(typeResult.decodedField?.ui?.abbr).toBe('DST');
    expect(typeResult.enum?.values).toEqual([
      { value: 0, label: 'valve' },
      { value: 1, label: 'saturate' },
      { value: 2, label: 'tube' },
      { value: 3, label: 'postfiltval' },
      { value: 4, label: 'postfiltsat' },
      { value: 5, label: 'postfilttub' },
    ]);
    expect(typeResult.decodedField?.notes).toContain('post-filter');

    expect(cabinetResult.success).toBe(true);
    expect(cabinetResult.decodedField?.ui?.abbr).toBe('CAB');
    expect(cabinetResult.enum?.count).toBe(12);
    expect(cabinetResult.enum?.values.find((v) => v.value === 0)?.label).toBe('OFF');
    expect(cabinetResult.enum?.values.find((v) => v.value === 3)?.label).toBe('A10');
    expect(cabinetResult.enum?.values.find((v) => v.value === 11)?.label).toBe('Rck');

    expect(highBandResult.success).toBe(true);
    expect(highBandResult.decodedField?.ui?.abbr).toBe('HBL');
    expect(highBandResult.decodedField?.value).toMatchObject({
      units: 'dB',
      min: -12,
      max: 12,
      modDestination: true,
    });
    expect(highBandResult.decodedField?.notes).toContain('above XoverFreq2');
    expect(highBandResult.decodedField?.notes).toContain('typo');
  });

  it('returns decoded UI + units/ranges for VintageRev numeric params', async () => {
    const result = await handleDescribeParam({ param: 'fx1.vintageRev.decay' });

    expect(result.success).toBe(true);
    expect(result.paramSpec).toBeDefined();
    expect(result.paramSpec?.nrpn).toEqual({ msb: 1, lsb: 41 });
    expect(result.decodedField?.kind).toBe('u8');
    expect(result.decodedField?.rawMin).toBe(0);
    expect(result.decodedField?.rawMax).toBe(255);
    expect(result.decodedField?.ui?.abbr).toBe('DCY');
    expect(result.decodedField?.ui?.name).toBe('Decay');
    expect(result.decodedField?.value).toMatchObject({
      units: 's',
      min: 0.1,
      max: 20.7,
      modDestination: true,
    });
  });

  it('returns enum options for VintageRev freeze param', async () => {
    const result = await handleDescribeParam({ param: 'fx1.vintageRev.freeze' });

    expect(result.success).toBe(true);
    expect(result.decodedField?.ui?.abbr).toBe('FRZ');
    expect(result.decodedField?.value?.modDestination).toBe(true);
    expect(result.enum?.count).toBe(2);
    expect(result.enum?.values.find((v) => v.value === 0)?.label).toBe('OFF');
    expect(result.enum?.values.find((v) => v.value === 1)?.label).toBe('ON');
  });

  it('returns DelayVerb pattern enum and manual metadata', async () => {
    const result = await handleDescribeParam({ param: 'fx1.delayVerb.pattern' });

    expect(result.success).toBe(true);
    expect(result.decodedField?.ui?.abbr).toBe('PAT');
    expect(result.decodedField?.ui?.name).toBe('Pattern');
    expect(result.enum?.count).toBe(14);
    expect(result.enum?.values.find((v) => v.value === 0)?.label).toBe('1/4');
    expect(result.enum?.values.find((v) => v.value === 6)?.label).toBe('1');
    expect(result.enum?.values.find((v) => v.value === 13)?.label).toBe('1X');
  });

  it('returns FlangVerb numeric metadata from the manual', async () => {
    const result = await handleDescribeParam({ param: 'fx1.flangVerb.feed' });

    expect(result.success).toBe(true);
    expect(result.decodedField?.ui?.abbr).toBe('FBK');
    expect(result.decodedField?.ui?.name).toBe('Feed');
    expect(result.decodedField?.value).toMatchObject({
      units: '%',
      min: -90,
      max: 90,
      modDestination: true,
    });
  });

  it('returns FlangVerb speed sync labels for the confirmed low-end lookup block', async () => {
    const result = await handleDescribeParam({ param: 'fx1.flangVerb.speed' });

    expect(result.success).toBe(true);
    expect(result.decodedField?.ui?.abbr).toBe('SPD');
    expect(result.decodedField?.value).toMatchObject({
      units: 'Hz',
      min: 0,
      max: 4,
      modDestination: true,
    });
    expect(result.enum?.count).toBe(20);
    expect(result.enum?.values.find((v) => v.value === 0)?.label).toBe('4');
    expect(result.enum?.values.find((v) => v.value === 7)?.label).toBe('1/4');
    expect(result.enum?.values.find((v) => v.value === 17)?.label).toBe('3/128');
    expect(result.enum?.values.find((v) => v.value === 19)?.label).toBe('1/64');
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 20)).toMatchObject({
      rawMin: 20,
      rawMax: 32,
      label: '0.0',
    });
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 93)).toMatchObject({
      rawMin: 93,
      rawMax: 93,
      label: '2.7',
    });
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 100)).toMatchObject({
      rawMin: 100,
      rawMax: 100,
      label: '4.0',
    });
    expect(result.decodedField?.notes).toContain('raw values 0..19');
  });

  it('returns Chorus manual metadata and confirmed sync labels', async () => {
    const result = await handleDescribeParam({ param: 'fx1.chorus.speed' });

    expect(result.success).toBe(true);
    expect(result.decodedField?.ui?.abbr).toBe('SPD');
    expect(result.decodedField?.ui?.name).toBe('Speed');
    expect(result.decodedField?.value).toMatchObject({
      units: 'Hz',
      min: 0,
      max: 5,
      modDestination: true,
    });
    expect(result.enum?.count).toBe(20);
    expect(result.enum?.values.find((v) => v.value === 0)?.label).toBe('4');
    expect(result.enum?.values.find((v) => v.value === 7)?.label).toBe('1/4');
    expect(result.enum?.values.find((v) => v.value === 17)?.label).toBe('3/128');
    expect(result.enum?.values.find((v) => v.value === 19)?.label).toBe('1/64');
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 20)).toMatchObject({
      rawMin: 20,
      rawMax: 32,
      label: '0.0',
    });
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 73)).toMatchObject({
      rawMin: 73,
      rawMax: 73,
      label: '1.0',
    });
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 96)).toMatchObject({
      rawMin: 96,
      rawMax: 96,
      label: '3.9',
    });
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 100)).toMatchObject({
      rawMin: 100,
      rawMax: 100,
      label: '5.0',
    });
    expect(result.decodedField?.notes).toContain('raw values 0..19');
    expect(result.decodedField?.notes).toContain('from 4 down to 1/64');
    expect(result.decodedField?.notes).toContain('raw 20..100');
  });

  it('returns Flanger metadata using the confirmed Chorus-equivalent speed mapping', async () => {
    const result = await handleDescribeParam({ param: 'fx1.flanger.speed' });

    expect(result.success).toBe(true);
    expect(result.decodedField?.ui?.abbr).toBe('SPD');
    expect(result.decodedField?.ui?.name).toBe('Speed');
    expect(result.decodedField?.value).toMatchObject({
      units: 'Hz',
      min: 0,
      max: 5,
      modDestination: true,
    });
    expect(result.enum?.count).toBe(20);
    expect(result.enum?.values.find((v) => v.value === 0)?.label).toBe('4');
    expect(result.enum?.values.find((v) => v.value === 7)?.label).toBe('1/4');
    expect(result.enum?.values.find((v) => v.value === 17)?.label).toBe('3/128');
    expect(result.enum?.values.find((v) => v.value === 19)?.label).toBe('1/64');
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 20)).toMatchObject({
      rawMin: 20,
      rawMax: 32,
      label: '0.0',
    });
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 73)).toMatchObject({
      rawMin: 73,
      rawMax: 73,
      label: '1.0',
    });
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 100)).toMatchObject({
      rawMin: 100,
      rawMax: 100,
      label: '5.0',
    });
    expect(result.decodedField?.notes).toContain('same mixed-mode mapping as Chorus');
    expect(result.decodedField?.notes).toContain('raw 20..100');
  });

  it('returns Phaser metadata using the confirmed Chorus-equivalent speed mapping', async () => {
    const result = await handleDescribeParam({ param: 'fx1.phaser.speed' });

    expect(result.success).toBe(true);
    expect(result.decodedField?.ui?.abbr).toBe('SPD');
    expect(result.decodedField?.ui?.name).toBe('Speed');
    expect(result.decodedField?.value).toMatchObject({
      units: 'Hz',
      min: 0,
      max: 5,
      modDestination: true,
    });
    expect(result.enum?.count).toBe(20);
    expect(result.enum?.values.find((v) => v.value === 0)?.label).toBe('4');
    expect(result.enum?.values.find((v) => v.value === 7)?.label).toBe('1/4');
    expect(result.enum?.values.find((v) => v.value === 17)?.label).toBe('3/128');
    expect(result.enum?.values.find((v) => v.value === 19)?.label).toBe('1/64');
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 20)).toMatchObject({
      rawMin: 20,
      rawMax: 32,
      label: '0.0',
    });
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 73)).toMatchObject({
      rawMin: 73,
      rawMax: 73,
      label: '1.0',
    });
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 100)).toMatchObject({
      rawMin: 100,
      rawMax: 100,
      label: '5.0',
    });
    expect(result.decodedField?.notes).toContain('same mixed-mode mapping as Chorus');
    expect(result.decodedField?.notes).toContain('raw 20..100');
  });

  it('returns Auto Pan metadata using the confirmed Chorus-equivalent speed mapping', async () => {
    const result = await handleDescribeParam({ param: 'fx1.autoPan.speed' });

    expect(result.success).toBe(true);
    expect(result.decodedField?.ui?.abbr).toBe('SPD');
    expect(result.decodedField?.ui?.name).toBe('Speed');
    expect(result.decodedField?.value).toMatchObject({
      units: 'Hz',
      min: 0,
      max: 5,
      modDestination: true,
    });
    expect(result.enum?.count).toBe(20);
    expect(result.enum?.values.find((v) => v.value === 0)?.label).toBe('4');
    expect(result.enum?.values.find((v) => v.value === 7)?.label).toBe('1/4');
    expect(result.enum?.values.find((v) => v.value === 17)?.label).toBe('3/128');
    expect(result.enum?.values.find((v) => v.value === 19)?.label).toBe('1/64');
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 20)).toMatchObject({
      rawMin: 20,
      rawMax: 32,
      label: '0.0',
    });
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 73)).toMatchObject({
      rawMin: 73,
      rawMax: 73,
      label: '1.0',
    });
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 100)).toMatchObject({
      rawMin: 100,
      rawMax: 100,
      label: '5.0',
    });
    expect(result.decodedField?.notes).toContain('same mixed-mode mapping as Chorus');
    expect(result.decodedField?.notes).toContain('raw 20..100');
  });

  it('returns Mood Filter metadata using its distinct 20.0 Hz speed mapping', async () => {
    const result = await handleDescribeParam({ param: 'fx1.moodFilter.speed' });

    expect(result.success).toBe(true);
    expect(result.decodedField?.ui?.abbr).toBe('SPD');
    expect(result.decodedField?.ui?.name).toBe('Speed');
    expect(result.decodedField?.value).toMatchObject({
      units: 'Hz',
      min: 0,
      max: 20,
    });
    expect(result.decodedField?.value?.modDestination).toBeUndefined();
    expect(result.enum?.count).toBe(20);
    expect(result.enum?.values.find((v) => v.value === 0)?.label).toBe('4');
    expect(result.enum?.values.find((v) => v.value === 7)?.label).toBe('1/4');
    expect(result.enum?.values.find((v) => v.value === 17)?.label).toBe('3/128');
    expect(result.enum?.values.find((v) => v.value === 19)?.label).toBe('1/64');
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 20)).toMatchObject({
      rawMin: 20,
      rawMax: 29,
      label: '0.0',
    });
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 60)).toMatchObject({
      rawMin: 60,
      rawMax: 61,
      label: '1.0',
    });
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 83)).toMatchObject({
      rawMin: 83,
      rawMax: 83,
      label: '5.5',
    });
    expect(result.decodedField?.value?.displayBuckets?.find((bucket) => bucket.rawMin === 100)).toMatchObject({
      rawMin: 100,
      rawMax: 100,
      label: '20.0',
    });
    expect(result.decodedField?.notes).toContain('same raw 0..19 synchronized bar settings');
    expect(result.decodedField?.notes).toContain('up to 20.0 Hz');
  });

  it('returns Mood Filter categorical enums for type, wave, and poles', async () => {
    const [typeResult, waveResult, polesResult] = await Promise.all([
      handleDescribeParam({ param: 'fx1.moodFilter.type' }),
      handleDescribeParam({ param: 'fx1.moodFilter.wave' }),
      handleDescribeParam({ param: 'fx1.moodFilter.poles' }),
    ]);

    expect(typeResult.success).toBe(true);
    expect(typeResult.enum?.values).toEqual([
      { value: 0, label: 'Lowpass' },
      { value: 1, label: 'Highpass' },
      { value: 2, label: 'Bandpass' },
      { value: 3, label: 'Notch' },
    ]);
    expect(typeResult.decodedField?.notes).toContain('Lowpass, Highpass, Bandpass, or Notch');

    expect(waveResult.success).toBe(true);
    expect(waveResult.enum?.values).toEqual([
      { value: 0, label: 'Triangle' },
      { value: 1, label: 'Sine' },
      { value: 2, label: 'Saw+' },
      { value: 3, label: 'Saw-' },
      { value: 4, label: 'Ramp' },
      { value: 5, label: 'Square' },
      { value: 6, label: 'Random' },
    ]);
    expect(waveResult.decodedField?.notes).toContain('Saw Up');
    expect(waveResult.decodedField?.notes).toContain('Saw Down');

    expect(polesResult.success).toBe(true);
    expect(polesResult.enum?.values).toEqual([
      { value: 0, label: '2P' },
      { value: 1, label: '4P' },
    ]);
    expect(polesResult.decodedField?.notes).toContain('2-pole to 4-pole');
  });

  it('returns Mood Filter manual-backed notes for the remaining numeric params', async () => {
    const [depthResult, baseFreqResult, envModResult, driveResult] = await Promise.all([
      handleDescribeParam({ param: 'fx1.moodFilter.depth' }),
      handleDescribeParam({ param: 'fx1.moodFilter.base freq' }),
      handleDescribeParam({ param: 'fx1.moodFilter.envMod' }),
      handleDescribeParam({ param: 'fx1.moodFilter.drive' }),
    ]);

    expect(depthResult.success).toBe(true);
    expect(depthResult.decodedField?.notes).toContain('depth (amount) of modulation');

    expect(baseFreqResult.success).toBe(true);
    expect(baseFreqResult.decodedField?.notes).toContain('base frequency');
    expect(baseFreqResult.decodedField?.notes).not.toContain('envelope modulation');

    expect(envModResult.success).toBe(true);
    expect(envModResult.decodedField?.notes).toContain('positive or negative envelope modulation');

    expect(driveResult.success).toBe(true);
    expect(driveResult.decodedField?.notes).toContain('overdrive effect');
  });

  it('returns ChorusVerb metadata and sync notes from the manual', async () => {
    const result = await handleDescribeParam({ param: 'fx1.chorusVerb.speed' });

    expect(result.success).toBe(true);
    expect(result.decodedField?.ui?.abbr).toBe('SPD');
    expect(result.decodedField?.ui?.name).toBe('Speed');
    expect(result.decodedField?.value).toMatchObject({
      units: 'Hz',
      min: 0,
      max: 4,
      modDestination: true,
    });
    expect(result.enum?.count).toBe(20);
    expect(result.enum?.values.find((v) => v.value === 0)?.label).toBe('4');
    expect(result.enum?.values.find((v) => v.value === 7)?.label).toBe('1/4');
    expect(result.enum?.values.find((v) => v.value === 17)?.label).toBe('3/128');
    expect(result.enum?.values.find((v) => v.value === 19)?.label).toBe('1/64');
    expect(result.decodedField?.notes).toContain('raw values 0..19');
  });

  it('returns DelayVerb time notes for sync-capable params', async () => {
    const result = await handleDescribeParam({ param: 'fx1.delayVerb.time' });

    expect(result.success).toBe(true);
    expect(result.decodedField?.ui?.abbr).toBe('TIM');
    expect(result.decodedField?.notes).toContain('Time-synchronized options from 4 to 1/64 bars.');
  });

  it('returns ModDlytRev enums and manual metadata', async () => {
    const [timeResult, factorResult, modeResult, speedResult, rTypeResult] = await Promise.all([
      handleDescribeParam({ param: 'fx1.modDlytRev.time' }),
      handleDescribeParam({ param: 'fx1.modDlytRev.factor' }),
      handleDescribeParam({ param: 'fx1.modDlytRev.mode' }),
      handleDescribeParam({ param: 'fx1.modDlytRev.speed' }),
      handleDescribeParam({ param: 'fx1.modDlytRev.rType' }),
    ]);

    expect(timeResult.success).toBe(true);
    expect(timeResult.decodedField?.ui?.abbr).toBe('TIM');
    expect(timeResult.enum?.count).toBe(20);
    expect(timeResult.enum?.values.find((v) => v.value === 0)?.label).toBe('4');
    expect(timeResult.enum?.values.find((v) => v.value === 7)?.label).toBe('1/4');
    expect(timeResult.enum?.values.find((v) => v.value === 19)?.label).toBe('1/64');
    expect(timeResult.decodedField?.notes).toContain('raw 0..19');
    expect(timeResult.decodedField?.notes).toContain('raw 20 begins the millisecond region at 1.0 ms');

    expect(factorResult.success).toBe(true);
    expect(factorResult.decodedField?.ui?.abbr).toBe('FAC');
    expect(factorResult.decodedField?.ui?.name).toBe('Factor');
    expect(factorResult.enum?.values).toEqual([
      { value: 0, label: '1' },
      { value: 1, label: '1/2' },
      { value: 2, label: '2/3' },
      { value: 3, label: '3/2' },
    ]);
    expect(factorResult.decodedField?.notes).toContain('rhythmic fractions');

    expect(modeResult.success).toBe(true);
    expect(modeResult.decodedField?.ui?.abbr).toBe('MOD');
    expect(modeResult.enum?.values).toEqual([
      { value: 0, label: 'PAR' },
      { value: 1, label: 'SER' },
    ]);
    expect(modeResult.decodedField?.notes).toContain('Parallel or Serial');

    expect(speedResult.success).toBe(true);
    expect(speedResult.decodedField?.ui?.abbr).toBe('SPD');
    expect(speedResult.decodedField?.ui?.name).toBe('Speed');
    expect(speedResult.decodedField?.value).toMatchObject({
      units: 'Hz',
      min: 0,
      max: 10,
      modDestination: true,
    });
    expect(speedResult.enum).toBeUndefined();
    expect(speedResult.decodedField?.notes).toContain('free-rate Hz control');
    expect(speedResult.decodedField?.notes).toContain('raw 20=0.1 Hz');
    expect(speedResult.decodedField?.notes).toContain('raw 100=10.0 Hz');

    expect(rTypeResult.success).toBe(true);
    expect(rTypeResult.decodedField?.ui?.abbr).toBe('RTY');
    expect(rTypeResult.enum?.values).toEqual([
      { value: 0, label: 'AMB' },
      { value: 1, label: 'CLUB' },
      { value: 2, label: 'HALL' },
    ]);
  });

  it('returns DualPitch manual metadata', async () => {
    const [semi1Result, delay1Result, hiCutResult] = await Promise.all([
      handleDescribeParam({ param: 'fx1.dualPitch.semi1' }),
      handleDescribeParam({ param: 'fx1.dualPitch.delay1' }),
      handleDescribeParam({ param: 'fx1.dualPitch.hiCut' }),
    ]);

    expect(semi1Result.success).toBe(true);
    expect(semi1Result.decodedField?.ui?.abbr).toBe('SM1');
    expect(semi1Result.decodedField?.ui?.name).toBe('Semi1');
    expect(semi1Result.decodedField?.value).toMatchObject({
      min: -12,
      max: 12,
      modDestination: true,
    });
    expect(semi1Result.decodedField?.notes).toContain('first channel in semitones');

    expect(delay1Result.success).toBe(true);
    expect(delay1Result.decodedField?.ui?.abbr).toBe('DL1');
    expect(delay1Result.decodedField?.ui?.name).toBe('Delay1');
    expect(delay1Result.decodedField?.value).toMatchObject({
      units: 'ms',
      min: 1,
      max: 500,
    });
    expect(delay1Result.enum?.count).toBe(20);
    expect(delay1Result.enum?.values.find((v) => v.value === 0)?.label).toBe('4');
    expect(delay1Result.enum?.values.find((v) => v.value === 7)?.label).toBe('1/4');
    expect(delay1Result.enum?.values.find((v) => v.value === 19)?.label).toBe('1/64');
    expect(delay1Result.decodedField?.notes).toContain('raw 0..19');
    expect(delay1Result.decodedField?.notes).toContain('raw 20..100 spans 1.0 to 500.0 ms');

    expect(hiCutResult.success).toBe(true);
    expect(hiCutResult.decodedField?.ui?.abbr).toBe('HIC');
    expect(hiCutResult.decodedField?.value).toMatchObject({
      units: 'Hz',
      min: 200,
      max: 20000,
      modDestination: true,
    });
    expect(hiCutResult.decodedField?.notes).toContain('high frequencies');
  });

  it('returns VintgPitch manual metadata', async () => {
    const [feedback1Result, delay2Result, hiCutResult] = await Promise.all([
      handleDescribeParam({ param: 'fx1.vintgPitch.feedback1' }),
      handleDescribeParam({ param: 'fx1.vintgPitch.delay2' }),
      handleDescribeParam({ param: 'fx1.vintgPitch.hiCut' }),
    ]);

    expect(feedback1Result.success).toBe(true);
    expect(feedback1Result.decodedField?.ui?.abbr).toBe('FB1');
    expect(feedback1Result.decodedField?.ui?.name).toBe('Feedback1');
    expect(feedback1Result.decodedField?.value).toMatchObject({
      units: '%',
      min: 0,
      max: 100,
      modDestination: true,
    });
    expect(feedback1Result.decodedField?.notes).toContain('feedback to be applied');

    expect(delay2Result.success).toBe(true);
    expect(delay2Result.decodedField?.ui?.abbr).toBe('DL2');
    expect(delay2Result.decodedField?.ui?.name).toBe('Delay2');
    expect(delay2Result.decodedField?.value).toMatchObject({
      units: 'ms',
      min: 1,
      max: 500,
    });
    expect(delay2Result.enum?.count).toBe(20);
    expect(delay2Result.enum?.values.find((v) => v.value === 0)?.label).toBe('4');
    expect(delay2Result.enum?.values.find((v) => v.value === 7)?.label).toBe('1/4');
    expect(delay2Result.enum?.values.find((v) => v.value === 19)?.label).toBe('1/64');
    expect(delay2Result.decodedField?.notes).toContain('wet and dry signals');
    expect(delay2Result.decodedField?.notes).toContain('4 to 1/64 bars');

    expect(hiCutResult.success).toBe(true);
    expect(hiCutResult.decodedField?.ui?.abbr).toBe('HIC');
    expect(hiCutResult.decodedField?.value).toMatchObject({
      units: 'Hz',
      min: 200,
      max: 20000,
      modDestination: true,
    });
    expect(hiCutResult.decodedField?.notes).toContain('high frequencies');
  });

  it('returns RackAmp rawMax=40 for all amp params (live-confirmed synth clamp)', async () => {
    const [driveResult, preAmpResult, cabinetResult] = await Promise.all([
      handleDescribeParam({ param: 'fx1.rackAmp.drive' }),
      handleDescribeParam({ param: 'fx1.rackAmp.preAmp' }),
      handleDescribeParam({ param: 'fx1.rackAmp.cabinet' }),
    ]);

    expect(driveResult.success).toBe(true);
    expect(driveResult.decodedField?.ui?.abbr).toBe('DRV');
    expect(driveResult.decodedField?.ui?.name).toBe('Drive');
    expect(driveResult.decodedField?.rawMax).toBe(40);
    expect(driveResult.decodedField?.value).toMatchObject({ min: 0, max: 10, modDestination: true });
    expect(driveResult.decodedField?.notes).toContain('raw 40=10.0');
    expect(driveResult.decodedField?.notes).toContain('clamps at raw 40');

    expect(preAmpResult.success).toBe(true);
    expect(preAmpResult.decodedField?.rawMax).toBe(40);
    expect(preAmpResult.decodedField?.notes).toContain('raw 0=0.0 to raw 40=10.0');

    expect(cabinetResult.success).toBe(true);
    expect(cabinetResult.decodedField?.ui?.abbr).toBe('CAB');
    expect(cabinetResult.enum?.values).toEqual([
      { value: 0, label: 'OFF' },
      { value: 1, label: 'ON' },
    ]);
  });

  it('returns Enhancer live-confirmed rawMax values per param', async () => {
    const [bassGainResult, spreadResult, bassFreqResult, outGainResult] = await Promise.all([
      handleDescribeParam({ param: 'fx1.enhancer.bassGain' }),
      handleDescribeParam({ param: 'fx1.enhancer.spread' }),
      handleDescribeParam({ param: 'fx1.enhancer.bassFreq' }),
      handleDescribeParam({ param: 'fx1.enhancer.outGain' }),
    ]);

    expect(bassGainResult.success).toBe(true);
    expect(bassGainResult.decodedField?.ui?.abbr).toBe('BGN');
    expect(bassGainResult.decodedField?.rawMax).toBe(50);
    expect(bassGainResult.decodedField?.value).toMatchObject({ units: '%', min: 0, max: 100, modDestination: true });

    expect(spreadResult.success).toBe(true);
    expect(spreadResult.decodedField?.ui?.abbr).toBe('SPR');
    expect(spreadResult.decodedField?.rawMax).toBe(100);
    expect(spreadResult.decodedField?.value).toMatchObject({ units: '%', min: 0, max: 100, modDestination: true });

    expect(bassFreqResult.success).toBe(true);
    expect(bassFreqResult.decodedField?.ui?.abbr).toBe('BFR');
    expect(bassFreqResult.decodedField?.rawMax).toBe(49);
    expect(bassFreqResult.decodedField?.value).toMatchObject({ min: 1, max: 50 });

    expect(outGainResult.success).toBe(true);
    expect(outGainResult.decodedField?.ui?.abbr).toBe('OGN');
    expect(outGainResult.decodedField?.rawMax).toBe(48);
    expect(outGainResult.decodedField?.value).toMatchObject({ units: 'dB', min: -12, max: 12, modDestination: true });
  });

  it('returns EdisonEx1 live-confirmed rawMax values per param', async () => {
    const [gainResult, stSpreadResult, onResult] = await Promise.all([
      handleDescribeParam({ param: 'fx1.edisonEx1.gain' }),
      handleDescribeParam({ param: 'fx1.edisonEx1.stSpread' }),
      handleDescribeParam({ param: 'fx1.edisonEx1.on' }),
    ]);

    expect(gainResult.success).toBe(true);
    expect(gainResult.decodedField?.ui?.abbr).toBe('GN');
    expect(gainResult.decodedField?.rawMax).toBe(48);
    expect(gainResult.decodedField?.value).toMatchObject({ units: 'dB', min: -12, max: 12, modDestination: true });

    expect(stSpreadResult.success).toBe(true);
    expect(stSpreadResult.decodedField?.ui?.abbr).toBe('STS');
    expect(stSpreadResult.decodedField?.rawMax).toBe(50);
    expect(stSpreadResult.decodedField?.value).toMatchObject({ min: -50, max: 50, modDestination: true });

    expect(onResult.success).toBe(true);
    expect(onResult.decodedField?.ui?.abbr).toBe('ON');
    expect(onResult.enum?.values).toEqual([
      { value: 0, label: 'OFF' },
      { value: 1, label: 'ON' },
    ]);
  });

  it('returns Chorus-D enums and mix range from the manual', async () => {
    const [mixResult, modeResult, sw1Result] = await Promise.all([
      handleDescribeParam({ param: 'fx1.chorusD.mix' }),
      handleDescribeParam({ param: 'fx1.chorusD.mode' }),
      handleDescribeParam({ param: 'fx1.chorusD.sw1' }),
    ]);

    expect(mixResult.success).toBe(true);
    expect(mixResult.decodedField?.ui?.abbr).toBe('MIX');
    expect(mixResult.decodedField?.value).toMatchObject({ units: '%', min: 0, max: 100, modDestination: true });
    expect(mixResult.enum).toBeUndefined(); // mix is numeric, not enum

    expect(modeResult.success).toBe(true);
    expect(modeResult.decodedField?.ui?.abbr).toBe('MOD');
    expect(modeResult.enum?.values).toEqual([
      { value: 0, label: 'M' },
      { value: 1, label: 'ST' },
    ]);

    expect(sw1Result.success).toBe(true);
    expect(sw1Result.decodedField?.ui?.abbr).toBe('SW1');
    expect(sw1Result.enum?.values).toEqual([
      { value: 0, label: 'OFF' },
      { value: 1, label: 'ON' },
    ]);
  });
});

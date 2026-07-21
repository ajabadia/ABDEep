// WebUI/tests/audioABSchema.contract.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Audio A/B Manifest JSON Schema Contract (v1.0.0)', () => {
  let schema;

  beforeEach(() => {
    schema = JSON.parse(
      fs.readFileSync(path.resolve('WebUI/schemas/audio-ab-manifest.schema.v1.0.0.json'), 'utf8')
    );
  });

  it('el esquema de manifest define la versión correcta y los campos clave del hardware/software', () => {
    expect(schema.$id).toContain('audio-ab-manifest/1.0.0');
    expect(schema.required).toContain('schema_version');
    expect(schema.required).toContain('run_id');
    expect(schema.required).toContain('engine');
    expect(schema.required).toContain('files');
    expect(schema.required).toContain('hardware');
    expect(schema.required).toContain('software');
    expect(schema.required).toContain('comparison');
  });

  it('el motor (engine) tiene los tipos de parámetros requeridos para el test físico', () => {
    const properties = schema.properties.engine.properties;
    expect(properties.sample_rate.type).toBe('NUMBER');
    expect(properties.bit_depth.type).toBe('INTEGER');
    expect(properties.note.type).toBe('INTEGER');
    expect(properties.velocity.type).toBe('INTEGER');
  });

  it('los metadatos de las tomas de hardware y software declaran RMS y picos requeridos', () => {
    const hwProps = schema.properties.hardware.properties;
    const swProps = schema.properties.software.properties;
    
    expect(hwProps.peak_dbfs.type).toBe('NUMBER');
    expect(hwProps.rms_dbfs.type).toBe('NUMBER');
    expect(swProps.peak_dbfs.type).toBe('NUMBER');
    expect(swProps.rms_dbfs.type).toBe('NUMBER');
  });
});

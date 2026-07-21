// WebUI/tests/calibrationSchema.contract.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

if (typeof window === 'undefined') {
  global.window = {};
}

import '../js/calibration_store.js';

describe('Calibration Lab JSON & Manifest Schema Contracts (v1.0.0)', () => {
  let reportSchema, manifestSchema;

  beforeEach(() => {
    reportSchema = JSON.parse(
      fs.readFileSync(path.resolve('WebUI/schemas/calibration-run.schema.v1.0.0.json'), 'utf8')
    );
    manifestSchema = JSON.parse(
      fs.readFileSync(path.resolve('WebUI/schemas/calibration-manifest.schema.v1.0.0.json'), 'utf8')
    );
  });

  it('el esquema de reporte define la versión 1.0.0 y los campos obligatorios', () => {
    expect(reportSchema.properties.schema_version.pattern).toBe('^\\d+\\.\\d+\\.\\d+$');
    expect(reportSchema.required).toContain('schemaVersion');
    expect(reportSchema.required).toContain('runId');
    expect(reportSchema.required).toContain('items');
  });

  it('el esquema de manifest define campos obligatorios y versión', () => {
    expect(manifestSchema.required).toContain('schemaVersion');
    expect(manifestSchema.required).toContain('files');
    expect(manifestSchema.properties.environment.enum).toContain('CI');
    expect(manifestSchema.properties.environment.enum).toContain('local');
  });

  // Validaciones del validador de datos del store con respecto al contrato
  it('el snapshot generado por el store coincide con las exigencias del contrato v1.0.0', () => {
    const createFn = window.createCalibrationStore || global.createCalibrationStore;
    const store = createFn(null);
    store.setBankRunConfig({ sampleSize: 2, seed: 1 });
    
    global.window.loadedBanks = {
      'Bank A': [
        { name: 'Patch 1', unpackedBytes: [0], meta: { category: 'Bass', favorite: true } },
        { name: 'Patch 2', unpackedBytes: [0], meta: { category: 'Lead', favorite: false } }
      ]
    };

    store.generateBankRun();
    store.startWorkflowSession();
    store.markWorkflowItemStatus(0, 'pass');
    store.setWorkflowItemNotes(0, 'Test note');

    const snap = store.getWorkflowReportSnapshot();
    
    // Validar estructura contractualmente
    expect(snap.schema_version).toBe('1.0.0');
    expect(snap.schemaVersion).toBe(1);
    expect(snap.runId).toBeDefined();
    expect(snap.progress.total).toBe(2);
    expect(snap.items).toHaveLength(2);
    
    // Validar item contractual
    const item = snap.items[0];
    expect(item.index).toBe(0);
    expect(item.bankName).toBe('Bank A');
    expect(item.patchName).toBe('Patch 1');
    expect(item.status).toBe('pass');
    expect(item.notes).toBe('Test note');
    expect(item.meta.category).toBe('Bass');
    expect(item.meta.favorite).toBe(true);

    delete global.window.loadedBanks;
  });
});

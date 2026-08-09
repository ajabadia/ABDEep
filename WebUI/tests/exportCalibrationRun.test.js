// WebUI/tests/exportCalibrationRun.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('export-calibration-run script integration', () => {
  let tmpInputDir = path.resolve('WebUI/tmp/test-exports-src');
  let tmpOutputDir = path.resolve('WebUI/tmp/test-exports-dest');

  function uniqueSuffix() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  beforeEach(() => {
    tmpInputDir = path.resolve(`WebUI/tmp/test-exports-src-${uniqueSuffix()}`);
    tmpOutputDir = path.resolve(`WebUI/tmp/test-exports-dest-${uniqueSuffix()}`);
    if (!fs.existsSync(tmpInputDir)) {fs.mkdirSync(tmpInputDir, { recursive: true });}
    if (fs.existsSync(tmpOutputDir)) {fs.rmSync(tmpOutputDir, { recursive: true, force: true });}
  });

  afterEach(() => {
    [tmpInputDir, tmpOutputDir].forEach((dir) => {
      if (fs.existsSync(dir)) {
        try {
          fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
        } catch (e) {
          // Swallow EPERM/EACCESS cleanup errors caused by Windows file locks;
          // anything else should still fail the test.
          if (e.code !== 'EPERM' && e.code !== 'EACCES' && e.code !== 'EBUSY') {
            throw e;
          }
        }
      }
    });
  });

  const scriptPath = path.resolve(__dirname, '../scripts/export-calibration-run.js');

  it('procesa correctamente archivos JSON y CSV copiándolos y creando manifest.json', () => {
    fs.writeFileSync(path.join(tmpInputDir, 'cal_report_run-123_test.json'), '{}');
    fs.writeFileSync(path.join(tmpInputDir, 'cal_report_run-123_test.csv'), 'headers\nvalue');
    fs.writeFileSync(path.join(tmpInputDir, 'random_file.txt'), 'ignore me');

    execSync(
      `node "${scriptPath}" --input-dir "${tmpInputDir}" --output-dir "${tmpOutputDir}" --run-id "run-123"`,
      { stdio: 'inherit' }
    );

    expect(fs.existsSync(path.join(tmpOutputDir, 'cal_report_run-123_test.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpOutputDir, 'cal_report_run-123_test.csv'))).toBe(true);
    expect(fs.existsSync(path.join(tmpOutputDir, 'random_file.txt'))).toBe(false); // excluido

    const manifestPath = path.join(tmpOutputDir, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.runId).toBe('run-123');
    expect(manifest.files).toContain('cal_report_run-123_test.json');
    expect(manifest.files).toContain('cal_report_run-123_test.csv');
  });

  it('genera PDF resumen cuando el JSON de entrada contiene un snapshot de calibración', () => {
    const reportData = {
      schemaVersion: 1,
      runId: 'run-pdf-99',
      exportedAt: '2026-06-01T00:00:00.000Z',
      config: { sourceScope: 'All', sampleSize: 5, seed: 42 },
      progress: { total: 5, reviewed: 3, pct: 60 },
      statusCounts: { pass: 2, review: 1, fail: 0, skip: 0, pending: 2 },
      items: [
        { index: 0, bankName: 'BankA', patchName: 'Lead', status: 'pass', criticalCandidate: false, notes: '' },
        { index: 1, bankName: 'BankA', patchName: 'Pad', status: 'review', criticalCandidate: true, notes: 'Check tuning' },
      ],
    };
    fs.writeFileSync(path.join(tmpInputDir, 'cal_report_run-pdf-99_report.json'), JSON.stringify(reportData));
    fs.writeFileSync(path.join(tmpInputDir, 'cal_report_run-pdf-99.csv'), 'col1,col2\nv1,v2');

    execSync(
      `node "${scriptPath}" --input-dir "${tmpInputDir}" --output-dir "${tmpOutputDir}" --run-id "run-pdf-99"`,
      { stdio: 'inherit' }
    );

    // Verificar que se generó el PDF
    const pdfFiles = fs.readdirSync(tmpOutputDir).filter(f => f.endsWith('.pdf'));
    expect(pdfFiles.length).toBeGreaterThanOrEqual(1);

    // Verificar que el PDF está listado en el manifest
    const manifest = JSON.parse(fs.readFileSync(path.join(tmpOutputDir, 'manifest.json'), 'utf8'));
    const pdfInManifest = manifest.files.some(f => f.endsWith('.pdf'));
    expect(pdfInManifest).toBe(true);
  });

  it('falla con código de salida 1 en modo CI si no hay archivos en el input directory', () => {
    expect(() => {
      execSync(
        `node "${scriptPath}" --input-dir "${tmpInputDir}" --output-dir "${tmpOutputDir}" --ci`,
        { stdio: 'pipe' }
      );
    }).toThrow();
  });
});

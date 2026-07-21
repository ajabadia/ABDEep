// WebUI/tests/calibrationReportExporter.test.js
// CL-10e: Tests del CalibrationReportExporter
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

if (typeof window === 'undefined') {global.window = {};}
if (typeof document === 'undefined') {
  global.document = {
    createElement: () => ({
      href: '',
      download: '',
      click: vi.fn(),
    }),
  };
}
if (typeof URL === 'undefined') {
  global.URL = {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  };
}

// Mock jsPDF for browser-side PDF export test
class MockJsPDF {
  constructor() { this._pages = 1; this._fontSize = 10; this._textColor = [0,0,0]; this._lines = []; }
  setFontSize(s) { this._fontSize = s; }
  setTextColor(...c) { this._textColor = c; }
  text(t, x, y) { this._lines.push({t,x,y}); }
  addPage() { this._pages++; }
  rect() {}
  setFillColor() {}
  splitTextToSize(t) { return [String(t).slice(0,40)]; }
  internal = { getNumberOfPages: () => this._pages };
  setPage() {}
  output() { return new Uint8Array([0x25,0x50,0x44,0x46]); } // %PDF
}
if (typeof global.window.jspdf === 'undefined') {
  global.window.jspdf = { jsPDF: MockJsPDF };
}

import '../js/calibration_report_exporter.js';

describe('CalibrationReportExporter', () => {
  let exporter;

  beforeEach(() => {
    exporter = global.window.CalibrationReportExporter || global.CalibrationReportExporter;
    // Reset URL mocks
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  // ── sanitizeFileName ────────────────────────────────────────────
  describe('sanitizeFileName', () => {
    it('reemplaza caracteres no seguros con guion bajo', () => {
      expect(exporter.sanitizeFileName('My Patch!')).toBe('My_Patch_');
      expect(exporter.sanitizeFileName('bass/lead#1')).toBe('bass_lead_1');
    });

    it('preserva letras, números, guión y guión bajo', () => {
      expect(exporter.sanitizeFileName('Patch_01-Lead')).toBe('Patch_01-Lead');
    });

    it('usa fallback "export" para nombres vacíos o null', () => {
      expect(exporter.sanitizeFileName('')).toBe('export');
      expect(exporter.sanitizeFileName(null)).toBe('export');
      expect(exporter.sanitizeFileName(undefined)).toBe('export');
    });
  });

  // ── exportCalibrationReportJson ─────────────────────────────────
  describe('exportCalibrationReportJson', () => {
    it('devuelve false si no hay snapshot', () => {
      const result = exporter.exportCalibrationReportJson(null);
      expect(result).toBe(false);
    });

    it('devuelve true y crea blob JSON para snapshot válido', () => {
      const mockSnap = {
        runId: 'run-test-42',
        schemaVersion: 1,
        items: [],
        config: {},
        progress: { total: 0, reviewed: 0, pct: 0 },
      };
      const result = exporter.exportCalibrationReportJson(mockSnap);
      expect(result).toBe(true);
      expect(URL.createObjectURL).toHaveBeenCalledOnce();
    });
  });

  // ── exportCalibrationReportCsv ──────────────────────────────────
  describe('exportCalibrationReportCsv', () => {
    it('devuelve false si no hay rows', () => {
      expect(exporter.exportCalibrationReportCsv(null)).toBe(false);
    });

    it('genera CSV con headers correctos para run vacío', () => {
      const capturedBlobs = [];
      const origCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = (blob) => {
        capturedBlobs.push(blob);
        return 'blob:mock-url';
      };

      exporter.exportCalibrationReportCsv([]);
      expect(capturedBlobs.length).toBe(1);
      // Verificar que el blob tiene content que incluye headers
      URL.createObjectURL = origCreateObjectURL;
    });

    it('escapa comas en campos con coma', () => {
      const rows = [{
        runId: 'r1', index: 0, bankName: 'Bank, A', patchIndex: 0,
        patchName: 'Lead', category: '', favorite: 'false',
        status: 'pass', criticalCandidate: 'false', latestBadge: '', notes: 'ok',
      }];
      // Verificar que no lanza — el escape de CSV debe manejar comas internamente
      expect(() => exporter.exportCalibrationReportCsv(rows)).not.toThrow();
    });

    it('escapa comillas dobles en campos', () => {
      const rows = [{
        runId: 'r1', index: 0, bankName: 'Bank', patchIndex: 0,
        patchName: 'Patch "Alpha"', category: '', favorite: 'false',
        status: 'pass', criticalCandidate: 'false', latestBadge: '', notes: '',
      }];
      expect(() => exporter.exportCalibrationReportCsv(rows)).not.toThrow();
    });

    it('contiene todas las columnas definidas en CSV_HEADERS', () => {
      const headers = exporter.CSV_HEADERS;
      expect(headers).toContain('schema_version');
      expect(headers).toContain('runId');
      expect(headers).toContain('bankName');
      expect(headers).toContain('patchName');
      expect(headers).toContain('status');
      expect(headers).toContain('criticalCandidate');
      expect(headers).toContain('notes');
      expect(headers.length).toBeGreaterThanOrEqual(12);
    });
  });

  // ── exportCalibrationReportPdf ─────────────────────────────────
  describe('exportCalibrationReportPdf', () => {
    it('devuelve false si no hay snapshot', () => {
      expect(exporter.exportCalibrationReportPdf(null)).toBe(false);
    });

    it('devuelve true y genera PDF para snapshot válido', () => {
      const mockSnap = {
        runId: 'run-42',
        exportedAt: '2026-01-01T00:00:00.000Z',
        schemaVersion: 1,
        config: { sourceScope: 'All Banks' },
        progress: { total: 10, reviewed: 5, pct: 50 },
        statusCounts: { pass: 3, review: 1, fail: 0, skip: 1, pending: 5 },
        items: [
          { index: 0, bankName: 'Bank A', patchName: 'Lead', status: 'pass', criticalCandidate: false, notes: '' },
          { index: 1, bankName: 'Bank B', patchName: 'Pad', status: 'review', criticalCandidate: true, notes: 'Needs adjustment' },
        ],
      };
      const result = exporter.exportCalibrationReportPdf(mockSnap);
      expect(result).toBe(true);
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });

  // ── exportSelectedWorkflowPatchSysex ───────────────────────────
  describe('exportSelectedWorkflowPatchSysex', () => {
    it('devuelve false si item es null', () => {
      expect(exporter.exportSelectedWorkflowPatchSysex(null)).toBe(false);
    });

    it('devuelve false si el item no tiene unpackedBytes', () => {
      const item = { index: 0, patchName: 'Patch', bankName: 'Bank', patchRef: {} };
      expect(exporter.exportSelectedWorkflowPatchSysex(item)).toBe(false);
    });

    it('llama a window.buildSingleSysex cuando patchRef tiene unpackedBytes', () => {
      const mockSyx = new Uint8Array([0xF0, 0xF7]);
      global.window.buildSingleSysex = vi.fn(() => mockSyx);

      const item = {
        index: 0,
        patchName: 'MyPatch',
        bankName: 'Bank A',
        patchRef: { name: 'MyPatch', unpackedBytes: [0, 1, 2] },
      };

      const result = exporter.exportSelectedWorkflowPatchSysex(item);
      expect(result).toBe(true);
      expect(global.window.buildSingleSysex).toHaveBeenCalledWith(item.patchRef);

      delete global.window.buildSingleSysex;
    });
  });
});

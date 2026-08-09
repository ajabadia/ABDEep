// eslint-disable-next-line no-var
var Logger = globalThis.Logger || console;

// WebUI/js/calibration_report_exporter.js
// CL-10: Exporter de reportes del Calibration Lab
// Reutiliza: Blob + URL.createObjectURL + a.click() ya usados en exportSinglePatch()
// Reutiliza: window.buildSingleSysex(patch) ya usado en browser_io.js
// NO duplica: exportSinglePatch(), parseSyxFile(), ni ningún parser SysEx nuevo.
(function () {

  // ─────────────────────────────────────────────────────────────────
  // Utilidades compartidas (patrón ya establecido en browser_io.js)
  // ─────────────────────────────────────────────────────────────────

  function sanitizeFileName(name) {
    return String(name || 'export').replace(/[^a-zA-Z0-9_\-]/g, '_');
  }

  function downloadBlob(blob, fileName) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  }

  // ─────────────────────────────────────────────────────────────────
  // CL-10a: Export JSON de sesión completa
  // ─────────────────────────────────────────────────────────────────

  function exportCalibrationReportJson(snapshot, fileName) {
    if (!snapshot) {
      Logger.warn('[CalibrationExporter] No snapshot provided for JSON export');
      return false;
    }
    const json = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const name = fileName || `cal_report_${sanitizeFileName(snapshot.runId || 'unknown')}_${ts}.json`;
    downloadBlob(blob, name);
    return true;
  }

  // ─────────────────────────────────────────────────────────────────
  // CL-10b: Export CSV resumido
  // Columnas: runId, index, bankName, patchIndex, patchName, category,
  //           favorite, status, criticalCandidate, latestBadge, notes
  // ─────────────────────────────────────────────────────────────────

  const CSV_HEADERS = [
    'schema_version', 'runId', 'index', 'bankName', 'patchIndex', 'patchName',
    'category', 'favorite', 'status', 'criticalCandidate', 'latestBadge', 'notes',
  ];

  function _escapeCsvCell(value) {
    const str = String(value ?? '');
    // Si contiene coma, comilla o salto de línea → envolver en comillas, escapar internas
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function exportCalibrationReportCsv(rows, fileName) {
    if (!Array.isArray(rows)) {
      Logger.warn('[CalibrationExporter] No rows provided for CSV export');
      return false;
    }
    const headerLine = CSV_HEADERS.join(',');
    const dataLines = rows.map((row) =>
      CSV_HEADERS.map((col) => _escapeCsvCell(row[col])).join(',')
    );
    const csv = [headerLine, ...dataLines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const name = fileName || `cal_report_${ts}.csv`;
    downloadBlob(blob, name);
    return true;
  }

  // ─────────────────────────────────────────────────────────────────
  // CL-10c: Export .syx de evidencia de patch — opcional
  // Solo si item.patchRef.unpackedBytes existe.
  // Reutiliza window.buildSingleSysex(patch) — no reimplementa SysEx.
  // ─────────────────────────────────────────────────────────────────

  function exportSelectedWorkflowPatchSysex(item) {
    if (!item || !item.patchRef || !Array.isArray(item.patchRef.unpackedBytes)) {
      Logger.warn('[CalibrationExporter] Item does not have unpackedBytes — skipping .syx export');
      return false;
    }
    if (typeof window === 'undefined' || typeof window.buildSingleSysex !== 'function') {
      Logger.warn('[CalibrationExporter] window.buildSingleSysex not available');
      return false;
    }
    const syxMsg = window.buildSingleSysex(item.patchRef);
    const blob = new Blob([syxMsg], { type: 'application/octet-stream' });
    const idxStr = String(item.index + 1).padStart(3, '0');
    const patchSafe = sanitizeFileName(item.patchName || 'patch');
    const bankSafe = sanitizeFileName(item.bankName || 'bank');
    const fileName = `${idxStr}_${bankSafe}_${patchSafe}.syx`;
    downloadBlob(blob, fileName);
    return true;
  }

  // ─────────────────────────────────────────────────────────────────
  // CL-10d: Export PDF (delegado a calibration_report_exporter_pdf.js)
  // ─────────────────────────────────────────────────────────────────

  function exportCalibrationReportPdf(snapshot, fileName) {
    const pdfModule = (typeof window !== 'undefined' && window._calPdfExporter) ||
                    (typeof global !== 'undefined' && global._calPdfExporter);
    if (pdfModule && typeof pdfModule.exportCalibrationReportPdf === 'function') {
      return pdfModule.exportCalibrationReportPdf(snapshot, fileName);
    }
    Logger.warn('[CalibrationExporter] PDF module not loaded');
    return false;
  }

  // ─────────────────────────────────────────────────────────────────
  // API pública
  // ─────────────────────────────────────────────────────────────────

  const CalibrationReportExporter = {
    sanitizeFileName,
    downloadBlob,
    exportCalibrationReportJson,
    exportCalibrationReportCsv,
    exportCalibrationReportPdf,
    exportSelectedWorkflowPatchSysex,
    CSV_HEADERS,
  };

  if (typeof window !== 'undefined') {
    window.CalibrationReportExporter = CalibrationReportExporter;
  }
  if (typeof global !== 'undefined') {
    global.CalibrationReportExporter = CalibrationReportExporter;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CalibrationReportExporter;
  }
})();

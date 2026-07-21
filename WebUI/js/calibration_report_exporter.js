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
      console.warn('[CalibrationExporter] No snapshot provided for JSON export');
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
      console.warn('[CalibrationExporter] No rows provided for CSV export');
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
      console.warn('[CalibrationExporter] Item does not have unpackedBytes — skipping .syx export');
      return false;
    }
    if (typeof window === 'undefined' || typeof window.buildSingleSysex !== 'function') {
      console.warn('[CalibrationExporter] window.buildSingleSysex not available');
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
  // CL-10d: Export PDF de reporte completo
  // ─────────────────────────────────────────────────────────────────

  function exportCalibrationReportPdf(snapshot, fileName) {
    if (!snapshot) {
      console.warn('[CalibrationExporter] No snapshot provided for PDF export');
      return false;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 190;
    const margin = 10;
    let y = margin;

    function addSection(title) {
      if (y > 270) { doc.addPage(); y = margin; }
      doc.setFontSize(14);
      doc.text(title, margin, y);
      y += 8;
    }

    function addLine(label, value) {
      if (y > 275) { doc.addPage(); y = margin; }
      doc.setFontSize(10);
      doc.text(`${label}: ${value}`, margin + 2, y);
      y += 5;
    }

    // Header
    doc.setFontSize(20);
    doc.text('Calibration Run Report', margin, y);
    y += 10;

    // Metadatos
    addLine('Run ID', snapshot.runId || 'N/A');
    addLine('Exported At', snapshot.exportedAt || new Date().toISOString());
    addLine('Schema Version', String(snapshot.schemaVersion ?? snapshot.schema_version ?? 'N/A'));
    if (snapshot.config) {
      addLine('Source Scope', snapshot.config.sourceScope || 'N/A');
      if (snapshot.config.bankNames && snapshot.config.bankNames.length > 0)
        {addLine('Bank Names', snapshot.config.bankNames.join(', '));}
      if (snapshot.config.sampleSize) {addLine('Sample Size', String(snapshot.config.sampleSize));}
      if (snapshot.config.seed) {addLine('Seed', String(snapshot.config.seed));}
    }
    y += 4;

    // Progress
    if (snapshot.progress) {
      addSection('Progress');
      addLine('Total', String(snapshot.progress.total));
      addLine('Reviewed', String(snapshot.progress.reviewed));
      addLine('Completion', `${snapshot.progress.pct}%`);
    }

    // Status counts
    if (snapshot.statusCounts) {
      addSection('Status Summary');
      const statusColors = { pass: [76, 175, 80], fail: [244, 67, 54], review: [255, 152, 0], skip: [158, 158, 158], pending: [33, 150, 243] };
      for (const [st, count] of Object.entries(snapshot.statusCounts)) {
        doc.setTextColor(...(statusColors[st] || [0, 0, 0]));
        addLine(st, String(count));
      }
      doc.setTextColor(0, 0, 0);
    }

    // Items table
    if (snapshot.items && snapshot.items.length > 0) {
      addSection(`Items (${snapshot.items.length})`);
      y += 2;

      const cols = ['#', 'Bank', 'Patch', 'Status', 'Critical', 'Notes'];
      const colW = [8, 30, 40, 18, 18, 70];
      const totalColW = colW.reduce((a, b) => a + b, 0);

      // Header row
      doc.setFontSize(8);
      doc.setFillColor(240, 240, 240);
      let cx = margin;
      cols.forEach((c, i) => {
        doc.rect(cx, y - 2, colW[i], 6, 'F');
        doc.text(c, cx + 1, y + 2);
        cx += colW[i];
      });
      y += 6;

      // Data rows
      doc.setFontSize(7);
      for (const item of snapshot.items) {
        if (y > 278) { doc.addPage(); y = margin; }

        // Check notes height
        const notes = String(item.notes || '');
        const lineH = notes ? 8 : 5;

        cx = margin;
        const rowY = y;
        doc.text(String((item.index ?? 0) + 1), cx + 1, y + 3);
        cx += colW[0];
        doc.text(String(item.bankName || '').slice(0, 14), cx + 1, y + 3);
        cx += colW[1];
        doc.text(String(item.patchName || '').slice(0, 18), cx + 1, y + 3);
        cx += colW[2];

        const st = item.status || 'pending';
        const stColors = { pass: [76, 175, 80], fail: [244, 67, 54], review: [255, 152, 0], skip: [158, 158, 158], pending: [33, 150, 243] };
        doc.setTextColor(...(stColors[st] || [0, 0, 0]));
        doc.text(st, cx + 1, y + 3);
        doc.setTextColor(0, 0, 0);
        cx += colW[3];

        doc.text(item.criticalCandidate ? 'YES' : 'no', cx + 1, y + 3);
        cx += colW[4];

        if (notes) {
          const lines = doc.splitTextToSize(notes, colW[5] - 2);
          doc.text(lines, cx + 1, y + 3);
        }

        y += lineH;
      }
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Generated by ABDEep Calibration Lab — Page ${i} / ${pageCount}`, margin, 290);
    }

    const pdfBlob = doc.output('blob');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const name = fileName || `cal_report_${sanitizeFileName(snapshot.runId || 'unknown')}_${ts}.pdf`;
    downloadBlob(pdfBlob, name);
    return true;
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

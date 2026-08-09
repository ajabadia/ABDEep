/**
 * @purpose Calibration Lab PDF report generation: uses jsPDF to create
 *          formatted A4 reports with metadata, status counts, and items table.
 * @classification Module/Calibration/Exporter
 * @dependencies calibration_report_exporter.js (for downloadBlob, sanitizeFileName)
 */

(function () {
    'use strict';

    const Logger = (typeof globalThis !== 'undefined' && globalThis.Logger) || console;

    /**
     * Exporta un reporte PDF completo usando jsPDF.
     * @param {Object} snapshot - snapshot de calibración
     * @param {string} [fileName] - nombre opcional del archivo
     * @returns {boolean} true si se exportó correctamente
     */
    function exportCalibrationReportPdf(snapshot, fileName) {
        if (!snapshot) {
            Logger.warn('[CalibrationExporter] No snapshot provided for PDF export');
            return false;
        }

        const jsPDF = (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : null;
        if (!jsPDF) {
            Logger.warn('[CalibrationExporter] jsPDF not available');
            return false;
        }

        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const _pageW = 190;
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
            doc.text(label + ': ' + value, margin + 2, y);
            y += 5;
        }

        // Header
        doc.setFontSize(20);
        doc.text('Calibration Run Report', margin, y);
        y += 10;

        // Metadatos
        addLine('Run ID', snapshot.runId || 'N/A');
        addLine('Exported At', snapshot.exportedAt || new Date().toISOString());
        addLine('Schema Version', String(snapshot.schemaVersion != null ? snapshot.schemaVersion : (snapshot.schema_version || 'N/A')));
        if (snapshot.config) {
            addLine('Source Scope', snapshot.config.sourceScope || 'N/A');
            if (snapshot.config.bankNames && snapshot.config.bankNames.length > 0) {
                addLine('Bank Names', snapshot.config.bankNames.join(', '));
            }
            if (snapshot.config.sampleSize != null) { addLine('Sample Size', String(snapshot.config.sampleSize)); }
            if (snapshot.config.seed != null) { addLine('Seed', String(snapshot.config.seed)); }
        }
        y += 4;

        // Progress
        if (snapshot.progress) {
            addSection('Progress');
            addLine('Total', String(snapshot.progress.total));
            addLine('Reviewed', String(snapshot.progress.reviewed));
            addLine('Completion', snapshot.progress.pct + '%');
        }

        // Status counts
        const statusColors = { pass: [76, 175, 80], fail: [244, 67, 54], review: [255, 152, 0], skip: [158, 158, 158], pending: [33, 150, 243] };
        if (snapshot.statusCounts) {
            addSection('Status Summary');
            const statusKeys = Object.keys(snapshot.statusCounts);
            for (let si = 0; si < statusKeys.length; si++) {
                const st = statusKeys[si];
                const count = snapshot.statusCounts[st];
                const c = statusColors[st] || [0, 0, 0];
                doc.setTextColor(c[0], c[1], c[2]);
                addLine(st, String(count));
            }
            doc.setTextColor(0, 0, 0);
        }

        // Items table
        if (snapshot.items && snapshot.items.length > 0) {
            addSection('Items (' + snapshot.items.length + ')');
            y += 2;

            const cols = ['#', 'Bank', 'Patch', 'Status', 'Critical', 'Notes'];
            const colW = [8, 30, 40, 18, 18, 70];

            // Header row
            doc.setFontSize(8);
            doc.setFillColor(240, 240, 240);
            let cx = margin;
            for (let ci = 0; ci < cols.length; ci++) {
                doc.rect(cx, y - 2, colW[ci], 6, 'F');
                doc.text(cols[ci], cx + 1, y + 2);
                cx += colW[ci];
            }
            y += 6;

            // Data rows
            doc.setFontSize(7);
            for (let ri = 0; ri < snapshot.items.length; ri++) {
                const item = snapshot.items[ri];
                if (y > 278) { doc.addPage(); y = margin; }

                const notes = String(item.notes || '');
                const lineH = notes ? 8 : 5;

                cx = margin;
                doc.text(String((item.index != null ? item.index : 0) + 1), cx + 1, y + 3);
                cx += colW[0];
                doc.text(String(item.bankName || '').slice(0, 14), cx + 1, y + 3);
                cx += colW[1];
                doc.text(String(item.patchName || '').slice(0, 18), cx + 1, y + 3);
                cx += colW[2];

                const status = item.status || 'pending';
                const sc = statusColors[status] || [0, 0, 0];
                doc.setTextColor(sc[0], sc[1], sc[2]);
                doc.text(status, cx + 1, y + 3);
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
        for (let pi = 1; pi <= pageCount; pi++) {
            doc.setPage(pi);
            doc.setFontSize(8);
            doc.setTextColor(128, 128, 128);
            doc.text('Generated by ABDEep Calibration Lab — Page ' + pi + ' / ' + pageCount, margin, 290);
        }

        const pdfBlob = doc.output('blob');
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const exporter = (typeof window !== 'undefined' && window.CalibrationReportExporter);
        const sanitize = (exporter && exporter.sanitizeFileName) || function (n) { return String(n || 'export').replace(/[^a-zA-Z0-9_\\-]/g, '_'); };
        const downloadFn = (exporter && exporter.downloadBlob) || function (blob, name) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = name;
            link.click();
            setTimeout(function () { URL.revokeObjectURL(link.href); }, 5000);
        };
        const name = fileName || 'cal_report_' + sanitize(snapshot.runId || 'unknown') + '_' + ts + '.pdf';
        downloadFn(pdfBlob, name);
        return true;
    }

    // --- Public API (con typeof guard para compatibilidad con vitest) ---
    if (typeof window !== 'undefined') {
        window._calPdfExporter = {
            exportCalibrationReportPdf: exportCalibrationReportPdf
        };
    }
    if (typeof global !== 'undefined') {
        global._calPdfExporter = {
            exportCalibrationReportPdf: exportCalibrationReportPdf
        };
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { exportCalibrationReportPdf: exportCalibrationReportPdf };
    }
})();

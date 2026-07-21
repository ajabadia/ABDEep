// WebUI/scripts/export-calibration-run.js
// CL-13.1: Copia JSON/CSV/SYX a artifacts/calibration-runs/, valida presencia mínima y escribe un manifest.json
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    inputDir: 'WebUI/tmp/calibration-exports',
    outputDir: 'artifacts/calibration-runs',
    runId: '',
    ci: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input-dir' && args[i + 1]) {
      options.inputDir = args[i + 1];
      i++;
    } else if (args[i] === '--output-dir' && args[i + 1]) {
      options.outputDir = args[i + 1];
      i++;
    } else if (args[i] === '--run-id' && args[i + 1]) {
      options.runId = args[i + 1];
      i++;
    } else if (args[i] === '--ci') {
      options.ci = true;
    }
  }

  return options;
}

function run() {
  const options = parseArgs();
  console.log('[CalibrationExporterCLI] Running with configuration:', options);

  const inputDirResolved = path.resolve(options.inputDir);
  const outputDirResolved = path.resolve(options.outputDir);

  if (!fs.existsSync(inputDirResolved)) {
    console.error(`[Error] Input directory does not exist: ${inputDirResolved}`);
    process.exit(1);
  }

  // Crear output dir si no existe
  if (!fs.existsSync(outputDirResolved)) {
    fs.mkdirSync(outputDirResolved, { recursive: true });
  }

  // Leer todos los archivos del directorio de entrada
  const files = fs.readdirSync(inputDirResolved);
  console.log(`[CalibrationExporterCLI] Found ${files.length} files in input directory.`);

  // Si no hay archivos, fallar si estamos en CI
  if (files.length === 0) {
    if (options.ci) {
      console.error('[Error] No files found in input directory, failing CI run.');
      process.exit(1);
    } else {
      console.log('[CalibrationExporterCLI] No files to process.');
      process.exit(0);
    }
  }

  const processedFiles = [];
  let foundJson = false;
  let foundCsv = false;
  let detectedRunId = options.runId || null;

  // Filtrar y copiar archivos
  files.forEach((file) => {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.json' || ext === '.csv' || ext === '.syx') {
      const srcPath = path.join(inputDirResolved, file);
      
      // Intentar extraer run-id si no se provee uno
      if (!detectedRunId) {
        const match = file.match(/cal_report_([a-zA-Z0-9_\-]+)_/);
        if (match) {
          detectedRunId = match[1];
        }
      }

      // Nombre final para el archivo, sanitizado
      const destPath = path.join(outputDirResolved, file);
      fs.copyFileSync(srcPath, destPath);
      processedFiles.push(file);

      if (ext === '.json') {foundJson = true;}
      if (ext === '.csv') {foundCsv = true;}
    }
  });

  // Validaciones mínimas
  if (options.ci && !foundJson && !foundCsv) {
    console.error('[Error] No valid JSON or CSV reports were processed.');
    process.exit(1);
  }

  // Generar PDF resumen si hay archivos JSON con datos
  const pdfPaths = generatePdfReport(outputDirResolved, processedFiles, detectedRunId);
  processedFiles.push(...pdfPaths);

  // Crear manifest.json con checksums / metadatos del run
  const manifestPath = path.join(outputDirResolved, 'manifest.json');
  const manifest = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    schema_version: '1.0.0',
    runId: detectedRunId || 'unknown-run',
    files: processedFiles,
    environment: options.ci ? 'CI' : 'local'
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`[CalibrationExporterCLI] Success! Exported manifest and ${processedFiles.length} files to ${outputDirResolved}`);
}

function generatePdfReport(outputDir, processedFiles, runId) {
  const pdfFiles = [];
  const jsonFiles = processedFiles.filter(f => f.endsWith('.json') && f !== 'manifest.json');
  if (jsonFiles.length === 0) {return pdfFiles;}

  try {
    // Buscar el primer JSON que parezca un reporte de calibración
    for (const f of jsonFiles) {
      const dataPath = path.join(outputDir, f);
      const content = fs.readFileSync(dataPath, 'utf8');
      let data;
      try { data = JSON.parse(content); } catch { continue; }

      // Detectar si es un snapshot de calibración
      const hasRunId = data.runId || data.session?.runId;
      const hasItems = Array.isArray(data.items) || Array.isArray(data.session?.items);
      if (!hasRunId && !hasItems) {continue;}

      const { jsPDF } = require('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const margin = 10;
      let y = margin;

      const w = (t) => { doc.text(t, margin, y); y += 7; };
      const l = (label, value) => { doc.setFontSize(10); doc.text(`${label}: ${value}`, margin + 2, y); y += 5; };

      doc.setFontSize(20);
      w('Calibration Run Report');

      const runIdVal = data.runId || data.session?.runId || runId || 'N/A';
      l('Run ID', runIdVal);
      l('Exported At', data.exportedAt || 'N/A');
      if (data.config?.sourceScope) {l('Source Scope', data.config.sourceScope);}
      if (data.progress) {l('Completion', `${data.progress.pct}%`);}

      if (data.statusCounts) {
        y += 3;
        doc.setFontSize(12);
        w('Status Summary');
        for (const [st, count] of Object.entries(data.statusCounts)) {
          l(`  ${st}`, String(count));
        }
      }

      const items = data.items || data.session?.items || [];
      if (items.length > 0) {
        y += 3;
        doc.setFontSize(12);
        w(`Items (${items.length})`);
        doc.setFontSize(8);

        const cols = ['#', 'Bank', 'Patch', 'Status'];
        const colW = [10, 35, 55, 20];
        let cx = margin;

        doc.setFillColor(240, 240, 240);
        cols.forEach((c, i) => {
          doc.rect(cx, y - 2, colW[i], 6, 'F');
          doc.text(c, cx + 1, y + 2);
          cx += colW[i];
        });
        y += 6;

        for (const item of items) {
          if (y > 280) { doc.addPage(); y = margin; }
          cx = margin;
          doc.text(String((item.index ?? 0) + 1), cx + 1, y + 3); cx += colW[0];
          doc.text(String(item.bankName || '').slice(0, 16), cx + 1, y + 3); cx += colW[1];
          doc.text(String(item.patchName || '').slice(0, 25), cx + 1, y + 3); cx += colW[2];
          doc.text(item.status || 'pending', cx + 1, y + 3);
          y += 5;
        }
      }

      // Footer
      for (let i = 1; i <= doc.internal.getNumberOfPages(); i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Generated by ABDEep Calibration Lab — Page ${i} / ${doc.internal.getNumberOfPages()}`, margin, 290);
      }

      const pdfName = f.replace(/\.json$/i, '.pdf');
      const pdfPath = path.join(outputDir, pdfName);
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      fs.writeFileSync(pdfPath, pdfBuffer);
      pdfFiles.push(pdfName);
      console.log(`[CalibrationExporterCLI] Generated PDF report: ${pdfName}`);
      break; // Solo un PDF por run
    }
  } catch (err) {
    console.warn(`[CalibrationExporterCLI] PDF generation skipped (${err.message})`);
  }
  return pdfFiles;
}

if (require.main === module) {
  run();
}

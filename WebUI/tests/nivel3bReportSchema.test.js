// WebUI/tests/nivel3bReportSchema.test.js
// Valida el esquema de los reportes de hardware-in-the-loop (docs/reports/nivel3b-*.json)
// y que el doc docs/fase4_nivel3b_hardware_in_the_loop.md referencie el reporte MÁS RECIENTE.
//
// Contrato (plan v3.2 §5, Nivel 3b):
//   - schema: "nivel3b-report" · schemaVersion >= 1 · corrida en formato YYYY-MM-DD
//   - fases A–D (+ variantes B_webui/C_webui) con titulo/descripcion/resultado/detalle
//   - checklistRelease A–E con estado ∈ {verificado, parcial, pendiente}
//   - restauracion con detalle.filter.cutoff y nombre, coincideConBaseline === true
//   - el doc del Nivel 3b debe apuntar al reporte con la fecha más reciente del directorio
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const REPORTS_DIR = path.join(ROOT, 'docs', 'reports');
const NIVEL3B_DOC = path.join(ROOT, 'docs', 'fase4_nivel3b_hardware_in_the_loop.md');
const DUMPS_ROOT = path.join(ROOT, 'resources', 'hardware_dumps');

/** Lista los reportes nivel3b-*.json con su fecha YYYYMMDD extraída del nombre. */
function listNivel3bReports() {
  if (!fs.existsSync(REPORTS_DIR)) { return []; }
  return fs.readdirSync(REPORTS_DIR)
    .filter((f) => /^nivel3b-\d{8}\.json$/.test(f))
    .map((f) => {
      const m = f.match(/^nivel3b-(\d{8})\.json$/);
      return { file: f, date: m[1] };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Lista los directorios de dumps con su fecha (YYYYMMDD o YYYY-MM-DD), más reciente al final. */
function listDumpDirs() {
  if (!fs.existsSync(DUMPS_ROOT)) { return []; }
  return fs.readdirSync(DUMPS_ROOT)
    .filter((d) => /^\d{8}$/.test(d) || /^\d{4}-\d{2}-\d{2}$/.test(d))
    .map((d) => ({ dir: d, date: d.replace(/-/g, '') }))
    .filter((x) => fs.statSync(path.join(DUMPS_ROOT, x.dir)).isDirectory())
    .sort((a, b) => a.date.localeCompare(b.date));
}

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// Carga compartida: el reporte más reciente (necesario en ambos describes — el de
// docs/reports y el de resources/hardware_dumps para cruzar fechas).
const reports = listNivel3bReports();

/** Carga el reporte más reciente (helper lazy para mensajes de error claros). */
function loadLatestReport() {
  if (reports.length === 0) {
    throw new Error('no hay reportes nivel3b-*.json en docs/reports/');
  }
  const latest = reports[reports.length - 1];
  return JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, latest.file), 'utf8'));
}

const report = loadLatestReport();
const latest = reports[reports.length - 1];
const docText = fs.existsSync(NIVEL3B_DOC) ? fs.readFileSync(NIVEL3B_DOC, 'utf8') : '';

describe('docs/reports/nivel3b-*.json — esquema del reporte hardware-in-the-loop', () => {
  it('existe al menos un reporte nivel3b-YYYYMMDD.json', () => {
    expect(reports.length).toBeGreaterThan(0);
  });

  describe('raíz del reporte', () => {
    it('tiene schema="nivel3b-report" y schemaVersion numérico', () => {
      expect(report.schema).toBe('nivel3b-report');
      expect(typeof report.schemaVersion).toBe('number');
      expect(report.schemaVersion).toBeGreaterThanOrEqual(1);
    });

    it('corrida tiene formato YYYY-MM-DD coherente con el nombre del archivo', () => {
      expect(report.corrida).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(report.corrida.replace(/-/g, '')).toBe(latest.date);
    });

    it('declara hardware con modelo y deviceId numérico', () => {
      expect(typeof report.hardware).toBe('object');
      expect(typeof report.hardware.modelo).toBe('string');
      expect(report.hardware.modelo.length).toBeGreaterThan(0);
      expect(typeof report.hardware.deviceId).toBe('number');
      expect(report.hardware.deviceId).toBeGreaterThanOrEqual(0);
    });

    it('resumen declara fases_completadas no vacío y hallazgos', () => {
      expect(Array.isArray(report.resumen.fases_completadas)).toBe(true);
      expect(report.resumen.fases_completadas.length).toBeGreaterThan(0);
      expect(Array.isArray(report.resumen.hallazgos)).toBe(true);
    });

    it('invariante de cruce: fases_completadas ⊆ claves de fases', () => {
      for (const fase of report.resumen.fases_completadas) {
        expect(report.fases[fase], `fase "${fase}" declarada completada sin detalle en fases`).toBeDefined();
      }
    });

    it('herramientasUsadas incluye el harness de round-trip WebUI', () => {
      expect(Array.isArray(report.herramientasUsadas)).toBe(true);
      expect(report.herramientasUsadas).toContain('scripts/hw_roundtrip_validate.js');
    });
  });

  describe('fases A–D (+ B_webui/C_webui)', () => {
    it.each(['A', 'B', 'C', 'D', 'B_webui', 'C_webui'])(
      'la fase %s tiene titulo, descripcion, resultado y detalle',
      (fase) => {
        expect(report.fases[fase]).toBeDefined();
        expect(typeof report.fases[fase].titulo).toBe('string');
        expect(report.fases[fase].titulo.length).toBeGreaterThan(0);
        expect(typeof report.fases[fase].descripcion).toBe('string');
        expect(typeof report.fases[fase].resultado).toBe('string');
        expect(report.fases[fase].resultado.length).toBeGreaterThan(0);
        expect(typeof report.fases[fase].detalle).toBe('object');
      }
    );

    it('B_webui registra 15/15 pasos del harness (round-trip + transacciones + restauración)', () => {
      const d = report.fases.B_webui.detalle;
      expect(typeof d.pasos).toBe('number');
      expect(typeof d.pasosOk).toBe('number');
      expect(d.pasosOk).toBe(d.pasos);
      // El reporte es un SNAPSHOT commiteado de la corrida del 2026-08-10: el
      // harness tenía 15 pasos en el camino feliz. Exacto a propósito: si el
      // harness gana pasos, el reporte debe actualizarse (no romper el test).
      expect(d.pasos).toBe(15);
      expect(d.validateSinglePatchSysexRoundTrip).toBe('transport=true patch=true mismatches=0');
      expect(d.payloadEnviadoVsVuelto).toMatch(/242\/242/);
    });

    it('C_webui documenta el hallazgo: DM12 no re-emite NRPN', () => {
      expect(report.fases.C_webui.detalle.hallazgoClave).toMatch(/NO re-emite NRPN/i);
      expect(report.fases.C_webui.detalle.ttlTimeout).toBe('status=out_of_sync tras sweep');
    });
  });

  describe('restauración del hardware', () => {
    it('declara estado y detalle con cutoff=42 y nombre "Blue Dolphin BC"', () => {
      expect(typeof report.restauracion).toBe('object');
      expect(typeof report.restauracion.estado).toBe('string');
      expect(report.restauracion.detalle['filter.cutoff']).toBe(42);
      expect(report.restauracion.detalle.nombre).toContain('Blue Dolphin BC');
      expect(report.restauracion.detalle.coincideConBaseline).toBe(true);
    });
  });

  describe('checklistRelease A–E', () => {
    it.each(['A_baseline', 'B_roundtrip', 'C_nrpn', 'D_nombre', 'E_cierre'])(
      'la sección %s tiene estado válido y listas verificado/pendiente',
      (seccion) => {
        const c = report.checklistRelease[seccion];
        expect(c).toBeDefined();
        expect(['verificado', 'parcial', 'pendiente']).toContain(c.estado);
        expect(Array.isArray(c.verificado)).toBe(true);
        expect(Array.isArray(c.pendiente)).toBe(true);
        expect(c.verificado.length).toBeGreaterThan(0);
      }
    );

    it('E_cierre refleja la validación WebUI ya realizada (harness en verificado)', () => {
      const e = report.checklistRelease.E_cierre;
      expect(e.verificado.join('\n')).toContain('hw_roundtrip_validate.js');
      expect(e.pendiente.join('\n')).not.toMatch(/validacion via WebUI real/i);
    });
  });

  describe('el doc del Nivel 3b referencia el reporte más reciente', () => {
    it('el doc menciona el reporte más reciente por su ruta completa', () => {
      expect(docText).toContain(`docs/reports/${latest.file}`);
    });

    it('la sección "Registro de ejecución" del doc usa el reporte más reciente', () => {
      const regSec = docText.split('## 6.')[1] || '';
      expect(regSec).toContain(`docs/reports/${latest.file}`);
    });

    it('la fecha del reporte más reciente coincide con la fecha de la última corrida del doc', () => {
      // Cabecera canónica de la sección 6: "## 6. Registro de ejecución — YYYY-MM-DD (...)".
      const heading = /^## 6\. Registro de ejecución — (\d{4}-\d{2}-\d{2})/m.exec(docText);
      expect(heading, 'heading "## 6. Registro de ejecución — YYYY-MM-DD" no encontrado').not.toBeNull();
      const docRunDate = heading[1];
      // La fecha del reporte más reciente (del nombre del archivo) debe ser la
      // misma corrida que el doc declara como la última (anti-drift reporte ↔ doc).
      expect(docRunDate).toBe(report.corrida);
      expect(docRunDate.replace(/-/g, '')).toBe(latest.date);
    });
  });
});

describe('resources/hardware_dumps/ — manifest.json y SHA-256 por banco', () => {
  const dumpDirs = listDumpDirs();

  it('existe al menos un directorio de dumps YYYY-MM-DD', () => {
    expect(dumpDirs.length).toBeGreaterThan(0);
  });

  // Guard con mensaje claro (patrón de loadLatestReport): un fallo por ausencia
  // de directorios produce un error descriptivo, no un TypeError en cascada.
  if (dumpDirs.length === 0) {
    throw new Error('no hay directorios de dumps en resources/hardware_dumps/ (YYYY-MM-DD)');
  }
  const latestDump = dumpDirs[dumpDirs.length - 1];
  const manifestPath = path.join(DUMPS_ROOT, latestDump.dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json no encontrado en ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  it('el manifest.json del directorio más reciente existe y parsea', () => {
    expect(manifest).not.toBeNull();
  });

  it('esquema raíz: schemaVersion, kind hardware-bank-dumps y fecha coherente con el dir', () => {
    expect(manifest.schemaVersion).toBeGreaterThanOrEqual(1);
    expect(manifest.kind).toBe('hardware-bank-dumps');
    expect(manifest.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(manifest.fecha.replace(/-/g, '')).toBe(latestDump.date);
  });

  it('declara hardware y procedimiento', () => {
    expect(typeof manifest.hardware).toBe('object');
    expect(typeof manifest.hardware.modelo).toBe('string');
    expect(manifest.hardware.modelo.length).toBeGreaterThan(0);
    expect(typeof manifest.procedimiento).toBe('string');
    expect(manifest.procedimiento).toContain('hw_bank_dump.js');
  });

  it('resumen declara bancos=8, presets=1024 y divergencias con known_exception', () => {
    expect(manifest.resumen.bancos).toBe(8);
    expect(manifest.resumen.presets).toBe(1024);
    expect(Array.isArray(manifest.resumen.divergencias)).toBe(true);
    const b1 = manifest.resumen.divergencias.find((d) => d.banco === 'B' && d.prog === 1);
    expect(b1).toBeDefined();
    expect(b1.clasificacion).toBe('known_exception');
    expect(b1.diffBytes).toBe(2);
  });

  it('banks cubre A–H con rawSha256/normalizedSha256/size/payloadDiffPrograms', () => {
    expect(Object.keys(manifest.banks).sort().join('')).toBe('ABCDEFGH');
    for (const L of 'ABCDEFGH') {
      const b = manifest.banks[L];
      expect(b).toBeDefined();
      expect(b.rawSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(b.normalizedSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(b.size).toBe(37248);
      expect(Array.isArray(b.payloadDiffPrograms)).toBe(true);
    }
  });

  it('los SHA-256 reales de los 8 .syx coinciden con manifest.banks (dumps no alterados)', () => {
    for (const L of 'ABCDEFGH') {
      const file = path.join(DUMPS_ROOT, latestDump.dir, `Synth Bank ${L}.syx`);
      expect(fs.existsSync(file), `falta ${file}`).toBe(true);
      const actual = sha256Hex(fs.readFileSync(file));
      expect(actual, `SHA-256 del banco ${L} no coincide con manifest.json`).toBe(manifest.banks[L].rawSha256);
    }
  });

  it('solo B/1 registra la divergencia de 2 bytes (known_exception); el resto no tiene diffs', () => {
    for (const L of 'ABCDEFGH') {
      const expected = L === 'B' ? [{ prog: 1, diffBytes: 2 }] : [];
      expect(manifest.banks[L].payloadDiffPrograms).toEqual(expected);
    }
  });

  it('el directorio de dumps más reciente coincide con la corrida del reporte más reciente', () => {
    expect(manifest.fecha).toBe(report.corrida);
  });
});

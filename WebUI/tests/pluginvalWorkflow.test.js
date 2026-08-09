/**
 * pluginvalWorkflow.test.js — Fase 7 · job CI pluginval (último pendiente)
 *
 * Guard del workflow .github/workflows/pluginval.yml (la validación real la
 * ejecuta pluginval en el runner; aquí se blinda la configuración del job):
 *   - Runner windows-2022 y target de build ABDEep_Standalone_VST3.
 *   - pluginval PINNEA a v1.0.4 (determinismo CI, como JUCE 8.0.12 y Emscripten
 *     3.1.64) con asset pluginval_Windows.zip.
 *   - Invocación canónica del repo (scripts/verify_release.ps1):
 *     --strictness-level 5 --seed 42 --validate "<vst3>".
 *   - Localización del VST3 con el glob *_artefacts/Release/VST3/*.vst3.
 *   - Anotaciones ::error::pluginval en fallo (patrón Fase 7).
 *
 * Sin parser YAML en devDependencies, se validan invariantes de contenido del
 * archivo (mismo enfoque que los guards de workflows previos, p. ej. el check
 * `if !` de registry-generation.yml verificado con grep en bash).
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const WF = path.join(ROOT, '.github', 'workflows', 'pluginval.yml');

const yml = fs.readFileSync(WF, 'utf8');

describe('.github/workflows/pluginval.yml — job pluginval (Fase 7)', () => {
  it('runner windows-2022 y target de build VST3 correcto', () => {
    expect(yml).toContain('runs-on: windows-2022');
    expect(yml).toContain('cmake --build build --config Release --target ABDEep_Standalone_VST3');
    // El build debe usar el mismo modelo Enhanced que el resto del pipeline
    expect(yml).toContain('-DDEEP_TARGET_MODEL=2');
  });

  it('pluginval pinneda a v1.0.4 (determinismo) con asset Windows', () => {
    expect(yml).toContain(
      'https://github.com/Tracktion/pluginval/releases/download/v1.0.4/pluginval_Windows.zip'
    );
    // El comentario del workflow debe documentar el pinning (convención Fase 7)
    expect(yml).toMatch(/PINNEA.*v1\.0\.4/);
  });

  it('invocación canónica: strictness 5, seed 42, --validate (verify_release.ps1)', () => {
    expect(yml).toContain('--strictness-level 5');
    expect(yml).toContain('--seed 42');
    expect(yml).toContain('--validate $vst3.FullName');
  });

  it('localiza el VST3 con el glob *_artefacts/Release/VST3/*.vst3', () => {
    expect(yml).toContain('Get-ChildItem "build\\*_artefacts\\Release\\VST3\\*.vst3"');
  });

  it('la validación corre en pwsh (mismo shell que la descarga y verify_release.ps1)', () => {
    expect(yml).toContain('shell: pwsh');
    expect(yml).toContain('$env:RUNNER_TEMP\\pluginval');
    expect(yml).toContain('& $pv.FullName --strictness-level 5 --seed 42 --validate $vst3.FullName *> pluginval.log');
  });

  it('falla con ::error::pluginval si la validación no pasa', () => {
    expect(yml).toContain('::error::pluginval');
    expect(yml).toContain('exit $LASTEXITCODE');
  });

  it('descarga el zip de pluginval y extrae pluginval.exe en RUNNER_TEMP', () => {
    expect(yml).toContain('Invoke-WebRequest');
    expect(yml).toContain('pluginval_Windows.zip');
    expect(yml).toContain('Expand-Archive');
    expect(yml).toContain('pluginval.exe');
  });

  it('usa el patrón Fase 7: concurrency group + permissions contents: read', () => {
    expect(yml).toContain('group: pluginval-${{ github.ref }}');
    expect(yml).toContain('permissions:');
    expect(yml).toContain('contents: read');
  });
});

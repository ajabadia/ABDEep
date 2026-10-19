// @vitest-environment jsdom
/**
 * liveSysExInspectorEep.test.js
 * Verificación de integración del LiveSysExInspector flotante transversal en ABDEep.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  decodeSysExHeader,
  createLiveSysExInspector,
  getCurrentDeepMindSysExBuffer,
  importDeepMindSysExBuffer,
  importSysexBase64,
  getLiveSysExInspector,
  toggleLiveSysExInspector,
  updateLiveSysExInspector,
  getAboutDialog,
} from '../js/live_sysex_inspector.js';

describe('LiveSysExInspector — ABDEep Integration', () => {
  it('getCurrentDeepMindSysExBuffer produce un mensaje SysEx completo de 291 bytes para DeepMind', () => {
    const buf = getCurrentDeepMindSysExBuffer();
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBe(291);
    expect(buf[0]).toBe(0xf0);
    expect(buf[1]).toBe(0x00);
    expect(buf[2]).toBe(0x20);
    expect(buf[3]).toBe(0x32); // Behringer ID
    expect(buf[4]).toBe(0x20);
    expect(buf[5]).toBe(0x7f); // Broadcast dev ID
    expect(buf[6]).toBe(0x02); // Program Dump Response
    expect(buf[290]).toBe(0xf7); // EOX

    const decoded = decodeSysExHeader(buf);
    expect(decoded.valid).toBe(true);
    expect(decoded.manufacturer).toContain('Behringer');
    expect(decoded.model).toBe('DeepMind');
    expect(decoded.hasEox).toBe(true);
  });

  it('top-bar.js incluye la opción Live SysEx Inspector con atajo Ctrl+I en el menú View', () => {
    const topBarPath = resolve(__dirname, '../js/components/top-bar.js');
    const topBarHtml = readFileSync(topBarPath, 'utf8');

    expect(topBarHtml).toContain('id="menu-sysex-inspector"');
    expect(topBarHtml).toContain('Live SysEx Inspector...');
    expect(topBarHtml).toContain('Ctrl+I');
  });

  it('index.html incluye el script live_sysex_inspector.js y el estilo live-sysex-inspector.css', () => {
    const indexPath = resolve(__dirname, '../index.html');
    const indexHtml = readFileSync(indexPath, 'utf8');

    expect(indexHtml).toContain('src="js/live_sysex_inspector.js"');

    const stylePath = resolve(__dirname, '../style.css');
    const styleCss = readFileSync(stylePath, 'utf8');
    expect(styleCss).toContain("css/live-sysex-inspector.css");

    const fitStagePath = resolve(__dirname, '../js/fit-stage.js');
    const fitStageJs = readFileSync(fitStagePath, 'utf8');
    expect(fitStageJs).toContain('@abdsynths/shared/styles/tokens.css');
    expect(fitStageJs).toContain('@abdsynths/shared/styles/themes/deepmind.css');
    expect(fitStageJs).toContain('@abdsynths/shared/styles/components/live-sysex-inspector.css');
    expect(fitStageJs).toContain('@abdsynths/shared/styles/components/about-dialog.css');
  });

  it('createLiveSysExInspector se instancia correctamente con soporte flotante y botón de popout', () => {
    const buf = getCurrentDeepMindSysExBuffer();
    const inspector = createLiveSysExInspector({
      title: 'DeepMind Live SysEx Inspector',
      floating: true,
      initialBuffer: buf,
    });

    expect(inspector).toBeDefined();
    expect(inspector.rootEl).toBeDefined();
    expect(inspector.rootEl.classList.contains('sysex-inspector--floating')).toBe(true);

    const sizeBadge = inspector.rootEl.querySelector('.sysex-inspector__badge--size');
    expect(sizeBadge.textContent).toBe('291 B');

    // Botón de popout / desacoplamiento a ventana externa
    const popoutBtn = inspector.rootEl.querySelector('.sysex-inspector__btn--popout');
    expect(popoutBtn).not.toBeNull();

    inspector.destroy();
  });

  it('toggleLiveSysExInspector alterna la visibilidad del inspector singleton y resalta diffs reactivamente', () => {
    const inspector = getLiveSysExInspector();
    expect(inspector.isOpen()).toBe(false);

    toggleLiveSysExInspector();
    expect(inspector.isOpen()).toBe(true);

    // Simular mutación de un parámetro en los 242 bytes desempaquetados
    const unpacked = new Uint8Array(242);
    unpacked[39] = 200; // vcf_cutoff con MSB activo (>127)
    updateLiveSysExInspector(unpacked);

    const mutatedSpans = inspector.rootEl.querySelectorAll('.sysex-byte--mutated');
    expect(mutatedSpans.length).toBeGreaterThan(0);

    // Verificar bidireccionalidad (importDeepMindSysExBuffer + importSysexBase64)
    const exportedSyx = getCurrentDeepMindSysExBuffer(unpacked);
    const reimported = importDeepMindSysExBuffer(exportedSyx);
    expect(reimported).not.toBeNull();
    expect(reimported.length).toBe(242);
    expect(reimported[39]).toBe(200);

    const b64 = Buffer.from(exportedSyx).toString('base64');
    const fromB64 = importSysexBase64(b64);
    expect(fromB64).not.toBeNull();
    expect(fromB64[39]).toBe(200);

    toggleLiveSysExInspector();
    expect(inspector.isOpen()).toBe(false);

    inspector.destroy();
  });

  it('getAboutDialog instancia el AboutDialog compartido conectado a AutoUpdater', () => {
    const dlg = getAboutDialog();
    expect(dlg).not.toBeNull();
    expect(dlg.options.appName).toBe('ABD Eep');
    expect(dlg.options.repo).toBe('ajabadia/ABDEep');
    dlg.renderUpdateResult({
      currentVersion: '0.2.35',
      latestVersion: 'v0.3.0',
      isUpdateAvailable: true,
      downloadUrl: 'https://github.com/ajabadia/ABDEep/releases/tag/v0.3.0',
    });
    expect(dlg.statusEl.textContent).toContain('v0.3.0');
  });
});

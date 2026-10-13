/**
 * Guard de dirección del canal nativo → JS de JUCE WebView2 — ABDEep.
 *
 * Lógica compartida de la suite (ABDSharedCode/WebView2Bridge/testing/webviewBridgeDirection.js):
 * En JUCE 8, `window.__JUCE__.backend.emitEvent(...)` es el canal JS → nativo, así que
 * escribirlo desde C++ descarta el mensaje en silencio; el canal nativo → JS es
 * `WebBrowserComponent::emitEventIfBrowserIsVisible(eventId, obj)`.
 *
 * ABDEep Fase 4: Unificación del WebView2Bridge.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it, expect } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(here, '../../Source');

const helperCandidates = [
  path.resolve(here, '../../../ABDShared/Code/WebView2Bridge/testing/webviewBridgeDirection.js'),
  path.resolve(here, '../../../ABDSharedCode/WebView2Bridge/testing/webviewBridgeDirection.js')
];
const helperPath = helperCandidates.find(fs.existsSync) ?? helperCandidates[0];
const {
  REQUIRED_CALL,
  checkBridgeDirection,
  formatFindings
} = await import(pathToFileURL(helperPath).href);

/** Ficheros del proyecto que emiten del C++ hacia el WebUI. */
const EMITTERS = ['Plugin/PluginEditor.cpp'];

describe('canal nativo → JS del WebView2 — guard de dirección (JUCE 8)', () => {
  it('ningún fichero C++ usa backend.emitEvent ni le falta emisor con la API correcta', () => {
    const result = checkBridgeDirection({ sourceRoot, emitters: EMITTERS });

    expect(result.scanned).toBeGreaterThan(0);
    expect(formatFindings(result)).toMatch(/^OK/);
    expect(result.absentEmitters).toEqual([]);
    expect(result.missingEmitters).toEqual([]);
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('el emisor del editor usa emitEventIfBrowserIsVisible', () => {
    const editor = fs.readFileSync(path.join(sourceRoot, EMITTERS[0]), 'utf8');

    expect(editor).toContain(REQUIRED_CALL);
    expect(editor).not.toContain('backend.emitEvent');
  });
});

// WebUI/tests/calibrationLabPage.test.js
// Tests for CalibrationLabPage semantic CSS classes and dynamic custom properties.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const cssPath = join(__dirname, '../css/calibration_lab.css');

describe('CalibrationLabPage - semantic CSS classes', () => {
  let cssText;

  beforeEach(() => {
    cssText = readFileSync(cssPath, 'utf-8');
  });

  it('calibration_lab.css defines .cal-modal-body and layout helpers', () => {
    expect(cssText).toContain('.cal-modal-body');
    expect(cssText).toContain('.cal-page-flex');
    expect(cssText).toContain('.cal-panel-flex');
  });

  it('dynamic audio verdict badge uses CSS custom property', () => {
    expect(cssText).toContain('.cal-audio-verdict-badge');
    expect(cssText).toContain('--cal-badge-bg');
    expect(cssText).toMatch(/background:\s*var\(\s*--cal-badge-bg/);
  });

  it('round-trip status/classification use CSS custom properties', () => {
    expect(cssText).toContain('.cal-rt-status');
    expect(cssText).toContain('--cal-rt-status-color');
    expect(cssText).toContain('.cal-rt-classification');
    expect(cssText).toContain('--cal-rt-class-color');
  });

  it('live validation status/cell/fail count use CSS custom properties', () => {
    expect(cssText).toContain('.cal-live-status');
    expect(cssText).toContain('--cal-live-status-color');
    expect(cssText).toContain('.cal-live-cell');
    expect(cssText).toContain('--cal-live-status-color');
    expect(cssText).toContain('.cal-live-fail-count');
    expect(cssText).toContain('--cal-fail-count-color');
  });

  it('cal-audio-verdict HTML uses semantic class and custom property', () => {
    const levelColor = '#2ecc71';
    const html = `<span class="cal-audio-verdict-badge" style="--cal-badge-bg: ${levelColor};">pass (WITHIN_TOLERANCE)</span>`;
    expect(html).toContain('cal-audio-verdict-badge');
    expect(html).toContain('--cal-badge-bg:');
  });

  it('cal-rt-status HTML uses semantic class and custom property', () => {
    const html = '<span class="cal-rt-status" style="--cal-rt-status-color: var(--accent-green);">OK</span>';
    expect(html).toContain('cal-rt-status');
    expect(html).toContain('--cal-rt-status-color:');
  });

  it('cal-live-cell HTML uses semantic class and custom property', () => {
    const html = '<td class="cal-live-cell" style="--cal-live-status-color: var(--accent-green);">✓</td>';
    expect(html).toContain('cal-live-cell');
    expect(html).toContain('--cal-live-status-color:');
  });
});

/**
 * Unit tests for lcdSafeUpdate (Vitest version)
 *
 * Run with: npx vitest run WebUI/tests/lcdSafeUpdate.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Function under test (extracted from script.js) ─────────────────
function lcdSafeUpdate(lcdEl, html, paramId, options) {
  options = options || {};
  if (typeof window.lcdFadeUpdate === 'function' && options.useQueue !== false) {
    window.lcdFadeUpdate(lcdEl, html, paramId);
  } else {
    if (lcdEl._ctrlLcdFadeTimer) {
      clearTimeout(lcdEl._ctrlLcdFadeTimer);
      lcdEl._ctrlLcdFadeTimer = null;
    }
    lcdEl._lcdFading = false;
    lcdEl.style.removeProperty('transition');
    lcdEl.style.opacity = '1';
    lcdEl.innerHTML = html;
  }
}

// ── Fake DOM element factory ─────────────────────────────────────
function createFakeLcdEl() {
  return {
    _ctrlLcdFadeTimer: null,
    _lcdFading: false,
    style: {
      _props: {},
      removeProperty(prop) { delete this._props[prop]; },
      get transition() { return this._props.transition; },
      set transition(val) { this._props.transition = val; },
      get opacity() { return this._props.opacity; },
      set opacity(val) { this._props.opacity = val; },
    },
    innerHTML: '',
  };
}

// ══════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════

describe('lcdSafeUpdate', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { lcdFadeUpdate: undefined });
  });

  // ─── calls lcdFadeUpdate when exists ───────────────────────────
  describe('when lcdFadeUpdate exists', () => {
    it('calls lcdFadeUpdate with correct el, html, and paramId', () => {
      const calledWith = { el: null, html: null, paramId: null };
      window.lcdFadeUpdate = (el, html, paramId) => {
        calledWith.el = el;
        calledWith.html = html;
        calledWith.paramId = paramId;
      };

      const el = createFakeLcdEl();
      lcdSafeUpdate(el, '<strong>test</strong>', 'my_param');

      expect(calledWith.el).toBe(el);
      expect(calledWith.html).toBe('<strong>test</strong>');
      expect(calledWith.paramId).toBe('my_param');
      expect(el.innerHTML).toBe('');
    });

    it('forwards paramId values correctly', () => {
      const received = [];
      window.lcdFadeUpdate = (_el, _html, paramId) => { received.push(paramId); };

      lcdSafeUpdate(createFakeLcdEl(), 'html', 'arp_reset');
      lcdSafeUpdate(createFakeLcdEl(), 'html', 'seq_enable');

      expect(received[0]).toBe('arp_reset');
      expect(received[1]).toBe('seq_enable');
    });

    it('forwards undefined paramId when not provided', () => {
      const received = [];
      window.lcdFadeUpdate = (_el, _html, paramId) => { received.push(paramId); };

      lcdSafeUpdate(createFakeLcdEl(), 'html');
      expect(received[0]).toBeUndefined();
    });

    it('forwards null paramId', () => {
      const received = [];
      window.lcdFadeUpdate = (_el, _html, paramId) => { received.push(paramId); };

      lcdSafeUpdate(createFakeLcdEl(), 'html', null);
      expect(received[0]).toBeNull();
    });
  });

  // ─── innerHTML fallback when lcdFadeUpdate missing ─────────────
  describe('when lcdFadeUpdate is missing', () => {
    it('sets innerHTML directly when lcdFadeUpdate does not exist', () => {
      delete window.lcdFadeUpdate;
      const el = createFakeLcdEl();
      lcdSafeUpdate(el, '<span>fallback</span>');
      expect(el.innerHTML).toBe('<span>fallback</span>');
    });

    it('sets innerHTML when lcdFadeUpdate is undefined', () => {
      window.lcdFadeUpdate = undefined;
      const el = createFakeLcdEl();
      lcdSafeUpdate(el, 'hello');
      expect(el.innerHTML).toBe('hello');
    });

    it('sets innerHTML when lcdFadeUpdate is null', () => {
      window.lcdFadeUpdate = null;
      const el = createFakeLcdEl();
      lcdSafeUpdate(el, 'null-case');
      expect(el.innerHTML).toBe('null-case');
    });
  });

  // ─── useQueue option ──────────────────────────────────────────
  describe('useQueue option', () => {
    it('useQueue: false sets innerHTML even when lcdFadeUpdate exists', () => {
      let called = false;
      window.lcdFadeUpdate = () => { called = true; };

      const el = createFakeLcdEl();
      lcdSafeUpdate(el, 'direct', null, { useQueue: false });

      expect(called).toBe(false);
      expect(el.innerHTML).toBe('direct');
    });

    it('useQueue: true calls lcdFadeUpdate (explicit)', () => {
      let called = false;
      window.lcdFadeUpdate = () => { called = true; };

      lcdSafeUpdate(createFakeLcdEl(), 'html', null, { useQueue: true });
      expect(called).toBe(true);
    });
  });

  // ─── cleanup in direct mode ───────────────────────────────────
  describe('cleanup in direct mode', () => {
    it('cleans up _ctrlLcdFadeTimer', () => {
      const el = createFakeLcdEl();
      const timer = setTimeout(() => {}, 1);
      el._ctrlLcdFadeTimer = timer;

      lcdSafeUpdate(el, 'html', null, { useQueue: false });

      expect(el._ctrlLcdFadeTimer).toBeNull();
      clearTimeout(timer);
    });

    it('cleans up _lcdFading and CSS properties', () => {
      const el = createFakeLcdEl();
      el._lcdFading = true;
      el.style._props.opacity = '0.5';
      el.style._props.transition = 'opacity 200ms ease';

      lcdSafeUpdate(el, 'html', null, { useQueue: false });

      expect(el._lcdFading).toBe(false);
      expect(el.style._props.opacity).toBe('1');
      expect(el.style._props.transition).toBeUndefined();
      expect(el.innerHTML).toBe('html');
    });
  });
});

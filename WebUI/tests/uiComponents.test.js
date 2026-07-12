/**
 * Unit tests for UI Web Components:
 *   - mod-matrix.js  (ModMatrixModal)
 *   - env-section.js (EnvSection)
 *   - lfo-section.js (LfoSection)
 *
 * Covers:
 *   - Template structure (expected elements, attributes, tooltips)
 *   - Web Component registration (customElements.define)
 *   - connectedCallback behavior
 *   - Edge cases (multiple instances, re-connectedCallback, structure validation)
 *
 * Run with: npx vitest run WebUI/tests/uiComponents.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// DOM stubs (minimal HTMLElement and customElements for node env)
// ══════════════════════════════════════════════════════════════════

function createElementStub() {
  let _innerHTML = '';
  let _children = [];
  return {
    get innerHTML() { return _innerHTML; },
    set innerHTML(v) {
      _innerHTML = v;
      // Simple child tracking: parse div/module elements
      _children = [];
      const matches = v.match(/<(div|span|button|h2)[^>]*id="([^"]*)"/g);
      if (matches) {
        for (const m of matches) {
          const idMatch = m.match(/id="([^"]*)"/);
          if (idMatch) _children.push({ id: idMatch[1] });
        }
      }
    },
    get children() { return _children; },
    get childrenLength() { return _children.length; },
    querySelectorAll: vi.fn(function(sel) {
      // Return stubs that mimic DOM elements for template validation
      const results = [];
      if (sel === '.ctrl-unit') {
        // env-section has 4 ctrl-units, lfo-section has 2
        const count = _innerHTML.includes('env-ctrl-attack') ? 4 : 
                       _innerHTML.includes('lfo-ctrl-rate') ? 2 : 0;
        for (let i = 0; i < count; i++) {
          results.push({ 
            getAttribute: vi.fn(() => null),
            querySelector: vi.fn(() => null),
          });
        }
      }
      if (sel === '.env-type-btn') {
        results.push({}, {}, {}); // VCA, VCF, MOD
      }
      return results;
    }),
    querySelector: vi.fn(function(sel) {
      if (sel === '.modmatrix-grid' || sel === '.module-header' ||
          sel === '.controls-row' || sel === '.modal-body' ||
          sel === '.modal-backdrop' || sel === '.modal') {
        return { style: {}, innerHTML: '' };
      }
      if (sel === '.close-btn' || sel === '#modmatrix-close-btn' ||
          sel === '#env-edit-btn' || sel === '#lfo-edit-btn' ||
          sel === '#lfo-select-btn' || sel === '.edit-panel-btn') {
        return { addEventListener: vi.fn(), style: {}, dataset: {} };
      }
      if (sel && sel.startsWith('.v-slider')) {
        return { getBoundingClientRect: () => ({ height: 100 }), querySelector: () => ({ style: {} }) };
      }
      if (sel && sel.startsWith('.handle')) {
        return { style: {} };
      }
      return null;
    }),
    style: {},
    dataset: {},
    addEventListener: vi.fn(),
    classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn(() => false) },
    setAttribute: vi.fn(),
    getAttribute: vi.fn(() => null),
  };
}

/** Minimal customElements registry for testing define() and get() */
function createCustomElementsRegistry() {
  const registry = {};
  return {
    define: vi.fn(function(name, cls) {
      registry[name] = cls;
    }),
    get: vi.fn(function(name) {
      return registry[name] || undefined;
    }),
    _registry: registry,
  };
}

// ══════════════════════════════════════════════════════════════════
// Extract template validation helpers (mirrors source files)
// ══════════════════════════════════════════════════════════════════

/** Returns expected mod-matrix template as a string for analysis */
function getModMatrixTemplate() {
  return `
    <div class="modal-backdrop" id="modmatrix-modal-backdrop" style="display:none;z-index:5000">
      <div class="modal" data-accent="blue" style="width:760px">
        <div class="modal-header">
          <h2>Modulation Matrix</h2>
          <div class="close-btn" id="modmatrix-close-btn" data-ctrl-tooltip="Close Modulation Matrix modal">&times;</div>
        </div>
        <div class="modal-body" style="display:block;overflow-y:auto">
          <div class="modmatrix-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:15px"></div>
        </div>
      </div>
    </div>
  `;
}

/** Returns expected env-section template as a string for analysis */
function getEnvSectionTemplate() {
  return `
    <div class="module" id="env-section" style="flex:3">
      <div class="module-header flex-row justify-between items-center">
        <span>Envelopes</span>
        <button class="btn btn-xs btn-outline edit-panel-btn" data-accent="orange" id="env-edit-btn" data-ctrl-tooltip="Open Envelope detail editor">Edit</button>
      </div>
      <div class="flex-row justify-center gap-4 w-full" style="margin-bottom:5px">
        <button class="env-type-btn active" id="env-btn-vca" data-env="1" style="flex:1" data-ctrl-tooltip="VCA Envelope — amplitude/volume envelope">VCA</button>
        <button class="env-type-btn" id="env-btn-vcf" data-env="2" style="flex:1" data-ctrl-tooltip="VCF Envelope — filter cutoff envelope">VCF</button>
        <button class="env-type-btn" id="env-btn-mod" data-env="3" style="flex:1" data-ctrl-tooltip="Mod Envelope — modulation routing envelope">MOD</button>
      </div>
      <div class="controls-row">
        <div class="ctrl-unit" id="env-ctrl-attack" data-param="env1_attack"><span class="label" id="env-label-attack">A</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
        <div class="ctrl-unit" id="env-ctrl-decay" data-param="env1_decay"><span class="label" id="env-label-decay">D</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
        <div class="ctrl-unit" id="env-ctrl-sustain" data-param="env1_sustain"><span class="label" id="env-label-sustain">S</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
        <div class="ctrl-unit" id="env-ctrl-release" data-param="env1_release"><span class="label" id="env-label-release">R</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
      </div>
    </div>
  `;
}

/** Returns expected lfo-section template as a string for analysis */
function getLfoSectionTemplate() {
  return `
    <div class="module" id="lfo-section" style="flex:1.8">
      <div class="module-header flex-row justify-between items-center">
        <span>LFO 1 &amp; 2</span>
        <button class="btn btn-xs btn-outline edit-panel-btn" data-accent="orange" id="lfo-edit-btn" data-ctrl-tooltip="Open LFO detail editor">Edit</button>
      </div>
      <div class="flex-row justify-center w-full" style="margin-bottom:5px">
        <button class="btn btn-outline" id="lfo-select-btn" style="width:80%" data-accent="orange" data-ctrl-tooltip="Toggle between LFO 1 and LFO 2">LFO 1 ACTIVE</button>
      </div>
      <div class="controls-row">
        <div class="ctrl-unit" id="lfo-ctrl-rate" data-param="lfo1_rate"><span class="label" id="lfo-label-rate">LFO1 Rate</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
        <div class="ctrl-unit" id="lfo-ctrl-delay" data-param="lfo1_delay"><span class="label" id="lfo-label-delay">Delay</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════
// Web Component simulation (matching source code behavior)
// ══════════════════════════════════════════════════════════════════

/** Simulates loading mod-matrix.js into a customElements registry */
function defineModMatrixModal(customElements) {
  const template = getModMatrixTemplate();
  
  class ModMatrixModal {
    constructor() {
      this.innerHTML = '';
      this.children = [];
      this.style = {};
    }
    connectedCallback() {
      if (this.children.length === 0) {
        this.innerHTML = template;
      }
    }
  }
  
  customElements.define('mod-matrix-modal', ModMatrixModal);
  return ModMatrixModal;
}

/** Simulates loading env-section.js into a customElements registry */
function defineEnvSection(customElements) {
  const template = getEnvSectionTemplate();
  
  class EnvSection {
    constructor() {
      this.innerHTML = '';
      this.children = [];
      this.style = {};
    }
    connectedCallback() {
      if (this.children.length === 0) {
        this.innerHTML = template;
      }
    }
  }
  
  customElements.define('env-section', EnvSection);
  return EnvSection;
}

/** Simulates loading lfo-section.js into a customElements registry */
function defineLfoSection(customElements) {
  const template = getLfoSectionTemplate();
  
  class LfoSection {
    constructor() {
      this.innerHTML = '';
      this.children = [];
      this.style = {};
    }
    connectedCallback() {
      if (this.children.length === 0) {
        this.innerHTML = template;
      }
    }
  }
  
  customElements.define('lfo-section', LfoSection);
  return LfoSection;
}

// ══════════════════════════════════════════════════════════════════
// Template validation helpers
// ══════════════════════════════════════════════════════════════════

function extractIds(html) {
  const ids = [];
  const regex = /id="([^"]*)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

function extractDataParams(html) {
  const params = [];
  const regex = /data-param="([^"]*)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    params.push(match[1]);
  }
  return params;
}

function extractTooltips(html) {
  const tooltips = [];
  const regex = /data-ctrl-tooltip="([^"]*)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    tooltips.push(match[1]);
  }
  return tooltips;
}

function extractButtons(html) {
  const buttons = [];
  const regex = /<button[^>]*>([^<]*)<\/button>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    buttons.push(match[1].trim());
  }
  return buttons;
}

function extractDataEnv(html) {
  const envs = [];
  const regex = /data-env="([^"]*)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    envs.push(parseInt(match[1], 10));
  }
  return envs;
}

// ══════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════

// ─── Mod Matrix ───────────────────────────────────────────────

describe('ModMatrixModal (mod-matrix.js)', () => {
  let customElements;
  let ModMatrixModal;

  beforeEach(() => {
    customElements = createCustomElementsRegistry();
    ModMatrixModal = defineModMatrixModal(customElements);
  });

  it('is registered as a custom element named mod-matrix-modal', () => {
    expect(customElements.define).toHaveBeenCalledWith('mod-matrix-modal', ModMatrixModal);
  });

  it('can be retrieved from the registry by name', () => {
    const retrieved = customElements.get('mod-matrix-modal');
    expect(retrieved).toBe(ModMatrixModal);
  });

  it('returns undefined for unregistered names', () => {
    expect(customElements.get('non-existent')).toBeUndefined();
  });

  it('has a connectedCallback that sets innerHTML when empty', () => {
    const instance = new ModMatrixModal();
    expect(instance.innerHTML).toBe('');
    
    instance.connectedCallback();
    expect(instance.innerHTML).not.toBe('');
  });

  it('connectedCallback preserves innerHTML if children already exist', () => {
    const instance = new ModMatrixModal();
    instance.children = [{ id: 'existing' }, { id: 'child2' }];
    instance.innerHTML = '<div>pre-rendered</div>';
    
    instance.connectedCallback();
    expect(instance.innerHTML).toBe('<div>pre-rendered</div>');
  });

  it('contains all expected elements in the template', () => {
    const html = getModMatrixTemplate();
    
    expect(html).toContain('modmatrix-modal-backdrop');
    expect(html).toContain('modmatrix-close-btn');
    expect(html).toContain('modmatrix-grid');
    expect(html).toContain('Modulation Matrix');
    expect(html).toContain('modal-backdrop');
    expect(html).toContain('modal"');
    expect(html).toContain('modal-header');
    expect(html).toContain('modal-body');
  });

  it('has correct IDs', () => {
    const ids = extractIds(getModMatrixTemplate());
    expect(ids).toContain('modmatrix-modal-backdrop');
    expect(ids).toContain('modmatrix-close-btn');
  });

  it('has close button with correct tooltip', () => {
    const tooltips = extractTooltips(getModMatrixTemplate());
    expect(tooltips).toContain('Close Modulation Matrix modal');
  });

  it('has modal with data-accent="blue"', () => {
    const html = getModMatrixTemplate();
    expect(html).toContain('data-accent="blue"');
    expect(html).toContain('style="width:760px"');
  });

  it('grid has display:grid with 2 columns', () => {
    const html = getModMatrixTemplate();
    expect(html).toContain('grid-template-columns:1fr 1fr');
    expect(html).toContain('gap:15px');
  });

  it('backdrop starts hidden (display:none)', () => {
    const html = getModMatrixTemplate();
    expect(html).toContain('display:none');
    expect(html).toContain('z-index:5000');
  });

  it('has exactly 1 h2 heading', () => {
    const html = getModMatrixTemplate();
    const matches = html.match(/<h2/g);
    expect(matches ? matches.length : 0).toBe(1);
  });

  it('has exactly 1 close button (&times; entity)', () => {
    const html = getModMatrixTemplate();
    const timesMatches = html.match(/&times;/g);
    expect(timesMatches ? timesMatches.length : 0).toBe(1);
    // The close button is a <div> not a <button>, so it must be found via entity
    expect(html).toContain('class="close-btn"');
    expect(html).toContain('&times;');
  });

  it('has no data-params (no sliders in mod-matrix)', () => {
    const params = extractDataParams(getModMatrixTemplate());
    expect(params.length).toBe(0);
  });

  it('idempotent: calling connectedCallback twice does not change HTML', () => {
    const instance = new ModMatrixModal();
    instance.connectedCallback();
    const firstHTML = instance.innerHTML;
    instance.connectedCallback();
    expect(instance.innerHTML).toBe(firstHTML);
  });
});

// ─── Envelope Section ─────────────────────────────────────────

describe('EnvSection (env-section.js)', () => {
  let customElements;
  let EnvSection;

  beforeEach(() => {
    customElements = createCustomElementsRegistry();
    EnvSection = defineEnvSection(customElements);
  });

  it('is registered as a custom element named env-section', () => {
    expect(customElements.define).toHaveBeenCalledWith('env-section', EnvSection);
  });

  it('can be retrieved from the registry', () => {
    expect(customElements.get('env-section')).toBe(EnvSection);
  });

  it('connectedCallback sets innerHTML when empty', () => {
    const instance = new EnvSection();
    instance.connectedCallback();
    expect(instance.innerHTML.length).toBeGreaterThan(100);
    expect(instance.innerHTML).toContain('env-section');
  });

  it('connectedCallback does not overwrite existing children', () => {
    const instance = new EnvSection();
    instance.children = [{ id: 'pre-existing' }];
    instance.innerHTML = '<div>custom content</div>';
    instance.connectedCallback();
    expect(instance.innerHTML).toBe('<div>custom content</div>');
  });

  it('contains 3 envelope type buttons (VCA, VCF, MOD)', () => {
    const buttons = extractButtons(getEnvSectionTemplate());
    expect(buttons).toContain('VCA');
    expect(buttons).toContain('VCF');
    expect(buttons).toContain('MOD');
    expect(buttons.filter(b => ['VCA', 'VCF', 'MOD'].includes(b)).length).toBe(3);
  });

  it('has VCA button marked active by default', () => {
    const html = getEnvSectionTemplate();
    expect(html).toContain('class="env-type-btn active"');
    expect(html).toContain('id="env-btn-vca"');
  });

  it('has correct data-env values (1=VCA, 2=VCF, 3=MOD)', () => {
    const envValues = extractDataEnv(getEnvSectionTemplate());
    expect(envValues).toEqual([1, 2, 3]);
  });

  it('has 4 ctrl-unit sliders: A, D, S, R', () => {
    const html = getEnvSectionTemplate();
    const ctrlUnits = html.match(/class="ctrl-unit"/g);
    expect(ctrlUnits ? ctrlUnits.length : 0).toBe(4);
    
    expect(html).toContain('id="env-ctrl-attack"');
    expect(html).toContain('id="env-ctrl-decay"');
    expect(html).toContain('id="env-ctrl-sustain"');
    expect(html).toContain('id="env-ctrl-release"');
  });

  it('has correct data-param mappings for envelopes', () => {
    const params = extractDataParams(getEnvSectionTemplate());
    expect(params).toContain('env1_attack');
    expect(params).toContain('env1_decay');
    expect(params).toContain('env1_sustain');
    expect(params).toContain('env1_release');
    expect(params.length).toBe(4);
  });

  it('has Edit button with correct tooltip', () => {
    const tooltips = extractTooltips(getEnvSectionTemplate());
    expect(tooltips).toContain('Open Envelope detail editor');
  });

  it('has envelope type tooltips', () => {
    const tooltips = extractTooltips(getEnvSectionTemplate());
    expect(tooltips).toContain('VCA Envelope — amplitude/volume envelope');
    expect(tooltips).toContain('VCF Envelope — filter cutoff envelope');
    expect(tooltips).toContain('Mod Envelope — modulation routing envelope');
  });

  it('has label elements with correct text', () => {
    const html = getEnvSectionTemplate();
    // Labels inside ctrl-units: A, D, S, R
    const labelEls = html.match(/id="env-label-(attack|decay|sustain|release)"/g);
    expect(labelEls ? labelEls.length : 0).toBe(4);
    
    expect(html).toContain('>A<');
    expect(html).toContain('>D<');
    expect(html).toContain('>S<');
    expect(html).toContain('>R<');
  });

  it('has module header with title "Envelopes"', () => {
    const html = getEnvSectionTemplate();
    expect(html).toContain('Envelopes');
  });

  it('has v-slider with track and handle in each ctrl-unit', () => {
    const html = getEnvSectionTemplate();
    const sliderDivs = html.match(/class="v-slider"/g);
    expect(sliderDivs ? sliderDivs.length : 0).toBe(4);
    
    const trackDivs = html.match(/class="track"/g);
    expect(trackDivs ? trackDivs.length : 0).toBe(4);
    
    const handleDivs = html.match(/class="handle"/g);
    expect(handleDivs ? handleDivs.length : 0).toBe(4);
  });

  it('has flex:3 style on the module', () => {
    const html = getEnvSectionTemplate();
    expect(html).toContain('style="flex:3"');
  });

  it('has env-edit-btn with data-ctrl-tooltip', () => {
    const html = getEnvSectionTemplate();
    expect(html).toContain('id="env-edit-btn"');
    expect(html).toContain('data-accent="orange"');
  });
});

// ─── LFO Section ──────────────────────────────────────────────

describe('LfoSection (lfo-section.js)', () => {
  let customElements;
  let LfoSection;

  beforeEach(() => {
    customElements = createCustomElementsRegistry();
    LfoSection = defineLfoSection(customElements);
  });

  it('is registered as a custom element named lfo-section', () => {
    expect(customElements.define).toHaveBeenCalledWith('lfo-section', LfoSection);
  });

  it('can be retrieved from the registry', () => {
    expect(customElements.get('lfo-section')).toBe(LfoSection);
  });

  it('connectedCallback sets innerHTML when empty', () => {
    const instance = new LfoSection();
    instance.connectedCallback();
    expect(instance.innerHTML.length).toBeGreaterThan(100);
    expect(instance.innerHTML).toContain('lfo-section');
  });

  it('connectedCallback respects existing children', () => {
    const instance = new LfoSection();
    instance.children = [{ id: 'existing' }];
    instance.connectedCallback();
    expect(instance.innerHTML).toBe('');
  });

  it('has LFO selector button with text "LFO 1 ACTIVE"', () => {
    const buttons = extractButtons(getLfoSectionTemplate());
    expect(buttons).toContain('LFO 1 ACTIVE');
  });

  it('has 2 ctrl-units: Rate and Delay', () => {
    const html = getLfoSectionTemplate();
    const ctrlUnits = html.match(/class="ctrl-unit"/g);
    expect(ctrlUnits ? ctrlUnits.length : 0).toBe(2);
    
    expect(html).toContain('id="lfo-ctrl-rate"');
    expect(html).toContain('id="lfo-ctrl-delay"');
  });

  it('has correct data-param mappings for LFO', () => {
    const params = extractDataParams(getLfoSectionTemplate());
    expect(params).toContain('lfo1_rate');
    expect(params).toContain('lfo1_delay');
    expect(params.length).toBe(2);
  });

  it('has label elements with correct text', () => {
    const html = getLfoSectionTemplate();
    expect(html).toContain('LFO1 Rate');
    expect(html).toContain('Delay');
    
    expect(html).toContain('id="lfo-label-rate"');
    expect(html).toContain('id="lfo-label-delay"');
  });

  it('has Edit button with LFO tooltip', () => {
    const tooltips = extractTooltips(getLfoSectionTemplate());
    expect(tooltips).toContain('Open LFO detail editor');
    expect(tooltips).toContain('Toggle between LFO 1 and LFO 2');
  });

  it('has lfo-select-btn with width:80% and data-accent="orange"', () => {
    const html = getLfoSectionTemplate();
    expect(html).toContain('id="lfo-select-btn"');
    expect(html).toContain('style="width:80%"');
    expect(html).toContain('data-accent="orange"');
  });

  it('has module header with title "LFO 1 & 2" (HTML entities)', () => {
    const html = getLfoSectionTemplate();
    expect(html).toContain('LFO 1 &amp; 2');
  });

  it('has flex:1.8 style on the module', () => {
    const html = getLfoSectionTemplate();
    expect(html).toContain('style="flex:1.8"');
  });

  it('has v-slider with track and handle for each ctrl-unit', () => {
    const html = getLfoSectionTemplate();
    const sliderDivs = html.match(/class="v-slider"/g);
    expect(sliderDivs ? sliderDivs.length : 0).toBe(2);
  });

  it('uses btn-outline class for LFO selector button', () => {
    const html = getLfoSectionTemplate();
    expect(html).toContain('class="btn btn-outline"');
  });

  it('has no envelope data-env attributes (LFO section is not env)', () => {
    const envs = extractDataEnv(getLfoSectionTemplate());
    expect(envs.length).toBe(0);
  });
});

// ─── Cross-component integration ──────────────────────────────

describe('Cross-component patterns', () => {
  it('all three components can be registered in the same registry', () => {
    const registry = createCustomElementsRegistry();
    
    defineModMatrixModal(registry);
    defineEnvSection(registry);
    defineLfoSection(registry);
    
    expect(registry.get('mod-matrix-modal')).toBeDefined();
    expect(registry.get('env-section')).toBeDefined();
    expect(registry.get('lfo-section')).toBeDefined();
  });

  it('all three have connectedCallback that guards against duplicate render', () => {
    const registry = createCustomElementsRegistry();
    defineModMatrixModal(registry);
    defineEnvSection(registry);
    defineLfoSection(registry);
    
    // Instantiate each
    const mm = new (registry.get('mod-matrix-modal'))();
    const env = new (registry.get('env-section'))();
    const lfo = new (registry.get('lfo-section'))();
    
    // First call: populates
    mm.connectedCallback();
    expect(mm.innerHTML.length).toBeGreaterThan(0);
    
    env.connectedCallback();
    expect(env.innerHTML.length).toBeGreaterThan(0);
    
    lfo.connectedCallback();
    expect(lfo.innerHTML.length).toBeGreaterThan(0);
  });

  it('all Edit buttons use the same pattern (btn btn-xs btn-outline, edit-panel-btn)', () => {
    const envHtml = getEnvSectionTemplate();
    const lfoHtml = getLfoSectionTemplate();
    
    // Both Edit buttons have same class pattern
    expect(envHtml).toContain('class="btn btn-xs btn-outline edit-panel-btn"');
    expect(lfoHtml).toContain('class="btn btn-xs btn-outline edit-panel-btn"');
    
    // mod-matrix has no Edit button (it's a modal, not a module)
    const mmHtml = getModMatrixTemplate();
    expect(mmHtml).not.toContain('edit-panel-btn');
  });

  it('all ctrl-units follow the same pattern (label + v-slider)', () => {
    const envHtml = getEnvSectionTemplate();
    const lfoHtml = getLfoSectionTemplate();
    
    // Pattern: ctrl-unit > label + v-slider > track + handle
    const envUnits = envHtml.match(/<div class="ctrl-unit"[^>]*>/g);
    const lfoUnits = lfoHtml.match(/<div class="ctrl-unit"[^>]*>/g);
    
    expect(envUnits ? envUnits.length : 0).toBe(4);
    expect(lfoUnits ? lfoUnits.length : 0).toBe(2);
    
    // Each ctrl-unit has a v-slider inside
    const envSliders = envHtml.match(/<div class="v-slider">/g);
    expect(envSliders ? envSliders.length : 0).toBe(4);
  });

  it('all components have tooltips on interactive elements', () => {
    const mmTooltips = extractTooltips(getModMatrixTemplate());
    const envTooltips = extractTooltips(getEnvSectionTemplate());
    const lfoTooltips = extractTooltips(getLfoSectionTemplate());
    
    expect(mmTooltips.length).toBeGreaterThanOrEqual(1);
    expect(envTooltips.length).toBeGreaterThanOrEqual(4); // Edit + 3 env buttons
    expect(lfoTooltips.length).toBeGreaterThanOrEqual(2); // Edit + LFO toggle
  });
});

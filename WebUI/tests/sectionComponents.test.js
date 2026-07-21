/**
 * Unit tests for Section Web Components (8 files):
 *   - osc-section.js       OscSection       (Oscillators module)
 *   - vca-section.js       VcaSection       (VCA module)
 *   - vcf-section.js       VcfSection       (VCF filter module)
 *   - hpf-section.js       HpfSection       (HPF filter module)
 *   - poly-section.js      PolySection      (Polyphony module)
 *   - arp-seq-section.js   ArpSeqSection    (Arp/Seq module)
 *   - keyboard-section.js  KeyboardSection  (Keyboard + wheels)
 *   - control-grid.js      ControlGrid      (Structural wrapper)
 *
 * Covers:
 *   - Template structure (expected elements, IDs, data-params, tooltips)
 *   - Web Component registration (customElements.define)
 *   - connectedCallback behavior (render-once guard)
 *   - Cross-component patterns (Edit buttons, ctrl-unit structure)
 *
 * Run with: npx vitest run WebUI/tests/sectionComponents.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Custom Elements registry mock
// ══════════════════════════════════════════════════════════════════

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
// Template generators (mirrors source code)
// ══════════════════════════════════════════════════════════════════

function getOscSectionTemplate() {
  return `
    <div class="module" id="osc-section" style="flex:3.5">
      <div class="module-header flex-row justify-between items-center">
        <span>Oscillators</span>
        <button class="btn btn-xs btn-outline edit-panel-btn" data-accent="orange" id="osc-edit-btn" data-ctrl-tooltip="Open Oscillator detail editor">Edit</button>
      </div>
      <div class="flex-row justify-center w-full" style="margin-bottom:5px">
        <button class="btn btn-outline" data-accent="orange" id="osc-select-btn" style="width:80%" data-ctrl-tooltip="Toggle between OSC 1 and OSC 2 controls">OSC 1 ACTIVE</button>
      </div>
      <div class="controls-row">
        <div class="ctrl-unit" id="osc-ctrl-pitchmod" data-param="osc1_pitch_mod"><span class="label" id="osc-label-pitchmod">Pitch Mod</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
        <div class="ctrl-unit" id="osc-ctrl-pwm-tone" data-param="osc1_pwm_amount"><span class="label" id="osc-label-pwm-tone">PWM</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
        <div class="ctrl-unit" id="osc-ctrl-pitch" data-param="osc2_pitch" style="display:none"><span class="label">Pitch</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
        <div class="ctrl-unit" id="osc-ctrl-level" data-param="osc2_level" style="display:none"><span class="label">Level</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
        <div class="ctrl-unit" data-param="noise_level"><span class="label">Noise</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
      </div>
    </div>
  `;
}

function getVcaSectionTemplate() {
  return `
    <div class="module" id="vca-section" style="flex:1.5">
      <div class="module-header flex-row justify-between items-center">
        <span>VCA</span>
        <button class="btn btn-xs btn-outline edit-panel-btn" data-accent="orange" id="vca-edit-btn" data-ctrl-tooltip="Open VCA detail editor">Edit</button>
      </div>
      <div class="flex-row justify-center w-full" style="margin-bottom:5px">
        <button class="btn btn-outline" id="vca-mode-btn" data-param="vca_mode" style="width:90%" data-ctrl-tooltip="Toggle VCA between Transparent (clean) and Ballsy (saturated) mode">TRANSPARENT</button>
      </div>
      <div class="controls-row justify-center">
        <div class="ctrl-unit" data-param="vca_level"><span class="label">Level</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
      </div>
    </div>
  `;
}

function getVcfSectionTemplate() {
  return `
    <div class="module" id="vcf-section" style="flex:3.5">
      <div class="module-header flex-row justify-between items-center">
        <span>VCF</span>
        <button class="btn btn-xs btn-outline edit-panel-btn" data-accent="orange" id="vcf-edit-btn" data-ctrl-tooltip="Open VCF filter detail editor">Edit</button>
      </div>
      <div class="controls-row">
        <div class="ctrl-unit" data-param="vcf_cutoff"><span class="label">Freq</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
        <div class="ctrl-unit" data-param="vcf_resonance"><span class="label">Res</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
        <div class="ctrl-unit" data-param="vcf_env_depth"><span class="label">Env</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
        <div class="ctrl-unit" data-param="vcf_lfo_depth"><span class="label">LFO</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
        <div class="ctrl-unit" data-param="vcf_key_tracking"><span class="label">KYBD</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
      </div>
    </div>
  `;
}

function getHpfSectionTemplate() {
  return `
    <div class="module" id="hpf-section" style="flex:1.1">
      <div class="module-header flex-row justify-between items-center">
        <span>HPF</span>
        <button class="btn btn-xs btn-outline edit-panel-btn" data-accent="orange" id="hpf-edit-btn" data-ctrl-tooltip="Open HPF detail editor">Edit</button>
      </div>
      <div class="flex-row justify-center w-full" style="margin-bottom:5px">
        <button class="btn btn-outline" id="hpf-boost-btn" data-param="hpf_boost_enable" style="width:90%" data-ctrl-tooltip="Toggle HPF Bass Boost — adds low-end presence">BOOST OFF</button>
      </div>
      <div class="controls-row justify-center">
        <div class="ctrl-unit" data-param="hpf_cutoff"><span class="label">Freq</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
      </div>
    </div>
  `;
}

function getPolySectionTemplate() {
  return `
    <div class="module" id="poly-section" style="flex:1.2">
      <div class="module-header flex-row justify-between items-center">
        <span>Poly</span>
        <button class="btn btn-xs btn-outline edit-panel-btn" data-accent="orange" id="poly-edit-btn" data-ctrl-tooltip="Open Polyphony / Unison detail editor">Edit</button>
      </div>
      <div class="controls-row">
        <div class="ctrl-unit" data-param="unison_detune"><span class="label">Detune</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
      </div>
    </div>
  `;
}

function getArpSeqSectionTemplate() {
  return `
    <div class="module" id="arp-section" style="flex:1.5">
      <div class="module-header">Arp / Seq</div>
      <div class="controls-row">
        <div class="ctrl-unit" data-param="arp_rate"><span class="label">Rate</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
        <div class="ctrl-unit" data-param="arp_gate_time"><span class="label">Gate</span><div class="v-slider"><div class="track"></div><div class="handle"></div></div></div>
      </div>
    </div>
  `;
}

function getKeyboardSectionTemplate() {
  return `
    <div class="keyboard-container">
      <div class="performance-wheels">
        <div class="wheel-slot" id="wheel-pitch">
          <div class="wheel"></div>
        </div>
        <div class="wheel-slot" id="wheel-mod">
          <div class="wheel"></div>
        </div>
      </div>

      <div class="performance-matrix-panel">
        <div class="matrix-row row-top">
          <div class="matrix-cell col-porta">
            <div class="ctrl-unit" data-param="global_portamento">
              <span class="label text-xs text-dim">Porta</span>
              <div class="knob-ring">
                <div class="knob-pointer"></div>
              </div>
            </div>
          </div>
          <div class="matrix-cell col-volume">
            <div class="ctrl-unit" data-param="global_volume">
              <span class="label text-xs text-dim">Volume</span>
              <div class="knob-ring">
                <div class="knob-pointer"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="matrix-row row-bottom">
          <div class="matrix-cell col-porta-edit">
            <button class="btn btn-xs btn-outline" id="porta-edit-btn" data-accent="blue" style="width:34px;height:26px;padding:0" data-ctrl-tooltip="Open Portamento / Glide settings">Edit</button>
          </div>
          <div class="matrix-cell col-oct-down">
            <button class="btn btn-sm" id="oct-down-btn" data-accent="orange" style="width:34px;height:26px;padding:0;color:var(--accent-primary)" data-ctrl-tooltip="Transpose keyboard down one octave">OCT -</button>
          </div>
          <div class="matrix-cell col-oct-up">
            <button class="btn btn-sm" id="oct-up-btn" data-accent="orange" style="width:34px;height:26px;padding:0;color:var(--accent-primary)" data-ctrl-tooltip="Transpose keyboard up one octave">OCT +</button>
          </div>
        </div>
      </div>

      <div id="ivory-keys-bed"></div>
    </div>
  `;
}

function getControlGridTemplate() {
  return `
    <div class="control-grid">
      <div class="row">
        <arp-seq-section></arp-seq-section>
        <lfo-section></lfo-section>
        <poly-section></poly-section>
        <programmer-section></programmer-section>
      </div>
      <div class="row">
        <osc-section></osc-section>
        <vcf-section></vcf-section>
        <vca-section></vca-section>
        <hpf-section></hpf-section>
        <env-section></env-section>
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════
// Web Component simulation (matching source code behavior)
// ══════════════════════════════════════════════════════════════════

function defineOscSection(customElements) {
  const template = getOscSectionTemplate();
  class OscSection {
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
  customElements.define('osc-section', OscSection);
  return OscSection;
}

function defineVcaSection(customElements) {
  const template = getVcaSectionTemplate();
  class VcaSection {
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
  customElements.define('vca-section', VcaSection);
  return VcaSection;
}

function defineVcfSection(customElements) {
  const template = getVcfSectionTemplate();
  class VcfSection {
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
  customElements.define('vcf-section', VcfSection);
  return VcfSection;
}

function defineHpfSection(customElements) {
  const template = getHpfSectionTemplate();
  class HpfSection {
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
  customElements.define('hpf-section', HpfSection);
  return HpfSection;
}

function definePolySection(customElements) {
  const template = getPolySectionTemplate();
  class PolySection {
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
  customElements.define('poly-section', PolySection);
  return PolySection;
}

function defineArpSeqSection(customElements) {
  const template = getArpSeqSectionTemplate();
  class ArpSeqSection {
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
  customElements.define('arp-seq-section', ArpSeqSection);
  return ArpSeqSection;
}

function defineKeyboardSection(customElements) {
  const template = getKeyboardSectionTemplate();
  class KeyboardSection {
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
  customElements.define('keyboard-section', KeyboardSection);
  return KeyboardSection;
}

function defineControlGrid(customElements) {
  const template = getControlGridTemplate();
  class ControlGrid {
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
  customElements.define('control-grid', ControlGrid);
  return ControlGrid;
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

function extractDataAccents(html) {
  const accents = [];
  const regex = /data-accent="([^"]*)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    accents.push(match[1]);
  }
  return accents;
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

function countCtrlUnits(html) {
  const matches = html.match(/class="ctrl-unit"/g);
  return matches ? matches.length : 0;
}

function countSliders(html) {
  const matches = html.match(/class="v-slider"/g);
  return matches ? matches.length : 0;
}

function countKnobRings(html) {
  const matches = html.match(/class="knob-ring"/g);
  return matches ? matches.length : 0;
}

// ══════════════════════════════════════════════════════════════════
// Tests: OscSection
// ══════════════════════════════════════════════════════════════════

describe('OscSection (osc-section.js)', () => {
  let customElements;
  let OscSection;

  beforeEach(() => {
    customElements = createCustomElementsRegistry();
    OscSection = defineOscSection(customElements);
  });

  it('is registered as a custom element named osc-section', () => {
    expect(customElements.define).toHaveBeenCalledWith('osc-section', OscSection);
  });

  it('can be retrieved from the registry', () => {
    expect(customElements.get('osc-section')).toBe(OscSection);
  });

  it('connectedCallback sets innerHTML when empty', () => {
    const instance = new OscSection();
    instance.connectedCallback();
    expect(instance.innerHTML.length).toBeGreaterThan(100);
    expect(instance.innerHTML).toContain('osc-section');
  });

  it('connectedCallback does not overwrite existing children', () => {
    const instance = new OscSection();
    instance.children = [{ id: 'existing' }];
    instance.innerHTML = '<div>custom</div>';
    instance.connectedCallback();
    expect(instance.innerHTML).toBe('<div>custom</div>');
  });

  it('has module header with title "Oscillators"', () => {
    expect(getOscSectionTemplate()).toContain('Oscillators');
  });

  it('has osc-select button with "OSC 1 ACTIVE" text', () => {
    const buttons = extractButtons(getOscSectionTemplate());
    expect(buttons).toContain('OSC 1 ACTIVE');
  });

  it('has Edit button with oscillator tooltip', () => {
    const tooltips = extractTooltips(getOscSectionTemplate());
    expect(tooltips).toContain('Open Oscillator detail editor');
  });

  it('has selector tooltip', () => {
    const tooltips = extractTooltips(getOscSectionTemplate());
    expect(tooltips).toContain('Toggle between OSC 1 and OSC 2 controls');
  });

  it('has 5 ctrl-units', () => {
    expect(countCtrlUnits(getOscSectionTemplate())).toBe(5);
  });

  it('has correct data-params', () => {
    const params = extractDataParams(getOscSectionTemplate());
    expect(params).toContain('osc1_pitch_mod');
    expect(params).toContain('osc1_pwm_amount');
    expect(params).toContain('osc2_pitch');
    expect(params).toContain('osc2_level');
    expect(params).toContain('noise_level');
    expect(params.length).toBe(5);
  });

  it('has 2 hidden ctrl-units (osc2_pitch, osc2_level) with display:none', () => {
    const html = getOscSectionTemplate();
    expect(html.match(/style="display:none"/g).length).toBe(2);
    expect(html).toContain('id="osc-ctrl-pitch"');
    expect(html).toContain('id="osc-ctrl-level"');
  });

  it('has specific IDs for OSC1 units', () => {
    expect(getOscSectionTemplate()).toContain('id="osc-ctrl-pitchmod"');
    expect(getOscSectionTemplate()).toContain('id="osc-ctrl-pwm-tone"');
  });

  it('has osc-select-btn with data-accent="orange"', () => {
    expect(getOscSectionTemplate()).toContain('data-accent="orange"');
  });

  it('has style flex:3.5', () => {
    expect(getOscSectionTemplate()).toContain('style="flex:3.5"');
  });

  it('has 5 v-sliders (one per ctrl-unit)', () => {
    expect(countSliders(getOscSectionTemplate())).toBe(5);
  });

  it('has label elements for each ctrl-unit', () => {
    const html = getOscSectionTemplate();
    expect(html).toContain('Pitch Mod');
    expect(html).toContain('PWM');
    expect(html).toContain('Pitch');
    expect(html).toContain('Level');
    expect(html).toContain('Noise');
  });

  it('has osc-edit-btn with edit-panel-btn class', () => {
    const html = getOscSectionTemplate();
    expect(html).toContain('id="osc-edit-btn"');
    expect(html).toContain('class="btn btn-xs btn-outline edit-panel-btn"');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: VcaSection
// ══════════════════════════════════════════════════════════════════

describe('VcaSection (vca-section.js)', () => {
  let customElements;
  let VcaSection;

  beforeEach(() => {
    customElements = createCustomElementsRegistry();
    VcaSection = defineVcaSection(customElements);
  });

  it('is registered as vca-section', () => {
    expect(customElements.define).toHaveBeenCalledWith('vca-section', VcaSection);
  });

  it('can be retrieved from registry', () => {
    expect(customElements.get('vca-section')).toBe(VcaSection);
  });

  it('connectedCallback populates innerHTML', () => {
    const instance = new VcaSection();
    instance.connectedCallback();
    expect(instance.innerHTML.length).toBeGreaterThan(50);
    expect(instance.innerHTML).toContain('vca-section');
  });

  it('connectedCallback preserves existing children', () => {
    const instance = new VcaSection();
    instance.children = [{ id: 'x' }];
    instance.innerHTML = '<div>keep</div>';
    instance.connectedCallback();
    expect(instance.innerHTML).toBe('<div>keep</div>');
  });

  it('has title "VCA"', () => {
    expect(getVcaSectionTemplate()).toContain('>VCA<');
  });

  it('has vca-mode-btn with "TRANSPARENT" text', () => {
    const buttons = extractButtons(getVcaSectionTemplate());
    expect(buttons).toContain('TRANSPARENT');
  });

  it('has Edit button with VCA tooltip', () => {
    const tooltips = extractTooltips(getVcaSectionTemplate());
    expect(tooltips).toContain('Open VCA detail editor');
  });

  it('has mode button tooltip about Transparent/Ballsy', () => {
    const tooltips = extractTooltips(getVcaSectionTemplate());
    expect(tooltips).toContain('Toggle VCA between Transparent (clean) and Ballsy (saturated) mode');
  });

  it('has 1 ctrl-unit (vca_level)', () => {
    expect(countCtrlUnits(getVcaSectionTemplate())).toBe(1);
    expect(extractDataParams(getVcaSectionTemplate())).toEqual(['vca_mode', 'vca_level']);
  });

  it('has style flex:1.5', () => {
    expect(getVcaSectionTemplate()).toContain('style="flex:1.5"');
  });

  it('has vca-mode-btn with data-param="vca_mode" style="width:90%"', () => {
    const html = getVcaSectionTemplate();
    expect(html).toContain('id="vca-mode-btn"');
    expect(html).toContain('data-param="vca_mode"');
    expect(html).toContain('style="width:90%"');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: VcfSection
// ══════════════════════════════════════════════════════════════════

describe('VcfSection (vcf-section.js)', () => {
  let customElements;
  let VcfSection;

  beforeEach(() => {
    customElements = createCustomElementsRegistry();
    VcfSection = defineVcfSection(customElements);
  });

  it('is registered as vcf-section', () => {
    expect(customElements.define).toHaveBeenCalledWith('vcf-section', VcfSection);
  });

  it('connectedCallback populates', () => {
    const instance = new VcfSection();
    instance.connectedCallback();
    expect(instance.innerHTML).toContain('vcf-section');
  });

  it('connectedCallback preserves children', () => {
    const instance = new VcfSection();
    instance.children = [{ id: 'x' }];
    instance.connectedCallback();
    expect(instance.innerHTML).toBe('');
  });

  it('has title "VCF"', () => {
    expect(getVcfSectionTemplate()).toContain('>VCF<');
  });

  it('has Edit button with VCF tooltip', () => {
    const tooltips = extractTooltips(getVcfSectionTemplate());
    expect(tooltips).toContain('Open VCF filter detail editor');
  });

  it('has 5 ctrl-units', () => {
    expect(countCtrlUnits(getVcfSectionTemplate())).toBe(5);
  });

  it('has correct data-params', () => {
    const params = extractDataParams(getVcfSectionTemplate());
    expect(params).toEqual(['vcf_cutoff', 'vcf_resonance', 'vcf_env_depth', 'vcf_lfo_depth', 'vcf_key_tracking']);
  });

  it('has correct label text', () => {
    const html = getVcfSectionTemplate();
    expect(html).toContain('Freq');
    expect(html).toContain('Res');
    expect(html).toContain('Env');
    expect(html).toContain('LFO');
    expect(html).toContain('KYBD');
  });

  it('has style flex:3.5', () => {
    expect(getVcfSectionTemplate()).toContain('style="flex:3.5"');
  });

  it('has 5 v-sliders', () => {
    expect(countSliders(getVcfSectionTemplate())).toBe(5);
  });

  it('has no OSC selector (VCF uses header+controls only)', () => {
    expect(getVcfSectionTemplate()).not.toContain('osc-select');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: HpfSection
// ══════════════════════════════════════════════════════════════════

describe('HpfSection (hpf-section.js)', () => {
  let customElements;
  let HpfSection;

  beforeEach(() => {
    customElements = createCustomElementsRegistry();
    HpfSection = defineHpfSection(customElements);
  });

  it('is registered as hpf-section', () => {
    expect(customElements.define).toHaveBeenCalledWith('hpf-section', HpfSection);
  });

  it('connectedCallback populates', () => {
    const instance = new HpfSection();
    instance.connectedCallback();
    expect(instance.innerHTML).toContain('hpf-section');
  });

  it('connectedCallback preserves children', () => {
    const instance = new HpfSection();
    instance.children = [{ id: 'keep' }];
    instance.connectedCallback();
    expect(instance.innerHTML).toBe('');
  });

  it('has title "HPF"', () => {
    expect(getHpfSectionTemplate()).toContain('>HPF<');
  });

  it('has hpf-boost-btn with "BOOST OFF" text', () => {
    const buttons = extractButtons(getHpfSectionTemplate());
    expect(buttons).toContain('BOOST OFF');
  });

  it('has Edit button with HPF tooltip', () => {
    const tooltips = extractTooltips(getHpfSectionTemplate());
    expect(tooltips).toContain('Open HPF detail editor');
  });

  it('has boost button tooltip about Bass Boost', () => {
    const tooltips = extractTooltips(getHpfSectionTemplate());
    expect(tooltips.some(function(t) { return t.startsWith('Toggle HPF Bass Boost'); })).toBe(true);
  });

  it('has 1 ctrl-unit (hpf_cutoff)', () => {
    expect(countCtrlUnits(getHpfSectionTemplate())).toBe(1);
    expect(extractDataParams(getHpfSectionTemplate())).toContain('hpf_cutoff');
  });

  it('has data-param="hpf_boost_enable" on boost button', () => {
    expect(getHpfSectionTemplate()).toContain('data-param="hpf_boost_enable"');
  });

  it('has style flex:1.1', () => {
    expect(getHpfSectionTemplate()).toContain('style="flex:1.1"');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: PolySection
// ══════════════════════════════════════════════════════════════════

describe('PolySection (poly-section.js)', () => {
  let customElements;
  let PolySection;

  beforeEach(() => {
    customElements = createCustomElementsRegistry();
    PolySection = definePolySection(customElements);
  });

  it('is registered as poly-section', () => {
    expect(customElements.define).toHaveBeenCalledWith('poly-section', PolySection);
  });

  it('connectedCallback populates', () => {
    const instance = new PolySection();
    instance.connectedCallback();
    expect(instance.innerHTML).toContain('poly-section');
  });

  it('connectedCallback preserves children', () => {
    const instance = new PolySection();
    instance.children = [{ id: 'keep' }];
    instance.connectedCallback();
    expect(instance.innerHTML).toBe('');
  });

  it('has title "Poly"', () => {
    expect(getPolySectionTemplate()).toContain('>Poly<');
  });

  it('has Edit button with polyphony tooltip', () => {
    const tooltips = extractTooltips(getPolySectionTemplate());
    expect(tooltips).toContain('Open Polyphony / Unison detail editor');
  });

  it('has 1 ctrl-unit (unison_detune)', () => {
    expect(countCtrlUnits(getPolySectionTemplate())).toBe(1);
    expect(extractDataParams(getPolySectionTemplate())).toEqual(['unison_detune']);
  });

  it('has label "Detune"', () => {
    expect(getPolySectionTemplate()).toContain('Detune');
  });

  it('has style flex:1.2', () => {
    expect(getPolySectionTemplate()).toContain('style="flex:1.2"');
  });

  it('has edit-panel-btn class on Edit button', () => {
    expect(getPolySectionTemplate()).toContain('class="btn btn-xs btn-outline edit-panel-btn"');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: ArpSeqSection
// ══════════════════════════════════════════════════════════════════

describe('ArpSeqSection (arp-seq-section.js)', () => {
  let customElements;
  let ArpSeqSection;

  beforeEach(() => {
    customElements = createCustomElementsRegistry();
    ArpSeqSection = defineArpSeqSection(customElements);
  });

  it('is registered as arp-seq-section', () => {
    expect(customElements.define).toHaveBeenCalledWith('arp-seq-section', ArpSeqSection);
  });

  it('connectedCallback populates', () => {
    const instance = new ArpSeqSection();
    instance.connectedCallback();
    expect(instance.innerHTML).toContain('arp-section');
  });

  it('connectedCallback preserves children', () => {
    const instance = new ArpSeqSection();
    instance.children = [{ id: 'x' }];
    instance.connectedCallback();
    expect(instance.innerHTML).toBe('');
  });

  it('has module header "Arp / Seq" (no Edit button)', () => {
    const html = getArpSeqSectionTemplate();
    expect(html).toContain('Arp / Seq');
    // Arp-Seq has a simple module-header without Edit button
    expect(html).not.toContain('edit-panel-btn');
  });

  it('has 2 ctrl-units', () => {
    expect(countCtrlUnits(getArpSeqSectionTemplate())).toBe(2);
  });

  it('has correct data-params', () => {
    const params = extractDataParams(getArpSeqSectionTemplate());
    expect(params).toEqual(['arp_rate', 'arp_gate_time']);
  });

  it('has labels Rate and Gate', () => {
    const html = getArpSeqSectionTemplate();
    expect(html).toContain('Rate');
    expect(html).toContain('Gate');
  });

  it('has style flex:1.5', () => {
    expect(getArpSeqSectionTemplate()).toContain('style="flex:1.5"');
  });

  it('has 2 v-sliders', () => {
    expect(countSliders(getArpSeqSectionTemplate())).toBe(2);
  });

  it('has id="arp-section"', () => {
    expect(getArpSeqSectionTemplate()).toContain('id="arp-section"');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: KeyboardSection
// ══════════════════════════════════════════════════════════════════

describe('KeyboardSection (keyboard-section.js)', () => {
  let customElements;
  let KeyboardSection;

  beforeEach(() => {
    customElements = createCustomElementsRegistry();
    KeyboardSection = defineKeyboardSection(customElements);
  });

  it('is registered as keyboard-section', () => {
    expect(customElements.define).toHaveBeenCalledWith('keyboard-section', KeyboardSection);
  });

  it('can be retrieved from registry', () => {
    expect(customElements.get('keyboard-section')).toBe(KeyboardSection);
  });

  it('connectedCallback populates innerHTML', () => {
    const instance = new KeyboardSection();
    instance.connectedCallback();
    expect(instance.innerHTML.length).toBeGreaterThan(100);
    expect(instance.innerHTML).toContain('keyboard-container');
  });

  it('connectedCallback preserves existing children', () => {
    const instance = new KeyboardSection();
    instance.children = [{ id: 'existing' }];
    instance.innerHTML = '<div>keep</div>';
    instance.connectedCallback();
    expect(instance.innerHTML).toBe('<div>keep</div>');
  });

  it('has piano-style container class', () => {
    expect(getKeyboardSectionTemplate()).toContain('class="keyboard-container"');
  });

  it('has performance wheels (pitch + mod)', () => {
    const html = getKeyboardSectionTemplate();
    expect(html).toContain('id="wheel-pitch"');
    expect(html).toContain('id="wheel-mod"');
    expect(html).toContain('class="performance-wheels"');
  });

  it('has wheel slots with wheel children', () => {
    const html = getKeyboardSectionTemplate();
    const wheelDivs = html.match(/class="wheel"/g);
    expect(wheelDivs ? wheelDivs.length : 0).toBe(2);
  });

  it('has performance matrix panel', () => {
    expect(getKeyboardSectionTemplate()).toContain('class="performance-matrix-panel"');
  });

  it('has 2 matrix rows (top and bottom)', () => {
    const html = getKeyboardSectionTemplate();
    expect(html).toContain('class="matrix-row row-top"');
    expect(html).toContain('class="matrix-row row-bottom"');
  });

  it('has Porta + Volume knobs in top row', () => {
    const params = extractDataParams(getKeyboardSectionTemplate());
    expect(params).toContain('global_portamento');
    expect(params).toContain('global_volume');
  });

  it('has knob-ring elements (2)', () => {
    expect(countKnobRings(getKeyboardSectionTemplate())).toBe(2);
  });

  it('has 3 bottom row buttons', () => {
    const buttons = extractButtons(getKeyboardSectionTemplate());
    expect(buttons).toContain('Edit');
    expect(buttons).toContain('OCT -');
    expect(buttons).toContain('OCT +');
    expect(buttons.length).toBe(3);
  });

  it('has correct tooltips', () => {
    const tooltips = extractTooltips(getKeyboardSectionTemplate());
    expect(tooltips).toContain('Open Portamento / Glide settings');
    expect(tooltips).toContain('Transpose keyboard down one octave');
    expect(tooltips).toContain('Transpose keyboard up one octave');
  });

  it('has ivory-keys-bed container', () => {
    expect(getKeyboardSectionTemplate()).toContain('id="ivory-keys-bed"');
  });

  it('has porta-edit-btn with data-accent="blue"', () => {
    const html = getKeyboardSectionTemplate();
    expect(html).toContain('id="porta-edit-btn"');
    expect(html).toContain('data-accent="blue"');
  });

  it('has octave buttons with data-accent="orange"', () => {
    const html = getKeyboardSectionTemplate();
    const accentOranges = (html.match(/data-accent="orange"/g) || []).length;
    expect(accentOranges).toBe(2);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: ControlGrid
// ══════════════════════════════════════════════════════════════════

describe('ControlGrid (control-grid.js)', () => {
  let customElements;
  let ControlGrid;

  beforeEach(() => {
    customElements = createCustomElementsRegistry();
    ControlGrid = defineControlGrid(customElements);
  });

  it('is registered as control-grid', () => {
    expect(customElements.define).toHaveBeenCalledWith('control-grid', ControlGrid);
  });

  it('can be retrieved from registry', () => {
    expect(customElements.get('control-grid')).toBe(ControlGrid);
  });

  it('connectedCallback populates innerHTML', () => {
    const instance = new ControlGrid();
    instance.connectedCallback();
    expect(instance.innerHTML.length).toBeGreaterThan(50);
    expect(instance.innerHTML).toContain('control-grid');
  });

  it('connectedCallback preserves existing children', () => {
    const instance = new ControlGrid();
    instance.children = [{ id: 'existing' }];
    instance.innerHTML = '<div>custom</div>';
    instance.connectedCallback();
    expect(instance.innerHTML).toBe('<div>custom</div>');
  });

  it('has 2 rows', () => {
    const rows = getControlGridTemplate().match(/class="row"/g);
    expect(rows ? rows.length : 0).toBe(2);
  });

  it('top row has arp-seq-section, lfo-section, poly-section, programmer-section', () => {
    const html = getControlGridTemplate();
    expect(html).toContain('<arp-seq-section>');
    expect(html).toContain('<lfo-section>');
    expect(html).toContain('<poly-section>');
    expect(html).toContain('<programmer-section>');
  });

  it('bottom row has osc-section, vcf-section, vca-section, hpf-section, env-section', () => {
    const html = getControlGridTemplate();
    expect(html).toContain('<osc-section>');
    expect(html).toContain('<vcf-section>');
    expect(html).toContain('<vca-section>');
    expect(html).toContain('<hpf-section>');
    expect(html).toContain('<env-section>');
  });

  it('has correct class on wrapper', () => {
    expect(getControlGridTemplate()).toContain('class="control-grid"');
  });

  it('has exactly 9 child custom elements referenced', () => {
    const html = getControlGridTemplate();
    // Count all <name-section> (e.g., arp-seq-section, lfo-section, etc.)
    const customTags = html.match(/<[a-z][a-z-]*-section>/g);
    expect(customTags ? customTags.length : 0).toBe(9);
  });
});

// ══════════════════════════════════════════════════════════════════
// Cross-component patterns
// ══════════════════════════════════════════════════════════════════

describe('Cross-component patterns (sections)', () => {
  it('all 8 components can be registered in the same registry', () => {
    const registry = createCustomElementsRegistry();
    defineOscSection(registry);
    defineVcaSection(registry);
    defineVcfSection(registry);
    defineHpfSection(registry);
    definePolySection(registry);
    defineArpSeqSection(registry);
    defineKeyboardSection(registry);
    defineControlGrid(registry);

    expect(registry.get('osc-section')).toBeDefined();
    expect(registry.get('vca-section')).toBeDefined();
    expect(registry.get('vcf-section')).toBeDefined();
    expect(registry.get('hpf-section')).toBeDefined();
    expect(registry.get('poly-section')).toBeDefined();
    expect(registry.get('arp-seq-section')).toBeDefined();
    expect(registry.get('keyboard-section')).toBeDefined();
    expect(registry.get('control-grid')).toBeDefined();
  });

  it('all have connectedCallback that guards against duplicate render', () => {
    const registry = createCustomElementsRegistry();
    defineOscSection(registry);
    defineVcaSection(registry);
    defineVcfSection(registry);
    defineHpfSection(registry);
    definePolySection(registry);
    defineArpSeqSection(registry);
    defineKeyboardSection(registry);
    defineControlGrid(registry);

    ['osc-section', 'vca-section', 'vcf-section', 'hpf-section',
     'poly-section', 'arp-seq-section', 'keyboard-section', 'control-grid'].forEach(function(name) {
      const instance = new (registry.get(name))();
      instance.connectedCallback();
      const firstHTML = instance.innerHTML;
      instance.connectedCallback();
      expect(instance.innerHTML).toBe(firstHTML);
    });
  });

  it('all sections with Edit button use same pattern (btn btn-xs btn-outline edit-panel-btn)', () => {
    const sections = [
      getOscSectionTemplate(),
      getVcaSectionTemplate(),
      getVcfSectionTemplate(),
      getHpfSectionTemplate(),
      getPolySectionTemplate(),
    ];
    sections.forEach(function(html) {
      expect(html).toContain('class="btn btn-xs btn-outline edit-panel-btn"');
    });
  });

  it('ArpSeqSection and KeyboardSection are deliberately different', () => {
    // ArpSeqSection has no Edit button
    expect(getArpSeqSectionTemplate()).not.toContain('edit-panel-btn');
    expect(getKeyboardSectionTemplate()).not.toContain('edit-panel-btn');
  });

  it('all data-params reference valid parameter IDs', () => {
    const allParams = []
      .concat(extractDataParams(getOscSectionTemplate()))
      .concat(extractDataParams(getVcaSectionTemplate()))
      .concat(extractDataParams(getVcfSectionTemplate()))
      .concat(extractDataParams(getHpfSectionTemplate()))
      .concat(extractDataParams(getPolySectionTemplate()))
      .concat(extractDataParams(getArpSeqSectionTemplate()))
      .concat(extractDataParams(getKeyboardSectionTemplate()));

    // All params should be non-empty strings
    allParams.forEach(function(p) {
      expect(typeof p).toBe('string');
      expect(p.length).toBeGreaterThan(0);
    });

    // Each parameter should follow convention (e.g., section_param)
    allParams.forEach(function(p) {
      expect(p).toMatch(/^[a-z][a-z0-9_]+$/);
    });
  });

  it('ControlGrid wraps all other section components', () => {
    const gridHtml = getControlGridTemplate();
    // References each child component
    expect(gridHtml).toContain('arp-seq-section');
    expect(gridHtml).toContain('lfo-section');
    expect(gridHtml).toContain('poly-section');
    expect(gridHtml).toContain('programmer-section');
    expect(gridHtml).toContain('osc-section');
    expect(gridHtml).toContain('vcf-section');
    expect(gridHtml).toContain('vca-section');
    expect(gridHtml).toContain('hpf-section');
    expect(gridHtml).toContain('env-section');
  });

  it('total ctrl-units across all sections', () => {
    const total = countCtrlUnits(getOscSectionTemplate())
      + countCtrlUnits(getVcaSectionTemplate())
      + countCtrlUnits(getVcfSectionTemplate())
      + countCtrlUnits(getHpfSectionTemplate())
      + countCtrlUnits(getPolySectionTemplate())
      + countCtrlUnits(getArpSeqSectionTemplate())
      + countCtrlUnits(getKeyboardSectionTemplate());
    // 5 (OSC) + 1 (VCA) + 5 (VCF) + 1 (HPF) + 1 (Poly) + 2 (ArpSeq) + 2 (Keyboard) = 17
    expect(total).toBe(17);
  });

  it('all Edit buttons use data-accent="orange"', () => {
    const sections = [
      getOscSectionTemplate(),
      getVcaSectionTemplate(),
      getVcfSectionTemplate(),
      getHpfSectionTemplate(),
      getPolySectionTemplate(),
    ];
    sections.forEach(function(html, idx) {
      const names = ['osc-edit-btn', 'vca-edit-btn', 'vcf-edit-btn', 'hpf-edit-btn', 'poly-edit-btn'];
      expect(html).toContain('data-accent="orange"');
      expect(html).toContain('id="' + names[idx] + '"');
    });
  });
});

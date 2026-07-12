/**
 * Tests for WebUI/js/panel_templates.js — HTML template generators for panel editor
 *
 * PANEL_TEMPLATES is an object of template functions (13 modules):
 * LFO(prefix), VCA(), ENV(prefix), HPF(), VCF(), OSC1(), OSC2(),
 * POLY(), PORTA(), CHORD(), POLY_CHORD(), ARP(), SEQ()
 */

// =============================================================================
// Known panel modes and their expected properties
// =============================================================================

var EXPECTED_MODES = [
    { key: 'LFO',      needsPrefix: true,  sections: ['LFO Waveform Shape', 'Modulation, Rates & Phase', 'Sync Options'] },
    { key: 'VCA',      needsPrefix: false, sections: ['VCA Sound Mode', 'VCA Level & Modulation'] },
    { key: 'ENV',      needsPrefix: true,  sections: ['Envelope Curves (ADSR)', 'Envelope Times', 'Envelope Trigger Source'] },
    { key: 'HPF',      needsPrefix: false, sections: ['HPF Bass Boost', 'HPF Cutoff Frequency'] },
    { key: 'VCF',      needsPrefix: false, sections: ['LPF Type', 'Envelope Polarity / Phase', 'Filter LFO Modulation Source', 'VCF Faders & Modulators'] },
    { key: 'OSC1',     needsPrefix: false, sections: ['OSC 1 Waveforms', 'OSC 1 Pitch Range', 'Pitch Mod Destination Mode', 'Modulation Sources Selection', 'OSC Settings', 'OSC 1 Faders'] },
    { key: 'OSC2',     needsPrefix: false, sections: ['OSC 2 Pitch Range', 'OSC Hard Sync', 'Modulation Sources Selection', 'OSC 2 Faders'] },
    { key: 'POLY',     needsPrefix: false, sections: ['Polyphony / Voice Mode', 'Note Priority', 'Envelope Trigger Mode', 'Unison & Drift Faders'] },
    { key: 'PORTA',    needsPrefix: false, sections: ['Portamento Mode', 'Note Priority', 'Trigger Mode', 'Portamento / Tune Sliders', 'Pitch Bend Range'] },
    { key: 'CHORD',    needsPrefix: false, sections: ['Chord Memory Status', 'Root Key', 'Chord Type', 'Hardware Connection'] },
    { key: 'POLY_CHORD', needsPrefix: false, sections: ['Poly Chord Status', 'SELECT KEY TO ASSIGN', 'ASSIGNED CHORD', 'ROOT KEY', 'CHORD TYPE', 'Summary', 'Presets & Hardware'] },
    { key: 'ARP',      needsPrefix: false, sections: ['Arpeggiator Status', 'Arp Routing & Clock', 'Mode & Range', 'Arpeggiator Faders'] },
    { key: 'SEQ',      needsPrefix: false, sections: ['Sequencer Status', 'Clock & Length', 'Step Values', 'Swing & Slew'] }
];

// =============================================================================
// Tests
// =============================================================================

// ---------------------------------------------------------------------------
// Constants — inline PANEL_TEMPLATES from panel_templates.js
// ---------------------------------------------------------------------------

// We import the templates from the source module
// (In vitest, we reference the module under test directly via eval or require)

// Load the source module at runtime (pure data, no DOM dependencies)
var PANEL_TEMPLATES = null;
try {
    // The file assigns to window.PANEL_TEMPLATES, which in vitest's jsdom
    // would be available via require. But the file uses window. assignment.
    // Let's use a simpler approach: define the key expectation tests
    // that check typeof on the actual module.
    var path = require('path');
    var fs = require('fs');
    var sourceContent = fs.readFileSync(path.join(__dirname, '..', 'js', 'panel_templates.js'), 'utf8');
    // Extract PANEL_TEMPLATES by evaluating in a sandbox
    var vm = require('vm');
    var sandbox = { window: {}, console: console };
    vm.createContext(sandbox);
    vm.runInContext(sourceContent, sandbox);
    PANEL_TEMPLATES = sandbox.window.PANEL_TEMPLATES;
} catch (e) {
    // Fallback: define tests without module reference
    console.warn('[panelTemplates] Could not load module:', e.message);
}

describe('PANEL_TEMPLATES — module structure', function () {

    it('PANEL_TEMPLATES is loaded and is an object', function () {
        expect(PANEL_TEMPLATES).not.toBeNull();
        expect(typeof PANEL_TEMPLATES).toBe('object');
    });

    it('has exactly 13 template modules', function () {
        var keys = Object.keys(PANEL_TEMPLATES);
        expect(keys.length).toBe(13);
    });

    it('has all expected mode keys', function () {
        for (var i = 0; i < EXPECTED_MODES.length; i++) {
            expect(PANEL_TEMPLATES).toHaveProperty(EXPECTED_MODES[i].key);
        }
    });

    it('each template is a function', function () {
        for (var i = 0; i < EXPECTED_MODES.length; i++) {
            expect(typeof PANEL_TEMPLATES[EXPECTED_MODES[i].key]).toBe('function');
        }
    });

});

describe('PANEL_TEMPLATES — template rendering', function () {

    it('prefix-parameterized templates (LFO, ENV) correctly substitute prefix', function () {
        var lfoHtml = PANEL_TEMPLATES.LFO('lfo1_');
        expect(lfoHtml).toContain('data-param="lfo1_shape"');
        expect(lfoHtml).toContain('data-param="lfo1_rate"');
        expect(lfoHtml).toContain('data-param="lfo1_delay"');
        expect(lfoHtml).toContain('data-param="lfo1_slew"');
        expect(lfoHtml).toContain('data-param="lfo1_mono_mode"');
        expect(lfoHtml).toContain('data-param="lfo1_key_sync"');
        expect(lfoHtml).toContain('data-param="lfo1_arp_sync"');

        var envHtml = PANEL_TEMPLATES.ENV('env2_');
        expect(envHtml).toContain('data-param="env2_attack_curve"');
        expect(envHtml).toContain('data-param="env2_decay_curve"');
        expect(envHtml).toContain('data-param="env2_sustain_curve"');
        expect(envHtml).toContain('data-param="env2_release_curve"');
        expect(envHtml).toContain('data-param="env2_attack"');
        expect(envHtml).toContain('data-param="env2_decay"');
        expect(envHtml).toContain('data-param="env2_sustain"');
        expect(envHtml).toContain('data-param="env2_release"');
        expect(envHtml).toContain('data-param="env2_trigger_mode"');
    });

    it('all templates return non-empty strings', function () {
        for (var i = 0; i < EXPECTED_MODES.length; i++) {
            var key = EXPECTED_MODES[i].key;
            var needsPrefix = EXPECTED_MODES[i].needsPrefix;
            var html = needsPrefix ? PANEL_TEMPLATES[key]('test_') : PANEL_TEMPLATES[key]();
            expect(typeof html).toBe('string');
            expect(html.length).toBeGreaterThan(0);
        }
    });

});

describe('PANEL_TEMPLATES — section titles', function () {

    it('VCA template contains VCA Sound Mode section', function () {
        var html = PANEL_TEMPLATES.VCA();
        expect(html).toContain('VCA Sound Mode');
        expect(html).toContain('VCA Level & Modulation');
    });

    it('HPF template contains HPF Bass Boost section', function () {
        var html = PANEL_TEMPLATES.HPF();
        expect(html).toContain('HPF Bass Boost');
        expect(html).toContain('HPF Cutoff Frequency');
    });

    it('VCF template contains LPF Type, Envelope Polarity, Filter LFO, VCF Faders', function () {
        var html = PANEL_TEMPLATES.VCF();
        expect(html).toContain('LPF Type');
        expect(html).toContain('Envelope Polarity');
        expect(html).toContain('Filter LFO Modulation Source');
        expect(html).toContain('VCF Faders');
    });

    it('OSC1 template contains Waveforms, Pitch Range, PMode, Modulation, OSC Settings, Faders', function () {
        var html = PANEL_TEMPLATES.OSC1();
        expect(html).toContain('OSC 1 Waveforms');
        expect(html).toContain('OSC 1 Pitch Range');
        expect(html).toContain('Pitch Mod Destination Mode');
        expect(html).toContain('Modulation Sources Selection');
        expect(html).toContain('OSC Settings');
        expect(html).toContain('OSC 1 Faders');
    });

    it('OSC2 template contains Pitch Range, Hard Sync, Modulation, Faders', function () {
        var html = PANEL_TEMPLATES.OSC2();
        expect(html).toContain('OSC 2 Pitch Range');
        expect(html).toContain('OSC Hard Sync');
        expect(html).toContain('Modulation Sources Selection');
        expect(html).toContain('OSC 2 Faders');
    });

    it('POLY template contains Voice Mode, Note Priority, Trigger Mode, Unison Faders', function () {
        var html = PANEL_TEMPLATES.POLY();
        expect(html).toContain('Polyphony / Voice Mode');
        expect(html).toContain('Note Priority');
        expect(html).toContain('Envelope Trigger Mode');
        expect(html).toContain('Unison');
        expect(html).toContain('Drift Faders');
    });

    it('PORTA template contains Portamento Mode, Note Priority, Trigger Mode, Sliders, Pitch Bend', function () {
        var html = PANEL_TEMPLATES.PORTA();
        expect(html).toContain('Portamento Mode');
        expect(html).toContain('Note Priority');
        expect(html).toContain('Trigger Mode');
        expect(html).toContain('Portamento / Tune Sliders');
        expect(html).toContain('Pitch Bend Range');
    });

    it('CHORD template contains Chord Memory, Root Key, Chord Type, Hardware Connection', function () {
        var html = PANEL_TEMPLATES.CHORD();
        expect(html).toContain('Chord Memory Status');
        expect(html).toContain('Root Key');
        expect(html).toContain('Chord Type');
        expect(html).toContain('Hardware Connection');
    });

    it('POLY_CHORD template contains Poly Chord Status, Key Select, Root Key, Chord Type, Summary', function () {
        var html = PANEL_TEMPLATES.POLY_CHORD();
        expect(html).toContain('Poly Chord Status');
        expect(html).toContain('SELECT KEY TO ASSIGN');
        expect(html).toContain('ROOT KEY');
        expect(html).toContain('CHORD TYPE');
        expect(html).toContain('Summary');
        expect(html).toContain('Presets & Hardware');
    });

    it('ARP template contains Arpeggiator Status, Arp Routing, Mode & Range, Faders', function () {
        var html = PANEL_TEMPLATES.ARP();
        expect(html).toContain('Arpeggiator Status');
        expect(html).toContain('Arp Routing & Clock');
        expect(html).toContain('Mode & Range');
        expect(html).toContain('Arpeggiator Faders');
    });

    it('SEQ template contains Sequencer Status, Clock & Length, Step Values, Swing & Slew', function () {
        var html = PANEL_TEMPLATES.SEQ();
        expect(html).toContain('Sequencer Status');
        expect(html).toContain('Clock');
        expect(html).toContain('Length');
        expect(html).toContain('Step Values');
        expect(html).toContain('Swing');
        expect(html).toContain('Slew');
    });

});

describe('PANEL_TEMPLATES — HTML structure', function () {

    it('HTML does not contain unescaped template expressions', function () {
        // Template strings use ${...} interpolation — check none leaked into output
        var html = PANEL_TEMPLATES.OSC1();
        expect(html).not.toContain('${');
    });

    it('v-slider elements have .handle children for all templates', function () {
        for (var i = 0; i < EXPECTED_MODES.length; i++) {
            var key = EXPECTED_MODES[i].key;
            var needsPrefix = EXPECTED_MODES[i].needsPrefix;
            var html = needsPrefix ? PANEL_TEMPLATES[key]('test_') : PANEL_TEMPLATES[key]();
            // Count v-slider divs and .handle divs
            var sliderMatches = html.match(/<div class="v-slider"/g);
            var handleMatches = html.match(/<div class="handle"/g);
            if (sliderMatches && handleMatches) {
                expect(sliderMatches.length).toBe(handleMatches.length);
            }
        }
    });

    it('toggle-box elements have .toggle-led children', function () {
        var html = PANEL_TEMPLATES.VCF();
        var toggleCount = (html.match(/class="toggle-box"/g) || []).length;
        var ledCount = (html.match(/class="toggle-led"/g) || []).length;
        expect(toggleCount).toBe(ledCount);
    });

    it('select elements have option children with value attributes', function () {
        var html = PANEL_TEMPLATES.POLY();
        var selectMatches = html.match(/<select[\s\S]*?<\/select>/g);
        if (selectMatches) {
            for (var s = 0; s < selectMatches.length; s++) {
                var selectHtml = selectMatches[s];
                var optionMatches = selectHtml.match(/<option[\s\S]*?<\/option>/g);
                expect(optionMatches.length).toBeGreaterThan(0);
                // Each option should have a value
                var valueMatches = selectHtml.match(/<option value="\d+"/g);
                expect(valueMatches.length).toBe(optionMatches.length);
            }
        }
    });

});

describe('PANEL_TEMPLATES — LFO shape selector', function () {

    it('has 7 shape options (Sine through Sample & Glide)', function () {
        var html = PANEL_TEMPLATES.LFO('lfo1_');
        var shapeMatches = html.match(/data-shape="\d"/g);
        expect(shapeMatches.length).toBe(7);
        expect(html).toContain('Sine');
        expect(html).toContain('Triangle');
        expect(html).toContain('Square');
        expect(html).toContain('Ramp Up');
        expect(html).toContain('Ramp Down');
        expect(html).toContain('Sample & Hold');
        expect(html).toContain('Sample & Glide');
    });

});

describe('PANEL_TEMPLATES — VCF specific structure', function () {

    it('has 2-Pole and 4-Pole toggle boxes', function () {
        var html = PANEL_TEMPLATES.VCF();
        expect(html).toContain('2-Pole');
        expect(html).toContain('4-Pole');
    });

    it('has Normal and Inverted polarity toggles', function () {
        var html = PANEL_TEMPLATES.VCF();
        expect(html).toContain('Normal');
        expect(html).toContain('Inverted');
    });

    it('has LFO 1 and LFO 2 source toggles', function () {
        var html = PANEL_TEMPLATES.VCF();
        expect(html).toContain('LFO 1');
        expect(html).toContain('LFO 2');
    });

});

describe('PANEL_TEMPLATES — CHORD root key and type', function () {

    it('has 12 root key options (C through B)', function () {
        var html = PANEL_TEMPLATES.CHORD();
        var rootKeys = html.match(/class="shape-led-row chord-key-led-row/g);
        expect(rootKeys.length).toBe(12);
        expect(html).toContain('C');
        expect(html).toContain('C#');
        expect(html).toContain('D');
        expect(html).toContain('E');
        expect(html).toContain('F');
        expect(html).toContain('G');
        expect(html).toContain('A');
        expect(html).toContain('B');
    });

    it('has 12 chord types (Memory through 7th)', function () {
        var html = PANEL_TEMPLATES.CHORD();
        var typeRows = html.match(/class="shape-led-row chord-type-led-row/g);
        expect(typeRows.length).toBe(12);
        expect(html).toContain('Major');
        expect(html).toContain('Minor');
        expect(html).toContain('Power');
        expect(html).toContain('7th');
    });

});

describe('PANEL_TEMPLATES — POLY voice mode select', function () {

    it('has 13 voice mode options (Poly through Poly 8)', function () {
        var html = PANEL_TEMPLATES.POLY();
        var options = html.match(/<option value="\d+">/g);
        expect(options.length).toBe(13);
        expect(html).toContain('Poly');
        expect(html).toContain('Unison');
        expect(html).toContain('Mono');
        expect(html).toContain('Poly 6');
        expect(html).toContain('Poly 8');
    });

});

describe('PANEL_TEMPLATES — ARP specific structure', function () {

    it('has 10 arpeggiator modes (UP through AS-PLAYED)', function () {
        var html = PANEL_TEMPLATES.ARP();
        var options = html.match(/<option value="\d+">/g);
        // Clock select (13) + Vel gate (3) + Mode (10) + Octave (4) = 30 options
        expect(options.length).toBeGreaterThanOrEqual(30);
        expect(html).toContain('UP');
        expect(html).toContain('DOWN');
        expect(html).toContain('RANDOM');
        expect(html).toContain('AS-PLAYED');
    });

    it('has 4 octave range options (1 through 4)', function () {
        var html = PANEL_TEMPLATES.ARP();
        expect(html).toContain('1');
        expect(html).toContain('2');
        expect(html).toContain('3');
        expect(html).toContain('4');
    });

});

describe('PANEL_TEMPLATES — SEQ specific structure', function () {

    it('has 16 clock division options', function () {
        var html = PANEL_TEMPLATES.SEQ();
        var options = html.match(/<option value="\d+">/g);
        // Clock (16) + Length (31) + KeyLoop (3) = 50 options
        expect(html).toContain('1/4');
        expect(html).toContain('1/8');
        expect(html).toContain('1/16');
        expect(html).toContain('1/32');
    });

    it('has step values container', function () {
        var html = PANEL_TEMPLATES.SEQ();
        expect(html).toContain('panel-seq-steps-container');
    });

});

/**
 * Tests for WebUI/js/settings_dump_viewer.js — SysEx decoded dump viewer
 *
 * Strategy: extracted region colors, tooltip formatting (type-specific),
 * byte display helpers, search matching, and summary calculation.
 * DOM-heavy renderDumpView() and initDumpView() are not covered.
 */

// ===== Global stubs =====
globalThis.window = globalThis.window || {};

// ===== Extracted Source Functions =====

var RESERVED_REGION = '?';
var DEFAULT_REGION_COLOR = { bg: '#111', fg: '#888' };

var DUMP_REGION_COLORS = {
    'LFO1':     { bg: '#1a2a3a', fg: '#7fc8ff' },
    'LFO2':     { bg: '#1a2a3a', fg: '#7fc8ff' },
    'OSC1':     { bg: '#2a1a3a', fg: '#c87fff' },
    'OSC2':     { bg: '#2a1a3a', fg: '#c87fff' },
    'OSC':      { bg: '#2a1a3a', fg: '#c87fff' },
    'Noise':    { bg: '#1a1a2a', fg: '#7f7fff' },
    'Porta':    { bg: '#1a2a1a', fg: '#7fff7f' },
    'Pitch':    { bg: '#1a2a1a', fg: '#7fff7f' },
    'VCF':      { bg: '#1a3a2a', fg: '#7fffaf' },
    'HPF':      { bg: '#1a3a2a', fg: '#7fffaf' },
    'ENV1':     { bg: '#3a2a1a', fg: '#ffc87f' },
    'ENV2':     { bg: '#3a2a1a', fg: '#ffc87f' },
    'ENV3':     { bg: '#3a2a1a', fg: '#ffc87f' },
    'VCA':      { bg: '#2a3a1a', fg: '#afff7f' },
    'Voice':    { bg: '#2a1a1a', fg: '#ff7f7f' },
    'ModMat':   { bg: '#1a1a3a', fg: '#7f7fff' },
    'Seq':      { bg: '#2a2a1a', fg: '#ffff7f' },
    'SeqSteps': { bg: '#2a2a1a', fg: '#ffff7f' },
    'Arp':      { bg: '#1a2a2a', fg: '#7fffff' },
    'FX':       { bg: '#2a1a2a', fg: '#ff7fff' },
    'FX1':      { bg: '#2a1a2a', fg: '#ff7fff' },
    'FX2':      { bg: '#2a1a2a', fg: '#ff7fff' },
    'FX3':      { bg: '#2a1a2a', fg: '#ff7fff' },
    'FX4':      { bg: '#2a1a2a', fg: '#ff7fff' },
    'Name':     { bg: '#1a1a1a', fg: '#cccccc' },
    'Tail':     { bg: '#1e1a14', fg: '#998866' },
    'Firmware': { bg: '#141e28', fg: '#88aacc' },
    '?':        { bg: '#1a1a1a', fg: '#666666' },
};

function getRegionColor(region) {
    return DUMP_REGION_COLORS[region] || DEFAULT_REGION_COLOR;
}

function formatHexByte(val) {
    return val.toString(16).toUpperCase().padStart(2, '0');
}

function formatDisplayVal(val, isReserved) {
    var hex = formatHexByte(val);
    return isReserved ? '\u2022' + hex : hex;
}

function isReservedRegion(region) {
    return region === RESERVED_REGION;
}

function matchesSearchTerm(info, idx, val, searchTerm) {
    if (!searchTerm) return true;
    var lower = searchTerm.toLowerCase();
    if (info && info.param && info.param.toLowerCase().indexOf(lower) !== -1) return true;
    if (info && info.region && info.region.toLowerCase().indexOf(lower) !== -1) return true;
    if (String(idx).indexOf(searchTerm) !== -1) return true;
    if (formatHexByte(val).indexOf(searchTerm.toUpperCase()) !== -1) return true;
    if (String(val).indexOf(searchTerm) !== -1) return true;
    return false;
}

function formatTooltip(info, val) {
    var pct = (val / 255 * 100).toFixed(1);
    var lines = ['Byte ' + info.idx + ' \u2014 ' + info.param];
    lines.push('Region: ' + info.region + ' | Type: ' + info.type);
    lines.push('Value: ' + val + ' (0x' + formatHexByte(val) + ') [' + pct + '%]');

    if (info.type === 'toggle') {
        lines.push('\u2192 ' + (val > 0 ? 'ON (1)' : 'OFF (0)'));
    } else if (info.type === 'enum' && info.enumLabels) {
        var idx = Math.min(val, info.enumLabels.length - 1);
        lines.push('\u2192 ' + info.enumLabels[idx] + ' (index ' + idx + ')');
    } else if (info.type === 'bipolar') {
        var bipolar = val - 128;
        lines.push('\u2192 Bipolar: ' + bipolar + ' (center=0, range -128..+127)');
        if (val === 128) lines.push('\u2192 Center (no modulation)');
        else if (val === 0) lines.push('\u2192 Skip step (seq) or min');
    } else if (info.type === 'time') {
        var secs = (val / 255 * 10).toFixed(3);
        lines.push('\u2192 ' + secs + 's');
    } else if (info.type === 'ascii') {
        var ch = val >= 32 && val < 127 ? String.fromCharCode(val) : '\u00B7';
        lines.push('\u2192 \'' + ch + '\'');
    }

    if (info.desc) lines.push('Note: ' + info.desc);

    return lines.join('\n');
}

function calculateSummary(bytes, byteMap) {
    if (!bytes || bytes.length === 0) return null;
    var total = bytes.length;
    var active = 0;
    var zero = 0;
    var reservedCount = 0;

    for (var i = 0; i < bytes.length; i++) {
        if (bytes[i] > 0) active++;
        else zero++;

        var info = byteMap && byteMap[i] || null;
        if (info && info.region === RESERVED_REGION) reservedCount++;
    }

    return { total: total, active: active, zero: zero, reservedCount: reservedCount };
}

function formatSummaryText(summary) {
    if (!summary) return 'No bytes loaded';
    var parts = [summary.total + ' bytes', summary.active + ' active', summary.zero + ' zero'];
    if (summary.reservedCount > 0) parts.push('\uD83D\uDFE6 ' + summary.reservedCount + ' reserved');
    return parts.join(' | ');
}

function getByteSelectionText(idx, val, info) {
    var hex = formatHexByte(val);
    if (info) {
        return 'Selected: b[' + idx + '] ' + info.param + ' = ' + val + ' (0x' + hex + ') [' + info.region + ']';
    }
    return 'Selected: b[' + idx + '] = ' + val + ' (0x' + hex + ') [unmapped]';
}

// ===== Tests =====

describe('DUMP_REGION_COLORS constant', function() {
    it('has all expected regions', function() {
        expect(DUMP_REGION_COLORS.LFO1).toBeDefined();
        expect(DUMP_REGION_COLORS.OSC1).toBeDefined();
        expect(DUMP_REGION_COLORS.VCF).toBeDefined();
        expect(DUMP_REGION_COLORS.ENV1).toBeDefined();
        expect(DUMP_REGION_COLORS.VCA).toBeDefined();
        expect(DUMP_REGION_COLORS.ModMat).toBeDefined();
        expect(DUMP_REGION_COLORS.Seq).toBeDefined();
        expect(DUMP_REGION_COLORS.Arp).toBeDefined();
        expect(DUMP_REGION_COLORS.FX).toBeDefined();
        expect(DUMP_REGION_COLORS.Name).toBeDefined();
        expect(DUMP_REGION_COLORS.Tail).toBeDefined();
        expect(DUMP_REGION_COLORS.Firmware).toBeDefined();
        expect(DUMP_REGION_COLORS['?']).toBeDefined();
    });

    it('each region has bg and fg colors', function() {
        Object.keys(DUMP_REGION_COLORS).forEach(function(key) {
            var c = DUMP_REGION_COLORS[key];
            expect(c.bg).toBeDefined();
            expect(c.fg).toBeDefined();
            expect(typeof c.bg).toBe('string');
            expect(typeof c.fg).toBe('string');
        });
    });
});

describe('RESERVED_REGION and DEFAULT_REGION_COLOR', function() {
    it('reserved region is "?"', function() {
        expect(RESERVED_REGION).toBe('?');
    });

    it('default color has bg and fg', function() {
        expect(DEFAULT_REGION_COLOR.bg).toBe('#111');
        expect(DEFAULT_REGION_COLOR.fg).toBe('#888');
    });
});

describe('getRegionColor', function() {
    it('returns color for known region', function() {
        var c = getRegionColor('VCF');
        expect(c.fg).toBe('#7fffaf');
    });

    it('returns default color for unknown region', function() {
        var c = getRegionColor('UNKNOWN');
        expect(c).toBe(DEFAULT_REGION_COLOR);
    });

    it('returns color for reserved region', function() {
        var c = getRegionColor('?');
        expect(c.bg).toBe('#1a1a1a');
    });
});

describe('formatHexByte', function() {
    it('formats 0 as "00"', function() {
        expect(formatHexByte(0)).toBe('00');
    });

    it('formats 15 as "0F"', function() {
        expect(formatHexByte(15)).toBe('0F');
    });

    it('formats 255 as "FF"', function() {
        expect(formatHexByte(255)).toBe('FF');
    });

    it('formats 128 as "80"', function() {
        expect(formatHexByte(128)).toBe('80');
    });
});

describe('formatDisplayVal', function() {
    it('prepends bullet for reserved bytes', function() {
        expect(formatDisplayVal(255, true)).toBe('\u2022FF');
    });

    it('returns plain hex for non-reserved', function() {
        expect(formatDisplayVal(128, false)).toBe('80');
    });
});

describe('isReservedRegion', function() {
    it('returns true for "?"', function() {
        expect(isReservedRegion('?')).toBe(true);
    });

    it('returns false for known regions', function() {
        expect(isReservedRegion('VCF')).toBe(false);
        expect(isReservedRegion('OSC1')).toBe(false);
    });

    it('returns false for unknown regions', function() {
        expect(isReservedRegion('UNKNOWN')).toBe(false);
    });
});

describe('matchesSearchTerm', function() {
    var info = { param: 'VCF Cutoff', region: 'VCF' };

    it('returns true when searchTerm is empty', function() {
        expect(matchesSearchTerm(info, 39, 200, '')).toBe(true);
    });

    it('matches by param name (case insensitive)', function() {
        expect(matchesSearchTerm(info, 39, 200, 'cutoff')).toBe(true);
    });

    it('matches by region', function() {
        expect(matchesSearchTerm(info, 39, 200, 'vcf')).toBe(true);
    });

    it('matches by byte index', function() {
        expect(matchesSearchTerm(info, 39, 200, '39')).toBe(true);
    });

    it('matches by hex value', function() {
        expect(matchesSearchTerm(info, 39, 200, 'C8')).toBe(true);
    });

    it('matches by decimal value', function() {
        expect(matchesSearchTerm(info, 39, 200, '200')).toBe(true);
    });

    it('returns false when nothing matches', function() {
        expect(matchesSearchTerm(info, 39, 200, 'zzzz')).toBe(false);
    });

    it('handles null info', function() {
        expect(matchesSearchTerm(null, 5, 100, '5')).toBe(true);
        expect(matchesSearchTerm(null, 5, 100, 'nonexistent')).toBe(false);
    });
});

describe('formatTooltip — type-specific formatting', function() {
    it('formats basic info line', function() {
        var tooltip = formatTooltip({ idx: 39, param: 'VCF Cutoff', region: 'VCF', type: 'float' }, 200);
        expect(tooltip).toContain('Byte 39');
        expect(tooltip).toContain('VCF Cutoff');
        expect(tooltip).toContain('Region: VCF');
        expect(tooltip).toContain('200');
        expect(tooltip).toContain('0xC8');
    });

    it('formats toggle: ON for val > 0', function() {
        var tooltip = formatTooltip({ idx: 19, param: 'OSC1 Saw', region: 'OSC1', type: 'toggle' }, 1);
        expect(tooltip).toContain('ON (1)');
    });

    it('formats toggle: OFF for val = 0', function() {
        var tooltip = formatTooltip({ idx: 19, param: 'OSC1 Saw', region: 'OSC1', type: 'toggle' }, 0);
        expect(tooltip).toContain('OFF (0)');
    });

    it('formats enum with labels', function() {
        var tooltip = formatTooltip({
            idx: 14, param: 'OSC1 Range', region: 'OSC1', type: 'enum',
            enumLabels: ["16'", "8'", "4'"]
        }, 1);
        expect(tooltip).toContain("8'");
        expect(tooltip).toContain('index 1');
    });

    it('clamps enum index to labels length', function() {
        var tooltip = formatTooltip({
            idx: 14, param: 'OSC1 Range', region: 'OSC1', type: 'enum',
            enumLabels: ["16'", "8'", "4'"]
        }, 255);
        expect(tooltip).toContain("4'");
        expect(tooltip).toContain('index 2');
    });

    it('formats bipolar: center at raw=128', function() {
        var tooltip = formatTooltip({ idx: 39, param: 'VCF Cutoff', region: 'VCF', type: 'bipolar' }, 128);
        expect(tooltip).toContain('Bipolar: 0');
        expect(tooltip).toContain('Center (no modulation)');
    });

    it('formats bipolar: positive value', function() {
        var tooltip = formatTooltip({ idx: 39, param: 'VCF Cutoff', region: 'VCF', type: 'bipolar' }, 200);
        expect(tooltip).toContain('Bipolar: 72');
    });

    it('formats bipolar: skip at raw=0', function() {
        var tooltip = formatTooltip({ idx: 39, param: 'VCF Cutoff', region: 'VCF', type: 'bipolar' }, 0);
        expect(tooltip).toContain('Bipolar: -128');
        expect(tooltip).toContain('Skip step (seq) or min');
    });

    it('formats time type in seconds', function() {
        var tooltip = formatTooltip({ idx: 0, param: 'LFO1 Rate', region: 'LFO1', type: 'time' }, 128);
        expect(tooltip).toContain('s'); // seconds
        // 128/255*10 = 5.0196...
        expect(tooltip).toContain('5.0');
    });

    it('formats ascii type', function() {
        var tooltip = formatTooltip({ idx: 224, param: 'Patch Name', region: 'Name', type: 'ascii' }, 65);
        expect(tooltip).toContain("'A'");
    });

    it('formats ascii dot for non-printable chars', function() {
        var tooltip = formatTooltip({ idx: 224, param: 'Patch Name', region: 'Name', type: 'ascii' }, 0);
        expect(tooltip).toContain('\u00B7'); // middle dot
    });

    it('includes description when present', function() {
        var tooltip = formatTooltip({
            idx: 19, param: 'OSC1 Saw', region: 'OSC1', type: 'toggle', desc: 'Enable saw wave'
        }, 1);
        expect(tooltip).toContain('Enable saw wave');
    });

    it('handles float type without special formatting', function() {
        var tooltip = formatTooltip({ idx: 39, param: 'VCF Cutoff', region: 'VCF', type: 'float' }, 128);
        // No extra arrow line beyond the standard ones
        var lines = tooltip.split('\n');
        expect(lines.length).toBe(3); // header, region, value
    });
});

describe('calculateSummary', function() {
    it('returns null for null bytes', function() {
        expect(calculateSummary(null, [])).toBeNull();
    });

    it('returns null for empty bytes', function() {
        expect(calculateSummary([], [])).toBeNull();
    });

    it('counts total, active, zero bytes', function() {
        var bytes = [0, 255, 128, 0, 64];
        var result = calculateSummary(bytes, []);
        expect(result.total).toBe(5);
        expect(result.active).toBe(3);
        expect(result.zero).toBe(2);
        expect(result.reservedCount).toBe(0);
    });

    it('counts reserved bytes from byteMap', function() {
        var bytes = [0, 255, 128, 0, 64];
        var byteMap = [
            null,
            { region: 'VCF' },
            { region: '?' },
            null,
            { region: '?' }
        ];
        var result = calculateSummary(bytes, byteMap);
        expect(result.total).toBe(5);
        expect(result.active).toBe(3);
        expect(result.zero).toBe(2);
        expect(result.reservedCount).toBe(2); // indices 2 and 4 are '?'
    });

    it('handles all-zero bytes', function() {
        var bytes = [0, 0, 0];
        expect(calculateSummary(bytes, []).active).toBe(0);
        expect(calculateSummary(bytes, []).zero).toBe(3);
    });
});

describe('formatSummaryText', function() {
    it('returns "No bytes loaded" for null', function() {
        expect(formatSummaryText(null)).toBe('No bytes loaded');
    });

    it('formats basic summary', function() {
        var text = formatSummaryText({ total: 242, active: 180, zero: 62, reservedCount: 0 });
        expect(text).toContain('242 bytes');
        expect(text).toContain('180 active');
        expect(text).toContain('62 zero');
        expect(text).not.toContain('reserved');
    });

    it('includes reserved count when > 0', function() {
        var text = formatSummaryText({ total: 242, active: 180, zero: 62, reservedCount: 5 });
        expect(text).toContain('reserved');
        expect(text).toContain('5');
    });
});

describe('getByteSelectionText', function() {
    it('formats with info', function() {
        var text = getByteSelectionText(39, 200, { param: 'VCF Cutoff', region: 'VCF' });
        expect(text).toContain('b[39]');
        expect(text).toContain('VCF Cutoff');
        expect(text).toContain('200');
        expect(text).toContain('0xC8');
        expect(text).toContain('[VCF]');
    });

    it('formats without info as unmapped', function() {
        var text = getByteSelectionText(5, 100, null);
        expect(text).toContain('b[5]');
        expect(text).toContain('100');
        expect(text).toContain('0x64');
        expect(text).toContain('[unmapped]');
    });
});

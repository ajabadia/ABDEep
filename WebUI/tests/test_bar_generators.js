/**
 * Unit tests for _genFillBar and _genPosBar
 *
 * Run with: node WebUI/tests/test_bar_generators.js
 *
 * These functions are extracted from WebUI/js/script.js and tested
 * in isolation with Node.js (no browser DOM needed).
 */

// ── Extract functions under test ──────────────────────────────────
// Copied verbatim from script.js lines 1954-1969
function _genFillBar(fillLen, totalLen, fillChar, emptyChar) {
    if (totalLen === undefined) totalLen = 18;
    if (fillChar === undefined) fillChar = '\u2588';
    if (emptyChar === undefined) emptyChar = '\u2591';
    fillLen = Math.max(0, Math.round(fillLen));
    return fillChar.repeat(Math.min(fillLen, totalLen)) + emptyChar.repeat(Math.max(0, totalLen - fillLen));
}

function _genPosBar(pos, totalLen, fillChar, emptyChar) {
    if (totalLen === undefined) totalLen = 18;
    if (fillChar === undefined) fillChar = '\u2588';
    if (emptyChar === undefined) emptyChar = '\u2591';
    pos = Math.max(0, Math.min(Math.round(pos), totalLen - 1));
    return emptyChar.repeat(pos) + fillChar + emptyChar.repeat(Math.max(0, totalLen - pos - 1));
}

// ── Test runner ───────────────────────────────────────────────────
const FILL = '\u2588'; // █
const EMPTY = '\u2591'; // ░

let passed = 0;
let failed = 0;

function assert(condition, msg) {
    if (condition) {
        passed++;
    } else {
        failed++;
        console.error('  FAIL:', msg);
    }
}

function test(name, fn) {
    console.log('\n# ' + name);
    fn();
}

// ══════════════════════════════════════════════════════════════════
// _genFillBar tests
// ══════════════════════════════════════════════════════════════════

test('_genFillBar — fillLen=0', () => {
    const result = _genFillBar(0, 10);
    assert(result.length === 10, 'length === 10');
    assert(result === EMPTY.repeat(10), 'all empty chars');
    assert(!result.includes(FILL), 'no fill chars');
});

test('_genFillBar — fillLen=totalLen (full bar)', () => {
    const result = _genFillBar(10, 10);
    assert(result.length === 10, 'length === 10');
    assert(result === FILL.repeat(10), 'all fill chars');
    assert(!result.includes(EMPTY), 'no empty chars');
});

test('_genFillBar — fillLen > totalLen (clamped)', () => {
    const result = _genFillBar(20, 10);
    assert(result.length === 10, 'length === 10 (clamped)');
    assert(result === FILL.repeat(10), 'all fill chars (clamped)');
});

test('_genFillBar — fillLen half', () => {
    const result = _genFillBar(5, 10);
    assert(result.length === 10, 'length === 10');
    assert(result === FILL.repeat(5) + EMPTY.repeat(5), '5 fill + 5 empty');
});

test('_genFillBar — fillLen negative (clamped to 0)', () => {
    const result = _genFillBar(-5, 10);
    assert(result.length === 10, 'length === 10');
    assert(result === EMPTY.repeat(10), 'all empty (negative clamped to 0)');
});

test('_genFillBar — fillLen float (rounded)', () => {
    const result = _genFillBar(3.7, 10);
    assert(result.length === 10, 'length === 10');
    assert(result === FILL.repeat(4) + EMPTY.repeat(6), '3.7 → 4 fill chars (Math.round)');
});

test('_genFillBar — default totalLen (18)', () => {
    const result = _genFillBar(5);
    assert(result.length === 18, 'default length === 18');
    assert(result === FILL.repeat(5) + EMPTY.repeat(13), '5 fill + 13 empty');
});

test('_genFillBar — custom fillChar and emptyChar', () => {
    const result = _genFillBar(4, 8, '*', '.');
    assert(result === '****....', 'custom chars: 4* + 4.');
});

test('_genFillBar — totalLen=0', () => {
    const result = _genFillBar(0, 0);
    assert(result.length === 0, 'empty string for totalLen=0');
});

test('_genFillBar — totalLen=1', () => {
    const r0 = _genFillBar(0, 1);
    assert(r0 === EMPTY, 'fillLen=0, totalLen=1 → empty');
    const r1 = _genFillBar(1, 1);
    assert(r1 === FILL, 'fillLen=1, totalLen=1 → fill');
    const r2 = _genFillBar(5, 1);
    assert(r2 === FILL, 'fillLen=5, totalLen=1 → clamped to 1 fill');
});

// ══════════════════════════════════════════════════════════════════
// _genPosBar tests
// ══════════════════════════════════════════════════════════════════

test('_genPosBar — pos=0 (first position)', () => {
    const result = _genPosBar(0, 10);
    assert(result.length === 10, 'length === 10');
    assert(result === FILL + EMPTY.repeat(9), 'fill at position 0');
});

test('_genPosBar — pos=last (totalLen-1)', () => {
    const result = _genPosBar(9, 10);
    assert(result.length === 10, 'length === 10');
    assert(result === EMPTY.repeat(9) + FILL, 'fill at last position');
});

test('_genPosBar — pos negative (clamped to 0)', () => {
    const result = _genPosBar(-3, 10);
    assert(result.length === 10, 'length === 10');
    assert(result === FILL + EMPTY.repeat(9), 'negative pos → fill at position 0');
});

test('_genPosBar — pos > totalLen-1 (clamped to last)', () => {
    const result = _genPosBar(20, 10);
    assert(result.length === 10, 'length === 10');
    assert(result === EMPTY.repeat(9) + FILL, 'pos > max → clamped to last position');
});

test('_genPosBar — pos float (rounded)', () => {
    const result = _genPosBar(3.7, 10);
    assert(result.length === 10, 'length === 10');
    assert(result === EMPTY.repeat(4) + FILL + EMPTY.repeat(5), '3.7 → pos 4 (Math.round)');
});

test('_genPosBar — default totalLen (18)', () => {
    const result = _genPosBar(5);
    assert(result.length === 18, 'default length === 18');
    assert(result[5] === FILL, 'fill at position 5');
    assert(result.indexOf(FILL) === 5, 'fill only at position 5');
});

test('_genPosBar — custom fillChar and emptyChar', () => {
    const result = _genPosBar(3, 8, 'X', '_');
    assert(result === '___X____', 'custom chars: X at pos 3, underscores elsewhere');
});

test('_genPosBar — totalLen=1', () => {
    const r0 = _genPosBar(0, 1);
    assert(r0 === FILL, 'pos=0, total=1 → single fill');
    const r1 = _genPosBar(5, 1);
    assert(r1 === FILL, 'pos=5, total=1 → clamped to single fill');
    const rn = _genPosBar(-2, 1);
    assert(rn === FILL, 'pos=-2, total=1 → clamped to single fill');
});

test('_genPosBar — single fill character only at correct position', () => {
    const result = _genPosBar(7, 15);
    const fillCount = (result.match(/\u2588/g) || []).length;
    assert(fillCount === 1, 'exactly 1 fill character');
    assert(result[7] === FILL, 'fill at correct position 7');
});

// ══════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
    console.error('❌ Some tests FAILED');
    process.exit(1);
} else {
    console.log('✅ All tests passed!');
}

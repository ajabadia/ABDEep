/**
 * Tests for WebUI/js/script_controllers.js — LCD priority queue, fade timing, VU ballistics, controller display
 *
 * Extracted pure functions:
 * - LcdQueue: priority queue with expiry (push, getActive, clear)
 * - getLcdFadeTiming(speed): timing values for fade animation
 * - calcVuSmoothed(rawPeak, smoothed, dt, isAttack): exponential moving average VU ballistics
 * - calcDbFromPeak(peakLevel): peak level → dB conversion
 * - getVuColor(peakLevel): peak level → CSS color variable
 * - formatPitchBend(pb): pitch bend value → st string
 * - calcSeqStepBar(seqVal): sequencer value → left/center/right bar segments
 * - calcSeqStepVal(seqVal): sequencer value → bipolar display value
 * - calcControllerPercent(val): 0..1 → percentage string
 * - calcTypewriterChars(text, elapsedMs, charMs): typewriter animation progress
 * - calcSeqFadeOpacity(elapsed, fadeHalf): sequencer step crossfade opacity
 */

// =============================================================================
// Extracted functions from script_controllers.js
// =============================================================================

// LcdQueue — priority queue with auto-expiry
function createLcdQueue() {
    const messages = {};
    const expiryTimers = {};

    return {
        _getMessages: function() { return messages; },
        _getExpiryTimers: function() { return expiryTimers; },

        push: function(id, content, priority, options) {
            options = options || {};
            messages[id] = {
                content: content,
                priority: priority,
                timestamp: Date.now()
            };
            if (expiryTimers[id]) {
                clearTimeout(expiryTimers[id]);
            }
            const duration = (options.duration !== undefined) ? options.duration : 2000;
            if (duration !== null) {
                const self = this;
                expiryTimers[id] = setTimeout(function() {
                    delete messages[id];
                    delete expiryTimers[id];
                }, duration);
            }
        },

        getActive: function() {
            let best = null;
            for (const id in messages) {
                const m = messages[id];
                if (!best || m.priority < best.priority) {
                    best = m;
                }
            }
            return best;
        },

        clear: function() {
            for (var id in expiryTimers) {
                clearTimeout(expiryTimers[id]);
            }
            for (var id in messages) {
                delete messages[id];
            }
            for (var id in expiryTimers) {
                delete expiryTimers[id];
            }
        }
    };
}

// getLcdFadeTiming — returns timing for fade-out/in animations
function getLcdFadeTiming(speed) {
    switch (speed) {
        case 'off':    return { out:0, swap:0, in:0, cleanup:0, outR:0, swapR:0, inR:0, cleanupR:0 };
        case 'fast':   return { out:60, swap:70, in:60, cleanup:80, outR:80, swapR:90, inR:80, cleanupR:100 };
        case 'normal': return { out:100, swap:110, in:100, cleanup:130, outR:150, swapR:160, inR:150, cleanupR:180 };
        case 'slow':   return { out:220, swap:230, in:220, cleanup:250, outR:300, swapR:320, inR:300, cleanupR:350 };
        default:       return { out:100, swap:110, in:100, cleanup:130, outR:150, swapR:160, inR:150, cleanupR:180 };
    }
}

// VU ballistics — exponential moving average with different attack/release
function calcVuSmoothed(rawPeak, smoothed, dt, isAttack) {
    const VU_ATTACK_MS = 5;
    const VU_RELEASE_MS = 300;
    rawPeak = Math.max(0, Math.min(1, rawPeak));

    if (isAttack !== undefined ? isAttack : rawPeak > smoothed) {
        const attackCoeff = Math.exp(-dt / VU_ATTACK_MS);
        smoothed = smoothed * attackCoeff + rawPeak * (1 - attackCoeff);
    } else {
        const releaseCoeff = Math.exp(-dt / VU_RELEASE_MS);
        smoothed = rawPeak + (smoothed - rawPeak) * releaseCoeff;
    }
    if (smoothed < 0.001) {smoothed = 0.0;}
    return smoothed;
}

// Peak level → dB conversion
function calcDbFromPeak(peakLevel) {
    if (peakLevel < 0.0001) {return '-\\u221E';}
    return (20.0 * Math.log10(peakLevel)).toFixed(1);
}

// Peak level → CSS color variable name
function getVuColor(peakLevel) {
    if (peakLevel < 0.001) {return 'var(--text-faint)';}
    if (peakLevel < 0.06)  {return 'var(--accent-green)';}
    if (peakLevel < 0.5)   {return 'var(--accent-yellow)';}
    if (peakLevel < 0.7)   {return 'var(--accent-orange)';}
    return 'var(--color-danger)';
}

// Pitch bend → st string with sign
function formatPitchBend(pb) {
    pb = Math.max(-1, Math.min(1, pb));
    const st = pb * 2.0;
    return (st >= 0 ? '+' : '') + st.toFixed(2);
}

// Sequencer value → bipolar display value
function calcSeqStepVal(seqVal) {
    const bipVal = (seqVal * 2.0) - 1.0;
    return Math.round(bipVal * 127);
}

// Sequencer value → bar segments (left, center-marker, right)
function calcSeqStepBar(seqVal) {
    const bipVal = (seqVal * 2.0) - 1.0;
    const barHalf = 12;
    const fillLen = Math.round(Math.abs(bipVal) * barHalf);
    const leftBar = bipVal >= 0
        ? window._genFillBar(0, barHalf)
        : window._genFillBar(fillLen, barHalf);
    const rightBar = bipVal < 0
        ? window._genFillBar(0, barHalf)
        : window._genFillBar(fillLen, barHalf);
    const centerMarker = '\\u2502';
    return { left: leftBar, center: centerMarker, right: rightBar };
}

// Controller 0..1 → percentage string (e.g. "75%")
function calcControllerPercent(val) {
    return Math.round(Math.max(0, Math.min(1, val)) * 100) + '%';
}

// Typewriter animation: how many chars to show at given elapsed time
function calcTypewriterChars(text, elapsedMs, charMs) {
    charMs = charMs || 65;
    if (elapsedMs <= 0) {return 1;}
    return Math.min(text.length, Math.max(1, Math.floor(elapsedMs / charMs)));
}

// Sequencer crossfade: returns opacity based on elapsed time
function calcSeqFadeOpacity(elapsed, fadeHalf) {
    fadeHalf = fadeHalf || 40;
    if (elapsed < fadeHalf) {
        const fadeOut = 1.0 - (elapsed / fadeHalf);
        return { phase: 'out', opacity: Math.max(0, fadeOut) };
    } else if (elapsed < fadeHalf * 2) {
        const fadeIn = (elapsed - fadeHalf) / fadeHalf;
        return { phase: 'in', opacity: Math.min(1, fadeIn) };
    } else {
        return { phase: 'done', opacity: 1.0 };
    }
}

// =============================================================================
// Stubs for bar generator dependencies
// =============================================================================
if (typeof window === 'undefined') {
    globalThis.window = {};
}
if (typeof window._genFillBar !== 'function') {
    window._genFillBar = function(fillLen, totalLen, fillChar, emptyChar) {
        fillChar = fillChar || '\\u2588';
        emptyChar = emptyChar || '\\u2591';
        let bar = '';
        for (let i = 0; i < totalLen; i++) {
            bar += i < fillLen ? fillChar : emptyChar;
        }
        return bar;
    };
}

// =============================================================================
// Tests
// =============================================================================

// ---------------------------------------------------------------------------
// LcdQueue
// ---------------------------------------------------------------------------

describe('LcdQueue', function () {

    beforeEach(function () {
        vi.useFakeTimers();
    });

    afterEach(function () {
        vi.useRealTimers();
    });

    it('push and getActive returns the pushed message', function () {
        const q = createLcdQueue();
        q.push('test1', 'Hello', 1);
        const active = q.getActive();
        expect(active).not.toBeNull();
        expect(active.content).toBe('Hello');
        expect(active.priority).toBe(1);
    });

    it('getActive returns message with lowest priority (highest urgency)', function () {
        const q = createLcdQueue();
        q.push('low', 'Low Priority', 5);
        q.push('high', 'High Priority', 1);
        q.push('mid', 'Mid Priority', 3);
        const active = q.getActive();
        expect(active.content).toBe('High Priority');
        expect(active.priority).toBe(1);
    });

    it('getActive returns null when queue is empty', function () {
        const q = createLcdQueue();
        expect(q.getActive()).toBeNull();
    });

    it('push with same id replaces previous message', function () {
        const q = createLcdQueue();
        q.push('dup', 'First', 1);
        q.push('dup', 'Second', 2);
        const active = q.getActive();
        expect(active.content).toBe('Second');
        // Only one message in queue
        let count = 0;
        for (const id in q._getMessages()) {count++;}
        expect(count).toBe(1);
    });

    it('message auto-expires after default 2000ms', function () {
        const q = createLcdQueue();
        q.push('exp', 'Expires', 1);
        expect(q.getActive()).not.toBeNull();

        vi.advanceTimersByTime(2000);

        expect(q.getActive()).toBeNull();
    });

    it('message auto-expires after custom duration', function () {
        const q = createLcdQueue();
        q.push('fast', 'Fast Expire', 1, { duration: 100 });
        expect(q.getActive()).not.toBeNull();

        vi.advanceTimersByTime(100);

        expect(q.getActive()).toBeNull();
    });

    it('push with duration=null does not expire', function () {
        const q = createLcdQueue();
        q.push('perm', 'Permanent', 1, { duration: null });
        expect(q.getActive()).not.toBeNull();

        vi.advanceTimersByTime(10000);

        expect(q.getActive()).not.toBeNull();
    });

    it('clear removes all messages and timers', function () {
        const q = createLcdQueue();
        q.push('a', 'A', 1);
        q.push('b', 'B', 2);
        q.clear();

        expect(q.getActive()).toBeNull();
        let count = 0;
        for (const id in q._getMessages()) {count++;}
        expect(count).toBe(0);
    });

    it('multiple messages: highest priority (lowest number) wins', function () {
        const q = createLcdQueue();
        q.push('p3', 'Prio 3', 3);
        q.push('p1', 'Prio 1', 1);
        q.push('p2', 'Prio 2', 2);

        expect(q.getActive().content).toBe('Prio 1');

        // Remove highest priority
        delete q._getMessages()['p1'];
        expect(q.getActive().content).toBe('Prio 2');

        delete q._getMessages()['p2'];
        expect(q.getActive().content).toBe('Prio 3');
    });

    it('push restarts expiry timer for existing id', function () {
        const q = createLcdQueue();
        q.push('test', 'First', 1, { duration: 500 });
        vi.advanceTimersByTime(300);

        // Re-push before expiry — timer should restart
        q.push('test', 'Second', 1, { duration: 500 });
        vi.advanceTimersByTime(300);
        // First expiry (500ms from original push) would have expired, but timer was restarted
        expect(q.getActive()).not.toBeNull();

        vi.advanceTimersByTime(200);
        // Now 500ms from re-push has passed
        expect(q.getActive()).toBeNull();
    });

});

// ---------------------------------------------------------------------------
// getLcdFadeTiming
// ---------------------------------------------------------------------------

describe('getLcdFadeTiming', function () {

    it('returns zero timings for "off"', function () {
        const t = getLcdFadeTiming('off');
        expect(t.out).toBe(0);
        expect(t.swap).toBe(0);
        expect(t.in).toBe(0);
        expect(t.cleanup).toBe(0);
        expect(t.outR).toBe(0);
        expect(t.swapR).toBe(0);
        expect(t.inR).toBe(0);
        expect(t.cleanupR).toBe(0);
    });

    it('returns fast timings', function () {
        const t = getLcdFadeTiming('fast');
        expect(t.out).toBe(60);
        expect(t.in).toBe(60);
        expect(t.swap).toBe(70);
        expect(t.cleanup).toBe(80);
    });

    it('returns normal timings by default', function () {
        const t = getLcdFadeTiming('normal');
        expect(t.out).toBe(100);
        expect(t.in).toBe(100);
        expect(t.swap).toBe(110);
        expect(t.cleanup).toBe(130);
    });

    it('returns slow timings', function () {
        const t = getLcdFadeTiming('slow');
        expect(t.out).toBe(220);
        expect(t.in).toBe(220);
        expect(t.swap).toBe(230);
        expect(t.cleanup).toBe(250);
    });

    it('unknown speed defaults to normal', function () {
        const t = getLcdFadeTiming('unknown');
        expect(t.out).toBe(100);
        expect(t.in).toBe(100);
    });

    it('restore timings (outR/inR) are longer than regular fade timings', function () {
        const t = getLcdFadeTiming('normal');
        expect(t.outR).toBe(150);
        expect(t.inR).toBe(150);
        expect(t.outR).toBeGreaterThan(t.out);
    });

});

// ---------------------------------------------------------------------------
// calcVuSmoothed — VU ballistics
// ---------------------------------------------------------------------------

describe('calcVuSmoothed', function () {

    it('attack: approaches rawPeak quickly (small time step)', function () {
        // rawPeak=1.0, smoothed=0, dt=1ms, attack
        const result = calcVuSmoothed(1.0, 0, 1, true);
        // attackCoeff = exp(-1/5) ≈ 0.8187
        // result = 0 * 0.8187 + 1 * 0.1813 ≈ 0.1813
        expect(result).toBeGreaterThan(0.15);
        expect(result).toBeLessThan(0.2);
    });

    it('release: decays slowly over time', function () {
        // rawPeak=0, smoothed=0.5, dt=100ms, release
        const result = calcVuSmoothed(0, 0.5, 100, false);
        // releaseCoeff = exp(-100/300) ≈ 0.7165
        // result = 0 + 0.5 * 0.7165 ≈ 0.3583
        expect(result).toBeGreaterThan(0.3);
        expect(result).toBeLessThan(0.4);
    });

    it('clamps below 0.001 to 0.0', function () {
        const result = calcVuSmoothed(0, 0.0005, 100, false);
        expect(result).toBe(0.0);
    });

    it('auto-detects attack when rawPeak > smoothed', function () {
        const result = calcVuSmoothed(1.0, 0.3, 5);
        // rawPeak (1.0) > smoothed (0.3) → attack path
        expect(result).toBeGreaterThan(0.3);
    });

    it('auto-detects release when rawPeak < smoothed', function () {
        const result = calcVuSmoothed(0, 0.8, 50);
        // rawPeak (0) < smoothed (0.8) → release path
        expect(result).toBeLessThan(0.8);
        expect(result).toBeGreaterThan(0.6);
    });

    it('clamps rawPeak to [0, 1]', function () {
        let result = calcVuSmoothed(2.0, 0, 1, true);
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThanOrEqual(1);

        result = calcVuSmoothed(-0.5, 0, 1, true);
        expect(result).toBe(0);
    });

});

// ---------------------------------------------------------------------------
// calcDbFromPeak — dB conversion
// ---------------------------------------------------------------------------

describe('calcDbFromPeak', function () {

    it('returns -infinity for very small values', function () {
        expect(calcDbFromPeak(0)).toBe('-\\u221E');
        expect(calcDbFromPeak(0.00005)).toBe('-\\u221E');
    });

    it('returns 0 dB for peak=1.0', function () {
        expect(calcDbFromPeak(1.0)).toBe('0.0');
    });

    it('returns -6.0 dB for peak=0.5', function () {
        expect(calcDbFromPeak(0.5)).toBe('-6.0');
    });

    it('returns -20.0 dB for peak=0.1', function () {
        expect(calcDbFromPeak(0.1)).toBe('-20.0');
    });

    it('returns -40.0 dB for peak=0.01', function () {
        expect(calcDbFromPeak(0.01)).toBe('-40.0');
    });

});

// ---------------------------------------------------------------------------
// getVuColor — VU meter color thresholds
// ---------------------------------------------------------------------------

describe('getVuColor', function () {

    it('text-faint for near-zero', function () {
        expect(getVuColor(0)).toBe('var(--text-faint)');
        expect(getVuColor(0.0005)).toBe('var(--text-faint)');
    });

    it('green for peak < 0.06', function () {
        expect(getVuColor(0.03)).toBe('var(--accent-green)');
        expect(getVuColor(0.059)).toBe('var(--accent-green)');
    });

    it('yellow for peak 0.06..0.5', function () {
        expect(getVuColor(0.06)).toBe('var(--accent-yellow)');
        expect(getVuColor(0.3)).toBe('var(--accent-yellow)');
    });

    it('orange for peak 0.5..0.7', function () {
        expect(getVuColor(0.5)).toBe('var(--accent-orange)');
        expect(getVuColor(0.69)).toBe('var(--accent-orange)');
    });

    it('red for peak >= 0.7', function () {
        expect(getVuColor(0.7)).toBe('var(--color-danger)');
        expect(getVuColor(1.0)).toBe('var(--color-danger)');
    });

});

// ---------------------------------------------------------------------------
// formatPitchBend
// ---------------------------------------------------------------------------

describe('formatPitchBend', function () {

    it('formats positive bend with + sign', function () {
        expect(formatPitchBend(0.5)).toBe('+1.00');
        expect(formatPitchBend(1.0)).toBe('+2.00');
    });

    it('formats negative bend with - sign', function () {
        expect(formatPitchBend(-0.5)).toBe('-1.00');
        expect(formatPitchBend(-1.0)).toBe('-2.00');
    });

    it('formats zero bend as +0.00', function () {
        expect(formatPitchBend(0)).toBe('+0.00');
    });

    it('clamps to [-1, 1]', function () {
        expect(formatPitchBend(2.0)).toBe('+2.00');
        expect(formatPitchBend(-2.0)).toBe('-2.00');
    });

    it('formats fractional values correctly', function () {
        expect(formatPitchBend(0.25)).toBe('+0.50');
        expect(formatPitchBend(-0.75)).toBe('-1.50');
    });

});

// ---------------------------------------------------------------------------
// calcControllerPercent
// ---------------------------------------------------------------------------

describe('calcControllerPercent', function () {

    it('returns percentage string for 0..1', function () {
        expect(calcControllerPercent(0)).toBe('0%');
        expect(calcControllerPercent(0.5)).toBe('50%');
        expect(calcControllerPercent(1.0)).toBe('100%');
    });

    it('clamps input range', function () {
        expect(calcControllerPercent(1.5)).toBe('100%');
        expect(calcControllerPercent(-0.5)).toBe('0%');
    });

    it('rounds to integer', function () {
        expect(calcControllerPercent(0.756)).toBe('76%');
    });

});

// ---------------------------------------------------------------------------
// calcSeqStepVal
// ---------------------------------------------------------------------------

describe('calcSeqStepVal', function () {

    it('maps 0.5 → 0 (center)', function () {
        expect(calcSeqStepVal(0.5)).toBe(0);
    });

    it('maps 0 → -127 (fully down)', function () {
        expect(calcSeqStepVal(0)).toBe(-127);
    });

    it('maps 1.0 → 127 (fully up)', function () {
        expect(calcSeqStepVal(1.0)).toBe(127);
    });

    it('maps 0.75 → 64 (round 63.5 away from zero)', function () {
        expect(calcSeqStepVal(0.75)).toBe(64);
    });

    it('maps 0.25 → -63', function () {
        expect(calcSeqStepVal(0.25)).toBe(-63);
    });

});

// ---------------------------------------------------------------------------
// calcSeqStepBar
// ---------------------------------------------------------------------------

describe('calcSeqStepBar', function () {

    it('positive value: left bar is empty, right bar fills', function () {
        const bar = calcSeqStepBar(0.75);
        // bipVal = 0.5, fillLen = round(0.5 * 12) = 6
        // leftBar: genFillBar(0, 12) → empty
        // rightBar: genFillBar(6, 12) → 6 filled + 6 empty
        expect(typeof bar.left).toBe('string');
        expect(typeof bar.right).toBe('string');
        expect(bar.center).toBe('\\u2502');
        // left should be all empty (0 filled)
        expect(bar.left.indexOf('\\u2588')).toBe(-1);
        // right should have some filled
        expect(bar.right.indexOf('\\u2588')).not.toBe(-1);
    });

    it('negative value: left bar fills, right bar is empty', function () {
        const bar = calcSeqStepBar(0.25);
        // bipVal = -0.5, fillLen = round(0.5 * 12) = 6
        // leftBar: genFillBar(6, 12) → 6 filled + 6 empty
        // rightBar: genFillBar(0, 12) → all empty
        expect(bar.left.indexOf('\\u2588')).not.toBe(-1);
        expect(bar.right.indexOf('\\u2588')).toBe(-1);
    });

    it('center value (0.5): both bars empty', function () {
        const bar = calcSeqStepBar(0.5);
        expect(bar.left.indexOf('\\u2588')).toBe(-1);
        expect(bar.right.indexOf('\\u2588')).toBe(-1);
        expect(bar.center).toBe('\\u2502');
    });

});

// ---------------------------------------------------------------------------
// calcTypewriterChars
// ---------------------------------------------------------------------------

describe('calcTypewriterChars', function () {

    it('returns 1 char at start (elapsed=0)', function () {
        expect(calcTypewriterChars('HELLO', 0)).toBe(1);
    });

    it('returns correct number of chars based on elapsed time', function () {
        expect(calcTypewriterChars('HELLO', 65)).toBe(1);
        expect(calcTypewriterChars('HELLO', 130)).toBe(2);
        expect(calcTypewriterChars('HELLO', 260)).toBe(4);
    });

    it('does not exceed text length', function () {
        expect(calcTypewriterChars('HI', 1000)).toBe(2);
    });

    it('supports custom charMs interval', function () {
        expect(calcTypewriterChars('ABCDE', 200, 100)).toBe(2);
        expect(calcTypewriterChars('ABCDE', 200, 50)).toBe(4);
    });

    it('returns at least 1 char even for very small elapsed time', function () {
        expect(calcTypewriterChars('HELLO', -1)).toBe(1);
    });

});

// ---------------------------------------------------------------------------
// calcSeqFadeOpacity — sequencer crossfade
// ---------------------------------------------------------------------------

describe('calcSeqFadeOpacity', function () {

    it('phase="out" in first half, decreasing from 1.0', function () {
        let r = calcSeqFadeOpacity(0);
        expect(r.phase).toBe('out');
        expect(r.opacity).toBe(1.0);

        r = calcSeqFadeOpacity(20);
        expect(r.phase).toBe('out');
        expect(r.opacity).toBeCloseTo(0.5, 3);

        r = calcSeqFadeOpacity(39);
        expect(r.phase).toBe('out');
        expect(r.opacity).toBeCloseTo(0.025, 2);
    });

    it('phase="in" in second half, increasing from 0', function () {
        let r = calcSeqFadeOpacity(40);
        expect(r.phase).toBe('in');
        expect(r.opacity).toBeCloseTo(0.0, 3);

        r = calcSeqFadeOpacity(60);
        expect(r.phase).toBe('in');
        expect(r.opacity).toBeCloseTo(0.5, 3);
    });

    it('phase="done" after full cycle', function () {
        let r = calcSeqFadeOpacity(80);
        expect(r.phase).toBe('done');
        expect(r.opacity).toBe(1.0);

        r = calcSeqFadeOpacity(100);
        expect(r.phase).toBe('done');
        expect(r.opacity).toBe(1.0);
    });

    it('supports custom fadeHalf duration', function () {
        let r = calcSeqFadeOpacity(50, 50);
        expect(r.phase).toBe('in');
        expect(r.opacity).toBeCloseTo(0.0, 3);

        r = calcSeqFadeOpacity(100, 50);
        expect(r.phase).toBe('done');
    });

});
